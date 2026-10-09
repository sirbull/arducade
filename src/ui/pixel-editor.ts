// Editor for 1 bit pixel art with transparency, used for images and tiles.

import { t } from '../i18n/i18n';
import { pixelAt, type PixelRows } from '../project/model';
import { h } from './dom';

export type Tool = '1' | '0' | '.' | 'fill';

export class PixelEditor {
  el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private grid: string[][] = [];
  private tool: Tool = '1';
  /** Colour used by the fill tool: the last colour picked. */
  private color: '1' | '0' | '.' = '1';
  private drawing = false;
  private toolButtons = new Map<Tool, HTMLButtonElement>();

  constructor(
    private width: number,
    private height: number,
    rows: PixelRows,
    private onChange: (rows: PixelRows) => void,
  ) {
    this.canvas = h('canvas', { class: 'pixel-canvas', 'aria-label': t('pixel.canvas') });
    this.ctx = this.canvas.getContext('2d')!;
    const tools: { tool: Tool; label: string }[] = [
      { tool: '1', label: t('pixel.white') },
      { tool: '0', label: t('pixel.black') },
      { tool: '.', label: t('pixel.erase') },
      { tool: 'fill', label: t('pixel.fill') },
    ];
    const toolbar = h(
      'div',
      { class: 'pixel-tools', role: 'toolbar' },
      ...tools.map(({ tool, label }) => {
        const b = h('button', { class: `tool tool-${tool === '.' ? 'erase' : tool === 'fill' ? 'fill' : tool === '1' ? 'white' : 'black'}`, title: label, 'aria-label': label, onclick: () => this.setTool(tool) }, label);
        this.toolButtons.set(tool, b);
        return b;
      }),
      h('button', { onclick: () => this.transform('flipH') }, t('pixel.flipH')),
      h('button', { onclick: () => this.transform('flipV') }, t('pixel.flipV')),
      h('button', { onclick: () => this.transform('clear') }, t('pixel.clear')),
    );
    this.el = h('div', { class: 'pixel-editor' }, toolbar, h('div', { class: 'pixel-wrap' }, this.canvas));
    this.setRows(rows, width, height);
    this.setTool('1');

    const paint = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * this.width);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * this.height);
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
      if (this.tool === 'fill') {
        this.fill(x, y);
        return;
      }
      else if (this.grid[y][x] !== this.tool) {
        this.grid[y][x] = this.tool;
        this.draw();
      }
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.drawing = true;
      this.canvas.setPointerCapture(e.pointerId);
      paint(e);
    });
    this.canvas.addEventListener('pointermove', (e) => this.drawing && this.tool !== 'fill' && paint(e));
    const stop = () => {
      if (!this.drawing) return;
      this.drawing = false;
      this.onChange(this.rows());
    };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
  }

  setRows(rows: PixelRows, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => pixelAt(rows, x, y)));
    const cell = Math.max(4, Math.min(24, Math.floor(384 / Math.max(width, height))));
    this.canvas.width = width * cell;
    this.canvas.height = height * cell;
    this.draw();
  }

  rows(): PixelRows {
    return this.grid.map((r) => r.join(''));
  }

  private setTool(tool: Tool) {
    this.tool = tool;
    if (tool !== 'fill') this.color = tool;
    for (const [k, b] of this.toolButtons) b.classList.toggle('active', k === tool);
  }

  private transform(kind: 'flipH' | 'flipV' | 'clear') {
    if (kind === 'flipH') this.grid = this.grid.map((r) => [...r].reverse());
    else if (kind === 'flipV') this.grid = [...this.grid].reverse();
    else this.grid = this.grid.map((r) => r.map(() => '.'));
    this.draw();
    this.onChange(this.rows());
  }

  private fill(x: number, y: number) {
    const target = this.grid[y][x];
    if (target === this.color) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height || this.grid[cy][cx] !== target) continue;
      this.grid[cy][cx] = this.color;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    this.draw();
  }

  private draw() {
    const cw = this.canvas.width / this.width;
    const ch = this.canvas.height / this.height;
    const ctx = this.ctx;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.grid[y][x];
        if (c === '.') {
          // Checkerboard for transparent pixels.
          ctx.fillStyle = (x + y) % 2 ? '#3a3a3a' : '#2c2c2c';
        } else ctx.fillStyle = c === '1' ? '#f0f0f0' : '#000';
        ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }
    ctx.strokeStyle = 'rgba(128,128,128,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x++) {
      ctx.moveTo(x * cw + 0.5, 0);
      ctx.lineTo(x * cw + 0.5, this.canvas.height);
    }
    for (let y = 0; y <= this.height; y++) {
      ctx.moveTo(0, y * ch + 0.5);
      ctx.lineTo(this.canvas.width, y * ch + 0.5);
    }
    ctx.stroke();
  }
}

/** Resizes pixel rows, keeping the top left part. */
export function resizeRows(rows: PixelRows, width: number, height: number): PixelRows {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => pixelAt(rows, x, y)).join(''));
}
