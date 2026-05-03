// Sandbox execution of generated D3 code via node:vm.

import vm from 'node:vm';
import { createMockD3 } from './mockD3.js';

/**
 * Executes generated code in an isolated vm context.
 * Outer catch handles V8-level exceptions and vm.createContext failures;
 * the inner try/catch (in _executeInSandboxInner) handles normal runtime errors.
 *
 * @param {string} code
 * @param {object} opts
 * @returns {{ ok: true, mockState: object } | { ok: false, errorType: string, message: string, stack?: string }}
 */
export function executeInSandbox(code, opts = {}) {
  try {
    return _executeInSandboxInner(code, opts);
  } catch (err) {
    return {
      ok: false,
      errorType: 'runtime',
      message: `Sandbox uncaught error: ${err?.message ?? String(err)}`,
      stack: err?.stack,
    };
  }
}

function _executeInSandboxInner(code, { schema, sample, timeoutMs = 2000 }) {
  const mockD3 = createMockD3();

  const contextData = [...(sample ?? [])];
  if (schema && schema.columns) {
    contextData.columns = schema.columns.map(c => c.name);
  }

  const context = {
    d3: mockD3,
    data: contextData,
    console: {
      log:   () => {},
      error: () => {},
      warn:  () => {},
      info:  () => {},
      debug: () => {},
    },
    Math,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Date,
    JSON,
    parseFloat,
    parseInt,
    isNaN,
    isFinite,
    undefined,
    setTimeout: () => {},
    clearTimeout: () => {},
  };

  vm.createContext(context);

  const scriptSource = `${code}\nrenderChart(data, "#test-div");`;

  let script;
  try {
    script = new vm.Script(scriptSource);
  } catch (err) {
    // Syntax error at compile time (should not reach here after staticAnalyze)
    return {
      ok: false,
      errorType: 'syntax',
      message: `Script compilation error: ${err.message}`,
      stack: err.stack,
    };
  }

  try {
    script.runInContext(context, { timeout: timeoutMs });
  } catch (err) {
    if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
      return {
        ok: false,
        errorType: 'runtime',
        message: `Script execution timed out after ${timeoutMs}ms (possible infinite loop)`,
        stack: err.stack,
      };
    }
    return {
      ok: false,
      errorType: 'runtime',
      message: err?.message ?? String(err),
      stack: err?.stack,
    };
  }

  const mockState = {
    selectCalls:    mockD3.selectCalls,
    dataBindCalls:  mockD3.dataBindCalls,
    appendCalls:    mockD3.appendCalls,
    svgAppended:    mockD3.svgAppended,
    lastDataLength: mockD3.lastDataLength,
  };

  if (!mockState.svgAppended) {
    return {
      ok: false,
      errorType: 'no_svg_appended',
      message: 'renderChart() did not call .append("svg")',
      mockState,
    };
  }

  if (mockState.dataBindCalls === 0) {
    return {
      ok: false,
      errorType: 'data_not_bound',
      message: 'renderChart() did not bind data via .data()',
      mockState,
    };
  }

  return { ok: true, mockState };
}
