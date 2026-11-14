import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import userService from '../../services/userService';
import { ROUTES } from '../../config';
import ConfirmWithPasswordDialog from './ConfirmWithPasswordDialog';

export default function DangerPanel() {
  const { logout } = useAuth();
  const { info } = useNotification();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const deleteAccount = async (password) => {
    await userService.deleteAccount(password);
    await logout(); // clears the local session; the server session is already gone
    info('Your account has been deleted.');
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" component="h2" gutterBottom color="error">Delete account</Typography>
      <Alert severity="warning" sx={{ mb: 3 }}>
        Deleting your account permanently removes your profile, every resume (including uploaded files), job description
        and analysis report. This cannot be undone.
      </Alert>
      <Button color="error" variant="contained" startIcon={<PersonRemoveOutlinedIcon />} onClick={() => setConfirming(true)}>
        Delete my account
      </Button>

      {confirming && (
        <ConfirmWithPasswordDialog
          id="delete-account"
          title="Delete your account?"
          confirmLabel="Delete my account"
          requireTypedWord
          onConfirm={deleteAccount}
          onClose={() => setConfirming(false)}
        >
          This permanently deletes your account and all your data, and you will be signed out. To confirm, type the word
          shown below and enter your password.
        </ConfirmWithPasswordDialog>
      )}
    </Box>
  );
}
