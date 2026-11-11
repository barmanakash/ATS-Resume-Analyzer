import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Divider, Link, Stack, Typography } from '@mui/material';
import Logo from '../common/Logo';
import { APP_NAME, ROUTES, TAGLINE } from '../../config';

export default function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', mt: 8, py: 5 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={4}>
          <Box sx={{ maxWidth: 360 }}>
            <Logo />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {TAGLINE} Understand how your resume lines up with a job description and improve it using only what is already true about you.
            </Typography>
          </Box>
          <Stack direction="row" spacing={6}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Product</Typography>
              <Link href="#features" color="text.secondary" underline="hover">Features</Link>
              <Link href="#pricing" color="text.secondary" underline="hover">Pricing</Link>
              <Link href="#faq" color="text.secondary" underline="hover">FAQ</Link>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Account</Typography>
              <Link component={RouterLink} to={ROUTES.login} color="text.secondary" underline="hover">Log in</Link>
              <Link component={RouterLink} to={ROUTES.register} color="text.secondary" underline="hover">Sign up</Link>
            </Stack>
          </Stack>
        </Stack>
        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary" component="p">
          © {new Date().getFullYear()} {APP_NAME}. Scores are an estimate based on our own transparent method. They do not reproduce any employer&apos;s ATS and do not guarantee interviews or job offers.
        </Typography>
      </Container>
    </Box>
  );
}
