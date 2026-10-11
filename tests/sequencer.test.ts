import { expect, it } from 'vitest';
import { sequence, sequenceText, placeNote } from '../src/engine/sequencer';
import { noteFreq } from '../src/engine/melody';
it('preserves timing, rests and octave changes through a piano-roll edit',()=>{
  const track=sequence('R:0.25 C3:2 G4:0.5 R:1');
  expect(track.notes).toEqual([{at:1,length:8,frequency:131},{at:9,length:2,frequency:392}]);
  expect(sequence(sequenceText(track.notes,track.length))).toEqual(track);
});
it('replaces overlapping notes without changing later notes or total length',()=>{
  const track=sequence('C:2 D:1 E:1');
  const notes=placeNote(track.notes,4,4,noteFreq('G',4));
  expect(notes.map(n=>n.at)).toEqual([4,8,12]);
  expect(sequence(sequenceText(notes,16)).length).toBe(16);
  expect(sequence(sequenceText(notes,16)).notes).toEqual(notes);
});
it('writes long silent tracks in valid chunks',()=>{
  expect(sequence(sequenceText([],256))).toEqual({notes:[],length:256,bad:[]});
});
it('mutes preview voices in the device mixer without changing song data',async()=>{
 const {songBytes}=await import('../src/engine/songs');const {renderSong}=await import('../src/sim/atm');
 const bytes=songBytes({tempo:120,voices:['C:1','E:1','C3:1','C:0.25 R:0.75']});
 expect(renderSong(bytes,2,100,15).every(n=>n===0)).toBe(true);
 expect(renderSong(bytes,2).some(n=>n!==0)).toBe(true);
});
