/**
 * Класифікація типів стовпців за ієрархією евристичних правил.
 * Реалізація відповідає алгоритму 3.1 (Крок 2): Temporal → Numeric → Categorical.
 */

const TEMPORAL_THRESHOLD = 0.8;
const NUMERIC_THRESHOLD = 0.9;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/;
const EU_DATE_RE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;

/**
 * Перевіряє, чи значення відповідає одному з підтримуваних темпоральних форматів.
 */
export function isTemporalValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return ISO_DATE_RE.test(trimmed) || EU_DATE_RE.test(trimmed);
}

/**
 * Перевіряє, чи значення парситься як кінцеве число.
 */
export function isNumericValue(value) {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return Number.isFinite(num);
}

/**
 * Визначає тип стовпця на основі порогових часток.
 */
export function inferColumnType(values) {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'Categorical';

  const total = nonEmpty.length;
  const temporalCount = nonEmpty.filter(isTemporalValue).length;
  if (temporalCount / total >= TEMPORAL_THRESHOLD) return 'Temporal';

  const numericCount = nonEmpty.filter(isNumericValue).length;
  if (numericCount / total >= NUMERIC_THRESHOLD) return 'Numeric';

  return 'Categorical';
}
