import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExportButton from './ExportButton';
import exportService from '../../services/exportService';
import { saveBlob } from '../../utils/download';

const mockNotify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../../context/NotificationContext', () => ({ useNotification: () => mockNotify }));
jest.mock('../../services/exportService', () => ({ __esModule: true, default: { download: jest.fn() } }));
jest.mock('../../utils/download', () => ({ saveBlob: jest.fn() }));
// The real client imports axios, which Create React App's Jest cannot parse (ES modules).
jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {},
  getErrorMessage: (err, fallback) => err?.userMessage || fallback,
}));

const blob = { size: 1 };
const result = (overrides = {}) => ({ blob, filename: 'Jane_Doe_Resume.pdf', warnings: [], ...overrides });

const openDialog = async (user) => {
  await user.click(screen.getByRole('button', { name: /download/i }));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  exportService.download.mockReset();
  saveBlob.mockReset();
  Object.values(mockNotify).forEach((fn) => fn.mockReset());
});

describe('ExportButton', () => {
  it('downloads a classic A4 PDF by default and closes', async () => {
    exportService.download.mockResolvedValue(result());
    const user = userEvent.setup();
    render(<ExportButton versionId="v1" />);

    const dialog = await openDialog(user);
    expect(within(dialog).getByRole('radio', { name: /^PDF/ })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(exportService.download).toHaveBeenCalledWith('v1', { format: 'pdf', template: 'classic', pageSize: 'A4' }));
    expect(saveBlob).toHaveBeenCalledWith(blob, 'Jane_Doe_Resume.pdf');
    expect(mockNotify.success).toHaveBeenCalledWith('Downloaded Jane_Doe_Resume.pdf');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends the chosen file type, style and page size', async () => {
    exportService.download.mockResolvedValue(result({ filename: 'Jane_Doe_Resume.docx' }));
    const user = userEvent.setup();
    render(<ExportButton versionId="v1" />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('radio', { name: /Word \(DOCX\)/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Modern' }));
    await user.click(within(dialog).getByRole('button', { name: 'US Letter' }));
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(exportService.download).toHaveBeenCalledWith('v1', { format: 'docx', template: 'modern', pageSize: 'LETTER' }));
  });

  it('shows the server explanation and stays open when the download fails', async () => {
    exportService.download.mockRejectedValue(Object.assign(new Error('x'), { userMessage: 'This version has no content to export.' }));
    const user = userEvent.setup();
    render(<ExportButton versionId="v1" />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This version has no content to export.');
    expect(saveBlob).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Download' })).toBeEnabled(); // can try again
  });

  it('tells the person when a PDF could not show some characters and offers Word instead', async () => {
    exportService.download
      .mockResolvedValueOnce(result({ warnings: ['5 character(s) the PDF font cannot show were replaced with "?".'] }))
      .mockResolvedValueOnce(result({ filename: 'Jane_Doe_Resume.docx' }));
    const user = userEvent.setup();
    render(<ExportButton versionId="v1" />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/cannot show were replaced/);
    expect(saveBlob).toHaveBeenCalledTimes(1); // the PDF was still saved
    await user.click(within(dialog).getByRole('button', { name: /download word \(docx\) instead/i }));

    await waitFor(() => expect(exportService.download).toHaveBeenLastCalledWith('v1', { format: 'docx', template: 'classic', pageSize: 'A4' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('cannot be started twice while a file is being prepared', async () => {
    let finish;
    exportService.download.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<ExportButton versionId="v1" />);

    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: 'Download' }));

    const busyButton = await within(dialog).findByRole('button', { name: /preparing/i });
    expect(busyButton).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    finish(result());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(exportService.download).toHaveBeenCalledTimes(1);
  });

  it('can be disabled, for example while the resume has unsaved changes', () => {
    render(<ExportButton versionId="v1" disabled />);
    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
  });
});
