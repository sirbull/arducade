import { blk, flag, get, num, set, workspace } from './dsl';
import type { TemplateSource } from './types';

export const shooter: TemplateSource = {
  id: 'shooter',
  order: 3,
  title: { en: 'Space shooter', nb: 'Romskyting', es: 'Batalla espacial', fr: 'Tir spatial', de: 'Weltraum-Shooter' },
  description: {
    en: 'Shoot the falling enemies with A. Do not let them hit you.',
    nb: 'Skyt fiendene som faller med A. Ikke la dem treffe deg.',
    es: 'Dispara con A a los enemigos que caen. Que no te toquen.',
    fr: 'Tire sur les ennemis qui tombent avec A. Ne te fais pas toucher.',
    de: 'Schieß mit A auf die fallenden Gegner. Lass dich nicht treffen.',
  },
  tips: [
    { en: 'Make enemies come more often: change 800.', nb: 'Få fiendene til å komme oftere: endre 800.', es: 'Haz que los enemigos vengan más a menudo: cambia 800.', fr: 'Fais venir les ennemis plus souvent : change 800.', de: 'Lass Gegner öfter kommen: ändere 800.' },
    { en: 'Draw your own space ship in the Images tab.', nb: 'Tegn ditt eget romskip i fanen Bilder.', es: 'Dibuja tu propia nave en la pestaña Imágenes.', fr: 'Dessine ton propre vaisseau dans l’onglet Images.', de: 'Zeichne dein eigenes Raumschiff im Tab Bilder.' },
    { en: 'Shoot two bullets at once.', nb: 'Skyt to skudd samtidig.', es: 'Dispara dos balas a la vez.', fr: 'Tire deux balles à la fois.', de: 'Schieß zwei Kugeln auf einmal.' },
  ],
  strings: {
    en: {
      start: 'Create the ship. It moves left and right with the buttons.',
      shoot: 'Press A to shoot a bullet upward.',
      spawn: 'A new enemy appears at the top every 800 ms.',
      hit: 'A bullet hits an enemy: both disappear and you get a point.',
      crash: 'An enemy hits the ship: you lose a life.',
    },
    nb: {
      start: 'Lag romskipet. Det flytter seg til venstre og høyre med knappene.',
      shoot: 'Trykk A for å skyte et skudd oppover.',
      spawn: 'En ny fiende kommer øverst hvert 800. millisekund.',
      hit: 'Et skudd treffer en fiende: begge forsvinner og du får et poeng.',
      crash: 'En fiende treffer romskipet: du mister et liv.',
    },
    es: {
      start: 'Crea la nave. Se mueve a izquierda y derecha con los botones.',
      shoot: 'Pulsa A para disparar hacia arriba.',
      spawn: 'Aparece un enemigo arriba cada 800 ms.',
      hit: 'Una bala toca a un enemigo: ambos desaparecen y ganas un punto.',
      crash: 'Un enemigo choca con la nave: pierdes una vida.',
    },
    fr: {
      start: 'Crée le vaisseau. Il bouge à gauche et à droite avec les boutons.',
      shoot: 'Appuie sur A pour tirer vers le haut.',
      spawn: 'Un nouvel ennemi apparaît en haut toutes les 800 ms.',
      hit: 'Une balle touche un ennemi : les deux disparaissent et tu gagnes un point.',
      crash: 'Un ennemi touche le vaisseau : tu perds une vie.',
    },
    de: {
      start: 'Erstelle das Raumschiff. Es bewegt sich mit den Tasten nach links und rechts.',
      shoot: 'Drück A, um nach oben zu schießen.',
      spawn: 'Alle 800 ms erscheint oben ein neuer Gegner.',
      hit: 'Eine Kugel trifft einen Gegner: beide verschwinden und du bekommst einen Punkt.',
      crash: 'Ein Gegner trifft das Raumschiff: du verlierst ein Leben.',
    },
  },
  kinds: [],
  images: [
    { id: 'ship', name: 'ship', width: 9, height: 7, frames: [['....1....', '...111...', '...1.1...', '..11111..', '.1111111.', '111.1.111', '1.......1']] },
    { id: 'alien', name: 'alien', width: 8, height: 6, frames: [['.1....1.', '..1111..', '.11.1.1.', '11111111', '1.1..1.1', '.1....1.']] },
    { id: 'bullet', name: 'bullet', width: 1, height: 3, frames: [['1', '1', '1']] },
  ],
  tiles: [],
  tilemaps: [],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        set('ship', blk('ab_sprite_create', { f: { IMAGE: 'ship', KIND: 'Player' } })),
        blk('ab_sprite_set_position', { i: { SPRITE: get('ship'), X: num(64), Y: num(58) } }),
        blk('ab_move_sprite', { i: { SPRITE: get('ship'), VX: num(70), VY: num(0) } }),
        flag('ship', 'stayInScreen'),
        blk('ab_life_set', { i: { VALUE: num(3) } }),
        blk('ab_score_set', { i: { VALUE: num(0) } }),
      ],
    }),
    blk('ab_on_button', {
      f: { BUTTON: 'a', EVENT: 'pressed' },
      comment: '@shoot',
      body: [
        set('shot', blk('ab_sprite_projectile', { f: { IMAGE: 'bullet' }, i: { FROM: get('ship'), VX: num(0), VY: num(-120) } })),
        blk('ab_play_effect', { f: { SFX: 'shoot' } }),
      ],
    }),
    blk('ab_on_every', {
      f: { MS: 800 },
      comment: '@spawn',
      body: [
        set('alien', blk('ab_sprite_create', { f: { IMAGE: 'alien', KIND: 'Enemy' } })),
        blk('ab_sprite_set_position', { i: { SPRITE: get('alien'), X: blk('ab_random', { i: { FROM: num(8), TO: num(120) } }), Y: num(0) } }),
        blk('ab_sprite_set_velocity', { i: { SPRITE: get('alien'), VX: num(0), VY: blk('ab_random', { i: { FROM: num(15), TO: num(35) } }) } }),
        flag('alien', 'autoDestroy'),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Projectile', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@hit',
      body: [
        blk('ab_sprite_destroy', { i: { SPRITE: get('sprite') } }),
        blk('ab_sprite_destroy', { i: { SPRITE: get('otherSprite') } }),
        blk('ab_score_change', { i: { VALUE: num(1) } }),
        blk('ab_play_effect', { f: { SFX: 'explosion' } }),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@crash',
      body: [
        blk('ab_sprite_destroy', { i: { SPRITE: get('otherSprite') } }),
        blk('ab_life_change', { i: { VALUE: num(-1) } }),
        blk('ab_play_effect', { f: { SFX: 'hit' } }),
      ],
    }),
  ]),
};
