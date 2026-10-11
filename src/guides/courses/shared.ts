import { blk, get, num, set, workspace, type B } from '../../templates/dsl';
import type { LocalizedText, TileAsset, TilemapAsset } from '../../project/model';
import { matchesSolution, type GuideStep, type Check } from '../guide';
export const L = (en: string, nb: string, es: string, fr: string, de: string): LocalizedText => ({ en, nb, es, fr, de });
export const create = (name: string, image: string, kind = 'Player') => set(name, blk('ab_sprite_create', { f: { IMAGE: image, KIND: kind } }));
export const position = (name: string, x: B | number, y: B | number) => blk('ab_sprite_set_position', { i: { SPRITE: get(name), X: typeof x === 'number' ? num(x) : x, Y: typeof y === 'number' ? num(y) : y } });
export const velocity = (name: string, vx: B | number, vy: B | number = 0) => blk('ab_sprite_set_velocity', { i: { SPRITE: get(name), VX: typeof vx === 'number' ? num(vx) : vx, VY: typeof vy === 'number' ? num(vy) : vy } });
export const image = (name: string, id: string) => blk('ab_sprite_set_image', { f: { IMAGE: id }, i: { SPRITE: get(name) } });
export const destroy = (name: string) => blk('ab_sprite_destroy', { i: { SPRITE: get(name) } });
export const win = () => blk('ab_game_over', { f: { WIN: 'win' } });
export const lose = () => blk('ab_game_over', { f: { WIN: 'lose' } });
export const button = (key: string, body: B[]) => blk('ab_on_button', { f: { BUTTON: key, EVENT: 'pressed' }, body });
export const every = (ms: number, body: B[]) => blk('ab_on_every', { f: { MS: ms }, body });
export const update = (body: B[]) => blk('ab_on_update', { body });
export const contact = (a: string, b: string, body: B[]) => blk('ab_on_overlap', { f: { SPRITE: { name: 'sprite' }, OTHER: { name: 'otherSprite' }, KIND_A: a, KIND_B: b }, body });
export const move = (name: string, speed = 40) => blk('ab_move_sprite', { i: { SPRITE: get(name), VX: num(speed), VY: num(speed) } });
export const text = (value: B, x = 0, y = 0) => blk('ab_draw_text', { f: { COLOR: 'white' }, i: { TEXT: value, X: num(x), Y: num(y) } });
export const draw = (body: B[]) => blk('ab_on_draw', { body });
export const mod = (a: B, b: number) => blk('math_modulo', { i: { DIVIDEND: a, DIVISOR: num(b) } });
export const clamp = (value: B, low: number, high: number) => blk('math_constrain', { i: { VALUE: value, LOW: num(low), HIGH: num(high) } });
export const map = (id: string) => blk('ab_set_tilemap', { f: { MAP: id } });
export const tileIs = (col: B, row: B, id: string) => blk('ab_tile_is', { f: { TILE: id }, i: { COL: col, ROW: row } });
export const setTile = (col: B, row: B, id: string) => blk('ab_set_tile', { f: { TILE: id }, i: { COL: col, ROW: row } });
export const animate = (name: string, ms = 200) => blk('ab_sprite_animate', { i: { SPRITE: get(name), MS: num(ms) } });
export const life = (v: number) => blk('ab_life_set', { i: { VALUE: num(v) } });
export const score = (v: number) => blk('ab_score_set', { i: { VALUE: num(v) } });
export const sound = (sfx: string) => blk('ab_play_effect', { f: { SFX: sfx } });

export function stage(explanation: LocalizedText, body: B[], events: B[] = [], show?: B[], run?: Check['run']): GuideStep {
  const roots = [blk('ab_on_start', { body }), ...events];
  const solution = structuredClone(workspace(roots));
  const checks: Check[] = [{
    text: L('All required blocks are connected in order and use the correct variables', 'Alle nødvendige blokker er koblet i rekkefølge og bruker riktige variabler', 'Todos los bloques necesarios están conectados en orden y usan las variables correctas', 'Tous les blocs nécessaires sont reliés dans l’ordre et utilisent les bonnes variables', 'Alle nötigen Blöcke sind in Reihenfolge verbunden und verwenden die richtigen Variablen'),
    ok: c => matchesSolution(c.blocks, solution),
  }];
  if (run) checks.push({ text: L('Your game passes the play test', 'Spillet ditt består spilleprøven', 'Tu juego supera la prueba', 'Ton jeu réussit le test', 'Dein Spiel besteht den Spieltest'), ok: () => true, run });
  return { text: explanation, solution, show: structuredClone(show ?? roots), checks };
}
export const tryGame: Check = { text: L('Press ▶ to try the game', 'Trykk ▶ for å prøve spillet', 'Pulsa ▶ para probar el juego', 'Appuie sur ▶ pour essayer le jeu', 'Drücke ▶, um das Spiel zu testen'), ok: c => c.played > 0 };
export const finishStage = (s: GuideStep): GuideStep => ({ ...s, show: undefined, checks: [...s.checks, tryGame] });
export const blank = () => workspace([]);
export function tiles(wallId: string, crateId?: string): TileAsset[] {
  const out: TileAsset[] = [{ id: wallId, name: '▦', solid: true, pixels: ['11111111','1..1...1','11111111','1....1.1','11111111','1..1...1','11111111','11111111'] }];
  if (crateId) out.push({ id: crateId, name: '▧', solid: true, pixels: ['11111111','11....11','1.1..1.1','1..11..1','1..11..1','1.1..1.1','11....11','11111111'] });
  return out;
}
export function room(id: string, walls: [number, number][], crates: [number, number][] = []): TilemapAsset {
  const cells: number[] = Array.from({ length: 128 }, (_, i) => { const x = i % 16, y = Math.floor(i / 16); return x === 0 || x === 15 || y === 0 || y === 7 ? 1 : 0; });
  walls.forEach(([x,y]) => { cells[y*16+x] = 1; });
  crates.forEach(([x,y]) => { cells[y*16+x] = 2; });
  return { id, name: id, width: 16, height: 8, cells };
}
