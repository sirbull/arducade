import { and, arith, blk, call, cmp, func, get, hitting, ifThen, num, prop, set, setProp, workspace } from './dsl';
import type { TemplateSource } from './types';

const W = 64;
const H = 8;
const EMPTY = 0;
const GROUND = 1;
const COIN = 2;
const SPIKE = 3;
const FLAG = 4;
const ENEMY = 5;

function buildLevel(): number[] {
  const cells = Array<number>(W * H).fill(EMPTY);
  const put = (col: number, row: number, t: number) => (cells[row * W + col] = t);
  const pits = [18, 19, 37, 38, 39, 52, 53];
  for (let c = 0; c < W; c++) if (!pits.includes(c)) put(c, 7, GROUND);
  for (const [from, to, row] of [[10, 13, 4], [24, 27, 4], [30, 33, 3], [44, 47, 4]]) for (let c = from; c <= to; c++) put(c, row, GROUND);
  for (const c of [11, 12, 25, 26, 45, 46]) put(c, 3, COIN);
  for (const c of [31, 32]) put(c, 2, COIN);
  for (const c of [6, 7, 15, 22, 41, 57]) put(c, 6, COIN);
  for (const c of [34, 49]) put(c, 6, SPIKE);
  for (const c of [16, 28, 43, 59]) put(c, 6, ENEMY);
  put(55, 6, GROUND);
  put(62, 6, FLAG);
  return cells;
}

const respawn = () => call('respawn');
const tileEvent = (tile: string, body: unknown[], comment?: string) =>
  blk('ab_on_tile', {
    f: { SPRITE: { name: 'sprite' }, KIND: 'Player', TILE: tile, COL: { name: 'col' }, ROW: { name: 'row' } },
    body: body as never,
    comment,
  });

export const platformer: TemplateSource = {
  id: 'platformer',
  order: 1,
  title: { en: 'Platformer', nb: 'Plattformspill', es: 'Plataformas', fr: 'Plateformes', de: 'Jump and Run' },
  description: {
    en: 'Run, jump and collect coins. Reach the flag to win.',
    nb: 'Løp, hopp og samle mynter. Kom deg til flagget for å vinne.',
    es: 'Corre, salta y recoge monedas. Llega a la bandera para ganar.',
    fr: 'Cours, saute et ramasse des pièces. Atteins le drapeau pour gagner.',
    de: 'Lauf, spring und sammle Münzen. Erreiche die Flagge, um zu gewinnen.',
  },
  tips: [
    { en: 'Jump higher: change -160 in "on button A pressed".', nb: 'Hopp høyere: endre -160 i "når knapp A trykkes".', es: 'Salta más alto: cambia -160 en "al pulsar A".', fr: 'Saute plus haut : change -160 dans « quand A est pressé ».', de: 'Spring höher: ändere -160 in "wenn A gedrückt".' },
    { en: 'Draw your own level in the Tile map tab.', nb: 'Tegn ditt eget brett i fanen Tilekart.', es: 'Dibuja tu propio nivel en la pestaña Mapa.', fr: 'Dessine ton propre niveau dans l’onglet Carte.', de: 'Zeichne dein eigenes Level im Tab Karte.' },
    { en: 'Add more enemies: place the enemy tile in the map.', nb: 'Legg til flere fiender: sett fiende-ruten i kartet.', es: 'Añade más enemigos: coloca la casilla de enemigo en el mapa.', fr: "Ajoute des ennemis : place la case ennemi sur la carte.", de: 'Mehr Gegner: setze das Gegner-Feld in die Karte.' },
  ],
  strings: {
    en: {
      start: 'Load the level, create the hero and turn on gravity (ay). The camera follows the hero.',
      enemies: 'Put an enemy on every enemy tile and make them walk.',
      jump: 'Jump only when standing on the ground.',
      short: 'Let go of A early for a short jump.',
      walk: 'Enemies turn around when they walk into a wall.',
      fall: 'Falling down a hole costs a life.',
      coin: 'Take the coin away from the map and get a point.',
      stomp: 'Jump on an enemy to remove it. Walking into it costs a life.',
      respawn: 'Lose a life and start again from the beginning of the level.',
    },
    nb: {
      start: 'Last inn brettet, lag helten og slå på tyngdekraft (ay). Kameraet følger helten.',
      enemies: 'Sett en fiende på hver fiende-rute og få dem til å gå.',
      jump: 'Hopp bare når helten står på bakken.',
      short: 'Slipp A tidlig for et kort hopp.',
      walk: 'Fiender snur når de går inn i en vegg.',
      fall: 'Å falle ned i et hull koster et liv.',
      coin: 'Fjern mynten fra kartet og få et poeng.',
      stomp: 'Hopp på en fiende for å fjerne den. Går du inn i den, mister du et liv.',
      respawn: 'Mist et liv og start på nytt fra begynnelsen av brettet.',
    },
    es: {
      start: 'Carga el nivel, crea al héroe y activa la gravedad (ay). La cámara sigue al héroe.',
      enemies: 'Pon un enemigo en cada casilla de enemigo y haz que caminen.',
      jump: 'Salta solo cuando estés en el suelo.',
      short: 'Suelta A pronto para un salto corto.',
      walk: 'Los enemigos se dan la vuelta al chocar con una pared.',
      fall: 'Caer en un agujero cuesta una vida.',
      coin: 'Quita la moneda del mapa y gana un punto.',
      stomp: 'Salta sobre un enemigo para quitarlo. Si chocas con él pierdes una vida.',
      respawn: 'Pierde una vida y empieza de nuevo desde el principio del nivel.',
    },
    fr: {
      start: 'Charge le niveau, crée le héros et active la gravité (ay). La caméra suit le héros.',
      enemies: 'Place un ennemi sur chaque case ennemi et fais-les marcher.',
      jump: 'Saute seulement quand le héros est au sol.',
      short: 'Lâche A tôt pour un petit saut.',
      walk: 'Les ennemis font demi-tour quand ils touchent un mur.',
      fall: 'Tomber dans un trou coûte une vie.',
      coin: 'Enlève la pièce de la carte et gagne un point.',
      stomp: 'Saute sur un ennemi pour le retirer. Le toucher coûte une vie.',
      respawn: 'Perds une vie et recommence au début du niveau.',
    },
    de: {
      start: 'Lade das Level, erstelle den Helden und schalte die Schwerkraft (ay) ein. Die Kamera folgt dem Helden.',
      enemies: 'Setze einen Gegner auf jedes Gegner-Feld und lass sie laufen.',
      jump: 'Springe nur, wenn der Held auf dem Boden steht.',
      short: 'Lass A früh los für einen kurzen Sprung.',
      walk: 'Gegner drehen um, wenn sie gegen eine Wand laufen.',
      fall: 'In ein Loch zu fallen kostet ein Leben.',
      coin: 'Nimm die Münze von der Karte und bekomme einen Punkt.',
      stomp: 'Spring auf einen Gegner, um ihn zu entfernen. Wenn du hineinläufst, verlierst du ein Leben.',
      respawn: 'Verliere ein Leben und fang am Anfang des Levels neu an.',
    },
  },
  kinds: [],
  images: [
    {
      id: 'hero',
      name: 'hero',
      width: 8,
      height: 8,
      frames: [
        ['..111...', '..1.1...', '..111...', '.11111..', '1.111.1.', '..111...', '..1.1...', '.11.11..'],
        ['..111...', '..1.1...', '..111...', '.11111..', '1.111.1.', '..111...', '...1....', '..111...'],
      ],
    },
    {
      id: 'enemy',
      name: 'enemy',
      width: 8,
      height: 8,
      frames: [['........', '..1111..', '.111111.', '11.11.11', '11111111', '.111111.', '.1.11.1.', '1..11..1']],
    },
  ],
  tiles: [
    { id: 'ground', name: 'ground', solid: true, pixels: ['11111111', '1...1...', '1...1...', '11111111', '..1...1.', '..1...1.', '11111111', '1...1...'] },
    { id: 'coin', name: 'coin', solid: false, pixels: ['........', '..111...', '.1...1..', '.1.1.1..', '.1.1.1..', '.1...1..', '..111...', '........'] },
    { id: 'spike', name: 'spike', solid: false, pixels: ['........', '........', '...1....', '...1....', '..111...', '..111...', '.11111..', '11111111'] },
    { id: 'flag', name: 'flag', solid: false, pixels: ['.11111..', '.1111...', '.111....', '.1......', '.1......', '.1......', '.1......', '111.....'] },
    { id: 'enemyMarker', name: 'enemy start', solid: false, pixels: ['..1111..', '.1....1.', '1.1..1.1', '1......1', '1.1111.1', '.1....1.', '..1111..', '........'] },
  ],
  tilemaps: [{ id: 'level1', name: 'level1', width: W, height: H, cells: buildLevel() }],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        blk('ab_set_tilemap', { f: { MAP: 'level1' } }),
        set('hero', blk('ab_sprite_create', { f: { IMAGE: 'hero', KIND: 'Player' } })),
        blk('ab_place_on_tile', { i: { SPRITE: get('hero'), COL: num(2), ROW: num(5) } }),
        setProp('hero', 'ay', num(400)),
        blk('ab_move_sprite', { i: { SPRITE: get('hero'), VX: num(60), VY: num(0) } }),
        blk('ab_sprite_animate', { i: { SPRITE: get('hero'), MS: num(150) } }),
        blk('ab_camera_follow', { i: { SPRITE: get('hero') } }),
        blk('ab_spawn_on_tiles', { f: { TILE: 'enemyMarker', IMAGE: 'enemy', KIND: 'Enemy' }, comment: '@enemies' }),
        blk('ab_for_each_kind', {
          f: { VAR: { name: 'enemy' }, KIND: 'Enemy' },
          body: [setProp('enemy', 'vx', num(-20)), setProp('enemy', 'ay', num(400))],
        }),
        blk('ab_life_set', { i: { VALUE: num(3) } }),
        blk('ab_score_set', { i: { VALUE: num(0) } }),
      ],
    }),
    blk('ab_on_button', {
      f: { BUTTON: 'a', EVENT: 'pressed' },
      body: [ifThen(hitting('hero', 'bottom'), [setProp('hero', 'vy', num(-160)), blk('ab_play_effect', { f: { SFX: 'jump' } })], undefined, '@jump')],
    }),
    blk('ab_on_button', {
      f: { BUTTON: 'a', EVENT: 'released' },
      body: [ifThen(cmp('LT', prop('hero', 'vy'), num(0)), [setProp('hero', 'vy', arith('DIVIDE', prop('hero', 'vy'), num(2)))], undefined, '@short')],
    }),
    blk('ab_on_update', {
      body: [
        blk('ab_for_each_kind', {
          f: { VAR: { name: 'enemy' }, KIND: 'Enemy' },
          comment: '@walk',
          body: [
            ifThen(hitting('enemy', 'left'), [setProp('enemy', 'vx', num(20))]),
            ifThen(hitting('enemy', 'right'), [setProp('enemy', 'vx', num(-20))]),
          ],
        }),
        ifThen(cmp('GT', prop('hero', 'y'), num(72)), [respawn()], undefined, '@fall'),
      ],
    }),
    tileEvent(
      'coin',
      [
        blk('ab_set_tile', { f: { TILE: 'empty' }, i: { COL: get('col'), ROW: get('row') } }),
        blk('ab_score_change', { i: { VALUE: num(1) } }),
        blk('ab_play_effect', { f: { SFX: 'coin' } }),
      ],
      '@coin',
    ),
    tileEvent('spike', [respawn()]),
    tileEvent('flag', [blk('ab_game_over', { f: { WIN: 'win' } })]),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@stomp',
      body: [
        ifThen(
          and(cmp('GT', prop('sprite', 'vy'), num(0)), cmp('LT', prop('sprite', 'bottom'), prop('otherSprite', 'y'))),
          [
            blk('ab_sprite_destroy', { i: { SPRITE: get('otherSprite') } }),
            setProp('sprite', 'vy', num(-100)),
            blk('ab_score_change', { i: { VALUE: num(2) } }),
            blk('ab_play_effect', { f: { SFX: 'hit' } }),
          ],
          [respawn()],
        ),
      ],
    }),
    func(
      'respawn',
      [
        blk('ab_life_change', { i: { VALUE: num(-1) } }),
        blk('ab_play_effect', { f: { SFX: 'lose' } }),
        blk('ab_place_on_tile', { i: { SPRITE: get('hero'), COL: num(2), ROW: num(5) } }),
        setProp('hero', 'vy', num(0)),
      ],
      '@respawn',
    ),
  ]),
};
