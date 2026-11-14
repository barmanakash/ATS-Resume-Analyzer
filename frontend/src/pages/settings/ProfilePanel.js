import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { getErrorMessage } from '../../services/apiClient';
import userService from '../../services/userService';
import { formatDate } from '../../utils/analysis';
import { profileSchema } from './settingsSchemas';

export default function ProfilePanel() {
  const { user, setUser } = useAuth();
  const { success } = useNotification();
  const [serverError, setServerError] = useState('');
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName || '' },
  });

  const onSubmit = async ({ fullName }) => {
    setServerError('');
    try {
      const updated = await userService.updateProfile(fullName);
      setUser(updated);
      reset({ fullName: updated.fullName });
      success('Profile updated.');
    } catch (err) {
      setServerError(getErrorMessage(err, 'Could not update your profile. Please try again.'));
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 520 }}>
      <Typography variant="h6" component="h2" gutterBottom>Profile</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>How your name appears in your account.</Typography>
      <Stack spacing={2.5}>
        {serverError && <Alert severity="error">{serverError}</Alert>}
        <TextField
          label="Full name"
          autoComplete="name"
          {...register('fullName')}
          error={Boolean(errors.fullName)}
          helperText={errors.fullName?.message}
        />
        <Box>
          <TextField
            label="Email"
            value={user?.email || ''}
            disabled
            fullWidth
            helperText="Your email is your login and cannot be changed here."
          />
          <Chip
            size="small"
            sx={{ mt: 1 }}
            color={user?.isEmailVerified ? 'success' : 'warning'}
            label={user?.isEmailVerified ? 'Email verified' : 'Email not verified'}
          />
        </Box>
        {user?.createdAt && (
          <Typography variant="body2" color="text.secondary">Member since {formatDate(user.createdAt)}</Typography>
        )}
        <Box>
          <Button type="submit" variant="contained" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Save changes'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
