# Checkmarx SAST Security Toolkit

End-to-end toolchain for extracting and visualising SAST vulnerabilities from a Checkmarx on-premise instance.

| Component | Description |
|---|---|
| `cx_extract.py` | Python CLI/pipeline script — pulls vulnerabilities from the CX REST API and writes a timestamped CSV |
| `cx-dashboard/` | React + TypeScript SPA — loads the CSV extracts and displays interactive KPI/KRI dashboards with trend comparison |

---

## Part 1 — Extractor (`cx_extract.py`)

Extracts all SAST vulnerabilities from a Checkmarx on-premise instance into a timestamped CSV file, combining per-project metadata from an Excel file with scan results from the REST API.

### Requirements

- Python 3.10+

```bash
pip install requests openpyxl
```

### Usage

```bash
python cx_extract.py \
  --url https://cx.company.com \
  --username <username> \
  --password <password> \
  --excel <path-to-excel-file.xlsx> \
  [--output-dir <output-directory>] \
  [--no-verify-ssl] \
  [--verbose]
```

#### Arguments

| Argument | Required | Description |
|---|---|---|
| `--url` | Yes | Checkmarx server base URL (e.g. `https://cx.company.com`) |
| `--username` | Yes | Checkmarx username |
| `--password` | Yes | Checkmarx password |
| `--excel` | Yes | Path to the project metadata Excel file (`.xlsx`) |
| `--output-dir` | No | Directory where the output CSV is written (default: current directory) |
| `--no-verify-ssl` | No | Disable SSL certificate verification (useful for self-signed certificates) |
| `--verbose` | No | Enable debug-level logging |

#### Examples

Basic run:
```bash
python cx_extract.py --url https://cx.company.com --username admin --password s3cr3t --excel projects.xlsx
```

Pipeline run with output directory and no SSL verification:
```bash
python cx_extract.py \
  --url https://cx.internal \
  --username $CX_USER \
  --password $CX_PASS \
  --excel projects.xlsx \
  --output-dir ./reports \
  --no-verify-ssl
```

### Input: Excel File

The Excel file must contain a single sheet with at least the following columns (column order does not matter):

| Column | Description |
|---|---|
| `Entity` | Business entity |
| `ITPM ID` | IT portfolio management identifier |
| `Business App Name` | Business application name |
| `Checkmarx project name` | Project name as it appears in Checkmarx |
| `CX Project ID` | Numeric Checkmarx project ID |
| `DORA Criticallity` | DORA criticality classification |
| `PCI DSS Relevance` | PCI DSS relevance flag |
| `Internet Facing` | Whether the application is internet-facing |
| `AGO SME` | AGO subject matter expert |
| `Technical Contact` | Technical point of contact |
| `LSO` | Local security officer |
| `RSO` | Regional security officer |

### Output: CSV File

The script writes `vulnerability_extract_<YYYYMMDD_HHMMSS>.csv` to the output directory. Each row represents one vulnerability. The file is UTF-8 encoded with BOM for Excel compatibility.

#### Columns

| Source | Columns |
|---|---|
| Excel file | `Entity`, `ITPM ID`, `Business App Name`, `Checkmarx project name`, `CX Project ID`, `DORA Criticallity`, `PCI DSS Relevance`, `Internet Facing`, `AGO SME`, `Technical Contact`, `LSO`, `RSO` |
| Query metadata | `Query`, `QueryPath`, `Custom` |
| Compliance tags | `PCI DSS v3.2.1`, `OWASP TOP 10 2013`, `FISMA 2014`, `NIST SP 800-53`, `OWASP Top 10 2017`, `OWASP Mobile Top 10 2016`, `OWASP Top 10 API`, `ASD STIG 4.10`, `OWASP Top 10 2010`, `CWE top 25`, `MOIS(KISA) Secure Coding 2021`, `OWASP ASVS`, `OWASP Top 10 2021`, `SANS top 25`, `ASA Mobile Premium`, `ASA Premium`, `Top Tier`, `ASD STIG 5.3`, `Base Preset`, `OWASP Top 10 API 2023`, `PCI DSS v4.0` |
| Source node | `SrcFileName`, `Line`, `Column`, `NodeId`, `Name` |
| Sink node | `DestFileName`, `DestLine`, `DestColumn`, `DestNodeId`, `DestName` |
| Result metadata | `Result State`, `Result Severity`, `Assigned To`, `Comment`, `Link`, `Result Status`, `Detection Date` |

### How It Works

1. **Authentication** — POSTs credentials to `/cxrestapi/auth/identity/connect/token` and attaches the returned Bearer token to all subsequent requests.
2. **Project metadata** — Reads the Excel file to build a dictionary of project-level attributes keyed by `CX Project ID`.
3. **Last scan lookup** — For each project, calls `GET /cxrestapi/sast/scans?projectId={id}&last=1&scanStatus=Finished` to retrieve the most recent finished scan.
4. **Vulnerability extraction** — Paginates through `GET /cxrestapi/sast/results?scanId={id}&offset=0&limit=500` to collect all vulnerabilities for each scan.
5. **CSV output** — Merges project metadata with scan results and writes the combined rows to the output CSV.

### Retry Behaviour

Every API call is retried up to 3 times on network errors or HTTP 429/5xx responses, with exponential backoff (2 s → 4 s → 8 s). Non-retryable HTTP errors (4xx) fail immediately.

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Fatal error (authentication failure, missing Excel columns, unrecoverable API error, etc.) |
| `130` | Interrupted by user (Ctrl+C) |

---

## Part 2 — Analytics Dashboard (`cx-dashboard/`)

A browser-based analytics SPA that loads one or more `vulnerability_extract_*.csv` files and displays interactive KPI/KRI visualisations with a modern cybersecurity dark theme — no backend required.

### Requirements

- Node.js 18+

```bash
cd cx-dashboard
npm install
npm run dev      # development server → http://localhost:5173
npm run build    # production build → dist/
```

### Pages

| Page | Content |
|---|---|
| **Overview** | KPI cards (total, severity breakdown, internet-facing exposure, assignment rate) + severity donut + result state pie + top 10 vulnerability types + DORA risk matrix |
| **Projects** | Horizontal bar of top 15 projects by vulnerability count + searchable per-project table with High / Medium / Low / Info breakdown |
| **Compliance** | KPI cards (active frameworks, high-coverage count, average coverage) + framework coverage bar chart + detail table with inline progress bars |
| **Trends** | Line chart of any severity metric over time + stacked severity bar per extract + extract comparison table with delta (Δ) column |

### Loading Data

1. Click **Upload Extracts** in the sidebar (or drag-and-drop CSV files onto the drop zone).
2. Load as many `vulnerability_extract_*.csv` files as needed — each is assigned a distinct colour.
3. Switch the active extract using the coloured dots in the top bar; the Trends page always shows all loaded extracts together for comparison.

The dashboard auto-parses the timestamp from the filename (`vulnerability_extract_YYYYMMDD_HHMMSS.csv`) so extracts are sorted chronologically on the Trends page.

### Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (custom dark cybersecurity theme) |
| Charts | Recharts |
| CSV parsing | PapaParse |
| Routing | React Router v6 |
| Icons | Lucide React |
