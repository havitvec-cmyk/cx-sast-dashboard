import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import type { VulnerabilityRow } from '../../types';

const DORA_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];
const SEV_COLORS = { High: '#ef4444', Medium: '#f97316', Low: '#facc15', Info: '#3b82f6' };

interface Props { rows: VulnerabilityRow[] }

export default function RiskMatrix({ rows }: Props) {
  const matrix: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const dora = (row['DORA Criticallity'] || 'Unknown').trim() || 'Unknown';
    const sev  = (row['Result Severity'] || 'Unknown').trim() || 'Unknown';
    if (!matrix[dora]) matrix[dora] = {};
    matrix[dora][sev] = (matrix[dora][sev] || 0) + 1;
  }

  const data = DORA_ORDER.filter((d) => matrix[d]).map((dora) => ({
    dora,
    High:   matrix[dora]['High']   || 0,
    Medium: matrix[dora]['Medium'] || 0,
    Low:    matrix[dora]['Low']    || 0,
    Info:   matrix[dora]['Info'] || matrix[dora]['Information'] || 0,
  }));

  if (data.length === 0) return <p className="text-center text-slate-600 text-sm py-8">No data</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(34,211,238,0.06)" />
          <XAxis
            dataKey="dora"
            tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
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
            labelFormatter={(l) => `DORA: ${l}`}
          />
          <Legend
            iconType="circle" iconSize={8}
            formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{v}</span>}
          />
          {Object.entries(SEV_COLORS).map(([sev, color]) => (
            <Bar key={sev} dataKey={sev} stackId="a" fill={color}
              radius={sev === 'Info' ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
