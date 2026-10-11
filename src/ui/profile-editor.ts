// Hardware profile picker and editor. Built in profiles can be copied, and
// custom profiles can be changed, exported as a template file and imported.

import { CHIPS, getChip, UNSUPPORTED_CHIPS } from '../hw/chips';
import {
  BUILTIN_PROFILES,
  BUTTONS,
  cloneProfile,
  createCustomProfile,
  DISPLAY_DRIVERS,
  ESPBOY_DEFAULTS,
  MCP_PINS,
  isESPboy,
  hasErrors,
  parseProfile,
  PROFILE_EXTENSION,
  SECRET_PROFILES,
  serializeProfile,
  validateProfile,
  type Profile,
} from '../hw/profile';
import { t } from '../i18n/i18n';
import { downloadFile, pickTextFile, profiles as profileStore, safeFileName } from '../project/store';
import { confirmDialog, openDialog, promptDialog } from './dialogs';
import { clear, h, select, toast } from './dom';

/** Built in profiles, profiles in the profiles/ folder on the server, and the user's own. */
export async function allProfiles(): Promise<Profile[]> {
  const own = await profileStore.list().catch(() => [] as Profile[]);
  return [...BUILTIN_PROFILES, ...(secretOn ? SECRET_PROFILES : []), ...serverProfiles, ...own];
}

let secretOn = false;

/** Shows the ATtiny85 Pico profile and chip, from the secret setting. */
export function setSecretProfiles(on: boolean) {
  secretOn = on;
}

let serverProfiles: Profile[] = [];

/** Loads profiles listed in profiles/index.json on the web server. */
export async function loadServerProfiles() {
  try {
    const res = await fetch('profiles/index.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const list = (await res.json()) as string[];
    const loaded: Profile[] = [];
    for (const file of list) {
      try {
        const r = await fetch(`profiles/${file}`);
        if (!r.ok) continue;
        const p = parseProfile(await r.text());
        p.builtin = true;
        loaded.push(p);
      } catch {
        // Skip broken files.
      }
    }
    serverProfiles = loaded;
  } catch {
    // No profiles folder on this server.
  }
}

/** Loads a profile from a link such as ?profile=profiles/my-nano.abprofile. */
export async function profileFromUrl(path: string): Promise<Profile | null> {
  if (!/^[\w./-]+$/.test(path) || path.includes('..')) return null;
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return parseProfile(await res.text());
  } catch {
    return null;
  }
}

export function issueList(p: Profile): HTMLElement {
  const issues = validateProfile(p);
  if (!issues.length) return h('p', { class: 'ok small' }, t('profile.allGood'));
  return h(
    'ul',
    { class: 'issues' },
    ...issues.map((i) => {
      const params: Record<string, string | number> = { ...(i.params ?? {}) };
      for (const k of ['role', 'other', 'bus']) if (typeof params[k] === 'string') params[k] = t(`role.${params[k]}`);
      return h('li', { class: i.level }, t(i.key, params));
    }),
  );
}

/** Dialog to choose and edit the hardware profile of a project. */
export function openProfileDialog(current: Profile, onChoose: (p: Profile) => void) {
  const d = openDialog(t('profile.title'), { wide: true });
  let working: Profile = JSON.parse(JSON.stringify(current));

  let renderVersion = 0;
  const render = async () => {
    const version = ++renderVersion;
    const list = await allProfiles();
    if (version !== renderVersion) return;
    clear(d.body);
    const options = [{ value: '__custom__', label: t('profile.custom') }, ...list.map((p) => ({ value: p.id, label: p.builtin ? p.name : `${p.name} (${t('profile.own')})` }))];
    if (!list.some((p) => p.id === working.id)) options.push({ value: working.id, label: working.name });
    d.body.append(
      h(
        'div',
        { class: 'row' },
        h(
          'label',
          { class: 'inline grow' },
          t('profile.choose'),
          select(options, working.id, (id) => {
            if (id === '__custom__') {
              working = createCustomProfile(t('profile.custom'));
              void render();
              return;
            }
            const p = list.find((x) => x.id === id);
            if (p) working = JSON.parse(JSON.stringify(p));
            void render();
          }),
        ),
        h('button', { onclick: copy }, t('profile.copy')),
        h('button', { onclick: importFile }, t('profile.import')),
        h('button', { onclick: () => downloadFile(safeFileName(working.name) + PROFILE_EXTENSION, serializeProfile(working)) }, t('profile.export')),
      ),
    );
    if (working.builtin) d.body.append(h('p', { class: 'muted small' }, t('profile.builtinHelp')));
    d.body.append(profileForm(working, false, () => {
      if (working.builtin) working = cloneProfile(working, working.name);
      void render();
    }));
  };

  const copy = async () => {
    const name = await promptDialog(t('profile.copy'), t('profile.name'), `${working.name} (2)`);
    if (!name) return;
    working = cloneProfile(working, name);
    await profileStore.save(working);
    void render();
  };

  const importFile = async () => {
    const file = await pickTextFile(`${PROFILE_EXTENSION},.json`);
    if (!file) return;
    try {
      const p = parseProfile(file.text);
      if ((await allProfiles()).some((x) => x.id === p.id && x.builtin)) p.id = cloneProfile(p, p.name).id;
      await profileStore.save(p);
      working = p;
      toast(t('profile.imported', { name: p.name }), 'ok');
      void render();
    } catch (e) {
      toast(t((e as Error).message), 'error');
    }
  };

  d.footer.append(
    h(
      'button',
      {
        class: 'danger',
        onclick: async () => {
          if (working.builtin) return;
          if (!(await confirmDialog(t('profile.deleteTitle'), t('profile.deleteText', { name: working.name }), t('ui.delete')))) return;
          await profileStore.remove(working.id);
          working = JSON.parse(JSON.stringify(BUILTIN_PROFILES[0]));
          void render();
        },
      },
      t('profile.delete'),
    ),
    h('span', { class: 'spacer' }),
    h('button', { onclick: () => d.close() }, t('ui.cancel')),
    h(
      'button',
      {
        class: 'primary',
        onclick: async () => {
          if (hasErrors(validateProfile(working))) {
            toast(t('profile.hasErrors'), 'error');
            return;
          }
          if (!working.builtin) await profileStore.save(working);
          onChoose(working);
          d.close();
        },
      },
      t('profile.use'),
    ),
  );
  void render();
}

/** Form with all settings; preset edits become a custom copy. */
function profileForm(p: Profile, readonly: boolean, onChange: () => void): HTMLElement {
  const chip = getChip(p.chip);
  const pinOptions = [{ value: '', label: t('profile.none') }, ...chip.pins.filter((x) => !x.reserved && !x.analogOnly).map((x) => ({ value: x.id, label: x.id }))];
  const changed = () => {
    onChange();
  };
  const pinSelect = (value: string | undefined, set: (v: string | undefined) => void, label: string, mcp = false) => {
    const options = [...pinOptions, ...(mcp && isESPboy(p) ? MCP_PINS.map((pin) => ({ value: pin.id, label: pin.id })) : [])];
    return h('label', { class: 'field' }, label, select(value && !options.some((x) => x.value === value) ? [...options, { value, label: value }] : options, value ?? '', (v) => (set(v || undefined), changed()), { disabled: readonly }));
  };
  const addressInput = (label: string, value: number, min: number, max: number, set: (v: number) => void) =>
    h('label', { class: 'field' }, label, select(Array.from({ length: max - min + 1 }, (_, n) => ({ value: String(min + n), label: `0x${(min + n).toString(16).toUpperCase()}` })), String(value), (v) => (set(Number(v)), changed()), { disabled: readonly }));

  const chipOptions = CHIPS.filter((c) => !c.tiny || secretOn || c.id === p.chip).map((c) => ({ value: c.id, label: `${c.name} (${c.boards[0]})${c.browserCompile ? '' : ' *'}` }));
  const form = h(
    'div',
    { class: 'profile-form' },
    h('label', { class: 'field' }, t('profile.name'), h('input', { value: p.name, disabled: readonly, onchange: (e) => { p.name = (e.target as HTMLInputElement).value.trim() || t('profile.custom'); changed(); } })),
    h(
      'fieldset',
      { disabled: readonly },
      h('legend', {}, t('profile.chip')),
      h(
        'label',
        { class: 'field' },
        t('profile.chip'),
        select(chipOptions, p.chip, (v) => {
          p.chip = v;
          changed();
        }),
      ),
      h('p', { class: 'muted small' }, t('profile.chipInfo', { boards: chip.boards.join(', '), flash: Math.round(chip.flash / 1024), ram: (chip.ram / 1024).toFixed(1) })),
      h('p', { class: 'muted small' }, t('profile.exportOnlyNote')),
      h('p', { class: 'muted small' }, t('profile.unsupported', { chips: UNSUPPORTED_CHIPS.map((c) => c.name).join(', ') })),
    ),
    h(
      'fieldset',
      { disabled: readonly },
      h('legend', {}, t('profile.display')),
      h('label', { class: 'field' }, t('profile.driver'), select(DISPLAY_DRIVERS.map((x) => ({ value: x.id, label: x.name })), p.display.driver, (v) => {
        p.display.driver = v as Profile['display']['driver'];
        if (isESPboy(p)) { p.espboy ??= { ...ESPBOY_DEFAULTS }; p.display.bus = 'spi'; }
        changed();
      })),
      h(
        'label',
        { class: 'field' },
        t('profile.bus'),
        select(
          [
            ...(!isESPboy(p) ? [{ value: 'i2c', label: 'I2C' }] : []),
            { value: 'spi', label: 'SPI' },
          ],
          p.display.bus,
          (v) => ((p.display.bus = v as Profile['display']['bus']), changed()),
        ),
      ),
      p.display.bus === 'i2c'
        ? h(
            'label',
            { class: 'field' },
            t('profile.address'),
            select(
              [
                { value: '60', label: '0x3C' },
                { value: '61', label: '0x3D' },
              ],
              String(p.display.i2cAddress),
              (v) => ((p.display.i2cAddress = Number(v)), changed()),
            ),
          )
        : [pinSelect(p.display.cs, (v) => (p.display.cs = v), 'CS', true), pinSelect(p.display.dc, (v) => (p.display.dc = v), 'DC')],
      pinSelect(p.display.rst, (v) => (p.display.rst = v), 'RST'),
      checkbox(t('profile.rotate'), p.display.rotate180, (v) => ((p.display.rotate180 = v), changed())),
      checkbox(t('profile.mirror'), p.display.mirror, (v) => ((p.display.mirror = v), changed())),
      h('label', { class: 'field' }, t(isESPboy(p) ? 'profile.backlightBrightness' : 'profile.contrast'), range(p.display.contrast, (v) => ((p.display.contrast = v), changed()))),
      h('p', { class: 'muted small' }, t(isESPboy(p) ? 'profile.espboyBusPins' : 'profile.busPins', { sda: (isESPboy(p) ? p.espboy?.sda : chip.bus.sda) ?? '-', scl: (isESPboy(p) ? p.espboy?.scl : chip.bus.scl) ?? '-', mosi: (isESPboy(p) ? p.espboy?.mosi : chip.bus.mosi) ?? '-', sck: (isESPboy(p) ? p.espboy?.sck : chip.bus.sck) ?? '-' })),
    ),
    ...(isESPboy(p) && p.espboy ? [h('fieldset', { disabled: readonly },
      h('legend', {}, 'ESPboy'),
      h('p', { class: 'muted small' }, t('profile.espboyHelp')),
      ...(['sda', 'scl', 'mosi', 'sck'] as const).map((key) => pinSelect(p.espboy![key], (v) => (p.espboy![key] = v ?? ''), key.toUpperCase())),
      addressInput(t('profile.mcpAddress'), p.espboy.mcpAddress, 0x20, 0x27, (v) => (p.espboy!.mcpAddress = v)),
      checkbox(t('profile.backlightDAC'), p.espboy.dacAddress !== undefined, (v) => { p.espboy!.dacAddress = v ? 0x60 : undefined; changed(); }),
      ...(p.espboy.dacAddress !== undefined ? [addressInput(t('profile.dacAddress'), p.espboy.dacAddress, 0x60, 0x67, (v) => (p.espboy!.dacAddress = v))] : []),
    )] : []),
    h(
      'fieldset',
      { disabled: readonly },
      h('legend', {}, t('profile.buttons')),
      ...BUTTONS.map((b) => pinSelect(p.buttons[b], (v) => (p.buttons[b] = v ?? ''), t(`role.button.${b}`), true)),
    ),
    h(
      'fieldset',
      { disabled: readonly },
      h('legend', {}, t('profile.sound')),
      pinSelect(p.sound.pin1, (v) => (p.sound.pin1 = v), t('role.sound.pin1')),
      ...(!isESPboy(p) ? [pinSelect(p.sound.pin2, (v) => (p.sound.pin2 = v), t('role.sound.pin2'))] : []),
    ),
    h('div', { class: 'issues-box' }, h('h4', {}, t('profile.checks')), issueList(p)),
  );
  return form;
}

function checkbox(label: string, value: boolean, set: (v: boolean) => void) {
  const input = h('input', { type: 'checkbox', checked: value });
  input.addEventListener('change', () => set(input.checked));
  return h('label', { class: 'field check' }, input, label);
}

function range(value: number, set: (v: number) => void) {
  const input = h('input', { type: 'range', min: 0, max: 255, value });
  input.addEventListener('change', () => set(Number(input.value)));
  return input;
}
