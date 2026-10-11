import './helpers';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compileProject } from './helpers';
import { parseProject } from '../src/project/model';
import { MUSIC_EXAMPLES } from '../src/ui/docs-music-examples';
import { parseMelody } from '../src/engine/melody';
import { parseSource } from '../src/text/languages';
import { generateCpp } from '../src/gen/cpp';
import { generateJs } from '../src/gen/js';

const project = () => parseProject(readFileSync('public/examples/music-guide.abproject','utf8'));
it('loads the downloadable tutorial with its saved melodies and three working sound events', () => {
  const p=project(), {ir,cpp,js}=compileProject(p);
  expect(ir.diagnostics).toEqual([]);expect(cpp.diagnostics).toEqual([]);
  expect(p.melodies[0].notes).toBe(MUSIC_EXAMPLES.melody);
  expect(p.songs[0].voices).toEqual(MUSIC_EXAMPLES.voices);
  expect(ir.program.events).toHaveLength(3);
  expect(js.code).toContain('E.playMelody(');
  expect(js.code).toContain('E.playSong(');
  expect(cpp.code).toContain('song_effect_shield');
});
it('provides note examples with the stated lengths and no invalid tokens', () => {
  expect(parseMelody(MUSIC_EXAMPLES.melody).bad).toEqual([]);
  const quarters=(text:string)=>parseMelody(text).steps.filter((_,i)=>i%2).reduce((a,b)=>a+b,0);
  expect(quarters(MUSIC_EXAMPLES.melody)).toBe(6);
  for(const voice of MUSIC_EXAMPLES.voices){expect(parseMelody(voice).bad).toEqual([]);expect(quarters(voice)).toBe(32);}
  expect(parseMelody(MUSIC_EXAMPLES.inheritance).steps).toEqual([523,2,587,2,659,4,0,4,784,4]);
});
it.each(['javascript','python'] as const)('parses and compiles the tutorial %s with the same sound events', language => {
  const p=project(),program=parseSource(MUSIC_EXAMPLES[language],language,p);
  expect(program.events.map(event=>event.k)).toEqual(['start','button','button']);
  expect(generateCpp(program,p).diagnostics).toEqual([]);
  expect(generateCpp(program,p).code).toContain('song_effect_shield');
  expect(generateJs(program,p).diagnostics).toEqual([]);
});
