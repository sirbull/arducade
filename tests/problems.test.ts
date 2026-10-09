// @vitest-environment jsdom
import * as Blockly from 'blockly/core';
import { describe, expect, it } from 'vitest';
import { setAssetProject } from '../src/blocks/assets';
import { newProject } from '../src/project/model';
import { Engine } from '../src/sim/engine';
import { loadGame } from '../src/sim/load';
import { blk, get, num, set, workspace } from '../src/templates/dsl';
import { buildWorkspace } from '../src/ui/build';
import './helpers';

function build(blocks: unknown) {
  const project = newProject('Test');
  project.images = [{ id: 'i1', name: 'ship', width: 4, height: 4, frames: [['1111', '1111', '1111', '1111']] }];
  project.blocks = blocks;
  setAssetProject(project);
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(blocks as object, ws);
  const ids: Record<string, string> = {};
  for (const b of ws.getAllBlocks(false)) ids[b.type] ??= b.id;
  const result = buildWorkspace(ws, project);
  ws.dispose();
  return { result, ids };
}

describe('problems for beginners', () => {
  it('finds blocks outside events, drawing outside "on draw" and variables without a value', () => {
    const { result, ids } = build(
      workspace([
        blk('ab_on_start', { body: [blk('ab_sprite_set_position', { i: { SPRITE: get('hero'), X: num(1), Y: num(2) } }), blk('ab_draw_pixel', { i: { X: num(1), Y: num(1) } })] }),
        blk('ab_score_set', { i: { VALUE: num(1) } }),
      ]),
    );
    const keys = result.diagnostics.map((d) => `${d.key}@${d.id}`);
    expect(keys).toContain(`diag.orphan@${ids['ab_score_set']}`);
    expect(keys).toContain(`diag.drawOutside@${ids['ab_draw_pixel']}`);
    expect(result.diagnostics.some((d) => d.key === 'diag.varNeverSet' && d.params?.name === 'hero')).toBe(true);
  });

  it('marks a loop that never ends', () => {
    const { result } = build(workspace([blk('ab_on_start', { body: [blk('controls_whileUntil', { f: { MODE: 'WHILE' }, i: { BOOL: blk('logic_boolean', { f: { BOOL: 'TRUE' } }) } })] })]));
    expect(result.diagnostics.some((d) => d.key === 'diag.endlessLoop' && d.level === 'error')).toBe(true);
  });

  it('reports a sprite used before it is created, with the block that did it', async () => {
    const { result, ids } = build(
      workspace([
        blk('ab_on_start', {
          body: [blk('ab_sprite_set_position', { i: { SPRITE: get('hero'), X: num(1), Y: num(2) } }), set('hero', blk('ab_sprite_create', { f: { IMAGE: 'i1', KIND: 'Player' } }))],
        }),
      ]),
    );
    const warnings: string[] = [];
    const engine = new Engine({
      show: () => {},
      tone: () => {},
      storage: { read: () => 0, write: () => {} },
      onWarning: (key, _p, id) => warnings.push(`${key}@${id}`),
      maxSprites: 12,
      hiscoreMagic: 1,
    });
    await engine.begin(loadGame(result.js.code, engine));
    expect(warnings).toContain(`runtime.noSprite@${ids['ab_sprite_set_position']}`);
  });
});
