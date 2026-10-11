// Compiles the templates with the WebAssembly compiler in Node.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { generateCpp } from '../src/gen/cpp';
import { defaultEffect, emptyProgram } from '../src/ir/ir';
import { newProject } from '../src/project/model';
import { BUILTIN_PROFILES, withBoardDefaults, withMicrocontrollerMode, cloneProfile, profileToConfigH, SECRET_PROFILES } from '../src/hw/profile';

const base = join(__dirname, '../public/compiler');
const haveTools = existsSync(join(base, 'tools/cc1plus.wasm'));

const src: FileSource = {
  bytes: async (p) => new Uint8Array(readFileSync(join(base, p))),
  text: async (p) => readFileSync(join(base, p), 'utf8'),
  tool: async (name) => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async (name) => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};

const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h', 'ab_tiny.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));

describe.skipIf(!haveTools)('WebAssembly compiler', () => {
  it('compiles timer displays and counting for a 2 KB RAM device', async () => {
    const project = newProject('Timers');
    const num = (v: number) => ({ k: 'num' as const, v });
    const program = { ...emptyProgram(), events: [{ k: 'start' as const, body: [
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerSet', args: [0, 94].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerRun', args: [0, -1].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerChange', args: [1, 120].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerSetMillis', args: [0, 125].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerChangeMillis', args: [1, -100].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerSetMillis', args: [num(1), { k: 'api' as const, fn: 'info.timerMillis', args: [num(0)] }] } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerFormat', args: [1, 7].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.timerPosition', args: [1, 10, 30].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.setLife', args: [3].map(num) } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'info.setLifePosition', args: [20, 40].map(num) } },
    ] }] };
    const profile = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(program, project).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    expect(out.ram).toBeLessThanOrEqual(1792);
  }, 120000);

  it('compiles adjustable sprite outlines for a 2 KB RAM device', async () => {
    const project = newProject('Outline');
    project.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
    const program = { ...emptyProgram(), events: [{ k: 'start' as const, body: [
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'sprites.setOutlineWidth', args: [
        { k: 'api' as const, fn: 'sprites.create', args: [{ k: 'enum' as const, type: 'image' as const, v: 'dot' }, { k: 'enum' as const, type: 'kind' as const, v: 'Player' }] },
        { k: 'num' as const, v: 3 },
      ] } },
    ] }] };
    const profile = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(program, project).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    expect(out.ram).toBeLessThanOrEqual(1792); // Leave at least 256 bytes for the stack.
  }, 120000);
  it('compiles pixel and image particles for a 2 KB RAM device', async () => {
    const project = newProject('Particles');
    project.images = [{ id: 'spark', name: 'spark', width: 2, height: 2, frames: [['11', '11']] }];
    const args = [64, 32, 30, -30, 500].map(v => ({ k: 'num' as const, v }));
    const program = { ...emptyProgram(), events: [{ k: 'start' as const, body: [
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.pixel', args } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.pixelColor', args: [...args, { k: 'num' as const, v: 0 }, { k: 'num' as const, v: 30 }, { k: 'num' as const, v: 2 }] } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.imageColor', args: [{ k: 'enum' as const, type: 'image' as const, v: 'spark' }, ...args, { k: 'num' as const, v: 0 }, { k: 'num' as const, v: 30 }, { k: 'num' as const, v: 0 }] } },
    ] }] };
    const profile = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(program, project).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    expect(out.ram).toBeLessThan(2048);
  }, 120000);
  it('compiles particle effects for a 2 KB RAM device', async () => {
    const project = newProject('Effects');
    project.images = [{ id: 'puff', name: 'puff', width: 2, height: 2, frames: [['11', '11'], ['10', '01']] }];
    const fx = { k: 'enum' as const, type: 'effect' as const, v: 'smoke' };
    const num = (v: number) => ({ k: 'num' as const, v });
    const sprite = { k: 'api' as const, fn: 'sprites.create', args: [{ k: 'enum' as const, type: 'image' as const, v: 'puff' }, { k: 'enum' as const, type: 'kind' as const, v: 'Player' }] };
    const program = { ...emptyProgram(), effects: [{ ...defaultEffect('smoke'), image: 'puff', accel: [0, -20] as [number, number], drag: 30, wobble: 3, blink: 30 }, defaultEffect('spray')], events: [{ k: 'start' as const, body: [
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.burst', args: [fx, num(5), num(64), num(32), num(-90)] } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.burstFrom', args: [{ ...fx, v: 'spray' }, num(3), sprite, num(0)] } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.clearEffect', args: [fx] } },
      { k: 'expr' as const, e: { k: 'api' as const, fn: 'particles.pixel', args: [64, 32, 30, -30, 500].map(num) } },
    ] }] };
    const profile = BUILTIN_PROFILES.find(p => p.id === 'nano-sh1106-i2c')!;
    const gen = generateCpp(program, project);
    expect(gen.diagnostics.filter(d => d.level === 'error')).toEqual([]);
    const out = await compileGame(src, { mcu: profile.chip, game: gen.code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    expect(out.ram).toBeLessThan(2048);
  }, 120000);
  it('compiles connected levels for the device', async () => {
    const project = newProject('Levels');
    project.tilemaps = [
      { id: 'a', name: 'a', width: 16, height: 8, cells: Array(128).fill(0), links: [{ id: 'exit', col: 2, row: 2, target: 'b', spawnCol: 1, spawnRow: 1 }] },
      { id: 'b', name: 'b', width: 16, height: 8, cells: Array(128).fill(0) },
    ];
    project.startLevelId = 'a';
    const profile = BUILTIN_PROFILES[0];
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(emptyProgram(), project).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }, 120000);
  it('compiles background music for the device', async () => {
    const melody = { k: 'enum', type: 'melody', v: 'C D E C R:2' } as const;
    const program = { ...emptyProgram(), events: [{ k: 'start' as const, body: [{ k: 'expr' as const, e: { k: 'api' as const, fn: 'music.melody', args: [melody, { k: 'num' as const, v: 120 }, { k: 'bool' as const, v: true }] } }] }] };
    const profile = BUILTIN_PROFILES[0];
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(program, newProject('Song')).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }, 120000);
  it('compiles a drawn splash screen for the device', async () => {
    const call = (fn: string, ...args: object[]) => ({ k: 'expr' as const, e: { k: 'api' as const, fn, args } as never });
    const body = [call('game.clear'), call('draw.text', { k: 'num', v: 10 }, { k: 'num', v: 20 }, { k: 'str', v: 'Hi' }, { k: 'enum', type: 'color', v: 'white' }), call('game.showAndWait')];
    const program = { ...emptyProgram(), events: [{ k: 'start' as const, body }] };
    const profile = BUILTIN_PROFILES[0];
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(program, newProject('Splash')).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }, 120000);
  for (const [profileId, mcu, template] of [
    ['nano-sh1106-i2c', 'atmega328p', 'platformer'],
    ['nano-sh1106-i2c', 'atmega328pb', 'platformer'],
    ['nano-sh1106-i2c', 'atmega644p', 'platformer'],
    ['arduboy', 'atmega32u4', 'platformer'],
    ['nano-sh1106-i2c', 'atmega328p', 'maze3d'],
    ['arduboy', 'atmega32u4', 'maze3d'],
    ['nano-sh1106-i2c', 'atmega328p', 'match3'],
    ['arduboy', 'atmega32u4', 'match3'],
  ] as const) {
    it(`compiles the ${template} for ${mcu}`, async () => {
      const game = readFileSync(join(__dirname, `../.cache/gen/${template}.ino`), 'utf8');
      const profile = BUILTIN_PROFILES.find((p) => p.id === profileId)!;
      const out = await compileGame(src, { mcu, game, config: profileToConfigH(profile), headers });
      expect(out.hex.startsWith(':')).toBe(true);
      expect(out.flash).toBeGreaterThan(8000);
      expect(out.flash).toBeLessThan(28000);
      expect(out.ram).toBeLessThan(2048);
      console.log(template, mcu, 'flash', out.flash, 'ram', out.ram);
    }, 120000);
  }
  for (const template of ['empty', 'shooter']) {
    it(`compiles the ${template} for the ATtiny85 Pico`, async () => {
      const game = readFileSync(join(__dirname, `../.cache/gen/${template}.ino`), 'utf8');
      const out = await compileGame(src, { mcu: 'attiny85', game, config: profileToConfigH(SECRET_PROFILES[0]), headers });
      expect(out.hex.startsWith(':')).toBe(true);
      expect(out.flash).toBeLessThanOrEqual(8192);
      expect(out.ram).toBeLessThanOrEqual(400); // Leave at least 112 bytes for the stack.
      console.log(template, 'attiny85', 'flash', out.flash, 'ram', out.ram);
    }, 120000);
  }
  for (const bus of ['i2c', 'spi'] as const) {
    for (const driver of ['ssd1306', 'sh1106', 'ssd1309'] as const) {
      it(`compiles custom ${driver} ${bus} wiring`, async () => {
        const profile = cloneProfile(BUILTIN_PROFILES[1], 'Custom device');
        profile.display = { ...profile.display, bus, driver, cs: 'D10', dc: 'D9', rst: 'D8', rotate180: true, mirror: true };
        profile.sound = { pin1: 'A0', pin2: 'A1' };
        const game = readFileSync(join(__dirname, '../.cache/gen/platformer.ino'), 'utf8');
        const out = await compileGame(src, { mcu: profile.chip, game, config: profileToConfigH(profile), headers });
        expect(out.hex.startsWith(':')).toBe(true);
      }, 120000);
    }
  }

});

describe.skipIf(!haveTools)('profile configuration modes and firmware', () => {
  it('compiles board and manual wiring identically with audio disabled', async () => {
    const project = newProject('Profile modes');
    const board = withBoardDefaults(cloneProfile(BUILTIN_PROFILES[0], 'Custom board'), 'promicro-16');
    board.sound.enabled = false;
    const manual = withMicrocontrollerMode(board);
    const game = generateCpp(emptyProgram(), project).code;
    const input = (profile: typeof board) => ({ mcu: profile.chip, game, config: profileToConfigH(profile), headers });
    const first = await compileGame(src, input(board));
    const second = await compileGame(src, input(manual));
    expect(first.hex).toBe(second.hex);
    expect(first.ram).toBe(second.ram);
    expect(first.hex.startsWith(':')).toBe(true);
  }, 120000);
  it('rejects 8 MHz profiles against the prebuilt 16 MHz core', async () => {
    const p = withBoardDefaults(cloneProfile(BUILTIN_PROFILES[0], '8 MHz'), 'promicro-8');
    await expect(compileGame(src, { mcu: p.chip, game: generateCpp(emptyProgram(), newProject('Clock')).code, config: profileToConfigH(p), headers })).rejects.toThrow();
  }, 120000);
});
