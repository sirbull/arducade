import { BUTTON_IDS } from '../engine/enums';
import type { Runner } from '../sim/runner';

type GameInput = Pick<Runner, 'keyDown' | 'keyUp' | 'setTouch' | 'releaseAll'>;

/** Keeps touch and keyboard input inside a modal simulator, without button focus stealing presses. */
export function bindSimulatorInput(root: HTMLElement, runner: GameInput, capture: () => void): () => void {
  const listeners = new AbortController();
  const signal = listeners.signal;
  const pointers = new Map<number, { button: (typeof BUTTON_IDS)[number]; element: HTMLButtonElement }>();
  const release = () => {
    pointers.clear();
    root.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
    runner.releaseAll();
  };
  root.querySelectorAll<HTMLButtonElement>('[data-btn]').forEach(element => {
    const button = element.dataset.btn as (typeof BUTTON_IDS)[number];
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      root.focus({ preventScroll: true });
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { button, element });
      element.classList.add('pressed');
      runner.setTouch(button, true);
    }, { signal });
    const up = (event: PointerEvent) => {
      const held = pointers.get(event.pointerId);
      if (!held) return;
      pointers.delete(event.pointerId);
      if (![...pointers.values()].some(p => p.button === held.button)) {
        runner.setTouch(held.button, false);
        held.element.classList.remove('pressed');
      }
    };
    element.addEventListener('pointerup', up, { signal });
    element.addEventListener('pointercancel', up, { signal });
    element.addEventListener('lostpointercapture', up, { signal });
  });
  root.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyB') {
      event.preventDefault(); event.stopPropagation();
      if (!event.repeat) capture();
    } else if ((event.code === 'Enter' || event.code === 'Space')
      && event.target instanceof HTMLButtonElement && !event.target.hasAttribute('data-btn')) {
      // Keep native keyboard activation for screenshot, pause, restart and close buttons.
      return;
    } else if (runner.keyDown(event)) {
      event.preventDefault(); event.stopPropagation();
    }
  }, { signal });
  root.addEventListener('keyup', event => {
    if ((event.code === 'Enter' || event.code === 'Space')
      && event.target instanceof HTMLButtonElement && !event.target.hasAttribute('data-btn')) {
      runner.keyUp(event);
      return;
    }
    if (event.code === 'KeyB' || runner.keyUp(event)) {
      event.preventDefault(); event.stopPropagation();
    }
  }, { signal });
  root.addEventListener('focusout', event => {
    if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) release();
  }, { signal });
  window.addEventListener('blur', release, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); }, { signal });
  return () => { listeners.abort(); release(); };
}
