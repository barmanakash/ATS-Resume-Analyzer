import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import { ROUTES } from '../config';

/** Placeholder for pages built in later phases. Intentionally shows no fake data. */
export default function ComingSoonPage({ title, phase }) {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>{title}</Typography>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <ConstructionOutlinedIcon color="primary" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h6">This section is not built yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            It is planned for {phase}.
          </Typography>
          <Button component={RouterLink} to={ROUTES.dashboard} variant="outlined">Back to dashboard</Button>
        </CardContent>
      </Card>
    </Box>
  );
}
