import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// NE / PNE are suppressed/FP equivalents — use same blue family as False Positive
const STATE_COLORS: Record<string, string> = {
  'New':                     '#ef4444',
  'Recurrent':               '#f97316',
  'Confirmed':               '#a78bfa',
  'Urgent':                  '#dc2626',
  'False Positive':          '#3b82f6',
  'Not Exploitable':         '#60a5fa',
  'Propose Not Exploitable': '#93c5fd',
  'Proposed Not Exploitable':'#bfdbfe',
};

function colorForState(state: string): string {
  return STATE_COLORS[state] ?? '#6b7280';
}

interface Props { data: Record<string, number> }

export default function StateDistribution({ data }: Props) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  if (chartData.length === 0) return <p className="text-center text-slate-600 text-sm py-8">No data</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={colorForState(entry.name)} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, name: string) => [v.toLocaleString(), name]}
            contentStyle={{ background: '#0f1f3d', border: '1px solid #1a3a5c', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
