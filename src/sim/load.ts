// Turns generated simulator code into the hooks the engine calls.

import type { GameHooks } from '../gen/js';
import type { Engine } from './engine';
import { div16, mod16 } from './intmath';

export function loadGame(code: string, engine: Engine): GameHooks {
  // The generated code only uses the engine and the helpers passed in.
  const factory = new Function('E', '$w', '$div', '$mod', '$lg', '$at', code) as (...args: unknown[]) => GameHooks;
  const div = (a: number, b: number) => {
    if (b === 0) engine.warn('runtime.divZero');
    return div16(a, b);
  };
  const mod = (a: number, b: number) => {
    if (b === 0) engine.warn('runtime.divZero');
    return mod16(a, b);
  };
  return factory(engine, (v: number) => (v << 16) >> 16, div, mod, engine.loopGuard, engine.at);
}
