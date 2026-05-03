// Two-level validator: AST static analysis then sandbox execution.

import { staticAnalyze } from './staticAnalyzer.js';
import { executeInSandbox } from './sandbox.js';

/**
 * @param {string} code
 * @param {object} opts
 * @param {object}   opts.schema
 * @param {object[]} opts.sample
 * @param {number}  [opts.timeoutMs=2000]
 * @returns {{ ok: boolean, errorType?: string, message?: string, stack?: string, mockState?: object }}
 */
export function validate(code, { schema, sample, timeoutMs = 2000 } = {}) {
  const staticResult = staticAnalyze(code);
  if (!staticResult.ok) {
    return staticResult;
  }

  return executeInSandbox(code, { schema, sample, timeoutMs });
}

export { staticAnalyze, executeInSandbox };
export { createMockD3 } from './mockD3.js';
