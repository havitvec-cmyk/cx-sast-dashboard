import { useMemo } from 'react';
import { useActiveExtract } from '../context/ExtractContext';
import { computeMetrics } from '../utils/metrics';
import ChartCard from '../components/ChartCard';
import KPICard from '../components/KPICard';
import ComplianceCoverage from '../components/charts/ComplianceCoverage';
import EmptyState from '../components/EmptyState';
import { COMPLIANCE_FIELDS } from '../types';
import { Shield, ShieldCheck, ShieldAlert, Download } from 'lucide-react';
import Papa from 'papaparse';

export default function Compliance() {
  const extract = useActiveExtract();
  const metrics = useMemo(() => extract ? computeMetrics(extract.rows) : null, [extract]);

  if (!extract || !metrics) return <EmptyState />;

  const total = metrics.total;
  const coverage = metrics.complianceCoverage;

  const covered = COMPLIANCE_FIELDS.filter((f) => (coverage[f] ?? 0) > 0).length;
  const highCoverage = COMPLIANCE_FIELDS.filter((f) => total > 0 && (coverage[f] ?? 0) / total >= 0.5).length;
  const avgPct = total > 0
    ? Math.round(COMPLIANCE_FIELDS.reduce((s, f) => s + (coverage[f] ?? 0), 0) / (COMPLIANCE_FIELDS.length * total) * 100)
    : 0;

  // Highlight table
  const tableData = COMPLIANCE_FIELDS.map((f) => {
    const count = coverage[f] ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { name: f, count, pct };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title="Frameworks Active"
          value={`${covered} / ${COMPLIANCE_FIELDS.length}`}
          icon={<Shield size={18} />}
          color="cyan"
          subtitle="frameworks with coverage"
        />
        <KPICard
          title="High Coverage (≥50%)"
          value={highCoverage}
          icon={<ShieldCheck size={18} />}
          color="green"
          subtitle="frameworks above 50%"
        />
        <KPICard
          title="Avg Coverage"
          value={`${avgPct}%`}
          icon={<ShieldAlert size={18} />}
          color={avgPct >= 50 ? 'green' : avgPct >= 25 ? 'orange' : 'red'}
          subtitle="across all frameworks"
        />
      </div>

      <ChartCard
        title="Compliance Framework Coverage"
        subtitle="% of vulnerabilities mapped to each regulatory framework"
      >
        <ComplianceCoverage data={coverage} total={total} />
      </ChartCard>

      {/* Detail table */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Framework Detail</h3>
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([Papa.unparse(tableData.map((r) => ({ Framework: r.name, 'Vulns Mapped': r.count, 'Coverage %': r.pct })))], { type: 'text/csv;charset=utf-8;' }));
              a.download = 'compliance_coverage.csv'; a.click();
            }}
            className="flex items-center gap-1.5 text-xs text-cyber-cyan hover:text-white border border-cyber-cyan/30 hover:border-cyber-cyan px-3 py-1.5 rounded-lg transition-all font-mono"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-left border-b border-cyber-border">
                <th className="pb-2 pr-6 font-medium">Framework</th>
                <th className="pb-2 pr-6 font-medium text-right">Vulns Mapped</th>
                <th className="pb-2 pr-6 font-medium text-right">Coverage</th>
                <th className="pb-2 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row) => {
                const color = row.pct >= 75 ? '#34d399' : row.pct >= 40 ? '#facc15' : row.pct >= 10 ? '#f97316' : row.pct > 0 ? '#ef4444' : '#374151';
                const label = row.pct >= 75 ? 'Good' : row.pct >= 40 ? 'Moderate' : row.pct >= 10 ? 'Low' : row.pct > 0 ? 'Minimal' : 'None';
                return (
                  <tr key={row.name} className="border-b border-cyber-border/50 hover:bg-cyber-border/20 transition-colors">
                    <td className="py-2 pr-6 text-slate-300">{row.name}</td>
                    <td className="py-2 pr-6 text-right text-slate-400">{row.count.toLocaleString()}</td>
                    <td className="py-2 pr-6 text-right" style={{ color }}>{row.pct}%</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-32 h-1.5 bg-cyber-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: color }} />
                        </div>
                        <span className="text-[10px]" style={{ color }}>{label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
