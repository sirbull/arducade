import { t } from '../i18n/i18n';
import { ACTION_ICONS } from './debug-panel';
import { h, icon } from './dom';

const BUG = 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6M8 9h8v11H8zM12 9v11M8 11H4l-2-2M8 15H2M8 18H4l-2 3M16 11h4l2-2M16 15h6M16 18h4l2 3M10 3 8 1M14 3l2-2';
const controls = ['continue', 'pause', 'step', 'frame', 'restart', 'stop', 'toggleBreakpoint', 'clear', 'detach', 'dock', 'smaller', 'larger', 'disable'];
const glyph = (name: string) => h('span', { class: 'docs-debug-icon' }, icon(name === 'show' ? BUG : ACTION_ICONS[`debug.${name}`]));
const section = (name: string) => h('article', { class: 'docs-step' }, h('h3', {}, t(`docs.debug.${name}.title`)),
  ...t(`docs.debug.${name}.body`).split('\n\n').map(p => h('p', {}, p)));

/** Localized, static illustrations use the same glyphs as the real controls. */
export function debugGuide(picture: (blocks: Record<string, any>[]) => HTMLElement): HTMLElement {
  const illustration = h('figure', { class: 'docs-figure' },
    h('div', { class: 'docs-debug-preview' },
      h('div', { class: 'docs-debug-preview-head' }, h('strong', {}, t('debug.title')),
        glyph('disable'), glyph('detach')),
      h('div', { class: 'docs-debug-preview-tools' }, ...controls.slice(0, 6).map(glyph)),
      h('p', {}, t('debug.paused')),
      h('div', { class: 'docs-debug-preview-tabs' }, ...['variables', 'sprites', 'breakpoints', 'log'].map(key => h('span', { title: t(`debug.${key}`), 'aria-label': t(`debug.${key}`) }, icon(ACTION_ICONS[`debug.${key}`])))),
      h('table', { class: 'debug-values' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('debug.name')), h('th', { scope: 'col' }, t('debug.value')))),
        h('tbody', {}, h('tr', {}, h('td', {}, 'count'), h('td', { class: 'docs-debug-changed' }, '1'))))),
    h('figcaption', {}, t('docs.debug.preview')));
  const legend = h('div', { class: 'docs-table-wrap' }, h('table', { class: 'docs-wiring docs-debug-legend' },
    h('caption', {}, t('docs.debug.controls.title')),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, t('docs.debug.button')), h('th', { scope: 'col' }, t('docs.debug.function')))),
    h('tbody', {}, ...['show', ...controls, 'variables', 'sprites', 'breakpoints', 'log'].map(name => h('tr', {},
      h('th', { scope: 'row' }, h('div', { class: 'docs-debug-label' }, glyph(name), h('span', {}, t(`debug.${name}`)))),
      h('td', {}, t(`docs.debug.action.${name}`)))))));
  const example = h('figure', { class: 'docs-figure' }, ...[
    { type: 'ab_on_start', inputs: { DO: { block: { type: 'variables_set', fields: { VAR: { name: 'count' } }, inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } } } } } },
    { type: 'ab_on_update', inputs: { DO: { block: { type: 'math_change', fields: { VAR: { name: 'count' } }, inputs: { DELTA: { shadow: { type: 'math_number', fields: { NUM: 1 } } } } } } } },
  ].map(block => picture([block])), h('figcaption', {}, t('docs.debug.example.caption')));
  const workflow = h('article', { class: 'docs-step' }, h('h3', {}, t('docs.debug.example.title')), example,
    h('ol', { class: 'docs-debug-workflow' }, ...['build', 'open', 'step', 'frame', 'breakpoint', 'inspect', 'finish'].map(name => h('li', {}, t(`docs.debug.example.${name}`)))));
  return h('div', { class: 'docs-illustrated' }, section('open'), illustration, legend,
    section('inspect'), section('breakpoints'), workflow, section('move'), section('limits'));
}
