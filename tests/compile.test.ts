// Compiles the templates with the WebAssembly compiler in Node.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { generateCpp } from '../src/gen/cpp';
import { emptyProgram } from '../src/ir/ir';
import { newProject } from '../src/project/model';
import { BUILTIN_PROFILES, cloneProfile, profileToConfigH } from '../src/hw/profile';

const base = join(__dirname, '../public/compiler');
const haveTools = existsSync(join(base, 'tools/cc1plus.wasm'));

const src: FileSource = {
  bytes: async (p) => new Uint8Array(readFileSync(join(base, p))),
  text: async (p) => readFileSync(join(base, p), 'utf8'),
  tool: async (name) => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async (name) => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};

const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));

describe.skipIf(!haveTools)('WebAssembly compiler', () => {
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
    ['arduboy', 'atmega32u4', 'platformer'],
    ['nano-sh1106-i2c', 'atmega328p', 'maze3d'],
    ['arduboy', 'atmega32u4', 'maze3d'],
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
