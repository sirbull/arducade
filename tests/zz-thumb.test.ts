// @vitest-environment jsdom
import { it } from 'vitest';
import { match3 } from '../src/templates/match3';
import { templateToProject } from '../src/templates';
import { compileProject } from './helpers';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';
import { FRAME_MS } from '../src/engine/enums';
import type { GameHooks } from '../src/gen/js';

const W = 8, H = 5, MEM = 8;
const kindAt = (e: Engine, x: number, y: number) => [0, 1, 2].reduce((k, l) => k | (e.tileAt(x, MEM + l * H + y) ? 1 << l : 0), 0);
function lineAt(b: number[][], x: number, y: number) {
  const k = b[y][x];
  if (k < 1 || k > 6) return 0;
  let best = 0;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    let len = 1;
    for (const s of [-1, 1]) for (let i = 1; b[y + s * i * dy]?.[x + s * i * dx] === k; i++) len++;
    best = Math.max(best, len);
  }
  return best >= 3 ? best : 0;
}
it('plans', async () => {
  const { js } = compileProject(templateToProject(match3));
  const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 16, hiscoreMagic: js.hiscoreKey, seed: 0xace1, noWaits: true });
  engine.millis = () => engine.frameCount * FRAME_MS;
  await engine.begin(new Function('E', '$w', '$div', '$mod', '$lg', js.code)(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks);
  const b = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => kindAt(engine, x, y)));
  console.log(b.map((r) => r.join(' ')).join('\n'));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy, d] of [[1, 0, 'right'], [0, 1, 'down']] as const) {
    if (x + dx >= W || y + dy >= H) continue;
    const c = b.map((r) => [...r]);
    [c[y][x], c[y + dy][x + dx]] = [c[y + dy][x + dx], c[y][x]];
    const len = Math.max(lineAt(c, x, y), lineAt(c, x + dx, y + dy));
    if (len) console.log(`move (${x},${y}) ${d} -> line ${len}`);
  }
});
