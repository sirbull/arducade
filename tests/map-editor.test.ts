// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { MapPane } from '../src/ui/assets-panes';
import { newProject } from '../src/project/model';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, strokeRect() {}, drawImage() {}, toDataURL() {} } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:');
});
function setup(cells = Array(12).fill(0)) {
  const project = newProject('test');
  project.tiles = [{ id: 'tile', name: 'Tile', pixels: Array(8).fill('11111111'), solid: false }];
  const map = { id: 'map', name: 'Map', width: 4, height: 3, cells };
  project.tilemaps = [map];
  const changed = vi.fn(), root = document.createElement('div');
  new MapPane(root, { project: () => project, changed }).render();
  const canvas = root.querySelector('canvas')!;
  canvas.setPointerCapture = () => {};
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 } as DOMRect);
  const pointer = (type: string, x: number, y = 0, id = 1) => canvas.dispatchEvent(Object.assign(new Event(type), { clientX: x * 100 + 50, clientY: y * 100 + 50, pointerId: id, button: 0 }));
  const button = (name: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="pixel.${name}"]`)!.click();
  return { map, changed, pointer, button };
}
it('previews hover without changing the map and joins fast brush movements', () => {
  const { map, pointer, changed, button } = setup();
  pointer('pointermove', 2); expect(map.cells).toEqual(Array(12).fill(0)); expect(changed).not.toHaveBeenCalled();
  pointer('pointerdown', 0); pointer('pointermove', 3); pointer('pointerup', 3);
  expect(map.cells.slice(0, 4)).toEqual([1, 1, 1, 1]); expect(changed).toHaveBeenCalledTimes(1);
  button('undo'); expect(map.cells).toEqual(Array(12).fill(0));
  button('redo'); expect(map.cells.slice(0, 4)).toEqual([1, 1, 1, 1]);
});
it('commits only the final line preview', () => {
  const { map, pointer, button } = setup(); button('line');
  pointer('pointerdown', 0); pointer('pointermove', 3);
  expect(map.cells).toEqual(Array(12).fill(0));
  pointer('pointermove', 0, 2); pointer('pointerup', 0, 2);
  expect(map.cells).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
});
it('fills connected cells without crossing a tile barrier', () => {
  const { map, pointer, button } = setup([0,1,0,0, 0,1,0,0, 0,1,0,0]);
  button('fill'); pointer('pointerdown', 0); pointer('pointerup', 0);
  expect(map.cells).toEqual([1,1,0,0, 1,1,0,0, 1,1,0,0]);
});
it('rolls back cancellation and ignores other pointers', () => {
  const { map, pointer, changed } = setup();
  pointer('pointerdown', 0); pointer('pointermove', 3, 0, 2); pointer('pointerup', 3, 0, 2);
  expect(map.cells.slice(0, 4)).toEqual([1,0,0,0]);
  pointer('pointercancel', 0); expect(map.cells).toEqual(Array(12).fill(0)); expect(changed).not.toHaveBeenCalled();
});
it('does not save unchanged fills', () => {
  const { pointer, button, changed } = setup(Array(12).fill(1));
  button('fill'); pointer('pointerdown', 0); pointer('pointerup', 0); expect(changed).not.toHaveBeenCalled();
});
