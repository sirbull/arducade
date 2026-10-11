import * as Blockly from 'blockly/core';
import { t } from '../i18n/i18n';
import type { Runner } from '../sim/runner';
import type { Program } from '../ir/ir';
import { clear, h, icon } from './dom';

export const ACTION_ICONS: Record<string, string> = {
  'debug.variables': 'M8 4H6v6l-3 2 3 2v6h2M16 4h2v6l3 2-3 2v6h-2M10 9l4 6M14 9l-4 6',
  'debug.sprites': 'M5 5h14v14H5zM9 10h1M14 10h1M9 15h6',
  'debug.breakpoints': 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16M9 9h6v6H9z',
  'debug.log': 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h4',
  'debug.disable': 'M6 6l12 12M18 6 6 18',
  'debug.detach': 'M4 9v11h11M10 4h10v10M20 4 9 15',
  'debug.dock': 'M4 4h16v16H4zM8 8l8 8M16 10v6h-6',
  'debug.continue': 'M8 4l12 8-12 8z',
  'debug.pause': 'M8 4v16M16 4v16',
  'debug.step': 'M5 5l10 7-10 7zM19 5v14',
  'debug.frame': 'M3 3h18v18H3zM7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M10 8l5 4-5 4z',
  'debug.restart': 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  'debug.stop': 'M5 5h14v14H5z',
  'debug.toggleBreakpoint': 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16M8 12h8M12 8v8',
  'debug.clear': 'M4 6h16M9 6V3h6v3M6 6v15h12V6M10 10v7M14 10v7',
  'debug.smaller': 'M5 12h14',
  'debug.larger': 'M5 12h14M12 5v14',
};

function labelIconButton(button: HTMLButtonElement, key: string) {
  button.dataset.i18nTitle = key;
  button.title = t(key);
  button.setAttribute('aria-label', button.title);
}

export class DebugPanel {
  readonly el = h('section', { id: 'debug-panel', class: 'panel debug-panel', hidden: true, 'aria-label': t('debug.title') });
  private body = h('div', { class: 'debug-body' });
  private toggle!: HTMLButtonElement;
  private status = h('p', { class: 'debug-status', role: 'status' });
  private variables = h('tbody');
  private sprites = h('div');
  private logs = h('div', { class: 'debug-log' });
  private locations = h('select', { 'aria-label': t('debug.chooseBlock') });
  private bpList = h('div', { class: 'debug-breakpoints' });
  private controls: HTMLButtonElement[] = [];
  private previous: Record<string, unknown> = {};
  private pauseSequence = -1;
  private pausedSnapshot?: Record<string, unknown>;
  private ids = new Set<string>();
  private floating = false;
  private logEntries: { text: string; id: string }[] = [];
  private lastRender = 0;
  private listSignature = '';
  private logSignature = '';
  private wasRunning = false;
  private highlighted: string | null = null;

  constructor(private runner: Runner, private workspace: () => Blockly.WorkspaceSvg,
    private start: () => void, private focusBlock: (id: string) => void) {
    const button = (key: string, action: () => void) => {
      const glyph = ACTION_ICONS[key];
      const element = h('button', { type: 'button', class: glyph ? 'debug-icon-button' : undefined,
        'data-i18n': glyph ? undefined : key, onclick: action }, glyph ? icon(glyph) : t(key));
      if (glyph) labelIconButton(element, key);
      return element;
    };
    this.toggle = button('debug.disable', () => this.toggleVisibility());
    const title = h('strong', { tabindex: '0', class: 'debug-drag', 'data-i18n': 'debug.title', 'aria-label': t('debug.move') }, t('debug.title'));
    const grip = h('div', { class: 'debug-grip', tabindex: '0', 'data-i18n-title': 'debug.move',
      title: t('debug.move'), 'aria-label': t('debug.move') });
    this.el.append(grip);
    const detach = button('debug.detach', () => {
      this.floating = !this.floating;
      this.el.classList.toggle('floating', this.floating);
      grip.hidden = !this.floating;
      labelIconButton(detach, this.floating ? 'debug.dock' : 'debug.detach');
      detach.replaceChildren(icon(ACTION_ICONS[this.floating ? 'debug.dock' : 'debug.detach']));
      if (this.floating) { this.el.style.left = '24px'; this.el.style.top = '80px'; }
      else { this.el.style.removeProperty('left'); this.el.style.removeProperty('top'); this.el.style.removeProperty('width'); this.el.style.removeProperty('height'); }
      this.runner.releaseAll();
      this.render(true);
    });
    grip.hidden = true;
    let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;
    const move = (left: number, top: number) => {
      this.el.style.left = `${Math.max(0, Math.min(left, window.innerWidth - this.el.offsetWidth))}px`;
      this.el.style.top = `${Math.max(0, Math.min(top, window.innerHeight - this.el.offsetHeight))}px`;
    };
    for (const handle of [title, grip]) {
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0 || drag) return;
        if (!this.floating) {
          const docked = this.el.getBoundingClientRect();
          detach.click();
          this.el.style.width = `${docked.width}px`;
          move(docked.left, docked.top);
        }
        const rect = this.el.getBoundingClientRect();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        handle.setPointerCapture(event.pointerId);
        this.runner.releaseAll();
        event.preventDefault();
      });
      handle.addEventListener('pointermove', event => {
        if (drag?.id === event.pointerId) move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        handle.addEventListener(type, (event: Event) => {
          if (drag?.id === (event as PointerEvent).pointerId) drag = undefined;
        });
      }
      handle.addEventListener('keydown', event => {
        if (!event.key.startsWith('Arrow')) return;
        event.preventDefault(); event.stopPropagation();
        if (!this.floating) detach.click();
        const rect = this.el.getBoundingClientRect();
        move(rect.left + (event.key === 'ArrowRight' ? 20 : event.key === 'ArrowLeft' ? -20 : 0),
          rect.top + (event.key === 'ArrowDown' ? 20 : event.key === 'ArrowUp' ? -20 : 0));
      });
    }
    window.addEventListener('resize', () => { if (this.floating) { const rect = this.el.getBoundingClientRect(); move(rect.left, rect.top); } });
    const resize = (amount: number) => {
      this.el.style.height = `${Math.max(360, Math.min(this.el.offsetHeight + amount, window.innerHeight - 24))}px`;
    };
    this.el.append(h('div', { class: 'debug-head' }, title, this.toggle, detach), this.body);
    const resume = button('debug.continue', () => {
      if (!this.runner.running) this.start(); else this.runner.debugResume();
    });
    const pause = button('debug.pause', () => this.runner.debugger.pause());
    const step = button('debug.step', () => this.runner.debugResume('block'));
    const frame = button('debug.frame', () => this.runner.debugResume('frame'));
    this.controls = [resume, pause, step, frame];
    const toolbar = h('div', { class: 'debug-controls debug-toolbar' }, ...this.controls,
      button('debug.restart', () => this.start()), button('debug.stop', () => { this.runner.stop(); this.runner.clearScreen(); }));
    this.body.append(h('h4', { 'data-i18n': 'debug.variables' }, t('debug.variables')), h('table', { class: 'debug-values' }, h('thead', {}, h('tr', {}, h('th', { 'data-i18n': 'debug.name' }, t('debug.name')), h('th', { 'data-i18n': 'debug.value' }, t('debug.value')))), this.variables),
      h('h4', { 'data-i18n': 'debug.sprites' }, t('debug.sprites')), this.sprites,
      h('h4', { 'data-i18n': 'debug.breakpoints' }, t('debug.breakpoints')), h('p', { class: 'muted small' }, t('debug.breakpointHelp')),
      this.locations, button('debug.toggleBreakpoint', () => this.toggleBreakpoint(this.locations.value)), this.bpList,
      h('h4', { 'data-i18n': 'debug.log' }, t('debug.log')), button('debug.clear', () => { this.logEntries = []; this.render(true); }), this.logs,
      );
    const sections = [h('div'), h('div'), h('div'), h('div')];
    let section = -1;
    for (const child of [...this.body.children]) {
      if (child.tagName === 'H4') section++;
      sections[section].append(child);
    }
    sections.forEach((section, index) => { section.hidden = index !== 0; section.className = 'debug-section'; });
    const tabs = h('div', { class: 'debug-tabs', role: 'tablist' });
    ['debug.variables', 'debug.sprites', 'debug.breakpoints', 'debug.log'].forEach((key, index) => {
      const tab = button(key, () => {
        sections.forEach((section, i) => { section.hidden = i !== index; });
        [...tabs.children].forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
      });
      tab.addEventListener('keydown', event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!offset) return;
        event.preventDefault(); event.stopPropagation();
        const next = tabs.children[(index + offset + sections.length) % sections.length] as HTMLButtonElement;
        next.click(); next.focus();
      });
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(index === 0));
      sections[index].setAttribute('role', 'tabpanel');
      tab.id = `debug-tab-${index}`; sections[index].id = `debug-section-${index}`;
      tab.setAttribute('aria-controls', sections[index].id); sections[index].setAttribute('aria-labelledby', tab.id);
      tabs.append(tab);
    });
    this.body.append(tabs, ...sections);
    this.el.insertBefore(h('div', { class: 'debug-actions' }, this.status, toolbar), this.body);
    this.el.append(h('div', { class: 'debug-sizing' }, button('debug.smaller', () => resize(-80)), button('debug.larger', () => resize(80))));
    Blockly.ContextMenuRegistry.registry.register({
      id: 'arducade_breakpoint', scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK, weight: 10,
      displayText: () => t('debug.toggleBreakpoint'),
      preconditionFn: scope => scope.block && this.ids.has(scope.block.id) ? 'enabled' : 'hidden',
      callback: scope => { if (scope.block) this.toggleBreakpoint(scope.block.id); },
    });
    this.render(true);
  }

  toggleVisibility() {
    const enabled = !this.runner.debugger.enabled;
    this.runner.setDebug(enabled);
    if (enabled) this.start();
    this.render(true);
    if (enabled) this.toggle.focus({ preventScroll: true });
    else document.getElementById('btn-debug')?.focus({ preventScroll: true });
  }

  updateProgram(program: Program) {
    this.ids.clear();
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const node = value as Record<string, unknown>;
      if (typeof node.id === 'string' && ['set', 'expr', 'if', 'while', 'repeat', 'for', 'forKind', 'break', 'continue', 'return', 'cpp'].includes(String(node.k))) this.ids.add(node.id);
      Object.values(node).forEach(visit);
    };
    visit(program);
    for (const id of this.runner.debugger.breakpoints) if (!this.ids.has(id)) this.runner.debugger.breakpoints.delete(id);
    clear(this.locations);
    this.locations.append(h('option', { value: '' }, t('debug.chooseBlock')));
    for (const id of this.ids) this.locations.append(h('option', { value: id }, this.label(id)));
    this.render(true);
  }

  select(id: string) {
    this.locations.value = this.ids.has(id) ? id : '';
  }

  private label(id: string) {
    return this.workspace().getBlockById(id)?.toString(70) || id;
  }

  private toggleBreakpoint(id: string) {
    if (!this.ids.has(id)) return;
    const points = this.runner.debugger.breakpoints;
    if (points.has(id)) points.delete(id); else points.add(id);
    this.runner.setDebug(true);
    this.render(true);
  }

  log(text: string, id = this.runner.debugger.location) {
    this.logEntries.push({ text, id });
    if (this.logEntries.length > 100) this.logEntries.shift();
    this.render(true);
  }

  reset() {
    this.runner.debugger.breakpoints.clear();
    this.logEntries = [];
    this.previous = {};
    this.pausedSnapshot = undefined;
    this.pauseSequence = -1;
  }

  render(force = false) {
    const debug = this.runner.debugger;
    this.el.hidden = !debug.enabled;
    const side = document.querySelector('.side');
    side?.classList.toggle('debug-active', debug.enabled);
    side?.classList.toggle('debug-docked', debug.enabled && !this.floating);
    const trigger = document.getElementById('btn-debug');
    if (trigger) {
      trigger.setAttribute('aria-expanded', String(debug.enabled));
      trigger.dataset.i18nTitle = debug.enabled ? 'debug.hide' : 'debug.show';
      trigger.title = t(trigger.dataset.i18nTitle);
      trigger.setAttribute('aria-label', trigger.title);
    }
    if (!force && !debug.enabled) return;
    const ws = this.workspace();
    if (!ws) return;
    const highlight = debug.paused && debug.location && ws.getBlockById(debug.location) ? debug.location : null;
    if (highlight !== this.highlighted) {
      ws.highlightBlock(highlight);
      if (highlight) ws.centerOnBlock(highlight);
      this.highlighted = highlight;
    }
    if (!force && !debug.paused && performance.now() - this.lastRender < 200) return;
    this.lastRender = performance.now();
    labelIconButton(this.toggle, debug.enabled ? 'debug.hide' : 'debug.show');
    this.toggle.setAttribute('aria-expanded', String(debug.enabled));
    this.body.hidden = !debug.enabled;
    this.el.classList.toggle('enabled', debug.enabled);
    for (const block of ws.getAllBlocks(false)) block.getSvgRoot()?.classList.toggle('debug-breakpoint-block', debug.breakpoints.has(block.id));
    if (this.runner.running && !this.wasRunning) { this.previous = {}; this.pausedSnapshot = undefined; }
    this.wasRunning = this.runner.running;
    const snapshot = this.runner.inspect();
    this.status.textContent = `${t(!this.runner.running ? 'debug.stopped' : debug.paused ? 'debug.paused' : 'debug.running')} · ${t('debug.frameNumber', { n: snapshot.frame })}`;
    this.controls[0].disabled = this.runner.running && !debug.paused;
    this.controls[1].disabled = !this.runner.running || debug.paused;
    this.controls[2].disabled = this.controls[3].disabled = !this.runner.running || !debug.paused;
    clear(this.variables);
    if (debug.paused && this.pauseSequence !== debug.sequence) {
      // Values are compared with the last rendered pause, including zero and false.
      this.pauseSequence = debug.sequence;
      this.previous = this.pausedSnapshot ?? {};
      this.pausedSnapshot = snapshot.variables;
    }
    for (const [name, value] of Object.entries(snapshot.variables)) {
      const changed = Object.hasOwn(this.previous, name) && this.previous[name] !== value;
      this.variables.append(h('tr', { class: changed ? 'debug-changed' : '' }, h('th', { scope: 'row' }, name), h('td', {}, String(value))));
    }
    if (!Object.keys(snapshot.variables).length) this.variables.append(h('tr', {}, h('td', { colspan: '2' }, t('debug.empty'))));
    clear(this.sprites);
    for (const sprite of snapshot.sprites) this.sprites.append(h('div', { class: 'debug-sprite' },
      `#${sprite.id} · ${t('debug.kind')} ${sprite.kind} · x ${sprite.x}, y ${sprite.y} · vx ${sprite.vx}, vy ${sprite.vy}`));
    if (!snapshot.sprites.length) this.sprites.textContent = t('debug.empty');
    if (!force) return;
    const listSignature = [...debug.breakpoints].map(id => `${id}:${this.label(id)}`).join('|');
    if (listSignature !== this.listSignature) {
      this.listSignature = listSignature;
      clear(this.bpList);
      for (const id of debug.breakpoints) {
        const remove = h('button', { type: 'button', class: 'debug-icon-button', onclick: () => this.toggleBreakpoint(id) }, icon(ACTION_ICONS['debug.disable']));
        labelIconButton(remove, 'debug.removeBreakpoint');
        this.bpList.append(h('div', { class: 'debug-breakpoint' }, h('button', { type: 'button', onclick: () => this.focusBlock(id) }, `● ${this.label(id)}`), remove));
      }
    }
    const logSignature = JSON.stringify(this.logEntries);
    if (logSignature === this.logSignature) return;
    this.logSignature = logSignature;
    clear(this.logs);
    for (const entry of this.logEntries) this.logs.append(entry.id ? h('button', { type: 'button', onclick: () => this.focusBlock(entry.id) }, entry.text) : h('p', {}, entry.text));
  }
}
