import { expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { FLAGS } from '../src/engine/enums';

it('lets sprites leave the map sideways unless they stay in the map', () => {
  const engine = new Engine({ show: () => {}, tone: () => {}, storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {}, maxSprites: 4, hiscoreMagic: 0 });
  engine.setMap([2, 1, 0, 0]);
  const img = new Uint8Array([2, 2, 1, 0, 3, 3]);
  const free = engine.create(img, 0);
  const kept = engine.create(img, 0);
  engine.setFlag(kept, FLAGS.stayInMap, true);
  for (const s of [free, kept]) {
    engine.setPosition(s, 12, 4);
    engine.setVelocity(s, 60, 0);
  }
  const update = () => (engine as unknown as { updateSprites(): void }).updateSprites();
  for (let i = 0; i < 30; i++) update();
  expect(engine.getProp(free, 0)).toBeGreaterThan(20);
  expect(engine.getProp(kept, 0)).toBe(15);
});
