/**
 * Таблиця правил відображення комбінацій стовпців на типи візуалізацій.
 * Порядок відповідає пріоритету в Таблиці 3.1 (зверху вниз).
 * Кожне правило — функція-предикат над лічильниками типів та метаданими схеми.
 */

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
    description: 'Один часовий + декілька числових',
  },
  {
    id: 'R2',
    chartType: 'line',
    predicate: ({ counts }) => counts.Temporal === 1 && counts.Numeric === 1,
    description: 'Один часовий + один числовий',
  },
  {
    id: 'R3',
    chartType: 'grouped-bar',
    predicate: ({ counts }) => counts.Categorical === 2 && counts.Numeric === 1,
    description: 'Два категоріальних + один числовий',
  },
  {
    id: 'R4',
    chartType: 'bar',
    predicate: ({ counts }) => counts.Categorical === 1 && counts.Numeric === 1,
    description: 'Один категоріальний + один числовий',
  },
  {
    id: 'R5',
    chartType: 'scatter-color',
    predicate: ({ counts }) => counts.Categorical === 1 && counts.Numeric === 2,
    description: 'Один категоріальний + два числових',
  },
  {
    id: 'R6',
    chartType: 'scatter',
    predicate: ({ counts }) => counts.Numeric === 2 && counts.Categorical === 0 && counts.Temporal === 0,
    description: 'Два числових',
  },
  {
    id: 'R7',
    chartType: 'pie',
    predicate: ({ counts, categoricalCardinality }) =>
      counts.Categorical === 1 && counts.Numeric === 0 && categoricalCardinality <= KAPPA_LOW,
    description: 'Один категоріальний з низькою кардинальністю',
  },
];
