import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { BUILTIN_PROFILES, profileToConfigH, SECRET_PROFILES } from '../src/hw/profile';
import { Engine } from '../src/sim/engine';
import type { GameHooks } from '../src/gen/js';
import { encodeBackground, newProject } from '../src/project/model';
import { compileProject } from './helpers';
import { generateSource, parseSource } from '../src/text/languages';
import { generateCpp } from '../src/gen/cpp';

async function engine() {
  const e = new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 12, hiscoreMagic: 1, seed: 1 });
  const noop = async () => {};
  const hooks: GameHooks = { init() {}, start: noop, update: noop, draw: noop, button: noop, overlap: noop, tile: noop, lifeZero: async () => false, hasOverlap: false, hasTile: false };
  await e.begin(hooks);
  return e;
}

// 8x8 with only the top left pixel white; black pixels count as background, not a mask.
const DOT = { id: 'b1', name: 'dot', width: 8, height: 8, frames: [['10000000', ...Array(7).fill('00000000')]] };

it('repeats the background over the screen and follows its position', async () => {
  const e = await engine();
  e.setBackground(e.image(encodeBackground(DOT)));
  await e.frame(true);
  expect(e.getPixel(0, 0)).toBe(1);
  expect(e.getPixel(120, 56)).toBe(1);
  expect(e.getPixel(1, 0)).toBe(0);
  e.setBackgroundPosition(-3, 2);
  await e.frame(true);
  expect(e.getPixel(5, 2)).toBe(1);
  expect(e.getPixel(0, 0)).toBe(0);
  e.setBackground(null);
  await e.frame(true);
  expect(e.getPixel(5, 2)).toBe(0);
});

it('shakes the camera for the given time and puts it back', async () => {
  const e = await engine();
  e.setBackground(e.image(encodeBackground(DOT)));
  e.shake(4, 100); // 4 frames of 33 ms
  let moved = false;
  for (let i = 0; i < 4; i++) {
    await e.frame(true);
    if (!e.getPixel(0, 0)) moved = true;
    expect(e.camX).toBe(0);
  }
  expect(moved).toBe(true);
  await e.frame(true);
  expect(e.getPixel(0, 0)).toBe(1);
});

it('generates background and shake blocks for both targets', () => {
  const project = newProject('Background');
  project.backgrounds = [DOT];
  const value = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const chain = (...blocks: object[]): object => blocks.reduceRight<object | undefined>((next, b) => ({ ...b, ...(next && { next: { block: next } }) }), undefined)!;
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: chain(
    { type: 'ab_bg_set', fields: { BG: 'b1' } },
    { type: 'ab_bg_set_position', inputs: { X: value(1), Y: value(2) } },
    { type: 'ab_bg_change_position', inputs: { X: value(-1), Y: value(0) } },
    { type: 'ab_shake', inputs: { STRENGTH: value(3), MS: value(300) } },
    { type: 'ab_bg_clear' },
  ) } } }] } };
  const { cpp, js, ir } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_BACKGROUND 1');
  expect(cpp.code).toContain('#define AB_HAS_SHAKE 1');
  expect(cpp.code).toContain('ab::setBackground(bg_dot)');
  expect(js.code).toContain('E.setBackground(bg_dot)');
  expect(js.code).toContain('E.shake(3, 300)');
  expect(compileProject(newProject('Empty')).cpp.code).not.toContain('AB_HAS_BACKGROUND');
});

const base = join(__dirname, '../public/compiler');
const src: FileSource = {
  bytes: async (p) => new Uint8Array(readFileSync(join(base, p))),
  text: async (p) => readFileSync(join(base, p), 'utf8'),
  tool: async (name) => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async (name) => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};
const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h', 'ab_tiny.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));

it.skipIf(!existsSync(join(base, 'tools/cc1plus.wasm')))('compiles backgrounds and shaking for the Nano and the ATtiny85', async () => {
  const project = newProject('Background');
  project.backgrounds = [{ ...DOT, width: 128, height: 64, frames: [Array(64).fill('10'.repeat(64))] }];
  const num = (v: number) => ({ k: 'num' as const, v });
  const call = (fn: string, ...args: object[]) => ({ k: 'expr' as const, e: { k: 'api' as const, fn, args } });
  const program = { vars: [], funcs: [], events: [
    { k: 'start' as const, body: [call('background.set', { k: 'enum', type: 'image', v: 'b1' }), call('scene.shake', num(3), num(300))] },
    { k: 'update' as const, body: [call('background.changePosition', num(-1), num(0))] },
  ] } as Parameters<typeof import('../src/gen/cpp').generateCpp>[0];
  const { generateCpp } = await import('../src/gen/cpp');
  const game = generateCpp(program, project).code;
  const nano = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
  for (const [mcu, profile] of [[nano.chip, nano], ['attiny85', SECRET_PROFILES[0]]] as const) {
    const out = await compileGame(src, { mcu, game, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }
}, 240000);

it('composes a static background and two transparent layers in order', async () => {
  const e = await engine();
  const image = (row: string) => e.image(encodeBackground({ ...DOT, frames: [[row, ...Array(7).fill('........')]] }, true));
  e.setBackground(image('111.....'));
  e.setBackgroundLayer(1, image('0.1.....'), 0);
  e.setBackgroundLayer(2, image('..0.....'), 0);
  await e.frame(true);
  expect([e.getPixel(0, 0), e.getPixel(1, 0), e.getPixel(2, 0)]).toEqual([0, 1, 0]);
  e.setBackground(null); // Removing the static image leaves both layers intact.
  await e.frame(true);
  expect(e.getPixel(1, 0)).toBe(0);
  e.setBackgroundLayer(2, null, 0);
  await e.frame(true);
  expect(e.getPixel(2, 0)).toBe(1);
});

it('uses the current camera on both axes, repeats for negative positions, and keeps offsets', async () => {
  const e = await engine();
  const img = e.image(encodeBackground(DOT, true));
  e.setBackgroundLayer(1, img, 25);
  e.camX = 12; e.camY = 8;
  await e.frame(true);
  expect(e.getPixel(5, 6)).toBe(1);
  e.camX = -12; e.camY = -8;
  e.setBackgroundLayerPosition(1, 1, 2);
  e.changeBackgroundLayerPosition(1, -2, -1);
  await e.frame(true);
  expect(e.getPixel(2, 3)).toBe(1);
  e.setBackgroundLayer(1, img, 0);
  await e.frame(true);
  expect(e.getPixel(7, 1)).toBe(1);
  e.setBackgroundLayer(1, img, 100);
  await e.frame(true);
  expect(e.getPixel(3, 1)).toBe(1);
  e.setBackgroundLayer(0, img, 50);
  e.setBackgroundLayerPosition(3, 10, 10);
  e.changeBackgroundLayerPosition(-1, 10, 10);
  await e.frame(true);
  expect(e.getPixel(3, 1)).toBe(1);
});

it('updates parallax after following a sprite and draws sprites in front', async () => {
  const e = await engine();
  const img = e.image(encodeBackground(DOT, true));
  e.setBackgroundLayer(1, img, 25);
  const sprite = e.create(img, 0);
  e.setProp(sprite, 0, 84);
  e.setProp(sprite, 1, 40);
  e.cameraFollow(sprite);
  await e.frame(true);
  expect(e.camX).toBe(20);
  expect(e.camY).toBe(8);
  expect(e.getPixel(3, 6)).toBe(1);
  expect(e.getPixel(60, 28)).toBe(1); // Sprite is drawn in front of the black layer.
});

it('generates all layer blocks for the simulator and hardware without enabling them for static games', () => {
  const project = newProject('Parallax');
  project.backgrounds = [DOT];
  const value = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const chain = (...blocks: object[]): object => blocks.reduceRight<object | undefined>((next, b) => ({ ...b, ...(next && { next: { block: next } }) }), undefined)!;
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: chain(
    { type: 'ab_bg_set', fields: { BG: 'b1' } },
    { type: 'ab_bg_layer_set', fields: { LAYER: '1', BG: 'b1' }, inputs: { PERCENT: value(15) } },
    { type: 'ab_bg_layer_set', fields: { LAYER: '2', BG: 'b1' }, inputs: { PERCENT: value(40) } },
    { type: 'ab_bg_layer_position', fields: { LAYER: '2' }, inputs: { X: value(3), Y: value(4) } },
    { type: 'ab_bg_layer_change_position', fields: { LAYER: '2' }, inputs: { X: value(-1), Y: value(0) } },
    { type: 'ab_bg_layer_clear', fields: { LAYER: '1' } },
  ) } } }] } };
  const { cpp, js, ir } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  expect(js.diagnostics.filter(d => d.level === 'error')).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_PARALLAX 1');
  expect(cpp.code).toContain('ab::setBackgroundLayer(1, bg_dot, 15)');
  expect(cpp.code).toContain('ab::setBackgroundLayerPosition(2, 3, 4)');
  expect(cpp.code).toContain('ab::changeBackgroundLayerPosition(2, -1, 0)');
  expect(cpp.code).toContain('ab::setBackgroundLayer(1, 0, 0)');
  expect(js.code).toContain('E.setBackgroundLayer(2, bg_dot, 40)');
  expect(js.code).toContain('E.setBackgroundLayer(1, null, 0)');
  expect(compileProject(newProject('Empty')).cpp.code).not.toContain('AB_HAS_PARALLAX');
  expect(encodeBackground(DOT)[3]).toBe(0);
  expect(encodeBackground(DOT, true)[3]).toBe(1);
  for (const language of ['javascript', 'python'] as const) {
    const source = generateSource(ir.program, project, language);
    expect(source).toContain(language === 'python' ? 'scene.set_background_layer' : 'scene.setBackgroundLayer');
    const parsed = parseSource(source, language, project);
    expect(generateCpp(parsed, project).diagnostics.filter(d => d.level === 'error')).toEqual([]);
    const again = generateSource(parsed, project, language);
    expect(generateSource(parseSource(again, language, project), project, language)).toBe(again);
    expect(generateCpp(parsed, project).code).toContain('ab::setBackgroundLayer(2, bg_dot, 40)');
  }
});

it.skipIf(!existsSync(join(base, 'tools/cc1plus.wasm')))('compiles two parallax layers with a static background for Nano and ATtiny85', async () => {
  const project = newProject('Parallax');
  project.backgrounds = [DOT];
  const num = (v: number) => ({ k: 'num' as const, v });
  const img = { k: 'enum' as const, type: 'image' as const, v: 'b1' };
  const call = (fn: string, ...args: object[]) => ({ k: 'expr' as const, e: { k: 'api' as const, fn, args } });
  const program = { vars: [], funcs: [], events: [
    { k: 'start' as const, body: [call('background.set', img), call('background.layerSet', num(1), img, num(15)), call('background.layerSet', num(2), img, num(40)), call('scene.shake', num(3), num(300))] },
    { k: 'update' as const, body: [call('background.layerPosition', num(1), num(2), num(3)), call('background.layerChangePosition', num(2), num(-1), num(0)), call('background.layerClear', num(1))] },
  ] } as Parameters<typeof import('../src/gen/cpp').generateCpp>[0];
  const { generateCpp } = await import('../src/gen/cpp');
  const game = generateCpp(program, project).code;
  const nano = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
  for (const [mcu, profile] of [[nano.chip, nano], ['attiny85', SECRET_PROFILES[0]]] as const) {
    const out = await compileGame(src, { mcu, game, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }
}, 240000);

it('shakes all background layers together regardless of parallax and resets layers on restart', async () => {
  const e = await engine();
  const dot = e.image(encodeBackground(DOT, true));
  const transparent = e.image(encodeBackground({ ...DOT, frames: [Array(8).fill('........')] }, true));
  e.setBackgroundLayer(1, dot, 25);
  e.setBackgroundLayer(2, transparent, 100);
  e.camX = 12; e.camY = 8;
  e.shake(4, 100);
  const reference = await engine();
  reference.setBackground(dot);
  reference.setBackgroundPosition(-3, -2); // 25% of the unshaken camera.
  reference.shake(4, 100);
  for (let i = 0; i < 4; i++) {
    await e.frame(true);
    await reference.frame(true);
    expect(e.buffer).toEqual(reference.buffer);
    expect([e.camX, e.camY]).toEqual([12, 8]);
  }
  const noop = async () => {};
  const hooks: GameHooks = { init() {}, start: noop, update: noop, draw: noop, button: noop, overlap: noop, tile: noop, lifeZero: async () => false, hasOverlap: false, hasTile: false };
  // Restart must remove both layers and their offsets.
  await e.begin(hooks);
  await e.frame(true);
  expect(Array.from(e.buffer).every(byte => byte === 0)).toBe(true);
});
