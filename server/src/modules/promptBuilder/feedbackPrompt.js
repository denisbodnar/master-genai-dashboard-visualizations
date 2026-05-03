/**
 * @param {object} opts
 * @param {string} opts.originalCode
 * @param {string} opts.errorTrace
 * @param {string} opts.chartType
 * @param {number} opts.iteration
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

function _extractErrorType(errorTrace) {
  if (!errorTrace) return 'unknown';
  const firstLine = errorTrace.split('\n')[0];
  const match = firstLine.match(/^(\w+):/);
  return match ? match[1] : firstLine.slice(0, 60);
}
