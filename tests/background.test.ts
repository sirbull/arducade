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
