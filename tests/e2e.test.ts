// End to end check: compile a template with the WebAssembly compiler, run
// the program in an AVR emulator (avr8js) with an emulated SSD1306 screen,
// and compare the screen with the simulator, frame by frame.
// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { BUILTIN_PROFILES, profileToConfigH } from '../src/hw/profile';
import { AvrBoard, CLOCK_HZ } from '../src/sim/avr-board';
import { Engine } from '../src/sim/engine';
import { loadGame } from '../src/sim/load';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';
import { blk, workspace } from '../src/templates/dsl';
import { newProject } from '../src/project/model';
import { EMULATOR_PROFILE } from '../src/hw/profile';
import { compileProject } from './helpers';

const base = join(__dirname, '../public/compiler');
const haveTools = existsSync(join(base, 'tools/cc1plus.wasm'));

const src: FileSource = {
  bytes: async (p) => new Uint8Array(readFileSync(join(base, p))),
  text: async (p) => readFileSync(join(base, p), 'utf8'),
  tool: async (name) => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async (name) => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};
const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));

/** Buttons held in frame k (1 based): bit 3 right, bit 4 A, as in BUTTON_IDS. */
function inputFor(k: number): number {
  let bits = 0;
  // Short enough that the game is not over: then both would wait for A.
  if (k >= 10 && k <= 40) bits |= 1 << 3;
  if (k >= 20 && k <= 24) bits |= 1 << 4;
  return bits;
}

function runOnAvr(hex: string, frames: number, input = inputFor): Uint8Array[] {
  const board = new AvrBoard(hex);
  const out: Uint8Array[] = [];
  board.screen.onFrame = (buf) => {
    out.push(buf.slice());
    // Change the buttons right after a frame is shown, before the next one.
    board.setButtons(input(out.length + 1));
  };
  board.setButtons(input(1));
  const limit = CLOCK_HZ * (frames * 0.05 + 2);
  while (out.length < frames && board.cpu.cycles < limit) board.run(16000);
  return out.slice(0, frames);
}

async function runInSimulator(js: { code: string; hiscoreKey: number }, frames: number): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  const engine = new Engine({
    show: (b) => out.push(b.slice()),
    tone: () => {},
    storage: { read: () => 0xff, write: () => {} },
    maxSprites: 12,
    hiscoreMagic: js.hiscoreKey,
  });
  await engine.begin(loadGame(js.code, engine));
  while (out.length < frames) {
    engine.input = inputFor(out.length + 1);
    await engine.frame(true);
  }
  return out;
}

function diff(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < 1024; i++) {
    let x = a[i] ^ b[i];
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}

describe.skipIf(!haveTools)('device code matches the simulator', () => {
  it('platformer on an ATmega328P with an SSD1306 over I2C', async () => {
    const project = templateToProject(TEMPLATE_SOURCES.find((t) => t.id === 'platformer')!);
    const { cpp, js } = compileProject(project);
    const profile = BUILTIN_PROFILES.find((p) => p.id === 'nano-ssd1306-i2c')!;
    const out = await compileGame(src, { mcu: 'atmega328p', game: cpp.code, config: profileToConfigH(profile), headers });
    const frames = 120;
    const device = runOnAvr(out.hex, frames);
    const sim = await runInSimulator(js, frames);
    expect(device.length).toBe(frames);
    const diffs = device.map((f, i) => diff(f, sim[i]));
    // Something is on the screen, and both show exactly the same pixels.
    expect(device[frames - 1].some((b) => b !== 0)).toBe(true);
    expect(diffs).toEqual(Array(frames).fill(0));
    // The hero moved: the picture changed during the run.
    expect(diff(device[5], device[frames - 1])).toBeGreaterThan(20);
  }, 180000);

  it('runs a game with a C++ block in the emulator', async () => {
    const project = newProject('Cpp');
    project.blocks = workspace([blk('ab_on_draw', { body: [blk('ab_cpp', { f: { CODE: 'ab::drawRect(0, 0, 128, 64, 1);\nab::fillRect(60, 28, 8, 8, 1);' } })] })]);
    const { cpp } = compileProject(project);
    const out = await compileGame(src, { mcu: 'atmega328p', game: cpp.code, config: profileToConfigH(EMULATOR_PROFILE), headers });
    const frames = runOnAvr(out.hex, 3, () => 0);
    expect(frames.length).toBe(3);
    const px = (b: Uint8Array, x: number, y: number) => (b[(y >> 3) * 128 + x] >> (y & 7)) & 1;
    const f = frames[2];
    // Border and the filled square from the C++ code are drawn, the rest is dark.
    expect([px(f, 0, 0), px(f, 127, 63), px(f, 64, 0), px(f, 63, 31)]).toEqual([1, 1, 1, 1]);
    expect(px(f, 30, 30)).toBe(0);
  }, 180000);
});
