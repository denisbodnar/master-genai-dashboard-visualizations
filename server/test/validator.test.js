/**
 * @fileoverview Unit-тести для модуля validator (Етап 4).
 * Покриває всі 5 перевірок staticAnalyze + 4 sandbox-сценарії + повний pipeline.
 *
 * Підрозділ 3.4 записки:
 *   - Рівень 1: статичний аналіз через AST (acorn)
 *   - Рівень 2: sandbox з MockD3 (vm)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { staticAnalyze } from '../src/modules/validator/staticAnalyzer.js';
import { executeInSandbox } from '../src/modules/validator/sandbox.js';
import { createMockD3 } from '../src/modules/validator/mockD3.js';
import { validate } from '../src/modules/validator/index.js';

// ─── Фікстури ─────────────────────────────────────────────────────────────────

const SAMPLE = [
  { date: '2023-01-01', revenue: 32000 },
  { date: '2023-06-01', revenue: 67000 },
  { date: '2023-12-01', revenue: 45000 },
];

const SCHEMA = {
  total_rows: 12,
  columns: [
    { name: 'date', type: 'Temporal' },
    { name: 'revenue', type: 'Numeric' },
  ],
};

/** Мінімальний валідний код: renderChart з правильною сигнатурою та d3.select */
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

// ═══════════════════════════════════════════════════════════════════════════════
// STATIC ANALYZER
// ═══════════════════════════════════════════════════════════════════════════════

describe('staticAnalyze', () => {

  // ── Крок 1: синтаксис ──────────────────────────────────────────────────────

  it('повертає ok:true для валідного коду', () => {
    const result = staticAnalyze(VALID_CODE);
    assert.equal(result.ok, true);
  });

  it('ловить синтаксичну помилку (errorType: syntax)', () => {
    const result = staticAnalyze('function renderChart( { d3.select(c); }');
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'syntax');
    assert.ok(result.message.includes('SyntaxError'));
  });

  // ── Крок 2: відсутність renderChart ───────────────────────────────────────

  it('ловить відсутність renderChart (errorType: missing_render_chart)', () => {
    const result = staticAnalyze(`
      function doSomething(data, containerSelector) {
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      }
    `);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'missing_render_chart');
  });

  // ── Крок 3: неправильна сигнатура ─────────────────────────────────────────

  it('ловить неправильну сигнатуру (errorType: wrong_signature)', () => {
    const result = staticAnalyze(`
      function renderChart(csvData) {
        d3.select('#div').append('svg').selectAll('rect').data(csvData).join('rect');
      }
    `);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'wrong_signature');
  });

  it('приймає renderChart як arrow function', () => {
    const code = `
      const renderChart = (data, containerSelector) => {
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      };
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, true, `Unexpected error: ${result.message}`);
  });

  // ── Крок 4: заборонені API ────────────────────────────────────────────────

  it('ловить eval() (errorType: forbidden_api)', () => {
    const code = `
      function renderChart(data, containerSelector) {
        eval('alert(1)');
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      }
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'forbidden_api');
    assert.ok(result.detail.includes('eval'));
  });

  it('ловить fetch() (errorType: forbidden_api)', () => {
    const code = `
      function renderChart(data, containerSelector) {
        fetch('/api/data').then(r => r.json());
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      }
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'forbidden_api');
    assert.ok(result.detail.includes('fetch'));
  });

  it('ловить d3.csv() (errorType: forbidden_api)', () => {
    const code = `
      function renderChart(data, containerSelector) {
        d3.csv('/data.csv').then(rows => {});
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      }
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'forbidden_api');
    assert.ok(result.detail.includes('d3.csv'));
  });

  it('ловить d3.tsv() (errorType: forbidden_api)', () => {
    const code = `
      function renderChart(data, containerSelector) {
        d3.tsv('/data.tsv').then(rows => {});
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      }
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'forbidden_api');
    assert.ok(result.detail.includes('d3.tsv'));
  });

  it('ловить new Function(...) (errorType: forbidden_api)', () => {
    const code = `
      function renderChart(data, containerSelector) {
        const fn = new Function('return 1');
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
      }
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'forbidden_api');
  });

  // ── Крок 5: відсутність d3.select ────────────────────────────────────────

  it('ловить відсутність d3.select (errorType: missing_d3_select)', () => {
    const code = `
      function renderChart(data, containerSelector) {
        const x = data.map(d => d.value);
      }
    `;
    const result = staticAnalyze(code);
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'missing_d3_select');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK D3
// ═══════════════════════════════════════════════════════════════════════════════

describe('createMockD3', () => {
  it('select() інкрементує selectCalls', () => {
    const d3 = createMockD3();
    d3.select('#div');
    d3.select('#div');
    assert.equal(d3.selectCalls, 2);
  });

  it('append("svg") встановлює svgAppended = true', () => {
    const d3 = createMockD3();
    d3.select('#div').append('svg');
    assert.equal(d3.svgAppended, true);
  });

  it('append("g") НЕ встановлює svgAppended', () => {
    const d3 = createMockD3();
    d3.select('#div').append('g');
    assert.equal(d3.svgAppended, false);
  });

  it("data() інкрементує dataBindCalls і запам'ятовує довжину", () => {
    const d3 = createMockD3();
    d3.selectAll('rect').data([1, 2, 3]);
    assert.equal(d3.dataBindCalls, 1);
    assert.equal(d3.lastDataLength, 3);
  });

  it("chainable методи повертають той самий об'єкт", () => {
    const d3 = createMockD3();
    const chain = d3.select('#div').append('svg').attr('width', 600).style('background', 'red');
    // якщо chainable — не викине помилку і chain !== undefined
    assert.ok(chain !== undefined);
  });

  it('scaleLinear повертає функцію зі .domain і .range', () => {
    const d3 = createMockD3();
    const scale = d3.scaleLinear();
    assert.equal(typeof scale, 'function');
    assert.equal(typeof scale.domain, 'function');
    assert.equal(typeof scale.range, 'function');
  });

  it('axisBottom повертає функцію', () => {
    const d3 = createMockD3();
    const axis = d3.axisBottom(d3.scaleLinear());
    assert.equal(typeof axis, 'function');
  });

  it('max/min/extent/sum/mean працюють як утиліти', () => {
    const d3 = createMockD3();
    assert.equal(d3.max([1, 2, 3]), 3);
    assert.equal(d3.min([1, 2, 3]), 1);
    assert.equal(d3.sum([1, 2, 3]), 6);
    assert.deepEqual(d3.extent([1, 2, 3]), [1, 3]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SANDBOX
// ═══════════════════════════════════════════════════════════════════════════════

describe('executeInSandbox', () => {
  it('виконує валідний код успішно → ok:true', () => {
    const result = executeInSandbox(VALID_CODE, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, true);
    assert.ok(result.mockState, 'mockState присутній');
  });

  it('mockState містить коректні лічильники після виконання', () => {
    const result = executeInSandbox(VALID_CODE, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, true);
    assert.equal(result.mockState.svgAppended, true);
    assert.ok(result.mockState.dataBindCalls > 0);
    assert.ok(result.mockState.selectCalls > 0);
  });

  it('нескінченний цикл перебивається timeout (errorType: runtime)', () => {
    const infiniteCode = `
      function renderChart(data, containerSelector) {
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
        while(true) {}
      }
    `;
    const result = executeInSandbox(infiniteCode, {
      schema: SCHEMA,
      sample: SAMPLE,
      timeoutMs: 100,
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'runtime');
    assert.ok(result.message.includes('timed out'));
  });

  it('runtime-помилка перехоплюється (errorType: runtime)', () => {
    const errorCode = `
      function renderChart(data, containerSelector) {
        d3.select(containerSelector).append('svg').selectAll('rect').data(data).join('rect');
        throw new Error('Runtime crash');
      }
    `;
    const result = executeInSandbox(errorCode, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'runtime');
    assert.ok(result.message.includes('Runtime crash'));
  });

  it('виявляє data_not_bound — код без .data()', () => {
    const noDataCode = `
      function renderChart(data, containerSelector) {
        d3.select(containerSelector).append('svg');
      }
    `;
    const result = executeInSandbox(noDataCode, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'data_not_bound');
  });

  it('виявляє no_svg_appended — код без .append("svg")', () => {
    const noSvgCode = `
      function renderChart(data, containerSelector) {
        d3.select(containerSelector).selectAll('div').data(data).join('div');
      }
    `;
    const result = executeInSandbox(noSvgCode, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'no_svg_appended');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ПОВНИЙ PIPELINE: validate()
// ═══════════════════════════════════════════════════════════════════════════════

describe('validate (full pipeline)', () => {
  it('валідний код проходить обидва рівні → ok:true', () => {
    const result = validate(VALID_CODE, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, true);
  });

  it('синтаксична помилка зупиняє pipeline на Рівні 1', () => {
    const result = validate('function renderChart( {}', { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'syntax');
  });

  it('відсутня renderChart зупиняє pipeline на Рівні 1', () => {
    const result = validate('const x = 1;', { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'missing_render_chart');
  });

  it('forbidden_api зупиняє pipeline на Рівні 1', () => {
    const result = validate(`
      function renderChart(data, containerSelector) {
        eval('x');
        d3.select(containerSelector).append('svg').selectAll('r').data(data).join('r');
      }
    `, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'forbidden_api');
  });

  it('data_not_bound виявляється на Рівні 2', () => {
    const code = `
      function renderChart(data, containerSelector) {
        d3.select(containerSelector).append('svg');
      }
    `;
    const result = validate(code, { schema: SCHEMA, sample: SAMPLE });
    assert.equal(result.ok, false);
    assert.equal(result.errorType, 'data_not_bound');
  });
});
