// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { match3 } from '../src/templates/match3';
import { templateToProject } from '../src/templates';
import { compileProject } from './helpers';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';
import type { GameHooks } from '../src/gen/js';

// The board lives in hidden tile map layers: 3 bits for the figure, then marks.
const W = 8, H = 5, MEM = 8;
const DOWN = 1, RIGHT = 3, A = 4;
const row = (layer: number, y: number) => MEM + layer * H + y;
const kindAt = (e: Engine, x: number, y: number) => [0, 1, 2].reduce((k, l) => k | (e.tileAt(x, row(l, y)) ? 1 << l : 0), 0);
const marked = (e: Engine, layer: number, x: number, y: number) => e.tileAt(x, row(layer, y)) !== 0;
const setKind = (e: Engine, x: number, y: number, k: number) => [0, 1, 2].forEach((l) => e.setTile(x, row(l, y), (k >> l) & 1 ? l + 1 : 0));
const cells = () => Array.from({ length: W * H }, (_, i) => [i % W, Math.floor(i / W)] as const);
const board = (e: Engine) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => kindAt(e, x, y)));
// A board with no lines and no possible move.
const dead = (x: number, y: number) => ((x + 2 * y) % 4) + 1;
const setBoard = (e: Engine, changes: Record<string, number> = {}) => cells().forEach(([x, y]) => setKind(e, x, y, changes[`${x},${y}`] ?? dead(x, y)));

function lineAt(b: number[][], x: number, y: number) {
  const k = b[y][x];
  if (k < 1 || k > 6) return false;
  return [[1, 0], [0, 1]].some(([dx, dy]) => {
    let len = 1;
    for (const s of [-1, 1]) for (let i = 1; b[y + s * i * dy]?.[x + s * i * dx] === k; i++) len++;
    return len >= 3;
  });
}

async function start() {
  const { js } = compileProject(templateToProject(match3));
  const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 12, hiscoreMagic: js.hiscoreKey });
  const hooks = new Function('E', '$w', '$div', '$mod', '$lg', js.code)(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks;
  let begun = false;
  void engine.begin(hooks).then(() => (begun = true));
  // Press A to leave the splash screen.
  for (let i = 0; i < 50 && !begun; i++) {
    engine.input = i % 4 < 2 ? 1 << A : 0;
    await vi.advanceTimersByTimeAsync(20);
  }
  expect(begun).toBe(true);
  const press = async (...buttons: number[]) => { for (const b of buttons) await hooks.button(b, 1); };
  const update = async (frames: number) => { for (let i = 0; i < frames; i++) await hooks.update(); };
  // Picks the figure under the cursor, swaps it and lets the slide finish.
  const swapTo = async (dir: number) => { await press(A, dir); await update(5); };
  return { engine, hooks, press, update, swapTo };
}

describe('Match three', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  it('starts with a full board without lines that has a move', async () => {
    const { engine } = await start();
    const b = board(engine);
    expect(b.flat().every((k) => k >= 1 && k <= 5)).toBe(true);
    expect(cells().some(([x, y]) => lineAt(b, x, y))).toBe(false);
  });

  it('slides the two figures into each other\'s place', async () => {
    const { engine, hooks, press, update } = await start();
    setBoard(engine);
    // The drop at (3,2) moves 2 pixels down each frame: its tip (58,22) leaves, its left side reaches (55,30).
    const drawn = async () => { engine.clear(); await hooks.draw(); return [engine.getPixel(58, 22), engine.getPixel(55, 30)]; };
    expect(await drawn()).toEqual([1, 0]);
    await press(A, DOWN);
    await update(2);
    expect(await drawn()).toEqual([0, 1]);
    // No line: it slides back home and the board is unchanged.
    await update(10);
    expect(await drawn()).toEqual([1, 0]);
    expect(board(engine).flat()).toEqual(cells().map(([x, y]) => dead(x, y)));
  });

  it('turns four in a line into a bomb where the player moved', async () => {
    const { engine, swapTo, update } = await start();
    // Cursor starts at (3,2). Moving the 5 at (3,3) up makes 5 5 5 5 in row 2.
    setBoard(engine, { '1,2': 5, '2,2': 5, '4,2': 5, '3,3': 5 });
    await swapTo(DOWN);
    expect([1, 2, 3, 4].every((x) => marked(engine, 3, x, 2))).toBe(true);
    expect(marked(engine, 4, 3, 2)).toBe(true);
    await update(12);
    expect([kindAt(engine, 1, 2), kindAt(engine, 2, 2), kindAt(engine, 3, 2), kindAt(engine, 4, 2)]).toEqual([0, 0, 6, 0]);
  });

  it('turns five in a line into a prism', async () => {
    const { engine, swapTo, update } = await start();
    setBoard(engine, { '1,2': 5, '2,2': 5, '4,2': 5, '5,2': 5, '3,3': 5 });
    await swapTo(DOWN);
    await update(12);
    expect(kindAt(engine, 3, 2)).toBe(7);
  });

  it('clears every figure of a kind when a prism is swapped with it', async () => {
    const { engine, swapTo } = await start();
    setBoard(engine, { '3,2': 7 });
    await swapTo(RIGHT);
    const target = dead(4, 2);
    for (const [x, y] of cells()) expect(marked(engine, 3, x, y), `${x},${y}`).toBe(dead(x, y) === target || (x === 3 && y === 2));
  });

  it('blows up everything within two squares of three bombs', async () => {
    const { engine, swapTo } = await start();
    setBoard(engine, { '2,2': 6, '4,2': 6, '3,3': 6 });
    await swapTo(DOWN);
    for (const [x, y] of cells()) expect(marked(engine, 3, x, y), `${x},${y}`).toBe(x <= 6);
  });

  it.each([[true, {}], [false, { '1,2': 5, '2,2': 5, '4,2': 5, '3,3': 5 }]] as const)('ends the game only when no move is left (%s)', async (over, next) => {
    const { engine, swapTo, update } = await start();
    setBoard(engine, { '1,2': 5, '2,2': 5, '4,2': 5, '3,3': 5 });
    await swapTo(DOWN);
    // The line is cleared and the board starts to fall: swap in a full board instead.
    await update(12);
    setBoard(engine, next);
    await update(2);
    expect(engine.gameOverPending).toBe(over);
  });

  it('refills the board after a move and keeps playing', async () => {
    const { engine, swapTo, update } = await start();
    setBoard(engine, { '1,2': 5, '2,2': 5, '4,2': 5, '3,3': 5 });
    await swapTo(DOWN);
    await update(200);
    const b = board(engine);
    expect(b.flat().every((k) => k >= 1 && k <= 7)).toBe(true);
    expect(cells().some(([x, y]) => lineAt(b, x, y))).toBe(false);
  });
});
