import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Stack, TextField, Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import userService from '../../services/userService';
import { getErrorMessage } from '../../services/apiClient';
import { ROUTES } from '../../config';
import { formatDate } from '../../utils/analysis';
import { profileSchema } from './settingsSchemas';

export default function ProfileSection() {
  const { user, setUser, logout } = useAuth();
  const { success, info } = useNotification();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user?.fullName || '' } });

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

  const handleLogout = async () => {
    await logout();
    info('You have been logged out.');
    navigate(ROUTES.home);
  };

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>Profile</Typography>
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
              {serverError && <Alert severity="error">{serverError}</Alert>}
              <TextField
                label="Full name"
                autoComplete="name"
                inputProps={{ maxLength: 100 }}
                error={Boolean(errors.fullName)}
                helperText={errors.fullName?.message}
                {...register('fullName')}
              />
              <Box>
                <Button type="submit" variant="contained" disabled={!isDirty || isSubmitting}>
                  {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Save changes'}
                </Button>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>Account</Typography>
          <Stack spacing={2} divider={<Divider flexItem />}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="body2" color="text.secondary">Email address</Typography>
                <Typography sx={{ overflowWrap: 'anywhere' }}>{user?.email}</Typography>
                <Typography variant="caption" color="text.secondary">Changing your email address is not available yet.</Typography>
              </Box>
              <Box>
                <Chip
                  size="small"
                  color={user?.isEmailVerified ? 'success' : 'warning'}
                  label={user?.isEmailVerified ? 'Email verified' : 'Email not verified'}
                />
              </Box>
            </Stack>
            {user?.createdAt && (
              <Box>
                <Typography variant="body2" color="text.secondary">Member since</Typography>
                <Typography>{formatDate(user.createdAt)}</Typography>
              </Box>
            )}
            <Box>
              <Button variant="outlined" startIcon={<LogoutIcon />} onClick={handleLogout}>Log out</Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
