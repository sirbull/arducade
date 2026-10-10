// The Images, Backgrounds, Tiles and Tile map tabs.

import { pixelsToDataUrl } from '../blocks/assets';
import { BUILTIN_KINDS } from '../engine/enums';
import { currentLanguage, kindName, t } from '../i18n/i18n';
import type { LibraryImage, LibraryTile } from '../project/library';
import { emptyPixels, localized, newId, type ImageAsset, type Project, type TileAsset, type TilemapAsset, type LevelLink } from '../project/model';
import { confirmDialog, promptDialog, openDialog } from './dialogs';
import { clear, h, toast } from './dom';
import { filmBadge, openImageLibrary, openTileLibrary } from './library-dialog';
import { PixelEditor, pixelToolIcon, resizeRows } from './pixel-editor';

// The engine keeps one solid bit per tile id in 32 bits; id 0 is empty.
export const MAX_TILES = 31;

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
  private previewTimer = 0;
  private previewFps = 8;
  private previewLoop = true;
  private refreshPreview: (() => void) | null = null;

  constructor(private root: HTMLElement, private host: AssetHost) {}

  render() {
    window.clearTimeout(this.previewTimer);
    this.refreshPreview = null;
    const p = this.host.project();
    if (!p.images.find((i) => i.id === this.selected)) this.selected = p.images[0]?.id ?? '';
    const img = p.images.find((i) => i.id === this.selected);
    if (img && this.frame >= img.frames.length) this.frame = 0;
    clear(this.root);

    const list = h(
      'div',
      { class: 'asset-list' },
      h('div', { class: 'asset-list-head' }, h('h3', {}, t('images.title')), h('button', { class: 'primary small', onclick: () => this.add() }, t('images.add'))),
      h('button', { class: 'small', onclick: () => openImageLibrary((item) => this.addFromLibrary(item)) }, t('library.open')),
      ...p.images.map((im) =>
        h(
          'button',
          { class: `asset-item ${im.id === this.selected ? 'active' : ''}`, onclick: () => ((this.selected = im.id), (this.frame = 0), this.render()) },
          h('img', { src: pixelsToDataUrl(im.frames[0], im.width, im.height, 2), alt: '' }),
          h('span', {}, im.name),
          im.frames.length > 1 ? filmBadge(im.frames.length) : null,
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
      this.refreshPreview?.();
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
      h('div', { class: 'sprite-studio' }, editor.el, this.animationPreview(img)),
      h('h4', {}, t('images.frames')),
      framesEl,
      h('p', { class: 'muted small' }, t('images.framesHelp')),
    ];
  }

  private animationPreview(img: ImageAsset): HTMLElement {
    let index = 0;
    let playing = false;
    const image = h('img', { alt: t('images.preview'), src: pixelsToDataUrl(img.frames[0], img.width, img.height, 4) });
    const counter = h('span', { class: 'muted small' });
    const show = () => {
      image.src = pixelsToDataUrl(img.frames[index], img.width, img.height, 4);
      counter.textContent = `${index + 1} / ${img.frames.length}`;
    };
    const stop = () => { window.clearTimeout(this.previewTimer); playing = false; play.textContent = t('images.previewPlay'); };
    const tick = () => {
      if (!playing || !image.isConnected || !this.root.classList.contains('active')) { stop(); return; }
      if (index + 1 >= img.frames.length && !this.previewLoop) { stop(); return; }
      index = (index + 1) % img.frames.length;
      show();
      this.previewTimer = window.setTimeout(tick, 1000 / this.previewFps);
    };
    const play = h('button', { class: 'primary', onclick: () => {
      if (playing) { stop(); return; }
      index = 0; show(); playing = true; play.textContent = t('sim.stop');
      this.previewTimer = window.setTimeout(tick, 1000 / this.previewFps);
    } }, t('images.previewPlay'));
    const loop = h('input', { type: 'checkbox', checked: this.previewLoop, onchange: () => { this.previewLoop = loop.checked; } });
    const fps = h('input', { type: 'number', min: 1, max: 24, step: 1, value: this.previewFps, 'aria-label': t('images.fps'), onchange: () => {
      this.previewFps = Math.max(1, Math.min(24, Math.round(Number(fps.value)) || 1)); fps.value = String(this.previewFps);
    } });
    show();
    this.refreshPreview = show;
    return h('div', { class: 'animation-preview' }, h('h4', {}, t('images.preview')),
      h('div', { class: 'animation-stage' }, image), counter, play,
      h('label', { class: 'inline' }, loop, t('images.loop')),
      h('label', { class: 'inline' }, t('images.fps'), fps));
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
    const img: ImageAsset = { id: newId('i'), name: uniqueName('sprite', p.images.map((i) => i.name)), width: 8, height: 8, frames: [emptyPixels(8, 8)] };
    p.images.push(img);
    this.selected = img.id;
    this.frame = 0;
    this.host.changed(true);
    this.render();
  }

  private addFromLibrary(item: LibraryImage) {
    const p = this.host.project();
    const name = uniqueName(localized(item.name, currentLanguage()), p.images.map((i) => i.name));
    const img: ImageAsset = { id: newId('i'), name, width: item.width, height: item.height, frames: item.frames.map((f) => [...f]) };
    p.images.push(img);
    this.selected = img.id;
    this.frame = 0;
    this.host.changed(true);
    this.render();
    toast(t('library.added', { name }));
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

// Backgrounds ------------------------------------------------------------

export class BackgroundsPane {
  private selected = '';

  constructor(private root: HTMLElement, private host: AssetHost) {}

  render() {
    const p = this.host.project();
    if (!p.backgrounds.find((b) => b.id === this.selected)) this.selected = p.backgrounds[0]?.id ?? '';
    const bg = p.backgrounds.find((b) => b.id === this.selected);
    clear(this.root);
    const list = h(
      'div',
      { class: 'asset-list' },
      h('div', { class: 'asset-list-head' }, h('h3', {}, t('backgrounds.title')), h('button', { class: 'primary small', onclick: () => this.add() }, t('backgrounds.add'))),
      h('p', { class: 'muted small' }, t('backgrounds.help')),
      ...p.backgrounds.map((b) =>
        h(
          'button',
          { class: `asset-item ${b.id === this.selected ? 'active' : ''}`, onclick: () => ((this.selected = b.id), this.render()) },
          h('img', { src: pixelsToDataUrl(b.frames[0], b.width, b.height, 32 / Math.max(b.width, b.height)), alt: '' }),
          h('span', {}, b.name),
          h('small', {}, `${b.width}x${b.height}`),
        ),
      ),
    );
    const editor = h('div', { class: 'asset-editor' });
    if (bg) editor.append(...this.editorFor(bg));
    else editor.append(h('p', { class: 'muted' }, t('backgrounds.empty')));
    this.root.append(list, editor);
  }

  private editorFor(bg: ImageAsset): HTMLElement[] {
    const p = this.host.project();
    const nameInput = h('input', { type: 'text', value: bg.name, 'aria-label': t('images.name') });
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim();
      if (!validName(name) || p.backgrounds.some((o) => o !== bg && o.name === name)) {
        toast(t('images.badName'), 'error');
        nameInput.value = bg.name;
        return;
      }
      bg.name = name;
      this.host.changed(true);
      this.render();
    });
    // The engine image format keeps width and height in one byte each.
    const size = (label: string, value: number, set: (v: number) => void) => {
      const input = h('input', { type: 'number', min: 8, max: 255, value, 'aria-label': label });
      input.addEventListener('change', () => {
        set(Math.max(8, Math.min(255, Math.round(Number(input.value)) || 8)));
        bg.frames = [resizeRows(bg.frames[0], bg.width, bg.height)];
        this.host.changed(true);
        this.render();
      });
      return h('label', { class: 'inline' }, label, input);
    };
    const editor = new PixelEditor(bg.width, bg.height, bg.frames[0], (rows) => {
      bg.frames[0] = rows;
      this.host.changed(true);
    });
    return [
      h(
        'div',
        { class: 'asset-props' },
        h('label', { class: 'inline' }, t('images.name'), nameInput),
        size(t('images.width'), bg.width, (v) => (bg.width = v)),
        size(t('images.height'), bg.height, (v) => (bg.height = v)),
        h('button', { onclick: () => this.duplicate(bg) }, t('ui.duplicate')),
        h('button', { class: 'danger', onclick: () => this.remove(bg) }, t('ui.delete')),
      ),
      editor.el,
    ];
  }

  private add() {
    const p = this.host.project();
    const bg: ImageAsset = { id: newId('b'), name: uniqueName('background', p.backgrounds.map((b) => b.name)), width: 128, height: 64, frames: [emptyPixels(128, 64)] };
    p.backgrounds.push(bg);
    this.selected = bg.id;
    this.host.changed(true);
    this.render();
  }

  private duplicate(bg: ImageAsset) {
    const p = this.host.project();
    const copy: ImageAsset = { ...structuredClone(bg), id: newId('b'), name: uniqueName(bg.name, p.backgrounds.map((b) => b.name)) };
    p.backgrounds.push(copy);
    this.selected = copy.id;
    this.host.changed(true);
    this.render();
  }

  private async remove(bg: ImageAsset) {
    if (!(await confirmDialog(t('backgrounds.deleteTitle'), t('backgrounds.deleteText', { name: bg.name }), t('ui.delete')))) return;
    const p = this.host.project();
    p.backgrounds = p.backgrounds.filter((b) => b !== bg);
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
      h('button', { class: 'small', onclick: () => openTileLibrary((tiles) => this.addFromLibrary(tiles)) }, t('library.open')),
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

  private addFromLibrary(items: LibraryTile[]) {
    const p = this.host.project();
    const have = new Set(p.tiles.map((tl) => tl.pixels.join('|')));
    const fresh = items.filter((tl) => !have.has(tl.pixels.join('|')));
    if (!fresh.length) {
      toast(t('library.exists'));
      return;
    }
    if (p.tiles.length + fresh.length > MAX_TILES) {
      toast(t('library.full', { max: MAX_TILES, free: MAX_TILES - p.tiles.length }), 'error');
      return;
    }
    const lang = currentLanguage();
    for (const tl of fresh) p.tiles.push({ id: newId('t'), name: localized(tl.name, lang), pixels: [...tl.pixels], solid: tl.solid });
    this.selected = p.tiles[p.tiles.length - 1].id;
    this.host.changed(true);
    this.render();
    toast(fresh.length === 1 ? t('library.added', { name: localized(fresh[0].name, lang) }) : t('library.addedSet', { n: fresh.length }));
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
  private pickingExit = false;
  private brush = 1;
  private tool: 'pencil' | 'erase' | 'line' | 'fill' = 'pencil';
  private histories = new WeakMap<TilemapAsset, { width: number; height: number; undo: number[][]; redo: number[][] }>();

  constructor(private root: HTMLElement, private host: AssetHost, private expanded = false) {}

  render() {
    const p = this.host.project();
    if (!p.tilemaps.find((m) => m.id === this.selected)) this.selected = p.tilemaps[0]?.id ?? '';
    const map = p.tilemaps.find((m) => m.id === this.selected);
    if (this.brush > p.tiles.length) this.brush = 0;
    clear(this.root);
    this.root.classList.add('levels-workspace');
    const overview = h('aside', { class: 'levels-overview' }, h('h2', {}, t('levels.title')),
      h('button', { class: 'primary', onclick: () => this.add() }, t('map.add')));
    for (const level of p.tilemaps) {
      overview.append(h('button', { class: `level-card ${level.id === this.selected ? 'active' : ''}`, onclick: () => { this.selected = level.id; this.pickingExit = false; this.render(); } },
        h('strong', {}, level.name), h('span', { class: 'muted small' }, `${level.width} × ${level.height}`),
        p.startLevelId === level.id ? h('span', { class: 'level-badge' }, t('levels.start')) : null,
        ...(level.links ?? []).map((link) => h('span', { class: 'muted small' }, `→ ${p.tilemaps.find((target) => target.id === link.target)?.name ?? '?'}`))));
    }
    const editor = h('div', { class: 'level-editor' });
    this.root.append(overview, editor);

    const head = h(
      'div',
      { class: 'map-head' },
      h('label', { class: 'inline' }, t('map.map'), this.mapSelect(p)),
      h('button', { class: 'small', onclick: () => this.duplicate(map) , disabled: !map }, t('ui.duplicate')),
      !this.expanded ? h('button', { class: 'small', onclick: () => this.openEditor() }, t('levels.expand')) : null,
    );
    editor.append(head);
    if (!map) {
      editor.append(h('p', { class: 'muted' }, t('map.empty')));
      return;
    }
    const size = (label: string, value: number, max: number, set: (v: number) => void) => {
      const input = h('input', { type: 'number', min: 1, max, value, 'aria-label': label });
      input.addEventListener('change', () => {
        set(Math.max(1, Math.min(max, Math.round(Number(input.value)) || 1)));
        map.links = map.links?.filter((link) => link.col < map.width && link.row < map.height);
        for (const level of p.tilemaps) for (const link of level.links ?? []) {
          if (link.target === map.id) {
            link.spawnCol = Math.min(link.spawnCol, map.width - 1);
            link.spawnRow = Math.min(link.spawnRow, map.height - 1);
          }
        }
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

    const start = h('input', { type: 'checkbox', checked: p.startLevelId === map.id });
    start.addEventListener('change', () => { p.startLevelId = start.checked ? map.id : undefined; this.host.changed(false); this.render(); });
    editor.append(h('label', { class: 'inline level-start' }, start, t('levels.start')));
    const connections = h('section', { class: 'level-connections' },
      h('div', { class: 'row' }, h('h3', {}, t('levels.connections')),
        h('button', { class: 'small', disabled: p.tilemaps.length < 2, onclick: () => { this.pickingExit = true; this.render(); } }, t('levels.addLink'))),
      h('p', { class: 'muted small' }, t('levels.help')));
    for (const link of map.links ?? []) {
      const target = p.tilemaps.find((level) => level.id === link.target);
      connections.append(h('div', { class: 'level-link row' },
        h('button', { class: 'link', onclick: () => this.editLink(map, link) }, `${map.name} (${link.col}, ${link.row}) → ${target?.name ?? '?'} (${link.spawnCol}, ${link.spawnRow})`),
        h('button', { class: 'danger small', 'aria-label': `${t('ui.delete')}: ${map.name} → ${target?.name ?? ''}`, onclick: () => {
          map.links = map.links?.filter((item) => item !== link); this.host.changed(false); this.render();
        } }, '×')));
    }
    editor.append(connections);
    if (this.pickingExit) editor.append(h('div', { class: 'row level-pick-exit', role: 'status' },
      h('strong', {}, t('levels.pickExit')),
      h('button', { class: 'small', onclick: () => { this.pickingExit = false; this.render(); } }, t('ui.cancel'))));
    const palette = h(
      'div',
      { class: 'palette', role: 'toolbar', 'aria-label': t('map.palette') },
      h('button', { class: `pal ${this.brush === 0 ? 'active' : ''}`, title: t('map.eraser'), onclick: () => ((this.brush = 0), this.render()) }, t('map.eraser')),
      ...p.tiles.map((tl, i) =>
        h(
          'button',
          { class: `pal ${this.brush === i + 1 ? 'active' : ''}`, title: tl.name, 'aria-label': tl.name, onclick: () => { this.brush = i + 1; if (this.tool === 'erase') this.tool = 'pencil'; this.render(); } },
          h('img', { src: pixelsToDataUrl(tl.pixels, 8, 8, 3), alt: '' }),
        ),
      ),
    );
    if (!p.tiles.length) palette.append(h('span', { class: 'muted small' }, t('map.noTiles')));
    editor.append(palette, this.mapCanvas(p, map), h('p', { class: 'muted small' }, t('map.help')));
  }

  private openEditor() {
    const dialog = openDialog(t('levels.expand'), { wide: true, onClose: () => { this.selected = pane.selected; this.pickingExit = false; this.render(); } });
    dialog.el.classList.add('level-dialog');
    const pane = new MapPane(dialog.body, this.host, true);
    pane.selected = this.selected;
    pane.render();
  }

  private duplicate(map: TilemapAsset | undefined) {
    if (!map) return;
    const project = this.host.project();
    const numbered = map.name.match(/^(.*?)([0-9]+)$/);
    let name = uniqueName(map.name, project.tilemaps.map((level) => level.name));
    if (numbered) {
      let index = Number(numbered[2]) + 1;
      while (project.tilemaps.some((level) => level.name === `${numbered[1]}${index}`)) index++;
      name = `${numbered[1]}${index}`;
    }
    const copy: TilemapAsset = { ...map, id: newId('m'), name, cells: [...map.cells], links: [] };
    project.tilemaps.push(copy);
    this.selected = copy.id;
    this.host.changed(true);
    this.render();
  }

  private editLink(map: TilemapAsset, existing?: LevelLink, point?: [number, number]) {
    const project = this.host.project();
    const targets = project.tilemaps.filter((level) => level !== map);
    if (!targets.length) return;
    const dialog = openDialog(t('levels.addLink'));
    const target = h('select', { 'aria-label': t('levels.target') }, ...targets.map((level) => h('option', { value: level.id, selected: level.id === existing?.target }, level.name)));
    const number = (value: number, label: string) => h('input', { type: 'number', min: 0, value, required: true, 'aria-label': label });
    const col = number(existing?.col ?? point?.[0] ?? Math.max(0, map.width - 2), t('levels.exitCol'));
    const row = number(existing?.row ?? point?.[1] ?? Math.max(0, map.height - 2), t('levels.exitRow'));
    const spawnCol = number(existing?.spawnCol ?? 1, t('levels.spawnCol'));
    const spawnRow = number(existing?.spawnRow ?? 1, t('levels.spawnRow'));
    const bounds = () => {
      const destination = targets.find((level) => level.id === target.value)!;
      col.max = String(map.width - 1); row.max = String(map.height - 1);
      spawnCol.max = String(destination.width - 1); spawnRow.max = String(destination.height - 1);
      for (const input of [spawnCol, spawnRow]) input.value = String(Math.min(Number(input.value), Number(input.max)));
    };
    target.addEventListener('change', bounds); bounds();
    const form = h('form', { class: 'form level-link-form' },
      h('p', { class: 'muted small' }, t('levels.coordinates')),
      ...[[t('levels.exitCol'), col], [t('levels.exitRow'), row], [t('levels.target'), target], [t('levels.spawnCol'), spawnCol], [t('levels.spawnRow'), spawnRow]].map(([label, input]) => h('label', {}, label as string, input as HTMLElement)));
    const save = () => {
      if (!form.reportValidity()) return;
      const link: LevelLink = { id: existing?.id ?? newId('exit'), col: Number(col.value), row: Number(row.value), target: target.value, spawnCol: Number(spawnCol.value), spawnRow: Number(spawnRow.value) };
      if ((map.links ?? []).some((item) => item !== existing && item.col === link.col && item.row === link.row)) { toast(t('levels.duplicateExit'), 'error'); return; }
      map.links = [...(map.links ?? []).filter((item) => item !== existing), link];
      this.host.changed(false); dialog.close(); this.render();
    };
    form.addEventListener('submit', (event) => { event.preventDefault(); save(); });
    dialog.body.append(form);
    dialog.footer.append(h('button', { onclick: () => dialog.close() }, t('ui.cancel')), h('button', { class: 'primary', onclick: save }, t('ui.ok')));
  }

  private mapSelect(p: Project) {
    const s = h('select', { 'aria-label': t('map.map') }, ...p.tilemaps.map((m) => h('option', { value: m.id, selected: m.id === this.selected }, m.name)));
    s.addEventListener('change', () => { this.selected = s.value; this.pickingExit = false; this.render(); });
    return s;
  }

  private mapCanvas(p: Project, map: TilemapAsset): HTMLElement {
    const scale = 3, cellSize = 8 * scale;
    const canvas = h('canvas', { class: 'map-canvas', width: map.width * cellSize, height: map.height * cellSize, tabindex: 0, 'aria-label': t('map.canvas') });
    const ctx = canvas.getContext('2d')!;
    const images = p.tiles.map(tl => {
      const image = new Image();
      image.src = pixelsToDataUrl(tl.pixels, 8, 8, scale);
      image.addEventListener('load', () => draw());
      return image;
    });
    type Point = [number, number];
    let hover: Point | null = null, start: Point | null = null, last: Point | null = null;
    let pointer: number | null = null, before: number[] = [], value = 0;
    let historyState = this.histories.get(map);
    if (!historyState || historyState.width !== map.width || historyState.height !== map.height) {
      historyState = { width: map.width, height: map.height, undo: [], redo: [] };
      this.histories.set(map, historyState);
    }
    const { undo, redo } = historyState;
    const tools = h('div', { class: 'pixel-tools map-tools', role: 'toolbar', 'aria-label': t('pixel.tools') });
    const buttons = new Map<string, HTMLButtonElement>();
    const button = (name: string, action: () => void) => {
      const b = h('button', { class: 'pixel-icon', title: t(`pixel.${name}`), 'aria-label': t(`pixel.${name}`), onclick: action }, pixelToolIcon(name));
      buttons.set(name, b); tools.append(b); return b;
    };
    const update = () => {
      for (const name of ['pencil', 'erase', 'line', 'fill']) {
        buttons.get(name)!.classList.toggle('active', this.tool === name);
        buttons.get(name)!.setAttribute('aria-pressed', String(this.tool === name));
      }
      buttons.get('undo')!.disabled = !undo.length;
      buttons.get('redo')!.disabled = !redo.length;
    };
    const line = (from: Point, to: Point): number[] => {
      let [x, y] = from;
      const [tx, ty] = to, dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
      const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
      let error = dx + dy;
      const cells: number[] = [];
      for (;;) {
        cells.push(y * map.width + x);
        if (x === tx && y === ty) return cells;
        const twice = error * 2;
        if (twice >= dy) { error += dy; x += sx; }
        if (twice <= dx) { error += dx; y += sy; }
      }
    };
    const region = (point: Point, replacement: number) => {
      const seed = point[1] * map.width + point[0], target = map.cells[seed] ?? 0;
      if (target === replacement) return [];
      const found = new Set<number>([seed]), queue = [seed];
      for (let n = 0; n < queue.length; n++) {
        const i = queue[n], x = i % map.width, y = Math.floor(i / map.width);
        for (const j of [x > 0 ? i - 1 : -1, x + 1 < map.width ? i + 1 : -1, y > 0 ? i - map.width : -1, y + 1 < map.height ? i + map.width : -1]) {
          if (j >= 0 && !found.has(j) && (map.cells[j] ?? 0) === target) { found.add(j); queue.push(j); }
        }
      }
      return queue;
    };
    const draw = () => {
      const previewValue = pointer === null ? (this.tool === 'erase' ? 0 : this.brush) : value;
      const preview = new Set(hover && !this.pickingExit ? this.tool === 'line' && start ? line(start, hover) : this.tool === 'fill' && pointer === null ? region(hover, previewValue) : [hover[1] * map.width + hover[0]] : []);
      for (let i = 0; i < map.width * map.height; i++) {
        const x = i % map.width * cellSize, y = Math.floor(i / map.width) * cellSize;
        const v = preview.has(i) ? previewValue : map.cells[i];
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, cellSize, cellSize);
        const image = images[v - 1];
        if (image?.complete && image.naturalWidth) ctx.drawImage(image, x, y);
        if (preview.has(i)) { ctx.fillStyle = 'rgba(201,163,107,0.25)'; ctx.fillRect(x, y, cellSize, cellSize); }
        ctx.strokeStyle = preview.has(i) ? '#c9a36b' : 'rgba(128,128,128,0.25)';
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize, cellSize);
      }
      for (const link of map.links ?? []) {
        ctx.strokeStyle = '#52d8c5'; ctx.lineWidth = 2;
        ctx.strokeRect(link.col * cellSize + 2, link.row * cellSize + 2, cellSize - 4, cellSize - 4);
        ctx.fillStyle = '#52d8c5'; ctx.font = 'bold 14px sans-serif';
        ctx.fillText('↗', link.col * cellSize + 5, link.row * cellSize + 18);
      }
      if (this.pickingExit && hover) {
        ctx.strokeStyle = '#52d8c5'; ctx.lineWidth = 2;
        ctx.strokeRect(hover[0] * cellSize + 2, hover[1] * cellSize + 2, cellSize - 4, cellSize - 4);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(201,163,107,0.9)'; ctx.strokeRect(0.5, 0.5, 128 * scale, 64 * scale);
    };
    const cancel = () => {
      if (pointer === null) return;
      map.cells = before; pointer = null; start = last = null; hover = null; draw();
    };
    for (const name of ['pencil', 'erase', 'line', 'fill'] as const) button(name, () => { cancel(); this.tool = name; update(); draw(); });
    const history = (forward: boolean) => {
      cancel(); const source = forward ? redo : undo, target = forward ? undo : redo;
      const cells = source.pop(); if (!cells) return;
      target.push(map.cells.slice()); map.cells = cells; update(); draw(); this.host.changed(false);
    };
    button('undo', () => history(false)); button('redo', () => history(true));
    const position = (e: PointerEvent, clamp = false): Point | null => {
      const rect = canvas.getBoundingClientRect();
      let x = Math.floor((e.clientX - rect.left) / rect.width * map.width), y = Math.floor((e.clientY - rect.top) / rect.height * map.height);
      if (clamp) { x = Math.max(0, Math.min(map.width - 1, x)); y = Math.max(0, Math.min(map.height - 1, y)); }
      return x >= 0 && y >= 0 && x < map.width && y < map.height ? [x, y] : null;
    };
    const paint = (point: Point) => {
      if (this.tool === 'pencil' || this.tool === 'erase') for (const i of line(last ?? point, point)) map.cells[i] = value;
      last = point;
    };
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      if (pointer !== null || (e.button !== 0 && e.button !== 2)) return;
      const point = position(e); if (!point) return;
      if (this.pickingExit) {
        e.preventDefault();
        this.pickingExit = false;
        this.render();
        this.editLink(map, undefined, point);
        return;
      }
      e.preventDefault(); canvas.focus(); canvas.setPointerCapture(e.pointerId);
      pointer = e.pointerId; before = map.cells.slice(); start = last = hover = point;
      value = this.tool === 'erase' || e.button === 2 ? 0 : this.brush;
      if (this.tool === 'fill') for (const i of region(point, value)) map.cells[i] = value;
      else paint(point);
      draw();
    });
    canvas.addEventListener('pointermove', e => {
      if (pointer !== null && pointer !== e.pointerId) return;
      hover = position(e, pointer !== null);
      if (pointer !== null && hover) paint(hover);
      draw();
    });
    canvas.addEventListener('pointerleave', () => { if (pointer === null) { hover = null; draw(); } });
    canvas.addEventListener('pointerup', e => {
      if (pointer !== e.pointerId) return;
      hover = position(e, true);
      if (hover) {
        if (this.tool === 'line' && start) for (const i of line(start, hover)) map.cells[i] = value;
        else paint(hover);
      }
      pointer = null; start = last = null;
      if (map.cells.some((v, i) => v !== before[i])) {
        undo.push(before); if (undo.length > 50) undo.shift(); redo.length = 0;
        this.host.changed(false);
      }
      hover = position(e); update(); draw();
    });
    canvas.addEventListener('pointercancel', e => { if (pointer === e.pointerId) cancel(); });
    canvas.addEventListener('lostpointercapture', cancel);
    canvas.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (this.pickingExit) { this.pickingExit = false; this.render(); } else cancel(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey); }
      const shortcuts: Record<string, typeof this.tool> = { b: 'pencil', e: 'erase', l: 'line', g: 'fill' };
      if (!e.ctrlKey && !e.metaKey && shortcuts[e.key.toLowerCase()]) { cancel(); this.tool = shortcuts[e.key.toLowerCase()]; update(); draw(); }
    });
    update(); draw();
    return h('div', {}, tools, h('div', { class: 'map-scroll' }, canvas));
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
    for (const level of p.tilemaps) level.links = level.links?.filter((link) => link.target !== map.id);
    if (p.startLevelId === map.id) delete p.startLevelId;
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
