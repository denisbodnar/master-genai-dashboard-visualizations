/**
 * @fileoverview ILLMProvider interface — abstraction over LLM providers.
 *
 * All methods are async and return a unified `LLMResponse` result.
 */

/**
 * @typedef {Object} LLMUsage
 * @property {number} promptTokens    - Number of tokens in the request.
 * @property {number} completionTokens - Number of tokens in the response.
 * @property {number} latencyMs       - Request execution time in milliseconds.
 */

/**
 * @typedef {Object} LLMResponse
 * @property {string}   content - Text content of the model's response.
 * @property {LLMUsage} usage   - Resource usage statistics.
 * @property {any}      raw     - Raw response object from the provider API.
 */

/**
 * @typedef {Object} ChartSelectionInput
 * @property {object}   schema     - Schema JSON (result of inferSchema).
 * @property {string[]} candidates - List of permitted chart types.
 */

/**
 * @typedef {Object} ChartSelectionResponse
 * @property {string} chartType - Selected chart type.
 * @property {string} [reasoning] - LLM explanation for the selection (optional).
 */

/**
 * @interface ILLMProvider
 *
 * Unified interface for interacting with LLM providers.
 * Concrete implementations: `OpenAIProvider`, `OllamaProvider`.
 *
 * Method           | Input                              | Output
 * -----------------|------------------------------------|-----------
 * generateCode     | prompt (string), options (object)  | LLMResponse
 * refineCode       | originalCode, errorTrace, prompt   | LLMResponse
 * selectChartType  | {schema, candidates}               | ChartSelectionResponse
 */

/**
 * Generates D3.js code from the system and user prompts.
 *
 * @function generateCode
 * @memberof ILLMProvider
 * @param {{ systemPrompt: string, userPrompt: string }} prompt - Assembled prompt.
 * @param {object} [options] - Additional parameters (temperature, max_tokens, etc.).
 * @returns {Promise<LLMResponse>}
 */

/**
 * Refines previously generated code based on an error trace.
 * Used in the Self-Refine loop [24].
 *
 * @function refineCode
 * @memberof ILLMProvider
 * @param {string} originalCode  - Code that failed validation.
 * @param {string} errorTrace    - Error message from the validator.
 * @param {{ systemPrompt: string, userPrompt: string }} prompt - Feedback prompt.
 * @returns {Promise<LLMResponse>}
 */

/**
 * Selects a chart type based on the data schema (LLM fallback for the rule-based agent).
 *
 * @function selectChartType
 * @memberof ILLMProvider
 * @param {ChartSelectionInput} input
 * @returns {Promise<ChartSelectionResponse>}
 */
