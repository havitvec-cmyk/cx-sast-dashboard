# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Two independent components:

- **`cx_extract.py`** — Python CLI that hits the Checkmarx SAST on-premise REST API (v9.6) and outputs a timestamped vulnerability CSV plus a scan coverage CSV.
- **`cx-dashboard/`** — React + TypeScript SPA that ingests those CSVs and renders an interactive security analytics dashboard.

---

## Extractor (`cx_extract.py`)

### Setup & Run

```bash
pip install requests openpyxl
python cx_extract.py \
  --url https://cx.company.com \
  --username admin --password secret \
  --excel projects.xlsx \
  [--output-dir ./out] \
  [--workers 6] \
  [--incremental] \
  [--force] \
  [--no-verify-ssl] \
  [--verbose]
```

### Key architecture decisions

- **Authentication**: POST to `/cxrestapi/auth/identity/connect/token` with `grant_type=password`, `client_id=resource_owner_client`, `client_secret=014DF517-39D1-4453-B7B3-9930C563627C`. Bearer token set on `requests.Session`.
- **Retry logic**: `api_request()` wraps all HTTP calls with exponential backoff (2s → 4s → 8s, max 3 retries) on 429 / 5xx / network errors.
- **Parallelism**: `ThreadPoolExecutor` with `--workers` (default 6) processes one project per thread. Row accumulation guarded by `threading.Lock`. Progress printed as `[done/total]`.
- **Incremental mode**: `cx_state.json` caches the last scan ID per `CX Project ID`. `--incremental` skips projects whose scan ID hasn't changed. `--force` ignores the cache.
- **Project metadata**: Read from Excel (`projects.xlsx`) — columns `Entity`, `ITPM ID`, `Business App Name`, `Checkmarx project name`, `CX Project ID`, `DORA Criticallity`, `PCI DSS Relevance`, `Internet Facing`, `AGO SME`, `Technical Contact`, `LSO`, `RSO`. Column order in the sheet may vary; matching is by header name.
- **Vulnerability extraction via reports** (3-step per project):
  1. POST `/cxrestapi/reports/sastScan` with `{"reportType": "CSV", "scanId": <id>}` → `reportId` (HTTP 202).
  2. Poll `/cxrestapi/reports/sastScan/{reportId}/status` every 10 s until `status.value == "Created"` (timeout 180 s).
  3. GET `/cxrestapi/reports/sastScan/{reportId}` → raw CSV bytes. Saved to `output_dir/reports/{safe_project_name}_scan{scan_id}.csv` and parsed in-memory. Column mapping from the CX report headers to `OUTPUT_COLUMNS` is case-insensitive (`_build_column_map`).
- **Outputs**:
  - `vulnerability_extract_{YYYYMMDD_HHMMSS}.csv` — one row per finding, 54 columns.
  - `scan_coverage_{YYYYMMDD_HHMMSS}.csv` — one row per project; includes projects with no finished scan.

---

## Dashboard (`cx-dashboard/`)

### Commands

```bash
cd cx-dashboard
npm install
npm run dev        # Vite dev server — http://localhost:5173
npm run build      # tsc type-check + Vite production build
npm run preview    # serve the production build locally
```

There is no test suite. `npm run build` serves as the CI gate (tsc + Vite must both pass).

### Architecture

**State** lives in `src/context/ExtractContext.tsx` (`ExtractProvider`):
- `extracts[]` — in-memory list of loaded `Extract` objects (id, name, timestamp, rows, color).
- `activeId` — which extract drives all charts.
- `filter: FilterState` — global `{ severity, entity, project, state }` filter; applied to produce `filteredRows` (memoized).
- `slaConfig: SlaConfig` — persisted to `localStorage` as `cx_sla_config`; defaults `{ high: 90, medium: 180, low: 365 }` days.

Most pages consume `filteredRows` (respects active filter) via `useExtracts()`. Remediation uses raw `extract.rows` for aging/SLA calculations so filters don't skew the governance view.

**Data flow**:
```
FileUpload → PapaParse → ExtractContext.addExtract()
                                  ↓
              useActiveExtract() / useExtracts().filteredRows
                                  ↓
                    computeMetrics / computeRiskScores / computeAging / …
                                  ↓
                         Recharts chart components
```

**Key utilities** (`src/utils/metrics.ts`):
- `computeMetrics(rows)` → `Metrics` — total, bySeverity, byState, byProject, byQuery, byEntity, byDoraCriticality, internetFacing, assignedVsUnassigned, complianceCoverage, byStatus.
- `computeRiskScores(rows)` → `ProjectRiskScore[]` sorted descending by composite score: `(High×10 + Medium×4 + Low×1) × DORA_weight × internet_facing_multiplier`.
- `computeAging(rows, slaConfig)` → age buckets (0–30d / 31–90d / 91–180d / 181+d), `avgAgeDays`, `maxAgeDays`, `slaBreach` by severity.
- `computeQueryHealth(rows)` → FP rate and recurrence rate per query. **FP is defined broadly**: `FP_EQUIVALENT_STATES` covers "false positive", "not exploitable", "propose not exploitable", "proposed not exploitable". Import this set when checking suppressed status elsewhere.
- `computeLanguageBreakdown`, `computeFileHotspots`, `computeEntityRollup` — supporting analytics.

**Routing** (React Router v6, `src/App.tsx`):

| Path | Page |
|---|---|
| `/` | Overview — KPI cards, severity donut (clickable filter), state distribution, risk matrix, language breakdown |
| `/projects` | Projects — vuln counts table, file hotspots, new-vs-recurrent bar chart |
| `/risk` | Risk Portfolio — composite score grid + ranking table + entity rollup |
| `/remediation` | Remediation — SLA editor, age histogram, assignee workload, AGO SME workload, oldest-vuln table, query health table |
| `/compliance` | Compliance — framework coverage chart + detail table |
| `/trends` | Trends — metric line chart (supports Total / H / M / L / Info / New / Recurrent), stacked severity bar, comparison table |

**Types** (`src/types/index.ts`):
- `VulnerabilityRow` — all 54 CSV columns typed as `string`.
- `FilterState` + `applyFilter()` + `filterLabel()` — filter logic lives here.
- `COMPLIANCE_FIELDS as const` — the 21 compliance framework column names.
- `SlaConfig` has an `[key: string]: number` index signature — required so it can be used as `Record<string, number>` in pages.

**CSV parsing** (`src/utils/csvParser.ts`): `parseCSV(file)` via PapaParse. Extract timestamp is parsed from the filename pattern `YYYYMMDD_HHMMSS`.

**Export pattern**: All pages with tables use PapaParse `unparse()` + a temporary `<a>` element for download — no server involved.

**Styling**: Tailwind CSS with a custom dark cybersecurity theme (colors: `cyber-surface`, `cyber-border`, `cyber-cyan`, `cyber-card`, `cyber-bg`). Defined in `tailwind.config.js`. No component library — all UI is custom.

### Adding a new chart or metric

1. Add a compute function to `src/utils/metrics.ts` (pure function over `VulnerabilityRow[]`).
2. Call it with `useMemo` in the relevant page, passing `filteredRows` or `extract.rows` as appropriate.
3. Drop a Recharts component in `src/components/charts/`.
4. Wrap it in `<ChartCard>` for consistent styling — accepts `title`, `subtitle`, and an optional `actions` slot (used for export buttons).
