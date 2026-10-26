import { create } from 'zustand';
import type { AreaKind } from '../store/segments';

export interface HoverInfo {
  kind: AreaKind;
  key: string;
  /** Mouse position in the map */
  x: number;
  y: number;
  /** Map size, so the tooltip can stay inside it */
  width: number;
  height: number;
}

/**
 * The area under the mouse. Kept outside MapView so mouse moves re-render only
 * the tooltip, not the whole map.
 */
export const useHover = create<{ area: HoverInfo | null }>(() => ({ area: null }));
