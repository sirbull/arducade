import { expect, it } from 'vitest';
import { LIBRARY_BACKGROUNDS } from '../src/project/background-library';
import { encodeBackground, newProject, parseProject, serializeProject } from '../src/project/model';
import { compileProject } from './helpers';
import { Engine } from '../src/sim/engine';
import type { GameHooks } from '../src/gen/js';
import manifest from '../assets/backgrounds/manifest.json';

it('provides unique native monochrome scenes and keeps the promised play area clear', () => {
  expect(new Set(LIBRARY_BACKGROUNDS.map(b => b.id)).size).toBe(LIBRARY_BACKGROUNDS.length);
  expect(new Set(LIBRARY_BACKGROUNDS.map(b => b.frames[0].join(''))).size).toBe(LIBRARY_BACKGROUNDS.length);
  expect(new Set(LIBRARY_BACKGROUNDS.map(b => b.detail)).size).toBe(3);
  for (const b of LIBRARY_BACKGROUNDS) {
    expect(manifest.find(item => item.id === b.id), b.id).toMatchObject({ detail: b.detail, layout: b.layout });
    expect([b.width, b.height]).toEqual([128, 64]);
    expect(b.frames).toHaveLength(1);
    expect(b.frames[0]).toHaveLength(64);
    for (const row of b.frames[0]) expect(row, b.id).toMatch(/^[01]{128}$/);
    for (const name of Object.values(b.name)) expect(name).toMatch(/^[\p{L}_][\p{L}\p{N}_ ]*$/u);
    expect(b.frames[0].join(''), b.id).toContain('1');
    if (b.layout === 'play') expect(b.frames[0].slice(40), b.id).toEqual(Array(24).fill('0'.repeat(128)));
  }
});

it('keeps copied backgrounds editable and persists them without changing the library', () => {
  const b = LIBRARY_BACKGROUNDS[0];
  const p = newProject('Library copy');
  p.backgrounds.push({ id: 'b1', name: b.name.en!, width: b.width, height: b.height, frames: structuredClone(b.frames) });
  const original = b.frames[0][0];
  p.backgrounds[0].frames[0][0] = '1'.repeat(128);
  expect(b.frames[0][0]).toBe(original);
  expect(parseProject(serializeProject(p)).backgrounds).toEqual(p.backgrounds);
});

it('offers several detailed environments for the play area below filter', () => {
  const detailedPlay = LIBRARY_BACKGROUNDS.filter(b => b.detail === 'rich' && b.layout === 'play');
  expect(detailedPlay.length).toBeGreaterThanOrEqual(6);
  expect(detailedPlay.map(b => b.id)).toContain('mountain-play');
  expect(detailedPlay.map(b => b.id)).toContain('city-play');
  for (const b of detailedPlay) expect(b.frames[0].slice(40), b.id).toEqual(Array(24).fill('0'.repeat(128)));
});

it('compiles every library background and renders its exact pixels in the simulator', async () => {
  const e = new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 12, hiscoreMagic: 1, seed: 1 });
  const noop = async () => {};
  const hooks: GameHooks = { init() {}, start: noop, update: noop, draw: noop, button: noop, overlap: noop, tile: noop, lifeZero: async () => false, hasOverlap: false, hasTile: false };
  await e.begin(hooks);
  for (const b of LIBRARY_BACKGROUNDS) {
    const p = newProject('Library');
    const asset = { id: 'b1', name: b.name.en!, width: b.width, height: b.height, frames: structuredClone(b.frames) };
    p.backgrounds.push(asset);
    p.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: { type: 'ab_bg_set', fields: { BG: 'b1' } } } } }] } };
    const result = compileProject(p);
    for (const diagnostics of [result.ir.diagnostics, result.cpp.diagnostics, result.js.diagnostics]) expect(diagnostics.filter(d => d.level === 'error'), b.id).toEqual([]);
    e.setBackground(e.image(encodeBackground(asset)));
    await e.frame(true);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) expect(e.getPixel(x, y), `${b.id} ${x},${y}`).toBe(Number(b.frames[0][y][x]));
  }
});
