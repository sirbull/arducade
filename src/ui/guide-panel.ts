// The guide panel next to the simulator: the text and picture of the current
// step, a checklist that ticks off as the user builds, Help, and Next.

import * as Blockly from 'blockly/core';
import { currentLanguage, t } from '../i18n/i18n';
import { passing, type Guide, type GuideContext } from '../guides/guide';
import { GUIDES } from '../guides/world1';
import { runChecks } from '../guides/runtime';
import { localized, type Project } from '../project/model';
import { openDialog } from './dialogs';
import { clear, h } from './dom';
import { BLOCK_RENDERER, blocklyTheme, type ThemeId } from './themes';

type Json = Record<string, unknown>;

export interface GuideHost {
  project(): Project;
  theme(): ThemeId;
  stars(): Record<string, number>;
  saveStars(id: string, stars: number): void;
  /** The guide state in the project changed and should be saved. */
  changed(): void;
  openLevel(g: Guide): void;
  home(): void;
}

/** A small read only workspace that shows blocks as a picture. */
export function blockPicture(el: HTMLElement, blocks: Json[], theme: ThemeId, maxHeight: number, overview = false): Blockly.WorkspaceSvg {
  const ws = Blockly.inject(el, {
    readOnly: true,
    theme: blocklyTheme(theme),
    renderer: 'geras',
    rendererOverrides: BLOCK_RENDERER,
    move: { scrollbars: false, drag: true, wheel: true },
    zoom: { controls: false, wheel: false, startScale: 0.8, minScale: overview ? 0.05 : 0.3 },
    sounds: false,
    media: 'blockly-media/',
  });
  if (overview) Blockly.Events.disable();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks } }, ws);
    ws.cleanUp();
  } finally {
    if (overview) Blockly.Events.enable();
  }
  const fit = async () => {
    if (!el.isConnected) return;
    if (overview) {
      const tops = ws.getTopBlocks(true);
      const widths = tops.map(block => block.getHeightWidth().width);
      const columnWidth = Math.max(...widths) + 48;
      const rows = Math.ceil(tops.length / 3);
      const heights = Array.from({ length: rows }, (_, row) => Math.max(...tops.slice(row * 3, row * 3 + 3).map(block => block.getHeightWidth().height)) + 48);
      Blockly.Events.disable();
      try {
        tops.forEach((block, i) => {
          const pos = block.getRelativeToSurfaceXY();
          block.moveBy((i % 3) * columnWidth - pos.x, heights.slice(0, Math.floor(i / 3)).reduce((a, b) => a + b, 0) - pos.y);
        });
      } finally { Blockly.Events.enable(); }
    }
    if (overview) await Blockly.renderManagement.finishQueuedRenders();
    if (!el.isConnected) return;
    const bounds = overview ? ws.getCanvas().getBBox() : undefined;
    const box = bounds ? { left: bounds.x, top: bounds.y, right: bounds.x + bounds.width, bottom: bounds.y + bounds.height } : ws.getBlocksBoundingBox();
    // Shrink wide blocks to fit the width, but never above the normal size.
    ws.setScale(Math.max(overview ? 0.05 : 0.4, Math.min(0.8, (el.clientWidth - 24) / Math.max(1, box.right - box.left), ...(overview ? [(maxHeight - 28) / Math.max(1, box.bottom - box.top)] : []))));
    el.style.height = `${Math.min(maxHeight, Math.max(60, (box.bottom - box.top) * ws.scale + 28))}px`;
    Blockly.svgResize(ws);
    ws.scroll(12 - box.left * ws.scale, 12 - box.top * ws.scale);
  };
  if (overview) void Blockly.renderManagement.finishQueuedRenders().then(fit);
  else void fit();
  return ws;
}

export class GuidePanel {
  private played = 0;
  private pressed = 0;
  private picture?: Blockly.WorkspaceSvg;
  private checklist?: HTMLElement;
  private nextButton?: HTMLButtonElement;
  private allOk = false;
  private runtimeKey = '';
  private runtime?: boolean[];
  private runtimeTimer?: ReturnType<typeof setTimeout>;
  private runtimeGeneration = 0;
  private visit = '';

  constructor(private el: HTMLElement, private host: GuideHost) {}

  private guide(): Guide | undefined {
    const state = this.host.project().guide;
    return state && GUIDES.find((g) => g.id === state.id);
  }

  get active(): boolean {
    return !!this.guide();
  }

  /** The game was started in the simulator. */
  onPlay() {
    this.played++;
    this.update();
  }

  onInput(buttons: number) {
    if (!buttons || (this.pressed | buttons) === this.pressed) return;
    this.pressed |= buttons;
    this.update();
  }

  private context(): GuideContext {
    const project = this.host.project();
    return { blocks: project.blocks as Json, project, played: this.played, pressed: this.pressed, runtime: this.runtime };
  }

  /** Draws the panel for the current step. */
  render() {
    this.picture?.dispose();
    this.picture = undefined;
    this.checklist = undefined;
    this.nextButton = undefined;
    this.allOk = false;
    clear(this.el);
    const g = this.guide();
    this.el.hidden = !g;
    if (!g) return;
    const state = this.host.project().guide!;
    const visit = `${this.host.project().id}:${g.id}:${state.step}`;
    if (visit !== this.visit) {
      this.visit = visit;
      this.played = 0;
      this.pressed = 0;
    }
    const lang = currentLanguage();
    const total = g.steps.length;
    const head = h('div', { class: 'guide-head' },
      h('span', { class: 'guide-badge' }, g.number),
      h('h3', {}, localized(g.title, lang)),
      h('span', { class: 'muted small' }, state.step < total ? t('guide.step', { n: state.step + 1, total }) : ''));
    const dots = h('div', { class: 'guide-dots', 'aria-hidden': 'true' },
      ...g.steps.map((_, i) => h('span', { class: i < state.step ? 'done' : i === state.step ? 'current' : '' })));
    this.el.append(head, dots);
    if (state.step >= total) {
      this.renderEnd(g);
      return;
    }
    const step = g.steps[state.step];
    const chapter = g.chapters?.slice().reverse().find((c) => c.start <= state.step);
    if (chapter) this.el.append(h('p', { class: 'guide-chapter muted small' }, localized(chapter.title, lang)));
    this.el.append(h('p', { class: 'guide-text' }, localized(step.text, lang)));
    if (step.show) {
      const pic = h('div', { class: 'guide-picture', role: 'img', 'aria-label': t('guide.picture') });
      this.el.append(h('p', { class: 'muted small guide-label' }, t('guide.picture')), pic);
      this.picture = blockPicture(pic, step.show, this.host.theme(), 220);
    }
    this.checklist = h('ul', { class: 'guide-checks', 'aria-live': 'polite' });
    this.nextButton = h('button', { class: 'primary', disabled: true, onclick: () => this.go(state.step + 1) }, t('guide.next'));
    this.el.append(this.checklist, h('div', { class: 'guide-actions' },
      h('button', { disabled: state.step === 0, onclick: () => this.go(state.step - 1) }, t('guide.back')),
      h('button', { onclick: () => this.help() }, t('guide.help')),
      this.nextButton));
    this.update();
  }

  private renderEnd(g: Guide) {
    const state = this.host.project().guide!;
    const stars = this.host.stars()[g.id] ?? 0;
    if (state.done) {
      this.el.append(h('p', { class: 'guide-stars', 'aria-label': t('guide.stars', { n: stars }) }, '★'.repeat(stars) + '☆'.repeat(Math.max(0, (g.bonus ? 2 : 1) - stars))),
        h('p', { class: 'guide-text' }, t('guide.finished')));
    } else {
      this.el.append(h('p', { class: 'guide-text' }, t('guide.almost')));
    }
    if (g.bonus) {
      this.checklist = h('ul', { class: 'guide-checks' });
      this.el.append(h('p', { class: 'muted small guide-label' }, t('guide.bonus')), this.checklist);
    }
    const next = GUIDES[GUIDES.indexOf(g) + 1];
    const actions = h('div', { class: 'guide-actions' }, h('button', { onclick: () => this.go(state.step - 1) }, t('guide.back')));
    if (!state.done) actions.append(h('button', { class: 'primary', onclick: () => this.finish(g) }, t('guide.finish')));
    else {
      actions.append(h('button', { onclick: () => this.host.home() }, t('guide.toHome')));
      if (next) actions.append(h('button', { class: 'primary', onclick: () => this.host.openLevel(next) }, t('guide.nextLevel')));
    }
    this.el.append(actions);
    this.update();
  }

  private finish(g: Guide) {
    const state = this.host.project().guide!;
    state.done = true;
    this.host.saveStars(g.id, 1 + (g.bonus && passing([g.bonus], this.context())[0] ? 1 : 0));
    this.host.changed();
    this.render();
  }

  private go(step: number) {
    const state = this.host.project().guide!;
    state.reached = Math.max(state.reached ?? state.step, state.step, step);
    state.step = Math.max(0, step);
    this.played = 0;
    this.pressed = 0;
    this.host.changed();
    this.render();
  }

  /** Ticks the checklist. Called when blocks change or the game runs. */
  update() {
    const g = this.guide();
    if (!g || !this.checklist) return;
    const state = this.host.project().guide!;
    const lang = currentLanguage();
    const checks = state.step < g.steps.length ? g.steps[state.step].checks : g.bonus ? [g.bonus] : [];
    const key = JSON.stringify([this.host.project(), state.step]);
    if (key !== this.runtimeKey) {
      this.runtimeKey = key;
      this.runtime = undefined;
      const generation = ++this.runtimeGeneration;
      if (this.runtimeTimer) clearTimeout(this.runtimeTimer);
      if (checks.some((c) => c.run)) {
        const project = structuredClone(this.host.project());
        this.runtimeTimer = setTimeout(() => {
          void runChecks(checks, project).then((results) => {
            if (generation !== this.runtimeGeneration) return;
            this.runtime = results;
            this.update();
          });
        }, 200);
      }
    }
    const ok = passing(checks, this.context());
    clear(this.checklist);
    checks.forEach((c, i) => this.checklist!.append(h('li', { class: ok[i] ? 'ok' : '' },
      h('span', { class: 'guide-tick', 'aria-hidden': 'true' }, ok[i] ? '✓' : ''),
      h('span', { class: 'sr-only' }, ok[i] ? t('guide.checkDone') : t('guide.checkTodo')),
      localized(c.text, lang))));
    // A finished level gets its bonus star as soon as the bonus is done.
    if (state.step >= g.steps.length && state.done && ok[0] && (this.host.stars()[g.id] ?? 0) < 2) {
      this.host.saveStars(g.id, 2);
      this.render();
      return;
    }
    const all = ok.every(Boolean);
    if (this.nextButton) this.nextButton.disabled = !all;
    if (all && !this.allOk) this.el.classList.add('guide-cheer');
    else if (!all) this.el.classList.remove('guide-cheer');
    this.allOk = all;
  }

  private help() {
    const g = this.guide();
    if (!g) return;
    const step = g.steps[this.host.project().guide!.step];
    const lang = currentLanguage();
    let ws: Blockly.WorkspaceSvg | undefined;
    const d = openDialog(t('guide.helpTitle'), { wide: true, onClose: () => ws?.dispose() });
    if (step.hint) d.body.append(h('p', { class: 'guide-hint' }, localized(step.hint, lang)));
    const pic = h('div', { class: 'guide-picture guide-picture-large' });
    d.body.append(h('p', { class: 'muted' }, t('guide.helpText')), pic);
    const blocks = ((step.solution as { blocks?: { blocks?: Json[] } }).blocks?.blocks ?? []);
    ws = blockPicture(pic, blocks, this.host.theme(), Math.round(window.innerHeight * 0.6));
    d.footer.append(h('button', { class: 'primary', onclick: () => d.close() }, t('ui.ok')));
  }
}
