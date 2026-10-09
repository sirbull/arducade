// Runs the engine's Timer1 tone in an AVR emulator.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVRIOPort, AVRTimer, AVRTWI, avrInstruction, CPU, portBConfig, portDConfig, timer0Config, timer1Config, timer2Config, twiConfig } from 'avr8js';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { generateCpp } from '../src/gen/cpp';
import { emptyProgram } from '../src/ir/ir';
import { newProject } from '../src/project/model';
import { BUILTIN_PROFILES, profileToConfigH } from '../src/hw/profile';
import { parseHex } from '../src/upload/serial';
const base = join(__dirname, '../public/compiler');
const src: FileSource = {
  bytes: async (p) => new Uint8Array(readFileSync(join(base, p))),
  text: async (p) => readFileSync(join(base, p), 'utf8'),
  tool: async (name) => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async (name) => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};
const haveTools = existsSync(join(base, 'tools/cc1plus.wasm'));
const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));
const num = (v: number) => ({ k: 'num' as const, v });
describe.skipIf(!haveTools)('sound on the device', () => {
const api = (fn: string, ...args: number[]) => ({ k: 'expr' as const, e: { k: 'api' as const, fn, args: args.map(num) } });
it.each([
  ['', [], 440],
  [' with the pitch at 200 percent', [api('music.pitch', 200, 200)], 880],
])('timer1 tone%s: frequency and duration on D9', async (_, before, hz) => {
  const program = { ...emptyProgram(), events: [{ k: 'start' as const, body: [...before, api('music.tone', 440, 200)] }] };
  const profile = BUILTIN_PROFILES.find((p) => p.id === 'nano-ssd1306-i2c')!;
  const out = await compileGame(src, { mcu: 'atmega328p', game: generateCpp(program as never, newProject('T')).code, config: profileToConfigH(profile), headers });
  const program16 = new Uint16Array(0x4000);
  new Uint8Array(program16.buffer).set(parseHex(out.hex));
  const cpu = new CPU(program16, 2048);
  new AVRTimer(cpu, timer0Config); new AVRTimer(cpu, timer1Config); new AVRTimer(cpu, timer2Config);
  const portB = new AVRIOPort(cpu, portBConfig);
  const portD = new AVRIOPort(cpu, portDConfig);
  for (let b = 2; b < 8; b++) portD.setPin(b, true);
  const twi = new AVRTWI(cpu, twiConfig, 16e6);
  twi.eventHandler = { start: () => twi.completeStart(), stop: () => twi.completeStop(), connectToSlave: () => twi.completeConnect(true), writeByte: () => twi.completeWrite(true), readByte: () => twi.completeRead(0xff) };
  const edges: number[] = [];
  portB.addListener((v, old) => { if ((v ^ old) & 2) edges.push(cpu.cycles); });
  while (cpu.cycles < 16e6 * 0.6) { avrInstruction(cpu); cpu.tick(); }
  const rising = edges.length / 2;
  const span = (edges[edges.length - 1] - edges[0]) / 16e6;
  expect(Math.abs(edges.length / 2 / span - hz)).toBeLessThan(3);
  expect(Math.abs(span - 0.2)).toBeLessThan(0.005);
  expect(rising).toBeGreaterThan(hz / 5 - 8);
  expect(portB.pinState(1)).toBe(0); // Low when done.
}, 120000);
it('a C++ block can still call the Arduino tone()', async () => {
  const program = { ...emptyProgram(), events: [{ k: 'start' as const, body: [{ k: 'cpp' as const, code: 'tone(9, 440, 100);' }] }] };
  for (const pid of ['nano-ssd1306-i2c', 'arduboy']) {
    const profile = BUILTIN_PROFILES.find((p) => p.id === pid)!;
    const out = await compileGame(src, { mcu: profile.chip, game: generateCpp(program as never, newProject('T')).code, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }
}, 120000);
});
