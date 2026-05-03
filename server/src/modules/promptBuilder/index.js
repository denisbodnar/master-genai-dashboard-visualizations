// Prompt builder facade — assembles system + user prompts from composable blocks.

import { buildRoleBlock } from './blocks/roleBlock.js';
import { buildSchemaBlock } from './blocks/schemaBlock.js';
import { buildFullCsvBlock } from './blocks/fullCsvBlock.js';
import { buildChartBlock } from './blocks/chartBlock.js';
import { buildShotsBlock } from './blocks/shotsBlock.js';
import { buildConstraintsBlock } from './blocks/constraintsBlock.js';

/**
 * @param {object} opts
 * @param {object} opts.schema
 * @param {string} opts.chartType
 * @param {object} opts.encoding
 * @param {'zero-shot'|'few-shot'|'cot'} [opts.mode='zero-shot']
 * @param {'schema-sample'|'full-csv'} [opts.dataStrategy='schema-sample']
 * @param {string}  [opts.csvText]
 * @param {boolean} [opts.includeShots]
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

  let schemaBlock;
  if (dataStrategy === 'full-csv' && csvText) {
    schemaBlock = buildFullCsvBlock(csvText, schema?.total_rows);
  } else {
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

  const userPrompt = 'Generate the D3.js visualization code based on the schema.';

  return { systemPrompt, userPrompt };
}

export { buildRoleBlock, buildSchemaBlock, buildChartBlock, buildShotsBlock, buildConstraintsBlock };
export { buildFullCsvBlock };
