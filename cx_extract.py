#!/usr/bin/env python3
"""
Checkmarx SAST Vulnerability Extractor
Extracts vulnerabilities from all projects in a Checkmarx SAST on-premise instance
into a timestamped CSV file.

Usage:
    python cx_extract.py --url https://cx.company.com --username admin --password secret \
        --excel projects.xlsx [--output-dir ./out] [--no-verify-ssl] [--verbose]
"""

import argparse
import csv
import logging
import sys
import time
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

AUTH_ENDPOINT = "/cxrestapi/auth/identity/connect/token"
SCANS_ENDPOINT = "/cxrestapi/sast/scans"
RESULTS_ENDPOINT = "/cxrestapi/sast/results"

PAGE_SIZE = 500
MAX_RETRIES = 3
RETRY_BASE_WAIT = 2.0  # seconds; doubles each attempt


# ---------------------------------------------------------------------------
# Logging
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


def api_request(session: requests.Session, method: str, url: str, **kwargs):
    """HTTP request with exponential-backoff retry on transient errors."""
    last_exc = None
    for attempt in range(MAX_RETRIES + 1):
        if attempt > 0:
            wait = RETRY_BASE_WAIT * (2 ** (attempt - 1))
            logging.info(f"Retry {attempt}/{MAX_RETRIES} for {method.upper()} {url} — waiting {wait:.0f}s")
            time.sleep(wait)
        try:
            logging.debug(f"{method.upper()} {url}  params={kwargs.get('params')}")
            resp = session.request(method, url, timeout=60, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "?"
            logging.warning(f"HTTP {status} on {method.upper()} {url}: {exc}")
            # 4xx errors (except 429) are not retryable
            if exc.response is not None and exc.response.status_code not in (429, 500, 502, 503, 504):
                raise
            last_exc = exc
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            logging.warning(f"Network error on {method.upper()} {url}: {exc}")
            last_exc = exc
    raise last_exc


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
    # Different API versions use 'scanId' or 'id'
    scan_id = scan.get("scanId") or scan.get("id")
    return int(scan_id) if scan_id is not None else None


def get_scan_results(session: requests.Session, base_url: str, scan_id: int) -> list:
    """Retrieve all results for a scan using offset/limit pagination."""
    url = f"{base_url}{RESULTS_ENDPOINT}"
    all_results = []
    offset = 0

    while True:
        params = {"scanId": scan_id, "offset": offset, "limit": PAGE_SIZE}
        data = api_request(session, "GET", url, params=params)

        if isinstance(data, list):
            page = data
        elif isinstance(data, dict):
            page = data.get("results") or data.get("Results") or []
        else:
            break

        all_results.extend(page)
        logging.debug(f"    Page offset={offset}: {len(page)} results (total so far: {len(all_results)})")

        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    return all_results


# ---------------------------------------------------------------------------
# Row construction
# ---------------------------------------------------------------------------

def _str(val) -> str:
    return str(val).strip() if val is not None else ""


def extract_nodes(nodes: list) -> tuple:
    """Return (src_file, src_line, src_col, src_nodeid, src_name, dst_*) from nodes list."""
    empty = ("", "", "", "", "")
    if not nodes:
        return empty + empty
    src = nodes[0]
    dst = nodes[-1]
    return (
        _str(src.get("fileName")), _str(src.get("line")), _str(src.get("column")),
        _str(src.get("nodeId")), _str(src.get("name")),
        _str(dst.get("fileName")), _str(dst.get("line")), _str(dst.get("column")),
        _str(dst.get("nodeId")), _str(dst.get("name")),
    )


def extract_compliance(query: dict) -> dict:
    """
    Extract compliance tag values from a query object.
    Checkmarx may expose them as a dict, a list of {name, value} pairs,
    or directly as top-level keys on the query object.
    """
    result = {col: "" for col in COMPLIANCE_COLUMNS}
    if not query:
        return result

    # Try nested compliance dict / list
    raw = (
        query.get("categories")
        or query.get("compliance")
        or query.get("tags")
        or query.get("complianceFrameworks")
    )

    if isinstance(raw, dict):
        for col in COMPLIANCE_COLUMNS:
            val = raw.get(col, "")
            result[col] = _str(val)
    elif isinstance(raw, list):
        for item in raw:
            name = _str(item.get("name") or item.get("complianceName", ""))
            if name in result:
                result[name] = _str(item.get("value") or item.get("data", ""))
    else:
        # Fall back: check top-level query keys that match compliance column names
        for col in COMPLIANCE_COLUMNS:
            val = query.get(col)
            if val is not None:
                result[col] = _str(val)

    return result


def build_row(project_meta: dict, result: dict) -> dict:
    row = {col: "" for col in OUTPUT_COLUMNS}

    # Project metadata
    for col in PROJECT_META_COLUMNS:
        row[col] = project_meta.get(col, "")

    # Query info (may be nested under 'query' key or flat on result)
    query = result.get("query") or {}
    row["Query"] = _str(query.get("name") or result.get("queryName") or result.get("query"))
    row["QueryPath"] = _str(
        query.get("queryPath") or query.get("group") or result.get("queryPath") or result.get("group")
    )
    is_custom = query.get("isCustom") if query else result.get("isCustom")
    row["Custom"] = _str(is_custom) if is_custom is not None else ""

    # Compliance
    row.update(extract_compliance(query if query else result))

    # Nodes
    nodes = result.get("nodes") or result.get("Nodes") or []
    (
        row["SrcFileName"], row["Line"], row["Column"], row["NodeId"], row["Name"],
        row["DestFileName"], row["DestLine"], row["DestColumn"], row["DestNodeId"], row["DestName"],
    ) = extract_nodes(nodes)

    # Result metadata — try multiple field name variants for API version tolerance
    row["Result State"] = _str(result.get("state") or result.get("resultState"))
    row["Result Severity"] = _str(result.get("severity") or result.get("resultSeverity"))
    row["Assigned To"] = _str(result.get("assignedTo") or result.get("assignedUser"))
    row["Comment"] = _str(result.get("comment"))
    row["Link"] = _str(result.get("deepLink") or result.get("link"))
    row["Result Status"] = _str(result.get("status") or result.get("resultStatus"))
    row["Detection Date"] = _str(result.get("detectionDate"))

    return row


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract Checkmarx SAST vulnerabilities to a timestamped CSV file.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--url", required=True,
                        help="Checkmarx server base URL, e.g. https://cx.company.com")
    parser.add_argument("--username", required=True, help="Checkmarx username")
    parser.add_argument("--password", required=True, help="Checkmarx password")
    parser.add_argument("--excel", required=True,
                        help="Path to the project metadata Excel file (.xlsx)")
    parser.add_argument("--output-dir", default=".",
                        help="Directory where the output CSV will be written")
    parser.add_argument("--no-verify-ssl", action="store_true",
                        help="Disable SSL certificate verification (useful for self-signed certs)")
    parser.add_argument("--verbose", action="store_true",
                        help="Enable debug-level logging")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.verbose)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = Path(args.output_dir) / f"vulnerability_extract_{timestamp}.csv"
    base_url = args.url.rstrip("/")

    session = make_session(verify_ssl=not args.no_verify_ssl)

    try:
        authenticate(session, base_url, args.username, args.password)
        projects = load_project_metadata(args.excel)

        total_vulns = 0
        all_rows = []

        for cx_id, meta in projects.items():
            proj_name = meta.get("Checkmarx project name") or str(cx_id)
            logging.info(f"[{cx_id}] {proj_name}")

            scan_id = get_last_scan_id(session, base_url, cx_id)
            if scan_id is None:
                logging.warning(f"  No finished scan found — skipping.")
                continue

            logging.info(f"  Last finished scan ID: {scan_id}")
            results = get_scan_results(session, base_url, scan_id)
            logging.info(f"  Vulnerabilities found: {len(results)}")

            for result in results:
                all_rows.append(build_row(meta, result))

            total_vulns += len(results)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        logging.info(f"Writing {total_vulns} vulnerabilities to: {output_path}")

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
            writer.writeheader()
            writer.writerows(all_rows)

        logging.info("Extraction complete.")

    except KeyboardInterrupt:
        logging.info("Interrupted by user.")
        sys.exit(130)
    except Exception as exc:
        logging.error(f"Fatal: {exc}", exc_info=args.verbose)
        sys.exit(1)


if __name__ == "__main__":
    main()
