
/**
 * Builds the B_chart block of the system prompt.
 *
 * @param {object} opts
 * @param {string} opts.chartType - Chart type (determined by the rule-based algorithm).
 * @param {object} opts.encoding  - Column-to-role mapping from resolveEncoding().
 *   Possible fields: x, y, color, groupBy, category, value.
 * @returns {string} B_chart block text.
 */
export function buildChartBlock({ chartType, encoding }) {
  const lines = [
    '[Chart Specification]',
    `Chart type: ${chartType}  (determined by rule-based algorithm, do not change)`,
  ];

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
