import { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useGeoData } from '../data/geoData';
import { formatNumber } from '../lib/classify';
import { dataResultsToCsv, segmentsToCsv } from '../lib/csv';
import { downloadBlob, downloadText, fileStem } from '../lib/download';
import { pluralize } from '../lib/format';
import type { LegendItem } from '../lib/mapImage';
import { canvasToBlob, canvasToPdf, captureMap, composeImage } from '../lib/mapImage';
import { useDataLayer, useResolvedData } from '../store/dataLayer';
import { useSegments } from '../store/segments';
import type { ExportTab } from '../store/ui';
import { useUi } from '../store/ui';

const ATTRIBUTION =
  'Basemap: OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors. ZIP and city data: U.S. Census Bureau.';
const FONT = 'Roboto, Helvetica, Arial, sans-serif';

type Scale = 1 | 2 | 3;
type Format = 'png' | 'pdf';

const countLabel = (zips: number, cities: number) =>
  [zips && pluralize(zips, 'ZIP'), cities && pluralize(cities, 'city', 'cities')].filter(Boolean).join(', ') || 'empty';

/** Legend entries and a default title for what the map shows right now. */
function useMapSummary() {
  const mode = useUi((s) => s.mode);
  const segments = useSegments((s) => s.segments);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const config = useDataLayer((s) => s.config);
  const resolved = useResolvedData();

  return useMemo(() => {
    if (mode === 'data') {
      const classes = resolved?.classification?.classes ?? [];
      return {
        title: config.valueColumn ? `${config.valueColumn} by ${config.keyType === 'zip' ? 'ZIP code' : 'city'}` : 'US map',
        legendTitle: config.valueColumn,
        legend: classes.map((c): LegendItem => ({ color: c.color, label: `${formatNumber(c.min)} – ${formatNumber(c.max)}` })),
      };
    }
    const visible = segments.filter((s) => s.visible);
    const count = (map: Record<string, string>, id: string) => Object.values(map).filter((v) => v === id).length;
    return {
      title: visible.length === 1 ? visible[0].name : 'Segments',
      legendTitle: 'Segments',
      legend: visible.map((s): LegendItem => ({
        color: s.color,
        label: `${s.name} (${countLabel(count(zipSegment, s.id), count(citySegment, s.id))})`,
      })),
    };
  }, [mode, segments, zipSegment, citySegment, config, resolved]);
}

function ImageExport({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const { main: mapRef } = useMap();
  const summary = useMapSummary();
  const [title, setTitle] = useState(summary.title);
  const [showTitle, setShowTitle] = useState(true);
  const [showLegend, setShowLegend] = useState(summary.legend.length > 0);
  const [scale, setScale] = useState<Scale>(2);
  const [format, setFormat] = useState<Format>('png');
  const [snapshot, setSnapshot] = useState<{ canvas: HTMLCanvasElement; scale: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A 1x copy of the map for the preview. The dialog covers the map, so it can't change meanwhile.
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    let cancelled = false;
    Promise.all([document.fonts.load(`500 24px Roboto`), document.fonts.load(`400 14px Roboto`)])
      .then(() => captureMap(map, 1))
      .then((shot) => !cancelled && setSnapshot(shot))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [mapRef]);

  const compose = (shot: { canvas: HTMLCanvasElement; scale: number }) =>
    composeImage({
      map: shot.canvas,
      scale: shot.scale,
      title: showTitle && title.trim() ? title.trim() : undefined,
      legendTitle: summary.legendTitle,
      legend: showLegend ? summary.legend : undefined,
      attribution: ATTRIBUTION,
      colors: {
        background: theme.palette.background.paper,
        text: theme.palette.text.primary,
        muted: theme.palette.text.secondary,
        border: theme.palette.divider,
      },
      fontFamily: FONT,
    });

  const preview = snapshot ? compose(snapshot) : null;
  const previewUrl = preview?.toDataURL('image/png');

  const save = async () => {
    const map = mapRef?.getMap();
    if (!map) return;
    setBusy(true);
    setError(null);
    try {
      const shot = scale === 1 && snapshot ? snapshot : await captureMap(map, scale);
      const image = compose(shot);
      const name = fileStem(showTitle && title.trim() ? title : summary.title);
      if (format === 'png') downloadBlob(await canvasToBlob(image), `${name}.png`);
      else downloadBlob(await canvasToPdf(image, shot.scale, title.trim() || summary.title), `${name}.pdf`);
      onClose();
    } catch (err) {
      setError(`Couldn't create the ${format.toUpperCase()}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {previewUrl ? (
              <Box
                component="img"
                src={previewUrl}
                alt="Preview of the exported image"
                sx={{ width: '100%', maxHeight: 420, objectFit: 'contain', border: 1, borderColor: 'divider', borderRadius: 1 }}
              />
            ) : (
              <Skeleton variant="rounded" height={320} />
            )}
            <Typography variant="caption" color="text.secondary">
              Exports the map exactly as it&rsquo;s shown. To change the view, close this, pan or zoom, then export again.
            </Typography>
          </Box>

          <Stack spacing={2} sx={{ width: { md: 260 }, flexShrink: 0 }}>
            <Box>
              <FormControlLabel
                control={<Checkbox checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />}
                label="Title"
              />
              <TextField
                size="small"
                fullWidth
                value={title}
                disabled={!showTitle}
                onChange={(e) => setTitle(e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': 'Image title' } }}
              />
            </Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={showLegend && summary.legend.length > 0}
                  disabled={summary.legend.length === 0}
                  onChange={(e) => setShowLegend(e.target.checked)}
                />
              }
              label={summary.legend.length ? 'Legend' : 'Legend (nothing to show)'}
            />
            <Box>
              <Typography variant="overline" color="text.secondary">
                Sharpness
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="primary"
                value={scale}
                onChange={(_, v: Scale | null) => v && setScale(v)}
              >
                <ToggleButton value={1}>Standard</ToggleButton>
                <ToggleButton value={2}>High</ToggleButton>
                <ToggleButton value={3}>Print</ToggleButton>
              </ToggleButtonGroup>
              {preview && snapshot && (
                <Typography variant="caption" color="text.secondary">
                  About {Math.round((preview.width / snapshot.scale) * scale).toLocaleString()} ×{' '}
                  {Math.round((preview.height / snapshot.scale) * scale).toLocaleString()} pixels
                </Typography>
              )}
            </Box>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Format
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="primary"
                value={format}
                onChange={(_, v: Format | null) => v && setFormat(v)}
              >
                <ToggleButton value="png">PNG</ToggleButton>
                <ToggleButton value="pdf">PDF</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!snapshot || busy}
          onClick={() => void save()}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {busy ? 'Exporting…' : `Download ${format.toUpperCase()}`}
        </Button>
      </DialogActions>
    </>
  );
}

type CsvKind = 'segments' | 'data';

function CsvExport({ onClose }: { onClose: () => void }) {
  const geo = useGeoData((s) => s.data);
  const segments = useSegments((s) => s.segments);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const fileName = useDataLayer((s) => s.fileName);
  const config = useDataLayer((s) => s.config);
  const resolved = useResolvedData();
  const mode = useUi((s) => s.mode);

  const hasSegments = segments.length > 0;
  const hasData = resolved !== null;
  const [kind, setKind] = useState<CsvKind>(mode === 'data' && hasData ? 'data' : hasSegments ? 'segments' : 'data');
  const areaCount = Object.keys(zipSegment).length + Object.keys(citySegment).length;

  const save = () => {
    if (kind === 'segments') {
      downloadText(segmentsToCsv(segments, zipSegment, citySegment, geo), `${fileStem('segments')}.csv`);
    } else if (resolved && geo) {
      const base = fileName?.replace(/\.csv$/i, '') ?? 'data';
      downloadText(dataResultsToCsv(resolved.dataset, resolved.classification, config, geo), `${fileStem(`${base} results`)}.csv`);
    }
    onClose();
  };

  return (
    <>
      <DialogContent>
        <RadioGroup value={kind} onChange={(e) => setKind(e.target.value as CsvKind)}>
          <FormControlLabel
            value="segments"
            disabled={!hasSegments}
            control={<Radio />}
            label={
              <Box sx={{ py: 1 }}>
                <Typography>Segments</Typography>
                <Typography variant="body2" color="text.secondary">
                  {hasSegments
                    ? `${pluralize(segments.length, 'segment')}, ${pluralize(areaCount, 'area')}. One row per ZIP code or city with its segment, color and center point. Can be imported again.`
                    : 'No segments yet.'}
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="data"
            disabled={!hasData}
            control={<Radio />}
            label={
              <Box sx={{ py: 1 }}>
                <Typography>Data results</Typography>
                <Typography variant="body2" color="text.secondary">
                  {resolved
                    ? `From ${fileName}: ${pluralize(resolved.dataset.matchedRows, 'matched row')}. One row per ${config.keyType === 'zip' ? 'ZIP code' : 'city'} with its value, color class and center point, then entries that weren’t found.`
                    : 'Upload a CSV in the Data tab first.'}
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={(kind === 'segments' && !hasSegments) || (kind === 'data' && !hasData)} onClick={save}>
          Download CSV
        </Button>
      </DialogActions>
    </>
  );
}

/** Export the map as an image or PDF, or segments and data results as CSV. */
export default function ExportDialog() {
  const tab = useUi((s) => s.exportTab);
  const setTab = useUi((s) => s.setExportTab);
  const close = () => setTab(null);

  return (
    <Dialog open={tab !== null} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>Export</DialogTitle>
      <Tabs value={tab ?? 'image'} onChange={(_, v: ExportTab) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="image" label="Image" />
        <Tab value="csv" label="CSV" />
      </Tabs>
      {tab === 'image' && <ImageExport onClose={close} />}
      {tab === 'csv' && <CsvExport onClose={close} />}
    </Dialog>
  );
}
