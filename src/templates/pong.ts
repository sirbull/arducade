import { abs, arith, blk, cmp, flag, get, ifThen, num, prop, set, setProp, workspace, hitting, type B } from './dsl';
import type { TemplateSource } from './types';

const ball = (img = 'ball') => blk('ab_sprite_create', { f: { IMAGE: img, KIND: 'Ball' } });

function resetBall(vx: number): B[] {
  return [
    blk('ab_sprite_set_position', { i: { SPRITE: get('ball'), X: num(64), Y: num(32) } }),
    blk('ab_sprite_set_velocity', { i: { SPRITE: get('ball'), VX: num(vx), VY: blk('ab_random', { i: { FROM: num(-30), TO: num(30) } }) } }),
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
      hit: 'Send the ball back, a little faster each time.',
    },
    nb: {
      start: 'Lag rekkertene og ballen. Ballen spretter på kantene av skjermen.',
      ai: 'Datamaskinen flytter rekkerten sin mot ballen.',
      miss: 'Ballen traff din side: du mister et liv. Ballen traff den andre siden: du får et poeng.',
      hit: 'Send ballen tilbake, litt raskere hver gang.',
    },
    es: {
      start: 'Crea las paletas y la pelota. La pelota rebota en los bordes de la pantalla.',
      ai: 'La computadora mueve su paleta hacia la pelota.',
      miss: 'Si la pelota toca tu lado pierdes una vida. Si toca el otro lado ganas un punto.',
      hit: 'Devuelve la pelota, un poco más rápido cada vez.',
    },
    fr: {
      start: "Crée les raquettes et la balle. La balle rebondit sur les bords de l'écran.",
      ai: "L'ordinateur déplace sa raquette vers la balle.",
      miss: "Si la balle touche ton côté, tu perds une vie. Si elle touche l'autre côté, tu gagnes un point.",
      hit: 'Renvoie la balle, un peu plus vite à chaque fois.',
    },
    de: {
      start: 'Erstelle die Schläger und den Ball. Der Ball prallt an den Rändern ab.',
      ai: 'Der Computer bewegt seinen Schläger zum Ball.',
      miss: 'Trifft der Ball deine Seite, verlierst du ein Leben. Trifft er die andere Seite, bekommst du einen Punkt.',
      hit: 'Schlag den Ball zurück, jedes Mal etwas schneller.',
    },
  },
  kinds: ['Ball'],
  images: [
    { id: 'paddle', name: 'paddle', width: 3, height: 14, frames: [Array(14).fill('111')] },
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
        ...resetBall(50),
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
        ifThen(hitting('ball', 'left'), [blk('ab_life_change', { i: { VALUE: num(-1) } }), blk('ab_play_effect', { f: { SFX: 'lose' } }), ...resetBall(50)], undefined, '@miss'),
        ifThen(hitting('ball', 'right'), [blk('ab_score_change', { i: { VALUE: num(1) } }), blk('ab_play_effect', { f: { SFX: 'coin' } }), ...resetBall(-50)]),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Ball', OTHER: { name: 'otherSprite' }, KIND_B: 'Player' },
      comment: '@hit',
      body: [
        ifThen(cmp('LT', prop('sprite', 'vx'), num(0)), [
          setProp('sprite', 'vx', arith('ADD', abs(prop('sprite', 'vx')), num(5))),
          blk('ab_play_effect', { f: { SFX: 'hit' } }),
        ]),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Ball', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      body: [
        ifThen(cmp('GT', prop('sprite', 'vx'), num(0)), [
          setProp('sprite', 'vx', arith('MINUS', num(0), abs(prop('sprite', 'vx')))),
          blk('ab_play_effect', { f: { SFX: 'hit' } }),
        ]),
      ],
    }),
  ]),
};
