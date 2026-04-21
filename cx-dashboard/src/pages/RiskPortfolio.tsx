import { useMemo } from 'react';
import { Flame, ShieldAlert, Globe, Target } from 'lucide-react';
import { useExtracts, useActiveExtract } from '../context/ExtractContext';
import { computeRiskScores, computeEntityRollup, riskColor } from '../utils/metrics';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import EntityRollupChart from '../components/charts/EntityRollupChart';
import { doraColor, severityColor } from '../utils/metrics';
import type { ProjectRiskScore } from '../utils/metrics';

function RiskTile({ p, maxScore }: { p: ProjectRiskScore; maxScore: number }) {
  const color = riskColor(p.score, maxScore);
  return (
    <div
      className="cyber-card p-3 flex flex-col gap-1.5 border-l-4 transition-all hover:scale-[1.01]"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-300 font-medium leading-tight truncate flex-1" title={p.projectName}>
          {p.projectName}
        </p>
        <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color }}>
          {p.score.toLocaleString()}
        </span>
      </div>
      <p className="text-[10px] text-slate-500 font-mono truncate">{p.entity || '—'}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {p.dora && (
          <span className="text-[10px] px-1 py-0.5 rounded font-mono"
            style={{ background: `${doraColor(p.dora)}20`, color: doraColor(p.dora), border: `1px solid ${doraColor(p.dora)}40` }}>
            {p.dora}
          </span>
        )}
        {p.internetFacing && (
          <span className="text-[10px] text-red-400 font-mono">⚠ Facing</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-red-400">{p.high}H</span>
        <span className="text-orange-400">{p.medium}M</span>
        <span className="text-yellow-400">{p.low}L</span>
      </div>
    </div>
  );
}

export default function RiskPortfolio() {
  const extract = useActiveExtract();
  const { extracts, activeId } = useExtracts();

  const scores = useMemo(() => extract ? computeRiskScores(extract.rows) : [], [extract]);
  const entities = useMemo(() => extract ? computeEntityRollup(extract.rows) : [], [extract]);

  // Previous extract for trend arrows
  const prevExtract = useMemo(() => {
    const sorted = [...extracts].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const idx = sorted.findIndex((e) => e.id === activeId);
    return idx > 0 ? sorted[idx - 1] : null;
  }, [extracts, activeId]);

  const prevScoreMap = useMemo(() => {
    if (!prevExtract) return new Map<string, number>();
    const prev = computeRiskScores(prevExtract.rows);
    return new Map(prev.map((p) => [p.projectId || p.projectName, p.score]));
  }, [prevExtract]);

  if (!extract || scores.length === 0) return <EmptyState />;

  const maxScore      = scores[0]?.score ?? 1;
  const criticalCount = scores.filter((p) => riskColor(p.score, maxScore) === '#ef4444').length;
  const atRiskCount   = scores.filter((p) => ['#ef4444', '#f97316'].includes(riskColor(p.score, maxScore))).length;
  const internetHigh  = scores.filter((p) => p.internetFacing && p.high > 0).length;

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Projects" value={scores.length} icon={<Target size={18} />} color="cyan" subtitle="in current extract" />
        <KPICard title="Critical Risk" value={criticalCount} icon={<Flame size={18} />} color="red" subtitle="top-quartile risk score" />
        <KPICard title="At Risk" value={atRiskCount} icon={<ShieldAlert size={18} />} color="orange" subtitle="High or Critical risk score" />
        <KPICard title="Internet-Facing + High" value={internetHigh} icon={<Globe size={18} />} color="red" subtitle="projects needing immediate attention" />
      </div>

      {/* Entity rollup */}
      <ChartCard title="Risk by Business Entity" subtitle="Stacked severity across entities">
        <EntityRollupChart data={entities} />
      </ChartCard>

      {/* Project grid */}
      <div className="cyber-card p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Project Risk Grid — ranked by composite score
        </h3>
        <p className="text-xs text-slate-500 font-mono">
          Score = (High×10 + Medium×4 + Low×1) × DORA weight × Internet-Facing multiplier
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {scores.map((p) => (
            <RiskTile key={p.projectId || p.projectName} p={p} maxScore={maxScore} />
          ))}
        </div>
      </div>

      {/* Ranked table */}
      <div className="cyber-card p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Risk Ranking Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wider text-left border-b border-cyber-border">
                <th className="pb-2 pr-3 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Entity</th>
                <th className="pb-2 pr-4 font-medium">DORA</th>
                <th className="pb-2 pr-3 font-medium">Facing</th>
                <th className="pb-2 pr-3 font-medium text-red-400">H</th>
                <th className="pb-2 pr-3 font-medium text-orange-400">M</th>
                <th className="pb-2 pr-3 font-medium text-yellow-400">L</th>
                <th className="pb-2 pr-4 font-medium text-cyber-cyan">Score</th>
                {prevExtract && <th className="pb-2 font-medium">Δ</th>}
              </tr>
            </thead>
            <tbody>
              {scores.map((p, i) => {
                const color = riskColor(p.score, maxScore);
                const prevScore = prevScoreMap.get(p.projectId || p.projectName);
                const delta = prevScore !== undefined ? p.score - prevScore : null;
                return (
                  <tr key={i} className="border-b border-cyber-border/50 hover:bg-cyber-border/20 transition-colors">
                    <td className="py-2 pr-3 text-slate-600">{i + 1}</td>
                    <td className="py-2 pr-4 text-slate-300 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="truncate" title={p.projectName}>{p.projectName}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{p.entity || '—'}</td>
                    <td className="py-2 pr-4">
                      {p.dora ? <span style={{ color: doraColor(p.dora) }}>{p.dora}</span> : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-2 pr-3">
                      {p.internetFacing ? <span className="text-red-400">Yes</span> : <span className="text-slate-600">No</span>}
                    </td>
                    <td className="py-2 pr-3 text-red-400 font-semibold">{p.high || '—'}</td>
                    <td className="py-2 pr-3 text-orange-400">{p.medium || '—'}</td>
                    <td className="py-2 pr-3 text-yellow-400">{p.low || '—'}</td>
                    <td className="py-2 pr-4 font-bold" style={{ color }}>{p.score.toLocaleString()}</td>
                    {prevExtract && (
                      <td className="py-2">
                        {delta === null ? <span className="text-slate-600">—</span>
                          : delta > 0 ? <span className="text-red-400">↑{delta.toLocaleString()}</span>
                          : delta < 0 ? <span className="text-emerald-400">↓{Math.abs(delta).toLocaleString()}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                    )}
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
