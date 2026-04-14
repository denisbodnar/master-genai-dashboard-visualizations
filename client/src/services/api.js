import axios from 'axios';

/**
 * Сервіс для взаємодії з бекендом GenAI-Viz.
 * Використовує відносний шлях, оскільки Vite налаштовано на проксіювання /api.
 */

export const api = {
  /**
   * Відправляє CSV файл та параметри для генерації D3 графіка.
   * 
   * @param {File} file - CSV файл.
   * @param {string} provider - 'openai', 'ollama', або 'none' (rule-based).
   * @param {string} mode - 'zero-shot', 'few-shot', або 'cot'.
   * @returns {Promise<Object>} Відповідь оркестратора.
   */
  async generateChart(file, provider = 'none', mode = 'zero-shot') {
    const formData = new FormData();
    formData.append('file', file);

    const url = `/api/generate?provider=${provider}&mode=${mode}`;
    
    try {
      const response = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error || `Server Error: ${error.response.status}`);
      }
      throw error;
    }
  }
};
