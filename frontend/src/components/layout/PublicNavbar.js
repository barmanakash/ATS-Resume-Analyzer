import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar, Box, Button, Container, Drawer, IconButton, List, ListItemButton, ListItemText, Toolbar, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import Logo from '../common/Logo';
import { ROUTES } from '../../config';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Sample report', href: '#sample-report' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const NAV_LINK_SX = {
  position: 'relative',
  color: 'text.secondary',
  transition: 'color 0.2s ease',
  '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 4,
    height: 2,
    borderRadius: 1,
    bgcolor: 'primary.main',
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.25s ease',
  },
  '&:hover::after, &:focus-visible::after': { transform: 'scaleX(1)' },
  '@media (prefers-reduced-motion: reduce)': { '&::after': { transition: 'none' } },
};

export default function PublicNavbar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated } = useAuth();

  // A soft shadow appears once the page has moved under the bar.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const actions = isAuthenticated ? (
    <Button component={RouterLink} to={ROUTES.dashboard} variant="contained">Go to dashboard</Button>
  ) : (
    <>
      <Button component={RouterLink} to={ROUTES.login} color="inherit">Log in</Button>
      <Button component={RouterLink} to={ROUTES.register} variant="contained">Get started free</Button>
    </>
  );

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: scrolled ? 'rgba(255, 255, 255, 0.88)' : 'background.paper',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        boxShadow: scrolled ? '0 4px 18px rgba(17, 24, 39, 0.08)' : 'none',
        transition: 'box-shadow 0.25s ease, background-color 0.25s ease',
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2 }}>
          <Logo />
          <Box sx={{ flexGrow: 1 }} />
          {isMobile ? (
            <IconButton aria-label="Open menu" onClick={() => setOpen(true)}><MenuIcon /></IconButton>
          ) : (
            <>
              {NAV_ITEMS.map((item) => (
                <Button key={item.href} href={item.href} color="inherit" sx={NAV_LINK_SX}>{item.label}</Button>
              ))}
              <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>{actions}</Box>
            </>
          )}
        </Toolbar>
      </Container>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260, p: 2 }}>
          <List>
            {NAV_ITEMS.map((item) => (
              <ListItemButton key={item.href} component="a" href={item.href} onClick={() => setOpen(false)}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>{actions}</Box>
        </Box>
      </Drawer>
    </AppBar>
  );
}
