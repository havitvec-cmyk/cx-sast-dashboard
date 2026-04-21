import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useActiveExtract } from '../context/ExtractContext';
import { computeMetrics, severityColor } from '../utils/metrics';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import VulnsByProject from '../components/charts/VulnsByProject';

export default function Projects() {
  const extract = useActiveExtract();
  const metrics = useMemo(() => extract ? computeMetrics(extract.rows) : null, [extract]);
  const [search, setSearch] = useState('');

  if (!extract || !metrics) return <EmptyState />;

  // Build per-project table
  const projectData = useMemo(() => {
    const map: Record<string, {
      name: string; id: string; entity: string; dora: string; pci: string;
      high: number; medium: number; low: number; info: number; total: number;
    }> = {};

    for (const row of extract.rows) {
      const key = row['CX Project ID'] || row['Checkmarx project name'];
      if (!map[key]) {
        map[key] = {
          name: row['Checkmarx project name'] || key,
          id: row['CX Project ID'],
          entity: row['Entity'],
          dora: row['DORA Criticallity'],
          pci: row['PCI DSS Relevance'],
          high: 0, medium: 0, low: 0, info: 0, total: 0,
        };
      }
      const sev = (row['Result Severity'] || '').toLowerCase();
      if (sev === 'high') map[key].high++;
      else if (sev === 'medium') map[key].medium++;
      else if (sev === 'low') map[key].low++;
      else if (sev === 'info' || sev === 'information') map[key].info++;
      map[key].total++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [extract]);

  const filtered = projectData.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.entity.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <ChartCard title="Vulnerabilities by Project" subtitle={`Top ${Math.min(15, Object.keys(metrics.byProject).length)} projects`}>
        <VulnsByProject data={metrics.byProject} maxItems={15} />
      </ChartCard>

      {/* Project table */}
      <div className="cyber-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
            Project Details
          </h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-cyber-surface border border-cyber-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyber-cyan/50 w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-left border-b border-cyber-border">
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Entity</th>
                <th className="pb-2 pr-4 font-medium">DORA</th>
                <th className="pb-2 pr-4 font-medium text-red-400">High</th>
                <th className="pb-2 pr-4 font-medium text-orange-400">Med</th>
                <th className="pb-2 pr-4 font-medium text-yellow-400">Low</th>
                <th className="pb-2 pr-4 font-medium text-blue-400">Info</th>
                <th className="pb-2 font-medium text-cyber-cyan">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={i}
                  className="border-b border-cyber-border/50 hover:bg-cyber-border/20 transition-colors"
                >
                  <td className="py-2 pr-4 text-slate-300 max-w-xs">
                    <div className="truncate" title={p.name}>{p.name}</div>
                    {p.id && <div className="text-slate-600 text-[10px]">ID: {p.id}</div>}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{p.entity || '—'}</td>
                  <td className="py-2 pr-4">
                    {p.dora ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{
                        background: `${severityColor(p.dora)}22`,
                        color: severityColor(p.dora),
                        border: `1px solid ${severityColor(p.dora)}44`,
                      }}>{p.dora}</span>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-2 pr-4 text-red-400 font-semibold">{p.high || '—'}</td>
                  <td className="py-2 pr-4 text-orange-400">{p.medium || '—'}</td>
                  <td className="py-2 pr-4 text-yellow-400">{p.low || '—'}</td>
                  <td className="py-2 pr-4 text-blue-400">{p.info || '—'}</td>
                  <td className="py-2 text-cyber-cyan font-semibold">{p.total}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-600">No matching projects</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
