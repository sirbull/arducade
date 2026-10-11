// Built in songs: the ATMlib data, the simulator player, the generated code,
// and the player on the device in an AVR emulator.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AVRIOPort, AVRSPI, AVRTimer, AVRTWI, avrInstruction, CPU, portBConfig, portDConfig, spiConfig, timer0Config, timer1Config, timer2Config, twiConfig } from 'avr8js';
import { describe, expect, it, vi } from 'vitest';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { SONG_NAMES, SONGS, songBytes } from '../src/engine/songs';
import { parseMelody } from '../src/engine/melody';
import { generateCpp } from '../src/gen/cpp';
import { generateJs } from '../src/gen/js';
import { BUILTIN_PROFILES, profileToConfigH, SECRET_PROFILES } from '../src/hw/profile';
import { emptyProgram, type Program } from '../src/ir/ir';
import { newProject } from '../src/project/model';
import { ATM_RATE, AtmPlayer, renderSong } from '../src/sim/atm';
import { Engine } from '../src/sim/engine';
import { generateSource, parseSource } from '../src/text/languages';
import { parseHex } from '../src/upload/serial';

const playSong = (v: string, loop = true): Program => ({
  ...emptyProgram(),
  events: [{ k: 'start', body: [{ k: 'expr', e: { k: 'api', fn: 'music.song', args: [{ k: 'enum', type: 'song', v }, { k: 'bool', v: loop }] } }] }],
});

it('writes every song as ATMlib data that ends when its voices do', () => {
  for (const name of SONG_NAMES) {
    const def = SONGS[name];
    const beats = def.voices.map((v) => parseMelody(v).steps.filter((_, i) => i % 2).reduce((a, b) => a + b, 0) / 4);
    expect(def.voices.flatMap((v) => parseMelody(v).bad)).toEqual([]);
    const longest = Math.max(...beats);
    expect(beats.every((b) => b === 0 || b === longest), name).toBe(true);
    const data = songBytes(def);
    expect(data[0]).toBe(4); // four tracks, one for each voice
    expect(data.length).toBeLessThan(700);
    const pcm = renderSong(data);
    expect(Math.abs(pcm.length / ATM_RATE - (longest * 60) / def.tempo), name).toBeLessThan(0.1);
    expect(pcm.every((v) => Math.abs(v) < 1)).toBe(true); // the mix never wraps
  }
});

it('plays a note at the ATMlib pitch', () => {
  // E5 is ATMlib note 30 (1397), which sounds at 1397 * 31250 / 65536 = 666 Hz.
  const player = new AtmPlayer(songBytes({ tempo: 120, voices: ['E5:4', '', '', ''] }));
  player.playroutine();
  expect(player.osc[0].freq).toBe(1397);
  expect(player.osc[0].vol).toBeGreaterThan(0);
});

it('compiles a song to a flash table on the device and an array in the simulator', () => {
  const cpp = generateCpp(playSong('title'), newProject('Song'));
  expect(cpp.code).toContain('#define AB_HAS_SONGS 1');
  expect(cpp.code).toContain(`static const uint8_t song_title[] PROGMEM = {${songBytes(SONGS.title).join(', ')}};`);
  expect(cpp.code).toContain('ab::playSong(song_title, true);');
  expect(cpp.code).not.toContain('song_boss');
  expect(generateCpp(emptyProgram(), newProject('Quiet')).code).not.toContain('AB_HAS_SONGS');
  const js = generateJs(playSong('boss', false), newProject('Song'));
  expect(js.code).toContain(`const song_boss = [${songBytes(SONGS.boss).join(',')}];`);
  expect(js.code).toContain('E.playSong(song_boss, false)');
});

it('starts and stops songs in the simulator', () => {
  const song = vi.fn();
  const engine = new Engine({ show: vi.fn(), tone: vi.fn(), song, storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 16, hiscoreMagic: 0 });
  engine.playSong([1, 2, 3], true);
  expect(song).toHaveBeenLastCalledWith([1, 2, 3], true);
  engine.stopSong();
  expect(song).toHaveBeenLastCalledWith(null, false);
  engine.playSong([1], false);
  engine.soundOff();
  expect(song).toHaveBeenLastCalledWith(null, false);
});

it('writes songs as Song constants in JavaScript and Python', () => {
  const project = newProject('Song');
  for (const language of ['javascript', 'python'] as const) {
    const source = generateSource(playSong('levelUp'), project, language);
    expect(source).toContain('Song.levelUp');
    expect(JSON.stringify(parseSource(source, language, project))).toContain('"type":"song","v":"levelUp"');
    expect(() => parseSource(source.replace('Song.levelUp', 'Song.nope'), language, project)).toThrow();
  }
});

const base = join(__dirname, '../public/compiler');
const haveTools = existsSync(join(base, 'tools/cc1plus.wasm'));
const src: FileSource = {
  bytes: async (p) => new Uint8Array(readFileSync(join(base, p))),
  text: async (p) => readFileSync(join(base, p), 'utf8'),
  tool: async (name) => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
  wasm: async (name) => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
};
const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h', 'ab_tiny.h', 'ab_atm.h'].map((f) => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));
const profile = (id: string) => [...BUILTIN_PROFILES, ...SECRET_PROFILES].find((p) => p.id === id)!;

describe.skipIf(!haveTools)('songs on the device', () => {
  it.each(['arduboy', 'nano-sh1106-i2c', 'attiny85-pico'])('compiles a song for %s', async (id) => {
    const p = profile(id);
    const quiet = await compileGame(src, { mcu: p.chip, game: generateCpp(emptyProgram(), newProject('Q')).code, config: profileToConfigH(p), headers });
    const out = await compileGame(src, { mcu: p.chip, game: generateCpp(playSong('title'), newProject('S')).code, config: profileToConfigH(p), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    console.log(id, 'song player and title song: flash', out.flash - quiet.flash, 'ram', out.ram - quiet.ram);
  }, 120000);

  it('runs the same playroutine on an Arduboy as in the simulator', async () => {
    const p = profile('arduboy');
    // The game tells the test where the oscillators and the playroutine are.
    const program = playSong('adventure');
    const where = 'uint16_t o = (uint16_t)atm_osc, r = (uint16_t)&ATM_playroutine; GPIOR0 = o; GPIOR0 = o >> 8; GPIOR0 = r; GPIOR0 = r >> 8;';
    program.events[0].body.unshift({ k: 'cpp', code: where });
    const out = await compileGame(src, { mcu: p.chip, game: generateCpp(program, newProject('S')).code, config: profileToConfigH(p), headers });
    const flash = new Uint16Array(0x4000);
    new Uint8Array(flash.buffer).set(parseHex(out.hex));
    const cpu = new CPU(flash, 0xa00);
    // ATmega32u4 vectors differ from the ATmega328P ones avr8js ships with.
    new AVRTimer(cpu, { ...timer0Config, compAInterrupt: 0x2a, compBInterrupt: 0x2c, ovfInterrupt: 0x2e });
    const spi = new AVRSPI(cpu, { ...spiConfig, spiInterrupt: 0x30 }, 16e6);
    spi.onByte = () => cpu.addClockEvent(() => spi.completeTransfer(0xff), 16);
    cpu.readHooks[0x49] = () => cpu.data[0x49] | 1; // PLLCSR: the USB PLL is locked
    // Timer4 overflows every 256 cycles at 16 MHz with no prescaler.
    const timer4Ovf = { address: 0x52, enableRegister: 0x72, enableMask: 4, flagRegister: 0x39, flagMask: 4 };
    const tick = () => { cpu.setInterruptFlag(timer4Ovf); cpu.addClockEvent(tick, 256); };
    cpu.addClockEvent(tick, 256);
    const gpior: number[] = [];
    cpu.writeHooks[0x3e] = (value) => { gpior.push(value); return false; }; // GPIOR0
    // Oscillators when the playroutine starts, so after the tick before it.
    // The noise shift register (voice 3 freq) runs every sample and is left out.
    const osc = (read: (n: number) => { vol: number; freq: number }) =>
      [0, 1, 2, 3].map((n) => (n === 3 ? read(n).vol : `${read(n).vol}/${read(n).freq}`)).join(' ');
    const device: string[] = [];
    let oscAt = 0, routine = -1;
    while (device.length < 60 && cpu.cycles < 16e6 * 4) {
      avrInstruction(cpu);
      cpu.tick();
      if (routine < 0 && gpior.length >= 4) [oscAt, routine] = [gpior[0] | (gpior[1] << 8), gpior[2] | (gpior[3] << 8)];
      if (cpu.pc === routine) {
        const d = cpu.data;
        device.push(osc((n) => ({ vol: d[oscAt + n * 5], freq: d[oscAt + n * 5 + 1] | (d[oscAt + n * 5 + 2] << 8) })));
        while (cpu.pc === routine) { avrInstruction(cpu); cpu.tick(); }
      }
    }
    const player = new AtmPlayer(songBytes(SONGS.adventure));
    const sim = Array.from({ length: device.length }, () => {
      const state = osc((n) => player.osc[n]);
      player.playroutine();
      return state;
    });
    expect(device.length).toBe(60);
    expect(device).toEqual(sim);
  }, 120000);

  it('plays the melody voice on the tone pin without Timer4', async () => {
    const p = profile('nano-ssd1306-i2c');
    const program: Program = { ...emptyProgram(), events: [{ k: 'start', body: [{ k: 'expr', e: { k: 'api', fn: 'music.song', args: [{ k: 'enum', type: 'song', v: 'title' }, { k: 'bool', v: false }] } }] }] };
    const out = await compileGame(src, { mcu: 'atmega328p', game: generateCpp(program, newProject('S')).code, config: profileToConfigH(p), headers });
    const flash = new Uint16Array(0x4000);
    new Uint8Array(flash.buffer).set(parseHex(out.hex));
    const cpu = new CPU(flash, 2048);
    new AVRTimer(cpu, timer0Config); new AVRTimer(cpu, timer1Config); new AVRTimer(cpu, timer2Config);
    const portB = new AVRIOPort(cpu, portBConfig);
    const portD = new AVRIOPort(cpu, portDConfig);
    for (let b = 2; b < 8; b++) portD.setPin(b, true);
    const twi = new AVRTWI(cpu, twiConfig, 16e6);
    twi.eventHandler = { start: () => twi.completeStart(), stop: () => twi.completeStop(), connectToSlave: () => twi.completeConnect(true), writeByte: () => twi.completeWrite(true), readByte: () => twi.completeRead(0xff) };
    const edges: number[] = [];
    portB.addListener((v, old) => { if ((v ^ old) & 2) edges.push(cpu.cycles); });
    while (cpu.cycles < 16e6 * 0.5) { avrInstruction(cpu); cpu.tick(); }
    // The first note of the title song is E5: ATMlib note 30, 1397 * 31250 / 65536 = 666 Hz.
    const first = edges.filter((c) => c < edges[0] + 16e6 * 0.15);
    const hz = (first.length - 1) / 2 / ((first[first.length - 1] - first[0]) / 16e6);
    expect(Math.abs(hz - 666)).toBeLessThan(3);
  }, 120000);
});
