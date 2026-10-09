// Runs a generated game in the browser: screen, keyboard, sound and the
// frame loop around the simulator engine.

import { BUTTON_IDS } from '../engine/enums';
import type { GameHooks, JsResult } from '../gen/js';
import { div16, mod16 } from './intmath';
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
  onError(key: string, detail?: string): void;
  onSkippedCpp(): void;
}

export class Runner {
  private engine: Engine | null = null;
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

  constructor(private canvas: HTMLCanvasElement, private events: RunnerEvents) {
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
  async start(game: JsResult, storageKey: string) {
    this.stop();
    let hooksFactory: (E: Engine, ...helpers: unknown[]) => GameHooks;
    try {
      // The generated code only uses the engine and the helpers passed in.
      hooksFactory = new Function('E', '$w', '$div', '$mod', '$lg', game.code) as typeof hooksFactory;
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
      maxSprites: 16,
      hiscoreMagic: game.hiscoreKey,
    });
    this.engine = engine;
    this.syncInput();
    const hooks = hooksFactory(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard);
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
    this.stop();
    if (err instanceof LoopError) this.events.onError('sim.infiniteLoop');
    else this.events.onError('sim.runtimeError', err instanceof Error ? err.message : String(err));
  }

  stop() {
    cancelAnimationFrame(this.raf);
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
