// Runs a generated game in the browser: screen, keyboard, sound and the
// frame loop around the simulator engine.

import { FONT_5X7 } from '../shared/font';
import { BUTTON_IDS } from '../engine/enums';
import type { GameHooks, JsResult } from '../gen/js';
import { div16, mod16 } from './intmath';
import { Debugger } from './debugger';
import { Engine, LoopError, StopSignal } from './engine';

export type PixelColor = 'white' | 'blue' | 'yellow';

export const PIXEL_RGB: Record<PixelColor, [number, number, number]> = {
  white: [235, 240, 245],
  blue: [90, 190, 255],
  yellow: [255, 214, 70],
};

/** A code-native pixel splash, in the same page format as the Arduboy screen. */
export function splashScreen(): Uint8Array {
  const buffer = new Uint8Array(1024);
  const dot = (x: number, y: number) => { if (x >= 0 && x < 128 && y >= 0 && y < 64) buffer[(y >> 3) * 128 + x] |= 1 << (y & 7); };
  const text = (label: string, y: number, scale = 1) => {
    const left = Math.floor((128 - (label.length * 6 - 1) * scale) / 2);
    [...label].forEach((letter, i) => {
      for (let x = 0; x < 5; x++) for (let row = 0; row < 7; row++) {
        if (FONT_5X7[(letter.charCodeAt(0) - 32) * 5 + x] & (1 << row)) {
          for (let dx = 0; dx < scale; dx++) for (let dy = 0; dy < scale; dy++) dot(left + (i * 6 + x) * scale + dx, y + row * scale + dy);
        }
      }
    });
  };
  // Circuit border, stars and a stepped skyline around the wordmark.
  for (let x = 8; x < 120; x++) { dot(x, 3); dot(x, 60); }
  for (let y = 8; y < 56; y++) { dot(3, y); dot(124, y); }
  // Keep the lower stars below the subtitle, with two clear pixel rows
  // between their tips and both the text and the bottom border.
  for (const [x, y] of [[16, 13], [110, 14], [24, 56], [104, 56]]) {
    dot(x, y); dot(x - 1, y); dot(x + 1, y); dot(x, y - 1); dot(x, y + 1);
  }
  for (let i = 0; i < 5; i++) {
    const x = 46 + i * 8, top = 17 - (i % 3) * 3;
    for (let y = top; y < 20; y++) { dot(x, y); dot(x + 5, y); }
    for (let dx = 0; dx < 6; dx++) { dot(x + dx, top); dot(x + dx, 19); }
  }
  text('ArduCade', 25, 2);
  text('MAKE. PLAY. REPEAT.', 46);
  return buffer;
}

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
  onError(key: string, detail?: string, id?: string): void;
  onSkippedCpp(): void;
  onInput?(buttons: number): void;
  onState?(): void;
  onDebug?(): void;
}

export class Runner {
  private engine: Engine | null = null;
  private hooks: GameHooks | null = null;
  readonly debugger = new Debugger(() => {
    this.paused = this.debugger.paused;
    this.engine?.setPaused(this.paused);
    if (this.paused) { this.tone(0); this.releaseAll(); }
    else if (this.engine) this.engine.resetLoopGuard();
    this.events.onState?.();
    this.events.onDebug?.();
  });

  inspect() {
    return {
      variables: { ...this.hooks?.inspect?.(), ...(this.debugger.paused ? this.debugger.locals : {}) },
      sprites: this.engine?.sprites.flatMap((sprite, id) => sprite.alive ? [{ id, kind: sprite.kind,
        x: this.engine!.getProp(id, 0), y: this.engine!.getProp(id, 1),
        vx: this.engine!.getProp(id, 2), vy: this.engine!.getProp(id, 3) }] : []) ?? [],
      frame: this.engine?.frameCount ?? 0,
    };
  }

  debugResume(mode: 'run' | 'block' | 'frame' = 'run') {
    if (!this.engine) return;
    this.debugger.resume(mode);
  }

  setDebug(enabled: boolean) {
    this.releaseAll();
    this.debugger.enabled = enabled;
    if (!enabled) this.debugResume();
    this.events.onDebug?.();
  }
  private raf = 0;
  private heldKeys = new Set<string>();
  private keys = 0;
  private touch = 0;
  private audio: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private toneTimer = 0;
  private image: ImageData;
  private ctx: CanvasRenderingContext2D;
  private color: PixelColor = 'white';
  private lastBuffer = new Uint8Array(1024);
  private lastInverted = false;
  private splash = splashScreen();

  get pixelColor(): PixelColor { return this.color; }
  set pixelColor(value: PixelColor) {
    this.color = value in PIXEL_RGB ? value : 'white';
    this.show(this.lastBuffer, this.lastInverted);
  }

  cyclePixelColor(): PixelColor {
    const colors: PixelColor[] = ['white', 'blue', 'yellow'];
    this.pixelColor = colors[(colors.indexOf(this.color) + 1) % colors.length];
    return this.color;
  }
  muted = false;
  running = false;
  paused = false;

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
    this.heldKeys.add(e.code);
    this.keys |= 1 << b;
    this.syncInput();
    return true;
  }

  keyUp(e: KeyboardEvent): boolean {
    const b = KEYS.findIndex((k) => k.includes(e.code));
    if (b < 0) return false;
    this.heldKeys.delete(e.code);
    if (!KEYS[b].some((key) => this.heldKeys.has(key))) this.keys &= ~(1 << b);
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
    this.heldKeys.clear();
    this.keys = this.touch = 0;
    this.engine?.releaseInput();
    this.syncInput();
  }

  private syncInput() {
    if (this.engine) this.engine.input = this.keys | this.touch;
    this.events.onInput?.(this.keys | this.touch);
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
    this.lastBuffer.set(buffer);
    this.lastInverted = inverted;
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
    this.show(this.running ? new Uint8Array(1024) : this.splash, false);
  }

  /** Starts a game from generated JavaScript. */
  async start(game: JsResult, storageKey: string, maxSprites = 16, tiny = false) {
    this.stop();
    if (this.debugger.enabled) this.debugger.pause();
    let hooksFactory: (E: Engine, ...helpers: unknown[]) => GameHooks;
    try {
      // The generated code only uses the engine and the helpers passed in.
      hooksFactory = new Function('E', '$w', '$div', '$mod', '$lg', '$debug', game.code) as typeof hooksFactory;
    } catch (err) {
      this.events.onError('sim.compileError', String(err));
      return;
    }
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
      onSkippedCpp: () => this.events.onSkippedCpp(),
      maxSprites,
      hiscoreMagic: game.hiscoreKey,
      tiny,
    });
    this.engine = engine;
    this.syncInput();
    const hooks = hooksFactory(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard, (index: number, locals: Record<string, unknown>) => {
      if (this.engine !== engine || engine.isStopped) throw new StopSignal();
      return this.debugger.checkpoint(game.debugIds?.[index] ?? '', locals);
    });
    this.hooks = hooks;
    this.running = true;
    this.clearScreen();
    this.events.onState?.();
    try {
      await engine.begin(hooks);
    } catch (err) {
      if (this.engine === engine) this.fail(err);
      return;
    }
    if (this.engine !== engine || engine.isStopped) return;
    const tick = () => {
      if (this.engine !== engine || engine.isStopped) return;
      if (!this.paused) engine.frame().then(rendered => {
        if (rendered && this.engine === engine) { this.debugger.frameEnd(); this.events.onDebug?.(); }
      }).catch((err) => {
        if (this.engine === engine) this.fail(err);
      });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private fail(err: unknown) {
    if (err instanceof StopSignal) return;
    const id = this.debugger.location;
    this.stop();
    if (err instanceof LoopError) this.events.onError('sim.infiniteLoop', undefined, id);
    else this.events.onError('sim.runtimeError', err instanceof Error ? err.message : String(err), id);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.tone(0);
    else this.resumeAudio();
    this.events.onState?.();
  }

  togglePause() {
    if (!this.engine) return;
    if (this.debugger.enabled) {
      if (this.paused) this.debugResume();
      else this.debugger.pause();
      return;
    }
    this.paused = !this.paused;
    this.engine.setPaused(this.paused);
    if (this.paused) { this.tone(0); this.releaseAll(); }
    this.events.onState?.();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    if (this.engine) this.engine.stop();
    this.debugger.reset(new StopSignal());
    this.hooks = null;
    this.engine = null;
    this.running = false;
    this.paused = false;
    this.releaseAll();
    this.tone(0);
    this.events.onState?.();
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
