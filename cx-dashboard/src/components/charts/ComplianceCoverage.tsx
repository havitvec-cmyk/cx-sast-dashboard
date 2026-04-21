import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { COMPLIANCE_FIELDS } from '../../types';

interface Props {
  data: Record<string, number>;
  total: number;
}

export default function ComplianceCoverage({ data, total }: Props) {
  const chartData = COMPLIANCE_FIELDS.map((field) => ({
    name: field,
    count: data[field] ?? 0,
    pct: total > 0 ? Math.round(((data[field] ?? 0) / total) * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  return (
    <div style={{ height: Math.max(300, chartData.length * 32) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={190}
            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(34,211,238,0.05)' }}
            formatter={(v: number, _name: string, props: { payload?: { count: number } }) => [
              `${v}% (${(props.payload?.count ?? 0).toLocaleString()} vulns)`,
              'Coverage',
            ]}
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {chartData.map((entry) => {
              const pct = entry.pct;
              const color = pct >= 75 ? '#34d399' : pct >= 40 ? '#facc15' : pct >= 10 ? '#f97316' : '#ef4444';
              return <Cell key={entry.name} fill={color} fillOpacity={0.85} />;
            })}
            <LabelList
              dataKey="pct"
              position="right"
              style={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              formatter={(v: number) => `${v}%`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
