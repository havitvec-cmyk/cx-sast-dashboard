import { useMemo } from 'react';
import { Bug, ShieldAlert, AlertTriangle, Info, Globe, UserCheck, Flame, Clock } from 'lucide-react';
import { useExtracts, useActiveExtract } from '../context/ExtractContext';
import { computeMetrics, computeRiskScores, computeAging, computeLanguageBreakdown, pct, riskColor } from '../utils/metrics';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import SeverityDonut from '../components/charts/SeverityDonut';
import StateDistribution from '../components/charts/StateDistribution';
import TopQueries from '../components/charts/TopQueries';
import RiskMatrix from '../components/charts/RiskMatrix';
import LanguageBreakdown from '../components/charts/LanguageBreakdown';

export default function Overview() {
  const extract     = useActiveExtract();
  const { filteredRows, slaConfig, filter, setFilter } = useExtracts();

  const rows    = filteredRows;
  const metrics = useMemo(() => extract ? computeMetrics(rows) : null, [rows, extract]);
  const scores  = useMemo(() => extract ? computeRiskScores(rows) : [], [rows, extract]);
  const aging   = useMemo(() => extract ? computeAging(rows, slaConfig) : null, [rows, extract, slaConfig]);
  const langs   = useMemo(() => extract ? computeLanguageBreakdown(rows) : [], [rows, extract]);

  if (!extract || !metrics || !aging) return <EmptyState />;

  const newVulns   = metrics.byState['New']       ?? 0;
  const recurrent  = metrics.byState['Recurrent'] ?? 0;
  const maxScore   = scores[0]?.score ?? 1;
  const criticalRisk = scores.filter((p) => riskColor(p.score, maxScore) === '#ef4444').length;
  const slaBreach  = aging.slaBreach.high + aging.slaBreach.medium + aging.slaBreach.low;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row 1 — volume */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total Vulns"  value={metrics.total}              icon={<Bug size={18} />}          color="cyan"   subtitle={`${Object.keys(metrics.byProject).length} projects`} />
        <KPICard title="High"         value={metrics.bySeverity.High}    icon={<ShieldAlert size={18} />}  color="red"    subtitle={pct(metrics.bySeverity.High, metrics.total)}
          trend={filter.severity ? undefined : undefined} />
        <KPICard title="Medium"       value={metrics.bySeverity.Medium}  icon={<AlertTriangle size={18} />} color="orange" subtitle={pct(metrics.bySeverity.Medium, metrics.total)} />
        <KPICard title="Low"          value={metrics.bySeverity.Low}     icon={<AlertTriangle size={18} />} color="yellow" subtitle={pct(metrics.bySeverity.Low, metrics.total)} />
        <KPICard title="New"          value={newVulns}                   icon={<Info size={18} />}          color="purple" subtitle={pct(newVulns, metrics.total)} />
        <KPICard title="Recurrent"    value={recurrent}                  icon={<Info size={18} />}          color="blue"   subtitle={pct(recurrent, metrics.total)} />
      </div>

      {/* KPI row 2 — risk & governance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Critical Risk Projects" value={criticalRisk}  icon={<Flame size={18} />}     color="red"    subtitle="top-quartile composite score" />
        <KPICard title="SLA Breached"           value={slaBreach}     icon={<Clock size={18} />}     color="orange" subtitle={`H:${aging.slaBreach.high} M:${aging.slaBreach.medium} L:${aging.slaBreach.low}`} />
        <KPICard title="Internet Facing"        value={metrics.internetFacing.yes}  icon={<Globe size={18} />}     color="red"    subtitle={pct(metrics.internetFacing.yes, metrics.total)} />
        <KPICard title="Unassigned"             value={metrics.assignedVsUnassigned.unassigned} icon={<UserCheck size={18} />} color="orange" subtitle={pct(metrics.assignedVsUnassigned.unassigned, metrics.total)} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Severity Breakdown" subtitle="Click a slice to filter"
          actions={
            filter.severity ? (
              <button onClick={() => setFilter({ severity: null })} className="text-xs text-cyber-cyan hover:text-white border border-cyber-cyan/30 px-2 py-1 rounded transition-colors">
                Clear filter
              </button>
            ) : undefined
          }
        >
          <SeverityDonut
            data={metrics.bySeverity}
            total={metrics.total}
            onSliceClick={(sev) => setFilter({ severity: filter.severity === sev ? null : sev })}
            activeSeverity={filter.severity}
          />
        </ChartCard>
        <ChartCard title="Result State" subtitle="Lifecycle status of findings">
          <StateDistribution data={metrics.byState} />
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Top 10 Vulnerability Types" subtitle="Most frequent queries triggered">
          <TopQueries data={metrics.byQuery} />
        </ChartCard>
        <ChartCard title="Risk Matrix" subtitle="Severity by DORA criticality tier">
          <RiskMatrix rows={rows} />
        </ChartCard>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Language Breakdown" subtitle="Vulnerability source by technology">
          <LanguageBreakdown data={langs} />
        </ChartCard>
        <div className="cyber-card p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {[
              { label: 'Assigned',          value: metrics.assignedVsUnassigned.assigned,  color: '#22d3ee' },
              { label: 'Internal',          value: metrics.internetFacing.no,               color: '#34d399' },
              { label: 'False Positive',    value: metrics.byState['False Positive'] ?? 0,  color: '#3b82f6' },
              { label: 'Not Exploitable',   value: metrics.byState['Not Exploitable'] ?? 0, color: '#a78bfa' },
              { label: 'Avg Age (days)',     value: aging.avgAgeDays,                        color: '#f97316' },
              { label: 'Oldest (days)',      value: aging.maxAgeDays,                        color: '#ef4444' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-cyber-surface border border-cyber-border rounded-lg p-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider">{label}</p>
                <p className="text-xl font-semibold mt-1" style={{ color }}>{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
