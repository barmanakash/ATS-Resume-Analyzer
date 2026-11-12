import apiClient from './apiClient';

const analysisService = {
  async list(page = 1, pageSize = 10) {
    const response = await apiClient.get('/analyses', { params: { page, pageSize } });
    return {
      items: response.data?.data || [],
      total: response.data?.meta?.total ?? 0,
      totalPages: response.data?.meta?.totalPages ?? 1,
    };
  },

  /** Runs an analysis. The finished report comes back in the same response. */
  async create(resumeId, jobDescriptionId) {
    const response = await apiClient.post('/analyses', { resumeId, jobDescriptionId }, { timeout: 60000 });
    return response.data?.data;
  },

  /** The full report: scores, requirement results with evidence, gaps and recommendations. */
  async getReport(id) {
    const response = await apiClient.get(`/analyses/${id}/report`);
    return response.data?.data;
  },

  async remove(id) {
    await apiClient.delete(`/analyses/${id}`);
  },
};

export default analysisService;
