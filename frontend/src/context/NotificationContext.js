import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [state, setState] = useState({ open: false, message: '', severity: 'info' });

  const notify = useCallback((message, severity = 'info') => {
    setState({ open: true, message, severity });
  }, []);

  const api = useMemo(
    () => ({
      notify,
      success: (m) => notify(m, 'success'),
      error: (m) => notify(m, 'error'),
      info: (m) => notify(m, 'info'),
    }),
    [notify]
  );

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setState((s) => ({ ...s, open: false }));
  };

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={5000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleClose} severity={state.severity} variant="filled" sx={{ width: '100%' }}>
          {state.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside NotificationProvider');
  return ctx;
};
