// @vitest-environment jsdom
import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { speechLines } from '../src/shared/speech';
import { newProject } from '../src/project/model';
import { compileProject } from './helpers';

function engine(tiny = false) {
  const e = new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 12, hiscoreMagic: 0, tiny });
  let now = 0;
  e.millis = () => now;
  return { e, time: (t: number) => { now = t; }, draw: () => { e.clear(); (e as unknown as { drawSpeech(): void }).drawSpeech(); return e.buffer.slice(); } };
}

it('wraps at words, preserves explicit newlines and splits long words', () => {
  expect(speechLines('Hello there friend', 8)).toEqual(['Hello', 'there', 'friend']);
  expect(speechLines('abcdefghij\nHi!', 4)).toEqual(['abcd', 'efgh', 'ij', 'Hi!']);
  expect(speechLines('a\n\nb', 8)).toEqual(['a', '', 'b']);
});

it('follows the sprite and camera, falls below at the top and stays on screen', () => {
  const { e, draw } = engine();
  const s = e.create(new Uint8Array([8, 8, 1, 0, ...Array(8).fill(255)]), 0);
  e.say(s, 'Hello!', 0);
  const centered = draw();
  e.setPosition(s, 2, 2);
  const edge = draw();
  expect(edge).not.toEqual(centered);
  expect(e.getPixel(0, 9)).toBe(0); // black outline of the bubble below
  expect(e.getPixel(1, 10)).toBe(1);
  e.camX = -62; e.camY = -30;
  expect(draw()).toEqual(centered);
});

it('replaces and hides messages, expires exactly on time and clears on destruction', () => {
  const { e, time, draw } = engine();
  const s = e.create(null, 0);
  e.say(s, 'First', 100);
  const first = draw();
  e.say(s, 'Next', 100);
  expect(draw()).not.toEqual(first);
  time(99); expect(draw().some(Boolean)).toBe(true);
  time(100); expect(draw().some(Boolean)).toBe(false);
  e.say(s, 'Keep'); time(5000); expect(draw().some(Boolean)).toBe(true);
  e.speechHide(s); expect(draw().some(Boolean)).toBe(false);
  e.say(s, 'Gone'); e.destroy(s); e.create(null, 0);
  expect(draw().some(Boolean)).toBe(false);
  e.say(s, 'Again'); e.say(s, ''); expect(draw().some(Boolean)).toBe(false);
});

it('cycles narrow text pages, applies settings immediately and limits device storage', () => {
  const { e, draw, time } = engine();
  const s = e.create(null, 0);
  e.speechWidth(s, 22);
  e.say(s, 'abcd efgh ijkl mnop');
  const first = draw(); time(1500); expect(draw()).not.toEqual(first);
  time(3000); expect(draw()).toEqual(first);
  e.speechColors(s, 1, 0); expect(draw()).not.toEqual(first);
  e.speechPosition(s, 2); expect(draw()).not.toEqual(first);
  expect(e.limitText('x'.repeat(100), 63)).toHaveLength(63);
  expect(engine(true).e.limitText('x'.repeat(100), 63)).toHaveLength(21);
  expect(e.limitText('æøå')).toBe('???');
});

it('uses a bounded bubble pool and hides invisible sprites', () => {
  const { e, draw } = engine();
  const sprites = [e.create(null, 0), e.create(null, 0), e.create(null, 0)];
  sprites.forEach((s, i) => { e.setPosition(s, 20 + 40 * i, 40); e.say(s, String(i)); });
  const two = draw(); e.speechHide(sprites[0]); expect(draw()).toEqual(two);
  e.setFlag(sprites[1], 16, true); e.setFlag(sprites[2], 16, true);
  expect(draw().some(Boolean)).toBe(false);
});

it('adds and removes join inputs without losing children and saves the input count', () => {
  const ws = new Blockly.Workspace();
  const join = ws.newBlock('text_join') as Blockly.Block & { changeItems(n: number): void };
  join.changeItems(1); join.changeItems(1);
  expect(join.getInput('ADD3')).not.toBeNull();
  const text = ws.newBlock('text'); text.setFieldValue('last', 'TEXT');
  join.getInput('ADD3')!.connection!.connect(text.outputConnection!);
  const state = Blockly.serialization.blocks.save(join)!;
  expect(state.extraState).toEqual({ itemCount: 4 });
  join.changeItems(-1);
  expect(text.getParent()).toBeNull(); expect(ws.getBlockById(text.id)).toBe(text);
  const loaded = Blockly.serialization.blocks.append(state, ws);
  expect(loaded.getInputTargetBlock('ADD3')!.getFieldValue('TEXT')).toBe('last');
  join.changeItems(-1); join.changeItems(-1);
  expect(join.getInput('ADD1')).not.toBeNull(); expect(join.getInput('ADD2')).toBeNull();
  ws.dispose();
});

it('compiles text variables, a four-part join and every speech setting for both engines', () => {
  const p = newProject('Speech');
  p.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
  const val = (type: string, fields?: Record<string, unknown>) => ({ block: { type, fields } });
  const sprite = val('variables_get', { VAR: { name: 'mySprite' } });
  const chain = [
    { type: 'variables_set', fields: { VAR: { name: 'mySprite' } }, inputs: { VALUE: val('ab_sprite_create', { IMAGE: 'dot', KIND: 'Player' }) } },
    { type: 'variables_set', fields: { VAR: { name: 'message' } }, inputs: { VALUE: { block: { type: 'text_join', extraState: { itemCount: 4 }, inputs: { ADD0: val('text', { TEXT: 'Hi, ' }), ADD1: val('text', { TEXT: 'Ada' }), ADD2: val('text', { TEXT: '! Score: ' }), ADD3: val('math_number', { NUM: 42 }) } } } } },
    { type: 'ab_sprite_speech_width', inputs: { SPRITE: sprite, WIDTH: val('math_number', { NUM: 50 }) } },
    { type: 'ab_sprite_speech_position', fields: { POSITION: '2' }, inputs: { SPRITE: sprite } },
    { type: 'ab_sprite_speech_colors', fields: { TEXT_COLOR: '1', BACKGROUND_COLOR: '0' }, inputs: { SPRITE: sprite } },
    { type: 'ab_sprite_say_for', inputs: { SPRITE: sprite, TEXT: val('variables_get', { VAR: { name: 'message' } }), MS: val('math_number', { NUM: 2000 }) } },
    { type: 'ab_sprite_speech_hide', inputs: { SPRITE: sprite } },
    { type: 'ab_sprite_say', inputs: { SPRITE: sprite, TEXT: val('text', { TEXT: 'Hello' }) } },
  ];
  let next: unknown;
  for (const block of [...chain].reverse()) next = { ...block, ...(next ? { next: { block: next } } : {}) };
  p.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: next } } }] } };
  const { ir, cpp, js } = compileProject(p);
  expect(ir.diagnostics).toEqual([]); expect(cpp.diagnostics).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_SPEECH 1');
  expect(cpp.code).toContain('ab::Text'); expect(cpp.code).toContain('ab::tbRam(');
  for (const fn of ['say', 'speechWidth', 'speechPosition', 'speechColors', 'speechHide']) {
    expect(cpp.code).toContain(`ab::${fn}(`); expect(js.code).toContain(`E.${fn}(`);
  }
});

it('only omits speech-game motion when no velocity calls or C++ blocks can change it', async () => {
  const { parseSource } = await import('../src/text/languages');
  const { generateCpp } = await import('../src/gen/cpp');
  const p = newProject('Motion detection');
  p.images = [{ id: 'dot', name: 'dot', width: 1, height: 1, frames: [['1']] }];
  for (const motion of ['', 'sprite.setVelocity(player, 20, 0);', 'sprite.set(player, Property.vx, 20);']) {
    const program = parseSource(`let player; function start() { player = sprites.create(images.dot, kind("Player")); sprite.say(player, "Hi", 0); ${motion} } events.start(start);`, 'javascript', p);
    expect(generateCpp(program, p).code.includes('#define AB_NO_SPRITE_MOTION 1')).toBe(!motion);
    if (!motion) {
      program.events[0].body.push({ k: 'cpp', code: 'ab::sprites[0].vx = 16;' });
      expect(generateCpp(program, p).code).not.toContain('#define AB_NO_SPRITE_MOTION 1');
    }
  }
});
