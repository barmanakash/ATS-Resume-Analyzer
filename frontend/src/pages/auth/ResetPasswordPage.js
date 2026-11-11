import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField } from '@mui/material';
import AuthShell from './AuthShell';
import { passwordSchema } from './RegisterPage';
import authService from '../../services/authService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { success } = useNotification();
  const [serverError, setServerError] = useState('');
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = async ({ password }) => {
    setServerError('');
    try {
      await authService.resetPassword({ token, newPassword: password });
      success('Password updated. You can now log in.');
      navigate(ROUTES.login, { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, 'This reset link is invalid or has expired.'));
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      footer={<Link component={RouterLink} to={ROUTES.login}>Back to log in</Link>}
    >
      {!token ? (
        <Alert severity="error">
          This reset link is missing its token. Request a new one from the{' '}
          <Link component={RouterLink} to={ROUTES.forgotPassword}>forgot password page</Link>.
        </Alert>
      ) : (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <TextField label="New password" type="password" autoComplete="new-password" autoFocus {...register('password')} error={Boolean(errors.password)} helperText={errors.password?.message} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Update password'}
            </Button>
          </Stack>
        </Box>
      )}
    </AuthShell>
  );
}
