import apiClient from './apiClient';

const optimizerService = {
  /** Creates an optimized copy of the resume for an analysis. mode: 'auto' | 'rules' | 'ai'. The original is never changed. */
  async optimize(analysisId, mode = 'auto') {
    const response = await apiClient.post(`/analyses/${analysisId}/optimize`, { mode }, { timeout: 120000 });
    return response.data?.data;
  },

  async get(versionId) {
    const response = await apiClient.get(`/versions/${versionId}`);
    return response.data?.data;
  },

  /** Saves a new name and/or the edited resume content. Returns the whole version. */
  async save(versionId, changes) {
    const response = await apiClient.patch(`/versions/${versionId}`, changes);
    return response.data?.data;
  },

  /** status: 'ACCEPTED' | 'REJECTED' | 'PENDING'. Returns the whole version with its suggestions. */
  async setSuggestionStatus(suggestionId, status) {
    const response = await apiClient.patch(`/suggestions/${suggestionId}`, { status });
    return response.data?.data;
  },

  /** source: 'original' or the id of a history entry. */
  async restore(versionId, source) {
    const response = await apiClient.post(`/versions/${versionId}/restore`, { source });
    return response.data?.data;
  },

  async remove(versionId) {
    await apiClient.delete(`/versions/${versionId}`);
  },

  /** Downloads the saved version as a text file. It is fetched with the auth header, never from a public URL. */
  async downloadText(version) {
    const response = await apiClient.get('/exports/resume', {
      params: { resumeId: version.resumeId, versionId: version.id, format: 'txt' },
      responseType: 'blob',
      timeout: 60000,
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(version.name || 'resume').replace(/[^\w.-]+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export default optimizerService;
