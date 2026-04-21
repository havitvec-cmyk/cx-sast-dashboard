import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

interface Props {
  data: Record<string, number>;
  maxItems?: number;
}

export default function VulnsByProject({ data, maxItems = 15 }: Props) {
  const sorted = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([name, value]) => ({ name: name.length > 30 ? name.slice(0, 28) + '…' : name, value }));

  if (sorted.length === 0) return <EmptyState />;

  const max = sorted[0].value;

  return (
    <div style={{ height: Math.max(240, sorted.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(34,211,238,0.05)' }}
            formatter={(v: number) => [v.toLocaleString(), 'Vulnerabilities']}
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#22d3ee' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {sorted.map((entry) => {
              const ratio = entry.value / max;
              const r = Math.round(34 + (239 - 34) * (1 - ratio));
              const g = Math.round(211 + (68 - 211) * (1 - ratio));
              const b = Math.round(238 + (68 - 238) * (1 - ratio));
              return <Cell key={entry.name} fill={`rgb(${r},${g},${b})`} />;
            })}
            <LabelList
              dataKey="value"
              position="right"
              style={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              formatter={(v: number) => v.toLocaleString()}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState() {
  return <p className="text-center text-slate-600 text-sm py-8">No data</p>;
}
