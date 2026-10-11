import { songBytes, type SongDef } from '../engine/songs';
import { sequence } from '../engine/sequencer';
import { ATM_RATE, renderSong } from './atm';

/** Uses the device's four-voice mixer rather than four unrelated browser oscillators. */
export class SongAudition {
  private audio?: AudioContext;
  private source?: AudioBufferSourceNode;
  private timer?: ReturnType<typeof setInterval>;
  private feedback?: (quarter: number | null) => void;
  play(song: SongDef, loop: boolean, feedback: (quarter: number | null) => void, mutedVoices = 0) {
    this.stop();
    this.audio ??= new AudioContext();
    if (this.audio.state === 'suspended') void this.audio.resume();
    const quarterSeconds = 3 * Math.floor(15625 / Math.max(1, Math.round(song.tempo / 10))) / ATM_RATE;
    const seconds = Math.ceil(Math.max(...song.voices.map(v=>sequence(v).length))*quarterSeconds)+1;
    const samples = renderSong(songBytes(song),seconds,100,mutedVoices);
    if (!samples.length) return;
    const buffer = this.audio.createBuffer(1,samples.length,ATM_RATE);
    buffer.getChannelData(0).set(samples);
    const source = this.audio.createBufferSource(); source.buffer = buffer; source.loop = loop;
    source.connect(this.audio.destination); this.source = source; this.feedback = feedback;
    const started = this.audio.currentTime;
    source.onended = () => { if (this.source === source) this.stop(); };
    source.start(); feedback(0);
    this.timer = setInterval(() => feedback(((this.audio!.currentTime-started) % buffer.duration) / quarterSeconds),33);
  }
  stop() {
    clearInterval(this.timer);
    const source = this.source; this.source = undefined;
    if (source) { source.onended = null; source.stop(); source.disconnect(); }
    const feedback = this.feedback; this.feedback = undefined; feedback?.(null);
  }
}
