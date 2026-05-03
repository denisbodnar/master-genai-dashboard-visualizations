// Static constraints block for the system prompt.

/** @returns {string} */
export function buildConstraintsBlock() {
  return [
    '[Constraints]',
    '- Use ONLY D3.js v7. Forbidden: d3.nest(), d3.csv(), d3.tsv()',
    '- Calculate width/height dynamically from containerSelector bounds',
    '- Append SVG to containerSelector, do not use hardcoded IDs',
    '- For numeric axes with highly skewed data (skewness > 2 or < -2 in Schema), forcefully prefer d3.scaleLog() or d3.scaleSymlog()',
    '- Include: axis labels, legend, hover tooltip via d3.select().on("mouseover")',
    '- Return ONLY valid JavaScript inside a single ```javascript block',
    '- Do not output HTML, CSS, or explanation text',
  ].join('\n');
}
