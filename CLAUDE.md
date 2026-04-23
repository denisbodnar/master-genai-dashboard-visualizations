# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GenAI-Viz** is a Master's thesis project: a full-stack system that automatically generates interactive D3.js v7 visualizations from CSV files. It combines deterministic data analysis with LLM-powered code generation and a Self-Refine loop for iterative error correction.

**Stack:** Node.js 20+, Express 4, ESM (`"type": "module"`), Vue 3 + Vite + D3.js v7, Vanilla CSS (Glassmorphism dark theme), native `node:test`, OpenAI SDK + Ollama HTTP API, `acorn` AST parsing, `node:vm` sandbox.

## Commands

```bash
# Install all workspace dependencies (Node.js 20+ required)
npm install

# Development (run both together)
npm run dev:server    # Express on port 3001, --watch mode
npm run dev:client    # Vite on port 5173, proxies /api → localhost:3001

# Testing
npm run test:server   # 123 unit tests via node:test

# Experiments
npm run exp:run:dry   # Dry-run with mock LLM (no API key needed, 40% fallback rate)
npm run exp:run       # Full experiment matrix (requires API keys in .env)
                      # Supports flags: --dataset D01 --provider openai --mode few-shot --strategy schema-sample
npm run exp:summarize # Generate ASCII metrics table from JSONL results

# Run a single test file
cd server && node --test test/orchestrator.test.js
```

Copy `.env.example` to `.env` and fill in `OPENAI_API_KEY` before running `exp:run`.

## Architecture

The project is a monorepo (npm workspaces): `server/`, `client/`, `experiments/`, `datasets/`.

### Backend Pipeline (`server/src/modules/`)

Five sequential modules form the core pipeline:

1. **`schemaInference/`** — Parses CSV via `papaparse`, classifies columns (`Numeric`/`Temporal`/`Categorical`) using heuristic rules (no LLM), computes statistics, and produces a stratified sample (N=3 rows). Output: compact JSON schema (~200-400 tokens).

2. **`chartSelector/`** — 7 priority rules map schema patterns to chart types (e.g., 2×Numeric → scatter). Falls back to LLM in JSON mode only when rules don't match. Always returns `chartType` + `encoding`.

3. **`llmProvider/`** — Abstract `ILLMProvider` interface with `OpenAIProvider` (openai SDK, retry logic) and `OllamaProvider` (native fetch + AbortController timeout). `createProvider(name, overrides)` factory.

4. **`promptBuilder/`** — Assembles 5-block prompts: `roleBlock + schemaBlock + chartBlock + shotsBlock + constraintsBlock`. Three modes: `zero-shot`, `few-shot` (injects 7 real D3.js examples from `examples/`), `cot` (Chain-of-Thought). Two data strategies: `schema-sample` (default, Schema JSON + 3 sample rows) and `full-csv` (raw CSV, first 50 rows) — this is the key axis of comparison in experiments. Also builds `feedbackPrompt` for Self-Refine iterations.

5. **`orchestrator/`** — Main facade. Runs the Self-Refine loop: generate → validate → (on error) refine → validate → ... (max `MAX_REFINE_ITERATIONS=3`). Accepts options `{ provider, mode, dataStrategy, maxRefineIterations, sandboxTimeoutMs, logger }`. Returns `{ status, code, chartType, encoding, iterations, validationLog, totalLatencyMs, totalTokens, dataStrategy }`. On loop exhaustion, falls back to `fallbackTemplates.js`.

**Validator** (called by orchestrator, two levels):
- **Level 1 Static** (`staticAnalyzer.js` via `acorn`): checks syntax, requires `function renderChart(data, containerSelector)` signature, blacklists `eval`, `fetch`, `XMLHttpRequest`, `d3.csv`, `d3.tsv`, `new Function`, `import()`.
- **Level 2 Sandbox** (`sandbox.js` via `node:vm`): runs code in isolated context with `MockD3` (Proxy-based D3 mock), sample data, 2000ms timeout, then checks SVG was appended and data bindings made.

**API endpoints** (`server/src/index.js`):
```
GET  /api/health      → {status, version}
POST /api/analyze     → CSV → {schema}
POST /api/select-chart → CSV → {schema, recommendation}
POST /api/generate    → CSV + ?provider=openai|ollama
                             &mode=zero-shot|few-shot|cot
                             &strategy=schema-sample|full-csv
                      → orchestrate result
```

**Logger** (`logger/`): `JSONLLogger` writes synchronously via `appendFileSync` to JSONL format for experiment analysis.

### Frontend (`client/src/`)

Global state lives in `App.vue`. Key components:

- **`ChartRenderer.vue`** — Executes D3 code via `new Function('d3', 'data', 'container', code)`, rendering into the Vue DOM. Has Code/Preview tabs.
- **`GenerationLogs.vue`** — Visualizes the `validationLog` array from the server, showing each Self-Refine iteration (status, error trace, tokens, latency).
- **`FileUploader.vue`** — Drag-and-drop CSV input.
- **`ConfigurationPanel.vue`** — Provider (OpenAI/Ollama) and mode (zero-shot/few-shot/cot) selector.
- **`services/api.js`** — axios wrapper, POSTs to `/api/generate`.

### Experiments (`experiments/`)

`runner.js` is a CLI that runs the 18-dataset × provider × mode matrix defined in `configs/matrix.json`. `summarize.js` reads JSONL from `results/` and computes Success Rate, Fallback Rate, Chart Match Rate, Avg Iterations, Avg Latency.

## Key Policies

1. **Do not modify `validator/mockD3.js`** without explicit approval. It is the most sensitive component — a Proxy-based D3 interceptor with specific chaining behavior that the entire sandbox validation depends on.

2. **Keep schema inference and chart selection deterministic.** Avoid adding LLM calls to `schemaInference` or `chartSelector` if pure JS rules can solve it.

3. **D3 security constraint.** Generated charts must depend only on the `data` argument passed to `renderChart`. External data loading (`d3.csv`, `d3.tsv`, `fetch`) is blocked at the AST level — do not weaken these checks.

4. **Use Vanilla CSS with CSS variables** for all styling. Do not introduce TailwindCSS or other CSS frameworks.

5. **The project is feature-complete** (all 8 thesis stages implemented). Do not propose new core modules unless explicitly requested.

## Testing

123 unit tests using native `node:test` across 7 files in `server/test/`. No Jest, Mocha, or Vitest. Tests cover all modules including MockD3 sandbox scenarios, Self-Refine loop paths, and validator edge cases.
