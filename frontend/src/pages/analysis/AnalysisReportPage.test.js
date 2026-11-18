import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AnalysisReportPage from './AnalysisReportPage';
import analysisService from '../../services/analysisService';
import optimizerService from '../../services/optimizerService';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/analysisService', () => ({ __esModule: true, default: { get: jest.fn(), remove: jest.fn() } }));
jest.mock('../../services/optimizerService', () => ({ __esModule: true, default: { optimize: jest.fn() } }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (err, fallback) => err?.userMessage || fallback }));
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
  resumeId: 'r1',
  jobDescriptionId: 'j1',
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
    { priority: 'low', category: 'structure', text: 'Use short bullet points.' },
    { priority: 'high', category: 'technicalSkills', text: 'Required but not found in your resume: Terraform.' },
  ],
  structureChecks: [
    { id: 'email', label: 'Email address', weight: 2, passed: true, hint: null },
    { id: 'bullets', label: 'Bullet points', weight: 1, passed: false, hint: 'Use short bullet points to describe results.' },
  ],
  resumeSummary: { yearsOfExperience: 4.5, yearsSource: 'dates', highestEducation: "Bachelor's degree", wordCount: 320 },
  semanticAnalysis: { enabled: false, note: 'AI semantic matching is not enabled.' },
  ...overrides,
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/app/analyses/a1']}>
    <Routes>
      <Route path="/app/analyses/:analysisId" element={<AnalysisReportPage />} />
      <Route path="/app/dashboard" element={<div>Dashboard page</div>} />
      <Route path="/app/versions/:versionId" element={<div>Version page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  analysisService.get.mockReset();
  analysisService.remove.mockReset();
  optimizerService.optimize.mockReset();
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('AnalysisReportPage', () => {
  it('shows the job, the score, the recommendation and the disclaimer', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Backend Engineer', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Acme · My CV/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /overall compatibility score: 68 out of 100/i })).toBeInTheDocument();
    expect(screen.getByText('Improve before applying')).toBeInTheDocument();
    expect(screen.getByText(/not a guarantee/i)).toBeInTheDocument();
    expect(analysisService.get).toHaveBeenCalledWith('a1');
  });

  it('lists missing required items separately and prominently', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    const title = await screen.findByText('Required items not found in your resume');
    expect(within(title.closest('[role="alert"]')).getByText('Terraform')).toBeInTheDocument();
    expect(screen.getByText('1 required item not found')).toBeInTheDocument();
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
    expect(await screen.findByText('22.5 of 30 points')).toBeInTheDocument();
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.getByText(/gave nothing to measure here/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /match by category: technical skills 75%/i })).toBeInTheDocument();
  });

  it('shows evidence, status and importance for each requirement', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    await screen.findByText('Python');
    expect(screen.getByText(/From your work experience/)).toHaveTextContent('95% confidence');
    expect(screen.getByText('Built APIs with Python and FastAPI')).toBeInTheDocument();
    expect(screen.getByText('Matched')).toBeInTheDocument();
    expect(screen.getByText('Partial match')).toBeInTheDocument();
    expect(screen.getByText('Could not verify')).toBeInTheDocument();
    expect(screen.getByText(/does not mean you lack the skill/i)).toBeInTheDocument();
  });

  it('filters requirements by status', async () => {
    analysisService.get.mockResolvedValue(report());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Python');
    await user.click(screen.getByRole('button', { name: /^not found \(1\)$/i }));
    expect(screen.queryByText('Python')).not.toBeInTheDocument();
    expect(screen.getByText('Terraform was not found in your resume.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^all \(4\)$/i }));
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('shows the skills overview, experience and education next to what the job asks for', async () => {
    analysisService.get.mockResolvedValue(report({
      matchedSkills: ['Python'], partialMatches: ['Docker'], missingSkills: ['Terraform'],
      extractedRequirements: { minYears: 3, maxYears: null, education: { requiredLabel: "Bachelor's degree", acceptsEquivalentExperience: false } },
    }));
    renderPage();
    const skills = (await screen.findByText('Skills overview')).closest('.MuiCard-root');
    expect(within(skills).getByText('Partially matched (1)')).toBeInTheDocument();
    expect(within(skills).getByText('Not found in your resume (1)')).toBeInTheDocument();
    expect(screen.getByText('4.5 years')).toBeInTheDocument();
    expect(screen.getByText('calculated from the dates in your resume')).toBeInTheDocument();
    expect(screen.getByText('3+ years')).toBeInTheDocument();
    expect(screen.getAllByText("Bachelor's degree", { selector: 'p' })).toHaveLength(2); // what the resume shows, and what the job asks
  });

  it('shows recommendations with the most important first, and failed structure checks with their hints', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    const first = await screen.findByText(/required but not found in your resume: terraform/i);
    const second = screen.getByText('Use short bullet points.');
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('High priority')).toBeInTheDocument();
    expect(screen.getByText(/Use short bullet points to describe results\./)).toBeInTheDocument();
  });

  it('shows warnings from the engine', async () => {
    analysisService.get.mockResolvedValue(report({ warnings: ['Few requirements could be detected in this job description.'] }));
    renderPage();
    expect(await screen.findByText(/few requirements could be detected/i)).toBeInTheDocument();
  });

  it('links back to the history and re-runs the analysis with the same resume and job', async () => {
    analysisService.get.mockResolvedValue(report());
    renderPage();
    expect(await screen.findByRole('link', { name: /all analyses/i })).toHaveAttribute('href', '/app/history');
    expect(screen.getByRole('link', { name: /analyze again/i })).toHaveAttribute('href', '/app/analyses/new?resumeId=r1&jobId=j1');
  });

  it('shows an error with a working retry', async () => {
    analysisService.get.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(report());
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load this report/i);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('heading', { name: 'Backend Engineer', level: 1 })).toBeInTheDocument();
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

  describe('optimizing the resume', () => {
    it('creates an optimized copy and opens it', async () => {
      analysisService.get.mockResolvedValue(report());
      optimizerService.optimize.mockResolvedValue({ id: 'v1' });
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole('button', { name: /optimize resume/i }));
      await waitFor(() => expect(optimizerService.optimize).toHaveBeenCalledWith('a1'));
      expect(await screen.findByText('Version page')).toBeInTheDocument();
    });

    it('shows the reason when it fails and lets the user try again', async () => {
      analysisService.get.mockResolvedValue(report());
      const failure = Object.assign(new Error('x'), { userMessage: 'The AI provider could not produce suggestions right now.' });
      optimizerService.optimize.mockRejectedValueOnce(failure).mockResolvedValueOnce({ id: 'v2' });
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole('button', { name: /optimize resume/i }));
      expect(await screen.findByText(/ai provider could not produce suggestions/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /optimize resume/i })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: /optimize resume/i }));
      expect(await screen.findByText('Version page')).toBeInTheDocument();
    });

    it('is not offered for an analysis made by an older scoring engine', async () => {
      analysisService.get.mockResolvedValue({ id: 'old', overallScore: 55, jobTitle: 'Old job', createdAt: '2026-01-01T00:00:00Z' });
      renderPage();
      expect(await screen.findByRole('heading', { name: 'Old job', level: 1 })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /optimize resume/i })).not.toBeInTheDocument();
    });
  });
});
