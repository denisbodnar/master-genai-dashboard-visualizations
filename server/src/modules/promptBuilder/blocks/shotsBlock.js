/**
 * @fileoverview Блок B_shots — few-shot приклади (опціонально).
 * Підрозділ 3.3 записки.
 *
 * Few-shot приклади знижують кількість синтаксичних помилок D3.js v7 API,
 * зокрема некоректне використання застарілих методів [35].
 *
 * Завантажує приклад з `examples/{chartType}.js`.
 * Якщо приклад відсутній — повертає порожній рядок (graceful degradation).
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.resolve(__dirname, '../examples');

/**
 * Формує блок B_shots системного промпту.
 * Динамічно імпортує приклад для заданого chartType.
 *
 * @param {string} chartType - Тип графіка (наприклад, 'bar', 'line').
 * @returns {Promise<string>} Текст блоку або порожній рядок, якщо приклад відсутній.
 */
export async function buildShotsBlock(chartType) {
  const examplePath = path.join(EXAMPLES_DIR, `${chartType}.js`);

  let example;
  try {
    const mod = await import(`${examplePath}?t=${Date.now()}`);
    example = mod.default ?? mod;
  } catch {
    // Приклад для даного типу графіка відсутній — повертаємо порожній рядок
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
