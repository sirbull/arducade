// Built in songs for the "play song" block. A song has up to four voices,
// written in the same note text as the melody block, and is turned into
// ATMlib song data (Arduboy Tracker Music). The device plays the data with
// core/ardublocks/ab_atm.h and the simulator with src/sim/atm.ts.
//
// Voices: 0 pulse (melody), 1 square (harmony), 2 triangle (bass), 3 noise
// (drums: any note is a hit, R is a rest). See docs/songs.md.

import { parseMelody } from './melody';

export interface SongDef {
  /** Beats per minute. */
  tempo: number;
  /** Note text for each voice, in the order pulse, square, triangle, noise. */
  voices: [string, string, string, string];
}

const bars = (text: string, n: number) => Array(n).fill(text).join(' ');

export const SONGS = {
  // A happy loop for a title screen.
  title: {
    tempo: 120,
    voices: [
      'E5:1 G E C D:2 G4:2 C5:1 E G C6 B5:2 G:2 A:1 F A C6 G5:1 E C E F:1 D B4 D5 C:4',
      'C4:1 E G E B3 D4 G D C E G E B3 D4 G D A3 C4 F C C E G E B3 D4 F D C4:4',
      'C3:2 G3 G3 D3 C3 G3 G3 D3 F3 C4 C3 G3 G3 D3 C3:4',
      bars('C:1 C:1/2 C C:1 C:1/2 C', 8),
    ],
  },
  // A driving loop for a level.
  adventure: {
    tempo: 140,
    voices: [
      'A4:1/2 C5 E C A4 C5 E C F4 A C5 A4 F A C5 A4 G4 C5 E C G4 C5 E C G4 B D5 B4 G B D5 G5 ' +
        'E5:1 D C:1/2 B4 A:1 C5:1 A4:1/2 F A:2 G4:1/2 A B C5 D:1 E E5:3 R:1',
      'E4:4 F4 E4 D4 E4 F4 E4 G#4',
      [bars('A3:1/2', 8), bars('F3', 8), bars('C3', 8), bars('G3', 8), bars('A3', 8), bars('F3', 8), bars('C3', 8), bars('E3', 8)].join(' '),
      bars('C:1 C:1/2 C C C C:1', 8),
    ],
  },
  // A tense loop for a boss fight.
  boss: {
    tempo: 150,
    voices: [
      'E5:2 D#5:1 E5 G5:2 F#5:1 E5 C5:2 B4:1 C5 B4:3 R:1',
      'B4:4 B G F#4',
      'E3:1/2 E E F E E G F# E E E F E E G F# C3 C C C# C C D# D B2 B B C3 B2 B C3 C#3',
      bars('C:1/2 C C:1 C:1/2 C C:1', 4),
    ],
  },
  // A short fanfare when a level is done.
  levelUp: {
    tempo: 160,
    voices: ['C5:1/2 E G C6:1 G5:1/2 C6:2', 'E4:1/2 G C5 E:1 C:1/2 E:2', 'C3:1/2 C C C:1 G3:1/2 C3:2', 'C:1/2 C C C:1 C:1/2 C:2'],
  },
  // A sad tune when the game is lost.
  gameOver: {
    tempo: 100,
    voices: ['C5:1 B4 Bb4 A4:3 Ab4:2 G4:4', '', 'E3:3 Eb3 D3:2 Db3 C3', ''],
  },
  // A fanfare when the game is won.
  victory: {
    tempo: 140,
    voices: [
      'G4:1/2 G G C5:2 D:1/2 D D E:2 G:5',
      'E4:1/2 E E G:2 B:1/2 B B C5:2 E:5',
      'C3:2 C G3 G C3:4',
      'C:1/2 C C C:2 C:1/2 C C C:2 C:1 C C C:2',
    ],
  },
} satisfies Record<string, SongDef>;

export type SongName = keyof typeof SONGS;
export const SONG_NAMES = Object.keys(SONGS) as SongName[];

// Volume of each voice (0 to 63, the noise voice plays at half) and how much
// it fades every tick. The sum stays below 128, so the mix never wraps.
const VOLUME = [36, 20, 40, 32];
const FADE = [0, 0, 0, -4];
/** Ticks per quarter beat. The tempo command sets about bpm / 5 ticks a second. */
const TICKS = 3;

/** ATMlib note number: 1 is about B2 (ATMlib plays noteTable[n] * 31250 / 65536 Hz). */
function atmNote(hz: number): number {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return Math.min(63, Math.max(1, midi - 46));
}

function delay(out: number[], ticks: number) {
  for (; ticks > 0; ticks -= 64) out.push(159 + Math.min(ticks, 64));
}

function voice(text: string, ch: number, tempo: number): number[] {
  const out: number[] = [];
  if (ch === 0) out.push(0x9d, Math.min(255, Math.max(1, Math.round(tempo / 10)))); // set tempo
  out.push(0x40, VOLUME[ch]); // set volume
  if (FADE[ch]) out.push(0x41, FADE[ch] & 0xff); // volume slide
  const { steps } = parseMelody(text);
  for (let i = 0; i < steps.length; i += 2) {
    const ticks = steps[i + 1] * TICKS;
    if (!steps[i]) {
      // Note off. Not on the noise voice: a note there restarts the volume.
      if (ch !== 3) out.push(0);
      delay(out, ticks);
    } else if (ch === 3) {
      out.push(1); // noise: the note only restarts the volume, the fade ends it
      delay(out, ticks);
    } else {
      // Note on, then off for the last tick, so two equal notes do not run together.
      out.push(atmNote(steps[i]));
      delay(out, ticks - 1);
      out.push(0);
      delay(out, 1);
    }
  }
  out.push(0x40, 0, 0x9f); // silence, stop channel
  return out;
}

/** ATMlib song data: track table, a start track for each channel, the tracks. */
export function songBytes(def: SongDef): number[] {
  const tracks = def.voices.map((text, ch) => voice(text, ch, def.tempo));
  const head = [tracks.length];
  let at = 0;
  for (const t of tracks) {
    head.push(at & 0xff, at >> 8);
    at += t.length;
  }
  return [...head, 0, 1, 2, 3, ...tracks.flat()];
}
