// Type checking for the IR. Blockly variables have no type, so the types of
// variables, function parameters and return values are worked out from how
// they are used.

import { getApi } from '../engine/api';
import type { Diagnostic, Expr, Func, Program, Stmt, Ty } from './ir';

export interface TypeInfo {
  vars: Map<string, Ty>;
  funcs: Map<string, { params: Ty[]; ret: Ty }>;
}

export function typeOf(e: Expr, info: TypeInfo, locals?: Map<string, Ty>): Ty {
  switch (e.k) {
    case 'num':
      return 'num';
    case 'bool':
      return 'bool';
    case 'str':
    case 'join':
      return 'str';
    case 'var':
      return locals?.get(e.name) ?? info.vars.get(e.name) ?? 'num';
    case 'bin':
      return ['+', '-', '*', '/', '%'].includes(e.op) ? 'num' : 'bool';
    case 'un':
      return e.op === 'neg' ? 'num' : 'bool';
    case 'cond':
      return typeOf(e.a, info, locals);
    case 'api':
      return getApi(e.fn)?.ret ?? 'num';
    case 'call':
      return info.funcs.get(e.name)?.ret ?? 'num';
    case 'enum':
      return 'num';
  }
}

function walkStmts(stmts: Stmt[], fn: (s: Stmt) => void) {
  for (const s of stmts) {
    fn(s);
    switch (s.k) {
      case 'if':
        walkStmts(s.then, fn);
        if (s.else) walkStmts(s.else, fn);
        break;
      case 'while':
      case 'repeat':
      case 'for':
      case 'forKind':
        walkStmts(s.body, fn);
        break;
    }
  }
}

function walkExprs(stmts: Stmt[], fn: (e: Expr) => void) {
  const visit = (e: Expr) => {
    fn(e);
    switch (e.k) {
      case 'join':
        e.parts.forEach(visit);
        break;
      case 'bin':
        visit(e.a);
        visit(e.b);
        break;
      case 'un':
        visit(e.a);
        break;
      case 'cond':
        visit(e.c);
        visit(e.a);
        visit(e.b);
        break;
      case 'api':
      case 'call':
        e.args.forEach(visit);
        break;
    }
  };
  walkStmts(stmts, (s) => {
    switch (s.k) {
      case 'set':
        visit(s.value);
        break;
      case 'expr':
        visit(s.e);
        break;
      case 'if':
      case 'while':
        visit(s.cond);
        break;
      case 'repeat':
        visit(s.count);
        break;
      case 'for':
        visit(s.from);
        visit(s.to);
        break;
      case 'forKind':
        visit(s.kind);
        break;
      case 'return':
        if (s.value) visit(s.value);
        break;
    }
  });
}

/** Every expression in the program. */
export function forEachExpr(p: Program, fn: (e: Expr) => void) {
  for (const { body } of bodies(p)) walkExprs(body, fn);
}

/** All statement lists in the program, with the function they belong to. */
function bodies(p: Program): { body: Stmt[]; func?: Func }[] {
  return [...p.events.map((e) => ({ body: e.body })), ...p.funcs.map((f) => ({ body: f.body, func: f }))];
}

export function checkProgram(p: Program): { info: TypeInfo; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const info: TypeInfo = { vars: new Map(), funcs: new Map() };

  // Variables bound by events and loops have a fixed type.
  const fixed = new Map<string, Ty>();
  for (const ev of p.events) {
    if (ev.k === 'overlap') {
      fixed.set(ev.sv, 'sprite');
      fixed.set(ev.ov, 'sprite');
    } else if (ev.k === 'tile') {
      fixed.set(ev.sv, 'sprite');
      fixed.set(ev.col, 'num');
      fixed.set(ev.row, 'num');
    }
  }
  for (const { body } of bodies(p)) {
    walkStmts(body, (s) => {
      if (s.k === 'for') fixed.set(s.name, 'num');
      if (s.k === 'forKind') fixed.set(s.name, 'sprite');
    });
  }

  for (const f of p.funcs) info.funcs.set(f.name, { params: f.params.map(() => 'num'), ret: f.ret });

  // A few rounds are enough for types to flow through variables and calls.
  for (let round = 0; round < 4; round++) {
    for (const v of p.vars) {
      if (!info.vars.has(v.name)) info.vars.set(v.name, fixed.get(v.name) ?? v.ty);
    }
    for (const { body, func } of bodies(p)) {
      const locals = func ? new Map(func.params.map((pr, i) => [pr.name, info.funcs.get(func.name)!.params[i]])) : undefined;
      walkStmts(body, (s) => {
        if (s.k === 'set' && !locals?.has(s.name) && !fixed.has(s.name)) {
          const t = typeOf(s.value, info, locals);
          if (t !== 'num') info.vars.set(s.name, t);
        }
        if (s.k === 'return' && s.value && func) {
          const t = typeOf(s.value, info, locals);
          const f = info.funcs.get(func.name)!;
          if (t !== 'num' && t !== 'str') f.ret = t;
        }
      });
      walkExprs(body, (e) => {
        if (e.k === 'call') {
          const f = info.funcs.get(e.name);
          if (!f) return;
          e.args.forEach((a, i) => {
            const t = typeOf(a, info, locals);
            if (i < f.params.length && t !== 'num' && t !== 'str') f.params[i] = t;
          });
        }
      });
    }
  }
  for (const [name, t] of fixed) info.vars.set(name, t);

  // Report values used with the wrong type.
  for (const { body, func } of bodies(p)) {
    const locals = func ? new Map(func.params.map((pr, i) => [pr.name, info.funcs.get(func.name)!.params[i]])) : undefined;
    walkStmts(body, (s) => {
      if (s.k === 'set') {
        const want = locals?.get(s.name) ?? info.vars.get(s.name) ?? 'num';
        const got = typeOf(s.value, info, locals);
        if (got === 'str') diagnostics.push({ level: 'error', key: 'diag.textVariable', params: { name: s.name }, id: s.id });
        else if (got !== want && !(want === 'num' && got === 'bool')) {
          diagnostics.push({ level: 'error', key: 'diag.typeMismatch', params: { name: s.name }, id: s.id });
        }
      }
    });
    walkExprs(body, (e) => {
      if (e.k !== 'api') return;
      const fn = getApi(e.fn);
      if (!fn) {
        diagnostics.push({ level: 'error', key: 'diag.unknownFunction', params: { name: e.fn }, id: e.id });
        return;
      }
      fn.args.forEach((want, i) => {
        const a = e.args[i];
        if (!a) return;
        if (want === 'sprite' && typeOf(a, info, locals) !== 'sprite') {
          diagnostics.push({ level: 'error', key: 'diag.needSprite', id: a.id ?? e.id });
        }
      });
    });
  }
  return { info, diagnostics };
}
