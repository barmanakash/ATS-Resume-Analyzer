import React from 'react';
import { Box, Card, CardContent, Container, Typography } from '@mui/material';
import Logo from '../../components/common/Logo';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', py: 6 }}>
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 3 }}><Logo /></Box>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="h4" component="h1" gutterBottom>{title}</Typography>
            {subtitle && <Typography color="text.secondary" sx={{ mb: 3 }}>{subtitle}</Typography>}
            {children}
          </CardContent>
        </Card>
        {footer && <Box sx={{ textAlign: 'center', mt: 3 }}>{footer}</Box>}
      </Container>
    </Box>
  );
}
