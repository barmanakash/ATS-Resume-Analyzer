import React, { useState } from 'react';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useNotification } from '../../context/NotificationContext';
import userService from '../../services/userService';
import PasswordConfirmDialog from './PasswordConfirmDialog';

// Keep these statements true to what the application does. Update them if the behaviour changes.
const HANDLING = [
  'Your resume files are stored privately. Only you can open them, and they are never available through a public link.',
  'Your resume text and job descriptions are used to run your analyses and, if you use it, resume optimization.',
  'Analysis scores are calculated on our server by a fixed set of rules. An AI model does not decide the score.',
  'Resume text is only sent to an AI provider when you ask for optimization suggestions and this service has an AI provider set up.',
  'You can delete everything you have uploaded or generated at any time, as described below.',
];

export default function PrivacySection() {
  const { success } = useNotification();
  const [open, setOpen] = useState(false);

  const handleConfirm = async (password) => {
    await userService.deleteData(password);
    setOpen(false);
    success('All your resumes, job descriptions and analyses have been deleted.');
  };

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <LockOutlinedIcon color="primary" />
            <Typography variant="h6" component="h2">How your data is handled</Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {HANDLING.map((text) => (
              <Typography key={text} component="li" sx={{ mb: 0.75 }}>{text}</Typography>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" component="h2" gutterBottom>Delete my data</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Permanently deletes all your uploaded resume files, saved job descriptions, analyses and optimized resume versions.
            Your account and login stay, so you can start fresh. This cannot be undone.
          </Typography>
          <Button color="error" variant="outlined" startIcon={<DeleteSweepOutlinedIcon />} onClick={() => setOpen(true)}>
            Delete all my data
          </Button>
        </CardContent>
      </Card>

      {open && (
        <PasswordConfirmDialog
          title="Delete all your data?"
          confirmLabel="Delete all my data"
          onConfirm={handleConfirm}
          onClose={() => setOpen(false)}
        >
          <Typography>
            Your resumes, job descriptions, analyses and optimized versions will be permanently deleted. Enter your password to confirm.
          </Typography>
        </PasswordConfirmDialog>
      )}
    </Stack>
  );
}
