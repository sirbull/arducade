import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import './helpers';
import { workspaceToIR } from '../src/blocks/toIR';
import { Engine } from '../src/sim/engine';

it('wraps the sounds inside a pitch block with a pitch range and a reset', () => {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{
      type: 'ab_on_start', inputs: { DO: { block: { type: 'ab_pitch', inputs: { DO: { block: { type: 'ab_play_effect' } } } } } },
    }] } }, ws);
    const body = workspaceToIR(ws).program.events[0].body.map((s) => s.k === 'expr' && s.e.k === 'api' ? `${s.e.fn}(${s.e.args.map((a) => a.k === 'num' ? a.v : a.k).join(',')})` : s.k);
    expect(body).toEqual(['music.pitch(90,110)', 'music.effect(enum)', 'music.pitch(100,100)']);
  } finally { ws.dispose(); }
});

it('gives each sound a random pitch from the range, and the normal pitch outside it', () => {
  const tones: number[] = [];
  const e = new Engine({ show() {}, tone: (f) => { tones.push(f); }, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 2, hiscoreMagic: 0 });
  const rng = e.rng;
  e.playTone(1000, 50);
  expect(tones).toEqual([1000]);
  expect(e.rng).toBe(rng); // No random number is used without a pitch block.
  e.setPitch(90, 110);
  tones.length = 0;
  for (let i = 0; i < 50; i++) e.playTone(1000, 50);
  expect(Math.min(...tones)).toBeGreaterThanOrEqual(900);
  expect(Math.max(...tones)).toBeLessThanOrEqual(1100);
  expect(new Set(tones).size).toBeGreaterThan(5);
  e.setPitch(100, 100);
  tones.length = 0;
  e.playTone(1000, 50);
  expect(tones).toEqual([1000]);
});
