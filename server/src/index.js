import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from './config.js';
import { inferSchema } from './modules/schemaInference/index.js';
import { selectChartType } from './modules/chartSelector/index.js';
import { createProvider } from './modules/llmProvider/index.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

/**
 * Витягує CSV-текст з multipart-файлу або body.csv.
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
 * POST /api/select-chart
 * CSV → Schema → chartType + encoding.
 * Приймає або CSV-файл, або готову схему в body.schema.
 *
 * Query params:
 *   ?provider=openai  — використати OpenAI (потребує OPENAI_API_KEY)
 *   ?provider=ollama  — використати локальний Ollama
 *   ?provider=none    — rule-based без LLM (default)
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

    // Вибір LLM-провайдера з query-параметра ?provider=
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
    // providerName === 'none' або відсутній → llmProvider = null (rule-based)

    const recommendation = await selectChartType(schema, llmProvider);
    return res.json({ schema, recommendation, provider: providerName ?? 'none' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
});
