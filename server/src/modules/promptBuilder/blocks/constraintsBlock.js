/**
 * @fileoverview Блок B_constraints — технічні обмеження для генерації коду.
 * Підрозділ 3.3 записки. Статичний текст — не залежить від chartType чи schema.
 *
 * Містить:
 * - заборону застарілих D3.js API (d3.nest, d3.csv, d3.tsv)
 * - вимогу динамічних width/height
 * - вимогу SVG, осей, tooltip
 * - формат відповіді (лише ```javascript block)
 */

/**
 * Формує блок B_constraints системного промпту.
 * Точний текст відповідає Лістингу 3.3 підрозділу 3.3 записки.
 *
 * @returns {string} Статичний текст блоку B_constraints.
 */
export function buildConstraintsBlock() {
  return [
    '[Constraints]',
    '- Use ONLY D3.js v7. Forbidden: d3.nest(), d3.csv(), d3.tsv()',
    '- Calculate width/height dynamically from containerSelector bounds',
    '- Append SVG to containerSelector, do not use hardcoded IDs',
    '- Include: axis labels, legend, hover tooltip via d3.select().on("mouseover")',
    '- Return ONLY valid JavaScript inside a single ```javascript block',
    '- Do not output HTML, CSS, or explanation text',
  ].join('\n');
}
