import { afterEach, expect, it, vi } from 'vitest';
import { Engine } from '../src/sim/engine';
import { Runner } from '../src/sim/runner';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('freezes game time and pending delays until resumed', async () => {
  vi.useFakeTimers({ toFake: ['performance', 'setTimeout'] });
  const engine = new Engine({ show: vi.fn(), tone: vi.fn(), storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 16, hiscoreMagic: 0 });
  let finished = false;
  const delay = engine.pause(100).then(() => { finished = true; });
  await vi.advanceTimersByTimeAsync(40);
  engine.setPaused(true);
  const time = engine.millis();
  await vi.advanceTimersByTimeAsync(500);
  expect(engine.millis()).toBe(time);
  expect(finished).toBe(false);
  expect(await engine.frame()).toBe(false);
  engine.setPaused(false);
  await vi.advanceTimersByTimeAsync(60);
  await delay;
  expect(finished).toBe(true);
  expect(engine.millis()).toBe(100);
});

it('keeps a button highlighted while another key or touch still holds it', () => {
  const input = vi.fn();
  const canvas = { getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }), fillRect: vi.fn(), putImageData: vi.fn() }) } as unknown as HTMLCanvasElement;
  vi.stubGlobal('AudioContext', class { state = 'running'; });
  const runner = new Runner(canvas, { onError: vi.fn(), onSkippedCpp: vi.fn(), onInput: input });
  const key = (code: string) => ({ code }) as KeyboardEvent;
  runner.keyDown(key('ArrowUp'));
  runner.keyDown(key('KeyW'));
  runner.keyUp(key('ArrowUp'));
  expect(input).toHaveBeenLastCalledWith(1);
  runner.setTouch('up', true);
  runner.keyUp(key('KeyW'));
  expect(input).toHaveBeenLastCalledWith(1);
  runner.setTouch('up', false);
  expect(input).toHaveBeenLastCalledWith(0);
  runner.keyDown(key('KeyZ'));
  runner.releaseAll();
  expect(input).toHaveBeenLastCalledWith(0);
});

it('delivers rapid taps and releases in order, even between frames', async () => {
  const button = vi.fn();
  const engine = new Engine({ show: vi.fn(), tone: vi.fn(), storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 16, hiscoreMagic: 0 });
  await engine.begin({ init: () => {}, lifeZero: async () => false, hasOverlap: false, hasTile: false, start: async () => {}, button, update: async () => {}, draw: async () => {}, overlap: async () => {}, tile: async () => {} });
  engine.input = 16;
  engine.input = 0;
  engine.input = 16;
  engine.input = 0;
  for (let i = 0; i < 4; i++) await engine.frame(true);
  expect(button.mock.calls).toEqual([[4, 1], [4, 0], [4, 1], [4, 0]]);
  await engine.frame(true);
  expect(button).toHaveBeenCalledTimes(4);
  engine.input = 16;
  engine.releaseInput();
  await engine.frame(true);
  expect(button).toHaveBeenCalledTimes(4);
});


it('cycles display colors immediately and preserves game pixels', () => {
  const putImageData = vi.fn();
  const canvas = { getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }), putImageData }) } as unknown as HTMLCanvasElement;
  const runner = new Runner(canvas, { onError: vi.fn(), onSkippedCpp: vi.fn() });
  const pixels = () => putImageData.mock.calls.at(-1)![0].data as Uint8ClampedArray;
  expect(pixels().some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
  expect(runner.cyclePixelColor()).toBe('blue');
  expect(pixels().some((v, i) => i % 4 === 0 && v === 90)).toBe(true);
  const buffer = new Uint8Array(1024); buffer[0] = 1;
  // Exercise the same presentation callback used by Engine.
  const display = runner as unknown as { show(buffer: Uint8Array, inverted: boolean): void };
  display.show(buffer, false);
  expect(runner.cyclePixelColor()).toBe('yellow');
  expect([...pixels().slice(0, 8)]).toEqual([255, 214, 70, 255, 0, 0, 0, 255]);
  expect(buffer[0]).toBe(1); expect(buffer.slice(1).every(v => v === 0)).toBe(true);
  expect(runner.cyclePixelColor()).toBe('white');
  display.show(new Uint8Array(1024).fill(255), true);
  expect(pixels().every((v, i) => v === (i % 4 === 3 ? 255 : 0))).toBe(true);
  display.show(new Uint8Array(1024), false);
  runner.cyclePixelColor();
  expect(pixels().every((v, i) => v === (i % 4 === 3 ? 255 : 0))).toBe(true);
  runner.clearScreen();
  expect(pixels().some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
  runner.running = true;
  runner.clearScreen();
  expect(pixels().every((v, i) => v === (i % 4 === 3 ? 255 : 0))).toBe(true);
});
