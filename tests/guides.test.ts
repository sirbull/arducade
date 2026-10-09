import { describe, expect, it } from 'vitest';
import { guideProject, passing, type GuideContext } from '../src/guides/guide';
import { GUIDES } from '../src/guides/world1';
import { compileProject } from './helpers';

const ALL_BUTTONS = 0b111111;

describe('guides', () => {
  for (const g of GUIDES) {
    describe(g.number, () => {
      const project = guideProject(g, 'en');
      const ctx = (blocks: unknown, done: boolean): GuideContext => ({ blocks: blocks as GuideContext['blocks'], project, played: done ? 1 : 0, pressed: done ? ALL_BUTTONS : 0 });

      it('the solution of each step passes its checks, and the step before does not', () => {
        g.steps.forEach((step, i) => {
          expect(passing(step.checks, ctx(step.solution, true)), `step ${i + 1}`).not.toContain(false);
          const before = i === 0 ? g.start : g.steps[i - 1].solution;
          expect(passing(step.checks, ctx(before, false)), `step ${i + 1} before`).toContain(false);
        });
      });

      it('every solution builds without errors', () => {
        for (const step of g.steps) {
          const { ir } = compileProject({ ...project, blocks: step.solution });
          expect(ir.diagnostics.filter((d) => d.level === 'error')).toEqual([]);
        }
      });

      it('has text in every language', () => {
        const texts = [g.title, g.description, ...g.steps.flatMap((s) => [s.text, s.hint, ...s.checks.map((c) => c.text)]), g.bonus?.text].filter(Boolean);
        for (const text of texts) expect(Object.keys(text!).sort()).toEqual(['de', 'en', 'es', 'fr', 'nb']);
      });
    });
  }
});
