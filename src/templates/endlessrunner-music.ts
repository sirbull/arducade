import type { SongAsset } from '../project/model';

// Eight bars in E minor: pulse arpeggios, offbeat harmony, triangle bass and drums.
// Every voice has 32 beats, so the 12-second loop joins on the same downbeat.
export const runnerSongs: SongAsset[] = [{
  id: 'voidDrive', name: 'Void Drive', tempo: 160,
  voices: [
    [
      'E5:0.5 B4 E5 G5 B5 G5 E5 B4',
      'E5:0.5 G5 B5 E6 D6 B5 G5 R',
      'C5:0.5 G4 C5 E5 G5 E5 C5 G4',
      'C5:0.5 E5 G5 C6 B5 G5 E5 R',
      'A4:0.5 E5 A5 B5 C6 B5 A5 E5',
      'A5:0.5 E5 C5 E5 G5 E5 C5 R',
      'B4:0.5 F#5 B5 D#6 F#6 D#6 B5 F#5',
      'D#6:0.5 B5 F#5 D#5 B4 D#5 F#5 R',
    ].join(' '),
    ['B3', 'G4', 'G3', 'E4', 'E4', 'C4', 'F#4', 'D#4'].map(note =>
      `${note}:0.5 R:0.5 ${note}:0.5 R:0.5 ${note}:0.5 R:0.5 ${note}:0.5 R:0.5`).join(' '),
    ['E3', 'E3', 'C3', 'C3', 'A2', 'A2', 'B2', 'B2'].map(note =>
      `${note}:0.5 R:0.5 ${note}:0.5 ${note}:0.5 ${note}:0.5 R:0.5 ${note}:0.5 R:0.5`).join(' '),
    Array(8).fill('C:0.25 R:0.75 C:0.25 R:0.25 C:0.25 R:0.25 C:0.25 R:0.75 C:0.25 R:0.25 C:0.25 R:0.25').join(' '),
  ],
}];
