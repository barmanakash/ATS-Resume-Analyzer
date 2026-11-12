import apiClient from './apiClient';

const analysisService = {
  /** Runs an analysis of one saved resume against one saved job description and returns the full report. */
  async create(resumeId, jobDescriptionId) {
    const response = await apiClient.post('/analyses', { resumeId, jobDescriptionId });
    return response.data?.data;
  },

  async get(id) {
    const response = await apiClient.get(`/analyses/${id}/report`);
    return response.data?.data;
  },

  async list(page = 1, pageSize = 10) {
    const response = await apiClient.get('/analyses', { params: { page, pageSize } });
    return {
      items: response.data?.data || [],
      total: response.data?.meta?.total ?? 0,
      totalPages: response.data?.meta?.totalPages ?? 1,
    };
  },

  async remove(id) {
    await apiClient.delete(`/analyses/${id}`);
  },
};

export default analysisService;
