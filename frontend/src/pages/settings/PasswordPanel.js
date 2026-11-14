import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useNotification } from '../../context/NotificationContext';
import { getErrorMessage, setAccessToken } from '../../services/apiClient';
import userService from '../../services/userService';
import { changePasswordSchema } from './settingsSchemas';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function PasswordPanel() {
  const { success } = useNotification();
  const [serverError, setServerError] = useState('');
  const {
    register, handleSubmit, reset, setError, formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setServerError('');
    try {
      const data = await userService.changePassword(currentPassword, newPassword);
      // The server signed out every other device and issued a fresh token for this one. Install it, or this
      // session would be logged out on its next request.
      if (data?.accessToken) setAccessToken(data.accessToken);
      reset(EMPTY);
      success('Password updated. Other devices have been signed out.');
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      const message = getErrorMessage(err, 'Could not change your password. Please try again.');
      if (code === 'INVALID_CURRENT_PASSWORD') setError('currentPassword', { message });
      else setServerError(message);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 520 }}>
      <Typography variant="h6" component="h2" gutterBottom>Password</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Changing your password signs you out of every other device.
      </Typography>
      <Stack spacing={2.5}>
        {serverError && <Alert severity="error">{serverError}</Alert>}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          {...register('currentPassword')}
          error={Boolean(errors.currentPassword)}
          helperText={errors.currentPassword?.message}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
          error={Boolean(errors.newPassword)}
          helperText={errors.newPassword?.message || 'At least 8 characters with upper, lower case and a number'}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword?.message}
        />
        <Box>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Update password'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
