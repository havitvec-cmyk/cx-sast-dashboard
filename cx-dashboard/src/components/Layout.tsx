import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import { useExtracts, useActiveExtract } from '../context/ExtractContext';
import { formatTimestamp } from '../utils/csvParser';
import { filterLabel } from '../types';

const PAGE_TITLES: Record<string, string> = {
  '/':              'Overview',
  '/projects':      'Projects',
  '/compliance':    'Compliance',
  '/trends':        'Trends',
  '/risk':          'Risk Portfolio',
  '/remediation':   'Remediation',
};

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const title    = PAGE_TITLES[location.pathname] ?? 'Dashboard';
  const { extracts, activeId, setActiveId, filter, setFilter, clearFilter } = useExtracts();
  const active   = useActiveExtract();
  const chips    = filterLabel(filter);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-cyber-border bg-cyber-surface/50 backdrop-blur-sm flex-shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-semibold text-slate-200 flex-shrink-0">{title}</h1>
            {active && (
              <span className="text-xs font-mono text-slate-500 bg-cyber-border/40 px-2 py-0.5 rounded hidden sm:block truncate">
                {formatTimestamp(active.timestamp)}
              </span>
            )}
            {/* Active filter chips */}
            {chips.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {chips.map((chip) => {
                  const [key] = chip.split(':');
                  return (
                    <button
                      key={chip}
                      onClick={() => setFilter({ [key.toLowerCase()]: null })}
                      className="flex items-center gap-1 text-[10px] font-mono bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan px-2 py-0.5 rounded-full hover:bg-cyber-cyan/20 transition-colors"
                    >
                      {chip} <X size={10} />
                    </button>
                  );
                })}
                <button onClick={clearFilter} className="text-[10px] text-slate-500 hover:text-slate-300 font-mono transition-colors">
                  clear all
                </button>
              </div>
            )}
          </div>

          {/* Extract switcher */}
          {extracts.length > 1 && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-slate-500 hidden md:block">Extract:</span>
              <div className="flex items-center gap-1">
                {extracts.map((ext) => (
                  <button
                    key={ext.id}
                    onClick={() => setActiveId(ext.id)}
                    title={ext.name}
                    className={`w-3 h-3 rounded-full transition-all duration-150 ${activeId === ext.id ? 'scale-125 ring-2 ring-offset-1 ring-offset-cyber-surface' : 'opacity-60 hover:opacity-100'}`}
                    style={{ background: ext.color, '--tw-ring-color': ext.color } as React.CSSProperties}
                  />
                ))}
              </div>
              {active && (
                <span className="text-xs font-mono text-slate-400 max-w-[160px] truncate hidden md:block">{active.name}</span>
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
