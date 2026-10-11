// @vitest-environment jsdom
import * as Blockly from 'blockly/core';
import { expect, it, vi } from 'vitest';
import { bindShortcuts, trimBlocklyShortcuts } from '../src/ui/shortcuts';

it('keeps only Blockly shortcuts that do not collide with game keys', () => {
  trimBlocklyShortcuts();
  expect(Object.keys(Blockly.ShortcutRegistry.registry.getRegistry()).sort())
    .toEqual(['copy', 'cut', 'delete', 'escape', 'paste', 'redo', 'undo']);
});

it('runs editor shortcuts, but not / while typing or with a dialog open', () => {
  const actions = { save: vi.fn(), run: vi.fn(), tab: vi.fn(), search: vi.fn(), help: vi.fn() };
  let blocked = false;
  bindShortcuts(actions, () => blocked, (el) => el instanceof HTMLInputElement);
  const input = document.body.appendChild(document.createElement('input'));
  const press = (init: KeyboardEventInit, target: EventTarget = document.body) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

  expect(press({ key: 's', ctrlKey: true })).toBe(false);
  press({ key: 'Enter', ctrlKey: true }, input);
  press({ key: '¡', code: 'Digit3', altKey: true });
  press({ key: '/' });
  press({ key: '/' }, input);
  press({ key: '?' });
  blocked = true;
  press({ key: 's', ctrlKey: true });

  expect(actions.save).toHaveBeenCalledTimes(1);
  expect(actions.run).toHaveBeenCalledTimes(1);
  expect(actions.tab).toHaveBeenCalledWith(2);
  expect(actions.search).toHaveBeenCalledTimes(1);
  expect(actions.help).toHaveBeenCalledTimes(1);
});
