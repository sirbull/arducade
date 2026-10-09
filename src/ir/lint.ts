// Checks for mistakes beginners often make. Each finding points at a block
// and has a hint (the translation key with ".hint" added) about what to do.

import type { Diagnostic, Expr, Program, Stmt } from './ir';

/** Blocks that stop a loop from freezing the game. */
const PAUSING_APIS = new Set(['game.pause', 'game.splash']);

function walk(stmts: Stmt[], fn: (s: Stmt) => void) {
  for (const s of stmts) {
    fn(s);
    if (s.k === 'if') {
      walk(s.then, fn);
      if (s.else) walk(s.else, fn);
    } else if (s.k === 'while' || s.k === 'repeat' || s.k === 'for' || s.k === 'forKind') walk(s.body, fn);
  }
}

function exprsOf(s: Stmt): Expr[] {
  switch (s.k) {
    case 'set':
      return [s.value];
    case 'expr':
      return [s.e];
    case 'if':
    case 'while':
      return [s.cond];
    case 'repeat':
      return [s.count];
    case 'for':
      return [s.from, s.to];
    case 'forKind':
      return [s.kind];
    case 'return':
      return s.value ? [s.value] : [];
    default:
      return [];
  }
}

function walkExpr(e: Expr, fn: (e: Expr) => void) {
  fn(e);
  switch (e.k) {
    case 'join':
      e.parts.forEach((x) => walkExpr(x, fn));
      break;
    case 'bin':
      walkExpr(e.a, fn);
      walkExpr(e.b, fn);
      break;
    case 'un':
      walkExpr(e.a, fn);
      break;
    case 'cond':
      walkExpr(e.c, fn);
      walkExpr(e.a, fn);
      walkExpr(e.b, fn);
      break;
    case 'api':
    case 'call':
      e.args.forEach((x) => walkExpr(x, fn));
      break;
  }
}

/** True if a loop body can leave the loop or wait. */
function canStop(body: Stmt[]): boolean {
  let found = false;
  walk(body, (s) => {
    if (s.k === 'break' || s.k === 'return') found = true;
    for (const e of exprsOf(s)) walkExpr(e, (x) => {
      if (x.k === 'api' && PAUSING_APIS.has(x.fn)) found = true;
      // A function call may contain a break out of the game loop, so trust it.
      if (x.k === 'call') found = true;
    });
  });
  return found;
}

export function lintProgram(p: Program): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  const add = (d: Diagnostic) => {
    const key = `${d.key}|${d.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(d);
  };

  // Variables that get a value somewhere.
  const assigned = new Set<string>();
  for (const ev of p.events) {
    if (ev.k === 'overlap') [ev.sv, ev.ov].forEach((n) => assigned.add(n));
    if (ev.k === 'tile') [ev.sv, ev.col, ev.row].forEach((n) => assigned.add(n));
  }
  const bodies = [...p.events.map((e) => ({ body: e.body, event: e.k, params: [] as string[] })), ...p.funcs.map((f) => ({ body: f.body, event: 'function', params: f.params.map((x) => x.name) }))];
  for (const { body } of bodies) {
    walk(body, (s) => {
      if (s.k === 'set' || s.k === 'for' || s.k === 'forKind') assigned.add(s.name);
    });
  }

  for (const { body, event, params } of bodies) {
    walk(body, (s) => {
      for (const e of exprsOf(s)) {
        walkExpr(e, (x) => {
          if (x.k === 'var' && !assigned.has(x.name) && !params.includes(x.name)) {
            add({ level: 'warning', key: 'diag.varNeverSet', params: { name: x.name }, id: x.id ?? s.id });
          }
        });
      }
      if (event !== 'draw' && event !== 'function' && s.k === 'expr' && s.e.k === 'api' && s.e.fn.startsWith('draw.') && s.e.fn !== 'draw.getPixel') {
        add({ level: 'warning', key: 'diag.drawOutside', id: s.id });
      }
      if (s.k === 'while' && s.cond.k === 'bool' && s.cond.v && !canStop(s.body)) {
        add({ level: 'error', key: 'diag.endlessLoop', id: s.id });
      }
    });
  }

  if (!p.events.some((e) => e.k === 'start')) add({ level: 'warning', key: 'diag.noStart' });
  return out;
}
