
/**
 * Builds the B_role block of the system prompt.
 *
 * @param {object} opts
 * @param {string} opts.chartType - Chart type (e.g. 'bar', 'line').
 * @param {'zero-shot' | 'few-shot' | 'cot'} opts.mode - Generation mode.
 * @returns {string} B_role block text.
 */
export function buildRoleBlock({ chartType, mode }) {
  const base = [
    'You are an expert D3.js v7 developer.',
    'Your task is to generate a JavaScript function:',
    '  renderChart(data, containerSelector)',
    `that creates an interactive ${chartType} visualization.`,
  ].join('\n');

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
