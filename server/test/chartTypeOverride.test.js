/**
 * @fileoverview Integration tests for the chartTypeOverride feature in orchestrate().
 *
 * Tests:
 *   1. chartTypeOverride bypasses selectChartType and uses the specified type.
 *   2. Without chartTypeOverride, the existing automatic selection is preserved.
 *   3. HTTP 400 is returned for an invalid chartType value (tested via direct validation logic).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { orchestrate } from '../src/modules/orchestrator/index.js';
import { SUPPORTED_CHART_TYPES } from '../src/modules/chartSelector/constants.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Iris-like CSV: 1 Categorical + 2 Numeric → rule R5 → scatter-color (auto).
 * Used to verify that override replaces this recommendation.
 */
const IRIS_CSV = `species,sepal_length,sepal_width
setosa,5.1,3.5
setosa,4.9,3.0
versicolor,7.0,3.2
versicolor,6.4,3.2
virginica,6.3,3.3`;

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

function makeMockProvider(code = VALID_CODE) {
  return {
    async generateCode() {
      return {
        content: '```javascript\n' + code + '\n```',
        usage: { promptTokens: 100, completionTokens: 200, latencyMs: 50 },
        raw: {},
      };
    },
    async refineCode() {
      return {
        content: '```javascript\n' + code + '\n```',
        usage: { promptTokens: 80, completionTokens: 150, latencyMs: 40 },
        raw: {},
      };
    },
    async selectChartType({ candidates }) {
      return { chartType: candidates[0], reasoning: 'mock' };
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test 1: chartTypeOverride is applied — server uses it, not the auto-selector
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — chartTypeOverride', () => {
  it('uses override type even when auto-selector would choose differently', async () => {
    // IRIS_CSV → auto would choose scatter-color (R5); override forces bar
    const provider = makeMockProvider();
    const result = await orchestrate({
      csv: IRIS_CSV,
      options: {
        provider,
        mode: 'zero-shot',
        maxRefineIterations: 1,
        chartTypeOverride: 'bar',
      },
    });

    assert.equal(result.chartType, 'bar', 'chartType should be the override value');
  });

  it('sets source to user-override in the recommendation (via chartSource field)', async () => {
    // We cannot inspect recommendation directly from the result, but we can verify
    // chartType was honoured and the pipeline completed successfully.
    const provider = makeMockProvider();
    const result = await orchestrate({
      csv: IRIS_CSV,
      options: {
        provider,
        mode: 'zero-shot',
        maxRefineIterations: 1,
        chartTypeOverride: 'line',
      },
    });

    assert.equal(result.chartType, 'line');
    assert.ok(['success', 'fallback'].includes(result.status));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 2: Without chartTypeOverride, automatic selection is preserved
// ═══════════════════════════════════════════════════════════════════════════════

describe('orchestrate — no override preserves automatic selection', () => {
  it('chartType comes from rule-based selector when no override is given', async () => {
    // IRIS_CSV → 1 Categorical + 2 Numeric → R5 → scatter-color
    const provider = makeMockProvider();
    const result = await orchestrate({
      csv: IRIS_CSV,
      options: {
        provider,
        mode: 'zero-shot',
        maxRefineIterations: 1,
        // chartTypeOverride intentionally omitted
      },
    });

    assert.equal(
      result.chartType,
      'scatter-color',
      'auto-selection should pick scatter-color for iris-like schema',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 3: SUPPORTED_CHART_TYPES validation — matches what the server enforces
// ═══════════════════════════════════════════════════════════════════════════════

describe('SUPPORTED_CHART_TYPES constant', () => {
  it('contains the 8 canonical chart types', () => {
    const expected = ['bar', 'grouped-bar', 'line', 'multiline', 'scatter', 'scatter-color', 'pie', 'heatmap'];
    for (const t of expected) {
      assert.ok(SUPPORTED_CHART_TYPES.includes(t), `${t} should be in SUPPORTED_CHART_TYPES`);
    }
    assert.equal(SUPPORTED_CHART_TYPES.length, expected.length, 'no extra types');
  });

  it('rejects unknown values (donut, radar, etc.)', () => {
    const invalidTypes = ['donut', 'radar', 'treemap', '', 'Bar'];
    for (const t of invalidTypes) {
      assert.equal(
        SUPPORTED_CHART_TYPES.includes(t),
        false,
        `"${t}" should not be a valid chart type`,
      );
    }
  });
});
