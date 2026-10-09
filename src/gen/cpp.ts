// IR to C++ for the device. The output is one .ino file that includes
// ab_config.h (from the hardware profile) and the engine in core/ardublocks.

import { API, getApi } from '../engine/api';
import { BUILTIN_KINDS } from '../engine/enums';
import { checkProgram, typeOf, type TypeInfo } from '../ir/check';
import type { Diagnostic, Expr, Program, Stmt, Ty } from '../ir/ir';
import { encodeImage, encodeTilemap, type Project } from '../project/model';
import { enumNumber, eventsOf, hash16, Names } from './common';
import { stringLiteral, wrap16 } from './names';
import { Writer } from './writer';

export interface CppResult {
  code: string;
  ranges: Map<string, [number, number]>;
  diagnostics: Diagnostic[];
}

const CPP_TYPE: Record<Ty, string> = { num: 'int16_t', bool: 'bool', sprite: 'uint8_t', str: 'int16_t', void: 'void' };
const BUILTIN_KIND_CONST = ['ab::KIND_PLAYER', 'ab::KIND_ENEMY', 'ab::KIND_PROJECTILE', 'ab::KIND_FOOD'];

function bytes(list: number[], perLine = 16): string[] {
  const out: string[] = [];
  for (let i = 0; i < list.length; i += perLine) {
    out.push(list.slice(i, i + perLine).map((b) => `0x${b.toString(16).padStart(2, '0')}`).join(', ') + ',');
  }
  return out;
}

class CppGen {
  w = new Writer();
  names: Names;
  info!: TypeInfo;
  diagnostics: Diagnostic[] = [];
  locals?: Map<string, Ty>;
  private tmp = 0;

  constructor(private program: Program, private project: Project) {
    this.names = new Names(project);
  }

  run(): CppResult {
    const { info, diagnostics } = checkProgram(this.program);
    this.info = info;
    this.diagnostics.push(...diagnostics);
    const p = this.program;
    const w = this.w;

    w.line(`// ${this.project.name.replace(/[\r\n]/g, ' ')}`);
    w.line('// Made with ArduBlocks. This file is generated from the blocks.');
    w.line();
    w.line('#include "ab_config.h"');
    if (eventsOf(p, 'overlap').length) w.line('#define AB_HAS_OVERLAP 1');
    if (eventsOf(p, 'tile').length) w.line('#define AB_HAS_TILE_OVERLAP 1');
    const cells = Math.max(8, ...this.project.tilemaps.map((m) => m.width * m.height));
    w.line(`#define AB_TILE_CELLS ${cells}`);
    w.line(`#define AB_HISCORE_MAGIC 0x${hash16(this.project.id).toString(16).toUpperCase()}`);
    w.line('#include "ardublocks.h"');
    w.line();

    this.assets();
    this.globals();
    this.functions();
    this.events();

    w.line('void setup() {');
    w.line('  ab::begin();');
    w.line('}');
    w.line();
    w.line('void loop() {');
    w.line('  ab::frame();');
    w.line('}');
    return { code: w.toString(), ranges: w.ranges, diagnostics: this.diagnostics };
  }

  assets() {
    const w = this.w;
    const pr = this.project;
    if (pr.kinds.length) {
      w.line('// Sprite kinds');
      w.line('enum : uint8_t {');
      pr.kinds.forEach((k, i) => w.line(`  ${this.names.userKindConst(k)} = ${BUILTIN_KINDS.length + i},`));
      w.line('};');
      w.line();
    }
    if (pr.images.length) {
      w.line('// Images');
      for (const img of pr.images) {
        w.line(`static const uint8_t ${this.names.image(img.id)}[] PROGMEM = {`);
        for (const l of bytes(encodeImage(img.width, img.height, img.frames))) w.line('  ' + l);
        w.line('};');
      }
      w.line();
    }
    if (pr.tilemaps.length || pr.tiles.length) {
      w.line('// Tiles');
      let solid = 0;
      pr.tiles.forEach((t, i) => {
        w.line(`static const uint8_t tile_${i + 1}[] PROGMEM = {`);
        for (const l of bytes(encodeImage(8, 8, [t.pixels]))) w.line('  ' + l);
        w.line('};');
        if (t.solid) solid |= 1 << (i + 1);
      });
      const list = ['0', ...pr.tiles.map((_, i) => `tile_${i + 1}`)].join(', ');
      w.line(`static const uint8_t *const tileImages[] PROGMEM = {${list}};`);
      w.line(`#define TILE_SOLID 0x${solid.toString(16)}`);
      for (const m of pr.tilemaps) {
        w.line(`static const uint8_t ${this.names.tilemap(m.id)}[] PROGMEM = {`);
        for (const l of bytes(encodeTilemap(m))) w.line('  ' + l);
        w.line('};');
      }
      w.line();
    }
  }

  globals() {
    const w = this.w;
    const vars = [...this.info.vars.entries()];
    if (vars.length) w.line('// Variables');
    for (const [name, ty] of vars) w.line(`${CPP_TYPE[ty]} ${this.names.vars.get(name)};`);
    eventsOf(this.program, 'every').forEach((_, i) => w.line(`uint32_t every_${i};`));
    w.line();
    w.line('void ab_init_globals() {');
    w.indent();
    for (const [name, ty] of vars) w.line(`${this.names.vars.get(name)} = ${ty === 'sprite' ? 'ab::NONE' : ty === 'bool' ? 'false' : '0'};`);
    eventsOf(this.program, 'every').forEach((_, i) => w.line(`every_${i} = 0;`));
    w.dedent();
    w.line('}');
    w.line();
  }

  functions() {
    const w = this.w;
    const funcs = this.program.funcs;
    if (!funcs.length) return;
    const sig = (f: (typeof funcs)[number]) => {
      const t = this.info.funcs.get(f.name)!;
      const params = f.params.map((pr, i) => `${CPP_TYPE[t.params[i]]} ${this.names.vars.get(pr.name)}`).join(', ');
      return `${CPP_TYPE[t.ret === 'str' ? 'num' : t.ret]} ${this.names.funcs.get(f.name)}(${params})`;
    };
    for (const f of funcs) w.line(sig(f) + ';');
    w.line();
    for (const f of funcs) {
      const t = this.info.funcs.get(f.name)!;
      this.locals = new Map(f.params.map((pr, i) => [pr.name, t.params[i]]));
      w.track(f.id, () => {
        w.line(sig(f) + ' {');
        w.indent();
        this.stmts(f.body);
        if (t.ret !== 'void') w.line(`return ${t.ret === 'bool' ? 'false' : t.ret === 'sprite' ? 'ab::NONE' : '0'};`);
        w.dedent();
        w.line('}');
      });
      this.locals = undefined;
      w.line();
    }
  }

  /** Writes one handler function per event, and the hooks that call them. */
  events() {
    const w = this.w;
    const p = this.program;
    const handler = (name: string, id: string | undefined, body: Stmt[], before: string[] = []) => {
      w.track(id, () => {
        w.line(`static void ${name}() {`);
        w.indent();
        before.forEach((l) => w.line(l));
        this.stmts(body);
        w.dedent();
        w.line('}');
      });
      w.line();
    };

    const simple = (k: 'start' | 'update' | 'draw', hook: string) => {
      const evs = eventsOf(p, k);
      evs.forEach((e, i) => handler(`on_${k}_${i}`, e.id, e.body));
      const every = k === 'update' ? eventsOf(p, 'every') : [];
      every.forEach((e, i) => handler(`on_every_${i}`, e.id, e.body));
      w.line(`void ${hook}() {`);
      evs.forEach((_, i) => w.line(`  on_${k}_${i}();`));
      every.forEach((e, i) => w.line(`  if (ab::every(every_${i}, ${Math.max(1, Math.round(e.ms))})) on_every_${i}();`));
      w.line('}');
      w.line();
    };
    simple('start', 'ab_on_start');
    simple('update', 'ab_on_update');
    simple('draw', 'ab_on_draw');

    const buttons = eventsOf(p, 'button');
    buttons.forEach((e, i) => handler(`on_button_${i}`, e.id, e.body));
    w.line('void ab_on_button(uint8_t button, uint8_t pressed) {');
    buttons.forEach((e, i) => {
      w.line(`  if (button == ${enumNumber('button', e.button, this.names)} && pressed == ${e.pressed ? 1 : 0}) on_button_${i}();`);
    });
    w.line('}');
    w.line();

    const overlaps = eventsOf(p, 'overlap');
    overlaps.forEach((e, i) => handler(`on_overlap_${i}`, e.id, e.body));
    w.line('void ab_on_overlap(uint8_t a, uint8_t b) {');
    if (overlaps.length) w.line('  uint8_t ka = ab::kindOf(a), kb = ab::kindOf(b);');
    overlaps.forEach((e, i) => {
      const ka = this.kind(e.a);
      const kb = this.kind(e.b);
      const sv = this.names.vars.get(e.sv);
      const ov = this.names.vars.get(e.ov);
      w.line(`  if (ka == ${ka} && kb == ${kb}) { ${sv} = a; ${ov} = b; on_overlap_${i}(); }`);
      if (e.a !== e.b) w.line(`  else if (ka == ${kb} && kb == ${ka}) { ${sv} = b; ${ov} = a; on_overlap_${i}(); }`);
      w.line('  if (!ab::exists(a) || !ab::exists(b)) return;');
    });
    w.line('}');
    w.line();

    const tiles = eventsOf(p, 'tile');
    tiles.forEach((e, i) => handler(`on_tile_${i}`, e.id, e.body));
    w.line('void ab_on_tile(uint8_t s, int16_t col, int16_t row) {');
    tiles.forEach((e, i) => {
      const sv = this.names.vars.get(e.sv);
      const cv = this.names.vars.get(e.col);
      const rv = this.names.vars.get(e.row);
      w.line(
        `  if (ab::kindOf(s) == ${this.kind(e.kind)} && ab::tileAt(col, row) == ${this.names.tile(e.tile)}) { ${sv} = s; ${cv} = col; ${rv} = row; on_tile_${i}(); }`,
      );
    });
    w.line('}');
    w.line();

    const lifeZero = eventsOf(p, 'lifeZero');
    lifeZero.forEach((e, i) => handler(`on_life_zero_${i}`, e.id, e.body));
    w.line('bool ab_on_life_zero() {');
    lifeZero.forEach((_, i) => w.line(`  on_life_zero_${i}();`));
    w.line(`  return ${lifeZero.length ? 'true' : 'false'};`);
    w.line('}');
    w.line();
  }

  kind(name: string): string {
    const n = enumNumber('kind', name, this.names);
    if (n < BUILTIN_KINDS.length) return BUILTIN_KIND_CONST[n];
    return this.names.userKindConst(name);
  }

  varName(name: string): string {
    return this.names.vars.get(name);
  }

  stmts(list: Stmt[]) {
    for (const s of list) this.w.track(s.id, () => this.stmt(s));
  }

  block(body: Stmt[]) {
    this.w.indent();
    this.stmts(body);
    this.w.dedent();
  }

  stmt(s: Stmt) {
    const w = this.w;
    switch (s.k) {
      case 'set':
        w.line(`${this.varName(s.name)} = ${this.expr(s.value)};`);
        break;
      case 'expr':
        w.line(`${this.expr(s.e)};`);
        break;
      case 'if': {
        w.line(`if (${this.cond(s.cond)}) {`);
        this.block(s.then);
        let rest = s.else;
        while (rest && rest.length === 1 && rest[0].k === 'if') {
          const elif = rest[0];
          w.line(`} else if (${this.cond(elif.cond)}) {`);
          this.block(elif.then);
          rest = elif.else;
        }
        if (rest && rest.length) {
          w.line('} else {');
          this.block(rest);
        }
        w.line('}');
        break;
      }
      case 'while':
        w.line(`while (${this.cond(s.cond)}) {`);
        this.block(s.body);
        w.line('}');
        break;
      case 'repeat': {
        const i = `i${this.tmp++}`;
        w.line(`for (int16_t ${i} = 0; ${i} < ${this.expr(s.count)}; ${i}++) {`);
        this.block(s.body);
        w.line('}');
        break;
      }
      case 'for': {
        const v = this.varName(s.name);
        w.line(`for (${v} = ${this.expr(s.from)}; ${v} <= ${this.expr(s.to)}; ${v}++) {`);
        this.block(s.body);
        w.line('}');
        break;
      }
      case 'forKind': {
        const i = `s${this.tmp++}`;
        w.line(`for (uint8_t ${i} = 0; ${i} < AB_MAX_SPRITES; ${i}++) {`);
        w.line(`  if (ab::kindOf(${i}) != ${this.expr(s.kind)}) continue;`);
        w.line(`  ${this.varName(s.name)} = ${i};`);
        this.block(s.body);
        w.line('}');
        break;
      }
      case 'break':
        w.line('break;');
        break;
      case 'continue':
        w.line('continue;');
        break;
      case 'return':
        w.line(s.value ? `return ${this.expr(s.value)};` : 'return;');
        break;
      case 'cpp':
        for (const l of s.code.split('\n')) w.line(l);
        break;
      case 'comment':
        for (const l of s.text.split('\n')) w.line(`// ${l}`);
        break;
    }
  }

  cond(e: Expr): string {
    const s = this.expr(e);
    return s.startsWith('(') && s.endsWith(')') && balanced(s.slice(1, -1)) ? s.slice(1, -1) : s;
  }

  /** Text for a "str" argument: a pointer to the engine text buffer. */
  text(e: Expr): string {
    const parts: string[] = [];
    const add = (x: Expr) => {
      if (x.k === 'join') x.parts.forEach(add);
      else if (x.k === 'str') {
        if (x.v) parts.push(`ab::tbStr(PSTR(${stringLiteral(x.v)}))`);
      } else if (typeOf(x, this.info, this.locals) === 'bool') parts.push(`ab::tbStr(${this.expr(x)} ? PSTR("true") : PSTR("false"))`);
      else parts.push(`ab::tbNum(${this.expr(x)})`);
    };
    add(e);
    return `(ab::tbClear(), ${parts.length ? parts.join(', ') + ', ' : ''}ab::tb())`;
  }

  expr(e: Expr): string {
    switch (e.k) {
      case 'num': {
        const v = wrap16(e.v);
        if (v !== e.v) this.diagnostics.push({ level: 'warning', key: 'diag.numberRange', params: { value: e.v }, id: e.id });
        return v === -32768 ? '(-32767 - 1)' : String(v);
      }
      case 'bool':
        return e.v ? 'true' : 'false';
      case 'str':
      case 'join':
        return this.text(e);
      case 'var':
        return this.varName(e.name);
      case 'bin': {
        const a = this.expr(e.a);
        const b = this.expr(e.b);
        switch (e.op) {
          case '+':
          case '-':
          case '*':
            return `(int16_t)(${a} ${e.op} ${b})`;
          case '/':
            return `ab::div(${a}, ${b})`;
          case '%':
            return `ab::mod(${a}, ${b})`;
          default:
            return `(${a} ${e.op} ${b})`;
        }
      }
      case 'un':
        return e.op === 'neg' ? `(int16_t)(-${this.expr(e.a)})` : `!${this.expr(e.a)}`;
      case 'cond':
        return `(${this.expr(e.c)} ? ${this.expr(e.a)} : ${this.expr(e.b)})`;
      case 'call':
        return `${this.names.funcs.get(e.name)}(${e.args.map((a) => this.expr(a)).join(', ')})`;
      case 'enum':
        return this.enumValue(e);
      case 'api': {
        const fn = getApi(e.fn);
        if (!fn) return '0';
        const args = fn.args.map((t, i) => {
          const a = e.args[i];
          if (!a) return '0';
          if (t === 'str') return this.text(a);
          return this.expr(a);
        });
        return fn.cpp.replace(/\$(\d)/g, (_, n) => args[Number(n)] ?? '0');
      }
    }
  }

  enumValue(e: Extract<Expr, { k: 'enum' }>): string {
    switch (e.type) {
      case 'kind':
        return this.kind(e.v);
      case 'image': {
        const n = this.names.image(e.v);
        if (!n) {
          this.diagnostics.push({ level: 'error', key: 'diag.noImage', id: e.id });
          return '0';
        }
        return n;
      }
      case 'tilemap': {
        const n = this.names.tilemap(e.v);
        if (!n) {
          this.diagnostics.push({ level: 'error', key: 'diag.noTilemap', id: e.id });
          return '0';
        }
        return n;
      }
      default:
        return String(enumNumber(e.type, e.v, this.names));
    }
  }
}

function balanced(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

export function generateCpp(program: Program, project: Project): CppResult {
  return new CppGen(program, project).run();
}

/** Names used by the API, for tests. */
export const API_IDS = Object.keys(API);
