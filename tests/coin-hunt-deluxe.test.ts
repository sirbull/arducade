import { describe, expect, it } from 'vitest';
import { compileProject } from './helpers';
import { castle1 } from '../src/guides/world1-games';
import { guideProject, passing } from '../src/guides/guide';
import { runChecks } from '../src/guides/runtime';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';
import type { GameHooks } from '../src/gen/js';

type Json = Record<string, any>;
function walk(value: Json): Json[] {
  return [ ...(value.type ? [value] : []), ...Object.values(value).flatMap(child =>
    child && typeof child === 'object' ? (Array.isArray(child) ? child.flatMap(walk) : walk(child)) : []) ];
}
function finishedProject() {
  const project = guideProject(castle1, 'en');
  project.blocks = structuredClone(castle1.steps.at(-1)!.solution);
  return project;
}

describe('Coin hunt deluxe', () => {
  it('starts from an empty workspace and introduces every final block in the guide pictures', () => {
    expect(castle1.start.blocks.blocks).toEqual([]);
    expect(castle1.steps).toHaveLength(19);
    expect(castle1.chapters!.map(c => c.start)).toEqual([0, 4, 8, 13]);
    const signature = (block: Json) => JSON.stringify([block.type, block.fields]);
    const shown = new Set(castle1.steps.flatMap(step => (step.show ?? []).flatMap(walk)).map(signature));
    for (const block of walk(castle1.steps.at(-1)!.solution)) {
      expect(shown.has(signature(block)), signature(block)).toBe(true);
    }
  });

  it('randomises all three coins within the visible play area on different starts', async () => {
    const project = finishedProject();
    const { js, cpp } = compileProject(project);
    expect(cpp.code).toContain('random(');
    const positions: string[][] = [[], [], []];
    for (const seed of [1, 42, 1234, 9999, 65535]) {
      const engine = new Engine({ seed, show: () => {}, tone: () => {},
        storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 12, hiscoreMagic: js.hiscoreKey });
      try {
        const hooks = new Function('E', '$w', '$div', '$mod', '$lg', js.code)(
          engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks;
        await engine.begin(hooks);
        const coins = engine.sprites.filter(s => s.alive && s.kind === 3);
        expect(coins).toHaveLength(3);
        coins.forEach((coin, index) => {
          expect(coin.x / 256).toBeGreaterThanOrEqual(8);
          expect(coin.x / 256).toBeLessThanOrEqual(112);
          expect(coin.y / 256).toBeGreaterThanOrEqual(16);
          expect(coin.y / 256).toBeLessThanOrEqual(48);
          positions[index].push(`${coin.x},${coin.y}`);
        });
      } finally { engine.stop(); }
    }
    positions.forEach(starts => expect(new Set(starts).size).toBeGreaterThan(1));
  });

  it('collects 100 coins and loses only after five minutes', async () => {
    const step = castle1.steps.at(-1)!;
    const project = finishedProject();
    const runtime = await runChecks(step.checks, project);
    expect(passing(step.checks, { blocks: project.blocks as Json, project, played: 1, pressed: 63, runtime })).not.toContain(false);
  });

  it.each(['VX', 'VY'])('rejects an enemy that does not move along %s', async axis => {
    const project = finishedProject();
    for (const block of walk(project.blocks as Json)) {
      if (block.type === 'ab_sprite_set_velocity') block.inputs[axis].block.fields.NUM = 0;
    }
    const movement = castle1.steps.at(-1)!.checks.find(check => check.text.en.includes('horizontally and vertically'))!;
    expect(await runChecks([movement], project)).toEqual([false]);
  });

  it('rejects an enemy that moves diagonally but does not bounce at the edges', async () => {
    const project = finishedProject();
    for (const block of walk(project.blocks as Json)) {
      if (block.type === 'ab_sprite_set_flag' && block.fields.FLAG === 'bounceOnWall') block.fields.ON = 'off';
    }
    const movement = castle1.steps.at(-1)!.checks.find(check => check.text.en.includes('horizontally and vertically'))!;
    expect(await runChecks([movement], project)).toEqual([false]);
  });

  it.each([3, 99, 101])('rejects a win threshold of %i coins', async target => {
    const project = finishedProject();
    for (const block of walk(project.blocks as Json)) {
      if (block.type === 'logic_compare' && block.fields.OP === 'GTE') block.inputs.B.block.fields.NUM = target;
    }
    const victory = castle1.steps.at(-1)!.checks.find(check => check.text.en.startsWith('Collecting 100'))!;
    expect(await runChecks([victory], project)).toEqual([false]);
  });

  it.each(['myCoin', 'coin2', 'coin3'])('rejects a fixed start position for %s', name => {
    const project = finishedProject();
    for (const block of walk(project.blocks as Json)) {
      if (block.type === 'ab_sprite_set_position' && block.inputs.SPRITE.block.fields.VAR.name === name) {
        block.inputs.X.block = { type: 'math_number', fields: { NUM: 64 } };
      }
    }
    const checks = castle1.steps.at(-1)!.checks;
    expect(passing(checks, { blocks: project.blocks as Json, project, played: 1, pressed: 63, runtime: checks.map(() => true) })).toContain(false);
  });
});
