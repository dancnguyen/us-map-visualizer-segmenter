import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { purple } from '@mui/material/colors';
import TopNav from './TopNav';

const theme = createTheme({
  colorSchemes: {
    light: { palette: { primary: { main: purple[900] } } },
    dark: { palette: { primary: { main: purple[200] } } },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          variants: [
            {
              props: { variant: 'contained', color: 'primary' },
              style: theme.applyStyles('dark', {
                backgroundColor: purple[900],
                color: theme.palette.common.white,
                '&:hover': { backgroundColor: purple[800] },
              }),
            },
          ],
        }),
      },
    },
  },
});

export default function App() {
  return(
    <ThemeProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <TopNav />
      </Box>
    </ThemeProvider>
  );
}
