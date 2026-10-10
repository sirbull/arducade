// Saves projects and hardware profiles in the browser (IndexedDB), and
// settings in localStorage. Nothing is sent to a server.

import type { Profile } from '../hw/profile';
import type { Project } from './model';

const DB_NAME = 'ardublocks';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const projects = {
  save: (p: Project) => tx('projects', 'readwrite', (s) => s.put(p)),
  get: (id: string) => tx<Project | undefined>('projects', 'readonly', (s) => s.get(id)),
  remove: (id: string) => tx('projects', 'readwrite', (s) => s.delete(id)),
  async list(): Promise<Project[]> {
    const all = await tx<Project[]>('projects', 'readonly', (s) => s.getAll());
    return all.sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || b.modified - a.modified);
  },
};

export const profiles = {
  save: (p: Profile) => tx('profiles', 'readwrite', (s) => s.put(p)),
  remove: (id: string) => tx('profiles', 'readwrite', (s) => s.delete(id)),
  list: () => tx<Profile[]>('profiles', 'readonly', (s) => s.getAll()),
};

// Settings -----------------------------------------------------------------

export interface Settings {
  language: string;
  theme: string;
  pixelColor: string;
  /** Profile used for new projects. */
  profileId: string;
  lastProjectId?: string;
  muted: boolean;
  firstRunDone: boolean;
  /** Stars per finished guide level. */
  guideStars?: Record<string, number>;
  /** Let the user open guide levels in any order. */
  guideFree?: boolean;
  /** Secret setting: the ATtiny85 Pico console (hold the settings button for 5 seconds). */
  secretTiny?: boolean;
}

const SETTINGS_KEY = 'ardublocks.settings';

export function loadSettings(defaults: Settings): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  return { ...defaults };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Ignore: settings are then kept only for this visit.
  }
}

// Files --------------------------------------------------------------------

export function downloadFile(name: string, content: BlobPart, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lets the user pick a file and returns its text. */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, text: await file.text() });
    };
    input.click();
  });
}

export function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().replace(/\s+/g, '_') || 'project';
}

/** Picks a project image or a legacy JSON project. */
export function pickProjectFile(): Promise<{ name: string; bytes: ArrayBuffer } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.png,.abproject,.json';
    input.addEventListener('cancel', () => resolve(null));
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try { resolve({ name: file.name, bytes: await file.arrayBuffer() }); } catch (error) { reject(error); }
    };
    input.click();
  });
}
