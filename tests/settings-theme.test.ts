// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import type { Settings } from '../src/project/store';
import { openFirstRun, openSettings, type SettingsHost } from '../src/ui/settings-dialog';
import { applyPageTheme, type ThemeId } from '../src/ui/themes';

vi.mock('../src/ui/profile-editor', () => ({ allProfiles: async () => [] }));
vi.mock('../src/i18n/i18n', () => ({ LANGUAGES: [{ code: 'en', name: 'English' }], t: (key: string) => key }));

beforeEach(() => {
  document.body.replaceChildren();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
  applyPageTheme('color');
});

function host(): SettingsHost {
  const settings: Settings = { language: 'en', theme: 'color', pixelColor: 'white', profileId: '', muted: false, firstRunDone: true };
  return {
    settings,
    previewTheme: vi.fn((theme: ThemeId) => applyPageTheme(theme)),
    apply: vi.fn(async function (this: SettingsHost, next: Settings) { this.settings = { ...next }; applyPageTheme(next.theme as ThemeId); }),
  };
}

function choose(theme: ThemeId) {
  document.querySelector<HTMLInputElement>(`input[name="theme"][value="${theme}"]`)!.click();
}

it.each(['cancel', 'close', 'escape'] as const)('previews immediately and restores the saved theme on %s', async (action) => {
  const h = host();
  await openSettings(h);
  expect(document.querySelector<HTMLInputElement>('input[name="theme"]')!.value).toBe('color');
  const originalBackground = document.documentElement.style.getPropertyValue('--bg');
  choose('green');
  expect(document.documentElement.dataset.theme).toBe('green');
  expect(document.documentElement.style.getPropertyValue('--bg')).not.toBe(originalBackground);
  expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#6cd08a');
  expect(h.settings.theme).toBe('color');
  expect(h.apply).not.toHaveBeenCalled();
  if (action === 'cancel') document.querySelector<HTMLButtonElement>('.dialog-footer button')!.click();
  else if (action === 'close') document.querySelector<HTMLButtonElement>('.dialog-head button')!.click();
  else {
    const dialog = document.querySelector('dialog')!;
    // The browser closes the dialog after an unprevented Escape cancellation.
    expect(dialog.dispatchEvent(new Event('cancel', { cancelable: true }))).toBe(true);
    dialog.close();
  }
  expect(document.documentElement.dataset.theme).toBe('color');
  expect(document.documentElement.style.getPropertyValue('--bg')).toBe(originalBackground);
});

it('keeps the chosen theme after saving and reopening settings', async () => {
  const h = host();
  await openSettings(h);
  choose('blue');
  document.querySelector<HTMLButtonElement>('.dialog-footer .primary')!.click();
  await vi.waitFor(() => expect(document.querySelector('dialog')).toBeNull());
  expect(h.settings.theme).toBe('blue');
  expect(document.documentElement.dataset.theme).toBe('blue');
  await openSettings(h);
  expect(document.querySelector<HTMLInputElement>('input[value="blue"]')!.checked).toBe(true);
  choose('arduboy');
  document.querySelector<HTMLButtonElement>('.dialog-footer button')!.click();
  expect(document.documentElement.dataset.theme).toBe('blue');
});

it('previews themes during first run without saving until Start', async () => {
  const h = host();
  h.settings.firstRunDone = false;
  const done = openFirstRun(h);
  await vi.waitFor(() => expect(document.querySelector('input[name="theme"]')).not.toBeNull());
  choose('greyscale');
  expect(document.documentElement.dataset.theme).toBe('greyscale');
  expect(h.apply).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>('.dialog-footer .primary')!.click();
  await done;
  expect(h.settings.theme).toBe('greyscale');
  expect(h.settings.firstRunDone).toBe(true);
  expect(document.documentElement.dataset.theme).toBe('greyscale');
});
