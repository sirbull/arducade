import { abs, arith, blk, cmp, flag, get, ifThen, num, prop, set, setProp, workspace, hitting, type B } from './dsl';
import type { TemplateSource } from './types';

const ball = (img = 'ball') => blk('ab_sprite_create', { f: { IMAGE: img, KIND: 'Ball' } });

// Integer Pythagorean vectors keep the same total speed in every zone.
// Only round when assigning velocity; retain the direction through center hits.
function velocity(sprite: string, direction: 1 | -1): B[] {
  const component = (name: string) => arith('DIVIDE', arith('ADD',
    arith('MULTIPLY', get('ballSpeed'), abs(get(name))),
    arith('DIVIDE', get('directionDivisor'), num(2))), get('directionDivisor'));
  return [
    setProp(sprite, 'vx', arith('MULTIPLY', component('directionX'), num(direction))),
    ifThen(cmp('LT', get('directionY'), num(0)),
      [setProp(sprite, 'vy', arith('MINUS', num(0), component('directionY')))],
      [setProp(sprite, 'vy', component('directionY'))]),
  ];
}

function resetBall(direction: 1 | -1): B[] {
  return [
    set('ballSpeed', num(50)),
    set('directionX', num(12)),
    set('directionY', num(5)),
    set('directionDivisor', num(13)),
    ifThen(cmp('EQ', blk('ab_random', { i: { FROM: num(0), TO: num(1) } }), num(0)),
      [set('directionY', num(-5))]),
    blk('ab_sprite_set_position', { i: { SPRITE: get('ball'), X: num(64), Y: num(32) } }),
    ...velocity('ball', direction),
  ];
}

// Five equal, three-pixel zones on a 15-pixel paddle.
function returnBall(direction: 1 | -1): B[] {
  const aim = (x: number, y: number, divisor: number) => [
    set('directionX', num(x)), set('directionY', num(y)), set('directionDivisor', num(divisor)),
  ];
  return [
    // Keep speed safe for discrete sprite collisions and 16-bit arithmetic.
    ifThen(cmp('LT', get('ballSpeed'), num(180)),
      [set('ballSpeed', arith('ADD', get('ballSpeed'), num(1)))]),
    // A wall may have reflected the vertical direction since the last hit.
    ifThen(cmp('LT', prop('sprite', 'vy'), num(0)),
      [set('directionY', arith('MINUS', num(0), abs(get('directionY'))))],
      [set('directionY', abs(get('directionY')))]),
    set('hitOffset', arith('MINUS', prop('sprite', 'y'), prop('otherSprite', 'y'))),
    ifThen(cmp('LT', get('hitOffset'), num(-4)), aim(4, -3, 5), [
      ifThen(cmp('LT', get('hitOffset'), num(-1)), aim(12, -5, 13), [
        ifThen(cmp('GTE', get('hitOffset'), num(5)), aim(4, 3, 5), [
          ifThen(cmp('GTE', get('hitOffset'), num(2)), aim(12, 5, 13)),
        ]),
      ]),
    ]),
    ...velocity('sprite', direction),
    setProp('sprite', 'x', arith('ADD', prop('otherSprite', 'x'), num(direction * 4))),
    blk('ab_play_effect', { f: { SFX: 'hit' } }),
  ];
}

export const pong: TemplateSource = {
  id: 'pong',
  order: 2,
  title: { en: 'Pong', nb: 'Pong', es: 'Pong', fr: 'Pong', de: 'Pong' },
  description: {
    en: 'Hit the ball past the computer. Move with up and down.',
    nb: 'Slå ballen forbi datamaskinen. Flytt med opp og ned.',
    es: 'Pasa la pelota a la computadora. Muévete con arriba y abajo.',
    fr: "Envoie la balle derrière l'ordinateur. Bouge avec haut et bas.",
    de: 'Schlag den Ball am Computer vorbei. Bewege dich mit hoch und runter.',
  },
  tips: [
    { en: 'Make the ball faster: change 50 in "on start".', nb: 'Gjør ballen raskere: endre 50 i "når spillet starter".', es: 'Haz la pelota más rápida: cambia 50 en "al iniciar".', fr: 'Rends la balle plus rapide : change 50 dans « au démarrage ».', de: 'Mach den Ball schneller: ändere 50 in "beim Start".' },
    { en: 'Give yourself more lives.', nb: 'Gi deg selv flere liv.', es: 'Date más vidas.', fr: 'Donne-toi plus de vies.', de: 'Gib dir mehr Leben.' },
    { en: 'Make the computer better: raise its speed from 40.', nb: 'Gjør datamaskinen flinkere: øk farten fra 40.', es: 'Mejora la computadora: sube su velocidad de 40.', fr: "Rends l'ordinateur meilleur : augmente sa vitesse de 40.", de: 'Mach den Computer besser: erhöhe sein Tempo von 40.' },
  ],
  strings: {
    en: {
      start: 'Create the paddles and the ball. The ball bounces on the edges of the screen.',
      ai: 'The computer moves its paddle toward the ball.',
      miss: 'The ball hit your side: you lose a life. The ball hit the other side: you get a point.',
      hit: 'Five paddle zones steer the ball: edges aim outward, the center keeps its angle. Each hit adds 1 to its speed (up to 180).',
    },
    nb: {
      start: 'Lag rekkertene og ballen. Ballen spretter på kantene av skjermen.',
      ai: 'Datamaskinen flytter rekkerten sin mot ballen.',
      miss: 'Ballen traff din side: du mister et liv. Ballen traff den andre siden: du får et poeng.',
      hit: 'Fem treffsoner styrer ballen: kantene gir utslag, midten beholder vinkelen. Hvert treff øker farten med 1 (opptil 180).',
    },
    es: {
      start: 'Crea las paletas y la pelota. La pelota rebota en los bordes de la pantalla.',
      ai: 'La computadora mueve su paleta hacia la pelota.',
      miss: 'Si la pelota toca tu lado pierdes una vida. Si toca el otro lado ganas un punto.',
      hit: 'Cinco zonas dirigen la pelota: los extremos la desvían y el centro conserva el ángulo. Cada golpe aumenta la velocidad en 1 (hasta 180).',
    },
    fr: {
      start: "Crée les raquettes et la balle. La balle rebondit sur les bords de l'écran.",
      ai: "L'ordinateur déplace sa raquette vers la balle.",
      miss: "Si la balle touche ton côté, tu perds une vie. Si elle touche l'autre côté, tu gagnes un point.",
      hit: 'Cinq zones dirigent la balle : les bords la dévient, le centre conserve son angle. Chaque frappe augmente la vitesse de 1 (jusqu’à 180).',
    },
    de: {
      start: 'Erstelle die Schläger und den Ball. Der Ball prallt an den Rändern ab.',
      ai: 'Der Computer bewegt seinen Schläger zum Ball.',
      miss: 'Trifft der Ball deine Seite, verlierst du ein Leben. Trifft er die andere Seite, bekommst du einen Punkt.',
      hit: 'Fünf Zonen lenken den Ball: Die Ränder lenken ihn ab, die Mitte behält den Winkel bei. Jeder Treffer erhöht das Tempo um 1 (bis 180).',
    },
  },
  kinds: ['Ball'],
  images: [
    { id: 'paddle', name: 'paddle', width: 3, height: 15, frames: [Array(15).fill('111')] },
    { id: 'ball', name: 'ball', width: 4, height: 4, frames: [['.11.', '1111', '1111', '.11.']] },
  ],
  tiles: [],
  tilemaps: [],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        set('player', blk('ab_sprite_create', { f: { IMAGE: 'paddle', KIND: 'Player' } })),
        blk('ab_sprite_set_position', { i: { SPRITE: get('player'), X: num(4), Y: num(32) } }),
        blk('ab_move_sprite', { i: { SPRITE: get('player'), VX: num(0), VY: num(80) } }),
        flag('player', 'stayInScreen'),
        set('computer', blk('ab_sprite_create', { f: { IMAGE: 'paddle', KIND: 'Enemy' } })),
        blk('ab_sprite_set_position', { i: { SPRITE: get('computer'), X: num(123), Y: num(32) } }),
        flag('computer', 'stayInScreen'),
        set('ball', ball()),
        flag('ball', 'bounceOnWall'),
        ...resetBall(1),
        blk('ab_life_set', { i: { VALUE: num(3) } }),
        blk('ab_score_set', { i: { VALUE: num(0) } }),
      ],
    }),
    blk('ab_on_update', {
      body: [
        ifThen(
          cmp('LT', prop('ball', 'y'), arith('MINUS', prop('computer', 'y'), num(2))),
          [setProp('computer', 'vy', num(-40))],
          [
            ifThen(
              cmp('GT', prop('ball', 'y'), arith('ADD', prop('computer', 'y'), num(2))),
              [setProp('computer', 'vy', num(40))],
              [setProp('computer', 'vy', num(0))],
            ),
          ],
          '@ai',
        ),
        ifThen(hitting('ball', 'left'), [blk('ab_life_change', { i: { VALUE: num(-1) } }), blk('ab_play_effect', { f: { SFX: 'lose' } }), ...resetBall(1)], undefined, '@miss'),
        ifThen(hitting('ball', 'right'), [blk('ab_score_change', { i: { VALUE: num(1) } }), blk('ab_play_effect', { f: { SFX: 'coin' } }), ...resetBall(-1)]),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Ball', OTHER: { name: 'otherSprite' }, KIND_B: 'Player' },
      comment: '@hit',
      body: [
        ifThen(cmp('LT', prop('sprite', 'vx'), num(0)), [
          ...returnBall(1),
        ]),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Ball', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      body: [
        ifThen(cmp('GT', prop('sprite', 'vx'), num(0)), [
          ...returnBall(-1),
        ]),
      ],
    }),
  ]),
};
