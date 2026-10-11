import { describe, expect, it } from 'vitest';
import * as Blockly from 'blockly/core';
import './helpers';
import { setAssetProject } from '../src/blocks/assets';
import { GUIDES } from '../src/guides/world1';
import { guideProject, matchesSolution, passing } from '../src/guides/guide';

type Json = Record<string, any>;
const maze = GUIDES.find(g => g.id === 'w2-maze')!;
const explorerStep = maze.steps[1];
const hero = (blocks: Json) => blocks.blocks.blocks[0].inputs.DO.block.next;
function visit(value: Json, change: (block: Json) => void) {
  if (value.type) change(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(v => { if (v && typeof v === 'object') visit(v, change); });
    else if (child && typeof child === 'object') visit(child, change);
  }
}
function checksPass(guide: typeof maze, step: typeof explorerStep, blocks: Json) {
  const project = { ...guideProject(guide, 'en'), blocks };
  return passing(step.checks, { project, blocks, played: 1, pressed: 63, runtime: step.checks.map(() => true) }).every(Boolean);
}

describe('complete guide build instructions', () => {
  it('explains sprite creation before positioning explorer and shows both connected in on start', () => {
    expect(explorerStep.setup!.some(t => t.en.includes('set mySprite to sprite') && t.en.includes('explorer'))).toBe(true);
    const root = explorerStep.show![0];
    expect(root.type).toBe('ab_on_start');
    expect(root.inputs.DO.block.inputs.VALUE.block.type).toBe('ab_sprite_create');
    expect(root.inputs.DO.block.next.block.type).toBe('ab_sprite_set_position');
  });
  it('cannot approve the position block with the creation block missing, detached or in the wrong order', () => {
    const missing = structuredClone(explorerStep.solution);
    hero(missing).block = hero(missing).block.next.block;
    expect(checksPass(maze, explorerStep, missing)).toBe(false);
    const detached = structuredClone(explorerStep.solution);
    const creation = hero(detached).block;
    hero(detached).block = creation.next.block;
    delete creation.next;
    detached.blocks.blocks.push(creation);
    expect(checksPass(maze, explorerStep, detached)).toBe(false);
    const reversed = structuredClone(explorerStep.solution);
    const first = hero(reversed).block;
    const second = first.next.block;
    delete first.next;
    second.next = { block: first };
    hero(reversed).block = second;
    expect(checksPass(maze, explorerStep, reversed)).toBe(false);
  });
  it('accepts a consistent rename but rejects using an unrelated variable or one variable for different sprites', () => {
    const renamed = structuredClone(explorerStep.solution);
    visit(renamed, b => { if (b.fields?.VAR?.name === 'explorer') b.fields.VAR.name = 'mySprite'; });
    expect(checksPass(maze, explorerStep, renamed)).toBe(true);
    hero(renamed).block.next.block.inputs.SPRITE.block.fields.VAR.name = 'wrongSprite';
    expect(checksPass(maze, explorerStep, renamed)).toBe(false);
    const keyStep = maze.steps[3];
    const reused = structuredClone(keyStep.solution);
    visit(reused, b => { if (b.fields?.VAR?.name === 'key') b.fields.VAR.name = 'explorer'; });
    expect(checksPass(maze, keyStep, reused)).toBe(false);
  });
  it('rejects blocks hidden inside a disabled ancestor or the wrong conditional branch', () => {
    const disabled = structuredClone(explorerStep.solution);
    disabled.blocks.blocks[0].disabledReasons = ['MANUALLY_DISABLED'];
    expect(checksPass(maze, explorerStep, disabled)).toBe(false);
    const guard = GUIDES.find(g => g.id === 'w2-states')!;
    const step = guard.steps[3];
    const misplaced = structuredClone(step.solution);
    const condition = misplaced.blocks.blocks[1].inputs.DO.block;
    condition.inputs.ELSE = condition.inputs.DO0;
    delete condition.inputs.DO0;
    expect(checksPass(guard, step, misplaced)).toBe(false);
  });
  for (const guide of GUIDES) {
    it(`${guide.number}: checks actual Blockly serialization and rejects every missing sprite initializer`, () => {
      const known = new Set<string>();
      visit(guide.start, b => {
        if (b.type === 'variables_set' && b.inputs?.VALUE?.block?.type === 'ab_sprite_create') {
          known.add(JSON.stringify([b.fields.VAR.name, b.inputs.VALUE.block.fields]));
        }
      });
      setAssetProject(guideProject(guide, 'en'));
      for (const step of guide.steps) {
        const ws = new Blockly.Workspace();
        try {
          Blockly.serialization.workspaces.load(step.solution, ws);
          const saved = Blockly.serialization.workspaces.save(ws);
          expect(checksPass(guide, step, saved), `step ${guide.steps.indexOf(step) + 1}`).toBe(true);
        } finally { ws.dispose(); }
        visit(step.solution, b => {
          if (b.type !== 'variables_set' || b.inputs?.VALUE?.block?.type !== 'ab_sprite_create') return;
          const key = JSON.stringify([b.fields.VAR.name, b.inputs.VALUE.block.fields]);
          if (known.has(key)) return;
          known.add(key);
          expect(step.setup!.some(t => t.en.includes(b.fields.VAR.name) && t.en.includes('set mySprite to sprite'))).toBe(true);
          const missing = structuredClone(step.solution);
          visit(missing, candidate => {
            if (candidate.type === 'variables_set' && candidate.fields.VAR.name === b.fields.VAR.name && candidate.inputs?.VALUE?.block?.type === 'ab_sprite_create') {
              candidate.inputs.VALUE.block = { type: 'math_number', fields: { NUM: 0 } };
            }
          });
          expect(matchesSolution(missing, step.solution)).toBe(false);
          expect(checksPass(guide, step, missing)).toBe(false);
        });
      }
    });
  }
  it('shows every changed event, including a function call added alongside a new definition', () => {
    const ttt = GUIDES.find(g => g.id === 'w2-tictactoe')!;
    expect(ttt.steps[9].show!.map(b => b.type)).toContain('ab_on_button');
    const bombs = GUIDES.find(g => g.id === 'w2-bombs')!;
    expect(bombs.steps[8].show!.map(b => b.type)).toContain('ab_on_start');
    const jumper = GUIDES.find(g => g.id === 'w2-jumper')!;
    expect(jumper.steps[16].show!.map(b => b.type)).toContain('ab_on_start');
  });
});
