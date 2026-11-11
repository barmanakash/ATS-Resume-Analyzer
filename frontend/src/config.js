export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

export const APP_NAME = process.env.REACT_APP_APP_NAME || 'ATS Resume Analyzer';
export const TAGLINE = 'Analyze. Optimize. Apply.';

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
