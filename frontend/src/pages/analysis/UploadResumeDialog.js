import React, { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Typography } from '@mui/material';
import resumeService from '../../services/resumeService';
import { getErrorMessage } from '../../services/apiClient';
import { defaultResumeName, validateResumeFile } from '../../utils/resumeFile';
import UploadDropzone from '../resumes/UploadDropzone';

/**
 * Upload a resume without leaving the analysis workflow. The file is checked here for instant feedback and
 * re-validated by the server. On success the parent receives the new resume and closes the dialog.
 */
export default function UploadResumeDialog({ onClose, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const processing = uploading && progress >= 100;

  const handleFiles = async (files) => {
    setError('');
    if (files.length > 1) {
      setError('Upload one resume at a time.');
      return;
    }
    const file = files[0];
    const problem = validateResumeFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const resume = await resumeService.upload(file, defaultResumeName(file.name), setProgress);
      onUploaded(resume);
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed. Please try again.'));
      setUploading(false);
    }
  };

  return (
    <Dialog open onClose={uploading ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="upload-resume-title">
      <DialogTitle id="upload-resume-title">Upload a new resume</DialogTitle>
      <DialogContent>
        <UploadDropzone onFile={handleFiles} disabled={uploading} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {uploading && (
          <Box sx={{ mt: 2 }} role="status">
            <LinearProgress
              variant={processing ? 'indeterminate' : 'determinate'}
              value={progress}
              aria-label={processing ? 'Reading your document' : 'Upload progress'}
            />
            <Typography variant="caption" color="text.secondary">
              {processing ? 'Reading your document…' : `Uploading… ${progress}%`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
