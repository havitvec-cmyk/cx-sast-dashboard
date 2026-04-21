import { useMemo, useState } from 'react';
import { Clock, AlertOctagon, Calendar, Settings } from 'lucide-react';
import { useActiveExtract, useExtracts } from '../context/ExtractContext';
import { computeAging, computeQueryHealth } from '../utils/metrics';
import type { QueryHealth } from '../utils/metrics';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import AgeHistogram from '../components/charts/AgeHistogram';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { SlaConfig } from '../types';

function AssigneeChart({ rows }: { rows: { assignee: string; high: number; medium: number; low: number; total: number }[] }) {
  const data = rows.slice(0, 12).map((r) => ({
    name: r.assignee.length > 18 ? r.assignee.slice(0, 16) + '…' : r.assignee,
    High: r.high, Medium: r.medium, Low: r.low,
  }));
  return (
    <div style={{ height: Math.max(240, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} itemStyle={{ color: '#e2e8f0' }} formatter={(v: number) => v.toLocaleString()} />
          <Bar dataKey="High"   stackId="a" fill="#ef4444" />
          <Bar dataKey="Medium" stackId="a" fill="#f97316" />
          <Bar dataKey="Low"    stackId="a" fill="#facc15" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function QueryHealthTable({ data }: { data: QueryHealth[] }) {
  const [sortKey, setSortKey] = useState<keyof QueryHealth>('total');
  const sorted = [...data].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)).slice(0, 20);
  const headers: { key: keyof QueryHealth; label: string }[] = [
    { key: 'query',          label: 'Query' },
    { key: 'total',          label: 'Total' },
    { key: 'recurrent',      label: 'Recurrent' },
    { key: 'falsePositive',  label: 'False Positive' },
    { key: 'fpRate',         label: 'FP %' },
    { key: 'recurrenceRate', label: 'Recurrence %' },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-slate-500 uppercase tracking-wider text-left border-b border-cyber-border">
            {headers.map((h) => (
              <th key={h.key} className="pb-2 pr-4 font-medium cursor-pointer hover:text-cyber-cyan transition-colors" onClick={() => setSortKey(h.key)}>
                {h.label} {sortKey === h.key ? '↓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const fpColor   = row.fpRate >= 40 ? '#ef4444' : row.fpRate >= 20 ? '#f97316' : '#94a3b8';
            const recColor  = row.recurrenceRate >= 50 ? '#ef4444' : row.recurrenceRate >= 25 ? '#f97316' : '#94a3b8';
            return (
              <tr key={row.query} className="border-b border-cyber-border/50 hover:bg-cyber-border/20">
                <td className="py-2 pr-4 text-slate-300 max-w-[220px] truncate" title={row.query}>{row.query}</td>
                <td className="py-2 pr-4 text-cyber-cyan font-semibold">{row.total}</td>
                <td className="py-2 pr-4 text-orange-400">{row.recurrent}</td>
                <td className="py-2 pr-4 text-blue-400">{row.falsePositive}</td>
                <td className="py-2 pr-4 font-semibold" style={{ color: fpColor }}>{row.fpRate}%</td>
                <td className="py-2 font-semibold" style={{ color: recColor }}>{row.recurrenceRate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlaEditor({ config, onChange }: { config: SlaConfig; onChange: (c: SlaConfig) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
      {(['high', 'medium', 'low'] as const).map((sev) => (
        <label key={sev} className="flex items-center gap-2">
          <span className="text-slate-400 capitalize">{sev} SLA (days):</span>
          <input
            type="number"
            min={1}
            value={config[sev]}
            onChange={(e) => onChange({ ...config, [sev]: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-16 bg-cyber-surface border border-cyber-border rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-cyber-cyan/50"
          />
        </label>
      ))}
    </div>
  );
}

export default function Remediation() {
  const extract = useActiveExtract();
  const { slaConfig, setSlaConfig } = useExtracts();
  const [showSlaEditor, setShowSlaEditor] = useState(false);

  const aging = useMemo(
    () => extract ? computeAging(extract.rows, slaConfig) : null,
    [extract, slaConfig],
  );

  const queryHealth = useMemo(
    () => extract ? computeQueryHealth(extract.rows) : [],
    [extract],
  );

  const assigneeData = useMemo(() => {
    if (!extract) return [];
    const map = new Map<string, { high: number; medium: number; low: number; total: number }>();
    for (const row of extract.rows) {
      const assignee = (row['Assigned To'] || 'Unassigned').trim() || 'Unassigned';
      if (!map.has(assignee)) map.set(assignee, { high: 0, medium: 0, low: 0, total: 0 });
      const e = map.get(assignee)!;
      const sev = (row['Result Severity'] || '').toLowerCase();
      if (sev === 'high') e.high++;
      else if (sev === 'medium') e.medium++;
      else if (sev === 'low') e.low++;
      e.total++;
    }
    return Array.from(map.entries())
      .map(([assignee, v]) => ({ assignee, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [extract]);

  if (!extract || !aging) return <EmptyState />;

  const totalBreach = aging.slaBreach.high + aging.slaBreach.medium + aging.slaBreach.low;

  return (
    <div className="flex flex-col gap-6">
      {/* SLA config */}
      <div className="cyber-card p-4 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-cyber-cyan" />
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">SLA Thresholds</span>
          </div>
          {showSlaEditor && <SlaEditor config={slaConfig} onChange={setSlaConfig} />}
        </div>
        <button
          onClick={() => setShowSlaEditor((v) => !v)}
          className="text-xs text-cyber-cyan hover:text-white border border-cyber-cyan/30 hover:border-cyber-cyan px-3 py-1.5 rounded-lg transition-all font-mono"
        >
          {showSlaEditor ? 'Done' : 'Configure SLAs'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="SLA Breached" value={totalBreach} icon={<AlertOctagon size={18} />} color="red"
          subtitle={`H:${aging.slaBreach.high} M:${aging.slaBreach.medium} L:${aging.slaBreach.low}`} />
        <KPICard title="Avg Age" value={`${aging.avgAgeDays}d`} icon={<Clock size={18} />} color="orange" subtitle="average days open" />
        <KPICard title="Oldest Vuln" value={`${aging.maxAgeDays}d`} icon={<Calendar size={18} />} color="red" subtitle="days since detection" />
        <KPICard title="Unassigned" value={assigneeData.find((a) => a.assignee === 'Unassigned')?.total ?? 0}
          icon={<AlertOctagon size={18} />} color="orange" subtitle="no owner assigned" />
      </div>

      {/* Age histogram */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Vulnerability Age Distribution" subtitle="Count by days since detection">
          <AgeHistogram buckets={aging.buckets} />
        </ChartCard>

        <ChartCard title="Assignee Workload" subtitle="Open vulnerabilities per owner">
          <AssigneeChart rows={assigneeData} />
        </ChartCard>
      </div>

      {/* SLA breach heatmap table */}
      <div className="cyber-card p-5">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
          SLA Breach Summary
          <span className="ml-2 text-xs text-slate-500 normal-case font-normal">
            (High &gt;{slaConfig.high}d · Medium &gt;{slaConfig.medium}d · Low &gt;{slaConfig.low}d)
          </span>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {(['high', 'medium', 'low'] as const).map((sev) => {
            const count = aging.slaBreach[sev];
            const color = sev === 'high' ? '#ef4444' : sev === 'medium' ? '#f97316' : '#facc15';
            return (
              <div key={sev} className="cyber-card p-4 text-center border" style={{ borderColor: `${color}30` }}>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 capitalize">{sev} severity</p>
                <p className="text-3xl font-mono font-bold" style={{ color }}>{count.toLocaleString()}</p>
                <p className="text-xs text-slate-600 mt-1">past {slaConfig[sev]}-day SLA</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Query health */}
      <ChartCard title="Query Health — False Positive &amp; Recurrence Rates" subtitle="Click column headers to sort">
        <QueryHealthTable data={queryHealth} />
      </ChartCard>
    </div>
  );
}
