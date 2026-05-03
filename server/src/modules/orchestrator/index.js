// Orchestrator: schema → chart selection → LLM code generation → Self-Refine loop.

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
 * @property {object|null}  [provider]              - LLM provider (ILLMProvider).
 * @property {'zero-shot'|'few-shot'|'cot'} [mode]  - Prompt mode (default: 'zero-shot').
 * @property {'schema-sample'|'full-csv'} [dataStrategy] - Data transfer strategy (default: 'schema-sample').
 * @property {number}       [maxRefineIterations]   - Max Self-Refine iterations (default: config).
 * @property {number}       [sandboxTimeoutMs]      - Sandbox timeout (default: config).
 * @property {object|null}  [logger]                - ExperimentLogger (optional).
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
 * @property {string}   dataStrategy
 */

/**
 * @param {object} params
 * @param {string} params.csv
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

  const schema = inferSchema(csv, config.schema);
  const sample = schema.sample ?? [];

  if (logger) logger.log(null, { event: 'schema_inferred', chartType: null });

  const recommendation = await selectChartType(schema, provider);
  const { chartType, encoding } = recommendation;

  if (logger) logger.log(null, {
    event: 'chart_selected',
    chartType,
    source: recommendation.source,
    dataStrategy,
  });

  const prompt = await buildPrompt({
    schema,
    chartType,
    encoding,
    mode,
    dataStrategy,
    csvText: csv,
  });

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
