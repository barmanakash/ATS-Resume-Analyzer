import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewAnalysisPage from './NewAnalysisPage';
import resumeService from '../../services/resumeService';
import jobService from '../../services/jobService';
import analysisService from '../../services/analysisService';

jest.mock('../../services/resumeService', () => ({ __esModule: true, default: { list: jest.fn() } }));
jest.mock('../../services/jobService', () => ({ __esModule: true, default: { list: jest.fn(), create: jest.fn() } }));
jest.mock('../../services/analysisService', () => ({ __esModule: true, default: { create: jest.fn() } }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));

const DESCRIPTION = 'We need a backend engineer with 3 years of Python and MongoDB experience.';
const resume = (overrides = {}) => ({
  id: 'r1', displayName: 'My CV', originalFileName: 'cv.pdf', fileSize: 2048, processingStatus: 'COMPLETED', ...overrides,
});
const job = (overrides = {}) => ({
  id: 'j1', jobTitle: 'Backend Engineer', companyName: 'Acme', descriptionPreview: 'We need a backend engineer…', ...overrides,
});
const listOf = (items) => ({ items, total: items.length, totalPages: 1 });

const renderPage = (url = '/app/analyses/new') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/app/analyses/new" element={<NewAnalysisPage />} />
      <Route path="/app/analyses/:analysisId" element={<div>Report page</div>} />
      <Route path="/app/resumes" element={<div>Resumes page</div>} />
    </Routes>
  </MemoryRouter>,
);

const resumeSelect = () => screen.getByLabelText('Resume');
const startButton = () => screen.getByRole('button', { name: /start analysis/i });

beforeEach(() => {
  resumeService.list.mockReset();
  jobService.list.mockReset();
  jobService.create.mockReset();
  analysisService.create.mockReset();
});

describe('NewAnalysisPage', () => {
  it('pre-selects the resume and job named in the link and shows them', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'r2', displayName: 'Other CV' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    renderPage('/app/analyses/new?resumeId=r2&jobId=j1');
    await screen.findByRole('heading', { name: /choose a resume/i });
    expect(resumeSelect()).toHaveValue('r2');
    expect(screen.getByLabelText('Saved job description')).toHaveValue('j1');
    expect(screen.getAllByText('Backend Engineer').length).toBeGreaterThan(0); // the selected-job card
  });

  it('asks the user to upload a resume first when there are none', async () => {
    resumeService.list.mockResolvedValue(listOf([]));
    jobService.list.mockResolvedValue(listOf([]));
    renderPage();
    expect(await screen.findByText(/upload a resume first/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upload a resume/i })).toHaveAttribute('href', '/app/resumes');
    expect(screen.queryByRole('button', { name: /start analysis/i })).not.toBeInTheDocument();
  });

  it('does not offer failed resumes', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'bad', displayName: 'Broken', processingStatus: 'FAILED' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    renderPage();
    await screen.findByLabelText('Resume');
    expect(screen.queryByRole('option', { name: 'Broken' })).not.toBeInTheDocument();
  });

  it('requires a resume and a job before starting', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'r2', displayName: 'Other CV' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Resume');

    await user.click(startButton());
    expect(await screen.findByText(/choose a resume to analyze/i)).toBeInTheDocument();

    await user.selectOptions(resumeSelect(), 'r1');
    await user.click(startButton());
    expect(await screen.findByText(/choose a job description/i, { selector: '[role="alert"] *' })).toBeInTheDocument();
    expect(analysisService.create).not.toHaveBeenCalled();
  });

  it('runs an analysis with a saved job and opens the report', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'r2', displayName: 'Other CV' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    analysisService.create.mockResolvedValue({ id: 'a9' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Resume');
    await user.selectOptions(resumeSelect(), 'r1');
    await user.selectOptions(screen.getByLabelText('Saved job description'), 'j1');
    await user.click(startButton());

    await waitFor(() => expect(analysisService.create).toHaveBeenCalledWith('r1', 'j1'));
    expect(await screen.findByText('Report page')).toBeInTheDocument();
  });

  it('saves a pasted job and then analyzes with it', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()])); // a single resume is selected automatically
    jobService.list.mockResolvedValue(listOf([])); // no saved jobs -> "New job" mode
    jobService.create.mockResolvedValue({ id: 'jNew' });
    analysisService.create.mockResolvedValue({ id: 'a1' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText(/^job title/i);
    expect(resumeSelect()).toHaveValue('r1');

    await user.type(screen.getByLabelText(/^job title/i), '  Backend Engineer ');
    await user.type(screen.getByLabelText(/company name/i), 'Acme');
    await user.click(screen.getByLabelText(/^job description/i));
    await user.paste(DESCRIPTION);
    await user.click(startButton());

    await waitFor(() => expect(jobService.create).toHaveBeenCalledWith({
      jobTitle: 'Backend Engineer', companyName: 'Acme', description: DESCRIPTION,
    }));
    await waitFor(() => expect(analysisService.create).toHaveBeenCalledWith('r1', 'jNew'));
    expect(await screen.findByText('Report page')).toBeInTheDocument();
  });

  it('shows field errors for an incomplete pasted job and saves nothing', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText(/^job title/i);
    await user.click(screen.getByLabelText(/^job description/i));
    await user.paste('too short');
    await user.click(startButton());

    expect(await screen.findByText(/enter the job title/i)).toBeInTheDocument();
    expect(screen.getByText(/description is too short/i)).toBeInTheDocument();
    expect(jobService.create).not.toHaveBeenCalled();
    expect(analysisService.create).not.toHaveBeenCalled();
  });

  it('reuses the saved job when the analysis fails and is retried', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([]));
    jobService.create.mockResolvedValue({ id: 'jNew' });
    analysisService.create.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 'a2' });
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText(/^job title/i);
    await user.type(screen.getByLabelText(/^job title/i), 'Backend Engineer');
    await user.click(screen.getByLabelText(/^job description/i));
    await user.paste(DESCRIPTION);

    await user.click(startButton());
    expect(await screen.findByText(/analysis could not be completed/i)).toBeInTheDocument();
    expect(await screen.findByText(/was saved\. retrying will reuse it/i)).toBeInTheDocument();

    await user.click(startButton());
    expect(await screen.findByText('Report page')).toBeInTheDocument();
    expect(jobService.create).toHaveBeenCalledTimes(1); // no duplicate job
    expect(analysisService.create).toHaveBeenLastCalledWith('r1', 'jNew');
  });

  it('shows a load error with a working retry', async () => {
    resumeService.list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your resumes/i);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByLabelText('Resume')).toBeInTheDocument();
  });
});
