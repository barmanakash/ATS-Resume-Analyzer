import React, { useState } from 'react';
import { Box, Button, Card, CardContent, List, ListItem, ListItemText, Typography } from '@mui/material';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import { useNotification } from '../../context/NotificationContext';
import userService from '../../services/userService';
import ConfirmWithPasswordDialog from './ConfirmWithPasswordDialog';

const STORED = [
  ['Your account', 'Your name, email address and a securely hashed password. We never store your password itself.'],
  ['Resumes', 'The original file you upload and the text extracted from it.'],
  ['Job descriptions', 'The job postings you save.'],
  ['Analysis reports', 'Each report and the scores and findings in it.'],
];

export default function PrivacyPanel() {
  const { success } = useNotification();
  const [confirming, setConfirming] = useState(false);

  const deleteData = async (password) => {
    await userService.deleteData(password);
    setConfirming(false);
    success('All your resumes, job descriptions and analyses have been deleted.');
  };

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" component="h2" gutterBottom>Privacy and your data</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Your documents are private. They are stored securely and are only available to you when you are signed in.
      </Typography>

      <Typography variant="subtitle2" component="h3">What we store</Typography>
      <List dense disablePadding sx={{ mb: 3 }}>
        {STORED.map(([title, text]) => (
          <ListItem key={title} disableGutters>
            <ListItemText primary={title} secondary={text} />
          </ListItem>
        ))}
      </List>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" component="h3" gutterBottom>Delete all my data</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Permanently removes every resume (including the uploaded files), job description and analysis report. Your
            account and login stay, so you can start fresh. This cannot be undone.
          </Typography>
          <Button color="error" variant="outlined" startIcon={<DeleteSweepOutlinedIcon />} onClick={() => setConfirming(true)}>
            Delete all my data
          </Button>
        </CardContent>
      </Card>

      {confirming && (
        <ConfirmWithPasswordDialog
          id="delete-data"
          title="Delete all your data?"
          confirmLabel="Delete all my data"
          onConfirm={deleteData}
          onClose={() => setConfirming(false)}
        >
          All your resumes, job descriptions and analysis reports will be permanently deleted. Enter your password to
          confirm.
        </ConfirmWithPasswordDialog>
      )}
    </Box>
  );
}
