import { currentLanguage, t } from '../i18n/i18n';
import { GUIDES } from '../guides/world1';
import { guideProject, type Guide } from '../guides/guide';
import { localized, type Project } from '../project/model';
import { LIBRARY_IMAGES } from '../project/library';
import { pixelsToDataUrl } from '../blocks/assets';
import { gameThumbnail } from './build';
import { openDialog } from './dialogs';
import { openProjectSimulator } from './cartridge-simulator';
import { clear, h, icon, LOCK_ICON } from './dom';

export interface CatalogHost {
  stars: Record<string, number>;
  free: boolean;
  projects: Project[];
  setFree(value: boolean): void;
  open(guide: Guide, step?: number): void;
  home(): void;
}
export function isGuideOpen(index: number, stars: Record<string, number>, free: boolean) {
  return index === 0 || free || (stars[GUIDES[index - 1]?.id] ?? 0) > 0;
}
export function reachedStep(project?: Project): number {
  return Math.max(project?.guide?.step ?? 0, project?.guide?.reached ?? 0);
}
/** Always preview the finished solution in a fresh, unsaved project. */
export function finishedGuideProject(guide: Guide, lang = currentLanguage()): Project {
  const project = guideProject(guide, lang);
  project.blocks = guide.steps.at(-1)!.solution;
  return project;
}

const previews = new Map<string, Promise<string>>();
function preview(guide: Guide): Promise<string> {
  if (!previews.has(guide.id)) {
    const project = finishedGuideProject(guide, 'en');
    previews.set(guide.id, gameThumbnail(project, 15).catch(() => ''));
  }
  return previews.get(guide.id)!;
}
function artwork(guide: Guide, className: string): HTMLElement {
  return h('div', { class: className, 'aria-hidden': 'true' }, ...guide.images.map(id => {
    const im = LIBRARY_IMAGES.find(im => im.id === id)!;
    return h('img', { src: pixelsToDataUrl(im.frames[0], im.width, im.height, 4), alt: '' });
  }));
}

export function renderGuideCatalog(root: HTMLElement, host: CatalogHost) {
  clear(root);
  const lang = currentLanguage();
  const projectFor = (g: Guide) => host.projects.find(p => p.guide?.id === g.id);
  const open = (index: number) => isGuideOpen(index, host.stars, host.free);
  const completed = GUIDES.filter(g => (host.stars[g.id] ?? 0) > 0).length;
  const content = h('div', { class: 'guide-catalog' });
  const heading = h('h1', { tabindex: '-1' }, t('guide.worldTitle'));
  const free = h('input', { type: 'checkbox', checked: host.free, onchange: () => {
    host.free = free.checked;
    host.setFree(free.checked);
    renderContent();
  } });
  const body = h('div', { class: 'catalog-body' });
  content.append(h('div', { class: 'catalog-heading' },
    h('div', {}, h('span', { class: 'catalog-eyebrow' }, t('guide.worldEyebrow')), heading,
      h('p', { class: 'muted' }, t('guide.worldHelp'))),
    h('button', { onclick: host.home }, t('guide.worldBack'))),
    h('div', { class: 'catalog-toolbar' }, h('span', { class: 'muted small' }, t('guide.catalogCompleted', { n: completed, total: GUIDES.length })),
      h('label', { class: 'inline' }, free, t('guide.free'))), body);
  root.append(content);

  function details(index: number) {
    const g = GUIDES[index];
    const project = projectFor(g);
    const reached = reachedStep(project);
    const chapters = g.chapters ?? [{ start: 0, title: g.title }];
    const d = openDialog(localized(g.title, lang), { wide: true });
    d.el.classList.add('catalog-dialog');
    const launch = (step?: number) => { d.close(); host.open(g, step); };
    d.body.append(h('p', { class: 'catalog-description' }, localized(g.description, lang)),
      artwork(g, 'catalog-assets'), h('p', { class: 'muted small' }, t('guide.worldSprites')),
      h('h3', {}, t('guide.worldParts')), h('p', { class: 'muted small' }, t('guide.worldPartsHelp')));
    const parts = h('div', { class: 'catalog-parts' });
    chapters.forEach((chapter, i) => {
      const end = chapters[i + 1]?.start ?? g.steps.length;
      const done = reached >= end;
      const available = open(index) && chapter.start <= reached;
      parts.append(h('button', { class: `catalog-part ${done ? 'done' : ''}`, disabled: !available, onclick: () => launch(chapter.start) },
        h('span', { class: 'catalog-part-number', 'aria-hidden': 'true' }, done ? '✓' : available ? String(i + 1) : icon(LOCK_ICON)),
        h('span', {}, h('strong', {}, localized(chapter.title, lang)),
          h('span', { class: 'muted small' }, t('guide.worldPartSteps', { from: chapter.start + 1, to: end })))));
    });
    d.body.append(parts);
    if (!open(index)) d.body.append(h('p', { class: 'catalog-lock-note' }, t('guide.worldUnlock', { name: localized(GUIDES[index - 1].title, lang) })));
    d.footer.append(h('button', { onclick: () => d.close() }, t('ui.close')),
      h('button', { class: 'primary catalog-try', onclick: () => openProjectSimulator(finishedGuideProject(g, lang), localized(g.title, lang)) }, t('guide.tryProject')),
      h('button', { class: 'primary catalog-start', disabled: !open(index), onclick: () => launch() }, t(project ? 'guide.worldContinue' : 'guide.worldStart')));
  }
  function card(g: Guide, index: number, compact: boolean) {
    const project = projectFor(g);
    const stars = host.stars[g.id] ?? 0;
    const progress = stars ? g.steps.length : Math.min(g.steps.length, reachedStep(project));
    const title = localized(g.title, lang);
    const card = h('button', { class: `course-card ${compact ? 'compact' : ''} ${open(index) ? 'open' : 'locked'} ${stars ? 'done' : ''}`,
      'aria-label': `${g.number} ${title}, ${t(stars ? 'guide.worldDone' : open(index) ? 'guide.worldOpen' : 'guide.locked')}`,
      'aria-haspopup': 'dialog', onclick: () => details(index) });
    if (compact) {
      card.append(h('img', { class: 'course-thumbnail', src: `${import.meta.env.BASE_URL}images/guides/${g.id}.jpg`, alt: '', loading: 'lazy', decoding: 'async' }));
    } else {
      const cover = artwork(g, 'course-cover');
      const img = h('img', { class: 'course-game-preview', alt: '' });
      cover.append(img);
      void preview(g).then(src => { if (src && cover.isConnected) { img.src = src; cover.classList.add('has-preview'); } });
      card.append(cover);
    }
    const status = h('span', { class: 'course-status' }, stars ? '★'.repeat(stars) : open(index) ? '→' : icon(LOCK_ICON));
    card.append(h('div', { class: 'course-card-heading' }, h('span', { class: 'catalog-eyebrow' }, g.number), status),
      h('strong', { class: 'course-card-title' }, title),
      h('span', { class: 'course-card-description muted' }, localized(g.description, lang)),
      h('span', { class: 'course-card-meta muted small' }, t('guide.catalogProgress', { n: progress, total: g.steps.length })),
      h('progress', { class: 'course-progress', max: g.steps.length, value: progress, 'aria-label': t('guide.catalogProgress', { n: progress, total: g.steps.length }) }));
    return card;
  }
  function renderContent() {
    clear(body);
    const recent = [...host.projects].sort((a, b) => b.modified - a.modified).find(p => {
      const i = GUIDES.findIndex(g => g.id === p.guide?.id);
      return i >= 0 && open(i) && !p.guide?.done && !(host.stars[GUIDES[i].id] > 0);
    });
    const nextIndex = recent ? GUIDES.findIndex(g => g.id === recent.guide?.id) : GUIDES.findIndex((g, i) => open(i) && !(host.stars[g.id] > 0));
    if (nextIndex >= 0) {
      const g = GUIDES[nextIndex];
      const project = projectFor(g);
      body.append(h('section', { class: 'catalog-recommendation' },
        artwork(g, 'catalog-recommendation-art'),
        h('div', { class: 'catalog-recommendation-copy' }, h('span', { class: 'catalog-eyebrow' }, t(project ? 'guide.catalogResume' : 'guide.catalogNext')),
          h('h2', {}, localized(g.title, lang)), h('p', { class: 'muted' }, localized(g.description, lang))),
        h('button', { class: 'primary catalog-resume', onclick: () => host.open(g) }, t(project ? 'guide.worldContinue' : 'guide.worldStart'))));
    }
    for (const [from, to, key] of [[0, 5, 'guide.catalogBasics'], [5, GUIDES.length, 'guide.catalogProjects']] as const) {
      const section = h('section', { class: 'catalog-section' }, h('h2', {}, t(key)));
      const grid = h('div', { class: `course-grid ${from === 0 ? 'course-grid-basics' : ''}` });
      GUIDES.slice(from, to).forEach((g, i) => grid.append(card(g, from + i, from === 0)));
      section.append(grid); body.append(section);
    }
  }
  renderContent(); heading.focus();
}
