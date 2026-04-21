import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT) || 3001,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
  },
  schema: {
    analysisRows: Number(process.env.SCHEMA_ANALYSIS_ROWS) || 100,
    sampleRows: Number(process.env.SAMPLE_ROWS) || 3,
  },
  refine: {
    maxIterations: Number(process.env.MAX_REFINE_ITERATIONS) || 3,
    sandboxTimeoutMs: Number(process.env.SANDBOX_TIMEOUT_MS) || 2000,
  },
};
