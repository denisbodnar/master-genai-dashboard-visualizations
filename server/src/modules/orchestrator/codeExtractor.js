// Extracts a JS code block from an LLM text response.

/**
 * @param {string} text - Full LLM response text.
 * @returns {string | null} Extracted JavaScript code, or null if not found.
 */
export function extractCodeBlock(text) {
  if (!text || typeof text !== 'string') return null;

  const cleaned = text.replace(/^\uFEFF/, '').trim();

  const fencedMatch = cleaned.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  if (fencedMatch) return fencedMatch[1].trim();

  if (
    cleaned.startsWith('function ') ||
    cleaned.startsWith('const ') ||
    cleaned.startsWith('let ') ||
    cleaned.includes('renderChart')
  ) {
    return cleaned;
  }

  return null;
}
