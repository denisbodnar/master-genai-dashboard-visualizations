/**
 * @fileoverview B_shots block — few-shot examples (optional).
 *
 * Few-shot examples reduce the number of D3.js v7 API syntax errors,
 * in particular incorrect use of deprecated methods [35].
 *
 * Loads an example from `examples/{chartType}.js`.
 * If no example exists, returns an empty string (graceful degradation).
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.resolve(__dirname, '../examples');

/**
 * Builds the B_shots block of the system prompt.
 * Dynamically imports the example for the given chartType.
 *
 * @param {string} chartType - Chart type (e.g. 'bar', 'line').
 * @returns {Promise<string>} Block text, or an empty string if no example exists.
 */
export async function buildShotsBlock(chartType) {
  const examplePath = path.join(EXAMPLES_DIR, `${chartType}.js`);

  let example;
  try {
    const mod = await import(`${examplePath}?t=${Date.now()}`);
    example = mod.default ?? mod;
  } catch {
    // No example found for this chart type — return an empty string
    return '';
  }

  if (!example || !example.code) return '';

  return [
    '[Example]',
    '// Schema for this example:',
    JSON.stringify(example.schema, null, 2),
    '// D3.js v7 code:',
    '```javascript',
    example.code.trim(),
    '```',
  ].join('\n');
}
