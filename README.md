# genai-viz — LLM-driven D3.js dashboard generator with self-refine validation.

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

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Health check. |
| `POST` | `/api/analyze` | CSV → schema JSON. |
| `POST` | `/api/select-chart` | CSV/schema → chart type + encoding. Query: `?provider=openai\|ollama\|none` |
| `POST` | `/api/generate` | CSV → validated D3 code (full pipeline). Query: `?provider=openai\|ollama` `?mode=zero-shot\|few-shot\|cot` `?strategy=schema-sample\|full-csv` |

## License

MIT
