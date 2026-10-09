import { describe, expect, it } from 'vitest';
import './helpers';
import { GUIDES, level12 } from '../src/guides/world1';
import { guideProject, passing } from '../src/guides/guide';
import { runChecks } from '../src/guides/runtime';

type Json = Record<string, any>;
function edit(value: Json, type: string, change: (block: Json) => void) {
  if (value.type === type) change(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      if (Array.isArray(child)) child.forEach((v) => edit(v, type, change));
      else edit(child, type, change);
    }
  }
}
async function results(id: string, type: string, mutate: (block: Json) => void) {
  const guide = GUIDES.find((g) => g.id === id)!;
  const step = guide.steps.at(-1)!;
  const project = guideProject(guide, 'en');
  project.blocks = structuredClone(step.solution);
  edit(project.blocks as Json, type, mutate);
  const runtime = await runChecks(step.checks, project);
  return passing(step.checks, { blocks: project.blocks as Json, project, played: 1, pressed: 63, runtime });
}

describe('guide gameplay validation', () => {
  it('rejects a disconnected controller despite matching block structure', async () => {
    expect(await results(level12.id, 'ab_move_sprite', (b) => {
      b.inputs.SPRITE.block.fields.VAR = { name: 'wrongSprite' };
    })).toContain(false);
  });
  it('rejects destroying the hero instead of the coin', async () => {
    expect(await results('w1-coins', 'ab_sprite_destroy', (b) => {
      b.inputs.SPRITE.block.fields.VAR = { name: 'sprite' };
    })).toContain(false);
  });
  it('rejects a counter that changes the wrong variable', async () => {
    expect(await results('w1-castle', 'math_change', (b) => {
      b.fields.VAR = { name: 'wrongTimer' };
    })).toContain(false);
  });
  it('rejects winning after the first coin', async () => {
    expect(await results('w1-castle', 'logic_compare', (b) => {
      if (b.fields.OP === 'GTE') b.inputs.B.block.fields.NUM = 1;
    })).toContain(false);
  });
  it('stops safely when code waits for a splash screen', async () => {
    const guide = GUIDES.find(g => g.id === 'w1-coins')!;
    const project = guideProject(guide,'en');
    project.blocks = { blocks: { blocks: [{ type:'ab_on_start', inputs:{ DO:{block:{type:'ab_splash',fields:{TEXT:'Wait'}}}}}] } };
    expect(await runChecks(guide.steps.at(-1)!.checks,project)).toContain(false);
  });
});
