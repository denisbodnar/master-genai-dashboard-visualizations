/**
 * @fileoverview Публічний фасад модуля promptBuilder.
 * Підрозділ 3.3 записки: формула P = B_role ⊕ B_schema ⊕ B_chart ⊕ B_shots ⊕ B_constraints.
 *
 * Три режими генерації (Таблиця 3.1):
 *   zero-shot: B_role + B_schema + B_chart + B_constraints
 *   few-shot:  zero-shot + B_shots
 *   cot:       zero-shot з CoT-версією B_role
 *
 * Дві стратегії передачі даних (підрозділ 2.3.2, Розділ 5):
 *   schema-sample: B_schema містить Schema JSON + 3 рядки вибірки (default)
 *   full-csv:      B_schema містить сирий CSV (перші 50 рядків)
 */

import { buildRoleBlock } from './blocks/roleBlock.js';
import { buildSchemaBlock } from './blocks/schemaBlock.js';
import { buildFullCsvBlock } from './blocks/fullCsvBlock.js';
import { buildChartBlock } from './blocks/chartBlock.js';
import { buildShotsBlock } from './blocks/shotsBlock.js';
import { buildConstraintsBlock } from './blocks/constraintsBlock.js';

/**
 * Формує системний та користувацький промпти для LLM-провайдера.
 *
 * @param {object} opts
 * @param {object} opts.schema           - Schema JSON (результат inferSchema).
 * @param {string} opts.chartType        - Тип графіка (з chartSelector).
 * @param {object} opts.encoding         - Маппінг стовпців (з resolveEncoding).
 * @param {'zero-shot'|'few-shot'|'cot'} [opts.mode='zero-shot'] - Режим генерації.
 * @param {'schema-sample'|'full-csv'}   [opts.dataStrategy='schema-sample'] - Стратегія передачі даних.
 * @param {string}  [opts.csvText]       - Сирий CSV-текст (потрібен лише для full-csv).
 * @param {boolean} [opts.includeShots]  - Явне перемикання few-shot (перекриває mode).
 * @returns {Promise<{ systemPrompt: string, userPrompt: string }>}
 */
export async function buildPrompt({
  schema,
  chartType,
  encoding,
  mode = 'zero-shot',
  dataStrategy = 'schema-sample',
  csvText = null,
  includeShots,
}) {
  // Блоки, присутні у всіх режимах
  const roleBlock = buildRoleBlock({ chartType, mode });
  const chartBlock = buildChartBlock({ chartType, encoding });
  const constraintsBlock = buildConstraintsBlock();

  // ── B_schema: залежить від стратегії передачі даних ───────────────────────
  let schemaBlock;
  if (dataStrategy === 'full-csv' && csvText) {
    schemaBlock = buildFullCsvBlock(csvText, schema?.total_rows);
  } else {
    // За замовчуванням — Schema + Sample (підрозділ 2.3.2)
    schemaBlock = buildSchemaBlock(schema);
  }

  // Визначаємо, чи включати few-shot
  const useFewShot = includeShots !== undefined ? includeShots : mode === 'few-shot';

  const blocks = [roleBlock, schemaBlock, chartBlock];

  if (useFewShot) {
    const shotsBlock = await buildShotsBlock(chartType);
    if (shotsBlock) blocks.push(shotsBlock);
  }

  blocks.push(constraintsBlock);

  const systemPrompt = blocks.join('\n\n');

  // User-prompt — короткий тригер (підрозділ 3.3)
  const userPrompt = 'Generate the D3.js visualization code based on the schema.';

  return { systemPrompt, userPrompt };
}

export { buildRoleBlock, buildSchemaBlock, buildChartBlock, buildShotsBlock, buildConstraintsBlock };
export { buildFullCsvBlock };
