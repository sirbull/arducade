import { afterEach, describe, expect, it, vi } from 'vitest';
import { Debugger } from '../src/sim/debugger';
import { Runner } from '../src/sim/runner';
import { generateJs, type GameHooks } from '../src/gen/js';
import { Engine, StopSignal } from '../src/sim/engine';
import { newProject } from '../src/project/model';
import type { Program } from '../src/ir/ir';
import { FRAME_MS } from '../src/engine/enums';
import { div16, mod16 } from '../src/sim/intmath';

const program: Program = {
  vars: [{ name: 'score', ty: 'num' }], funcs: [],
  events: [{ k: 'start', body: [
    { k: 'set', id: 'first', name: 'score', value: { k: 'num', v: 7 } },
    { k: 'set', id: 'second', name: 'score', value: { k: 'num', v: 12 } },
  ] }, { k: 'update', body: [{ k: 'set', id: 'update', name: 'score', value: { k: 'bin', op: '+', a: { k: 'var', name: 'score' }, b: { k: 'num', v: 1 } } }] }],
};
const canvas = () => ({ getContext: () => ({ createImageData: () => ({ data: new Uint8ClampedArray(128 * 64 * 4) }), putImageData: vi.fn() }) }) as unknown as HTMLCanvasElement;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('cooperative debugger', () => {
  it('pauses before assignments, steps once and preserves global values', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const errors = vi.fn();
    const runner = new Runner(canvas(), { onError: errors, onSkippedCpp: vi.fn() });
    runner.setDebug(true);
    const started = runner.start(generateJs(program, newProject('Debug')), 'debug-test');
    expect(runner.paused).toBe(true);
    expect(runner.debugger.location).toBe('first');
    expect(runner.inspect().variables.score).toBe(0);
    runner.debugResume('block');
    await vi.waitFor(() => expect(runner.debugger.location).toBe('second'));
    expect(runner.paused).toBe(true);
    expect(runner.inspect().variables.score).toBe(7);
    runner.debugResume();
    await started;
    expect(runner.inspect().variables.score).toBe(12);
    expect(errors).not.toHaveBeenCalled();
    runner.stop();
  });

  it('cancels a suspended old program when restarting or stopping', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const errors = vi.fn();
    const runner = new Runner(canvas(), { onError: errors, onSkippedCpp: vi.fn() });
    runner.setDebug(true);
    const game = generateJs(program, newProject('Debug'));
    const old = runner.start(game, 'debug-test');
    const replacement = runner.start(game, 'debug-test');
    await old;
    expect(runner.inspect().variables.score).toBe(0);
    expect(runner.paused).toBe(true);
    runner.stop();
    await replacement;
    expect(runner.running).toBe(false);
    expect(errors).not.toHaveBeenCalled();
  });

  it('honors breakpoints on repeated visits and releases when debugging is disabled', async () => {
    const changed = vi.fn();
    const debug = new Debugger(changed);
    debug.enabled = true;
    debug.breakpoints.add('loop');
    const first = debug.checkpoint('loop', { value: false });
    expect(debug.locals.value).toBe(false);
    expect(debug.paused).toBe(true);
    debug.resume();
    await first;
    const second = debug.checkpoint('loop', { value: 0 });
    expect(debug.paused).toBe(true);
    debug.enabled = false;
    debug.resume();
    await second;
    expect(debug.checkpoint('loop', {})).toBeUndefined();
  });

  it('next frame ignores ordinary checkpoints and stops at the frame boundary', () => {
    const debug = new Debugger(vi.fn());
    debug.enabled = true;
    debug.resume('frame');
    expect(debug.checkpoint('a', {})).toBeUndefined();
    expect(debug.checkpoint('b', {})).toBeUndefined();
    expect(debug.paused).toBe(false);
    debug.frameEnd();
    expect(debug.paused).toBe(true);
    debug.reset(new StopSignal());
    expect(debug.paused).toBe(false);
  });

  it('runs exactly one simulator frame and can step into the next update', async () => {
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const errors = vi.fn();
    const runner = new Runner(canvas(), { onError: errors, onSkippedCpp: vi.fn() });
    runner.setDebug(true);
    const started = runner.start(generateJs(program, newProject('Debug')), 'debug-test');
    runner.debugResume('frame');
    await started;
    frames.shift()!(0);
    await vi.waitFor(() => expect(runner.paused).toBe(true));
    expect(runner.inspect().frame).toBe(1);
    expect(runner.inspect().variables.score).toBe(13);
    expect(runner.debugger.location).toBe('');
    runner.debugResume('block');
    // The next ordinary frame becomes due after the first frame interval.
    clock += FRAME_MS;
    frames.shift()!(0);
    await vi.waitFor(() => expect(runner.debugger.location).toBe('update'));
    expect(runner.paused).toBe(true);
    expect(runner.inspect().variables.score).toBe(13);
    runner.stop();
    await Promise.resolve();
    expect(errors).not.toHaveBeenCalled();
  });

  it('can step and cancel an empty infinite loop instead of locking the browser', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const runner = new Runner(canvas(), { onError: vi.fn(), onSkippedCpp: vi.fn() });
    runner.setDebug(true);
    const loop: Program = { vars: [], funcs: [], events: [{ k: 'start', body: [{ k: 'while', id: 'loop', cond: { k: 'bool', v: true }, body: [] }] }] };
    const started = runner.start(generateJs(loop, newProject('Debug')), 'debug-test');
    const sequence = runner.debugger.sequence;
    runner.debugResume('block');
    await vi.waitFor(() => expect(runner.debugger.sequence).toBe(sequence + 1));
    expect(runner.debugger.location).toBe('loop');
    runner.stop();
    await started;
    expect(runner.running).toBe(false);
  });

  it('reports the block responsible for a runtime error after clearing the runner', async () => {
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const errors = vi.fn();
    const runner = new Runner(canvas(), { onError: errors, onSkippedCpp: vi.fn() });
    await runner.start({ code: 'return { init() {}, async start() { $debug(0, {}); throw new Error("broken"); } };', diagnostics: [], hiscoreKey: 0, debugIds: ['bad-block'] }, 'debug-test');
    expect(errors).toHaveBeenCalledWith('sim.runtimeError', 'broken', 'bad-block');
    expect(runner.running).toBe(false);
  });

  it('exposes local parameters at checkpoints without hiding global variables in inspect', async () => {
    const debug = new Debugger(vi.fn());
    debug.enabled = true;
    debug.breakpoints.add('inside');
    const p: Program = { vars: [{ name: 'total', ty: 'num' }],
      funcs: [{ name: 'add', params: [{ name: 'amount', ty: 'num' }], ret: 'void', body: [{ k: 'set', id: 'inside', name: 'total', value: { k: 'var', name: 'amount' } }] }],
      events: [{ k: 'start', body: [{ k: 'expr', id: 'call', e: { k: 'call', name: 'add', args: [{ k: 'num', v: 8 }] } }] }],
    };
    const engine = new Engine({ show: vi.fn(), tone: vi.fn(), storage: { read: () => 0, write: vi.fn() }, onSkippedCpp: vi.fn(), maxSprites: 16, hiscoreMagic: 0 });
    const game = generateJs(p, newProject('Debug'));
    const code = game.code;
    const hooks = new Function('E', '$w', '$div', '$mod', '$lg', '$debug', code)(engine, (v: number) => (v << 16) >> 16, div16, mod16, engine.loopGuard, (index: number, locals: Record<string, unknown>) => debug.checkpoint(game.debugIds?.[index] ?? '', locals)) as GameHooks;
    const started = engine.begin(hooks);
    expect(debug.location).toBe('inside');
    expect(debug.locals).toEqual({ amount: 8 });
    expect(hooks.inspect?.().total).toBe(0);
    debug.resume();
    await started;
    expect(hooks.inspect?.().total).toBe(8);
    engine.stop();
  });
});
