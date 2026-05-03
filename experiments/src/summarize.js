#!/usr/bin/env node
// Aggregates experiment metrics from JSONL result files.
// Usage: node src/summarize.js [--log <file>] [--dir <dir>] [--format json|table]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const getArg = (flag, def = null) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };

const logFile   = getArg('--log');
const logDir    = getArg('--dir') ? path.resolve(getArg('--dir')) : path.resolve(__dirname, '../../results');
const outFormat = getArg('--format', 'table');

function loadLines(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return content.trim().split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

let allEntries = [];

if (logFile) {
  if (!existsSync(logFile)) { console.error(`File not found: ${logFile}`); process.exit(1); }
  allEntries = loadLines(logFile);
} else {
  if (!existsSync(logDir)) { console.error(`Results directory not found: ${logDir}`); process.exit(1); }
  const files = readdirSync(logDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) { console.error(`No .jsonl files found in ${logDir}`); process.exit(1); }
  for (const f of files) {
    allEntries.push(...loadLines(path.join(logDir, f)));
  }
}

const doneEntries = allEntries.filter(e => e.event === 'experiment_done');

if (doneEntries.length === 0) {
  console.warn('No completed experiments found. Run experiments first.');
  process.exit(0);
}

/**
 * @param {object[]} entries
 * @returns {object}
 */
function aggregate(entries) {
  const n = entries.length;
  if (n === 0) return null;

  const successes  = entries.filter(e => e.status === 'success');
  const fallbacks  = entries.filter(e => e.status === 'fallback');
  const chartMatch = entries.filter(e => e.chartMatch === true);

  const avgIterations = (entries.reduce((s, e) => s + (e.iterations  ?? 0), 0) / n).toFixed(2);
  const avgLatencyMs  = (entries.reduce((s, e) => s + (e.totalLatencyMs ?? 0), 0) / n).toFixed(0);
  const avgTokens     = (entries.reduce((s, e) => s + (e.totalTokens  ?? 0), 0) / n).toFixed(0);

  const errorTypes = {};
  for (const e of entries) {
    for (const log of e.validationLog ?? []) {
      if (!log.ok && log.errorType) {
        errorTypes[log.errorType] = (errorTypes[log.errorType] || 0) + 1;
      }
    }
  }

  return {
    n,
    successRate:    ((successes.length  / n) * 100).toFixed(1) + '%',
    fallbackRate:   ((fallbacks.length  / n) * 100).toFixed(1) + '%',
    chartMatchRate: ((chartMatch.length / n) * 100).toFixed(1) + '%',
    avgIterations,
    avgLatencyMs,
    avgTokens,
    errorTypes,
  };
}

const overall = aggregate(doneEntries);

const byProvider = {};
const byMode     = {};
const byStrategy = {};
const byDataset  = {};

for (const e of doneEntries) {
  const pKey = e.provider     ?? 'unknown';
  const mKey = e.mode         ?? 'unknown';
  const sKey = e.dataStrategy ?? 'unknown';
  const dKey = `${e.datasetId}(${e.datasetName})`;

  if (!byProvider[pKey]) byProvider[pKey] = [];
  if (!byMode[mKey])     byMode[mKey]     = [];
  if (!byStrategy[sKey]) byStrategy[sKey] = [];
  if (!byDataset[dKey])  byDataset[dKey]  = [];

  byProvider[pKey].push(e);
  byMode[mKey].push(e);
  byStrategy[sKey].push(e);
  byDataset[dKey].push(e);
}

if (outFormat === 'json') {
  const report = {
    generatedAt: new Date().toISOString(),
    totalExperiments: doneEntries.length,
    overall,
    byProvider:   Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [k, aggregate(v)])),
    byMode:       Object.fromEntries(Object.entries(byMode).map(([k, v]) => [k, aggregate(v)])),
    byStrategy:   Object.fromEntries(Object.entries(byStrategy).map(([k, v]) => [k, aggregate(v)])),
    byDataset:    Object.fromEntries(Object.entries(byDataset).map(([k, v]) => [k, aggregate(v)])),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const row = (label, m) => m
  ? `  ${label.padEnd(24)} | ${m.successRate.padStart(8)} | ${m.fallbackRate.padStart(9)} | ${m.chartMatchRate.padStart(11)} | ${m.avgIterations.padStart(8)} | ${(m.avgLatencyMs + 'ms').padStart(11)} | ${(m.avgTokens + 'tok').padStart(9)}`
  : `  ${label.padEnd(24)} | ${'N/A'.padStart(8)} | ${'N/A'.padStart(9)} | ${'N/A'.padStart(11)} | ${'N/A'.padStart(8)} | ${'N/A'.padStart(11)} | ${'N/A'.padStart(9)}`;

const header  = `  ${'Group'.padEnd(24)} | ${'Success%'.padStart(8)} | ${'Fallback%'.padStart(9)} | ${'ChartMatch%'.padStart(11)} | ${'AvgIter'.padStart(8)} | ${'AvgLatency'.padStart(11)} | ${'AvgTokens'.padStart(9)}`;
const divider = '─'.repeat(header.length);

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║            GenAI-Viz Experiment Results Summary                  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log(`  Total experiments analyzed: ${doneEntries.length}\n`);

console.log(divider);
console.log(header);
console.log(divider);
console.log(row('OVERALL', overall));
console.log(divider);

console.log('  BY PROVIDER');
for (const [k, v] of Object.entries(byProvider)) console.log(row(`  → ${k}`, aggregate(v)));
console.log(divider);

console.log('  BY MODE');
for (const [k, v] of Object.entries(byMode)) console.log(row(`  → ${k}`, aggregate(v)));
console.log(divider);

console.log('  BY DATA STRATEGY');
for (const [k, v] of Object.entries(byStrategy)) console.log(row(`  → ${k}`, aggregate(v)));
console.log(divider);

console.log('  BY DATASET');
for (const [k, v] of Object.entries(byDataset)) console.log(row(`  → ${k}`, aggregate(v)));
console.log(divider);

console.log('\n  Error Type Distribution (all experiments):');
const errorTypes = overall.errorTypes;
const totalErrors = Object.values(errorTypes).reduce((s, v) => s + v, 0);
if (totalErrors === 0) {
  console.log('    (no validation errors recorded)');
} else {
  for (const [type, count] of Object.entries(errorTypes).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / totalErrors) * 100).toFixed(1);
    console.log(`    ${type.padEnd(25)}: ${String(count).padStart(4)}  (${pct}%)`);
  }
}
console.log();
