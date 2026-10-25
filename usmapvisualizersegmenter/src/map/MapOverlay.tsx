import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import DataLegend from '../components/DataLegend';
import { useDataLayer, useResolvedData } from '../store/dataLayer';
import { useUi } from '../store/ui';
import MapSearch from './MapSearch';

/** Search box, layer switches and legend floating over the map. */
export default function MapOverlay() {
  const mode = useUi((s) => s.mode);
  const showZips = useUi((s) => s.showZips);
  const showCities = useUi((s) => s.showCities);
  const setShowZips = useUi((s) => s.setShowZips);
  const setShowCities = useUi((s) => s.setShowCities);
  const valueColumn = useDataLayer((s) => s.config.valueColumn);
  const resolved = useResolvedData();
  const classes = mode === 'data' ? resolved?.classification?.classes : undefined;

  return (
    <>
      <Paper elevation={3} sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
        <MapSearch />
      </Paper>

      {/* Sits higher on phones, where the map attribution wraps onto two lines. */}
      <Paper
        elevation={3}
        sx={{ position: 'absolute', bottom: { xs: 88, sm: 32 }, left: 12, zIndex: 1, px: 1.5, py: 1, maxWidth: 240 }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <FormControlLabel
            control={<Switch size="small" checked={showZips} onChange={(e) => setShowZips(e.target.checked)} />}
            label="ZIP codes"
            slotProps={{ typography: { variant: 'body2' } }}
          />
          <FormControlLabel
            control={<Switch size="small" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} />}
            label="Cities"
            slotProps={{ typography: { variant: 'body2' } }}
          />
        </Box>
        {classes && (
          <>
            <Divider sx={{ my: 1 }} />
            <DataLegend title={valueColumn} classes={classes} />
          </>
        )}
      </Paper>
    </>
  );
}
