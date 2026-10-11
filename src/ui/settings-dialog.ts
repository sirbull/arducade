// Settings and the first run dialog: language, theme, pixel colour and the
// hardware profile for new projects. Holding the settings button for 5 seconds
// also shows the secret settings.

import { BUILTIN_PROFILES, DEFAULT_PROFILE_ID, parseProfile, PROFILE_EXTENSION, SECRET_PROFILES, type Profile } from '../hw/profile';
import { LANGUAGES, t } from '../i18n/i18n';
import { pickTextFile, profiles as profileStore, type Settings } from '../project/store';
import type { PixelColor } from '../sim/runner';
import { openDialog } from './dialogs';
import { h, select, toast } from './dom';
import { allProfiles } from './profile-editor';
import { THEME_IDS, type ThemeId } from './themes';

export const PIXEL_COLORS: PixelColor[] = ['white', 'blue', 'yellow', 'green'];

export interface SettingsHost {
  settings: Settings;
  previewTheme(theme: ThemeId): void;
  apply(next: Settings): Promise<void>;
}

async function form(draft: Settings, previewTheme: (theme: ThemeId) => void, secret = false): Promise<HTMLElement> {
  const list = await allProfiles();
  const profileSelect = select(
    list.map((p) => ({ value: p.id, label: p.name })),
    list.some((p) => p.id === draft.profileId) ? draft.profileId : BUILTIN_PROFILES[0].id,
    (v) => (draft.profileId = v),
  );
  const importBtn = h(
    'button',
    {
      type: 'button',
      onclick: async () => {
        const file = await pickTextFile(`${PROFILE_EXTENSION},.json`);
        if (!file) return;
        try {
          const p: Profile = parseProfile(file.text);
          await profileStore.save(p);
          profileSelect.append(h('option', { value: p.id }, p.name));
          profileSelect.value = p.id;
          draft.profileId = p.id;
          toast(t('profile.imported', { name: p.name }), 'ok');
        } catch (e) {
          toast(t((e as Error).message), 'error');
        }
      },
    },
    t('profile.import'),
  );
  const themeChoices = h('fieldset', { class: 'theme-choices' }, h('legend', {}, t('settings.theme')));
  for (const id of THEME_IDS) {
    themeChoices.append(h('label', { class: 'theme-choice', 'data-palette': id },
      h('input', { type: 'radio', name: 'theme', value: id, checked: draft.theme === id, onchange: () => { draft.theme = id; previewTheme(id); } }),
      h('span', { class: 'theme-swatch', 'aria-hidden': 'true' }),
      h('span', {}, t(`theme.${id}`)),
    ));
  }
  const pico = SECRET_PROFILES[0];
  const tiny = h('input', {
    type: 'checkbox',
    checked: !!draft.secretTiny,
    onchange: () => {
      draft.secretTiny = tiny.checked;
      // Turning it on picks the console for new projects, turning it off puts the default back.
      profileSelect.querySelector(`option[value="${pico.id}"]`)?.remove();
      if (tiny.checked) {
        profileSelect.append(h('option', { value: pico.id }, pico.name));
        profileSelect.value = draft.profileId = pico.id;
      } else if (draft.profileId === pico.id) {
        profileSelect.value = draft.profileId = DEFAULT_PROFILE_ID;
      }
    },
  });
  const secretBox = h(
    'fieldset',
    { class: 'secret-settings' },
    h('legend', {}, t('settings.secret')),
    h('label', { class: 'field check' }, tiny, t('settings.secretTiny')),
    h('p', { class: 'muted small' }, t('settings.secretTinyHelp')),
  );
  return h(
    'div',
    { class: 'settings-form' },
    h('label', { class: 'field' }, t('settings.language'), select(LANGUAGES.map((l) => ({ value: l.code, label: l.name })), draft.language, (v) => (draft.language = v))),
    themeChoices,
    h('label', { class: 'field' }, t('settings.pixel'), select(PIXEL_COLORS.map((c) => ({ value: c, label: t(`pixel.${c}Color`) })), draft.pixelColor, (v) => (draft.pixelColor = v))),
    h('label', { class: 'field' }, t('settings.profile'), profileSelect),
    h('div', { class: 'row' }, importBtn, h('span', { class: 'muted small' }, t('settings.profileHelp'))),
    (secret || draft.secretTiny) && secretBox,
  );
}

/**
 * Shows that the secret was found: the dialog shakes and confetti flies out
 * of the secret settings. With reduced motion there is only the message.
 */
function celebrate(dialog: HTMLElement, from: HTMLElement) {
  // In the dialog, since a toast would be behind it.
  from.querySelector('legend')!.after(h('p', { class: 'secret-found', role: 'status' }, t('settings.secretFound')));
  from.classList.add('found');
  from.scrollIntoView({ block: 'nearest' });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  dialog.animate(['0 0', '-12px 2px', '10px -2px', '-7px 1px', '4px 0', '0 0'].map((translate) => ({ translate })), { duration: 500, easing: 'ease-out' });
  // A modal dialog is drawn above everything else, except a popover opened after it.
  const layer = h('div', { class: 'confetti-layer', popover: 'manual', 'aria-hidden': 'true' });
  const popover = typeof layer.showPopover === 'function';
  (popover ? document.body : dialog).append(layer);
  if (popover) layer.showPopover();
  const box = from.getBoundingClientRect();
  const origin = layer.getBoundingClientRect();
  const x = box.left + box.width / 2 - origin.left, y = box.top + box.height / 2 - origin.top;
  const colors = ['#ff681f', '#4b6cf0', '#2fa38f', '#ffd646', '#e8e8e2', '#c9a36b'];
  const done: Promise<unknown>[] = [];
  for (let i = 0; i < 72; i++) {
    // Squares and true circles only, as everywhere else in ArduCade.
    const piece = h('span', { class: i % 3 ? 'confetti' : 'confetti circle' });
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = colors[i % colors.length];
    layer.append(piece);
    const angle = Math.random() * Math.PI * 2;
    const speed = 160 + Math.random() * 320;
    const dx = Math.cos(angle) * speed, dy = Math.sin(angle) * speed - 140;
    const spin = (Math.random() - 0.5) * 1440;
    done.push(piece.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx * 1.3}px, ${dy + 480}px) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 1500 + Math.random() * 700, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' }).finished);
  }
  void Promise.allSettled(done).then(() => layer.remove());
}

export async function openSettings(host: SettingsHost, secret = false) {
  const draft: Settings = { ...host.settings };
  const d = openDialog(t('settings.title'), { onClose: () => host.previewTheme(host.settings.theme as ThemeId) });
  d.el.classList.add('settings-dialog');
  d.body.append(await form(draft, (theme) => host.previewTheme(theme), secret));
  const secretBox = d.body.querySelector<HTMLElement>('.secret-settings');
  if (secret && secretBox) celebrate(d.el, secretBox);
  d.footer.append(
    h('button', { onclick: () => d.close() }, t('ui.cancel')),
    h('button', { class: 'primary', onclick: async () => (await host.apply(draft), d.close()) }, t('ui.save')),
  );
}

export async function openFirstRun(host: SettingsHost): Promise<void> {
  return new Promise((resolve) => {
    const draft: Settings = { ...host.settings };
    const d = openDialog(t('firstRun.title'), { closable: false, onClose: () => { host.previewTheme(host.settings.theme as ThemeId); resolve(); } });
    d.el.classList.add('settings-dialog');
    d.body.append(h('p', {}, t('firstRun.text')));
    void form(draft, (theme) => host.previewTheme(theme)).then((f) => d.body.append(f));
    d.footer.append(
      h(
        'button',
        {
          class: 'primary',
          onclick: async () => {
            draft.firstRunDone = true;
            await host.apply(draft);
            d.close();
          },
        },
        t('firstRun.start'),
      ),
    );
  });
}
