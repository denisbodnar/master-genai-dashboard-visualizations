/**
 * @fileoverview Публічний фасад модуля validator.
 * Підрозділ 3.4 записки: дворівнева валідація.
 *
 * Рівень 1 → staticAnalyze (AST, без виконання)
 * Рівень 2 → executeInSandbox (vm + MockD3)
 *
 * Послідовність: провал Рівня 1 не запускає Рівень 2.
 * Повертає уніфікований результат для orchestrator.
 */

import { staticAnalyze } from './staticAnalyzer.js';
import { executeInSandbox } from './sandbox.js';

/**
 * Виконує двоетапну валідацію згенерованого коду.
 *
 * @param {string} code - JavaScript-код з функцією renderChart.
 * @param {object} opts
 * @param {object}   opts.schema     - Schema JSON.
 * @param {object[]} opts.sample     - Вибіркові рядки даних.
 * @param {number}  [opts.timeoutMs=2000] - Таймаут sandbox.
 * @returns {{ ok: boolean, errorType?: string, message?: string, stack?: string, mockState?: object }}
 */
export function validate(code, { schema, sample, timeoutMs = 2000 } = {}) {
  // ── Рівень 1: статичний аналіз ───────────────────────────────────────────
  const staticResult = staticAnalyze(code);
  if (!staticResult.ok) {
    return staticResult;
  }

  // ── Рівень 2: виконання у sandbox ────────────────────────────────────────
  const sandboxResult = executeInSandbox(code, { schema, sample, timeoutMs });
  return sandboxResult;
}

export { staticAnalyze, executeInSandbox };
export { createMockD3 } from './mockD3.js';
