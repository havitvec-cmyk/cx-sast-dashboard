import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Layers, Shield, TrendingUp,
  Upload, ChevronLeft, ChevronRight, ShieldAlert,
} from 'lucide-react';
import FileUpload from './FileUpload';
import { useExtracts } from '../context/ExtractContext';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Overview'   },
  { to: '/projects',   icon: Layers,          label: 'Projects'   },
  { to: '/compliance', icon: Shield,          label: 'Compliance' },
  { to: '/trends',     icon: TrendingUp,      label: 'Trends'     },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const { extracts } = useExtracts();

  return (
    <aside
      className={`relative flex flex-col bg-cyber-surface border-r border-cyber-border transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-cyber-border">
        <ShieldAlert size={22} className="text-cyber-cyan flex-shrink-0" />
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold text-slate-100 leading-none">CX Dashboard</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">SAST Analytics</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
               ${isActive
                 ? 'text-cyber-cyan bg-cyber-cyan/10 border-l-2 border-cyber-cyan pl-[10px]'
                 : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-border/40'
               }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Upload section */}
      <div className="border-t border-cyber-border p-2">
        {showUpload && !collapsed && (
          <div className="mb-2 p-3 bg-cyber-card border border-cyber-border rounded-xl">
            <FileUpload onClose={() => setShowUpload(false)} />
          </div>
        )}
        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
            ${showUpload
              ? 'text-cyber-cyan bg-cyber-cyan/10'
              : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-border/40'
            }`}
          title={collapsed ? 'Upload extracts' : undefined}
        >
          <Upload size={18} className="flex-shrink-0" />
          {!collapsed && (
            <span className="flex-1 text-left">
              Upload Extracts
              {extracts.length > 0 && (
                <span className="ml-2 text-xs bg-cyber-cyan/20 text-cyber-cyan px-1.5 py-0.5 rounded-full">
                  {extracts.length}
                </span>
              )}
            </span>
          )}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-[72px] bg-cyber-surface border border-cyber-border rounded-full p-1 text-slate-500 hover:text-cyber-cyan transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
