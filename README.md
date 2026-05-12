# GenAI System for Automatic Generation of Interactive Dashboards and Data Visualizations
This is a repository for masters thesis project in Computer Science

- Reserch topic: Development and Research of a GenAI System for Automatic Generation of Interactive Dashboards and Data Visualizations
- Author: Denys Bodnar
- Supervisor: Vyacheslav Koldovskyy, PhD in Economics, Associate Professor at IT STEP University

## Requirements

- Node.js ≥ 20
- npm ≥ 10
- (optional) Ollama running locally on `:11434`
- (optional) `OPENAI_API_KEY` for the cloud provider

## Install

```bash
npm install
```

## Configure

Copy `.env.example` to `.env` and fill in the values:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:14b-instruct-q4_K_M
PORT=3001
SCHEMA_ANALYSIS_ROWS=100
SAMPLE_ROWS=3
MAX_REFINE_ITERATIONS=3
SANDBOX_TIMEOUT_MS=2000
```

## Run

**Server** (port 3001):
```bash
npm run dev:server
```

**Client** (port 5173):
```bash
npm run dev:client
```

**Tests**:
```bash
npm run test:server
```

## Repository layout

```
server/       Node.js orchestrator, validator, LLM providers
client/       Vue 3 + D3 SPA
experiments/  CLI runner for the experimental matrix
datasets/     CSV fixtures
results/      JSONL experiment logs
```

## Datasets

18 CSV fixtures in `datasets/`. All are bundled; large external files (D09, D12, D15) are included as-is.

| ID  | Name | Rows | Cols | Source | Expected chart | Notes |
|-----|------|-----:|-----:|--------|----------------|-------|
| D01 | iris | 149 | 5 | UCI | scatter-color | |
| D02 | seattle-weather | 1 460 | 6 | Vega | line | |
| D03 | disasters | 802 | 3 | Vega | bar | |
| D04 | wine-quality-red | 1 599 | 12 | UCI | scatter | `;`-delimited |
| D05 | bike-sharing-day | 731 | 16 | UCI | line | |
| D06 | adult-census | 48 840 | 15 | UCI | grouped-bar | |
| D07 | titanic | 890 | 12 | Kaggle | bar | |
| D08 | house-prices | 545 | 13 | Kaggle | scatter | |
| D09 | covid-owid | 429 435 | 67 | OWID | line | large file |
| D10 | gapminder | 1 703 | 6 | Gapminder | scatter | |
| D11 | worldbank-gdp | 40 | 3 | World Bank | multiline | |
| D12 | energy-consumption | 23 232 | 130 | OWID | line | large file |
| D13 | budget-ua | 10 | 4 | data.gov.ua | bar | Cyrillic headers |
| D14 | population-ua | 13 | 3 | Держстат | line | Cyrillic headers |
| D15 | airbnb-listings | 103 005 | 26 | Inside Airbnb | scatter | large file |
| D16 | synthetic-edge | 10 | 2 | synthetic | scatter | edge case |
| D17 | sales-monthly | 12 | 3 | synthetic | multiline | |
| D18 | products | 6 | 3 | synthetic | bar | |

## Experiments

Run the full experiment matrix (18 datasets × providers × modes × strategies):

```bash
# Dry run with mock LLM (no API keys needed)
npm run exp:run:dry

# Live run — OpenAI, few-shot, schema-sample strategy
npm run exp:run -- --provider openai --mode few-shot

# Single dataset, Ollama, full-csv strategy
npm run exp:run -- --dataset D01 --provider ollama --strategy full-csv
```

Aggregate results from JSONL logs:

```bash
npm run exp:summarize                      # ASCII table
npm run exp:summarize -- --format json     # JSON → stdout
npm run exp:summarize -- --format json > report.json  # JSON → file (if needed)
npm run exp:summarize -- --log results/run-<id>.jsonl # specific run
```

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Health check. |
| `POST` | `/api/analyze` | CSV → schema JSON. |
| `POST` | `/api/select-chart` | CSV/schema → chart type + encoding. Query: `?provider=openai\|ollama\|none` |
| `POST` | `/api/generate` | CSV → validated D3 code (full pipeline). Query: `?provider=openai\|ollama` `?mode=zero-shot\|few-shot\|cot` `?strategy=schema-sample\|full-csv` |

## License

MIT
