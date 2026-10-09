// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { installScrollGuard } from '../src/ui/scroll-guard';

let uninstall: () => void;
beforeEach(() => { uninstall = installScrollGuard(); });
afterEach(() => { uninstall(); document.body.replaceChildren(); });

function wheel(target: EventTarget, deltaX: number, deltaY = 0, ctrlKey = false) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX, deltaY, ctrlKey });
  target.dispatchEvent(event);
  return event;
}

it('blocks unused horizontal gestures anywhere in the app', () => {
  const panel = document.createElement('div');
  document.body.append(panel);
  expect(wheel(panel, -50).defaultPrevented).toBe(true);
  expect(wheel(document.body, 50).defaultPrevented).toBe(true);
});

it('preserves vertical scrolling and pinch zoom', () => {
  expect(wheel(document.body, 0, 50).defaultPrevented).toBe(false);
  expect(wheel(document.body, 2, 50).defaultPrevented).toBe(false);
  expect(wheel(document.body, 50, 0, true).defaultPrevented).toBe(false);
});

it('allows native horizontal scrolling until the panel reaches an edge', () => {
  const panel = document.createElement('div');
  panel.style.overflowX = 'auto';
  Object.defineProperties(panel, { scrollWidth: { value: 300 }, clientWidth: { value: 100 } });
  const child = document.createElement('span');
  panel.append(child);
  document.body.append(panel);
  panel.scrollLeft = 100;
  expect(wheel(child, -50).defaultPrevented).toBe(false);
  expect(wheel(child, 50).defaultPrevented).toBe(false);
  panel.scrollLeft = 0;
  expect(wheel(child, -50).defaultPrevented).toBe(true);
  panel.scrollLeft = 200;
  expect(wheel(child, 50).defaultPrevented).toBe(true);
});

it('lets Blockly handle gestures before the guard and can be uninstalled', () => {
  const workspace = document.createElement('div');
  document.body.append(workspace);
  let handled = false;
  workspace.addEventListener('wheel', event => {
    handled = !event.defaultPrevented;
    event.preventDefault();
  });
  wheel(workspace, 50);
  expect(handled).toBe(true);
  uninstall();
  expect(wheel(document.body, 50).defaultPrevented).toBe(false);
});
