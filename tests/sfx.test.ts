import { expect, it } from 'vitest';
import { SFX, SFX_MENU, SFX_STEPS } from '../src/engine/enums';
import { generateCpp } from '../src/gen/cpp';
import { emptyProgram, type Program } from '../src/ir/ir';
import { newProject } from '../src/project/model';

const play = (...names: string[]): Program => ({
  ...emptyProgram(),
  events: [{ k: 'start', body: names.map((v) => ({ k: 'expr', e: { k: 'api', fn: 'music.effect', args: [{ k: 'enum', type: 'sfx', v }] } })) }],
});

it('lists every sound effect once in the block menu, each with a sound', () => {
  expect([...SFX_MENU].sort()).toEqual([...SFX].sort());
  for (const name of SFX) {
    const steps = SFX_STEPS[name];
    expect(steps.length % 2, name).toBe(0);
    expect(steps.filter((_, i) => i % 2).every((ms) => ms > 0), name).toBe(true);
  }
});

it('gives the device a table only for the effects the game plays', () => {
  const code = generateCpp(play('laser', 'laser', 'win'), newProject('Fx')).code;
  expect(code).toContain(`static const uint16_t sfx_laser[] PROGMEM = {${[...SFX_STEPS.laser, 0, 0].join(', ')}};`);
  expect(code).toContain('ab::playSound(sfx_laser);');
  expect(code).toContain('ab::playSound(ab::sfxWin);'); // from ardublocks.h, like the game over screen
  expect(code).not.toContain('sfx_win');
  expect(code).not.toContain('sfx_jump');
  expect(generateCpp(emptyProgram(), newProject('Quiet')).code).not.toContain('Sound effects');
});
