# genai-viz

> GenAI-система автоматичної генерації інтерактивних D3.js-візуалізацій з CSV-файлів.
> Магістерська робота. Node.js 20+ · Express 4 · ESM · Vue 3 · D3.js v7.

---

## Поточний стан

| Етап | Модуль | Статус | Тестів |
|------|--------|--------|--------|
| 1 | Schema Inference + Chart Selector | ✅ Завершено | 21 |
| 2 | LLM Providers (OpenAI + Ollama) | ✅ Завершено | 17 |
| 3 | Prompt Builder (5 блоків, 3 режими, 2 стратегії) | ✅ Завершено | 26 |
| 4 | Validator + Sandbox (AST + vm) | ✅ Завершено | 30 |
| 5 | Orchestrator + Self-Refine | ✅ Завершено | 25 |
| 6 | Logger (JSONL) | ✅ Завершено | 4 |
| 7 | Vue 3 Frontend | ✅ Завершено | — |
| 8 | Experiment Runner (18 датасетів) | ✅ Завершено | — |

**Разом: 123 unit-тести, всі проходять.**

---

## Структура проєкту

```
genai-viz/
├── package.json                   npm workspaces, ESM ("type": "module")
├── .env.example                   шаблон змінних середовища
├── server/
│   ├── src/
│   │   ├── index.js               Express: /api/health, /api/analyze, /api/select-chart, /api/generate
│   │   ├── config.js              dotenv: OpenAI, Ollama, refine, schema
│   │   └── modules/
│   │       ├── schemaInference/   Алгоритм 3.1 — CSV → Schema JSON
│   │       ├── chartSelector/     Алгоритм 3.2 — rule-based + LLM fallback
│   │       ├── llmProvider/       OpenAIProvider, OllamaProvider, createProvider()
│   │       ├── promptBuilder/     buildPrompt(), 5 блоків, few-shot приклади
│   │       │   ├── blocks/        roleBlock, schemaBlock, chartBlock, shotsBlock, constraintsBlock
│   │       │   └── examples/      line, bar, scatter, pie, multiline, grouped-bar, scatter-color
│   │       ├── validator/         staticAnalyze (AST) + executeInSandbox (vm + MockD3)
│   │       ├── orchestrator/      orchestrate(), Self-Refine цикл, codeExtractor, fallbackTemplates
│   │       └── logger/            JSONLLogger (логування в результати експериментів)
│   └── test/                      123 unit-тести (node:test)
│       ├── schemaInference.test.js
│       ├── chartSelector.test.js
│       ├── llmProvider.test.js
│       ├── promptBuilder.test.js
│       ├── validator.test.js
│       ├── orchestrator.test.js
│       └── logger.test.js
├── datasets/                      12 локальних CSV-датасетів
│   ├── iris.csv                   D01 — scatter-color (N+C, UCI)
│   ├── seattle-weather.csv        D03 — line (T+N+C, Vega)
│   ├── disasters.csv              D04 — bar (C+N, Vega)
│   ├── adult-census.csv           D08 — grouped-bar (C+C+N, UCI)
│   ├── titanic.csv                D09 — bar (C+N, Kaggle)
│   ├── gapminder.csv              D12 — scatter (N+C, Gapminder)
│   ├── worldbank-gdp.csv          D13 — multiline (C+T+N, World Bank)
│   ├── budget-ua.csv              D15 — bar (кирилиця, data.gov.ua)
│   ├── population-ua.csv          D16 — line (кирилиця, Держстат)
│   ├── synthetic-edge.csv         D18 — scatter (граничний кейс, 10 рядків)
│   ├── sales_monthly.csv          line (T+N+C)
│   └── products.csv               bar (C+N)
├── client/                        Vue 3 + Vite + D3.js v7
│   ├── src/
│   │   ├── App.vue                головний компонент (layout, state)
│   │   ├── main.js                точка входу
│   │   ├── assets/main.css        преміум Dark Mode / Glassmorphism CSS
│   │   ├── services/api.js        axios → POST /api/generate
│   │   └── components/
│   │       ├── FileUploader.vue   drag & drop CSV
│   │       ├── ConfigurationPanel.vue  вибір provider / mode
│   │       ├── GenerationLogs.vue self-refine iteration viewer
│   │       └── ChartRenderer.vue  ізольований D3 рендеринг (new Function)
│   └── vite.config.js             proxy /api → localhost:3001
├── experiments/
│   ├── configs/matrix.json        18-датасетна матриця (D01..D18)
│   └── src/
│       ├── runner.js              CLI запуск (--dry-run, --dataset, --provider, --mode)
│       └── summarize.js           агрегатор метрик з JSONL (таблиця / JSON)
└── results/                       JSONL-логи експериментів
```

---

## Швидкий старт

```bash
# 1. Встановити залежності (Node.js 20+)
npm install

# 2. Скопіювати конфіг
cp .env.example .env
# Заповнити OPENAI_API_KEY та/або OLLAMA_BASE_URL

# 3. Запустити тести (123 тести)
npm run test:server

# 4. Запустити сервер (порт 3001)
npm run dev:server

# 5. Запустити клієнт (порт 5173)
npm run dev:client
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
curl -X POST -F "file=@datasets/sales_monthly.csv" \
     http://localhost:3001/api/select-chart
```

### `POST /api/generate` — Повний pipeline: CSV → D3.js код

| Query param | Значення | Поведінка |
|---|---|---|
| `?provider=openai` | потрібен `OPENAI_API_KEY` | генерація через OpenAI |
| `?provider=ollama` | потрібен локальний Ollama | генерація через Ollama |
| `?mode=zero-shot` | (default) | пряма генерація |
| `?mode=few-shot` | з прикладом | підсвічений D3 приклад у промпті |
| `?mode=cot` | Chain of Thought | крок-за-кроком міркування |
| `?strategy=schema-sample` | (default) | Schema JSON + 3 рядки вибірки |
| `?strategy=full-csv` | сирий CSV (перші 50 рядків) | для експериментального порівняння |

```bash
# Повний pipeline з OpenAI + CoT
curl -X POST -F "file=@datasets/gapminder.csv" \
     "http://localhost:3001/api/generate?provider=openai&mode=cot"

# Full CSV стратегія
curl -X POST -F "file=@datasets/gapminder.csv" \
     "http://localhost:3001/api/generate?provider=openai&mode=few-shot&strategy=full-csv"
```

Відповідь містить: `status`, `code`, `chartType`, `encoding`, `iterations`, `validationLog`, `totalLatencyMs`, `totalTokens`, `schema`, `sample`.

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

Дві стратегії передачі даних (ключова вісь експериментального порівняння):
- `schema-sample` (default) — Schema JSON (~200-400 токенів) + 3 рядки вибірки;
- `full-csv` — сирий CSV (перші 50 рядків, 2000-5000 токенів) — для порівняння у Розділі 5.

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
- Ізольований контекст: `MockD3` (Proxy-based) + `data = sample` + заглушка `console`
- Таймаут (default 2000ms) → перериває нескінченні цикли
- Перевірки після виконання: `svgAppended` та `dataBindCalls > 0`

### Етап 5 — Orchestrator + Self-Refine

Реалізація циклу Self-Refine [24] за підрозділом 3.4:

```
inferSchema → selectChartType → buildPrompt → generateCode
  → extractCodeBlock → validate → (on fail) buildFeedbackPrompt
  → refineCode → validate → ... (до maxRefineIterations)
  → fallbackTemplate[chartType]
```

- **`codeExtractor.js`** — витягує `\`\`\`javascript` блок з LLM-відповіді.
- **`fallbackTemplates.js`** — агрегує код із `examples/*.js` як єдине джерело правди.
- **`orchestrate()`** — повертає уніфікований артефакт: `status`, `code`, `chartType`, `encoding`, `iterations`, `validationLog`, `totalLatencyMs`, `totalTokens`.

### Етап 6 — Logger (JSONL)

- **`JSONLLogger`** — синхронний `appendFileSync` для JSONL-записів.
- Атомарний запис кожної події з `timestamp` та опційним `experimentId`.
- Graceful error handling (не падає при помилках I/O).

### Етап 7 — Vue 3 Frontend

Преміальний UI з Dark Mode / Glassmorphism:

- **`FileUploader.vue`** — drag & drop CSV з анімацією.
- **`ConfigurationPanel.vue`** — вибір LLM Provider + Prompt Mode + кнопка генерації.
- **`GenerationLogs.vue`** — дешборд Self-Refine: ітерації, latency, tokens, errorType, фінальний статус.
- **`ChartRenderer.vue`** — ізольоване виконання D3 коду через `new Function('d3', code)`, перемикач Code/Preview.

### Етап 8 — Experiment Runner

Матриця 18 датасетів (Таблиця 5.X) × providers × modes:

**CLI Runner (`experiments/src/runner.js`):**
```bash
npm run exp:run:dry                                                   # Mock LLM (демо)
npm run exp:run -- --provider openai --mode few-shot                  # OpenAI, обидві стратегії
npm run exp:run -- --dataset D01 --provider ollama --strategy full-csv  # Один датасет, одна стратегія
```

**Агрегатор (`experiments/src/summarize.js`):**
```bash
npm run exp:summarize                                   # ASCII-таблиця
npm run exp:summarize -- --format json                  # JSON-звіт
```

Метрики: Success Rate, Fallback Rate, ChartMatch%, AvgIterations, AvgLatency, AvgTokens, Error Type Distribution — по осях provider / mode / dataStrategy / dataset.

---

## Датасети

| ID | Файл | Джерело | Рядків | Типи | Очік. графік | Статус |
|---|---|---|---|---|---|---|
| D01 | `iris.csv` | UCI | 60 | N+C | scatter-color | ✅ локальний |
| D03 | `seattle-weather.csv` | Vega | 42 | T+N+C | line | ✅ локальний |
| D04 | `disasters.csv` | Vega | 52 | C+N | bar | ✅ локальний |
| D08 | `adult-census.csv` | UCI | 18 | C+C+N | grouped-bar | ✅ локальний |
| D09 | `titanic.csv` | Kaggle | 6 | C+N | bar | ✅ локальний |
| D12 | `gapminder.csv` | Gapminder | 62 | N+C+T | scatter | ✅ локальний |
| D13 | `worldbank-gdp.csv` | World Bank | 40 | C+T+N | multiline | ✅ локальний |
| D15 | `budget-ua.csv` | data.gov.ua | 10 | C+N | bar | ✅ 🇺🇦 кирилиця |
| D16 | `population-ua.csv` | Держстат | 13 | T+N+C | line | ✅ 🇺🇦 кирилиця |
| D18 | `synthetic-edge.csv` | synthetic | 10 | N | scatter | ✅ граничний |
| D02,D05–D07,D10–D11,D14,D17 | — | UCI/Kaggle/OWID | 400–350k | — | — | 📥 зовнішні |

Зовнішні датасети помічені `"external": true` у `matrix.json` — Runner пропускає їх із підказкою URL для завантаження.

---

## Покриття тестами

| Файл | Тестів | Що перевіряє |
|---|---|---|
| `schemaInference.test.js` | 8 | типізація, статистики, edge cases |
| `chartSelector.test.js` | 13 | всі 7 правил, LLM-fallback, encoding |
| `llmProvider.test.js` | 17 | payload, парсинг, retry, latency, factory |
| `promptBuilder.test.js` | 26 | блоки, 3 режими, shots, snapshot, feedback |
| `validator.test.js` | 30 | AST-перевірки, MockD3, sandbox, pipeline |
| `orchestrator.test.js` | 25 | Self-Refine 3 сценарії, validationLog, extractor, fallback |
| `logger.test.js` | 4 | створення директорій, JSONL формат, experimentId, error catch |
| **Разом** | **123** | **всі проходять** |

---

## Змінні середовища (`.env`)

```env
PORT=3001

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:14b

# Schema inference
SCHEMA_ANALYSIS_ROWS=100
SAMPLE_ROWS=3

# Self-Refine
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
- **Frontend**: Vue 3 + Vite + D3.js v7, Vanilla CSS (Glassmorphism), `lucide-vue-next`
- **Experiment Runner**: CLI, JSONL output, `--dry-run` mock mode
