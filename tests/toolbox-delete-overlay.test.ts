// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import * as Blockly from 'blockly/core';
import { ToolboxDeleteOverlay } from '../src/ui/toolbox-delete-overlay';

function setup(visible = true) {
  const div = document.createElement('div');
  div.innerHTML = '<svg><g class="blocklyFlyout"><path class="blocklyFlyoutBackground" /></g></svg>';
  div.getBoundingClientRect = () => ({ top: 10, bottom: 610, left: 20, height: 600 }) as DOMRect;
  const originalRect = vi.fn(() => new Blockly.utils.Rect(10, 610, 20, 520));
  const flyout = {
    autoClose: false,
    isVisible: () => visible,
    setVisible: (value: boolean) => { visible = value; },
    getWidth: vi.fn(() => 350),
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

it('follows search result widths and visibility without workspace events', async () => {
  const { target, flyout, div } = setup();
  const button = div.querySelector<HTMLButtonElement>('.flyout-close')!;
  const background = div.querySelector('.blocklyFlyoutBackground')!;
  expect(button.style.left).toBe('452px');
  for (const width of [220, 160, 480]) {
    flyout.getWidth.mockReturnValue(width);
    background.setAttribute('d', `M 0 0 H ${width} V 600 Z`);
    await Promise.resolve();
    expect(button.style.left).toBe(`${150 + width - 48}px`);
    expect(button.hidden).toBe(false);
  }
  flyout.setVisible(false);
  div.querySelector('.blocklyFlyout')!.setAttribute('style', 'display: none');
  await Promise.resolve();
  expect(button.hidden).toBe(true);
  target.dispose();
  flyout.getWidth.mockReturnValue(300);
  background.setAttribute('d', 'M 0 0 H 300 Z');
  await Promise.resolve();
  expect(button.style.left).toBe('582px');
});
