// Device panel: size meter, compiling in the browser, uploading over USB
// and downloading the Arduino sketch.

import { compileInWorker } from '../compile/client';
import type { CompileOutput } from '../compile/avrgcc';
import { usableFlash, type Chip } from '../hw/chips';
import { hasErrors, validateProfile, profileToConfigH, isESPboy, profileChip } from '../hw/profile';
import { t } from '../i18n/i18n';
import type { Diagnostic } from '../ir/ir';
import { CORE_HEADERS } from '../project/sketch';
import { downloadFile, pickTextFile, safeFileName } from '../project/store';
import { resetAndRequestPort, touch1200, uploadAvr109 } from '../upload/avr109';
import { parseHex, serialApi, sleep, UploadError, type SerialPortLike } from '../upload/serial';
import { uploadStk500v1 } from '../upload/stk500v1';
import type { App } from './app';
import { openDialog } from './dialogs';
import { $, clear, h, toast } from './dom';

/** Flash page size used by the bootloader. */
const PAGE_SIZE: Record<string, number> = { atmega328p: 128, atmega328pb: 128, atmega644p: 256, atmega1284p: 256 };

/** USB product ids of 32U4 bootloaders (Arduino, SparkFun, Adafruit). */
const BOOTLOADER_PIDS = new Set([0x0036, 0x0037, 0x9205, 0x9203, 0x000c]);

export class DeviceTools {
  private exact: { code: string; profile: string; out: CompileOutput } | null = null;
  private busy = false;

  constructor(private app: App) {
    $('#btn-device-export').addEventListener('click', () => {
      const panel = $('#device-panel');
      const dialog = openDialog(t('device.export'), {
        onClose: () => $('#device-panel-home').append(panel),
      });
      dialog.body.append(panel);
    });
    $('#btn-compile').addEventListener('click', () => void this.compile());
    $('#btn-upload').addEventListener('click', () => void this.upload());
    $('#btn-sketch').addEventListener('click', () => this.app.downloadSketch());
    $('#btn-hex-download').addEventListener('click', () => void this.downloadHex());
    $('#btn-hex-upload').addEventListener('click', () => void this.pickHex());
  }

  private chip(): Chip | null {
    try {
      return profileChip(this.app.project.profile);
    } catch {
      return null;
    }
  }

  private status(text: string) {
    $('#device-status').textContent = text;
  }

  /** Rough size between compiles, from the size of the generated code. */
  estimate() {
    const chip = this.chip();
    const build = this.app.build;
    if (!chip || !build) return;
    const key = build.cpp.code + JSON.stringify(this.app.project.profile);
    if (this.exact && this.exact.code + this.exact.profile === key) {
      this.meter(this.exact.out.flash, this.exact.out.ram, false);
      return;
    }
    const p = this.app.project;
    let assets = 0;
    for (const img of p.images) assets += 4 + img.frames.length * Math.ceil(img.height / 8) * img.width * 2;
    for (const bg of p.backgrounds) assets += 4 + Math.ceil(bg.height / 8) * bg.width;
    assets += p.tiles.length * 12;
    for (const m of p.tilemaps) assets += 2 + m.width * m.height;
    const statements = build.cpp.code.split('\n').filter((l) => l.trim().endsWith(';')).length;
    const flash = 9000 + statements * 14 + assets + (chip.id === 'atmega32u4' ? 3500 : 0);
    const cells = Math.max(8, ...p.tilemaps.map((m) => m.width * m.height));
    const ram = 1024 + this.app.maxSprites() * 25 + build.program.vars.length * 2 + Math.ceil(cells / 8) + 120 + (chip.id === 'atmega32u4' ? 200 : 0);
    this.meter(flash, ram, true);
  }

  private meter(flash: number, ram: number, estimate: boolean) {
    const chip = this.chip();
    const el = $('#meter');
    clear(el);
    if (!chip) return;
    const flashMax = usableFlash(chip);
    // Leave room for the stack.
    const ramMax = chip.ram;
    const bar = (label: string, used: number, max: number) => {
      const pct = Math.min(100, Math.round((used / max) * 100));
      const level = pct >= 95 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
      return h(
        'div',
        { class: 'bar-row' },
        h('span', { class: 'bar-label' }, label),
        h('div', { class: 'bar', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': used, 'aria-label': label }, h('div', { class: `fill ${level}`, style: `width:${pct}%` })),
        h('span', { class: 'bar-value' }, `${estimate ? '~' : ''}${(used / 1024).toFixed(1)} / ${(max / 1024).toFixed(1)} KB`),
      );
    };
    el.append(bar(t('device.flash'), flash, flashMax), bar(t('device.ram'), ram, ramMax));
    const summary = $('#meter-summary');
    clear(summary);
    summary.append(bar(t('device.flash'), flash, flashMax), bar(t('device.ram'), ram, ramMax));
    const explanation = estimate && isESPboy(this.app.project.profile) ? t('device.espboyEstimate') : estimate ? t('device.estimate') : t('device.exact');
    summary.title = explanation;
    el.append(h('p', { class: 'muted small' }, explanation));
    if (flash > flashMax) el.append(h('p', { class: 'error small' }, t('device.tooBig')));
    else if (ram > ramMax - 300) el.append(h('p', { class: 'warning small' }, t('device.lowRam')));
  }

  /** Warnings about the hardware, shown with the other problems. */
  warnings(): Diagnostic[] {
    const out: Diagnostic[] = [];
    const chip = this.chip();
    if (!chip) return out;
    const cells = Math.max(0, ...this.app.project.tilemaps.map((m) => m.width * m.height));
    if (chip.ram <= 2560 && cells / 8 > 256) out.push({ level: 'warning', key: 'diag.bigMap' });
    return out;
  }

  private async compileNow(): Promise<CompileOutput | null> {
    this.app.runBuild(false);
    const chip = this.chip();
    const build = this.app.build;
    if (!chip || !build) return null;
    if (build.diagnostics.some((d) => d.level === 'error')) {
      toast(t('device.fixErrors'), 'error');
      return null;
    }
    if (!chip.browserCompile) {
      toast(t('device.exportOnly', { chip: chip.name }), 'info');
      return null;
    }
    if (hasErrors(validateProfile(this.app.project.profile))) {
      toast(t('profile.hasErrors'), 'error');
      return null;
    }
    const profileKey = JSON.stringify(this.app.project.profile);
    if (this.exact && this.exact.code === build.cpp.code && this.exact.profile === profileKey) return this.exact.out;
    this.status(t('device.compiling'));
    const started = performance.now();
    try {
      const out = await compileInWorker({ mcu: chip.id, game: build.cpp.code, config: profileToConfigH(this.app.project.profile), headers: CORE_HEADERS });
      this.exact = { code: build.cpp.code, profile: profileKey, out };
      this.meter(out.flash, out.ram, false);
      this.status(t('device.compiled', { seconds: ((performance.now() - started) / 1000).toFixed(1) }));
      return out;
    } catch (e) {
      const log = (e as { log?: string[] }).log ?? [];
      this.status(t('device.compileFailed'));
      const d = openDialog(t('device.compileFailed'), { wide: true });
      d.body.append(h('p', {}, t('device.compileFailedHelp')), h('pre', { class: 'log' }, log.join('\n') || String((e as Error).message)));
      d.footer.append(h('button', { class: 'primary', onclick: () => d.close() }, t('ui.ok')));
      return null;
    }
  }

  async compile() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.compileNow();
    } finally {
      this.busy = false;
    }
  }

  private async downloadHex() {
    if (this.busy) return;
    this.busy = true;
    try {
      const out = await this.compileNow();
      if (out) downloadFile(`${safeFileName(this.app.project.name)}.hex`, out.hex, 'application/octet-stream');
    } finally {
      this.busy = false;
    }
  }

  /** Uploads someone else's .hex. Confirmed in a dialog so requestPort gets a fresh click. */
  private async pickHex() {
    if (this.busy) return;
    const file = await pickTextFile('.hex');
    if (!file) return;
    try {
      parseHex(file.text);
    } catch {
      toast(t('device.badHex'), 'error');
      return;
    }
    const chip = this.chip();
    const d = openDialog(t('device.uploadHex'));
    d.body.append(h('p', {}, t('device.uploadHexConfirm', { file: file.name, chip: chip?.name ?? '?' })));
    d.footer.append(
      h('button', { onclick: () => d.close() }, t('ui.cancel')),
      h('button', { class: 'primary', onclick: () => { d.close(); void this.upload(file.text); } }, t('device.upload')),
    );
  }

  /** Compiles and uploads the game, or uploads the given Intel HEX as is. */
  async upload(hex?: string) {
    if (this.busy) return;
    const chip = this.chip();
    if (!chip) return;
    const serial = serialApi();
    if (chip.tiny) {
      toast(t('device.ispOnly'), 'info');
      return;
    }
    if (chip.upload === 'none' || !chip.browserCompile) {
      toast(t('device.exportOnly', { chip: chip.name }), 'info');
      return;
    }
    if (!serial) {
      toast(t('upload.noWebSerial'), 'error');
      return;
    }
    this.busy = true;
    try {
      // Ask for the port first, while the click still counts as a user action.
      // A port that was allowed before is used again without asking.
      let port: SerialPortLike;
      const granted = await serial.getPorts();
      try {
        port = granted.length === 1 ? granted[0] : await serial.requestPort();
      } catch {
        this.status('');
        return;
      }
      if (hex === undefined) {
        const out = await this.compileNow();
        if (!out) return;
        if (out.flash > usableFlash(chip)) {
          toast(t('device.tooBig'), 'error');
          return;
        }
        hex = out.hex;
      }
      const program = parseHex(hex);
      if (program.length > usableFlash(chip)) {
        toast(t('device.tooBig'), 'error');
        return;
      }
      const progress = (stage: string, f: number) => this.status(t(`upload.${stage}`, { percent: Math.round(f * 100) }));
      if (chip.upload === 'stk500v1') {
        await uploadStk500v1(port, program, { bauds: chip.baud ?? [115200, 57600], pageSize: PAGE_SIZE[chip.id] ?? 128, signature: chip.signature, progress });
      } else if (chip.upload === 'avr109') {
        const boot = await this.enterBootloader(port);
        if (!boot) return;
        await uploadAvr109(boot, program, { signature: chip.signature, progress });
      } else {
        toast(t('device.exportOnly', { chip: chip.name }), 'info');
        return;
      }
      toast(t('upload.success'), 'ok');
    } catch (e) {
      const err = e instanceof UploadError ? t(e.key, e.params) : `${t('upload.failed')}: ${(e as Error).message}`;
      this.status(err);
      toast(err, 'error');
    } finally {
      this.busy = false;
    }
  }

  /** Restarts a 32U4 board into the bootloader and finds its serial port. */
  private async enterBootloader(port: SerialPortLike): Promise<SerialPortLike | null> {
    const serial = serialApi()!;
    const info = port.getInfo();
    if (info.usbProductId !== undefined && BOOTLOADER_PIDS.has(info.usbProductId)) return port;
    const granted = await serial.getPorts();
    // Only reset automatically when this board's bootloader was already allowed.
    // Otherwise the short bootloader window must start with the chooser click.
    const matchesBootloader = (p: SerialPortLike) => {
      const candidate = p.getInfo();
      return candidate.usbVendorId === info.usbVendorId
        && candidate.usbProductId !== undefined && BOOTLOADER_PIDS.has(candidate.usbProductId);
    };
    if (granted.some(matchesBootloader)) {
      this.status(t('upload.reset'));
      await touch1200(port);
      for (let i = 0; i < 80; i++) {
        await sleep(100);
        const boot = (await serial.getPorts()).find(matchesBootloader);
        if (boot) {
          // getPorts also returns disconnected ports with retained permission.
          // Probe availability before handing it to the uploader.
          try {
            await boot.open({ baudRate: 57600 });
          } catch {
            continue;
          }
          await boot.close();
          return boot;
        }
      }
      throw new UploadError('upload.noBootloader');
    }
    return new Promise((resolve, reject) => {
      let closed = false;
      let choosing = false;
      let chosen: SerialPortLike | null = null;
      const d = openDialog(t('upload.pickBootloader'), { onClose: () => { closed = true; resolve(chosen); } });
      d.body.append(h('p', {}, t('upload.pickBootloaderHelp')));
      d.footer.append(
        h('button', { onclick: () => d.close() }, t('ui.cancel')),
        h(
          'button',
          {
            class: 'primary',
            onclick: async () => {
              if (choosing || closed) return;
              choosing = true;
              this.status(t('upload.reset'));
              try {
                const selected = await resetAndRequestPort(port, () => serial.requestPort());
                if (!closed) chosen = selected;
              } catch (e) {
                if (!closed && (e as Error).name !== 'NotFoundError') reject(e);
              }
              if (!closed) d.close();
            },
          },
          t('upload.pickPort'),
        ),
      );
    });
  }
}
