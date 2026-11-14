import React, { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField,
} from '@mui/material';
import { getErrorMessage } from '../../services/apiClient';
import { DELETE_CONFIRM_WORD, isDeleteConfirmed } from './settingsSchemas';

/**
 * Confirmation for destructive actions. The user must re-enter their password (so a stolen session cannot wipe
 * the account) and, for the most destructive actions, type a word so it cannot happen by accident.
 * The parent closes the dialog from inside `onConfirm` when the action succeeds.
 */
export default function ConfirmWithPasswordDialog({
  id, title, children, confirmLabel, requireTypedWord = false, onConfirm, onClose,
}) {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = !busy && password.length > 0 && (!requireTypedWord || isDeleteConfirmed(typed));

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby={`${id}-title`}
      PaperProps={{ component: 'form', onSubmit: submit, noValidate: true }}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" sx={{ mb: 2 }}>{children}</DialogContentText>
        <Stack spacing={2}>
          {requireTypedWord && (
            <TextField
              label={`Type ${DELETE_CONFIRM_WORD} to confirm`}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              autoComplete="off"
              fullWidth
            />
          )}
          <TextField
            label="Your password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            autoFocus
            fullWidth
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" color="error" variant="contained" disabled={!canSubmit}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
