import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface Target {
  source: string;
  sourceLayer?: string;
}

/**
 * Sets each area's color as MapLibre "feature state", which the map layers read
 * with ['feature-state', 'color']. Only areas whose color changed are updated.
 * Putting the colors in the layer style instead makes MapLibre re-process every
 * loaded tile on each change, which is slow with ~33k ZIPs.
 *
 * Must be rendered inside <Map>.
 */
export default function FeatureColors({ zips, cities }: { zips: Map<string, string>; cities: Map<string, string> }) {
  const map = useMap().current?.getMap();
  useSyncColors(map, ZIPS, zips);
  useSyncColors(map, CITIES, cities);
  return null;
}

const ZIPS: Target = { source: 'zips', sourceLayer: 'zips' };
const CITIES: Target = { source: 'cities' };

function useSyncColors(map: MapLibreMap | undefined, target: Target, colors: Map<string, string>) {
  // What was last applied, and to which source object. A basemap switch
  // re-creates the sources, which drops their state, so then we start over.
  const applied = useRef<{ source: unknown; colors: Map<string, string> }>({ source: null, colors: new Map() });

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      const source = map.getSource(target.source);
      if (!source) return;
      const last = applied.current;
      if (last.source === source && last.colors === colors) return;
      const prev = last.source === source ? last.colors : new Map<string, string>();
      for (const id of prev.keys()) {
        if (!colors.has(id)) map.removeFeatureState({ ...target, id }, 'color');
      }
      for (const [id, color] of colors) {
        if (prev.get(id) !== color) map.setFeatureState({ ...target, id }, { color });
      }
      applied.current = { source, colors };
    };
    sync();
    // Catches the source being added (or re-added) after this runs.
    map.on('sourcedata', sync);
    return () => {
      map.off('sourcedata', sync);
    };
  }, [map, target, colors]);
}
