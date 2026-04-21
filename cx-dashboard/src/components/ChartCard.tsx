import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export default function ChartCard({ title, subtitle, children, className = '', actions }: ChartCardProps) {
  return (
    <div className={`cyber-card p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-mono">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
