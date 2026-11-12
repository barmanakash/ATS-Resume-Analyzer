import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import jobService from '../../services/jobService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { JOB_DESCRIPTION_MAX_CHARS } from '../../config';
import { jobSchema, validateJobFile } from './jobSchema';

const EMPTY = { jobTitle: '', companyName: '', description: '' };

/** Create (no jobId) or edit (jobId) a job description. Edit mode loads the full text first. */
export default function JobFormDialog({ jobId, onClose, onSaved }) {
  const isEdit = Boolean(jobId);
  const { success } = useNotification();
  const fileInput = useRef(null);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [fileError, setFileError] = useState('');
  const [fileNotice, setFileNotice] = useState('');
  const [extracting, setExtracting] = useState(false);

  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(jobSchema), defaultValues: EMPTY });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const job = await jobService.get(jobId);
      reset({ jobTitle: job.jobTitle || '', companyName: job.companyName || '', description: job.description || '' });
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this job description.'));
    } finally {
      setLoading(false);
    }
  }, [jobId, reset]);

  useEffect(() => { if (isEdit) load(); }, [isEdit, load]);

  const busy = isSubmitting || extracting;

  const handleClose = (_event, reason) => {
    if (busy) return;
    // A stray click outside must not discard a long pasted description.
    if (reason === 'backdropClick' && isDirty) return;
    onClose();
  };

  const onSubmit = async (values) => {
    setSubmitError('');
    try {
      if (isEdit) await jobService.update(jobId, values);
      else await jobService.create(values);
      success(isEdit ? 'Job description updated.' : 'Job description saved.');
      onSaved();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not save this job description. Please try again.'));
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allows choosing the same file again
    if (!file) return;
    setFileError('');
    setFileNotice('');
    const problem = validateJobFile(file);
    if (problem) { setFileError(problem); return; }
    setExtracting(true);
    try {
      const { text, truncated } = await jobService.extractText(file);
      setValue('description', text, { shouldDirty: true, shouldValidate: true });
      if (truncated) {
        setFileNotice(`The document was longer than ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString('en-US')} characters, so it was shortened. Check that nothing important is missing.`);
      }
    } catch (err) {
      setFileError(getErrorMessage(err, 'Could not read this file. Try pasting the text instead.'));
    } finally {
      setExtracting(false);
    }
  };

  const length = (watch('description') || '').length;
  const formDisabled = loading || Boolean(loadError);

  return (
    <Dialog open onClose={handleClose} fullWidth maxWidth="md" aria-labelledby="job-form-title">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle id="job-form-title">{isEdit ? 'Edit job description' : 'Add job description'}</DialogTitle>
        <DialogContent dividers>
          {loadError && (
            <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
              {loadError}
            </Alert>
          )}
          {loading ? (
            <Stack spacing={2}><Skeleton variant="rounded" height={56} /><Skeleton variant="rounded" height={56} /><Skeleton variant="rounded" height={220} /></Stack>
          ) : (
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Job title"
                  required
                  fullWidth
                  disabled={formDisabled}
                  error={Boolean(errors.jobTitle)}
                  helperText={errors.jobTitle?.message}
                  inputProps={{ maxLength: 200 }}
                  {...register('jobTitle')}
                />
                <TextField
                  label="Company name"
                  fullWidth
                  disabled={formDisabled}
                  error={Boolean(errors.companyName)}
                  helperText={errors.companyName?.message || 'Optional'}
                  inputProps={{ maxLength: 200 }}
                  {...register('companyName')}
                />
              </Stack>

              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Paste the description, or fill it from a file.</Typography>
                  <Button
                    size="small"
                    startIcon={extracting ? <CircularProgress size={16} /> : <UploadFileOutlinedIcon />}
                    onClick={() => fileInput.current?.click()}
                    disabled={formDisabled || busy}
                  >
                    {extracting ? 'Reading file…' : 'Upload a file'}
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    accept=".pdf,.docx,.txt"
                    aria-label="Upload a job description file"
                    onChange={handleFile}
                  />
                </Stack>
                {fileError && <Alert severity="error" onClose={() => setFileError('')}>{fileError}</Alert>}
                {fileNotice && <Alert severity="warning" onClose={() => setFileNotice('')}>{fileNotice}</Alert>}
                <TextField
                  label="Job description"
                  required
                  multiline
                  minRows={10}
                  maxRows={18}
                  fullWidth
                  disabled={formDisabled || extracting}
                  error={Boolean(errors.description)}
                  helperText={errors.description?.message || `${length.toLocaleString('en-US')} / ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString('en-US')} characters`}
                  {...register('description')}
                />
              </Stack>

              {submitError && <Alert severity="error">{submitError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose()} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy || formDisabled}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
