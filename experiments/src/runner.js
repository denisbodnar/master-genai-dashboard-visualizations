#!/usr/bin/env node
// CLI runner for the experiment matrix (dataset × provider × mode × dataStrategy).
// Usage: node src/runner.js [--dataset <id>] [--provider openai|ollama] [--mode zero-shot|few-shot|cot]
//        [--strategy schema-sample|full-csv] [--dry-run] [--out <dir>] [--help]

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const { orchestrate } = await import(`${ROOT}/server/src/modules/orchestrator/index.js`);
const { JSONLLogger } = await import(`${ROOT}/server/src/modules/logger/index.js`);
const { createProvider } = await import(`${ROOT}/server/src/modules/llmProvider/index.js`);

// vm errors in Node.js 22+ can escape try/catch inside executeInSandbox and reach
// the process level — without these handlers one bad generation aborts the whole matrix.
process.on('uncaughtException', (err) => {
  console.error(`\n  ⚠  uncaughtException intercepted: ${err.message}`);
  console.error(`     (continuing experiment matrix)\n`);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error(`\n  ⚠  unhandledRejection intercepted: ${msg}`);
  console.error(`     (continuing experiment matrix)\n`);
});

const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
Usage: node src/runner.js [options]

Options:
  --dataset  <id>      Run only specific dataset (e.g. D01, D03)
  --provider <name>    openai | ollama (default: from matrix.json)
  --mode     <name>    zero-shot | few-shot | cot (default: all modes)
  --strategy <name>    schema-sample | full-csv (default: all strategies)
  --dry-run            Use mock LLM provider (no API keys required)
  --out      <dir>     Output JSONL directory (default: ../../results/)
  --help               Show this help
`);
  process.exit(0);
}

const getArg = (flag, def = null) => {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
};

const isDryRun        = args.includes('--dry-run');
const filterDataset   = getArg('--dataset');
const filterProvider  = getArg('--provider');
const filterMode      = getArg('--mode');
const filterStrategy  = getArg('--strategy');
const outDir          = getArg('--out')
  ? path.resolve(getArg('--out'))
  : path.resolve(__dirname, '../../results');

const matrixPath = path.resolve(__dirname, '../configs/matrix.json');
const matrix     = JSON.parse(readFileSync(matrixPath, 'utf-8'));

const providers      = filterProvider ? [filterProvider] : (isDryRun ? ['dry-run'] : matrix.providers);
const modes          = filterMode     ? [filterMode]     : matrix.modes;
const dataStrategies = filterStrategy ? [filterStrategy] : matrix.dataStrategies;
const datasets       = matrix.datasets.filter(d => {
  if (filterDataset && d.id !== filterDataset) return false;
  if (d.external) {
    const filePath = path.resolve(__dirname, '..', d.file);
    if (!existsSync(filePath)) {
      console.warn(`⚠  [SKIP] ${d.id} (${d.name}) — external dataset file not found: ${filePath}`);
      console.warn(`   Download from: ${d.externalUrl ?? 'N/A'}`);
      return false;
    }
  }
  return true;
});

const MOCK_VALID_CODE = `
function renderChart(data, containerSelector) {
  const svg = d3.select(containerSelector).append('svg');
  svg.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', 0)
    .attr('y', 0);
}
`.trim();

function createMockProvider(simulateFailRate = 0) {
  let callCount = 0;
  return {
    async generateCode() {
      callCount++;
      const code = (Math.random() < simulateFailRate && callCount === 1)
        ? 'function renderChart(data, c) { d3.select(c).append("svg"); }'  // no .data() → fail
        : MOCK_VALID_CODE;
      return {
        content: '```javascript\n' + code + '\n```',
        usage: { promptTokens: 150 + Math.floor(Math.random() * 100), completionTokens: 200 + Math.floor(Math.random() * 150), latencyMs: 50 + Math.random() * 200 },
        raw: {}
      };
    },
    async refineCode() {
      return {
        content: '```javascript\n' + MOCK_VALID_CODE + '\n```',
        usage: { promptTokens: 200, completionTokens: 150, latencyMs: 30 },
        raw: {}
      };
    },
    async selectChartType({ candidates }) {
      return { chartType: candidates[0] ?? 'bar', reasoning: 'mock' };
    }
  };
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(outDir, `run-${runId}.jsonl`);
const logger = new JSONLLogger(logFile);

const total   = datasets.length * providers.length * modes.length * dataStrategies.length;
let done      = 0;
let succeeded = 0;
let failed    = 0;

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              GenAI-Viz Experiment Runner                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`  Mode      : ${isDryRun ? '🧪 DRY RUN (mock LLM)' : '🔥 LIVE'}`);
console.log(`  Total     : ${total} experiment(s)`);
console.log(`  Breakdown : ${datasets.length} datasets × ${providers.length} providers × ${modes.length} modes × ${dataStrategies.length} strategies`);
console.log(`  Log       : ${logFile}`);
console.log('──────────────────────────────────────────────────────────────\n');

for (const dataset of datasets) {
  const csvPath = path.resolve(__dirname, '..', dataset.file);

  if (!existsSync(csvPath)) {
    console.log(`⚠  [SKIP] ${dataset.id} ${dataset.name} — file not found at ${csvPath}`);
    continue;
  }

  const csv = readFileSync(csvPath, 'utf-8');

  for (const providerName of providers) {
    for (const mode of modes) {
      for (const dataStrategy of dataStrategies) {
        done++;
        const label = `[${done}/${total}] ${dataset.id}(${dataset.name}) | ${providerName} | ${mode} | ${dataStrategy}`;
        process.stdout.write(`  ▶ ${label} ... `);

        const expStart = performance.now();

        let provider = null;
        if (isDryRun || providerName === 'dry-run') {
          provider = createMockProvider(0.4);
        } else {
          try {
            provider = createProvider(providerName);
          } catch (err) {
            console.log(`SKIP (${err.message})`);
            logger.log(null, {
              event: 'experiment_skip',
              datasetId: dataset.id, datasetName: dataset.name,
              provider: providerName, mode, dataStrategy,
              reason: err.message
            });
            failed++;
            continue;
          }
        }

        const experimentId = `${dataset.id}__${providerName}__${mode}__${dataStrategy}__${runId}`;

        logger.log(experimentId, {
          event: 'experiment_start',
          datasetId: dataset.id, datasetName: dataset.name,
          expectedChart: dataset.expectedChart,
          provider: providerName, mode, dataStrategy,
          csvRows: dataset.rows
        });

        let result;
        try {
          result = await orchestrate({
            csv,
            options: { provider, mode, dataStrategy, logger: { log: (_, e) => logger.log(experimentId, e) } }
          });

          const elapsed = ((performance.now() - expStart) / 1000).toFixed(2);
          const icon = result.status === 'success' ? '✅' : '⚠️ ';
          console.log(`${icon} ${result.status.toUpperCase()} (${result.iterations} iter, ${elapsed}s, ${result.totalTokens}tok)`);
          if (result.status === 'success') succeeded++; else failed++;

          logger.log(experimentId, {
            event: 'experiment_done',
            datasetId: dataset.id, datasetName: dataset.name,
            expectedChart: dataset.expectedChart,
            actualChart: result.chartType,
            chartMatch: result.chartType === dataset.expectedChart,
            provider: providerName, mode, dataStrategy,
            status: result.status,
            iterations: result.iterations,
            totalLatencyMs: result.totalLatencyMs,
            totalTokens: result.totalTokens,
            validationLog: result.validationLog
          });

        } catch (err) {
          const elapsed = ((performance.now() - expStart) / 1000).toFixed(2);
          console.log(`❌ ERROR (${elapsed}s): ${err.message}`);
          failed++;
          logger.log(experimentId, {
            event: 'experiment_error',
            datasetId: dataset.id, datasetName: dataset.name,
            provider: providerName, mode, dataStrategy,
            error: err.message
          });
        }
      }
    }
  }
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(`  Done : ${done}/${total}`);
console.log(`  ✅   : ${succeeded}  |  ❌ : ${failed}`);
console.log(`  Log  : ${logFile}`);
console.log(`\n  Run summarize to compute metrics:`);
console.log(`  node src/summarize.js --log ${logFile}`);
console.log('──────────────────────────────────────────────────────────────\n');
