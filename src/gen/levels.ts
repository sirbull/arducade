// Portal transitions shared by the simulator and device generators.
import type { Project, TilemapAsset } from '../project/model';
import type { Names } from './common';

export function validLevelLinks(project: Project) {
  return project.tilemaps.flatMap((source) => (source.links ?? []).flatMap((link) => {
    const target = project.tilemaps.find((map) => map.id === link.target);
    const inside = (map: TilemapAsset, col: number, row: number) => Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < map.width && row < map.height;
    return target && inside(source, link.col, link.row) && inside(target, link.spawnCol, link.spawnRow) ? [{ source, target, link }] : [];
  }));
}

export function levelTransitionCode(project: Project, names: Names, cpp: boolean): string[] {
  const links = validLevelLinks(project);
  if (!links.length) return [];
  const engine = cpp ? 'ab::' : 'E.';
  const lines = [cpp ? 'static bool levelPortalLocked = false;' : 'let levelPortalLocked = false;',
    cpp ? 'static void updateLevelPortals() {' : 'function updateLevelPortals() {',
    cpp ? '  for (uint8_t s = 0; s < AB_MAX_SPRITES; ++s) {' : '  for (let s = 0; s < E.maxSprites; ++s) {',
    `    if (!${engine}exists(s) || ${engine}kindOf(s) != 0) continue;`,
    `    ${cpp ? 'int16_t' : 'const'} x = ${engine}getProp(s, 0), y = ${engine}getProp(s, 1);`,
    cpp ? '    bool atPortal = false;' : '    let atPortal = false;'];
  for (const { source, target, link } of links) {
    // Pixel bounds avoid differing rounding rules for negative coordinates.
    const condition = `${engine}map ${cpp ? '==' : '==='} ${names.tilemap(source.id)} && x >= ${link.col * 8} && x < ${(link.col + 1) * 8} && y >= ${link.row * 8} && y < ${(link.row + 1) * 8}`;
    lines.push(`    if (${condition}) {`, '      atPortal = true;', '      if (!levelPortalLocked) {',
      `        ${engine}setMap(${names.tilemap(target.id)}${cpp ? ', tileImages, TILE_SOLID' : ''});`,
      `        ${engine}setPosition(s, ${link.spawnCol * 8 + 4}, ${link.spawnRow * 8 + 4});`,
      `        ${engine}setVelocity(s, 0, 0);`,
      '        levelPortalLocked = true;', '        return;', '      }', '    }');
  }
  lines.push('    if (!atPortal) levelPortalLocked = false;', '    return;', '  }', '}');
  return lines;
}
