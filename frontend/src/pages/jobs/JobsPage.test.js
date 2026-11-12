import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import JobsPage from './JobsPage';
import jobService from '../../services/jobService';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/jobService', () => ({
  __esModule: true,
  default: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), extractText: jest.fn() },
}));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));

const DESCRIPTION = 'We need a backend engineer with 3 years of Python and MongoDB experience.';
const job = (overrides = {}) => ({
  id: 'j1', jobTitle: 'Backend Engineer', companyName: 'Acme', descriptionPreview: 'We need a backend engineer…',
  createdAt: '2026-11-01T10:00:00Z', ...overrides,
});
const listOf = (items) => ({ items, total: items.length, totalPages: 1 });

const renderPage = () => render(<MemoryRouter><JobsPage /></MemoryRouter>);
const descriptionBox = () => screen.getByRole('textbox', { name: /^job description/i });
const titleBox = () => screen.getByRole('textbox', { name: /job title/i });

async function fillForm(user, { title = 'Backend Engineer', company = 'Acme', description = DESCRIPTION } = {}) {
  if (title) await user.type(titleBox(), title);
  if (company) await user.type(screen.getByRole('textbox', { name: /company name/i }), company);
  if (description) {
    await user.click(descriptionBox());
    await user.paste(description);
  }
}

beforeEach(() => {
  Object.values(jobService).forEach((fn) => fn.mockReset());
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('JobsPage list', () => {
  it('lists saved jobs with an analyze link that carries the job id', async () => {
    jobService.list.mockResolvedValue(listOf([job()]));
    renderPage();
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText(/Acme · Saved/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analyze/i })).toHaveAttribute('href', '/app/analyses/new?jobId=j1');
  });

  it('shows an empty state', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    renderPage();
    expect(await screen.findByText(/no job descriptions yet/i)).toBeInTheDocument();
  });

  it('shows a load error and retries', async () => {
    jobService.list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(listOf([job()]));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your job descriptions/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
  });
});

describe('JobsPage create', () => {
  it('saves a new job and reloads the list', async () => {
    jobService.list.mockResolvedValueOnce(listOf([])).mockResolvedValueOnce(listOf([job()]));
    jobService.create.mockResolvedValue(job());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no job descriptions yet/i);

    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await screen.findByRole('dialog');
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(jobService.create).toHaveBeenCalledWith({
      jobTitle: 'Backend Engineer', companyName: 'Acme', description: DESCRIPTION,
    }));
    expect(mockNotify.success).toHaveBeenCalled();
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks saving and explains what is wrong when the form is incomplete', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no job descriptions yet/i);
    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await fillForm(user, { title: '', company: '', description: 'too short' });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/enter the job title/i)).toBeInTheDocument();
    expect(screen.getByText(/description is too short/i)).toBeInTheDocument();
    expect(jobService.create).not.toHaveBeenCalled();
  });

  it('keeps the form open with the server error when saving fails', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    jobService.create.mockRejectedValue(new Error('limit'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no job descriptions yet/i);
    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/could not save this job description/i)).toBeInTheDocument();
    expect(descriptionBox()).toHaveValue(DESCRIPTION); // nothing the user typed is lost
  });

  it('fills the description from an uploaded file', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    jobService.extractText.mockResolvedValue({ text: DESCRIPTION, truncated: false });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no job descriptions yet/i);
    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await screen.findByRole('dialog');

    const file = new File(['text'], 'jd.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText('Upload a job description file'), file);

    await waitFor(() => expect(descriptionBox()).toHaveValue(DESCRIPTION));
    expect(jobService.extractText).toHaveBeenCalledWith(file);
  });

  it('warns when an uploaded document had to be shortened', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    jobService.extractText.mockResolvedValue({ text: DESCRIPTION, truncated: true });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no job descriptions yet/i);
    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await user.upload(screen.getByLabelText('Upload a job description file'), new File(['x'], 'jd.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/was shortened/i)).toBeInTheDocument();
  });

  it('shows an error when a file cannot be read and keeps existing text', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    jobService.extractText.mockRejectedValue(new Error('bad'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no job descriptions yet/i);
    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await user.click(descriptionBox());
    await user.paste(DESCRIPTION);
    await user.upload(screen.getByLabelText('Upload a job description file'), new File(['x'], 'jd.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/could not read this file/i)).toBeInTheDocument();
    expect(descriptionBox()).toHaveValue(DESCRIPTION);
  });

  it('rejects an unsupported file type without calling the server', async () => {
    jobService.list.mockResolvedValue(listOf([]));
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await screen.findByText(/no job descriptions yet/i);
    await user.click(screen.getByRole('button', { name: 'Add job description' }));
    await user.upload(screen.getByLabelText('Upload a job description file'), new File(['x'], 'jd.png', { type: 'image/png' }));
    expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
    expect(jobService.extractText).not.toHaveBeenCalled();
  });
});

describe('JobsPage edit and delete', () => {
  it('loads the full description when editing and saves changes', async () => {
    jobService.list.mockResolvedValue(listOf([job()]));
    jobService.get.mockResolvedValue({ ...job(), description: DESCRIPTION });
    jobService.update.mockResolvedValue(job());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Backend Engineer' }));

    await waitFor(() => expect(descriptionBox()).toHaveValue(DESCRIPTION));
    expect(jobService.get).toHaveBeenCalledWith('j1');
    await user.clear(titleBox());
    await user.type(titleBox(), 'Senior Backend Engineer');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(jobService.update).toHaveBeenCalledWith('j1', {
      jobTitle: 'Senior Backend Engineer', companyName: 'Acme', description: DESCRIPTION,
    }));
  });

  it('shows a retryable error if the full job cannot be loaded', async () => {
    jobService.list.mockResolvedValue(listOf([job()]));
    jobService.get.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ ...job(), description: DESCRIPTION });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Backend Engineer' }));
    expect(await screen.findByText(/could not load this job description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(descriptionBox()).toHaveValue(DESCRIPTION));
  });

  it('asks before deleting and says analyses are kept', async () => {
    jobService.list.mockResolvedValueOnce(listOf([job()])).mockResolvedValueOnce(listOf([]));
    jobService.remove.mockResolvedValue();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Backend Engineer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/analyses already created with it are kept/i)).toBeInTheDocument();
    expect(jobService.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(jobService.remove).toHaveBeenCalledWith('j1'));
    expect(await screen.findByText(/no job descriptions yet/i)).toBeInTheDocument();
  });

  it('cancelling the delete dialog deletes nothing', async () => {
    jobService.list.mockResolvedValue(listOf([job()]));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete Backend Engineer' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(jobService.remove).not.toHaveBeenCalled();
  });
});
