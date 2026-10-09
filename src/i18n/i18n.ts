// Translations. Each language is one JSON file in public/locales, so a new
// language can be added by putting a file on the web server. English is the
// reference: text missing in a language is shown in English.

import * as Blockly from 'blockly/core';

export interface LanguageInfo {
  code: string;
  /** Name of the language in the language itself. */
  name: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English' },
  { code: 'nb', name: 'Norsk (bokmål)' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
];

export const DEFAULT_LANGUAGE = 'en';

interface LocaleFile {
  ui?: Record<string, string>;
  blocks?: Record<string, string>;
}

// Blockly's own block texts, loaded only when the language is used.
const BLOCKLY_MSG: Record<string, () => Promise<unknown>> = {
  en: () => import('blockly/msg/en'),
  nb: () => import('blockly/msg/nb'),
  es: () => import('blockly/msg/es'),
  fr: () => import('blockly/msg/fr'),
  de: () => import('blockly/msg/de'),
};

let ui: Record<string, string> = {};
let current = DEFAULT_LANGUAGE;

async function fetchLocale(code: string): Promise<LocaleFile> {
  try {
    const res = await fetch(`locales/${code}.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    return (await res.json()) as LocaleFile;
  } catch {
    return {};
  }
}

export function currentLanguage(): string {
  return current;
}

/** Loads a language and applies it to Blockly. */
export async function loadLanguage(code: string): Promise<void> {
  const known = LANGUAGES.some((l) => l.code === code) || code === DEFAULT_LANGUAGE;
  const lang = known ? code : DEFAULT_LANGUAGE;
  const [en, local] = await Promise.all([fetchLocale('en'), lang === 'en' ? Promise.resolve({}) : fetchLocale(lang)]);
  ui = { ...(en.ui ?? {}), ...((local as LocaleFile).ui ?? {}) };

  const loader = BLOCKLY_MSG[lang] ?? BLOCKLY_MSG.en;
  const msgs = (await loader()) as { default?: Record<string, string> } & Record<string, string>;
  Blockly.setLocale((msgs.default ?? msgs) as Record<string, string>);
  Object.assign(Blockly.Msg, en.blocks ?? {}, (local as LocaleFile).blocks ?? {});
  current = lang;
  document.documentElement.lang = lang;
}

/** Translated text for a key. {name} in the text is replaced by params.name. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = ui[key];
  if (s === undefined) s = key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  return s;
}

/** Translates elements with data-i18n (text), data-i18n-title and data-i18n-placeholder. */
export function translatePage(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
    el.setAttribute('aria-label', el.title);
  });
  root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder!)));
}

/** Picks the user's browser language if we have it, otherwise English. */
export function guessLanguage(): string {
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase().split('-')[0];
    if (code === 'no' || code === 'nn') return 'nb';
    if (LANGUAGES.some((x) => x.code === code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

/** Name of a sprite kind in the current language. */
export function kindName(kind: string): string {
  return Blockly.Msg[`AB_KIND_${kind}`] ?? kind;
}
