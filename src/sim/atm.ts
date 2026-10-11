// The ATMlib player (Arduboy Tracker Music) for the simulator: the same
// playroutine and four voice mixer as core/ardublocks/ab_atm.h, with the same
// 8 bit arithmetic, so a song sounds like it does on an Arduboy. It renders a
// whole song to samples ahead of time.
//
// Based on ATMlib by TEAM a.r.g., Davey Taylor and Joeri Gantois, BSD 3-Clause
// License. See core/ardublocks/ab_atm.h.

/** Samples a second: Timer4 overflows at 62500 Hz and the mixer runs every second time. */
export const ATM_RATE = 31250;

const NOTE_TABLE = [
  0,
  262, 277, 294, 311, 330, 349, 370, 392, 415, 440, 466, 494,
  523, 554, 587, 622, 659, 698, 740, 784, 831, 880, 932, 988,
  1047, 1109, 1175, 1245, 1319, 1397, 1480, 1568, 1661, 1760, 1865, 1976,
  2093, 2217, 2349, 2489, 2637, 2794, 2960, 3136, 3322, 3520, 3729, 3951,
  4186, 4435, 4699, 4978, 5274, 5588, 5920, 6272, 6645, 7040, 7459, 7902,
  8372, 8870, 9397,
];

const s8 = (v: number) => (v << 24) >> 24;
const note = (i: number) => NOTE_TABLE[i] ?? 0;

interface Channel {
  ptr: number; note: number;
  stackPointer: number[]; stackCounter: number[]; stackTrack: number[]; stackIndex: number;
  delay: number; counter: number; track: number;
  freq: number; vol: number;
  volFreSlide: number; volFreConfig: number; volFreCount: number;
  arpNotes: number; arpTiming: number; arpCount: number;
  reConfig: number; reCount: number;
  transConfig: number;
  treviDepth: number; treviConfig: number; treviCount: number;
  glisConfig: number; glisCount: number;
}

const newChannel = (): Channel => ({
  ptr: 0, note: 0, stackPointer: [], stackCounter: [], stackTrack: [], stackIndex: 0, delay: 0, counter: 0, track: 0,
  freq: 0, vol: 0, volFreSlide: 0, volFreConfig: 0, volFreCount: 0, arpNotes: 0, arpTiming: 0, arpCount: 0,
  reConfig: 0, reCount: 0, transConfig: 0, treviDepth: 0, treviConfig: 0, treviCount: 0, glisConfig: 0, glisCount: 0,
});

export class AtmPlayer {
  osc = [0, 1, 2, 3].map(() => ({ vol: 0, freq: 0, phase: 0 }));
  ch: Channel[] = [];
  /** Bits 4 to 7: the channel still plays. Bits 0 to 3: the channel is muted. */
  active = 0xf0;
  cia = 0;
  private ciaCount = 1;
  private tickRate = 25;
  private trackList = 0;
  private trackBase = 0;

  constructor(private song: number[]) {
    this.load();
  }

  private byte(at: number) {
    return this.song[at] ?? 0;
  }

  private trackPointer(track: number) {
    const at = this.trackList + track * 2;
    return this.trackBase + (this.byte(at) | (this.byte(at + 1) << 8));
  }

  /** Reads a variable length number at ch.ptr. */
  private vle(ch: Channel) {
    let q = 0;
    let d;
    do {
      d = this.byte(ch.ptr++);
      q = ((q << 7) | (d & 0x7f)) & 0xffff;
    } while (d & 0x80);
    return q;
  }

  load() {
    this.ch = [0, 1, 2, 3].map(newChannel);
    this.tickRate = 25;
    this.cia = Math.floor(15625 / this.tickRate);
    this.osc[3].freq = 1; // seed the noise
    this.ch[3].freq = 1;
    this.active = 0xf0;
    const count = this.byte(0);
    this.trackList = 1;
    this.trackBase = 1 + count * 2 + 4;
    for (let n = 0; n < 4; n++) this.ch[n].ptr = this.trackPointer(this.byte(1 + count * 2 + n));
  }

  /** One tick of the song. False when every channel has stopped. */
  playroutine(): boolean {
    if (!(this.active & 0xf0)) return false;
    for (let n = 0; n < 4; n++) {
      const ch = this.ch[n];

      // Noise retriggering
      if (ch.reConfig) {
        if (ch.reCount >= (ch.reConfig & 0x03)) {
          this.osc[n].freq = note(ch.reConfig >> 2);
          ch.reCount = 0;
        } else ch.reCount = (ch.reCount + 1) & 0xff;
      }

      // Glissando
      if (ch.glisConfig) {
        if (ch.glisCount >= (ch.glisConfig & 0x7f)) {
          ch.note = (ch.glisConfig & 0x80 ? ch.note - 1 : ch.note + 1) & 0xff;
          if (ch.note < 1) ch.note = 1;
          else if (ch.note > 63) ch.note = 63;
          ch.freq = note(ch.note);
          ch.glisCount = 0;
        } else ch.glisCount = (ch.glisCount + 1) & 0xff;
      }

      // Volume and frequency slides
      if (ch.volFreSlide) {
        if (!ch.volFreCount) {
          const isFreq = ch.volFreConfig & 0x40;
          let vf = (isFreq ? ch.freq : ch.vol) + ch.volFreSlide;
          if (!(ch.volFreConfig & 0x80)) {
            if (vf < 0) vf = 0;
            else if (isFreq && vf > 9397) vf = 9397;
          }
          if (isFreq) ch.freq = vf & 0xffff;
          else ch.vol = vf & 0xff;
        }
        if (ch.volFreCount >= (ch.volFreConfig & 0x3f)) ch.volFreCount = 0;
        else ch.volFreCount++;
      }

      // Arpeggio or note cut
      if (ch.arpNotes && ch.note) {
        if ((ch.arpCount & 0x1f) < (ch.arpTiming & 0x1f)) ch.arpCount++;
        else {
          if ((ch.arpCount & 0xe0) === 0x00) ch.arpCount = 0x20;
          else if ((ch.arpCount & 0xe0) === 0x20 && !(ch.arpTiming & 0x40) && ch.arpNotes !== 0xff) ch.arpCount = 0x40;
          else ch.arpCount = 0x00;
          let arpNote = ch.note;
          if ((ch.arpCount & 0xe0) !== 0x00) {
            if (ch.arpNotes === 0xff) arpNote = 0;
            else arpNote = (arpNote + (ch.arpNotes >> 4)) & 0xff;
          }
          if ((ch.arpCount & 0xe0) === 0x40) arpNote = (arpNote + (ch.arpNotes & 0x0f)) & 0xff;
          ch.freq = note(arpNote + ch.transConfig);
        }
      }

      // Tremolo or vibrato
      if (ch.treviDepth) {
        const isFreq = ch.treviConfig & 0x40;
        let vt = isFreq ? ch.freq : ch.vol;
        vt = ch.treviCount & 0x80 ? vt + ch.treviDepth : vt - ch.treviDepth;
        if (vt < 0) vt = 0;
        else if (isFreq && vt > 9397) vt = 9397;
        if (isFreq) ch.freq = vt;
        else ch.vol = vt & 0xff;
        if ((ch.treviCount & 0x1f) < (ch.treviConfig & 0x1f)) ch.treviCount++;
        else ch.treviCount = ch.treviCount & 0x80 ? 0 : 0x80;
      }

      if (ch.delay) ch.delay--;
      else {
        do {
          const cmd = this.byte(ch.ptr++);
          if (cmd < 64) {
            // Note on, or off for 0
            ch.note = cmd;
            if (ch.note) ch.note = (ch.note + ch.transConfig) & 0xff;
            ch.freq = note(ch.note);
            ch.vol = ch.reCount;
            if (ch.arpTiming & 0x20) ch.arpCount = 0;
          } else if (cmd < 160) {
            const read = () => this.byte(ch.ptr++);
            switch (cmd - 64) {
              case 0: ch.vol = ch.reCount = read(); break;
              case 1: case 4: ch.volFreSlide = s8(read()); ch.volFreConfig = cmd - 64 === 1 ? 0x00 : 0x40; break;
              case 2: case 5: ch.volFreSlide = s8(read()); ch.volFreConfig = read(); break;
              case 3: case 6: ch.volFreSlide = 0; break;
              case 7: ch.arpNotes = read(); ch.arpTiming = read(); break;
              case 8: ch.arpNotes = 0; break;
              case 9: ch.reConfig = read(); break;
              case 10: ch.reConfig = 0; break;
              case 11: ch.transConfig = s8(ch.transConfig + read()); break;
              case 12: ch.transConfig = s8(read()); break;
              case 13: ch.transConfig = 0; break;
              case 14: case 16: ch.treviDepth = read(); ch.treviConfig = (read() + (cmd - 64 === 14 ? 0x00 : 0x40)) & 0xff; break;
              case 15: case 17: ch.treviDepth = 0; break;
              case 18: ch.glisConfig = read(); break;
              case 19: ch.glisConfig = 0; break;
              case 20: ch.arpNotes = 0xff; ch.arpTiming = read(); break;
              case 21: ch.arpNotes = 0; break;
              case 92: this.tickRate = (this.tickRate + read()) & 0xff; this.cia = Math.floor(15625 / this.tickRate); break;
              case 93: this.tickRate = read(); this.cia = Math.floor(15625 / this.tickRate); break;
              case 94: for (const c of this.ch) c.track = read(); break;
              case 95: this.active ^= 1 << (n + 4); ch.delay = 0xffff; break;
            }
          } else if (cmd < 224) ch.delay = cmd - 159;
          else if (cmd === 224) ch.delay = (this.vle(ch) + 129) & 0xffff;
          else if (cmd === 252 || cmd === 253) {
            // Call a track, once or repeated
            ch.stackCounter[ch.stackIndex] = ch.counter;
            ch.stackTrack[ch.stackIndex] = ch.track;
            ch.counter = cmd === 252 ? 0 : this.byte(ch.ptr++);
            ch.track = this.byte(ch.ptr++);
            ch.stackPointer[ch.stackIndex] = ch.ptr;
            ch.stackIndex++;
            ch.ptr = this.trackPointer(ch.track);
          } else if (cmd === 254) {
            // Return, or repeat the track
            if (ch.counter > 0) {
              ch.counter--;
              ch.ptr = this.trackPointer(ch.track);
            } else if (ch.stackIndex === 0) ch.delay = 0xffff;
            else {
              ch.stackIndex--;
              ch.ptr = ch.stackPointer[ch.stackIndex];
              ch.counter = ch.stackCounter[ch.stackIndex];
              ch.track = ch.stackTrack[ch.stackIndex];
            }
          } else if (cmd === 255) ch.ptr += this.vle(ch); // embedded data
        } while (ch.delay === 0);
        ch.delay = (ch.delay - 1) & 0xffff;
      }

      if (!(this.active & (1 << n))) {
        if (n === 3) this.osc[n].vol = ch.vol >> 1;
        else {
          this.osc[n].freq = ch.freq;
          this.osc[n].vol = ch.vol;
        }
      }
    }
    return true;
  }

  /** One mixer sample, 0 to 255 like OCR4A. False as the value when the song has ended. */
  sample(): number | false {
    const [o0, o1, o2, o3] = this.osc;
    o2.phase = (o2.phase + o2.freq) & 0xffff; // triangle
    let t = o2.phase >> 8;
    if (t & 0x80) t = ~t & 0xff;
    t = (((t << 1) & 0xff) - 128) & 0xff;
    let acc = (((((s8(t) * s8(o2.vol)) & 0xffff) >> 8) << 1) & 0xff);
    o0.phase = (o0.phase + o0.freq) & 0xffff; // pulse, 25 %
    let hi = o0.phase >> 8;
    acc += ((hi << 1) & hi & 0x80) ? -o0.vol : o0.vol;
    o1.phase = (o1.phase + o1.freq) & 0xffff; // square
    acc += (o1.phase & 0x8000) ? -o1.vol : o1.vol;
    let f = (o3.freq << 1) & 0xffff; // noise from a shift register
    hi = f >> 8;
    if (hi & 0x80) f ^= 1;
    if (hi & 0x40) f ^= 1;
    o3.freq = f;
    acc += (hi & 0x80) ? -o3.vol : o3.vol;
    const out = (acc + 128) & 0xff;
    if (--this.ciaCount === 0) {
      this.ciaCount = this.cia;
      if (!this.playroutine()) return false;
    }
    return out;
  }
}

/** The whole song as samples from -1 to 1 at ATM_RATE, at most maxSeconds long. */
export function renderSong(song: number[], maxSeconds = 120): Float32Array {
  const player = new AtmPlayer(song);
  const out = new Float32Array(ATM_RATE * maxSeconds);
  let n = 0;
  for (; n < out.length; n++) {
    const v = player.sample();
    if (v === false) break;
    out[n] = (v - 128) / 128;
  }
  return out.subarray(0, n);
}
