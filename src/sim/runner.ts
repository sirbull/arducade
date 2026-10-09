// Runs a generated game in the browser: screen, keyboard, sound and the
// frame loop around the simulator engine.

import { BUTTON_IDS } from '../engine/enums';
import type { GameHooks, JsResult } from '../gen/js';
import { loadGame } from './load';
import { Engine, LoopError, StopSignal } from './engine';

export type PixelColor = 'white' | 'blue' | 'yellow';

const PIXEL_RGB: Record<PixelColor, [number, number, number]> = {
  white: [235, 240, 245],
  blue: [90, 190, 255],
  yellow: [255, 214, 70],
};

/** Keyboard keys for each button, in BUTTON_IDS order. */
const KEYS: string[][] = [
  ['ArrowUp', 'KeyW'],
  ['ArrowDown', 'KeyS'],
  ['ArrowLeft', 'KeyA'],
  ['ArrowRight', 'KeyD'],
  ['KeyZ', 'Space', 'KeyJ'],
  ['KeyX', 'Enter', 'KeyK'],
];

export interface RunnerEvents {
  /** The game stopped. blockId is the block that was running. */
  onError(key: string, params: Record<string, string | number> | undefined, blockId: string | undefined): void;
  /** A problem while the game runs; the game goes on. */
  onWarning(key: string, params: Record<string, string | number> | undefined, blockId: string | undefined): void;
}

export class Runner {
  private engine: Engine | null = null;
  private avr: Worker | null = null;
  private raf = 0;
  private keys = 0;
  private touch = 0;
  private audio: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private toneTimer = 0;
  private image: ImageData;
  private ctx: CanvasRenderingContext2D;
  pixelColor: PixelColor = 'white';
  muted = false;
  running = false;

  constructor(canvas: HTMLCanvasElement, private events: RunnerEvents) {
    canvas.width = 128;
    canvas.height = 64;
    this.ctx = canvas.getContext('2d')!;
    this.image = this.ctx.createImageData(128, 64);
    this.clearScreen();
  }

  /** Key handling, attached by the caller to the simulator element. */
  keyDown(e: KeyboardEvent): boolean {
    const b = KEYS.findIndex((k) => k.includes(e.code));
    if (b < 0) return false;
    this.keys |= 1 << b;
    this.syncInput();
    return true;
  }

  keyUp(e: KeyboardEvent): boolean {
    const b = KEYS.findIndex((k) => k.includes(e.code));
    if (b < 0) return false;
    this.keys &= ~(1 << b);
    this.syncInput();
    return true;
  }

  /** Called by the on screen buttons. */
  setTouch(button: (typeof BUTTON_IDS)[number], down: boolean) {
    const b = BUTTON_IDS.indexOf(button);
    if (down) this.touch |= 1 << b;
    else this.touch &= ~(1 << b);
    this.syncInput();
    this.resumeAudio();
  }

  releaseAll() {
    this.keys = this.touch = 0;
    this.syncInput();
  }

  private syncInput() {
    if (this.engine) this.engine.input = this.keys | this.touch;
    this.avr?.postMessage({ type: 'input', bits: this.keys | this.touch });
  }

  resumeAudio() {
    if (!this.audio) {
      try {
        this.audio = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.audio.state === 'suspended') void this.audio.resume();
  }

  private tone(freq: number, ms?: number) {
    clearTimeout(this.toneTimer);
    if (!this.audio || this.muted || freq <= 0) {
      if (this.gain && this.audio) this.gain.gain.setTargetAtTime(0, this.audio.currentTime, 0.005);
      return;
    }
    if (!this.osc) {
      this.osc = this.audio.createOscillator();
      this.gain = this.audio.createGain();
      this.osc.type = 'square';
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(this.audio.destination);
      this.osc.start();
    }
    this.osc.frequency.setValueAtTime(freq, this.audio.currentTime);
    this.gain!.gain.setTargetAtTime(0.05, this.audio.currentTime, 0.002);
    if (ms) this.toneTimer = window.setTimeout(() => this.tone(0), ms);
  }

  private show(buffer: Uint8Array, inverted: boolean) {
    const [r, g, b] = PIXEL_RGB[this.pixelColor];
    const d = this.image.data;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        let on = (buffer[(y >> 3) * 128 + x] >> (y & 7)) & 1;
        if (inverted) on ^= 1;
        const i = (y * 128 + x) * 4;
        d[i] = on ? r : 0;
        d[i + 1] = on ? g : 0;
        d[i + 2] = on ? b : 0;
        d[i + 3] = 255;
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
  }

  clearScreen() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, 128, 64);
  }

  /** Starts a game from generated JavaScript. */
  async start(game: JsResult, storageKey: string, maxSprites = 16) {
    this.stop();
    const storage = loadStorage(storageKey);
    const engine = new Engine({
      show: (buf, inv) => this.show(buf, inv),
      tone: (f, ms) => this.tone(f, ms),
      storage: {
        read: (a) => storage.data[a] ?? 0,
        write: (a, v) => {
          storage.data[a] = v;
          storage.save();
        },
      },
      onWarning: (key, params, id) => this.events.onWarning(key, params, id),
      maxSprites,
      hiscoreMagic: game.hiscoreKey,
    });
    this.engine = engine;
    this.syncInput();
    let hooks: GameHooks;
    try {
      hooks = loadGame(game.code, engine);
    } catch (err) {
      this.events.onError('runtime.error', { detail: String(err) }, undefined);
      return;
    }
    this.running = true;
    try {
      await engine.begin(hooks);
    } catch (err) {
      this.fail(err);
      return;
    }
    const tick = () => {
      if (this.engine !== engine || engine.isStopped) return;
      engine.frame().catch((err) => this.fail(err));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private fail(err: unknown) {
    if (err instanceof StopSignal) return;
    const block = this.engine?.currentBlock;
    this.stop();
    if (err instanceof LoopError) this.events.onError('runtime.infiniteLoop', undefined, block);
    else this.events.onError('runtime.error', { detail: err instanceof Error ? err.message : String(err) }, block);
  }

  /**
   * Runs a compiled game (Intel HEX) in the emulated console. Used for games
   * with C++ blocks, which the JavaScript simulator can not run.
   */
  startEmulator(hex: string, storageKey: string) {
    this.stop();
    const storage = loadStorage(storageKey);
    const eeprom = Array.from({ length: 1024 }, (_, i) => storage.data[i] ?? 0xff);
    const worker = new Worker(new URL('./avr-worker.ts', import.meta.url), { type: 'module' });
    this.avr = worker;
    this.running = true;
    worker.onmessage = (e: MessageEvent<{ type: string; buffer?: Uint8Array; inverted?: boolean; freq?: number; data?: number[]; message?: string }>) => {
      const m = e.data;
      if (m.type === 'frame' && m.buffer) this.show(m.buffer, !!m.inverted);
      else if (m.type === 'tone') this.tone(m.freq ?? 0);
      else if (m.type === 'eeprom' && m.data) {
        storage.data.splice(0, m.data.length, ...m.data);
        storage.save();
      } else if (m.type === 'error') {
        this.stop();
        this.events.onError('runtime.emulatorError', { detail: m.message ?? '' }, undefined);
      }
    };
    worker.postMessage({ type: 'start', hex, eeprom });
    this.syncInput();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.avr?.terminate();
    this.avr = null;
    if (this.engine) this.engine.stop();
    this.engine = null;
    this.running = false;
    this.tone(0);
  }
}

function loadStorage(key: string) {
  let data: number[] = [];
  try {
    data = JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    data = [];
  }
  return {
    data,
    save() {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Storage is not available (private window). The game still runs.
      }
    },
  };
}
