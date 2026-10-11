// Keyboard shortcuts. Blockly's single-key shortcuts (C cleans up, D
// duplicates, X disconnects, arrows navigate...) collide with the simulator's
// game keys, so only its copy, paste, undo and delete shortcuts are kept.
// Every shortcut here has a button on screen too.

import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';
import { h } from './dom';

const BLOCKLY_KEEP = new Set(['escape', 'delete', 'copy', 'cut', 'paste', 'undo', 'redo']);

export function trimBlocklyShortcuts() {
  const registry = Blockly.ShortcutRegistry.registry;
  for (const name of Object.keys(registry.getRegistry())) if (!BLOCKLY_KEEP.has(name)) registry.unregister(name);
}

const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
export const MOD = mac ? '⌘' : 'Ctrl';
export const ALT = mac ? '⌥' : 'Alt';
/** A key combination as text, "⌘S" or "Ctrl+S". */
export const combo = (...keys: string[]) => keys.join(mac ? '' : '+');

export interface ShortcutActions {
  save(): void;
  run(): void;
  tab(index: number): void;
  search(): void;
  help(): void;
}

/** Handles the editor's own shortcuts. `blocked` is true on the home screen or with a dialog open. */
export function bindShortcuts(actions: ShortcutActions, blocked: () => boolean, editable: (el: EventTarget | null) => boolean) {
  // Capture, so the code editors do not get Ctrl+Enter or Alt+number first.
  window.addEventListener('keydown', (e) => {
    if (blocked() || e.repeat) return;
    const mod = mac ? e.metaKey : e.ctrlKey;
    const digit = /^Digit([1-9])$/.exec(e.code);
    let action: (() => void) | undefined;
    if (mod && !e.altKey && e.key.toLowerCase() === 's') action = actions.save;
    else if (mod && !e.altKey && e.key === 'Enter') action = actions.run;
    // e.code: Option+number types a symbol on a Mac.
    else if (e.altKey && !e.ctrlKey && !e.metaKey && digit) action = () => actions.tab(Number(digit[1]) - 1);
    else if (!mod && !e.altKey && !editable(e.target) && e.key === '/') action = actions.search;
    else if (!mod && !e.altKey && !editable(e.target) && e.key === '?') action = actions.help;
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    action();
  }, true);
}

const kbd = (...keys: string[]) => h('span', { class: 'keys' }, ...keys.map(k => h('kbd', {}, k)));

/** The shortcuts table for the documentation. */
export function shortcutsGuide(): HTMLElement {
  const or = (...combos: HTMLElement[]) => h('span', {}, ...combos.flatMap((c, i) => i ? [` ${t('shortcuts.or')} `, c] : [c]));
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('.tabs [data-tab]'));
  const groups: [string, [HTMLElement, string][]][] = [
    ['editor', [
      [kbd(MOD, 'S'), t('shortcuts.save')],
      [kbd(MOD, 'Enter'), t('shortcuts.run')],
      ...tabs.map((tab, i): [HTMLElement, string] => [kbd(ALT, String(i + 1)), t('shortcuts.tab', { name: tab.textContent!.trim() })]),
      [kbd('/'), t('shortcuts.search')],
      [kbd('?'), t('shortcuts.help')],
      [kbd('Esc'), t('shortcuts.escape')],
    ]],
    ['blocks', [
      [kbd(MOD, 'Z'), t('shortcuts.undo')],
      [or(kbd(MOD, 'Shift', 'Z'), kbd(MOD, 'Y')), t('shortcuts.redo')],
      [kbd(MOD, 'C'), t('shortcuts.copy')],
      [kbd(MOD, 'X'), t('shortcuts.cut')],
      [kbd(MOD, 'V'), t('shortcuts.paste')],
      [or(kbd('Delete'), kbd('⌫')), t('shortcuts.delete')],
    ]],
    ['sim', [
      [or(kbd('←', '↑', '→', '↓'), kbd('W', 'A', 'S', 'D')), t('shortcuts.move')],
      [or(kbd('Z'), kbd(t('shortcuts.space')), kbd('J')), t('shortcuts.a')],
      [or(kbd('X'), kbd('Enter'), kbd('K')), t('shortcuts.b')],
    ]],
  ];
  return h('div', {}, ...groups.map(([id, rows]) => h('div', { class: 'docs-table-wrap' }, h('table', { class: 'docs-wiring docs-shortcuts' },
    h('caption', {}, t(`shortcuts.group.${id}`)),
    h('tbody', {}, ...rows.map(([keys, text]) => h('tr', {}, h('th', { scope: 'row' }, keys), h('td', {}, text))))))));
}
