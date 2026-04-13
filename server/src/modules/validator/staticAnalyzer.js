/**
 * @fileoverview Рівень 1 валідації: статичний аналіз коду через AST.
 * Підрозділ 3.4 записки, псевдокод staticAnalyze().
 *
 * Перевірки (послідовні, перша невдача зупиняє аналіз):
 *   1. Синтаксичний парсинг через acorn
 *   2. Наявність функції renderChart(data, containerSelector)
 *   3. Коректна сигнатура [data, containerSelector]
 *   4. Відсутність заборонених API (чорний список)
 *   5. Наявність хоча б одного виклику d3.select(...)
 *
 * Використовує acorn [ecmaVersion: 2022, sourceType: 'module'] та acorn-walk.
 */

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * Заборонені виклики та ідентифікатори (підрозділ 3.4 записки).
 * eval, Function-конструктор, мережеві API, застарілі D3.js методи [5, 6].
 */
const FORBIDDEN_IDENTIFIERS = new Set([
  'eval',
  'XMLHttpRequest',
]);

const FORBIDDEN_MEMBER_CALLS = new Set([
  'document.cookie',
  'd3.nest',
  'd3.csv',
  'd3.tsv',
]);

/**
 * Виконує статичний аналіз JavaScript-коду.
 *
 * @param {string} code - Код для аналізу.
 * @returns {{ ok: true } | { ok: false, errorType: string, message: string, detail?: string }}
 */
export function staticAnalyze(code) {
  // ── Крок 1: Синтаксичний парсинг ─────────────────────────────────────────
  let ast;
  try {
    // sourceType: 'module' для підтримки ESM; якщо fail — спробуємо script
    try {
      ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
    } catch {
      ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
    }
  } catch (err) {
    return {
      ok: false,
      errorType: 'syntax',
      message: `SyntaxError: ${err.message}`,
    };
  }

  // ── Крок 2 + 3: Пошук функції renderChart та перевірка сигнатури ─────────
  const renderChartResult = _findRenderChart(ast);
  if (!renderChartResult.found) {
    return {
      ok: false,
      errorType: 'missing_render_chart',
      message: 'Function renderChart(data, containerSelector) not found',
    };
  }
  if (!renderChartResult.correctSignature) {
    return {
      ok: false,
      errorType: 'wrong_signature',
      message: `renderChart must have params [data, containerSelector], got: [${renderChartResult.params.join(', ')}]`,
    };
  }

  // ── Крок 4: Чорний список заборонених API ──────────────────────────────────
  const forbiddenResult = _checkForbiddenApis(ast, code);
  if (forbiddenResult) {
    return {
      ok: false,
      errorType: 'forbidden_api',
      message: `Forbidden API usage detected: ${forbiddenResult}`,
      detail: forbiddenResult,
    };
  }

  // ── Крок 5: Наявність d3.select ───────────────────────────────────────────
  if (!_hasD3Select(ast)) {
    return {
      ok: false,
      errorType: 'missing_d3_select',
      message: 'Code must contain at least one d3.select(...) call',
    };
  }

  return { ok: true };
}

// ─── Приватні хелпери ─────────────────────────────────────────────────────────

/**
 * Знаходить оголошення renderChart у AST (FunctionDeclaration або
 * VariableDeclarator з ArrowFunctionExpression / FunctionExpression).
 *
 * @private
 * @param {object} ast
 * @returns {{ found: boolean, correctSignature: boolean, params: string[] }}
 */
function _findRenderChart(ast) {
  let found = false;
  let correctSignature = false;
  let params = [];

  walk.simple(ast, {
    FunctionDeclaration(node) {
      if (node.id?.name === 'renderChart') {
        found = true;
        params = node.params.map(_paramName);
        correctSignature = _isCorrectSignature(params);
      }
    },
    VariableDeclarator(node) {
      if (node.id?.name === 'renderChart') {
        const init = node.init;
        if (
          init?.type === 'ArrowFunctionExpression' ||
          init?.type === 'FunctionExpression'
        ) {
          found = true;
          params = init.params.map(_paramName);
          correctSignature = _isCorrectSignature(params);
        }
      }
    },
  });

  return { found, correctSignature, params };
}

/**
 * Повертає ім'я параметра із AST-вузла.
 * @private
 */
function _paramName(param) {
  if (param.type === 'Identifier') return param.name;
  if (param.type === 'AssignmentPattern') return param.left?.name ?? '?';
  return '?';
}

/**
 * Перевіряє сигнатуру [data, containerSelector].
 * @private
 */
function _isCorrectSignature(params) {
  return params.length === 2 && params[0] === 'data' && params[1] === 'containerSelector';
}

/**
 * Перевіряє наявність заборонених API через обхід AST.
 * Повертає назву порушника або null.
 *
 * @private
 * @param {object} ast
 * @param {string} code - Оригінальний код для перевірки `import(...)`.
 * @returns {string | null}
 */
function _checkForbiddenApis(ast, code) {
  let violation = null;

  walk.simple(ast, {
    // Виклики функцій: eval(...), fetch(...), XMLHttpRequest(...)
    CallExpression(node) {
      if (violation) return;

      const callee = node.callee;

      // eval(...)
      if (callee.type === 'Identifier' && FORBIDDEN_IDENTIFIERS.has(callee.name)) {
        violation = callee.name;
        return;
      }

      // fetch(...) — може бути Identifier або MemberExpression (window.fetch)
      if (callee.type === 'Identifier' && callee.name === 'fetch') {
        violation = 'fetch';
        return;
      }

      // new Function(...)
      if (
        node.type === 'CallExpression' &&
        callee.type === 'Identifier' &&
        callee.name === 'Function'
      ) {
        violation = 'Function';
        return;
      }

      // import(...) — динамічний імпорт
      if (node.type === 'ImportExpression') {
        violation = 'import(...)';
        return;
      }

      // require(...)
      if (callee.type === 'Identifier' && callee.name === 'require') {
        violation = 'require(...)';
        return;
      }

      // d3.csv(...), d3.tsv(...), d3.nest(...)
      if (callee.type === 'MemberExpression') {
        const key = `${_memberKey(callee.object)}.${callee.property?.name ?? ''}`;
        if (FORBIDDEN_MEMBER_CALLS.has(key)) {
          violation = key;
        }
      }
    },

    // new Function(...) через NewExpression
    NewExpression(node) {
      if (violation) return;
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Function'
      ) {
        violation = 'new Function(...)';
      }
    },

    // import(...) через ImportExpression у Node 20+
    ImportExpression(node) {
      if (!violation) violation = 'import(...)';
    },

    // document.cookie via MemberExpression
    MemberExpression(node) {
      if (violation) return;
      const key = `${_memberKey(node.object)}.${node.property?.name ?? ''}`;
      if (FORBIDDEN_MEMBER_CALLS.has(key)) {
        violation = key;
      }
    },
  });

  return violation;
}

/**
 * Повертає рядковий ключ об'єкта MemberExpression (один рівень).
 * @private
 */
function _memberKey(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    return `${_memberKey(node.object)}.${node.property?.name ?? ''}`;
  }
  return '';
}

/**
 * Перевіряє наявність d3.select(...) у AST.
 * @private
 * @param {object} ast
 * @returns {boolean}
 */
function _hasD3Select(ast) {
  let found = false;
  walk.simple(ast, {
    CallExpression(node) {
      if (found) return;
      const callee = node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.object?.name === 'd3' &&
        callee.property?.name === 'select'
      ) {
        found = true;
      }
    },
  });
  return found;
}
