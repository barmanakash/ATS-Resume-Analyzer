import apiClient from './apiClient';

/**
 * Fetches everything the dashboard shows in one request from GET /dashboard/summary.
 * Totals, the average score and usage are computed on the server over all of the user's data,
 * not just the few recent rows that are displayed.
 */
const dashboardService = {
  async getOverview() {
    const response = await apiClient.get('/dashboard/summary');
    const data = response.data?.data || {};
    return {
      totalResumes: data.totalResumes ?? 0,
      totalJobDescriptions: data.totalJobDescriptions ?? 0,
      totalAnalyses: data.totalAnalyses ?? 0,
      averageCompatibilityScore: typeof data.averageCompatibilityScore === 'number' ? data.averageCompatibilityScore : null,
      recentResumes: data.recentResumes || [],
      recentAnalyses: data.recentAnalyses || [],
      scoreTrend: data.scoreTrend || [],
      usage: {
        analysesThisMonth: data.usage?.analysesThisMonth ?? 0,
        resumes: data.usage?.resumes || { used: data.totalResumes ?? 0, limit: null },
        jobDescriptions: data.usage?.jobDescriptions || { used: data.totalJobDescriptions ?? 0, limit: null },
      },
    };
  },
};

export default dashboardService;
