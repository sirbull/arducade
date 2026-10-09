import { expect, it, vi } from 'vitest';
import { Engine } from '../src/sim/engine';
import { parseMelody } from '../src/engine/melody';
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
