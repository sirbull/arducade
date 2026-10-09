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

describe('selection clipboard', () => {
  function clipboard(editor: PixelEditor, type: 'copy' | 'paste', initial = '') {
    let text = initial;
    const event = Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      clipboardData: { setData: (_type: string, value: string) => { text = value; }, getData: () => text },
    });
    editor.el.dispatchEvent(event);
    return { text, prevented: event.defaultPrevented };
  }
  it('selects without painting and pastes black, white and transparent pixels into another frame', () => {
    const source = setup(['10.', '.01']);
    source.button('pixel.select');
    source.pointer('pointerdown', 1, 1); source.pointer('pointermove', 0, 0); source.pointer('pointerup', 0, 0);
    expect(source.changed).not.toHaveBeenCalled();
    const copied = clipboard(source.editor, 'copy');
    expect(copied.prevented).toBe(true);
    const target = setup(['111', '111']);
    target.button('pixel.select'); target.pointer('pointerdown', 1); target.pointer('pointerup', 1);
    clipboard(target.editor, 'paste', copied.text);
    target.editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(target.editor.rows()).toEqual(['110', '110']);
    expect(target.changed).toHaveBeenCalledTimes(1);
    target.button('pixel.undo'); expect(target.editor.rows()).toEqual(['111', '111']);
    target.button('pixel.redo'); expect(target.editor.rows()).toEqual(['110', '110']);
  });
  it('clips oversized pastes at the edge and ignores ordinary clipboard text', () => {
    const source = setup(['10.', '.01']);
    const copied = clipboard(source.editor, 'copy');
    const target = setup(['...', '...']);
    target.button('pixel.select'); target.pointer('pointerdown', 2, 1); target.pointer('pointerup', 2, 1);
    clipboard(target.editor, 'paste', copied.text);
    expect(target.editor.rows()).toEqual(['...', '..1']);
    expect(clipboard(target.editor, 'paste', 'ordinary text').prevented).toBe(false);
    expect(target.editor.rows()).toEqual(['...', '..1']);
  });
  it('supports modifier shortcuts without changing drawing tools and leaves text inputs alone', () => {
    const { editor, button } = setup();
    button('pixel.line');
    editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(editor.el.querySelector('button[aria-label="pixel.select"]')?.getAttribute('aria-pressed')).toBe('true');
    editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const input = editor.el.querySelector('input')!;
    const event = new KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('selection history', () => {
  it('undoes and redoes deselection of a single pixel with Cmd+Z and Cmd+Y', () => {
    const { editor, pointer, button, changed } = setup();
    const strokes = vi.mocked(HTMLCanvasElement.prototype.getContext).mock.results.at(-1)!.value;
    const outline = vi.spyOn(strokes, 'strokeRect');
    button('pixel.select'); pointer('pointerdown', 1); pointer('pointerup', 1);
    outline.mockClear();
    pointer('pointerdown', 1); pointer('pointerup', 1);
    expect(editor.rows()).toEqual(['10.', '...']);
    editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true }));
    expect(outline).toHaveBeenCalled();
    outline.mockClear();
    editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', metaKey: true, bubbles: true, cancelable: true }));
    expect(outline).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });
  it('clears a selection on an outside click and restores earlier selection rectangles without editing pixels', () => {
    const { editor, pointer, button, changed } = setup();
    document.body.append(editor.el);
    const ctx = vi.mocked(HTMLCanvasElement.prototype.getContext).mock.results.at(-1)!.value;
    const outline = vi.spyOn(ctx, 'strokeRect');
    button('pixel.select'); pointer('pointerdown', 0); pointer('pointermove', 1); pointer('pointerup', 1);
    pointer('pointerdown', 2, 1); pointer('pointerup', 2, 1);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outline.mockClear();
    editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(outline).toHaveBeenCalledWith(97, 49, 46, 46);
    outline.mockClear();
    editor.el.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(outline).toHaveBeenCalledWith(1, 1, 94, 46);
    expect(changed).not.toHaveBeenCalled();
    editor.el.remove();
  });
});
