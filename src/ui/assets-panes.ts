// The Images, Tiles and Tile map tabs.

import { pixelsToDataUrl } from '../blocks/assets';
import { BUILTIN_KINDS } from '../engine/enums';
import { kindName, t } from '../i18n/i18n';
import { emptyPixels, newId, type ImageAsset, type Project, type TileAsset, type TilemapAsset } from '../project/model';
import { confirmDialog, promptDialog } from './dialogs';
import { clear, h, toast } from './dom';
import { PixelEditor, resizeRows } from './pixel-editor';

export const MAX_TILES = 15;

export interface AssetHost {
  project(): Project;
  /** Called after assets change. structural is true when blocks may need new dropdown options. */
  changed(structural: boolean): void;
}

function uniqueName(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}${i}`)) return `${base}${i}`;
}

function validName(name: string): boolean {
  return /^[\p{L}_][\p{L}\p{N}_ ]*$/u.test(name);
}

// Images -----------------------------------------------------------------

export class ImagesPane {
  private selected = '';
  private frame = 0;

  constructor(private root: HTMLElement, private host: AssetHost) {}

  render() {
    const p = this.host.project();
    if (!p.images.find((i) => i.id === this.selected)) this.selected = p.images[0]?.id ?? '';
    const img = p.images.find((i) => i.id === this.selected);
    if (img && this.frame >= img.frames.length) this.frame = 0;
    clear(this.root);

    const list = h(
      'div',
      { class: 'asset-list' },
      h('div', { class: 'asset-list-head' }, h('h3', {}, t('images.title')), h('button', { class: 'primary small', onclick: () => this.add() }, t('images.add'))),
      ...p.images.map((im) =>
        h(
          'button',
          { class: `asset-item ${im.id === this.selected ? 'active' : ''}`, onclick: () => ((this.selected = im.id), (this.frame = 0), this.render()) },
          h('img', { src: pixelsToDataUrl(im.frames[0], im.width, im.height, 2), alt: '' }),
          h('span', {}, im.name),
          h('small', {}, `${im.width}x${im.height}`),
        ),
      ),
      this.kindsSection(p),
    );

    const editor = h('div', { class: 'asset-editor' });
    if (img) editor.append(...this.editorFor(img));
    else editor.append(h('p', { class: 'muted' }, t('images.empty')));
    this.root.append(list, editor);
  }

  private editorFor(img: ImageAsset): HTMLElement[] {
    const nameInput = h('input', { type: 'text', value: img.name, 'aria-label': t('images.name') });
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim();
      const p = this.host.project();
      if (!validName(name) || p.images.some((o) => o !== img && o.name === name)) {
        toast(t('images.badName'), 'error');
        nameInput.value = img.name;
        return;
      }
      img.name = name;
      this.host.changed(true);
      this.render();
    });
    const size = (label: string, value: number, set: (v: number) => void) => {
      const input = h('input', { type: 'number', min: 1, max: 64, value, 'aria-label': label });
      input.addEventListener('change', () => {
        const v = Math.max(1, Math.min(64, Math.round(Number(input.value)) || 1));
        set(v);
        img.frames = img.frames.map((f) => resizeRows(f, img.width, img.height));
        this.host.changed(true);
        this.render();
      });
      return h('label', { class: 'inline' }, label, input);
    };
    const editor = new PixelEditor(img.width, img.height, img.frames[this.frame], (rows) => {
      img.frames[this.frame] = rows;
      this.host.changed(true);
      this.renderFramesOnly(img, framesEl);
    });
    const framesEl = h('div', { class: 'frames' });
    this.renderFramesOnly(img, framesEl);

    return [
      h(
        'div',
        { class: 'asset-props' },
        h('label', { class: 'inline' }, t('images.name'), nameInput),
        size(t('images.width'), img.width, (v) => (img.width = v)),
        size(t('images.height'), img.height, (v) => (img.height = v)),
        h('button', { onclick: () => this.duplicate(img) }, t('ui.duplicate')),
        h('button', { class: 'danger', onclick: () => this.remove(img) }, t('ui.delete')),
      ),
      editor.el,
      h('h4', {}, t('images.frames')),
      framesEl,
      h('p', { class: 'muted small' }, t('images.framesHelp')),
    ];
  }

  private renderFramesOnly(img: ImageAsset, el: HTMLElement) {
    clear(el);
    img.frames.forEach((f, i) => {
      el.append(
        h(
          'button',
          { class: `frame ${i === this.frame ? 'active' : ''}`, title: t('images.frameN', { n: i + 1 }), onclick: () => ((this.frame = i), this.render()) },
          h('img', { src: pixelsToDataUrl(f, img.width, img.height, 2), alt: t('images.frameN', { n: i + 1 }) }),
        ),
      );
    });
    el.append(
      h('button', { onclick: () => (img.frames.splice(this.frame + 1, 0, [...img.frames[this.frame]]), (this.frame += 1), this.host.changed(true), this.render()) }, t('images.addFrame')),
    );
    if (img.frames.length > 1) {
      el.append(
        h(
          'button',
          { class: 'danger', onclick: () => (img.frames.splice(this.frame, 1), (this.frame = Math.max(0, this.frame - 1)), this.host.changed(true), this.render()) },
          t('images.deleteFrame'),
        ),
      );
    }
  }

  private kindsSection(p: Project): HTMLElement {
    const add = async () => {
      const name = await promptDialog(t('kinds.add'), t('kinds.name'));
      if (!name) return;
      const clean = name.replace(/\s+/g, '');
      if (!validName(clean) || [...BUILTIN_KINDS, ...p.kinds].includes(clean)) {
        toast(t('kinds.badName'), 'error');
        return;
      }
      p.kinds.push(clean);
      this.host.changed(true);
      this.render();
    };
    return h(
      'div',
      { class: 'kinds' },
      h('div', { class: 'asset-list-head' }, h('h3', {}, t('kinds.title')), h('button', { class: 'small', onclick: add }, t('kinds.addShort'))),
      h('p', { class: 'muted small' }, t('kinds.help')),
      h(
        'ul',
        {},
        ...BUILTIN_KINDS.map((k) => h('li', {}, kindName(k))),
        ...p.kinds.map((k) =>
          h(
            'li',
            {},
            k,
            h(
              'button',
              {
                class: 'icon-btn',
                title: t('ui.delete'),
                'aria-label': t('ui.delete'),
                onclick: () => {
                  p.kinds = p.kinds.filter((x) => x !== k);
                  this.host.changed(true);
                  this.render();
                },
              },
              '×',
            ),
          ),
        ),
      ),
    );
  }

  private add() {
    const p = this.host.project();
    const img: ImageAsset = { id: newId('i'), name: uniqueName('image', p.images.map((i) => i.name)), width: 8, height: 8, frames: [emptyPixels(8, 8)] };
    p.images.push(img);
    this.selected = img.id;
    this.frame = 0;
    this.host.changed(true);
    this.render();
  }

  private duplicate(img: ImageAsset) {
    const p = this.host.project();
    const copy: ImageAsset = { ...JSON.parse(JSON.stringify(img)), id: newId('i'), name: uniqueName(img.name, p.images.map((i) => i.name)) };
    p.images.push(copy);
    this.selected = copy.id;
    this.host.changed(true);
    this.render();
  }

  private async remove(img: ImageAsset) {
    if (!(await confirmDialog(t('images.deleteTitle'), t('images.deleteText', { name: img.name }), t('ui.delete')))) return;
    const p = this.host.project();
    p.images = p.images.filter((i) => i !== img);
    this.host.changed(true);
    this.render();
  }
}

// Tiles ------------------------------------------------------------------

export class TilesPane {
  private selected = '';

  constructor(private root: HTMLElement, private host: AssetHost) {}

  render() {
    const p = this.host.project();
    if (!p.tiles.find((x) => x.id === this.selected)) this.selected = p.tiles[0]?.id ?? '';
    const tile = p.tiles.find((x) => x.id === this.selected);
    clear(this.root);
    const list = h(
      'div',
      { class: 'asset-list' },
      h(
        'div',
        { class: 'asset-list-head' },
        h('h3', {}, t('tiles.title')),
        h('button', { class: 'primary small', disabled: p.tiles.length >= MAX_TILES, onclick: () => this.add() }, t('tiles.add')),
      ),
      h('p', { class: 'muted small' }, t('tiles.help', { max: MAX_TILES })),
      ...p.tiles.map((tl, i) =>
        h(
          'button',
          { class: `asset-item ${tl.id === this.selected ? 'active' : ''}`, onclick: () => ((this.selected = tl.id), this.render()) },
          h('img', { src: pixelsToDataUrl(tl.pixels, 8, 8, 3), alt: '' }),
          h('span', {}, `${i + 1}. ${tl.name}`),
          tl.solid ? h('small', {}, t('tiles.solid')) : null,
        ),
      ),
    );
    const editor = h('div', { class: 'asset-editor' });
    if (tile) editor.append(...this.editorFor(tile));
    else editor.append(h('p', { class: 'muted' }, t('tiles.empty')));
    this.root.append(list, editor);
  }

  private editorFor(tile: TileAsset): HTMLElement[] {
    const nameInput = h('input', { type: 'text', value: tile.name, 'aria-label': t('images.name') });
    nameInput.addEventListener('change', () => {
      tile.name = nameInput.value.trim() || tile.name;
      this.host.changed(true);
      this.render();
    });
    const solid = h('input', { type: 'checkbox', checked: tile.solid });
    solid.addEventListener('change', () => {
      tile.solid = solid.checked;
      this.host.changed(false);
      this.render();
    });
    const editor = new PixelEditor(8, 8, tile.pixels, (rows) => {
      tile.pixels = rows;
      this.host.changed(true);
    });
    return [
      h(
        'div',
        { class: 'asset-props' },
        h('label', { class: 'inline' }, t('images.name'), nameInput),
        h('label', { class: 'inline' }, solid, t('tiles.solidLabel')),
        h('button', { class: 'danger', onclick: () => this.remove(tile) }, t('ui.delete')),
      ),
      editor.el,
    ];
  }

  private add() {
    const p = this.host.project();
    if (p.tiles.length >= MAX_TILES) return;
    const tile: TileAsset = { id: newId('t'), name: uniqueName('tile', p.tiles.map((x) => x.name)), pixels: emptyPixels(8, 8), solid: true };
    p.tiles.push(tile);
    this.selected = tile.id;
    this.host.changed(true);
    this.render();
  }

  private async remove(tile: TileAsset) {
    if (!(await confirmDialog(t('tiles.deleteTitle'), t('tiles.deleteText', { name: tile.name }), t('ui.delete')))) return;
    const p = this.host.project();
    const index = p.tiles.indexOf(tile) + 1;
    p.tiles = p.tiles.filter((x) => x !== tile);
    // Tile numbers after the removed one move down by one.
    for (const m of p.tilemaps) m.cells = m.cells.map((c) => (c === index ? 0 : c > index ? c - 1 : c));
    this.host.changed(true);
    this.render();
  }
}

// Tile map ---------------------------------------------------------------

export class MapPane {
  private selected = '';
  private brush = 1;
  private painting = false;

  constructor(private root: HTMLElement, private host: AssetHost) {}

  render() {
    const p = this.host.project();
    if (!p.tilemaps.find((m) => m.id === this.selected)) this.selected = p.tilemaps[0]?.id ?? '';
    const map = p.tilemaps.find((m) => m.id === this.selected);
    if (this.brush > p.tiles.length) this.brush = 0;
    clear(this.root);

    const head = h(
      'div',
      { class: 'map-head' },
      h('label', { class: 'inline' }, t('map.map'), this.mapSelect(p)),
      h('button', { class: 'primary small', onclick: () => this.add() }, t('map.add')),
    );
    this.root.append(head);
    if (!map) {
      this.root.append(h('p', { class: 'muted' }, t('map.empty')));
      return;
    }
    const size = (label: string, value: number, max: number, set: (v: number) => void) => {
      const input = h('input', { type: 'number', min: 1, max, value, 'aria-label': label });
      input.addEventListener('change', () => {
        set(Math.max(1, Math.min(max, Math.round(Number(input.value)) || 1)));
        this.host.changed(false);
        this.render();
      });
      return h('label', { class: 'inline' }, label, input);
    };
    const nameInput = h('input', { type: 'text', value: map.name, 'aria-label': t('images.name') });
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim();
      if (!validName(name) || p.tilemaps.some((o) => o !== map && o.name === name)) {
        toast(t('images.badName'), 'error');
        nameInput.value = map.name;
        return;
      }
      map.name = name;
      this.host.changed(true);
      this.render();
    });
    head.append(
      h('label', { class: 'inline' }, t('images.name'), nameInput),
      size(t('map.width'), map.width, 255, (w) => resizeMap(map, w, map.height)),
      size(t('map.height'), map.height, 64, (hh) => resizeMap(map, map.width, hh)),
      h('button', { class: 'danger small', onclick: () => this.remove(map) }, t('ui.delete')),
    );

    const palette = h(
      'div',
      { class: 'palette', role: 'toolbar', 'aria-label': t('map.palette') },
      h('button', { class: `pal ${this.brush === 0 ? 'active' : ''}`, title: t('map.eraser'), onclick: () => ((this.brush = 0), this.render()) }, t('map.eraser')),
      ...p.tiles.map((tl, i) =>
        h(
          'button',
          { class: `pal ${this.brush === i + 1 ? 'active' : ''}`, title: tl.name, 'aria-label': tl.name, onclick: () => ((this.brush = i + 1), this.render()) },
          h('img', { src: pixelsToDataUrl(tl.pixels, 8, 8, 3), alt: '' }),
        ),
      ),
    );
    if (!p.tiles.length) palette.append(h('span', { class: 'muted small' }, t('map.noTiles')));
    this.root.append(palette, this.mapCanvas(p, map), h('p', { class: 'muted small' }, t('map.help')));
  }

  private mapSelect(p: Project) {
    const s = h('select', { 'aria-label': t('map.map') }, ...p.tilemaps.map((m) => h('option', { value: m.id, selected: m.id === this.selected }, m.name)));
    s.addEventListener('change', () => ((this.selected = s.value), this.render()));
    return s;
  }

  private mapCanvas(p: Project, map: TilemapAsset): HTMLElement {
    const scale = 3;
    const canvas = h('canvas', { class: 'map-canvas', width: map.width * 8 * scale, height: map.height * 8 * scale, 'aria-label': t('map.canvas') });
    const ctx = canvas.getContext('2d')!;
    const images = p.tiles.map((tl) => {
      const im = new Image();
      im.src = pixelsToDataUrl(tl.pixels, 8, 8, scale);
      return im;
    });
    const drawCell = (c: number, r: number) => {
      const v = map.cells[r * map.width + c] ?? 0;
      ctx.fillStyle = '#000';
      ctx.fillRect(c * 8 * scale, r * 8 * scale, 8 * scale, 8 * scale);
      const im = images[v - 1];
      if (v && im) {
        if (im.complete) ctx.drawImage(im, c * 8 * scale, r * 8 * scale);
        else im.addEventListener('load', () => drawCell(c, r), { once: true });
      }
      ctx.strokeStyle = 'rgba(128,128,128,0.25)';
      ctx.strokeRect(c * 8 * scale + 0.5, r * 8 * scale + 0.5, 8 * scale, 8 * scale);
    };
    const drawAll = () => {
      for (let r = 0; r < map.height; r++) for (let c = 0; c < map.width; c++) drawCell(c, r);
      // Show the size of one screen.
      ctx.strokeStyle = 'rgba(201,163,107,0.9)';
      ctx.strokeRect(0.5, 0.5, 128 * scale, 64 * scale);
    };
    drawAll();
    const paint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const c = Math.floor(((e.clientX - rect.left) / rect.width) * map.width);
      const r = Math.floor(((e.clientY - rect.top) / rect.height) * map.height);
      if (c < 0 || r < 0 || c >= map.width || r >= map.height) return;
      const i = r * map.width + c;
      if (map.cells[i] === this.brush) return;
      map.cells[i] = this.brush;
      drawCell(c, r);
    };
    canvas.addEventListener('pointerdown', (e) => {
      this.painting = true;
      canvas.setPointerCapture(e.pointerId);
      paint(e);
    });
    canvas.addEventListener('pointermove', (e) => this.painting && paint(e));
    const stop = () => {
      if (!this.painting) return;
      this.painting = false;
      drawAll();
      this.host.changed(false);
    };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    return h('div', { class: 'map-scroll' }, canvas);
  }

  private add() {
    const p = this.host.project();
    const map: TilemapAsset = { id: newId('m'), name: uniqueName('level', p.tilemaps.map((m) => m.name)), width: 32, height: 8, cells: Array(32 * 8).fill(0) };
    p.tilemaps.push(map);
    this.selected = map.id;
    this.host.changed(true);
    this.render();
  }

  private async remove(map: TilemapAsset) {
    if (!(await confirmDialog(t('map.deleteTitle'), t('map.deleteText', { name: map.name }), t('ui.delete')))) return;
    const p = this.host.project();
    p.tilemaps = p.tilemaps.filter((m) => m !== map);
    this.host.changed(true);
    this.render();
  }
}

function resizeMap(map: TilemapAsset, width: number, height: number) {
  const cells: number[] = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) cells.push(r < map.height && c < map.width ? map.cells[r * map.width + c] ?? 0 : 0);
  map.width = width;
  map.height = height;
  map.cells = cells;
}
