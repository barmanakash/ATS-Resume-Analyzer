import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from '../components/common/PageLoader';
import { ROUTES } from '../config';

/** Blocks unauthenticated users and remembers where they were going. */
export function ProtectedRoute() {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <PageLoader minHeight="100vh" />;
  if (!isAuthenticated) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  return <Outlet />;
}

/** Keeps logged-in users away from login/register pages. */
export function PublicOnlyRoute() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) return <PageLoader minHeight="100vh" />;
  if (isAuthenticated) return <Navigate to={ROUTES.dashboard} replace />;
  return <Outlet />;
}
