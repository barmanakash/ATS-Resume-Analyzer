import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { APP_NAME, ROUTES } from '../../config';

export default function Logo({ to = ROUTES.home, color = 'text.primary' }) {
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, textDecoration: 'none', color }}
      aria-label={`${APP_NAME} home`}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DescriptionOutlinedIcon fontSize="small" />
      </Box>
      <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
        {APP_NAME}
      </Typography>
    </Box>
  );
}
