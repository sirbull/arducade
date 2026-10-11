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
import { generateJs, type GameHooks } from '../src/gen/js';
import { BUILTIN_PROFILES, profileToConfigH, SECRET_PROFILES } from '../src/hw/profile';
import { emptyProgram, type Program } from '../src/ir/ir';
import { newProject } from '../src/project/model';
import { ATM_RATE, AtmFallback, AtmPlayer, renderSong, songDurationMs } from '../src/sim/atm';
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
    expect(data.length).toBeLessThan(800);
    expect(def.tempo % 10, name).toBe(0);
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
  it.each(['arduboy', 'nano-sh1106-i2c', 'attiny85-pico'])('compiles a custom four-track song for %s', async id => {
    const device=profile(id), project=newProject('Studio');project.profile=device;
    project.songs.push({id:'own',name:'own',tempo:120,voices:['C4:1 E G R','E4:4','C3:4','C:0.25 R:3.75']});
    const program: Program={...emptyProgram(),events:[{k:'start',body:[{k:'expr',e:{k:'api',fn:'music.namedSong',args:[{k:'enum',type:'songAsset',v:'own'},{k:'bool',v:true}]}}]}]};
    const generated=generateCpp(program,project);expect(generated.diagnostics).toEqual([]);
    const result=await compileGame(src,{mcu:device.chip,game:generated.code,config:profileToConfigH(device),headers});
    expect(result.hex.startsWith(':')).toBe(true);
  },120000);

  it.each(['arduboy', 'nano-sh1106-i2c', 'attiny85-pico'])('compiles a song for %s', async (id) => {
    const p = profile(id);
    const quiet = await compileGame(src, { mcu: p.chip, game: generateCpp(emptyProgram(), newProject('Q')).code, config: profileToConfigH(p), headers });
    const out = await compileGame(src, { mcu: p.chip, game: generateCpp(playSong('title'), newProject('S')).code, config: profileToConfigH(p), headers });
    expect(out.hex.startsWith(':')).toBe(true);
    console.log(id, 'song player and title song: flash', out.flash - quiet.flash, 'ram', out.ram - quiet.ram);
  }, 120000);

  it.each([[undefined, 100, undefined], [100, 100, undefined], [50, 100, undefined], [0, 100, undefined], [100, 200, undefined], [50, 75, undefined], [100, 100, 'shield'], [100, 200, 'laser'], [50, 75, 'explosion']] as const)('runs the same playroutine at %s%% volume and %s%% pitch for %s on an Arduboy as in the simulator', async (volume, pitch, effect) => {
    const p = profile('arduboy');
    // The game tells the test where the oscillators and the playroutine are.
    const definition = effect ? POLYPHONIC_EFFECTS[effect] : SONGS.adventure;
    const program = effect ? {...emptyProgram(),events:[{k:'start' as const,body:[{k:'expr' as const,e:{k:'api' as const,fn:'music.polyEffect',args:[{k:'enum' as const,type:'polyEffect' as const,v:effect}]}}]}]} : playSong('adventure');
    if (pitch !== 100) program.events[0].body.unshift({k:'expr',e:{k:'api',fn:'music.pitch',args:[{k:'num',v:pitch},{k:'num',v:pitch}]}});
    if (volume !== undefined) program.events[0].body.unshift({ k: 'expr', e: { k: 'api', fn: 'music.setSongVolume', args: [{ k: 'num', v: volume }] } });
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
    while (device.length < (effect ? 30 : 60) && cpu.cycles < 16e6 * 4) {
      avrInstruction(cpu);
      cpu.tick();
      if (routine < 0 && gpior.length >= 4) [oscAt, routine] = [gpior[0] | (gpior[1] << 8), gpior[2] | (gpior[3] << 8)];
      if (cpu.pc === routine) {
        const d = cpu.data;
        device.push(osc((n) => ({ vol: d[oscAt + n * 5], freq: d[oscAt + n * 5 + 1] | (d[oscAt + n * 5 + 2] << 8) })));
        while (cpu.pc === routine) { avrInstruction(cpu); cpu.tick(); }
      }
    }
    const player = new AtmPlayer(songBytes(definition), pitch);
    player.setVolume(volume ?? 100);
    const sim = Array.from({ length: device.length }, () => {
      const state = osc((n) => player.osc[n]);
      player.playroutine();
      return state;
    });
    expect(device.length).toBe(effect ? 30 : 60);
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

it('selects the fallback voice at the same frame times as the Nano', async () => {
  if (!haveTools) return;
  const p = profile('nano-ssd1306-i2c');
  const program = playSong('adventure', false);
  program.events[0].body.push({ k: 'cpp', code: `
    uint32_t started = atm_next / 1000;
    for (uint8_t b = 0; b < 4; b++) GPIOR0 = started >> (8*b);
    for (uint8_t i = 0; i < 60; i++) {
      uint32_t now = millis(); uint16_t hz = atm_update();
      for (uint8_t b = 0; b < 4; b++) GPIOR0 = now >> (8*b);
      GPIOR0 = hz; GPIOR0 = hz >> 8; delay(33);
    }` });
  const out = await compileGame(src, { mcu: p.chip, game: generateCpp(program, newProject('Fallback')).code, config: profileToConfigH(p), headers });
  const flash = new Uint16Array(0x4000); new Uint8Array(flash.buffer).set(parseHex(out.hex));
  const cpu = new CPU(flash, 2048);
  new AVRTimer(cpu, timer0Config); new AVRTimer(cpu, timer1Config); new AVRTimer(cpu, timer2Config);
  const twi = new AVRTWI(cpu, twiConfig, 16e6);
  twi.eventHandler = { start: () => twi.completeStart(), stop: () => twi.completeStop(), connectToSlave: () => twi.completeConnect(true), writeByte: () => twi.completeWrite(true), readByte: () => twi.completeRead(0xff) };
  const bytes: number[] = []; cpu.writeHooks[0x3e] = v => { bytes.push(v); return false; };
  while (bytes.length < 364 && cpu.cycles < 16e6 * 3) { avrInstruction(cpu); cpu.tick(); }
  expect(bytes.length).toBe(364);
  const read = (i: number, n: number) => bytes.slice(i, i+n).reduce((v,b,j) => v + b * 2 ** (8*j), 0);
  const sim = new AtmFallback(songBytes(SONGS.adventure), false, read(0,4));
  for (let i = 4; i < bytes.length; i += 6) expect(sim.update(read(i,4)), `at ${read(i,4)}ms`).toBe(read(i+4,2));
}, 120000);


it('gates song volume code and clamps master volume', () => {
  const p = playSong('title'); const project = newProject('Volume');
  expect(generateCpp(p, project).code).not.toContain('AB_HAS_SONG_VOLUME');
  p.events[0].body.unshift({ k: 'expr', e: { k: 'api', fn: 'music.setSongVolume', args: [{ k: 'num', v: 50 }] } });
  expect(generateCpp(p, project).code).toContain('#define AB_HAS_SONG_VOLUME 1');
  for (const volume of [-10,0,50,100,200]) {
    const player = new AtmPlayer(songBytes(SONGS.title)); player.setVolume(volume); player.playroutine();
    const full = new AtmPlayer(songBytes(SONGS.title)); full.playroutine();
    expect(player.osc.map(o => o.vol)).toEqual(full.osc.map(o => o.vol * Math.floor(Math.max(0,Math.min(100,volume))*256/100) >> 8));
  }
});
it('ignores song volume on fallback devices and resets it on restart', async () => {
  const volume = vi.fn();
  const opts = { show: vi.fn(), tone: vi.fn(), songVolume: volume, storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 1, hiscoreMagic: 0 };
  const fallback = new Engine({ ...opts, fourVoices: false }); fallback.setSongVolume(20); expect(volume).not.toHaveBeenCalled();
  const engine = new Engine(opts); engine.setSongVolume(20); expect(volume).toHaveBeenLastCalledWith(20);
  await engine.begin({ init: () => {}, start: async () => {} } as never);
  expect(volume).toHaveBeenLastCalledWith(100); engine.stop();
});


it.each(['arduboy','nano-sh1106-i2c','attiny85-pico'])('compiles volume only where it works: %s', async id => {
  if (!haveTools) return;
  const p = profile(id), project = newProject('Song');
  const plain = playSong('title'), volume = playSong('title');
  volume.events[0].body.unshift({ k: 'expr', e: { k: 'api', fn: 'music.setSongVolume', args: [{ k: 'num', v: 50 }] } });
  const compile = (program: Program) => compileGame(src, { mcu: p.chip, game: generateCpp(program,project).code, config: profileToConfigH(p), headers });
  const before = await compile(plain), after = await compile(volume);
  console.log(id, 'title song without/with volume: flash', before.flash, after.flash, 'ram', before.ram, after.ram);
  if (id !== 'arduboy') expect(after.hex).toBe(before.hex);
  else expect(after.ram - before.ram).toBe(2);
}, 120000);
it('keeps fallback songs playing during waits and restores them after pausing', async () => {
  vi.useFakeTimers();
  try {
    const tone = vi.fn();
    const engine = new Engine({ show: vi.fn(), tone, fourVoices: false, storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 1, hiscoreMagic: 0 });
    let now = 0; vi.spyOn(engine,'millis').mockImplementation(()=>now);
    engine.playSong(songBytes(SONGS.title),true);
    const wait = engine.pause(100);
    expect(tone).toHaveBeenLastCalledWith(666);
    now = 100; await vi.advanceTimersByTimeAsync(100); await wait;
    engine.setPaused(true); expect(tone).toHaveBeenLastCalledWith(0);
    engine.setPaused(false); const next = engine.pause(1);
    expect(tone).toHaveBeenLastCalledWith(666);
    now++; await vi.advanceTimersByTimeAsync(1); await next; engine.stop();
  } finally { vi.useRealTimers(); }
});

import { POLYPHONIC_EFFECTS, POLYPHONIC_EFFECT_NAMES } from '../src/engine/polyphonic-effects';

const silentHooks: GameHooks = {
  init() {}, start: async () => {}, update: async () => {}, draw: async () => {},
  button: async () => {}, overlap: async () => {}, tile: async () => {}, lifeZero: async () => false,
  hasOverlap: false, hasTile: false,
};

it('resumes the saved song position and pitch after successive effects, and cancels it for a new song', async () => {
  let now = 0;
  const song = vi.fn();
  const e = new Engine({ show() {}, tone() {}, song, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 1, hiscoreMagic: 0 });
  e.millis = () => now;
  await e.begin(silentHooks);
  const background = songBytes(SONGS.adventure), jump = songBytes(POLYPHONIC_EFFECTS.jump), laser = songBytes(POLYPHONIC_EFFECTS.laser);
  e.setPitch(150, 150); e.playSong(background, true);
  now = 2500; e.setPitch(200, 200); e.playPolyEffect(jump);
  now += 50; e.playPolyEffect(laser);
  now += songDurationMs(laser) + 1; await e.frame(true);
  expect(song).toHaveBeenLastCalledWith(background, true, 150, 2.5);
  now += 1000; e.playPolyEffect(jump);
  now += songDurationMs(jump) + 1; await e.frame(true);
  expect(song).toHaveBeenLastCalledWith(background, true, 150, 3.5);
  e.playPolyEffect(laser);
  const menu = songBytes(SONGS.menu);
  e.playSong(menu, true);
  const count = song.mock.calls.length;
  now += 2000; await e.frame(true);
  expect(song).toHaveBeenCalledTimes(count);
  e.playPolyEffect(jump); e.stopSong();
  now += 2000; await e.frame(true);
  expect(song).toHaveBeenLastCalledWith(null, false);
  e.stop();
});

it('restores the one-voice fallback scheduler without consuming song time during effects', async () => {
  let now = 0;
  const tone = vi.fn();
  const e = new Engine({ show() {}, tone, fourVoices: false, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 1, hiscoreMagic: 0 });
  e.millis = () => now;
  await e.begin(silentHooks);
  const background = songBytes(SONGS.adventure), effect = songBytes(POLYPHONIC_EFFECTS.jump);
  const expected = new AtmFallback(background, true);
  e.playSong(background, true);
  for (let i = 0; i < 20; i++) { now += 33; expected.update(now); await e.frame(true); }
  const savedTime = now;
  e.playPolyEffect(effect);
  now += Math.ceil(songDurationMs(effect)) + 10; await e.frame(true);
  expect(tone).toHaveBeenLastCalledWith(expected.update(savedTime));
  for (let i = 1; i <= 20; i++) {
    now += 33; await e.frame(true);
    expect(tone.mock.calls.at(-1)![0]).toBe(expected.update(savedTime + i * 33));
  }
  e.stop();
});

it('measures effect duration from tracker ticks without rendering a PCM buffer', () => {
  for (const name of POLYPHONIC_EFFECT_NAMES) {
    const bytes = songBytes(POLYPHONIC_EFFECTS[name]);
    expect(Math.abs(songDurationMs(bytes) - renderSong(bytes, 3).length * 1000 / ATM_RATE)).toBeLessThan(1);
  }
});

it.skipIf(!haveTools)('restores exact tracker and oscillator state after replaced effects on Arduboy', async () => {
  const body: Program['events'][number]['body'] = [
    ...playSong('adventure').events[0].body,
    { k: 'cpp', code: `
      cli(); TIMSK4 = 0;
      for (uint8_t i = 0; i < 50; i++) ATM_playroutine();
      atm_ch_t expectedChannels[4]; atm_osc_t expectedOsc[4];
      memcpy(expectedChannels, atm_channel, sizeof(atm_channel));
      memcpy(expectedOsc, atm_osc, sizeof(atm_osc));
      uint16_t expectedCia = atm_cia, expectedCount = atm_cia_count;
    ` },
    ...effectProgram().events[0].body,
    { k: 'cpp', code: 'TIMSK4 = 0; for (uint8_t i = 0; i < 3; i++) ATM_playroutine();' },
    { k: 'expr', e: { k: 'api', fn: 'music.polyEffect', args: [{ k: 'enum', type: 'polyEffect', v: 'jump' }] } },
    { k: 'cpp', code: `
      TIMSK4 = 0;
      for (uint16_t i = 0; i < 400 && atm_background.valid; i++) ATM_playroutine();
      bool ok = !atm_background.valid && !atm_isEffect && atm_song == song_adventure && atm_loop;
      ok = ok && !memcmp(expectedChannels, atm_channel, sizeof(atm_channel));
      ok = ok && !memcmp(expectedOsc, atm_osc, sizeof(atm_osc));
      ok = ok && expectedCia == atm_cia && expectedCount == atm_cia_count && atm_pitch == 100;
      GPIOR0 = ok ? 7 : 9;
    ` },
  ];
  const p = profile('arduboy');
  const generated = generateCpp({ ...emptyProgram(), events: [{ k: 'start', body }] }, newProject('Resume'));
  const out = await compileGame(src, { mcu: p.chip, game: generated.code, config: profileToConfigH(p), headers });
  const flash = new Uint16Array(0x4000);
  new Uint8Array(flash.buffer).set(parseHex(out.hex));
  const cpu = new CPU(flash, 0xa00);
  new AVRTimer(cpu, { ...timer0Config, compAInterrupt: 0x2a, compBInterrupt: 0x2c, ovfInterrupt: 0x2e });
  const spi = new AVRSPI(cpu, { ...spiConfig, spiInterrupt: 0x30 }, 16e6);
  spi.onByte = () => cpu.addClockEvent(() => spi.completeTransfer(0xff), 16);
  cpu.readHooks[0x49] = () => cpu.data[0x49] | 1;
  const results: number[] = [];
  cpu.writeHooks[0x3e] = value => { results.push(value); return false; };
  while (!results.length && cpu.cycles < 16e6 * 2) { avrInstruction(cpu); cpu.tick(); }
  expect(results).toEqual([7]);
}, 120000);

it('renders short polyphonic effects with several sounding voices', () => {
  for (const name of POLYPHONIC_EFFECT_NAMES) {
    const def = POLYPHONIC_EFFECTS[name];
    expect(def.voices.flatMap(v => parseMelody(v).bad), name).toEqual([]);
    const bytes = songBytes(def), player = new AtmPlayer(bytes);
    player.playroutine();
    expect(player.osc.filter(o => o.vol && o.freq).length, name).toBeGreaterThanOrEqual(2);
    const pcm = renderSong(bytes, 3);
    expect(pcm.some(v => v !== 0), name).toBe(true);
    expect(pcm.length / ATM_RATE, name).toBeLessThan(2);
  }
});

it('changes all pitched voices without changing song timing or fallback timing', () => {
  const bytes = songBytes({tempo:120,voices:['C4 E4','E4 G4','C3 G3','C:2']});
  const normal = new AtmPlayer(bytes), high = new AtmPlayer(bytes, 200);
  normal.playroutine(); high.playroutine();
  expect(high.cia).toBe(normal.cia);
  for (let n=0;n<3;n++) expect(high.osc[n].freq).toBe(normal.osc[n].freq*2);
  expect(high.osc[3].freq).toBe(normal.osc[3].freq);
  expect(renderSong(bytes,3,100,0,200).length).toBe(renderSong(bytes,3).length);
  const a=new AtmFallback(bytes,false), b=new AtmFallback(bytes,false,0,200);
  for(let t=0;t<1400;t+=20)expect(Math.abs(b.update(t)-a.update(t)*2)).toBeLessThanOrEqual(1);
});

it('captures song pitch when starting and retains it after leaving the pitch block', () => {
  const song=vi.fn();
  const engine=new Engine({show:vi.fn(),tone:vi.fn(),song,storage:{read:()=>0,write:vi.fn()},onSkippedCpp:vi.fn(),maxSprites:16,hiscoreMagic:0});
  engine.setPitch(200,200);engine.playSong([1],false);engine.setPitch(100,100);
  expect(song).toHaveBeenLastCalledWith([1],false,200);
  engine.playSong([2],false);expect(song).toHaveBeenLastCalledWith([2],false);
});

const effectProgram = (): Program => ({...emptyProgram(),events:[{k:'start',body:[
  {k:'expr',e:{k:'api',fn:'music.pitch',args:[{k:'num',v:200},{k:'num',v:200}]}},
  {k:'expr',e:{k:'api',fn:'music.polyEffect',args:[{k:'enum',type:'polyEffect',v:'coin'}]}}
]}]});

it('includes only the chosen effect and roundtrips the polyphonic effect in text languages', () => {
  const p=effectProgram(), project=newProject('Effects');
  const cpp=generateCpp(p,project);
  expect(cpp.diagnostics).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_SONG_PITCH 1');
  expect(cpp.code).toContain('ab::playPolyEffect(song_effect_coin)');
  expect(cpp.code).not.toContain('song_effect_jump');
  expect(generateCpp(playSong('title'),project).code).not.toContain('AB_HAS_SONG_PITCH');
  expect(generateJs(p,project).code).toContain('E.playPolyEffect(song_effect_coin)');
  for(const language of ['javascript','python'] as const){
    const source=generateSource(p,project,language);
    expect(source).toContain('PolySound.coin');
    expect(JSON.stringify(parseSource(source,language,project))).toContain('"type":"polyEffect","v":"coin"');
  }
});

it.skipIf(!haveTools).each(['arduboy','nano-sh1106-i2c','attiny85-pico'])('compiles a pitched polyphonic effect for %s', async id => {
  const device=profile(id),project=newProject('Effect');project.profile=device;
  const generated=generateCpp(effectProgram(),project);
  const result=await compileGame(src,{mcu:device.chip,game:generated.code,config:profileToConfigH(device),headers});
  expect(result.hex.startsWith(':')).toBe(true);
},120000);

it('gives each effect four audible layers with room for the mixer', () => {
  for (const name of POLYPHONIC_EFFECT_NAMES) {
    const bytes = songBytes(POLYPHONIC_EFFECTS[name]);
    for (let voice = 0; voice < 4; voice++) {
      const solo = renderSong(bytes, 2, 100, 15 ^ (1 << voice));
      expect(solo.some(sample => sample !== 0), `${name}, voice ${voice}`).toBe(true);
    }
    const player = new AtmPlayer(bytes);
    for (let tick = 0; tick < 150 && player.playroutine(); tick++) {
      const peak = player.osc.reduce((sum, voice) => sum + voice.vol, 0);
      expect(peak, name).toBeLessThan(128);
    }
  }
});

it('shapes the laser sweep, shield vibrato and explosion tail in the tracker', () => {
  const laser = new AtmPlayer(songBytes(POLYPHONIC_EFFECTS.laser));
  laser.playroutine();const frequency = laser.osc[0].freq, volume = laser.osc[0].vol;
  laser.playroutine();
  expect(laser.osc[0].freq).toBeLessThan(frequency);
  expect(laser.osc[0].vol).toBeLessThan(volume);
  const shield = new AtmPlayer(songBytes(POLYPHONIC_EFFECTS.shield));
  const pitches = Array.from({length: 12}, () => {shield.playroutine();return shield.osc[1].freq;});
  expect(new Set(pitches).size).toBeGreaterThan(2);
  const explosion = new AtmPlayer(songBytes(POLYPHONIC_EFFECTS.explosion));
  explosion.playroutine();const noise = explosion.osc[3].vol;
  for(let i=0;i<12;i++) explosion.playroutine();
  expect(explosion.osc[3].vol).toBeGreaterThan(0);
  expect(explosion.osc[3].vol).toBeLessThan(noise);
});
