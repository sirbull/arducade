import { BUILTIN_PROFILES, DEFAULT_PROFILE_ID } from '../hw/profile';
import { PROJECT_VERSION, type Project } from '../project/model';
import { blk, workspace } from './dsl';
import { match3 } from './match3';
import { bricks } from './bricks';
import { flappy } from './flappy';
import { maze3d } from './maze3d';
import { platformer } from './platformer';
import { pong } from './pong';
import { shooter } from './shooter';
import type { TemplateSource } from './types';

const empty: TemplateSource = {
  id: 'empty',
  order: 0,
  title: { en: 'Empty project', nb: 'Tomt prosjekt', es: 'Proyecto vacío', fr: 'Projet vide', de: 'Leeres Projekt' },
  description: {
    en: 'Start from scratch.',
    nb: 'Start helt fra begynnelsen.',
    es: 'Empieza desde cero.',
    fr: 'Commence de zéro.',
    de: 'Fang ganz von vorne an.',
  },
  tips: [],
  strings: {},
  kinds: [],
  images: [
    { id: 'player', name: 'player', width: 8, height: 8, frames: [['..1111..', '.111111.', '11.11.11', '11111111', '11111111', '1.1111.1', '.1....1.', '11....11']] },
  ],
  tiles: [],
  tilemaps: [],
  blocks: workspace([blk('ab_on_start'), blk('ab_on_update')]),
};

export const TEMPLATE_SOURCES: TemplateSource[] = [empty, platformer, pong, shooter, maze3d, bricks, flappy, match3].sort((a, b) => a.order - b.order);

export function templateToProject(t: TemplateSource): Project {
  return {
    format: 'ardublocks-project',
    version: PROJECT_VERSION,
    id: `template-${t.id}`,
    name: t.title.en,
    created: 0,
    modified: 0,
    profile: BUILTIN_PROFILES.find((p) => p.id === DEFAULT_PROFILE_ID)!,
    blocks: t.blocks,
    images: t.images,
    tiles: t.tiles,
    tilemaps: t.tilemaps,
    kinds: t.kinds,
    template: { id: t.id, title: t.title, description: t.description, tips: t.tips, strings: t.strings, thumbnail: t.thumbnail },
  };
}
