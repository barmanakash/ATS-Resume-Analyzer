import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewAnalysisPage from './NewAnalysisPage';
import resumeService from '../../services/resumeService';
import jobService from '../../services/jobService';
import analysisService from '../../services/analysisService';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/resumeService', () => ({ __esModule: true, default: { list: jest.fn(), upload: jest.fn() } }));
jest.mock('../../services/jobService', () => ({
  __esModule: true,
  default: { list: jest.fn(), create: jest.fn(), get: jest.fn(), update: jest.fn(), extractText: jest.fn() },
}));
jest.mock('../../services/analysisService', () => ({ __esModule: true, default: { create: jest.fn() } }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));

const DESCRIPTION = 'We need a backend engineer with 3 years of Python and MongoDB experience.';
const resume = (overrides = {}) => ({
  id: 'r1', displayName: 'My CV', originalFileName: 'cv.pdf', fileType: 'pdf', fileSize: 2048, processingStatus: 'COMPLETED', ...overrides,
});
const job = (overrides = {}) => ({ id: 'j1', jobTitle: 'Backend Engineer', companyName: 'Acme', ...overrides });
const listOf = (items) => ({ items, total: items.length, totalPages: 1 });

const renderPage = (url = '/app/analyses/new') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/app/analyses/new" element={<NewAnalysisPage />} />
      <Route path="/app/analyses/:analysisId" element={<div>Report page</div>} />
    </Routes>
  </MemoryRouter>,
);

const radio = (name) => screen.getByRole('radio', { name });
const button = (name) => screen.getByRole('button', { name });
const waitForStep = (title) => screen.findByRole('heading', { name: title });

async function goToJobStep(user) {
  await waitForStep(/choose a resume/i);
  await user.click(radio(/My CV/));
  await user.click(button(/^next$/i));
  await waitForStep(/choose a job description/i);
}

beforeEach(() => {
  [resumeService, jobService, analysisService].forEach((service) => Object.values(service).forEach((fn) => fn.mockReset()));
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('NewAnalysisPage steps', () => {
  it('lists resumes and only enables Next once one is chosen', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'r2', displayName: 'Other CV' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup();
    renderPage();
    await waitForStep(/choose a resume/i);
    expect(button(/^next$/i)).toBeDisabled();
    await user.click(radio(/Other CV/));
    expect(radio(/Other CV/)).toBeChecked();
    expect(button(/^next$/i)).toBeEnabled();
  });

  it('jumps straight to the confirmation when the link names a resume and a job', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'r2', displayName: 'Other CV' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    renderPage('/app/analyses/new?resumeId=r2&jobId=j1');
    await waitForStep(/confirm your selection/i);
    expect(screen.getByText('Other CV')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer at Acme')).toBeInTheDocument();
  });

  it('starts at the job step when the link only names a resume, and ignores unknown ids', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const { unmount } = renderPage('/app/analyses/new?resumeId=r1');
    await waitForStep(/choose a job description/i);
    unmount();

    renderPage('/app/analyses/new?resumeId=nope&jobId=nope');
    await waitForStep(/choose a resume/i);
    expect(button(/^next$/i)).toBeDisabled();
  });

  it('cannot select a resume that could not be read', async () => {
    resumeService.list.mockResolvedValue(listOf([resume(), resume({ id: 'bad', displayName: 'Broken', processingStatus: 'FAILED' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    renderPage();
    await waitForStep(/choose a resume/i);
    expect(radio(/Broken/)).toBeDisabled();
    expect(screen.getByText('Could not be read')).toBeInTheDocument();
    expect(radio(/My CV/)).toBeEnabled();
  });

  it('does not preselect a resume that could not be read even if the link names it', async () => {
    resumeService.list.mockResolvedValue(listOf([resume({ id: 'bad', displayName: 'Broken', processingStatus: 'FAILED' })]));
    jobService.list.mockResolvedValue(listOf([job()]));
    renderPage('/app/analyses/new?resumeId=bad&jobId=j1');
    await waitForStep(/choose a resume/i);
    expect(button(/^next$/i)).toBeDisabled();
  });

  it('explains the empty states', async () => {
    resumeService.list.mockResolvedValue(listOf([]));
    jobService.list.mockResolvedValue(listOf([]));
    renderPage();
    expect(await screen.findByText(/you have not uploaded a resume yet/i)).toBeInTheDocument();
    expect(button(/^next$/i)).toBeDisabled();
  });

  it('keeps the choices when going Back and forward', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup();
    renderPage();
    await goToJobStep(user);
    await user.click(radio(/Backend Engineer/));
    await user.click(button(/^back$/i));
    expect(radio(/My CV/)).toBeChecked();
    await user.click(button(/^next$/i));
    expect(radio(/Backend Engineer/)).toBeChecked();
  });

  it('asks the user to add a job when there are none saved', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([]));
    const user = userEvent.setup();
    renderPage();
    await goToJobStep(user);
    expect(screen.getByText(/you have not saved a job description yet/i)).toBeInTheDocument();
    expect(button(/^next$/i)).toBeDisabled();
  });
});

describe('NewAnalysisPage running an analysis', () => {
  it('confirms the choice, runs the analysis once and opens the report', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    analysisService.create.mockResolvedValue({ id: 'a9' });
    const user = userEvent.setup();
    renderPage();
    await goToJobStep(user);
    await user.click(radio(/Backend Engineer/));
    await user.click(button(/^next$/i));

    await waitForStep(/confirm your selection/i);
    expect(analysisService.create).not.toHaveBeenCalled(); // nothing runs until the user starts it
    await user.click(button(/start analysis/i));

    await waitFor(() => expect(analysisService.create).toHaveBeenCalledWith('r1', 'j1'));
    expect(analysisService.create).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Report page')).toBeInTheDocument();
  });

  it('shows the error and lets the user try again', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    analysisService.create.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ id: 'a2' });
    const user = userEvent.setup();
    renderPage('/app/analyses/new?resumeId=r1&jobId=j1');
    await user.click(await screen.findByRole('button', { name: /start analysis/i }));

    expect(await screen.findByText(/analysis could not be completed/i)).toBeInTheDocument();
    await user.click(button(/try again/i));
    expect(await screen.findByText('Report page')).toBeInTheDocument();
    expect(analysisService.create).toHaveBeenCalledTimes(2);
  });

  it('can go back from a failed run to change the selection', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    analysisService.create.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPage('/app/analyses/new?resumeId=r1&jobId=j1');
    await user.click(await screen.findByRole('button', { name: /start analysis/i }));
    await screen.findByText(/analysis could not be completed/i);
    await user.click(button(/^back$/i));
    expect(await waitForStep(/confirm your selection/i)).toBeInTheDocument();
  });

  it('shows a load error with a working retry', async () => {
    resumeService.list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your resumes/i);
    await user.click(button(/retry/i));
    await waitForStep(/choose a resume/i);
    expect(radio(/My CV/)).toBeInTheDocument();
  });
});

describe('NewAnalysisPage adding a job', () => {
  it('saves a pasted job description in a dialog and selects it', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValueOnce(listOf([])).mockResolvedValueOnce(listOf([job({ id: 'jNew', jobTitle: 'Data Analyst', companyName: '' })]));
    jobService.create.mockResolvedValue({ id: 'jNew' });
    const user = userEvent.setup();
    renderPage();
    await goToJobStep(user);

    await user.click(button('Add job description'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /job title/i }), 'Data Analyst');
    await user.click(within(dialog).getByRole('textbox', { name: /^job description/i }));
    await user.paste(DESCRIPTION);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(jobService.create).toHaveBeenCalledWith({ jobTitle: 'Data Analyst', companyName: '', description: DESCRIPTION }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(radio(/Data Analyst/)).toBeChecked()); // the new job is selected for the user
    expect(button(/^next$/i)).toBeEnabled();
  });
});

describe('NewAnalysisPage uploading a resume in the first step', () => {
  const pdf = (name = 'new.pdf') => new File(['%PDF-1.4 resume'], name, { type: 'application/pdf' });

  it('uploads a resume and selects it', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    resumeService.upload.mockResolvedValue(resume({ id: 'rNew', displayName: 'new', originalFileName: 'new.pdf' }));
    const user = userEvent.setup();
    renderPage();
    await waitForStep(/choose a resume/i);
    const file = pdf();
    await user.upload(screen.getByLabelText('Choose resume file'), file);

    await waitFor(() => expect(resumeService.upload).toHaveBeenCalledWith(file, 'new', expect.any(Function)));
    await waitFor(() => expect(radio(/^new/i)).toBeChecked());
    expect(mockNotify.success).toHaveBeenCalled();
    expect(button(/^next$/i)).toBeEnabled();
  });

  it('rejects an unsupported file without contacting the server', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup({ applyAccept: false }); // the browser would filter this; the code must too
    renderPage();
    await waitForStep(/choose a resume/i);
    await user.upload(screen.getByLabelText('Choose resume file'), new File(['notes'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
    expect(resumeService.upload).not.toHaveBeenCalled();
  });

  it('shows the error when the upload fails and selects nothing', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    resumeService.upload.mockRejectedValue(new Error('scanned'));
    const user = userEvent.setup();
    renderPage();
    await waitForStep(/choose a resume/i);
    await user.upload(screen.getByLabelText('Choose resume file'), pdf());
    expect(await screen.findByText(/could not upload this resume/i)).toBeInTheDocument();
    expect(button(/^next$/i)).toBeDisabled();
  });

  it('does not select an uploaded resume whose text could not be read', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    jobService.list.mockResolvedValue(listOf([job()]));
    resumeService.upload.mockResolvedValue(resume({ id: 'rBad', displayName: 'scan', processingStatus: 'FAILED' }));
    const user = userEvent.setup();
    renderPage();
    await waitForStep(/choose a resume/i);
    await user.upload(screen.getByLabelText('Choose resume file'), pdf('scan.pdf'));
    expect(await screen.findByText(/could not read text from this file/i)).toBeInTheDocument();
    expect(button(/^next$/i)).toBeDisabled();
  });
});
