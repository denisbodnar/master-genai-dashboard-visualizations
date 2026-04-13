/**
 * @fileoverview Промпт зворотного зв'язку для циклу Self-Refine.
 * Підрозділ 3.4 записки, Лістинг 3.2: шаблон prompta P_refine.
 *
 * Використовується orchestrator-ом після невдалої валідації коду.
 * Методи Self-Refine [24] та Self-Debug [22, 23]: LLM виправляє власні
 * помилки на основі stack trace та errorType.
 */

/**
 * Формує feedback-промпт для ітерації рефайнменту.
 * Точна структура відповідає Лістингу 3.2 підрозділу 3.4 записки.
 *
 * @param {object} opts
 * @param {string} opts.originalCode - Код, що не пройшов валідацію.
 * @param {string} opts.errorTrace   - Трасування помилки (errorType + message + stack).
 * @param {string} opts.chartType    - Тип графіка (для збереження типу при рефайнменті).
 * @param {number} opts.iteration    - Поточна ітерація (1-based).
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildFeedbackPrompt({ originalCode, errorTrace, chartType, iteration }) {
  const systemPrompt = [
    '[Error Report]',
    `Iteration: ${iteration} / 3`,
    `Error type: ${_extractErrorType(errorTrace)}`,
    'Stack trace:',
    errorTrace,
    '',
    '[Original Code]',
    originalCode,
    '',
    '[Task]',
    `Fix the error above. Preserve the original chart type (${chartType})`,
    'and data mapping. Return ONLY the corrected ```javascript block.',
  ].join('\n');

  const userPrompt = 'Fix the error and return the corrected D3.js code.';

  return { systemPrompt, userPrompt };
}

/**
 * Витягує тип помилки з трасування (для першого рядка звіту).
 * @private
 * @param {string} errorTrace
 * @returns {string}
 */
function _extractErrorType(errorTrace) {
  if (!errorTrace) return 'unknown';
  const firstLine = errorTrace.split('\n')[0];
  // Намагаємося знайти errorType у форматі "errorType: ..."
  const match = firstLine.match(/^(\w+):/);
  return match ? match[1] : firstLine.slice(0, 60);
}
