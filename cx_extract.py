#!/usr/bin/env python3
"""
Checkmarx SAST Vulnerability Extractor
Extracts vulnerabilities from all projects in a Checkmarx SAST on-premise instance
into a timestamped CSV file using the report generation API.

Usage:
    python cx_extract.py --url https://cx.company.com --username admin --password secret \
        --excel projects.xlsx [--output-dir ./out] [--workers 6] [--incremental] [--no-verify-ssl] [--verbose]
"""

import argparse
import csv
import io
import json
import logging
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import openpyxl
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OUTPUT_COLUMNS = [
    "Entity", "ITPM ID", "Business App Name", "Checkmarx project name",
    "CX Project ID", "DORA Criticallity", "PCI DSS Relevance", "Internet Facing",
    "AGO SME", "Technical Contact", "LSO", "RSO",
    "Query", "QueryPath", "Custom",
    "PCI DSS v3.2.1", "OWASP TOP 10 2013", "FISMA 2014", "NIST SP 800-53",
    "OWASP Top 10 2017", "OWASP Mobile Top 10 2016", "OWASP Top 10 API",
    "ASD STIG 4.10", "OWASP Top 10 2010", "CWE top 25",
    "MOIS(KISA) Secure Coding 2021", "OWASP ASVS", "OWASP Top 10 2021",
    "SANS top 25", "ASA Mobile Premium", "ASA Premium", "Top Tier",
    "ASD STIG 5.3", "Base Preset", "OWASP Top 10 API 2023", "PCI DSS v4.0",
    "SrcFileName", "Line", "Column", "NodeId", "Name",
    "DestFileName", "DestLine", "DestColumn", "DestNodeId", "DestName",
    "Result State", "Result Severity", "Assigned To", "Comment", "Link",
    "Result Status", "Detection Date",
]

PROJECT_META_COLUMNS = [
    "Entity", "ITPM ID", "Business App Name", "Checkmarx project name",
    "CX Project ID", "DORA Criticallity", "PCI DSS Relevance", "Internet Facing",
    "AGO SME", "Technical Contact", "LSO", "RSO",
]

COMPLIANCE_COLUMNS = [
    "PCI DSS v3.2.1", "OWASP TOP 10 2013", "FISMA 2014", "NIST SP 800-53",
    "OWASP Top 10 2017", "OWASP Mobile Top 10 2016", "OWASP Top 10 API",
    "ASD STIG 4.10", "OWASP Top 10 2010", "CWE top 25",
    "MOIS(KISA) Secure Coding 2021", "OWASP ASVS", "OWASP Top 10 2021",
    "SANS top 25", "ASA Mobile Premium", "ASA Premium", "Top Tier",
    "ASD STIG 5.3", "Base Preset", "OWASP Top 10 API 2023", "PCI DSS v4.0",
]

COVERAGE_COLUMNS = [
    "CX Project ID", "Checkmarx project name", "Entity",
    "Last Scan ID", "Included In Extract", "Skip Reason",
]

AUTH_ENDPOINT    = "/cxrestapi/auth/identity/connect/token"
SCANS_ENDPOINT   = "/cxrestapi/sast/scans"
REPORTS_ENDPOINT = "/cxrestapi/reports/sastScan"
STATE_FILE_NAME  = "cx_state.json"

MAX_RETRIES          = 3
RETRY_BASE_WAIT      = 2.0   # seconds; doubles each attempt
REPORT_POLL_INTERVAL = 10    # seconds between status checks
REPORT_TIMEOUT       = 180   # seconds before giving up on a report


# ---------------------------------------------------------------------------
# Logging (thread-safe via stdlib's built-in locking)
# ---------------------------------------------------------------------------

def setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
    )


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def make_session(verify_ssl: bool) -> requests.Session:
    session = requests.Session()
    session.verify = verify_ssl
    if not verify_ssl:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    return session


def _do_request(session: requests.Session, method: str, url: str, **kwargs) -> requests.Response:
    """HTTP request with exponential-backoff retry on transient errors. Returns the raw Response."""
    last_exc = None
    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            wait = RETRY_BASE_WAIT * (2 ** (attempt - 1))
            logging.info(f"Retry {attempt}/{MAX_RETRIES} for {method.upper()} {url} — waiting {wait:.0f}s")
            time.sleep(wait)
        try:
            logging.debug(f"{method.upper()} {url}  params={kwargs.get('params')}")
            resp = session.request(method, url, timeout=120, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "?"
            logging.warning(f"HTTP {status} on {method.upper()} {url}: {exc}")
            if exc.response is not None and exc.response.status_code not in (429, 500, 502, 503, 504):
                raise
            last_exc = exc
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            logging.warning(f"Network error on {method.upper()} {url}: {exc}")
            last_exc = exc
    raise last_exc


def api_request(session: requests.Session, method: str, url: str, **kwargs):
    """HTTP request that returns parsed JSON."""
    return _do_request(session, method, url, **kwargs).json()


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def authenticate(session: requests.Session, base_url: str, username: str, password: str) -> None:
    logging.info("Authenticating with Checkmarx...")
    url = f"{base_url}{AUTH_ENDPOINT}"
    data = {
        "username": username,
        "password": password,
        "grant_type": "password",
        "scope": "sast_rest_api",
        "client_id": "resource_owner_client",
        "client_secret": "014DF517-39D1-4453-B7B3-9930C563627C",
    }
    resp = api_request(session, "POST", url, data=data)
    token = resp["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    logging.info("Authentication successful.")


# ---------------------------------------------------------------------------
# Incremental state file
# ---------------------------------------------------------------------------

def load_state(output_dir: Path) -> dict:
    """Load {str(cx_id): last_scan_id} from cx_state.json, or {} if missing."""
    state_path = output_dir / STATE_FILE_NAME
    if state_path.exists():
        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except Exception as exc:
            logging.warning(f"Could not read state file {state_path}: {exc} — starting fresh.")
    return {}


def save_state(output_dir: Path, state: dict) -> None:
    state_path = output_dir / STATE_FILE_NAME
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    logging.debug(f"State saved to {state_path}")


# ---------------------------------------------------------------------------
# Excel project metadata
# ---------------------------------------------------------------------------

def load_project_metadata(excel_path: str) -> dict:
    """
    Read the first sheet of the Excel file.
    Returns {cx_project_id (int): {column: value, ...}}.
    """
    logging.info(f"Loading project metadata from: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    if not rows:
        raise ValueError(f"Excel file is empty: {excel_path}")

    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    logging.debug(f"Excel columns: {headers}")

    missing = [c for c in PROJECT_META_COLUMNS if c not in headers]
    if missing:
        raise ValueError(f"Excel file is missing required columns: {missing}")

    col_idx = {h: i for i, h in enumerate(headers)}
    projects = {}
    skipped = 0

    for row in rows[1:]:
        if all(v is None for v in row):
            continue
        meta = {}
        for col in PROJECT_META_COLUMNS:
            raw = row[col_idx[col]]
            meta[col] = str(raw).strip() if raw is not None else ""

        try:
            cx_id = int(float(meta["CX Project ID"]))
        except (ValueError, TypeError):
            logging.warning(f"Skipping row — invalid CX Project ID: {meta['CX Project ID']!r}")
            skipped += 1
            continue

        meta["CX Project ID"] = str(cx_id)
        projects[cx_id] = meta

    logging.info(f"Loaded {len(projects)} projects from Excel ({skipped} rows skipped).")
    return projects


# ---------------------------------------------------------------------------
# Checkmarx API calls
# ---------------------------------------------------------------------------

def get_last_scan_id(session: requests.Session, base_url: str, project_id: int) -> int | None:
    """Return the most recent finished scan ID for a project, or None."""
    url = f"{base_url}{SCANS_ENDPOINT}"
    params = {"projectId": project_id, "last": 1, "scanStatus": "Finished"}
    data = api_request(session, "GET", url, params=params)

    scans = data if isinstance(data, list) else data.get("scans", [])
    if not scans:
        return None

    scan = scans[0]
    scan_id = scan.get("scanId") or scan.get("id")
    return int(scan_id) if scan_id is not None else None


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def order_scan_report(session: requests.Session, base_url: str, scan_id: int) -> int:
    """Request a CSV report for the given scan. Returns the reportId."""
    url = f"{base_url}{REPORTS_ENDPOINT}"
    data = api_request(session, "POST", url, json={"reportType": "CSV", "scanId": scan_id})
    return int(data["reportId"])


def wait_for_report(session: requests.Session, base_url: str, report_id: int) -> bool:
    """
    Poll the report status every REPORT_POLL_INTERVAL seconds.
    Returns True when status is "Created", False on timeout.
    """
    url = f"{base_url}{REPORTS_ENDPOINT}/{report_id}/status"
    deadline = time.monotonic() + REPORT_TIMEOUT

    while time.monotonic() < deadline:
        data = api_request(session, "GET", url)
        status = data.get("status", {})
        # API returns {"id": 2, "value": "Created"} or similar
        status_val = status.get("value") if isinstance(status, dict) else str(status)
        logging.debug(f"    Report {report_id} status: {status_val}")
        if status_val and status_val.lower() == "created":
            return True
        time.sleep(REPORT_POLL_INTERVAL)

    return False


def download_report_csv(
    session: requests.Session,
    base_url: str,
    report_id: int,
    output_dir: Path,
    project_name: str,
    scan_id: int,
) -> str:
    """
    Download the report CSV and save it to output_dir/reports/.
    Returns the raw CSV text for in-memory parsing.
    """
    url = f"{base_url}{REPORTS_ENDPOINT}/{report_id}"
    resp = _do_request(session, "GET", url)

    safe_name = re.sub(r'[\\/:*?"<>|]', "_", project_name).strip("_") or f"project_{scan_id}"
    reports_dir = output_dir / "reports"
    reports_dir.mkdir(exist_ok=True)
    file_path = reports_dir / f"{safe_name}_scan{scan_id}.csv"
    file_path.write_bytes(resp.content)
    logging.debug(f"    Report saved: {file_path}")

    return resp.text


# ---------------------------------------------------------------------------
# Row construction from report CSV
# ---------------------------------------------------------------------------

def _build_column_map(report_headers: list[str]) -> dict[str, str]:
    """
    Map each OUTPUT_COLUMN (non-meta) to the matching header in the report CSV.
    Matching is case-insensitive and strips whitespace.
    Returns {output_col: report_header} for columns that were found.
    """
    normalised = {h.strip().lower(): h for h in report_headers}
    mapping: dict[str, str] = {}
    for col in OUTPUT_COLUMNS:
        if col in PROJECT_META_COLUMNS:
            continue
        key = col.strip().lower()
        if key in normalised:
            mapping[col] = normalised[key]
    return mapping


def parse_report_rows(csv_text: str, project_meta: dict) -> list[dict]:
    """
    Parse the downloaded report CSV and merge each row with project_meta.
    Returns a list of dicts keyed by OUTPUT_COLUMNS.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    headers = reader.fieldnames or []
    col_map = _build_column_map(list(headers))

    rows = []
    for record in reader:
        row = {col: "" for col in OUTPUT_COLUMNS}
        for col in PROJECT_META_COLUMNS:
            row[col] = project_meta.get(col, "")
        for out_col, report_col in col_map.items():
            row[out_col] = (record.get(report_col) or "").strip()
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# Per-project worker (runs in thread pool)
# ---------------------------------------------------------------------------

def process_project(
    cx_id: int,
    meta: dict,
    session: requests.Session,
    base_url: str,
    output_dir: Path,
    prev_state: dict,
    incremental: bool,
    counter: list,      # [done, total] — mutable for progress display
    counter_lock: threading.Lock,
) -> tuple[list[dict], dict]:
    """
    Returns (rows, coverage_row).
    rows          — list of vulnerability dicts (empty if skipped/no scan)
    coverage_row  — dict for the scan_coverage CSV
    """
    proj_name = meta.get("Checkmarx project name") or str(cx_id)
    coverage_row = {
        "CX Project ID":          str(cx_id),
        "Checkmarx project name": proj_name,
        "Entity":                 meta.get("Entity", ""),
        "Last Scan ID":           "",
        "Included In Extract":    "No",
        "Skip Reason":            "",
    }

    try:
        scan_id = get_last_scan_id(session, base_url, cx_id)
        coverage_row["Last Scan ID"] = str(scan_id) if scan_id else ""

        if scan_id is None:
            coverage_row["Skip Reason"] = "No finished scan found"
            with counter_lock:
                counter[0] += 1
                logging.warning(f"[{counter[0]}/{counter[1]}] {proj_name} — no finished scan, skipping.")
            return [], coverage_row

        # Incremental: skip if scan ID unchanged
        if incremental and str(cx_id) in prev_state and prev_state[str(cx_id)] == scan_id:
            coverage_row["Skip Reason"] = "Scan unchanged (incremental mode)"
            with counter_lock:
                counter[0] += 1
                logging.info(f"[{counter[0]}/{counter[1]}] {proj_name} — scan {scan_id} unchanged, skipping.")
            return [], coverage_row

        # Step 1: order the report
        logging.debug(f"    [{proj_name}] Ordering CSV report for scan {scan_id}…")
        report_id = order_scan_report(session, base_url, scan_id)
        logging.debug(f"    [{proj_name}] Report {report_id} accepted — polling status…")

        # Step 2: wait for the report to be ready
        if not wait_for_report(session, base_url, report_id):
            raise TimeoutError(f"Report {report_id} did not reach 'Created' status within {REPORT_TIMEOUT}s")

        # Step 3: download and parse
        csv_text = download_report_csv(session, base_url, report_id, output_dir, proj_name, scan_id)
        rows = parse_report_rows(csv_text, meta)

        coverage_row["Included In Extract"] = "Yes"
        with counter_lock:
            counter[0] += 1
            logging.info(f"[{counter[0]}/{counter[1]}] {proj_name} — scan {scan_id} — {len(rows)} vulnerabilities.")

        return rows, coverage_row

    except Exception as exc:
        coverage_row["Skip Reason"] = f"Error: {exc}"
        with counter_lock:
            counter[0] += 1
            logging.error(f"[{counter[0]}/{counter[1]}] {proj_name} — ERROR: {exc}")
        return [], coverage_row


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract Checkmarx SAST vulnerabilities to a timestamped CSV file.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--url",      required=True, help="Checkmarx server base URL, e.g. https://cx.company.com")
    parser.add_argument("--username", required=True, help="Checkmarx username")
    parser.add_argument("--password", required=True, help="Checkmarx password")
    parser.add_argument("--excel",    required=True, help="Path to the project metadata Excel file (.xlsx)")
    parser.add_argument("--output-dir", default=".", help="Directory where output files will be written")
    parser.add_argument("--workers",  type=int, default=6,
                        help="Number of parallel threads for project extraction")
    parser.add_argument("--incremental", action="store_true",
                        help="Skip projects whose last scan ID hasn't changed since the previous run")
    parser.add_argument("--force", action="store_true",
                        help="Ignore incremental state and re-extract everything")
    parser.add_argument("--no-verify-ssl", action="store_true",
                        help="Disable SSL certificate verification (useful for self-signed certs)")
    parser.add_argument("--verbose", action="store_true",
                        help="Enable debug-level logging")
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    setup_logging(args.verbose)

    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir  = Path(args.output_dir)
    output_path = output_dir / f"vulnerability_extract_{timestamp}.csv"
    coverage_path = output_dir / f"scan_coverage_{timestamp}.csv"
    base_url    = args.url.rstrip("/")

    output_dir.mkdir(parents=True, exist_ok=True)
    session = make_session(verify_ssl=not args.no_verify_ssl)

    try:
        authenticate(session, base_url, args.username, args.password)
        projects = load_project_metadata(args.excel)

        # Incremental state
        prev_state: dict = {}
        if args.incremental and not args.force:
            prev_state = load_state(output_dir)
            logging.info(f"Incremental mode: {len(prev_state)} projects in state cache.")
        elif args.force:
            logging.info("--force: ignoring state cache.")

        total   = len(projects)
        counter = [0, total]           # [done, total]
        counter_lock = threading.Lock()

        all_rows: list[dict]      = []
        coverage_rows: list[dict] = []
        new_state: dict           = dict(prev_state)  # carry forward unchanged entries
        rows_lock = threading.Lock()

        logging.info(f"Processing {total} projects with {args.workers} parallel workers…")

        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = {
                pool.submit(
                    process_project,
                    cx_id, meta, session, base_url, output_dir,
                    prev_state, args.incremental,
                    counter, counter_lock,
                ): cx_id
                for cx_id, meta in projects.items()
            }

            for future in as_completed(futures):
                cx_id = futures[future]
                try:
                    rows, cov_row = future.result()
                    with rows_lock:
                        all_rows.extend(rows)
                        coverage_rows.append(cov_row)
                        if cov_row["Included In Extract"] == "Yes" and cov_row["Last Scan ID"]:
                            new_state[str(cx_id)] = int(cov_row["Last Scan ID"])
                except Exception as exc:
                    logging.error(f"Unexpected error for project {cx_id}: {exc}")

        # Sort coverage rows by project name for readability
        coverage_rows.sort(key=lambda r: r.get("Checkmarx project name", "").lower())

        total_vulns = len(all_rows)
        included    = sum(1 for r in coverage_rows if r["Included In Extract"] == "Yes")
        skipped     = total - included

        logging.info(f"Extraction complete: {included}/{total} projects included, {skipped} skipped.")
        logging.info(f"Writing {total_vulns} vulnerabilities to: {output_path}")

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
            writer.writeheader()
            writer.writerows(all_rows)

        logging.info(f"Writing scan coverage report to: {coverage_path}")
        with open(coverage_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=COVERAGE_COLUMNS)
            writer.writeheader()
            writer.writerows(coverage_rows)

        if args.incremental and not args.force:
            save_state(output_dir, new_state)

    except KeyboardInterrupt:
        logging.info("Interrupted by user.")
        sys.exit(130)
    except Exception as exc:
        logging.error(f"Fatal: {exc}", exc_info=args.verbose)
        sys.exit(1)


if __name__ == "__main__":
    main()
