import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { cityLabel, useGeoData } from '../data/geoData';
import { formatNumber } from '../lib/classify';
import { useDataLayer, useResolvedData } from '../store/dataLayer';
import { useSegments } from '../store/segments';
import { useUi } from '../store/ui';
import ColorSwatch from '../components/ColorSwatch';
import type { HoverInfo } from './hover';
import { useHover } from './hover';

/** Small card that follows the mouse with the hovered area's details. */
export default function HoverTooltip() {
  const area = useHover((s) => s.area);
  return area ? <AreaTooltip area={area} /> : null;
}

function AreaTooltip({ area }: { area: HoverInfo }) {
  const geo = useGeoData((s) => s.data);
  const mode = useUi((s) => s.mode);
  const segmentId = useSegments((s) => (area.kind === 'zip' ? s.zipSegment : s.citySegment)[area.key]);
  const segment = useSegments((s) => s.segments.find((seg) => seg.id === segmentId));
  const active = useSegments((s) => s.segments.find((seg) => seg.id === s.activeId));
  const valueColumn = useDataLayer((s) => s.config.valueColumn);
  const resolved = useResolvedData();

  const city = area.kind === 'city' ? geo?.cities.get(area.key) : undefined;
  const title = area.kind === 'zip' ? `ZIP ${area.key}` : city ? cityLabel(city) : area.key;
  const value = resolved && (area.kind === 'zip' ? resolved.dataset.zipValues : resolved.dataset.cityValues).get(area.key);

  const radiusOpen = useUi((s) => s.radius !== null);

  let hint = '';
  if (mode === 'segments' && radiusOpen) {
    hint = 'Click to center the radius here';
  } else if (mode === 'segments' && active) {
    hint = segmentId === active.id ? `Click to remove from ${active.name}` : `Click to add to ${active.name}`;
  }

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        // Below-right of the mouse, flipped when that would leave the map.
        ...(area.x > area.width - 280 ? { right: area.width - area.x + 14 } : { left: area.x + 14 }),
        ...(area.y > area.height - 140 ? { bottom: area.height - area.y + 14 } : { top: area.y + 14 }),
        px: 1.5,
        py: 1,
        maxWidth: 260,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      {mode === 'segments' ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {segment && <ColorSwatch color={segment.color} size={10} />}
          <Typography variant="body2" color={segment ? 'text.primary' : 'text.secondary'}>
            {segment ? segment.name : 'Not in a segment'}
          </Typography>
        </Stack>
      ) : (
        <Typography variant="body2" color={value != null ? 'text.primary' : 'text.secondary'}>
          {value != null ? `${valueColumn}: ${formatNumber(value)}` : 'No data'}
        </Typography>
      )}
      {hint && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
