import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AnalysisReportPage from './AnalysisReportPage';
import analysisService from '../../services/analysisService';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/analysisService', () => ({ __esModule: true, default: { get: jest.fn(), remove: jest.fn() } }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));
// jsdom has no layout, so recharts' ResponsiveContainer would render nothing.
jest.mock('recharts', () => {
  const Passthrough = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Passthrough, RadarChart: Passthrough, PolarGrid: () => null, PolarAngleAxis: () => null,
    PolarRadiusAxis: () => null, Radar: () => null,
  };
});

const category = (key, label, overrides = {}) => ({
  key, label, weight: 20, effectiveWeight: 20, applicable: true, ratio: 0.5, points: 10, ...overrides,
});

const report = (overrides = {}) => ({
  id: 'a1',
  engineVersion: '1.0',
  overallScore: 68,
  recommendation: 'IMPROVE_BEFORE_APPLYING',
  jobTitle: 'Backend Engineer',
  companyName: 'Acme',
  resumeName: 'My CV',
  createdAt: '2026-11-10T10:00:00Z',
  disclaimer: 'This score is an estimate and not a guarantee of passing any ATS.',
  warnings: [],
  categoryScores: [
    category('technicalSkills', 'Technical skills', { ratio: 0.75, points: 22.5, effectiveWeight: 30 }),
    category('experience', 'Experience relevance'),
    category('responsibilities', 'Responsibilities match'),
    category('keywords', 'Keyword relevance'),
    category('education', 'Education match', { applicable: false, ratio: null, points: 0, effectiveWeight: 0 }),
    category('structure', 'Resume structure', { ratio: 0.9, points: 9, effectiveWeight: 10 }),
  ],
  mandatoryGaps: [{ requirement: 'Terraform', kind: 'skill', explanation: 'x' }],
  requirements: [
    {
      id: 'skill:Python', kind: 'skill', category: 'technicalSkills', requirement: 'Python', importance: 'MANDATORY',
      status: 'MATCHED', confidence: 0.95, evidence: 'Built APIs with Python and FastAPI', evidenceSection: 'experience',
      explanation: 'Python appears in your work experience.',
    },
    {
      id: 'skill:Docker', kind: 'skill', category: 'technicalSkills', requirement: 'Docker', importance: 'PREFERRED',
      status: 'PARTIAL_MATCH', confidence: 0.5, evidence: null, evidenceSection: null,
      explanation: 'Your resume shows related experience (Kubernetes), but Docker itself was not found.',
    },
    {
      id: 'skill:Terraform', kind: 'skill', category: 'technicalSkills', requirement: 'Terraform', importance: 'MANDATORY',
      status: 'NOT_FOUND', confidence: null, evidence: null, evidenceSection: null, explanation: 'Terraform was not found in your resume.',
    },
    {
      id: 'experience:years', kind: 'experience', category: 'experience', requirement: '3+ years of experience',
      importance: 'MANDATORY', status: 'UNVERIFIED', confidence: null, evidence: null, evidenceSection: null,
      explanation: 'Your total experience could not be worked out.',
    },
  ],
  improvementRecommendations: [
    { priority: 'high', category: 'technicalSkills', text: 'Required but not found in your resume: Terraform.' },
    { priority: 'low', category: 'structure', text: 'Use short bullet points.' },
  ],
  structureChecks: [
    { id: 'email', label: 'Email address', weight: 2, passed: true, hint: null },
    { id: 'bullets', label: 'Bullet points', weight: 1, passed: false, hint: 'Use short bullet points to describe results.' },
  ],
  resumeSummary: { yearsOfExperience: 4.5, highestEducation: "Bachelor's degree", wordCount: 320 },
  semanticAnalysis: { enabled: false, note: 'AI semantic matching is not enabled.' },
  ...overrides,
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/app/analyses/a1']}>
    <Routes>
      <Route path="/app/analyses/:analysisId" element={<AnalysisReportPage />} />
      <Route path="/app/dashboard" element={<div>Dashboard page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  analysisService.get.mockReset();
  analysisService.remove.mockReset();
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('AnalysisReportPage', () => {
  it('shows the job, the score, the recommendation and the disclaimer', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
    expect(screen.getByText(/Acme · My CV/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /overall compatibility score 68 out of 100/i })).toBeInTheDocument();
    expect(screen.getByText('Improve before applying')).toBeInTheDocument();
    expect(screen.getByText(/not a guarantee/i)).toBeInTheDocument();
    expect(analysisService.get).toHaveBeenCalledWith('a1');
  });

  it('lists missing required items separately and prominently', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    const alert = await screen.findByText(/1 required item was not found/i);
    expect(within(alert.closest('[role="alert"]')).getByText('Terraform')).toBeInTheDocument();
  });

  it('says so when nothing required is missing', async () => {
    analysisService.get.mockResolvedValue(report({ mandatoryGaps: [], recommendation: 'READY_TO_APPLY', overallScore: 91 }));
    renderPage();
    expect(await screen.findByText(/no required items are missing/i)).toBeInTheDocument();
    expect(screen.getByText('Ready to apply')).toBeInTheDocument();
  });

  it('shows points per category and marks a category the job does not specify as not scored', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    expect(await screen.findByText('22.5 / 30 points')).toBeInTheDocument();
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.getByText(/does not specify this/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /match by category: technical skills 75%/i })).toBeInTheDocument();
  });

  it('shows evidence, status and importance for each requirement', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    await screen.findByText('Python');
    expect(screen.getByText(/From your work experience:/)).toHaveTextContent('Built APIs with Python and FastAPI');
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.getByText('Partial match')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(screen.getByText(/not that you lack the skill/i)).toBeInTheDocument();
  });

  it('filters requirements by status', async () => {
    analysisService.get.mockResolvedValue(report());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Python');
    await user.click(screen.getByRole('button', { name: /not found \(1\)/i }));
    expect(screen.queryByText('Python')).not.toBeInTheDocument();
    expect(screen.getByText('Terraform was not found in your resume.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /all \(4\)/i }));
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('shows improvement recommendations and failed structure checks with their hints', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    expect(await screen.findByText(/required but not found in your resume: terraform/i)).toBeInTheDocument();
    expect(screen.getByText('high priority')).toBeInTheDocument();
    expect(screen.getByText(/Use short bullet points to describe results\./)).toBeInTheDocument();
    expect(screen.getByText(/about 4\.5 years/)).toBeInTheDocument();
  });

  it('shows warnings from the engine', async () => {
    analysisService.get.mockResolvedValue(report({ warnings: ['Few requirements could be detected in this job description.'] }));
    renderPage();
    expect(await screen.findByText(/few requirements could be detected/i)).toBeInTheDocument();
  });

  it('explains when an analysis predates the detailed report', async () => {
    analysisService.get.mockResolvedValue({ id: 'old', overallScore: 55, jobTitle: 'Old job', createdAt: '2026-01-01T00:00:00Z' });
    renderPage();
    expect(await screen.findByText(/older version of the scoring engine/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /score 55 out of 100/i })).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    analysisService.get.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(report());
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load this report/i);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
  });

  it('deletes only after confirmation and returns to the dashboard', async () => {
    analysisService.get.mockResolvedValue(report());
    analysisService.remove.mockResolvedValue();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));
    const dialog = await screen.findByRole('dialog');
    expect(analysisService.remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(analysisService.remove).toHaveBeenCalledWith('a1'));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('cancelling the delete dialog keeps the report', async () => {
    analysisService.get.mockResolvedValue(report());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /^delete$/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(analysisService.remove).not.toHaveBeenCalled();
  });
});
