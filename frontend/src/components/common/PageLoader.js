import React from 'react';
import { Box, CircularProgress } from '@mui/material';

export default function PageLoader({ minHeight = '60vh' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight }} role="status" aria-label="Loading">
      <CircularProgress />
    </Box>
  );
}
