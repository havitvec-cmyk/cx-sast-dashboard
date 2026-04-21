import { useMemo } from 'react';
import { Bug, ShieldAlert, AlertTriangle, Info, Globe, UserCheck } from 'lucide-react';
import { useActiveExtract } from '../context/ExtractContext';
import { computeMetrics, pct } from '../utils/metrics';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import EmptyState from '../components/EmptyState';
import SeverityDonut from '../components/charts/SeverityDonut';
import StateDistribution from '../components/charts/StateDistribution';
import TopQueries from '../components/charts/TopQueries';
import RiskMatrix from '../components/charts/RiskMatrix';

export default function Overview() {
  const extract = useActiveExtract();
  const metrics = useMemo(() => extract ? computeMetrics(extract.rows) : null, [extract]);

  if (!extract || !metrics) return <EmptyState />;

  const newVulns = metrics.byState['New'] ?? 0;
  const recurrent = metrics.byState['Recurrent'] ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Total Vulns"
          value={metrics.total}
          icon={<Bug size={18} />}
          color="cyan"
          subtitle={`${Object.keys(metrics.byProject).length} projects`}
        />
        <KPICard
          title="High"
          value={metrics.bySeverity.High}
          icon={<ShieldAlert size={18} />}
          color="red"
          subtitle={pct(metrics.bySeverity.High, metrics.total)}
        />
        <KPICard
          title="Medium"
          value={metrics.bySeverity.Medium}
          icon={<AlertTriangle size={18} />}
          color="orange"
          subtitle={pct(metrics.bySeverity.Medium, metrics.total)}
        />
        <KPICard
          title="Low"
          value={metrics.bySeverity.Low}
          icon={<AlertTriangle size={18} />}
          color="yellow"
          subtitle={pct(metrics.bySeverity.Low, metrics.total)}
        />
        <KPICard
          title="New"
          value={newVulns}
          icon={<Info size={18} />}
          color="purple"
          subtitle={pct(newVulns, metrics.total)}
        />
        <KPICard
          title="Recurrent"
          value={recurrent}
          icon={<Info size={18} />}
          color="blue"
          subtitle={pct(recurrent, metrics.total)}
        />
      </div>

      {/* Row 2: exposure + assignment */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Internet Facing"
          value={metrics.internetFacing.yes}
          icon={<Globe size={18} />}
          color="red"
          subtitle={`${pct(metrics.internetFacing.yes, metrics.total)} of vulns`}
        />
        <KPICard
          title="Internal"
          value={metrics.internetFacing.no}
          icon={<Globe size={18} />}
          color="green"
          subtitle={pct(metrics.internetFacing.no, metrics.total)}
        />
        <KPICard
          title="Assigned"
          value={metrics.assignedVsUnassigned.assigned}
          icon={<UserCheck size={18} />}
          color="cyan"
          subtitle={pct(metrics.assignedVsUnassigned.assigned, metrics.total)}
        />
        <KPICard
          title="Unassigned"
          value={metrics.assignedVsUnassigned.unassigned}
          icon={<UserCheck size={18} />}
          color="orange"
          subtitle={pct(metrics.assignedVsUnassigned.unassigned, metrics.total)}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Severity Breakdown" subtitle="Distribution across all projects">
          <SeverityDonut data={metrics.bySeverity} total={metrics.total} />
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
          <RiskMatrix rows={extract.rows} />
        </ChartCard>
      </div>
    </div>
  );
}
