/**
 * @fileoverview OpenAI-реалізація ILLMProvider.
 * Підрозділ 2.5.2: хмарний LLM-провайдер на базі офіційного openai SDK.
 *
 * Особливості:
 * - Вимірює latencyMs через performance.now() [точність ~мікросекунди]
 * - Розпізнає retryable-помилки (rate limit, 5xx) та non-retryable (auth, bad_request)
 * - Делегує selectChartType через structured JSON-response
 */

import OpenAI from 'openai';
import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';

/**
 * Провайдер для OpenAI API (GPT-4o, GPT-4o-mini тощо).
 * Реалізує інтерфейс ILLMProvider.
 *
 * @see ILLMProvider
 */
export class OpenAIProvider {
  /**
   * @param {object} opts
   * @param {string} [opts.apiKey]       - OpenAI API key (default: config.openai.apiKey).
   * @param {string} [opts.model]        - Ідентифікатор моделі (default: config.openai.model).
   * @param {number} [opts.temperature]  - Температура семплінгу (default: 0.1).
   */
  constructor({ apiKey, model, temperature = 0.1 } = {}) {
    this.model = model ?? config.openai.model;
    this.temperature = temperature;
    this._client = new OpenAI({ apiKey: apiKey ?? config.openai.apiKey });
  }

  /**
   * Виконує запит до OpenAI Chat Completions API та вимірює затримку.
   *
   * @private
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [extra] - Додаткові параметри для API (response_format тощо).
   * @returns {Promise<import('./ILLMProvider.js').LLMResponse>}
   */
  async _chat(messages, extra = {}) {
    const t0 = performance.now();
    let completion;
    try {
      completion = await this._client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        messages,
        ...extra,
      });
    } catch (err) {
      const retryable = _isRetryable(err);
      const error = new Error(`OpenAI API error: ${err.message}`);
      error.retryable = retryable;
      error.cause = err;
      throw error;
    }

    const latencyMs = performance.now() - t0;
    const choice = completion.choices[0];

    return {
      content: choice.message.content ?? '',
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0,
        latencyMs,
      },
      raw: completion,
    };
  }

  /**
   * Генерує D3.js-код на основі промпту.
   *
   * @param {{ systemPrompt: string, userPrompt: string }} prompt
   * @param {object} [options]
   * @returns {Promise<import('./ILLMProvider.js').LLMResponse>}
   */
  async generateCode({ systemPrompt, userPrompt }, options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    return this._chat(messages, options);
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
   * Використовує JSON-mode, щоб гарантувати структуровану відповідь.
   *
   * @param {{ schema: object, candidates: string[] }} input
   * @returns {Promise<import('./ILLMProvider.js').ChartSelectionResponse>}
   */
  async selectChartType({ schema, candidates }) {
    const systemPrompt = [
      'You are a data visualization expert.',
      `Select the most appropriate chart type from: ${candidates.join(', ')}.`,
      'Respond with valid JSON: {"chartType": "<type>", "reasoning": "<one sentence>"}',
    ].join('\n');

    const userPrompt = `Schema:\n${JSON.stringify(schema, null, 2)}`;

    const response = await this._chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { response_format: { type: 'json_object' } },
    );

    let parsed;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      parsed = { chartType: candidates[0], reasoning: 'Failed to parse LLM response' };
    }

    return {
      chartType: parsed.chartType ?? candidates[0],
      reasoning: parsed.reasoning ?? '',
    };
  }
}

/**
 * Визначає, чи помилка OpenAI API є retryable.
 * Rate limit (429) та серверні помилки (5xx) — retryable.
 * Auth (401), bad request (400) — non-retryable.
 *
 * @private
 * @param {Error} err
 * @returns {boolean}
 */
function _isRetryable(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}
