import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, expect, it } from 'vitest';
import { compileProject } from './helpers';
import { endlessrunner, RUNNER_HAZARDS, RUNNER_RULES } from '../src/templates/endlessrunner';
import { templateToProject } from '../src/templates';
import { instantiateTemplate } from '../src/project/model';
import { Engine } from '../src/sim/engine';
import type { GameHooks, JsResult } from '../src/gen/js';
import { div16, mod16 } from '../src/sim/intmath';
import { compileGame, type FileSource } from '../src/compile/avrgcc';
import { BUILTIN_PROFILES, profileToConfigH } from '../src/hw/profile';
import { runnerSongs } from '../src/templates/endlessrunner-music';
import { parseMelody } from '../src/engine/melody';
import { SONGS, songBytes } from '../src/engine/songs';
import { POLYPHONIC_EFFECTS } from '../src/engine/polyphonic-effects';
import { ATM_RATE, renderSong } from '../src/sim/atm';

let game: JsResult;
let cpp: string;
beforeAll(() => {
  const compiled = compileProject(instantiateTemplate(templateToProject(endlessrunner), 'en'));
  expect([...compiled.ir.diagnostics, ...compiled.js.diagnostics, ...compiled.cpp.diagnostics].filter(d => d.level === 'error')).toEqual([]);
  game = compiled.js; cpp = compiled.cpp.code;
});
async function running(seed = 1, storage = new Uint8Array(512)) {
  let now = 0;
  const audio: { data: number[] | null; loop: boolean }[] = [];
  const offsets: number[] = [];
  const e = new Engine({ show() {}, tone() {}, song: (data, loop, _pitch, offset = 0) => { audio.push({ data, loop }); offsets.push(offset); }, storage: { read: address => storage[address] ?? 0, write: (address, value) => { storage[address] = value; } }, onSkippedCpp() {}, maxSprites: 12, hiscoreMagic: game.hiscoreKey, seed, noWaits: true });
  e.millis = () => now;
  const hooks = new Function('E', '$w', '$div', '$mod', '$lg', game.code)(e, (v: number) => (v << 16) >> 16, div16, mod16, e.loopGuard) as GameHooks;
  await e.begin(hooks);
  const values = () => hooks.inspect!() as Record<string, number>;
  const tick = async (input = 0, ms = 33) => { now += ms; e.input = input; await e.frame(true); return values(); };
  return { e, values, tick, hooks, storage, audio, offsets };
}
const snapshot = (name: string, e: Engine) => { mkdirSync('.cache/runner', { recursive: true }); writeFileSync(`.cache/runner/${name}.bin`, e.buffer); };

it('exports an editable four-voice soundtrack with equal loop lengths and audible voices', () => {
  expect(templateToProject(endlessrunner).songs).toEqual(runnerSongs);
  const tune = runnerSongs[0];
  const voices = tune.voices.map(voice => parseMelody(voice));
  expect(voices.flatMap(voice => voice.bad)).toEqual([]);
  expect(voices.map(voice => voice.steps.filter((_, i) => i % 2).reduce((sum, ticks) => sum + ticks, 0) / 4)).toEqual([32, 32, 32, 32]);
  const data = songBytes(tune);
  for (let voice = 0; voice < 4; voice++) {
    expect(renderSong(data, 1, 100, 15 ^ (1 << voice)).some(sample => sample !== 0)).toBe(true);
  }
  expect(renderSong(data, 15).length / ATM_RATE).toBeCloseTo(12, 0);
  expect(game.code).not.toContain('E.playEffect(');
});

it('plays effects only for jump and slide, resumes music, and ranks survival time without points', async () => {
  const r = await running();
  const last = () => r.audio.at(-1);
  const effect = (name: keyof typeof POLYPHONIC_EFFECTS) => ({ data: songBytes(POLYPHONIC_EFFECTS[name]), loop: false });
  const drive = { data: songBytes(runnerSongs[0]), loop: true };
  expect(last()).toEqual({ data: songBytes(SONGS.cave), loop: true });
  expect(r.e.timers[0].format).toBe(5);
  await r.tick(1 << 4);
  expect(last()).toEqual(drive);
  await r.tick(0, 900);
  expect(last()).toEqual(drive);
  await r.tick(1 << 4);
  expect(last()).toEqual(effect('jump'));
  const count = r.audio.length;
  await r.tick(1 << 4, 100);
  expect(r.audio).toHaveLength(count);
  await r.tick(0, 150);
  expect(last()).toEqual(drive);
  const afterJump = r.offsets.at(-1)!;
  expect(afterJump).toBeGreaterThan(0);
  for (let i = 0; i < 28; i++) {
    if (r.values().obstacleActive) r.e.setProp(r.values().obstacle, 0, r.values().camera + 500);
    await r.tick();
  }
  await r.tick(1 << 5);
  expect(last()).toEqual(effect('laser'));
  const slideCount = r.audio.length;
  await r.tick(1 << 5, 100);
  expect(r.audio).toHaveLength(slideCount);
  await r.tick(0, 400);
  expect(last()).toEqual(drive);
  expect(r.offsets.at(-1)).toBeGreaterThan(afterJump);
  r.e.setProp(r.values().obstacle, 0, r.values().camera - 50);
  const beforePass = r.audio.length;
  await r.tick();
  expect(r.audio).toHaveLength(beforePass);
  expect(r.e.score).toBe(0);
  await r.tick(0, 500);
  expect(last()).toEqual(drive);
  for (let i = 0; i < 14; i++) await r.tick();
  r.e.setPosition(r.values().obstacle, r.e.getProp(r.values().hero, 0) + 2, 48);
  await r.tick();
  expect(r.values().state).toBe(2);
  expect(r.values().recordRank).toBe(1);
  expect(last()).toEqual({ data: songBytes(SONGS.menu), loop: true });
  expect(r.e.score).toBe(0);
  expect(r.audio.filter(sound => sound.data && !sound.loop)).toEqual([effect('jump'), effect('laser')]);
  // No automatic timer overlay may cover the custom record screen.
  const records = r.e.buffer.slice();
  r.e.timers.forEach(timer => { timer.visible = false; });
  await r.tick();
  expect(r.e.buffer).toEqual(records);
  for (let i = 0; i < 25; i++) await r.tick();
  await r.tick(1 << 4);
  expect(last()).toEqual(drive);
  await r.tick(0, 900);
  expect(last()).toEqual(drive);
});

it('keeps all artwork valid and preserves editable backgrounds in exported projects', () => {
  const project = templateToProject(endlessrunner);
  expect(project.backgrounds).toHaveLength(3);
  for (const image of [...project.images, ...project.backgrounds]) {
    expect(image.width, image.id).toBeLessThanOrEqual(128);
    for (const frame of image.frames) {
      expect(frame, image.id).toHaveLength(image.height);
      frame.forEach(row => { expect(row.length, image.id).toBe(image.width); expect(row, image.id).toMatch(/^[.01]+$/); });
    }
  }
  expect(new Set(RUNNER_HAZARDS.map(h => h.image)).size).toBe(5);
  expect(RUNNER_RULES.resetDistance * 25 / 100 % 128).toBe(0);
  expect(RUNNER_RULES.resetDistance * 50 / 100 % 128).toBe(0);
});

it('starts and retries without effects and uses only time for a shorter run record', async () => {
  const first = await running();
  await first.tick(1 << 4);
  for (let i = 0; i < 31; i++) await first.tick();
  first.e.setPosition(first.values().obstacle, first.e.getProp(first.values().hero, 0) + 2, 48);
  await first.tick(0, 65000);
  expect(first.values().recordRank).toBe(1);
  for (let i = 0; i < 25; i++) await first.tick();
  await first.tick(1 << 4);
  const afterRetry = first.audio.length;
  await first.tick(0, 900);
  expect(first.audio).toHaveLength(afterRetry);
  expect(first.audio.at(-1)).toEqual({ data: songBytes(runnerSongs[0]), loop: true });

  const second = await running(2, first.storage);
  await second.tick(1 << 4);
  for (let i = 0; i < 31; i++) await second.tick();
  second.e.setPosition(second.values().obstacle, second.e.getProp(second.values().hero, 0) + 2, 48);
  await second.tick();
  expect(second.values().recordRank).toBe(2);
  expect(second.audio.at(-1)).toEqual({ data: songBytes(SONGS.menu), loop: true });
  expect(first.audio.filter(sound => sound.data && !sound.loop)).toEqual([]);
  expect(second.audio.filter(sound => sound.data && !sound.loop)).toEqual([]);
  expect(second.e.score).toBe(0);
});

it('shows the title, starts with Up, jumps with A, and slides with Down and B', async () => {
  const r = await running();
  await r.tick(); snapshot('splash', r.e);
  expect(r.values().state).toBe(0);
  await r.tick(1); await r.tick();
  expect(r.values().state).toBe(1);
  const hero = r.values().hero;
  await r.tick(1 << 4);
  expect(r.e.getProp(hero, 3)).toBeLessThan(0);
  for (let i = 0; i < 28; i++) await r.tick();
  await r.tick(1 << 1);
  expect(r.e.sprites[hero].img![1]).toBe(8);
  expect(r.e.getProp(hero, 11)).toBe(56);
  await r.tick();
  expect(r.e.sprites[hero].img![1]).toBe(16);
  await r.tick(1 << 5);
  expect(r.e.sprites[hero].img![1]).toBe(8);
  await r.tick((1 << 4) | (1 << 5));
  expect(r.e.sprites[hero].img![1]).toBe(8); // Slide wins simultaneous inputs.
});

it('caps slides at 1.5 seconds and requires releasing both Down and B to rearm', async () => {
  const r = await running();
  const down = 1 << 1, b = 1 << 5;
  await r.tick(1 << 4); await r.tick();
  const hero = r.values().hero;
  const tick = async (input: number, ms = 33) => {
    const vars = r.values();
    if (vars.obstacleActive) r.e.setProp(vars.obstacle, 0, vars.camera + 500);
    const result = await r.tick(input, ms);
    expect(result.state).toBe(1);
    return result;
  };
  await tick(down, 10);
  expect(r.values().pose).toBe(1);
  await tick(down | b, 1490);
  expect(r.values().pose).toBe(1);
  await tick(down | b, 10);
  expect(r.values().pose).toBe(0);
  expect(r.e.sprites[hero].img![1]).toBe(16);
  await tick(b, 200); // Releasing only Down must not rearm B.
  expect(r.values().pose).toBe(0);
  await tick(down, 200); // Switching held inputs must not start another slide.
  expect(r.values().pose).toBe(0);
  await tick(0);
  await tick(b);
  expect(r.values().pose).toBe(1);
  await tick(0);
  expect(r.values().pose).toBe(0); // Early release stands immediately.
  await tick(down);
  expect(r.values().pose).toBe(1);
  await tick(down, 2000); // Elapsed time, rather than frame count, limits sliding.
  expect(r.values().pose).toBe(0);
});

it('expires a slide across the survival timer minute rollover', async () => {
  const r = await running();
  await r.tick(1 << 4); await r.tick();
  await r.tick(0, 58850);
  const vars = r.values();
  r.e.setProp(vars.obstacle, 0, vars.camera + 500);
  await r.tick(1 << 5, 100);
  expect(r.values().pose).toBe(1);
  await r.tick(1 << 5, 1400);
  expect(r.values().minutesElapsed).toBe(1);
  expect(r.values().pose).toBe(1);
  await r.tick(1 << 5, 100);
  expect(r.values().pose).toBe(0);
});

it('survives mixed random obstacles, the maximum speed and repeated background wraps with skillful inputs', async () => {
  const r = await running(0xace1);
  await r.tick(1 << 4);
  const seen = new Set<number>();
  let wraps = 0, previousCamera = 0;
  for (let frame = 0; frame < 12000; frame++) {
    const vars = r.values();
    let input = 0;
    if (vars.obstacleActive) {
      seen.add(vars.hazardType);
      const dx = r.e.getProp(vars.obstacle, 0) - r.e.getProp(vars.hero, 0);
      const obstacleRight = r.e.getProp(vars.obstacle, 9);
      const heroLeft = r.e.getProp(vars.hero, 8);
      if (vars.hazardType >= 4 && dx < vars.speed / 2 + 25 && obstacleRight >= heroLeft - 4) input = 1 << 5;
      else if (vars.hazardType <= 3 && dx > 0 && dx <= vars.speed * 0.4 && vars.pose !== 2) input = 1 << 4;
    }
    const after = await r.tick(input);
    expect(after.state, `frame ${frame}, hazard ${vars.hazardType}, speed ${vars.speed}`).toBe(1);
    const activeHazards = r.e.sprites.filter(s => s.alive && s.kind === 4);
    expect(activeHazards.length).toBeLessThanOrEqual(1);
    expect(after.speed).toBeLessThanOrEqual(RUNNER_RULES.maxSpeed);
    if (after.camera < previousCamera) wraps++;
    previousCamera = after.camera;
    if (frame === 46) snapshot('game', r.e);
    if (frame === 8000) snapshot('fast', r.e);
  }
  expect(seen.size).toBe(5);
  expect(r.values().speed).toBe(RUNNER_RULES.maxSpeed);
  expect(wraps).toBeGreaterThan(60);
  expect(r.values().minutesElapsed).toBeGreaterThan(5);
}, 30000);

it('sorts and persists three best times with fractions and minute rollover, then retries without held-button restarts', async () => {
  const r = await running();
  for (const duration of [65000, 20000, 90000, 50000]) {
    await r.tick(1 << 4); await r.tick();
    for (let i = 0; i < 31; i++) await r.tick();
    const vars = r.values();
    expect(vars.obstacleActive).toBeTruthy();
    r.e.setPosition(vars.obstacle, r.e.getProp(vars.hero, 0) + 2, 48);
    await r.tick(0, duration);
    expect(r.values().state).toBe(2);
    expect(r.e.timers[0].mode).toBe(0);
    snapshot('records', r.e);
    for (let i = 0; i < 26; i++) await r.tick(1 << 4);
    expect(r.values().state).toBe(2);
    await r.tick();
  }
  expect(r.values().bestMinutes1).toBe(1);
  expect(r.values().bestMinutes2).toBe(1);
  expect(r.values().bestMinutes3).toBe(0);
  expect(r.values().bestTicks1).toBeGreaterThan(r.values().bestTicks2);
  expect(r.values().bestTicks3).toBeGreaterThan(5000);
  const again = await running(2, r.storage);
  for (const rank of [1, 2, 3]) {
    expect(again.values()['bestMinutes' + rank]).toBe(r.values()['bestMinutes' + rank]);
    expect(again.values()['bestTicks' + rank]).toBe(r.values()['bestTicks' + rank]);
  }
});

const base = join(__dirname, '../public/compiler');
it.skipIf(!existsSync(join(base, 'tools/cc1plus.wasm')))('compiles the detailed runner for Nano and Arduboy', async () => {
  const src: FileSource = {
    bytes: async p => new Uint8Array(readFileSync(join(base, p))), text: async p => readFileSync(join(base, p), 'utf8'),
    tool: async name => (await import(pathToFileURL(join(base, 'tools', `${name}.mjs`)).href)).default,
    wasm: async name => new Uint8Array(readFileSync(join(base, 'tools', `${name}.wasm`))),
  };
  const headers = Object.fromEntries(['ardublocks.h', 'ab_display.h', 'ab_font.h', 'ab_tiny.h', 'ab_atm.h'].map(f => [f, readFileSync(join(__dirname, '../core/ardublocks', f), 'utf8')]));
  for (const id of ['nano-ssd1306-i2c', 'arduboy']) {
    const profile = BUILTIN_PROFILES.find(p => p.id === id)!;
    expect(profile, id).toBeDefined();
    const out = await compileGame(src, { mcu: profile.chip, game: cpp, config: profileToConfigH(profile), headers });
    expect(out.hex.startsWith(':')).toBe(true);
  }
}, 120000);
