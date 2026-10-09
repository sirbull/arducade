import { expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { FRAME_MS } from '../src/engine/enums';
import type { GameHooks } from '../src/gen/js';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';

async function engine() {
  const e = new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 12, hiscoreMagic: 1 });
  const noop = async () => {};
  const hooks: GameHooks = { init() {}, start: noop, update: noop, draw: noop, button: noop, overlap: noop, tile: noop, lifeZero: async () => false, hasOverlap: false, hasTile: false };
  await e.begin(hooks);
  return { e, hooks };
}

it('moves pixel particles in world coordinates and expires them', async () => {
  const { e } = await engine();
  e.camX = 10;
  e.emitParticle(null, 30, 20, 100, -100, FRAME_MS * 2);
  await e.frame(true);
  expect(e.getPixel(23, 16)).toBe(1);
  expect(e.sprites.every(s => !s.alive)).toBe(true);
  await e.frame(true);
  expect(e.particles).toHaveLength(0);
  expect(e.getPixel(23, 16)).toBe(0);
});

it('caps particles to the device capacity, ignores nonpositive lifetimes and reuses expired capacity', async () => {
  const { e } = await engine();
  e.emitParticle(null, 0, 0, 0, 0, 0);
  for (let i = 0; i < e.maxParticles + 2; i++) e.emitParticle(null, i, 20, 0, 0, FRAME_MS);
  expect(e.particles).toHaveLength(e.maxParticles);
  await e.frame(true);
  e.emitParticle(null, 40, 20, 0, 0, 100);
  expect(e.particles).toHaveLength(1);
  e.clearParticles();
  expect(e.particles).toHaveLength(0);
});

it('draws centered image particles and clears particles when a game begins', async () => {
  const { e, hooks } = await engine();
  e.emitParticle(e.image([2, 2, 1, 0, 3, 3]), 40, 20, 0, 0, 100);
  await e.frame(true);
  expect(e.getPixel(39, 19)).toBe(1);
  expect(e.getPixel(40, 20)).toBe(1);
  await e.begin(hooks);
  expect(e.particles).toHaveLength(0);
});

it('generates particle blocks for both targets and reserves RAM only when used', () => {
  const project = newProject('Particles');
  const empty = compileProject(project);
  expect(empty.cpp.code).not.toContain('#define AB_HAS_PARTICLES');
  project.images = [{ id: 'spark', name: 'spark', width: 2, height: 2, frames: [['11', '11']] }];
  const value = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const inputs = { X: value(64), Y: value(32), VX: value(30), VY: value(-30), MS: value(500) };
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: { type: 'ab_particle_pixel', inputs, next: { block: { type: 'ab_particle_image', fields: { IMAGE: project.images[0].id }, inputs, next: { block: { type: 'ab_particles_clear' } } } } } } } }] } };
  const { cpp, js, ir } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_PARTICLES 1');
  expect(cpp.code).toContain('ab::emitParticleTween(0, 64, 32, 30, -30, 500, 30, -30, 1)');
  expect(cpp.code).toContain('ab::clearParticles()');
  expect(js.code).toContain('E.emitParticle(null, 64, 32, 30, -30, 500, 30, -30, 1)');
  expect(js.code).toContain('E.clearParticles()');
  Object.assign(inputs, { END_VX: value(-10), END_VY: value(10) });
  const tween = compileProject(project);
  expect(tween.ir.diagnostics).toEqual([]);
  expect(tween.cpp.code).toContain('ab::emitParticleTween(0, 64, 32, 30, -30, 500, -10, 10, 1)');
  expect(tween.cpp.code).toContain('ab::emitParticleTween(img_spark, 64, 32, 30, -30, 500, -10, 10, 1)');
  expect(tween.js.code).toContain('E.emitParticle(null, 64, 32, 30, -30, 500, -10, 10, 1)');

});

it('interpolates X and Y velocity independently over the chosen lifetime', async () => {
  const { e } = await engine();
  e.emitParticle(null, 30, 20, 100, 0, FRAME_MS * 4, 0, 100);
  const deltas: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const { x, y } = e.particles[0];
    await e.frame(true);
    deltas.push([e.particles[0].x - x, e.particles[0].y - y]);
  }
  expect(deltas[0][0]).toBeGreaterThan(deltas[1][0]);
  expect(deltas[1][0]).toBeGreaterThan(deltas[2][0]);
  expect(deltas[0][1]).toBeLessThan(deltas[1][1]);
  expect(deltas[1][1]).toBeLessThan(deltas[2][1]);
  await e.frame(true);
  expect(e.particles).toHaveLength(0);
});

it('starts particles from a player/object contact event', async () => {
  const { e, hooks } = await engine();
  hooks.hasOverlap = true;
  const img = e.image([2, 2, 1, 0, 3, 3]);
  const player = e.create(img, 0), object = e.create(img, 1);
  e.setPosition(player, 30, 20);
  e.setPosition(object, 80, 20);
  hooks.overlap = async (a, b) => {
    if (a === player && b === object) {
      e.emitParticle(null, e.getProp(a, 0), e.getProp(a, 1), 30, -30, 500, 0, 30);
      e.destroy(object);
    }
  };
  await e.frame(true);
  expect(e.particles).toHaveLength(0);
  e.setPosition(object, 30, 20);
  await e.frame(true);
  expect(e.particles).toHaveLength(1);
  expect(e.particles[0]).toMatchObject({ x: 30 * 256, y: 20 * 256, remaining: 500, endVx: 0, endVy: 30 });
  await e.frame(true);
  expect(e.particles).toHaveLength(1);
});

it('supports more particles on larger devices', async () => {
  const { e } = await engine();
  expect(e.maxParticles).toBe(12);
  e.maxSprites = 16;
  expect(e.maxParticles).toBe(16);
  for (let i = 0; i < 20; i++) e.emitParticle(null, i, 20, 0, 0, 100);
  expect(e.particles).toHaveLength(16);
});

it.each([null, new Uint8Array([2, 2, 1, 1, 1, 0, 1, 2])])('draws black particles over white while retaining image transparency', async img => {
  const { e } = await engine();
  const background = e.create(e.image([3, 3, 1, 0, 7, 7, 7]), 0);
  e.setPosition(background, 40, 20);
  e.emitParticle(img, 40, 20, 0, 0, 100, 0, 0, 0);
  await e.frame(true);
  if (img) {
    expect(e.getPixel(39, 19)).toBe(0);
    expect(e.getPixel(40, 20)).toBe(0);
    expect(e.getPixel(40, 19)).toBe(1);
    expect(e.getPixel(39, 20)).toBe(1);
  } else expect(e.getPixel(40, 20)).toBe(0);
});

it('chooses random black or white once per particle', async () => {
  const { e } = await engine();
  e.rng = 0xace1;
  for (let i = 0; i < 12; i++) e.emitParticle(null, i, 20, 0, 0, 100, 0, 0, 2);
  const colors = e.particles.map(p => p.color);
  expect(new Set(colors)).toEqual(new Set([0, 1]));
  await e.frame(true);
  expect(e.particles.map(p => p.color)).toEqual(colors);
});
