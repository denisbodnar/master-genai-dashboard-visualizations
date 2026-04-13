# genai-viz

> GenAI-система автоматичної генерації інтерактивних D3.js-візуалізацій з CSV-файлів.
> Магістерська робота. Node.js 20+ · Express 4 · ESM · Vue 3 (у розробці).

---

## Поточний стан

| Етап | Модуль | Статус | Тестів |
|------|--------|--------|--------|
| 1 | Schema Inference + Chart Selector | ✅ Завершено | 21 |
| 2 | LLM Providers (OpenAI + Ollama) | ✅ Завершено | 25 |
| 3 | Prompt Builder (5 блоків, 3 режими) | ✅ Завершено | 26 |
| 4 | Validator + Sandbox (AST + vm) | ✅ Завершено | 30 |
| 5 | Orchestrator + Self-Refine | 🔲 Наступний | — |
| 6 | Logger (JSONL) | 🔲 Черга | — |
| 7 | Vue 3 Frontend | 🔲 Черга | — |
| 8 | Experiment Runner | 🔲 Черга | — |

**Разом: 94 unit-тести, всі проходять.**

---

## Структура проєкту

```
genai-viz/
├── package.json                   npm workspaces, ESM ("type": "module")
├── .env.example                   шаблон змінних середовища
├── server/
│   ├── src/
│   │   ├── index.js               Express: /api/health, /api/analyze, /api/select-chart
│   │   ├── config.js              dotenv: OpenAI, Ollama, refine, schema
│   │   └── modules/
│   │       ├── schemaInference/   Алгоритм 3.1 — CSV → Schema JSON
│   │       ├── chartSelector/     Алгоритм 3.2 — rule-based + LLM fallback
│   │       ├── llmProvider/       OpenAIProvider, OllamaProvider, createProvider()
│   │       ├── promptBuilder/     buildPrompt(), 5 блоків, few-shot приклади
│   │       │   ├── blocks/        roleBlock, schemaBlock, chartBlock, shotsBlock, constraintsBlock
│   │       │   └── examples/      line, bar, scatter, pie, multiline, grouped-bar, scatter-color
│   │       ├── validator/         staticAnalyze (AST) + executeInSandbox (vm + MockD3)
│   │       ├── orchestrator/      (наступний етап)
│   │       └── logger/            (наступний етап)
│   └── test/
│       ├── schemaInference.test.js
│       ├── chartSelector.test.js
│       ├── llmProvider.test.js
│       ├── promptBuilder.test.js
│       └── validator.test.js
├── datasets/                      тестові CSV + meta.json (у розробці)
├── client/                        Vue 3 + Vite (наступний етап)
├── experiments/                   CLI runner для матриці експериментів (наступний етап)
└── results/                       JSONL-логи та звіти
```

---

## Швидкий старт

```bash
# 1. Встановити залежності (Node.js 20+)
npm install

# 2. Скопіювати конфіг
cp .env.example .env
# Заповнити OPENAI_API_KEY та/або OLLAMA_BASE_URL

# 3. Запустити тести
npm run test:server

# 4. Запустити сервер (порт 3001)
npm run dev:server
```

---

## API-ендпоінти

### `GET /api/health`
```bash
curl http://localhost:3001/api/health
# → {"status":"ok","version":"0.1.0"}
```

### `POST /api/analyze` — CSV → Schema JSON
```bash
curl -X POST -F "file=@datasets/sales_monthly.csv" \
     http://localhost:3001/api/analyze
```

### `POST /api/select-chart` — CSV → тип графіка + encoding

| Query param | Значення | Поведінка |
|---|---|---|
| `?provider=none` | (default) | rule-based без LLM |
| `?provider=openai` | потрібен `OPENAI_API_KEY` | LLM fallback через OpenAI |
| `?provider=ollama` | потрібен локальний Ollama | LLM fallback через Ollama |

```bash
# Rule-based
curl -X POST -F "file=@datasets/sales_monthly.csv" \
     http://localhost:3001/api/select-chart

# З OpenAI-провайдером
curl -X POST -F "file=@datasets/sales_monthly.csv" \
     "http://localhost:3001/api/select-chart?provider=openai"
```

---

## Реалізовані модулі

### Етап 1 — Schema Inference + Chart Selector

- **Schema Inference** (`schemaInference/`): парсинг CSV, класифікація стовпців (Temporal / Numeric / Categorical) за ієрархією евристик, статистики, вибірка 3 рядків → Schema JSON (~200-400 токенів).
- **Chart Selector** (`chartSelector/`): 7 rule-based правил із пріоритетом (Таблиця 3.1), LLM-fallback для неоднозначних випадків, `resolveEncoding()` → маппінг осей.

### Етап 2 — LLM Providers

- **`ILLMProvider.js`** — JSDoc-typedef: `generateCode`, `refineCode`, `selectChartType`.
- **`OpenAIProvider`** — `performance.now()` latency, retryable/non-retryable класифікація (429 → retryable, 401 → non-retryable), JSON-mode для chart selection.
- **`OllamaProvider`** — native `fetch` + `AbortController` timeout, HTTP 404 → `ollama pull <model>` hint.
- **`createProvider(name, overrides)`** — фабрика.

### Етап 3 — Prompt Builder

Формула: `P = B_role ⊕ B_schema ⊕ B_chart ⊕ B_shots ⊕ B_constraints` (підрозділ 3.3).

| Режим | Склад |
|---|---|
| `zero-shot` | role + schema + chart + constraints |
| `few-shot` | + shots (приклад із `examples/`) |
| `cot` | + CoT крок-за-кроком у role-блоці |

- **`feedbackPrompt.js`** — `buildFeedbackPrompt()` за Лістингом 3.2 (Self-Refine [24]).
- **`examples/`** — 7 повних D3.js v7 прикладів: `line`, `bar`, `scatter`, `pie`, `multiline`, `grouped-bar`, `scatter-color`.

### Етап 4 — Validator + Sandbox

Дворівнева валідація (підрозділ 3.4):

**Рівень 1 — `staticAnalyze(code)`** (acorn AST, без виконання):
1. Синтаксичний парсинг → `errorType: syntax`
2. Наявність `renderChart` → `missing_render_chart`
3. Сигнатура `(data, containerSelector)` → `wrong_signature`
4. Чорний список: `eval`, `fetch`, `XMLHttpRequest`, `d3.csv`, `d3.tsv`, `d3.nest`, `new Function`, `import()` → `forbidden_api`
5. Наявність `d3.select(...)` → `missing_d3_select`

**Рівень 2 — `executeInSandbox(code, {sample})`** (Node.js `vm`):
- Ізольований контекст: `MockD3` + `data = sample` + заглушка `console`
- Таймаут (default 2000ms) → перериває нескінченні цикли
- Перевірки після виконання: `svgAppended` та `dataBindCalls > 0`

---

## Покриття тестами

| Файл | Тестів | Що перевіряє |
|---|---|---|
| `schemaInference.test.js` | 8 | типізація, статистики, edge cases |
| `chartSelector.test.js` | 13 | всі 7 правил, LLM-fallback, encoding |
| `llmProvider.test.js` | 25 | payload, парсинг, retry, latency, factory |
| `promptBuilder.test.js` | 26 | блоки, 3 режими, shots, snapshot, feedback |
| `validator.test.js` | 30 | AST-перевірки, MockD3, sandbox, pipeline |
| **Разом** | **94** | **всі проходять** |

---

## Змінні середовища (`.env`)

```env
PORT=3001

# OpenAI (Етап 2+)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Ollama (Етап 2+)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b

# Schema inference
SCHEMA_ANALYSIS_ROWS=100
SAMPLE_ROWS=3

# Self-Refine (Етап 5+)
MAX_REFINE_ITERATIONS=3
SANDBOX_TIMEOUT_MS=2000
```

---

## Технічний стек

- **Backend**: Node.js 20+, Express 4, ESM (`"type": "module"`)
- **LLM**: `openai` SDK, Ollama HTTP API (native `fetch`)
- **AST**: `acorn` + `acorn-walk`
- **Sandbox**: вбудований `node:vm`
- **Тести**: `node:test` (без Jest/Mocha/Vitest)
- **Frontend**: Vue 3 + Vite + Pinia + D3.js v7 *(наступний етап)*
