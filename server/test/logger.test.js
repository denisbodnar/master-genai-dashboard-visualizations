/**
 * @fileoverview Unit-тести для модуля logger (Етап 6).
 *
 * Перевіряє:
 * - Створення директорії, якщо її не існує.
 * - Коректність формату JSONL (кожен рядок - валідний JSON-об'єкт).
 * - Включення поля timestamp.
 * - Включення поля experimentId, якщо його передано.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { JSONLLogger } from '../src/modules/logger/index.js';

// ─── Фікстури та утиліти ──────────────────────────────────────────────────────

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'genai-viz-logger-test-'));

function getTempFilePath(filename) {
  return path.join(tmpDir, filename);
}

// Очищення після тестів
after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// JSONLLogger Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('JSONLLogger', () => {
  it("створює директорію для лог-файлу, якщо вона не існує", () => {
    const nestedDirFile = path.join(tmpDir, 'nested', 'logs', 'test1.jsonl');
    const logger = new JSONLLogger(nestedDirFile);
    
    // Перевіряємо що директорія створена під час ініціалізації
    assert.ok(fs.existsSync(path.dirname(nestedDirFile)), 'директорія повинна бути створена');
  });

  it("пише коректний формат JSONL у файл", () => {
    const logFile = getTempFilePath('test2.jsonl');
    const logger = new JSONLLogger(logFile);
    
    logger.log(null, { event: 'test_event_1', value: 42 });
    logger.log(null, { event: 'test_event_2', value: 100 });
    
    const fileContent = fs.readFileSync(logFile, 'utf8');
    const lines = fileContent.trim().split('\n');
    
    assert.equal(lines.length, 2, 'повинно бути 2 рядки');
    
    const parsed1 = JSON.parse(lines[0]);
    const parsed2 = JSON.parse(lines[1]);
    
    assert.equal(parsed1.event, 'test_event_1');
    assert.equal(parsed1.value, 42);
    assert.ok(parsed1.timestamp, 'повинен містити timestamp');

    assert.equal(parsed2.event, 'test_event_2');
    assert.equal(parsed2.value, 100);
  });

  it("додає experimentId, якщо його передано", () => {
    const logFile = getTempFilePath('test3.jsonl');
    const logger = new JSONLLogger(logFile);
    
    logger.log('exp-12345', { status: 'success' });
    
    const fileContent = fs.readFileSync(logFile, 'utf8');
    const parsed = JSON.parse(fileContent.trim());
    
    assert.equal(parsed.experimentId, 'exp-12345');
    assert.equal(parsed.status, 'success');
    assert.ok(parsed.timestamp);
  });

  it("не падає при помилці запису, а лише перехоплює виняток", () => {
    // Вказуємо шлях до існуючої директорії замість файлу, що викличе EISDIR помилку при appendFileSync
    const dirAsFile = getTempFilePath('isDirectory');
    fs.mkdirSync(dirAsFile);
    
    const logger = new JSONLLogger(dirAsFile);
    
    // Перехоплюємо console.error щоб не забруднювати вивід тестів
    const originalConsoleError = console.error;
    let errorLogged = false;
    console.error = () => { errorLogged = true; };
    
    // Не повинно викидати виняток (graceful fail)
    assert.doesNotThrow(() => {
      logger.log(null, { event: 'fail_test' });
    });
    
    console.error = originalConsoleError;
    assert.ok(errorLogged, 'помилка повинна бути залогована в console.error');
  });
});
