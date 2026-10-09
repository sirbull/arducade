import { buildProject } from '../ui/build';
import type { Project } from '../project/model';
import type { GameHooks, JsResult } from '../gen/js';
import { Engine } from '../sim/engine';
import { div16, mod16 } from '../sim/intmath';
import type { Check } from './guide';

/** A virtual clock makes timers advance with frames, rather than wall time. */
class GuideEngine extends Engine {
  time = 0;
  override millis() { return this.time; }
  override gameOver(win: boolean) { super.gameOver(win); this.stop(); }
  override async setLife(value: number) {
    await super.setLife(value);
    if (this.gameOverPending) this.stop();
  }
}

/** Each check gets a fresh game, no sound and no writes to the player's saves. */
export async function runChecks(checks: Check[], project: Project): Promise<boolean[]> {
  let js: JsResult;
  try {
    const build = buildProject(project);
    if (build.diagnostics.some((d) => d.level === 'error')) return checks.map(() => false);
    js = build.js;
  } catch { return checks.map(() => false); }
  const results: boolean[] = [];
  for (const check of checks) {
    if (!check.run) { results.push(true); continue; }
    const engine = new GuideEngine({ show: () => {}, tone: () => {},
      storage: { read: () => 0, write: () => {} }, onSkippedCpp: () => {},
      maxSprites: 12, hiscoreMagic: js.hiscoreKey });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const run = async () => {
        const hooks = new Function('E', '$w', '$div', '$mod', '$lg', js.code)(
          engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard) as GameHooks;
        await engine.begin(hooks);
        return check.run!(engine, async (buttons = 0, count = 1) => {
          for (let i = 0; i < Math.min(count, 600); i++) {
            engine.input = buttons;
            engine.time += 16;
            // Terminal screens wait for input. Inspect the terminal state instead.
            if (engine.gameOverPending || engine.isStopped) break;
            const pending = engine.frame(true);
            if (engine.gameOverPending) { engine.stop(); }
            await pending;
          }
        });
      };
      results.push(await Promise.race([run(), new Promise<boolean>((resolve) => {
        timer = setTimeout(() => { engine.stop(); resolve(false); }, 500);
      })]));
    } catch { results.push(false); }
    finally { if (timer) clearTimeout(timer); engine.stop(); }
  }
  return results;
}
