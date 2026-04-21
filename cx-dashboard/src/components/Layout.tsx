import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useExtracts, useActiveExtract } from '../context/ExtractContext';
import { formatTimestamp } from '../utils/csvParser';

const PAGE_TITLES: Record<string, string> = {
  '/':           'Overview',
  '/projects':   'Projects',
  '/compliance': 'Compliance',
  '/trends':     'Trends',
};

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Dashboard';
  const { extracts, activeId, setActiveId } = useExtracts();
  const active = useActiveExtract();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-cyber-border bg-cyber-surface/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-slate-200">{title}</h1>
            {active && (
              <span className="text-xs font-mono text-slate-500 bg-cyber-border/40 px-2 py-0.5 rounded">
                {formatTimestamp(active.timestamp)}
              </span>
            )}
          </div>

          {/* Extract switcher */}
          {extracts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Extract:</span>
              <div className="flex items-center gap-1">
                {extracts.map((ext) => (
                  <button
                    key={ext.id}
                    onClick={() => setActiveId(ext.id)}
                    title={ext.name}
                    className={`w-3 h-3 rounded-full transition-all duration-150 ${
                      activeId === ext.id ? 'scale-125 ring-2 ring-offset-1 ring-offset-cyber-surface' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ background: ext.color, '--tw-ring-color': ext.color } as React.CSSProperties}
                  />
                ))}
              </div>
              {active && (
                <span className="text-xs font-mono text-slate-400 max-w-[200px] truncate">{active.name}</span>
              )}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto grid-bg p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
