import { t } from '../i18n/i18n';
import { cartridgeBlob, drawCartridge } from '../project/cartridge';
import { serializeProject, type Project } from '../project/model';
import { downloadFile, safeFileName } from '../project/store';
import type { PixelColor } from '../sim/runner';
import { gameThumbnail } from './build';
import { openCartridgeSimulator } from './cartridge-simulator';
import { openDialog } from './dialogs';
import { h, toast } from './dom';

export async function saveCartridge(project: Project, pixelColor: PixelColor = project.pixelColor ?? 'white'): Promise<void> {
  const snapshot: Project = structuredClone(project);
  let closed = false;
  const d = openDialog(t('save.title'), { onClose: () => { closed = true; } });
  d.el.classList.add('save-dialog');
  const preview = h('div', { class: 'cartridge-preview', 'aria-label': t('save.preview') });
  const status = h('p', { role: 'status' });
  let canvas: HTMLCanvasElement | undefined;
  const refresh = async (image: string) => {
    const next = await drawCartridge(snapshot.name, image);
    if (closed) return;
    canvas = next; preview.replaceChildren(canvas);
  };
  const save = h('button', { class: 'primary', disabled: true, onclick: async () => {
    if (!canvas) return;
    save.disabled = true;
    try {
      const blob = await cartridgeBlob(canvas, snapshot);
      downloadFile(safeFileName(snapshot.name) + '.png', blob, 'image/png'); d.close();
    } catch { toast(t('project.saveError'), 'error'); save.disabled = false; }
  } }, t('save.download'));
  const play = h('button', { onclick: () => openCartridgeSimulator(snapshot, async (image, color) => {
    pixelColor = color;
    await refresh(image);
    if (!closed) status.textContent = t('save.captured');
  }, pixelColor) }, t('save.play'));
  d.body.append(h('p', {}, t('save.help')), preview, play, status);
  d.footer.append(
    h('button', { onclick: () => downloadFile(safeFileName(snapshot.name) + '.abproject', serializeProject(snapshot)) }, t('save.json')),
    h('button', { onclick: () => d.close() }, t('ui.cancel')), save);
  play.disabled = true;
  try { await refresh(await gameThumbnail(snapshot, 45, pixelColor)); } catch { await refresh(''); }
  save.disabled = false;
  play.disabled = false;
}
