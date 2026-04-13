/**
 * @fileoverview Публічний фасад модуля llmProvider.
 * Експортує фабрику `createProvider` та класи провайдерів.
 *
 * Підрозділ 2.5.2: фабричний патерн для перемикання між провайдерами.
 */

import { OpenAIProvider } from './OpenAIProvider.js';
import { OllamaProvider } from './OllamaProvider.js';

/**
 * Фабрична функція для створення LLM-провайдера за іменем.
 *
 * @param {'openai' | 'ollama'} name - Назва провайдера.
 * @param {object} [configOverrides]  - Параметри, що перекривають дефолти з config.js.
 * @returns {OpenAIProvider | OllamaProvider}
 * @throws {Error} Якщо передано невідоме ім'я провайдера.
 *
 * @example
 * const provider = createProvider('ollama', { model: 'llama3.2' });
 * const provider = createProvider('openai', { temperature: 0.2 });
 */
export function createProvider(name, configOverrides = {}) {
  switch (name) {
    case 'openai':
      return new OpenAIProvider(configOverrides);
    case 'ollama':
      return new OllamaProvider(configOverrides);
    default:
      throw new Error(
        `Unknown LLM provider: "${name}". Valid options: "openai", "ollama".`,
      );
  }
}

export { OpenAIProvider, OllamaProvider };
