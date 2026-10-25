import { useEffect, useState } from 'react';
import { MapProvider } from 'react-map-gl/maplibre';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import { useGeoData } from './data/geoData';
import ExportDialog from './export/ExportDialog';
import MapView from './map/MapView';

// Brand color. On white, #14B8A6 text is too faint (2.5:1), so light mode uses
// the darker teal for text and controls. The darker teal is also the header
// background, where white text has 5.5:1 contrast (passes WCAG AA).
const TEAL = '#14B8A6';
const TEAL_DARK = '#0F766E';

const theme = createTheme({
  colorSchemes: {
    light: { palette: { primary: { main: TEAL_DARK, dark: TEAL_DARK } } },
    dark: { palette: { primary: { main: TEAL, dark: TEAL_DARK } } },
  },
});

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    void useGeoData.getState().load();
  }, []);

  return (
    <ThemeProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <MapProvider>
        <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
          <TopNav onMenuClick={() => setMobileOpen((open) => !open)} />
          <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
          <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Toolbar />
            <MapView />
          </Box>
        </Box>
        <ExportDialog />
      </MapProvider>
    </ThemeProvider>
  );
}
