// End to end check: compile a template with the WebAssembly compiler, run
// the program in an AVR emulator (avr8js) with an emulated SSD1306 screen,
// and compare the screen with the simulator, frame by frame.
// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVREEPROM, AVRIOPort, AVRTimer, AVRTWI, avrInstruction, CPU, EEPROMMemoryBackend, PinState, portBConfig, portCConfig, portDConfig, timer0Config, timer1Config, timer2Config, twiConfig } from 'avr8js';
import { describe, expect, it } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import type { GameHooks } from '../src/gen/js';
import { BUILTIN_PROFILES, profileToConfigH, SECRET_PROFILES } from '../src/hw/profile';
import { FRAME_MS } from '../src/engine/enums';
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
const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h', 'ab_tiny.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));

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

  /** Without a TWI unit the bytes come from SoftI2c. */
  constructor(private twi?: AVRTWI) {}

  start() {
    this.control = -1;
    this.twi?.completeStart();
  }
  stop() {
    this.twi?.completeStop();
  }
  connectToSlave(addr: number) {
    this.twi?.completeConnect(addr === 0x3c);
  }
  readByte() {
    this.twi?.completeRead(0xff);
  }
  writeByte(v: number) {
    if (this.control < 0) this.control = v;
    else if (this.control === 0x40) this.data(v);
    else this.command(v);
    this.twi?.completeWrite(true);
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

/** Reads I2C from two port pins, as the bit banged bus of the ATtiny85. */
class SoftI2c {
  private scl = true;
  private sda = true;
  private bits = -1; // -1: no transfer, else bits of the byte so far (9th is the ack)
  private byte = 0;
  private first = false;

  constructor(private port: AVRIOPort, private sdaPin: number, private sclPin: number, private screen: Ssd1306) {
    port.addListener(() => this.update());
  }

  /** The screen module has pull up resistors, so a pin that is let go is high. */
  private level(pin: number) {
    return this.port.pinState(pin) !== PinState.Low;
  }

  private update() {
    const scl = this.level(this.sclPin), sda = this.level(this.sdaPin);
    if (scl && this.scl && sda !== this.sda) {
      if (!sda) { this.screen.start(); this.bits = 0; this.byte = 0; this.first = true; }
      else { this.screen.stop(); this.bits = -1; }
    } else if (scl && !this.scl && this.bits >= 0) {
      if (this.bits < 8) this.byte = (this.byte << 1) | (sda ? 1 : 0);
      if (++this.bits === 9) {
        if (this.first) this.screen.connectToSlave(this.byte >> 1);
        else this.screen.writeByte(this.byte);
        this.first = false;
        this.bits = 0;
        this.byte = 0;
      }
    }
    this.scl = scl;
    this.sda = sda;
  }
}

// ATtiny85 registers (data addresses) and vectors (word addresses) for avr8js.
const tinyPortB = { PIN: 0x36, DDR: 0x37, PORT: 0x38, externalInterrupts: [] };
const tinyTimer0 = {
  ...timer0Config, compAInterrupt: 10, compBInterrupt: 11, ovfInterrupt: 5, TIFR: 0x58, OCRA: 0x49, OCRB: 0x48, TCNT: 0x52, TCCRA: 0x4a, TCCRB: 0x53, TIMSK: 0x59,
  TOV: 2, OCFA: 16, OCFB: 8, TOIE: 2, OCIEA: 16, OCIEB: 8, compPortA: 0x38, compPinA: 0, compPortB: 0x38, compPinB: 1, externalClockPort: 0x38, externalClockPin: 2,
};

/**
 * Runs an ATtiny85 Pico game: left on PB0, right on PB2, screen on PB3 and PB4.
 * Also returns the random seed: the timer count micros() read at start.
 */
function runOnTiny(hex: string, frames: number, input: (k: number) => number): { frames: Uint8Array[]; seed: number } {
  const program = new Uint16Array(0x1000);
  new Uint8Array(program.buffer).set(parseHex(hex));
  const cpu = new CPU(program, 512);
  new AVRTimer(cpu, tinyTimer0);
  let tcnt: number | undefined;
  const readTimer = cpu.readHooks[tinyTimer0.TCNT];
  cpu.readHooks[tinyTimer0.TCNT] = (addr) => {
    const v = readTimer(addr);
    tcnt ??= v ?? cpu.data[addr];
    return v;
  };
  const port = new AVRIOPort(cpu, tinyPortB);
  const setButtons = (bits: number) => {
    port.setPin(0, !(bits & (1 << 2)));
    port.setPin(2, !(bits & (1 << 3)));
  };
  setButtons(input(1));
  const screen = new Ssd1306();
  new SoftI2c(port, 3, 4, screen);
  const limit = 8e6 * (frames * 0.1 + 2);
  let shown = 0;
  frameCycles = [];
  while (screen.frames.length < frames && cpu.cycles < limit) {
    avrInstruction(cpu);
    // The program counter has 12 bits, so rjmp and rcall wrap around the 8 KB
    // (the linker uses that with --pmem-wrap-around=8k). avr8js does not.
    cpu.pc &= 0xfff;
    cpu.tick();
    if (screen.frames.length !== shown) {
      shown = screen.frames.length;
      frameCycles.push(cpu.cycles);
      setButtons(input(shown + 1));
    }
  }
  return { frames: screen.frames, seed: (0xace1 ^ (tcnt ?? 0)) || 0xace1 };
}

/** Buttons held in frame k (1 based): bit 3 right, bit 4 A, as in BUTTON_IDS. */
function inputFor(k: number): number {
  let bits = 0;
  // Short enough that the game is not over: then both would wait for A.
  if (k >= 10 && k <= 40) bits |= 1 << 3;
  if (k >= 20 && k <= 24) bits |= 1 << 4;
  return bits;
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
  const limit = 16e6 * (frames * 0.05 + 2);
  let shown = 0;
  frameCycles = [];
  while (screen.frames.length < frames && cpu.cycles < limit) {
    avrInstruction(cpu);
    cpu.tick();
    // Change the buttons right after a frame is shown, before the next one.
    if (screen.frames.length !== shown) {
      shown = screen.frames.length;
      frameCycles.push(cpu.cycles);
      setButtons(portD, inputFor(shown + 1));
    }
  }
  return screen.frames;
}

/** With tiny, runs as the ATtiny85 with its seed, and time follows the frames. */
async function runInSimulator(js: { code: string; hiscoreKey: number }, frames: number, input = inputFor, tiny?: { seed: number }): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  const engine = new Engine({
    show: (b) => out.push(b.slice()),
    tone: () => {},
    storage: { read: () => 0xff, write: () => {} },
    onSkippedCpp: () => {},
    maxSprites: tiny ? 5 : 12,
    hiscoreMagic: js.hiscoreKey,
    tiny: !!tiny,
    seed: tiny?.seed,
  });
  if (tiny) engine.millis = () => engine.frameCount * FRAME_MS;
  const factory = new Function('E', '$w', '$div', '$mod', '$lg', js.code) as (...a: unknown[]) => GameHooks;
  await engine.begin(factory(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard));
  while (out.length < frames) {
    engine.input = input(out.length + 1);
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
  it.each(['platformer', 'maze3d'])('%s on an ATmega328P with an SSD1306 over I2C', async (id) => {
    const project = templateToProject(TEMPLATE_SOURCES.find((t) => t.id === id)!);
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
    const ms = frameCycles.slice(1).map((c, i) => (c - frameCycles[i]) / 16000);
    console.log(id, 'ms per frame: max', Math.max(...ms).toFixed(1), 'mean', (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1));
  }, 180000);
});

/** Right held in frames 10 to 40, and left too in 20 to 24: that is A on two buttons. */
function tinyInput(k: number): number {
  let bits = 0;
  if (k >= 10 && k <= 40) bits |= 1 << 3;
  if (k >= 20 && k <= 24) bits |= 1 << 2;
  return bits;
}

describe.skipIf(!haveTools)('ATtiny85 device code matches the simulator', () => {
  it('shooter on the ATtiny85 Pico, drawn a page at a time', async () => {
    const project = templateToProject(TEMPLATE_SOURCES.find((t) => t.id === 'shooter')!);
    project.profile = SECRET_PROFILES[0];
    const { cpp, js } = compileProject(project);
    const out = await compileGame(src, { mcu: 'attiny85', game: cpp.code, config: profileToConfigH(project.profile), headers });
    expect(out.flash).toBeLessThanOrEqual(8192);
    const frames = 60;
    const { frames: device, seed } = runOnTiny(out.hex, frames, tinyInput);
    const sim = await runInSimulator(js, frames, tinyInput, { seed });
    expect(device.length).toBe(frames);
    expect(device[frames - 1].some((b) => b !== 0)).toBe(true);
    expect(device.map((f, i) => diff(f, sim[i]))).toEqual(Array(frames).fill(0));
    expect(diff(device[5], device[frames - 1])).toBeGreaterThan(20);
    const ms = frameCycles.slice(1).map((c, i) => (c - frameCycles[i]) / 8000);
    console.log('attiny85 shooter ms per frame: max', Math.max(...ms).toFixed(1), 'mean', (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1));
  }, 180000);
});


it.skipIf(!haveTools)('inversion references match device pixels with masks, animation, camera, layers and tiles', async () => {
  const { generateCpp } = await import('../src/gen/cpp');
  const { generateJs } = await import('../src/gen/js');
  const { parseSource } = await import('../src/text/languages');
  const { newProject } = await import('../src/project/model');
  const project = newProject('Inversion parity');
  project.images = [
    { id: 'shape', name: 'shape', width: 3, height: 3, frames: [['1.0', '.1.', '01.'], ['0.1', '.0.', '10.']] },
    { id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] },
  ];
  project.backgrounds = [
    { id: 'base', name: 'base', width: 8, height: 8, frames: [Array(8).fill('11110000')] },
    { id: 'layer', name: 'layer', width: 8, height: 8, frames: [Array(8).fill('.0.1....')] },
  ];
  project.tiles = [{ id: 'tile', name: 'tile', pixels: Array(8).fill('0101....'), solid: false }];
  project.tilemaps = [{ id: 'map', name: 'map', width: 2, height: 2, cells: [1, 0, 0, 1] }];
  const program = parseSource(`
    let target; let mover;
    function start() {
      scene.setBackgroundImage(images.base);
      scene.setBackgroundLayer(1, images.layer, 25);
      scene.setBackgroundLayer(2, images.layer, 100);
      scene.setBackgroundLayerPosition(2, 2, -1);
      tiles.setTilemap(tilemaps.map);
      target = sprites.create(images.shape, kind("Player"));
      sprite.setPosition(target, 12, 10);
      animation.run(target, 66);
      with_draw_mode(1) {
        mover = sprites.create(images.dot, kind("Enemy"));
        particles.imageColor(images.shape, 15, 10, 20, 0, 2000, 20, 0, 0);
      }
      sprite.setPosition(mover, 12, 10);
      sprite.setVelocity(mover, 20, 0);
      with_draw_mode(2) { particles.pixel(12, 10, 30, 0, 2000); }
      with_draw_mode(screen.spriteReference(target)) { particles.imageColor(images.shape, 12, 10, 0, 0, 2000, 0, 0, 1); }
      scene.centerCameraAt(2, -1);
    }
    function update() { scene.changeBackgroundPosition(-1, 1); }
    function draw() {
      with_draw_mode(1) { screen.drawCircle(30, 20, 4, Color.white); screen.fillCircle(45, 20, 5, Color.white); screen.drawRect(55, 20, 1, 5, Color.white); }
      with_draw_mode(2) { screen.drawImage(images.shape, 2, 2); screen.drawLine(0, 0, 18, 18, Color.white); }
      with_draw_mode(3) { screen.fillRect(60, 10, 4, 7, Color.white); }
      with_draw_mode(4) { screen.drawImage(images.shape, 70, 10); }
      with_draw_mode(screen.spriteReference(target)) { screen.drawImage(images.shape, 10, 8); }
    }
    events.start(start); events.update(update); events.draw(draw);
  `, 'javascript', project);
  const cpp = generateCpp(program, project), js = generateJs(program, project);
  expect(cpp.diagnostics).toEqual([]);
  const profile = BUILTIN_PROFILES.find(p => p.id === 'nano-ssd1306-i2c')!;
  const out = await compileGame(src, { mcu: profile.chip, game: cpp.code, config: profileToConfigH(profile), headers });
  const frames = 12;
  const device = runOnAvr(out.hex, frames);
  const sim = await runInSimulator(js, frames);
  expect(device).toHaveLength(frames);
  expect(device.map((f, i) => diff(f, sim[i]))).toEqual(Array(frames).fill(0));
}, 120000);

it.skipIf(!haveTools)('speech bubbles and text variables match AVR pixels with wrapping, camera and settings', async () => {
  const { generateCpp } = await import('../src/gen/cpp');
  const { generateJs } = await import('../src/gen/js');
  const { parseSource } = await import('../src/text/languages');
  const { newProject } = await import('../src/project/model');
  const project = newProject('Speech parity');
  project.images = [{ id: 'dot', name: 'dot', width: 4, height: 4, frames: [['1111','1001','1001','1111']] }];
  const program = parseSource(`
    let target; let message = ""; let name = "Ada"; let step = 0;
    function greeting(person) { return text("Hi, ", person, "!"); }
    function start() {
      target = sprites.create(images.dot, kind("Player"));
      message = text(greeting(name), " Score: ", 42);
      sprite.setSpeechWidth(target, 30);
      sprite.setPosition(target, 2, 2);
      sprite.say(target, message, 0);
    }
    function update() {
      step = step + 1; sprite.setPosition(target, step, 2);
      if (step > 5) { sprite.setSpeechColors(target, 1, 0); sprite.setSpeechPosition(target, 2); }
    }
    events.start(start); events.update(update);
  `, 'javascript', project);
  const cpp = generateCpp(program, project), js = generateJs(program, project);
  expect(cpp.diagnostics).toEqual([]);
  const profile = BUILTIN_PROFILES.find(p => p.id === 'nano-ssd1306-i2c')!;
  const out = await compileGame(src, { mcu: profile.chip, game: cpp.code, config: profileToConfigH(profile), headers });
  expect(out.ram).toBeLessThanOrEqual(1792);
  const frames = 12;
  const device = runOnAvr(out.hex, frames);
  const sim = await runInSimulator(js, frames);
  expect(device).toHaveLength(frames);
  expect(device.map((f, i) => diff(f, sim[i]))).toEqual(Array(frames).fill(0));
}, 120000);

it.skipIf(!haveTools)('speech bubbles match the paged ATtiny85 screen within flash and RAM limits', async () => {
  const { generateCpp } = await import('../src/gen/cpp');
  const { generateJs } = await import('../src/gen/js');
  const { parseSource } = await import('../src/text/languages');
  const { newProject } = await import('../src/project/model');
  const project = newProject('Tiny speech');
  project.images = [{ id: 'dot', name: 'dot', width: 4, height: 4, frames: [['1111','1001','1001','1111']] }];
  const program = parseSource(`
    let target; let message;
    function start() {
      target = sprites.create(images.dot, kind("Player"));
      message = text("Hi! Score: ", 42);
      sprite.say(target, message, 0);
    }
    events.start(start);
  `, 'javascript', project);
  const cpp = generateCpp(program, project), js = generateJs(program, project);
  expect(cpp.diagnostics).toEqual([]);
  const out = await compileGame(src, { mcu: 'attiny85', game: cpp.code, config: profileToConfigH(SECRET_PROFILES[0]), headers });
  expect(out.flash).toBeLessThanOrEqual(8192);
  expect(out.ram).toBeLessThanOrEqual(400);
  const frames = 8;
  const { frames: device, seed } = runOnTiny(out.hex, frames, () => 0);
  const sim = await runInSimulator(js, frames, () => 0, { seed });
  expect(device).toHaveLength(frames);
  expect(device.map((f, i) => diff(f, sim[i]))).toEqual(Array(frames).fill(0));
}, 120000);
