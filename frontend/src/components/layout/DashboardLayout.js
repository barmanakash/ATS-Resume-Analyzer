import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import HistoryIcon from '@mui/icons-material/History';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Logo from '../common/Logo';
import { ROUTES } from '../../config';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const DRAWER_WIDTH = 248;

const NAV = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: <DashboardOutlinedIcon /> },
  { label: 'New analysis', to: ROUTES.newAnalysis, icon: <AnalyticsOutlinedIcon /> },
  { label: 'My resumes', to: ROUTES.resumes, icon: <DescriptionOutlinedIcon /> },
  { label: 'Job descriptions', to: ROUTES.jobs, icon: <WorkOutlineIcon /> },
  { label: 'History', to: ROUTES.history, icon: <HistoryIcon /> },
  { label: 'Settings', to: ROUTES.settings, icon: <SettingsOutlinedIcon /> },
];

export default function DashboardLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const { info } = useNotification();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setAnchorEl(null);
    await logout();
    info('You have been logged out.');
    navigate(ROUTES.home);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar><Logo to={ROUTES.dashboard} /></Toolbar>
      <Divider />
      <List sx={{ px: 1.5, py: 2 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } },
              '&.active:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  const initial = (user?.fullName || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', ml: { md: `${DRAWER_WIDTH}px` }, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` } }}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton edge="start" aria-label="Open navigation" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Account menu">
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>{initial}</Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2">{user?.fullName}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate(ROUTES.settings); }}>Settings</MenuItem>
            <MenuItem onClick={handleLogout}>Log out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }} aria-label="Main navigation">
        {isDesktop ? (
          <Drawer variant="permanent" open sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
