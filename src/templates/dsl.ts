// A small helper language for writing templates as Blockly workspace JSON.

export type B = Record<string, unknown>;

/** Statement blocks chained with "next". */
export function chain(list: B[]): B | undefined {
  if (!list.length) return undefined;
  const [first, ...rest] = list.map((b) => ({ ...b }));
  let cur = first;
  for (const b of rest) {
    cur.next = { block: b };
    cur = b;
  }
  return first;
}

export function blk(type: string, opts: { f?: B; i?: Record<string, B | undefined>; body?: B[]; comment?: string; extra?: B } = {}): B {
  const b: B = { type };
  if (opts.f) b.fields = opts.f;
  const inputs: B = {};
  if (opts.i) for (const [k, v] of Object.entries(opts.i)) if (v) inputs[k] = { block: v };
  if (opts.body) {
    const c = chain(opts.body);
    if (c) inputs.DO = { block: c };
  }
  if (Object.keys(inputs).length) b.inputs = inputs;
  if (opts.comment) b.icons = { comment: { text: opts.comment, pinned: false, height: 80, width: 200 } };
  if (opts.extra) b.extraState = opts.extra;
  return b;
}

export const num = (v: number) => blk('math_number', { f: { NUM: v } });
export const txt = (v: string) => blk('text', { f: { TEXT: v } });
export const bool = (v: boolean) => blk('logic_boolean', { f: { BOOL: v ? 'TRUE' : 'FALSE' } });
export const get = (name: string) => blk('variables_get', { f: { VAR: { name } } });
export const set = (name: string, value: B, comment?: string) => blk('variables_set', { f: { VAR: { name } }, i: { VALUE: value }, comment });
export const change = (name: string, by: number) => blk('math_change', { f: { VAR: { name } }, i: { DELTA: num(by) } });

export const arith = (op: 'ADD' | 'MINUS' | 'MULTIPLY' | 'DIVIDE', a: B, b: B) => blk('math_arithmetic', { f: { OP: op }, i: { A: a, B: b } });
export const cmp = (op: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE', a: B, b: B) => blk('logic_compare', { f: { OP: op }, i: { A: a, B: b } });
export const and = (a: B, b: B) => blk('logic_operation', { f: { OP: 'AND' }, i: { A: a, B: b } });
export const or = (a: B, b: B) => blk('logic_operation', { f: { OP: 'OR' }, i: { A: a, B: b } });
export const not = (a: B) => blk('logic_negate', { i: { BOOL: a } });
export const abs = (a: B) => blk('math_single', { f: { OP: 'ABS' }, i: { NUM: a } });
export const neg = (a: B) => blk('math_single', { f: { OP: 'NEG' }, i: { NUM: a } });
export const minmax = (op: 'min' | 'max', a: B, b: B) => blk('ab_minmax', { f: { OP: op }, i: { A: a, B: b } });
export const random = (from: number, to: number) => blk('ab_random', { i: { FROM: num(from), TO: num(to) } });
export const pressed = (button: string) => blk('ab_is_pressed', { f: { BUTTON: button } });

export const forRange = (name: string, from: B, to: B, body: B[], comment?: string) =>
  blk('controls_for', { f: { VAR: { name } }, i: { FROM: from, TO: to, BY: num(1) }, body, comment });
export const whileDo = (cond: B, body: B[]) => blk('controls_whileUntil', { f: { MODE: 'WHILE' }, i: { BOOL: cond }, body });
export const repeat = (times: number, body: B[]) => blk('controls_repeat_ext', { i: { TIMES: num(times) }, body });
export const breakLoop = () => blk('controls_flow_statements', { f: { FLOW: 'BREAK' } });
export const forKind = (name: string, kind: string, body: B[], comment?: string) =>
  blk('ab_for_each_kind', { f: { VAR: { name }, KIND: kind }, body, comment });

export function ifThen(cond: B, then: B[], els?: B[], comment?: string): B {
  const inputs: B = { IF0: { block: cond } };
  const t = chain(then);
  if (t) inputs.DO0 = { block: t };
  if (els) {
    const e = chain(els);
    if (e) inputs.ELSE = { block: e };
  }
  const b: B = { type: 'controls_if', inputs };
  if (els) b.extraState = { hasElse: true };
  if (comment) b.icons = { comment: { text: comment, pinned: false, height: 80, width: 200 } };
  return b;
}

export const prop = (sprite: string, p: string) => blk('ab_sprite_get_prop', { f: { PROP: p }, i: { SPRITE: get(sprite) } });
export const setProp = (sprite: string, p: string, v: B, comment?: string) =>
  blk('ab_sprite_set_prop', { f: { PROP: p }, i: { SPRITE: get(sprite), VALUE: v }, comment });
export const flag = (sprite: string, f: string, on = true) => blk('ab_sprite_set_flag', { f: { FLAG: f, ON: on ? 'on' : 'off' }, i: { SPRITE: get(sprite) } });
export const hitting = (sprite: string, dir: string) => blk('ab_sprite_is_hitting', { f: { DIR: dir }, i: { SPRITE: get(sprite) } });

export function call(name: string, params: string[] = [], args: B[] = []): B {
  if (!params.length) return { type: 'procedures_callnoreturn', extraState: { name } };
  return { ...callRet(name, params, args), type: 'procedures_callnoreturn' };
}

export function func(name: string, body: B[], comment?: string, params: string[] = []): B {
  const b = blk('procedures_defnoreturn', { f: { NAME: name }, comment, extra: params.length ? { params: params.map((p) => ({ name: p })) } : undefined });
  const c = chain(body);
  if (c) b.inputs = { STACK: { block: c } };
  return b;
}

/** Function with parameters that gives back a value. */
export function funcRet(name: string, params: string[], body: B[], ret: B, comment?: string): B {
  const b = blk('procedures_defreturn', { f: { NAME: name }, comment, extra: { params: params.map((p) => ({ name: p })) } });
  const inputs: B = { RETURN: { block: ret } };
  const c = chain(body);
  if (c) inputs.STACK = { block: c };
  b.inputs = inputs;
  return b;
}

export function callRet(name: string, params: string[], args: B[]): B {
  const inputs: B = {};
  args.forEach((a, i) => (inputs[`ARG${i}`] = { block: a }));
  return { type: 'procedures_callreturn', extraState: { name, params }, inputs };
}

/** Places top level blocks in a column. */
export function workspace(tops: B[]): B {
  let y = 20;
  const blocks = tops.map((b, i) => {
    const placed = { ...b, x: 20 + (i % 2) * 420, y };
    if (i % 2 === 1) y += 260;
    return placed;
  });
  return { blocks: { languageVersion: 0, blocks } };
}
