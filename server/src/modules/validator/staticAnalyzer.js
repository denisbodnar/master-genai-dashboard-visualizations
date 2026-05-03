// Static AST analysis of generated D3 code (level 1 validation).

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

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
 * @param {string} code
 * @returns {{ ok: true } | { ok: false, errorType: string, message: string, detail?: string }}
 */
export function staticAnalyze(code) {
  let ast;
  try {
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

  const fnResult = _findRenderChart(ast);
  if (!fnResult.found) {
    return {
      ok: false,
      errorType: 'missing_render_chart',
      message: 'Function renderChart(data, containerSelector) not found',
    };
  }
  if (!fnResult.correctSignature) {
    return {
      ok: false,
      errorType: 'wrong_signature',
      message: `renderChart must have params [data, containerSelector], got: [${fnResult.params.join(', ')}]`,
    };
  }

  const forbiddenResult = _checkForbiddenApis(ast);
  if (forbiddenResult) {
    return {
      ok: false,
      errorType: 'forbidden_api',
      message: `Forbidden API usage detected: ${forbiddenResult}`,
      detail: forbiddenResult,
    };
  }

  if (!_hasD3Select(ast)) {
    return {
      ok: false,
      errorType: 'missing_d3_select',
      message: 'Code must contain at least one d3.select(...) call',
    };
  }

  return { ok: true };
}

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

function _paramName(param) {
  if (param.type === 'Identifier') return param.name;
  if (param.type === 'AssignmentPattern') return param.left?.name ?? '?';
  return '?';
}

function _isCorrectSignature(params) {
  return params.length === 2 && params[0] === 'data' && params[1] === 'containerSelector';
}

function _checkForbiddenApis(ast) {
  let violation = null;

  walk.simple(ast, {
    CallExpression(node) {
      if (violation) return;

      const callee = node.callee;

      if (callee.type === 'Identifier' && FORBIDDEN_IDENTIFIERS.has(callee.name)) {
        violation = callee.name;
        return;
      }

      if (callee.type === 'Identifier' && callee.name === 'fetch') {
        violation = 'fetch';
        return;
      }

      if (
        node.type === 'CallExpression' &&
        callee.type === 'Identifier' &&
        callee.name === 'Function'
      ) {
        violation = 'Function';
        return;
      }

      if (node.type === 'ImportExpression') {
        violation = 'import(...)';
        return;
      }

      if (callee.type === 'Identifier' && callee.name === 'require') {
        violation = 'require(...)';
        return;
      }

      if (callee.type === 'MemberExpression') {
        const key = `${_memberKey(callee.object)}.${callee.property?.name ?? ''}`;
        if (FORBIDDEN_MEMBER_CALLS.has(key)) {
          violation = key;
        }
      }
    },

    NewExpression(node) {
      if (violation) return;
      if (
        node.callee.type === 'Identifier' &&
        node.callee.name === 'Function'
      ) {
        violation = 'new Function(...)';
      }
    },

    ImportExpression() {
      if (!violation) violation = 'import(...)';
    },
  });

  return violation;
}

function _memberKey(node) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    return `${_memberKey(node.object)}.${node.property?.name ?? ''}`;
  }
  return '';
}

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
