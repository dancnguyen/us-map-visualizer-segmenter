import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import ConfirmDialog from '../components/ConfirmDialog';
import DataLegend from '../components/DataLegend';
import { useGeoData } from '../data/geoData';
import { formatNumber, MAX_CLASSES, MIN_CLASSES, PALETTES } from '../lib/classify';
import type { ClassMethod, PaletteId } from '../lib/classify';
import { numericColumns, readCsvFile } from '../lib/csv';
import type { KeyType } from '../lib/csv';
import { pluralize } from '../lib/format';
import { useDataLayer, useResolvedData } from '../store/dataLayer';
import { newId } from '../store/storage';
import { useSegments } from '../store/segments';
import { useUi } from '../store/ui';

function PaletteStrip({ palette }: { palette: PaletteId }) {
  return (
    <Stack direction="row" sx={{ borderRadius: 0.5, overflow: 'hidden', width: 96, height: 14 }}>
      {PALETTES[palette].colors(5).map((c) => (
        <Box key={c} sx={{ flex: 1, bgcolor: c }} />
      ))}
    </Stack>
  );
}

export default function DataPanel() {
  const geo = useGeoData((s) => s.data);
  const fileName = useDataLayer((s) => s.fileName);
  const table = useDataLayer((s) => s.table);
  const config = useDataLayer((s) => s.config);
  const { setTable, setConfig, clear } = useDataLayer.getState();
  const resolved = useResolvedData();
  const setMode = useUi((s) => s.setMode);
  const [error, setError] = useState<string | null>(null);
  const [confirmSegments, setConfirmSegments] = useState(false);

  const numeric = useMemo(() => (table ? numericColumns(table) : []), [table]);
  const otherColumns = table ? table.fields.filter((f) => !numeric.includes(f)) : [];

  const upload = async (file: File) => {
    try {
      const parsed = await readCsvFile(file);
      if (parsed.fields.length === 0 || parsed.rows.length === 0) throw new Error('The file has no rows.');
      setTable(file.name, parsed);
      setError(null);
    } catch (err) {
      setError(`Couldn't read ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const uploadButton = (label: string, variant: 'contained' | 'outlined') => (
    <Button component="label" variant={variant} startIcon={<UploadFileIcon />} disabled={!geo}>
      {label}
      <input
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
    </Button>
  );

  /** One segment per color class, holding the areas in that class. */
  const createSegmentsFromClasses = () => {
    const classification = resolved?.classification;
    if (!resolved || !classification) return;
    const values = config.keyType === 'zip' ? resolved.dataset.zipValues : resolved.dataset.cityValues;
    const { segments, zipSegment, citySegment, replaceAll } = useSegments.getState();
    const newSegments = classification.classes.map((c) => ({
      id: newId(),
      name: `${config.valueColumn}: ${formatNumber(c.min)} – ${formatNumber(c.max)}`,
      color: c.color,
      visible: true,
    }));
    const assigned = { ...(config.keyType === 'zip' ? zipSegment : citySegment) };
    for (const [key, value] of values) assigned[key] = newSegments[classification.classOf(value)].id;
    replaceAll({
      segments: [...segments, ...newSegments],
      zipSegment: config.keyType === 'zip' ? assigned : zipSegment,
      citySegment: config.keyType === 'city' ? assigned : citySegment,
    });
    setMode('segments');
  };

  if (!table) {
    return (
      <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1" gutterBottom>
          Color the map with your data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload a CSV with a ZIP code column (or city and state columns) and a number column, like sales or customer
          counts. Areas are shaded by value.
        </Typography>
        {uploadButton('Upload CSV', 'contained')}
        <Box component="pre" sx={{ textAlign: 'left', mt: 3, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12 }}>
          {'zip,customers\n02134,120\n10001,385\n94105,42'}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
            {error}
          </Alert>
        )}
      </Box>
    );
  }

  const ds = resolved?.dataset;
  const columnSelect = (label: string, value: string, onChange: (v: string) => void, numericFirst = false) => (
    <TextField select size="small" fullWidth label={label} value={table.fields.includes(value) ? value : ''} onChange={(e) => onChange(e.target.value)}>
      {numericFirst && numeric.length > 0 && <ListSubheader>Number columns</ListSubheader>}
      {(numericFirst ? numeric : table.fields).map((f) => (
        <MenuItem key={f} value={f}>
          {f}
        </MenuItem>
      ))}
      {numericFirst && otherColumns.length > 0 && <ListSubheader>Other columns</ListSubheader>}
      {numericFirst &&
        otherColumns.map((f) => (
          <MenuItem key={f} value={f}>
            {f}
          </MenuItem>
        ))}
    </TextField>
  );

  return (
    <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, px: 2, py: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <DescriptionOutlinedIcon color="action" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap title={fileName ?? ''}>
            {fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {pluralize(table.rows.length, 'row')} · {pluralize(table.fields.length, 'column')}
          </Typography>
        </Box>
        <Tooltip title="Remove data">
          <IconButton aria-label="Remove data" onClick={clear}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Match rows by
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={config.keyType}
            onChange={(_, v: KeyType | null) => v && setConfig({ keyType: v })}
          >
            <ToggleButton value="zip">ZIP code</ToggleButton>
            <ToggleButton value="city">City and state</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {config.keyType === 'zip' ? (
          columnSelect('ZIP code column', config.zipColumn, (v) => setConfig({ zipColumn: v }))
        ) : (
          <Stack direction="row" spacing={1}>
            {columnSelect('City column', config.cityColumn, (v) => setConfig({ cityColumn: v }))}
            {columnSelect('State column', config.stateColumn, (v) => setConfig({ stateColumn: v }))}
          </Stack>
        )}
        {columnSelect('Value column', config.valueColumn, (v) => setConfig({ valueColumn: v }), true)}

        {ds && (
          <Alert severity={ds.matchedRows === 0 ? 'error' : ds.unmatched.length ? 'warning' : 'success'}>
            Matched {ds.matchedRows.toLocaleString()} of {pluralize(ds.totalRows, 'row')} to{' '}
            {config.keyType === 'zip' ? 'ZIP codes' : 'cities'}.
            {ds.noValueRows > 0 && ` ${pluralize(ds.noValueRows, 'row')} had no number in "${config.valueColumn}".`}
            {ds.unmatched.length > 0 && (
              <>
                {' '}
                Not found: {ds.unmatched.slice(0, 10).join(', ')}
                {ds.unmatched.length > 10 && `, and ${ds.unmatched.length - 10} more`}.
              </>
            )}
          </Alert>
        )}
        {!config.valueColumn && <Alert severity="info">Pick the column with the numbers to map.</Alert>}

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            Color classes
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={config.method}
            onChange={(_, v: ClassMethod | null) => v && setConfig({ method: v })}
          >
            <ToggleButton value="quantile">Equal counts</ToggleButton>
            <ToggleButton value="equal">Equal ranges</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
            {config.method === 'quantile'
              ? 'Each color covers about the same number of areas (quantiles).'
              : 'Each color covers the same span of values (equal intervals).'}
          </Typography>
        </Box>

        <Box sx={{ px: 1 }}>
          <Typography variant="body2" gutterBottom id="classes-label">
            Number of colors: {config.classes}
          </Typography>
          <Slider
            aria-labelledby="classes-label"
            value={config.classes}
            min={MIN_CLASSES}
            max={MAX_CLASSES}
            step={1}
            marks
            onChange={(_, v) => setConfig({ classes: v as number })}
          />
        </Box>

        <TextField
          select
          size="small"
          label="Palette"
          value={config.palette}
          onChange={(e) => setConfig({ palette: e.target.value as PaletteId })}
          slotProps={{
            select: {
              renderValue: (v) => (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <PaletteStrip palette={v as PaletteId} />
                  <span>{PALETTES[v as PaletteId].label}</span>
                </Stack>
              ),
            },
          }}
        >
          {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
            <MenuItem key={id} value={id}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <PaletteStrip palette={id} />
                <span>{PALETTES[id].label}</span>
              </Stack>
            </MenuItem>
          ))}
        </TextField>

        {resolved?.classification && (
          <>
            <Box>
              <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="overline" color="text.secondary">
                  Legend
                </Typography>
                <Typography variant="overline" color="text.secondary">
                  {config.keyType === 'zip' ? 'ZIPs' : 'Cities'}
                </Typography>
              </Stack>
              <DataLegend classes={resolved.classification.classes} showCounts />
            </Box>
            <Button variant="outlined" startIcon={<WorkspacesIcon />} onClick={() => setConfirmSegments(true)}>
              Make a segment from each color
            </Button>
          </>
        )}

        <Box>{uploadButton('Upload a different CSV', 'outlined')}</Box>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>

      <ConfirmDialog
        open={confirmSegments}
        title="Make segments from colors?"
        confirmLabel="Make segments"
        onConfirm={createSegmentsFromClasses}
        onClose={() => setConfirmSegments(false)}
      >
        This adds {pluralize(resolved?.classification?.classes.length ?? 0, 'segment')}, one per color, holding the matching{' '}
        {config.keyType === 'zip' ? 'ZIP codes' : 'cities'}. Areas already in another segment move to the new ones.
      </ConfirmDialog>
    </Box>
  );
}
