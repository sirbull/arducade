// The type chosen when a variable is made. Blockly variable types are left as
// '' (typed variables drop out of the Variables category and clash with
// blocks that name variables without a type), so the choice is kept here by
// variable id and saved with the workspace.

import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';
import { alertDialog, confirmDialog, openDialog, promptDialog } from '../ui/dialogs';
import { h } from '../ui/dom';
import type { Ty } from '../ir/ir';

const types = new WeakMap<Blockly.Workspace, Map<string, Ty>>();

function of(ws: Blockly.Workspace): Map<string, Ty> {
  let m = types.get(ws);
  if (!m) types.set(ws, (m = new Map()));
  return m;
}

/** The chosen type of a variable, if one was chosen. */
export function varType(ws: Blockly.Workspace, id: string): Ty | undefined {
  return of(ws).get(id);
}

Blockly.serialization.registry.register('varTypes', {
  priority: 90, // after variables, before blocks
  save: (ws: Blockly.Workspace) => (of(ws).size ? Object.fromEntries(of(ws)) : null),
  load: (state: Record<string, Ty>, ws: Blockly.Workspace) => {
    for (const [id, ty] of Object.entries(state)) of(ws).set(id, ty);
  },
  clear: (ws: Blockly.Workspace) => of(ws).clear(),
});

/** Asks for a name and a type. */
function newVariableDialog(title: string): Promise<{ name: string; ty: Ty } | null> {
  return new Promise((resolve) => {
    let result: { name: string; ty: Ty } | null = null;
    const d = openDialog(title, { onClose: () => resolve(result) });
    d.el.classList.add('variable-dialog');
    const input = h('input', { type: 'text', 'aria-label': title, autocomplete: 'off' }) as HTMLInputElement;
    const choice = (ty: Ty, key: string) =>
      h('label', { class: 'var-type' }, h('input', { type: 'radio', name: 'var-type', value: ty, checked: ty === 'num' }), h('span', {}, t(key)));
    const form = h(
      'form',
      { class: 'form' },
      input,
      h('fieldset', { class: 'var-types' }, h('legend', {}, t('var.type')), choice('num', 'var.num'), choice('str', 'var.str'), choice('bool', 'var.bool')),
    ) as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return input.focus();
      result = { name, ty: (form.querySelector('input[name=var-type]:checked') as HTMLInputElement).value as Ty };
      d.close();
    });
    d.body.append(form);
    d.footer.append(
      h('button', { onclick: () => d.close() }, t('ui.cancel')),
      h('button', { class: 'primary', onclick: () => form.requestSubmit() }, t('ui.ok')),
    );
    input.focus();
  });
}

/** Blockly's prompts, alerts and confirms in the app's own dialogs. */
export function installBlocklyDialogs() {
  Blockly.dialog.setAlert((message, callback) => void alertDialog('', message).then(() => callback?.()));
  Blockly.dialog.setConfirm((message, callback) => void confirmDialog('', message).then(callback));
  Blockly.dialog.setPrompt((message, defaultValue, callback) => {
    if (message !== Blockly.Msg['NEW_VARIABLE_TITLE']) {
      void promptDialog(message, '', defaultValue).then(callback);
      return;
    }
    // The workspace is not passed in; the one creating the variable is the main one.
    const ws = Blockly.getMainWorkspace();
    void newVariableDialog(message).then((r) => {
      callback(r?.name ?? null);
      const v = r && ws.getVariableMap().getVariable(r.name, '');
      if (v) of(ws).set(v.getId(), r.ty);
    });
  });
}

