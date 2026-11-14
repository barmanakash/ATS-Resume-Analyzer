import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
} from '@mui/material';
import { getErrorMessage } from '../../services/apiClient';

/**
 * Asks for the account password (and optionally a typed word) before a destructive action.
 * `onConfirm(password)` should resolve on success; the parent then closes the dialog.
 * If it rejects, the error is shown here and the dialog stays open.
 */
export default function PasswordConfirmDialog({ title, children, confirmLabel, requireText, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const textOk = !requireText || typed.trim() === requireText;
  const canSubmit = password.length > 0 && textOk && !busy;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(password);
    } catch (err) {
      if (mounted.current) {
        setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
        setBusy(false);
      }
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="confirm-dialog-title">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {children}
            {requireText && (
              <TextField
                label={`Type ${requireText} to confirm`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={busy}
              />
            )}
            <TextField
              label="Your password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
              autoFocus={!requireText}
            />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" color="error" variant="contained" disabled={!canSubmit}>
            {busy ? <CircularProgress size={20} color="inherit" /> : confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
