// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Runner } from '../src/sim/runner';
import { bindSimulatorInput } from '../src/ui/simulator-input';

let root: HTMLDivElement;
let runner: Runner;
let input: Mock<(buttons: number) => void>;
let capture: Mock<() => void>;
let unbind: () => void;

beforeEach(() => {
  root = document.createElement('div'); root.tabIndex = 0;
  root.innerHTML = '<canvas tabindex="0"></canvas><button data-btn="right">Right</button><button data-btn="a">A</button><button id="capture">Screenshot</button>';
  document.body.append(root);
  root.querySelectorAll('button').forEach(button => { button.setPointerCapture = vi.fn(); });
  const canvas = root.querySelector('canvas')!;
  vi.spyOn(canvas, 'getContext').mockReturnValue({
    createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }), putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  input = vi.fn(); capture = vi.fn();
  runner = new Runner(canvas, { onError: vi.fn(), onSkippedCpp: vi.fn(), onInput: input });
  runner.setMuted(true);
  unbind = bindSimulatorInput(root, runner, capture);
  canvas.focus();
});
afterEach(() => { unbind(); document.body.replaceChildren(); vi.restoreAllMocks(); });

function pointer(button: string, type: string, pointerId = 1, mouseButton = 0) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId, button: mouseButton });
  root.querySelector(`[data-btn="${button}"]`)!.dispatchEvent(event);
  return event;
}
function key(code: string, type = 'keydown', repeat = false, target: HTMLElement = root) {
  const event = new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true });
  target.dispatchEvent(event); return event;
}

describe('cartridge simulator input', () => {
  it('prevents focus-stealing touch presses and supports movement + action together', () => {
    expect(pointer('right', 'pointerdown', 1).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(root);
    pointer('a', 'pointerdown', 2);
    expect(input).toHaveBeenLastCalledWith(8 | 16);
    pointer('right', 'pointerup', 1);
    expect(input).toHaveBeenLastCalledWith(16);
    pointer('a', 'pointercancel', 2);
    expect(input).toHaveBeenLastCalledWith(0);
  });
  it('keeps a button held until all its fingers are released', () => {
    pointer('a', 'pointerdown', 1); pointer('a', 'pointerdown', 2);
    pointer('a', 'lostpointercapture', 1);
    expect(input).toHaveBeenLastCalledWith(16);
    pointer('a', 'lostpointercapture', 2);
    expect(input).toHaveBeenLastCalledWith(0);
  });
  it('keeps keyboard controls active after touching or focusing the screenshot button', () => {
    pointer('right', 'pointerdown'); pointer('right', 'pointerup');
    const button = root.querySelector<HTMLButtonElement>('#capture')!;
    button.focus();
    expect(key('ArrowRight', 'keydown', false, button).defaultPrevented).toBe(true);
    key('KeyZ', 'keydown', false, button);
    expect(input).toHaveBeenLastCalledWith(8 | 16);
    key('ArrowRight', 'keyup', false, button);
    expect(input).toHaveBeenLastCalledWith(16);
  });
  it('preserves native Enter and Space activation on non-game buttons', () => {
    const button = root.querySelector<HTMLButtonElement>('#capture')!;
    expect(key('Enter', 'keydown', false, button).defaultPrevented).toBe(false);
    expect(key('Space', 'keydown', false, button).defaultPrevented).toBe(false);
    expect(input).not.toHaveBeenCalled();
    expect(key('Space', 'keyup', false, button).defaultPrevented).toBe(false);
    expect(key('Enter', 'keyup', false, button).defaultPrevented).toBe(false);
  });
  it('takes one screenshot with B without pressing the game B button or leaking keys', () => {
    const outer = vi.fn(); window.addEventListener('keydown', outer);
    expect(key('KeyB').defaultPrevented).toBe(true);
    key('KeyB', 'keydown', true); key('KeyB', 'keyup');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
    key('KeyX'); expect(input).toHaveBeenLastCalledWith(32);
    window.removeEventListener('keydown', outer);
  });
  it('releases inputs when backgrounded or closed and removes listeners', () => {
    pointer('a', 'pointerdown'); key('ArrowRight');
    window.dispatchEvent(new Event('blur'));
    expect(input).toHaveBeenLastCalledWith(0);
    pointer('a', 'pointerdown');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(input).toHaveBeenLastCalledWith(0);
    delete (document as unknown as { hidden?: boolean }).hidden;
    pointer('a', 'pointerdown'); unbind();
    expect(input).toHaveBeenLastCalledWith(0);
    input.mockClear(); pointer('a', 'pointerdown'); key('KeyB');
    expect(input).not.toHaveBeenCalled(); expect(capture).not.toHaveBeenCalled();
  });
  it('releases held keys on focus leaving the simulator and ignores right-clicks', () => {
    pointer('right', 'pointerdown', 1, 2); expect(input).not.toHaveBeenCalled();
    key('KeyZ');
    const other = document.createElement('button'); document.body.append(other); other.focus();
    expect(input).toHaveBeenLastCalledWith(0);
  });
});
