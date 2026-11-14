import apiClient from './apiClient';

const userService = {
  /** Returns the updated user. */
  async updateProfile(fullName) {
    const response = await apiClient.patch('/users/me', { fullName });
    return response.data?.data;
  },

  /**
   * Changes the password. The server signs out every other device and returns a fresh access token
   * for this one, which the caller must install so this session keeps working.
   */
  async changePassword(currentPassword, newPassword) {
    const response = await apiClient.post('/users/me/change-password', { currentPassword, newPassword });
    return response.data?.data;
  },

  /** Deletes all resumes, job descriptions, analyses and versions. The account stays. */
  async deleteData(password) {
    await apiClient.delete('/users/me/data', { data: { password } });
  },

  /** Deletes the account and everything in it. */
  async deleteAccount(password) {
    await apiClient.delete('/users/me', { data: { password } });
  },
};

export default userService;
