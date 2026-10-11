// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { BUILTIN_PROFILES, cloneProfile, createCustomProfile, withBoardDefaults } from '../src/hw/profile';
import { profileForm } from '../src/ui/profile-editor';

vi.mock('../src/i18n/i18n', () => ({ t: (key: string, params?: Record<string, string>) => key + (params ? JSON.stringify(params) : '') }));
const confirm = vi.hoisted(() => vi.fn());
vi.mock('../src/ui/dialogs', () => ({ confirmDialog: confirm, openDialog: vi.fn(), promptDialog: vi.fn() }));
beforeEach(() => { confirm.mockReset(); document.body.replaceChildren(); });
function form(p = withBoardDefaults(createCustomProfile(), 'promicro-16')) {
  const changed = vi.fn();
  const root = profileForm(p, false, changed);
  document.body.append(root);
  const pick = (label: string, value: string) => {
    const input = Array.from(root.querySelectorAll('label')).find(l => l.firstChild?.textContent === label)!.querySelector('select')!;
    input.value = value; input.dispatchEvent(new Event('change'));
  };
  return { p, root, pick, changed };
}
it('waits for confirmation before resetting customized board wiring and supports cancellation', async () => {
  const f = form(); f.p.buttons.up = 'D0';
  let finish!: (result: boolean) => void;
  confirm.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
  f.pick('profile.developmentBoard', 'nano');
  expect(f.p.chip).toBe('atmega32u4'); expect(f.p.buttons.up).toBe('D0');
  expect(confirm.mock.calls[0][1]).toContain('profile.setting.buttons');
  finish(false); await Promise.resolve();
  expect(f.p.boardId).toBe('promicro-16'); expect(f.p.buttons.up).toBe('D0');
  confirm.mockResolvedValue(true); f.pick('profile.developmentBoard', 'nano'); await Promise.resolve();
  expect(f.p.chip).toBe('atmega328p'); expect(f.p.boardId).toBe('nano'); expect(f.p.buttons.up).toBe('D2');
});
it('switches to manual mode without changing the clock or wiring', () => {
  const f = form(withBoardDefaults(createCustomProfile(), 'promicro-8'));
  f.p.buttons.up = 'D0'; f.pick('profile.configurationMode', 'microcontroller');
  expect(f.p.configurationMode).toBe('microcontroller'); expect(f.p.boardId).toBeUndefined();
  expect(f.p.clockHz).toBe(8000000); expect(f.p.buttons.up).toBe('D0'); expect(confirm).not.toHaveBeenCalled();
});
it('loads legacy hardware into manual controls and shows nearby pin errors', () => {
  const p = cloneProfile(BUILTIN_PROFILES[0], 'Legacy'); p.buttons.up = 'D16';
  const f = form(p);
  expect(f.root.querySelector('select')!.value).toBe('microcontroller');
  expect(f.root.querySelector('label [role=alert]')?.textContent).toContain('profile.pinBus');
});
it('disables audio without discarding the pin settings and hides speaker controls', () => {
  const f = form(); const sound = { ...f.p.sound };
  f.pick('profile.sound', 'disabled');
  expect(f.p.sound).toEqual({ ...sound, enabled: false });
  const root = profileForm(f.p, false, vi.fn());
  expect(root.textContent).not.toContain('role.sound.pin1');
});
it('shows a read-only microcontroller in board mode', () => {
  const f = form();
  expect(f.root.textContent).toContain('ATmega32U4');
  expect(Array.from(f.root.querySelectorAll('select')).some(s => Array.from(s.options).some(o => o.value === 'atmega32u4'))).toBe(false);
});
it('enters board selection in the same form and preserves compatible custom wiring', () => {
  const p = cloneProfile(BUILTIN_PROFILES[0], 'Manual'); p.buttons.up = 'D0';
  const f = form(p); f.pick('profile.configurationMode', 'board');
  expect(p.chip).toBe('atmega32u4'); expect(p.buttons.up).toBe('D0'); expect(p.boardId).toBeUndefined();
  const next = form(p); next.pick('profile.developmentBoard', 'leonardo');
  expect(p.boardId).toBe('leonardo'); expect(p.buttons.up).toBe('D0'); expect(confirm).not.toHaveBeenCalled();
});
it('refreshes a cancelled preset edit without creating a custom copy', async () => {
  confirm.mockResolvedValue(false);
  const changed = vi.fn(), refresh = vi.fn();
  const p = JSON.parse(JSON.stringify(BUILTIN_PROFILES[0]));
  const root = profileForm(p, false, changed, refresh);
  const clock = Array.from(root.querySelectorAll('label')).find(l => l.firstChild?.textContent === 'profile.clockSpeed')!.querySelector('select')!;
  clock.value = '8000000'; clock.dispatchEvent(new Event('change')); await Promise.resolve();
  expect(p.builtin).toBe(true); expect(p.clockHz).toBeUndefined();
  expect(changed).not.toHaveBeenCalled(); expect(refresh).toHaveBeenCalledOnce();
});
