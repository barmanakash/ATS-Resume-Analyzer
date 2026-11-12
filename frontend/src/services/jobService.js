import apiClient from './apiClient';

const jobService = {
  async list(page = 1, pageSize = 10) {
    const response = await apiClient.get('/jobs', { params: { page, pageSize } });
    return {
      items: response.data?.data || [],
      total: response.data?.meta?.total ?? 0,
      totalPages: response.data?.meta?.totalPages ?? 1,
    };
  },

  /** Full record including the whole description (the list only carries a short preview). */
  async get(id) {
    const response = await apiClient.get(`/jobs/${id}`);
    return response.data?.data;
  },

  async create({ jobTitle, companyName, description }) {
    const response = await apiClient.post('/jobs', { jobTitle, companyName, description });
    return response.data?.data;
  },

  async update(id, { jobTitle, companyName, description }) {
    const response = await apiClient.patch(`/jobs/${id}`, { jobTitle, companyName, description });
    return response.data?.data;
  },

  async remove(id) {
    await apiClient.delete(`/jobs/${id}`);
  },

  /** Reads text from a PDF, DOCX or TXT file so the form can be pre-filled. Nothing is saved by this call. */
  async extractText(file) {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post('/jobs/extract-text', form, { timeout: 120000 });
    return { text: response.data?.data?.text || '', truncated: Boolean(response.data?.data?.truncated) };
  },
};

export default jobService;
