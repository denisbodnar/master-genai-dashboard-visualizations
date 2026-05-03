// Factory for LLM providers.

import { OpenAIProvider } from './OpenAIProvider.js';
import { OllamaProvider } from './OllamaProvider.js';

/**
 * @param {'openai' | 'ollama'} name
 * @param {object} [configOverrides]
 * @returns {OpenAIProvider | OllamaProvider}
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
