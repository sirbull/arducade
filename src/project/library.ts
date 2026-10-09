// Ready made sprites and tiles the user can copy into a project.
// Tile sets (edges, corners and inner corners) are drawn by autoTiles from a
// few rules, so they always fit together.

import type { LocalizedText, PixelRows } from './model';

export type LibraryView = 'side' | 'top' | 'any';

export interface LibraryImage {
  id: string;
  group: string;
  view: LibraryView;
  name: LocalizedText;
  width: number;
  height: number;
  frames: PixelRows[];
}

export interface LibraryTile {
  id: string;
  name: LocalizedText;
  pixels: PixelRows;
  solid: boolean;
}

export interface LibraryTileGroup {
  id: string;
  view: LibraryView;
  name: LocalizedText;
  /** True for a set of edges and corners that belong together. */
  set: boolean;
  tiles: LibraryTile[];
  /** Rows of tile ids (or '' for empty) that show how the set is used. */
  preview?: string[][];
}

/** Rows written as one string with spaces between them. */
const px = (s: string): PixelRows => s.trim().split(/\s+/);
const grid = (w: number, h: number, f: (x: number, y: number) => string): PixelRows =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
const mirror = (rows: PixelRows): PixelRows => rows.map((r) => [...r].reverse().join(''));
const flip = (rows: PixelRows): PixelRows => [...rows].reverse();
const turn = (rows: PixelRows): PixelRows => grid(rows.length, rows[0].length, (x, y) => rows[x][y]);
const pattern = (rows: PixelRows) => (x: number, y: number) => rows[((y % 8) + 8) % 8][((x % 8) + 8) % 8];

// Sprites -----------------------------------------------------------------

const coin = [
  px('..1111.. .1....1. 1..11..1 1.1....1 1.1....1 1......1 .1....1. ..1111..'),
  px('...11... ..1..1.. .1.1..1. .1.1..1. .1.1..1. .1....1. ..1..1.. ...11...'),
  px('...11... ...11... ...11... ...11... ...11... ...11... ...11... ...11...'),
  px('...11... ..1..1.. .1..1.1. .1..1.1. .1..1.1. .1....1. ..1..1.. ...11...'),
];

const heroHead = px('..111... ..11111. ..1101.. ..1111..');
const topHead = px('..1111.. .111111. .101101. ..1111..');

function asteroid(size: number): PixelRows {
  const c = (size - 1) / 2;
  const bump = [0, 0.8, 0.3, 1, 0.2, 0.9, 0.4, 0.7];
  const radius = (x: number, y: number) => c * (0.82 + 0.18 * bump[Math.floor(((Math.atan2(y - c, x - c) + Math.PI) / (2 * Math.PI)) * 8) % 8]);
  const inside = (x: number, y: number) => Math.hypot(x - c, y - c) <= radius(x, y);
  const crater = (x: number, y: number) => Math.hypot(x - c * 0.7, y - c * 0.8) < c * 0.25 || Math.hypot(x - c * 1.3, y - c * 1.3) < c * 0.18;
  return grid(size, size, (x, y) => {
    if (!inside(x, y)) return '.';
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (edge) return '1';
    const rim = crater(x, y) && (!crater(x - 1, y) || !crater(x + 1, y) || !crater(x, y - 1) || !crater(x, y + 1));
    return rim ? '1' : '0';
  });
}

function bigTree(): PixelRows {
  const leaf = (x: number, y: number) => Math.hypot(x - 7.5, y - 6) <= 6.5;
  const spots = pattern(px('........ ..1..... .1.1.... ......1. .....1.1 ..1..... .1.1.... ........'));
  return grid(16, 16, (x, y) => {
    if (leaf(x, y)) {
      const edge = !leaf(x - 1, y) || !leaf(x + 1, y) || !leaf(x, y - 1) || !leaf(x, y + 1);
      return edge || spots(x, y) === '1' ? '1' : '0';
    }
    if (y >= 12 && x >= 6 && x <= 9) return x === 6 || x === 9 || y === 15 ? '1' : '0';
    return '.';
  });
}

export const LIBRARY_IMAGES: LibraryImage[] = [
  // Characters
  { id: 'hero-run', group: 'characters', view: 'side', name: { en: 'hero', nb: 'helt' }, width: 8, height: 8, frames: [
    [...heroHead, ...px('.11111.. 1.1111.. ..1..1.. .1....1.')],
    [...heroHead, ...px('.11111.. ..1111.1 ...11... ..11....')],
  ] },
  { id: 'hero-jump', group: 'characters', view: 'side', name: { en: 'hero jump', nb: 'helt hopp' }, width: 8, height: 8, frames: [
    [...heroHead, ...px('1.1111.1 .111111. .1...1.. 1.....1.')],
  ] },
  { id: 'hero-down', group: 'characters', view: 'top', name: { en: 'walker down', nb: 'vandrer ned' }, width: 8, height: 8, frames: [
    [...topHead, ...px('.111111. 1.1111.1 ..1..1.. .11..1..')],
    [...topHead, ...px('.111111. 1.1111.1 ..1..1.. ..1..11.')],
  ] },
  { id: 'hero-up', group: 'characters', view: 'top', name: { en: 'walker up', nb: 'vandrer opp' }, width: 8, height: 8, frames: [
    [...px('..1111.. .111111. .111111. ..1111..'), ...px('.111111. 1.1111.1 ..1..1.. .11..1..')],
    [...px('..1111.. .111111. .111111. ..1111..'), ...px('.111111. 1.1111.1 ..1..1.. ..1..11.')],
  ] },
  { id: 'hero-side', group: 'characters', view: 'top', name: { en: 'walker side', nb: 'vandrer side' }, width: 8, height: 8, frames: [
    px('..1111.. .111111. .11110.. ..1111.. ..1111.. ..1111.. ..1..1.. .1....1.'),
    px('..1111.. .111111. .11110.. ..1111.. ..1111.. ..1111.. ...11... ...11...'),
  ] },
  { id: 'robot', group: 'characters', view: 'any', name: { en: 'robot', nb: 'robot' }, width: 8, height: 8, frames: [
    px('...1.... ..1111.. .101101. .111111. ..1111.. .111111. .1.11.1. .11..11.'),
    px('...11... ..1111.. .101101. .111111. ..1111.. .111111. .1.11.1. .1....1.'),
  ] },

  // Enemies
  { id: 'slime', group: 'enemies', view: 'any', name: { en: 'slime', nb: 'slim' }, width: 8, height: 8, frames: [
    px('........ ........ ..1111.. .111111. 11011011 11111111 11111111 .111111.'),
    px('........ ........ ........ ..1111.. .111111. 11011011 11111111 11111111'),
  ] },
  { id: 'bat', group: 'enemies', view: 'any', name: { en: 'bat', nb: 'flaggermus' }, width: 8, height: 8, frames: [
    px('1......1 11....11 111..111 .110011. ..1111.. ...11... ........ ........'),
    px('........ ........ ...11... .110011. 11111111 1.1111.1 1..11..1 ........'),
  ] },
  { id: 'ghost', group: 'enemies', view: 'any', name: { en: 'ghost', nb: 'spøkelse' }, width: 8, height: 8, frames: [
    px('..1111.. .111111. 11011011 11011011 11111111 11111111 11111111 11.11.11'),
    px('........ ..1111.. .111111. 11011011 11011011 11111111 11111111 1.11.11.'),
  ] },
  { id: 'spider', group: 'enemies', view: 'any', name: { en: 'spider', nb: 'edderkopp' }, width: 8, height: 8, frames: [
    px('........ 1..11..1 .1.11.1. ..1111.. .101101. 1.1111.1 .1....1. 1......1'),
    px('........ .1.11.1. 1..11..1 ..1111.. .101101. .111111. 1.1..1.1 ........'),
  ] },
  { id: 'fish', group: 'enemies', view: 'side', name: { en: 'fish', nb: 'fisk' }, width: 8, height: 8, frames: [
    px('........ ..111..1 .1011111 1111111. .1111111 ..111..1 ........ ........'),
    px('........ ..111.1. .1011111 11111111 .1111111 ..111.1. ........ ........'),
  ] },
  { id: 'invader', group: 'enemies', view: 'any', name: { en: 'invader', nb: 'inntrenger' }, width: 8, height: 8, frames: [
    px('...11... ..1111.. .111111. 11.11.11 11111111 ..1..1.. .1.11.1. 1.1..1.1'),
    px('...11... ..1111.. .111111. 11.11.11 11111111 .1.11.1. 1......1 .1....1.'),
  ] },

  // Space
  { id: 'ship', group: 'space', view: 'top', name: { en: 'ship', nb: 'romskip' }, width: 8, height: 8, frames: [
    px('...11... ...11... ..1111.. ..1001.. .111111. 11111111 11.11.11 1..11..1'),
  ] },
  { id: 'ship-side', group: 'space', view: 'side', name: { en: 'ship side', nb: 'romskip side' }, width: 8, height: 8, frames: [
    px('111..... .111.... .111111. 11110011 11111111 .111111. .111.... 111.....'),
    px('111..... 1111.... .111111. 11110011 11111111 .111111. 1111.... 111.....'),
  ] },
  { id: 'ufo', group: 'space', view: 'any', name: { en: 'ufo', nb: 'ufo' }, width: 8, height: 8, frames: [
    px('........ ...11... ..1001.. .111111. 1.1.1.11 .111111. ........ ........'),
    px('........ ...11... ..1001.. .111111. 11.1.1.1 .111111. ........ ........'),
  ] },
  { id: 'asteroid', group: 'space', view: 'any', name: { en: 'asteroid', nb: 'asteroide' }, width: 8, height: 8, frames: [
    px('..1111.. .1..1.1. 1......1 1.11...1 1......1 1...11.1 .1....1. ..1111..'),
  ] },
  { id: 'asteroid-big', group: 'space', view: 'any', name: { en: 'big asteroid', nb: 'stor asteroide' }, width: 16, height: 16, frames: [asteroid(16)] },
  { id: 'bullet', group: 'space', view: 'any', name: { en: 'bullet', nb: 'kule' }, width: 2, height: 2, frames: [px('11 11')] },
  { id: 'laser', group: 'space', view: 'any', name: { en: 'laser', nb: 'laser' }, width: 1, height: 4, frames: [px('1 1 1 1')] },
  { id: 'bomb', group: 'space', view: 'any', name: { en: 'bomb', nb: 'bombe' }, width: 8, height: 8, frames: [
    px('.....1.. ....1... ..111... .1111... 111.111. 11111.1. .11111.. ..111...'),
    px('....1.1. ....1... ..111... .1111... 111.111. 11111.1. .11111.. ..111...'),
  ] },

  // Items
  { id: 'coin', group: 'items', view: 'any', name: { en: 'coin', nb: 'mynt' }, width: 8, height: 8, frames: coin },
  { id: 'heart', group: 'items', view: 'any', name: { en: 'heart', nb: 'hjerte' }, width: 8, height: 8, frames: [
    px('........ .11.11.. 1111111. 1111111. .11111.. ..111... ...1.... ........'),
    px('........ ........ ..1.1... .11111.. .11111.. ..111... ...1.... ........'),
  ] },
  { id: 'gem', group: 'items', view: 'any', name: { en: 'gem', nb: 'edelstein' }, width: 8, height: 8, frames: [
    px('........ ..1111.. .1.1..1. 11111111 .1....1. ..1..1.. ...11... ........'),
    px('......1. ..11111. .1.1..1. 11111111 .1.1..1. ..1..1.. ...11... ........'),
  ] },
  { id: 'star', group: 'items', view: 'any', name: { en: 'star', nb: 'stjerne' }, width: 8, height: 8, frames: [
    px('...1.... ..111... 1111111. .11111.. ..111... .11.11.. .1...1.. ........'),
    px('........ ...1.... ...1.... .11.11.. ...1.... ...1.... ........ ........'),
  ] },
  { id: 'key', group: 'items', view: 'any', name: { en: 'key', nb: 'nøkkel' }, width: 8, height: 8, frames: [
    px('........ .111.... 1...1... 1...1111 1...1.11 .111.... ........ ........'),
  ] },
  { id: 'potion', group: 'items', view: 'any', name: { en: 'potion', nb: 'trylledrikk' }, width: 8, height: 8, frames: [
    px('...11... ...11... ..1..1.. .1....1. .111111. .110111. .111111. ..1111..'),
  ] },
  { id: 'mushroom', group: 'items', view: 'any', name: { en: 'mushroom', nb: 'sopp' }, width: 8, height: 8, frames: [
    px('..1111.. .1.11.1. 11111111 1.1111.1 .111111. ..1..1.. ..1..1.. ..1111..'),
  ] },
  { id: 'sword', group: 'items', view: 'any', name: { en: 'sword', nb: 'sverd' }, width: 8, height: 8, frames: [
    px('......11 .....111 ....111. .1.111.. ..111... ..11.... .1..1... 1.......'),
  ] },
  { id: 'shield', group: 'items', view: 'any', name: { en: 'shield', nb: 'skjold' }, width: 8, height: 8, frames: [
    px('11111111 1..11..1 1..11..1 11111111 1..11..1 .1.11.1. ..1..1.. ...11...'),
  ] },
  { id: 'chest', group: 'items', view: 'any', name: { en: 'chest', nb: 'kiste' }, width: 8, height: 8, frames: [
    px('........ .111111. 1......1 11111111 1..11..1 1......1 11111111 ........'),
  ] },
  { id: 'chest-open', group: 'items', view: 'any', name: { en: 'chest open', nb: 'kiste åpen' }, width: 8, height: 8, frames: [
    px('.111111. 1......1 1......1 11111111 1.1111.1 1......1 11111111 ........'),
  ] },
  { id: 'flag', group: 'items', view: 'side', name: { en: 'flag', nb: 'flagg' }, width: 8, height: 8, frames: [
    px('1....... 111111.. 1111111. 11111... 1....... 1....... 1....... 1.......'),
    px('1....... 11111... 1111111. 111111.. 1....... 1....... 1....... 1.......'),
  ] },

  // Effects
  { id: 'explosion', group: 'effects', view: 'any', name: { en: 'explosion', nb: 'eksplosjon' }, width: 8, height: 8, frames: [
    px('........ ........ ...11... ..1111.. ..1111.. ...11... ........ ........'),
    px('........ ..1111.. .1....1. .1.11.1. .1.11.1. .1....1. ..1111.. ........'),
    px('1..1..1. .1.1.1.. ..1.1... 111.111. ..1.1... .1.1.1.. 1..1..1. ........'),
    px('1......1 ...1.... .1....1. ........ .....1.. 1.1..... ......1. .1..1..1'),
  ] },
  { id: 'sparkle', group: 'effects', view: 'any', name: { en: 'sparkle', nb: 'gnist' }, width: 8, height: 8, frames: [
    px('........ ........ ........ ...1.... ..111... ...1.... ........ ........'),
    px('........ ...1.... ...1.... .11.11.. ...1.... ...1.... ........ ........'),
    px('.1...1.. ..1.1... ........ ..1.1... .1...1.. ........ ........ ........'),
  ] },
  { id: 'poof', group: 'effects', view: 'any', name: { en: 'poof', nb: 'røyk' }, width: 8, height: 8, frames: [
    px('........ ........ ..11.... .1..11.. .1....1. ..1111.. ........ ........'),
    px('........ .11.11.. 1..1..1. 1......1 .1....1. 1.1..1.1 .1.11.1. ........'),
    px('.1....1. ........ 1......1 ........ ........ 1......1 ........ .1..1...'),
  ] },

  // Shapes
  { id: 'ball', group: 'shapes', view: 'any', name: { en: 'ball', nb: 'ball' }, width: 4, height: 4, frames: [px('.11. 1111 1111 .11.')] },
  { id: 'paddle', group: 'shapes', view: 'any', name: { en: 'paddle', nb: 'racket' }, width: 2, height: 12, frames: [grid(2, 12, () => '1')] },
  { id: 'brick', group: 'shapes', view: 'any', name: { en: 'brick', nb: 'kloss' }, width: 8, height: 4, frames: [px('11111111 1......1 1......1 11111111')] },
  { id: 'cursor', group: 'shapes', view: 'any', name: { en: 'arrow', nb: 'pil' }, width: 8, height: 8, frames: [
    px('1....... 11...... 101..... 1001.... 10001... 101111.. 11...... 1.......'),
  ] },
  { id: 'tree-big', group: 'shapes', view: 'top', name: { en: 'big tree', nb: 'stort tre' }, width: 16, height: 16, frames: [bigTree()] },
];

// Tile sets -----------------------------------------------------------------

type Side = 'n' | 'e' | 's' | 'w';

interface AutoStyle {
  id: string;
  view: LibraryView;
  name: LocalizedText;
  solid: boolean;
  inside: (x: number, y: number) => string;
  /** The ground around the shape. Sets with an outside get one more tile. */
  outside?: (x: number, y: number) => string;
  outsideName?: LocalizedText;
  /** Ragged edge: how far in the edge starts, by side and position along it. */
  rag?: (side: Side, along: number) => number;
  /** Pixel at depth d from the edge (negative is outside), or null to use the fill. */
  edge: (d: number, side: Side, along: number) => string | null;
  /** Cut this many pixels off outer corners. */
  round?: number;
}

const POSITIONS: { id: string; open: Side[]; inner?: [Side, Side]; name: LocalizedText }[] = [
  { id: 'tl', open: ['n', 'w'], name: { en: 'top left', nb: 'øverst venstre' } },
  { id: 't', open: ['n'], name: { en: 'top', nb: 'topp' } },
  { id: 'tr', open: ['n', 'e'], name: { en: 'top right', nb: 'øverst høyre' } },
  { id: 'l', open: ['w'], name: { en: 'left', nb: 'venstre' } },
  { id: 'm', open: [], name: { en: 'middle', nb: 'midten' } },
  { id: 'r', open: ['e'], name: { en: 'right', nb: 'høyre' } },
  { id: 'bl', open: ['s', 'w'], name: { en: 'bottom left', nb: 'nederst venstre' } },
  { id: 'b', open: ['s'], name: { en: 'bottom', nb: 'bunn' } },
  { id: 'br', open: ['s', 'e'], name: { en: 'bottom right', nb: 'nederst høyre' } },
  { id: 'itl', open: [], inner: ['n', 'w'], name: { en: 'inner top left', nb: 'innerhjørne øverst venstre' } },
  { id: 'itr', open: [], inner: ['n', 'e'], name: { en: 'inner top right', nb: 'innerhjørne øverst høyre' } },
  { id: 'ibl', open: [], inner: ['s', 'w'], name: { en: 'inner bottom left', nb: 'innerhjørne nederst venstre' } },
  { id: 'ibr', open: [], inner: ['s', 'e'], name: { en: 'inner bottom right', nb: 'innerhjørne nederst høyre' } },
];

function autoTile(style: AutoStyle, open: Side[], inner?: [Side, Side]): PixelRows {
  const dist = (side: Side, x: number, y: number) => ({ n: y, s: 7 - y, w: x, e: 7 - x })[side];
  const along = (side: Side, x: number, y: number) => (side === 'n' || side === 's' ? x : y);
  return grid(8, 8, (x, y) => {
    let d = Infinity;
    let side: Side = 'n';
    const depth = (s: Side) => dist(s, x, y) - (style.rag?.(s, along(s, x, y)) ?? 0);
    for (const s of open) if (depth(s) < d) [d, side] = [depth(s), s];
    if (inner) {
      const [a, b] = inner;
      [d, side] = depth(a) >= depth(b) ? [depth(a), a] : [depth(b), b];
    }
    if (open.length === 2 && dist(open[0], x, y) + dist(open[1], x, y) < (style.round ?? 0)) d = -1;
    const ch = d === Infinity ? null : style.edge(d, side, along(side, x, y));
    if (ch !== null) return ch;
    return d < 0 ? (style.outside?.(x, y) ?? '.') : style.inside(x, y);
  });
}

function autoSet(style: AutoStyle): LibraryTileGroup {
  const name = (pos: LocalizedText): LocalizedText =>
    Object.fromEntries(Object.keys(style.name).map((lang) => [lang, `${style.name[lang]} ${pos[lang] ?? pos.en}`]));
  const tiles: LibraryTile[] = POSITIONS.map((p) => ({
    id: `${style.id}-${p.id}`,
    name: name(p.name),
    pixels: autoTile(style, p.open, p.inner),
    solid: style.solid,
  }));
  if (style.outside) tiles.push({ id: `${style.id}-o`, name: style.outsideName ?? name({ en: 'outside', nb: 'utenfor' }), pixels: grid(8, 8, style.outside), solid: false });
  const o = style.outside ? `${style.id}-o` : '';
  const shape = style.outside ? SHAPE : SHAPE.slice(1, -1).map((r) => r.slice(1, -1));
  const preview = shape.map((row, r) => [...row].map((_, c) => {
    const pos = autoPosition((cc, rr) => shape[rr]?.[cc] === '#', c, r);
    return pos ? `${style.id}-${pos}` : o;
  }));
  return { id: style.id, view: style.view, name: style.name, set: true, tiles, preview };
}

const SHAPE = ['........', '.####...', '.######.', '.######.', '.###.##.', '.######.', '..#####.', '........'];

/** Which tile of a set fits at col, row of a shape, or '' outside it. */
export function autoPosition(filled: (col: number, row: number) => boolean, c: number, r: number): string {
  if (!filled(c, r)) return '';
  const n = !filled(c, r - 1), s = !filled(c, r + 1), w = !filled(c - 1, r), e = !filled(c + 1, r);
  if (n || s) return `${n ? 't' : 'b'}${w ? 'l' : e ? 'r' : ''}`;
  if (w || e) return w ? 'l' : 'r';
  if (!filled(c - 1, r - 1)) return 'itl';
  if (!filled(c + 1, r - 1)) return 'itr';
  if (!filled(c - 1, r + 1)) return 'ibl';
  if (!filled(c + 1, r + 1)) return 'ibr';
  return 'm';
}

const at = (list: number[]) => (i: number) => list[((i % list.length) + list.length) % list.length];
const wobble = at([0, 1, 1, 0, 0, 0, 1, 0]);
const dirt = pattern(px('........ ..1..... ........ ........ ......1. ........ ........ ........'));
const soil = pattern(px('........ ..1..... ......1. ........ 1....... ....1... ........ .1....1.'));
const grass = pattern(px('.1.1.... ..1..... ......1. .....1.1 1.1..... .1...... ....1.1. .....1..'));
const bricks = pattern(px('11111111 ...1.... ...1.... ...1.... 11111111 .......1 .......1 .......1'));
const rock = pattern(px('........ .11..... 1..1..11 ....11.. ........ ..1..... .1.1.11. ....1..1'));
const waves = pattern(px('........ .11..... 1..1.... ........ ........ .....11. ....1..1 ........'));
const sand = pattern(px('........ ........ ...1.... ........ ........ ........ .......1 ........'));
const leaves = pattern(px('........ ..11.... .1..1... ........ .....11. ....1..1 ........ 1.......'));
const ice = pattern(px('........ ......1. .....1.. ........ ........ ..1..... .1...... ........'));

const AUTO_STYLES: AutoStyle[] = [
  {
    id: 'grassland', view: 'side', solid: true, round: 2,
    name: { en: 'ground', nb: 'bakke' },
    inside: soil,
    rag: (side) => (side === 'n' ? 1 : 0),
    edge: (d, side, a) => {
      if (side !== 'n') return d < 0 ? '.' : d === 0 ? '1' : null;
      if (d === -1) return at([0, 1, 0, 0, 0, 1, 0, 1])(a) ? '1' : '.';
      if (d === 0) return '1';
      if (d === 1) return at([1, 0, 1, 1, 0, 1, 1, 0])(a) ? '1' : '.';
      if (d === 2) return at([0, 0, 1, 0, 0, 0, 0, 1])(a) ? '1' : '.';
      return d < 0 ? '.' : null;
    },
  },
  {
    id: 'snow', view: 'side', solid: true, round: 2,
    name: { en: 'snow', nb: 'snø' },
    inside: ice,
    edge: (d, side, a) => {
      if (d < 0) return '.';
      if (side !== 'n') return d === 0 ? '1' : null;
      if (d <= 1) return '1';
      if (d === 2) return at([1, 1, 0, 1, 1, 1, 0, 0])(a) ? '1' : '.';
      if (d === 3) return at([0, 1, 0, 0, 1, 0, 0, 0])(a) ? '1' : null;
      return null;
    },
  },
  {
    id: 'cave', view: 'side', solid: true, round: 2,
    name: { en: 'rock', nb: 'fjell' },
    inside: rock,
    rag: (_side, a) => wobble(a),
    edge: (d) => (d < 0 ? '.' : d === 0 ? '1' : d === 1 ? '.' : null),
  },
  {
    id: 'brickwall', view: 'any', solid: true,
    name: { en: 'brick', nb: 'mur' },
    inside: bricks,
    edge: (d) => (d < 0 ? '.' : d === 0 ? '1' : null),
  },
  {
    id: 'path', view: 'top', solid: false, round: 2,
    name: { en: 'path', nb: 'sti' },
    inside: dirt,
    outside: grass,
    outsideName: { en: 'grass', nb: 'gress' },
    rag: (_side, a) => wobble(a),
    edge: (d) => (d === -1 || d === 1 ? '.' : d === 0 ? '1' : null),
  },
  {
    id: 'pond', view: 'top', solid: true, round: 2,
    name: { en: 'water', nb: 'vann' },
    inside: waves,
    outside: sand,
    outsideName: { en: 'sand', nb: 'sand' },
    edge: (d, _side, a) => (d === -1 ? '.' : d === 0 ? '1' : d === 1 ? '.' : d === 2 ? (at([1, 1, 0, 0, 1, 1, 1, 0])(a) ? '1' : '.') : null),
  },
  {
    id: 'walls', view: 'top', solid: true,
    name: { en: 'wall', nb: 'vegg' },
    inside: bricks,
    edge: (d) => (d < 0 ? '.' : d <= 1 ? '1' : d === 2 ? '.' : null),
  },
  {
    id: 'forest', view: 'top', solid: true, round: 2,
    name: { en: 'forest', nb: 'skog' },
    inside: leaves,
    rag: (_side, a) => at([1, 0, 0, 1, 1, 0, 0, 1])(a),
    edge: (d) => (d < 0 ? '.' : d === 0 ? '1' : d === 1 ? '.' : null),
  },
];

// Single tiles ----------------------------------------------------------------

const tile = (id: string, en: string, nb: string, solid: boolean, pixels: PixelRows): LibraryTile => ({ id, name: { en, nb }, pixels, solid });

const pipeTop = px('11111111 1....... 1.11.... 1.11.... 11111111 .1.1.... .1.1.... .1.1....');
const pipeBody = px('.1.1.... .1.1.... .1.1.... .1.1.... .1.1.... .1.1.... .1.1.... .1.1....');
const spikes = px('........ ........ ........ .1...1.. .1...1.. 111.111. 111.111. 11111111');
const fenceH = px('........ ........ 11111111 .1...1.. .1...1.. 11111111 ........ ........');
const bridgeH = px('11111111 ..1...1. ..1...1. ..1...1. ..1...1. ..1...1. ..1...1. 11111111');
const cloudL = px('........ ....111. ..11...1 .1...... 1....... 1....... .1111111 ........');
const platformL = px('.1111111 1..1...1 .1111111 ........ ........ ........ ........ ........');

const SINGLE_GROUPS: LibraryTileGroup[] = [
  {
    id: 'platform', view: 'side', set: false, name: { en: 'Platform pieces', nb: 'Plattformdeler' },
    tiles: [
      tile('block', 'block', 'blokk', true, px('11111111 1.....11 1.....11 1.....11 1.....11 1.....11 11111111 11111111')),
      tile('question', 'question block', 'spørreblokk', true, px('11111111 1..11..1 1.1..1.1 1...1..1 1..1...1 1......1 1..1...1 11111111')),
      tile('crate', 'crate', 'kasse', true, px('11111111 11....11 1.1..1.1 1..11..1 1..11..1 1.1..1.1 11....11 11111111')),
      tile('brick', 'brick', 'murstein', true, grid(8, 8, bricks)),
      tile('platform-l', 'platform left', 'plattform venstre', true, platformL),
      tile('platform-m', 'platform middle', 'plattform midten', true, px('11111111 ..1...1. 11111111 ........ ........ ........ ........ ........')),
      tile('platform-r', 'platform right', 'plattform høyre', true, mirror(platformL)),
      tile('ladder', 'ladder', 'stige', false, px('1......1 11111111 1......1 1......1 1......1 11111111 1......1 1......1')),
      tile('spikes', 'spikes', 'pigger', false, spikes),
      tile('spikes-down', 'spikes down', 'pigger ned', false, flip(spikes)),
      tile('pipe-tl', 'pipe top left', 'rør øverst venstre', true, pipeTop),
      tile('pipe-tr', 'pipe top right', 'rør øverst høyre', true, mirror(pipeTop)),
      tile('pipe-l', 'pipe left', 'rør venstre', true, pipeBody),
      tile('pipe-r', 'pipe right', 'rør høyre', true, mirror(pipeBody)),
      tile('water-top', 'water surface', 'vannflate', false, px('........ ...11... ..1..1.. 11....11 ........ ........ .....1.. ........')),
      tile('water', 'water', 'vann', false, px('........ ..11.... ........ ........ ......11 ........ ........ ........')),
      tile('lava-top', 'lava surface', 'lavaflate', false, px('........ ...11... ..1111.. 11111111 1.1.1.1. .1.1.1.1 1.1.1.1. .1.1.1.1')),
      tile('lava', 'lava', 'lava', false, grid(8, 8, (x, y) => ((x + y) % 2 ? '1' : '.'))),
    ],
  },
  {
    id: 'decor', view: 'side', set: false, name: { en: 'Scenery', nb: 'Kulisser' },
    tiles: [
      tile('door-top', 'door top', 'dør topp', false, px('..1111.. .1....1. 1......1 1......1 1......1 1......1 1......1 1......1')),
      tile('door-bottom', 'door bottom', 'dør bunn', false, px('1......1 1......1 1....1.1 1......1 1......1 1......1 1......1 11111111')),
      tile('goal', 'goal flag', 'målflagg', false, px('.11111.. .1111... .111.... .1...... .1...... .1...... .1...... 111.....')),
      tile('torch', 'torch', 'fakkel', false, px('....1... ...1.1.. ...1.1.. ....1... ..11111. ...111.. ....1... ....1...')),
      tile('sign', 'sign', 'skilt', false, px('.111111. 1......1 1.1111.1 1......1 .111111. ...11... ...11... ..1111..')),
      tile('fence', 'fence', 'gjerde', false, px('........ .1....1. 11111111 .1....1. .1....1. 11111111 .1....1. .1....1.')),
      tile('cloud-l', 'cloud left', 'sky venstre', false, cloudL),
      tile('cloud-r', 'cloud right', 'sky høyre', false, mirror(cloudL)),
      tile('tuft', 'grass tuft', 'gresstust', false, px('........ ........ ........ ........ ........ .1...1.. 1.1.1.1. ........')),
    ],
  },
  {
    id: 'topdown', view: 'top', set: false, name: { en: 'Top down objects', nb: 'Ting sett ovenfra' },
    tiles: [
      tile('tree', 'tree', 'tre', true, px('..1111.. .1.1..1. 1..1.1.1 1.1....1 .1...11. ..1111.. ...11... ..1111..')),
      tile('rock', 'rock', 'stein', true, px('........ ..111... .1...11. 1......1 1.1....1 1......1 .111111. ........')),
      tile('bush', 'bush', 'busk', true, px('........ .11.11.. 1..1..1. 1.....11 .1.1...1 1......1 .111111. ........')),
      tile('flowers', 'flowers', 'blomster', false, px('........ .1...... 1.1..1.. .1..1.1. .....1.. ..1..... .1.1.... ..1.....')),
      tile('grass', 'grass', 'gress', false, grid(8, 8, grass)),
      tile('stairs', 'stairs', 'trapp', false, px('11111111 1......1 1.111111 1.1....1 1.1.1111 1.1.1..1 1.1.1.11 11111111')),
      tile('chest', 'chest', 'kiste', true, px('........ .111111. 1......1 11111111 1..11..1 1......1 11111111 ........')),
      tile('floor-grid', 'tiled floor', 'flisgulv', false, px('11111111 1....... 1....... 1....... 1....... 1....... 1....... 1.......')),
      tile('floor-planks', 'planks', 'planker', false, px('11111111 ........ ...1.... ........ 11111111 ........ .......1 ........')),
      tile('fence-h', 'fence across', 'gjerde bortover', true, fenceH),
      tile('fence-v', 'fence down', 'gjerde nedover', true, turn(fenceH)),
      tile('bridge-h', 'bridge across', 'bro bortover', false, bridgeH),
      tile('bridge-v', 'bridge down', 'bro nedover', false, turn(bridgeH)),
    ],
  },
  {
    id: 'pickups', view: 'any', set: false, name: { en: 'Things to collect', nb: 'Ting å samle' },
    tiles: [
      tile('coin', 'coin', 'mynt', false, coin[0]),
      tile('heart', 'heart', 'hjerte', false, LIBRARY_IMAGES.find((i) => i.id === 'heart')!.frames[0]),
      tile('key', 'key', 'nøkkel', false, LIBRARY_IMAGES.find((i) => i.id === 'key')!.frames[0]),
      tile('gem', 'gem', 'edelstein', false, LIBRARY_IMAGES.find((i) => i.id === 'gem')!.frames[0]),
      tile('star', 'star', 'stjerne', false, LIBRARY_IMAGES.find((i) => i.id === 'star')!.frames[0]),
    ],
  },
];

export const LIBRARY_TILE_GROUPS: LibraryTileGroup[] = [...AUTO_STYLES.map(autoSet), ...SINGLE_GROUPS];
