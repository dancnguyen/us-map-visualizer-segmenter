import { useMemo, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { cityLabel, useGeoData } from '../data/geoData';
import { pluralize } from '../lib/format';
import type { AreaKind, Segment } from '../store/segments';
import { segmentMembers, useSegments } from '../store/segments';
import { useUi } from '../store/ui';

/** Chips shown before "Show all", to keep huge segments fast. */
const PREVIEW = 60;

interface Item {
  kind: AreaKind;
  key: string;
  label: string;
}

/** The ZIP codes and cities in a segment, as removable chips. */
export default function SegmentMembers({ segment }: { segment: Segment }) {
  const geo = useGeoData((s) => s.data);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const unassign = useSegments((s) => s.unassign);
  const setFocus = useUi((s) => s.setFocus);
  const { main: map } = useMap();
  const [showAll, setShowAll] = useState(false);

  const items = useMemo<Item[]>(() => {
    const { zips, cityIds } = segmentMembers({ zipSegment, citySegment }, segment.id);
    const cities = cityIds
      .map((id) => geo?.cities.get(id))
      .filter((c) => c != null)
      .sort((a, b) => cityLabel(a).localeCompare(cityLabel(b)))
      .map((c) => ({ kind: 'city' as const, key: c.id, label: cityLabel(c) }));
    return [...cities, ...zips.map((z) => ({ kind: 'zip' as const, key: z, label: z }))];
  }, [geo, zipSegment, citySegment, segment.id]);

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No areas yet.
      </Typography>
    );
  }

  const shown = showAll ? items : items.slice(0, PREVIEW);
  const flyTo = (item: Item) => {
    const p = item.kind === 'zip' ? geo?.zips.get(item.key) : geo?.cities.get(item.key);
    if (!p) return;
    setFocus({ kind: item.kind, key: item.key });
    map?.flyTo({ center: [p.lon, p.lat], zoom: item.kind === 'zip' ? 11 : 10 });
  };

  return (
    <>
      <Typography variant="subtitle2" gutterBottom>
        {pluralize(items.length, 'area')}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {shown.map((item) => (
          <Chip
            key={`${item.kind}:${item.key}`}
            size="small"
            label={item.label}
            variant={item.kind === 'city' ? 'filled' : 'outlined'}
            onClick={() => flyTo(item)}
            onDelete={() => unassign(item.kind, [item.key])}
          />
        ))}
      </Stack>
      {items.length > PREVIEW && (
        <Button size="small" sx={{ mt: 1 }} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${items.length.toLocaleString()}`}
        </Button>
      )}
    </>
  );
}
