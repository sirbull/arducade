// @vitest-environment jsdom
import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { div16, mod16 } from '../src/sim/intmath';
import { Engine } from '../src/sim/engine';
import type { GameHooks } from '../src/gen/js';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';
import { compileProject } from './helpers';

describe.each(TEMPLATE_SOURCES.map((t) => [t.id, t] as const))('template %s', (id, source) => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('converts to C++ and JavaScript without errors', () => {
    const { ir, cpp, js } = compileProject(templateToProject(source));
    const errors = [...ir.diagnostics, ...cpp.diagnostics, ...js.diagnostics].filter((d) => d.level === 'error');
    expect(errors).toEqual([]);
    expect(cpp.code).toContain('void setup()');
    mkdirSync('.cache/gen', { recursive: true });
    writeFileSync(`.cache/gen/${id}.ino`, cpp.code);
  });

  it('runs in the simulator', async () => {
    const { js } = compileProject(templateToProject(source));
    let frames = 0;
    const engine = new Engine({
      show: () => frames++,
      tone: () => {},
      storage: { read: () => 0, write: () => {} },
      onSkippedCpp: () => {},
      maxSprites: 12,
      hiscoreMagic: js.hiscoreKey,
    });
    const factory = new Function('E', '$w', '$div', '$mod', '$lg', js.code) as (...a: unknown[]) => GameHooks;
    const hooks = factory(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard);
    await engine.begin(hooks);
    for (let i = 0; i < 300; i++) {
      // Hold right and press A now and then.
      engine.input = (1 << 3) | (i % 20 < 3 ? 1 << 4 : 0);
      // A frame can wait for a button (splash, game over), so let time pass
      // while it runs instead of waiting for it.
      void engine.frame();
      await vi.advanceTimersByTimeAsync(34);
    }
    expect(frames).toBeGreaterThan(250);
  });
});

it('flappy spawns pipes and gate inside the screen so autoDestroy keeps them', async () => {
  const { flappy } = await import('../src/templates/flappy');
  // Spawned at x=131; autoDestroy kills sprites whose left edge is >= 128.
  for (const id of ['pipeTop', 'pipeBottom', 'gate']) {
    const img = flappy.images.find((i) => i.id === id)!;
    expect(131 - Math.trunc(img.width / 2), id).toBeLessThan(128);
  }
});
