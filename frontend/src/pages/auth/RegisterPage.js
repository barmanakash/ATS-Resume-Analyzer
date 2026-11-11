import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField, Typography } from '@mui/material';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import AuthShell from './AuthShell';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../services/apiClient';
import { ROUTES } from '../../config';

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[0-9]/, 'Include a number');

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async ({ fullName, email, password }) => {
    setServerError('');
    try {
      await registerUser({ fullName, email, password });
      setRegisteredEmail(email);
    } catch (err) {
      setServerError(getErrorMessage(err, 'Could not create your account. Please try again.'));
    }
  };

  if (registeredEmail) {
    return (
      <AuthShell title="Check your email" footer={<Link component={RouterLink} to={ROUTES.login}>Back to log in</Link>}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <MarkEmailReadOutlinedIcon color="primary" sx={{ fontSize: 56 }} />
          <Typography>
            We sent a verification link to <strong>{registeredEmail}</strong>. Open it to activate your account, then log in.
          </Typography>
        </Stack>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start analyzing your resume for free."
      footer={
        <Typography variant="body2" color="text.secondary">
          Already have an account? <Link component={RouterLink} to={ROUTES.login}>Log in</Link>
        </Typography>
      }
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {serverError && <Alert severity="error">{serverError}</Alert>}
          <TextField label="Full name" autoComplete="name" autoFocus {...register('fullName')} error={Boolean(errors.fullName)} helperText={errors.fullName?.message} />
          <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={Boolean(errors.email)} helperText={errors.email?.message} />
          <TextField label="Password" type="password" autoComplete="new-password" {...register('password')} error={Boolean(errors.password)} helperText={errors.password?.message || 'At least 8 characters with upper, lower case and a number'} />
          <TextField label="Confirm password" type="password" autoComplete="new-password" {...register('confirmPassword')} error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} />
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Create account'}
          </Button>
        </Stack>
      </Box>
    </AuthShell>
  );
}
