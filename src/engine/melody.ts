// Melodies written as text, for example "C D E F G:2 G:2". Each note is a
// letter (H is the same as B), then # or b, then an octave, then :beats.
// R or - is a rest. Octave and beats carry over to the next notes. The result
// is frequency and length pairs, where the length is in quarter beats. The
// engine turns quarter beats into milliseconds from the tempo.

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11 };
const NOTE = /^([A-H])(#|b)?(\d)?(?::(\d+(?:[./]\d+)?))?$/;
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

export function parseMelody(text: string): Melody {
  const steps: number[] = [];
  const bad: string[] = [];
  let octave = 4;
  let len = 4;
  for (const word of text.split(/[\s,|]+/).filter(Boolean)) {
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
    } else bad.push(word);
  }
  return { steps, bad };
}

/** Notes C4 to C6 for the note block, as [name, frequency]. */
export const NOTE_CHOICES: [string, number][] = [4, 5].flatMap((o) =>
  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map((n): [string, number] => [n + o, noteFreq(n[0], o, n[1])]),
).concat([['C6', noteFreq('C', 6)]]);
