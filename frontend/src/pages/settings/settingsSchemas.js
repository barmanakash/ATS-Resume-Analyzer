import { z } from 'zod';

// Same rules as registration and the server (8-128 characters with upper case, lower case and a digit).
// Defined here instead of imported from the register page so this file stays light and easy to test.
export const newPasswordRule = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[0-9]/, 'Include a number');

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: newPasswordRule,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Choose a password that is different from your current one',
  });

/** Deleting an account needs the word typed out so it cannot happen by accident. */
export const DELETE_CONFIRM_WORD = 'DELETE';

export const isDeleteConfirmed = (text) => String(text || '').trim() === DELETE_CONFIRM_WORD;

export const SETTINGS_TABS = ['profile', 'password', 'privacy', 'danger'];

/** Reads ?tab= from the URL. Anything unknown means the first tab. */
export const tabFromParam = (value) => (SETTINGS_TABS.includes(value) ? value : SETTINGS_TABS[0]);
