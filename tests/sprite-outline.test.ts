import { expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';

function setup(img = new Uint8Array([2, 1, 1, 0, 1, 1])) {
  const e = new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 2, hiscoreMagic: 0 });
  const s = e.create(img, 0);
  e.setPosition(s, 11, 10);
  const draw = () => (e as unknown as { drawSprites(): void }).drawSprites();
  return { e, s, draw };
}

it('inverts each contour pixel once on mixed backgrounds, preserving the sprite', () => {
  const { e, s, draw } = setup();
  e.fillRect(11, 0, 117, 64, 1);
  e.setOutline(s, 3);
  draw();
  expect(e.getPixel(10, 9)).toBe(1);
  expect(e.getPixel(11, 9)).toBe(0);
  expect(e.getPixel(9, 10)).toBe(1);
  expect(e.getPixel(12, 10)).toBe(0);
  expect(e.getPixel(10, 10)).toBe(1);
  expect(e.getPixel(11, 10)).toBe(1);
  expect(e.getPixel(8, 10)).toBe(0);
});

it.each([0, 1, 2])('supports fixed and disabled outline mode %s', mode => {
  const { e, s, draw } = setup();
  e.buffer.fill(255);
  e.setOutline(s, mode);
  draw();
  expect(e.getPixel(10, 9)).toBe(mode === 1 ? 0 : 1);
  e.buffer.fill(0);
  draw();
  expect(e.getPixel(10, 9)).toBe(mode === 2 ? 1 : 0);
});

it('uses opaque black pixels in masks and follows the current animation frame', () => {
  const { e, s, draw } = setup(new Uint8Array([2, 1, 2, 1, 0, 0, 1, 0, 0, 0, 0, 1]));
  e.setOutline(s, 2);
  draw();
  expect(e.getPixel(10, 10)).toBe(0);
  expect(e.getPixel(9, 10)).toBe(1);
  expect(e.getPixel(12, 10)).toBe(0);
  e.buffer.fill(0);
  e.sprites[s].frame = 1;
  draw();
  expect(e.getPixel(9, 10)).toBe(0);
  expect(e.getPixel(12, 10)).toBe(1);
});

it('clips at screen edges, hides with the sprite, and resets recycled sprites', () => {
  const { e, s, draw } = setup();
  e.setOutline(s, 2);
  e.setPosition(s, 0, 0);
  draw();
  expect(e.getPixel(1, 0)).toBe(1);
  e.buffer.fill(0);
  e.setFlag(s, 16, true);
  draw();
  expect(e.buffer.some(Boolean)).toBe(false);
  e.destroy(s);
  const next = e.create(new Uint8Array([1, 1, 1, 0, 1]), 0);
  expect(e.sprites[next].outline).toBe(0);
});

it.each([2, 3])('draws a %s pixel contour and inverts overlapping neighborhoods only once', width => {
  const { e, s, draw } = setup();
  e.setOutlineWidth(s, width);
  e.setOutline(s, 3);
  draw();
  for (let y = 10 - width; y <= 10 + width; y++) {
    for (let x = 10 - width; x <= 11 + width; x++) expect(e.getPixel(x, y)).toBe(1);
  }
  expect(e.getPixel(10 - width - 1, 10)).toBe(0);
  expect(e.getPixel(10, 10 - width - 1)).toBe(0);
  e.buffer.fill(255);
  draw();
  expect(e.getPixel(10, 10 - width)).toBe(0);
  expect(e.getPixel(10, 10)).toBe(1);
});

it('bounds thickness and resets it on sprite reuse', () => {
  const { e, s } = setup();
  e.setOutlineWidth(s, 99);
  expect(e.sprites[s].outlineWidth).toBe(8);
  e.setOutlineWidth(s, -2);
  expect(e.sprites[s].outlineWidth).toBe(1);
  e.setOutlineWidth(s, 3);
  e.destroy(s);
  const next = e.create(new Uint8Array([1, 1, 1, 0, 1]), 0);
  expect(e.sprites[next].outlineWidth).toBe(1);
});
