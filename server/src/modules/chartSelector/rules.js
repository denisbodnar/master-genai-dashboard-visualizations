// Chart type selection rules, ordered by priority.

export const KAPPA_LOW = 6;

/**
 * @typedef {Object} ColumnCounts
 * @property {number} Temporal
 * @property {number} Numeric
 * @property {number} Categorical
 */

export const RULES = [
  {
    id: 'R1',
    chartType: 'multiline',
    predicate: ({ counts }) => counts.Temporal === 1 && counts.Numeric >= 2,
    description: 'One temporal + multiple numeric',
  },
  {
    id: 'R2',
    chartType: 'line',
    predicate: ({ counts }) => counts.Temporal === 1 && counts.Numeric === 1,
    description: 'One temporal + one numeric',
  },
  {
    id: 'R3',
    chartType: 'grouped-bar',
    predicate: ({ counts }) => counts.Categorical === 2 && counts.Numeric === 1,
    description: 'Two categorical + one numeric',
  },
  {
    id: 'R4',
    chartType: 'bar',
    predicate: ({ counts }) => counts.Categorical === 1 && counts.Numeric === 1,
    description: 'One categorical + one numeric',
  },
  {
    id: 'R5',
    chartType: 'scatter-color',
    predicate: ({ counts }) => counts.Categorical === 1 && counts.Numeric === 2,
    description: 'One categorical + two numeric',
  },
  {
    id: 'R6',
    chartType: 'scatter',
    predicate: ({ counts }) => counts.Numeric === 2 && counts.Categorical === 0 && counts.Temporal === 0,
    description: 'Two numeric',
  },
  {
    id: 'R7',
    chartType: 'pie',
    predicate: ({ counts, categoricalCardinality }) =>
      counts.Categorical === 1 && counts.Numeric === 0 && categoricalCardinality <= KAPPA_LOW,
    description: 'One categorical with low cardinality',
  },
];
