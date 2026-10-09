import { expect, test } from 'vitest';
import { checkProgram } from '../src/ir/check';

test('a chosen variable type is used when nothing else decides it', () => {
  const { info } = checkProgram({ vars: [{ name: 'label', ty: 'str' }, { name: 'n', ty: 'num' }], funcs: [], events: [] });
  expect(info.vars.get('label')).toBe('str');
  expect(info.vars.get('n')).toBe('num');
});
