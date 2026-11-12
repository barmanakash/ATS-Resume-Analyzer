import apiClient from './apiClient';

const resumeService = {
  async list(page = 1, pageSize = 10) {
    const response = await apiClient.get('/resumes', { params: { page, pageSize } });
    return {
      items: response.data?.data || [],
      total: response.data?.meta?.total ?? 0,
      totalPages: response.data?.meta?.totalPages ?? 1,
    };
  },

  /** Uploads one file. `onProgress` receives 0-100 for the network transfer only (server processing follows). */
  async upload(file, displayName, onProgress) {
    const form = new FormData();
    form.append('file', file);
    if (displayName) form.append('displayName', displayName);
    const response = await apiClient.post('/resumes', form, {
      timeout: 120000, // scanned PDFs go through OCR, which can take longer than the default timeout
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded * 100) / event.total));
      },
    });
    return response.data?.data;
  },

  /** Full record including extracted text and basic parsed information. */
  async get(id) {
    const response = await apiClient.get(`/resumes/${id}`);
    return response.data?.data;
  },

  async rename(id, displayName) {
    const response = await apiClient.patch(`/resumes/${id}`, { displayName });
    return response.data?.data;
  },

  async remove(id) {
    await apiClient.delete(`/resumes/${id}`);
  },

  /** Downloads the original file. It is fetched with the auth header, never from a public URL. */
  async download(id, fileName) {
    const response = await apiClient.get(`/resumes/${id}/file`, { responseType: 'blob', timeout: 60000 });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'resume';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export default resumeService;
