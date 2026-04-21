import type { VulnerabilityRow, Metrics, SeverityBreakdown } from '../types';
import { COMPLIANCE_FIELDS } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBy(rows: VulnerabilityRow[], key: keyof VulnerabilityRow): Record<string, number> {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const val = (row[key] ?? '').toString().trim() || 'Unknown';
    result[val] = (result[val] || 0) + 1;
  }
  return result;
}

function topN(obj: Record<string, number>, n: number): [string, number][] {
  return Object.entries(obj)
    .filter(([k]) => k && k !== 'Unknown')
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function normalizeSeverity(raw: string): keyof SeverityBreakdown | null {
  const v = raw.trim().toLowerCase();
  if (v === 'high')   return 'High';
  if (v === 'medium') return 'Medium';
  if (v === 'low')    return 'Low';
  if (v === 'info' || v === 'information') return 'Info';
  return null;
}

// ---------------------------------------------------------------------------
// Core metrics
// ---------------------------------------------------------------------------

export function computeMetrics(rows: VulnerabilityRow[]): Metrics {
  const bySeverity: SeverityBreakdown = { High: 0, Medium: 0, Low: 0, Info: 0 };
  const internetFacing = { yes: 0, no: 0, unknown: 0 };
  const assignedVsUnassigned = { assigned: 0, unassigned: 0 };

  for (const row of rows) {
    const sev = normalizeSeverity(row['Result Severity'] || '');
    if (sev) bySeverity[sev]++;

    const facing = (row['Internet Facing'] || '').toLowerCase().trim();
    if (['yes', 'true', '1', 'y'].includes(facing)) internetFacing.yes++;
    else if (['no', 'false', '0', 'n'].includes(facing)) internetFacing.no++;
    else internetFacing.unknown++;

    const assigned = (row['Assigned To'] || '').trim();
    if (assigned && assigned.toLowerCase() !== 'unassigned') assignedVsUnassigned.assigned++;
    else assignedVsUnassigned.unassigned++;
  }

  const complianceCoverage: Record<string, number> = {};
  for (const field of COMPLIANCE_FIELDS) {
    complianceCoverage[field] = rows.filter((r) => {
      const val = (r[field as keyof VulnerabilityRow] || '').toString().trim();
      return val !== '' && val !== '-' && val.toLowerCase() !== 'n/a';
    }).length;
  }

  return {
    total: rows.length,
    bySeverity,
    byState:          countBy(rows, 'Result State'),
    byProject:        countBy(rows, 'Checkmarx project name'),
    byQuery:          topN(countBy(rows, 'Query'), 10),
    byEntity:         countBy(rows, 'Entity'),
    byDoraCriticality: countBy(rows, 'DORA Criticallity'),
    internetFacing,
    assignedVsUnassigned,
    complianceCoverage,
    byStatus:         countBy(rows, 'Result Status'),
  };
}

// ---------------------------------------------------------------------------
// Risk score
// ---------------------------------------------------------------------------

const DORA_WEIGHT: Record<string, number> = {
  critical: 2.0,
  high:     1.5,
  medium:   1.0,
  low:      0.5,
};

export interface ProjectRiskScore {
  projectName: string;
  projectId: string;
  entity: string;
  dora: string;
  internetFacing: boolean;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  score: number;
}

export function computeRiskScores(rows: VulnerabilityRow[]): ProjectRiskScore[] {
  const map = new Map<string, ProjectRiskScore>();

  for (const row of rows) {
    const key = row['CX Project ID'] || row['Checkmarx project name'];
    if (!map.has(key)) {
      const facing = (row['Internet Facing'] || '').toLowerCase().trim();
      map.set(key, {
        projectName:   row['Checkmarx project name'] || key,
        projectId:     row['CX Project ID'],
        entity:        row['Entity'],
        dora:          row['DORA Criticallity'],
        internetFacing: ['yes', 'true', '1', 'y'].includes(facing),
        high: 0, medium: 0, low: 0, info: 0, total: 0, score: 0,
      });
    }
    const p = map.get(key)!;
    const sev = normalizeSeverity(row['Result Severity'] || '');
    if (sev === 'High')   p.high++;
    else if (sev === 'Medium') p.medium++;
    else if (sev === 'Low')    p.low++;
    else if (sev === 'Info')   p.info++;
    p.total++;
  }

  for (const p of map.values()) {
    const raw = (p.high * 10) + (p.medium * 4) + (p.low * 1);
    const doraW = DORA_WEIGHT[p.dora.toLowerCase()] ?? 1.0;
    const facingW = p.internetFacing ? 1.5 : 1.0;
    p.score = Math.round(raw * doraW * facingW);
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Vulnerability aging
// ---------------------------------------------------------------------------

export interface AgingBucket {
  label: string;
  days: [number, number]; // [min, max] inclusive, max=-1 means open-ended
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface AgingMetrics {
  buckets: AgingBucket[];
  avgAgeDays: number;
  maxAgeDays: number;
  slaBreach: { high: number; medium: number; low: number };
}

const BUCKETS: { label: string; days: [number, number] }[] = [
  { label: '0–30 d',  days: [0,   30]  },
  { label: '31–90 d', days: [31,  90]  },
  { label: '91–180 d',days: [91,  180] },
  { label: '181+ d',  days: [181, -1]  },
];

function parseDetectionDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function daysSince(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function computeAging(rows: VulnerabilityRow[], slaConfig?: Record<string, number>): AgingMetrics {
  const sla = { high: 90, medium: 180, low: 365, ...slaConfig };

  const buckets: AgingBucket[] = BUCKETS.map((b) => ({
    ...b, high: 0, medium: 0, low: 0, info: 0, total: 0,
  }));

  let totalAge = 0;
  let maxAge   = 0;
  let counted  = 0;
  const slaBreach = { high: 0, medium: 0, low: 0 };

  for (const row of rows) {
    const date = parseDetectionDate(row['Detection Date']);
    if (!date) continue;
    const age = daysSince(date);
    totalAge += age;
    maxAge    = Math.max(maxAge, age);
    counted++;

    const sev = normalizeSeverity(row['Result Severity'] || '');

    // SLA breach
    if (sev === 'High'   && age > sla.high)   slaBreach.high++;
    if (sev === 'Medium' && age > sla.medium) slaBreach.medium++;
    if (sev === 'Low'    && age > sla.low)    slaBreach.low++;

    // Bucket
    for (const bucket of buckets) {
      const [min, max] = bucket.days;
      if (age >= min && (max === -1 || age <= max)) {
        bucket.total++;
        if (sev === 'High')   bucket.high++;
        else if (sev === 'Medium') bucket.medium++;
        else if (sev === 'Low')    bucket.low++;
        else if (sev === 'Info')   bucket.info++;
        break;
      }
    }
  }

  return {
    buckets,
    avgAgeDays: counted > 0 ? Math.round(totalAge / counted) : 0,
    maxAgeDays: maxAge,
    slaBreach,
  };
}

// ---------------------------------------------------------------------------
// Language breakdown (from SrcFileName extension)
// ---------------------------------------------------------------------------

const EXT_TO_LANG: Record<string, string> = {
  java:  'Java',    cs:    'C#',      cpp: 'C/C++',   c: 'C/C++',
  py:    'Python',  js:    'JavaScript', ts: 'TypeScript',
  php:   'PHP',     go:    'Go',       rb:  'Ruby',
  swift: 'Swift',   kt:    'Kotlin',   vb:  'VB.NET',
  scala: 'Scala',   groovy:'Groovy',  rs:  'Rust',
  html:  'HTML',    jsp:   'JSP',      aspx:'ASP.NET',
  pl:    'Perl',    sh:    'Shell',    tf:  'Terraform',
};

export function computeLanguageBreakdown(rows: VulnerabilityRow[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const file = row['SrcFileName'] || '';
    const ext  = file.split('.').pop()?.toLowerCase() ?? '';
    const lang = EXT_TO_LANG[ext] ?? (ext ? `Other (${ext})` : 'Unknown');
    counts[lang] = (counts[lang] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([k]) => k !== 'Unknown')
    .sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Query health (FP + recurrence rates)
// ---------------------------------------------------------------------------

// "Not Exploitable" and its variants are treated as suppressed/false-positive
export const FP_EQUIVALENT_STATES = new Set([
  'false positive',
  'not exploitable',
  'propose not exploitable',
  'proposed not exploitable',
]);

export interface QueryHealth {
  query: string;
  total: number;
  recurrent: number;
  falsePositive: number;
  fpRate: number;
  recurrenceRate: number;
}

export function computeQueryHealth(rows: VulnerabilityRow[]): QueryHealth[] {
  const map = new Map<string, { total: number; recurrent: number; fp: number }>();

  for (const row of rows) {
    const q = (row['Query'] || 'Unknown').trim();
    if (!map.has(q)) map.set(q, { total: 0, recurrent: 0, fp: 0 });
    const entry = map.get(q)!;
    entry.total++;
    const state = (row['Result State'] || '').toLowerCase();
    if (state === 'recurrent') entry.recurrent++;
    if (FP_EQUIVALENT_STATES.has(state)) entry.fp++;
  }

  return Array.from(map.entries())
    .filter(([k]) => k !== 'Unknown')
    .map(([query, { total, recurrent, fp }]) => ({
      query,
      total,
      recurrent,
      falsePositive: fp,
      fpRate:         total > 0 ? Math.round((fp / total) * 100) : 0,
      recurrenceRate: total > 0 ? Math.round((recurrent / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// File hotspot
// ---------------------------------------------------------------------------

export function computeFileHotspots(rows: VulnerabilityRow[], n = 15): [string, number][] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const file = (row['SrcFileName'] || '').trim();
    if (!file) continue;
    // Strip common path prefixes — keep last 2 path segments for readability
    const parts = file.replace(/\\/g, '/').split('/');
    const label = parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : file;
    counts[label] = (counts[label] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ---------------------------------------------------------------------------
// Entity rollup
// ---------------------------------------------------------------------------

export interface EntityRollup {
  entity: string;
  total: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  score: number;
  internetFacing: number;
  projects: number;
}

export function computeEntityRollup(rows: VulnerabilityRow[]): EntityRollup[] {
  const map = new Map<string, EntityRollup & { projectSet: Set<string> }>();

  for (const row of rows) {
    const entity = (row['Entity'] || 'Unknown').trim() || 'Unknown';
    if (!map.has(entity)) {
      map.set(entity, {
        entity, total: 0, high: 0, medium: 0, low: 0, info: 0,
        score: 0, internetFacing: 0, projects: 0, projectSet: new Set(),
      });
    }
    const e = map.get(entity)!;
    e.total++;
    e.projectSet.add(row['CX Project ID'] || row['Checkmarx project name']);

    const sev = normalizeSeverity(row['Result Severity'] || '');
    if (sev === 'High')   e.high++;
    else if (sev === 'Medium') e.medium++;
    else if (sev === 'Low')    e.low++;
    else if (sev === 'Info')   e.info++;

    const facing = (row['Internet Facing'] || '').toLowerCase().trim();
    if (['yes', 'true', '1', 'y'].includes(facing)) e.internetFacing++;
  }

  return Array.from(map.values()).map((e) => {
    const score = Math.round(e.high * 10 + e.medium * 4 + e.low * 1);
    return { ...e, score, projects: e.projectSet.size };
  }).sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function severityColor(sev: string): string {
  switch (sev.toLowerCase()) {
    case 'high':   return '#ef4444';
    case 'medium': return '#f97316';
    case 'low':    return '#facc15';
    case 'info':
    case 'information': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function doraColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical': return '#ef4444';
    case 'high':     return '#f97316';
    case 'medium':   return '#facc15';
    case 'low':      return '#34d399';
    default: return '#6b7280';
  }
}

export function riskColor(score: number, max: number): string {
  if (max === 0) return '#6b7280';
  const ratio = score / max;
  if (ratio >= 0.75) return '#ef4444';
  if (ratio >= 0.50) return '#f97316';
  if (ratio >= 0.25) return '#facc15';
  return '#34d399';
}
