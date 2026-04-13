/**
 * @fileoverview Блок B_chart — обмеження типу візуалізації та маппінг осей.
 * Підрозділ 3.3 записки.
 *
 * Явне зазначення назв стовпців усуває клас галюцинацій, пов'язаних
 * з некоректним маппінгом полів [14, 16].
 *
 * Підтримувані поля encoding: x, y, color, groupBy, category, value.
 */

/**
 * Формує блок B_chart системного промпту.
 *
 * @param {object} opts
 * @param {string} opts.chartType - Тип графіка (визначений rule-based алгоритмом).
 * @param {object} opts.encoding  - Маппінг стовпців на ролі з resolveEncoding().
 *   Можливі поля: x, y, color, groupBy, category, value.
 * @returns {string} Текст блоку B_chart.
 */
export function buildChartBlock({ chartType, encoding }) {
  const lines = [
    '[Chart Specification]',
    `Chart type: ${chartType}  (determined by rule-based algorithm, do not change)`,
  ];

  // Додаємо лише наявні поля — структура залежить від типу графіка
  if (encoding.x !== undefined) {
    const xVal = Array.isArray(encoding.x) ? encoding.x.join(', ') : encoding.x;
    lines.push(`X-axis: ${xVal}`);
  }
  if (encoding.y !== undefined) {
    const yVal = Array.isArray(encoding.y) ? encoding.y.join(', ') : encoding.y;
    lines.push(`Y-axis: ${yVal}`);
  }
  if (encoding.color !== undefined) {
    lines.push(`Color: ${encoding.color}`);
  }
  if (encoding.groupBy !== undefined) {
    lines.push(`GroupBy: ${encoding.groupBy}`);
  }
  if (encoding.category !== undefined) {
    lines.push(`Category: ${encoding.category}`);
  }
  if (encoding.value !== undefined) {
    lines.push(`Value: ${encoding.value}`);
  }

  return lines.join('\n');
}
