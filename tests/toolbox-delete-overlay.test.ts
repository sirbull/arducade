// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { ToolboxDeleteOverlay } from '../src/ui/toolbox-delete-overlay';

function setup(visible = true) {
  const div = document.createElement('div');
  div.getBoundingClientRect = () => ({ top: 10, bottom: 610, left: 20, height: 600 }) as DOMRect;
  const originalRect = vi.fn(() => new Blockly.utils.Rect(10, 610, 20, 520));
  const flyout = {
    autoClose: false,
    isVisible: () => visible,
    setVisible: (value: boolean) => { visible = value; },
    getWidth: () => 350,
    getClientRect: originalRect,
  };
  let listener: (event: Blockly.Events.Abstract) => void;
  const ws = {
    getInjectionDiv: () => div,
    getFlyout: () => flyout,
    getToolbox: () => ({ getWidth: () => 150 }),
    getComponentManager: () => ({ addComponent: vi.fn(), removeComponent: vi.fn() }),
    addChangeListener: (fn: typeof listener) => { listener = fn; },
    removeChangeListener: vi.fn(),
  };
  const target = new ToolboxDeleteOverlay(ws as unknown as Blockly.WorkspaceSvg);
  const drag = (isStart: boolean) => listener({ type: Blockly.Events.BLOCK_DRAG, isStart } as Blockly.Events.BlockDrag);
  return { target, flyout, div, drag, originalRect };
}

it('limits deletion to categories even before the palette hides, then restores the palette', () => {
  const { target, flyout, div, drag, originalRect } = setup();
  expect(target.getClientRect()?.right).toBe(170);
  expect(flyout.getClientRect()).toBeNull();
  drag(true);
  expect(flyout.isVisible()).toBe(false);
  expect(div.querySelector<HTMLElement>('.toolbox-delete-overlay')?.style.width).toBe('150px');
  expect(div.querySelector<HTMLButtonElement>('.flyout-close')?.hidden).toBe(true);
  drag(false);
  expect(flyout.isVisible()).toBe(true);
  expect(div.querySelector<HTMLElement>('.toolbox-delete-overlay')?.hidden).toBe(true);
  expect(div.querySelector<HTMLButtonElement>('.flyout-close')?.hidden).toBe(false);
  target.dispose();
  expect(flyout.getClientRect).toBe(originalRect);
});

it('keeps a previously closed palette closed after dragging', () => {
  const { target, flyout, drag } = setup(false);
  drag(true);
  drag(false);
  expect(flyout.isVisible()).toBe(false);
  target.dispose();
});
