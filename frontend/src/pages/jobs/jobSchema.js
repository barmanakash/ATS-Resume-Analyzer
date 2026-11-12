import { z } from 'zod';
import { JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MIN_CHARS, JOB_FILE_EXTENSIONS, MAX_RESUME_MB } from '../../config';

/** Mirrors the backend rules. The server re-validates everything. */
export const jobSchema = z.object({
  jobTitle: z.string().trim().min(1, 'Enter the job title.').max(200, 'The job title can be at most 200 characters.'),
  companyName: z.string().trim().max(200, 'The company name can be at most 200 characters.'),
  description: z
    .string()
    .trim()
    .min(JOB_DESCRIPTION_MIN_CHARS, `The description is too short. Paste the full job description (at least ${JOB_DESCRIPTION_MIN_CHARS} characters).`)
    .max(JOB_DESCRIPTION_MAX_CHARS, `The description can be at most ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString('en-US')} characters.`),
});

/** Quick check of a job description file before it is sent. The server validates the real file content. */
export function validateJobFile(file) {
  if (!file) return 'Choose a file.';
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!file.name.includes('.') || !JOB_FILE_EXTENSIONS.includes(extension)) {
    return 'Unsupported file type. Use a PDF, DOCX or TXT file.';
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_RESUME_MB * 1024 * 1024) return `This file is too large. The limit is ${MAX_RESUME_MB} MB.`;
  return '';
}
