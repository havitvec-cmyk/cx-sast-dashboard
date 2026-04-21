import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { Extract } from '../../types';
import { computeMetrics } from '../../utils/metrics';
import { formatTimestamp } from '../../utils/csvParser';

export type MetricKey = 'total' | 'High' | 'Medium' | 'Low' | 'Info' | 'New' | 'Recurrent';

interface Props {
  extracts: Extract[];
  metric: MetricKey;
}

function getValue(ext: Extract, metric: MetricKey): number {
  const m = computeMetrics(ext.rows);
  if (metric === 'total') return m.total;
  if (metric === 'New' || metric === 'Recurrent') return m.byState[metric] ?? 0;
  return m.bySeverity[metric];
}

const METRIC_LABELS: Record<MetricKey, string> = {
  total:     'Total',
  High:      'High',
  Medium:    'Medium',
  Low:       'Low',
  Info:      'Info',
  New:       'New',
  Recurrent: 'Recurrent',
};

export default function TrendComparison({ extracts, metric }: Props) {
  if (extracts.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Load at least 2 extracts to compare trends
      </div>
    );
  }

  const sorted = [...extracts].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const data = sorted.map((ext) => ({
    label: formatTimestamp(ext.timestamp),
    value: getValue(ext, metric),
    name: ext.name,
    color: ext.color,
    id: ext.id,
  }));

  const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / data.length);

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
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
            formatter={(v: number) => [v.toLocaleString(), METRIC_LABELS[metric]]}
            labelFormatter={(l) => `Extract: ${l}`}
          />
          <ReferenceLine
            y={avg}
            stroke="#22d3ee"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{ value: `avg ${avg.toLocaleString()}`, fill: '#22d3ee', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={{ r: 5, fill: '#22d3ee', stroke: '#050d1a', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: '#22d3ee', stroke: '#050d1a', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
