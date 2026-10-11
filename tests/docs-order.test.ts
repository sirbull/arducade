import { expect, it } from 'vitest';
import './helpers';
import { documentationSections } from '../src/ui/docs';
import { buildToolbox } from '../src/blocks/toolbox';

it('documents every static toolbox entry and variant in editor order', () => {
  const sections = documentationSections(false);
  const categories = (buildToolbox().contents as Record<string, any>[]).filter(cat => !cat.custom);
  for (const category of categories) {
    const id = category.name.replace(/^%\{BKY_AB_CAT_|\}$/g, '');
    const expected = category.contents.filter((entry: Record<string, unknown>) => entry.kind === 'block')
      .map(({ kind, abFavouriteCategory, ...state }: Record<string, unknown>) => state);
    // Legacy explanations may follow, but must not interrupt the menu order.
    expect(sections.find(section => section.id === id)?.blocks?.slice(0, expected.length), id).toEqual(expected);
  }
  const logic = sections.find(section => section.id === 'LOGIC')!;
  expect(logic.blocks?.filter(block => block.type === 'controls_if')).toHaveLength(2);
  expect(sections.some(section => section.id === 'FAVOURITES')).toBe(false);
});

it('uses the editor order for variable and function documentation', () => {
  const sections = documentationSections(false);
  expect(sections.find(section => section.id === 'VARIABLES')?.blocks?.map(block => block.type))
    .toEqual(['variables_set', 'variables_get', 'math_change']);
  expect(sections.find(section => section.id === 'FUNCTIONS')?.blocks?.map(block => block.type))
    .toEqual(['procedures_defnoreturn', 'procedures_callnoreturn', 'procedures_defreturn', 'procedures_callreturn', 'procedures_ifreturn']);
});
