// CSV → Schema JSON.

import Papa from 'papaparse';
import { inferColumnType } from './typeInference.js';
import { computeStats } from './statistics.js';

const DEFAULT_ANALYSIS_ROWS = 100;
const DEFAULT_SAMPLE_ROWS = 3;

function parseCsv(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // keep raw strings — type inference is handled separately
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    const critical = result.errors.filter((e) => e.type !== 'FieldMismatch');
    if (critical.length > 0) {
      throw new Error(`CSV parse error: ${critical[0].message}`);
    }
  }
  return {
    rows: result.data,
    columns: result.meta.fields ?? [],
    delimiter: result.meta.delimiter,
  };
}

function stratifiedSample(rows, columnDescriptions, sampleSize) {
  if (rows.length <= sampleSize) return rows;

  const categoricalCol = columnDescriptions.find((c) => c.type === 'Categorical');
  if (!categoricalCol) {
    // random sample
    const indices = new Set();
    while (indices.size < sampleSize) {
      indices.add(Math.floor(Math.random() * rows.length));
    }
    return [...indices].map((i) => rows[i]);
  }

  const groups = new Map();
  for (const row of rows) {
    const key = row[categoricalCol.name];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const keys = [...groups.keys()];
  const sample = [];
  let idx = 0;
  while (sample.length < sampleSize && keys.length > 0) {
    const key = keys[idx % keys.length];
    const group = groups.get(key);
    if (group.length > 0) sample.push(group.shift());
    idx += 1;
    if (idx > sampleSize * keys.length * 2) break; // safety
  }
  return sample.length > 0 ? sample : rows.slice(0, sampleSize);
}

/**
 * @param {string} csvText
 * @param {object} options - { analysisRows, sampleRows }.
 */
export function inferSchema(csvText, options = {}) {
  const analysisRows = options.analysisRows ?? DEFAULT_ANALYSIS_ROWS;
  const sampleRows = options.sampleRows ?? DEFAULT_SAMPLE_ROWS;

  const { rows, columns } = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error('CSV contains no data rows');
  }
  if (columns.length === 0) {
    throw new Error('CSV contains no columns');
  }

  const analysisSubset = rows.slice(0, analysisRows);

  const columnDescriptions = columns.map((col) => {
    const values = analysisSubset.map((row) => row[col] ?? null);
    const type = inferColumnType(values);
    const stats = computeStats(values, type);
    return { name: col, type, ...stats };
  });

  const sample = stratifiedSample(rows, columnDescriptions, sampleRows);

  return {
    total_rows: rows.length,
    columns: columnDescriptions,
    sample,
  };
}
