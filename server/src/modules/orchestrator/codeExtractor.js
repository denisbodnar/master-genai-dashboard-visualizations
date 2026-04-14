/**
 * @fileoverview Екстрактор коду з відповіді LLM.
 * Підрозділ 3.3 записки: постобробка відповіді — витягування ```javascript блоку.
 *
 * "Відсутність блоку трактується як помилка генерації та одразу запускає
 *  цикл рефайнменту" (підрозділ 3.3).
 */

/**
 * Витягує JavaScript-код з текстової відповіді LLM.
 *
 * Алгоритм:
 *   1. Шукаємо ```javascript ... ``` або ``` js ... ``` через regex
 *   2. Якщо не знайдено — пробуємо парсити весь текст як код
 *   3. Видаляємо BOM та leading/trailing whitespace
 *
 * @param {string} text - Повна текстова відповідь від LLM.
 * @returns {string | null} Очищений JavaScript-код або null якщо видобути не вдалося.
 */
export function extractCodeBlock(text) {
  if (!text || typeof text !== 'string') return null;

  // Нормалізуємо BOM та зайві пробіли на початку
  const cleaned = text.replace(/^\uFEFF/, '').trim();

  // ── Крок 1: пошук ```javascript або ```js блоку ───────────────────────────
  const fencedMatch = cleaned.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  // ── Крок 2: fallback — весь текст як потенційний код ─────────────────────
  // Якщо текст починається з 'function' або містить renderChart — це вже код
  if (
    cleaned.startsWith('function ') ||
    cleaned.startsWith('const ') ||
    cleaned.startsWith('let ') ||
    cleaned.includes('renderChart')
  ) {
    return cleaned;
  }

  // Не вдалося витягти код
  return null;
}
