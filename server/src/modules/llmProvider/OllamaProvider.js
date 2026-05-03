// Ollama local provider via HTTP API — uses native fetch + AbortController timeout.

import { performance } from 'node:perf_hooks';
import { config } from '../../config.js';

export class OllamaProvider {
  /**
   * @param {object} opts
   * @param {string} [opts.baseUrl]
   * @param {string} [opts.model]
   * @param {number} [opts.temperature]
   * @param {number} [opts.timeoutMs]
   */
  constructor({ baseUrl, model, temperature = 0.1, timeoutMs = 120000 } = {}) {
    this.baseUrl = baseUrl ?? config.ollama.baseUrl;
    this.model = model ?? config.ollama.model;
    this.temperature = temperature;
    this.timeoutMs = timeoutMs;
  }

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

    if (res.status === 404) {
      const error = new Error(
        `Ollama model "${this.model}" not found. Run: ollama pull ${this.model}`,
      );
      error.retryable = false;
      throw error;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const error = new Error(`Ollama HTTP ${res.status}: ${body}`);
      error.retryable = res.status >= 500;
      throw error;
    }

    const data = await res.json();

    return {
      content: data.message?.content ?? '',
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        latencyMs,
      },
      raw: data,
    };
  }

  /**
   * @param {{ systemPrompt: string, userPrompt: string }} prompt
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
   * Ollama has no JSON mode — extracts JSON from free-form text via regex.
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
