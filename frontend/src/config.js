export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

export const APP_NAME = process.env.REACT_APP_APP_NAME || 'ATS Resume Analyzer';
export const TAGLINE = 'Analyze. Optimize. Apply.';

// Must match MAX_UPLOAD_MB on the backend. The server enforces it too; this only gives instant feedback.
export const MAX_RESUME_MB = 5;
export const RESUME_EXTENSIONS = ['pdf', 'docx'];

// Job description files share the backend's upload size limit above.
export const JOB_FILE_EXTENSIONS = ['pdf', 'docx', 'txt'];
export const JOB_DESCRIPTION_MIN_CHARS = 30;
export const JOB_DESCRIPTION_MAX_CHARS = 20000; // matches the backend limit

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',
  dashboard: '/app/dashboard',
  resumes: '/app/resumes',
  jobs: '/app/jobs',
  newAnalysis: '/app/analyses/new',
  history: '/app/history',
  settings: '/app/settings',
};

/** Path of one analysis report. */
export const analysisPath = (id) => `/app/analyses/${id}`;
