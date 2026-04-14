/**
 * @fileoverview Головний оркестратор системи генерації D3.js-візуалізацій.
 * Підрозділ 3.4 записки: координація всіх агентів та реалізація циклу
 * ітеративного виправлення (Self-Refine [24], Self-Debug [22, 23], LEVER [20, 21]).
 *
 * Послідовність (псевдокод з підрозділу 3.4):
 *   1. inferSchema(csv)             → schema
 *   2. selectChartType(schema)      → recommendation
 *   3. Self-Refine loop (до maxRefineIterations):
 *      a. buildPrompt(...)          → systemPrompt + userPrompt
 *      b. provider.generateCode()   → LLM response
 *      c. extractCodeBlock()        → code string
 *      d. validate(code)            → ok | error
 *      e. якщо error: buildFeedbackPrompt → provider.refineCode → validate
 *   4. Якщо ліміт: fallbackTemplate[chartType], status = 'fallback'
 *   5. Повернути уніфікований артефакт (підрозділ 3.4)
 */

import { performance } from 'node:perf_hooks';
import { inferSchema } from '../schemaInference/index.js';
import { selectChartType } from '../chartSelector/index.js';
import { buildPrompt } from '../promptBuilder/index.js';
import { buildFeedbackPrompt } from '../promptBuilder/feedbackPrompt.js';
import { validate } from '../validator/index.js';
import { extractCodeBlock } from './codeExtractor.js';
import { getFallbackTemplate } from './fallbackTemplates.js';
import { config } from '../../config.js';

/**
 * @typedef {object} OrchestrateOptions
 * @property {object|null}  [provider]              - LLM-провайдер (ILLMProvider).
 * @property {'zero-shot'|'few-shot'|'cot'} [mode]  - Режим промпту (default: 'zero-shot').
 * @property {number}       [maxRefineIterations]   - Макс. ітерацій Self-Refine (default: config).
 * @property {number}       [sandboxTimeoutMs]      - Таймаут sandbox (default: config).
 * @property {object|null}  [logger]                - ExperimentLogger (опційно).
 */

/**
 * @typedef {object} ValidationLogEntry
 * @property {number}   iteration
 * @property {boolean}  ok
 * @property {string}   [errorType]
 * @property {string}   [message]
 * @property {number}   latencyMs
 * @property {number}   tokens
 */

/**
 * @typedef {object} OrchestrateResult
 * @property {'success'|'fallback'} status
 * @property {string}   code
 * @property {string}   chartType
 * @property {object}   encoding
 * @property {number}   iterations
 * @property {ValidationLogEntry[]} validationLog
 * @property {number}   totalLatencyMs
 * @property {number}   totalTokens
 * @property {object}   schema
 * @property {object[]} sample
 */

/**
 * Головна функція оркестратора.
 * Координує весь pipeline від CSV до валідованого D3.js-коду.
 *
 * @param {object} params
 * @param {string} params.csv        - Текст CSV-файлу.
 * @param {OrchestrateOptions} [params.options]
 * @returns {Promise<OrchestrateResult>}
 */
export async function orchestrate({ csv, options = {} }) {
  const {
    provider = null,
    mode = 'zero-shot',
    maxRefineIterations = config.refine.maxIterations,
    sandboxTimeoutMs = config.refine.sandboxTimeoutMs,
    logger = null,
  } = options;

  const totalStart = performance.now();
  const validationLog = [];
  let totalTokens = 0;

  // ── Крок 1: Schema Inference ───────────────────────────────────────────────
  const schema = inferSchema(csv, config.schema);
  const sample = schema.sample ?? [];

  if (logger) logger.log(null, { event: 'schema_inferred', chartType: null });

  // ── Крок 2: Chart Type Selection ──────────────────────────────────────────
  const recommendation = await selectChartType(schema, provider);
  const { chartType, encoding } = recommendation;

  if (logger) logger.log(null, { event: 'chart_selected', chartType, source: recommendation.source });

  // ── Крок 3: Промпт першої ітерації ───────────────────────────────────────
  const prompt = await buildPrompt({ schema, chartType, encoding, mode });

  // ── Крок 4: Self-Refine цикл [24] ─────────────────────────────────────────
  let code = null;
  let lastError = null;
  let llmResponse = null;
  let iterationCount = 0;

  for (let i = 0; i < maxRefineIterations; i++) {
    iterationCount = i + 1;
    const iterStart = performance.now();

    // ── Генерація / рефайнмент ────────────────────────────────────────────
    try {
      if (i === 0) {
        // Перша ітерація — генерація з нуля
        llmResponse = await _callGenerateCode(provider, prompt, chartType);
      } else {
        // Наступні ітерації — Self-Refine [24]: виправлення з feedback
        const feedbackPrompt = buildFeedbackPrompt({
          originalCode: code ?? '',
          errorTrace: _formatError(lastError),
          chartType,
          iteration: i,
        });

        if (logger) {
          logger.log(null, { event: 'refine_iteration', iteration: i, errorType: lastError?.errorType });
        }

        llmResponse = await _callRefineCode(provider, code, lastError, feedbackPrompt, chartType);
      }
    } catch (llmErr) {
      // LLM-помилка — логуємо та виходимо на fallback
      validationLog.push({
        iteration: iterationCount,
        ok: false,
        errorType: 'llm_error',
        message: llmErr.message,
        latencyMs: performance.now() - iterStart,
        tokens: 0,
      });
      break;
    }

    const iterLatency = performance.now() - iterStart;
    const iterTokens = (llmResponse?.usage?.promptTokens ?? 0) + (llmResponse?.usage?.completionTokens ?? 0);
    totalTokens += iterTokens;

    if (logger) {
      logger.log(null, {
        event: 'llm_response',
        iteration: iterationCount,
        latencyMs: iterLatency,
        tokens: iterTokens,
      });
    }

    // ── Витягування коду з відповіді ─────────────────────────────────────
    const extracted = extractCodeBlock(llmResponse?.content ?? '');
    if (!extracted) {
      lastError = { errorType: 'no_code_block', message: 'LLM response did not contain a ```javascript block' };
      validationLog.push({
        iteration: iterationCount,
        ok: false,
        errorType: 'no_code_block',
        message: lastError.message,
        latencyMs: iterLatency,
        tokens: iterTokens,
      });
      code = null;
      continue;
    }
    code = extracted;

    // ── Валідація (Рівень 1 + Рівень 2) ──────────────────────────────────
    const validStart = performance.now();
    const validResult = validate(code, { schema, sample, timeoutMs: sandboxTimeoutMs });
    const validLatency = performance.now() - validStart;

    if (logger) {
      logger.log(null, {
        event: validResult.ok ? 'sandbox_exec' : 'static_analysis',
        iteration: iterationCount,
        ok: validResult.ok,
        errorType: validResult.errorType,
        latencyMs: validLatency,
      });
    }

    validationLog.push({
      iteration: iterationCount,
      ok: validResult.ok,
      errorType: validResult.errorType,
      message: validResult.message,
      latencyMs: iterLatency + validLatency,
      tokens: iterTokens,
    });

    if (validResult.ok) {
      // Успіх!
      return {
        status: 'success',
        code,
        chartType,
        encoding,
        iterations: iterationCount,
        validationLog,
        totalLatencyMs: performance.now() - totalStart,
        totalTokens,
        schema,
        sample,
      };
    }

    // Зберігаємо помилку для наступної ітерації refine
    lastError = validResult;
  }

  // ── Fallback: вичерпано всі ітерації ─────────────────────────────────────
  if (logger) {
    logger.log(null, { event: 'fallback_triggered', chartType, iterations: iterationCount });
  }

  const fallbackCode = getFallbackTemplate(chartType);

  return {
    status: 'fallback',
    code: fallbackCode,
    chartType,
    encoding,
    iterations: iterationCount,
    validationLog,
    totalLatencyMs: performance.now() - totalStart,
    totalTokens,
    schema,
    sample,
  };
}

// ─── Приватні хелпери ─────────────────────────────────────────────────────────

/**
 * Викликає generateCode у провайдера або повертає заглушку якщо провайдер відсутній.
 * @private
 */
async function _callGenerateCode(provider, prompt, chartType) {
  if (!provider || typeof provider.generateCode !== 'function') {
    // Без провайдера — одразу повертаємо null (піде на fallback)
    throw new Error('No LLM provider configured. Use ?provider=openai or ?provider=ollama');
  }
  return provider.generateCode(prompt);
}

/**
 * Викликає refineCode у провайдера.
 * @private
 */
async function _callRefineCode(provider, originalCode, error, feedbackPrompt, chartType) {
  if (!provider || typeof provider.refineCode !== 'function') {
    throw new Error('No LLM provider configured');
  }
  return provider.refineCode(originalCode ?? '', _formatError(error), feedbackPrompt);
}

/**
 * Форматує об'єкт помилки у рядок для buildFeedbackPrompt.
 * @private
 * @param {object|null} error
 * @returns {string}
 */
function _formatError(error) {
  if (!error) return 'Unknown error';
  const parts = [];
  if (error.errorType) parts.push(`errorType: ${error.errorType}`);
  if (error.message)   parts.push(error.message);
  if (error.stack)     parts.push(error.stack);
  return parts.join('\n') || 'Unknown error';
}
