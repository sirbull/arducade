import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// The owner draws these in Illustrator. If this fails, someone replaced one:
// ask the owner before changing the test or the file.
const HAND_DRAWN = ['pro-micro-wiring.svg', 'attiny85-components.svg', 'attiny85-schematic.svg'];

it.each(HAND_DRAWN)('public/docs/%s is the hand-drawn Illustrator file', (file) => {
  expect(readFileSync(`public/docs/${file}`, 'utf8')).toContain('Generator: Adobe Illustrator');
});
