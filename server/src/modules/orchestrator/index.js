/**
 * @fileoverview Головний оркестратор системи генерації D3.js-візуалізацій.
 * Підрозділ 3.4 записки: координація всіх агентів та реалізація циклу
 * ітеративного виправлення (Self-Refine [24], Self-Debug [22, 23], LEVER [20, 21]).
 *
 * Зміни відносно початкової версії:
 *   - додано параметр dataStrategy ('schema-sample' | 'full-csv')
 *   - csvText тепер передається до buildPrompt для full-csv режиму
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
 * @property {'schema-sample'|'full-csv'} [dataStrategy] - Стратегія передачі даних (default: 'schema-sample').
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
 * @property {string}   dataStrategy  — фіксується для логування в Розділі 5
 */

/**
 * Головна функція оркестратора.
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
    dataStrategy = 'schema-sample',
    maxRefineIterations = config.refine.maxIterations,
    sandboxTimeoutMs = config.refine.sandboxTimeoutMs,
    logger = null,
  } = options;

  const totalStart = performance.now();
  const validationLog = [];
  let totalTokens = 0;

  // ── Крок 1: Schema Inference ───────────────────────────────────────────────
  // Schema завжди обчислюється незалежно від dataStrategy:
  // використовується для chartSelector та sandbox-валідації
  const schema = inferSchema(csv, config.schema);
  const sample = schema.sample ?? [];

  if (logger) logger.log(null, { event: 'schema_inferred', chartType: null });

  // ── Крок 2: Chart Type Selection ──────────────────────────────────────────
  const recommendation = await selectChartType(schema, provider);
  const { chartType, encoding } = recommendation;

  if (logger) logger.log(null, {
    event: 'chart_selected',
    chartType,
    source: recommendation.source,
    dataStrategy,
  });

  // ── Крок 3: Промпт першої ітерації ───────────────────────────────────────
  // dataStrategy визначає вміст блоку B_schema:
  //   'schema-sample' → Schema JSON + 3 рядки (підрозділ 2.3.2, за замовчуванням)
  //   'full-csv'      → сирий CSV (перші 50 рядків)
  const prompt = await buildPrompt({
    schema,
    chartType,
    encoding,
    mode,
    dataStrategy,
    csvText: csv,
  });

  // ── Крок 4: Self-Refine цикл [24] ─────────────────────────────────────────
  let code = null;
  let lastError = null;
  let llmResponse = null;
  let iterationCount = 0;

  for (let i = 0; i < maxRefineIterations; i++) {
    iterationCount = i + 1;
    const iterStart = performance.now();

    try {
      if (i === 0) {
        llmResponse = await _callGenerateCode(provider, prompt, chartType);
      } else {
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
        dataStrategy,
      };
    }

    lastError = validResult;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
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
    dataStrategy,
  };
}

// ─── Приватні хелпери ─────────────────────────────────────────────────────────

async function _callGenerateCode(provider, prompt, chartType) {
  if (!provider || typeof provider.generateCode !== 'function') {
    throw new Error('No LLM provider configured. Use ?provider=openai or ?provider=ollama');
  }
  return provider.generateCode(prompt);
}

async function _callRefineCode(provider, originalCode, error, feedbackPrompt, chartType) {
  if (!provider || typeof provider.refineCode !== 'function') {
    throw new Error('No LLM provider configured');
  }
  return provider.refineCode(originalCode ?? '', _formatError(error), feedbackPrompt);
}

function _formatError(error) {
  if (!error) return 'Unknown error';
  const parts = [];
  if (error.errorType) parts.push(`errorType: ${error.errorType}`);
  if (error.message)   parts.push(error.message);
  if (error.stack)     parts.push(error.stack);
  return parts.join('\n') || 'Unknown error';
}
