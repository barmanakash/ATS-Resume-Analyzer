import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import { refreshAccessToken, setAccessToken, setAuthFailureHandler } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  // Restore the session on page load using the httpOnly refresh cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAccessToken();
        const me = await authService.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // If a token refresh fails mid-session, drop the user back to logged-out state.
  useEffect(() => {
    setAuthFailureHandler(clearSession);
    return () => setAuthFailureHandler(null);
  }, [clearSession]);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback((payload) => authService.register(payload), []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Clear local state even if the server call fails.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, initializing, isAuthenticated: Boolean(user), login, register, logout, setUser }),
    [user, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
