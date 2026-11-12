import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResumesPage from './ResumesPage';
import resumeService from '../../services/resumeService';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/resumeService', () => ({
  __esModule: true,
  default: { list: jest.fn(), upload: jest.fn(), get: jest.fn(), rename: jest.fn(), remove: jest.fn(), download: jest.fn() },
}));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));

const resume = (overrides = {}) => ({
  id: 'r1', displayName: 'My CV', originalFileName: 'cv.pdf', fileType: 'pdf', fileSize: 2048,
  processingStatus: 'COMPLETED', createdAt: '2026-11-01T10:00:00Z', ...overrides,
});
const listOf = (items) => ({ items, total: items.length, totalPages: 1 });

const renderPage = () => render(<MemoryRouter><ResumesPage /></MemoryRouter>);
const chooseFile = (user, file) => user.upload(screen.getByLabelText('Choose resume file'), file);

beforeEach(() => {
  Object.values(resumeService).forEach((fn) => fn.mockReset());
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('ResumesPage', () => {
  it('lists resumes with an analyze link that carries the resume id', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    renderPage();
    expect(await screen.findByText('My CV')).toBeInTheDocument();
    expect(screen.getByText(/cv\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analyze/i })).toHaveAttribute('href', '/app/analyses/new?resumeId=r1');
  });

  it('shows an empty state when there are no resumes', async () => {
    resumeService.list.mockResolvedValue(listOf([]));
    renderPage();
    expect(await screen.findByText(/no resumes yet/i)).toBeInTheDocument();
  });

  it('shows a load error and retries', async () => {
    resumeService.list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(listOf([resume()]));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your resumes/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('My CV')).toBeInTheDocument();
  });

  it('rejects an unsupported file without calling the server', async () => {
    resumeService.list.mockResolvedValue(listOf([]));
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await screen.findByText(/no resumes yet/i);
    await chooseFile(user, new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText(/unsupported file type/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload resume/i })).not.toBeInTheDocument();
    expect(resumeService.upload).not.toHaveBeenCalled();
  });

  it('uploads a valid file with a default name, then reloads the list', async () => {
    resumeService.list.mockResolvedValueOnce(listOf([])).mockResolvedValueOnce(listOf([resume({ displayName: 'cv' })]));
    resumeService.upload.mockResolvedValue(resume());
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no resumes yet/i);

    const file = new File(['%PDF-1.4'], 'cv.pdf', { type: 'application/pdf' });
    await chooseFile(user, file);
    expect(screen.getByLabelText(/resume name/i)).toHaveValue('cv');
    await user.click(screen.getByRole('button', { name: /upload resume/i }));

    await waitFor(() => expect(resumeService.upload).toHaveBeenCalledWith(file, 'cv', expect.any(Function)));
    await waitFor(() => expect(mockNotify.success).toHaveBeenCalled());
    expect(await screen.findByText('cv')).toBeInTheDocument();
    expect(resumeService.list).toHaveBeenCalledTimes(2);
  });

  it('keeps the chosen file and shows the error when the upload fails', async () => {
    resumeService.list.mockResolvedValue(listOf([]));
    resumeService.upload.mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no resumes yet/i);
    await chooseFile(user, new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /upload resume/i }));
    expect(await screen.findByText(/upload failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload resume/i })).toBeEnabled(); // can retry
  });

  it('renames a resume', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    resumeService.rename.mockResolvedValue(resume({ displayName: 'Backend CV' }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Rename My CV' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText(/resume name/i);
    await user.clear(input);
    await user.type(input, 'Backend CV');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(resumeService.rename).toHaveBeenCalledWith('r1', 'Backend CV'));
  });

  it('does not rename to an empty name', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Rename My CV' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText(/resume name/i));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/enter a name/i)).toBeInTheDocument();
    expect(resumeService.rename).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting, and warns about derived data', async () => {
    resumeService.list.mockResolvedValueOnce(listOf([resume()])).mockResolvedValueOnce(listOf([]));
    resumeService.remove.mockResolvedValue();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete My CV' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/every analysis and\s+optimized version/i)).toBeInTheDocument();
    expect(resumeService.remove).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(resumeService.remove).toHaveBeenCalledWith('r1'));
    expect(await screen.findByText(/no resumes yet/i)).toBeInTheDocument();
  });

  it('cancelling the delete dialog deletes nothing', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Delete My CV' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(resumeService.remove).not.toHaveBeenCalled();
  });

  it('shows extracted details in the view dialog', async () => {
    resumeService.list.mockResolvedValue(listOf([resume()]));
    resumeService.get.mockResolvedValue(resume({
      parsedText: 'Jane Doe\nPython developer',
      parsedData: { email: 'jane@example.com', phone: null, pageCount: 1, wordCount: 4, sectionsDetected: ['skills'] },
    }));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'View My CV' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('jane@example.com')).toBeInTheDocument();
    expect(within(dialog).getByText('Skills')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Extracted resume text')).toHaveTextContent('Python developer');
    expect(within(dialog).getByText('Not found')).toBeInTheDocument(); // phone was null: shown honestly
  });
});
