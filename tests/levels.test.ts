import { describe, expect, it } from 'vitest';
import { emptyProgram } from '../src/ir/ir';
import { newProject, parseProject, serializeProject, type TilemapAsset } from '../src/project/model';
import { generateJs, type GameHooks } from '../src/gen/js';
import { generateCpp } from '../src/gen/cpp';
import { validLevelLinks } from '../src/gen/levels';
import { Engine } from '../src/sim/engine';
import { div16, mod16 } from '../src/sim/intmath';

export function linkedProject() {
  const project = newProject('Linked levels');
  const map = (id: string): TilemapAsset => ({ id, name: id, width: 16, height: 8, cells: Array(128).fill(0) });
  const first = map('first'), second = map('second');
  first.links = [{ id: 'a', col: 2, row: 2, target: second.id, spawnCol: 1, spawnRow: 1 }];
  second.links = [{ id: 'b', col: 1, row: 1, target: first.id, spawnCol: 3, spawnRow: 3 }];
  project.tilemaps = [first, second];
  project.startLevelId = first.id;
  return project;
}

describe('linked levels', () => {
  it('loads the start map, moves the player, preserves score, and avoids reciprocal bouncing', async () => {
    const project = linkedProject();
    const js = generateJs(emptyProgram(), project);
    const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 16, hiscoreMagic: js.hiscoreKey });
    const factory = new Function('E', '$w', '$div', '$mod', '$lg', js.code) as (...args: unknown[]) => GameHooks;
    const hooks = factory(engine, (n: number) => (n << 16) >> 16, div16, mod16, engine.loopGuard);
    await engine.begin(hooks);
    const firstMap = engine.map;
    const player = engine.create(null, 0);
    engine.setScore(123);
    engine.setPosition(player, 20, 20);
    await hooks.update();
    expect(engine.map).not.toBe(firstMap);
    expect(engine.getProp(player, 0)).toBe(12);
    expect(engine.getProp(player, 1)).toBe(12);
    expect(engine.score).toBe(123);
    const secondMap = engine.map;
    await hooks.update();
    expect(engine.map).toBe(secondMap);
    engine.setPosition(player, 28, 12);
    await hooks.update();
    engine.setPosition(player, 12, 12);
    await hooks.update();
    expect(engine.map).toBe(firstMap);
    expect(engine.getProp(player, 0)).toBe(28);
    engine.stop();
  });

  it('ignores missing destinations and out-of-bounds exits', () => {
    const project = linkedProject();
    project.tilemaps[0].links![0].target = 'deleted';
    project.tilemaps[1].links![0].spawnCol = 99;
    expect(validLevelLinks(project)).toEqual([]);
    expect(generateJs(emptyProgram(), project).code).not.toContain('updateLevelPortals');
  });

  it('persists connections and generates device transitions', () => {
    const project = linkedProject();
    const parsed = parseProject(serializeProject(project));
    expect(parsed.tilemaps).toEqual(project.tilemaps);
    expect(parsed.startLevelId).toBe(project.startLevelId);
    const cpp = generateCpp(emptyProgram(), parsed);
    expect(cpp.diagnostics).toEqual([]);
    expect(cpp.code).toContain('ab::setMap(map_second, tileImages, TILE_SOLID)');
    expect(cpp.code).toContain('updateLevelPortals();');
  });
});
