// Simulator version of the game engine. This is a port of
// core/ardublocks/ardublocks.h and must stay in sync with it: same integer
// math and the same order of updates, so games behave the same in the
// simulator and on the device.

import { BUTTON_IDS, FRAME_MS, NONE, SFX, SFX_STEPS, STORAGE_SLOTS } from '../engine/enums';
import type { GameHooks } from '../gen/js';
import { FONT_5X7 } from '../shared/font';

const FLAG_STAY_IN_SCREEN = 1;
const FLAG_BOUNCE_ON_WALL = 2;
const FLAG_GHOST = 4;
const FLAG_AUTO_DESTROY = 8;
const FLAG_INVISIBLE = 16;
const FLAG_DESTROY_ON_WALL = 32;
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

/** Stops a running game while it waits inside splash or pause. */
export class StopSignal extends Error {}

/** Thrown when a loop runs for too long in one frame. */
export class LoopError extends Error {}

interface Sprite {
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
  hit: number;
  frame: number;
  animRate: number;
  animCount: number;
  alive: boolean;
}

function newSprite(): Sprite {
  return { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, img: null, kind: 0, flags: 0, outline: 0, outlineWidth: 1, hit: 0, frame: 0, animRate: 0, animCount: 0, alive: false };
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
  /** Reads and writes the simulated EEPROM. */
  storage: { read(addr: number): number; write(addr: number, v: number): void };
  /** Called once when the game uses a C++ block. */
  onSkippedCpp(): void;
  maxSprites: number;
  hiscoreMagic: number;
}

export class Engine {
  buffer = new Uint8Array(1024);
  maxSprites: number;
  sprites: Sprite[];
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
  showLife = false;
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

  map: number[] | null = null;
  tileImages: (Uint8Array | null)[] = [null];
  solidTiles = 0;
  private cleared = new Set<number>();
  private overlay: { idx: number; tile: number }[] = [];

  private soundSteps: number[] | null = null;
  private soundPos = 0;
  private soundNext = 0;
  private music: { steps: number[]; pos: number; next: number; tempo: number; loop: boolean } | null = null;

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

  particles: { x: number; y: number; vx: number; vy: number; endVx: number; endVy: number; duration: number; color: number; img: Uint8Array | null; remaining: number }[] = [];

  get maxParticles() { return this.maxSprites <= 12 ? 12 : 16; }

  clearParticles() { this.particles = []; }

  emitParticle(img: Uint8Array | null, x: number, y: number, vx: number, vy: number, ms: number, endVx = vx, endVy = vy, color = -1) {
    if (ms <= 0 || this.particles.length >= this.maxParticles) return;
    this.particles.push({ img, x: x * 256, y: y * 256, vx, vy, endVx, endVy, duration: ms, remaining: ms, color: color === 2 ? this.random(0, 1) : color });
  }

  private updateParticles() {
    for (const p of this.particles) {
      const step = Math.min(p.remaining, FRAME_MS);
      const midpoint = p.duration - p.remaining + tdiv(step, 2);
      const vx = p.vx + tdiv((p.endVx - p.vx) * midpoint, p.duration);
      const vy = p.vy + tdiv((p.endVy - p.vy) * midpoint, p.duration);
      p.x += tdiv(vx * 256 * step, 1000);
      p.y += tdiv(vy * 256 * step, 1000);
      p.remaining -= step;
    }
    this.particles = this.particles.filter(p => p.remaining > 0);
  }

  private drawParticles() {
    for (const p of this.particles) {
      const x = Math.floor(p.x / 256) - this.camX, y = Math.floor(p.y / 256) - this.camY;
      if (p.img) this.drawImage(x - tdiv(p.img[0], 2), y - tdiv(p.img[1], 2), p.img, 0, p.color);
      else this.drawPixel(x, y, p.color === 0 ? 0 : 1);
    }
  }

  // Helpers used by the generated code ------------------------------------

  image(bytes: number[]): Uint8Array {
    return Uint8Array.from(bytes);
  }

  /** Loop guard, called at the top of every loop body. */
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
    this.hline(x, y + h - 1, w, color);
    for (let j = 1; j < h - 1; j++) {
      this.drawPixel(x, y + j, color);
      this.drawPixel(x + w - 1, y + j, color);
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
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      if (fill) {
        this.hline(cx - x, cy + y, 2 * x + 1, color);
        this.hline(cx - x, cy - y, 2 * x + 1, color);
        this.hline(cx - y, cy + x, 2 * y + 1, color);
        this.hline(cx - y, cy - x, 2 * y + 1, color);
      } else {
        for (const [a, b] of [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]]) this.drawPixel(cx + a, cy + b, color);
      }
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
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
          this.buffer[b] = (this.buffer[b] & ~m & 0xff) | (d & 0xff);
        }
        if (shift && page + 1 >= 0 && page + 1 < 8) {
          const b = (page + 1) * 128 + col;
          this.buffer[b] = (this.buffer[b] & ~(m >> 8) & 0xff) | ((d >> 8) & 0xff);
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
    for (const c of s.slice(0, 31)) {
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
    this.soundSteps = null;
    this.music = null;
  }

  playTone(freq: number, ms: number) {
    this.soundSteps = null;
    this.opts.tone(freq > 0 ? freq : 0, ms);
  }

  playEffect(id: number) {
    const name = SFX[id];
    if (!name) return;
    this.soundSteps = SFX_STEPS[name];
    this.soundPos = 0;
    this.soundNext = 0;
  }

  /** Music plays in the background, same as playMelody in ardublocks.h. */
  playMelody(steps: number[], bpm: number, loop: boolean) {
    this.music = { steps, pos: 0, next: 0, tempo: Math.min(Math.max(bpm, 20), 600), loop };
  }

  private updateSound() {
    if (this.pausedAt !== null) return;
    const now = this.millis();
    if (this.soundSteps && now >= this.soundNext) {
      if (this.soundPos >= this.soundSteps.length) {
        this.soundSteps = null;
        this.opts.tone(0);
      } else {
        this.opts.tone(this.soundSteps[this.soundPos]);
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
      const f = m.steps[m.pos];
      const ms = Math.floor((m.steps[m.pos + 1] * 15000) / m.tempo);
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
      const down = this.inputTransitions[b].shift() ?? !!(this.input & (1 << b));
      if (down) this.buttons |= 1 << b;
      else this.buttons &= ~(1 << b);
    }
  }

  isPressed(b: number): boolean {
    return (this.buttons & (1 << b)) !== 0;
  }

  private async waitForA() {
    const poll = async (want: boolean) => {
      do {
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
    const until = this.millis() + ms;
    return new Promise((resolve, reject) => {
      const poll = () => {
        if (this.stopped) return reject(new StopSignal());
        if (this.pausedAt === null && this.millis() >= until) return resolve();
        setTimeout(poll, Math.min(10, Math.max(1, until - this.millis())));
      };
      poll();
    });
  }

  setPaused(paused: boolean) {
    if (paused && this.pausedAt === null) {
      this.pausedAt = performance.now();
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
    if (this.overlay.length === 8) this.overlay.shift();
    this.overlay.push({ idx, tile });
  }

  private isSolid(col: number, row: number): boolean {
    if (!this.map) return false;
    if (col < 0 || col >= this.mapW()) return true;
    if (row < 0 || row >= this.mapH()) return false;
    return (this.solidTiles & (1 << this.tileAt(col, row))) !== 0;
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

  destroy(s: number) {
    if (s >= 0 && s < this.maxSprites) this.sprites[s].alive = false;
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
    if (horizontal) {
      const col = delta > 0 ? right >> 3 : left >> 3;
      for (let row = top >> 3; row <= bottom >> 3; row++) {
        if (!this.isSolid(col, row)) continue;
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
        if (!this.isSolid(col, row)) continue;
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

  private drawSprites() {
    for (const sp of this.sprites) {
      if (!sp.alive || sp.flags & FLAG_INVISIBLE) continue;
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
      this.drawImage(x, y, sp.img, sp.frame);
    }
  }

  // Score and lives -------------------------------------------------------

  private drawHud() {
    if (this.showLife) {
      const heart = [0x06, 0x0f, 0x1e, 0x0f, 0x06];
      for (let i = 0; i < this.life && i < 8; i++) {
        for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) if (heart[c] & (1 << r)) this.drawPixel(1 + i * 7 + c, 1 + r, 1);
      }
    }
    if (this.showScore) {
      const text = String(this.score);
      const w = text.length * 6;
      this.fillRect(127 - w - 1, 0, w + 2, 9, 0);
      this.drawText(127 - w, 1, text, 1);
    }
  }

  setScore(v: number) {
    this.score = w16(v);
    this.showScore = true;
  }

  changeScore(by: number) {
    this.setScore(this.score + by);
  }

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
    this.opts.show(this.buffer, this.inverted);
    await this.waitForA();
    this.nextFrame = this.millis();
  }

  async splash(text: string) {
    this.messageBox(text.slice(0, 31));
    await this.showAndWait();
  }

  async pause(ms: number) {
    if (ms > 0) await this.sleep(ms);
    this.nextFrame = this.millis();
  }

  private async restart() {
    this.clearParticles();
    this.sprites = Array.from({ length: this.maxSprites }, newSprite);
    this.map = null;
    this.camX = this.camY = 0;
    this.cameraSprite = this.controlled = NONE;
    this.score = this.life = 0;
    this.showScore = this.showLife = this.gameOverPending = false;
    this.soundOff();
    this.inverted = false;
    this.frameCount = 0;
    this.hooks.init();
    await this.hooks.start();
  }

  private async showGameOver() {
    this.saveHiscore();
    this.music = null;
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
    this.rng = (Math.floor(Math.random() * 0xffff) & 0xffff) || 0xace1;
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

      this.clear();
      this.drawMap();
      this.drawSprites();
      this.drawParticles();
      await this.hooks.draw();
      if (this.stopped) return false;
      this.drawHud();
      this.opts.show(this.buffer, this.inverted);

      if (this.gameOverPending) await this.showGameOver();
      return true;
    } finally {
      this.busy = false;
    }
  }
}

