// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { Engine } from '../src/sim/engine';
import * as Blockly from 'blockly/core';
import { setAssetProject } from '../src/blocks/assets';
import { newProject, parseProject } from '../src/project/model';
import { compileProject } from './helpers';

const engine = () => new Engine({ show() {}, tone() {}, storage: { read: () => 0, write() {} }, onSkippedCpp() {}, maxSprites: 4, hiscoreMagic: 0 });
it('counts real seconds independently, normalizes time, stops at zero and resumes fractional seconds', () => {
  const e = engine(); let now = 0;
  vi.spyOn(e, 'millis').mockImplementation(() => now);
  e.timerSet(0, 94); e.timerRun(0, -1);
  e.timerSet(1, 59); e.timerRun(1, 1);
  now = 2500;
  expect(e.timerValue(0)).toBe(91); expect(e.timerValue(1)).toBe(61);
  expect(e.timerText(1)).toBe('01:01');
  e.timerRun(1, 0); now = 10000; expect(e.timerValue(1)).toBe(61);
  e.timerRun(1, 1); now = 10500; expect(e.timerValue(1)).toBe(62);
  now = 200000; expect(e.timerValue(0)).toBe(0); expect(e.timers[0].mode).toBe(0);
  e.timerSet(2, 7200); e.timerFormat(2, 4); expect(e.timerText(2)).toBe('02:00:00');
  e.timerChange(2, -60); expect(e.timerText(2)).toBe('01:59:00');
  e.timerFormat(2, 1); expect(e.timerText(2)).toBe('119');
  e.timerPosition(2, 20, 30); expect(e.timers[2]).toMatchObject({ x: 20, y: 30 });
});
it('generates timer blocks with math/random inputs and score-style position in both engines', () => {
  const p = newProject('Timers');
  const n = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  p.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'ab_timer_set', fields: { TIMER: '1' }, inputs: { SECONDS: n(94) }, next: { block: {
      type: 'ab_timer_change', fields: { TIMER: '1' }, inputs: { VALUE: { block: { type: 'ab_random', inputs: { FROM: n(1), TO: n(10) } } } }, next: { block: {
        type: 'ab_sprite_set_position', inputs: { SPRITE: { block: { type: 'ab_timer', fields: { TIMER: '1' } } }, X: n(10), Y: n(20) },
      } },
    } },
  } } } }] } };
  const { ir, cpp, js } = compileProject(p);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.code).toContain('#define AB_HAS_TIMERS 1');
  expect(cpp.code).toContain('ab::timerSet(1, 94)');
  expect(cpp.code).toContain('ab::timerPosition(1, 10, 20)');
  expect(js.code).toContain('E.timerSet(1, 94)');
  expect(js.code).toContain('E.timerChange(1,');
  expect(js.code).toContain('E.timerPosition(1, 10, 20)');
});

it('tracks millisecond precision through countdown, carry, direction changes and stopping', () => {
  const e = engine(); let now = 0;
  vi.spyOn(e, 'millis').mockImplementation(() => now);
  e.timerSet(0, 60); e.timerFormat(0, 6); e.timerRun(0, -1);
  now = 1; expect(e.timerValue(0)).toBe(59); expect(e.timerMillis(0)).toBe(999);
  expect(e.timerText(0)).toBe('00:59.999');
  e.timerRun(0, 1); now = 2; expect(e.timerValue(0)).toBe(60); expect(e.timerMillis(0)).toBe(0);
  e.timerRun(0, 0); e.timerSetMillis(0, 125);
  e.timerChangeMillis(0, 1000); expect(e.timerText(0)).toBe('01:01.125');
  e.timerChange(0, -1); expect(e.timerText(0)).toBe('01:00.125');
  e.timerChangeMillis(0, -126); expect(e.timerText(0)).toBe('00:59.999');
  e.timerSet(0, 0); e.timerSetMillis(0, 125); e.timerRun(0, -1);
  now = 126; expect(e.timerMillis(0)).toBe(1); expect(e.timers[0].mode).toBe(-1);
  now = 127; expect(e.timerMillis(0)).toBe(0); expect(e.timers[0].mode).toBe(0);
  e.timerSet(1, 3600); e.timerSetMillis(1, 7); e.timerFormat(1, 7);
  expect(e.timerText(1)).toBe('01:00:00.007');
  e.timerSet(1, 32767); e.timerChangeMillis(1, 1000); expect(e.timerMillis(1)).toBe(0);
});
it('generates millisecond operations and reporter for both engines', () => {
  const p = newProject('Milliseconds');
  const n = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  p.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'ab_timer_set_millis', fields: { TIMER: '2' }, inputs: { VALUE: n(125) }, next: { block: {
      type: 'ab_timer_change_millis', fields: { TIMER: '2' }, inputs: { VALUE: { block: { type: 'ab_timer_millis', fields: { TIMER: '1' } } } },
    } },
  } } } }] } };
  const { ir, cpp, js } = compileProject(p);
  expect(ir.diagnostics).toEqual([]);
  expect(cpp.code).toContain('ab::timerSetMillis(2, 125)');
  expect(cpp.code).toContain('ab::timerChangeMillis(2, ab::timerMillis(1))');
  expect(js.code).toContain('E.timerSetMillis(2, 125)');
  expect(js.code).toContain('E.timerChangeMillis(2, E.timerMillis(1))');
});

it('lists score, health and only created timers, with creation and persistence', () => {
  const p = newProject('Created timers'); setAssetProject(p);
  const ws = new Blockly.Workspace();
  try {
    const position = ws.newBlock('ab_info_position');
    const field = position.getField('DISPLAY') as Blockly.FieldDropdown;
    expect(field.getOptions(false).map(([label]) => label)).toEqual(['score', 'health', 'timer', '+ New timer']);
    field.setValue('__new_timer__');
    expect(field.getValue()).toBe('1'); expect(p.timerCount).toBe(2);
    expect(field.getOptions(false).map(([label]) => label)).toEqual(['score', 'health', 'timer', 'timer2', '+ New timer']);
    const timer = ws.newBlock('ab_timer_set');
    expect((timer.getField('TIMER') as Blockly.FieldDropdown).getOptions(false).map(([label]) => label)).toEqual(['timer', 'timer2', '+ New timer']);
    expect(parseProject(JSON.stringify(p)).timerCount).toBe(2);
    field.setValue('health'); expect(field.getValue()).toBe('health');
  } finally { ws.dispose(); setAssetProject(null); }
});
it.each([['score', 'setScorePosition'], ['health', 'setLifePosition'], ['0', 'timerPosition']])('moves %s through the shared position block', (display, method) => {
  const p = newProject('HUD position');
  const n = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  p.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'ab_on_start', inputs: { DO: { block: {
    type: 'ab_info_position', fields: { DISPLAY: display }, inputs: { X: n(20), Y: n(30) },
  } } } }] } };
  const { ir, cpp, js } = compileProject(p);
  expect(ir.diagnostics).toEqual([]);
  const args = display === '0' ? '0, 20, 30' : '20, 30';
  expect(cpp.code).toContain(`ab::${method}(${args})`);
  expect(js.code).toContain(`E.${method}(${args})`);
  if (display === 'health') expect(cpp.code).toContain('#define AB_LIFE_POS 1');
});
