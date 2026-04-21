import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface Props { data: [string, number][] }

export default function FileHotspot({ data }: Props) {
  if (data.length === 0) return <p className="text-center text-slate-600 text-sm py-8">No file data</p>;

  const max = data[0][1];
  const chartData = data.map(([name, value]) => ({ name, value }));

  return (
    <div style={{ height: Math.max(240, chartData.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={200} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(34,211,238,0.05)' }}
            formatter={(v: number) => [v.toLocaleString(), 'Vulnerabilities']}
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((entry) => {
              const ratio = entry.value / max;
              return <Cell key={entry.name} fill={ratio >= 0.7 ? '#ef4444' : ratio >= 0.4 ? '#f97316' : '#22d3ee'} />;
            })}
            <LabelList dataKey="value" position="right" style={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} formatter={(v: number) => v.toLocaleString()} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
