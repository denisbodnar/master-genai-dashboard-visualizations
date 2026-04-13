/**
 * @fileoverview Блок B_role — визначення ролі та завдання.
 * Підрозділ 3.3 записки, формула P = B_role ⊕ B_schema ⊕ B_chart ⊕ B_shots ⊕ B_constraints.
 *
 * Якщо mode === 'cot' — додається інструкція покрокового міркування (CoT [30]).
 * В режимах 'zero-shot' та 'few-shot' блок ідентичний,
 * але без кроку "Think step by step".
 */

/**
 * Формує блок B_role системного промпту.
 *
 * @param {object} opts
 * @param {string} opts.chartType - Тип графіка (наприклад, 'bar', 'line').
 * @param {'zero-shot' | 'few-shot' | 'cot'} opts.mode - Режим генерації.
 * @returns {string} Текст блоку B_role.
 */
export function buildRoleBlock({ chartType, mode }) {
  // Базова роль — однакова для всіх режимів (Лістинг 3.3 записки)
  const base = [
    'You are an expert D3.js v7 developer.',
    'Your task is to generate a JavaScript function:',
    '  renderChart(data, containerSelector)',
    `that creates an interactive ${chartType} visualization.`,
  ].join('\n');

  // CoT-режим: додаємо інструкцію покрокового міркування [30]
  // Точний текст з підрозділу 3.3 записки (блок B_role з CoT)
  if (mode === 'cot') {
    return (
      base +
      '\n' +
      [
        'Think step by step:',
        '  1. Identify which columns map to axes/encoding channels',
        '  2. Define scales and domains',
        '  3. Bind data to DOM elements',
        '  4. Add axes, labels, legend, and tooltip',
      ].join('\n')
    );
  }

  return base;
}
