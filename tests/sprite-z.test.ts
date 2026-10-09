// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { newProject } from '../src/project/model';
import { Engine } from '../src/sim/engine';
import { compileProject } from './helpers';

it('generates simulator and device calls for the layer block', () => {
  const project = newProject('Layer');
  project.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'ab_sprite_set_z', inputs: {
      SPRITE: { block: { type: 'ab_sprite_create', fields: { IMAGE: 'dot', KIND: 'Player' } } },
      Z: { block: { type: 'math_number', fields: { NUM: 3 } } },
    },
  } } } }] } };
  const { ir, cpp, js } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.code).toContain('ab::setZ(');
  expect(js.code).toContain('E.setZ(');
  expect(cpp.code).toContain(', 3)');
});

it('draws a sprite on a higher layer on top of one created later', () => {
  const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 4, hiscoreMagic: 0 });
  // 1x1 images: white, then opaque black, both in the middle of the screen.
  const white = engine.create(new Uint8Array([1, 1, 1, 0, 1]), 0);
  engine.create(new Uint8Array([1, 1, 1, 1, 0, 1]), 0);
  const draw = () => {
    engine.clear();
    (engine as unknown as { drawSprites(): void }).drawSprites();
    return engine.getPixel(64, 32);
  };
  expect(draw()).toBe(0);
  engine.setZ(white, 1);
  expect(draw()).toBe(1);
});
