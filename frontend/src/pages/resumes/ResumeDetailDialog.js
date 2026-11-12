import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Skeleton, Stack, Typography,
} from '@mui/material';
import resumeService from '../../services/resumeService';
import { getErrorMessage } from '../../services/apiClient';
import { formatBytes } from '../../utils/resumeFile';

const SECTION_LABELS = {
  summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills',
  projects: 'Projects', certifications: 'Certifications', achievements: 'Achievements',
};

function Field({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value || 'Not found'}</Typography>
    </Box>
  );
}

export default function ResumeDetailDialog({ resumeId, onClose }) {
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResume(await resumeService.get(resumeId));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this resume.'));
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => { load(); }, [load]);

  const info = resume?.parsedData || {};
  const sections = info.sectionsDetected || [];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="resume-detail-title">
      <DialogTitle id="resume-detail-title">{resume?.displayName || 'Resume'}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>
        )}
        {loading && (
          <Stack spacing={1}><Skeleton variant="rounded" height={60} /><Skeleton variant="rounded" height={240} /></Stack>
        )}
        {!loading && resume && (
          <Stack spacing={2}>
            {resume.processingStatus !== 'COMPLETED' && (
              <Alert severity={resume.processingStatus === 'FAILED' ? 'error' : 'info'}>
                {resume.processingStatus === 'FAILED'
                  ? (resume.processingError || 'This resume could not be processed.')
                  : 'This resume is still being processed.'}
              </Alert>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>File</Typography>
              <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
                <Field label="Original file name" value={resume.originalFileName} />
                <Field label="Type" value={(resume.fileType || '').toUpperCase()} />
                <Field label="Size" value={formatBytes(resume.fileSize)} />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Information read from the document</Typography>
              <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
                <Field label="Email" value={info.email} />
                <Field label="Phone" value={info.phone} />
                <Field label="Pages" value={info.pageCount != null ? String(info.pageCount) : ''} />
                <Field label="Words" value={info.wordCount != null ? String(info.wordCount) : ''} />
              </Stack>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2, mb: 0.5 }}>
                Sections detected
              </Typography>
              {sections.length ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {sections.map((s) => <Chip key={s} size="small" label={SECTION_LABELS[s] || s} />)}
                </Stack>
              ) : (
                <Typography variant="body2">None detected. Standard headings such as &quot;Experience&quot; and &quot;Education&quot; help ATS software read your resume.</Typography>
              )}
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                Only details that can be read directly from your document are shown. Nothing is guessed.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Extracted text</Typography>
              {resume.parsedText ? (
                <Box
                  component="pre"
                  tabIndex={0}
                  aria-label="Extracted resume text"
                  sx={{
                    m: 0, p: 2, maxHeight: 360, overflow: 'auto', bgcolor: 'background.default', border: 1,
                    borderColor: 'divider', borderRadius: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13,
                  }}
                >
                  {resume.parsedText}
                </Box>
              ) : (
                <Typography color="text.secondary">No text was extracted from this file.</Typography>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
}
