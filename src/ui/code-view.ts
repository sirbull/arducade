// Read only view of the generated C++, with the lines of the selected block
// marked.

import { clear, h } from './dom';

const KEYWORDS = /\b(void|bool|int16_t|uint8_t|uint16_t|uint32_t|int32_t|static|const|if|else|for|while|return|break|continue|true|false|enum|PROGMEM|#include|#define)\b/g;

export class CodeView {
  private lines: HTMLElement[] = [];
  private text = '';

  constructor(private el: HTMLElement) {}

  setCode(code: string) {
    if (code === this.text) return;
    this.text = code;
    clear(this.el);
    this.lines = code.split('\n').map((line, i) => {
      const content = h('span', { class: 'code-text' });
      const comment = line.indexOf('//');
      const body = comment >= 0 ? line.slice(0, comment) : line;
      appendHighlighted(content, body);
      if (comment >= 0) content.append(h('span', { class: 'tok-comment' }, line.slice(comment)));
      return h('span', { class: 'code-line' }, h('span', { class: 'ln', 'aria-hidden': 'true' }, String(i + 1)), content, '\n');
    });
    this.el.append(...this.lines);
  }

  get code() {
    return this.text;
  }

  highlight(range: [number, number] | undefined, scroll: boolean) {
    for (const l of this.lines) l.classList.remove('hl');
    if (!range) return;
    for (let i = range[0]; i <= range[1] && i < this.lines.length; i++) this.lines[i].classList.add('hl');
    if (scroll) this.lines[range[0]]?.scrollIntoView({ block: 'center' });
  }
}

function appendHighlighted(el: HTMLElement, text: string) {
  let last = 0;
  for (const m of text.matchAll(KEYWORDS)) {
    if (m.index! > last) el.append(text.slice(last, m.index));
    el.append(h('span', { class: 'tok-kw' }, m[0]));
    last = m.index! + m[0].length;
  }
  if (last < text.length) el.append(text.slice(last));
}
