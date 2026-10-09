// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';

it('generates simulator and device calls from the outline dropdown', () => {
  for (const mode of ['0', '1', '2', '3']) {
    const project = newProject('Outline');
    project.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
    project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
      type: 'ab_sprite_set_outline', fields: { OUTLINE: mode }, inputs: { SPRITE: { block: { type: 'ab_sprite_create', fields: { IMAGE: 'dot', KIND: 'Player' } } } },
    } } } }] } };
    const { ir, cpp, js } = compileProject(project);
    expect(ir.diagnostics).toEqual([]);
    expect(cpp.code).toContain('ab::setOutline(');
    expect(js.code).toContain('E.setOutline(');
    expect(cpp.code).toContain(`, ${mode})`);
  }
});

it('generates the thickness block with its value and defaults missing inputs to one', () => {
  for (const width of [undefined, 2, 3]) {
    const project = newProject('Thickness');
    project.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
    project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
      type: 'ab_sprite_set_outline_width', inputs: {
        SPRITE: { block: { type: 'ab_sprite_create', fields: { IMAGE: 'dot', KIND: 'Player' } } },
        ...(width === undefined ? {} : { WIDTH: { block: { type: 'math_number', fields: { NUM: width } } } }),
      },
    } } } }] } };
    const { ir, cpp, js } = compileProject(project);
    expect(ir.diagnostics).toEqual([]);
    expect(cpp.code).toContain('ab::setOutlineWidth(');
    expect(js.code).toContain('E.setOutlineWidth(');
    expect(cpp.code).toContain(`, ${width ?? 1})`);
  }
});
