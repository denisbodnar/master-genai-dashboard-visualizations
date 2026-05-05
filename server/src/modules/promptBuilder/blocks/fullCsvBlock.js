/**
 * @fileoverview B_schema block for the Full CSV strategy.
 * An alternative data-transfer strategy for the LLM.
 *
 * Instead of a compact Schema JSON, sends the first MAX_ROWS rows of the
 * input CSV as raw text. Used exclusively in the experimental comparison
 * (Full CSV vs Schema+Sample).
 *
 * The row limit is required to avoid context-window overflow — even with
 * the 50-row cap the block can be 2,000–5,000 tokens, which is 5–15× larger
 * than Schema+Sample [14].
 */

const MAX_ROWS = 50; // maximum number of CSV rows included in the prompt

/**
 * Builds the B_schema block in Full CSV mode.
 * Substitutes raw CSV text (truncated to MAX_ROWS rows) instead of
 * a structured Schema JSON.
 *
 * @param {string} csvText   - Full CSV file text.
 * @param {number} totalRows - Total number of rows (used for annotation).
 * @returns {string} B_schema block text in Full CSV format.
 */
export function buildFullCsvBlock(csvText, totalRows) {
  if (!csvText || typeof csvText !== 'string') {
    return '[Dataset - Full CSV]\n(no data)';
  }

  // Split into lines, keep header + first MAX_ROWS data rows
  const lines = csvText.trim().split('\n').filter(Boolean);
  const header = lines[0];                       // header row
  const dataLines = lines.slice(1, MAX_ROWS + 1); // first MAX_ROWS data rows

  const truncated = dataLines.length < lines.length - 1;
  const csvSlice = [header, ...dataLines].join('\n');

  const annotation = truncated
    ? `(showing first ${dataLines.length} of ${totalRows ?? lines.length - 1} rows)`
    : `(${dataLines.length} rows total)`;

  return [
    '[Dataset - Full CSV]',
    annotation,
    csvSlice,
  ].join('\n');
}
