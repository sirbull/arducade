// Simulator version of the game engine. This is a port of
// core/ardublocks/ardublocks.h and must stay in sync with it: same integer
// math and the same order of updates, so games behave the same in the
// simulator and on the device.

import { BUTTON_IDS, FRAME_MS, NONE, SFX, SFX_STEPS, STORAGE_SLOTS } from '../engine/enums';
import type { GameHooks } from '../gen/js';
import { FONT_3X5 } from '../shared/font-small';
import { speechLines } from '../shared/speech';
import { FONT_5X7 } from '../shared/font';
import { AtmFallback, songDurationMs } from './atm';
import { isin } from './intmath';

const FLAG_STAY_IN_SCREEN = 1;
const FLAG_BOUNCE_ON_WALL = 2;
const FLAG_GHOST = 4;
const FLAG_AUTO_DESTROY = 8;
const FLAG_INVISIBLE = 16;
const FLAG_DESTROY_ON_WALL = 32;
const FLAG_STAY_IN_MAP = 64;
const HIT_LEFT = 1;
const HIT_RIGHT = 2;
const HIT_TOP = 4;
const HIT_BOTTOM = 8;
const KIND_PROJECTILE = 2;
const BTN_A = 4;
const BTN_DOWN = 1;
const BTN_LEFT = 2;
const BTN_RIGHT = 3;
const SFX_WIN = 5;
const SFX_LOSE = 6;

/** A particle effect recipe, made by the generated code with E.effect. */
export interface Effect {
  img: Uint8Array | null;
  color: number; blink: number; lifeMin: number; lifeMax: number; dir: number; spread: number;
  speedMin: number; speedMax: number; areaW: number; areaH: number; ax: number; ay: number; drag: number; wobble: number;
}

/** Legacy particles have no effect and tween from vx to endVx in pixels per second. */
interface Particle {
  drawMode: number;
  x: number; y: number; vx: number; vy: number; endVx: number; endVy: number;
  duration: number; remaining: number; color: number; img: Uint8Array | null; fx: Effect | null;
}

/** Stops a running game while it waits inside splash or pause. */
export class StopSignal extends Error {}

/** Thrown when a loop runs for too long in one frame. */
export class LoopError extends Error {}

interface Sprite {
  speechWidth: number;
  speechPosition: number;
  speechColors: number;
  drawMode: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  img: Uint8Array | null;
  kind: number;
  flags: number;
  outline: number;
  outlineWidth: number;
  /** Drawing layer, higher is drawn on top. */
  z: number;
  hit: number;
  frame: number;
  animRate: number;
  animCount: number;
  alive: boolean;
}

function newSprite(): Sprite {
  return { speechWidth: 0, speechPosition: 0, speechColors: 0, drawMode: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, img: null, kind: 0, flags: 0, outline: 0, outlineWidth: 1, z: 0, hit: 0, frame: 0, animRate: 0, animCount: 0, alive: false };
}

const w16 = (v: number) => (v << 16) >> 16;
const clamp16 = (v: number) => (v > 32767 ? 32767 : v < -32768 ? -32768 : Math.trunc(v));
const tdiv = (a: number, b: number) => Math.trunc(a / b);
const px = (v: number) => v >> 8;

export interface EngineOptions {
  /** Called with the screen buffer after each frame. */
  show(buffer: Uint8Array, inverted: boolean): void;
  /** Plays a tone. Frequency 0 stops the sound. */
  tone(freq: number, ms?: number): void;
  /** Audition UI follows the same scheduled notes and rests as the sound. */
  melodyStep?(index: number, frequency: number): void;
  /** False uses frame-driven single-voice song playback on the tone output. */
  fourVoices?: boolean;
  songVolume?(percent: number): void;
  /** Plays ATMlib song data in the background, or stops it for null. */
  song?(data: number[] | null, loop: boolean, pitch?: number, offsetSeconds?: number): void;
  /** Reads and writes the simulated EEPROM. */
  storage: { read(addr: number): number; write(addr: number, v: number): void };
  /** Called once when the game uses a C++ block. */
  onSkippedCpp(): void;
  maxSprites: number;
  hiscoreMagic: number;
  /** Fixed random seed, for pictures that look the same every time. */
  seed?: number;
  /** Do not wait for A or for pauses, for pictures made without a player. */
  noWaits?: boolean;
  /**
   * ATtiny85 console (AB_PAGED in ardublocks.h): fewer particles, changed
   * tiles and characters, A is left and right together, and nothing drawn
   * is kept between frames.
   */
  tiny?: boolean;
}

export class Engine {
  buffer = new Uint8Array(1024);
  /** 0 normal, 1 underlay, 2 background/map, 3/4 layers, 5 + reference sprite slot. */
  drawingMode = 0;

  spriteReference(s: number) { return this.exists(s) ? 5 + s : 0; }

  setDrawMode(s: number, mode: number) {
    if (this.exists(s)) this.sprites[s].drawMode = mode;
  }

  private forgetDrawReference(s: number) {
    const reference = 5 + s;
    if (this.drawingMode === reference) this.drawingMode = 0;
    for (const sp of this.sprites) if (sp.drawMode === reference) sp.drawMode = 0;
    for (const p of this.slots) if (p.drawMode === reference) p.drawMode = 0;
  }
  maxSprites: number;
  sprites: Sprite[];
  private speeches: { sprite: number; text: string; started: number; duration: number }[] = [];
  buttons = 0;
  buttonsPrev = 0;
  /** Buttons held right now, set by the keyboard and the on screen buttons. */
  private liveInput = 0;
  private inputTransitions: boolean[][] = BUTTON_IDS.map(() => []);

  get input() { return this.liveInput; }
  set input(value: number) {
    for (let b = 0; b < BUTTON_IDS.length; b++) {
      const mask = 1 << b;
      if ((value & mask) !== (this.liveInput & mask)) {
        this.inputTransitions[b].push(!!(value & mask));
      }
    }
    this.liveInput = value;
  }

  /** Clear pending taps when focus is lost or the game is paused. */
  releaseInput() {
    this.liveInput = this.buttons = this.buttonsPrev = 0;
    this.inputTransitions.forEach((queue) => { queue.length = 0; });
  }
  score = 0;
  life = 0;
  hiscore = 0;
  showScore = false;
  scoreX = -1; // -1: top right corner
  scoreY = 0;
  showLife = false;
  lifeX = 1;
  lifeY = 1;
  gameOverPending = false;
  gameOverWin = false;
  camX = 0;
  camY = 0;
  cameraSprite = NONE;
  controlled = NONE;
  controlVx = 0;
  controlVy = 0;
  rng = 0xace1;
  inverted = false;
  frameCount = 0;
  background: Uint8Array | null = null;
  private backgroundLayers = Array.from({ length: 2 }, () => ({ image: null as Uint8Array | null, percent: 0, x: 0, y: 0 }));
  bgX = 0;
  bgY = 0;
  private shakeLeft = 0;
  private shakeAmp = 0;
  private shakeX = 0;
  private shakeY = 0;

  map: number[] | null = null;
  tileImages: (Uint8Array | null)[] = [null];
  solidTiles = 0;
  private cleared = new Set<number>();
  private overlay: { idx: number; tile: number }[] = [];

  private fallbackSong: AtmFallback | null = null;
  private songPlayback: { data: number[]; loop: boolean; pitch: number; offset: number; startedAt: number } | null = null;
  private polyEffect: { until: number; suspendedAt: number; fallback: AtmFallback | null } | null = null;
  private songHz = -1;
  private soundSteps: number[] | null = null;
  private soundPos = 0;
  private soundNext = 0;
  private music: { steps: number[]; pos: number; next: number; tempo: number; loop: boolean; pitch: number } | null = null;
  // Pitch in percent, same as pitchLo and pitchHi in ardublocks.h.
  private pitchLo = 100;
  private pitchHi = 100;
  private soundPitch = 100;

  private hooks!: GameHooks;
  private startTime = performance.now();
  private nextFrame = 0;
  private stopped = false;
  private pausedAt: number | null = null;
  private busy = false;
  private loopCount = 0;
  private warnedCpp = false;

  constructor(private opts: EngineOptions) {
    this.maxSprites = opts.maxSprites;
    this.sprites = Array.from({ length: this.maxSprites }, newSprite);
  }

  /** Fixed slots like the device, so particles update in the same order. */
  private slots: Particle[] = [];

  get particles(): Particle[] { return this.slots.filter(p => p.remaining > 0); }

  get maxParticles() { return this.opts.tiny ? 4 : this.maxSprites <= 12 ? 12 : 16; }

  /** Characters that fit in the device text buffer. */
  textCapacity = 31;
  private get textMax() { return this.opts.tiny ? 21 : this.textCapacity; }

  clearParticles() { this.slots = []; }

  private freeSlot(): number {
    for (let i = 0; i < this.maxParticles; i++) if (!this.slots[i] || this.slots[i].remaining <= 0) return i;
    return -1;
  }

  emitParticle(img: Uint8Array | null, x: number, y: number, vx: number, vy: number, ms: number, endVx = vx, endVy = vy, color = -1) {
    if (ms <= 0) return;
    const i = this.freeSlot();
    if (i < 0) return;
    this.slots[i] = { drawMode: this.drawingMode, img, x: x * 256, y: y * 256, vx, vy, endVx, endVy, duration: ms, remaining: ms, color: color === 2 ? this.random(0, 1) : color, fx: null };
  }

  effect(img: Uint8Array | null, f: number[]): Effect {
    const [color, blink, lifeMin, lifeMax, dir, spread, speedMin, speedMax, areaW, areaH, ax, ay, drag, wobble] = f;
    return { img, color, blink, lifeMin, lifeMax, dir, spread, speedMin, speedMax, areaW, areaH, ax, ay, drag, wobble };
  }

  burst(fx: Effect | null, n: number, x: number, y: number, rot: number) {
    if (!fx) return;
    for (let k = 0; k < n; k++) {
      const i = this.freeSlot();
      if (i < 0) return;
      // Same order of random numbers as the device.
      const life = this.random(fx.lifeMin, fx.lifeMax);
      const a = (fx.dir + rot + this.random(-fx.spread, fx.spread)) % 360;
      const sp = this.random(fx.speedMin, fx.speedMax);
      const ox = fx.areaW ? this.random(0, fx.areaW - 1) - (fx.areaW >> 1) : 0;
      const oy = fx.areaH ? this.random(0, fx.areaH - 1) - (fx.areaH >> 1) : 0;
      const color = fx.color === 2 ? this.random(0, 1) : fx.color;
      if (life <= 0) continue;
      this.slots[i] = {
        drawMode: this.drawingMode, img: fx.img, x: (x + ox) * 256, y: (y + oy) * 256,
        vx: tdiv(sp * 16 * isin(a), 127), vy: -tdiv(sp * 16 * isin(a + 90), 127),
        endVx: 0, endVy: 0, duration: life, remaining: life, color, fx,
      };
    }
  }

  burstFrom(fx: Effect | null, n: number, s: number, rot: number) {
    if (this.exists(s)) this.burst(fx, n, this.getProp(s, 0), this.getProp(s, 1), rot);
  }

  clearEffect(fx: Effect | null) {
    for (const p of this.slots) if (fx && p.fx === fx) p.remaining = 0;
  }

  private updateParticles() {
    for (const p of this.slots) {
      if (p.remaining <= 0) continue;
      const step = Math.min(p.remaining, FRAME_MS);
      const fx = p.fx;
      if (fx) {
        // Speeds in 1/16 pixels per second.
        const v = (x: number) => Math.max(-32000, Math.min(32000, x));
        p.vx = v(p.vx + tdiv(fx.ax * 16 * step, 1000));
        p.vy = v(p.vy + tdiv(fx.ay * 16 * step, 1000));
        if (fx.drag) {
          p.vx -= tdiv(p.vx * fx.drag * step, 100000);
          p.vy -= tdiv(p.vy * fx.drag * step, 100000);
        }
        if (fx.wobble) p.vx = v(p.vx + this.random(-fx.wobble, fx.wobble) * 16);
        p.x += tdiv(p.vx * 16 * step, 1000);
        p.y += tdiv(p.vy * 16 * step, 1000);
      } else {
        const midpoint = p.duration - p.remaining + tdiv(step, 2);
        const vx = p.vx + tdiv((p.endVx - p.vx) * midpoint, p.duration);
        const vy = p.vy + tdiv((p.endVy - p.vy) * midpoint, p.duration);
        p.x += tdiv(vx * 256 * step, 1000);
        p.y += tdiv(vy * 256 * step, 1000);
      }
      p.remaining -= step;
    }
  }

  private drawParticles() {
    for (const p of this.slots) {
      if (p.remaining <= 0) continue;
      const fx = p.fx;
      if (fx?.blink && p.remaining * 100 < p.duration * fx.blink && this.frameCount & 2) continue;
      const x = Math.floor(p.x / 256) - this.camX, y = Math.floor(p.y / 256) - this.camY;
      const frames = p.img ? p.img[2] : 0;
      const frame = fx && frames > 1 ? Math.min(frames - 1, tdiv((p.duration - p.remaining) * frames, p.duration)) : 0;
      const saved = this.drawingMode;
      this.drawingMode = p.drawMode;
      if (p.img) this.drawImage(x - tdiv(p.img[0], 2), y - tdiv(p.img[1], 2), p.img, frame, p.color);
      else this.drawPixel(x, y, p.color === 0 ? 0 : 1);
      this.drawingMode = saved;
    }
  }

  // Helpers used by the generated code ------------------------------------

  image(bytes: number[]): Uint8Array {
    return Uint8Array.from(bytes);
  }

  /** Loop guard, called at the top of every loop body. */
  resetLoopGuard() { this.loopCount = 0; }

  loopGuard = () => {
    if (++this.loopCount > 200000) throw new LoopError();
  };

  skippedCpp() {
    if (!this.warnedCpp) {
      this.warnedCpp = true;
      this.opts.onSkippedCpp();
    }
  }

  millis(): number {
    return Math.floor((this.pausedAt ?? performance.now()) - this.startTime);
  }

  runtime(): number {
    return w16(this.millis());
  }

  mapValue(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
    if (fromLow === fromHigh) return toLow;
    return (Math.trunc((value - fromLow) * (toHigh - toLow) / (fromHigh - fromLow)) + toLow) << 16 >> 16;
  }

  random(lo: number, hi: number): number {
    if (hi < lo) [lo, hi] = [hi, lo];
    let r = this.rng;
    r ^= (r << 7) & 0xffff;
    r ^= r >> 9;
    r ^= (r << 8) & 0xffff;
    this.rng = r;
    const range = (hi - lo + 1) & 0xffff;
    if (range === 0) return w16(r);
    return w16(lo + (r % range));
  }

  every(timer: { t: number }, ms: number): boolean {
    const now = this.millis();
    if (timer.t === 0) timer.t = now + ms;
    if (now - timer.t < 0) return false;
    timer.t += ms;
    if (now - timer.t > ms) timer.t = now + ms;
    return true;
  }

  // Drawing ---------------------------------------------------------------

  clear() {
    this.buffer.fill(0);
  }

  drawPixel(x: number, y: number, color: number) {
    if (x < 0 || x >= 128 || y < 0 || y >= 64) return;
    color = this.drawColor(x, y, color);
    const i = (y >> 3) * 128 + x;
    const bit = 1 << (y & 7);
    if (color === 1) this.buffer[i] |= bit;
    else if (color === 0) this.buffer[i] &= ~bit;
    else this.buffer[i] ^= bit;
  }

  getPixel(x: number, y: number): number {
    if (x < 0 || x >= 128 || y < 0 || y >= 64) return 0;
    return (this.buffer[(y >> 3) * 128 + x] >> (y & 7)) & 1;
  }

  private hline(x: number, y: number, w: number, color: number) {
    for (let i = 0; i < w; i++) this.drawPixel(x + i, y, color);
  }

  fillRect(x: number, y: number, w: number, h: number, color: number) {
    for (let j = 0; j < h; j++) this.hline(x, y + j, w, color);
  }

  drawRect(x: number, y: number, w: number, h: number, color: number) {
    if (w <= 0 || h <= 0) return;
    this.hline(x, y, w, color);
    if (h > 1) this.hline(x, y + h - 1, w, color);
    for (let j = 1; j < h - 1; j++) {
      this.drawPixel(x, y + j, color);
      if (w > 1) this.drawPixel(x + w - 1, y + j, color);
    }
  }

  drawLine(x0: number, y0: number, x1: number, y1: number, color: number) {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 1000; guard++) {
      this.drawPixel(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  drawCircle(cx: number, cy: number, r: number, color: number, fill: boolean) {
    let x = r, y = 0, err = 1 - r;
    while (x >= y) {
      const oldX = x, oldY = y;
      if (fill) {
        this.hline(cx - x, cy + y, 2 * x + 1, color);
        if (y) this.hline(cx - x, cy - y, 2 * x + 1, color);
      } else {
        const points = [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]];
        for (let i = 0; i < points.length; i++) {
          const [dx, dy] = points[i];
          if (!points.slice(0, i).some(p => p[0] === dx && p[1] === dy)) this.drawPixel(cx + dx, cy + dy, color);
        }
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
      // Draw each filled row once, including the widest span at the outer rows.
      if (fill && oldX > oldY && (x !== oldX || y > x)) {
        this.hline(cx - oldY, cy + oldX, 2 * oldY + 1, color);
        this.hline(cx - oldY, cy - oldX, 2 * oldY + 1, color);
      }
    }
  }

  drawImage(x: number, y: number, img: Uint8Array | null, frame: number, tint = -1) {
    if (!img) return;
    const w = img[0];
    const h = img[1];
    const frames = img[2];
    const hasMask = img[3] & 1;
    if (x + w <= 0 || x >= 128 || y + h <= 0 || y >= 64) return;
    const pages = (h + 7) >> 3;
    const frameSize = pages * w;
    if (frame >= frames) frame = 0;
    const data = 4 + frame * frameSize * (hasMask ? 2 : 1);
    const mask = data + frameSize;
    const mode = this.drawingMode;
    if (mode > 1) {
      for (let cy = Math.max(0, -y); cy < Math.min(h, 64 - y); cy++) {
        for (let cx = Math.max(0, -x); cx < Math.min(w, 128 - x); cx++) {
          const color = this.imageColor(img, cx, cy, frame);
          if (color >= 0) this.drawPixel(x + cx, y + cy, tint >= 0 ? (tint ? 1 : 0) : color);
        }
      }
      return;
    }
    const shift = y & 7;
    for (let p = 0; p < pages; p++) {
      const page = (y >> 3) + p;
      for (let i = 0; i < w; i++) {
        const col = x + i;
        if (col < 0 || col >= 128) continue;
        const src = p * w + i;
        let d = img[data + src] << shift;
        const m = hasMask ? img[mask + src] << shift : d;
        if (tint >= 0) d = tint ? m : 0;
        if (page >= 0 && page < 8) {
          const b = page * 128 + col;
          if (mode === 1) this.buffer[b] ^= m & 0xff;
          else this.buffer[b] = (this.buffer[b] & ~m & 0xff) | (d & 0xff);
        }
        if (shift && page + 1 >= 0 && page + 1 < 8) {
          const b = (page + 1) * 128 + col;
          if (mode === 1) this.buffer[b] ^= (m >> 8) & 0xff;
          else this.buffer[b] = (this.buffer[b] & ~(m >> 8) & 0xff) | ((d >> 8) & 0xff);
        }
      }
    }
  }

  drawChar(x: number, y: number, c: string, color: number) {
    let code = c.charCodeAt(0);
    if (code < 32 || code > 126) code = 63;
    const g = (code - 32) * 5;
    for (let i = 0; i < 5; i++) {
      const bits = FONT_5X7[g + i];
      for (let j = 0; j < 7; j++) if (bits & (1 << j)) this.drawPixel(x + i, y + j, color);
    }
  }

  drawText(x: number, y: number, s: string, color: number) {
    for (const c of s.slice(0, this.textMax)) {
      this.drawChar(x, y, c, color);
      x += 6;
    }
  }

  invert(on: boolean) {
    this.inverted = on;
  }

  // Sound -----------------------------------------------------------------

  soundOff() {
    this.opts.tone(0);
    this.stopSong();
    this.soundSteps = null;
    this.music = null;
  }

  /** Songs play in the background, same as playSong in ardublocks.h. */
  playSong(data: number[] | null, loop: boolean) {
    if (!data) return;
    const pitch = this.pickPitch();
    this.polyEffect = null;
    this.songPlayback = { data, loop, pitch, offset: 0, startedAt: this.millis() };
    if (this.opts.fourVoices === false) { this.fallbackSong = new AtmFallback(data, loop, this.millis(), pitch); this.songHz = -1; }
    else if (pitch === 100) this.opts.song?.(data, loop);
    else this.opts.song?.(data, loop, pitch);
  }

  stopSong() {
    if (this.fallbackSong) this.opts.tone(0);
    this.fallbackSong = null;
    this.songPlayback = null;
    this.polyEffect = null;
    this.opts.song?.(null, false);
  }

  /** Save the background position once, even if another effect interrupts this one. */
  playPolyEffect(data: number[] | null) {
    if (!data) return;
    const now = this.millis(), pitch = this.pickPitch();
    if (!this.polyEffect) {
      if (this.songPlayback) this.songPlayback.offset += now - this.songPlayback.startedAt;
      this.polyEffect = { until: 0, suspendedAt: now, fallback: this.fallbackSong };
    }
    this.polyEffect.until = now + songDurationMs(data);
    if (this.opts.fourVoices === false) {
      this.fallbackSong = new AtmFallback(data, false, now, pitch); this.songHz = -1;
    } else if (pitch === 100) this.opts.song?.(data, false);
    else this.opts.song?.(data, false, pitch);
  }

  setSongVolume(percent: number) {
    if (this.opts.fourVoices !== false) this.opts.songVolume?.(Math.max(0, Math.min(100, Math.trunc(percent))));
  }

  setPitch(lo: number, hi: number) {
    this.pitchLo = Math.min(Math.max(lo, 10), 1000);
    this.pitchHi = Math.min(Math.max(hi, 10), 1000);
  }

  private pickPitch(): number {
    return this.pitchLo === this.pitchHi ? this.pitchLo : this.random(this.pitchLo, this.pitchHi);
  }

  private pitched(f: number, pct: number): number {
    if (!f || pct === 100) return f;
    return Math.min(Math.floor((f * pct) / 100), 65535) || 1;
  }

  playTone(freq: number, ms: number) {
    const pct = this.pickPitch();
    this.soundSteps = null;
    this.opts.tone(freq > 0 ? this.pitched(freq, pct) : 0, ms);
  }

  playEffect(id: number) {
    const name = SFX[id];
    if (!name) return;
    this.soundSteps = SFX_STEPS[name];
    this.soundPos = 0;
    this.soundNext = 0;
    this.soundPitch = this.pickPitch();
  }

  /** Music plays in the background, same as playMelody in ardublocks.h. */
  playMelody(steps: number[], bpm: number, loop: boolean) {
    this.music = { steps, pos: 0, next: 0, tempo: Math.min(Math.max(bpm, 20), 600), loop, pitch: this.pickPitch() };
  }

  get melodyPlaying(): boolean { return this.music !== null; }

  private updateSong() {
    if (this.pausedAt !== null) return;
    if (this.polyEffect && this.millis() >= this.polyEffect.until) {
      const effect = this.polyEffect, now = this.millis();
      this.polyEffect = null;
      this.fallbackSong = effect.fallback;
      this.fallbackSong?.shiftTime(now - effect.suspendedAt);
      this.songHz = -1;
      if (this.songPlayback) {
        const s = this.songPlayback;
        s.startedAt = now;
        if (this.opts.fourVoices !== false) this.opts.song?.(s.data, s.loop, s.pitch, s.offset / 1000);
      } else if (this.opts.fourVoices !== false) this.opts.song?.(null, false);
    }
    if (!this.fallbackSong) return;
    const hz = this.fallbackSong.update(this.millis());
    if (this.soundSteps) this.songHz = -1;
    else if (hz !== this.songHz) { this.opts.tone(hz); this.songHz = hz; }
  }

  private updateSound() {
    if (this.pausedAt !== null) return;
    const now = this.millis();
    this.updateSong();
    if (this.soundSteps && now >= this.soundNext) {
      if (this.soundPos >= this.soundSteps.length) {
        this.soundSteps = null;
        this.opts.tone(0);
      } else {
        this.opts.tone(this.pitched(this.soundSteps[this.soundPos], this.soundPitch));
        this.soundNext = now + this.soundSteps[this.soundPos + 1];
        this.soundPos += 2;
      }
    }
    const m = this.music;
    if (m && now >= m.next) {
      if (m.pos >= m.steps.length && m.loop) m.pos = 0;
      if (m.pos >= m.steps.length) {
        this.music = null;
        return;
      }
      const f = this.pitched(m.steps[m.pos], m.pitch);
      const ms = Math.floor((m.steps[m.pos + 1] * 15000) / m.tempo);
      this.opts.melodyStep?.(m.pos / 2, f);
      if (!this.soundSteps) this.opts.tone(f, f ? ms - Math.floor(ms / 8) : undefined);
      m.next = now + ms;
      m.pos += 2;
    }
  }

  // Input -----------------------------------------------------------------

  private readButtons() {
    this.buttonsPrev = this.buttons;
    // Consume each edge on a separate frame, even for a tap between frames.
    for (let b = 0; b < BUTTON_IDS.length; b++) {
      if (this.opts.tiny && b !== BTN_LEFT && b !== BTN_RIGHT) {
        // The console has no such button.
        this.inputTransitions[b].length = 0;
        this.buttons &= ~(1 << b);
        continue;
      }
      const down = this.inputTransitions[b].shift() ?? !!(this.input & (1 << b));
      if (down) this.buttons |= 1 << b;
      else this.buttons &= ~(1 << b);
    }
    if (this.opts.tiny && this.isPressed(BTN_LEFT) && this.isPressed(BTN_RIGHT)) this.buttons |= 1 << BTN_A;
  }

  isPressed(b: number): boolean {
    return (this.buttons & (1 << b)) !== 0;
  }

  private async waitForA() {
    if (this.opts.noWaits) return;
    const poll = async (want: boolean) => {
      do {
        this.updateTimers();
      this.readButtons();
        await this.sleep(10);
      } while (this.isPressed(BTN_A) !== want);
    };
    await poll(false);
    await poll(true);
    await poll(false);
    this.buttons = this.buttonsPrev = 0;
  }

  private sleep(ms: number): Promise<void> {
    if (this.opts.noWaits) return Promise.resolve();
    const until = this.millis() + ms;
    return new Promise((resolve, reject) => {
      const poll = () => {
        if (this.stopped) return reject(new StopSignal());
        if (this.pausedAt === null && this.millis() >= until) return resolve();
        this.updateSong();
        setTimeout(poll, Math.min(this.fallbackSong ? 1 : 10, Math.max(1, until - this.millis())));
      };
      poll();
    });
  }

  setPaused(paused: boolean) {
    if (paused && this.pausedAt === null) {
      this.pausedAt = performance.now();
      this.songHz = -1;
      this.opts.tone(0);
    } else if (!paused && this.pausedAt !== null) {
      this.startTime += performance.now() - this.pausedAt;
      this.pausedAt = null;
    }
  }

  // Storage ---------------------------------------------------------------

  private readWord(addr: number): number {
    return this.opts.storage.read(addr) | (this.opts.storage.read(addr + 1) << 8);
  }

  private writeWord(addr: number, v: number) {
    this.opts.storage.write(addr, v & 0xff);
    this.opts.storage.write(addr + 1, (v >> 8) & 0xff);
  }

  storageLoad(slot: number): number {
    if (slot < 0 || slot >= STORAGE_SLOTS) return 0;
    return w16(this.readWord(64 + slot * 2));
  }

  storageSave(slot: number, value: number) {
    if (slot < 0 || slot >= STORAGE_SLOTS) return;
    this.writeWord(64 + slot * 2, value & 0xffff);
  }

  private loadHiscore() {
    this.hiscore = 0;
    if (this.readWord(16) === this.opts.hiscoreMagic) this.hiscore = w16(this.readWord(18));
  }

  private saveHiscore() {
    if (this.score <= this.hiscore) return;
    this.hiscore = this.score;
    this.writeWord(16, this.opts.hiscoreMagic);
    this.writeWord(18, this.hiscore & 0xffff);
  }

  // Tile map --------------------------------------------------------------

  mapW() {
    return this.map ? this.map[0] : 0;
  }

  mapH() {
    return this.map ? this.map[1] : 0;
  }

  setMap(m: number[] | null) {
    this.map = m;
    this.cleared.clear();
    this.overlay = [];
    this.camX = this.camY = 0;
  }

  tileAt(col: number, row: number): number {
    if (!this.map || col < 0 || row < 0 || col >= this.mapW() || row >= this.mapH()) return 0;
    const idx = row * this.mapW() + col;
    for (let i = this.overlay.length - 1; i >= 0; i--) if (this.overlay[i].idx === idx) return this.overlay[i].tile;
    if (this.cleared.has(idx)) return 0;
    return this.map[2 + idx];
  }

  setTile(col: number, row: number, tile: number) {
    if (!this.map || col < 0 || row < 0 || col >= this.mapW() || row >= this.mapH()) return;
    const idx = row * this.mapW() + col;
    this.overlay = this.overlay.filter((o) => o.idx !== idx);
    if (tile === 0) {
      this.cleared.add(idx);
      return;
    }
    this.cleared.delete(idx);
    if (this.map[2 + idx] === tile) return;
    if (this.overlay.length === (this.opts.tiny ? 4 : 8)) this.overlay.shift();
    this.overlay.push({ idx, tile });
  }

  /** Outside the left and right side of the map is a wall only for sprites that stay in the map. */
  private isSolid(col: number, row: number, edgeWalls: boolean): boolean {
    if (!this.map) return false;
    if (col < 0 || col >= this.mapW()) return edgeWalls;
    if (row < 0 || row >= this.mapH()) return false;
    return (this.solidTiles & (1 << this.tileAt(col, row))) !== 0;
  }

  setBackground(img: Uint8Array | null) {
    this.background = img;
  }

  setBackgroundPosition(x: number, y: number) {
    this.bgX = w16(x);
    this.bgY = w16(y);
  }

  setBackgroundLayer(layer: number, image: Uint8Array | null, percent: number) {
    if (layer !== 1 && layer !== 2) return;
    const state = this.backgroundLayers[layer - 1];
    state.image = image;
    state.percent = Math.max(0, Math.min(100, w16(percent)));
  }

  setBackgroundLayerPosition(layer: number, x: number, y: number) {
    if (layer !== 1 && layer !== 2) return;
    Object.assign(this.backgroundLayers[layer - 1], { x: w16(x), y: w16(y) });
  }

  changeBackgroundLayerPosition(layer: number, x: number, y: number) {
    if (layer !== 1 && layer !== 2) return;
    const state = this.backgroundLayers[layer - 1];
    this.setBackgroundLayerPosition(layer, state.x + x, state.y + y);
  }

  /** Same as ab::shake: strength in pixels (at most 16), time rounded up to whole frames. */
  shake(strength: number, ms: number) {
    this.shakeAmp = Math.max(0, Math.min(16, strength));
    this.shakeLeft = ms > 0 ? tdiv(ms + FRAME_MS - 1, FRAME_MS) : 0;
  }

  /** Repeat each image in screen coordinates; shake is applied after parallax. */
  private drawRepeatedBackground(img: Uint8Array | null, x: number, y: number) {
    if (!img) return;
    const w = img[0], h = img[1];
    if (!w || !h) return;
    let x0 = w16(x - this.shakeX) % w, y0 = w16(y - this.shakeY) % h;
    if (x0 > 0) x0 -= w;
    if (y0 > 0) y0 -= h;
    for (let y = y0; y < 64; y += h) for (let x = x0; x < 128; x += w) this.drawImage(x, y, img, 0);
  }

  private drawBackground() {
    this.drawRepeatedBackground(this.background, this.bgX, this.bgY);
    for (const layer of this.backgroundLayers) {
      this.drawRepeatedBackground(layer.image,
        layer.x - tdiv((this.camX - this.shakeX) * layer.percent, 100),
        layer.y - tdiv((this.camY - this.shakeY) * layer.percent, 100));
    }
  }

  /** -1 is transparent. Black pixels in a mask are opaque. */
  private imageColor(img: Uint8Array | null, x: number, y: number, frame = 0): number {
    if (!img || x < 0 || y < 0 || x >= img[0] || y >= img[1]) return -1;
    const size = ((img[1] + 7) >> 3) * img[0];
    const masked = img[3] & 1;
    if (frame >= img[2]) frame = 0;
    const data = 4 + frame * size * (masked ? 2 : 1);
    const offset = (y >> 3) * img[0] + x, bit = 1 << (y & 7);
    const color = img[data + offset] & bit ? 1 : 0;
    return (masked ? img[data + size + offset] & bit : color) ? color : -1;
  }

  private repeatedColor(img: Uint8Array | null, x: number, y: number, ox: number, oy: number) {
    if (!img || !img[0] || !img[1]) return -1;
    const mod = (v: number, size: number) => ((v % size) + size) % size;
    return this.imageColor(img, mod(x - w16(ox - this.shakeX), img[0]), mod(y - w16(oy - this.shakeY), img[1]));
  }

  private layerColor(layer: number, x: number, y: number) {
    const state = this.backgroundLayers[layer];
    return this.repeatedColor(state.image, x, y,
      state.x - tdiv((this.camX - this.shakeX) * state.percent, 100),
      state.y - tdiv((this.camY - this.shakeY) * state.percent, 100));
  }

  private drawColor(x: number, y: number, fallback: number): number {
    const mode = this.drawingMode;
    if (!mode) return fallback;
    if (mode === 1) return 2;
    let color = -1;
    if (mode === 2) {
      color = Math.max(0, this.repeatedColor(this.background, x, y, this.bgX, this.bgY));
      for (let i = 0; i < 2; i++) { const c = this.layerColor(i, x, y); if (c >= 0) color = c; }
      const wx = x + this.camX, wy = y + this.camY;
      const tile = this.tileAt(wx >> 3, wy >> 3);
      const c = this.imageColor(this.tileImages[tile] ?? null, wx & 7, wy & 7);
      if (tile && c >= 0) color = c;
    } else if (mode === 3 || mode === 4) color = this.layerColor(mode - 3, x, y);
    else if (mode >= 5) {
      const s = this.drawingMode - 5;
      if (this.exists(s)) {
        const sp = this.sprites[s];
        if (!(sp.flags & FLAG_INVISIBLE) && sp.img) color = this.imageColor(sp.img,
          x + this.camX - (px(sp.x) - tdiv(sp.img[0], 2)),
          y + this.camY - (px(sp.y) - tdiv(sp.img[1], 2)), sp.frame);
      }
    }
    return color < 0 ? fallback : 1 - color;
  }

  private drawMap() {
    if (!this.map) return;
    const c0 = this.camX >> 3;
    const r0 = this.camY >> 3;
    for (let r = r0; r <= r0 + 8; r++) {
      for (let c = c0; c <= c0 + 16; c++) {
        const t = this.tileAt(c, r);
        if (t) this.drawImage(c * 8 - this.camX, r * 8 - this.camY, this.tileImages[t] ?? null, 0);
      }
    }
  }

  spawnOnTiles(tile: number, img: Uint8Array | null, kind: number) {
    for (let r = 0; r < this.mapH(); r++) {
      for (let c = 0; c < this.mapW(); c++) {
        if (this.tileAt(c, r) !== tile) continue;
        const s = this.create(img, kind);
        if (s === NONE) return;
        this.setPosition(s, c * 8 + 4, r * 8 + 4);
        this.setTile(c, r, 0);
      }
    }
  }

  // Sprites ---------------------------------------------------------------

  exists(s: number): boolean {
    return s >= 0 && s < this.maxSprites && this.sprites[s].alive;
  }

  getProp(s: number, prop: number): number {
    if (!this.exists(s)) return 0;
    const sp = this.sprites[s];
    const w = sp.img ? sp.img[0] : 0;
    const h = sp.img ? sp.img[1] : 0;
    switch (prop) {
      case 0: return w16(px(sp.x));
      case 1: return w16(px(sp.y));
      case 2: return tdiv(sp.vx, 16);
      case 3: return tdiv(sp.vy, 16);
      case 4: return sp.ax;
      case 5: return sp.ay;
      case 6: return w;
      case 7: return h;
      case 8: return w16(px(sp.x) - tdiv(w, 2));
      case 9: return w16(px(sp.x) - tdiv(w, 2) + w);
      case 10: return w16(px(sp.y) - tdiv(h, 2));
      case 11: return w16(px(sp.y) - tdiv(h, 2) + h);
    }
    return 0;
  }

  setProp(s: number, prop: number, v: number) {
    if (!this.exists(s)) return;
    const sp = this.sprites[s];
    const w = sp.img ? sp.img[0] : 0;
    const h = sp.img ? sp.img[1] : 0;
    switch (prop) {
      case 0: sp.x = v * 256; break;
      case 1: sp.y = v * 256; break;
      case 2: sp.vx = clamp16(v * 16); break;
      case 3: sp.vy = clamp16(v * 16); break;
      case 4: sp.ax = v; break;
      case 5: sp.ay = v; break;
      case 8: sp.x = (v + tdiv(w, 2)) * 256; break;
      case 9: sp.x = (v - w + tdiv(w, 2)) * 256; break;
      case 10: sp.y = (v + tdiv(h, 2)) * 256; break;
      case 11: sp.y = (v - h + tdiv(h, 2)) * 256; break;
    }
  }

  changeProp(s: number, prop: number, by: number) {
    this.setProp(s, prop, w16(this.getProp(s, prop) + by));
  }

  create(img: Uint8Array | null, kind: number): number {
    for (let i = 0; i < this.maxSprites; i++) {
      if (!this.sprites[i].alive) {
        const sp = newSprite();
        this.forgetDrawReference(i);
        sp.drawMode = this.drawingMode;
        sp.alive = true;
        sp.img = img;
        sp.kind = kind;
        sp.x = (this.camX + 64) * 256;
        sp.y = (this.camY + 32) * 256;
        this.sprites[i] = sp;
        return i;
      }
    }
    return NONE;
  }

  createProjectile(img: Uint8Array | null, vx: number, vy: number, from: number): number {
    const s = this.create(img, KIND_PROJECTILE);
    if (s === NONE) return s;
    const sp = this.sprites[s];
    if (this.exists(from)) {
      sp.x = this.sprites[from].x;
      sp.y = this.sprites[from].y;
    }
    sp.vx = clamp16(vx * 16);
    sp.vy = clamp16(vy * 16);
    sp.flags = FLAG_AUTO_DESTROY | FLAG_DESTROY_ON_WALL;
    return s;
  }

  createProjectileFromPosition(img: Uint8Array | null, x: number, y: number, vx: number, vy: number): number {
    const s = this.createProjectile(img, vx, vy, NONE);
    this.setPosition(s, x, y);
    return s;
  }

  destroy(s: number) {
    if (s >= 0 && s < this.maxSprites) {
      this.speechHide(s);
      this.forgetDrawReference(s);
      this.sprites[s].alive = false;
    }
    if (s === this.cameraSprite) this.cameraSprite = NONE;
  }

  destroyAll(kind: number) {
    for (let i = 0; i < this.maxSprites; i++) if (this.sprites[i].alive && this.sprites[i].kind === kind) this.destroy(i);
  }

  kindOf(s: number): number {
    return this.exists(s) ? this.sprites[s].kind : NONE;
  }

  setKind(s: number, kind: number) {
    if (this.exists(s)) this.sprites[s].kind = kind;
  }

  setImage(s: number, img: Uint8Array | null) {
    if (this.exists(s)) {
      this.sprites[s].img = img;
      this.sprites[s].frame = 0;
    }
  }

  setPosition(s: number, x: number, y: number) {
    if (!this.exists(s)) return;
    this.sprites[s].x = x * 256;
    this.sprites[s].y = y * 256;
  }

  setVelocity(s: number, vx: number, vy: number) {
    if (!this.exists(s)) return;
    this.sprites[s].vx = clamp16(vx * 16);
    this.sprites[s].vy = clamp16(vy * 16);
  }

  setOutlineWidth(s: number, width: number) {
    if (this.exists(s)) this.sprites[s].outlineWidth = Math.max(1, Math.min(8, Math.trunc(width)));
  }

  setZ(s: number, z: number) {
    if (this.exists(s)) this.sprites[s].z = Math.max(-128, Math.min(127, Math.trunc(z)));
  }

  setOutline(s: number, mode: number) {
    if (this.exists(s)) this.sprites[s].outline = mode >= 0 && mode <= 3 ? Math.trunc(mode) : 0;
  }

  setFlag(s: number, flag: number, on: boolean) {
    if (!this.exists(s)) return;
    if (on) this.sprites[s].flags |= flag;
    else this.sprites[s].flags &= ~flag;
  }

  animate(s: number, ms: number) {
    if (!this.exists(s)) return;
    const f = ms <= 0 ? 0 : tdiv(ms + tdiv(FRAME_MS, 2), FRAME_MS);
    this.sprites[s].animRate = f <= 0 ? (ms > 0 ? 1 : 0) : Math.min(f, 255);
    this.sprites[s].animCount = 0;
  }

  isHitting(s: number, dir: number): boolean {
    return this.exists(s) && (this.sprites[s].hit & dir) !== 0;
  }

  overlaps(a: number, b: number): boolean {
    if (!this.exists(a) || !this.exists(b) || a === b) return false;
    const sa = this.sprites[a];
    const sb = this.sprites[b];
    const aw = sa.img ? sa.img[0] : 0;
    const ah = sa.img ? sa.img[1] : 0;
    const bw = sb.img ? sb.img[0] : 0;
    const bh = sb.img ? sb.img[1] : 0;
    const al = px(sa.x) - tdiv(aw, 2);
    const at = px(sa.y) - tdiv(ah, 2);
    const bl = px(sb.x) - tdiv(bw, 2);
    const bt = px(sb.y) - tdiv(bh, 2);
    return al < bl + bw && bl < al + aw && at < bt + bh && bt < at + ah;
  }

  moveWithButtons(s: number, vx: number, vy: number) {
    this.controlled = s;
    this.controlVx = vx;
    this.controlVy = vy;
  }

  cameraFollow(s: number) {
    this.cameraSprite = s;
  }

  setCamera(x: number, y: number) {
    this.cameraSprite = NONE;
    this.camX = x;
    this.camY = y;
  }

  private moveAxis(sp: Sprite, horizontal: boolean, delta: number) {
    const w = sp.img ? sp.img[0] : 0;
    const h = sp.img ? sp.img[1] : 0;
    if (horizontal) sp.x += delta;
    else sp.y += delta;
    if (!this.map || sp.flags & FLAG_GHOST || delta === 0) return;
    let left = px(sp.x) - tdiv(w, 2);
    let top = px(sp.y) - tdiv(h, 2);
    const right = left + w - 1;
    const bottom = top + h - 1;
    const bounce = (sp.flags & FLAG_BOUNCE_ON_WALL) !== 0;
    const edgeWalls = (sp.flags & FLAG_STAY_IN_MAP) !== 0;
    if (horizontal) {
      const col = delta > 0 ? right >> 3 : left >> 3;
      for (let row = top >> 3; row <= bottom >> 3; row++) {
        if (!this.isSolid(col, row, edgeWalls)) continue;
        if (delta > 0) {
          left = col * 8 - w;
          sp.hit |= HIT_RIGHT;
        } else {
          left = (col + 1) * 8;
          sp.hit |= HIT_LEFT;
        }
        sp.x = (left + tdiv(w, 2)) * 256;
        sp.vx = bounce ? -sp.vx : 0;
        return;
      }
    } else {
      // Include the floor at the exclusive bottom edge so subpixel gravity
      // keeps grounded contact stable between frames.
      const row = delta > 0 ? (bottom + 1) >> 3 : top >> 3;
      for (let col = left >> 3; col <= right >> 3; col++) {
        if (!this.isSolid(col, row, edgeWalls)) continue;
        if (delta > 0) {
          top = row * 8 - h;
          sp.hit |= HIT_BOTTOM;
        } else {
          top = (row + 1) * 8;
          sp.hit |= HIT_TOP;
        }
        sp.y = (top + tdiv(h, 2)) * 256;
        sp.vy = bounce ? -sp.vy : 0;
        return;
      }
    }
  }

  private updateSprites() {
    if (this.exists(this.controlled)) {
      const sp = this.sprites[this.controlled];
      if (this.controlVx) {
        const dir = (this.isPressed(BTN_RIGHT) ? 1 : 0) - (this.isPressed(BTN_LEFT) ? 1 : 0);
        sp.vx = clamp16(dir * this.controlVx * 16);
      }
      if (this.controlVy) {
        const dir = (this.isPressed(BTN_DOWN) ? 1 : 0) - (this.isPressed(0) ? 1 : 0);
        sp.vy = clamp16(dir * this.controlVy * 16);
      }
    }
    for (let i = 0; i < this.maxSprites; i++) {
      const sp = this.sprites[i];
      if (!sp.alive) continue;
      sp.hit = 0;
      sp.vx = clamp16(sp.vx + tdiv(sp.ax * 8, 15));
      sp.vy = clamp16(sp.vy + tdiv(sp.ay * 8, 15));
      this.moveAxis(sp, true, tdiv(sp.vx * 8, 15));
      this.moveAxis(sp, false, tdiv(sp.vy * 8, 15));
      if (sp.hit && sp.flags & FLAG_DESTROY_ON_WALL) {
        this.destroy(i);
        continue;
      }

      const w = sp.img ? sp.img[0] : 0;
      const h = sp.img ? sp.img[1] : 0;
      let left = px(sp.x) - tdiv(w, 2);
      let top = px(sp.y) - tdiv(h, 2);
      const viewL = this.camX;
      const viewT = this.camY;
      if (sp.flags & (FLAG_STAY_IN_SCREEN | FLAG_BOUNCE_ON_WALL)) {
        const bounce = (sp.flags & FLAG_BOUNCE_ON_WALL) !== 0;
        if (left < viewL) {
          left = viewL;
          sp.hit |= HIT_LEFT;
          if (bounce && sp.vx < 0) sp.vx = -sp.vx;
        }
        if (left + w > viewL + 128) {
          left = viewL + 128 - w;
          sp.hit |= HIT_RIGHT;
          if (bounce && sp.vx > 0) sp.vx = -sp.vx;
        }
        if (top < viewT) {
          top = viewT;
          sp.hit |= HIT_TOP;
          if (bounce && sp.vy < 0) sp.vy = -sp.vy;
        }
        if (top + h > viewT + 64) {
          top = viewT + 64 - h;
          sp.hit |= HIT_BOTTOM;
          if (bounce && sp.vy > 0) sp.vy = -sp.vy;
        }
        // Preserve fractional positions on axes that did not hit a boundary.
        if (left !== px(sp.x) - tdiv(w, 2)) sp.x = (left + tdiv(w, 2)) * 256;
        if (top !== px(sp.y) - tdiv(h, 2)) sp.y = (top + tdiv(h, 2)) * 256;
      } else if (sp.flags & FLAG_AUTO_DESTROY) {
        if (left + w < viewL || left >= viewL + 128 || top + h < viewT || top >= viewT + 64) this.destroy(i);
      }

      if (sp.alive && sp.animRate) {
        if (++sp.animCount >= sp.animRate) {
          sp.animCount = 0;
          if (++sp.frame >= (sp.img ? sp.img[2] : 0)) sp.frame = 0;
        }
      }
    }
  }

  private updateCamera() {
    if (!this.exists(this.cameraSprite)) return;
    const sp = this.sprites[this.cameraSprite];
    this.camX = px(sp.x) - 64;
    this.camY = px(sp.y) - 32;
    if (this.map) {
      const maxX = this.mapW() * 8 - 128;
      const maxY = this.mapH() * 8 - 64;
      if (this.camX > maxX) this.camX = maxX;
      if (this.camY > maxY) this.camY = maxY;
      if (this.camX < 0) this.camX = 0;
      if (this.camY < 0) this.camY = 0;
    }
  }

  private async checkOverlaps() {
    if (this.hooks.hasOverlap) {
      for (let i = 0; i < this.maxSprites; i++) {
        for (let j = i + 1; j < this.maxSprites; j++) {
          const a = this.sprites[i];
          const b = this.sprites[j];
          if (!a.alive || !b.alive) continue;
          if ((a.flags | b.flags) & FLAG_GHOST) continue;
          if (this.overlaps(i, j)) await this.hooks.overlap(i, j);
        }
      }
    }
    if (this.hooks.hasTile && this.map) {
      for (let i = 0; i < this.maxSprites; i++) {
        const sp = this.sprites[i];
        if (!sp.alive) continue;
        const w = sp.img ? sp.img[0] : 0;
        const h = sp.img ? sp.img[1] : 0;
        const left = px(sp.x) - tdiv(w, 2);
        const top = px(sp.y) - tdiv(h, 2);
        for (let r = top >> 3; r <= (top + h - 1) >> 3; r++) {
          for (let c = left >> 3; c <= (left + w - 1) >> 3; c++) {
            if (sp.alive && this.tileAt(c, r)) await this.hooks.tile(i, c, r);
          }
        }
      }
    }
  }

  /** Lowest layer first; sprites on the same layer are drawn in pool order. */
  private drawSprites() {
    for (let layer = -129; ; ) {
      let next = 128;
      for (const sp of this.sprites) if (sp.alive && sp.z > layer && sp.z < next) next = sp.z;
      if (next === 128) return;
      for (const sp of this.sprites) if (sp.alive && sp.z === next) this.drawSprite(sp);
      layer = next;
    }
  }

  private drawSprite(sp: Sprite) {
    if (sp.flags & FLAG_INVISIBLE) return;
    const w = sp.img ? sp.img[0] : 0;
    const h = sp.img ? sp.img[1] : 0;
    const x = px(sp.x) - tdiv(w, 2) - this.camX;
    const y = px(sp.y) - tdiv(h, 2) - this.camY;
    if (sp.outline && sp.img) {
      const radius = sp.outlineWidth;
      const img = sp.img;
      const size = ((h + 7) >> 3) * w;
      const masked = img[3] & 1;
      const frame = sp.frame < img[2] ? sp.frame : 0;
      const offset = 4 + frame * size * (masked ? 2 : 1) + (masked ? size : 0);
      const solid = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < w && cy < h && !!(img[offset + (cy >> 3) * w + cx] & (1 << (cy & 7)));
      // Visit each contour pixel once, so automatic inversion never cancels itself.
      for (let cy = Math.max(-radius, -y); cy <= Math.min(h - 1 + radius, 63 - y); cy++) {
        for (let cx = Math.max(-radius, -x); cx <= Math.min(w - 1 + radius, 127 - x); cx++) {
          if (solid(cx, cy)) continue;
          let adjacent = false;
          for (let dy = -radius; dy <= radius && !adjacent; dy++)
            for (let dx = -radius; dx <= radius; dx++) if (solid(cx + dx, cy + dy)) { adjacent = true; break; }
          if (adjacent) this.drawPixel(x + cx, y + cy, sp.outline === 3 ? 2 : sp.outline - 1);
        }
      }
    }
    const saved = this.drawingMode;
    this.drawingMode = sp.drawMode;
    this.drawImage(x, y, sp.img, sp.frame);
    this.drawingMode = saved;
  }

  // Speech is copied when say runs; changing a variable needs another say call.
  limitText(value: unknown, max = 31): string {
    return Array.from(String(value), c => c === '\n' || (c >= ' ' && c <= '~') ? c : '?').join('').slice(0, this.opts.tiny ? Math.min(21, max) : max);
  }

  say(s: number, value: string, ms = 0) {
    if (!this.exists(s)) return;
    const text = this.limitText(value, 63);
    if (!text || ms < 0) { this.speechHide(s); return; }
    let slot = this.speeches.find(b => b.sprite === s);
    if (!slot) {
      if (this.speeches.length >= (this.opts.tiny ? 1 : 2)) this.speeches.shift();
      slot = { sprite: s, text, started: this.millis(), duration: ms };
      this.speeches.push(slot);
    }
    slot.text = text;
    slot.started = this.millis();
    slot.duration = ms;
  }

  speechHide(s: number) { this.speeches = this.speeches.filter(b => b.sprite !== s); }
  speechPosition(s: number, position: number) {
    if (this.exists(s)) this.sprites[s].speechPosition = Math.max(0, Math.min(2, position));
  }
  speechWidth(s: number, width: number) {
    if (this.exists(s)) this.sprites[s].speechWidth = Math.max(14, Math.min(128, width));
  }
  speechColors(s: number, text: number, background: number) {
    if (this.exists(s)) this.sprites[s].speechColors = 4 | (text ? 1 : 0) | (background ? 2 : 0);
  }

  private drawSpeech() {
    const now = this.millis();
    this.speeches = this.speeches.filter(b => this.exists(b.sprite) && (!b.duration || now - b.started < b.duration));
    const saved = this.drawingMode;
    this.drawingMode = 0;
    for (const b of this.speeches) {
      const sp = this.sprites[b.sprite];
      if (sp.flags & FLAG_INVISIBLE) continue;
      const columns = Math.floor(((sp.speechWidth || 86) - 6) / 4);
      const all = speechLines(b.text, columns);
      const page = Math.floor((now - b.started) / 1500) % Math.ceil(all.length / 3);
      const lines = all.slice(page * 3, page * 3 + 3);
      const width = Math.max(14, Math.max(...lines.map(l => l.length)) * 4 + 6);
      const height = lines.length * 6 + 5;
      const cx = px(sp.x) - this.camX;
      const top = px(sp.y) - Math.floor((sp.img?.[1] || 0) / 2) - this.camY;
      const bottom = top + (sp.img?.[1] || 0);
      const x = Math.max(0, Math.min(128 - width, cx - Math.floor(width / 2)));
      let below = sp.speechPosition === 2 || (sp.speechPosition === 0 && top < height + 3);
      if (below && bottom + 3 + height > 64 && top >= height + 3) below = false;
      if (!below && top < height + 3 && bottom + 3 + height <= 64) below = true;
      const y = Math.max(0, Math.min(64 - height, below ? bottom + 3 : top - height - 3));
      const colors = sp.speechColors || 6; // black text, white background
      const fg = colors & 1, bg = (colors >> 1) & 1;
      this.fillRect(x, y, width, height, bg);
      this.drawRect(x, y, width, height, 1 - bg);
      const tailX = Math.max(x + 3, Math.min(x + width - 4, cx));
      this.fillRect(tailX - 1, below ? y : y + height - 1, 3, 1, bg);
      for (let i = 0; i < 3; i++) {
        const ty = below ? y - 1 - i : y + height + i;
        if (ty < 0 || ty >= 64) continue;
        this.fillRect(tailX - 2 + i, ty, 5 - i * 2, 1, 1 - bg);
        if (i < 2) this.fillRect(tailX - 1 + i, ty, 3 - i * 2, 1, bg);
      }
      lines.forEach((line, row) => {
        for (let c = 0; c < line.length; c++) {
          const glyph = (line.charCodeAt(c) - 32) * 3;
          for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 5; gy++)
            if (FONT_3X5[glyph + gx] & (1 << gy)) this.drawPixel(x + 3 + c * 4 + gx, y + 3 + row * 6 + gy, fg);
        }
      });
    }
    this.drawingMode = saved;
  }

  // Score and lives -------------------------------------------------------

  readonly timers = Array.from({ length: 8 }, (_, i) => ({ seconds: 0, mode: 0, format: 3, visible: false, x: 0, y: 10 + i * 9, last: 0, remainder: 0 }));

  private updateTimers() {
    const now = this.millis();
    for (const t of this.timers) {
      if (t.mode) {
        const value = Math.max(0, Math.min(32767000, t.seconds * 1000 + t.remainder + Math.max(0, now - t.last) * t.mode));
        t.seconds = Math.floor(value / 1000);
        t.remainder = value % 1000;
        if (t.mode < 0 && value === 0) t.mode = 0;
      }
      t.last = now;
    }
  }

  timerValue(id: number) { this.updateTimers(); return this.timers[id]?.seconds ?? 0; }
  timerSet(id: number, s: number) {
    this.updateTimers(); const t = this.timers[id]; if (!t) return;
    t.seconds = Math.max(0, Math.min(32767, Math.trunc(s)));
    t.remainder = 0; t.visible = true;
  }
  timerChange(id: number, value: number) {
    this.updateTimers(); const t = this.timers[id]; if (!t) return;
    this.timerChangeMillis(id, Math.trunc(value) * 1000);
  }
  timerMillis(id: number) { this.updateTimers(); return this.timers[id]?.remainder ?? 0; }
  timerSetMillis(id: number, value: number) {
    this.updateTimers(); const t = this.timers[id]; if (!t) return;
    t.remainder = t.seconds === 32767 ? 0 : Math.max(0, Math.min(999, Math.trunc(value))); t.visible = true;
  }
  timerChangeMillis(id: number, value: number) {
    this.updateTimers(); const t = this.timers[id]; if (!t) return;
    const total = Math.max(0, Math.min(32767000, t.seconds * 1000 + t.remainder + Math.trunc(value)));
    t.seconds = Math.floor(total / 1000); t.remainder = total % 1000; t.visible = true;
    if (t.mode < 0 && total === 0) t.mode = 0;
  }
  timerRun(id: number, mode: number) {
    this.updateTimers(); const t = this.timers[id]; if (!t) return;
    t.mode = Math.sign(mode); t.visible = true;
  }
  timerFormat(id: number, format: number) { const t = this.timers[id]; if (t) { t.format = format; t.visible = format !== 5; } }
  timerPosition(id: number, x: number, y: number) { const t = this.timers[id]; if (t) { t.x = Math.trunc(x); t.y = Math.trunc(y); } }
  timerText(id: number) {
    const t = this.timers[id], s = t.seconds;
    const pad = (v: number) => String(v).padStart(2, '0');
    if (t.format < 3) return String(Math.floor(s / [1, 60, 3600][t.format]));
    const fraction = `.${String(t.remainder).padStart(3, '0')}`;
    if (t.format === 6) return `${pad(Math.floor(s / 60))}:${pad(s % 60)}${fraction}`;
    if (t.format === 7) return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}${fraction}`;
    if (t.format === 3) return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }

  private drawHud() {
    this.timers.forEach((t, i) => {
      if (!t.visible || t.format === 5) return;
      const text = this.timerText(i);
      this.fillRect(t.x - 1, t.y, text.length * 6 + 2, 9, 0);
      this.drawText(t.x, t.y + 1, text, 1);
    });
    if (this.showLife) {
      const heart = [0x06, 0x0f, 0x1e, 0x0f, 0x06];
      for (let i = 0; i < this.life && i < 8; i++) {
        for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) if (heart[c] & (1 << r)) this.drawPixel(this.lifeX + i * 7 + c, this.lifeY + r, 1);
      }
    }
    if (this.showScore) {
      const text = String(this.score);
      const w = text.length * 6;
      const x = this.scoreX < 0 ? 127 - w : this.scoreX;
      this.fillRect(x - 1, this.scoreY, w + 2, 9, 0);
      this.drawText(x, this.scoreY + 1, text, 1);
    }
  }

  setScore(v: number) {
    this.score = w16(v);
    this.showScore = true;
  }

  setScorePosition(x: number, y: number) {
    this.scoreX = Math.max(0, Math.trunc(x));
    this.scoreY = Math.trunc(y);
  }

  changeScore(by: number) {
    this.setScore(this.score + by);
  }

  setLifePosition(x: number, y: number) { this.lifeX = Math.trunc(x); this.lifeY = Math.trunc(y); }

  async setLife(v: number) {
    this.life = w16(v);
    this.showLife = true;
    if (this.life <= 0) {
      this.life = 0;
      if (!(await this.hooks.lifeZero())) {
        this.gameOverPending = true;
        this.gameOverWin = false;
      }
    }
  }

  changeLife(by: number) {
    return this.setLife(this.life + by);
  }

  gameOver(win: boolean) {
    this.gameOverPending = true;
    this.gameOverWin = win;
  }

  private messageBox(text: string) {
    this.fillRect(4, 22, 120, 19, 0);
    this.drawRect(4, 22, 120, 19, 1);
    this.drawText(64 - tdiv(text.length * 6, 2), 28, text, 1);
  }

  private center(y: number, text: string) {
    this.drawText(64 - tdiv(text.length * 6, 2), y, text, 1);
  }

  /** Shows what has been drawn so far and waits until A is pressed. */
  async showAndWait() {
    if (!this.opts.tiny) this.opts.show(this.buffer, this.inverted);
    await this.waitForA();
    this.nextFrame = this.millis();
  }

  async splash(text: string) {
    if (this.opts.tiny) this.buffer.fill(0);
    this.messageBox(text.slice(0, this.textMax));
    if (this.opts.tiny) this.opts.show(this.buffer, this.inverted);
    await this.showAndWait();
  }

  async pause(ms: number) {
    if (ms > 0) await this.sleep(ms);
    this.nextFrame = this.millis();
  }

  private async restart() {
    this.setSongVolume(100);
    this.clearParticles();
    this.speeches = [];
    this.sprites = Array.from({ length: this.maxSprites }, newSprite);
    this.map = null;
    this.camX = this.camY = 0;
    this.cameraSprite = this.controlled = NONE;
    this.timers.forEach((t, i) => Object.assign(t, { seconds: 0, mode: 0, format: 3, visible: false, x: 0, y: 10 + i * 9, last: this.millis(), remainder: 0 }));
    this.score = this.life = 0;
    this.showScore = this.showLife = this.gameOverPending = false;
    this.lifeX = this.lifeY = 1;
    this.scoreX = -1;
    this.scoreY = 0;
    this.soundOff();
    this.inverted = false;
    this.frameCount = 0;
    this.drawingMode = 0;
    this.background = null;
    this.backgroundLayers.forEach(layer => Object.assign(layer, { image: null, percent: 0, x: 0, y: 0 }));
    this.bgX = this.bgY = this.shakeLeft = 0;
    this.pitchLo = this.pitchHi = 100;
    this.hooks.init();
    await this.hooks.start();
  }

  private async showGameOver() {
    this.saveHiscore();
    this.music = null;
    this.stopSong();
    this.playEffect(this.gameOverWin ? SFX_WIN : SFX_LOSE);
    this.clear();
    this.center(8, this.gameOverWin ? 'YOU WIN!' : 'GAME OVER');
    if (this.showScore) {
      this.center(24, `SCORE ${this.score}`);
      this.center(34, `BEST ${this.hiscore}`);
    }
    this.center(52, 'PRESS A');
    this.opts.show(this.buffer, this.inverted);
    // Keep the sound effect playing while waiting.
    const timer = setInterval(() => this.updateSound(), 10);
    try {
      await this.waitForA();
    } finally {
      clearInterval(timer);
    }
    await this.restart();
    this.nextFrame = this.millis();
  }

  // Main loop -------------------------------------------------------------

  async begin(hooks: GameHooks) {
    this.hooks = hooks;
    this.stopped = false;
    this.pausedAt = null;
    this.startTime = performance.now();
    this.rng = this.opts.seed ?? ((Math.floor(Math.random() * 0xffff) & 0xffff) || 0xace1);
    this.loadHiscore();
    this.loopCount = 0;
    await this.restart();
    this.nextFrame = this.millis();
  }

  stop() {
    this.stopped = true;
    this.opts.tone(0);
  }

  get isStopped() {
    return this.stopped;
  }

  /** Runs one frame if it is time for it. Returns false if it was not. */
  /** force runs the frame now, used for gallery pictures. */
  async frame(force = false): Promise<boolean> {
    if (this.busy || this.stopped || this.pausedAt !== null) return false;
    const now = this.millis();
    if (!force && now - this.nextFrame < 0) return false;
    this.busy = true;
    try {
      this.nextFrame += FRAME_MS;
      if (now - this.nextFrame > FRAME_MS * 4) this.nextFrame = now + FRAME_MS;
      this.frameCount++;
      // A pitch block left early (return or break) only lasts until the next frame.
      this.pitchLo = this.pitchHi = 100;
      this.loopCount = 0;

      this.readButtons();
      for (let b = 0; b < BUTTON_IDS.length; b++) {
        const mask = 1 << b;
        if (this.buttons & mask && !(this.buttonsPrev & mask)) await this.hooks.button(b, 1);
        else if (!(this.buttons & mask) && this.buttonsPrev & mask) await this.hooks.button(b, 0);
      }
      await this.hooks.update();
      if (this.stopped) return false;
      this.updateSprites();
      this.updateParticles();
      await this.checkOverlaps();
      this.updateCamera();
      this.updateSound();

      // Shaking moves the camera for one frame and is undone after drawing.
      if (this.shakeLeft) {
        this.shakeLeft--;
        this.shakeX = this.random(-this.shakeAmp, this.shakeAmp);
        this.shakeY = this.random(-this.shakeAmp, this.shakeAmp);
      } else this.shakeX = this.shakeY = 0;
      this.camX += this.shakeX;
      this.camY += this.shakeY;
      this.clear();
      this.drawBackground();
      this.drawMap();
      this.drawSprites();
      this.drawParticles();
      try {
        await this.hooks.draw();
      } finally {
        this.camX -= this.shakeX;
        this.camY -= this.shakeY;
      }
      if (this.stopped) return false;
      this.drawSpeech();
      this.drawHud();
      this.opts.show(this.buffer, this.inverted);

      if (this.gameOverPending) await this.showGameOver();
      return true;
    } finally {
      this.busy = false;
    }
  }
}

