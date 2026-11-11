import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1e4fd8', dark: '#173ba3', light: '#4d78e6', contrastText: '#ffffff' },
    secondary: { main: '#0f766e' },
    success: { main: '#15803d' },
    warning: { main: '#b45309' },
    error: { main: '#b91c1c' },
    info: { main: '#0369a1' },
    background: { default: '#f6f8fc', paper: '#ffffff' },
    text: { primary: '#111827', secondary: '#4b5563' },
    divider: '#e5e7eb',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, fontSize: '3rem', lineHeight: 1.15 },
    h2: { fontWeight: 700, fontSize: '2.25rem', lineHeight: 1.2 },
    h3: { fontWeight: 700, fontSize: '1.75rem' },
    h4: { fontWeight: 700, fontSize: '1.5rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600, fontSize: '1.05rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: '#e5e7eb' } },
    },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'medium' } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#e5e7eb' } } },
  },
});

export default theme;
