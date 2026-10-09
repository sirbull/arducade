// Project file format (.abproject). Plain JSON so it is easy to read and to
// upgrade later. Bump PROJECT_VERSION and add an upgrade step in
// upgradeProject when the format changes.

import type { GuideState } from '../guides/guide';
import { BUILTIN_PROFILES, DEFAULT_PROFILE_ID, parseProfile, type Profile } from '../hw/profile';

export const PROJECT_VERSION = 1;
export const PROJECT_EXTENSION = '.abproject';

/**
 * Pixels are stored as rows of characters:
 * "." transparent, "1" white, "0" black.
 */
export type PixelRows = string[];

export interface ImageAsset {
  id: string;
  name: string;
  width: number;
  height: number;
  /** One or more frames for animation. */
  frames: PixelRows[];
}

export interface TileAsset {
  id: string;
  name: string;
  /** 8x8 pixels. */
  pixels: PixelRows;
  /** Sprites can not move through solid tiles. */
  solid: boolean;
}

export interface LevelLink {
  id: string;
  col: number;
  row: number;
  target: string;
  spawnCol: number;
  spawnRow: number;
}

export interface TilemapAsset {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Portals triggered when a Player sprite enters the source tile. */
  links?: LevelLink[];
  /** Tile number per cell, row by row. 0 is empty, 1 is the first tile. */
  cells: number[];
}

/** Text in several languages, used by templates. */
export type LocalizedText = Record<string, string>;

export interface TemplateInfo {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  /** Suggestions shown in the "Try this" panel. */
  tips: LocalizedText[];
  /**
   * Texts used in the blocks of the template, by language and key. Strings
   * in the blocks written as "@key" are replaced when the template is opened.
   */
  strings?: Record<string, Record<string, string>>;
}

export interface Project {
  format: 'ardublocks-project';
  version: number;
  id: string;
  name: string;
  created: number;
  modified: number;
  profile: Profile;
  /** Simulator display colour, saved with this game. */
  pixelColor?: 'white' | 'blue' | 'yellow';
  /** Blockly workspace saved with Blockly.serialization.workspaces.save. */
  blocks: unknown;
  /** Text mode keeps the original block workspace as a recoverable copy. */
  source?: { language: 'javascript' | 'python'; code: string };
  images: ImageAsset[];
  tiles: TileAsset[];
  tilemaps: TilemapAsset[];
  /** Optional map loaded after the on-start blocks. */
  startLevelId?: string;
  /** Sprite kinds added by the user, after the built in kinds. */
  kinds: string[];
  template?: TemplateInfo;
  /** Set when the project belongs to a guide level. */
  guide?: GuideState;
}

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyPixels(w: number, h: number): PixelRows {
  return Array.from({ length: h }, () => '.'.repeat(w));
}

export function newProject(name: string, profile?: Profile): Project {
  const now = Date.now();
  return {
    format: 'ardublocks-project',
    version: PROJECT_VERSION,
    id: newId('p'),
    name,
    created: now,
    modified: now,
    profile: profile ?? BUILTIN_PROFILES.find((p) => p.id === DEFAULT_PROFILE_ID)!,
    pixelColor: 'white',
    blocks: {},
    images: [],
    tiles: [],
    tilemaps: [],
    kinds: [],
  };
}

/** Parses a project file. Throws an Error with a translation key. */
export function parseProject(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('file.notJson');
  }
  const p = data as Partial<Project>;
  if (!p || p.format !== 'ardublocks-project') throw new Error('file.notProject');
  if (typeof p.version !== 'number' || p.version > PROJECT_VERSION) throw new Error('file.tooNew');
  return upgradeProject(p);
}

function upgradeProject(p: Partial<Project>): Project {
  const base = newProject(typeof p.name === 'string' ? p.name : 'Project');
  return {
    ...base,
    ...p,
    format: 'ardublocks-project',
    version: PROJECT_VERSION,
    profile: p.profile ? parseProfile(JSON.stringify(p.profile)) : base.profile,
    images: Array.isArray(p.images) ? p.images : [],
    tiles: Array.isArray(p.tiles) ? p.tiles : [],
    tilemaps: Array.isArray(p.tilemaps) ? p.tilemaps : [],
    kinds: Array.isArray(p.kinds) ? p.kinds : [],
    pixelColor: p.pixelColor === 'blue' || p.pixelColor === 'yellow' ? p.pixelColor : 'white',
    source: p.source && ['javascript', 'python'].includes(p.source.language) && typeof p.source.code === 'string' ? p.source : undefined,
  };
}

export function serializeProject(p: Project): string {
  return JSON.stringify(p, null, 1) + '\n';
}

// Pixel helpers -------------------------------------------------------------

export function pixelAt(rows: PixelRows, x: number, y: number): '.' | '1' | '0' {
  const c = rows[y]?.[x];
  return c === '1' || c === '0' ? c : '.';
}

/**
 * Converts pixels to the engine image format: width, height, frame count,
 * flags, then data (and mask) per frame in the Arduboy layout.
 */
export function encodeImage(width: number, height: number, frames: PixelRows[]): number[] {
  const hasMask = frames.some((f) => f.some((row) => row.includes('0')));
  const pages = Math.ceil(height / 8);
  const out = [width, height, frames.length, hasMask ? 1 : 0];
  for (const f of frames) {
    const data: number[] = [];
    const mask: number[] = [];
    for (let p = 0; p < pages; p++) {
      for (let x = 0; x < width; x++) {
        let d = 0;
        let m = 0;
        for (let bit = 0; bit < 8; bit++) {
          const y = p * 8 + bit;
          if (y >= height) break;
          const c = pixelAt(f, x, y);
          if (c === '1') d |= 1 << bit;
          if (c !== '.') m |= 1 << bit;
        }
        data.push(d);
        mask.push(m);
      }
    }
    out.push(...data);
    if (hasMask) out.push(...mask);
  }
  return out;
}

/** Tilemap in the engine format: width, height, cells. */
export function encodeTilemap(m: TilemapAsset): number[] {
  return [m.width, m.height, ...m.cells.slice(0, m.width * m.height).map((c) => c & 0xff)];
}

/** Picks the text for a language, falling back to English. */
export function localized(text: LocalizedText | undefined, lang: string): string {
  if (!text) return '';
  return text[lang] ?? text.en ?? Object.values(text)[0] ?? '';
}

/** Makes a new project from a template, with texts in the given language. */
export function instantiateTemplate(template: Project, lang: string): Project {
  const strings = template.template?.strings ?? {};
  const lookup = (key: string) => strings[lang]?.[key] ?? strings.en?.[key] ?? key;
  const replace = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith('@') && v.length > 1 ? lookup(v.slice(1)) : v;
    if (Array.isArray(v)) return v.map(replace);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]));
    return v;
  };
  const now = Date.now();
  const copy: Project = JSON.parse(JSON.stringify(template));
  copy.blocks = replace(copy.blocks);
  copy.id = newId('p');
  copy.name = localized(template.template?.title, lang) || template.name;
  copy.pixelColor = 'white';
  copy.created = now;
  copy.modified = now;
  return copy;
}
