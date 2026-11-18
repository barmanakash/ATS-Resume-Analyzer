import apiClient from './apiClient';
import { filenameFromDisposition } from '../utils/download';

export const EXPORT_FORMATS = ['pdf', 'docx'];

const exportService = {
  /**
   * Generates a resume file on the server. Resolves to { blob, filename, warnings }.
   * `warnings` is non-empty when the PDF font could not draw some characters.
   */
  async download(versionId, { format = 'pdf', template = 'classic', pageSize = 'A4' } = {}) {
    try {
      const response = await apiClient.post(
        `/versions/${versionId}/export`,
        { format, template, pageSize },
        { responseType: 'blob', timeout: 60000 },
      );
      const warning = response.headers?.['x-export-warnings'];
      return {
        blob: response.data,
        filename: filenameFromDisposition(response.headers?.['content-disposition'], `Resume.${format}`),
        warnings: warning ? [warning] : [],
      };
    } catch (error) {
      // With responseType "blob" an error message arrives as a Blob too. Turn it back into JSON so
      // getErrorMessage can show the server's explanation.
      const data = error?.response?.data;
      if (typeof Blob !== 'undefined' && data instanceof Blob && typeof data.text === 'function') {
        try {
          error.response.data = JSON.parse(await data.text());
        } catch {
          // keep the original error
        }
      }
      throw error;
    }
  },
};

export default exportService;
