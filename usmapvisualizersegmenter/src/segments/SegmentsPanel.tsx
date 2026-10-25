import { useMemo, useRef, useState } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import ColorSwatch from '../components/ColorSwatch';
import ConfirmDialog from '../components/ConfirmDialog';
import { useGeoData } from '../data/geoData';
import type { GeoData } from '../data/geoData';
import { readCsvFile, segmentsFromCsv } from '../lib/csv';
import { pluralize } from '../lib/format';
import type { Segment } from '../store/segments';
import { nextColor, segmentMembers, useSegments } from '../store/segments';
import { useUi } from '../store/ui';
import AddAreasDialog from './AddAreasDialog';
import RadiusPanel from './RadiusPanel';
import SegmentDialog from './SegmentDialog';
import SegmentMembers from './SegmentMembers';

type Bounds = [[number, number], [number, number]];

/** Box around a segment's ZIP and city center points. */
function memberBounds(members: { zips: string[]; cityIds: string[] }, geo: GeoData): Bounds | null {
  const points = [
    ...members.zips.map((z) => geo.zips.get(z)),
    ...members.cityIds.map((c) => geo.cities.get(c)),
  ].filter((p) => p != null);
  if (points.length === 0) return null;
  // A loop, not Math.min(...points): segments can hold tens of thousands of ZIPs.
  const bounds: Bounds = [
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ];
  for (const { lon, lat } of points) {
    bounds[0] = [Math.min(bounds[0][0], lon), Math.min(bounds[0][1], lat)];
    bounds[1] = [Math.max(bounds[1][0], lon), Math.max(bounds[1][1], lat)];
  }
  return bounds;
}

const countLabel = (zips: number, cities: number) =>
  zips + cities === 0 ? 'Empty' : [zips && pluralize(zips, 'ZIP'), cities && pluralize(cities, 'city', 'cities')].filter(Boolean).join(' · ');

type DialogState =
  | { type: 'new' }
  | { type: 'edit'; segment: Segment }
  | { type: 'add-areas'; segment: Segment }
  | { type: 'delete'; segment: Segment }
  | { type: 'delete-all' }
  | { type: 'replace'; imported: ReturnType<typeof segmentsFromCsv> };

export default function SegmentsPanel() {
  const geo = useGeoData((s) => s.data);
  const { main: map } = useMap();
  const segments = useSegments((s) => s.segments);
  const zipSegment = useSegments((s) => s.zipSegment);
  const citySegment = useSegments((s) => s.citySegment);
  const activeId = useSegments((s) => s.activeId);
  const { addSegment, updateSegment, removeSegment, setActive, clearSegment, replaceAll } = useSegments.getState();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; segment: Segment } | null>(null);
  const [fileMenu, setFileMenu] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<{ text: string; severity: 'success' | 'warning' | 'error' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const radiusOpen = useUi((s) => s.radius !== null);
  const openRadius = useUi((s) => s.openRadius);

  const counts = useMemo(() => {
    const c = new Map<string, { zips: number; cities: number }>();
    for (const s of segments) c.set(s.id, { zips: 0, cities: 0 });
    for (const id of Object.values(zipSegment)) {
      const entry = c.get(id);
      if (entry) entry.zips++;
    }
    for (const id of Object.values(citySegment)) {
      const entry = c.get(id);
      if (entry) entry.cities++;
    }
    return c;
  }, [segments, zipSegment, citySegment]);

  const active = segments.find((s) => s.id === activeId) ?? null;

  const zoomTo = (segment: Segment) => {
    if (!geo || !map) return;
    const bounds = memberBounds(segmentMembers({ zipSegment, citySegment }, segment.id), geo);
    if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 11 });
    else setNotice({ text: `${segment.name} is empty.`, severity: 'warning' });
  };


  const importCsv = async (file: File) => {
    if (!geo) return;
    try {
      const imported = segmentsFromCsv(await readCsvFile(file), geo);
      if (imported.segments.length === 0) throw new Error('No segments found in the file.');
      if (segments.length > 0) setDialog({ type: 'replace', imported });
      else applyImport(imported);
    } catch (err) {
      setNotice({ text: `Couldn't import: ${err instanceof Error ? err.message : String(err)}`, severity: 'error' });
    }
  };

  const applyImport = (imported: ReturnType<typeof segmentsFromCsv>) => {
    replaceAll(imported);
    const skipped = imported.unmatched.length;
    setNotice({
      text:
        `Imported ${pluralize(imported.segments.length, 'segment')}.` +
        (skipped ? ` ${pluralize(skipped, 'row')} didn't match a ZIP code or city.` : ''),
      severity: skipped ? 'warning' : 'success',
    });
  };

  if (radiusOpen) return <RadiusPanel onDone={(text) => setNotice({ text, severity: 'success' })} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, py: 1.5 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ type: 'new' })} sx={{ whiteSpace: 'nowrap' }}>
          New segment
        </Button>
        <Button
          variant="outlined"
          startIcon={<TrackChangesIcon />}
          disabled={!geo}
          onClick={() => openRadius()}
          sx={{ whiteSpace: 'nowrap' }}
        >
          By radius
        </Button>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Import or export">
          <IconButton aria-label="Import or export segments" onClick={(e) => setFileMenu(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importCsv(file);
          e.target.value = '';
        }}
      />

      <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {segments.length === 0 ? (
          <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
            <Typography variant="subtitle1" gutterBottom>
              No segments yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A segment is a named group of ZIP codes and cities, like a sales territory. Create one, then click areas on
              the map or paste a list to fill it.
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {segments.map((segment) => {
              const c = counts.get(segment.id) ?? { zips: 0, cities: 0 };
              return (
                <ListItem
                  key={segment.id}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row">
                      <Tooltip title={segment.visible ? 'Hide on map' : 'Show on map'}>
                        <IconButton
                          size="small"
                          aria-label={segment.visible ? `Hide ${segment.name}` : `Show ${segment.name}`}
                          onClick={() => updateSegment(segment.id, { visible: !segment.visible })}
                        >
                          {segment.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        edge="end"
                        aria-label={`More actions for ${segment.name}`}
                        onClick={(e) => setRowMenu({ anchor: e.currentTarget, segment })}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <ListItemButton selected={segment.id === activeId} onClick={() => setActive(segment.id)} sx={{ pr: 11 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ColorSwatch color={segment.color} size={16} />
                    </ListItemIcon>
                    <ListItemText
                      primary={segment.name}
                      secondary={countLabel(c.zips, c.cities)}
                      slotProps={{ primary: { noWrap: true, sx: { opacity: segment.visible ? 1 : 0.6 } } }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}

        {active && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Alert severity="info" icon={false} sx={{ mb: 1.5 }}>
                Click ZIP codes or cities on the map to add them to <strong>{active.name}</strong>. Click again to remove.
              </Alert>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PlaylistAddIcon />}
                  onClick={() => setDialog({ type: 'add-areas', segment: active })}
                >
                  Add from list
                </Button>
                <Button size="small" variant="outlined" startIcon={<ZoomInMapIcon />} onClick={() => zoomTo(active)}>
                  Zoom to
                </Button>
              </Stack>
              <SegmentMembers segment={active} />
            </Box>
          </>
        )}
      </Box>

      <Menu anchorEl={rowMenu?.anchor} open={rowMenu !== null} onClose={() => setRowMenu(null)}>
        {rowMenu && [
          <MenuItem key="edit" onClick={() => { setDialog({ type: 'edit', segment: rowMenu.segment }); setRowMenu(null); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            Rename or recolor
          </MenuItem>,
          <MenuItem key="add" onClick={() => { setDialog({ type: 'add-areas', segment: rowMenu.segment }); setRowMenu(null); }}>
            <ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon>
            Add from list
          </MenuItem>,
          <MenuItem key="radius" onClick={() => { openRadius(rowMenu.segment.id); setRowMenu(null); }}>
            <ListItemIcon><TrackChangesIcon fontSize="small" /></ListItemIcon>
            Add by radius
          </MenuItem>,
          <MenuItem key="zoom" onClick={() => { zoomTo(rowMenu.segment); setRowMenu(null); }}>
            <ListItemIcon><ZoomInMapIcon fontSize="small" /></ListItemIcon>
            Zoom to
          </MenuItem>,
          <MenuItem key="clear" onClick={() => { clearSegment(rowMenu.segment.id); setRowMenu(null); }}>
            <ListItemIcon><LayersClearIcon fontSize="small" /></ListItemIcon>
            Remove all areas
          </MenuItem>,
          <Divider key="divider" />,
          <MenuItem key="delete" onClick={() => { setDialog({ type: 'delete', segment: rowMenu.segment }); setRowMenu(null); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
            Delete segment
          </MenuItem>,
        ]}
      </Menu>

      <Menu anchorEl={fileMenu} open={fileMenu !== null} onClose={() => setFileMenu(null)}>
        <MenuItem disabled={!geo} onClick={() => { fileInput.current?.click(); setFileMenu(null); }}>
          <ListItemIcon><FileUploadIcon fontSize="small" /></ListItemIcon>
          Import segments (CSV)
        </MenuItem>
        <MenuItem disabled={segments.length === 0} onClick={() => { useUi.getState().setExportTab('csv'); setFileMenu(null); }}>
          <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
          Export…
        </MenuItem>
        <Divider />
        <MenuItem disabled={segments.length === 0} onClick={() => { setDialog({ type: 'delete-all' }); setFileMenu(null); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          Delete all segments
        </MenuItem>
      </Menu>

      {dialog?.type === 'new' && (
        <SegmentDialog
          title="New segment"
          submitLabel="Create"
          initial={{ name: `Segment ${segments.length + 1}`, color: nextColor(segments) }}
          onSubmit={(fields) => addSegment(fields)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'edit' && (
        <SegmentDialog
          title="Edit segment"
          submitLabel="Save"
          initial={dialog.segment}
          onSubmit={(fields) => updateSegment(dialog.segment.id, fields)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'add-areas' && <AddAreasDialog segment={dialog.segment} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title="Delete segment?"
        confirmLabel="Delete"
        destructive
        onConfirm={() => dialog?.type === 'delete' && removeSegment(dialog.segment.id)}
        onClose={() => setDialog(null)}
      >
        {dialog?.type === 'delete' && (
          <>
            <strong>{dialog.segment.name}</strong> and its area list will be deleted. The ZIP codes and cities stay on
            the map.
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'delete-all'}
        title="Delete all segments?"
        confirmLabel="Delete all"
        destructive
        onConfirm={() => replaceAll({ segments: [], zipSegment: {}, citySegment: {} })}
        onClose={() => setDialog(null)}
      >
        All {pluralize(segments.length, 'segment')} will be deleted. Export them first if you may need them again.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog?.type === 'replace'}
        title="Replace your segments?"
        confirmLabel="Replace"
        onConfirm={() => dialog?.type === 'replace' && applyImport(dialog.imported)}
        onClose={() => setDialog(null)}
      >
        {dialog?.type === 'replace' && (
          <>
            The file has {pluralize(dialog.imported.segments.length, 'segment')}. Importing replaces your current{' '}
            {pluralize(segments.length, 'segment')}.
          </>
        )}
      </ConfirmDialog>

      <Snackbar open={notice !== null} autoHideDuration={6000} onClose={() => setNotice(null)}>
        <Alert severity={notice?.severity ?? 'info'} variant="filled" onClose={() => setNotice(null)}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}
