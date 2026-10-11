import { parseMelody } from '../engine/melody';
// IR to C++ for the device. The output is one .ino file that includes
// ab_config.h (from the hardware profile) and the engine in core/ardublocks.

import { API, getApi } from '../engine/api';
import { BUILTIN_KINDS } from '../engine/enums';
import { checkProgram, forEachExpr, typeOf, type TypeInfo } from '../ir/check';
import type { Diagnostic, Expr, Program, Stmt, Ty } from '../ir/ir';
import { encodeBackground, encodeImage, encodeTilemap, type Project } from '../project/model';
import { buttonMatch, effectFields, effectNames, enumNumber, eventsOf, hasParallax, hash16, melodies, Names, songs, soundEffects } from './common';
import { stringLiteral, wrap16 } from './names';
import { Writer } from './writer';
import { levelTransitionCode } from './levels';

export interface CppResult {
  code: string;
  ranges: Map<string, [number, number]>;
  diagnostics: Diagnostic[];
}

const CPP_TYPE: Record<Ty, string> = { num: 'int16_t', bool: 'bool', sprite: 'uint8_t', str: 'ab::Text', void: 'void' };
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
  private hasRawCpp = false;
  private tmp = 0;
  private melodies: ReturnType<typeof melodies>;
  private songs: ReturnType<typeof songs>;
  private sfx: ReturnType<typeof soundEffects>;
  private effects: ReturnType<typeof effectNames>;

  constructor(private program: Program, private project: Project) {
    this.names = new Names(project);
    this.melodies = melodies(program, project);
    this.songs = songs(program, project);
    this.sfx = soundEffects(program);
    this.effects = effectNames(program, this.names);
  }

  run(): CppResult {
    const { info, diagnostics } = checkProgram(this.program);
    this.info = info;
    this.diagnostics.push(...diagnostics);
    const p = this.program;
    const w = this.w;

    w.line(`// ${this.project.name.replace(/[\r\n]/g, ' ')}`);
    w.line('// Made with ArduCade. This file is generated from the blocks.');
    w.line();
    w.line('#include "ab_config.h"');
    let hasParticles = this.effects.size > 0;
    forEachExpr(p, e => { if (e.k === 'api' && e.fn.startsWith('particles.')) hasParticles = true; });
    let hasDrawMode = false, hasDrawReference = false;
    const scopes = (list: Stmt[]) => { for (const s of list) {
      if (s.k === 'cpp') this.hasRawCpp = true;
      if (s.k === 'drawMode') {
        hasDrawMode = true;
        if (s.mode.k !== 'num' || s.mode.v > 1) hasDrawReference = true;
      }
      if ('body' in s) scopes(s.body);
      if (s.k === 'if') { scopes(s.then); scopes(s.else ?? []); }
    } };
    p.events.forEach(e => scopes(e.body));
    p.funcs.forEach(f => scopes(f.body));
    forEachExpr(p, e => {
      if (e.k !== 'api') return;
      if (e.fn === 'draw.spriteReference') hasDrawMode = hasDrawReference = true;
      if (e.fn === 'sprites.setDrawMode') {
        hasDrawMode = true;
        const mode = e.args[1];
        if (mode?.k !== 'num' || mode.v > 1) hasDrawReference = true;
      }
    });
    if (hasDrawMode) w.line('#define AB_HAS_DRAW_MODE 1');
    if (hasDrawReference) w.line('#define AB_HAS_DRAW_REFERENCE 1');
    let hasSpeech = false, hasSpeechSettings = false;
    forEachExpr(p, e => { if (e.k === 'api' && (e.fn === 'sprites.say' || e.fn.startsWith('sprites.speech'))) hasSpeech = true; });
    forEachExpr(p, e => { if (e.k === 'api' && ['sprites.speechPosition', 'sprites.speechWidth', 'sprites.speechColors'].includes(e.fn)) hasSpeechSettings = true; });
    if (hasSpeech) w.line('#define AB_HAS_SPEECH 1');
    if (hasSpeechSettings || (hasSpeech && this.hasRawCpp)) w.line('#define AB_HAS_SPEECH_SETTINGS 1');
    if (hasParticles) w.line('#define AB_HAS_PARTICLES 1');
    let hasBackground = false, hasShake = false;
    forEachExpr(p, e => {
      if (e.k !== 'api') return;
      if (e.fn.startsWith('background.')) hasBackground = true;
      if (e.fn === 'scene.shake') hasShake = true;
    });
    if (hasBackground) w.line('#define AB_HAS_BACKGROUND 1');
    if (hasParallax(p)) w.line('#define AB_HAS_PARALLAX 1');
    if (hasShake) w.line('#define AB_HAS_SHAKE 1');
    let hasSongVolume = false, hasPolyEffects = false;
    forEachExpr(p, e => { if (e.k === 'api' && e.fn === 'music.setSongVolume') hasSongVolume = true; });
    if (hasSongVolume) w.line('#define AB_HAS_SONG_VOLUME 1');
    if (this.songs.size) {
      w.line('#define AB_HAS_SONGS 1');
      forEachExpr(p, e => { if (e.k === 'api' && e.fn === 'music.polyEffect') hasPolyEffects = true; });
      if (hasPolyEffects) w.line('#define AB_HAS_POLY_EFFECTS 1');
      let hasPitch = false;
      forEachExpr(p, e => { if (e.k === 'api' && e.fn === 'music.pitch') hasPitch = true; });
      if (hasPitch) w.line('#define AB_HAS_SONG_PITCH 1');
    }
    if (eventsOf(p, 'overlap').length) w.line('#define AB_HAS_OVERLAP 1');
    if (eventsOf(p, 'tile').length) w.line('#define AB_HAS_TILE_OVERLAP 1');
    const cells = Math.max(8, ...this.project.tilemaps.map((m) => m.width * m.height));
    w.line(`#define AB_TILE_CELLS ${cells}`);
    w.line(`#define AB_HISCORE_MAGIC 0x${hash16(this.project.id).toString(16).toUpperCase()}`);
    const unusedAt = w.lines.length;
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
    this.leaveOut(unusedAt);
    return { code: w.toString(), ranges: w.ranges, diagnostics: this.diagnostics };
  }

  /** Tells the engine which parts the game never uses, so they are left out of flash. */
  private leaveOut(at: number) {
    const body = this.w.lines.slice(at).join('\n');
    const unused = [
      ['AB_NO_SPRITES', /ab::(create|createProjectile|createProjectileFromPosition|spawnOnTiles)\(/],
      ['AB_NO_MAP', /ab::setMap\(/],
      ['AB_NO_OUTLINE', /ab::setOutline/],
      ['AB_NO_HUD', /ab::(setScore|changeScore|setLife|changeLife)\(/],
    ].filter(([, used]) => !(used as RegExp).test(body)).map(([name]) => `#define ${name} 1`);
    // Speech needs room on ATtiny85. Static sprites have no velocity or
    // acceleration, so their physics can be omitted without changing behavior.
    if (!this.hasRawCpp && this.w.lines.includes('#define AB_HAS_SPEECH 1') &&
        !/ab::(createProjectile|createProjectileFromPosition|moveWithButtons|setVelocity|setProp|changeProp)\(/.test(body)) {
      unused.push('#define AB_NO_SPRITE_MOTION 1');
    }
    if (/ab::timer/.test(body)) unused.push('#define AB_HAS_TIMERS 1');
    if (/ab::setLifePosition\(/.test(body)) unused.push('#define AB_LIFE_POS 1');
    if (/ab::setScorePosition\(/.test(body)) unused.push('#define AB_SCORE_POS 1');
    this.w.lines.splice(at, 0, ...unused);
    for (const [id, [a, b]] of this.w.ranges) if (a >= at) this.w.ranges.set(id, [a + unused.length, b + unused.length]);
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
    if (pr.backgrounds.length) {
      w.line('// Backgrounds');
      for (const bg of pr.backgrounds) {
        w.line(`static const uint8_t ${this.names.image(bg.id)}[] PROGMEM = {`);
        for (const l of bytes(encodeBackground(bg, hasParallax(this.program)))) w.line('  ' + l);
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
      w.line(`#define TILE_SOLID 0x${(solid >>> 0).toString(16)}UL`);
      for (const m of pr.tilemaps) {
        w.line(`static const uint8_t ${this.names.tilemap(m.id)}[] PROGMEM = {`);
        for (const l of bytes(encodeTilemap(m))) w.line('  ' + l);
        w.line('};');
      }
      w.line();
    }
    if (this.effects.size) {
      w.line('// Particle effects');
      for (const { id, fx } of this.effects.values()) {
        const img = fx.image ? this.names.image(fx.image) : '0';
        if (!img) this.diagnostics.push({ level: 'error', key: 'diag.noImage', id: fx.id });
        w.line(`static const ab::Effect ${id} PROGMEM = {${[img ?? '0', ...effectFields(fx)].join(', ')}};`);
      }
      w.line();
    }
    if (this.melodies.size) {
      w.line('// Melodies: frequency and length in quarter beats');
      for (const m of this.melodies.values()) w.line(`static const uint16_t ${m.name}[] PROGMEM = {${[...m.steps, 0, 0].join(', ')}};`);
      w.line();
    }
    const sfxTables = [...this.sfx.values()].filter((s) => s.steps.length);
    if (sfxTables.length) {
      w.line('// Sound effects: frequency and duration in ms');
      for (const s of sfxTables) w.line(`static const uint16_t ${s.name}[] PROGMEM = {${[...s.steps, 0, 0].join(', ')}};`);
      w.line();
    }
    if (this.songs.size) {
      w.line('// Songs: ATMlib data, see ab_atm.h');
      for (const s of this.songs.values()) w.line(`static const uint8_t ${s.name}[] PROGMEM = {${s.bytes.join(', ')}};`);
      w.line();
    }
  }

  globals() {
    const w = this.w;
    for (const line of levelTransitionCode(this.project, this.names, true)) w.line(line);
    // One struct, so a restart clears all variables with one memset instead of
    // one store per variable. The references compile to plain addresses.
    const fields = [
      ...[...this.info.vars.entries()].map(([name, ty]) => [CPP_TYPE[ty], this.names.vars.get(name)]),
      ...eventsOf(this.program, 'every').map((_, i) => ['uint32_t', `every_${i}`]),
    ];
    if (fields.length) {
      w.line('// Variables');
      w.line('static struct {');
      for (const [ty, n] of fields) w.line(`  ${ty} ${n};`);
      w.line('} ab_vars;');
      for (const [ty, n] of fields) w.line(`static ${ty} &${n} = ab_vars.${n};`);
    }
    w.line();
    w.line('void ab_init_globals() {');
    w.indent();
    if (fields.length) w.line('memset(&ab_vars, 0, sizeof(ab_vars));');
    for (const [name, ty] of this.info.vars) if (ty === 'sprite') w.line(`${this.names.vars.get(name)} = ab::NONE;`);
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
      return `${CPP_TYPE[t.ret]} ${this.names.funcs.get(f.name)}(${params})`;
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
        if (t.ret !== 'void') w.line(`return ${t.ret === 'bool' ? 'false' : t.ret === 'sprite' ? 'ab::NONE' : t.ret === 'str' ? 'ab::Text("")' : '0'};`);
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
      const portals = levelTransitionCode(this.project, this.names, true).length > 0;
      if (k === 'start' && portals) w.line('  levelPortalLocked = false;');
      evs.forEach((_, i) => w.line(`  on_${k}_${i}();`));
      if (k === 'start') {
        const startMap = this.project.tilemaps.find((map) => map.id === this.project.startLevelId);
        if (startMap) w.line(`  ab::setMap(${this.names.tilemap(startMap.id)}, tileImages, TILE_SOLID);`);
      }
      every.forEach((e, i) => w.line(`  if (ab::every(every_${i}, ${Math.max(1, Math.round(e.ms))})) on_every_${i}();`));
      if (k === 'update' && portals) w.line('  updateLevelPortals();');
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
      w.line(`  if (pressed == ${e.pressed ? 1 : 0} && ${buttonMatch(e.button, this.names, 'ab::isPressed')}) on_button_${i}();`);
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
        w.line(`${this.varName(s.name)} = ${typeOf(s.value, this.info, this.locals) === 'str' ? this.text(s.value) : this.expr(s.value)};`);
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
      case 'drawMode':
        w.line('{');
        w.indent();
        w.line(`ab::DrawModeScope drawMode${this.tmp++}(${this.expr(s.mode)});`);
        this.stmts(s.body);
        w.dedent();
        w.line('}');
        break;
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
    const prep: string[] = [];
    const add = (x: Expr) => {
      if (x.k === 'join') x.parts.forEach(add);
      else if (x.k === 'str') {
        if (x.v) parts.push(`ab::tbStr(PSTR(${stringLiteral(x.v)}))`);
      } else if (typeOf(x, this.info, this.locals) === 'str') {
        if (x.k === 'var') parts.push(`ab::tbRam(${this.expr(x)})`);
        else {
          const name = `textPart${this.tmp++}`;
          prep.push(`ab::Text ${name} = ${this.expr(x)};`);
          parts.push(`ab::tbRam(${name})`);
        }
      } else if (typeOf(x, this.info, this.locals) === 'bool') parts.push(`ab::tbStr(${this.expr(x)} ? PSTR("true") : PSTR("false"))`);
      else parts.push(`ab::tbNum(${this.expr(x)})`);
    };
    add(e);
    const result = `(ab::tbClear(), ${parts.length ? parts.join(', ') + ', ' : ''}ab::tb())`;
    return prep.length ? `([&]() -> const char * { ${prep.join(' ')} return ${result}; }())` : result;
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
          case '%': {
            // A constant divisor needs no check for 0, and lets the compiler use shifts.
            const d = e.b.k === 'num' ? wrap16(e.b.v) : 0;
            if (d !== 0 && d !== -1) return `(int16_t)(${a} ${e.op} ${b})`;
            return `ab::${e.op === '/' ? 'div' : 'mod'}(${a}, ${b})`;
          }
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
        const first = e.args[0];
        const tempo = first?.k === 'enum' ? this.project.melodies?.find(m => m.id === first.v)?.tempo ?? 120 : 120;
        const args = fn.args.map((t, i) => {
          const a = e.args[i];
          if (!a) return '0';
          if (t === 'str') return this.text(a);
          return this.expr(a);
        });
        return fn.cpp.replace('$tempo', String(tempo)).replace(/\$(\d)/g, (_, n) => args[Number(n)] ?? '0');
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
      case 'polyEffect': return this.songs.get(`effect:${e.v}`)?.name ?? 'nullptr';
      case 'songAsset': {
        const song = this.songs.get(`asset:${e.v}`);
        if (!song) this.diagnostics.push({ level: 'error', key: 'diag.noSong', id: e.id });
        const asset = this.project.songs?.find(s => s.id === e.v);
        const bad = asset?.voices.flatMap(v => parseMelody(v).bad) ?? [];
        if (bad.length) this.diagnostics.push({ level: 'error', key: 'diag.badNote', params: { notes: bad.join(' ') }, id: e.id });
        return song?.name ?? 'nullptr';
      }
      case 'song':
        return this.songs.get(e.v)?.name ?? '0';
      case 'sfx':
        return this.sfx.get(e.v)?.name ?? '0';
      case 'melodyAsset': {
        const m = this.melodies.get(`asset:${e.v}`);
        if (!m) { this.diagnostics.push({ level: 'error', key: 'diag.noMelody', id: e.id }); return 'nullptr'; }
        if (m.bad.length) this.diagnostics.push({ level: 'warning', key: 'diag.badNote', params: { notes: m.bad.join(' ') }, id: e.id });
        return m.name;
      }
      case 'melody': {
        const m = this.melodies.get(`text:${e.v}`)!;
        if (m.bad.length) this.diagnostics.push({ level: 'warning', key: 'diag.badNote', params: { notes: m.bad.join(' ') }, id: e.id });
        return m.name;
      }
      case 'effect': {
        const fx = this.effects.get(e.v);
        if (!fx) {
          this.diagnostics.push({ level: 'error', key: 'diag.noEffect', params: { name: e.v }, id: e.id });
          return '0';
        }
        return `&${fx.id}`;
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
