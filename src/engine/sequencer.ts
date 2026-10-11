import { formatMelody, parseMelody } from './melody';

export interface SequenceNote { at: number; length: number; frequency: number; }
export function sequence(text: string): { notes: SequenceNote[]; length: number; bad: string[] } {
  const parsed = parseMelody(text), notes: SequenceNote[] = [];
  let at = 0;
  for (let i = 0; i < parsed.steps.length; i += 2) {
    if (parsed.steps[i]) notes.push({ at, length: parsed.steps[i + 1], frequency: parsed.steps[i] });
    at += parsed.steps[i + 1];
  }
  return { notes, length: at, bad: parsed.bad };
}
/** Each hardware voice is monophonic. Drawing replaces all overlapping notes. */
export function placeNote(notes: SequenceNote[], at: number, length: number, frequency: number): SequenceNote[] {
  const end = at + length;
  return [...notes.filter(n => n.at + n.length <= at || n.at >= end), { at, length, frequency }].sort((a,b) => a.at-b.at);
}
export function sequenceText(notes: SequenceNote[], length: number): string {
  const steps: number[] = [];
  const append = (frequency: number, quarters: number) => { while (quarters > 0) { const n = Math.min(64,quarters); steps.push(frequency,n); quarters -= n; } };
  let at = 0;
  for (const note of [...notes].sort((a,b) => a.at-b.at)) {
    if (note.at < at || note.at >= length) continue;
    append(0,note.at-at); const duration = Math.min(note.length,length-note.at);
    append(note.frequency,duration); at = note.at + duration;
  }
  append(0,length-at);
  return formatMelody(steps);
}
