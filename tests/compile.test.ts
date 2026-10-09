// Compiles the templates with the WebAssembly compiler in Node.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { BUILTIN_PROFILES, profileToConfigH } from '../src/hw/profile';

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
  for (const [profileId, mcu] of [
    ['nano-sh1106-i2c', 'atmega328p'],
    ['arduboy', 'atmega32u4'],
  ] as const) {
    it(`compiles the platformer for ${mcu}`, async () => {
      const game = readFileSync(join(__dirname, '../.cache/gen/platformer.ino'), 'utf8');
      const profile = BUILTIN_PROFILES.find((p) => p.id === profileId)!;
      const out = await compileGame(src, { mcu, game, config: profileToConfigH(profile), headers });
      expect(out.hex.startsWith(':')).toBe(true);
      expect(out.flash).toBeGreaterThan(8000);
      expect(out.flash).toBeLessThan(28000);
      expect(out.ram).toBeLessThan(2048);
      console.log(mcu, 'flash', out.flash, 'ram', out.ram);
    }, 120000);
  }
});
