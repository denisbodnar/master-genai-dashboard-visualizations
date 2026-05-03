/**
 * @fileoverview Блок B_schema для стратегії Full CSV.
 * Підрозділ 3.3 записки: альтернативна стратегія передачі даних до LLM.
 *
 * Замість компактного Schema JSON передає перші MAX_ROWS рядків
 * вхідного CSV у сирому вигляді. Використовується виключно в
 * експериментальному порівнянні (Розділ 5): Full CSV vs Schema+Sample.
 *
 * Обмеження кількості рядків необхідне для уникнення переповнення
 * контекстного вікна — навіть з обмеженням у 50 рядків блок може
 * становити 2000–5000 токенів, що у 5–15 разів більше за Schema+Sample [14].
 */

const MAX_ROWS = 50; // максимальна кількість рядків CSV у промпті

/**
 * Формує блок B_schema у режимі Full CSV.
 * Підставляє сирий текст CSV (обрізаний до MAX_ROWS рядків) замість
 * структурованого Schema JSON.
 *
 * @param {string} csvText   - Повний текст CSV-файлу.
 * @param {number} totalRows - Загальна кількість рядків (для анотації).
 * @returns {string} Текст блоку B_schema у форматі Full CSV.
 */
export function buildFullCsvBlock(csvText, totalRows) {
  if (!csvText || typeof csvText !== 'string') {
    return '[Dataset - Full CSV]\n(no data)';
  }

  // Розбиваємо на рядки, зберігаємо заголовок + перші MAX_ROWS рядків даних
  const lines = csvText.trim().split('\n').filter(Boolean);
  const header = lines[0];                       // рядок заголовків
  const dataLines = lines.slice(1, MAX_ROWS + 1); // перші MAX_ROWS рядків

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
