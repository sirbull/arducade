import { t } from '../i18n/i18n';
import type { Project } from '../project/model';
import { PIXEL_RGB, Runner, type PixelColor } from '../sim/runner';
import { buildProject } from './build';
import { openDialog } from './dialogs';
import { h, icon } from './dom';
import { bindSimulatorInput } from './simulator-input';

/** A compact playable simulator for cartridge artwork and project previews. */
export function openCartridgeSimulator(project: Project, onCapture: (image: string, color: PixelColor) => Promise<void>, initialColor: PixelColor = project.pixelColor ?? 'white'): void {
  openSimulator(project, onCapture, initialColor, t('save.play'));
}

/** Plays a temporary project without changing its saved code or progress. */
export function openProjectSimulator(project: Project, title: string): void {
  openSimulator(project, undefined, project.pixelColor ?? 'white', title);
}

function openSimulator(project: Project, onCapture: ((image: string, color: PixelColor) => Promise<void>) | undefined, initialColor: PixelColor, title: string): void {
  let unbind: (() => void) | undefined;
  let runner: Runner | undefined;
  let closed = false;
  const dialog = openDialog(title, { onClose: () => {
    closed = true; unbind?.(); runner?.stop();
  } });
  dialog.el.classList.add('cartridge-simulator-dialog');
  if (!onCapture) dialog.el.classList.add('project-preview-dialog');
  const screen = h('canvas', { width: 128, height: 64, 'aria-label': t('sim.focus') });
  const status = h('p', { class: 'cartridge-simulator-status', role: 'status', 'aria-live': 'polite' });
  const simulator = h('div', { class: 'sim cartridge-simulator', tabindex: 0, 'aria-label': t('sim.focus') });
  const dpad = h('div', { class: 'dpad' });
  for (const [button, symbol] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
    dpad.append(h('button', { type: 'button', class: button, 'data-btn': button,
      'aria-label': t(`button.${button}`), title: t(`button.${button}`) }, symbol));
  }
  const ab = h('div', { class: 'ab' }, ...['b', 'a'].map(button => h('button', {
    type: 'button', class: button, 'data-btn': button, 'aria-label': button.toUpperCase(),
  }, button.toUpperCase())));
  const pause = h('button', { type: 'button', class: 'sim-control', title: t('sim.pause'), 'aria-label': t('sim.pause') }, icon('M9 5v14 M15 5v14'));
  const restart = h('button', { type: 'button', class: 'sim-control', title: t('sim.restart'), 'aria-label': t('sim.restart') }, icon('M4 10a8 8 0 1 1 1 8 M4 4v6h6'));
  const color = h('button', { type: 'button', class: 'sim-control', title: t('sim.color'), 'aria-label': t('sim.color') }, icon('M12 4a8 8 0 1 0 0 16a8 8 0 0 0 0-16 M12 4v16'));
  const renderColor = () => {
    if (!runner) return;
    color.style.background = `rgb(${PIXEL_RGB[runner.pixelColor].join(', ')})`;
    color.style.color = '#111111';
    color.title = `${t('sim.color')}: ${t(`pixel.${runner.pixelColor}Color`)}`;
    color.setAttribute('aria-label', color.title);
  };
  const capture = h('button', { type: 'button', class: 'primary', disabled: true }, t('save.capture'));
  const takeScreenshot = async () => {
    if (!onCapture || capture.disabled || !runner?.running) return;
    capture.disabled = true;
    // Capture the current frame immediately, before asynchronous image decoding.
    const image = screen.toDataURL('image/png');
    try {
      await onCapture(image, runner.pixelColor);
      if (!closed) status.textContent = t('save.captured');
    } catch { if (!closed) status.textContent = t('project.saveError'); }
    finally { if (!closed) capture.disabled = !runner.running; }
  };
  capture.addEventListener('click', () => void takeScreenshot());
  runner = new Runner(screen, {
    onError: (key, detail) => { status.textContent = t(key, { detail: detail ?? '' }); capture.disabled = true; },
    onSkippedCpp: () => { status.textContent = t('sim.skippedCpp'); },
    onInput: buttons => simulator.querySelectorAll<HTMLButtonElement>('[data-btn]').forEach(button => {
      const bit = { up: 0, down: 1, left: 2, right: 3, a: 4, b: 5 }[button.dataset.btn!];
      button.classList.toggle('pressed', bit !== undefined && !!(buttons & (1 << bit)));
    }),
    onState: () => {
      if (!runner) return;
      capture.disabled = !runner.running;
      pause.disabled = !runner.running;
      const key = runner.paused ? 'sim.play' : 'sim.pause';
      pause.title = t(key); pause.setAttribute('aria-label', t(key));
      pause.replaceChildren(icon(runner.paused ? 'M8 5l11 7-11 7Z' : 'M9 5v14 M15 5v14'));
    },
  });
  runner.pixelColor = initialColor;
  runner.setMuted(true);
  renderColor();
  color.addEventListener('click', () => { runner?.cyclePixelColor(); renderColor(); });
  simulator.append(h('div', { class: 'screen-frame' }, screen),
    h('div', { class: 'pad' }, dpad, h('div', { class: 'sim-bar' }, pause, restart, color), ab));
  dialog.body.append(simulator, h('p', { class: 'muted small' }, t(onCapture ? 'save.controls' : 'guide.tryControls')), status);
  dialog.footer.append(h('button', { onclick: () => dialog.close() }, t(onCapture ? 'save.back' : 'ui.close')));
  if (onCapture) dialog.footer.append(capture);
  unbind = bindSimulatorInput(dialog.el, runner, () => void takeScreenshot());
  // Pointer controls focus the dialog to keep keyboard input active without moving the viewport.
  dialog.el.tabIndex = -1;
  pause.addEventListener('click', () => runner?.togglePause());
  try {
    const build = buildProject(project);
    if (build.diagnostics.some(x => x.level === 'error')) {
      status.textContent = t('sim.fixErrors'); pause.disabled = true; restart.disabled = true; return;
    }
    const start = () => {
      if (closed) return;
      status.textContent = '';
      void runner!.start(build.js, `cartridge-preview:${project.id}`, 16);
    };
    restart.addEventListener('click', start);
    start(); simulator.focus({ preventScroll: true });
  } catch {
    status.textContent = t('sim.fixErrors'); pause.disabled = true; restart.disabled = true;
  }
}
