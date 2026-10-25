import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SearchResult } from '../lib/search';
import type { AreaKind } from './segments';
import { safeStorage } from './storage';

/** Which sidebar tab is open; it also decides how the map is colored. */
export type MapMode = 'segments' | 'data';

export interface AreaRef {
  kind: AreaKind;
  key: string;
}

/** The "segment by radius" tool, while it's open. */
export interface RadiusTool {
  center: SearchResult | null;
  miles: number;
  /** Segment to add to, or null to create a new one */
  targetId: string | null;
}

export type ExportTab = 'image' | 'csv';

interface UiState {
  mode: MapMode;
  showZips: boolean;
  showCities: boolean;
  /** Area picked in search; outlined on the map */
  focus: AreaRef | null;
  radius: RadiusTool | null;
  /** Open tab of the Export dialog, or null when closed */
  exportTab: ExportTab | null;
  setMode: (mode: MapMode) => void;
  setShowZips: (show: boolean) => void;
  setShowCities: (show: boolean) => void;
  setFocus: (focus: AreaRef | null) => void;
  openRadius: (targetId?: string | null) => void;
  updateRadius: (fields: Partial<RadiusTool>) => void;
  closeRadius: () => void;
  setExportTab: (tab: ExportTab | null) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      mode: 'segments',
      showZips: true,
      showCities: true,
      focus: null,
      radius: null,
      exportTab: null,
      // The radius tool lives in the Segments tab, so leaving the tab closes it.
      setMode: (mode) => set({ mode, radius: null }),
      setShowZips: (showZips) => set({ showZips }),
      setShowCities: (showCities) => set({ showCities }),
      setFocus: (focus) => set({ focus }),
      openRadius: (targetId = null) =>
        set((s) => ({ radius: { center: s.radius?.center ?? null, miles: s.radius?.miles ?? 25, targetId } })),
      updateRadius: (fields) => set((s) => (s.radius ? { radius: { ...s.radius, ...fields } } : {})),
      closeRadius: () => set({ radius: null }),
      setExportTab: (exportTab) => set({ exportTab }),
    }),
    {
      name: 'usmap.ui',
      version: 1,
      storage: safeStorage,
      partialize: ({ mode, showZips, showCities }) => ({ mode, showZips, showCities }),
    },
  ),
);
