import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from './config.js';
import { inferSchema } from './modules/schemaInference/index.js';
import { selectChartType } from './modules/chartSelector/index.js';
import { createProvider } from './modules/llmProvider/index.js';
import { orchestrate } from './modules/orchestrator/index.js';
import { SUPPORTED_CHART_TYPES } from './modules/chartSelector/constants.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

/**
 * Extracts CSV text from a multipart file upload or body.csv.
 */
function extractCsv(req) {
  if (req.file) return req.file.buffer.toString('utf-8');
  if (req.body && typeof req.body.csv === 'string') return req.body.csv;
  return null;
}

/**
 * POST /api/analyze
 * CSV → Schema JSON.
 */
app.post('/api/analyze', upload.single('file'), (req, res) => {
  try {
    const csvText = extractCsv(req);
    if (!csvText) return res.status(400).json({ error: 'No CSV data provided' });
    const schema = inferSchema(csvText, config.schema);
    return res.json({ schema });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/select-chart — CSV or body.schema → chart type + encoding.
 *
 * Query: ?provider=openai|ollama|none  (default: none = rule-based)
 */
app.post('/api/select-chart', upload.single('file'), async (req, res) => {
  try {
    let schema;
    const csvText = extractCsv(req);
    if (csvText) {
      schema = inferSchema(csvText, config.schema);
    } else if (req.body && req.body.schema) {
      schema = req.body.schema;
    } else {
      return res.status(400).json({ error: 'Provide CSV or body.schema' });
    }

    // Resolve LLM provider from the ?provider= query parameter
    let llmProvider = null;
    const providerName = req.query.provider;
    if (providerName === 'openai') {
      if (!config.openai.apiKey) {
        return res.status(400).json({ error: 'OPENAI_API_KEY is not set' });
      }
      llmProvider = createProvider('openai');
    } else if (providerName === 'ollama') {
      llmProvider = createProvider('ollama');
    }
    // providerName === 'none' or absent → llmProvider = null (rule-based)

    const recommendation = await selectChartType(schema, llmProvider);
    return res.json({ schema, recommendation, provider: providerName ?? 'none' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/generate — full pipeline: CSV → schema → chart selection → LLM generation → Self-Refine.
 *
 * Query: ?provider=ollama|openai  ?mode=zero-shot|few-shot|cot  ?strategy=schema-sample|full-csv
 *
 * Body params (multipart/form-data):
 *   file:       CSV file (required)
 *   chartType?: 'bar'|'grouped-bar'|'line'|'multiline'|'scatter'|
 *               'scatter-color'|'pie'|'heatmap'
 *               (optional — overrides automatic chart type selection)
 */
app.post('/api/generate', upload.single('file'), async (req, res) => {
  try {
    const csvText = extractCsv(req);
    if (!csvText) return res.status(400).json({ error: 'No CSV data provided' });

    const providerName     = req.query.provider  ?? 'ollama';
    const mode             = req.query.mode      ?? 'few-shot';
    const dataStrategy     = req.query.strategy  ?? 'schema-sample';
    const chartTypeOverride = req.body?.chartType ?? null;

    if (!['ollama', 'openai'].includes(providerName)) {
      return res.status(400).json({ error: `Unknown provider: "${providerName}". Valid: ollama, openai` });
    }
    if (!['zero-shot', 'few-shot', 'cot'].includes(mode)) {
      return res.status(400).json({ error: `Unknown mode: "${mode}". Valid: zero-shot, few-shot, cot` });
    }
    if (!['schema-sample', 'full-csv'].includes(dataStrategy)) {
      return res.status(400).json({ error: `Unknown strategy: "${dataStrategy}". Valid: schema-sample, full-csv` });
    }
    if (providerName === 'openai' && !config.openai.apiKey) {
      return res.status(400).json({ error: 'OPENAI_API_KEY is not set' });
    }
    if (chartTypeOverride !== null && !SUPPORTED_CHART_TYPES.includes(chartTypeOverride)) {
      return res.status(400).json({
        error: `Unknown chartType: "${chartTypeOverride}". Valid: ${SUPPORTED_CHART_TYPES.join(', ')}`,
      });
    }

    const llmProvider = createProvider(providerName);
    const result = await orchestrate({
      csv: csvText,
      options: { provider: llmProvider, mode, dataStrategy, chartTypeOverride },
    });

    return res.json(result);
  } catch (err) {
    const status = err.retryable === false ? 400 : 502;
    return res.status(status).json({ error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});
