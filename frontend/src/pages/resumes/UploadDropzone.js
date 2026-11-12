import React, { useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { MAX_RESUME_MB } from '../../config';

/** Click, keyboard or drag-and-drop file picker. It only reports the chosen file; the page validates it. */
export default function UploadDropzone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) onFile(files, true);
  };

  const handleChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = ''; // lets the same file be chosen again after an error
    if (files.length) onFile(files, false);
  };

  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label="Upload a resume. Drag a PDF or DOCX file here, or press Enter to browse."
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      sx={{
        border: '2px dashed',
        borderColor: dragging ? 'primary.main' : 'divider',
        bgcolor: dragging ? 'action.hover' : 'background.paper',
        borderRadius: 2,
        p: { xs: 3, md: 5 },
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light', outlineOffset: 2 },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.docx"
        aria-label="Choose resume file"
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
      />
      <CloudUploadOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
      <Typography variant="h6">Drag and drop your resume here</Typography>
      <Typography color="text.secondary">
        or click to browse. PDF or DOCX, up to {MAX_RESUME_MB} MB.
      </Typography>
    </Box>
  );
}
