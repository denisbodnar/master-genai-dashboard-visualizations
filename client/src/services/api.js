import axios from 'axios';

/**
 * Service for communicating with the GenAI-Viz backend.
 * Uses relative paths; Vite proxies /api to the Express server.
 */

export const api = {
  /**
   * Sends a CSV file and parameters to generate a D3 chart.
   *
   * @param {File}        file      - CSV file.
   * @param {string}      provider  - 'openai', 'ollama'.
   * @param {string}      mode      - 'zero-shot', 'few-shot', or 'cot'.
   * @param {string|null} chartType - Optional override (e.g. 'bar', 'line'). null = auto.
   * @returns {Promise<Object>} Orchestrator response.
   */
  async generateChart(file, provider = 'none', mode = 'zero-shot', chartType = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (chartType) {
      formData.append('chartType', chartType);
    }

    const url = `/api/generate?provider=${provider}&mode=${mode}`;

    try {
      const response = await axios.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error || `Server Error: ${error.response.status}`);
      }
      throw error;
    }
  },

  /**
   * Requests an automatic chart type recommendation for a CSV file.
   *
   * @param {File}   file     - CSV file.
   * @param {string} provider - 'openai', 'ollama', or 'none' (rule-based).
   * @returns {Promise<{chartType: string, recommendation: object}>}
   */
  async selectChart(file, provider = 'none') {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`/api/select-chart?provider=${provider}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error || `Server Error: ${error.response.status}`);
      }
      throw error;
    }
  },
};
