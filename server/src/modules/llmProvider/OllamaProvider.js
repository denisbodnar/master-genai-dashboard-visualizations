/**
 * @fileoverview Ollama-реалізація ILLMProvider.
 * Підрозділ 2.5.2: локальний LLM-провайдер через Ollama HTTP API.
 *
 * Використовує вбудований fetch Node.js 20+ (без додаткових залежностей).
 * Endpoint: POST ${baseUrl}/api/chat
 *
 * Особливості:
 * - AbortController для timeout
 * - HTTP 404 → non-retryable з підказкою `ollama pull <model>`
 * - Апроксимація токенів через response.eval_count / prompt_eval_count
 */

import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';

/**
 * Провайдер для локального Ollama API.
 * Реалізує інтерфейс ILLMProvider.
 *
 * @see ILLMProvider
 */
export class OllamaProvider {
  /**
   * @param {object} opts
   * @param {string} [opts.baseUrl]     - Базовий URL Ollama (default: config.ollama.baseUrl).
   * @param {string} [opts.model]       - Назва моделі (default: config.ollama.model).
   * @param {number} [opts.temperature] - Температура семплінгу (default: 0.1).
   * @param {number} [opts.timeoutMs]   - Таймаут запиту в мілісекундах (default: 120000).
   */
  constructor({ baseUrl, model, temperature = 0.1, timeoutMs = 120000 } = {}) {
    this.baseUrl = baseUrl ?? config.ollama.baseUrl;
    this.model = model ?? config.ollama.model;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Виконує запит до Ollama /api/chat і вимірює затримку.
   *
   * @private
   * @param {Array<{role: string, content: string}>} messages
   * @returns {Promise<import('./ILLMProvider.js').LLMResponse>}
   */
  async _chat(messages) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const payload = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: this.temperature,
        num_predict: 2048,
      },
    };

    const t0 = performance.now();
    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const error = new Error(`Ollama request timed out after ${this.timeoutMs}ms`);
        error.retryable = true;
        throw error;
      }
      const error = new Error(`Ollama network error: ${err.message}`);
      error.retryable = true;
      error.cause = err;
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = performance.now() - t0;

    // HTTP 404 — модель не завантажена (non-retryable)
    if (res.status === 404) {
      const error = new Error(
        `Ollama model "${this.model}" not found. Run: ollama pull ${this.model}`,
      );
      error.retryable = false;
      throw error;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const retryable = res.status >= 500;
      const error = new Error(`Ollama HTTP ${res.status}: ${body}`);
      error.retryable = retryable;
      throw error;
    }

    const data = await res.json();

    return {
      content: data.message?.content ?? '',
      usage: {
        // Ollama повертає наближені значення токенів
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        latencyMs,
      },
      raw: data,
    };
  }

  /**
   * Генерує D3.js-код на основі промпту.
   *
   * @param {{ systemPrompt: string, userPrompt: string }} prompt
   * @param {object} [options] - Ігнорується для Ollama (параметри задаються в конструкторі).
   * @returns {Promise<import('./ILLMProvider.js').LLMResponse>}
   */
  async generateCode({ systemPrompt, userPrompt }, options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    return this._chat(messages);
  }

  /**
   * Уточнює код на основі трасування помилки (Self-Refine [24]).
   *
   * @param {string} originalCode
   * @param {string} errorTrace
   * @param {{ systemPrompt: string, userPrompt: string }} prompt - Feedback-промпт.
   * @returns {Promise<import('./ILLMProvider.js').LLMResponse>}
   */
  async refineCode(originalCode, errorTrace, { systemPrompt, userPrompt }) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    return this._chat(messages);
  }

  /**
   * LLM-fallback для вибору типу графіка.
   * Ollama не підтримує JSON-mode, тому парсимо відповідь регулярним виразом.
   *
   * @param {{ schema: object, candidates: string[] }} input
   * @returns {Promise<import('./ILLMProvider.js').ChartSelectionResponse>}
   */
  async selectChartType({ schema, candidates }) {
    const systemPrompt = [
      'You are a data visualization expert.',
      `Select the most appropriate chart type from: ${candidates.join(', ')}.`,
      'Respond with ONLY a JSON object: {"chartType": "<type>", "reasoning": "<one sentence>"}',
      'Do not include any explanation outside the JSON object.',
    ].join('\n');

    const userPrompt = `Schema:\n${JSON.stringify(schema, null, 2)}`;

    const response = await this._chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    let parsed;
    try {
      // Витягуємо JSON навіть якщо модель додала зайвий текст
      const match = response.content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match?.[0] ?? response.content);
    } catch {
      parsed = { chartType: candidates[0], reasoning: 'Failed to parse LLM response' };
    }

    const chartType = candidates.includes(parsed.chartType) ? parsed.chartType : candidates[0];

    return {
      chartType,
      reasoning: parsed.reasoning ?? '',
    };
  }
}
