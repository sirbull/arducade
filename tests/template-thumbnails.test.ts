// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import './helpers';
import { TEMPLATE_SOURCES, templateToProject } from '../src/templates';
import { thumbnailScreen } from '../src/ui/build';

const screen = (id: string) => thumbnailScreen(templateToProject(TEMPLATE_SOURCES.find((t) => t.id === id)!));
/** True when any pixel in the box is lit. */
const lit = (b: Uint8Array, x0: number, x1: number, y0: number, y1: number) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((b[(y >> 3) * 128 + x] >> (y & 7)) & 1) return true;
  return false;
};

describe('template gallery pictures', () => {
  it('pong shows both paddles below the HUD and the ball near the middle', async () => {
    const b = await screen('pong');
    expect(lit(b, 3, 5, 13, 54)).toBe(true);
    expect(lit(b, 3, 5, 8, 12)).toBe(false);
    expect(lit(b, 122, 124, 13, 54)).toBe(true);
    expect(lit(b, 122, 124, 8, 12)).toBe(false);
    expect(lit(b, 54, 84, 22, 42)).toBe(true);
  });

  it('space shooter shows enemies and a shot on its way', async () => {
    const b = await screen('shooter');
    expect(lit(b, 0, 127, 10, 30)).toBe(true);
    expect(lit(b, 60, 70, 32, 50)).toBe(true);
  });

  it('flying bird shows the bird alive between two pairs of pipes', async () => {
    const b = await screen('flappy');
    expect(lit(b, 26, 34, 30, 40)).toBe(true);
    expect(lit(b, 0, 24, 10, 20)).toBe(true);
    expect(lit(b, 70, 90, 10, 20)).toBe(true);
    expect(lit(b, 26, 34, 0, 26)).toBe(false);
  });

  it('frog crossing shows a filled home and all three lives left', async () => {
    const b = await screen('frogger');
    // The home tile in bay column 9 is filled; bay column 2 is still empty.
    expect(lit(b, 73, 75, 13, 13)).toBe(true);
    expect(lit(b, 17, 19, 13, 13)).toBe(false);
    expect(lit(b, 15, 19, 1, 5)).toBe(true);
  });
});

it('resolves template display text and keeps the runner thumbnail script without mutating the source', async () => {
  const { instantiateTemplate } = await import('../src/project/model');
  const project = templateToProject(TEMPLATE_SOURCES.find(t => t.id === 'endlessrunner')!);
  const blocks = JSON.stringify(project.blocks);
  const localized = instantiateTemplate(project, 'en');
  localized.template!.thumbnail = project.template!.thumbnail;
  const raw = await thumbnailScreen(project);
  const translated = await thumbnailScreen(localized);
  expect(raw).toEqual(translated);
  expect(raw.some(byte => byte !== 0)).toBe(true);
  // The gallery must show the splash artwork rather than tapping A to start.
  const title = project.images.find(image => image.id === 'titleScreen')!.frames[0];
  for (let y = 0; y < 55; y++) for (let x = 0; x < 128; x++) {
    expect((raw[(y >> 3) * 128 + x] >> (y & 7)) & 1).toBe(Number(title[y][x]));
  }
  expect(JSON.stringify(project.blocks)).toBe(blocks);
});
