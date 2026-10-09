import { and, arith, blk, bool, call, cmp, forKind, forRange, func, get, ifThen, not, num, prop, set, setProp, workspace } from './dsl';
import type { TemplateSource } from './types';

// Tile numbers in the map: 1 hedge, 2 bay, 3 home, 4 water, 5 grass, 6 lane line.
const BAYS = [2, 6, 9, 13];
const ROWS = [
  Array<number>(16).fill(0),
  Array.from({ length: 16 }, (_, c) => (BAYS.includes(c) ? 2 : 1)),
  Array<number>(16).fill(4),
  Array<number>(16).fill(4),
  Array<number>(16).fill(5),
  Array<number>(16).fill(0),
  Array<number>(16).fill(6),
  Array<number>(16).fill(5),
];
const START_X = 60;
const START_Y = 60;

const sfx = (name: string) => blk('ab_play_effect', { f: { SFX: name } });
const changeProp = (sprite: string, p: string, by: number) => blk('ab_sprite_change_prop', { f: { PROP: p }, i: { SPRITE: get(sprite), VALUE: num(by) } });
const hop = (button: string, p: string, by: number) =>
  blk('ab_on_button', { f: { BUTTON: button, EVENT: 'pressed' }, body: [changeProp('frog', p, by), sfx('jump')] });
/** count sprites spread over the 160 pixel wide loop, all moving the same way. */
const lane = (image: string, kind: string, count: number, offset: number, y: number, vx: number) =>
  forRange('i', num(0), num(count - 1), [
    set('thing', blk('ab_sprite_create', { f: { IMAGE: image, KIND: kind } })),
    blk('ab_sprite_set_position', { i: { SPRITE: get('thing'), X: arith('ADD', arith('MULTIPLY', get('i'), num(Math.floor(160 / count))), num(offset)), Y: num(y) } }),
    blk('ab_sprite_set_velocity', { i: { SPRITE: get('thing'), VX: num(vx), VY: num(0) } }),
  ]);
/** A log with bark lines, black inside so the water does not show through. */
const log = (w: number) => {
  const edge = '.' + '1'.repeat(w - 2) + '.';
  const bark = (shift: number) => '1' + Array.from({ length: w - 2 }, (_, x) => ((x + shift) % 9 < 3 ? '1' : '0')).join('') + '1';
  const plain = '1' + '0'.repeat(w - 2) + '1';
  return [edge, plain, bark(0), plain, bark(5), plain, edge];
};

export const frogger: TemplateSource = {
  id: 'frogger',
  order: 8,
  // Hops across the road and rides two logs; the frog is on a log in the river.
  thumbnail: { frames: 112, taps: { up: [2, 12, 14, 16, 52, 76, 78, 80, 82, 102] } },
  title: { en: 'Frog crossing', nb: 'Froskehopp', es: 'Rana cruzando', fr: 'Grenouille traversière', de: 'Froschsprung' },
  description: {
    en: 'Hop across the road and ride the logs over the river. Fill all four homes at the top to win.',
    nb: 'Hopp over veien og ri på stokkene over elva. Fyll alle fire hjemmene øverst for å vinne.',
    es: 'Salta por la carretera y viaja en los troncos por el río. Llena las cuatro casas de arriba para ganar.',
    fr: 'Saute à travers la route et monte sur les troncs pour traverser la rivière. Remplis les quatre maisons en haut pour gagner.',
    de: 'Hüpf über die Straße und reite auf den Baumstämmen über den Fluss. Füll alle vier Häuser oben, um zu gewinnen.',
  },
  tips: [
    { en: 'Make the cars faster: change -24 and 14 in "on start".', nb: 'Gjør bilene raskere: endre -24 og 14 i "ved start".', es: 'Haz los coches más rápidos: cambia -24 y 14 en "al empezar".', fr: 'Rends les voitures plus rapides : change -24 et 14 dans « au démarrage ».', de: 'Mach die Autos schneller: ändere -24 und 14 in "beim Start".' },
    { en: 'Draw new tiles for the river and the road in the Tiles tab.', nb: 'Tegn nye fliser for elva og veien i fanen Fliser.', es: 'Dibuja nuevas baldosas para el río y la carretera en la pestaña Baldosas.', fr: 'Dessine de nouvelles tuiles pour la rivière et la route dans l’onglet Tuiles.', de: 'Zeichne neue Kacheln für den Fluss und die Straße im Tab Kacheln.' },
    { en: 'Give a point for every hop up.', nb: 'Gi et poeng for hvert hopp oppover.', es: 'Da un punto por cada salto hacia arriba.', fr: 'Donne un point pour chaque saut vers le haut.', de: 'Gib einen Punkt für jeden Sprung nach oben.' },
  ],
  strings: {
    en: {
      start: 'Draw the map, put the frog at the bottom and fill the lanes with logs and cars.',
      wrap: 'A log or car that drives off one side comes back on the other.',
      ride: 'When the frog sits on a log, it moves along with the log.',
      water: 'In the river (between y 16 and 32) the frog drowns if it is not on a log.',
      home: 'At the top the frog must land in an empty home. All four homes filled wins the game.',
      die: 'The frog loses a life and starts again at the bottom.',
      crash: 'A car hits the frog.',
    },
    nb: {
      start: 'Tegn kartet, sett frosken nederst og fyll filene med stokker og biler.',
      wrap: 'En stokk eller bil som kjører ut på den ene siden, kommer inn igjen på den andre.',
      ride: 'Når frosken sitter på en stokk, flytter den seg sammen med stokken.',
      water: 'I elva (mellom y 16 og 32) drukner frosken hvis den ikke er på en stokk.',
      home: 'Øverst må frosken lande i et tomt hjem. Fyller du alle fire hjemmene, vinner du.',
      die: 'Frosken mister et liv og starter nederst igjen.',
      crash: 'En bil treffer frosken.',
    },
    es: {
      start: 'Dibuja el mapa, pon la rana abajo y llena los carriles con troncos y coches.',
      wrap: 'Un tronco o coche que sale por un lado vuelve a entrar por el otro.',
      ride: 'Cuando la rana está sobre un tronco, se mueve con el tronco.',
      water: 'En el río (entre y 16 y 32) la rana se ahoga si no está sobre un tronco.',
      home: 'Arriba la rana tiene que caer en una casa vacía. Si llenas las cuatro casas, ganas.',
      die: 'La rana pierde una vida y empieza otra vez abajo.',
      crash: 'Un coche atropella a la rana.',
    },
    fr: {
      start: 'Dessine la carte, place la grenouille en bas et remplis les voies de troncs et de voitures.',
      wrap: 'Un tronc ou une voiture qui sort d’un côté revient de l’autre.',
      ride: 'Quand la grenouille est sur un tronc, elle se déplace avec lui.',
      water: 'Dans la rivière (entre y 16 et 32), la grenouille se noie si elle n’est pas sur un tronc.',
      home: 'En haut, la grenouille doit atterrir dans une maison vide. Remplis les quatre maisons pour gagner.',
      die: 'La grenouille perd une vie et recommence en bas.',
      crash: 'Une voiture touche la grenouille.',
    },
    de: {
      start: 'Zeichne die Karte, setz den Frosch nach unten und füll die Spuren mit Stämmen und Autos.',
      wrap: 'Ein Stamm oder Auto, das auf einer Seite hinausfährt, kommt auf der anderen wieder herein.',
      ride: 'Wenn der Frosch auf einem Stamm sitzt, bewegt er sich mit dem Stamm.',
      water: 'Im Fluss (zwischen y 16 und 32) ertrinkt der Frosch, wenn er nicht auf einem Stamm ist.',
      home: 'Oben muss der Frosch in einem leeren Haus landen. Sind alle vier Häuser voll, gewinnst du.',
      die: 'Der Frosch verliert ein Leben und fängt unten wieder an.',
      crash: 'Ein Auto trifft den Frosch.',
    },
  },
  kinds: ['Log'],
  images: [
    { id: 'frog', name: 'frog', width: 7, height: 7, frames: [['1100011', '0111110', '1101011', '0111110', '1111111', '0111110', '1100011']] },
    { id: 'car', name: 'car', width: 10, height: 7, frames: [['.11000110.', '1111111111', '1100100011', '1100100001', '1100100011', '1111111111', '.11000110.']] },
    { id: 'truck', name: 'truck', width: 16, height: 7, frames: [['.11..11....11...', '1111111111111110', '1000000001100011', '1000000001100011', '1000000001100011', '1111111111111110', '.11..11....11...']] },
    { id: 'logLong', name: 'long log', width: 32, height: 7, frames: [log(32)] },
    { id: 'log', name: 'log', width: 24, height: 7, frames: [log(24)] },
  ],
  tiles: [
    { id: 'hedge', name: 'hedge', solid: false, pixels: ['11111111', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '11111111'] },
    { id: 'bay', name: 'bay', solid: false, pixels: ['11111111', '........', '........', '.11.....', '1..1..1.', '....11..', '........', '........'] },
    { id: 'home', name: 'home', solid: false, pixels: ['11111111', '.11...11', '..11111.', '.11.1.11', '..11111.', '.1111111', '..11111.', '.11...11'] },
    { id: 'water', name: 'water', solid: false, pixels: ['........', '.11.....', '1..1..1.', '....11..', '........', '........', '........', '........'] },
    { id: 'grass', name: 'grass', solid: false, pixels: ['11111111', '........', '..1.....', '........', '......1.', '........', '........', '11111111'] },
    { id: 'lane', name: 'lane line', solid: false, pixels: ['.1111...', '........', '........', '........', '........', '........', '........', '........'] },
  ],
  tilemaps: [{ id: 'river', name: 'river', width: 16, height: 8, cells: ROWS.flat() }],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        blk('ab_set_tilemap', { f: { MAP: 'river' } }),
        set('frog', blk('ab_sprite_create', { f: { IMAGE: 'frog', KIND: 'Player' } })),
        blk('ab_sprite_set_position', { i: { SPRITE: get('frog'), X: num(START_X), Y: num(START_Y) } }),
        blk('ab_sprite_set_flag', { f: { FLAG: 'stayInScreen', ON: 'on' }, i: { SPRITE: get('frog') } }),
        lane('logLong', 'Log', 2, 0, 20, 12),
        lane('log', 'Log', 3, 30, 28, -18),
        lane('car', 'Enemy', 3, 10, 44, -24),
        lane('truck', 'Enemy', 2, 40, 52, 14),
        set('homes', num(0)),
        blk('ab_life_set', { i: { VALUE: num(3) } }),
        blk('ab_score_set', { i: { VALUE: num(0) } }),
      ],
    }),
    hop('up', 'y', -8),
    hop('down', 'y', 8),
    hop('left', 'x', -8),
    hop('right', 'x', 8),
    blk('ab_on_update', {
      body: [
        set('onLog', bool(false)),
        setProp('frog', 'vx', num(0)),
        forKind('thing', 'Enemy', [call('wrap')]),
        forKind(
          'thing',
          'Log',
          [
            call('wrap'),
            ifThen(blk('ab_sprite_overlaps', { i: { A: get('frog'), B: get('thing') } }), [set('onLog', bool(true)), setProp('frog', 'vx', prop('thing', 'vx'))]),
          ],
          '@ride',
        ),
        ifThen(and(and(cmp('GT', prop('frog', 'y'), num(16)), cmp('LT', prop('frog', 'y'), num(32))), not(get('onLog'))), [call('die')], undefined, '@water'),
        ifThen(
          cmp('LT', prop('frog', 'y'), num(16)),
          [
            set('col', arith('DIVIDE', prop('frog', 'x'), num(8))),
            ifThen(
              blk('ab_tile_is', { f: { TILE: 'bay' }, i: { COL: get('col'), ROW: num(1) } }),
              [
                blk('ab_set_tile', { f: { TILE: 'home' }, i: { COL: get('col'), ROW: num(1) } }),
                blk('ab_score_change', { i: { VALUE: num(10) } }),
                sfx('coin'),
                set('homes', arith('ADD', get('homes'), num(1))),
                blk('ab_sprite_set_position', { i: { SPRITE: get('frog'), X: num(START_X), Y: num(START_Y) } }),
                ifThen(cmp('EQ', get('homes'), num(BAYS.length)), [blk('ab_game_over', { f: { WIN: 'win' } })]),
              ],
              [call('die')],
            ),
          ],
          undefined,
          '@home',
        ),
      ],
    }),
    func(
      'wrap',
      [
        ifThen(cmp('GT', prop('thing', 'x'), num(143)), [changeProp('thing', 'x', -160)]),
        ifThen(cmp('LT', prop('thing', 'x'), num(-16)), [changeProp('thing', 'x', 160)]),
      ],
      '@wrap',
    ),
    func(
      'die',
      [
        sfx('hit'),
        blk('ab_sprite_set_position', { i: { SPRITE: get('frog'), X: num(START_X), Y: num(START_Y) } }),
        setProp('frog', 'vx', num(0)),
        blk('ab_life_change', { i: { VALUE: num(-1) } }),
      ],
      '@die',
    ),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@crash',
      body: [call('die')],
    }),
  ]),
};
