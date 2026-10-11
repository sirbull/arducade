// Shared parts of the C++ and JavaScript generators.

import { BUILTIN_KINDS, BUTTON_IDS, COLORS, FLAGS, HIT, PROPS, SFX } from '../engine/enums';
import { parseMelody } from '../engine/melody';
import { SONGS, songBytes, type SongName } from '../engine/songs';
import { forEachExpr } from '../ir/check';
import type { EffectDef, EnumType, Event, Func, Program } from '../ir/ir';
import type { Project } from '../project/model';
import { NameTable, sanitize } from './names';

/** Identifiers for the assets and names in a project. */
export class Names {
  vars = new NameTable('v_');
  funcs = new NameTable('f_');
  images = new NameTable('img_');
  backgrounds = new NameTable('bg_');
  maps = new NameTable('map_');
  effects = new NameTable('fx_');
  imageIds = new Map<string, string>();
  mapIds = new Map<string, string>();

  constructor(public project: Project) {
    for (const img of project.images) this.imageIds.set(img.id, this.images.get(img.name));
    // Backgrounds are images too, so blocks can pass them where an image goes.
    for (const bg of project.backgrounds) this.imageIds.set(bg.id, this.backgrounds.get(bg.name));
    for (const m of project.tilemaps) this.mapIds.set(m.id, this.maps.get(m.name));
  }

  image(id: string): string | undefined {
    return this.imageIds.get(id);
  }

  tilemap(id: string): string | undefined {
    return this.mapIds.get(id);
  }

  /** Tile number for a tile asset id. 0 is empty. */
  tile(id: string): number {
    if (id === 'empty') return 0;
    const i = this.project.tiles.findIndex((t) => t.id === id);
    return i < 0 ? 0 : i + 1;
  }

  userKindConst(name: string): string {
    return `KIND_${sanitize(name)}`;
  }
}

/** Numeric value of an enum member, the same in C++ and in the simulator. */
export function enumNumber(type: EnumType, v: string, names: Names): number {
  switch (type) {
    case 'button':
      return Math.max(0, (BUTTON_IDS as readonly string[]).indexOf(v));
    case 'flag':
      return FLAGS[v as keyof typeof FLAGS] ?? 0;
    case 'prop':
      return Math.max(0, (PROPS as readonly string[]).indexOf(v));
    case 'dir':
      return HIT[v as keyof typeof HIT] ?? 0;
    case 'sfx':
      return Math.max(0, (SFX as readonly string[]).indexOf(v));
    case 'color':
      return COLORS[v as keyof typeof COLORS] ?? 1;
    case 'tile':
      return names.tile(v);
    case 'kind': {
      const b = (BUILTIN_KINDS as readonly string[]).indexOf(v);
      if (b >= 0) return b;
      const u = names.project.kinds.indexOf(v);
      return u >= 0 ? BUILTIN_KINDS.length + u : 0;
    }
    default:
      return 0;
  }
}

/** Condition for an "on button" handler. `isPressed` is ab::isPressed or E.isPressed. */
export function buttonMatch(button: string, names: Names, isPressed: string): string {
  const a = BUTTON_IDS.indexOf('a'), b = BUTTON_IDS.indexOf('b');
  if (button === 'any') return 'true';
  if (button === 'direction') return `button < ${a}`;
  // ponytail: A and B released in the same frame only fires on the first of them.
  if (button === 'ab') return `((button == ${a} && ${isPressed}(${b})) || (button == ${b} && ${isPressed}(${a})))`;
  return `button == ${enumNumber('button', button, names)}`;
}

export function eventsOf<K extends Event['k']>(p: Program, k: K): Extract<Event, { k: K }>[] {
  return p.events.filter((e): e is Extract<Event, { k: K }> => e.k === k);
}

/** Overlap handlers grouped by kind pair. */
export function overlapGroups(p: Program) {
  return eventsOf(p, 'overlap');
}

export function funcByName(p: Program, name: string): Func | undefined {
  return p.funcs.find((f) => f.name === name);
}

/** 16 bit number from a string, used to tell games apart in EEPROM. */
export function hash16(s: string): number {
  let h = 0x811c;
  for (let i = 0; i < s.length; i++) h = ((h ^ s.charCodeAt(i)) * 0x193) & 0xffff;
  return h === 0 ? 1 : h;
}

/** The effects in the program with their identifiers. */
export function effectNames(p: Program, names: Names): Map<string, { id: string; fx: EffectDef }> {
  return new Map((p.effects ?? []).map((fx) => [fx.name, { id: names.effects.get(fx.name), fx }]));
}

/** Initial values of an effect, in the order of ab::Effect and the simulator. */
export function effectFields(fx: EffectDef): number[] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.trunc(v) || 0));
  // Speeds are kept in 1/16 pixels per second in 16 bits.
  const sp = (v: number) => clamp(v, -2000, 2000);
  return [
    clamp(fx.color, 0, 2), clamp(fx.blink, 0, 100), clamp(fx.life[0], 0, 32767), clamp(fx.life[1], 0, 32767),
    clamp(fx.dir, -32768, 32767), clamp(fx.spread, 0, 360), sp(fx.speed[0]), sp(fx.speed[1]),
    clamp(fx.area[0], 0, 255), clamp(fx.area[1], 0, 255), sp(fx.accel[0]), sp(fx.accel[1]),
    clamp(fx.drag, 0, 100), clamp(fx.wobble, 0, 100),
  ];
}

/** Each built in song the program plays, with its constant name and ATMlib data. */
export function songs(p: Program): Map<string, { name: string; bytes: number[] }> {
  const out = new Map<string, { name: string; bytes: number[] }>();
  forEachExpr(p, (e) => {
    if (e.k === 'enum' && e.type === 'song' && e.v in SONGS && !out.has(e.v)) out.set(e.v, { name: `song_${e.v}`, bytes: songBytes(SONGS[e.v as SongName]) });
  });
  return out;
}

/** Each melody text in the program with its constant name and notes. */
export function melodies(p: Program): Map<string, { name: string; steps: number[]; bad: string[] }> {
  const out = new Map<string, { name: string; steps: number[]; bad: string[] }>();
  forEachExpr(p, (e) => {
    if (e.k === 'enum' && e.type === 'melody' && !out.has(e.v)) out.set(e.v, { name: `mel_${out.size}`, ...parseMelody(e.v) });
  });
  return out;
}
