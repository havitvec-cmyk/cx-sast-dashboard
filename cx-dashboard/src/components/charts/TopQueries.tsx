import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const QUERY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#facc15', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
];

interface Props { data: [string, number][] }

export default function TopQueries({ data }: Props) {
  const chartData = data.map(([name, value]) => ({
    name: name.length > 36 ? name.slice(0, 34) + '…' : name,
    value,
  }));

  if (chartData.length === 0) return <p className="text-center text-slate-600 text-sm py-8">No data</p>;

  return (
    <div style={{ height: Math.max(240, chartData.length * 38) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 52, top: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={210}
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(34,211,238,0.05)' }}
            formatter={(v: number) => [v.toLocaleString(), 'Occurrences']}
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={QUERY_COLORS[i % QUERY_COLORS.length]} />
            ))}
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
