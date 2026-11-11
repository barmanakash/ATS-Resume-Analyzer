import apiClient from './apiClient';

/**
 * Assumed backend response envelope (to be implemented in the backend phase):
 *   success: { success: true, data: {...}, meta?: {...} }
 *   error:   { success: false, error: { code, message } }
 */
const authService = {
  register: (payload) => apiClient.post('/auth/register', payload).then((r) => r.data.data),
  login: (payload) => apiClient.post('/auth/login', payload).then((r) => r.data.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data.data),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (payload) => apiClient.post('/auth/reset-password', payload).then((r) => r.data),
  verifyEmail: (token) => apiClient.post('/auth/verify-email', { token }).then((r) => r.data),
};

export default authService;
