// Append-only JSONL logger for experiment events.

import fs from 'node:fs';
import path from 'node:path';

export class JSONLLogger {
  constructor(logFilePath) {
    this.logFilePath = logFilePath;
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * @param {string|null} experimentId
   * @param {object} entry
   */
  log(experimentId, entry) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...(experimentId && { experimentId }),
      ...entry,
    };

    try {
      // appendFileSync guarantees write order without async overhead.
      fs.appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.error(`[JSONLLogger] Error writing to ${this.logFilePath}:`, err.message);
    }
  }
}
