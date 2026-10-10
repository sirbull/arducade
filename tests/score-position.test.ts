// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';

it('moves the score display with the show score at block', () => {
  const project = newProject('Score position');
  const n = (v: number) => ({ block: { type: 'math_number', fields: { NUM: v } } });
  project.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'ab_score_position', inputs: { X: n(10), Y: n(20) },
  } } } }] } };
  const { ir, cpp, js } = compileProject(project);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.code).toContain('ab::setScorePosition(10, 20)');
  expect(cpp.code).toContain('#define AB_SCORE_POS 1');
  expect(js.code).toContain('E.setScorePosition(10, 20)');
});
