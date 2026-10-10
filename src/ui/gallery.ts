// "New project" gallery with the templates from templates/index.json, and
// the list of the user's own projects.

import { currentLanguage, t } from '../i18n/i18n';
import { localized, parseProject, type Project } from '../project/model';
import { readCartridge } from '../project/cartridge';
import { projects as projectStore } from '../project/store';
import { gameThumbnail } from './build';
import type { PixelColor } from '../sim/runner';
import { confirmDialog, openDialog } from './dialogs';
import { clear, h, toast } from './dom';

let cache: Project[] | null = null;

/** Loads the templates listed in templates/index.json on the web server. */
export async function loadTemplates(): Promise<Project[]> {
  if (cache) return cache;
  const out: Project[] = [];
  try {
    const res = await fetch('templates/index.json', { cache: 'no-cache' });
    const list = res.ok ? ((await res.json()) as string[]) : [];
    for (const file of list) {
      try {
        const r = await fetch(`templates/${file}`, { cache: 'no-cache' });
        if (r.ok) out.push(file.endsWith('.png') ? readCartridge(new Uint8Array(await r.arrayBuffer())) : parseProject(await r.text()));
      } catch {
        // Skip broken templates.
      }
    }
  } catch {
    // No templates on this server.
  }
  cache = out;
  return out;
}

const thumbs = new Map<string, Promise<string>>();

export function thumbnail(p: Project, pixelColor: PixelColor = p.pixelColor ?? 'white'): Promise<string> {
  // Refresh the picture when either the project or simulator colour changes.
  const key = `${p.id}:${p.modified}:${pixelColor}`;
  let th = thumbs.get(key);
  if (!th) {
    th = gameThumbnail(p, 45, pixelColor).catch(() => '');
    thumbs.set(key, th);
  }
  return th;
}

export async function openGallery(onPick: (template: Project) => void, closable = true) {
  const d = openDialog(t('gallery.title'), { wide: true, closable });
  const grid = h('div', { class: 'gallery' }, h('p', { class: 'muted' }, t('ui.loading')));
  d.body.append(h('p', { class: 'muted' }, t('gallery.help')), grid);
  const templates = await loadTemplates();
  clear(grid);
  const lang = currentLanguage();
  for (const tp of templates) {
    const img = h('img', { alt: '', class: 'thumb' });
    void thumbnail(tp).then((src) => src && (img.src = src));
    grid.append(
      h(
        'button',
        { class: 'card', onclick: () => (d.close(), onPick(tp)) },
        img,
        h('strong', {}, localized(tp.template?.title, lang) || tp.name),
        h('span', { class: 'muted small' }, localized(tp.template?.description, lang)),
      ),
    );
  }
  if (!templates.length) grid.append(h('p', { class: 'muted' }, t('gallery.none')));
}

const STAR_ICON = (filled: boolean) =>
  `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="miter" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z"/></svg>`;

/** Toggles a project's star, which keeps it first in the project lists. */
export function starButton(p: Project, className: string, onToggle: () => void): HTMLElement {
  const label = `${t(p.starred ? 'projects.unstar' : 'projects.star')} ${p.name}`;
  const b = h('button', {
    class: `${className} project-star`,
    title: label,
    'aria-label': label,
    'aria-pressed': String(!!p.starred),
    onclick: async () => {
      p.starred = !p.starred;
      try {
        await projectStore.save(p);
      } catch {
        p.starred = !p.starred;
        toast(t('project.saveError'), 'error');
      }
      onToggle();
    },
  });
  b.innerHTML = STAR_ICON(!!p.starred);
  return b;
}

export async function openProjectsDialog(current: Project, onOpen: (p: Project) => void) {
  const currentId = current.id;
  const d = openDialog(t('projects.title'), { wide: true });
  const render = async () => {
    clear(d.body);
    const list = await projectStore.list().catch(() => [] as Project[]);
    if (!list.length) {
      d.body.append(h('p', { class: 'muted' }, t('projects.none')));
      return;
    }
    const fmt = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' });
    d.body.append(
      h(
        'ul',
        { class: 'project-list' },
        ...list.map((p) =>
          h(
            'li',
            { class: p.id === currentId ? 'active' : '' },
            h('button', { class: 'link', onclick: () => (d.close(), onOpen(p)) }, h('strong', {}, p.name), h('span', { class: 'muted project-date' }, ` ${fmt.format(p.modified)}`)),
            h('span', { class: 'project-list-actions' }, starButton(p, 'icon-btn', () => {
              // The open project is saved from memory, so keep its star in step.
              if (p.id === currentId) current.starred = p.starred;
              void render();
            }), h(
              'button',
              {
                class: 'icon-btn',
                title: t('ui.delete'),
                'aria-label': `${t('ui.delete')} ${p.name}`,
                disabled: p.id === currentId,
                onclick: async () => {
                  if (!(await confirmDialog(t('projects.deleteTitle'), t('projects.deleteText', { name: p.name }), t('ui.delete')))) return;
                  await projectStore.remove(p.id);
                  void render();
                },
              },
              '×',
            )),
          ),
        ),
      ),
    );
  };
  await render();
}
