import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import AuthShell from './AuthShell';
import authService from '../../services/authService';
import { getErrorMessage } from '../../services/apiClient';
import { ROUTES } from '../../config';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing its token.');
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true; // avoid double-calling in React StrictMode
    authService
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err, 'This verification link is invalid or has expired.'));
      });
  }, [token]);

  return (
    <AuthShell title="Email verification">
      <Stack spacing={2} alignItems="stretch">
        {status === 'loading' && <Stack alignItems="center"><CircularProgress /></Stack>}
        {status === 'success' && <Alert severity="success">Your email is verified. You can log in now.</Alert>}
        {status === 'error' && <Alert severity="error">{message}</Alert>}
        {status !== 'loading' && (
          <Button component={RouterLink} to={ROUTES.login} variant="contained">Go to log in</Button>
        )}
      </Stack>
    </AuthShell>
  );
}
