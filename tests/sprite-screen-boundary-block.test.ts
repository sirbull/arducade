// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';

it('keeps a sprite on screen with the dedicated boundary block', () => {
  const project = newProject('Screen boundary');
  project.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'ab_sprite_stay_in_screen',
    inputs: { SPRITE: { block: { type: 'ab_sprite_create', fields: { IMAGE: 'dot', KIND: 'Player' } } } },
  } } } }] } };

  const { ir, cpp, js } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.code).toContain('ab::setFlag(');
  expect(js.code).toContain('E.setFlag(');
  expect(cpp.code).toContain(', 1, true)');
});
