// The library of ready made sprites and tiles.

import { pixelsToDataUrl } from '../blocks/assets';
import { currentLanguage, t } from '../i18n/i18n';
import { LIBRARY_IMAGES, LIBRARY_TILE_GROUPS, type LibraryImage, type LibraryTile, type LibraryView } from '../project/library';
import { localized, type PixelRows } from '../project/model';
import { LIBRARY_BACKGROUNDS, type LibraryBackground } from '../project/background-library';
import { openDialog } from './dialogs';
import { clear, FILM_ICON, h, icon } from './dom';

let view: LibraryView = 'any';

const shows = (v: LibraryView) => view === 'any' || v === 'any' || v === view;

export function openBackgroundLibrary(onPick: (background: LibraryBackground) => void) {
  const d = openDialog(t('library.backgrounds'), { wide: true });
  const lang = currentLanguage();
  const content = h('div', { class: 'background-library-grid' });
  const detail = h('select', { 'aria-label': t('library.backgroundDetail') },
    ...['any', 'simple', 'medium', 'rich'].map(value => h('option', { value }, t(`library.detail.${value}`))));
  const layout = h('select', { 'aria-label': t('library.backgroundLayout') },
    ...['any', 'play', 'scene'].map(value => h('option', { value }, t(`library.layout.${value}`))));
  const render = () => {
    clear(content);
    const items = LIBRARY_BACKGROUNDS.filter(item =>
      (detail.value === 'any' || item.detail === detail.value) && (layout.value === 'any' || item.layout === layout.value));
    if (!items.length) content.append(h('div', {},
      h('p', { class: 'muted', role: 'status' }, t('library.noBackgrounds')),
      h('button', { class: 'small', onclick: () => { detail.value = 'any'; render(); } }, t('library.showAllDetails'))));
    for (const item of items) {
      content.append(h('button', { class: 'background-library-item', onclick: () => { onPick(item); d.close(); } },
        h('img', { src: pixelsToDataUrl(item.frames[0], item.width, item.height, 2), alt: '' }),
        h('strong', {}, localized(item.name, lang)),
        h('span', { class: 'muted' }, localized(item.genre, lang)),
        h('small', {}, `${t(`library.detail.${item.detail}`)} · ${t(`library.layout.${item.layout}`)}`)));
    }
  };
  detail.addEventListener('change', render);
  layout.addEventListener('change', render);
  d.body.append(h('p', { class: 'muted' }, t('library.helpBackgrounds')),
    h('div', { class: 'library-view' },
      h('label', { class: 'inline' }, t('library.backgroundDetail'), detail),
      h('label', { class: 'inline' }, t('library.backgroundLayout'), layout)), content);
  render();
}

export function filmBadge(frames: number): HTMLElement {
  const label = t('library.animated', { n: frames });
  return h('span', { class: 'film-badge', title: label, 'aria-label': label }, icon(FILM_ICON));
}

function viewSwitch(render: () => void): HTMLElement {
  const bar = h('div', { class: 'library-view', role: 'group', 'aria-label': t('library.view') });
  const draw = () => {
    clear(bar);
    for (const v of ['any', 'side', 'top'] as const) {
      bar.append(h('button', { class: `small ${view === v ? 'active' : ''}`, 'aria-pressed': String(view === v), onclick: () => ((view = v), draw(), render()) }, t(`library.view.${v}`)));
    }
  };
  draw();
  return bar;
}

export function openImageLibrary(onPick: (img: LibraryImage) => void) {
  const animated: { img: HTMLImageElement; item: LibraryImage }[] = [];
  let tick = 0;
  const timer = window.setInterval(() => {
    tick++;
    for (const { img, item } of animated) img.src = pixelsToDataUrl(item.frames[tick % item.frames.length], item.width, item.height, 4);
  }, 200);
  const d = openDialog(t('library.images'), { wide: true, onClose: () => window.clearInterval(timer) });
  const lang = currentLanguage();
  const content = h('div');
  const render = () => {
    clear(content);
    animated.length = 0;
    for (const group of [...new Set(LIBRARY_IMAGES.map((i) => i.group))]) {
      const items = LIBRARY_IMAGES.filter((i) => i.group === group && shows(i.view));
      if (!items.length) continue;
      content.append(
        h('h3', {}, t(`library.group.${group}`)),
        h('div', { class: 'library-grid' }, ...items.map((item) => {
          const img = h('img', { src: pixelsToDataUrl(item.frames[0], item.width, item.height, 4), alt: '' });
          if (item.frames.length > 1) animated.push({ img, item });
          return h('button', { class: 'library-item', onclick: () => onPick(item) },
            img, h('span', {}, localized(item.name, lang)), item.frames.length > 1 ? filmBadge(item.frames.length) : null);
        })),
      );
    }
  };
  d.body.append(h('p', { class: 'muted' }, t('library.helpImages')), viewSwitch(render), content);
  render();
}

/** One picture of a set's preview layout. */
function setPicture(preview: string[][], tiles: LibraryTile[]): string {
  const byId = new Map(tiles.map((tl) => [tl.id, tl.pixels]));
  const rows: PixelRows = [];
  for (const row of preview) for (let y = 0; y < 8; y++) rows.push(row.map((id) => byId.get(id)?.[y] ?? '........').join(''));
  return pixelsToDataUrl(rows, preview[0].length * 8, preview.length * 8, 3);
}

export function openTileLibrary(onPick: (tiles: LibraryTile[]) => void) {
  const d = openDialog(t('library.tiles'), { wide: true });
  const lang = currentLanguage();
  const content = h('div');
  const tileButton = (tl: LibraryTile) =>
    h('button', { class: 'library-tile', title: localized(tl.name, lang), 'aria-label': localized(tl.name, lang), onclick: () => onPick([tl]) },
      h('img', { src: pixelsToDataUrl(tl.pixels, 8, 8, 4), alt: '' }));
  const render = () => {
    clear(content);
    for (const group of LIBRARY_TILE_GROUPS.filter((g) => shows(g.view))) {
      const name = localized(group.name, lang);
      content.append(h('h3', {}, group.set ? t('library.set', { name }) : name));
      const tiles = h('div', { class: 'library-tiles' }, ...group.tiles.map(tileButton));
      if (!group.set || !group.preview) {
        content.append(tiles);
        continue;
      }
      content.append(h('div', { class: 'library-set' },
        h('img', { class: 'library-set-preview', src: setPicture(group.preview, group.tiles), alt: name }),
        h('div', { class: 'library-set-side' }, tiles,
          h('button', { class: 'primary small', onclick: () => onPick(group.tiles) }, t('library.addSet', { n: group.tiles.length })))));
    }
  };
  d.body.append(h('p', { class: 'muted' }, t('library.helpTiles')), viewSwitch(render), content);
  render();
}
