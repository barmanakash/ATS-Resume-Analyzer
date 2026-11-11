import React, { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField, Typography } from '@mui/material';
import AuthShell from './AuthShell';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../services/apiClient';
import { ROUTES } from '../../config';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const redirectTo = location.state?.from?.pathname || ROUTES.dashboard;

  const onSubmit = async (values) => {
    setServerError('');
    try {
      await login(values);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err, 'Login failed. Check your email and password.'));
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue analyzing your resume."
      footer={
        <Typography variant="body2" color="text.secondary">
          New here? <Link component={RouterLink} to={ROUTES.register}>Create an account</Link>
        </Typography>
      }
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <TextField
            label="Email" type="email" autoComplete="email" autoFocus
            {...register('email')} error={Boolean(errors.email)} helperText={errors.email?.message}
          />
          <TextField
            label="Password" type="password" autoComplete="current-password"
            {...register('password')} error={Boolean(errors.password)} helperText={errors.password?.message}
          />
          <Box sx={{ textAlign: 'right', mt: -1 }}>
            <Link component={RouterLink} to={ROUTES.forgotPassword} variant="body2">Forgot password?</Link>
          </Box>
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Log in'}
          </Button>
        </Stack>
      </Box>
    </AuthShell>
  );
}
