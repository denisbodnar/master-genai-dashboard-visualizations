/**
 * @fileoverview Модуль логування результатів експериментів у форматі JSONL.
 *
 * Використовується оркестратором для збереження кожного кроку генерації
 * (схема, промпт, помилки, ітерації Self-Refine) у файл .jsonl для
 * подальшого аналізу.
 *
 * Підрозділ 5.1 записки: "Всіметрики (latency, tokens, error_types, success_rate)
 * агрегуються під час запуску експериментів та зберігаються у JSONL-файли".
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Клас для логування подій у JSONL-файл.
 */
export class JSONLLogger {
  /**
   * Ініціалізує логер.
   * @param {string} logFilePath - Повний шлях до JSONL файлу.
   */
  constructor(logFilePath) {
    this.logFilePath = logFilePath;
    this.ensureDirectoryExists();
  }

  /**
   * Створює директорію для файлу, якщо вона не існує.
   * @private
   */
  ensureDirectoryExists() {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Логує подію у файл.
   * У форматі orchestrator: logger.log(experimentId, entry)
   * Якщо experimentId відсутній, логує entry як є (або додає timestamp).
   *
   * @param {string|null} experimentId - Ідентифікатор експерименту.
   * @param {object} entry - Дані події.
   */
  log(experimentId, entry) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...(experimentId && { experimentId }),
      ...entry,
    };

    try {
      // Синхронний запис для гарантії порядку та уникнення race conditions
      // при інтенсивному логуванні в Node.js без очікування (await).
      fs.appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n', 'utf8');
    } catch (err) {
      console.error(`[JSONLLogger] Error writing to ${this.logFilePath}:`, err.message);
    }
  }
}
