import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { schemeTableau10 } from 'd3-scale-chromatic';
import { newId, safeStorage } from './storage';

export type AreaKind = 'zip' | 'city';

export interface Segment {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

/** Distinct colors that read well on light and dark maps. */
export const SEGMENT_COLORS: readonly string[] = schemeTableau10;

interface SegmentsState {
  segments: Segment[];
  /** ZIP code -> segment id. An area belongs to at most one segment. */
  zipSegment: Record<string, string>;
  /** City GEOID -> segment id */
  citySegment: Record<string, string>;
  /** Segment that map clicks add to */
  activeId: string | null;

  addSegment: (fields?: Partial<Omit<Segment, 'id'>>) => string;
  updateSegment: (id: string, fields: Partial<Omit<Segment, 'id'>>) => void;
  removeSegment: (id: string) => void;
  setActive: (id: string | null) => void;
  /** Adds areas to a segment, moving them out of any other segment. */
  assign: (kind: AreaKind, keys: string[], segmentId: string) => void;
  unassign: (kind: AreaKind, keys: string[]) => void;
  /** Map click: add to the active segment, or remove if already in it. */
  toggle: (kind: AreaKind, key: string) => void;
  clearSegment: (id: string) => void;
  /** Replaces everything (used by CSV import). */
  replaceAll: (data: Pick<SegmentsState, 'segments' | 'zipSegment' | 'citySegment'>) => void;
}

const mapKey = (kind: AreaKind) => (kind === 'zip' ? 'zipSegment' : 'citySegment');
const patch = (kind: AreaKind, map: Record<string, string>) =>
  kind === 'zip' ? { zipSegment: map } : { citySegment: map };

function withoutSegment(map: Record<string, string>, segmentId: string) {
  return Object.fromEntries(Object.entries(map).filter(([, id]) => id !== segmentId));
}

/** First palette color not used yet, cycling once all are taken. */
export function nextColor(segments: Segment[]): string {
  const used = new Set(segments.map((s) => s.color.toLowerCase()));
  return SEGMENT_COLORS.find((c) => !used.has(c.toLowerCase())) ?? SEGMENT_COLORS[segments.length % SEGMENT_COLORS.length];
}

export const useSegments = create<SegmentsState>()(
  persist(
    (set, get) => ({
      segments: [],
      zipSegment: {},
      citySegment: {},
      activeId: null,

      addSegment: (fields = {}) => {
        const { segments } = get();
        const segment: Segment = {
          id: newId(),
          name: fields.name?.trim() || `Segment ${segments.length + 1}`,
          color: fields.color ?? nextColor(segments),
          visible: fields.visible ?? true,
        };
        set({ segments: [...segments, segment], activeId: segment.id });
        return segment.id;
      },

      updateSegment: (id, fields) =>
        set((s) => ({ segments: s.segments.map((seg) => (seg.id === id ? { ...seg, ...fields } : seg)) })),

      removeSegment: (id) =>
        set((s) => ({
          segments: s.segments.filter((seg) => seg.id !== id),
          zipSegment: withoutSegment(s.zipSegment, id),
          citySegment: withoutSegment(s.citySegment, id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      setActive: (id) => set({ activeId: id }),

      assign: (kind, keys, segmentId) =>
        set((s) => {
          const next = { ...s[mapKey(kind)] };
          for (const key of keys) next[key] = segmentId;
          return patch(kind, next);
        }),

      unassign: (kind, keys) =>
        set((s) => {
          const next = { ...s[mapKey(kind)] };
          for (const key of keys) delete next[key];
          return patch(kind, next);
        }),

      toggle: (kind, key) => {
        const { activeId, assign, unassign } = get();
        if (!activeId) return;
        if (get()[mapKey(kind)][key] === activeId) unassign(kind, [key]);
        else assign(kind, [key], activeId);
      },

      clearSegment: (id) =>
        set((s) => ({ zipSegment: withoutSegment(s.zipSegment, id), citySegment: withoutSegment(s.citySegment, id) })),

      replaceAll: ({ segments, zipSegment, citySegment }) =>
        set({ segments, zipSegment, citySegment, activeId: segments[0]?.id ?? null }),
    }),
    { name: 'usmap.segments', version: 1, storage: safeStorage },
  ),
);

/** Members of one segment, grouped by kind. */
export function segmentMembers(state: Pick<SegmentsState, 'zipSegment' | 'citySegment'>, segmentId: string) {
  const pick = (map: Record<string, string>) =>
    Object.keys(map)
      .filter((k) => map[k] === segmentId)
      .sort();
  return { zips: pick(state.zipSegment), cityIds: pick(state.citySegment) };
}
