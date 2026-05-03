/**
 * @fileoverview Unit-тести для модуля promptBuilder (Етап 3).
 * Покриває:
 *   - Структуру промпту у всіх 3 режимах (zero-shot, few-shot, cot)
 *   - Наявність/відсутність shots-блоку
 *   - Потрапляння chartType в обмеження
 *   - Snapshot одного канонічного випадку (bar, zero-shot)
 *   - buildFeedbackPrompt: структура Лістингу 3.2
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt } from '../src/modules/promptBuilder/index.js';
import { buildRoleBlock } from '../src/modules/promptBuilder/blocks/roleBlock.js';
import { buildSchemaBlock } from '../src/modules/promptBuilder/blocks/schemaBlock.js';
import { buildChartBlock } from '../src/modules/promptBuilder/blocks/chartBlock.js';
import { buildConstraintsBlock } from '../src/modules/promptBuilder/blocks/constraintsBlock.js';
import { buildFeedbackPrompt } from '../src/modules/promptBuilder/feedbackPrompt.js';

// ─── Фікстура ─────────────────────────────────────────────────────────────────

const SCHEMA = {
  total_rows: 12,
  columns: [
    { name: 'date', type: 'Temporal', range: ['2023-01-01', '2023-12-01'], step: 'month', null_rate: 0 },
    { name: 'revenue', type: 'Numeric', min: 1200, max: 98400, mean: 45300, null_rate: 0.02 },
  ],
  sample: [
    { date: '2023-01-01', revenue: 32000 },
    { date: '2023-06-01', revenue: 67000 },
  ],
};

const ENCODING = { x: 'date', y: 'revenue' };

// ═══════════════════════════════════════════════════════════════════════════════
// БЛОКИ: roleBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildRoleBlock', () => {
  it('zero-shot: не містить "Think step by step"', () => {
    const block = buildRoleBlock({ chartType: 'line', mode: 'zero-shot' });
    assert.ok(!block.includes('Think step by step'), 'zero-shot не має CoT');
    assert.ok(block.includes('line'), 'містить chartType');
  });

  it('few-shot: не містить "Think step by step"', () => {
    const block = buildRoleBlock({ chartType: 'bar', mode: 'few-shot' });
    assert.ok(!block.includes('Think step by step'), 'few-shot не має CoT');
  });

  it('cot: містить точну CoT-інструкцію з підрозділу 3.3', () => {
    const block = buildRoleBlock({ chartType: 'scatter', mode: 'cot' });
    assert.ok(block.includes('Think step by step:'), 'є CoT-заголовок');
    assert.ok(block.includes('1. Identify which columns map to axes'), 'крок 1');
    assert.ok(block.includes('2. Define scales and domains'), 'крок 2');
    assert.ok(block.includes('3. Bind data to DOM elements'), 'крок 3');
    assert.ok(block.includes('4. Add axes, labels, legend, and tooltip'), 'крок 4');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// БЛОКИ: schemaBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildSchemaBlock', () => {
  it('містить [Dataset], Schema та Sample секції', () => {
    const block = buildSchemaBlock(SCHEMA);
    assert.ok(block.includes('[Dataset]'));
    assert.ok(block.includes('Schema:'));
    assert.ok(block.includes('Sample:'));
  });

  it('серіалізує назви стовпців', () => {
    const block = buildSchemaBlock(SCHEMA);
    assert.ok(block.includes('date'));
    assert.ok(block.includes('revenue'));
  });

  it('включає sample-рядки', () => {
    const block = buildSchemaBlock(SCHEMA);
    assert.ok(block.includes('32000'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// БЛОКИ: chartBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildChartBlock', () => {
  it('містить [Chart Specification] та chartType', () => {
    const block = buildChartBlock({ chartType: 'bar', encoding: { x: 'category', y: 'sales' } });
    assert.ok(block.includes('[Chart Specification]'));
    assert.ok(block.includes('bar'));
    assert.ok(block.includes('do not change'), 'є попередження про фіксований тип');
  });

  it('включає X-axis та Y-axis для bar', () => {
    const block = buildChartBlock({ chartType: 'bar', encoding: { x: 'category', y: 'sales' } });
    assert.ok(block.includes('X-axis: category'));
    assert.ok(block.includes('Y-axis: sales'));
  });

  it('включає Color та GroupBy для scatter-color і grouped-bar', () => {
    const block = buildChartBlock({
      chartType: 'scatter-color',
      encoding: { x: 'age', y: 'income', color: 'education' },
    });
    assert.ok(block.includes('Color: education'));
  });

  it('включає Category для pie', () => {
    const block = buildChartBlock({ chartType: 'pie', encoding: { category: 'region' } });
    assert.ok(block.includes('Category: region'));
  });

  it('масив Y для multiline серіалізується через кому', () => {
    const block = buildChartBlock({
      chartType: 'multiline',
      encoding: { x: 'date', y: ['product_a', 'product_b'] },
    });
    assert.ok(block.includes('product_a, product_b'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// БЛОКИ: constraintsBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildConstraintsBlock', () => {
  it('містить [Constraints] і заборонені API', () => {
    const block = buildConstraintsBlock();
    assert.ok(block.includes('[Constraints]'));
    assert.ok(block.includes('d3.nest()'));
    assert.ok(block.includes('d3.csv()'));
    assert.ok(block.includes('d3.tsv()'));
  });

  it('вимагає динамічних розмірів', () => {
    const block = buildConstraintsBlock();
    assert.ok(block.includes('dynamically'));
  });

  it('вимагає```javascript блок', () => {
    const block = buildConstraintsBlock();
    assert.ok(block.includes('```javascript'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildPrompt: режими
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildPrompt — режими генерації', () => {
  it("zero-shot: системний промпт містить усі обов'язкові блоки", async () => {
    const { systemPrompt, userPrompt } = await buildPrompt({
      schema: SCHEMA,
      chartType: 'line',
      encoding: ENCODING,
      mode: 'zero-shot',
    });

    assert.ok(systemPrompt.includes('expert D3.js v7 developer'), 'B_role');
    assert.ok(systemPrompt.includes('[Dataset]'), 'B_schema');
    assert.ok(systemPrompt.includes('[Chart Specification]'), 'B_chart');
    assert.ok(systemPrompt.includes('[Constraints]'), 'B_constraints');
    assert.ok(!systemPrompt.includes('[Example]'), 'zero-shot: без shots');
    assert.equal(userPrompt, 'Generate the D3.js visualization code based on the schema.');
  });

  it('zero-shot: НЕ містить CoT-інструкцію', async () => {
    const { systemPrompt } = await buildPrompt({
      schema: SCHEMA,
      chartType: 'line',
      encoding: ENCODING,
      mode: 'zero-shot',
    });
    assert.ok(!systemPrompt.includes('Think step by step'));
  });

  it('cot: містить CoT-інструкцію', async () => {
    const { systemPrompt } = await buildPrompt({
      schema: SCHEMA,
      chartType: 'bar',
      encoding: { x: 'category', y: 'sales' },
      mode: 'cot',
    });
    assert.ok(systemPrompt.includes('Think step by step:'));
  });

  it('few-shot + існуючий тип: містить [Example]', async () => {
    const { systemPrompt } = await buildPrompt({
      schema: SCHEMA,
      chartType: 'bar',
      encoding: { x: 'date', y: 'revenue' },
      mode: 'few-shot',
    });
    assert.ok(systemPrompt.includes('[Example]'), 'few-shot має shots-блок для bar');
  });

  it('few-shot + відсутній тип: не падає, не має [Example]', async () => {
    const { systemPrompt } = await buildPrompt({
      schema: SCHEMA,
      chartType: 'heatmap',      // прикладу немає
      encoding: { x: 'a', y: 'b', value: 'c' },
      mode: 'few-shot',
    });
    assert.ok(!systemPrompt.includes('[Example]'), 'graceful: відсутній приклад → без блоку');
    assert.ok(systemPrompt.includes('[Constraints]'), 'constraints все одно є');
  });

  it('chartType потрапляє в блок обмежень', async () => {
    const { systemPrompt } = await buildPrompt({
      schema: SCHEMA,
      chartType: 'scatter',
      encoding: { x: 'x', y: 'y' },
      mode: 'zero-shot',
    });
    assert.ok(systemPrompt.includes('scatter'), 'chartType у промпті');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildPrompt: snapshot канонічного випадку (bar, zero-shot)
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildPrompt — snapshot canonical case (bar, zero-shot)', () => {
  it('системний промпт має очікувані секції у правильному порядку', async () => {
    const { systemPrompt } = await buildPrompt({
      schema: {
        total_rows: 6,
        columns: [
          { name: 'category', type: 'Categorical', cardinality: 6, null_rate: 0 },
          { name: 'sales', type: 'Numeric', min: 500, max: 8200, null_rate: 0 },
        ],
        sample: [{ category: 'A', sales: 1000 }],
      },
      chartType: 'bar',
      encoding: { x: 'category', y: 'sales' },
      mode: 'zero-shot',
    });

    const roleIdx = systemPrompt.indexOf('expert D3.js v7 developer');
    const datasetIdx = systemPrompt.indexOf('[Dataset]');
    const chartIdx = systemPrompt.indexOf('[Chart Specification]');
    const constraintsIdx = systemPrompt.indexOf('[Constraints]');

    assert.ok(roleIdx < datasetIdx, 'B_role перед B_schema');
    assert.ok(datasetIdx < chartIdx, 'B_schema перед B_chart');
    assert.ok(chartIdx < constraintsIdx, 'B_chart перед B_constraints');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// buildFeedbackPrompt
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildFeedbackPrompt', () => {
  it('містить [Error Report], [Original Code], [Task] з Лістингу 3.2', () => {
    const { systemPrompt } = buildFeedbackPrompt({
      originalCode: 'function renderChart(data, c) { }',
      errorTrace: 'syntax: Unexpected token at line 1',
      chartType: 'line',
      iteration: 1,
    });

    assert.ok(systemPrompt.includes('[Error Report]'));
    assert.ok(systemPrompt.includes('[Original Code]'));
    assert.ok(systemPrompt.includes('[Task]'));
  });

  it('містить номер ітерації', () => {
    const { systemPrompt } = buildFeedbackPrompt({
      originalCode: 'code',
      errorTrace: 'runtime: Error',
      chartType: 'bar',
      iteration: 2,
    });
    assert.ok(systemPrompt.includes('Iteration: 2 / 3'));
  });

  it('зберігає chartType у задачі', () => {
    const { systemPrompt } = buildFeedbackPrompt({
      originalCode: 'code',
      errorTrace: 'missing_d3_select',
      chartType: 'scatter',
      iteration: 1,
    });
    assert.ok(systemPrompt.includes('scatter'));
  });

  it('містить originalCode у тілі промпту', () => {
    const code = 'function renderChart(data, containerSelector) { d3.select(containerSelector); }';
    const { systemPrompt } = buildFeedbackPrompt({
      originalCode: code,
      errorTrace: 'data_not_bound',
      chartType: 'bar',
      iteration: 1,
    });
    assert.ok(systemPrompt.includes(code));
  });

  it('userPrompt є коротким тригером', () => {
    const { userPrompt } = buildFeedbackPrompt({
      originalCode: '',
      errorTrace: '',
      chartType: 'line',
      iteration: 1,
    });
    assert.ok(userPrompt.length < 100, 'userPrompt короткий');
    assert.ok(userPrompt.toLowerCase().includes('fix'));
  });
});
