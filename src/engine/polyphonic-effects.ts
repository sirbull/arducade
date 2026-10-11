import type { SongDef, VoiceSound } from './songs';

const sound = (volume: number, decay: number, extra: Partial<VoiceSound> = {}): VoiceSound => ({ volume, decay, ...extra });

/** Miniature sound designs: independent pulse, square, triangle and noise layers.
 * The envelopes, glides and vibrato use ATMlib commands on both targets.
 * Each effect pauses the song player, finishes without looping, then resumes
 * the background at the saved position.
 */
export const POLYPHONIC_EFFECTS = {
  // Springy rising sweep, with a held fifth and a low take-off thump.
  jump: {
    tempo: 600,
    voices: ['C4:1 G5:0.5 C6:0.5', 'G4:1.5 E5:0.5', 'C3:0.5 G3:0.5 R:1', 'C:0.25 R:1.75'],
    sounds: [sound(28, 1, {glide: 'up'}), sound(28, 1), sound(42, 4), sound(36, 6)],
  },
  // Sparkling two-stage chime over a sustained major chord.
  coin: {
    tempo: 360,
    voices: ['E6:0.5 B6:0.5 E7:1.5', 'G5:0.75 B5:0.75 E6:1', 'C4:2.5', 'C:0.25 R:2.25'],
    sounds: [sound(26, 2), sound(30, 1), sound(40, 1), sound(24, 8)],
  },
  // Fast upward sparkle over changing chords and a rising bass.
  powerUp: {
    tempo: 300,
    voices: ['C5:0.25 E5:0.25 G5:0.25 B5:0.25 C6:0.25 E6:0.25 G6:0.5 C7:2', 'E4:1 A4:1 E5:2', 'C3:1 F3:1 C4:2', 'C:0.25 R:0.75 C:0.25 R:0.75 C:0.5 R:1.5'],
    sounds: [sound(28, 2), sound(30, 1), sound(42, 1), sound(34, 4)],
  },
  // Two descending laser sweeps, offset against a bass impact and hiss.
  laser: {
    tempo: 600,
    voices: ['C7:2 R:0.25 G6:1.75', 'G5:0.5 D6:2.5 R:1', 'C3:1 R:3', 'C:1.5 R:0.5 C:0.5 R:1.5'],
    sounds: [sound(28, 1, {glide: 'down'}), sound(26, 1, {glide: 'down'}), sound(42, 3), sound(42, 2)],
  },
  // Discordant falling debris, deep rumble and a long noise tail.
  explosion: {
    tempo: 240,
    voices: ['C5:1 F#4:1 B3:2.5', 'F#3:2 C4:1 B2:1.5', 'C3:1 B2:3.5', 'C:3.5 R:1'],
    sounds: [sound(22, 2, {glide: 'down'}), sound(24, 1, {glide: 'down'}), sound(44, 1), sound(44, 1)],
  },
  // A glowing minor ninth chord with rippling high notes and a pulsing bass.
  shield: {
    tempo: 300,
    voices: ['E6:0.5 B6:0.25 G6:0.25 E6:0.5 B6:0.25 G6:0.25 E6:2', 'C5:2 B4:2', 'A3:1 E4:1 A3:2', 'C:0.25 R:0.75 C:0.25 R:0.75 C:0.25 R:1.75'],
    sounds: [sound(26, 1), sound(30, 0, {vibrato: {depth: 6, ticks: 2}}), sound(42, 1), sound(30, 6)],
  },
  // Three-part fanfare, bass roots and a short celebratory drum roll.
  win: {
    tempo: 240,
    voices: ['G5:0.5 C6:0.5 E6:1 G6:3', 'E5:1 F5:1 E5:3', 'C3:1 F3:1 C4:3', 'C:0.25 C:0.25 R:0.5 C:0.25 C:0.25 R:0.5 C:0.5 R:2.5'],
    sounds: [sound(28, 1), sound(30, 0), sound(42, 1), sound(36, 4)],
  },
  // Falling minor chords with a bass drop and a muted final impact.
  lose: {
    tempo: 200,
    voices: ['E5:1 Eb5:1 D5:1 C5:2', 'C5:1 B4:1 Bb4:1 G4:2', 'C3:1 B2:2 C3:2', 'C:0.5 R:2.5 C:0.5 R:1.5'],
    sounds: [sound(26, 1), sound(30, 1), sound(42, 1), sound(32, 4)],
  },
} satisfies Record<string, SongDef>;

export type PolyphonicEffectName = keyof typeof POLYPHONIC_EFFECTS;
export const POLYPHONIC_EFFECT_NAMES = Object.keys(POLYPHONIC_EFFECTS) as PolyphonicEffectName[];
