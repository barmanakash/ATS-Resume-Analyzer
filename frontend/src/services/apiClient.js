import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Security model:
 * - The access token lives only in memory (never localStorage), so XSS cannot read it from storage.
 * - The refresh token is expected to be an httpOnly, Secure, SameSite cookie set by the backend,
 *   which is why requests use `withCredentials: true`.
 */
let accessToken = null;
let authFailureHandler = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setAuthFailureHandler = (fn) => {
  authFailureHandler = fn;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/** Requests a new access token using the refresh cookie. Shared so parallel 401s refresh once. */
export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, null, { withCredentials: true, timeout: 15000 })
      .then((res) => {
        const token = res.data?.data?.accessToken;
        if (!token) throw new Error('No access token returned');
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = AUTH_PATHS.some((p) => original?.url?.includes(p));

    if (status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      } catch (refreshError) {
        setAccessToken(null);
        if (authFailureHandler) authFailureHandler();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

/** Converts any thrown error into a safe, user-readable message. */
export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (!error?.response) {
    return error?.request ? 'Cannot reach the server. Check your connection or try again later.' : fallback;
  }
  const detail = error.response.data?.error?.message || error.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
};

export default apiClient;
