import { useMemo } from 'react';
import type { ColorGroup } from '../lib/mapColors';
import { groupBy } from '../lib/mapColors';
import { useResolvedData } from '../store/dataLayer';
import { useSegments } from '../store/segments';
import { useUi } from '../store/ui';

export interface AreaColors {
  zipGroups: ColorGroup[];
  cityGroups: ColorGroup[];
}

/** Which color each ZIP and city gets, for the current map mode. */
export function useAreaColors(): AreaColors {
  const mode = useUi((s) => s.mode);
  const segments = useSegments((s) => s.segments);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const resolved = useResolvedData();

  return useMemo(() => {
    if (mode === 'segments') {
      const zipsBySegment = groupBy(Object.entries(zipSegment));
      const citiesBySegment = groupBy(Object.entries(citySegment));
      const visible = segments.filter((s) => s.visible);
      return {
        zipGroups: visible.map((s) => ({ keys: zipsBySegment.get(s.id) ?? [], color: s.color })),
        cityGroups: visible.map((s) => ({ keys: citiesBySegment.get(s.id) ?? [], color: s.color })),
      };
    }

    const classification = resolved?.classification;
    if (!resolved || !classification) return { zipGroups: [], cityGroups: [] };
    const toGroups = (values: Map<string, number>) => {
      const byClass = groupBy([...values].map(([key, value]) => [key, classification.classOf(value)] as [string, number]));
      return classification.classes.map((c, i) => ({ keys: byClass.get(i) ?? [], color: c.color }));
    };
    return {
      zipGroups: toGroups(resolved.dataset.zipValues),
      cityGroups: toGroups(resolved.dataset.cityValues),
    };
  }, [mode, segments, zipSegment, citySegment, resolved]);
}
