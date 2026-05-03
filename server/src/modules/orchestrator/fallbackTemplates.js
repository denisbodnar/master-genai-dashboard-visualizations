// Fallback D3.js templates for all 7 chart types — aggregated from examples/.

import { code as lineCode } from '../promptBuilder/examples/line.js';
import { code as barCode } from '../promptBuilder/examples/bar.js';
import { code as scatterCode } from '../promptBuilder/examples/scatter.js';
import { code as pieCode } from '../promptBuilder/examples/pie.js';
import { code as multilineCode } from '../promptBuilder/examples/multiline.js';
import { code as groupedBarCode } from '../promptBuilder/examples/grouped-bar.js';
import { code as scatterColorCode } from '../promptBuilder/examples/scatter-color.js';

export const fallbackTemplates = {
  line:          lineCode,
  bar:           barCode,
  scatter:       scatterCode,
  pie:           pieCode,
  multiline:     multilineCode,
  'grouped-bar': groupedBarCode,
  'scatter-color': scatterColorCode,
};

/**
 * Returns the fallback template for a given chart type.
 * Falls back to 'bar' if the type is unknown.
 *
 * @param {string} chartType
 * @returns {string}
 */
export function getFallbackTemplate(chartType) {
  return fallbackTemplates[chartType] ?? fallbackTemplates.bar;
}
