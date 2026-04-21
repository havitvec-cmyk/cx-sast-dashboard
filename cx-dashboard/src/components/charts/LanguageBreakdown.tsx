import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const LANG_COLORS = [
  '#22d3ee', '#a78bfa', '#34d399', '#fb923c', '#f472b6',
  '#60a5fa', '#facc15', '#f87171', '#4ade80', '#c084fc',
];

interface Props { data: [string, number][] }

export default function LanguageBreakdown({ data }: Props) {
  if (data.length === 0) return <p className="text-center text-slate-600 text-sm py-8">No file data</p>;

  const chartData = data.slice(0, 10).map(([name, value]) => ({ name, value }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="45%" outerRadius={90} paddingAngle={2} dataKey="value">
            {chartData.map((_, i) => (
              <Cell key={i} fill={LANG_COLORS[i % LANG_COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, name: string) => [v.toLocaleString(), name]}
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
