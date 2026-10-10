// The documentation: how ArduCade works, then every block in the toolbox with
// a picture, what it does (its tooltip) and for some blocks an example.
// Opened from the Help button, the (i) on toolbox blocks and the block menu.

import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';
import { buildToolbox } from '../blocks/toolbox';
import { DEFS } from '../blocks/defs';
import { openDialog } from './dialogs';
import { clear, h } from './dom';
import { getAssetProject, setAssetProject } from '../blocks/assets';
import { templateToProject } from '../templates';
import { platformer } from '../templates/platformer';
import { illustratedGuide } from './docs-guide';
import { blockPicture } from './guide-panel';
import type { ThemeId } from './themes';

type Json = Record<string, any>;

/** Sections about the editor. Texts are docs.<id>.title and docs.<id>.body. */
const GUIDE = ['start', 'blocks', 'assets', 'sim', 'device', 'homemade', 'attiny'];

const n = (v: number): Json => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const s = (v: string): Json => ({ shadow: { type: 'text', fields: { TEXT: v } } });
const b = (type: string, inputs?: Json, fields?: Json, next?: Json): Json => ({
  type,
  ...(inputs && { inputs }),
  ...(fields && { fields }),
  ...(next && { next: { block: next } }),
});
const v = (name: string): Json => ({ block: { type: 'variables_get', fields: { VAR: { name } } } });
const val = (block: Json): Json => ({ block });
const body = (block: Json): Json => ({ DO: { block } });
const setVar = (name: string, value: Json, next?: Json) => b('variables_set', { VALUE: value }, { VAR: { name } }, next);
const create = () => val(b('ab_sprite_create'));

// Variables and functions are filled in by Blockly when the toolbox opens,
// so their blocks are listed here.
const CUSTOM: Record<string, Json[]> = {
  VARIABLES: [setVar('count', n(0)), b('math_change', { DELTA: n(1) }, { VAR: { name: 'count' } }), b('variables_get', undefined, { VAR: { name: 'count' } })],
  FUNCTIONS: [b('procedures_defnoreturn', undefined, { NAME: 'restart' }), b('procedures_defreturn', undefined, { NAME: 'double' })],
};

/** Examples. The text is docs.ex.<block type>. */
const EXAMPLES: Record<string, Json[]> = {
  ab_on_start: [b('ab_on_start', body(setVar('mySprite', create(), b('ab_sprite_set_position', { SPRITE: v('mySprite'), X: n(64), Y: n(32) }))))],
  ab_on_update: [b('ab_on_update', body(b('controls_if', { IF0: val(b('ab_is_pressed', undefined, { BUTTON: 'a' })), DO0: val(b('ab_sprite_change_prop', { SPRITE: v('mySprite'), VALUE: n(1) }, { PROP: 'x' })) })))],
  ab_on_every: [b('ab_on_every', body(b('ab_score_change', { VALUE: n(1) })), { MS: 1000 })],
  ab_move_sprite: [b('ab_on_start', body(setVar('mySprite', create(), b('ab_move_sprite', { SPRITE: v('mySprite'), VX: n(60), VY: n(60) }))))],
  ab_on_button: [b('ab_on_button', body(setVar('projectile', val(b('ab_sprite_projectile', { FROM: v('mySprite'), VX: n(0), VY: n(-80) })))), { BUTTON: 'a', EVENT: 'pressed' })],
  ab_on_overlap: [b('ab_on_overlap', body(b('ab_score_change', { VALUE: n(1) }, undefined, b('ab_sprite_destroy', { SPRITE: v('otherSprite') }))))],
  ab_sprite_set_flag: [b('ab_on_start', body(setVar('mySprite', create(), b('ab_sprite_set_flag', { SPRITE: v('mySprite') }, { FLAG: 'stayInScreen', ON: 'on' }))))],
  ab_on_life_zero: [b('ab_on_life_zero', body(b('ab_game_over', undefined, { WIN: 'lose' })))],
  ab_draw_text: [b('ab_on_draw', body(b('ab_draw_text', { TEXT: val(b('text_join', { ADD0: s('Score: '), ADD1: val(b('ab_score')) })), X: n(0), Y: n(0) })))],
  ab_play_melody: [b('ab_on_start', body(b('ab_play_melody', { TEMPO: n(120) }, { NOTES: 'C D E:2 F G:1/2 A H C5:4', MODE: 'once' })))],
  ab_pitch: [b('ab_on_button', body(b('ab_pitch', { FROM: n(90), TO: n(110), ...body(b('ab_play_effect', undefined, { SFX: 'jump' })) })), { BUTTON: 'a', EVENT: 'pressed' })],
  ab_random: [b('ab_on_every', body(b('ab_sprite_set_position', { SPRITE: v('mySprite'), X: val(b('ab_random', { FROM: n(0), TO: n(120) })), Y: n(0) })), { MS: 1000 })],
  controls_if: [b('ab_on_update', body(b('controls_if', { IF0: val(b('logic_compare', { A: val(b('ab_score')), B: n(9) }, { OP: 'GT' })), DO0: val(b('ab_game_over', undefined, { WIN: 'win' })) })))],
  procedures_defnoreturn: [
    b('procedures_defnoreturn', { STACK: val(b('ab_score_set', { VALUE: n(0) }, undefined, b('ab_life_set', { VALUE: n(3) }))) }, { NAME: 'restart' }),
    b('ab_on_start', body({ type: 'procedures_callnoreturn', extraState: { name: 'restart' } })),
  ],
};

interface Section {
  id: string;
  title: string;
  /** Block states to describe, or none for a text section. */
  blocks?: Json[];
}

/** "set mySprite to (sprite)" in the toolbox is about the sprite block. */
function subject(state: Json): string {
  const inner = state.type === 'variables_set' ? state.inputs?.VALUE?.block?.type : undefined;
  return inner?.startsWith('ab_') ? inner : state.type;
}

function sections(secretTiny: boolean): Section[] {
  const list: Section[] = GUIDE.filter(id => id !== 'attiny' || secretTiny).map((id) => ({ id, title: t(`docs.${id}.title`) }));
  const seen = new Set<string>();
  for (const cat of buildToolbox().contents as Json[]) {
    const key = String(cat.name).replace(/^%\{BKY_AB_CAT_|\}$/g, '');
    const entries: Json[] = cat.custom ? CUSTOM[key] ?? [] : cat.contents;
    const blocks = entries
      .map(({ kind, ...state }) => state)
      .filter((state) => Blockly.Blocks[subject(state)] && !seen.has(subject(state)) && seen.add(subject(state)));
    list.push({ id: key, title: Blockly.Msg[`AB_CAT_${key}`] ?? key, blocks });
  }
  // Older projects can contain blocks that are no longer in the toolbox.
  // Keep their explanations reachable through Help and the block menu.
  for (const def of DEFS) {
    if (seen.has(def.type)) continue;
    const section = list.find(sec => sec.id === def.style.replace(/^ab_/, '').toUpperCase());
    section?.blocks?.push(b(def.type));
  }
  return list;
}

function tooltip(type: string): string {
  const ws = new Blockly.Workspace();
  try {
    const tip = ws.newBlock(type).getTooltip();
    return typeof tip === 'string' ? tip : '';
  } finally {
    ws.dispose();
  }
}

/** The longer text for a block (docs.more.<type>), or its tooltip. */
function more(type: string): string[] {
  const key = `docs.more.${type}`;
  const text = t(key);
  return (text === key ? tooltip(type) : text).split('\n\n');
}

/** Opens the documentation, at the block of this type if one is given. */
export function openDocs(theme: ThemeId, blockType?: string, secretTiny = false) {
  const all = sections(secretTiny);
  const guideCount = all.filter(sec => !sec.blocks).length;
  const dlg = openDialog(t('docs.title'), { wide: true, onClose: () => disposePictures() });
  dlg.el.classList.add('docs-dialog');
  const nav = h('nav', { class: 'docs-nav', 'aria-label': t('docs.title') });
  const content = h('div', { class: 'docs-content' });
  dlg.body.classList.add('docs');
  dlg.body.append(nav, content);

  let pictures: Blockly.WorkspaceSvg[] = [];
  let observer: IntersectionObserver | undefined;
  const disposePictures = () => {
    observer?.disconnect();
    pictures.forEach((ws) => ws.dispose());
    pictures = [];
  };

  // Blockly pictures are drawn when they scroll into view: a category can
  // have twenty of them.
  const picture = (blocks: Json[], overview = false) => {
    const el = h('div', { class: overview ? 'docs-picture docs-overview' : 'docs-picture' });
    (el as HTMLElement & { blocks?: Json[] }).blocks = blocks;
    observer?.observe(el);
    return el;
  };

  const buttons = all.map((sec) =>
    h('button', { type: 'button', onclick: () => show(sec) }, sec.title),
  );
  nav.append(
    h('h3', {}, t('docs.guide')),
    ...buttons.slice(0, guideCount),
    h('h3', {}, t('docs.blocks')),
    ...buttons.slice(guideCount),
  );

  let target: HTMLElement | null = null;
  let shown = 0;

  function show(sec: Section, focus?: string) {
    target = null;
    disposePictures();
    clear(content);
    content.scrollTop = 0;
    buttons.forEach((btn, i) => btn.setAttribute('aria-current', String(all[i] === sec)));
    observer = new IntersectionObserver((seen) => {
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        observer!.unobserve(e.target);
        const overview = e.target.classList.contains('docs-overview');
        const project = getAssetProject();
        try {
          if (overview) setAssetProject(templateToProject(platformer));
          pictures.push(blockPicture(e.target as HTMLElement, (e.target as HTMLElement & { blocks: Json[] }).blocks, theme, overview ? 700 : 420, overview));
        } finally {
          if (overview) setAssetProject(project);
        }
      }
      // Pictures above the block change height as they are drawn.
      if (target && performance.now() - shown < 1000) target.scrollIntoView({ block: 'start' });
    }, { root: content, rootMargin: '200px' });

    content.append(h('h2', {}, sec.title));
    if (!sec.blocks) {
      for (const p of t(`docs.${sec.id}.body`).split('\n\n')) content.append(h('p', {}, p));
      content.append(illustratedGuide(sec.id, picture));
      return;
    }
    for (const state of sec.blocks) {
      const type = subject(state);
      const example = EXAMPLES[type];
      content.append(
        h(
          'article',
          { class: 'docs-block', 'data-type': type },
          picture([state]),
          ...more(type).map((p) => h('p', {}, p)),
          example && h('h4', {}, t('docs.example')),
          example && picture(example),
          example && h('p', {}, t(`docs.ex.${type}`)),
        ),
      );
    }
    target = focus ? content.querySelector<HTMLElement>(`[data-type="${CSS.escape(focus)}"]`) : null;
    shown = performance.now();
    if (target) {
      target.classList.add('focus');
      target.scrollIntoView({ block: 'start' });
    }
  }

  const start = blockType ? all.find((sec) => sec.blocks?.some((state) => subject(state) === blockType)) : undefined;
  show(start ?? all[0], blockType);
}
