import type { GameHooks } from '../gen/js';
import { Engine } from './engine';

/** The shared square-wave output for simulator beeps and melody audition. */
export class SquareTone {
  private osc?: OscillatorNode;
  private gain?: GainNode;
  private timer: ReturnType<typeof setTimeout> | undefined;
  play(audio: AudioContext | null, freq: number, ms?: number) {
    clearTimeout(this.timer);
    if (!audio) return;
    if (freq <= 0) { this.gain?.gain.setTargetAtTime(0, audio.currentTime, 0.005); return; }
    if (!this.osc) {
      this.osc = audio.createOscillator(); this.gain = audio.createGain();
      this.osc.type = 'square'; this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(audio.destination); this.osc.start();
    }
    this.osc.frequency.setValueAtTime(freq, audio.currentTime);
    this.gain!.gain.setTargetAtTime(0.05, audio.currentTime, 0.002);
    if (ms) this.timer = setTimeout(() => this.play(audio, 0), ms);
  }
}

/** Audition uses the simulator's melody scheduler, including frame quantisation. */
export class BeepAudition {
  private audio: AudioContext | null = null;
  private square = new SquareTone();
  private engine?: Engine;
  private timer?: ReturnType<typeof setInterval>;
  private generation = 0;
  private onStep?: (index: number | null, frequency: number) => void;
  tone(freq: number, ms?: number) {
    if (!this.audio && freq > 0) { try { this.audio = new AudioContext(); } catch { return; } }
    if (this.audio?.state === 'suspended') void this.audio.resume();
    this.square.play(this.audio, freq, ms);
  }
  async play(steps: number[], tempo: number, onStep?: (index: number | null, frequency: number) => void) {
    this.stop();
    this.onStep = onStep;
    const generation = this.generation;
    const engine = new Engine({ show: () => {}, tone: (f, ms) => this.tone(f, ms), melodyStep: (i, f) => { if (generation === this.generation) this.onStep?.(i, f); }, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 1, hiscoreMagic: 0 });
    this.engine = engine;
    this.tone(0);
    // Resume the AudioContext while still in the user's activation event.
    this.tone(1); this.tone(0);
    const hooks: GameHooks = { init: () => {}, start: async () => { engine.playMelody(steps, tempo, false); }, update: async () => {}, draw: async () => {}, button: async () => {}, overlap: async () => {}, tile: async () => {}, lifeZero: async () => false, hasOverlap: false, hasTile: false };
    await engine.begin(hooks);
    if (generation !== this.generation) { engine.stop(); return; }
    this.timer = setInterval(() => { void engine.frame(true).then(() => { if (!engine.melodyPlaying && generation === this.generation) this.stop(); }); }, 33);
  }
  dispose() { this.stop(); if (this.audio) void this.audio.close(); this.audio = null; }
  stop() { this.generation++; clearInterval(this.timer); this.engine?.stop(); this.engine = undefined; this.tone(0); const onStep = this.onStep; this.onStep = undefined; onStep?.(null, 0); }
}
