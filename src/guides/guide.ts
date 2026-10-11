// Guides: levels that take the user step by step through making a game.
// Each step has checks; the user can only go on when all checks pass.

import type { Profile } from '../hw/profile';
import type { Engine } from '../sim/engine';
import { LIBRARY_IMAGES } from '../project/library';
import { localized, newProject, type LocalizedText, type Project, type TileAsset, type TilemapAsset } from '../project/model';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** What the checks look at. */
export interface GuideContext {
  /** The workspace as saved by Blockly.serialization.workspaces.save. */
  blocks: Json;
  project: Project;
  /** Times the game was started since the step was opened. */
  played: number;
  /** Buttons pressed while the game ran since the step was opened, one bit per button. */
  pressed: number;
  /** Results for the current code, indexed by the step's checks. */
  runtime?: boolean[];
}

export interface Check {
  text: LocalizedText;
  ok: (c: GuideContext) => boolean;
  /** A deterministic test of the user's game, in an isolated simulator. */
  run?: (engine: Engine, frame: (buttons?: number, count?: number) => Promise<void>) => Promise<boolean>;
}

export interface GuideStep {
  text: LocalizedText;
  /** Explicit setup for new sprites, variables and functions in this step. */
  setup?: LocalizedText[];
  /** Top blocks shown as a picture of what to build in this step. */
  show?: Json[];
  /** The whole workspace after this step, shown under Help. */
  solution: Json;
  checks: Check[];
  hint?: LocalizedText;
}

export interface Guide {
  id: string;
  /** Shown on the level card, like "1-1". */
  number: string;
  title: LocalizedText;
  description: LocalizedText;
  /** Library sprites the level starts with. */
  images: string[];
  /** Workspace the level starts with. */
  start: Json;
  tiles?: TileAsset[];
  tilemaps?: TilemapAsset[];
  kinds?: string[];
  chapters?: { title: LocalizedText; start: number }[];
  steps: GuideStep[];
  bonus?: Check;
}

/** Where the user is in a guide. Stored in the project. */
export interface GuideState {
  id: string;
  /** Step index; steps.length means the bonus / finish page. */
  step: number;
  done?: boolean;
  /** Furthest unlocked step; going back does not lock completed chapters. */
  reached?: number;
}

// Block patterns -------------------------------------------------------------

export interface Range {
  min?: number;
  max?: number;
}

/** Matches a block in Blockly's JSON. Extra fields, inputs and blocks are allowed. */
export interface Pattern {
  type: string;
  fields?: Record<string, string | Range>;
  inputs?: Record<string, Pattern>;
  /** Blocks somewhere inside this block, in any order. */
  contains?: Pattern[];
}

const enabled = (b: Json) => b.enabled !== false && !(b.disabledReasons?.length > 0);

function children(b: Json): Json[] {
  const out: Json[] = [];
  for (const input of Object.values<Json>(b.inputs ?? {})) {
    const child = input.block ?? input.shadow;
    if (child) out.push(child);
  }
  if (b.next?.block) out.push(b.next.block);
  return out;
}

function descendants(b: Json): Json[] {
  return children(b).flatMap((c) => [c, ...descendants(c)]);
}

export function matches(b: Json, p: Pattern): boolean {
  if (b.type !== p.type || !enabled(b)) return false;
  for (const [k, want] of Object.entries(p.fields ?? {})) {
    const have = b.fields?.[k];
    if (typeof want === 'object') {
      const n = Number(have);
      if (!Number.isFinite(n) || n < (want.min ?? -Infinity) || n > (want.max ?? Infinity)) return false;
    } else if (String(have) !== want) return false;
  }
  for (const [k, want] of Object.entries(p.inputs ?? {})) {
    const input = b.inputs?.[k];
    const child = input?.block ?? input?.shadow;
    if (!child || !matches(child, want)) return false;
  }
  const inside = p.contains?.length ? descendants(b) : [];
  return (p.contains ?? []).every((want) => inside.some((d) => matches(d, want)));
}

/** True when a top block (an event) matches. Loose blocks are disabled and never match. */
export function hasTop(blocks: Json, p: Pattern): boolean {
  return (blocks.blocks?.blocks ?? []).some((b: Json) => matches(b, p));
}

export const numIn = (min?: number, max?: number): Pattern => ({ type: 'math_number', fields: { NUM: { min, max } } });

/** Enabled blocks of one type inside the events on the workspace. */
export function blocksOfType(blocks: Json, type: string): Json[] {
  return (blocks.blocks?.blocks ?? []).filter(enabled).flatMap((b: Json) => [b, ...descendants(b)]).filter((b: Json) => b.type === type && enabled(b));
}

/** Match the cumulative build, including order, nesting and consistent variable
 * references. Variable names may differ from the example, but distinct example
 * variables must remain distinct. Blockly saves references as either names or IDs. */
export function matchesSolution(blocks: Json, solution: Json, flexibleNumbers = false): boolean {
  type Bindings = Map<string, string>;
  const variable = (value: any): string => {
    if (typeof value === 'object' && value.name) return value.name;
    const id = typeof value === 'object' ? value.id : value;
    return blocks.variables?.find((v: Json) => v.id === id)?.name ?? String(id);
  };
  const bind = (bindings: Bindings, want: string, have: string): boolean => {
    if (bindings.has(want)) return bindings.get(want) === have;
    if ([...bindings.values()].includes(have)) return false;
    bindings.set(want, have);
    return true;
  };
  const sequence = (have: Json | undefined, want: Json | undefined, bindings: Bindings): Bindings | undefined => {
    if (!want) return bindings;
    for (let b = have; b; b = b.next?.block) {
      const matched = block(b, want, bindings);
      if (matched) {
        const rest = sequence(b.next?.block, want.next?.block, matched);
        if (rest) return rest;
      }
    }
    return undefined;
  };
  const block = (have: Json, want: Json, bindings: Bindings): Bindings | undefined => {
    if (have.type !== want.type || !enabled(have)) return undefined;
    let next = new Map(bindings);
    for (const [key, value] of Object.entries<any>(want.fields ?? {})) {
      if (flexibleNumbers && want.type === 'math_number' && key === 'NUM') continue;
      if (typeof value === 'object') {
        if (have.fields?.[key] == null || !bind(next, value.name, variable(have.fields[key]))) return undefined;
      } else if (String(have.fields?.[key]) !== String(value)) return undefined;
    }
    if (want.extraState?.name && have.extraState?.name !== want.extraState.name) return undefined;
    const params = want.extraState?.params;
    if (params) {
      if (have.extraState?.params?.length !== params.length) return undefined;
      for (let i = 0; i < params.length; i++) {
        const name = (p: any) => typeof p === 'string' ? p : p.name;
        if (!bind(next, name(params[i]), name(have.extraState.params[i]))) return undefined;
      }
    }
    for (const [key, input] of Object.entries<Json>(want.inputs ?? {})) {
      const child = input.block ?? input.shadow;
      const actual = have.inputs?.[key]?.block ?? have.inputs?.[key]?.shadow;
      if (!child || !actual) return undefined;
      const result = /^(DO\d*|ELSE|STACK)$/.test(key) ? sequence(actual, child, next) : block(actual, child, next);
      if (!result) return undefined;
      next = result;
    }
    return next;
  };
  const have: Json[] = blocks.blocks?.blocks ?? [];
  const want: Json[] = solution.blocks?.blocks ?? [];
  const tops = (index: number, used: Set<number>, bindings: Bindings): boolean => {
    if (index === want.length) return true;
    return have.some((b, i) => {
      if (used.has(i)) return false;
      const matched = block(b, want[index], bindings);
      return !!matched && tops(index + 1, new Set([...used, i]), matched);
    });
  };
  return tops(0, new Set(), new Map());
}

// Projects -------------------------------------------------------------------

export function guideProject(g: Guide, lang: string, profile?: Profile): Project {
  const p = newProject(`${g.number} ${localized(g.title, lang)}`, profile);
  p.images = g.images.map((id) => {
    const im = LIBRARY_IMAGES.find((x) => x.id === id)!;
    return { id: im.id, name: localized(im.name, lang), width: im.width, height: im.height, frames: im.frames.map((f) => [...f]) };
  });
  p.blocks = JSON.parse(JSON.stringify(g.start));
  p.tiles = structuredClone(g.tiles ?? []);
  p.tilemaps = structuredClone(g.tilemaps ?? []);
  p.kinds = [...g.kinds ?? []];
  p.guide = { id: g.id, step: 0 };
  return p;
}

/** Index of each check that passes. */
export function passing(checks: Check[], c: GuideContext): boolean[] {
  return checks.map((ch, i) => {
    try {
      return ch.ok(c) && (!ch.run || c.runtime?.[i] === true);
    } catch {
      return false;
    }
  });
}
