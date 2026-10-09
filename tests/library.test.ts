import { describe, expect, it } from 'vitest';
import { emptyProgram } from '../src/ir/ir';
import { generateCpp } from '../src/gen/cpp';
import { autoPosition, LIBRARY_IMAGES, LIBRARY_TILE_GROUPS } from '../src/project/library';
import { newProject } from '../src/project/model';

const valid = (rows: string[], w: number, h: number) => rows.length === h && rows.every((r) => r.length === w && /^[.01]+$/.test(r));

describe('asset library', () => {
  it('has well formed sprites and tiles with unique ids and usable names', () => {
    for (const im of LIBRARY_IMAGES) {
      expect(im.frames.every((f) => valid(f, im.width, im.height)), im.id).toBe(true);
      for (const name of Object.values(im.name)) expect(name, im.id).toMatch(/^[\p{L}_][\p{L}\p{N}_ ]*$/u);
    }
    const tiles = LIBRARY_TILE_GROUPS.flatMap((g) => g.tiles);
    for (const tl of tiles) expect(valid(tl.pixels, 8, 8), tl.id).toBe(true);
    expect(new Set(tiles.map((tl) => tl.id)).size).toBe(tiles.length);
    expect(new Set(LIBRARY_IMAGES.map((im) => im.id)).size).toBe(LIBRARY_IMAGES.length);
  });

  it('every set has all 13 edge, corner and middle tiles and a preview that uses them', () => {
    for (const g of LIBRARY_TILE_GROUPS.filter((x) => x.set)) {
      expect(g.tiles.length, g.id).toBeGreaterThanOrEqual(13);
      const used = new Set(g.preview!.flat());
      for (const tl of g.tiles) expect(used.has(tl.id), tl.id).toBe(true);
    }
  });

  it('picks edges, corners and inner corners from a shape', () => {
    const shape = ['###', '###', '##.'];
    const at = (c: number, r: number) => autoPosition((cc, rr) => shape[rr]?.[cc] === '#', c, r);
    expect([at(0, 0), at(1, 0), at(2, 0), at(1, 1), at(2, 1), at(1, 2), at(2, 2)]).toEqual(['tl', 't', 'tr', 'ibr', 'br', 'br', '']);
  });

  it('marks solid tiles up to tile 31', () => {
    const p = newProject('many tiles');
    p.tiles = Array.from({ length: 31 }, (_, i) => ({ id: `t${i}`, name: `t${i}`, pixels: Array(8).fill('11111111'), solid: i === 30 }));
    p.tilemaps = [{ id: 'm', name: 'm', width: 1, height: 1, cells: [31] }];
    expect(generateCpp(emptyProgram(), p).code).toContain('#define TILE_SOLID 0x80000000UL');
  });
});
