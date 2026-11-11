import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Container, Typography } from '@mui/material';
import { ROUTES } from '../config';

export default function NotFoundPage() {
  return (
    <Container maxWidth="sm" sx={{ textAlign: 'center', py: 14 }}>
      <Typography variant="h1" color="primary" sx={{ fontSize: '5rem' }}>404</Typography>
      <Typography variant="h5" gutterBottom>Page not found</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>The page you are looking for does not exist or has moved.</Typography>
      <Box><Button component={RouterLink} to={ROUTES.home} variant="contained">Back to home</Button></Box>
    </Container>
  );
}
