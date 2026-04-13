import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRules, selectChartType } from '../src/modules/chartSelector/index.js';

/**
 * Допоміжна функція для побудови мінімальної схеми.
 */
function makeSchema(cols, totalRows = 100) {
  return {
    total_rows: totalRows,
    columns: cols,
    sample: [],
  };
}

function numCol(name) {
  return { name, type: 'Numeric', min: 0, max: 100, mean: 50, std: 10, null_rate: 0 };
}
function catCol(name, cardinality = 4) {
  return { name, type: 'Categorical', cardinality, mode: 'A', null_rate: 0 };
}
function tempCol(name) {
  return { name, type: 'Temporal', range: ['2023-01-01', '2023-12-31'], step: 'month', null_rate: 0 };
}

test('R1: Temporal + multiple Numeric → multiline', () => {
  const schema = makeSchema([tempCol('date'), numCol('a'), numCol('b')]);
  assert.equal(applyRules(schema).chartType, 'multiline');
});

test('R2: Temporal + one Numeric → line', () => {
  const schema = makeSchema([tempCol('date'), numCol('revenue')]);
  assert.equal(applyRules(schema).chartType, 'line');
});

test('R3: 2 Categorical + 1 Numeric → grouped-bar', () => {
  const schema = makeSchema([catCol('region'), catCol('product'), numCol('sales')]);
  assert.equal(applyRules(schema).chartType, 'grouped-bar');
});

test('R4: 1 Categorical + 1 Numeric → bar', () => {
  const schema = makeSchema([catCol('product'), numCol('rating')]);
  assert.equal(applyRules(schema).chartType, 'bar');
});

test('R5: 1 Categorical + 2 Numeric → scatter-color', () => {
  const schema = makeSchema([catCol('group'), numCol('x'), numCol('y')]);
  assert.equal(applyRules(schema).chartType, 'scatter-color');
});

test('R6: 2 Numeric only → scatter', () => {
  const schema = makeSchema([numCol('x'), numCol('y')]);
  assert.equal(applyRules(schema).chartType, 'scatter');
});

test('R7: 1 Categorical low cardinality → pie', () => {
  const schema = makeSchema([catCol('segment', 4)]);
  assert.equal(applyRules(schema).chartType, 'pie');
});

test('R7 negative: high cardinality → no rule', () => {
  const schema = makeSchema([catCol('user_id', 500)]);
  assert.equal(applyRules(schema), null);
});

test('Ambiguous schema with no LLM falls back gracefully', async () => {
  const schema = makeSchema([numCol('a'), numCol('b'), numCol('c'), numCol('d')]);
  const result = await selectChartType(schema, null);
  assert.equal(result.source, 'fallback-no-llm');
  assert.ok(['bar', 'pie'].includes(result.chartType));
});

test('selectChartType returns encoding with axis mapping', async () => {
  const schema = makeSchema([tempCol('date'), numCol('revenue')]);
  const result = await selectChartType(schema);
  assert.equal(result.chartType, 'line');
  assert.equal(result.source, 'rule-based');
  assert.equal(result.encoding.x, 'date');
  assert.equal(result.encoding.y, 'revenue');
});

test('LLM provider is called on ambiguous schema', async () => {
  const schema = makeSchema([numCol('a'), numCol('b'), numCol('c'), numCol('d')]);
  let called = false;
  const mockProvider = {
    async selectChartType({ schema: s, candidates }) {
      called = true;
      assert.ok(Array.isArray(candidates));
      assert.equal(s.columns.length, 4);
      return { chartType: 'heatmap', reasoning: 'mock' };
    },
  };
  const result = await selectChartType(schema, mockProvider);
  assert.equal(called, true);
  assert.equal(result.source, 'llm');
  assert.equal(result.chartType, 'heatmap');
});

test('selectChartType returns encoding for grouped-bar', async () => {
  const schema = makeSchema([catCol('region'), catCol('product'), numCol('sales')]);
  const result = await selectChartType(schema);
  assert.equal(result.chartType, 'grouped-bar');
  assert.equal(result.encoding.x, 'region');
  assert.equal(result.encoding.y, 'sales');
  assert.equal(result.encoding.groupBy, 'product');
});

test('Rule priority: Temporal+Numeric wins even with extra Categorical', () => {
  // Правила не обмежують надлишкові стовпці — часовий графік лишається пріоритетним.
  const schema = makeSchema([tempCol('date'), numCol('revenue'), catCol('region')]);
  const result = applyRules(schema);
  assert.equal(result.chartType, 'line');
  assert.equal(result.ruleId, 'R2');
});
