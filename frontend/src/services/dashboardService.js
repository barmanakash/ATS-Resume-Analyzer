import apiClient from './apiClient';

/** Fetches the lists the dashboard needs. Totals come from pagination `meta.total`. */
const dashboardService = {
  async getOverview() {
    const [resumes, analyses] = await Promise.all([
      apiClient.get('/resumes', { params: { page: 1, pageSize: 5 } }).then((r) => r.data),
      apiClient.get('/analyses', { params: { page: 1, pageSize: 5 } }).then((r) => r.data),
    ]);
    return {
      resumes: resumes.data || [],
      resumesTotal: resumes.meta?.total ?? (resumes.data || []).length,
      analyses: analyses.data || [],
      analysesTotal: analyses.meta?.total ?? (analyses.data || []).length,
    };
  },
};

export default dashboardService;
