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

export const SFX = ['jump', 'coin', 'hit', 'powerUp', 'explosion', 'win', 'lose', 'shoot'] as const;
export type SfxName = (typeof SFX)[number];

/** Frequency and duration pairs, same as the tables in ardublocks.h. */
export const SFX_STEPS: Record<SfxName, number[]> = {
  jump: [300, 20, 400, 20, 500, 20, 600, 20],
  coin: [988, 60, 1319, 120],
  hit: [220, 40, 180, 40, 140, 40, 100, 40],
  powerUp: [523, 60, 659, 60, 784, 60, 1047, 120],
  explosion: [400, 30, 300, 30, 220, 30, 160, 40, 110, 60, 70, 80],
  win: [523, 100, 659, 100, 784, 100, 1047, 300],
  lose: [392, 150, 330, 150, 262, 300],
  shoot: [1200, 20, 900, 20, 600, 20],
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
