/**
 * @fileoverview Рівень 2 валідації: виконання коду в ізольованому sandbox.
 * Підрозділ 3.4 записки, псевдокод sandboxExecute().
 *
 * Архітектура LEVER [20, 21]: перевірка коду через реальне виконання
 * суттєво підвищує метрики успішності генерації порівняно з чисто
 * статичним аналізом.
 *
 * Контекст sandbox:
 *   - d3: MockD3() — перехоплює виклики та лічить їх
 *   - data: sample (3 рядки зі Schema JSON)
 *   - console: заглушка (лог не потрапляє у stdout)
 *
 * Після виконання перевіряє:
 *   - svgAppended === true (код додав SVG-елемент)
 *   - dataBindCalls > 0 (дані були прив'язані через .data())
 */

import vm from 'node:vm';
import { createMockD3 } from './mockD3.js';

/**
 * Виконує сгенерований код у ізольованому vm-контексті.
 *
 * @param {string} code - JavaScript-код з функцією renderChart.
 * @param {object} opts
 * @param {object}   opts.schema    - Schema JSON (для метаданих).
 * @param {object[]} opts.sample    - Вибіркові рядки даних (3 записи).
 * @param {number}  [opts.timeoutMs=2000] - Таймаут vm виконання.
 * @returns {{ ok: true, mockState: object } | { ok: false, errorType: string, message: string, stack?: string }}
 */
export function executeInSandbox(code, { schema, sample, timeoutMs = 2000 }) {
  const mockD3 = createMockD3();

  // ── Контекст виконання (підрозділ 3.4) ────────────────────────────────────
  const context = {
    d3: mockD3,
    data: sample ?? [],
    console: {
      log:   () => {},
      error: () => {},
      warn:  () => {},
      info:  () => {},
      debug: () => {},
    },
    // Базові глобали, які може використати код
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

  // Код + виклик renderChart з тестовим контейнером (підрозділ 3.4)
  const scriptSource = `${code}\nrenderChart(data, "#test-div");`;

  let script;
  try {
    script = new vm.Script(scriptSource);
  } catch (err) {
    // Синтаксична помилка при компіляції (не мала би доходити сюди після staticAnalyze)
    return {
      ok: false,
      errorType: 'syntax',
      message: `Script compilation error: ${err.message}`,
      stack: err.stack,
    };
  }

  // ── Виконання з timeout ────────────────────────────────────────────────────
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
      message: err.message,
      stack: err.stack,
    };
  }

  // ── Перевірка стейту MockD3 після виконання ───────────────────────────────
  const mockState = {
    selectCalls:    mockD3.selectCalls,
    dataBindCalls:  mockD3.dataBindCalls,
    appendCalls:    mockD3.appendCalls,
    svgAppended:    mockD3.svgAppended,
    lastDataLength: mockD3.lastDataLength,
  };

  // SVG має бути доданий (підрозділ 3.4: MockD3.svgAppended == false → error)
  if (!mockState.svgAppended) {
    return {
      ok: false,
      errorType: 'no_svg_appended',
      message: 'renderChart() did not call .append("svg")',
      mockState,
    };
  }

  // Дані мають бути прив'язані через .data() (підрозділ 3.4: dataCalls.count == 0 → error)
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
