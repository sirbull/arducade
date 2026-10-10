import { expect, it } from 'vitest';
import { buttonMatch, type Names } from '../src/gen/common';

// Buttons: up 0, down 1, left 2, right 3, a 4, b 5.
const fires = (choice: string, button: number, held: number[]) =>
  new Function('button', 'isPressed', `return ${buttonMatch(choice, {} as Names, 'isPressed')};`)(button, (b: number) => held.includes(b));

it('matches the combined on button choices', () => {
  expect(fires('a', 4, [4])).toBe(true);
  expect(fires('a', 5, [5])).toBe(false);
  expect([0, 1, 2, 3, 4, 5].map((b) => fires('any', b, []))).toEqual([true, true, true, true, true, true]);
  expect([0, 1, 2, 3, 4, 5].map((b) => fires('direction', b, []))).toEqual([true, true, true, true, false, false]);
  expect(fires('ab', 4, [4])).toBe(false);
  expect(fires('ab', 4, [4, 5])).toBe(true);
  expect(fires('ab', 5, [4, 5])).toBe(true);
  expect(fires('ab', 0, [4, 5])).toBe(false);
});
