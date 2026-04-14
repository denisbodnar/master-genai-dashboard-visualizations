#!/usr/bin/env node
/**
 * @fileoverview Агрегатор метрик для аналізу результатів матриці експериментів.
 * Підрозділ 5.2 записки: "Агрегація результатів по вісях provider, mode, dataset".
 *
 * Читає JSONL-файл (або директорію), рахує ключові метрики Розділу 5:
 * - Success Rate (%)
 * - Fallback Rate (%)
 * - Avg Iterations (кількість ітерацій Self-Refine до успіху/fallback)
 * - Avg Total Latency (ms)
 * - Avg Total Tokens
 * - Chart Match Rate (% збігу actualChart з expectedChart)
 * - Error Type Distribution
 *
 * Використання:
 *   node src/summarize.js --log <path-to-jsonl>
 *   node src/summarize.js --dir <path-to-results-dir>
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI аргументи ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag, def = null) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };

const logFile  = getArg('--log');
const logDir   = getArg('--dir') ? path.resolve(getArg('--dir')) : path.resolve(__dirname, '../../results');
const outFormat = getArg('--format', 'table'); // 'table' | 'json'

// ─── Завантаження JSONL-рядків ────────────────────────────────────────────────

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
  // Читаємо всі .jsonl файли з директорії
  if (!existsSync(logDir)) { console.error(`Results directory not found: ${logDir}`); process.exit(1); }
  const files = readdirSync(logDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) { console.error(`No .jsonl files found in ${logDir}`); process.exit(1); }
  for (const f of files) {
    allEntries.push(...loadLines(path.join(logDir, f)));
  }
}

// ─── Фільтруємо лише фінальні результати (experiment_done) ───────────────────

const doneEntries = allEntries.filter(e => e.event === 'experiment_done');

if (doneEntries.length === 0) {
  console.warn('No completed experiments found. Run experiments first.');
  process.exit(0);
}

// ─── Агрегація по вісях ───────────────────────────────────────────────────────

/**
 * Рахує метрики для групи записів.
 * @param {object[]} entries
 * @returns {object} Агреговані метрики
 */
function aggregate(entries) {
  const n = entries.length;
  if (n === 0) return null;

  const successes  = entries.filter(e => e.status === 'success');
  const fallbacks  = entries.filter(e => e.status === 'fallback');
  const chartMatch = entries.filter(e => e.chartMatch === true);

  const avgIterations  = (entries.reduce((s, e) => s + (e.iterations  ?? 0), 0) / n).toFixed(2);
  const avgLatencyMs   = (entries.reduce((s, e) => s + (e.totalLatencyMs ?? 0), 0) / n).toFixed(0);
  const avgTokens      = (entries.reduce((s, e) => s + (e.totalTokens  ?? 0), 0) / n).toFixed(0);

  // Розподіл типів помилок
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
    successRate:  ((successes.length  / n) * 100).toFixed(1) + '%',
    fallbackRate: ((fallbacks.length  / n) * 100).toFixed(1) + '%',
    chartMatchRate: ((chartMatch.length / n) * 100).toFixed(1) + '%',
    avgIterations,
    avgLatencyMs,
    avgTokens,
    errorTypes
  };
}

// ─── Підготовка звітів ────────────────────────────────────────────────────────

// Загальний
const overall = aggregate(doneEntries);

// По provider
const byProvider = {};
for (const e of doneEntries) {
  const key = e.provider ?? 'unknown';
  if (!byProvider[key]) byProvider[key] = [];
  byProvider[key].push(e);
}

// По mode
const byMode = {};
for (const e of doneEntries) {
  const key = e.mode ?? 'unknown';
  if (!byMode[key]) byMode[key] = [];
  byMode[key].push(e);
}

// По dataset
const byDataset = {};
for (const e of doneEntries) {
  const key = `${e.datasetId}(${e.datasetName})`;
  if (!byDataset[key]) byDataset[key] = [];
  byDataset[key].push(e);
}

// ─── Вивід ───────────────────────────────────────────────────────────────────

if (outFormat === 'json') {
  const report = {
    generatedAt: new Date().toISOString(),
    totalExperiments: doneEntries.length,
    overall,
    byProvider: Object.fromEntries(Object.entries(byProvider).map(([k, v]) => [k, aggregate(v)])),
    byMode:     Object.fromEntries(Object.entries(byMode).map(([k, v]) => [k, aggregate(v)])),
    byDataset:  Object.fromEntries(Object.entries(byDataset).map(([k, v]) => [k, aggregate(v)])),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// ── ASCII Table вивід ─────────────────────────────────────────────────────────

const row = (label, m) => m
  ? `  ${label.padEnd(22)} | ${m.successRate.padStart(8)} | ${m.fallbackRate.padStart(9)} | ${m.chartMatchRate.padStart(11)} | ${m.avgIterations.padStart(8)} | ${(m.avgLatencyMs + 'ms').padStart(11)} | ${(m.avgTokens + 'tok').padStart(9)}`
  : `  ${label.padEnd(22)} | ${'N/A'.padStart(8)} | ${'N/A'.padStart(9)} | ${'N/A'.padStart(11)} | ${'N/A'.padStart(8)} | ${'N/A'.padStart(11)} | ${'N/A'.padStart(9)}`;

const header = `  ${'Group'.padEnd(22)} | ${'Success%'.padStart(8)} | ${'Fallback%'.padStart(9)} | ${'ChartMatch%'.padStart(11)} | ${'AvgIter'.padStart(8)} | ${'AvgLatency'.padStart(11)} | ${'AvgTokens'.padStart(9)}`;
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

// По провайдеру
console.log('  BY PROVIDER');
for (const [key, entries] of Object.entries(byProvider)) {
  console.log(row(`  → ${key}`, aggregate(entries)));
}
console.log(divider);

// По режиму
console.log('  BY MODE');
for (const [key, entries] of Object.entries(byMode)) {
  console.log(row(`  → ${key}`, aggregate(entries)));
}
console.log(divider);

// По датасету
console.log('  BY DATASET');
for (const [key, entries] of Object.entries(byDataset)) {
  console.log(row(`  → ${key}`, aggregate(entries)));
}
console.log(divider);

// Розподіл помилок (загальний)
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
