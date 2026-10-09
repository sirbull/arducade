import { arith, blk, flag, get, ifThen, not, num, set, setProp, workspace } from './dsl';
import type { TemplateSource } from './types';

const GAP = 24;
const PIPE_H = 40;
const sfx = (name: string) => blk('ab_play_effect', { f: { SFX: name } });
const at = (sprite: string, x: number, y: unknown) => blk('ab_sprite_set_position', { i: { SPRITE: get(sprite), X: num(x), Y: y as never } });
const slide = (sprite: string) => blk('ab_sprite_set_velocity', { i: { SPRITE: get(sprite), VX: num(-40), VY: num(0) } });
const pipe = (rimTop: boolean) => {
  const body = Array<string>(PIPE_H - 3).fill('.1....1.');
  const rim = ['11111111', '1......1', '11111111'];
  return rimTop ? [...rim, ...body] : [...body, ...rim];
};

export const flappy: TemplateSource = {
  id: 'flappy',
  order: 6,
  title: { en: 'Flying bird', nb: 'Flaksefugl', es: 'Pájaro aleteador', fr: 'Oiseau battant', de: 'Flatter-Vogel' },
  description: {
    en: 'Press A to flap and fly between the pipes. Each gap you pass gives a point.',
    nb: 'Trykk A for å flakse og fly mellom rørene. Hver åpning du kommer gjennom gir et poeng.',
    es: 'Pulsa A para aletear y vuela entre las tuberías. Cada hueco que pasas da un punto.',
    fr: 'Appuie sur A pour battre des ailes et vole entre les tuyaux. Chaque passage donne un point.',
    de: 'Drück A zum Flattern und flieg zwischen den Rohren durch. Jede Lücke gibt einen Punkt.',
  },
  tips: [
    { en: 'Make the game easier: make the gap bigger than 24.', nb: 'Gjør spillet lettere: gjør åpningen større enn 24.', es: 'Haz el juego más fácil: haz el hueco mayor que 24.', fr: 'Rends le jeu plus facile : agrandis le passage au-delà de 24.', de: 'Mach das Spiel leichter: mach die Lücke größer als 24.' },
    { en: 'Change gravity: change 400 in "on A pressed".', nb: 'Endre tyngdekraften: endre 400 i "når A trykkes".', es: 'Cambia la gravedad: cambia 400 en "al pulsar A".', fr: 'Change la gravité : change 400 dans « quand A est pressé ».', de: 'Ändere die Schwerkraft: ändere 400 in "wenn A gedrückt".' },
    { en: 'Draw your own bird in the Images tab. It has two frames.', nb: 'Tegn din egen fugl i fanen Bilder. Den har to bilder.', es: 'Dibuja tu propio pájaro en la pestaña Imágenes. Tiene dos fotogramas.', fr: 'Dessine ton propre oiseau dans l’onglet Images. Il a deux images.', de: 'Zeichne deinen eigenen Vogel im Tab Bilder. Er hat zwei Bilder.' },
  ],
  strings: {
    en: {
      start: 'Create the bird. It waits in the air until you press A the first time.',
      flap: 'The first press turns on gravity (ay). Every press gives a push up.',
      pipes: 'When the game has started, new pipes come from the right. gapY is the top of the gap.',
      gate: 'An invisible gate in the gap gives a point when the bird flies through it.',
      ground: 'Hitting the ground ends the game.',
      crash: 'Hitting a pipe ends the game.',
    },
    nb: {
      start: 'Lag fuglen. Den venter i lufta til du trykker A første gang.',
      flap: 'Første trykk slår på tyngdekraften (ay). Hvert trykk gir et dytt oppover.',
      pipes: 'Når spillet har startet, kommer nye rør fra høyre. gapY er toppen av åpningen.',
      gate: 'En usynlig port i åpningen gir et poeng når fuglen flyr gjennom den.',
      ground: 'Treffer fuglen bakken, er spillet slutt.',
      crash: 'Treffer fuglen et rør, er spillet slutt.',
    },
    es: {
      start: 'Crea el pájaro. Espera en el aire hasta que pulsas A la primera vez.',
      flap: 'La primera pulsación activa la gravedad (ay). Cada pulsación da un empujón hacia arriba.',
      pipes: 'Cuando el juego ha empezado, llegan tuberías nuevas por la derecha. gapY es la parte de arriba del hueco.',
      gate: 'Una puerta invisible en el hueco da un punto cuando el pájaro la atraviesa.',
      ground: 'Si el pájaro toca el suelo, se acaba el juego.',
      crash: 'Si el pájaro choca con una tubería, se acaba el juego.',
    },
    fr: {
      start: 'Crée l’oiseau. Il attend en l’air jusqu’à ce que tu appuies sur A la première fois.',
      flap: 'Le premier appui active la gravité (ay). Chaque appui donne une poussée vers le haut.',
      pipes: 'Quand le jeu a commencé, de nouveaux tuyaux arrivent par la droite. gapY est le haut du passage.',
      gate: 'Une porte invisible dans le passage donne un point quand l’oiseau la traverse.',
      ground: 'Si l’oiseau touche le sol, la partie est finie.',
      crash: 'Si l’oiseau touche un tuyau, la partie est finie.',
    },
    de: {
      start: 'Erstelle den Vogel. Er wartet in der Luft, bis du zum ersten Mal A drückst.',
      flap: 'Der erste Druck schaltet die Schwerkraft (ay) ein. Jeder Druck gibt einen Schubs nach oben.',
      pipes: 'Wenn das Spiel läuft, kommen neue Rohre von rechts. gapY ist der obere Rand der Lücke.',
      gate: 'Ein unsichtbares Tor in der Lücke gibt einen Punkt, wenn der Vogel hindurchfliegt.',
      ground: 'Berührt der Vogel den Boden, ist das Spiel vorbei.',
      crash: 'Berührt der Vogel ein Rohr, ist das Spiel vorbei.',
    },
  },
  kinds: [],
  images: [
    {
      id: 'bird',
      name: 'bird',
      width: 8,
      height: 6,
      frames: [
        ['..1111..', '.1..1.1.', '111.1111', '1..1111.', '.1111...', '........'],
        ['..1111..', '.1111.1.', '1...1111', '1..1111.', '.1111...', '........'],
      ],
    },
    { id: 'pipeTop', name: 'pipe top', width: 8, height: PIPE_H, frames: [pipe(false)] },
    { id: 'pipeBottom', name: 'pipe bottom', width: 8, height: PIPE_H, frames: [pipe(true)] },
    { id: 'gate', name: 'gate', width: 8, height: GAP, frames: [Array<string>(GAP).fill('11111111')] },
  ],
  tiles: [],
  tilemaps: [],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        set('bird', blk('ab_sprite_create', { f: { IMAGE: 'bird', KIND: 'Player' } })),
        at('bird', 30, num(28)),
        blk('ab_sprite_animate', { i: { SPRITE: get('bird'), MS: num(120) } }),
        flag('bird', 'stayInScreen'),
        set('started', blk('logic_boolean', { f: { BOOL: 'FALSE' } })),
        blk('ab_score_set', { i: { VALUE: num(0) } }),
      ],
    }),
    blk('ab_on_button', {
      f: { BUTTON: 'a', EVENT: 'pressed' },
      comment: '@flap',
      body: [
        ifThen(not(get('started')), [set('started', blk('logic_boolean', { f: { BOOL: 'TRUE' } })), setProp('bird', 'ay', num(400))]),
        setProp('bird', 'vy', num(-90)),
        sfx('jump'),
      ],
    }),
    blk('ab_on_every', {
      f: { MS: 1500 },
      comment: '@pipes',
      body: [
        ifThen(get('started'), [
          set('gapY', blk('ab_random', { i: { FROM: num(6), TO: num(64 - GAP - 6) } })),
          set('pipe', blk('ab_sprite_create', { f: { IMAGE: 'pipeTop', KIND: 'Enemy' } })),
          at('pipe', 131, arith('MINUS', get('gapY'), num(PIPE_H / 2))),
          slide('pipe'),
          flag('pipe', 'autoDestroy'),
          set('pipe', blk('ab_sprite_create', { f: { IMAGE: 'pipeBottom', KIND: 'Enemy' } })),
          at('pipe', 131, arith('ADD', get('gapY'), num(GAP + PIPE_H / 2))),
          slide('pipe'),
          flag('pipe', 'autoDestroy'),
          set('gate', blk('ab_sprite_create', { f: { IMAGE: 'gate', KIND: 'Food' } })),
          at('gate', 131, arith('ADD', get('gapY'), num(GAP / 2))),
          slide('gate'),
          flag('gate', 'autoDestroy'),
          flag('gate', 'invisible'),
        ]),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Food' },
      comment: '@gate',
      body: [blk('ab_sprite_destroy', { i: { SPRITE: get('otherSprite') } }), blk('ab_score_change', { i: { VALUE: num(1) } }), sfx('coin')],
    }),
    blk('ab_on_update', {
      body: [
        ifThen(
          blk('ab_sprite_is_hitting', { f: { DIR: 'bottom' }, i: { SPRITE: get('bird') } }),
          [sfx('lose'), blk('ab_game_over', { f: { WIN: 'lose' } })],
          undefined,
          '@ground',
        ),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@crash',
      body: [sfx('lose'), blk('ab_game_over', { f: { WIN: 'lose' } })],
    }),
    blk('ab_on_draw', { body: [blk('ab_draw_line', { f: { COLOR: 'white' }, i: { X0: num(0), Y0: num(63), X1: num(127), Y1: num(63) } })] }),
  ]),
};
