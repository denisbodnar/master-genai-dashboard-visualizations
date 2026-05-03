// Per-column statistics for Schema JSON.

function round(value, digits = 2) {
  return Number.parseFloat(value.toFixed(digits));
}

function computeNumeric(values) {
  const nums = values.map(Number);
  const n = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  
  const std = Math.sqrt(variance);
  let skewness = 0;
  if (std > 0) {
    skewness = nums.reduce((acc, v) => acc + Math.pow(v - mean, 3), 0) / (n * Math.pow(std, 3));
  }

  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    mean: round(mean),
    std: round(std),
    skewness: round(skewness),
  };
}

function computeCategorical(values) {
  const freq = new Map();
  for (const v of values) {
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  let mode = null;
  let modeCount = -1;
  for (const [value, count] of freq.entries()) {
    if (count > modeCount) {
      mode = value;
      modeCount = count;
    }
  }
  return {
    cardinality: freq.size,
    mode,
  };
}

function detectTemporalStep(sortedIsoDates) {
  if (sortedIsoDates.length < 2) return 'unknown';
  const parse = (s) => new Date(s).getTime();
  const diffs = [];
  for (let i = 1; i < sortedIsoDates.length; i += 1) {
    diffs.push(parse(sortedIsoDates[i]) - parse(sortedIsoDates[i - 1]));
  }
  const medianDiffMs = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
  const day = 24 * 60 * 60 * 1000;
  if (medianDiffMs <= day * 1.5) return 'day';
  if (medianDiffMs <= day * 10) return 'week';
  if (medianDiffMs <= day * 45) return 'month';
  if (medianDiffMs <= day * 120) return 'quarter';
  return 'year';
}

function computeTemporal(values) {
  const sorted = [...values].sort();
  return {
    range: [sorted[0], sorted[sorted.length - 1]],
    step: detectTemporalStep(sorted),
  };
}

/**
 * Головна функція обчислення статистик.
 * @param {Array} rawValues - сирі значення стовпця (включно з порожніми).
 * @param {string} type - Temporal | Numeric | Categorical.
 */
export function computeStats(rawValues, type) {
  const nonEmpty = rawValues.filter((v) => v !== null && v !== undefined && v !== '');
  const nullRate = round((rawValues.length - nonEmpty.length) / rawValues.length, 3);

  let typeStats;
  if (type === 'Numeric') typeStats = computeNumeric(nonEmpty);
  else if (type === 'Temporal') typeStats = computeTemporal(nonEmpty);
  else typeStats = computeCategorical(nonEmpty);

  return { ...typeStats, null_rate: nullRate };
}
