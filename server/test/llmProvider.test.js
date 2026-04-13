/**
 * @fileoverview Unit-тести для модуля llmProvider (Етап 2).
 * Mock-стратегія:
 *   - OllamaProvider: підміна globalThis.fetch перед кожним тестом
 *   - OpenAIProvider: інжекція stub-клієнта через _client після конструктора
 * Реальних мережевих запитів немає.
 */

import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { OpenAIProvider } from '../src/modules/llmProvider/OpenAIProvider.js';
import { OllamaProvider } from '../src/modules/llmProvider/OllamaProvider.js';
import { createProvider } from '../src/modules/llmProvider/index.js';

// ─── Хелпери для мокування fetch ────────────────────────────────────────────

/**
 * Замінює globalThis.fetch stub-функцією, що повертає заздалегідь відомий JSON.
 * @param {object} body   - JSON-тіло відповіді.
 * @param {number} status - HTTP-статус.
 * @returns {Function} Оригінальний fetch для відновлення.
 */
function mockFetch(body, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  return original;
}

function restoreFetch(original) {
  globalThis.fetch = original;
}

// ─── Хелпер для stub OpenAI-клієнта ─────────────────────────────────────────

/**
 * Створює мінімальний stub OpenAI-клієнта.
 * @param {string} content  - Текст відповіді моделі.
 * @param {object} [usage]  - Токени.
 */
function makeOpenAIClientStub(content, usage = { prompt_tokens: 10, completion_tokens: 20 }) {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content } }],
          usage,
        }),
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OLLAMA PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

describe('OllamaProvider', () => {
  /** Зберігаємо оригінальний fetch */
  let originalFetch;

  afterEach(() => {
    if (originalFetch !== undefined) {
      restoreFetch(originalFetch);
      originalFetch = undefined;
    }
  });

  // ── Формування payload ──────────────────────────────────────────────────────

  it('формує правильний payload для /api/chat', async () => {
    let capturedBody;
    const original = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: 'result' },
          prompt_eval_count: 5,
          eval_count: 10,
        }),
        text: async () => '',
      };
    };
    originalFetch = original;

    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5-coder:3b',
      temperature: 0.5,
    });
    await provider.generateCode({
      systemPrompt: 'sys',
      userPrompt: 'user',
    });

    assert.equal(capturedBody.model, 'qwen2.5-coder:3b');
    assert.equal(capturedBody.stream, false);
    assert.equal(capturedBody.options.temperature, 0.5);
    assert.equal(capturedBody.options.num_predict, 2048);
    assert.equal(capturedBody.messages[0].role, 'system');
    assert.equal(capturedBody.messages[1].role, 'user');
  });

  // ── Парсинг відповіді ────────────────────────────────────────────────────────

  it('коректно парсить відповідь та повертає LLMResponse', async () => {
    originalFetch = mockFetch({
      message: { content: '```js\nconsole.log("hi");\n```' },
      prompt_eval_count: 42,
      eval_count: 99,
    });

    const provider = new OllamaProvider({ baseUrl: 'http://test', model: 'test' });
    const result = await provider.generateCode({
      systemPrompt: 'sys',
      userPrompt: 'gen',
    });

    assert.equal(result.content, '```js\nconsole.log("hi");\n```');
    assert.equal(result.usage.promptTokens, 42);
    assert.equal(result.usage.completionTokens, 99);
    assert.ok(result.usage.latencyMs >= 0);
    assert.ok(result.raw !== undefined);
  });

  // ── Обробка HTTP 404 ─────────────────────────────────────────────────────────

  it('кидає non-retryable помилку при HTTP 404 (модель відсутня)', async () => {
    originalFetch = mockFetch({}, 404);

    const provider = new OllamaProvider({ model: 'missing-model' });
    await assert.rejects(
      () => provider.generateCode({ systemPrompt: '', userPrompt: '' }),
      (err) => {
        assert.ok(err.message.includes('missing-model'), 'повідомлення містить назву моделі');
        assert.ok(err.message.includes('ollama pull'), 'підказка про ollama pull');
        assert.equal(err.retryable, false);
        return true;
      },
    );
  });

  // ── Обробка 5xx ──────────────────────────────────────────────────────────────

  it('кидає retryable помилку при HTTP 500', async () => {
    originalFetch = mockFetch({ error: 'internal' }, 500);

    const provider = new OllamaProvider({ model: 'test' });
    await assert.rejects(
      () => provider.generateCode({ systemPrompt: '', userPrompt: '' }),
      (err) => {
        assert.equal(err.retryable, true);
        return true;
      },
    );
  });

  // ── refineCode ────────────────────────────────────────────────────────────────

  it('refineCode передає правильну структуру messages', async () => {
    let capturedMessages;
    const original = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      capturedMessages = JSON.parse(opts.body).messages;
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: { content: 'fixed' }, eval_count: 5, prompt_eval_count: 3 }),
        text: async () => '',
      };
    };
    originalFetch = original;

    const provider = new OllamaProvider({ model: 'test' });
    await provider.refineCode('old code', 'SyntaxError', {
      systemPrompt: 'Fix this',
      userPrompt: 'Here is the error',
    });

    assert.equal(capturedMessages[0].role, 'system');
    assert.equal(capturedMessages[0].content, 'Fix this');
    assert.equal(capturedMessages[1].role, 'user');
    assert.equal(capturedMessages[1].content, 'Here is the error');
  });

  // ── selectChartType ───────────────────────────────────────────────────────────

  it('selectChartType парсить JSON у відповіді Ollama', async () => {
    originalFetch = mockFetch({
      message: { content: '{"chartType":"bar","reasoning":"Two columns: category and value"}' },
      eval_count: 15,
      prompt_eval_count: 30,
    });

    const provider = new OllamaProvider({ model: 'test' });
    const result = await provider.selectChartType({
      schema: { columns: [] },
      candidates: ['bar', 'line', 'scatter'],
    });

    assert.equal(result.chartType, 'bar');
    assert.ok(result.reasoning.length > 0);
  });

  it('selectChartType fallback до першого кандидата при неправильному JSON', async () => {
    originalFetch = mockFetch({
      message: { content: 'I think it should be a bar chart.' },
      eval_count: 5,
      prompt_eval_count: 10,
    });

    const provider = new OllamaProvider({ model: 'test' });
    const result = await provider.selectChartType({
      schema: { columns: [] },
      candidates: ['pie', 'bar'],
    });

    assert.equal(result.chartType, 'pie');
  });

  // ── Вимірювання latencyMs ────────────────────────────────────────────────────

  it('latencyMs > 0 після успішного запиту', async () => {
    originalFetch = mockFetch({
      message: { content: 'ok' },
      prompt_eval_count: 1,
      eval_count: 1,
    });

    const provider = new OllamaProvider({ model: 'test' });
    const result = await provider.generateCode({ systemPrompt: '', userPrompt: '' });

    assert.ok(result.usage.latencyMs >= 0, 'latencyMs має бути >= 0');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OPENAI PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

describe('OpenAIProvider', () => {
  // ── generateCode ──────────────────────────────────────────────────────────────

  it('generateCode повертає content з відповіді API', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key', model: 'gpt-4o-mini' });
    provider._client = makeOpenAIClientStub('```js\nconst x = 1;\n```', {
      prompt_tokens: 50,
      completion_tokens: 30,
    });

    const result = await provider.generateCode({
      systemPrompt: 'Generate D3.js',
      userPrompt: 'Bar chart',
    });

    assert.equal(result.content, '```js\nconst x = 1;\n```');
    assert.equal(result.usage.promptTokens, 50);
    assert.equal(result.usage.completionTokens, 30);
    assert.ok(result.usage.latencyMs >= 0);
  });

  // ── refineCode ────────────────────────────────────────────────────────────────

  it('refineCode повертає відповідь моделі', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key', model: 'gpt-4o-mini' });
    provider._client = makeOpenAIClientStub('fixed code');

    const result = await provider.refineCode('broken code', 'SyntaxError: ...', {
      systemPrompt: 'Fix it',
      userPrompt: 'Error details',
    });

    assert.equal(result.content, 'fixed code');
  });

  // ── selectChartType ───────────────────────────────────────────────────────────

  it('selectChartType парсить JSON від OpenAI', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    provider._client = makeOpenAIClientStub(
      '{"chartType":"scatter","reasoning":"Two numeric columns"}',
    );

    const result = await provider.selectChartType({
      schema: { columns: [] },
      candidates: ['bar', 'scatter', 'line'],
    });

    assert.equal(result.chartType, 'scatter');
    assert.ok(result.reasoning.includes('numeric'));
  });

  it('selectChartType fallback при невалідному JSON', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    provider._client = makeOpenAIClientStub('not json at all');

    const result = await provider.selectChartType({
      schema: { columns: [] },
      candidates: ['line', 'bar'],
    });

    assert.equal(result.chartType, 'line');
  });

  // ── Retryable помилки ─────────────────────────────────────────────────────────

  it('кидає retryable=true для rate limit (429)', async () => {
    const provider = new OpenAIProvider({ apiKey: 'test-key' });
    const rateLimitErr = new Error('Rate limit exceeded');
    rateLimitErr.status = 429;
    provider._client = {
      chat: { completions: { create: async () => { throw rateLimitErr; } } },
    };

    await assert.rejects(
      () => provider.generateCode({ systemPrompt: '', userPrompt: '' }),
      (err) => {
        assert.equal(err.retryable, true);
        return true;
      },
    );
  });

  it('кидає retryable=false для auth помилки (401)', async () => {
    const provider = new OpenAIProvider({ apiKey: 'bad-key' });
    const authErr = new Error('Unauthorized');
    authErr.status = 401;
    provider._client = {
      chat: { completions: { create: async () => { throw authErr; } } },
    };

    await assert.rejects(
      () => provider.generateCode({ systemPrompt: '', userPrompt: '' }),
      (err) => {
        assert.equal(err.retryable, false);
        return true;
      },
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY: createProvider
// ═══════════════════════════════════════════════════════════════════════════════

describe('createProvider', () => {
  it('повертає OpenAIProvider для "openai"', () => {
    const provider = createProvider('openai', { apiKey: 'x', model: 'gpt-4o-mini' });
    assert.ok(provider instanceof OpenAIProvider);
  });

  it('повертає OllamaProvider для "ollama"', () => {
    const provider = createProvider('ollama', { model: 'test' });
    assert.ok(provider instanceof OllamaProvider);
  });

  it('кидає Error для невідомого провайдера', () => {
    assert.throws(
      () => createProvider('unknown'),
      (err) => {
        assert.ok(err.message.includes('"unknown"'));
        return true;
      },
    );
  });
});
