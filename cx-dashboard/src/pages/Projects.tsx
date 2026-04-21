import { useMemo, useState } from 'react';
import { Search, Download } from 'lucide-react';
import { useExtracts, useActiveExtract } from '../context/ExtractContext';
import { computeMetrics, computeAging, computeFileHotspots, riskColor, computeRiskScores, severityColor } from '../utils/metrics';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import VulnsByProject from '../components/charts/VulnsByProject';
import FileHotspot from '../components/charts/FileHotspot';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Projects() {
  const extract           = useActiveExtract();
  const { filteredRows, slaConfig } = useExtracts();
  const rows              = filteredRows;
  const metrics           = useMemo(() => extract ? computeMetrics(rows) : null, [rows, extract]);
  const scores            = useMemo(() => extract ? computeRiskScores(rows) : [], [rows, extract]);
  const aging             = useMemo(() => extract ? computeAging(rows, slaConfig) : null, [rows, extract, slaConfig]);
  const hotspots          = useMemo(() => extract ? computeFileHotspots(rows) : [], [rows, extract]);
  const [search, setSearch] = useState('');

  if (!extract || !metrics) return <EmptyState />;

  // Build per-project table enriched with risk score and aging
  const scoreMap = useMemo(
    () => new Map(scores.map((s) => [s.projectId || s.projectName, s])),
    [scores],
  );

  // Per-project aging (avg days open)
  const projectAgingMap = useMemo(() => {
    const map = new Map<string, { totalAge: number; count: number; breach: number }>();
    for (const row of rows) {
      const key  = row['CX Project ID'] || row['Checkmarx project name'];
      const date = row['Detection Date'] ? new Date(row['Detection Date']) : null;
      if (!date || isNaN(date.getTime())) continue;
      const age  = Math.floor((Date.now() - date.getTime()) / 86_400_000);
      const sev  = (row['Result Severity'] || '').toLowerCase();
      const slaVal = sev === 'high' ? slaConfig.high : sev === 'medium' ? slaConfig.medium : slaConfig.low;
      if (!map.has(key)) map.set(key, { totalAge: 0, count: 0, breach: 0 });
      const e = map.get(key)!;
      e.totalAge += age;
      e.count++;
      if (age > slaVal) e.breach++;
    }
    return map;
  }, [rows, slaConfig]);

  const projectData = useMemo(() => {
    const map: Record<string, {
      name: string; id: string; entity: string; dora: string;
      high: number; medium: number; low: number; info: number; total: number;
    }> = {};
    for (const row of rows) {
      const key = row['CX Project ID'] || row['Checkmarx project name'];
      if (!map[key]) {
        map[key] = { name: row['Checkmarx project name'] || key, id: row['CX Project ID'], entity: row['Entity'], dora: row['DORA Criticallity'], high: 0, medium: 0, low: 0, info: 0, total: 0 };
      }
      const sev = (row['Result Severity'] || '').toLowerCase();
      if (sev === 'high') map[key].high++;
      else if (sev === 'medium') map[key].medium++;
      else if (sev === 'low') map[key].low++;
      else if (sev === 'info' || sev === 'information') map[key].info++;
      map[key].total++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [rows]);

  const maxScore = scores[0]?.score ?? 1;

  // New vs Recurrent per project (top 10 by total)
  const newVsRecurrentData = useMemo(() => {
    const map: Record<string, { name: string; New: number; Recurrent: number }> = {};
    for (const row of rows) {
      const key = row['Checkmarx project name'] || row['CX Project ID'] || 'Unknown';
      if (!map[key]) map[key] = { name: key.length > 20 ? key.slice(0, 18) + '…' : key, New: 0, Recurrent: 0 };
      const state = (row['Result State'] || '').toLowerCase();
      if (state === 'new') map[key].New++;
      else if (state === 'recurrent') map[key].Recurrent++;
    }
    return Object.values(map)
      .sort((a, b) => (b.New + b.Recurrent) - (a.New + a.Recurrent))
      .slice(0, 10);
  }, [rows]);

  const filtered = projectData.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.entity.toLowerCase().includes(search.toLowerCase())
  );

  const exportCsv = () => {
    const exportData = filtered.map((p) => {
      const key    = p.id || p.name;
      const score  = scoreMap.get(key)?.score ?? 0;
      const ag     = projectAgingMap.get(key);
      return { Project: p.name, Entity: p.entity, DORA: p.dora, High: p.high, Medium: p.medium, Low: p.low, Info: p.info, Total: p.total, RiskScore: score, AvgAge: ag ? Math.round(ag.totalAge / ag.count) : '', SLABreaches: ag?.breach ?? '' };
    });
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'projects_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Vulnerabilities by Project" subtitle={`Top ${Math.min(15, Object.keys(metrics.byProject).length)} projects`}>
          <VulnsByProject data={metrics.byProject} maxItems={15} />
        </ChartCard>
        <ChartCard title="File Hotspots" subtitle="Top 15 files by vulnerability count">
          <FileHotspot data={hotspots} />
        </ChartCard>
      </div>

      {/* New vs Recurrent per project */}
      <ChartCard title="New vs Recurrent Vulnerabilities" subtitle="Top 10 projects — active findings by lifecycle state">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={newVsRecurrentData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={{ stroke: '#1a3a5c' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} itemStyle={{ color: '#e2e8f0' }} formatter={(v: number) => v.toLocaleString()} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>} />
              <Bar dataKey="New"       fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Recurrent" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Project table */}
      <div className="cyber-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Project Details</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Filter projects…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-cyber-surface border border-cyber-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyber-cyan/50 w-44" />
            </div>
            <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs text-cyber-cyan hover:text-white border border-cyber-cyan/30 hover:border-cyber-cyan px-3 py-1.5 rounded-lg transition-all font-mono">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-left border-b border-cyber-border">
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Entity</th>
                <th className="pb-2 pr-4 font-medium">DORA</th>
                <th className="pb-2 pr-3 font-medium text-red-400">H</th>
                <th className="pb-2 pr-3 font-medium text-orange-400">M</th>
                <th className="pb-2 pr-3 font-medium text-yellow-400">L</th>
                <th className="pb-2 pr-3 font-medium text-blue-400">I</th>
                <th className="pb-2 pr-4 font-medium text-cyber-cyan">Total</th>
                <th className="pb-2 pr-4 font-medium">Risk Score</th>
                <th className="pb-2 pr-4 font-medium">Avg Age</th>
                <th className="pb-2 font-medium text-red-400">SLA ⚠</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const key   = p.id || p.name;
                const score = scoreMap.get(key)?.score ?? 0;
                const color = riskColor(score, maxScore);
                const ag    = projectAgingMap.get(key);
                const avgAge = ag && ag.count > 0 ? Math.round(ag.totalAge / ag.count) : null;
                return (
                  <tr key={i} className="border-b border-cyber-border/50 hover:bg-cyber-border/20 transition-colors">
                    <td className="py-2 pr-4 text-slate-300 max-w-[160px]">
                      <div className="truncate" title={p.name}>{p.name}</div>
                      {p.id && <div className="text-slate-600 text-[10px]">ID: {p.id}</div>}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{p.entity || '—'}</td>
                    <td className="py-2 pr-4">
                      {p.dora
                        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: `${severityColor(p.dora)}22`, color: severityColor(p.dora), border: `1px solid ${severityColor(p.dora)}44` }}>{p.dora}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2 pr-3 text-red-400 font-semibold">{p.high || '—'}</td>
                    <td className="py-2 pr-3 text-orange-400">{p.medium || '—'}</td>
                    <td className="py-2 pr-3 text-yellow-400">{p.low || '—'}</td>
                    <td className="py-2 pr-3 text-blue-400">{p.info || '—'}</td>
                    <td className="py-2 pr-4 text-cyber-cyan font-semibold">{p.total}</td>
                    <td className="py-2 pr-4 font-bold" style={{ color }}>{score > 0 ? score.toLocaleString() : '—'}</td>
                    <td className="py-2 pr-4 text-slate-400">{avgAge !== null ? `${avgAge}d` : '—'}</td>
                    <td className="py-2">
                      {ag?.breach ? <span className="text-red-400 font-semibold">{ag.breach}</span> : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="py-8 text-center text-slate-600">No matching projects</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
