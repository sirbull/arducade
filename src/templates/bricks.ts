import { abs, arith, blk, call, cmp, flag, forRange, func, get, ifThen, neg, not, num, prop, set, setProp, workspace } from './dsl';
import type { TemplateSource } from './types';

const BRICK = 1;
const cells = Array.from({ length: 16 * 8 }, (_, i) => (i >= 16 && i < 16 * 5 ? BRICK : 0));
const sfx = (name: string) => blk('ab_play_effect', { f: { SFX: name } });

export const bricks: TemplateSource = {
  id: 'bricks',
  order: 5,
  title: { en: 'Brick breaker', nb: 'Murbryter', es: 'Rompeladrillos', fr: 'Casse-briques', de: 'Mauerbrecher' },
  description: {
    en: 'Bounce the ball with the paddle and break all the bricks. Move with left and right.',
    nb: 'Sprett ballen med racketen og knus alle mursteinene. Flytt med venstre og høyre.',
    es: 'Haz rebotar la pelota con la paleta y rompe todos los ladrillos. Muévete con izquierda y derecha.',
    fr: 'Renvoie la balle avec la raquette et casse toutes les briques. Bouge avec gauche et droite.',
    de: 'Lass den Ball vom Schläger abprallen und zerbrich alle Steine. Bewege dich mit links und rechts.',
  },
  tips: [
    { en: 'Draw your own wall of bricks in the Tile map tab.', nb: 'Tegn din egen mur i fanen Tilekart.', es: 'Dibuja tu propio muro en la pestaña Mapa.', fr: 'Dessine ton propre mur dans l’onglet Carte.', de: 'Zeichne deine eigene Mauer im Tab Karte.' },
    { en: 'Steer the ball harder: change 6 in "on ball hits paddle".', nb: 'Styr ballen mer: endre 6 i "når ballen treffer racketen".', es: 'Dirige más la pelota: cambia 6 en "cuando la pelota toca la paleta".', fr: 'Dirige plus la balle : change 6 dans « quand la balle touche la raquette ».', de: 'Lenk den Ball stärker: ändere 6 in "wenn der Ball den Schläger trifft".' },
    { en: 'Make the paddle wider in the Images tab.', nb: 'Gjør racketen bredere i fanen Bilder.', es: 'Haz la paleta más ancha en la pestaña Imágenes.', fr: 'Élargis la raquette dans l’onglet Images.', de: 'Mach den Schläger breiter im Tab Bilder.' },
  ],
  strings: {
    en: {
      start: 'Load the wall, create the paddle and the ball, and count the bricks.',
      serve: 'Put the ball above the paddle and send it up. It bounces on the edges of the screen.',
      miss: 'The ball hit the bottom: you lose a life.',
      paddle: 'The ball bounces up. Where it hits the paddle decides the angle.',
      brick: 'The ball hits a brick: take it away and get a point. Only bounce once per frame, even if two bricks are hit.',
    },
    nb: {
      start: 'Last inn muren, lag racketen og ballen, og tell mursteinene.',
      serve: 'Sett ballen over racketen og send den opp. Den spretter på kantene av skjermen.',
      miss: 'Ballen traff bunnen: du mister et liv.',
      paddle: 'Ballen spretter opp. Hvor den treffer racketen bestemmer vinkelen.',
      brick: 'Ballen treffer en murstein: fjern den og få et poeng. Sprett bare én gang per bilde, selv om to steiner treffes.',
    },
    es: {
      start: 'Carga el muro, crea la paleta y la pelota, y cuenta los ladrillos.',
      serve: 'Pon la pelota sobre la paleta y lánzala hacia arriba. Rebota en los bordes de la pantalla.',
      miss: 'La pelota tocó el fondo: pierdes una vida.',
      paddle: 'La pelota rebota hacia arriba. El punto donde toca la paleta decide el ángulo.',
      brick: 'La pelota toca un ladrillo: quítalo y gana un punto. Rebota solo una vez por imagen, aunque toque dos ladrillos.',
    },
    fr: {
      start: 'Charge le mur, crée la raquette et la balle, et compte les briques.',
      serve: 'Place la balle au-dessus de la raquette et lance-la vers le haut. Elle rebondit sur les bords de l’écran.',
      miss: 'La balle a touché le bas : tu perds une vie.',
      paddle: 'La balle rebondit vers le haut. L’endroit touché sur la raquette décide de l’angle.',
      brick: 'La balle touche une brique : enlève-la et gagne un point. Ne rebondis qu’une fois par image, même si deux briques sont touchées.',
    },
    de: {
      start: 'Lade die Mauer, erstelle Schläger und Ball und zähle die Steine.',
      serve: 'Setz den Ball über den Schläger und schick ihn nach oben. Er prallt an den Rändern ab.',
      miss: 'Der Ball hat den Boden berührt: Du verlierst ein Leben.',
      paddle: 'Der Ball prallt nach oben ab. Wo er den Schläger trifft, bestimmt den Winkel.',
      brick: 'Der Ball trifft einen Stein: Nimm ihn weg und bekomme einen Punkt. Nur einmal pro Bild abprallen, auch wenn zwei Steine getroffen werden.',
    },
  },
  kinds: ['Ball'],
  images: [
    { id: 'paddle', name: 'paddle', width: 16, height: 3, frames: [['.11111111111111.', '1111111111111111', '.11111111111111.']] },
    { id: 'ball', name: 'ball', width: 3, height: 3, frames: [['.1.', '111', '.1.']] },
  ],
  tiles: [{ id: 'brick', name: 'brick', solid: false, pixels: ['1111111.', '1.....1.', '1.1.1.1.', '1.....1.', '1111111.', '........', '........', '........'] }],
  tilemaps: [{ id: 'wall', name: 'wall', width: 16, height: 8, cells }],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        blk('ab_set_tilemap', { f: { MAP: 'wall' } }),
        set('paddle', blk('ab_sprite_create', { f: { IMAGE: 'paddle', KIND: 'Player' } })),
        blk('ab_sprite_set_position', { i: { SPRITE: get('paddle'), X: num(64), Y: num(61) } }),
        blk('ab_move_sprite', { i: { SPRITE: get('paddle'), VX: num(90), VY: num(0) } }),
        flag('paddle', 'stayInScreen'),
        set('ball', blk('ab_sprite_create', { f: { IMAGE: 'ball', KIND: 'Ball' } })),
        flag('ball', 'bounceOnWall'),
        set('bricksLeft', num(0)),
        forRange('row', num(0), num(7), [
          forRange('col', num(0), num(15), [
            ifThen(blk('ab_tile_is', { f: { TILE: 'brick' }, i: { COL: get('col'), ROW: get('row') } }), [
              set('bricksLeft', arith('ADD', get('bricksLeft'), num(1))),
            ]),
          ]),
        ]),
        call('serve'),
        blk('ab_life_set', { i: { VALUE: num(3) } }),
        blk('ab_score_set', { i: { VALUE: num(0) } }),
      ],
    }),
    func(
      'serve',
      [
        blk('ab_sprite_set_position', { i: { SPRITE: get('ball'), X: prop('paddle', 'x'), Y: num(52) } }),
        blk('ab_sprite_set_velocity', { i: { SPRITE: get('ball'), VX: blk('ab_random', { i: { FROM: num(-40), TO: num(40) } }), VY: num(-55) } }),
      ],
      '@serve',
    ),
    blk('ab_on_update', {
      body: [
        set('bounced', blk('logic_boolean', { f: { BOOL: 'FALSE' } })),
        ifThen(blk('ab_sprite_is_hitting', { f: { DIR: 'bottom' }, i: { SPRITE: get('ball') } }), [
          sfx('lose'),
          call('serve'),
          blk('ab_life_change', { i: { VALUE: num(-1) } }),
        ], undefined, '@miss'),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Ball', OTHER: { name: 'otherSprite' }, KIND_B: 'Player' },
      comment: '@paddle',
      body: [
        setProp('sprite', 'vy', neg(abs(prop('sprite', 'vy')))),
        setProp('sprite', 'vx', arith('MULTIPLY', arith('MINUS', prop('sprite', 'x'), prop('otherSprite', 'x')), num(6))),
        sfx('hit'),
      ],
    }),
    blk('ab_on_tile', {
      f: { SPRITE: { name: 'sprite' }, KIND: 'Ball', TILE: 'brick', COL: { name: 'col' }, ROW: { name: 'row' } },
      comment: '@brick',
      body: [
        blk('ab_set_tile', { f: { TILE: 'empty' }, i: { COL: get('col'), ROW: get('row') } }),
        blk('ab_score_change', { i: { VALUE: num(1) } }),
        sfx('coin'),
        ifThen(not(get('bounced')), [
          setProp('sprite', 'vy', neg(prop('sprite', 'vy'))),
          set('bounced', blk('logic_boolean', { f: { BOOL: 'TRUE' } })),
        ]),
        set('bricksLeft', arith('MINUS', get('bricksLeft'), num(1))),
        ifThen(cmp('EQ', get('bricksLeft'), num(0)), [blk('ab_game_over', { f: { WIN: 'win' } })]),
      ],
    }),
  ]),
};
