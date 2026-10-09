// Small helpers for building the page without a framework.

type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (k === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function $(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.firstChild.remove();
}

export function select(options: { value: string; label: string }[], value: string, onChange: (v: string) => void, attrs: Attrs = {}): HTMLSelectElement {
  const s = h('select', attrs, ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

let toastTimer = 0;
export function toast(message: string, kind: 'info' | 'error' | 'ok' = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el!.className = ''), 4000);
}

/** A one color line icon from an SVG path on a 24x24 grid. Sized 1em so it follows the font size. */
export function icon(d: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '1em'); svg.setAttribute('height', '1em'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', d); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path); return svg;
}

export const LOCK_ICON = 'M6 11h12v10H6z M8 11V7a4 4 0 018 0v4';
export const FILM_ICON = 'M4 4h16v16H4z M8 4v16 M16 4v16 M4 8h4 M4 12h4 M4 16h4 M16 8h4 M16 12h4 M16 16h4';
