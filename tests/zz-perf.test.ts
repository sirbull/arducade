// End to end check: compile a template with the WebAssembly compiler, run
// the program in an AVR emulator (avr8js) with an emulated SSD1306 screen,
// and compare the screen with the simulator, frame by frame.
// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVREEPROM, AVRIOPort, AVRTimer, AVRTWI, avrInstruction, CPU, EEPROMMemoryBackend, portBConfig, portCConfig, portDConfig, timer0Config, timer1Config, timer2Config, twiConfig } from 'avr8js';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import type { GameHooks } from '../src/gen/js';
import { BUILTIN_PROFILES, profileToConfigH } from '../src/hw/profile';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';
import { parseHex } from '../src/upload/serial';
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

const ARG_COUNT: Record<number, number> = { 0x20: 1, 0x21: 2, 0x22: 2, 0x81: 1, 0x8d: 1, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1 };

/** An SSD1306 on the I2C bus, in horizontal addressing mode. */
class Ssd1306 {
  buffer = new Uint8Array(1024);
  frames: Uint8Array[] = [];
  private control = -1;
  private cmd: number[] = [];
  private col = 0;
  private page = 0;
  private col0 = 0;
  private col1 = 127;
  private page0 = 0;
  private page1 = 7;
  private written = 0;

  constructor(private twi: AVRTWI) {}

  start() {
    this.control = -1;
    this.twi.completeStart();
  }
  stop() {
    this.twi.completeStop();
  }
  connectToSlave(addr: number) {
    this.twi.completeConnect(addr === 0x3c);
  }
  readByte() {
    this.twi.completeRead(0xff);
  }
  writeByte(v: number) {
    if (this.control < 0) this.control = v;
    else if (this.control === 0x40) this.data(v);
    else this.command(v);
    this.twi.completeWrite(true);
  }
  private command(v: number) {
    this.cmd.push(v);
    const need = ARG_COUNT[this.cmd[0]] ?? 0;
    if (this.cmd.length <= need) return;
    const [c, a, b] = this.cmd;
    if (c === 0x21) [this.col0, this.col1, this.col] = [a, b, a];
    if (c === 0x22) [this.page0, this.page1, this.page] = [a, b, a];
    this.cmd = [];
  }
  private data(v: number) {
    this.buffer[this.page * 128 + this.col] = v;
    if (++this.col > this.col1) {
      this.col = this.col0;
      if (++this.page > this.page1) this.page = this.page0;
    }
    if (++this.written % 1024 === 0) this.frames.push(this.buffer.slice());
  }
}

/** Buttons held in frame k (1 based): bit 3 right, bit 4 A, as in BUTTON_IDS. */
function inputFor(k: number): number {
  const p = k % 24;
  if (p < 2) return 1 << 4; // A
  if (p >= 4 && p < 6) return 1 << ((k / 24 | 0) % 4); // a direction
  return 0;
}

/** Nano profile pins for up, down, left, right, A, B: D2 to D7. */
function setButtons(port: AVRIOPort, bits: number) {
  for (let b = 0; b < 6; b++) port.setPin(2 + b, !(bits & (1 << b)));
}

/** CPU cycles at each shown frame of the last runOnAvr. */
let frameCycles: number[] = [];

function runOnAvr(hex: string, frames: number): Uint8Array[] {
  const program = new Uint16Array(0x4000);
  const bytes = parseHex(hex);
  new Uint8Array(program.buffer).set(bytes);
  const cpu = new CPU(program, 2048);
  new AVRTimer(cpu, timer0Config);
  new AVRTimer(cpu, timer1Config);
  new AVRTimer(cpu, timer2Config);
  new AVREEPROM(cpu, new EEPROMMemoryBackend(1024));
  const portB = new AVRIOPort(cpu, portBConfig);
  new AVRIOPort(cpu, portCConfig);
  const portD = new AVRIOPort(cpu, portDConfig);
  for (let i = 0; i <= 5; i++) portB.setPin(i, true);
  setButtons(portD, inputFor(1));
  const twi = new AVRTWI(cpu, twiConfig, 16e6);
  const screen = new Ssd1306(twi);
  twi.eventHandler = screen;
  const limit = 16e6 * (frames * 0.2 + 20);
  let shown = 0;
  frameCycles = [];
  while (screen.frames.length < frames && cpu.cycles < limit) {
    avrInstruction(cpu);
    cpu.tick();
    // Change the buttons right after a frame is shown, before the next one.
    if (screen.frames.length !== shown) {
      shown = screen.frames.length;
      frameCycles.push(cpu.cycles);
    }
    if ((cpu.cycles & 0x3fff) < 4) setButtons(portD, inputFor(Math.floor(cpu.cycles / 528000) + 1));
  }
  return screen.frames;
}

async function runInSimulator(js: { code: string; hiscoreKey: number }, frames: number): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  const engine = new Engine({
    show: (b) => out.push(b.slice()),
    tone: () => {},
    storage: { read: () => 0xff, write: () => {} },
    onSkippedCpp: () => {},
    maxSprites: 12,
    hiscoreMagic: js.hiscoreKey,
  });
  const factory = new Function('E', '$w', '$div', '$mod', '$lg', js.code) as (...a: unknown[]) => GameHooks;
  await engine.begin(factory(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard));
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


describe('match3 timing', () => {
  it('measures', async () => {
    const project = templateToProject(TEMPLATE_SOURCES.find((t) => t.id === 'match3')!);
    const { cpp } = compileProject(project);
    const profile = BUILTIN_PROFILES.find((p) => p.id === 'nano-ssd1306-i2c')!;
    const out = await compileGame(src, { mcu: 'atmega328p', game: cpp.code, config: profileToConfigH(profile), headers });
    console.log('flash', out.flash, 'ram', out.ram);
    const frames = 900;
    const device = runOnAvr(out.hex, frames);
    const ms = frameCycles.slice(1).map((c, i) => (c - frameCycles[i]) / 16000);
    console.log('got', device.length, 'cycles', frameCycles.length);
    const sorted = [...ms].sort((a, b) => a - b);
    console.log('frames', device.length, 'max', sorted.at(-1)!.toFixed(1), 'p95', sorted[Math.floor(sorted.length * 0.95)].toFixed(1), 'median', sorted[sorted.length >> 1].toFixed(1));
    console.log('over 40ms:', ms.filter((m) => m > 40).length, ms.map((m) => m.toFixed(0)).filter((m) => +m > 40).join(' '));
  }, 600000);
});
