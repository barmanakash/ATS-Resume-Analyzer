import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './routes/RouteGuards';
import DashboardLayout from './components/layout/DashboardLayout';
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import ResumesPage from './pages/resumes/ResumesPage';
import JobsPage from './pages/jobs/JobsPage';
import ComingSoonPage from './pages/ComingSoonPage';
import NotFoundPage from './pages/NotFoundPage';
import { ROUTES } from './config';

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<LandingPage />} />

      {/* Reset and verify links are opened from email, so they work regardless of login state. */}
      <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
      <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.resumes} element={<ResumesPage />} />
          <Route path={ROUTES.jobs} element={<JobsPage />} />
          <Route path={ROUTES.newAnalysis} element={<ComingSoonPage title="New analysis" phase="Phase 5 (ATS Analysis)" />} />
          <Route path={ROUTES.history} element={<ComingSoonPage title="Analysis history" phase="Phase 8 (Dashboard and History)" />} />
          <Route path={ROUTES.settings} element={<ComingSoonPage title="Settings" phase="Phase 8 (User Settings)" />} />
          <Route path="/app" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
