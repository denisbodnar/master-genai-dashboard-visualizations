/**
 * Модуль вибору типу візуалізації (Chart Type Recommender Agent).
 * Реалізує гібридний алгоритм із підрозділу 3.2: rule-based із пріоритетом + LLM-fallback.
 *
 * Окрім вибору типу графіка, модуль визначає маппінг стовпців на осі/канали кодування —
 * це жорстке обмеження передається далі в системний промпт Code Generator (підрозділ 3.3),
 * щоб унеможливити галюцинаційні відсилки на неіснуючі стовпці.
 */

import { RULES } from './rules.js';

const CANDIDATES_FOR_LLM = ['bar', 'line', 'scatter', 'pie', 'heatmap', 'multiline'];

/**
 * Підрахунок стовпців за типом.
 */
function countColumnTypes(schema) {
  const counts = { Temporal: 0, Numeric: 0, Categorical: 0 };
  for (const col of schema.columns) {
    counts[col.type] = (counts[col.type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Мінімальна кардинальність категоріального стовпця у схемі (для правила R7).
 */
function minCategoricalCardinality(schema) {
  const cats = schema.columns.filter((c) => c.type === 'Categorical');
  if (cats.length === 0) return Infinity;
  return Math.min(...cats.map((c) => c.cardinality ?? Infinity));
}

/**
 * Визначає маппінг стовпців на ролі (x, y, color, groupBy) залежно від типу графіка.
 * Повертає структурований опис для блоку B_chart промпту (Лістинг 3.3).
 */
function resolveEncoding(chartType, schema) {
  const byType = {
    Temporal: schema.columns.filter((c) => c.type === 'Temporal'),
    Numeric: schema.columns.filter((c) => c.type === 'Numeric'),
    Categorical: schema.columns.filter((c) => c.type === 'Categorical'),
  };

  switch (chartType) {
    case 'line':
      return { x: byType.Temporal[0]?.name, y: byType.Numeric[0]?.name };
    case 'multiline':
      return {
        x: byType.Temporal[0]?.name,
        y: byType.Numeric.map((c) => c.name),
      };
    case 'bar':
      return { x: byType.Categorical[0]?.name, y: byType.Numeric[0]?.name };
    case 'grouped-bar':
      return {
        x: byType.Categorical[0]?.name,
        y: byType.Numeric[0]?.name,
        groupBy: byType.Categorical[1]?.name,
      };
    case 'scatter':
      return { x: byType.Numeric[0]?.name, y: byType.Numeric[1]?.name };
    case 'scatter-color':
      return {
        x: byType.Numeric[0]?.name,
        y: byType.Numeric[1]?.name,
        color: byType.Categorical[0]?.name,
      };
    case 'pie':
      return { category: byType.Categorical[0]?.name };
    case 'heatmap':
      return {
        x: byType.Categorical[0]?.name,
        y: byType.Categorical[1]?.name,
        value: byType.Numeric[0]?.name,
      };
    default:
      return {};
  }
}

/**
 * Застосування правил у порядку пріоритету.
 * @returns {{ chartType, ruleId, description } | null}
 */
export function applyRules(schema) {
  const counts = countColumnTypes(schema);
  const categoricalCardinality = minCategoricalCardinality(schema);

  for (const rule of RULES) {
    if (rule.predicate({ counts, categoricalCardinality, schema })) {
      return {
        chartType: rule.chartType,
        ruleId: rule.id,
        description: rule.description,
      };
    }
  }
  return null;
}

/**
 * Головна функція модуля.
 * @param {object} schema - Schema JSON.
 * @param {object} [llmProvider] - провайдер з методом selectChartType (для fallback).
 * @returns {Promise<{chartType, source, reasoning, encoding}>}
 */
export async function selectChartType(schema, llmProvider = null) {
  const ruleResult = applyRules(schema);

  if (ruleResult) {
    return {
      chartType: ruleResult.chartType,
      source: 'rule-based',
      reasoning: `Rule ${ruleResult.ruleId}: ${ruleResult.description}`,
      encoding: resolveEncoding(ruleResult.chartType, schema),
    };
  }

  // Неоднозначний випадок — делегування LLM
  if (!llmProvider || typeof llmProvider.selectChartType !== 'function') {
    // Fallback без LLM: обираємо найбільш загальний тип
    const counts = countColumnTypes(schema);
    const fallbackType = counts.Numeric >= 1 ? 'bar' : 'pie';
    return {
      chartType: fallbackType,
      source: 'fallback-no-llm',
      reasoning: 'No rule matched and no LLM provider configured',
      encoding: resolveEncoding(fallbackType, schema),
    };
  }

  const llmResponse = await llmProvider.selectChartType({
    schema,
    candidates: CANDIDATES_FOR_LLM,
  });

  const chartType = CANDIDATES_FOR_LLM.includes(llmResponse.chartType)
    ? llmResponse.chartType
    : 'bar';

  return {
    chartType,
    source: 'llm',
    reasoning: llmResponse.reasoning ?? 'LLM-selected for ambiguous schema',
    encoding: resolveEncoding(chartType, schema),
  };
}
