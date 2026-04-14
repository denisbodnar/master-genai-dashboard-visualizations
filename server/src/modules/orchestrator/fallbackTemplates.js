/**
 * @fileoverview Fallback-шаблони для всіх 7 типів графіків.
 * Підрозділ 3.4 записки: "fallback-механізм із заздалегідь підготованим
 * статичним шаблоном D3.js для заданого типу графіка [7, 8]".
 *
 * Спільне джерело правди: агрегує `code` з examples/*.js, щоб уникнути
 * дублювання між few-shot прикладами та fallback-шаблонами.
 */

import { code as lineCode } from '../promptBuilder/examples/line.js';
import { code as barCode } from '../promptBuilder/examples/bar.js';
import { code as scatterCode } from '../promptBuilder/examples/scatter.js';
import { code as pieCode } from '../promptBuilder/examples/pie.js';
import { code as multilineCode } from '../promptBuilder/examples/multiline.js';
import { code as groupedBarCode } from '../promptBuilder/examples/grouped-bar.js';
import { code as scatterColorCode } from '../promptBuilder/examples/scatter-color.js';

/**
 * Готові D3.js v7 шаблони для кожного типу графіка.
 * Використовуються як останній резерв після вичерпання ітерацій рефайнменту.
 *
 * @type {Record<string, string>}
 */
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
 * Повертає fallback-шаблон для заданого типу графіка.
 * Якщо тип невідомий — повертає bar як найзагальніший.
 *
 * @param {string} chartType
 * @returns {string}
 */
export function getFallbackTemplate(chartType) {
  return fallbackTemplates[chartType] ?? fallbackTemplates.bar;
}
