/**
 * @fileoverview MockD3 — мок-об'єкт бібліотеки D3.js для ізольованого виконання.
 * Підрозділ 3.4 записки: "MockD3 імітує D3.js API, перехоплює виклики
 * та перевіряє коректність data binding".
 *
 * Архітектура:
 *   - Всі chainable-методи повертають той самий проксі (fluent API)
 *   - Лічильники: selectCalls, dataBindCalls, appendCalls, svgAppended
 *   - scale*, axis*, утиліти повертають функції або константи-замінники
 *   - timeFormat/format повертають identity-функції
 *
 * НЕ імпортує D3.js (лише для сервера/тестів).
 */

/**
 * Створює та повертає мок-об'єкт MockD3 зі стейтом та chainable API.
 *
 * @returns {object} MockD3-об'єкт, сумісний з D3.js v7 API.
 */
export function createMockD3() {
  // ── Стейт (лічильники для перевірки після виконання) ──────────────────────
  const state = {
    selectCalls:   0,
    dataBindCalls: 0,
    appendCalls:   0,
    svgAppended:   false,
    lastDataLength: 0,
  };

  // ── Проксі — єдиний об'єкт, що повертається з усіх ланцюжкових методів ───
  // Використовуємо forward-reference: proxy оголошується після chainable
  let proxy;

  // Фабрика scale-функцій: поводяться як Scale D3 (identity + .domain/.range/.nice)
  function makeScale() {
    const scaleFn = (val) => (typeof val === 'number' ? val : 0);
    scaleFn.domain   = () => scaleFn;
    scaleFn.range    = () => scaleFn;
    scaleFn.nice     = () => scaleFn;
    scaleFn.padding  = () => scaleFn;
    scaleFn.paddingInner = () => scaleFn;
    scaleFn.paddingOuter = () => scaleFn;
    scaleFn.bandwidth = () => 20;
    scaleFn.ticks    = () => [];
    scaleFn.tickFormat = () => (d) => String(d);
    scaleFn.copy     = () => makeScale();
    scaleFn.invert   = (d) => d;
    return scaleFn;
  }

  // Фабрика axis-функцій: приймають scale, повертають функцію g => void
  function makeAxis() {
    const axisCall = () => {};
    axisCall.ticks = () => axisCall;
    axisCall.tickFormat = () => axisCall;
    axisCall.tickSize = () => axisCall;
    axisCall.tickSizeInner = () => axisCall;
    axisCall.tickSizeOuter = () => axisCall;
    axisCall.tickPadding = () => axisCall;
    axisCall.tickValues = () => axisCall;
    axisCall.scale = () => axisCall;
    return () => axisCall;
  }

  // Фабрика line/area/arc-генераторів
  function makePathGenerator() {
    const gen = () => 'M 0 0';
    gen.x = () => gen;
    gen.y = () => gen;
    gen.x0 = () => gen;
    gen.x1 = () => gen;
    gen.y0 = () => gen;
    gen.y1 = () => gen;
    gen.curve = () => gen;
    gen.defined = () => gen;
    gen.innerRadius = () => gen;
    gen.outerRadius = () => gen;
    gen.startAngle = () => gen;
    gen.endAngle = () => gen;
    gen.padAngle = () => gen;
    gen.value = () => gen;
    gen.sort = () => gen;
    return gen;
  }

  // ── Chainable proxy ────────────────────────────────────────────────────────
  proxy = new Proxy({}, {
    get(_, prop) {
      if (typeof prop === 'symbol') {
        if (prop === Symbol.iterator) {
           return function* () { yield proxy; };
        }
        return undefined;
      }

      // ── Стейт (читання) ────────────────────────────────────────────────
      if (prop === '__state__') return state;

      // Публічні лічильники (для перевірки після виконання)
      if (prop === 'selectCalls')    return state.selectCalls;
      if (prop === 'dataBindCalls')  return state.dataBindCalls;
      if (prop === 'appendCalls')    return state.appendCalls;
      if (prop === 'svgAppended')    return state.svgAppended;
      if (prop === 'lastDataLength') return state.lastDataLength;

      // ── Chainable методи селекцій та маніпуляцій ──────────────────────
      if (prop === 'select') {
        return (selector) => {
          state.selectCalls++;
          return proxy;
        };
      }

      if (prop === 'selectAll') return () => proxy;

      if (prop === 'append') {
        return (tag) => {
          state.appendCalls++;
          if (typeof tag === 'string' && tag.toLowerCase() === 'svg') {
            state.svgAppended = true;
          }
          return proxy;
        };
      }

      if (prop === 'data') {
        return (arr) => {
          state.dataBindCalls++;
          if (Array.isArray(arr)) state.lastDataLength = arr.length;
          return proxy;
        };
      }

      // Прості chainable: повертають proxy
      const chainable = [
        'attr', 'style', 'text', 'html', 'classed', 'property',
        'enter', 'exit', 'join', 'remove', 'merge',
        'on', 'dispatch',
        'transition', 'duration', 'ease', 'delay',
        'call', 'filter', 'sort', 'order',
        'raise', 'lower',
        'datum', 'each',
        'insert', 'clone',
        'node', 'nodes',
        'empty', 'size',
      ];
      if (chainable.includes(prop)) {
        return typeof prop === 'string' && prop === 'node'
          ? () => ({ getBoundingClientRect: () => ({ width: 600, height: 400 }) })
          : () => proxy;
      }

      // ── Scales ────────────────────────────────────────────────────────
      if ([
        'scaleLinear', 'scaleBand', 'scaleTime',
        'scaleOrdinal', 'scaleSequential', 'scaleLog',
        'scalePow', 'scaleSqrt', 'scalePoint',
        'scaleIdentity', 'scaleThreshold', 'scaleQuantile',
      ].includes(prop)) {
        return () => makeScale();
      }

      // ── Axes ──────────────────────────────────────────────────────────
      if (['axisBottom', 'axisLeft', 'axisRight', 'axisTop'].includes(prop)) {
        return makeAxis();
      }

      // ── Path generators ───────────────────────────────────────────────
      if (['line', 'area', 'arc', 'pie', 'symbol'].includes(prop)) {
        return () => makePathGenerator();
      }

      // ── Утиліти ───────────────────────────────────────────────────────
      if (prop === 'max')    return (arr, fn) => fn ? Math.max(...arr.map(fn)) : Math.max(...arr);
      if (prop === 'min')    return (arr, fn) => fn ? Math.min(...arr.map(fn)) : Math.min(...arr);
      if (prop === 'sum')    return (arr, fn) => arr.reduce((s, d) => s + (fn ? fn(d) : d), 0);
      if (prop === 'mean')   return (arr, fn) => {
        const vals = fn ? arr.map(fn) : arr;
        return vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
      };
      if (prop === 'extent') return (arr, fn) => {
        const vals = fn ? arr.map(fn) : arr;
        return [Math.min(...vals), Math.max(...vals)];
      };
      if (prop === 'range')  return (start, stop, step = 1) => {
        const result = [];
        for (let i = start; i < stop; i += step) result.push(i);
        return result;
      };
      if (prop === 'groups') return () => [];
      if (prop === 'group')  return () => new Map();
      if (prop === 'rollup') return () => new Map();
      if (prop === 'index')  return () => new Map();

      // ── Кольорові схеми ───────────────────────────────────────────────
      if (prop === 'schemeCategory10') {
        return ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd',
                '#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf'];
      }
      if (prop === 'interpolateBlues') return (t) => `rgb(${Math.round(t*200)},${Math.round(t*200)},255)`;
      if (prop === 'interpolateOranges') return (t) => `rgb(255,${Math.round(t*200)},0)`;
      if (['schemeTableau10', 'schemePastel1', 'schemePastel2'].includes(prop)) {
        return Array(10).fill('#ccc');
      }

      // ── timeFormat / format ───────────────────────────────────────────
      if (prop === 'timeFormat') return () => (d) => String(d);
      if (prop === 'timeParse')  return () => (d) => new Date(d);
      if (prop === 'format')     return () => (d) => String(d);
      if (prop === 'timeFormatLocale') return () => ({
        format: () => (d) => String(d),
        parse: () => (d) => new Date(d),
      });

      // ── Curve ─────────────────────────────────────────────────────────
      if (prop.startsWith('curve')) return {};

      // ── Інше (symbol types, brush тощо) ──────────────────────────────
      return () => proxy;
    },
  });

  return proxy;
}
