import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { SeverityBreakdown } from '../../types';

const SEV_COLORS: Record<string, string> = {
  High:   '#ef4444',
  Medium: '#f97316',
  Low:    '#facc15',
  Info:   '#3b82f6',
};

interface Props {
  data: SeverityBreakdown;
  total: number;
  onSliceClick?: (severity: string) => void;
  activeSeverity?: string | null;
}

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: Record<string, number>) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function SeverityDonut({ data, total, onSliceClick, activeSeverity }: Props) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const chartData = entries.map(([name, value]) => ({ name, value }));

  return (
    <div className="relative h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={renderLabel}
            onClick={onSliceClick ? (entry) => onSliceClick(entry.name) : undefined}
            style={onSliceClick ? { cursor: 'pointer' } : undefined}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={SEV_COLORS[entry.name] ?? '#6b7280'}
                stroke="transparent"
                opacity={activeSeverity && activeSeverity !== entry.name ? 0.3 : 1}
              />
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
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: 32 }}>
        <p className="text-2xl font-mono font-bold text-slate-100">{total.toLocaleString()}</p>
        <p className="text-xs text-slate-500 uppercase tracking-wider">total</p>
      </div>
    </div>
  );
}
