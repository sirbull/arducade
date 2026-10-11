// Constants shared by the simulator engine and the code generators. The
// numbers must match the enums in core/ardublocks/ardublocks.h.

export const BUTTON_IDS = ['up', 'down', 'left', 'right', 'a', 'b'] as const;
export type ButtonName = (typeof BUTTON_IDS)[number];

export const BUILTIN_KINDS = ['Player', 'Enemy', 'Projectile', 'Food'] as const;

export const FLAGS = {
  stayInScreen: 1,
  bounceOnWall: 2,
  ghost: 4,
  autoDestroy: 8,
  invisible: 16,
  destroyOnWall: 32,
  stayInMap: 64,
} as const;
export type FlagName = keyof typeof FLAGS;

export const PROPS = ['x', 'y', 'vx', 'vy', 'ax', 'ay', 'width', 'height', 'left', 'right', 'top', 'bottom'] as const;
export type PropName = (typeof PROPS)[number];

export const HIT = { left: 1, right: 2, top: 4, bottom: 8 } as const;
export type DirName = keyof typeof HIT;

// New effects go at the end, so the numbers of the old ones stay the same.
export const SFX = [
  'jump', 'coin', 'hit', 'powerUp', 'explosion', 'win', 'lose', 'shoot',
  'step', 'land', 'dash', 'bounce', 'gem', 'key', 'extraLife', 'heal', 'laser', 'hurt',
  'defeat', 'shield', 'bomb', 'blip', 'select', 'back', 'error', 'door', 'teleport', 'alarm',
] as const;
export type SfxName = (typeof SFX)[number];

/** The effects in the order of the block menu, grouped by what they are for. */
export const SFX_MENU: SfxName[] = [
  'jump', 'step', 'land', 'dash', 'bounce', // moving
  'coin', 'gem', 'key', 'powerUp', 'extraLife', 'heal', // collecting
  'shoot', 'laser', 'hit', 'hurt', 'defeat', 'shield', 'bomb', 'explosion', // fighting
  'blip', 'select', 'back', 'error', // menus
  'door', 'teleport', 'alarm', 'win', 'lose', // events
];

/**
 * Frequency and duration pairs. The device gets a table for each effect the
 * game uses; win and lose are always in ardublocks.h for the game over screen.
 * Steps change once per frame, so a step lasts at least 33 ms.
 */
export const SFX_STEPS: Record<SfxName, number[]> = {
  jump: [300, 20, 400, 20, 500, 20, 600, 20],
  coin: [988, 60, 1319, 120],
  hit: [220, 40, 180, 40, 140, 40, 100, 40],
  powerUp: [523, 60, 659, 60, 784, 60, 1047, 120],
  explosion: [400, 30, 300, 30, 220, 30, 160, 40, 110, 60, 70, 80],
  win: [523, 100, 659, 100, 784, 100, 1047, 300],
  lose: [392, 150, 330, 150, 262, 300],
  shoot: [1200, 20, 900, 20, 600, 20],
  step: [180, 33],
  land: [220, 33, 110, 33],
  dash: [400, 33, 700, 33, 1000, 33, 800, 33],
  bounce: [200, 33, 300, 33, 450, 33, 600, 33, 800, 66],
  gem: [1568, 33, 2093, 33, 2637, 66],
  key: [784, 66, 988, 66, 1175, 66, 1568, 133],
  extraLife: [523, 66, 659, 66, 784, 66, 1047, 66, 784, 66, 1047, 200],
  heal: [523, 100, 659, 100, 784, 100, 1047, 166],
  laser: [2400, 33, 1900, 33, 1500, 33, 1200, 33, 950, 33],
  hurt: [300, 33, 200, 33, 300, 33, 150, 66],
  defeat: [800, 33, 1200, 33, 400, 66],
  shield: [880, 33, 0, 33, 880, 33, 0, 33, 880, 66],
  bomb: [1500, 66, 1350, 66, 1200, 66, 1050, 66, 900, 66, 750, 66, 600, 66],
  blip: [1000, 33],
  select: [784, 33, 1175, 66],
  back: [1175, 33, 784, 66],
  error: [180, 100, 0, 33, 180, 133],
  door: [150, 66, 200, 66, 150, 100],
  teleport: [300, 33, 600, 33, 1200, 33, 2400, 33, 1200, 33, 600, 33, 300, 33],
  alarm: [880, 133, 660, 133, 880, 133, 660, 133],
};

export const COLORS = { white: 1, black: 0, invert: 2 } as const;
export type ColorName = keyof typeof COLORS;

export const FRAME_MS = 33;
export const FPS = 30;
export const SCREEN_W = 128;
export const SCREEN_H = 64;
export const NONE = 0xff;
export const STORAGE_SLOTS = 32;

/** Index of a kind: built in kinds first, then the kinds of the project. */
export function kindIndex(name: string, userKinds: string[]): number {
  const b = (BUILTIN_KINDS as readonly string[]).indexOf(name);
  if (b >= 0) return b;
  const u = userKinds.indexOf(name);
  return u >= 0 ? BUILTIN_KINDS.length + u : 0;
}
