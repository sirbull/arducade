import { expect, it } from 'vitest';
import { searchDocs, docsSearchExcerpt, DOCS_KEYWORDS, type DocsSearchEntry } from '../src/ui/docs-search';

const entries: DocsSearchEntry[] = [
  { sectionId: 'start', title: 'Getting started', sectionTitle: 'Guide', text: 'Detect a collision in your game.', keywords: '' },
  { sectionId: 'SPRITES', blockType: 'ab_on_overlap', title: 'On overlap', sectionTitle: 'Sprites', text: 'Runs when sprites touch.', keywords: DOCS_KEYWORDS.ab_on_overlap },
  { sectionId: 'collision', title: 'Collision events', sectionTitle: 'Events', text: 'Sprites touch.', keywords: '' },
];

it('searches full text and ranks titles before keywords before body matches', () => {
  expect(searchDocs(entries, 'collision').map(e => e.sectionId)).toEqual(['collision', 'SPRITES', 'start']);
});
it('finds blocks through Norwegian aliases absent from their visible text', () => {
  expect(searchDocs(entries, 'KOLLISJON')).toEqual([entries[1]]);
});
it('requires every query word while allowing each to match a different field', () => {
  expect(searchDocs(entries, 'kollisjon sprites')).toEqual([entries[1]]);
  expect(searchDocs(entries, 'kollisjon missing')).toEqual([]);
});
it('ignores whitespace, case and diacritics, and keeps stable ties', () => {
  const texts = ['Feilsøking', 'FEILSOKING', 'Féilsoking'].map(title => ({ ...entries[0], title }));
  expect(searchDocs(texts, '  feilsøking  ')).toEqual(texts);
  expect(searchDocs(entries, '  ')).toEqual([]);
});
it('handles punctuation as literal text', () => {
  expect(searchDocs(entries, '[')).toEqual([]);
  expect(docsSearchExcerpt('Example [input] value', '[input]')).toBe('Example [input] value');
});
it('shows an excerpt around matches deep in a guide', () => {
  const text = 'Intro '.repeat(100) + 'collision example ' + 'Later '.repeat(100);
  const excerpt = docsSearchExcerpt(text, 'collision');
  expect(excerpt).toContain('collision example');
  expect(excerpt.startsWith('…')).toBe(true);
  expect(excerpt.length).toBeLessThanOrEqual(242);
});
