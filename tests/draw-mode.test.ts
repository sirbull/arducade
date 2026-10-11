import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { generateJs, type GameHooks } from '../src/gen/js';
import { generateCpp } from '../src/gen/cpp';
import { emptyProgram, type Expr, type Program, type Stmt } from '../src/ir/ir';
import { encodeImage, newProject } from '../src/project/model';
import { compileProject } from './helpers';
import { generateSource, parseSource } from '../src/text/languages';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { BUILTIN_PROFILES, SECRET_PROFILES, profileToConfigH } from '../src/hw/profile';

const num = (v: number): Expr => ({ k: 'num', v });
const call = (fn: string, ...args: Expr[]): Stmt => ({ k: 'expr', e: { k: 'api', fn, args } });
const scope = (mode: number, ...body: Stmt[]): Stmt => ({ k: 'drawMode', mode: num(mode), body });
const pixel = (x: number, y: number) => call('draw.pixel', num(x), num(y), num(1));
const project = newProject('Drawing modes');

async function engine(tiny = false) {
  const e = new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: tiny ? 4 : 12, hiscoreMagic: 1, seed: 1, tiny });
  const noop = async () => {};
  const hooks: GameHooks = { init() {}, start: noop, update: noop, draw: noop, button: noop, overlap: noop, tile: noop, lifeZero: async () => false, hasOverlap: false, hasTile: false };
  await e.begin(hooks);
  return { e, hooks };
}
const dot = [1, 1, 1, 0, 1];
const image = (e: Engine, rows: string[]) => e.image(encodeImage(rows[0].length, rows.length, [rows]));
const factory = (p: Program, e: Engine) => new Function('E', '$w', '$div', '$mod', '$lg', generateJs(p, project).code)(e, (v: number) => (v << 16) >> 16, (a: number, b: number) => b ? Math.trunc(a / b) : 0, (a: number, b: number) => b ? a % b : 0, () => {} ) as GameHooks;

it('keeps inverted 1px sprites and particles visible as they move over white and black', async () => {
  const { e } = await engine();
  e.setBackground(image(e, ['1100']));
  e.drawingMode = 1;
  const s = e.create(e.image(dot), 0);
  e.setPosition(s, 1, 10);
  e.emitParticle(null, 1, 12, 0, 0, 1000);
  e.drawingMode = 0;
  await e.frame(true);
  expect(e.getPixel(1, 10)).toBe(0);
  expect(e.getPixel(1, 12)).toBe(0);
  e.setPosition(s, 2, 10);
  e.particles[0].x = 2 * 256;
  await e.frame(true);
  expect(e.getPixel(2, 10)).toBe(1);
  expect(e.getPixel(2, 12)).toBe(1);
  expect(e.drawingMode).toBe(0);
});

it('inverts every opaque image pixel including black, leaves transparency and clips across pages', async () => {
  const { e } = await engine();
  e.fillRect(0, 0, 128, 64, 1);
  e.drawingMode = 1;
  e.drawImage(-1, 7, image(e, ['10.', '010']), 0);
  expect(e.getPixel(0, 7)).toBe(0); // Opaque black.
  expect(e.getPixel(1, 7)).toBe(1); // Transparent.
  expect(e.getPixel(0, 8)).toBe(0);
  expect(e.getPixel(1, 8)).toBe(0);
  expect(e.getPixel(0, 9)).toBe(1); // Padding is not drawn.
});

it('background reference ignores foreground sprites and other particles', async () => {
  const { e } = await engine();
  e.setBackground(image(e, ['1100']));
  const foreground = e.create(image(e, ['00']), 0);
  e.setPosition(foreground, 1, 10);
  e.drawingMode = 2;
  const s = e.create(e.image(dot), 1);
  e.setPosition(s, 1, 10);
  e.emitParticle(null, 1, 10, 0, 0, 1000);
  e.emitParticle(null, 1, 10, 0, 0, 1000);
  e.drawingMode = 0;
  await e.frame(true);
  expect(e.getPixel(1, 10)).toBe(0);
  e.setDrawMode(s, 1);
  e.clearParticles();
  await e.frame(true);
  expect(e.getPixel(1, 10)).toBe(1);
});

it('samples background layers, map tiles, offsets, camera and shake without copying the screen', async () => {
  const { e, hooks } = await engine();
  e.setBackground(image(e, ['1010', '0101']));
  e.setBackgroundPosition(-3, 1);
  e.setBackgroundLayer(1, image(e, ['.1.0', '0.1.']), 25);
  e.setBackgroundLayerPosition(1, 2, -1);
  e.setBackgroundLayer(2, image(e, ['0..1']), 100);
  e.setBackgroundLayerPosition(2, -4, 3);
  e.setMap([2, 1, 1, 0]);
  e.tileImages[1] = image(e, ['1.0.....', '.01.....', '........', '........', '........', '........', '........', '........']);
  e.camX = 3; e.camY = -2;
  e.shake(3, 100);
  for (let i = 0; i < 2; i++) {
    hooks.draw = async () => {
      const before = e.buffer.slice();
      e.drawingMode = 2;
      e.fillRect(0, 0, 128, 64, 1);
      e.drawingMode = 0;
      expect(e.buffer).toEqual(Uint8Array.from(before, b => b ^ 255));
    };
    await e.frame(true);
  }
});

it('uses only the selected layer and keeps the normal color where it is transparent or missing', async () => {
  const { e } = await engine();
  e.setBackgroundLayer(1, image(e, ['1.0']), 0);
  e.setBackgroundLayer(2, image(e, ['010']), 0);
  e.drawingMode = 3;
  for (let x = 0; x < 3; x++) e.drawPixel(x, 0, 0);
  expect([0, 1, 2].map(x => e.getPixel(x, 0))).toEqual([0, 0, 1]);
  e.drawingMode = 4;
  for (let x = 0; x < 3; x++) e.drawPixel(x, 0, 0);
  expect([0, 1, 2].map(x => e.getPixel(x, 0))).toEqual([1, 0, 1]);
  e.setBackgroundLayer(2, null, 0);
  e.drawPixel(0, 0, 0);
  expect(e.getPixel(0, 0)).toBe(0);
});

it('follows a specific animated sprite regardless of z, with normal color outside its mask', async () => {
  const { e } = await engine();
  e.camX = 5; e.camY = 2;
  const target = e.create(e.image(encodeImage(3, 1, [['10.'], ['01.']])), 0);
  e.setPosition(target, 15, 12);
  e.setZ(target, 10);
  e.drawingMode = e.spriteReference(target);
  e.drawImage(9, 10, image(e, ['0000']), 0);
  expect([9, 10, 11, 12].map(x => e.getPixel(x, 10))).toEqual([0, 1, 0, 0]);
  e.sprites[target].frame = 1;
  e.drawImage(9, 10, image(e, ['0000']), 0);
  expect([9, 10, 11, 12].map(x => e.getPixel(x, 10))).toEqual([1, 0, 0, 0]);
  e.setFlag(target, 16, true);
  e.drawPixel(9, 10, 0);
  expect(e.getPixel(9, 10)).toBe(0);
});

it('forgets destroyed references before sprite slots are reused and clears modes on restart', async () => {
  const { e, hooks } = await engine();
  const target = e.create(e.image(dot), 0);
  e.drawingMode = e.spriteReference(target);
  const s = e.create(e.image(dot), 1);
  e.emitParticle(null, 10, 10, 0, 0, 1000);
  e.destroy(target);
  expect(e.sprites[s].drawMode).toBe(0);
  expect(e.particles[0].drawMode).toBe(0);
  expect(e.drawingMode).toBe(0);
  expect(e.create(e.image(dot), 0)).toBe(target);
  e.drawingMode = 2;
  await e.begin(hooks);
  expect(e.drawingMode).toBe(0);
});

it('captures the mode for effect bursts and image particles on the tiny target too', async () => {
  const { e } = await engine(true);
  e.drawingMode = 2;
  e.burst(e.effect(e.image(dot), [0, 0, 1000, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 2, 10, 10, 0);
  e.emitParticle(e.image(dot), 10, 10, 0, 0, 1000, 0, 0, 0);
  e.drawingMode = 0;
  await e.frame(true);
  expect(e.particles.map(p => p.drawMode)).toEqual([2, 2, 2]);
  expect(e.getPixel(10, 10)).toBe(1);
});

it('restores nested scopes across return, break, continue and exceptions in generated simulator code', async () => {
  const { e } = await engine();
  const p: Program = { ...emptyProgram(), funcs: [{ name: 'early', params: [], ret: 'void', body: [scope(2, { k: 'return' })] }], events: [{ k: 'draw', body: [
    scope(1, { k: 'expr', e: { k: 'call', name: 'early', args: [] } }, pixel(1, 1), scope(0, pixel(2, 1)), pixel(2, 1)),
    { k: 'repeat', count: num(2), body: [scope(1, pixel(3, 1), { k: 'continue' })] },
    { k: 'repeat', count: num(2), body: [scope(1, pixel(4, 1), { k: 'break' })] },
    pixel(5, 1),
  ] }] };
  await factory(p, e).draw();
  expect([1, 2, 3, 4, 5].map(x => e.getPixel(x, 1))).toEqual([1, 0, 0, 1, 1]);
  expect(e.drawingMode).toBe(0);
  const fail = { ...emptyProgram(), events: [{ k: 'draw' as const, body: [scope(2, { k: 'cpp', code: '' })] }] };
  e.skippedCpp = () => { throw new Error('test failure'); };
  await expect(factory(fail, e).draw()).rejects.toThrow('test failure');
  expect(e.drawingMode).toBe(0);
});

it('draws circles and thin rectangles once per pixel so inversion cannot cancel their edges', async () => {
  for (const fill of [false, true]) for (let r = 0; r < 10; r++) {
    const { e } = await engine();
    e.drawCircle(20, 20, r, 1, fill);
    const expected = e.buffer.slice();
    e.clear(); e.drawingMode = 1;
    e.drawCircle(20, 20, r, 1, fill);
    expect(e.buffer).toEqual(expected);
  }
  for (const [w, h] of [[1, 1], [1, 6], [6, 1], [6, 6]]) {
    const { e } = await engine();
    e.drawRect(10, 10, w, h, 1);
    const expected = e.buffer.slice();
    e.clear(); e.drawingMode = 1;
    e.drawRect(10, 10, w, h, 1);
    expect(e.buffer).toEqual(expected);
  }
});

function blockProject() {
  const p = newProject('Inverted rain');
  p.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
  const v = (name: string) => ({ block: { type: 'variables_get', fields: { VAR: { name } } } });
  const n = (value: number) => ({ shadow: { type: 'math_number', fields: { NUM: value } } });
  p.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'variables_set', fields: { VAR: { name: 'target' } }, inputs: { VALUE: { block: { type: 'ab_sprite_create', fields: { IMAGE: 'dot' } } } }, next: { block: {
      type: 'ab_with_draw_mode', fields: { MODE: '1' }, inputs: { DO: { block: {
        type: 'ab_with_sprite_reference', inputs: { REFERENCE: v('target'), DO: { block: {
          type: 'ab_particle_pixel', inputs: { X: n(10), Y: n(10), MS: n(1000) }, next: { block: {
            type: 'ab_sprite_set_draw_reference', inputs: { SPRITE: v('target'), REFERENCE: v('target') }, next: { block: {
              type: 'ab_sprite_set_draw_mode', fields: { MODE: '0' }, inputs: { SPRITE: v('target') },
            } },
          } },
        } } },
      } } },
    } },
  } } } }] } };
  return p;
}

it('compiles all four blocks and round trips their scopes in JavaScript and Python', () => {
  const p = blockProject();
  const { ir, cpp, js } = compileProject(p);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.diagnostics).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_DRAW_MODE 1');
  expect(cpp.code).toContain('ab::DrawModeScope');
  expect(js.code).toContain('finally');
  for (const language of ['javascript', 'python'] as const) {
    const text = generateSource(ir.program, p, language);
    const parsed = parseSource(text, language, p);
    expect(generateCpp(parsed, p).diagnostics).toEqual([]);
    expect(generateSource(parsed, p, language)).toBe(text);
    expect(generateCpp(parsed, p).code).toContain('ab::spriteReference(');
  }
  expect(compileProject(newProject('Empty')).cpp.code).not.toContain('AB_HAS_DRAW_MODE');
});

const base = join(__dirname, '../public/compiler');
const src: FileSource = {
  bytes: async p => new Uint8Array(readFileSync(join(base, p))),
  text: async p => readFileSync(join(base, p), 'utf8'),
  tool: async name => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async name => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};
const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h', 'ab_tiny.h'].map(f => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));
it.skipIf(!existsSync(join(base, 'tools/cc1plus.wasm')))('compiles full reference drawing for Nano and small reference/XOR scenes for ATtiny85', async () => {
  const p = blockProject();
  const program = compileProject(p).ir.program;
  program.events.push({ k: 'draw', body: [scope(2, pixel(1, 1)), scope(3, call('draw.rect', ...[1, 1, 3, 4, 1].map(num))), scope(4, call('draw.circle', ...[20, 20, 4, 1].map(num)))] });
  const nano = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
  const full = await compileGame(src, { mcu: nano.chip, game: generateCpp(program, p).code, config: profileToConfigH(nano), headers });
  expect(full.hex.startsWith(':')).toBe(true);
  expect(full.ram).toBeLessThanOrEqual(1792);
  const tiny = SECRET_PROFILES[0];
  for (const mode of [1, 5]) {
    const small: Program = { ...emptyProgram(), vars: [{ name: 'target', ty: 'sprite' }], events: [{ k: 'start', body: [
      { k: 'set', name: 'target', value: { k: 'api', fn: 'sprites.create', args: [{ k: 'enum', type: 'image', v: 'dot' }, { k: 'enum', type: 'kind', v: 'Player' }] } },
      { k: 'drawMode', mode: mode === 1 ? num(1) : { k: 'api', fn: 'draw.spriteReference', args: [{ k: 'var', name: 'target' }] }, body: [
        mode === 1 ? call('particles.pixel', ...[10, 10, 0, 10, 1000].map(num)) : call('sprites.setDrawMode', { k: 'var', name: 'target' }, num(2)),
      ] },
    ] }, { k: 'draw', body: [scope(mode, pixel(1, 1))] }] };
    const game = generateCpp(small, p).code;
    if (mode === 1) expect(game).not.toContain('AB_HAS_DRAW_REFERENCE');
    const out = await compileGame(src, { mcu: tiny.chip, game, config: profileToConfigH(tiny), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    expect(out.ram).toBeLessThan(512);
  }
}, 120000);
