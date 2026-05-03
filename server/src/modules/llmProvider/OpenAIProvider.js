// OpenAI Chat Completions provider — measures latency, classifies retryable errors.

import OpenAI from 'openai';
import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';

export class OpenAIProvider {
  /**
   * @param {object} opts
   * @param {string} [opts.apiKey]
   * @param {string} [opts.model]
   * @param {number} [opts.temperature]
   */
  constructor({ apiKey, model, temperature = 0.1 } = {}) {
    this.model = model ?? config.openai.model;
    this.temperature = temperature;
    this._client = new OpenAI({ apiKey: apiKey ?? config.openai.apiKey });
  }

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
      const error = new Error(`OpenAI API error: ${err.message}`);
      error.retryable = _isRetryable(err);
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
   * @param {string} originalCode
   * @param {string} errorTrace
   * @param {{ systemPrompt: string, userPrompt: string }} prompt
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
   * Uses JSON mode to guarantee a structured response.
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

// 429 (rate limit) and 5xx are retryable; 401/400 are not.
function _isRetryable(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}
