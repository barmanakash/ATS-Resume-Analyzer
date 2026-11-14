import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useNotification } from '../../context/NotificationContext';
import userService from '../../services/userService';
import { getErrorMessage, setAccessToken } from '../../services/apiClient';
import { changePasswordSchema } from './settingsSchemas';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function PasswordSection() {
  const { success } = useNotification();
  const [serverError, setServerError] = useState('');

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: EMPTY });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setServerError('');
    try {
      const data = await userService.changePassword(currentPassword, newPassword);
      // The server signed every other device out and issued a new token for this one. Keep using it.
      if (data?.accessToken) setAccessToken(data.accessToken);
      reset(EMPTY);
      success('Password updated. Other devices have been signed out.');
    } catch (err) {
      setServerError(getErrorMessage(err, 'Could not change your password. Please try again.'));
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>Change password</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          After you change it, every other device you are logged in on will be signed out. This device stays signed in.
        </Typography>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
            {serverError && <Alert severity="error">{serverError}</Alert>}
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              error={Boolean(errors.currentPassword)}
              helperText={errors.currentPassword?.message}
              {...register('currentPassword')}
            />
            <TextField
              label="New password"
              type="password"
              autoComplete="new-password"
              error={Boolean(errors.newPassword)}
              helperText={errors.newPassword?.message || 'At least 8 characters with upper and lower case letters and a number'}
              {...register('newPassword')}
            />
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Box>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Update password'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
