/**
 * @fileoverview Unit-тести для модуля orchestrator (Етап 5).
 *
 * Стратегія: mock-провайдер що повертає заздалегідь визначений код.
 * Реальних LLM-запитів немає.
 *
 * Сценарії (підрозділ 3.4):
 *   1. Код валідний з першої спроби → status:'success', iterations:1
 *   2. Перша спроба невалідна, друга валідна → iterations:2
 *   3. Всі ітерації невалідні → status:'fallback', код = fallbackTemplate
 *   4. Перевірка структури validationLog
 *   5. extractCodeBlock: витягування коду з різних форматів
 *   6. getFallbackTemplate: відомий та невідомий chartType
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { orchestrate } from '../src/modules/orchestrator/index.js';
import { extractCodeBlock } from '../src/modules/orchestrator/codeExtractor.js';
import { getFallbackTemplate, fallbackTemplates } from '../src/modules/orchestrator/fallbackTemplates.js';

// ─── Фікстури ─────────────────────────────────────────────────────────────────

/** Мінімальний CSV з Temporal + Numeric стовпцями → line chart */
const SIMPLE_CSV = `date,revenue
2023-01-01,32000
2023-02-01,45000
2023-03-01,28000`;

/**
 * Мінімальний валідний D3.js код що проходить обидва рівні валідації.
 * .append('svg') → svgAppended = true
 * .data(data)    → dataBindCalls > 0
 */
const VALID_CODE = `
function renderChart(data, containerSelector) {
  const svg = d3.select(containerSelector).append('svg');
  svg.selectAll('rect')
    .data(data)
    .join('rect')
    .attr('x', 0)
    .attr('y', 0);
}
`.trim();

/** Невалідний код: немає renderChart */
const INVALID_CODE_NO_FUNCTION = `const x = 1;`;

/** Невалідний код: немає .data() → data_not_bound */
const INVALID_CODE_NO_DATA = `
function renderChart(data, containerSelector) {
  d3.select(containerSelector).append('svg');
}
`.trim();

/**
 * Фабрика mock-LLM-провайдера.
 * @param {string[]} responses - Масив кодів що повертаються послідовно (кожен виклик → наступний елемент).
 */
function makeMockProvider(responses) {
  let callIndex = 0;

  return {
    async generateCode() {
      const code = responses[callIndex] ?? VALID_CODE;
      callIndex++;
      return {
        content: '```javascript\n' + code + '\n```',
        usage: { promptTokens: 100, completionTokens: 200, latencyMs: 50 },
        raw: {},
      };
    },
    async refineCode() {
      const code = responses[callIndex] ?? VALID_CODE;
      callIndex++;
      return {
        content: '```javascript\n' + code + '\n```',
        usage: { promptTokens: 80, completionTokens: 150, latencyMs: 40 },
        raw: {},
      };
    },
    async selectChartType({ schema, candidates }) {
      return { chartType: candidates[0], reasoning: 'mock' };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// extractCodeBlock
// ═══════════════════════════════════════════════════════════════════════════════

describe('extractCodeBlock', () => {
  it('витягує з ```javascript блоку', () => {
    const text = '```javascript\nconst x = 1;\n```';
    assert.equal(extractCodeBlock(text), 'const x = 1;');
  });

  it('витягує з ```js блоку', () => {
    const text = '```js\nconst x = 1;\n```';
    assert.equal(extractCodeBlock(text), 'const x = 1;');
  });

  it('витягує з ``` без мітки', () => {
    const text = '```\nconst x = 1;\n```';
    assert.equal(extractCodeBlock(text), 'const x = 1;');
  });

  it('fallback: повертає текст якщо починається з function', () => {
    const code = 'function renderChart(data, c) { }';
    assert.equal(extractCodeBlock(code), code);
  });

  it('повертає null для порожнього тексту', () => {
    assert.equal(extractCodeBlock(''), null);
    assert.equal(extractCodeBlock(null), null);
  });

  it('повертає null якщо ні блоку ні renderChart', () => {
    assert.equal(extractCodeBlock('I cannot generate this chart.'), null);
  });

  it('ігнорує текст поза блоком', () => {
    const text = 'Here is the code:\n```javascript\nconst x = 1;\n```\nHope this helps!';
    assert.equal(extractCodeBlock(text), 'const x = 1;');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getFallbackTemplate
// ═══════════════════════════════════════════════════════════════════════════════

describe('getFallbackTemplate', () => {
  it('повертає код для кожного з 7 відомих типів', () => {
    const types = ['line', 'bar', 'scatter', 'pie', 'multiline', 'grouped-bar', 'scatter-color'];
    for (const type of types) {
      const code = getFallbackTemplate(type);
      assert.ok(typeof code === 'string' && code.length > 0, `${type}: код не порожній`);
      assert.ok(code.includes('renderChart'), `${type}: містить renderChart`);
    }
  });

  it('повертає bar для невідомого типу', () => {
    const code = getFallbackTemplate('heatmap');
    assert.equal(code, fallbackTemplates.bar);
  });

  it('fallbackTemplates містить всі 7 ключів', () => {
    const expected = ['line', 'bar', 'scatter', 'pie', 'multiline', 'grouped-bar', 'scatter-color'];
    for (const key of expected) {
      assert.ok(key in fallbackTemplates, `ключ "${key}" присутній`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// orchestrate — Сценарій 1: успіх з першої спроби
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — Сценарій 1: успіх з першої спроби', () => {
  it('повертає status:success та iterations:1', async () => {
    const provider = makeMockProvider([VALID_CODE]);

    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, mode: 'zero-shot', maxRefineIterations: 3 },
    });

    assert.equal(result.status, 'success');
    assert.equal(result.iterations, 1);
    assert.ok(result.code.includes('renderChart'), "результат містить renderChart");
  });

  it("артефакт містить всі обов'язкові поля", async () => {
    const provider = makeMockProvider([VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, mode: 'zero-shot', maxRefineIterations: 3 },
    });

    // Обов'язкові поля відповідно до підрозділу 3.4
    assert.ok('status'         in result, 'status');
    assert.ok('code'           in result, 'code');
    assert.ok('chartType'      in result, 'chartType');
    assert.ok('encoding'       in result, 'encoding');
    assert.ok('iterations'     in result, 'iterations');
    assert.ok('validationLog'  in result, 'validationLog');
    assert.ok('totalLatencyMs' in result, 'totalLatencyMs');
    assert.ok('totalTokens'    in result, 'totalTokens');
    assert.ok('schema'         in result, 'schema');
    assert.ok('sample'         in result, 'sample');
  });

  it('totalTokens > 0 після успішного виклику', async () => {
    const provider = makeMockProvider([VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });
    assert.ok(result.totalTokens > 0);
  });

  it('totalLatencyMs > 0', async () => {
    const provider = makeMockProvider([VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });
    assert.ok(result.totalLatencyMs >= 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// orchestrate — Сценарій 2: перша спроба невалідна, друга успішна
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — Сценарій 2: рефайнмент на другій ітерації', () => {
  it('повертає status:success та iterations:2', async () => {
    // Перший виклик: код без .data() → data_not_bound
    // Другий виклик: валідний код
    const provider = makeMockProvider([INVALID_CODE_NO_DATA, VALID_CODE]);

    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, mode: 'zero-shot', maxRefineIterations: 3 },
    });

    assert.equal(result.status, 'success');
    assert.equal(result.iterations, 2);
  });

  it('validationLog першої ітерації: ok:false', async () => {
    const provider = makeMockProvider([INVALID_CODE_NO_DATA, VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    assert.ok(result.validationLog.length >= 2);
    assert.equal(result.validationLog[0].ok, false);
    assert.equal(result.validationLog[1].ok, true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// orchestrate — Сценарій 3: всі ітерації невалідні → fallback
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — Сценарій 3: fallback після вичерпання ітерацій', () => {
  it('повертає status:fallback', async () => {
    // Всі 3 відповіді невалідні
    const provider = makeMockProvider([
      INVALID_CODE_NO_DATA,
      INVALID_CODE_NO_DATA,
      INVALID_CODE_NO_DATA,
    ]);

    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    assert.equal(result.status, 'fallback');
  });

  it('code дорівнює fallbackTemplate для chartType', async () => {
    const provider = makeMockProvider([
      INVALID_CODE_NO_DATA,
      INVALID_CODE_NO_DATA,
      INVALID_CODE_NO_DATA,
    ]);

    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    const expected = getFallbackTemplate(result.chartType);
    assert.equal(result.code, expected, 'fallback код відповідає шаблону для chartType');
  });

  it('validationLog має 3 записи, всі ok:false', async () => {
    const provider = makeMockProvider([
      INVALID_CODE_NO_DATA,
      INVALID_CODE_NO_DATA,
      INVALID_CODE_NO_DATA,
    ]);

    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    assert.equal(result.validationLog.length, 3);
    assert.ok(result.validationLog.every(e => e.ok === false), 'всі записи невалідні');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// orchestrate — Структура validationLog
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — структура validationLog', () => {
  it("кожен запис містить обов'язкові поля", async () => {
    const provider = makeMockProvider([INVALID_CODE_NO_DATA, VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    for (const entry of result.validationLog) {
      assert.ok('iteration'  in entry, 'iteration');
      assert.ok('ok'         in entry, 'ok');
      assert.ok('latencyMs'  in entry, 'latencyMs');
      assert.ok('tokens'     in entry, 'tokens');
    }
  });

  it('iteration в записах строго зростає від 1', async () => {
    const provider = makeMockProvider([INVALID_CODE_NO_DATA, VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    result.validationLog.forEach((entry, idx) => {
      assert.equal(entry.iteration, idx + 1);
    });
  });

  it('невалідний запис містить errorType', async () => {
    const provider = makeMockProvider([INVALID_CODE_NO_DATA, VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 3 },
    });

    const failEntry = result.validationLog.find(e => !e.ok);
    assert.ok(failEntry, 'є невалідний запис');
    assert.ok(failEntry.errorType, 'errorType присутній');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// orchestrate — schema передається у result
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — schema та sample у результаті', () => {
  it('schema містить columns та total_rows', async () => {
    const provider = makeMockProvider([VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 1 },
    });

    assert.ok(Array.isArray(result.schema.columns));
    assert.ok(typeof result.schema.total_rows === 'number');
  });

  it('sample — масив рядків', async () => {
    const provider = makeMockProvider([VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 1 },
    });

    assert.ok(Array.isArray(result.sample));
  });

  it('chartType є рядком', async () => {
    const provider = makeMockProvider([VALID_CODE]);
    const result = await orchestrate({
      csv: SIMPLE_CSV,
      options: { provider, maxRefineIterations: 1 },
    });

    assert.equal(typeof result.chartType, 'string');
    assert.ok(result.chartType.length > 0);
  });
});
