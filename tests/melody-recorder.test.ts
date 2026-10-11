// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openMelodyRecorder } from '../src/ui/melody-recorder';

const tone = vi.fn(), gain = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', class {
    currentTime = 0; state = 'running'; destination = {}; close() { return Promise.resolve(); }
    createOscillator() { return { type: '', frequency: { setValueAtTime: tone }, connect: (g: unknown) => g, start: () => {} }; }
    createGain() { return { gain: { value: 0, setTargetAtTime: gain }, connect: () => ({}) }; }
  });
  HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  HTMLDialogElement.prototype.close = function() { this.open = false; this.dispatchEvent(new Event('close')); };
  HTMLElement.prototype.setPointerCapture = () => {};
  tone.mockClear(); gain.mockClear();
});
afterEach(() => { document.querySelectorAll('dialog').forEach(d => d.close()); vi.unstubAllGlobals(); vi.useRealTimers(); });
const key = (name: string) => document.querySelector<HTMLButtonElement>(`.piano-key[aria-label="${name}"]`)!;
const pointer = (name: string, type: string, id: number) => key(name).dispatchEvent(Object.assign(new Event(type), { pointerId: id, pointerType: 'touch', button: 0 }));
const action = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b => b.textContent === label)!.click();
it('supports overlapping touches, restores previous held key and silences on cancellation', () => {
  openMelodyRecorder('',120,vi.fn());
  pointer('C4','pointerdown',1); expect(tone).toHaveBeenLastCalledWith(262,0);
  pointer('D4','pointerdown',2); expect(tone).toHaveBeenLastCalledWith(294,0);
  pointer('D4','pointercancel',2); expect(tone).toHaveBeenLastCalledWith(262,0);
  pointer('C4','pointercancel',1); expect(gain).toHaveBeenLastCalledWith(0,0,0.005);
  expect(document.querySelector('.piano-key.active')).toBeNull();
});
it('releases keyboard and touch on blur and closes without applying changes', () => {
  const apply = vi.fn(); openMelodyRecorder('C D',120,apply);
  pointer('C4','pointerdown',1); window.dispatchEvent(new Event('blur'));
  expect(document.querySelector('.piano-key.active')).toBeNull();
  pointer('D4','pointerdown',2); action('ui.cancel');
  expect(document.querySelector('dialog')).toBeNull(); expect(apply).not.toHaveBeenCalled();
  expect(gain).toHaveBeenLastCalledWith(0,0,0.005);
  const calls = tone.mock.calls.length; window.dispatchEvent(new KeyboardEvent('keydown',{key:'a'})); expect(tone.mock.calls).toHaveLength(calls);
});
it('writes the recorded melody only on Use, and disables invalid text', () => {
  const apply = vi.fn(); openMelodyRecorder('C',120,apply); action('music.record');
  pointer('C4','pointerdown',1); vi.advanceTimersByTime(250); pointer('C4','pointerup',1);
  vi.advanceTimersByTime(125); pointer('D4','pointerdown',2); vi.advanceTimersByTime(125); pointer('D4','pointerup',2);
  action('sim.stop');
  const text = document.querySelector<HTMLTextAreaElement>('dialog textarea')!;
  expect(text.value).toBe('C:0.5 R:0.25 D'); expect(apply).not.toHaveBeenCalled();
  text.value += ' invalid'; text.dispatchEvent(new Event('input'));
  expect([...document.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==='music.use')!.disabled).toBe(true);
  text.value = 'C:0.5 R:0.25 D'; text.dispatchEvent(new Event('input')); action('music.use');
  expect(apply).toHaveBeenCalledWith('C:0.5 R:0.25 D',120);
});
it('follows repeated notes, rests and octave changes, and selects the right occurrence for editing', async () => {
  openMelodyRecorder('C:0.25, R | C C7',120,vi.fn());
  const text = document.querySelector<HTMLTextAreaElement>('dialog textarea')!;
  action('music.play');
  await vi.advanceTimersByTimeAsync(40);
  expect(key('C4').classList.contains('active')).toBe(true);
  expect(text.value.slice(text.selectionStart,text.selectionEnd)).toBe('C:0.25');
  await vi.advanceTimersByTimeAsync(140);
  expect(document.querySelector('.piano-key.active')).toBeNull();
  expect(document.querySelector('.melody-playback-notes .active')?.textContent).toBe('R');
  await vi.advanceTimersByTimeAsync(140);
  expect(key('C4').classList.contains('active')).toBe(true);
  expect(text.selectionStart).toBe(12);
  await vi.advanceTimersByTimeAsync(140);
  expect(key('C7').classList.contains('active')).toBe(true);
  const active = document.querySelector<HTMLButtonElement>('.melody-playback-notes .active')!;
  active.click();
  expect(document.activeElement).toBe(text);
  expect(text.value.slice(text.selectionStart,text.selectionEnd)).toBe('C7');
  expect(document.querySelector('.piano-key.active')).toBeNull();
  expect(document.querySelector<HTMLElement>('.melody-playback-notes')!.hidden).toBe(false);
  expect(document.querySelector('.melody-playback-notes .active')).toBeNull();
  await vi.advanceTimersByTimeAsync(40);
  expect(key('C7').classList.contains('active')).toBe(true);
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('.piano-key.active')).toBeNull();
});
it('clears playback feedback on completion and when notes are edited', async () => {
  openMelodyRecorder('C:0.25',120,vi.fn());
  action('music.play'); await vi.advanceTimersByTimeAsync(250);
  expect(document.querySelector('.piano-key.active')).toBeNull();
  expect(document.querySelector('.melody-playing')?.textContent).toBe('');
  action('music.play'); await vi.advanceTimersByTimeAsync(40);
  const text = document.querySelector<HTMLTextAreaElement>('dialog textarea')!;
  text.value = 'D'; text.dispatchEvent(new Event('input'));
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('.piano-key.active')).toBeNull();
  expect(text.value).toBe('D');
});
it('shows the note buttons before playback, refreshes after edits and keeps them after Stop', async () => {
  openMelodyRecorder('C D C',120,vi.fn());
  const preview=document.querySelector<HTMLElement>('.melody-playback-notes')!;
  expect([...preview.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['C','D','C']);
  const text=document.querySelector<HTMLTextAreaElement>('dialog textarea')!;
  text.value='R:0.25 C5:0.25';text.dispatchEvent(new Event('input'));
  expect([...preview.querySelectorAll('button')].map(b=>b.textContent)).toEqual(['R:0.25','C5:0.25']);
  action('music.play');await vi.advanceTimersByTimeAsync(40);action('sim.stop');
  expect(preview.querySelectorAll('button')).toHaveLength(2);expect(preview.querySelector('.active')).toBeNull();
  preview.querySelectorAll<HTMLButtonElement>('button')[1].click();
  expect(document.activeElement).toBe(text);expect(text.value.slice(text.selectionStart,text.selectionEnd)).toBe('C5:0.25');
  action('music.clear');expect(preview.querySelectorAll('button')).toHaveLength(0);
});

it('auditions a clicked note using its inherited octave, duration and current tempo, then stops', async () => {
  const apply=vi.fn();openMelodyRecorder('C5:2 A:1 A R:0.5 A',120,apply);
  const text=document.querySelector<HTMLTextAreaElement>('dialog textarea')!;
  const buttons=document.querySelectorAll<HTMLButtonElement>('.melody-playback-notes button');
  buttons[1].click();await vi.advanceTimersByTimeAsync(40);
  expect(tone).toHaveBeenLastCalledWith(880,0);expect(key('A5').classList.contains('active')).toBe(true);
  expect(text.value.slice(text.selectionStart,text.selectionEnd)).toBe('A:1');
  await vi.advanceTimersByTimeAsync(400);expect(key('A5').classList.contains('active')).toBe(true);
  await vi.advanceTimersByTimeAsync(150);expect(document.querySelector('.piano-key.active')).toBeNull();
  const tempo=document.querySelector<HTMLInputElement>('dialog input[type=number]')!;tempo.value='60';
  buttons[2].click();await vi.advanceTimersByTimeAsync(600);expect(key('A5').classList.contains('active')).toBe(true);
  buttons[4].click();await vi.advanceTimersByTimeAsync(400);expect(key('A5').classList.contains('active')).toBe(true);
  await vi.advanceTimersByTimeAsync(200);expect(document.querySelector('.piano-key.active')).toBeNull();
  buttons[3].click();await vi.advanceTimersByTimeAsync(40);
  expect(document.querySelector('.piano-key.active')).toBeNull();expect(buttons[3].classList.contains('active')).toBe(true);
  action('sim.stop');await vi.advanceTimersByTimeAsync(600);expect(document.querySelector('.melody-playback-notes .active')).toBeNull();
  expect(text.value).toBe('C5:2 A:1 A R:0.5 A');expect(apply).not.toHaveBeenCalled();
});
