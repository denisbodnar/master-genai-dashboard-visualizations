import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inferSchema } from '../src/modules/schemaInference/index.js';
import { inferColumnType, isTemporalValue, isNumericValue } from '../src/modules/schemaInference/typeInference.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const datasetsDir = join(__dirname, '..', '..', 'datasets');

test('isTemporalValue detects ISO 8601 and EU dates', () => {
  assert.equal(isTemporalValue('2023-01-15'), true);
  assert.equal(isTemporalValue('2023-01-15T10:30:00'), true);
  assert.equal(isTemporalValue('15/01/2023'), true);
  assert.equal(isTemporalValue('not a date'), false);
  assert.equal(isTemporalValue('42'), false);
});

test('isNumericValue detects finite numbers', () => {
  assert.equal(isNumericValue('42'), true);
  assert.equal(isNumericValue('3.14'), true);
  assert.equal(isNumericValue('-10'), true);
  assert.equal(isNumericValue('abc'), false);
  assert.equal(isNumericValue(''), false);
  assert.equal(isNumericValue(null), false);
});

test('inferColumnType classifies Temporal column', () => {
  const values = ['2023-01-01', '2023-02-01', '2023-03-01', '', '2023-04-01'];
  assert.equal(inferColumnType(values), 'Temporal');
});

test('inferColumnType classifies Numeric column', () => {
  const values = ['41200', '38500', '45300', '52100'];
  assert.equal(inferColumnType(values), 'Numeric');
});

test('inferColumnType classifies Categorical column', () => {
  const values = ['North', 'South', 'East', 'West', 'North'];
  assert.equal(inferColumnType(values), 'Categorical');
});

test('inferSchema on sales_monthly.csv produces expected structure', () => {
  const csv = readFileSync(join(datasetsDir, 'sales_monthly.csv'), 'utf-8');
  const schema = inferSchema(csv);

  assert.equal(schema.total_rows, 12);
  assert.equal(schema.columns.length, 3);

  const dateCol = schema.columns.find((c) => c.name === 'date');
  const revenueCol = schema.columns.find((c) => c.name === 'revenue');
  const regionCol = schema.columns.find((c) => c.name === 'region');

  assert.equal(dateCol.type, 'Temporal');
  assert.equal(revenueCol.type, 'Numeric');
  assert.equal(regionCol.type, 'Categorical');

  assert.ok(revenueCol.min <= revenueCol.max);
  assert.ok(revenueCol.mean > 0);
  assert.equal(regionCol.cardinality, 4);

  assert.equal(schema.sample.length, 3);
});

test('inferSchema on products.csv produces Numeric + Categorical', () => {
  const csv = readFileSync(join(datasetsDir, 'products.csv'), 'utf-8');
  const schema = inferSchema(csv);

  assert.equal(schema.total_rows, 6);
  const ratingCol = schema.columns.find((c) => c.name === 'rating');
  const productCol = schema.columns.find((c) => c.name === 'product');

  assert.equal(ratingCol.type, 'Numeric');
  assert.equal(productCol.type, 'Categorical');
  assert.equal(productCol.cardinality, 6);
});

test('inferSchema throws on empty CSV', () => {
  assert.throws(() => inferSchema(''));
});
