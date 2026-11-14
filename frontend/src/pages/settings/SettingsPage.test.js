import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import userService from '../../services/userService';
import { setAccessToken } from '../../services/apiClient';

const mockSetUser = jest.fn();
const mockLogout = jest.fn();
const mockSuccess = jest.fn();
const mockInfo = jest.fn();
const mockUser = {
  id: 'u1',
  fullName: 'Alice Smith',
  email: 'alice@example.com',
  isEmailVerified: true,
  createdAt: '2026-01-15T10:00:00Z',
};

jest.mock('../../services/userService', () => ({
  __esModule: true,
  default: { updateProfile: jest.fn(), changePassword: jest.fn(), deleteData: jest.fn(), deleteAccount: jest.fn() },
}));
jest.mock('../../services/apiClient', () => ({
  __esModule: true,
  default: {},
  setAccessToken: jest.fn(),
  getErrorMessage: (err, fallback) => err?.message || fallback,
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, setUser: mockSetUser, logout: mockLogout }),
}));
jest.mock('../../context/NotificationContext', () => ({
  useNotification: () => ({ success: mockSuccess, info: mockInfo, error: jest.fn(), notify: jest.fn() }),
}));

const renderPage = (url = '/app/settings') => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/app/settings" element={<SettingsPage />} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>
  </MemoryRouter>,
);

const apiError = (message, code) => Object.assign(new Error(message), { response: { data: { error: { code, message } } } });

describe('SettingsPage tabs', () => {
  it('opens on the profile tab by default', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  });

  it('opens the tab named in the URL', () => {
    renderPage('/app/settings?tab=password');
    expect(screen.getByRole('tab', { name: 'Password' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
  });

  it('falls back to the profile tab for an unknown tab', () => {
    renderPage('/app/settings?tab=nonsense');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switches tabs when a tab is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Privacy & data' }));
    expect(screen.getByRole('tab', { name: 'Privacy & data' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /delete all my data/i })).toBeInTheDocument();
  });
});

describe('Profile', () => {
  it('shows the account details, with the email read-only', () => {
    renderPage();
    expect(screen.getByLabelText('Full name')).toHaveValue('Alice Smith');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Email')).toHaveValue('alice@example.com');
    expect(screen.getByText('Email verified')).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });

  it('only enables Save once the name has changed, then saves and updates the session user', async () => {
    const updated = { ...mockUser, fullName: 'Alice Jones' };
    userService.updateProfile.mockResolvedValue(updated);
    const user = userEvent.setup();
    renderPage();
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), '  Alice Jones  ');
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(userService.updateProfile).toHaveBeenCalledWith('Alice Jones')); // trimmed
    expect(mockSetUser).toHaveBeenCalledWith(updated);
    expect(mockSuccess).toHaveBeenCalledWith('Profile updated.');
  });

  it('rejects a too-short name without calling the server', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'A');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument();
    expect(userService.updateProfile).not.toHaveBeenCalled();
  });

  it('shows the server error when saving fails', async () => {
    userService.updateProfile.mockRejectedValue(new Error('Server is down'));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Full name'), ' Jr');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server is down');
    expect(mockSetUser).not.toHaveBeenCalled();
  });
});

describe('Password', () => {
  const fill = async (user, { current = 'OldPassw0rd', next = 'NewPassw0rd', confirm = 'NewPassw0rd' } = {}) => {
    await user.type(screen.getByLabelText('Current password'), current);
    await user.type(screen.getByLabelText('New password'), next);
    await user.type(screen.getByLabelText('Confirm new password'), confirm);
    await user.click(screen.getByRole('button', { name: /update password/i }));
  };

  it('changes the password, installs the new access token and clears the form', async () => {
    userService.changePassword.mockResolvedValue({ accessToken: 'fresh-token' });
    const user = userEvent.setup();
    renderPage('/app/settings?tab=password');
    await fill(user);

    await waitFor(() => expect(userService.changePassword).toHaveBeenCalledWith('OldPassw0rd', 'NewPassw0rd'));
    expect(setAccessToken).toHaveBeenCalledWith('fresh-token'); // otherwise this session would be logged out
    expect(mockSuccess).toHaveBeenCalledWith('Password updated. Other devices have been signed out.');
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it.each([
    ['the confirmation does not match', { confirm: 'Different1' }, 'Passwords do not match'],
    ['the new password is weak', { next: 'alllowercase1', confirm: 'alllowercase1' }, 'Include an uppercase letter'],
    ['the new password equals the current one', { current: 'SamePassw0rd', next: 'SamePassw0rd', confirm: 'SamePassw0rd' },
      'Choose a password that is different from your current one'],
  ])('does not call the server when %s', async (_, values, message) => {
    const user = userEvent.setup();
    renderPage('/app/settings?tab=password');
    await fill(user, values);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(userService.changePassword).not.toHaveBeenCalled();
  });

  it('shows a wrong current password next to that field', async () => {
    userService.changePassword.mockRejectedValue(apiError('Your current password is incorrect.', 'INVALID_CURRENT_PASSWORD'));
    const user = userEvent.setup();
    renderPage('/app/settings?tab=password');
    await fill(user);

    expect(await screen.findByText('Your current password is incorrect.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInvalid();
    expect(setAccessToken).not.toHaveBeenCalled();
  });

  it('shows other server errors in an alert', async () => {
    userService.changePassword.mockRejectedValue(apiError('Too many attempts. Try again later.', 'RATE_LIMITED'));
    const user = userEvent.setup();
    renderPage('/app/settings?tab=password');
    await fill(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });
});

describe('Privacy and data', () => {
  const openDialog = async (user) => {
    renderPage('/app/settings?tab=privacy');
    await user.click(screen.getByRole('button', { name: /delete all my data/i }));
    return screen.getByRole('dialog');
  };

  it('explains what is stored', () => {
    renderPage('/app/settings?tab=privacy');
    expect(screen.getByText('Resumes')).toBeInTheDocument();
    expect(screen.getByText('Job descriptions')).toBeInTheDocument();
    expect(screen.getByText('Analysis reports')).toBeInTheDocument();
  });

  it('requires the password before the delete button is enabled', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    const confirm = within(dialog).getByRole('button', { name: /delete all my data/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Your password'), 'MyPassw0rd');
    expect(confirm).toBeEnabled();
  });

  it('deletes the data and closes the dialog', async () => {
    userService.deleteData.mockResolvedValue();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Your password'), 'MyPassw0rd');
    await user.click(within(dialog).getByRole('button', { name: /delete all my data/i }));

    await waitFor(() => expect(userService.deleteData).toHaveBeenCalledWith('MyPassw0rd'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockSuccess).toHaveBeenCalledWith('All your resumes, job descriptions and analyses have been deleted.');
  });

  it('keeps the dialog open and shows the error when the password is wrong', async () => {
    userService.deleteData.mockRejectedValue(apiError('The password you entered is incorrect.', 'INVALID_PASSWORD'));
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText('Your password'), 'wrong');
    await user.click(within(dialog).getByRole('button', { name: /delete all my data/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('password you entered is incorrect');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it('can be cancelled without deleting anything', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(userService.deleteData).not.toHaveBeenCalled();
  });
});

describe('Delete account', () => {
  const openDialog = async (user) => {
    renderPage('/app/settings?tab=danger');
    await user.click(screen.getByRole('button', { name: /delete my account/i }));
    return screen.getByRole('dialog');
  };

  it('needs the exact word and the password before it can be confirmed', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    const confirm = within(dialog).getByRole('button', { name: /delete my account/i });
    await user.type(within(dialog).getByLabelText('Your password'), 'MyPassw0rd');
    expect(confirm).toBeDisabled(); // password alone is not enough

    await user.type(within(dialog).getByLabelText(/type delete to confirm/i), 'delete');
    expect(confirm).toBeDisabled(); // the word is case-sensitive

    await user.clear(within(dialog).getByLabelText(/type delete to confirm/i));
    await user.type(within(dialog).getByLabelText(/type delete to confirm/i), 'DELETE');
    expect(confirm).toBeEnabled();
  });

  it('deletes the account, signs out and returns to the home page', async () => {
    userService.deleteAccount.mockResolvedValue();
    mockLogout.mockResolvedValue();
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/type delete to confirm/i), 'DELETE');
    await user.type(within(dialog).getByLabelText('Your password'), 'MyPassw0rd');
    await user.click(within(dialog).getByRole('button', { name: /delete my account/i }));

    await waitFor(() => expect(userService.deleteAccount).toHaveBeenCalledWith('MyPassw0rd'));
    expect(mockLogout).toHaveBeenCalled();
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(mockInfo).toHaveBeenCalledWith('Your account has been deleted.');
  });

  it('stays signed in and shows the error when the password is wrong', async () => {
    userService.deleteAccount.mockRejectedValue(apiError('The password you entered is incorrect.', 'INVALID_PASSWORD'));
    const user = userEvent.setup();
    const dialog = await openDialog(user);
    await user.type(within(dialog).getByLabelText(/type delete to confirm/i), 'DELETE');
    await user.type(within(dialog).getByLabelText('Your password'), 'wrong');
    await user.click(within(dialog).getByRole('button', { name: /delete my account/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('password you entered is incorrect');
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.queryByText('Home page')).not.toBeInTheDocument();
  });
});
