// Monochrome sprite and tile editor with explicit transparent pixels.
import { t } from '../i18n/i18n';
import { pixelAt, type PixelRows } from '../project/model';
import { h } from './dom';

type Color = '1' | '0' | '.';
export type Tool = 'pencil' | 'erase' | 'fill' | 'line' | 'rectangle' | 'select';
type EditorState = { rows: PixelRows; selection: Rect | null; tool: Tool };
type Rect = { x: number; y: number; w: number; h: number };
let pixelClipboard: PixelRows | null = null;
// "Erase matching color" stays on across editors and visits until the user turns it off.
const ERASE_MATCHING_KEY = 'ardublocks.pixelEraseMatching';
let eraseMatching = (() => { try { return localStorage.getItem(ERASE_MATCHING_KEY) === '1'; } catch { return false; } })();
const CLIPBOARD_PREFIX = 'ARDUBLOCKS_PIXELS\n';
const icons: Record<string, string> = {
  copy: 'M9 9h12v12H9z M15 9V3H3v12h6',
  paste: 'M9 5H5v16h14V5h-4 M9 3h6v4H9z',
  pencil: 'M4 16l-1 5 5-1L20 8l-4-4L4 16z M14 6l4 4',
  erase: 'M3 14l9-10 9 8-8 9H9l-6-7z M7 10l9 8 M13 21h9',
  fill: 'M4 12l8-8 8 8-8 8-8-8z M2 3l10 9 M20 15s-3 4-3 5a3 3 0 006 0c0-1-3-5-3-5z',
  line: 'M4 20L20 4 M3 18v3h3 M18 3h3v3', rectangle: 'M4 5h16v14H4z',
  select: 'M4 4h4 M11 4h2 M16 4h4v4 M20 11v2 M20 16v4h-4 M13 20h-2 M8 20H4v-4 M4 13v-2 M4 8V4',
  undo: 'M9 4L3 10l6 6 M3 10h11a7 7 0 010 14', redo: 'M15 4l6 6-6 6 M21 10H10a7 7 0 000 14',
  flipH: 'M12 3v18 M3 8l5 4-5 4z M21 8l-5 4 5 4z',
  flipV: 'M3 12h18 M8 3l4 5 4-5z M8 21l4-5 4 5z', clear: 'M4 6h16 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
};
export function pixelToolIcon(name: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', icons[name]); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.7'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path); return svg;
}

export class PixelEditor {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: Color[][] = [];
  private tool: Tool = 'pencil';
  private color: Color = '1';
  private drawing = false;
  private start = [0, 0];
  private last = [0, 0];
  private before: PixelRows = [];
  private strokeColor: Color = '1';
  private visited = new Set<string>();
  private undo: EditorState[] = [];
  private redo: EditorState[] = [];
  private toolButtons = new Map<Tool, HTMLButtonElement>();
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private zoom = 1;
  private showGrid = true;
  private sel: Rect | null = null;
  // Pasted or lifted pixels hovering over `base` until dropped; `before` is what undo restores.
  private floating: { pixels: Color[][]; base: PixelRows; before: PixelRows; beforeState?: EditorState } | null = null;
  private grab: number[] | null = null;
  private selectionBefore: EditorState | null = null;
  private pendingLift = false;
  private selectionMoved = false;

  constructor(private width: number, private height: number, rows: PixelRows, private onChange: (rows: PixelRows) => void) {
    this.canvas = h('canvas', { class: 'pixel-canvas', 'aria-label': t('pixel.canvas') });
    this.ctx = this.canvas.getContext('2d')!;
    const button = (name: string, action: () => void) => h('button', { class: 'pixel-icon', title: t(`pixel.${name}`), 'aria-label': t(`pixel.${name}`), onclick: action }, pixelToolIcon(name));
    const tools = h('div', { class: 'pixel-tools', role: 'toolbar', 'aria-label': t('pixel.tools') });
    for (const tool of ['pencil', 'erase', 'fill', 'line', 'rectangle', 'select'] as Tool[]) {
      const b = button(tool, () => this.setTool(tool)); this.toolButtons.set(tool, b); tools.append(b);
    }
    this.undoButton = button('undo', () => this.history(false));
    this.redoButton = button('redo', () => this.history(true));
    tools.append(button('copy', () => this.copy()), button('paste', () => { void this.pasteFromClipboard(); }), this.undoButton, this.redoButton, ...(['flipH', 'flipV', 'clear'] as const).map(k => button(k, () => this.transform(k))));
    const colors = h('div', { class: 'pixel-tools pixel-colors', role: 'toolbar', 'aria-label': t('pixel.colors') });
    const colorButtons: HTMLButtonElement[] = [];
    for (const [c, name] of [['1', 'white'], ['0', 'black'], ['.', 'transparent']] as const) {
      const b = h('button', { class: `pixel-swatch swatch-${name}`, title: t(`pixel.${name}`), 'aria-label': t(`pixel.${name}`), onclick: () => {
        this.color = c; if (this.tool === 'erase') this.setTool('pencil'); colorButtons.forEach((el, i) => { el.classList.toggle('active', i === colorButtons.indexOf(b)); el.setAttribute('aria-pressed', String(el === b)); });
      } }); colorButtons.push(b); colors.append(b);
    }
    colorButtons[0].classList.add('active'); colorButtons[0].setAttribute('aria-pressed', 'true');
    const toggle = h('input', { type: 'checkbox', checked: eraseMatching, onchange: () => {
      eraseMatching = toggle.checked;
      try { localStorage.setItem(ERASE_MATCHING_KEY, eraseMatching ? '1' : '0'); } catch { /* Kept only for this visit. */ }
    } });
    colors.append(h('label', { class: 'inline small' }, toggle, t('pixel.toggle')));
    const grid = h('input', { type: 'checkbox', checked: true, onchange: () => { this.showGrid = grid.checked; this.draw(); } });
    const zoomLabel = h('span', {}, '100%');
    const zoom = (delta: number) => { this.zoom = Math.max(0.5, Math.min(4, this.zoom + delta)); this.resizeCanvas(); zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`; };
    this.el = h('div', { class: 'pixel-editor', tabindex: 0 }, tools, colors, h('div', { class: 'pixel-wrap' }, this.canvas),
      h('div', { class: 'pixel-footer' }, h('span', {}, `${width} × ${height}`), h('label', { class: 'inline' }, grid, t('pixel.grid')),
        h('button', { 'aria-label': t('pixel.zoomOut'), onclick: () => zoom(-0.25) }, '−'), zoomLabel,
        h('button', { 'aria-label': t('pixel.zoomIn'), onclick: () => zoom(0.25) }, '+')));
    this.setRows(rows, width, height); this.setTool('pencil'); this.updateHistory();
    const outside = (event: PointerEvent) => {
      if (!this.el.isConnected) { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', outsideHistory); return; }
      if (event.target instanceof Node && !this.el.contains(event.target)) this.deselect();
      else if (event.target instanceof HTMLElement && event.target.closest('.pixel-wrap') && event.target !== this.canvas) this.deselect();
    };
    const outsideHistory = (event: KeyboardEvent) => {
      if (!this.el.isConnected || this.el.contains(event.target as Node) || this.isTextTarget(event.target)) return;
      const pane = this.el.closest('.pane');
      if (!pane?.classList.contains('active') || !pane.contains(event.target as Node)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault(); this.history(key === 'y' || event.shiftKey);
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', outsideHistory);
    this.el.addEventListener('copy', e => {
      if (this.isTextTarget(e.target)) return;
      const rows = this.selectionRows();
      pixelClipboard = rows;
      e.clipboardData?.setData('text/plain', CLIPBOARD_PREFIX + JSON.stringify(rows));
      e.preventDefault();
    });
    this.el.addEventListener('paste', e => {
      if (this.isTextTarget(e.target)) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const rows = this.decodeClipboard(text);
      if (rows) { e.preventDefault(); pixelClipboard = rows; this.paste(rows); }
      else if (!text && pixelClipboard) { e.preventDefault(); this.paste(pixelClipboard); }
    });
    this.el.addEventListener('keydown', e => {
      if (this.isTextTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (key === 'c') { e.preventDefault(); this.copy(); }
        else if (key === 'v' && pixelClipboard) { e.preventDefault(); this.paste(pixelClipboard); }
        else if (key === 'x') { e.preventDefault(); this.copy(); this.deleteSelection(); }
        else if (key === 'a') { e.preventDefault(); this.drop(); const before = this.snapshot(); this.sel = { x: 0, y: 0, w: this.width, h: this.height }; this.setTool('select'); this.record(before); this.draw(); }
        else if (key === 'z' || key === 'y') { e.preventDefault(); this.history(key === 'y' || e.shiftKey); }
        // With no internal copy, let the browser deliver its system paste event.
        return;
      }
      if (key === 'escape') { this.deselect(); return; }
      if (key === 'enter') { this.drop(); return; }
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); this.deleteSelection(); return; }
      const shortcuts: Record<string, Tool> = { b: 'pencil', p: 'pencil', e: 'erase', g: 'fill', l: 'line', u: 'rectangle', m: 'select' };
      if (shortcuts[key]) { e.preventDefault(); this.setTool(shortcuts[key]); }
    });
    const position = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return [Math.max(0, Math.min(this.width - 1, Math.floor((e.clientX - r.left) / r.width * this.width))), Math.max(0, Math.min(this.height - 1, Math.floor((e.clientY - r.top) / r.height * this.height)))];
    };
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointerdown', e => {
      if (this.drawing || (e.button !== 0 && e.button !== 2)) return;
      e.preventDefault(); this.el.focus(); this.drawing = true; this.canvas.setPointerCapture(e.pointerId);
      this.start = this.last = position(e);
      if (this.tool === 'select') return this.selectDown(this.start);
      this.before = this.rows(); this.visited.clear();
      this.strokeColor = this.tool === 'erase' || e.button === 2 ? '.' : this.color;
      if (this.tool === 'fill') this.fill(...this.start as [number, number]);
      else this.paintTo(this.start);
    });
    this.canvas.addEventListener('pointermove', e => { if (!this.drawing) return; if (this.tool === 'select') this.selectMove(position(e)); else if (this.tool !== 'fill') this.paintTo(position(e)); });
    this.canvas.addEventListener('pointerup', () => {
      if (!this.drawing) return;
      this.drawing = false;
      if (this.tool !== 'select') this.commit(this.before);
      else if (this.grab && !this.selectionMoved && this.sel?.w === 1 && this.sel.h === 1 && this.floating) this.deselect();
      else if (!this.floating && this.selectionBefore) {
        if (this.pendingLift && this.sel?.w === 1 && this.sel.h === 1) this.sel = null;
        this.record(this.selectionBefore); this.draw();
      }
      this.pendingLift = false; this.selectionBefore = null;
    });
    this.canvas.addEventListener('pointercancel', () => { if (!this.drawing) return; this.drawing = false; if (this.tool !== 'select') { this.load(this.before); this.draw(); } });
  }
  setRows(rows: PixelRows, width: number, height: number) { this.sel = null; this.floating = null; this.width = width; this.height = height; this.load(rows); this.undo = []; this.redo = []; this.resizeCanvas(); }
  rows(): PixelRows { return this.grid.map(r => r.join('')); }
  private load(rows: PixelRows) { this.grid = Array.from({ length: this.height }, (_, y) => Array.from({ length: this.width }, (_, x) => pixelAt(rows, x, y))); }
  private resizeCanvas() { const cell = Math.max(4, Math.min(48, Math.floor(384 / Math.max(this.width, this.height)))) * this.zoom; this.canvas.width = this.width * cell; this.canvas.height = this.height * cell; this.draw(); }
  private setTool(tool: Tool) { if (tool !== 'select' && this.sel) { this.drop(); this.sel = null; this.draw(); } this.tool = tool; for (const [k, b] of this.toolButtons) { b.classList.toggle('active', k === tool); b.setAttribute('aria-pressed', String(k === tool)); } }
  private put(x: number, y: number) {
    const key = `${x},${y}`; if (this.visited.has(key)) return; this.visited.add(key);
    this.grid[y][x] = eraseMatching && this.strokeColor !== '.' && this.grid[y][x] === this.strokeColor ? '.' : this.strokeColor;
  }
  private line(a: number[], b: number[]) {
    let [x, y] = a; const [tx, ty] = b; const dx = Math.abs(tx - x), dy = -Math.abs(ty - y), sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1; let err = dx + dy;
    while (true) { this.put(x, y); if (x === tx && y === ty) break; const e = 2 * err; if (e >= dy) { err += dy; x += sx; } if (e <= dx) { err += dx; y += sy; } }
  }
  private paintTo(p: number[]) {
    if (this.tool === 'line' || this.tool === 'rectangle') {
      this.load(this.before); this.visited.clear();
      if (this.tool === 'line') this.line(this.start, p);
      else { const [x, y] = this.start, [xx, yy] = p; this.line([x, y], [xx, y]); this.line([xx, y], [xx, yy]); this.line([xx, yy], [x, yy]); this.line([x, yy], [x, y]); }
    } else this.line(this.last, p);
    this.last = p; this.draw();
  }
  private snapshot(): EditorState { return { rows: this.rows(), selection: this.sel ? { ...this.sel } : null, tool: this.tool }; }
  private record(before: EditorState) {
    const after = this.snapshot();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.undo.push(before); if (this.undo.length > 100) this.undo.shift(); this.redo = []; this.updateHistory();
    if (before.rows.join('\n') !== after.rows.join('\n')) this.onChange(after.rows);
  }
  private commit(before: PixelRows) {
    if (before.join('\n') === this.rows().join('\n')) return;
    this.record({ rows: before, selection: this.sel ? { ...this.sel } : null, tool: this.tool });
  }
  private deselect() {
    this.drop();
    if (!this.sel) return;
    const before = this.snapshot(); this.sel = null; this.grab = null; this.pendingLift = false;
    this.record(before); this.draw();
  }
  private updateHistory() { this.undoButton.disabled = !this.undo.length; this.redoButton.disabled = !this.redo.length; }
  private history(redo: boolean) {
    this.drop();
    const source = redo ? this.redo : this.undo, dest = redo ? this.undo : this.redo;
    const state = source.pop(); if (!state) return;
    const before = this.rows(); dest.push(this.snapshot()); this.load(state.rows);
    this.sel = state.selection ? { ...state.selection } : null;
    this.grab = null; this.pendingLift = false;
    this.setTool(state.tool); this.draw(); this.updateHistory();
    if (before.join('\n') !== state.rows.join('\n')) this.onChange(this.rows());
  }
  private transform(kind: 'flipH' | 'flipV' | 'clear') { this.drop(); const before = this.rows(); if (kind === 'flipH') this.grid = this.grid.map(r => [...r].reverse()); else if (kind === 'flipV') this.grid.reverse(); else this.grid = this.grid.map(r => r.map(() => '.')); this.draw(); this.commit(before); }
  private selectDown(p: number[]) {
    this.selectionBefore = this.snapshot(); this.pendingLift = false; this.selectionMoved = false;
    const s = this.sel;
    if (s && p[0] >= s.x && p[0] < s.x + s.w && p[1] >= s.y && p[1] < s.y + s.h) {
      this.pendingLift = !this.floating;
      this.grab = [p[0] - s.x, p[1] - s.y]; return;
    }
    this.drop(); this.selectionBefore = this.snapshot();
    this.grab = null; this.sel = { x: p[0], y: p[1], w: 1, h: 1 }; this.draw();
  }
  private selectMove(p: number[]) {
    if (p[0] !== this.start[0] || p[1] !== this.start[1]) this.selectionMoved = true;
    if (this.grab && this.sel) {
      if (this.pendingLift) {
        if (p[0] === this.start[0] && p[1] === this.start[1]) return;
        const beforeState = this.snapshot(), before = this.rows(), pixels = this.region(this.sel); this.clearRegion(this.sel);
        this.floating = { pixels, base: this.rows(), before, beforeState }; this.pendingLift = false;
      }
      this.sel.x = p[0] - this.grab[0]; this.sel.y = p[1] - this.grab[1]; this.stamp();
    } else { const [x, y] = this.start; this.sel = { x: Math.min(x, p[0]), y: Math.min(y, p[1]), w: Math.abs(p[0] - x) + 1, h: Math.abs(p[1] - y) + 1 }; }
    this.draw();
  }
  private region(s: Rect): Color[][] { return Array.from({ length: s.h }, (_, y) => Array.from({ length: s.w }, (_, x) => this.grid[s.y + y]?.[s.x + x] ?? '.')); }
  private clearRegion(s: Rect) { for (let y = Math.max(0, s.y); y < Math.min(this.height, s.y + s.h); y++) for (let x = Math.max(0, s.x); x < Math.min(this.width, s.x + s.w); x++) this.grid[y][x] = '.'; }
  // Transparent pixels in the floating selection let the picture underneath show through.
  private stamp() {
    const f = this.floating!, s = this.sel!; this.load(f.base);
    f.pixels.forEach((row, dy) => row.forEach((c, dx) => { const x = s.x + dx, y = s.y + dy; if (c !== '.' && x >= 0 && y >= 0 && x < this.width && y < this.height) this.grid[y][x] = c; }));
  }
  private drop() { if (!this.floating) return; const { before, beforeState } = this.floating; this.floating = null; this.draw(); if (beforeState) this.record(beforeState); else this.commit(before); }
  private deleteSelection() {
    if (!this.sel) return;
    const before = this.floating?.before ?? this.rows();
    if (this.floating) this.load(this.floating.base); else this.clearRegion(this.sel);
    this.floating = null; this.draw(); this.commit(before);
  }
  private fill(x: number, y: number) {
    const target = this.grid[y][x]; const color = eraseMatching && target === this.strokeColor ? '.' : this.strokeColor; if (target === color) return;
    const stack = [[x, y]]; while (stack.length) { const [cx, cy] = stack.pop()!; if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height || this.grid[cy][cx] !== target) continue; this.grid[cy][cx] = color; stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); } this.draw();
  }
  private isTextTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input, textarea, select'));
  }
  private selectionRows(): PixelRows {
    return (this.floating?.pixels ?? this.region(this.sel ?? { x: 0, y: 0, w: this.width, h: this.height })).map(row => row.join(''));
  }
  private copy() {
    pixelClipboard = this.selectionRows();
    const text = CLIPBOARD_PREFIX + JSON.stringify(pixelClipboard);
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).catch(() => {});
  }
  private decodeClipboard(text: string): PixelRows | null {
    if (!text.startsWith(CLIPBOARD_PREFIX)) return null;
    try {
      const rows: unknown = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
      if (!Array.isArray(rows) || !rows.length || rows.length > 255 || typeof rows[0] !== 'string' || !rows[0].length || rows[0].length > 255) return null;
      return rows.every(row => typeof row === 'string' && row.length === rows[0].length && /^[.01]+$/.test(row)) ? rows : null;
    } catch { return null; }
  }
  private async pasteFromClipboard() {
    let rows = pixelClipboard;
    try { const text = await navigator.clipboard.readText(); rows = this.decodeClipboard(text) ?? rows; } catch { /* Internal clipboard also works between sprites and frames. */ }
    if (rows) this.paste(rows);
  }
  private paste(rows: PixelRows) {
    if (this.drawing) return;
    this.drop();
    const beforeState = this.snapshot(), before = this.rows();
    this.sel = { x: Math.max(0, this.sel?.x ?? 0), y: Math.max(0, this.sel?.y ?? 0), w: rows[0].length, h: rows.length };
    this.floating = { pixels: rows.map(row => [...row] as Color[]), base: before, before, beforeState };
    this.setTool('select'); this.stamp(); this.draw();
  }
  private draw() {
    const cw = this.canvas.width / this.width, ch = this.canvas.height / this.height, ctx = this.ctx;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) { const c = this.grid[y][x]; ctx.fillStyle = c === '.' ? ((x + y) % 2 ? '#444851' : '#30343b') : c === '1' ? '#fff' : '#000'; ctx.fillRect(x * cw, y * ch, cw, ch); }
    if (this.showGrid && cw >= 6) this.drawGrid(cw, ch);
    this.drawSelection(cw, ch);
  }
  private drawGrid(cw: number, ch: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(128,128,128,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= this.width; x++) { ctx.moveTo(x * cw + .5, 0); ctx.lineTo(x * cw + .5, this.canvas.height); }
    for (let y = 0; y <= this.height; y++) { ctx.moveTo(0, y * ch + .5); ctx.lineTo(this.canvas.width, y * ch + .5); } ctx.stroke();
    }
  private drawSelection(cw: number, ch: number) {
    if (!this.sel) return; const { x, y, w, h } = this.sel, ctx = this.ctx;
    ctx.lineWidth = 2;
    for (const [color, dash] of [['#000', []], ['#4da3ff', [4, 4]]] as [string, number[]][]) { ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.strokeRect(x * cw + 1, y * ch + 1, w * cw - 2, h * ch - 2); }
    ctx.setLineDash([]);
  }
}
export function resizeRows(rows: PixelRows, width: number, height: number): PixelRows { return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => pixelAt(rows, x, y)).join('')); }
