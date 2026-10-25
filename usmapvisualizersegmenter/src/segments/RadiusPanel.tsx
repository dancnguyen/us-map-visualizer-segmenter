import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AreaSearchField from '../components/AreaSearchField';
import ColorSwatch from '../components/ColorSwatch';
import { useGeoData } from '../data/geoData';
import { pluralize } from '../lib/format';
import { areasWithinRadius, MAX_RADIUS_MILES, radiusBounds, radiusSegmentName } from '../lib/radius';
import { resultName } from '../lib/search';
import { useSegments } from '../store/segments';
import { useUi } from '../store/ui';

const PRESETS = [10, 25, 50, 100, 250];

/**
 * Builds a segment from every ZIP code and city whose center is within a
 * radius of a chosen ZIP or city. The circle is drawn on the map (MapView).
 */
export default function RadiusPanel({ onDone }: { onDone: (message: string) => void }) {
  const geo = useGeoData((s) => s.data);
  const radius = useUi((s) => s.radius);
  const { updateRadius, closeRadius } = useUi.getState();
  const segments = useSegments((s) => s.segments);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const { main: map } = useMap();

  const [milesText, setMilesText] = useState(String(radius?.miles ?? 25));
  const [includeZips, setIncludeZips] = useState(true);
  const [includeCities, setIncludeCities] = useState(true);
  const [customName, setCustomName] = useState<string | null>(null);

  const center = radius?.center ?? null;
  const targetId = radius?.targetId ?? null;
  const target = segments.find((s) => s.id === targetId) ?? null;
  const milesValue = Number(milesText);
  const milesValid = milesText.trim() !== '' && milesValue > 0 && milesValue <= MAX_RADIUS_MILES;
  const miles = milesValid ? milesValue : 0;

  // The map and counts follow the typed radius once typing pauses.
  const deferredMiles = useDeferredValue(miles);
  useEffect(() => {
    if (milesValid) updateRadius({ miles: milesValue });
  }, [milesValid, milesValue, updateRadius]);

  useEffect(() => {
    if (!center || !deferredMiles || !map) return;
    const timer = setTimeout(() => map.fitBounds(radiusBounds(center, deferredMiles), { padding: 48, maxZoom: 12 }), 300);
    return () => clearTimeout(timer);
  }, [center, deferredMiles, map]);

  const result = useMemo(
    () =>
      geo && center && deferredMiles
        ? areasWithinRadius(geo, center, deferredMiles, { zips: includeZips, cities: includeCities })
        : null,
    [geo, center, deferredMiles, includeZips, includeCities],
  );

  if (!radius) return null;

  const autoName = center && miles ? radiusSegmentName(miles, resultName(center)) : '';
  const name = customName ?? autoName;
  const total = result ? result.zips.length + result.cityIds.length : 0;
  const moving = result
    ? result.zips.filter((z) => zipSegment[z] && zipSegment[z] !== targetId).length +
      result.cityIds.filter((c) => citySegment[c] && citySegment[c] !== targetId).length
    : 0;
  const canApply = total > 0 && (target !== null || name.trim() !== '');

  const apply = () => {
    if (!result || !canApply) return;
    const { addSegment, assign, setActive } = useSegments.getState();
    const id = target ? target.id : addSegment({ name: name.trim() });
    assign('zip', result.zips, id);
    assign('city', result.cityIds, id);
    setActive(id);
    closeRadius();
    onDone(
      `Added ${[result.zips.length && pluralize(result.zips.length, 'ZIP code'), result.cityIds.length && pluralize(result.cityIds.length, 'city', 'cities')]
        .filter(Boolean)
        .join(' and ')} to ${target ? target.name : name.trim()}.`,
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1, py: 1 }}>
        <IconButton aria-label="Back to segments" onClick={closeRadius}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1">Segment by radius</Typography>
      </Stack>

      <Stack spacing={2.5} sx={{ px: 2, pb: 2, overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <Box>
          <AreaSearchField
            label="Center"
            placeholder="ZIP code or city"
            value={center}
            onChange={(c) => updateRadius({ center: c })}
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Or click a ZIP code or city on the map.
          </Typography>
        </Box>

        <Box>
          <TextField
            label="Radius"
            type="number"
            size="small"
            fullWidth
            value={milesText}
            onChange={(e) => setMilesText(e.target.value)}
            error={!milesValid}
            helperText={milesValid ? 'Straight-line distance to each area’s center point' : `Enter 1 to ${MAX_RADIUS_MILES.toLocaleString()} miles`}
            slotProps={{
              input: { endAdornment: <InputAdornment position="end">miles</InputAdornment> },
              htmlInput: { min: 1, max: MAX_RADIUS_MILES, step: 'any' },
            }}
          />
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            {PRESETS.map((p) => (
              <Chip
                key={p}
                size="small"
                label={`${p} mi`}
                color={miles === p ? 'primary' : 'default'}
                variant={miles === p ? 'filled' : 'outlined'}
                onClick={() => setMilesText(String(p))}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Include
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={<Checkbox checked={includeZips} onChange={(e) => setIncludeZips(e.target.checked)} />}
              label={`ZIP codes${result && includeZips ? ` (${result.zips.length.toLocaleString()})` : ''}`}
            />
            <FormControlLabel
              control={<Checkbox checked={includeCities} onChange={(e) => setIncludeCities(e.target.checked)} />}
              label={`Cities${result && includeCities ? ` (${result.cityIds.length.toLocaleString()})` : ''}`}
            />
          </FormGroup>
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Save to
          </Typography>
          <RadioGroup
            value={target ? 'existing' : 'new'}
            onChange={(e) => updateRadius({ targetId: e.target.value === 'new' ? null : (segments[0]?.id ?? null) })}
          >
            <FormControlLabel value="new" control={<Radio />} label="New segment" />
            {target === null && (
              <TextField
                size="small"
                label="Name"
                value={name}
                placeholder="Within 25 mi of …"
                onChange={(e) => setCustomName(e.target.value)}
                sx={{ ml: 4, mb: 1 }}
              />
            )}
            <FormControlLabel value="existing" control={<Radio />} label="Existing segment" disabled={segments.length === 0} />
            {target && (
              <TextField
                select
                size="small"
                label="Segment"
                value={target.id}
                onChange={(e) => updateRadius({ targetId: e.target.value })}
                sx={{ ml: 4 }}
              >
                {segments.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <ColorSwatch color={s.color} size={12} />
                      <span>{s.name}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
            )}
          </RadioGroup>
        </Box>

        {center && result && (
          <Alert severity={total ? 'info' : 'warning'}>
            {total
              ? `${pluralize(total, 'area')} within ${pluralize(deferredMiles, 'mile')} of ${resultName(center)}.`
              : `Nothing within ${pluralize(deferredMiles, 'mile')} of ${resultName(center)}. Try a larger radius.`}
            {moving > 0 && ` ${pluralize(moving, 'area')} will move here from other segments.`}
          </Alert>
        )}

        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button onClick={closeRadius}>Cancel</Button>
          <Button variant="contained" disabled={!canApply} onClick={apply}>
            {target ? 'Add to segment' : 'Create segment'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
