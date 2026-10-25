import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import BarChartIcon from '@mui/icons-material/BarChart';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import DataPanel from './data-panel/DataPanel';
import SegmentsPanel from './segments/SegmentsPanel';
import type { MapMode } from './store/ui';
import { useUi } from './store/ui';

export const SIDEBAR_WIDTH = 360;

interface Props {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/** Segments and Data tabs. Always visible on desktop; slides in on small screens. */
export default function Sidebar({ mobileOpen, onMobileClose }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const mode = useUi((s) => s.mode);
  const setMode = useUi((s) => s.setMode);

  return (
    <Drawer
      variant={isDesktop ? 'permanent' : 'temporary'}
      open={isDesktop || mobileOpen}
      onClose={onMobileClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: { md: SIDEBAR_WIDTH },
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: { xs: 'min(100vw, 360px)', md: SIDEBAR_WIDTH }, boxSizing: 'border-box' },
      }}
    >
      <Toolbar />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Tabs
          value={mode}
          onChange={(_, v: MapMode) => setMode(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="segments" label="Segments" icon={<WorkspacesIcon />} iconPosition="start" />
          <Tab value="data" label="Data" icon={<BarChartIcon />} iconPosition="start" />
        </Tabs>
        {mode === 'segments' ? <SegmentsPanel /> : <DataPanel />}
      </Box>
    </Drawer>
  );
}
