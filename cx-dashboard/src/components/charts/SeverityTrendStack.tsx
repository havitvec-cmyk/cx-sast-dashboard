import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { Extract } from '../../types';
import { computeMetrics } from '../../utils/metrics';
import { formatTimestamp } from '../../utils/csvParser';

interface Props { extracts: Extract[] }

export default function SeverityTrendStack({ extracts }: Props) {
  if (extracts.length === 0) {
    return <p className="text-center text-slate-600 text-sm py-8">No extracts loaded</p>;
  }

  const sorted = [...extracts].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const data = sorted.map((ext) => {
    const m = computeMetrics(ext.rows);
    return {
      label: formatTimestamp(ext.timestamp),
      High: m.bySeverity.High,
      Medium: m.bySeverity.Medium,
      Low: m.bySeverity.Low,
      Info: m.bySeverity.Info,
    };
  });

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={{ stroke: '#1a3a5c' }}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(v: number) => v.toLocaleString()}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>}
          />
          <Bar dataKey="High"   stackId="a" fill="#ef4444" />
          <Bar dataKey="Medium" stackId="a" fill="#f97316" />
          <Bar dataKey="Low"    stackId="a" fill="#facc15" />
          <Bar dataKey="Info"   stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
