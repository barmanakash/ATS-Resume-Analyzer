import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField } from '@mui/material';
import AuthShell from './AuthShell';
import authService from '../../services/authService';
import { getErrorMessage } from '../../services/apiClient';
import { ROUTES } from '../../config';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState('');
  const [sent, setSent] = useState(false);
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    setServerError('');
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we will send a reset link if an account exists."
      footer={<Link component={RouterLink} to={ROUTES.login}>Back to log in</Link>}
    >
      {sent ? (
        <Alert severity="success">
          If an account exists for that email, a password reset link is on its way. The link expires soon, so use it promptly.
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <TextField label="Email" type="email" autoComplete="email" autoFocus {...register('email')} error={Boolean(errors.email)} helperText={errors.email?.message} />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Send reset link'}
            </Button>
          </Stack>
        </Box>
      )}
    </AuthShell>
  );
}
