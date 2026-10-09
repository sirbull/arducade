// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PixelEditor } from '../src/ui/pixel-editor';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, strokeRect() {}, setLineDash() {} } as unknown as CanvasRenderingContext2D);
});
function setup(rows = ['10.', '...']) {
  const changed = vi.fn();
  const editor = new PixelEditor(3, 2, rows, changed);
  const canvas = editor.el.querySelector('canvas')!;
  canvas.setPointerCapture = () => {};
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200 } as DOMRect);
  const pointer = (type: string, x: number, y = 0) => canvas.dispatchEvent(Object.assign(new Event(type), { clientX: x * 100 + 50, clientY: y * 100 + 50, pointerId: 1, button: 0 }));
  const key = (k: string, ctrlKey = false) => editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey, bubbles: true }));
  const button = (label: string) => editor.el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
  return { editor, changed, pointer, button, key };
}
describe('sprite drawing', () => {
  it('toggles matching white and black to transparent only once per stroke', () => {
    const {editor, pointer, button} = setup();
    const toggle = editor.el.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    toggle.checked = true; toggle.dispatchEvent(new Event('change'));
    pointer('pointerdown', 0); pointer('pointermove', 0); pointer('pointerup', 0);
    expect(editor.rows()[0]).toBe('.0.');
    button('pixel.black'); pointer('pointerdown', 1); pointer('pointermove', 1); pointer('pointerup', 1);
    expect(editor.rows()[0]).toBe('...');
  });
  it('draws continuous strokes and undoes an entire stroke', () => {
    const {editor, pointer, button, changed} = setup(['...', '...']);
    pointer('pointerdown', 0); pointer('pointermove', 2); pointer('pointerup', 2);
    expect(editor.rows()).toEqual(['111', '...']); expect(changed).toHaveBeenCalledTimes(1);
    button('pixel.undo'); expect(editor.rows()).toEqual(['...', '...']);
    button('pixel.redo'); expect(editor.rows()).toEqual(['111', '...']);
  });
  it('fills connected pixels with the selected black color', () => {
    const {editor, pointer, button} = setup(['1..', '1..']);
    button('pixel.black'); button('pixel.fill'); pointer('pointerdown', 2); pointer('pointerup', 2);
    expect(editor.rows()).toEqual(['100', '100']);
  });
  it('previews a line without leaving earlier previews behind', () => {
    const {editor, pointer, button} = setup(['...', '...']);
    button('pixel.line'); pointer('pointerdown', 0); pointer('pointermove', 2); pointer('pointermove', 0, 1); pointer('pointerup', 0, 1);
    expect(editor.rows()).toEqual(['1..', '1..']);
  });
  it('copies a selection, pastes it floating, moves it and undoes the paste in one step', () => {
    const {editor, pointer, button, key, changed} = setup(['10.', '...']);
    button('pixel.select'); pointer('pointerdown', 0); pointer('pointermove', 1); pointer('pointerup', 1);
    key('c', true); key('v', true);
    pointer('pointerdown', 0); pointer('pointermove', 1, 1); pointer('pointerup', 1, 1);
    expect(changed).not.toHaveBeenCalled(); key('Enter');
    expect(editor.rows()).toEqual(['10.', '.10']); expect(changed).toHaveBeenCalledTimes(1);
    button('pixel.undo'); expect(editor.rows()).toEqual(['10.', '...']);
  });
  it('cuts a selection to transparent', () => {
    const {editor, pointer, button, key} = setup(['10.', '...']);
    button('pixel.select'); pointer('pointerdown', 0); pointer('pointerup', 0);
    key('x', true); expect(editor.rows()).toEqual(['.0.', '...']);
  });
});
