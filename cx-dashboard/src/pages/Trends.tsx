import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Download } from 'lucide-react';
import { useExtracts } from '../context/ExtractContext';
import { computeMetrics } from '../utils/metrics';
import { formatTimestamp } from '../utils/csvParser';
import ChartCard from '../components/ChartCard';
import TrendComparison from '../components/charts/TrendComparison';
import type { MetricKey } from '../components/charts/TrendComparison';
import SeverityTrendStack from '../components/charts/SeverityTrendStack';
import FileUpload from '../components/FileUpload';
import Papa from 'papaparse';

const METRIC_OPTIONS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'total',     label: 'Total',     color: '#22d3ee' },
  { key: 'High',      label: 'High',      color: '#ef4444' },
  { key: 'Medium',    label: 'Medium',    color: '#f97316' },
  { key: 'Low',       label: 'Low',       color: '#facc15' },
  { key: 'Info',      label: 'Info',      color: '#3b82f6' },
  { key: 'New',       label: 'New',       color: '#a78bfa' },
  { key: 'Recurrent', label: 'Recurrent', color: '#fb923c' },
];

export default function Trends() {
  const { extracts } = useExtracts();
  const [metric, setMetric] = useState<MetricKey>('total');

  const sorted = useMemo(
    () => [...extracts].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [extracts],
  );

  const getMetricValue = (m: ReturnType<typeof computeMetrics>, key: MetricKey): number => {
    if (key === 'total') return m.total;
    if (key === 'New' || key === 'Recurrent') return m.byState[key] ?? 0;
    return m.bySeverity[key as 'High' | 'Medium' | 'Low' | 'Info'];
  };

  const summaryRows = useMemo(() =>
    sorted.map((ext, i) => {
      const m = computeMetrics(ext.rows);
      const prev = i > 0 ? computeMetrics(sorted[i - 1].rows) : null;
      const getValue = (key: MetricKey) => getMetricValue(m, key);
      const getPrev  = (key: MetricKey) => prev ? getMetricValue(prev, key) : null;
      return { ext, m, getValue, getPrev };
    }),
  [sorted]);

  const exportComparison = () => {
    const rows = summaryRows.map(({ ext, m }) => ({
      Extract: ext.name,
      Timestamp: formatTimestamp(ext.timestamp),
      Total: m.total,
      High: m.bySeverity.High,
      Medium: m.bySeverity.Medium,
      Low: m.bySeverity.Low,
      Info: m.bySeverity.Info,
      New: m.byState['New'] ?? 0,
      Recurrent: m.byState['Recurrent'] ?? 0,
    }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([Papa.unparse(rows)], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'trends_comparison.csv'; a.click();
  };

  if (extracts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <p className="text-slate-500 text-sm">Load at least one extract to see trends.</p>
        <div className="w-full max-w-md cyber-card p-6">
          <FileUpload />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Metric selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setMetric(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all duration-150 ${
              metric === opt.key
                ? 'text-cyber-bg border-transparent'
                : 'border-cyber-border text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
            style={metric === opt.key ? { background: opt.color, borderColor: opt.color } : {}}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Trend line */}
      <ChartCard
        title={`${METRIC_OPTIONS.find((o) => o.key === metric)?.label} Vulnerability Trend`}
        subtitle={`${extracts.length} extract${extracts.length > 1 ? 's' : ''} loaded — sorted by timestamp`}
      >
        <TrendComparison extracts={extracts} metric={metric} />
      </ChartCard>

      {/* Stacked severity */}
      <ChartCard title="Severity Composition Over Time" subtitle="Stacked breakdown per extract">
        <SeverityTrendStack extracts={extracts} />
      </ChartCard>

      {/* Extract summary table */}
      <div className="cyber-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Extract Comparison Table</h3>
          <button onClick={exportComparison} className="flex items-center gap-1.5 text-xs text-cyber-cyan hover:text-white border border-cyber-cyan/30 hover:border-cyber-cyan px-3 py-1.5 rounded-lg transition-all font-mono">
            <Download size={13} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-left border-b border-cyber-border">
                <th className="pb-2 pr-4 font-medium">Extract</th>
                <th className="pb-2 pr-4 font-medium">Timestamp</th>
                <th className="pb-2 pr-4 font-medium text-cyber-cyan">Total</th>
                <th className="pb-2 pr-4 font-medium text-red-400">High</th>
                <th className="pb-2 pr-4 font-medium text-orange-400">Medium</th>
                <th className="pb-2 pr-4 font-medium text-yellow-400">Low</th>
                <th className="pb-2 pr-4 font-medium text-blue-400">Info</th>
                <th className="pb-2 font-medium">Δ Total</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(({ ext, m, getValue, getPrev }, i) => {
                const curr = getValue(metric);
                const prev = getPrev(metric);
                const delta = prev !== null ? curr - prev : null;
                return (
                  <tr key={ext.id} className="border-b border-cyber-border/50 hover:bg-cyber-border/20 transition-colors">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ext.color }} />
                        <span className="text-slate-300 truncate max-w-[180px]" title={ext.name}>{ext.name}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{formatTimestamp(ext.timestamp)}</td>
                    <td className="py-2 pr-4 text-cyber-cyan font-semibold">{m.total.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-red-400">{m.bySeverity.High.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-orange-400">{m.bySeverity.Medium.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-yellow-400">{m.bySeverity.Low.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-blue-400">{m.bySeverity.Info.toLocaleString()}</td>
                    <td className="py-2">
                      {delta === null ? (
                        <span className="text-slate-600">—</span>
                      ) : delta === 0 ? (
                        <span className="flex items-center gap-1 text-slate-500"><Minus size={12} /> 0</span>
                      ) : delta > 0 ? (
                        <span className="flex items-center gap-1 text-red-400"><TrendingUp size={12} /> +{delta.toLocaleString()}</span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400"><TrendingDown size={12} /> {delta.toLocaleString()}</span>
                      )}
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
