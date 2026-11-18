import React, { useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  FormControlLabel, FormLabel, Radio, RadioGroup, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import exportService from '../../services/exportService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { saveBlob } from '../../utils/download';

/**
 * "Download" button that opens a small dialog to choose the file type, style and page size, then saves the
 * resume version as a PDF or Word file. Both styles are single column with real text, which is what applicant
 * tracking systems read best.
 */
export default function ExportButton({ versionId, disabled = false, variant = 'contained', label = 'Download' }) {
  const { success } = useNotification();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [template, setTemplate] = useState('classic');
  const [pageSize, setPageSize] = useState('A4');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError('');
    setWarning('');
  };

  const download = async (chosenFormat) => {
    setBusy(true);
    setError('');
    setWarning('');
    try {
      const { blob, filename, warnings } = await exportService.download(versionId, { format: chosenFormat, template, pageSize });
      saveBlob(blob, filename);
      success(`Downloaded ${filename}`);
      if (warnings.length) {
        // Keep the dialog open: the file was saved, but the person should know something was replaced.
        setWarning(warnings.join(' '));
      } else {
        setOpen(false);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the file. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const switchToDocx = () => {
    setFormat('docx');
    download('docx');
  };

  return (
    <>
      <Button variant={variant} startIcon={<DownloadOutlinedIcon />} disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby="export-dialog-title">
        <DialogTitle id="export-dialog-title">Download your resume</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 0.5 }}>
            <FormControl>
              <FormLabel id="export-format-label">File type</FormLabel>
              <RadioGroup aria-labelledby="export-format-label" value={format} onChange={(e) => setFormat(e.target.value)}>
                <FormControlLabel
                  value="pdf"
                  control={<Radio />}
                  label={<Box><Typography>PDF</Typography><Typography variant="caption" color="text.secondary">Best for sending to employers</Typography></Box>}
                />
                <FormControlLabel
                  value="docx"
                  control={<Radio />}
                  label={<Box><Typography>Word (DOCX)</Typography><Typography variant="caption" color="text.secondary">Best for editing. Keeps every character, including non-Latin scripts</Typography></Box>}
                />
              </RadioGroup>
            </FormControl>

            <FormControl>
              <FormLabel id="export-template-label" sx={{ mb: 1 }}>Style</FormLabel>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="primary"
                value={template}
                onChange={(_, value) => value && setTemplate(value)}
                aria-labelledby="export-template-label"
              >
                <ToggleButton value="classic">Classic</ToggleButton>
                <ToggleButton value="modern">Modern</ToggleButton>
              </ToggleButtonGroup>
            </FormControl>

            <FormControl>
              <FormLabel id="export-size-label" sx={{ mb: 1 }}>Page size</FormLabel>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                color="primary"
                value={pageSize}
                onChange={(_, value) => value && setPageSize(value)}
                aria-labelledby="export-size-label"
              >
                <ToggleButton value="A4">A4</ToggleButton>
                <ToggleButton value="LETTER">US Letter</ToggleButton>
              </ToggleButtonGroup>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              Both styles use one column and real text with standard headings, so applicant tracking systems can read them.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}
            {warning && (
              <Alert
                severity="warning"
                action={<Button color="inherit" size="small" onClick={switchToDocx} disabled={busy}>Download Word (DOCX) instead</Button>}
              >
                {warning}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={busy}>{warning ? 'Done' : 'Cancel'}</Button>
          <Button variant="contained" onClick={() => download(format)} disabled={busy} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <DownloadOutlinedIcon />}>
            {busy ? 'Preparing\u2026' : 'Download'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
