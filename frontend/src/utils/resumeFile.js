import { MAX_RESUME_MB, RESUME_EXTENSIONS } from '../config';

/**
 * Quick client-side checks so users get instant feedback.
 * This is a convenience only: the server re-validates the extension, size and the real file signature.
 * Returns an error message, or an empty string when the file looks acceptable.
 */
export function validateResumeFile(file) {
  if (!file) return 'Choose a file to upload.';
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!file.name.includes('.') || !RESUME_EXTENSIONS.includes(extension)) {
    return 'Unsupported file type. Upload a PDF or DOCX file.';
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_RESUME_MB * 1024 * 1024) {
    return `This file is too large. The limit is ${MAX_RESUME_MB} MB.`;
  }
  return '';
}

export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Jane Doe CV.pdf" -> "Jane Doe CV" */
export function defaultResumeName(fileName) {
  return (fileName || '').replace(/\.[^.]+$/, '').trim();
}
