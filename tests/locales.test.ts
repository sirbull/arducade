import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { DEFS } from '../src/blocks/defs';
import { buildToolbox } from '../src/blocks/toolbox';

it('all languages have every text with the same placeholders', () => {
  const out = execFileSync('node', ['scripts/check-locales.mjs'], { encoding: 'utf8' });
  expect(out).toContain('All languages are complete.');
});

it('every custom block and toolbox block has an explanation in every language', () => {
  const types = new Set(DEFS.map(def => def.type));
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') types.add(node.type);
    Object.values(node).forEach(visit);
  };
  visit(buildToolbox());
  ['variables_set', 'variables_get', 'math_change', 'procedures_defnoreturn', 'procedures_defreturn'].forEach(type => types.add(type));
  const dir = new URL('../public/locales/', import.meta.url);
  for (const file of readdirSync(dir).filter(file => file.endsWith('.json'))) {
    const { ui } = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    for (const type of types) {
      const key = `docs.more.${type}`;
      expect(ui[key], `${file}: ${key}`).toBeTypeOf('string');
      expect(ui[key].trim().length, `${file}: ${key}`).toBeGreaterThan(20);
    }
  }
});
