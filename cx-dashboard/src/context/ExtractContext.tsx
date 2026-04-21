import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Extract } from '../types';
import { EXTRACT_COLORS } from '../types';

interface ExtractContextValue {
  extracts: Extract[];
  addExtract: (extract: Omit<Extract, 'id' | 'color'>) => void;
  removeExtract: (id: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const ExtractContext = createContext<ExtractContextValue | null>(null);

export function ExtractProvider({ children }: { children: ReactNode }) {
  const [extracts, setExtracts] = useState<Extract[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const addExtract = useCallback((data: Omit<Extract, 'id' | 'color'>) => {
    setExtracts((prev) => {
      const id = crypto.randomUUID();
      const color = EXTRACT_COLORS[prev.length % EXTRACT_COLORS.length];
      const next = [...prev, { ...data, id, color }];
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

  return (
    <ExtractContext.Provider value={{ extracts, addExtract, removeExtract, activeId, setActiveId }}>
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
