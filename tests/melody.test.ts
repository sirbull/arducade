import { expect, it, vi } from 'vitest';
import { Engine } from '../src/sim/engine';
import { parseMelody, formatMelody, noteFreq, MelodyRecording } from '../src/engine/melody';
import { generateCpp } from '../src/gen/cpp';
import { generateJs } from '../src/gen/js';
import type { Program } from '../src/ir/ir';
import { newProject } from '../src/project/model';

it('parses notes, octaves, lengths and rests', () => {
  expect(parseMelody('A C5 R:2 e:1/2 H3 Bb x').steps).toEqual([440, 4, 523, 4, 0, 8, 659, 2, 247, 2, 233, 2]);
  expect(parseMelody('A x9 C').bad).toEqual(['x9']);
});

it('compiles a melody to a flash table on the device and an array in the simulator', () => {
  const melody = { k: 'enum', type: 'melody', v: 'C D x' } as const;
  const program: Program = { vars: [], funcs: [], events: [{ k: 'start', body: [{ k: 'expr', e: { k: 'api', fn: 'music.melody', args: [melody, { k: 'num', v: 90 }, { k: 'bool', v: true }] } }] }] };
  const cpp = generateCpp(program, newProject('Song'));
  expect(cpp.code).toContain('static const uint16_t mel_0[] PROGMEM = {262, 4, 294, 4, 0, 0};');
  expect(cpp.code).toContain('ab::playMelody(mel_0, 90, true);');
  expect(cpp.diagnostics.map((d) => d.key)).toContain('diag.badNote');
  const js = generateJs(program, newProject('Song'));
  expect(js.code).toContain('const mel_0 = [262,4,294,4];');
  expect(js.code).toContain('E.playMelody(mel_0, 90, true)');
});

it('plays music in the simulator and lets a sound effect cover it', () => {
  let now = 0;
  const tone = vi.fn();
  const engine = new Engine({ show: vi.fn(), tone, storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 16, hiscoreMagic: 0 });
  vi.spyOn(engine, 'millis').mockImplementation(() => now);
  const update = () => (engine as unknown as { updateSound(): void }).updateSound();
  engine.playMelody([440, 4, 0, 4], 120, true); // 500 ms per beat
  update();
  expect(tone).toHaveBeenLastCalledWith(440, 438);
  now = 500;
  update();
  expect(tone).toHaveBeenLastCalledWith(0, undefined);
  now = 1000;
  engine.playEffect(1);
  update();
  expect(tone).toHaveBeenCalledTimes(3); // the coin effect, not the looped A
  expect(tone).toHaveBeenLastCalledWith(988);
});

it('formats sharps with octave and length only when they change', () => {
  expect(formatMelody(parseMelody('C4:1 C#4:1 D5:1/2 R:1/2 F5:1/2').steps)).toBe('C C# D5:0.5 R F');
});
it('round trips chromatic notes, carried lengths and rests', () => {
  for (let octave = 0; octave <= 9; octave++) for (let length = 1; length <= 64; length++) {
    const steps = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].flatMap(name => [noteFreq(name[0],octave,name[1]),length,0,length]);
    expect(parseMelody(formatMelody(steps)).steps).toEqual(steps);
  }
});
it('records gaps and durations at quarter beats, including last-key transitions', () => {
  const record = new MelodyRecording(120,0); // 125ms quarter beat
  record.change(440,50); record.change(523,180); record.change(440,300); record.change(0,375);
  record.change(659,450); record.change(0,9000);
  expect(record.steps).toEqual([440,1,523,1,440,1,0,1,659,64]);
  expect(parseMelody(formatMelody(record.steps)).steps).toEqual(record.steps);
});
it('round trips accidentals at octave boundaries with sharps only', () => {
  const steps = parseMelody('Cb0 B#9').steps;
  const text = formatMelody(steps);
  expect(text).not.toContain('b'); expect(parseMelody(text).steps).toEqual(steps);
});
