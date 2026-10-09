// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { platformer } from '../src/templates/platformer';
import { templateToProject } from '../src/templates';
import { compileProject } from './helpers';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';
import type { GameHooks } from '../src/gen/js';

it('accepts a grounded jump on every frame, including subpixel gravity frames', async () => {
  const { js } = compileProject(templateToProject(platformer));
  for (let wait = 0; wait < 12; wait++) {
    const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 16, hiscoreMagic: js.hiscoreKey });
    const hooks = new Function('E', '$w', '$div', '$mod', '$lg', js.code)(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks;
    await engine.begin(hooks);
    engine.setPosition(0, 20, 52);
    engine.setVelocity(0, 0, 0);
    for (let i = 0; i <= wait; i++) await engine.frame(true);
    expect(engine.isHitting(0, 8), `ground contact after ${wait + 1} frames`).toBe(true);
    engine.input = 16;
    await engine.frame(true);
    expect(engine.getProp(0, 3)).toBeLessThan(0);
    expect(engine.getProp(0, 1)).toBeLessThan(52);
    expect(engine.isHitting(0, 8)).toBe(false);
    // A second press while airborne must not allow another jump.
    engine.input = 0;
    await engine.frame(true);
    engine.input = 16;
    await engine.frame(true);
    expect(engine.getProp(0, 3)).toBeGreaterThan(-100);
  }
});

it('keeps the enemies inside the level, so the last one turns at the right end', async () => {
  const { js } = compileProject(templateToProject(platformer));
  const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 16, hiscoreMagic: js.hiscoreKey, noWaits: true });
  engine.millis = () => engine.frameCount * 33;
  await engine.begin(new Function('E', '$w', '$div', '$mod', '$lg', js.code)(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks);
  // Without the hero the enemies just walk back and forth.
  engine.destroy(0);
  for (let i = 0; i < 900; i++) await engine.frame(true);
  const enemies = [...Array(16).keys()].filter((s) => engine.exists(s));
  expect(enemies.length).toBeGreaterThan(0);
  for (const s of enemies) expect(engine.getProp(s, 9)).toBeLessThanOrEqual(engine.mapW() * 8);
});
