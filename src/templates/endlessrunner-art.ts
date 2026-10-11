import titleArtwork from './endlessrunner-title.json';
import type { ImageAsset } from '../project/model';

// Native 1-bit artwork: every pixel remains editable in ArduCade's asset tabs.
class Pixels {
  private data: string[][];
  constructor(readonly width: number, readonly height: number, fill = '.') {
    this.data = Array.from({ length: height }, () => Array(width).fill(fill));
  }
  dot(x: number, y: number, color = '1') {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.data[y][x] = color;
  }
  rect(x: number, y: number, w: number, h: number, color = '1') {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.dot(xx, yy, color);
  }
  line(x0: number, y0: number, x1: number, y1: number, color = '1') {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) this.dot(Math.round(x0 + (x1 - x0) * i / (steps || 1)), Math.round(y0 + (y1 - y0) * i / (steps || 1)), color);
  }
  rows() { return this.data.map(row => row.join('')); }
}
const asset = (id: string, p: Pixels): ImageAsset => ({ id, name: id, width: p.width, height: p.height, frames: [p.rows()] });

const runHead = ['...111111...', '..10000001..', '..10111111..', '..10000001..', '...111111...', '..1101100...', '.110111111..', '.1011100011.', '..01111101..', '...110111...'];
const runLegs = [
  ['...111011...', '..1100011...', '.110....11..', '.10......10.', '110......11.', '111.....111.'],
  ['...111011...', '....11101...', '...111.11...', '..110..11...', '..10...10...', '.111..111...'],
  ['...111011...', '...11.11....', '...11..11...', '...10...11..', '..110....10.', '..111....111'],
  ['...111011...', '...11011....', '...11.11....', '...11.10....', '..110.110...', '..111.111...'],
];
const runner: ImageAsset = { id: 'runner', name: 'runner', width: 12, height: 16, frames: runLegs.map(legs => [...runHead, ...legs]) };
const jump: ImageAsset = { id: 'jump', name: 'jump', width: 12, height: 16, frames: [[...runHead, '...111111...', '..110..11...', '..111..11...', '....1..111..', '....1.......', '............']] };
const slide: ImageAsset = { id: 'slide', name: 'slide', width: 18, height: 8, frames: [[
  '.........111111...', '........10000001..', '...1111110111111..', '..10011011000001..', '.11011111111111...', '11000110111001....', '11111111100111111.', '....11111111111111',
]] };

function crate() {
  const p = new Pixels(14, 12); p.rect(0, 0, 14, 12); p.rect(1, 1, 12, 10, '0');
  p.rect(2, 2, 10, 2); p.rect(3, 5, 8, 5); p.rect(5, 6, 4, 3, '0');
  p.dot(1, 10); p.dot(12, 10); p.line(0, 0, 3, 3, '0'); p.line(10, 0, 13, 3, '0'); return asset('cargo', p);
}
function reactor() {
  const p = new Pixels(18, 14); p.rect(2, 0, 14, 14, '0'); p.rect(1, 1, 16, 12); p.rect(2, 2, 14, 10, '0');
  p.rect(0, 4, 3, 6); p.rect(15, 4, 3, 6); p.rect(5, 3, 8, 7); p.rect(6, 4, 6, 5, '0');
  p.rect(8, 4, 2, 5); p.line(5, 11, 12, 11); p.dot(3, 3); p.dot(14, 10); p.line(3, 13, 14, 13); return asset('reactor', p);
}
function spikes() {
  const p = new Pixels(20, 10); p.rect(0, 8, 20, 2); p.rect(0, 9, 20, 1, '0');
  for (const x of [3, 10, 17]) for (let y = 0; y < 8; y++) {
    const half = Math.floor(y / 3); p.rect(x - half, y, half * 2 + 1, 1); if (half) p.dot(x, y, '0');
  }
  p.rect(0, 7, 20, 1, '0'); p.dot(1, 8, '0'); p.dot(18, 8, '0'); return asset('plasmaSpikes', p);
}
function drone() {
  const p = new Pixels(22, 12); p.rect(0, 1, 7, 2); p.rect(15, 1, 7, 2); p.rect(3, 3, 16, 6, '0');
  p.line(2, 3, 7, 6); p.line(19, 3, 14, 6); p.rect(7, 3, 8, 7); p.rect(8, 4, 6, 5, '0');
  p.rect(9, 5, 4, 2); p.rect(3, 5, 3, 3); p.rect(16, 5, 3, 3); p.rect(9, 10, 4, 2);
  p.dot(1, 1, '0'); p.dot(20, 1, '0'); return asset('securityDrone', p);
}
function laser() {
  const p = new Pixels(14, 18); p.rect(0, 0, 14, 6); p.rect(1, 1, 12, 4, '0'); p.rect(3, 2, 8, 2);
  p.rect(2, 6, 10, 1); p.rect(3, 7, 8, 11, '0');
  for (let y = 7; y < 18; y++) { p.dot(3, y); p.dot(10, y); if (y % 2 === 0) p.rect(5, y, 4, 1); }
  p.line(2, 17, 11, 17); return asset('laserGate', p);
}
function sky() {
  const p = new Pixels(128, 64);
  // Scattered points and small cross stars, without repeating diagonal streaks.
  const stars = [[4, 13], [17, 23], [28, 11], [41, 19], [56, 12], [69, 26], [83, 14], [117, 12], [124, 24], [8, 32], [23, 37], [34, 29], [51, 24], [62, 36], [77, 7], [87, 31], [113, 35], [122, 3], [12, 5], [45, 4], [60, 2], [97, 3]];
  for (const [x, y] of stars) p.dot(x, y);
  for (const [x, y] of [[21, 16], [64, 19], [116, 27]]) {
    p.dot(x, y); p.dot(x - 1, y); p.dot(x + 1, y); p.dot(x, y - 1); p.dot(x, y + 1);
  }
  // A true circle, with a crescent shadow and surface texture.
  for (let y = 0; y < 19; y++) for (let x = 0; x < 19; x++) if ((x - 9) ** 2 + (y - 9) ** 2 <= 81) {
    p.dot(91 + x, 8 + y, (x - 5) ** 2 + (y - 7) ** 2 < 45 ? '0' : '1');
  }
  p.dot(106, 17, '0'); p.dot(104, 23, '0'); return asset('starfield', p);
}
function mountains() {
  const p = new Pixels(128, 64);
  const ridge = [[0, 44], [12, 35], [22, 41], [39, 25], [57, 42], [73, 33], [88, 45], [108, 29], [127, 44]];
  for (let i = 0; i < ridge.length - 1; i++) {
    const [x0, y0] = ridge[i], [x1, y1] = ridge[i + 1];
    for (let x = x0; x <= x1; x++) {
      const top = Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
      p.rect(x, top, 1, 56 - top, '0'); p.dot(x, top);
      if (x % 3 === 0) p.dot(x, top + 3);
      if (x % 7 === 0) p.dot(x, top + 7);
    }
  }
  p.line(39, 26, 31, 45); p.line(108, 30, 97, 50); p.line(73, 34, 64, 47);
  return asset('colonyMountains', p);
}
function city() {
  const p = new Pixels(128, 64);
  for (const [x, w, top] of [[4, 13, 41], [25, 11, 34], [46, 16, 39], [72, 10, 32], [94, 17, 40], [120, 6, 37]]) {
    p.rect(x, top, w, 56 - top, '0'); p.line(x, top, x + w - 1, top); p.line(x, top, x, 55); p.line(x + w - 1, top, x + w - 1, 55);
    p.line(x + 3, top - 4, x + 3, top); p.dot(x + 3, top - 5);
    for (let y = top + 3; y < 54; y += 5) for (let xx = x + 3; xx < x + w - 2; xx += 4) p.rect(xx, y, 2, 1);
  }
  p.line(0, 53, 127, 53); p.line(0, 55, 127, 55);
  for (let x = 0; x < 128; x += 8) p.line(x, 53, x + 2, 55);
  return asset('colonySkyline', p);
}
function splash() {
  // PixelLab PixFlux, generated natively at 128 × 64 with a forced 1-bit palette.
  // Source PNG and generation provenance: assets/templates/void-runner/.
  // The empty bottom rows leave room for the localized start prompt.
  return {
    id: 'titleScreen', name: 'titleScreen', width: 128, height: 64,
    frames: [titleArtwork.map(row => [...row].map(hex => parseInt(hex, 16).toString(2).padStart(4, '0')).join(''))],
  } satisfies ImageAsset;
}

export const runnerImages = [runner, jump, slide, crate(), reactor(), spikes(), drone(), laser(), splash()];
export const runnerBackgrounds = [sky(), mountains(), city()];
export const runnerDeck = [
  { id: 'deckA', name: 'deck panel', solid: true, pixels: ['11111111', '00000000', '11000011', '10011001', '10011001', '11000011', '00000000', '11111111'] },
  { id: 'deckB', name: 'deck grille', solid: true, pixels: ['11111111', '00000000', '01010101', '01010101', '01010101', '01010101', '00000000', '11111111'] },
];
