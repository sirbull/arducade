// Settings and the first run dialog: language, theme, pixel colour and the
// hardware profile for new projects.

import { BUILTIN_PROFILES, parseProfile, PROFILE_EXTENSION, type Profile } from '../hw/profile';
import { LANGUAGES, t } from '../i18n/i18n';
import { pickTextFile, profiles as profileStore, type Settings } from '../project/store';
import type { PixelColor } from '../sim/runner';
import { openDialog } from './dialogs';
import { h, select, toast } from './dom';
import { allProfiles } from './profile-editor';
import { THEME_IDS } from './themes';

export const PIXEL_COLORS: PixelColor[] = ['white', 'blue', 'yellow'];

export interface SettingsHost {
  settings: Settings;
  apply(next: Settings): Promise<void>;
}

async function form(draft: Settings): Promise<HTMLElement> {
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
      h('input', { type: 'radio', name: 'theme', value: id, checked: draft.theme === id, onchange: () => { draft.theme = id; } }),
      h('span', { class: 'theme-swatch', 'aria-hidden': 'true' }),
      h('span', {}, t(`theme.${id}`)),
    ));
  }
  return h(
    'div',
    { class: 'settings-form' },
    h('label', { class: 'field' }, t('settings.language'), select(LANGUAGES.map((l) => ({ value: l.code, label: l.name })), draft.language, (v) => (draft.language = v))),
    themeChoices,
    h('label', { class: 'field' }, t('settings.pixel'), select(PIXEL_COLORS.map((c) => ({ value: c, label: t(`pixel.${c}Color`) })), draft.pixelColor, (v) => (draft.pixelColor = v))),
    h('label', { class: 'field' }, t('settings.profile'), profileSelect),
    h('div', { class: 'row' }, importBtn, h('span', { class: 'muted small' }, t('settings.profileHelp'))),
  );
}

export async function openSettings(host: SettingsHost) {
  const draft: Settings = { ...host.settings };
  const d = openDialog(t('settings.title'));
  d.el.classList.add('settings-dialog');
  d.body.append(await form(draft));
  d.footer.append(
    h('button', { onclick: () => d.close() }, t('ui.cancel')),
    h('button', { class: 'primary', onclick: async () => (await host.apply(draft), d.close()) }, t('ui.save')),
  );
}

export async function openFirstRun(host: SettingsHost): Promise<void> {
  return new Promise((resolve) => {
    const draft: Settings = { ...host.settings };
    const d = openDialog(t('firstRun.title'), { closable: false, onClose: () => resolve() });
    d.el.classList.add('settings-dialog');
    d.body.append(h('p', {}, t('firstRun.text')));
    void form(draft).then((f) => d.body.append(f));
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
