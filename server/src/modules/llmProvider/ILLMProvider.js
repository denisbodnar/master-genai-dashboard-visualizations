/**
 * @fileoverview Інтерфейс ILLMProvider — абстракція над LLM-провайдерами.
 * Підрозділ 2.5.2 записки: єдиний контракт для OpenAI та Ollama.
 *
 * Усі методи є async і повертають уніфікований результат `LLMResponse`.
 */

/**
 * @typedef {Object} LLMUsage
 * @property {number} promptTokens    - Кількість токенів у запиті.
 * @property {number} completionTokens - Кількість токенів у відповіді.
 * @property {number} latencyMs       - Час виконання запиту в мілісекундах.
 */

/**
 * @typedef {Object} LLMResponse
 * @property {string}   content - Текстовий вміст відповіді від моделі.
 * @property {LLMUsage} usage   - Статистика використання ресурсів.
 * @property {any}      raw     - Сирий об'єкт відповіді від API провайдера.
 */

/**
 * @typedef {Object} ChartSelectionInput
 * @property {object}   schema     - Schema JSON (результат inferSchema).
 * @property {string[]} candidates - Список допустимих типів графіків.
 */

/**
 * @typedef {Object} ChartSelectionResponse
 * @property {string} chartType - Обраний тип графіка.
 * @property {string} [reasoning] - Пояснення вибору від LLM (опційно).
 */

/**
 * @interface ILLMProvider
 *
 * Єдиний інтерфейс для взаємодії з LLM-провайдерами.
 * Конкретні реалізації: `OpenAIProvider`, `OllamaProvider`.
 *
 * Метод        | Вхід                               | Вихід
 * -------------|------------------------------------|-----------
 * generateCode | prompt (string), options (object)  | LLMResponse
 * refineCode   | originalCode, errorTrace, prompt   | LLMResponse
 * selectChartType | {schema, candidates}            | ChartSelectionResponse
 */

/**
 * Генерує D3.js-код на основі системного та користувацького промптів.
 *
 * @function generateCode
 * @memberof ILLMProvider
 * @param {{ systemPrompt: string, userPrompt: string }} prompt - Сформований промпт.
 * @param {object} [options] - Додаткові параметри (temperature, max_tokens тощо).
 * @returns {Promise<LLMResponse>}
 */

/**
 * Уточнює раніше згенерований код на основі трасування помилки.
 * Використовується в циклі Self-Refine [24].
 *
 * @function refineCode
 * @memberof ILLMProvider
 * @param {string} originalCode  - Код, що не пройшов валідацію.
 * @param {string} errorTrace    - Повідомлення про помилку з validator.
 * @param {{ systemPrompt: string, userPrompt: string }} prompt - Feedback-промпт.
 * @returns {Promise<LLMResponse>}
 */

/**
 * Обирає тип графіка на основі схеми даних (LLM-fallback для rule-based агента).
 *
 * @function selectChartType
 * @memberof ILLMProvider
 * @param {ChartSelectionInput} input
 * @returns {Promise<ChartSelectionResponse>}
 */
