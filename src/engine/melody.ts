// Melodies written as text, for example "C D E F G:2 G:2". Each note is a
// letter (H is the same as B), then # or b, then an octave, then :beats.
// R or - is a rest. Octave and beats carry over to the next notes. The result
// is frequency and length pairs, where the length is in quarter beats. The
// engine turns quarter beats into milliseconds from the tempo.

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
const NOTE = /^([A-H])(#|b)?(-?\d{1,2})?(?::(\d+(?:[./]\d+)?))?$/;
const REST = /^[R-](?::(\d+(?:[./]\d+)?))?$/;

export interface Melody {
  steps: number[];
  /** Words that are not notes. They are left out. */
  bad: string[];
}

function beats(s: string | undefined, prev: number): number {
  if (!s) return prev;
  const [a, b] = s.split('/');
  const v = b === undefined ? Number(a) : Number(a) / Number(b);
  return Number.isFinite(v) && v > 0 ? Math.max(1, Math.min(64, Math.round(v * 4))) : prev;
}

export function noteFreq(name: string, octave: number, accidental = ''): number {
  const midi = 12 * (octave + 1) + SEMI[name] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  return Math.round(440 * 2 ** ((midi - 69) / 12));
}

export interface MelodyToken { text: string; start: number; end: number; frequency: number; }

export function parseMelody(text: string, onStep?: (token: MelodyToken) => void): Melody {
  const steps: number[] = [];
  const bad: string[] = [];
  let octave = 4;
  let len = 4;
  for (const match of text.matchAll(/[^\s,|]+/g)) {
    const word = match[0];
    const up = word.charAt(0).toUpperCase() + word.slice(1);
    const rest = REST.exec(up);
    const note = NOTE.exec(up);
    if (rest) {
      len = beats(rest[1], len);
      steps.push(0, len);
    } else if (note) {
      if (note[3]) octave = Number(note[3]);
      len = beats(note[4], len);
      steps.push(noteFreq(note[1], octave, note[2]), len);
    } else { bad.push(word); continue; }
    onStep?.({ text: word, start: match.index!, end: match.index! + word.length, frequency: steps[steps.length - 2] });
  }
  return { steps, bad };
}

/** Notes C4 to C6 for the note block, as [name, frequency]. */
export const NOTE_CHOICES: [string, number][] = [4, 5].flatMap((o) =>
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((n): [string, number] => [n + o, noteFreq(n[0], o, n[1])]),
).concat([['C6', noteFreq('C', 6)]]);

/** Canonical note text. Octave and quarter-beat duration carry over. */
export function formatMelody(steps: readonly number[]): string {
  if (steps.length % 2) throw new Error('Unpaired melody step');
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const pitches = new Map<number, { name: string; octave: number }>();
  for (let o = 0; o <= 9; o++) for (const name of names) pitches.set(noteFreq(name[0], o, name[1]), { name, octave: o });
  pitches.set(noteFreq('B', -1), { name: 'B', octave: -1 });
  pitches.set(noteFreq('C', 10), { name: 'C', octave: 10 });
  let octave = 4, length = 4;
  const out: string[] = [];
  for (let i = 0; i < steps.length; i += 2) {
    const freq = steps[i], len = steps[i+1];
    if (!Number.isInteger(len) || len < 1 || len > 64) throw new Error('Invalid melody length');
    let word = 'R';
    if (freq) {
      const pitch = pitches.get(freq);
      if (!pitch) throw new Error('Frequency is not a supported note');
      word = pitch.name;
      if (pitch.octave !== octave) { octave = pitch.octave; word += octave; }
    }
    if (len !== length) { length = len; word += `:${len / 4}`; }
    out.push(word);
  }
  return out.join(' ');
}

/** Monophonic recording in milliseconds, rounded to quarter beats. */
export class MelodyRecording {
  steps: number[] = [];
  private current = 0;
  private since: number;
  constructor(private tempo: number, now: number) { this.since = now; }
  change(freq: number, now: number) {
    const elapsed = Math.max(0, now - this.since), quarter = 15000 / this.tempo;
    if (this.current || elapsed >= quarter / 2) {
      this.steps.push(this.current, Math.max(1, Math.min(64, Math.round(elapsed / quarter))));
    }
    this.current = freq; this.since = now;
  }
}
