import { h } from './dom';
import { t } from '../i18n/i18n';
import { placeNote, type SequenceNote } from '../engine/sequencer';

interface RollOptions {
  notes: SequenceNote[]; start: number; rows: { label: string; frequency: number; disabled?: boolean }[];
  change: (notes: SequenceNote[]) => void; beforeEdit: () => void; disabled?: boolean;
}
/** Pointer edits are transactions: preview while dragging, save once on release. */
export class PianoRoll {
  readonly element = h('div', { class: 'studio-piano-roll' });
  readonly surface = h('div', { class: 'studio-note-surface', tabindex: 0, role: 'group', 'aria-label': t('music.pianoRoll') });
  readonly tools = h('div', { class: 'studio-selection-tools' });
  private notes: SequenceNote[];
  private selected: SequenceNote | null = null;
  private history: SequenceNote[][] = [];
  private cursor = { step: 0, row: 11 };
  private drag: { id: number; mode: 'draw'|'move'|'left'|'right'; anchor: number; original: SequenceNote; preview: SequenceNote } | null = null;
  private menu: HTMLElement | null = null;
  private head = h('i', { class: 'studio-playhead', hidden: true });
  private status = h('output', { class: 'studio-selection-status', 'aria-live': 'polite' });
  private removeButton = h('button', { onclick: () => this.remove() }, t('music.deleteNote'));
  private undoButton = h('button', { onclick: () => this.undo() }, t('music.undo'));
  private blur = () => this.cancel();
  private hidden = () => { if (document.hidden) this.cancel(); };
  constructor(private options: RollOptions) {
    this.notes = options.notes.map(n => ({ ...n })); this.cursor.row = options.rows.length - 1;
    const keys = h('div', { class: 'studio-roll-keys' });
    options.rows.forEach(row => keys.append(h('div', { class: row.label.includes('#') ? 'black' : '' }, row.label)));
    const ruler = h('div', { class: 'studio-time-ruler' }, ...Array.from({ length: 8 }, (_, i) => h('span', {}, `${Math.floor((options.start + i * 4) / 16) + 1}.${i % 4 + 1}`)));
    this.element.style.setProperty('--rows', String(options.rows.length));
    this.element.append(h('div', { class: 'studio-roll-top' }, h('span', {}, '♪'), ruler), h('div', { class: 'studio-roll-body' }, keys, this.surface));
    this.tools.append(this.status,
      h('button', { 'aria-label': t('music.moveLeft'), onclick: () => this.adjust(-1, 0) }, '←'),
      h('button', { 'aria-label': t('music.moveRight'), onclick: () => this.adjust(1, 0) }, '→'),
      h('button', { 'aria-label': t('music.shorten'), onclick: () => this.adjust(0, -1) }, '−'),
      h('button', { 'aria-label': t('music.lengthen'), onclick: () => this.adjust(0, 1) }, '+'), this.removeButton, this.undoButton);
    this.surface.addEventListener('pointerdown', e => this.down(e));
    this.surface.addEventListener('pointermove', e => this.move(e));
    this.surface.addEventListener('pointerup', e => this.up(e));
    this.surface.addEventListener('pointercancel', e => { if (e.pointerId === this.drag?.id) this.cancel(); });
    this.surface.addEventListener('lostpointercapture', e => { if (e.pointerId === this.drag?.id) this.cancel(); });
    this.surface.addEventListener('contextmenu', e => this.context(e));
    this.surface.addEventListener('keydown', e => this.key(e));
    window.addEventListener('blur', this.blur); document.addEventListener('visibilitychange', this.hidden);
    this.draw();
  }
  private position(e: PointerEvent) {
    const rect = this.surface.getBoundingClientRect();
    return { step: Math.max(0, Math.min(31, Math.floor((e.clientX - rect.left) / rect.width * 32))), row: Math.max(0, Math.min(this.options.rows.length - 1, Math.floor((e.clientY - rect.top) / rect.height * this.options.rows.length))) };
  }
  private down(e: PointerEvent) {
    if (e.button !== 0 || this.drag || this.options.disabled) return;
    if ((e.target as HTMLElement).closest('.studio-note-menu')) return;
    this.options.beforeEdit(); this.closeMenu();
    const pos = this.position(e); this.cursor = pos;
    const node = (e.target as HTMLElement).closest<HTMLElement>('.studio-note');
    const note = node ? this.notes[Number(node.dataset.index)] : null;
    if (!note && this.options.rows[pos.row].disabled) return;
    e.preventDefault(); this.surface.focus({ preventScroll: true });
    if (note) {
      this.selected = note;
      const edge = (e.target as HTMLElement).dataset.edge;
      this.drag = { id: e.pointerId, mode: edge === 'left' || edge === 'right' ? edge : 'move', anchor: pos.step, original: { ...note }, preview: { ...note } };
    } else {
      const fresh = { at: this.options.start + pos.step, length: 1, frequency: this.options.rows[pos.row].frequency };
      this.selected = null; this.drag = { id: e.pointerId, mode: 'draw', anchor: pos.step, original: fresh, preview: { ...fresh } };
    }
    if (e.isTrusted) this.surface.setPointerCapture?.(e.pointerId); this.draw();
  }
  private move(e: PointerEvent) {
    const drag = this.drag; if (!drag || drag.id !== e.pointerId) return;
    const at = this.options.start + this.position(e).step, delta = this.position(e).step - drag.anchor;
    const original = drag.original;
    if (drag.mode === 'draw') drag.preview = { ...original, at: Math.min(at, original.at), length: Math.abs(at - original.at) + 1 };
    if (drag.mode === 'move') drag.preview.at = Math.max(0, Math.min(this.options.start + 31, original.at + delta));
    if (drag.mode === 'left') { const end = original.at + original.length; drag.preview.at = Math.max(this.options.start, Math.min(end - 1, original.at + delta)); drag.preview.length = end - drag.preview.at; }
    if (drag.mode === 'right') drag.preview.length = Math.max(1, Math.min(64, this.options.start + 32 - original.at, original.length + delta));
    this.draw();
  }
  private up(e: PointerEvent) {
    const drag = this.drag; if (!drag || drag.id !== e.pointerId) return;
    this.move(e); this.drag = null;
    const changed = drag.mode === 'draw' || drag.preview.at !== drag.original.at || drag.preview.length !== drag.original.length;
    if (changed) this.commit(placeNote(this.notes.filter(n => n !== this.selected), drag.preview.at, drag.preview.length, drag.preview.frequency), drag.preview);
    else this.draw();
    if (this.surface.hasPointerCapture?.(e.pointerId)) this.surface.releasePointerCapture(e.pointerId);
  }
  cancel() { this.drag = null; this.closeMenu(); this.draw(); }
  dispose() { this.cancel(); window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.hidden); }
  private commit(notes: SequenceNote[], select: SequenceNote | null) {
    this.history.push(this.notes.map(n => ({ ...n }))); this.notes = notes;
    this.selected = select ? notes.find(n => n.at === select.at && n.frequency === select.frequency) ?? null : null;
    this.options.change(notes); this.draw();
  }
  private undo() { const previous = this.history.pop(); if (!previous) return; this.options.beforeEdit(); this.notes = previous; this.selected = null; this.options.change(previous); this.draw(); }
  private remove() { if (!this.selected) return; this.options.beforeEdit(); this.commit(this.notes.filter(n => n !== this.selected), null); this.closeMenu(); this.surface.focus({ preventScroll: true }); }
  private adjust(move: number, length: number) {
    if (!this.selected) return; this.options.beforeEdit();
    const n = { ...this.selected, at: Math.max(0, this.selected.at + move), length: Math.max(1, Math.min(64, this.selected.length + length)) };
    this.commit(placeNote(this.notes.filter(note => note !== this.selected), n.at, n.length, n.frequency), n);
  }
  private key(e: KeyboardEvent) {
    if (e.target !== this.surface && !(e.target as HTMLElement).closest('.studio-note')) return;
    if (e.key === 'Escape') { this.cancel(); this.selected = null; this.draw(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) { e.preventDefault(); this.remove(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault(); const delta = e.key === 'ArrowLeft' ? -1 : 1;
      if (this.selected) this.adjust(e.shiftKey ? 0 : delta, e.shiftKey ? delta : 0);
      else { this.cursor.step = Math.max(0, Math.min(31, this.cursor.step + delta)); this.draw(); } return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.selected = null; this.cursor.row = Math.max(0, Math.min(this.options.rows.length - 1, this.cursor.row + (e.key === 'ArrowUp' ? -1 : 1))); this.draw(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); if (this.options.disabled || this.options.rows[this.cursor.row].disabled) return;
      this.options.beforeEdit(); const at = this.options.start + this.cursor.step;
      const existing = this.notes.find(n => n.at <= at && n.at + n.length > at && n.frequency === this.options.rows[this.cursor.row].frequency);
      if (existing) { this.selected = existing; this.draw(); }
      else { const n = { at, length: 4, frequency: this.options.rows[this.cursor.row].frequency }; this.commit(placeNote(this.notes, n.at, n.length, n.frequency), n); }
    }
  }
  private context(e: MouseEvent) {
    const node = (e.target as HTMLElement).closest<HTMLElement>('.studio-note'); if (!node) return;
    e.preventDefault(); this.options.beforeEdit(); this.selected = this.notes[Number(node.dataset.index)]; this.closeMenu(); this.draw();
    this.menu = h('div', { class: 'studio-note-menu', role: 'menu' }, h('button', { role: 'menuitem', onclick: () => this.remove() }, t('music.deleteNote')));
    const rect = this.surface.getBoundingClientRect();
    this.menu.style.left = `${Math.max(0, Math.min(rect.width - 150, e.clientX - rect.left))}px`;
    this.menu.style.top = `${Math.max(0, Math.min(rect.height - 48, e.clientY - rect.top))}px`;
    this.surface.append(this.menu); this.menu.querySelector('button')!.focus();
    this.menu.addEventListener('keydown', event => { if (event.key === 'Escape') { this.closeMenu(); this.surface.focus(); } });
  }
  private closeMenu() { this.menu?.remove(); this.menu = null; }
  private draw() {
    this.surface.querySelectorAll('.studio-note,.studio-cursor').forEach(n => n.remove());
    const displayed = this.drag ? this.notes.filter(n => n !== this.selected).concat(this.drag.preview) : this.notes;
    displayed.forEach(note => {
      const row = this.options.rows.findIndex(r => r.frequency === note.frequency);
      if (row < 0 || note.at >= this.options.start + 32 || note.at + note.length <= this.options.start) return;
      const left = Math.max(note.at, this.options.start), end = Math.min(note.at + note.length, this.options.start + 32);
      const index = this.notes.indexOf(note), selected = note === this.selected || note === this.drag?.preview;
      const el = h('div', { class: `studio-note ${selected ? 'selected' : ''}`, role: 'button', tabindex: -1, 'data-index': index, 'aria-label': `${this.options.rows[row].label}, ${note.length / 4} ${t('music.beats')}`, 'aria-pressed': String(selected), style: `left:${(left - this.options.start) / 32 * 100}%;width:${(end - left) / 32 * 100}%;top:${row / this.options.rows.length * 100}%;height:${100 / this.options.rows.length}%` },
        ...(note.at >= this.options.start ? [h('span', { class: 'studio-note-edge left', 'data-edge': 'left', 'aria-hidden': true }, '│')] : []),
        h('span', { class: 'studio-note-name', 'aria-hidden': true }, this.options.rows[row].label),
        ...(note.at + note.length <= this.options.start + 32 ? [h('span', { class: 'studio-note-edge right', 'data-edge': 'right', 'aria-hidden': true }, '│')] : []));
      this.surface.append(el);
    });
    if (!this.selected && !this.drag) this.surface.append(h('i', { class: 'studio-cursor', style: `left:${this.cursor.step / 32 * 100}%;top:${this.cursor.row / this.options.rows.length * 100}%;width:${100 / 32}%;height:${100 / this.options.rows.length}%` }));
    this.surface.append(this.head);
    const n = this.drag?.preview ?? this.selected;
    this.status.textContent = n ? `${this.options.rows.find(r => r.frequency === n.frequency)?.label ?? '♪'} · ${n.length / 4} ${t('music.beats')}` : t('music.selectNote');
    this.removeButton.disabled = !this.selected; this.undoButton.disabled = !this.history.length;
    this.tools.querySelectorAll<HTMLButtonElement>('button[aria-label]').forEach(b => b.disabled = !this.selected);
  }
  playback(quarter: number | null) {
    this.head.hidden = quarter === null || quarter < this.options.start || quarter >= this.options.start + 32;
    this.head.style.left = `${((quarter ?? 0) - this.options.start) / 32 * 100}%`;
    this.surface.querySelectorAll<HTMLElement>('.studio-note').forEach(el => { const n = this.notes[Number(el.dataset.index)]; el.classList.toggle('playing', !!n && quarter !== null && quarter >= n.at && quarter < n.at + n.length); });
  }
}
