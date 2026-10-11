import './helpers';
import * as Blockly from 'blockly/core';
import { setAssetProject } from '../src/blocks/assets';
import { workspaceToIR } from '../src/blocks/toIR';
import type { FieldDropdown } from 'blockly/core';
import { expect, it } from 'vitest';
import { newProject, upgradeProject, parseProject, serializeProject } from '../src/project/model';
import { emptyProgram, type Program } from '../src/ir/ir';
import { generateCpp } from '../src/gen/cpp';
import { generateJs } from '../src/gen/js';
import { generateSource, parseSource } from '../src/text/languages';
import { buildToolbox } from '../src/blocks/toolbox';

it('keeps every sound block together in the original Music category', () => {
  const toolbox = buildToolbox() as { contents: { categorystyle?: string; contents?: { kind: string; type?: string }[] }[] };
  const music = toolbox.contents.filter(category => category.categorystyle === 'ab_music');
  expect(music).toHaveLength(1);
  expect(toolbox.contents.some(category => category.categorystyle === 'ab_polyphonic')).toBe(false);
  expect(music[0].contents?.map(block => block.type).sort()).toEqual([
    'ab_play_effect', 'ab_play_poly_effect', 'ab_play_song', 'ab_stop_song', 'ab_set_song_volume', 'ab_play_named_melody',
    'ab_play_tone', 'ab_note', 'ab_pitch', 'ab_stop_sound',
  ].sort());
});

const project = () => { const p = newProject('Music'); p.melodies.push({ id: 'intro', name: 'intro', notes: 'C D E:2', tempo: 140 }); return p; };
const program = (): Program => ({ ...emptyProgram(), events: [{ k: 'start', body: [true, false].map(loop => ({ k: 'expr', e: { k: 'api', fn: 'music.namedMelody', args: [{ k: 'enum', type: 'melodyAsset', v: 'intro' }, { k: 'bool', v: loop }] } })) }] });
it('upgrades legacy projects and validates melody data', () => {
  expect(upgradeProject({ version: 1 }).melodies).toEqual([]);
  const p = project(); expect(parseProject(serializeProject(p)).melodies).toEqual(p.melodies);
  const broken = { ...p, melodies: [...p.melodies, { id: 'bad', name: 'bad', notes: '', tempo: NaN }, ...p.melodies] };
  expect(upgradeProject(broken).melodies).toEqual(p.melodies);
});
it('shares one table per melody and includes only used melodies', () => {
  const p = project(); p.melodies.push({ id: 'unused', name: 'unused', notes: 'F', tempo: 120 });
  const cpp = generateCpp(program(), p); expect(cpp.diagnostics).toEqual([]);
  expect(cpp.code.match(/static const uint16_t mel_/g)).toHaveLength(1);
  expect(cpp.code).toContain('ab::playMelody(mel_0, 140, true)');
  expect(cpp.code).toContain('ab::playMelody(mel_0, 140, false)');
  expect(generateJs(program(), p).code.match(/const mel_/g)).toHaveLength(1);
  expect(generateCpp(emptyProgram(), p).code).not.toContain('static const uint16_t mel_');
  p.melodies = []; expect(generateCpp(program(), p).diagnostics.some(d => d.key === 'diag.noMelody')).toBe(true);
});
it.each(['javascript','python'] as const)('round trips melodies by name in %s', language => {
  const p = project(); const source = generateSource(program(), p, language);
  expect(source).toContain('melodies.intro');
  expect(parseSource(source, language, p).events).toEqual(program().events);
  expect(() => parseSource(source.replaceAll('melodies.intro', 'melodies.missing'), language, p)).toThrow();
});
it('reports fallback and disabled audio at info level for polyphonic blocks', async () => {
  const { defineBlocks } = await import('../src/blocks/defs');
  const { buildProject } = await import('../src/ui/build');
  const { BUILTIN_PROFILES } = await import('../src/hw/profile');
  defineBlocks();
  const p = project(); p.profile = structuredClone(BUILTIN_PROFILES[1]);
  p.source = { language: 'javascript', code: 'function start() { music.playSong(Song.title, true); music.setSongVolume(50); }' };
  expect(buildProject(p).diagnostics).toContainEqual({ level: 'info', key: 'diag.songOneVoice' });
  p.profile.sound.enabled = false;
  expect(buildProject(p).diagnostics).toContainEqual({ level: 'info', key: 'diag.songSoundOff' });
  p.profile = BUILTIN_PROFILES[0]; expect(buildProject(p).diagnostics.some(d=>d.level==='info')).toBe(false);
});
it('preserves a deleted asset ID in saved blocks so it is reported as an error', async () => {
  const Blockly = await import('blockly/core');
  const { defineBlocks } = await import('../src/blocks/defs');
  const { setAssetProject } = await import('../src/blocks/assets');
  const { buildProject } = await import('../src/ui/build'); defineBlocks();
  const p = project(); setAssetProject(p);
  const ws = new Blockly.Workspace(); const block = ws.newBlock('ab_play_named_melody'); block.setFieldValue('intro','MELODY');
  const start = ws.newBlock('ab_on_start'); start.getInput('DO')!.connection!.connect(block.previousConnection!);
  p.blocks = Blockly.serialization.workspaces.save(ws); ws.dispose(); p.melodies = [];
  const result = buildProject(p); expect(result.diagnostics.some(d=>d.key==='diag.noMelody')).toBe(true);
  setAssetProject(null);
});

const songProject = () => { const p=newProject('Studio'); p.songs.push({id:'custom',name:'theme',tempo:120,voices:['C4:1 E G R','E4:4','C3:4','C:0.25 R:3.75']}); return p; };
const songProgram = (): Program => ({...emptyProgram(),events:[{k:'start',body:[{k:'expr',e:{k:'api',fn:'music.namedSong',args:[{k:'enum',type:'songAsset',v:'custom'},{k:'bool',v:false}]}}]}]});
it('persists four-track songs and upgrades projects without songs',()=>{
  const p=songProject();expect(parseProject(serializeProject(p)).songs).toEqual(p.songs);
  expect(upgradeProject({version:1}).songs).toEqual([]);
  expect(upgradeProject({...p,songs:[{...p.songs[0],voices:['C'] as never}]}).songs).toEqual([]);
});
it('compiles only used custom songs and reports deleted or invalid song assets',()=>{
  const p=songProject();p.songs.push({...p.songs[0],id:'unused',name:'unused'});
  const cpp=generateCpp(songProgram(),p);expect(cpp.diagnostics).toEqual([]);
  expect(cpp.code.match(/static const uint8_t song_custom_/g)).toHaveLength(1);
  expect(cpp.code).toContain('ab::playSong(song_custom_0, false)');
  expect(generateJs(songProgram(),p).code).toContain('E.playSong(song_custom_0, false)');
  expect(generateCpp(emptyProgram(),p).code).not.toContain('song_custom_');
  p.songs[0].voices[1]='invalid';expect(generateCpp(songProgram(),p).diagnostics.some(d=>d.key==='diag.badNote')).toBe(true);
  p.songs=[];expect(generateCpp(songProgram(),p).diagnostics.some(d=>d.key==='diag.noSong')).toBe(true);
});
it.each(['javascript','python'] as const)('round trips custom songs in %s', language=>{
  const p=songProject(),source=generateSource(songProgram(),p,language);
  expect(source).toContain('songs.theme');
  const result=parseSource(source,language,p);expect(result.events).toEqual(songProgram().events);
  expect(generateCpp(result,p).code).toContain('ab::playSong(song_custom_0, false)');
});
it('resolves custom song assets from blocks and keeps deleted selections for diagnostics',async()=>{
 const Blockly=await import('blockly/core');const {setAssetProject}=await import('../src/blocks/assets');const {workspaceToIR}=await import('../src/blocks/toIR');
 const p=songProject();setAssetProject(p);const ws=new Blockly.Workspace();
 try{
  Blockly.serialization.workspaces.load({blocks:{languageVersion:0,blocks:[{type:'ab_on_start',inputs:{DO:{block:{type:'ab_play_named_song',fields:{SONG:'custom',MODE:'once'}}}}}]}},ws);
  expect(generateCpp(workspaceToIR(ws).program,p).code).toContain('ab::playSong(song_custom_0, false)');
  p.songs=[];setAssetProject(p);expect(ws.getBlocksByType('ab_play_named_song',false)[0].getFieldValue('SONG')).toBe('custom');
  expect(generateCpp(workspaceToIR(ws).program,p).diagnostics.some(d=>d.key==='diag.noSong')).toBe(true);
 }finally{ws.dispose();setAssetProject(null);}
});

it('puts custom songs first and distinguishes a custom ID matching a built-in song',async()=>{
 const Blockly=await import('blockly/core');const {setAssetProject}=await import('../src/blocks/assets');const {workspaceToIR}=await import('../src/blocks/toIR');
 const p=songProject();p.songs[0].id='title';p.songs[0].name='My title';setAssetProject(p);const ws=new Blockly.Workspace();
 try{
  const start=ws.newBlock('ab_on_start'),block=ws.newBlock('ab_play_song');start.getInput('DO')!.connection!.connect(block.previousConnection!);
  const field=block.getField('SONG') as FieldDropdown;
  expect(field.getOptions(false)[0]).toEqual(['My title','asset:title']);
  expect(field.getOptions(false)[1][1]).toBe('title');
  block.setFieldValue('asset:title','SONG');block.setFieldValue('once','MODE');
  expect(generateCpp(workspaceToIR(ws).program,p).code).toContain('ab::playSong(song_custom_0, false)');
  block.setFieldValue('title','SONG');expect(workspaceToIR(ws).program.events[0].body[0]).toMatchObject({e:{fn:'music.song',args:[{type:'song',v:'title'},{v:false}]}});
  block.setFieldValue('asset:title','SONG');p.songs=[];setAssetProject(p);
  expect(block.getFieldValue('SONG')).toBe('asset:title');expect(generateCpp(workspaceToIR(ws).program,p).diagnostics.some(d=>d.key==='diag.noSong')).toBe(true);
 }finally{ws.dispose();setAssetProject(null);}
});
it('upgrades nested custom-song blocks without changing builtin choices, connections or source data',()=>{
 const p=songProject();p.blocks={blocks:{languageVersion:0,blocks:[{type:'ab_on_start',id:'start',inputs:{DO:{block:{type:'ab_play_named_song',id:'own',fields:{SONG:'custom',MODE:'once'},next:{block:{type:'ab_play_song',id:'preset',fields:{SONG:'title',MODE:'loop'}}}}}}}]}};
 const before=JSON.stringify(p.blocks), upgraded=upgradeProject(p);const blocks=upgraded.blocks as typeof p.blocks & {blocks:{blocks:{inputs:{DO:{block:{type:string;id:string;fields:{SONG:string;MODE:string};next:unknown}}}}[]}};
 expect(blocks.blocks.blocks[0].inputs.DO.block).toMatchObject({type:'ab_play_song',id:'own',fields:{SONG:'asset:custom',MODE:'once'},next:{block:{type:'ab_play_song',id:'preset',fields:{SONG:'title',MODE:'loop'}}}});
 expect(JSON.stringify(p.blocks)).toBe(before);expect(upgradeProject(upgraded).blocks).toEqual(upgraded.blocks);
});
it('gives all polyphonic blocks a shared nearby colour in every theme',async()=>{
 const {blocklyTheme,THEME_IDS}=await import('../src/ui/themes');
 for(const id of THEME_IDS){const theme=blocklyTheme(id);expect(theme.blockStyles.ab_polyphonic.colourPrimary).not.toBe(theme.blockStyles.ab_music.colourPrimary);}
 const Blockly=await import('blockly/core');const ws=new Blockly.Workspace();
 try{for(const type of ['ab_play_song','ab_play_named_song','ab_stop_song','ab_set_song_volume'])expect(ws.newBlock(type).getStyleName()).toBe('ab_polyphonic');expect(ws.newBlock('ab_play_named_melody').getStyleName()).toBe('ab_music');}finally{ws.dispose();}
});

it('offers separate beep melodies and polyphonic effects with distinct icons', () => {
  const p=project();setAssetProject(p);
  const ws=new Blockly.Workspace();
  try {
    const melody=ws.newBlock('ab_play_named_melody');
    const options=(melody.getField('MELODY') as FieldDropdown).getOptions(false);
    expect(options[0]).toEqual(['intro','intro']);
    expect(options.slice(1).every(option=>String(option[1]).startsWith('preset:'))).toBe(true);
    const start=ws.newBlock('ab_on_start');start.getInput('DO')!.connection!.connect(melody.previousConnection!);
    melody.setFieldValue('preset:title','MELODY');melody.setFieldValue('once','MODE');
    const ir=workspaceToIR(ws);
    expect(ir.program.events[0].body[0]).toMatchObject({e:{fn:'music.melody',args:[{type:'melody'},{k:'num'},{v:false}]}});
    const poly=ws.newBlock('ab_play_poly_effect'),beep=ws.newBlock('ab_play_effect');
    expect(poly.getStyleName()).toBe('ab_polyphonic');
    expect(beep.getStyleName()).toBe('ab_music');
    const image=(b: Blockly.Block)=>b.inputList.flatMap(i=>i.fieldRow).find(f=>f instanceof Blockly.FieldImage) as Blockly.FieldImage;
    expect(image(poly).getValue()).not.toBe(image(beep).getValue());
  } finally {ws.dispose();setAssetProject(null);}
});
