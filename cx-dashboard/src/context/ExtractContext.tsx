import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Extract, FilterState, SlaConfig } from '../types';
import { EXTRACT_COLORS, EMPTY_FILTER, DEFAULT_SLA, applyFilter } from '../types';

interface ExtractContextValue {
  extracts: Extract[];
  addExtract: (extract: Omit<Extract, 'id' | 'color'>) => void;
  removeExtract: (id: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  // Global filter
  filter: FilterState;
  setFilter: (patch: Partial<FilterState>) => void;
  clearFilter: () => void;
  // Filtered rows for the active extract
  filteredRows: ReturnType<typeof applyFilter>;
  // SLA configuration
  slaConfig: SlaConfig;
  setSlaConfig: (cfg: SlaConfig) => void;
}

const ExtractContext = createContext<ExtractContextValue | null>(null);

function loadSla(): SlaConfig {
  try {
    const raw = localStorage.getItem('cx_sla_config');
    if (raw) return { ...DEFAULT_SLA, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SLA;
}

export function ExtractProvider({ children }: { children: ReactNode }) {
  const [extracts, setExtracts]   = useState<Extract[]>([]);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [filter, setFilterState]  = useState<FilterState>(EMPTY_FILTER);
  const [slaConfig, setSlaState]  = useState<SlaConfig>(loadSla);

  const addExtract = useCallback((data: Omit<Extract, 'id' | 'color'>) => {
    setExtracts((prev) => {
      const id    = crypto.randomUUID();
      const color = EXTRACT_COLORS[prev.length % EXTRACT_COLORS.length];
      const next  = [...prev, { ...data, id, color }];
      setActiveId(id);
      return next;
    });
  }, []);

  const removeExtract = useCallback((id: string) => {
    setExtracts((prev) => {
      const next = prev.filter((e) => e.id !== id);
      if (next.length > 0) setActiveId(next[next.length - 1].id);
      else setActiveId(null);
      return next;
    });
  }, []);

  const setFilter = useCallback((patch: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilter = useCallback(() => setFilterState(EMPTY_FILTER), []);

  const setSlaConfig = useCallback((cfg: SlaConfig) => {
    setSlaState(cfg);
    try { localStorage.setItem('cx_sla_config', JSON.stringify(cfg)); } catch { /* ignore */ }
  }, []);

  const activeExtract = useMemo(
    () => extracts.find((e) => e.id === activeId) ?? null,
    [extracts, activeId],
  );

  const filteredRows = useMemo(
    () => activeExtract ? applyFilter(activeExtract.rows, filter) : [],
    [activeExtract, filter],
  );

  return (
    <ExtractContext.Provider value={{
      extracts, addExtract, removeExtract,
      activeId, setActiveId,
      filter, setFilter, clearFilter,
      filteredRows,
      slaConfig, setSlaConfig,
    }}>
      {children}
    </ExtractContext.Provider>
  );
}

export function useExtracts() {
  const ctx = useContext(ExtractContext);
  if (!ctx) throw new Error('useExtracts must be used within ExtractProvider');
  return ctx;
}

export function useActiveExtract(): Extract | null {
  const { extracts, activeId } = useExtracts();
  return extracts.find((e) => e.id === activeId) ?? null;
}
