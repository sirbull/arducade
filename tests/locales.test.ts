import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('all languages have every text with the same placeholders', () => {
  const out = execFileSync('node', ['scripts/check-locales.mjs'], { encoding: 'utf8' });
  expect(out).toContain('All languages are complete.');
});
