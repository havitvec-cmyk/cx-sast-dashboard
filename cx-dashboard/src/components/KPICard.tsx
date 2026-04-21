import type { ReactNode } from 'react';

type ColorKey = 'cyan' | 'red' | 'orange' | 'yellow' | 'green' | 'purple' | 'blue';

const colorMap: Record<ColorKey, { text: string; border: string; glow: string; bg: string }> = {
  cyan:   { text: 'text-cyber-cyan',   border: 'border-cyber-cyan/30',   glow: 'shadow-glow-sm',    bg: 'bg-cyber-cyan/10'   },
  red:    { text: 'text-red-400',      border: 'border-red-500/30',      glow: 'shadow-glow-red',   bg: 'bg-red-500/10'      },
  orange: { text: 'text-orange-400',   border: 'border-orange-500/30',   glow: '',                  bg: 'bg-orange-500/10'   },
  yellow: { text: 'text-yellow-400',   border: 'border-yellow-400/30',   glow: '',                  bg: 'bg-yellow-400/10'   },
  green:  { text: 'text-emerald-400',  border: 'border-emerald-400/30',  glow: '',                  bg: 'bg-emerald-400/10'  },
  purple: { text: 'text-violet-400',   border: 'border-violet-400/30',   glow: 'shadow-glow-purple', bg: 'bg-violet-400/10'  },
  blue:   { text: 'text-blue-400',     border: 'border-blue-400/30',     glow: '',                  bg: 'bg-blue-400/10'     },
};

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ReactNode;
  color?: ColorKey;
  trend?: { value: number; label: string };
}

export default function KPICard({ title, value, subtitle, icon, color = 'cyan', trend }: KPICardProps) {
  const c = colorMap[color];
  return (
    <div className={`cyber-card border ${c.border} ${c.glow} p-5 flex flex-col gap-3 relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{title}</p>
        <div className={`${c.bg} ${c.text} p-2 rounded-lg`}>{icon}</div>
      </div>

      <div>
        <p className={`stat-value ${c.text}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1 font-mono">{subtitle}</p>}
      </div>

      {trend && (
        <div className={`flex items-center gap-1.5 text-xs font-mono ${trend.value >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          <span>{trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value).toLocaleString()}</span>
          <span className="text-slate-500">{trend.label}</span>
        </div>
      )}

      {/* Corner accent */}
      <div className={`absolute top-0 right-0 w-16 h-16 opacity-10 ${c.bg} rounded-bl-full`} />
    </div>
  );
}
