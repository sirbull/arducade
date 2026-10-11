import * as Blockly from 'blockly/core';
import { expect, it } from 'vitest';
import './helpers';
import { favouriteKey, normalizeFavourites, toggleFavourite } from '../src/project/favourites';
import { bindFavourites, favouritesFlyout } from '../src/blocks/favourites';
import { buildToolbox } from '../src/blocks/toolbox';
import { newProject, parseProject, serializeProject, upgradeProject } from '../src/project/model';
import { embedProject, readCartridge } from '../src/project/cartridge';

it('keeps variants separate, ignores transient IDs and toggles without duplicates', () => {
  const a = { category: 'ab_logic', block: { type: 'controls_if', kind: 'block' } };
  const b = { ...a, block: { ...a.block, extraState: { hasElse: true } } };
  expect(favouriteKey({ ...a, block: { ...a.block, id: 'temporary', enabled: true } })).toBe(favouriteKey(a));
  expect(toggleFavourite(toggleFavourite([], a), b)).toHaveLength(2);
  expect(toggleFavourite(toggleFavourite([], a), a)).toEqual([]);
  expect(normalizeFavourites([null, {}, a, a, b])).toEqual([a, b]);
});

it('orders groups and recipes by the original toolbox, regardless of starring order', () => {
  const project = newProject('Favourites');
  const categories = buildToolbox().contents as Record<string, any>[];
  const game = categories.find(c => c.categorystyle === 'ab_game')!;
  const sprites = categories.find(c => c.categorystyle === 'ab_sprites')!;
  project.favouriteBlocks = normalizeFavourites([
    { category: 'ab_sprites', block: sprites.contents[7] },
    { category: 'ab_game', block: { ...game.contents[2], enabled: true } },
    { category: 'ab_game', block: game.contents[0] },
  ]);
  const ws = new Blockly.Workspace() as unknown as Blockly.WorkspaceSvg;
  const callbacks = new Map();
  ws.registerToolboxCategoryCallback = (key, callback) => { callbacks.set(key, callback); };
  ws.getToolboxCategoryCallback = key => callbacks.get(key);
  bindFavourites(ws, () => project, () => {});
  const list = favouritesFlyout(ws) as unknown as Record<string, any>[];
  expect(list.filter(item => item.kind === 'label').map(item => item.text)).toEqual(['Game', 'Sprites']);
  expect(list.filter(item => item.kind === 'block').map(item => item.type)).toEqual(['ab_on_start', 'ab_on_every', 'ab_sprite_say_for']);
  ws.dispose();
});

it('upgrades old projects and round trips favourites independently through PNG cartridges', () => {
  const project = newProject('My game');
  project.favouriteBlocks = [{ category: 'ab_game', block: { kind: 'block', type: 'ab_on_start' } }];
  const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  const restored = readCartridge(embedProject(png, project));
  expect(restored.favouriteBlocks).toEqual(project.favouriteBlocks);
  expect(parseProject(serializeProject(restored)).favouriteBlocks).toEqual(project.favouriteBlocks);
  expect(upgradeProject({ ...newProject('Old'), version: 2 }).favouriteBlocks).toEqual([]);
  expect(newProject('Other').favouriteBlocks ?? []).toEqual([]);
  expect(restored.blocks).toEqual(project.blocks);
});
