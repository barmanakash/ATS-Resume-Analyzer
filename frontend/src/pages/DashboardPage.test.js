import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import dashboardService from '../services/dashboardService';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { fullName: 'Asha Verma', email: 'asha@example.com' } }) }));
jest.mock('../services/dashboardService', () => ({ __esModule: true, default: { getOverview: jest.fn() } }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules). Only the message helper is needed.
jest.mock('../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));
// jsdom has no layout, so recharts' ResponsiveContainer would render nothing.
jest.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough, LineChart: Passthrough, Line: () => null,
    CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null,
  };
});

const emptyData = {
  totalResumes: 0, totalJobDescriptions: 0, totalAnalyses: 0, averageCompatibilityScore: null,
  recentResumes: [], recentAnalyses: [], scoreTrend: [],
  usage: { analysesThisMonth: 0, resumes: { used: 0, limit: 50 }, jobDescriptions: { used: 0, limit: 200 } },
};

const fullData = {
  totalResumes: 2, totalJobDescriptions: 1, totalAnalyses: 7, averageCompatibilityScore: 62.4,
  recentResumes: [{ id: 'r1', displayName: 'My CV', originalFileName: 'cv.pdf', fileType: 'pdf', createdAt: '2026-11-01T10:00:00Z' }],
  recentAnalyses: [
    { id: 'a1', jobTitle: 'Backend Engineer', companyName: 'Acme', resumeName: 'My CV', overallScore: 81, createdAt: '2026-11-02T10:00:00Z' },
    { id: 'a2', jobTitle: null, companyName: '', resumeName: 'My CV', overallScore: 40, createdAt: '2026-11-03T10:00:00Z' },
  ],
  scoreTrend: [{ id: 'a1', score: 81, createdAt: '2026-11-02T10:00:00Z' }],
  usage: { analysesThisMonth: 3, resumes: { used: 2, limit: 50 }, jobDescriptions: { used: 1, limit: 200 } },
};

const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => dashboardService.getOverview.mockReset());

describe('DashboardPage', () => {
  it('greets the user by first name', async () => {
    dashboardService.getOverview.mockResolvedValue(emptyData);
    renderPage();
    expect(await screen.findByRole('heading', { name: /welcome, asha/i })).toBeInTheDocument();
  });

  it('shows empty states and guides a new user to upload a resume first', async () => {
    dashboardService.getOverview.mockResolvedValue(emptyData);
    renderPage();
    expect(await screen.findByText(/no analyses yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no resumes uploaded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/run an analysis to see your average/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upload a resume/i })).toHaveAttribute('href', '/app/resumes');
  });

  it('points to job descriptions once a resume exists but no job does', async () => {
    dashboardService.getOverview.mockResolvedValue({ ...emptyData, totalResumes: 1 });
    renderPage();
    expect(await screen.findByRole('link', { name: /add a job description/i })).toHaveAttribute('href', '/app/jobs');
  });

  it('shows totals, average, usage and recent items from the server', async () => {
    dashboardService.getOverview.mockResolvedValue(fullData);
    renderPage();
    expect(await screen.findByText('62%')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('81%')).toBeInTheDocument();
    expect(screen.getByText('Job description removed')).toBeInTheDocument();
    expect(screen.getByText('My CV')).toBeInTheDocument();
    expect(screen.getByText('2 of 50')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start analysis/i })).toHaveAttribute('href', '/app/analyses/new');
    expect(screen.getByRole('img', { name: /last 1 analyses: 81%/i })).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    dashboardService.getOverview.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(emptyData);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your dashboard/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(dashboardService.getOverview).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/no analyses yet/i)).toBeInTheDocument();
  });
});
