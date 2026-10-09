// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pong } from '../src/templates/pong';
import { templateToProject } from '../src/templates';
import { compileProject } from './helpers';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';
import type { GameHooks } from '../src/gen/js';

async function game() {
  const { js } = compileProject(templateToProject(pong));
  const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 12, hiscoreMagic: js.hiscoreKey });
  const hooks = new Function('E', '$w', '$div', '$mod', '$lg', js.code)(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks;
  await engine.begin(hooks);
  return { engine, hooks };
}

describe('Pong gameplay', () => {
  it.each([[2, -19], [62, 19]])('reflects at wall y=%s without changing speed or losing vertical motion', async (y, vy) => {
    const { engine } = await game();
    engine.setPosition(2, 64, y);
    engine.setVelocity(2, 46, vy);
    const initialSpeed = Math.hypot(engine.sprites[2].vx, engine.sprites[2].vy);
    // Enough frames to leave the wall, without reaching a paddle.
    for (let i = 0; i < 12; i++) await engine.frame(true);
    expect(engine.sprites[2].vy / 16).toBe(-vy);
    expect(Math.hypot(engine.sprites[2].vx, engine.sprites[2].vy)).toBe(initialSpeed);
    expect(y === 2 ? engine.sprites[2].y / 256 > 5 : engine.sprites[2].y / 256 < 59).toBe(true);
  });

  it('keeps the center direction after a wall reflection', async () => {
    const { engine, hooks } = await game();
    engine.setPosition(2, 7, 32);
    engine.setVelocity(2, -46, -19);
    await hooks.overlap(0, 2);
    expect(engine.sprites[2].vx / 16).toBe(47);
    expect(engine.sprites[2].vy / 16).toBe(-20);
  });

  it.each([0, 1])('uses five steering zones on paddle %s', async (paddle) => {
    const direction = paddle === 0 ? 1 : -1;
    for (const [offset, expectedVx, expectedVy] of [[-6, 41, -31], [-3, 47, -20], [0, 47, 20], [3, 47, 20], [6, 41, 31]]) {
      const { engine, hooks } = await game();
      engine.setPosition(paddle, paddle === 0 ? 4 : 123, 32);
      engine.setPosition(2, paddle === 0 ? 7 : 120, 32 + offset);
      engine.setVelocity(2, -direction * 50, 20);
      await hooks.overlap(paddle, 2);
      expect(engine.sprites[2].vx / 16).toBe(direction * expectedVx);
      expect(engine.sprites[2].vy / 16).toBe(expectedVy);
      expect(Math.abs(Math.hypot(engine.sprites[2].vx / 16, engine.sprites[2].vy / 16) - 51)).toBeLessThan(0.6);
      // The outgoing direction prevents a repeated hit while separating.
      await hooks.overlap(paddle, 2);
      expect(engine.sprites[2].vx / 16).toBe(direction * expectedVx);
    }
  });

  it('moves the AI toward the ball and stops when aligned', async () => {
    const { engine, hooks } = await game();
    for (const [ballY, expectedVy] of [[15, -40], [49, 40], [32, 0]]) {
      engine.setPosition(2, 64, ballY);
      await hooks.update();
      expect(engine.sprites[1].vy / 16).toBe(expectedVy);
    }
  });

  it('increases speed on consecutive returns and preserves the center slope', async () => {
    const { engine, hooks } = await game();
    engine.setPosition(2, 7, 32);
    engine.setVelocity(2, -46, 19);
    await hooks.overlap(0, 2);
    expect(engine.sprites[2].vx / 16).toBe(47);
    expect(engine.sprites[2].vy / 16).toBe(20);
    engine.setPosition(2, 120, 32);
    await hooks.overlap(1, 2);
    expect(engine.sprites[2].vx / 16).toBe(-48);
    expect(engine.sprites[2].vy / 16).toBe(20);
  });
});
