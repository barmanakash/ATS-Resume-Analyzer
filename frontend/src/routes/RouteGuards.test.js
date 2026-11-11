import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './RouteGuards';

let mockAuth = { isAuthenticated: false, initializing: false };
jest.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app/dashboard" element={<div>Private dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', () => {
    mockAuth = { isAuthenticated: false, initializing: false };
    renderAt('/app/dashboard');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Private dashboard')).not.toBeInTheDocument();
  });

  it('renders the page for authenticated users', () => {
    mockAuth = { isAuthenticated: true, initializing: false };
    renderAt('/app/dashboard');
    expect(screen.getByText('Private dashboard')).toBeInTheDocument();
  });

  it('shows a loader while the session is being restored', () => {
    mockAuth = { isAuthenticated: false, initializing: true };
    renderAt('/app/dashboard');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
