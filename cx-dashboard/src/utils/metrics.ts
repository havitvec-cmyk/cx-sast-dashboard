import type { VulnerabilityRow, Metrics, SeverityBreakdown } from '../types';
import { COMPLIANCE_FIELDS } from '../types';

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
  if (v === 'high') return 'High';
  if (v === 'medium') return 'Medium';
  if (v === 'low') return 'Low';
  if (v === 'info' || v === 'information') return 'Info';
  return null;
}

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
    byState: countBy(rows, 'Result State'),
    byProject: countBy(rows, 'Checkmarx project name'),
    byQuery: topN(countBy(rows, 'Query'), 10),
    byEntity: countBy(rows, 'Entity'),
    byDoraCriticality: countBy(rows, 'DORA Criticallity'),
    internetFacing,
    assignedVsUnassigned,
    complianceCoverage,
    byStatus: countBy(rows, 'Result Status'),
  };
}

export function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function severityColor(sev: string): string {
  switch (sev.toLowerCase()) {
    case 'high': return '#ef4444';
    case 'medium': return '#f97316';
    case 'low': return '#facc15';
    case 'info':
    case 'information': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function doraColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#facc15';
    case 'low': return '#34d399';
    default: return '#6b7280';
  }
}
