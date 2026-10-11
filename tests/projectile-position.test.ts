import { expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';
import { readFileSync } from 'node:fs';

const image = new Uint8Array([2, 2, 1, 0, 3, 3]);
const engine = (maxSprites = 4) => new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites, hiscoreMagic: 0 });
const update = (e: Engine) => (e as unknown as { updateSprites(): void }).updateSprites();

it('has a label, tooltip and world-coordinate explanation in every language', () => {
  for (const language of ['nb', 'en', 'de', 'es', 'fr']) {
    const locale = JSON.parse(readFileSync(new URL(`../public/locales/${language}.json`, import.meta.url), 'utf8'));
    expect(locale.blocks.AB_SPRITE_PROJECTILE_POSITION.match(/%\d/g)).toEqual(['%1', '%2', '%3', '%4', '%5']);
    expect(locale.blocks.AB_SPRITE_PROJECTILE_POSITION_TOOLTIP.length).toBeGreaterThan(20);
    expect(locale.ui['docs.more.ab_sprite_projectile_position'].length).toBeGreaterThan(20);
  }
});

it('generates position projectiles for both targets and keeps sprite support enabled', () => {
  const project = newProject('Position projectile');
  project.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
  const number = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'variables_set', fields: { VAR: { name: 'shot' } }, inputs: { VALUE: { block: {
      type: 'ab_sprite_projectile_position', fields: { IMAGE: 'dot' },
      inputs: { X: number(12), Y: number(25), VX: number(60), VY: number(-30) },
    } } },
  } } } }] } };
  const { ir, cpp, js } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.diagnostics).toEqual([]);
  expect(cpp.code).toContain('ab::createProjectileFromPosition(img_dot, 12, 25, 60, -30)');
  expect(cpp.code).not.toContain('#define AB_NO_SPRITES');
  expect(js.code).toContain('E.createProjectileFromPosition(img_dot, 12, 25, 60, -30)');
});

it('uses world coordinates, projectile kind, and independent velocities', () => {
  const e = engine();
  e.camX = 100;
  e.camY = 20;
  const s = e.createProjectileFromPosition(image, 112, 45, 60, -30);
  expect(e.kindOf(s)).toBe(2);
  expect([0, 1, 2, 3].map(prop => e.getProp(s, prop))).toEqual([112, 45, 60, -30]);
  update(e);
  expect(e.getProp(s, 0)).toBe(114);
  expect(e.getProp(s, 1)).toBe(44);
});

it('can enter from a screen edge and disappears after leaving the screen', () => {
  const e = engine();
  const s = e.createProjectileFromPosition(image, 0, 32, 120, 0);
  update(e);
  expect(e.exists(s)).toBe(true);
  for (let i = 0; i < 40; i++) update(e);
  expect(e.exists(s)).toBe(false);
});

it('destroys position projectiles when they hit a solid tile', () => {
  const e = engine();
  e.setMap([2, 1, 0, 1]);
  e.solidTiles = 1 << 1;
  const s = e.createProjectileFromPosition(image, 4, 4, 120, 0);
  for (let i = 0; i < 3; i++) update(e);
  expect(e.exists(s)).toBe(false);
});

it('returns NONE when full without changing an existing sprite', () => {
  const e = engine(1);
  const s = e.createProjectileFromPosition(image, 20, 30, 0, 0);
  expect(e.createProjectileFromPosition(image, 90, 50, 100, 100)).toBe(255);
  expect(e.getProp(s, 0)).toBe(20);
  expect(e.getProp(s, 1)).toBe(30);
});
