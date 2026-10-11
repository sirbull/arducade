// IR to JavaScript for the simulator. The code uses the same integer rules
// as the device: numbers are 16 bit, division rounds toward zero, and
// division by zero gives 0.

import { getApi } from '../engine/api';
import { checkProgram, forEachExpr, typeOf, type TypeInfo } from '../ir/check';
import type { Diagnostic, Expr, Program, Stmt, Ty } from '../ir/ir';
import { encodeBackground, encodeImage, encodeTilemap, type Project } from '../project/model';
import { buttonMatch, effectFields, effectNames, enumNumber, eventsOf, hasParallax, hash16, melodies, Names, songs } from './common';
import { stringLiteral, wrap16 } from './names';
import { Writer } from './writer';
import { levelTransitionCode } from './levels';

export interface JsResult {
  code: string;
  diagnostics: Diagnostic[];
  hiscoreKey: number;
  /** Statement indices keep generated code independent of Blockly IDs. */
  debugIds?: string[];
}

/** Hooks returned by the generated code, called by the simulator engine. */
export interface GameHooks {
  inspect?(): Record<string, unknown>;
  init(): void;
  start(): Promise<void>;
  update(): Promise<void>;
  draw(): Promise<void>;
  button(b: number, pressed: number): Promise<void>;
  overlap(a: number, b: number): Promise<void>;
  tile(s: number, col: number, row: number): Promise<void>;
  lifeZero(): Promise<boolean>;
  hasOverlap: boolean;
  hasTile: boolean;
}

class JsGen {
  w = new Writer();
  names: Names;
  info!: TypeInfo;
  diagnostics: Diagnostic[] = [];
  locals?: Map<string, Ty>;
  private tmp = 0;
  private textCapacity = 31;
  private debugIds: string[] = [];
  private melodies: ReturnType<typeof melodies>;
  private songs: ReturnType<typeof songs>;
  private effects: ReturnType<typeof effectNames>;

  constructor(private program: Program, private project: Project) {
    this.names = new Names(project);
    this.melodies = melodies(program, project);
    this.songs = songs(program, project);
    this.effects = effectNames(program, this.names);
  }

  run(): JsResult {
    const { info } = checkProgram(this.program);
    this.info = info;
    forEachExpr(this.program, e => { if (e.k === 'api' && (e.fn === 'sprites.say' || e.fn.startsWith('sprites.speech'))) this.textCapacity = 63; });
    const w = this.w;
    const p = this.program;
    const pr = this.project;
    w.line(`E.textCapacity = ${this.textCapacity};`);

    for (const img of pr.images) w.line(`const ${this.names.image(img.id)} = E.image([${encodeImage(img.width, img.height, img.frames).join(',')}]);`);
    for (const bg of pr.backgrounds) w.line(`const ${this.names.image(bg.id)} = E.image([${encodeBackground(bg, hasParallax(p)).join(',')}]);`);
    const tiles = pr.tiles.map((t) => `E.image([${encodeImage(8, 8, [t.pixels]).join(',')}])`);
    let solid = 0;
    pr.tiles.forEach((t, i) => {
      if (t.solid) solid |= 1 << (i + 1);
    });
    w.line(`E.tileImages = [null${tiles.map((t) => ', ' + t).join('')}];`);
    w.line(`E.solidTiles = ${solid};`);
    for (const m of pr.tilemaps) w.line(`const ${this.names.tilemap(m.id)} = [${encodeTilemap(m).join(',')}];`);
    for (const m of this.melodies.values()) w.line(`const ${m.name} = [${m.steps.join(',')}];`);
    for (const s of this.songs.values()) w.line(`const ${s.name} = [${s.bytes.join(',')}];`);
    for (const { id, fx } of this.effects.values()) {
      w.line(`const ${id} = E.effect(${(fx.image && this.names.image(fx.image)) || 'null'}, [${effectFields(fx).join(',')}]);`);
    }

    const levelCode = levelTransitionCode(pr, this.names, false);
    for (const line of levelCode) w.line(line);
    const vars = [...info.vars.entries()];
    for (const [name] of vars) w.line(`let ${this.names.vars.get(name)};`);
    eventsOf(p, 'every').forEach((_, i) => w.line(`const every_${i} = { t: 0 };`));

    for (const f of p.funcs) {
      const t = info.funcs.get(f.name)!;
      this.locals = new Map(f.params.map((pr2, i) => [pr2.name, t.params[i]]));
      const params = f.params.map((pr2) => this.names.vars.get(pr2.name)).join(', ');
      w.line(`async function ${this.names.funcs.get(f.name)}(${params}) {`);
      w.indent();
      this.stmts(f.body);
      if (t.ret !== 'void') w.line(`return ${t.ret === 'bool' ? 'false' : t.ret === 'sprite' ? '255' : t.ret === 'str' ? '""' : '0'};`);
      w.dedent();
      w.line('}');
      this.locals = undefined;
    }

    const handler = (name: string, body: Stmt[]) => {
      w.line(`async function ${name}() {`);
      w.indent();
      this.stmts(body);
      w.dedent();
      w.line('}');
    };
    const calls = (k: 'start' | 'update' | 'draw') => {
      const evs = eventsOf(p, k);
      evs.forEach((e, i) => handler(`on_${k}_${i}`, e.body));
      return evs.map((_, i) => `await on_${k}_${i}();`);
    };
    const start = calls('start');
    const update = calls('update');
    eventsOf(p, 'every').forEach((e, i) => {
      handler(`on_every_${i}`, e.body);
      update.push(`if (E.every(every_${i}, ${Math.max(1, Math.round(e.ms))})) await on_every_${i}();`);
    });
    if (levelCode.length) update.push('updateLevelPortals();');
    const startMap = pr.tilemaps.find((map) => map.id === pr.startLevelId);
    if (startMap) start.push(`E.setMap(${this.names.tilemap(startMap.id)});`);
    if (levelCode.length) start.unshift('levelPortalLocked = false;');
    const draw = calls('draw');

    const buttons = eventsOf(p, 'button');
    buttons.forEach((e, i) => handler(`on_button_${i}`, e.body));
    const overlaps = eventsOf(p, 'overlap');
    overlaps.forEach((e, i) => handler(`on_overlap_${i}`, e.body));
    const tilesEv = eventsOf(p, 'tile');
    tilesEv.forEach((e, i) => handler(`on_tile_${i}`, e.body));
    const lifeZero = eventsOf(p, 'lifeZero');
    lifeZero.forEach((e, i) => handler(`on_life_zero_${i}`, e.body));

    w.line('return {');
    w.indent();
    w.line(`inspect() { return { ${vars.map(([name]) => `${stringLiteral(name)}: ${this.names.vars.get(name)}`).join(', ')} }; },`);
    w.line('init() {');
    for (const [name, ty] of vars) w.line(`  ${this.names.vars.get(name)} = ${ty === 'sprite' ? '255' : ty === 'bool' ? 'false' : ty === 'str' ? '""' : '0'};`);
    eventsOf(p, 'every').forEach((_, i) => w.line(`  every_${i}.t = 0;`));
    w.line('},');
    w.line(`async start() { ${start.join(' ')} },`);
    w.line(`async update() { ${update.join(' ')} },`);
    w.line(`async draw() { ${draw.join(' ')} },`);
    w.line('async button(button, pressed) {');
    buttons.forEach((e, i) =>
      w.line(`  if (pressed === ${e.pressed ? 1 : 0} && ${buttonMatch(e.button, this.names, 'E.isPressed')}) await on_button_${i}();`),
    );
    w.line('},');
    w.line('async overlap(a, b) {');
    if (overlaps.length) w.line('  const ka = E.kindOf(a), kb = E.kindOf(b);');
    overlaps.forEach((e, i) => {
      const ka = enumNumber('kind', e.a, this.names);
      const kb = enumNumber('kind', e.b, this.names);
      const sv = this.names.vars.get(e.sv);
      const ov = this.names.vars.get(e.ov);
      w.line(`  if (ka === ${ka} && kb === ${kb}) { ${sv} = a; ${ov} = b; await on_overlap_${i}(); }`);
      if (e.a !== e.b) w.line(`  else if (ka === ${kb} && kb === ${ka}) { ${sv} = b; ${ov} = a; await on_overlap_${i}(); }`);
      w.line('  if (!E.exists(a) || !E.exists(b)) return;');
    });
    w.line('},');
    w.line('async tile(s, col, row) {');
    tilesEv.forEach((e, i) => {
      const sv = this.names.vars.get(e.sv);
      const cv = this.names.vars.get(e.col);
      const rv = this.names.vars.get(e.row);
      w.line(
        `  if (E.kindOf(s) === ${enumNumber('kind', e.kind, this.names)} && E.tileAt(col, row) === ${this.names.tile(e.tile)}) { ${sv} = s; ${cv} = col; ${rv} = row; await on_tile_${i}(); }`,
      );
    });
    w.line('},');
    w.line(`async lifeZero() { ${lifeZero.map((_, i) => `await on_life_zero_${i}();`).join(' ')} return ${lifeZero.length ? 'true' : 'false'}; },`);
    w.line(`hasOverlap: ${overlaps.length > 0},`);
    w.line(`hasTile: ${tilesEv.length > 0},`);
    w.dedent();
    w.line('};');
    return { code: w.toString(), diagnostics: this.diagnostics, hiscoreKey: hash16(pr.id), debugIds: this.debugIds };
  }

  varName(name: string) {
    return this.names.vars.get(name);
  }

  stmts(list: Stmt[]) {
    for (const s of list) this.stmt(s);
  }

  block(body: Stmt[], loop: Stmt) {
    this.w.indent();
    this.checkpoint(loop);
    this.w.line('$lg();');
    this.stmts(body);
    this.w.dedent();
  }

  private checkpoint(s: Stmt) {
    const w = this.w;
    if (s.k !== 'comment') {
      const locals = [...(this.locals?.keys() ?? [])].map(name => `${stringLiteral(name)}: ${this.varName(name)}`).join(', ');
      w.line(`if (typeof $debug !== "undefined" && $debug) { const $wait = $debug(${this.debugIds.push(s.id ?? '') - 1}, { ${locals} }); if ($wait) await $wait; }`);
    }
  }

  stmt(s: Stmt) {
    const w = this.w;
    this.checkpoint(s);
    switch (s.k) {
      case 'set': {
        const ty = this.locals?.get(s.name) ?? this.info.vars.get(s.name) ?? 'num';
        const v = this.expr(s.value);
        w.line(`${this.varName(s.name)} = ${ty === 'num' ? `$w(${v})` : v};`);
        break;
      }
      case 'expr':
        w.line(`${this.expr(s.e)};`);
        break;
      case 'if': {
        w.line(`if (${this.expr(s.cond)}) {`);
        this.w.indent();
        this.stmts(s.then);
        this.w.dedent();
        if (s.else && s.else.length) {
          w.line('} else {');
          this.w.indent();
          this.stmts(s.else);
          this.w.dedent();
        }
        w.line('}');
        break;
      }
      case 'while':
        w.line(`while (${this.expr(s.cond)}) {`);
        this.block(s.body, s);
        w.line('}');
        break;
      case 'repeat': {
        const i = `i${this.tmp++}`;
        w.line(`for (let ${i} = 0, n${i} = ${this.expr(s.count)}; ${i} < n${i}; ${i}++) {`);
        this.block(s.body, s);
        w.line('}');
        break;
      }
      case 'for': {
        const v = this.varName(s.name);
        w.line(`for (${v} = ${this.expr(s.from)}; ${v} <= ${this.expr(s.to)}; ${v} = $w(${v} + 1)) {`);
        this.block(s.body, s);
        w.line('}');
        break;
      }
      case 'forKind': {
        const i = `s${this.tmp++}`;
        w.line(`for (let ${i} = 0; ${i} < E.maxSprites; ${i}++) {`);
        w.line(`  if (E.kindOf(${i}) !== ${this.expr(s.kind)}) continue;`);
        w.line(`  ${this.varName(s.name)} = ${i};`);
        this.block(s.body, s);
        w.line('}');
        break;
      }
      case 'drawMode': {
        const saved = `drawMode${this.tmp++}`;
        w.line('{');
        w.indent();
        w.line(`const ${saved} = E.drawingMode;`);
        w.line(`E.drawingMode = ${this.expr(s.mode)};`);
        w.line('try {');
        w.indent();
        this.stmts(s.body);
        w.dedent();
        w.line(`} finally { E.drawingMode = ${saved}; }`);
        w.dedent();
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
        w.line('E.skippedCpp();');
        break;
      case 'comment':
        for (const l of s.text.split('\n')) w.line(`// ${l.replace(/\*\//g, '* /')}`);
        break;
    }
  }

  text(e: Expr): string {
    const parts: string[] = [];
    const add = (x: Expr) => {
      if (x.k === 'join') x.parts.forEach(add);
      else if (x.k === 'str') parts.push(stringLiteral(x.v));
      else if (typeOf(x, this.info, this.locals) === 'bool') parts.push(`(${this.expr(x)} ? "true" : "false")`);
      else parts.push(`String(${this.expr(x)})`);
    };
    add(e);
    return parts.length ? `E.limitText(${parts.join(' + ')}, ${this.textCapacity})` : '""';
  }

  expr(e: Expr): string {
    switch (e.k) {
      case 'num':
        return String(wrap16(e.v));
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
            return `$w(${a} ${e.op} ${b})`;
          case '/':
            return `$div(${a}, ${b})`;
          case '%':
            return `$mod(${a}, ${b})`;
          case '==':
            return `(${a} === ${b})`;
          case '!=':
            return `(${a} !== ${b})`;
          default:
            return `(${a} ${e.op} ${b})`;
        }
      }
      case 'un':
        return e.op === 'neg' ? `$w(-${this.expr(e.a)})` : `!${this.expr(e.a)}`;
      case 'cond':
        return `(${this.expr(e.c)} ? ${this.expr(e.a)} : ${this.expr(e.b)})`;
      case 'call':
        return `(await ${this.names.funcs.get(e.name)}(${e.args.map((a) => this.expr(a)).join(', ')}))`;
      case 'enum':
        if (e.type === 'image') return this.names.image(e.v) ?? 'null';
        if (e.type === 'tilemap') return this.names.tilemap(e.v) ?? 'null';
        if (e.type === 'melodyAsset') return this.melodies.get(`asset:${e.v}`)?.name ?? '[]';
        if (e.type === 'melody') return this.melodies.get(`text:${e.v}`)!.name;
        if(e.type==='polyEffect')return this.songs.get(`effect:${e.v}`)?.name ?? 'null';
        if (e.type === 'songAsset') return this.songs.get(`asset:${e.v}`)?.name ?? 'null';
        if (e.type === 'song') return this.songs.get(e.v)?.name ?? 'null';
        if (e.type === 'effect') return this.effects.get(e.v)?.id ?? 'null';
        return String(enumNumber(e.type, e.v, this.names));
      case 'api': {
        const fn = getApi(e.fn);
        if (!fn) return '0';
        const first = e.args[0];
        const tempo = first?.k === 'enum' ? this.project.melodies?.find(m => m.id === first.v)?.tempo ?? 120 : 120;
        const args = fn.args.map((t, i) => {
          const a = e.args[i];
          if (!a) return '0';
          if (t === 'str') return this.text(a);
          return this.expr(a);
        });
        const code = fn.js.replace('$tempo', String(tempo)).replace(/\$(\d)/g, (_, n) => args[Number(n)] ?? '0');
        return fn.async ? `(${code})` : code;
      }
    }
  }
}

export function generateJs(program: Program, project: Project): JsResult {
  return new JsGen(program, project).run();
}
