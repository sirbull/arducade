// Modal dialogs built on the <dialog> element.

import { t } from '../i18n/i18n';
import { h } from './dom';

export interface DialogHandle {
  el: HTMLDialogElement;
  body: HTMLElement;
  footer: HTMLElement;
  close(): void;
}

export function openDialog(title: string, opts: { wide?: boolean; onClose?: () => void; closable?: boolean } = {}): DialogHandle {
  const body = h('div', { class: 'dialog-body' });
  const footer = h('div', { class: 'dialog-footer' });
  const closeBtn = opts.closable === false ? null : h('button', { class: 'icon-btn', 'aria-label': t('ui.close'), title: t('ui.close') }, '×');
  const el = h('dialog', { class: opts.wide ? 'wide' : '' }, h('div', { class: 'dialog-head' }, h('h2', {}, title), closeBtn), body, footer);
  document.body.append(el);
  const handle: DialogHandle = {
    el,
    body,
    footer,
    close() {
      el.close();
    },
  };
  closeBtn?.addEventListener('click', () => handle.close());
  const outsideDialog = (event: MouseEvent) => {
    const bounds = el.getBoundingClientRect();
    return event.target === el && (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom);
  };
  let pressedOutside = false;
  el.addEventListener('pointerdown', (event) => {
    pressedOutside = event.isPrimary && event.button === 0 && outsideDialog(event);
  });
  el.addEventListener('pointercancel', () => { pressedOutside = false; });
  el.addEventListener('click', (event) => {
    if (opts.closable !== false && pressedOutside && outsideDialog(event)) handle.close();
    pressedOutside = false;
  });
  el.addEventListener('cancel', (e) => {
    if (opts.closable === false) e.preventDefault();
  });
  el.addEventListener('close', () => {
    el.remove();
    opts.onClose?.();
  });
  el.showModal();
  return handle;
}

export function confirmDialog(title: string, message: string, okLabel = t('ui.ok')): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const d = openDialog(title, { onClose: () => resolve(result) });
    d.body.append(h('p', {}, message));
    d.footer.append(
      h('button', { onclick: () => d.close() }, t('ui.cancel')),
      h('button', { class: 'primary', onclick: () => ((result = true), d.close()) }, okLabel),
    );
  });
}

export function promptDialog(title: string, label: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    const d = openDialog(title, { onClose: () => resolve(result) });
    const input = h('input', { type: 'text', value, 'aria-label': label });
    const form = h('form', { class: 'form' }, h('label', {}, label, input));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      result = input.value.trim() || null;
      d.close();
    });
    d.body.append(form);
    d.footer.append(
      h('button', { onclick: () => d.close() }, t('ui.cancel')),
      h('button', { class: 'primary', onclick: () => form.requestSubmit() }, t('ui.ok')),
    );
    input.focus();
    input.select();
  });
}

export function alertDialog(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    const d = openDialog(title, { onClose: () => resolve() });
    d.body.append(h('p', {}, message));
    d.footer.append(h('button', { class: 'primary', onclick: () => d.close() }, t('ui.ok')));
  });
}
