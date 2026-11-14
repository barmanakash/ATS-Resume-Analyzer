import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AnalysisHistoryPage from './AnalysisHistoryPage';
import analysisService from '../../services/analysisService';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/analysisService', () => ({ __esModule: true, default: { list: jest.fn(), remove: jest.fn() } }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({ __esModule: true, default: {}, getErrorMessage: (_err, fallback) => fallback }));

const item = (overrides = {}) => ({
  id: 'a1',
  jobTitle: 'Backend Engineer',
  companyName: 'Acme',
  resumeName: 'My CV',
  status: 'COMPLETED',
  engineVersion: '1.0',
  overallScore: 82,
  recommendation: 'READY_TO_APPLY',
  mandatoryGapCount: 0,
  createdAt: '2026-11-10T10:00:00Z',
  completedAt: '2026-11-10T10:00:05Z',
  ...overrides,
});
const listOf = (items, extra = {}) => ({ items, total: items.length, totalPages: 1, ...extra });

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

const renderPage = (url = '/app/history') => render(
  <MemoryRouter initialEntries={[url]}>
    <LocationProbe />
    <Routes>
      <Route path="/app/history" element={<AnalysisHistoryPage />} />
      <Route path="/app/analyses/new" element={<div>New analysis page</div>} />
      <Route path="/app/analyses/:analysisId" element={<div>Report page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  analysisService.list.mockReset();
  analysisService.remove.mockReset();
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('AnalysisHistoryPage', () => {
  it('lists previous analyses with job, resume, score, recommendation and date', async () => {
    analysisService.list.mockResolvedValue(listOf([
      item(),
      item({ id: 'a2', jobTitle: 'Data Analyst', companyName: '', resumeName: 'Other CV', overallScore: 41, recommendation: 'LOW_COMPATIBILITY', mandatoryGapCount: 3 }),
    ]));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
    expect(screen.getByText(/Acme · My CV/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Score 82 out of 100' })).toBeInTheDocument();
    expect(screen.getByText('Ready to apply')).toBeInTheDocument();
    expect(screen.getByText('No required items missing')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Data Analyst' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Score 41 out of 100' })).toBeInTheDocument();
    expect(screen.getByText('Low compatibility')).toBeInTheDocument();
    expect(screen.getByText('3 required items not found')).toBeInTheDocument();
    expect(screen.getByText('Showing 1\u20132 of 2')).toBeInTheDocument();
    expect(analysisService.list).toHaveBeenCalledWith(1, 10);
  });

  it('links each finished analysis to its report', async () => {
    analysisService.list.mockResolvedValue(listOf([item()]));
    const user = userEvent.setup();
    renderPage();
    const link = await screen.findByRole('link', { name: 'View report for Backend Engineer' });
    expect(link).toHaveAttribute('href', '/app/analyses/a1');
    await user.click(link);
    expect(await screen.findByText('Report page')).toBeInTheDocument();
  });

  it('explains rows that have no report instead of linking to a broken page', async () => {
    analysisService.list.mockResolvedValue(listOf([
      item({ id: 'old', jobTitle: 'Old job', engineVersion: undefined, recommendation: undefined, mandatoryGapCount: undefined }),
      item({ id: 'bad', jobTitle: 'Failed job', status: 'FAILED', overallScore: null, errorMessage: 'The analysis could not be completed.' }),
      item({ id: 'run', jobTitle: 'Running job', status: 'PROCESSING', overallScore: null }),
    ]));
    renderPage();
    await screen.findByText('Old job');

    ['Old job', 'Failed job', 'Running job'].forEach((title) => {
      expect(screen.getByRole('button', { name: `View report for ${title}` })).toBeDisabled();
      expect(screen.queryByRole('link', { name: `View report for ${title}` })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/older version of the scoring engine/i)).toBeInTheDocument();
    expect(screen.getByText('The analysis could not be completed.')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'No score' })).toHaveLength(2); // failed and running
    expect(screen.getByRole('img', { name: 'Score 82 out of 100' })).toBeInTheDocument(); // legacy keeps its score
  });

  it('shows an empty state that starts a new analysis', async () => {
    analysisService.list.mockResolvedValue(listOf([]));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('No analyses yet')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /start your first analysis/i }));
    expect(await screen.findByText('New analysis page')).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    analysisService.list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(listOf([item()]));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your analysis history/i);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
  });

  describe('deleting', () => {
    it('deletes only after confirmation, then reloads the list', async () => {
      analysisService.list
        .mockResolvedValueOnce(listOf([item(), item({ id: 'a2', jobTitle: 'Data Analyst' })]))
        .mockResolvedValueOnce(listOf([item({ id: 'a2', jobTitle: 'Data Analyst' })]));
      analysisService.remove.mockResolvedValue();
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Delete analysis of Backend Engineer' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/"Backend Engineer"/)).toBeInTheDocument();
      expect(analysisService.remove).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(analysisService.remove).toHaveBeenCalledWith('a1'));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Backend Engineer' })).not.toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'Data Analyst' })).toBeInTheDocument();
      expect(mockNotify.success).toHaveBeenCalledWith('Analysis deleted.');
    });

    it('does nothing when the confirmation is cancelled', async () => {
      analysisService.list.mockResolvedValue(listOf([item()]));
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Delete analysis of Backend Engineer' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
      expect(analysisService.remove).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
    });

    it('reports a failed delete and keeps the row', async () => {
      analysisService.list.mockResolvedValue(listOf([item()]));
      analysisService.remove.mockRejectedValue(new Error('nope'));
      const user = userEvent.setup();
      renderPage();
      await user.click(await screen.findByRole('button', { name: 'Delete analysis of Backend Engineer' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(mockNotify.error).toHaveBeenCalledWith('Could not delete this analysis. Please try again.'));
      expect(screen.getByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
    });

    it('steps back a page when the only item on the last page is deleted', async () => {
      analysisService.list
        .mockResolvedValueOnce(listOf([item({ id: 'last', jobTitle: 'Only on page 2' })], { total: 11, totalPages: 2 }))
        .mockResolvedValueOnce(listOf([item()], { total: 10, totalPages: 1 }));
      analysisService.remove.mockResolvedValue();
      const user = userEvent.setup();
      renderPage('/app/history?page=2');

      await user.click(await screen.findByRole('button', { name: 'Delete analysis of Only on page 2' }));
      await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(analysisService.list).toHaveBeenLastCalledWith(1, 10));
      expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
    });
  });

  describe('paging', () => {
    it('reads the page from the URL', async () => {
      analysisService.list.mockResolvedValue(listOf([item()], { total: 11, totalPages: 2 }));
      renderPage('/app/history?page=2');
      await screen.findByRole('heading', { name: 'Backend Engineer' });
      expect(analysisService.list).toHaveBeenCalledWith(2, 10);
      expect(screen.getByText('Showing 11\u201311 of 11')).toBeInTheDocument();
    });

    it('moves to another page and keeps it in the URL', async () => {
      analysisService.list.mockResolvedValue(listOf([item()], { total: 15, totalPages: 2 }));
      const user = userEvent.setup();
      renderPage();
      await screen.findByRole('heading', { name: 'Backend Engineer' });
      await user.click(screen.getByRole('button', { name: /go to page 2/i }));
      await waitFor(() => expect(analysisService.list).toHaveBeenLastCalledWith(2, 10));
      expect(screen.getByTestId('search')).toHaveTextContent('?page=2');
    });

    it('treats an invalid page as page 1', async () => {
      analysisService.list.mockResolvedValue(listOf([item()]));
      renderPage('/app/history?page=abc');
      await screen.findByRole('heading', { name: 'Backend Engineer' });
      expect(analysisService.list).toHaveBeenCalledWith(1, 10);
    });

    it('moves to the last page when the requested page is past the end', async () => {
      analysisService.list
        .mockResolvedValueOnce({ items: [], total: 4, totalPages: 1 })
        .mockResolvedValueOnce(listOf([item()], { total: 4, totalPages: 1 }));
      renderPage('/app/history?page=9');
      await waitFor(() => expect(analysisService.list).toHaveBeenLastCalledWith(1, 10));
      expect(await screen.findByRole('heading', { name: 'Backend Engineer' })).toBeInTheDocument();
    });
  });
});
