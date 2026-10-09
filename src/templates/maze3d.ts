// A first person shooter drawn with ray casting, made only from normal blocks.
//
// The world is a tile map where 1 tile = 8 pixels for the sprites (ghosts and
// bullets move and collide there as usual) and 64 units for the player, who
// needs finer steps than whole pixels for smooth walking. All math is 16 bit:
// directions are scaled by 64 and the products are kept below 32767.

import {
  abs, and, arith, blk, breakLoop, call, callRet, cmp, forKind, forRange, func, funcRet, get, ifThen,
  minmax, neg, not, num, or, pressed, prop, random, repeat, set, workspace, whileDo, type B,
} from './dsl';
import type { TemplateSource } from './types';

const MAP = [
  '################',
  '#.....#........#',
  '#.##..#..##.##.#',
  '#.#.......g#...#',
  '#...##.##..#.#.#',
  '#.#..g.#.....#g#',
  '#.#..#...##....#',
  '################',
];
const CELL: Record<string, number> = { '.': 0, '#': 1, g: 2 };

const add = (a: B, b: B) => arith('ADD', a, b);
const sub = (a: B, b: B) => arith('MINUS', a, b);
const mul = (a: B, b: B) => arith('MULTIPLY', a, b);
const div = (a: B, b: B) => arith('DIVIDE', a, b);
const n = num;
const v = get;

const sin = (a: B) => callRet('sin', ['degrees'], [a]);
const isWall = (x: B, y: B) => callRet('isWall', ['atX', 'atY'], [x, y]);
const tileEmpty = (col: B, row: B) => blk('ab_tile_is', { f: { TILE: 'empty' }, i: { COL: col, ROW: row } });
const rect = (x: B, y: B, w: B, h: B, color = 'white') => blk('ab_draw_rect', { f: { FILL: 'filled', COLOR: color }, i: { X: x, Y: y, W: w, H: h } });
const line = (x0: B, y0: B, x1: B, y1: B, color = 'white') => blk('ab_draw_line', { f: { COLOR: color }, i: { X0: x0, Y0: y0, X1: x1, Y1: y1 } });
const pixel = (x: B, y: B, color = 'white') => blk('ab_draw_pixel', { f: { COLOR: color }, i: { X: x, Y: y } });
const circle = (x: B, y: B, r: B, color = 'white') => blk('ab_draw_circle', { f: { FILL: 'filled', COLOR: color }, i: { X: x, Y: y, R: r } });
const image = (img: string, x: number, y: number) => blk('ab_draw_image', { f: { IMAGE: img }, i: { X: n(x), Y: n(y) } });
const velocity = (sprite: string, vx: B, vy: B) => blk('ab_sprite_set_velocity', { i: { SPRITE: v(sprite), VX: vx, VY: vy } });
const sfx = (name: string) => blk('ab_play_effect', { f: { SFX: name } });
const hitting = (sprite: string, dir: string) => blk('ab_sprite_is_hitting', { f: { DIR: dir }, i: { SPRITE: v(sprite) } });

/** One axis of the ray setup: step direction, distance between grid lines and distance to the first one. */
function raySetup(axis: 'X' | 'Y', pos: string): B[] {
  const ray = v(`ray${axis}`);
  const cell = v(`map${axis}`);
  const delta = `delta${axis}`;
  // delta / 8 * fraction / 8 stays below 32767, delta * fraction would not.
  const part = (fraction: B) => div(mul(fraction, div(v(delta), n(8))), n(8));
  return [
    set(delta, div(n(4096), minmax('max', abs(ray), n(2)))),
    ifThen(
      cmp('LT', ray, n(0)),
      [set(`step${axis}`, n(-1)), set(`side${axis}`, part(sub(v(pos), mul(cell, n(64)))))],
      [set(`step${axis}`, n(1)), set(`side${axis}`, part(sub(add(mul(cell, n(64)), n(64)), v(pos))))],
    ),
  ];
}

const castRays = func(
  'drawWalls',
  [
    rect(n(0), n(0), n(128), n(64), 'black'),
    set('lastMapX', n(-1)),
    forRange('column', n(0), n(63), [
      set('rayX', add(v('dirX'), div(mul(v('planeX'), sub(v('column'), n(32))), n(32))), '@ray'),
      set('rayY', add(v('dirY'), div(mul(v('planeY'), sub(v('column'), n(32))), n(32)))),
      set('mapX', div(v('posX'), n(64))),
      set('mapY', div(v('posY'), n(64))),
      ...raySetup('X', 'posX'),
      ...raySetup('Y', 'posY'),
      set('hit', blk('logic_boolean', { f: { BOOL: 'FALSE' } })),
      set('steps', n(0)),
      blk('ab_comment', { f: { TEXT: '@dda' } }),
      whileDo(and(not(v('hit')), cmp('LT', v('steps'), n(20))), [
        ifThen(
          cmp('LT', v('sideX'), v('sideY')),
          [set('sideX', add(v('sideX'), v('deltaX'))), set('mapX', add(v('mapX'), v('stepX'))), set('side', n(0))],
          [set('sideY', add(v('sideY'), v('deltaY'))), set('mapY', add(v('mapY'), v('stepY'))), set('side', n(1))],
        ),
        set('hit', not(tileEmpty(v('mapX'), v('mapY')))),
        set('steps', add(v('steps'), n(1))),
      ]),
      ifThen(cmp('EQ', v('side'), n(0)), [set('dist', sub(v('sideX'), v('deltaX')))], [set('dist', sub(v('sideY'), v('deltaY')))]),
      set('wallH', minmax('min', div(n(4096), minmax('max', v('dist'), n(8))), n(64)), '@height'),
      set('top', sub(n(32), div(v('wallH'), n(2)))),
      set('x', mul(v('column'), n(2))),
      ifThen(
        cmp('EQ', v('side'), n(0)),
        [rect(v('x'), v('top'), n(2), v('wallH'))],
        [
          line(v('x'), v('top'), v('x'), add(v('top'), sub(v('wallH'), n(1)))),
          pixel(add(v('x'), n(1)), v('top')),
          pixel(add(v('x'), n(1)), add(v('top'), sub(v('wallH'), n(1)))),
        ],
        '@shade',
      ),
      ifThen(
        or(or(cmp('NEQ', v('mapX'), v('lastMapX')), cmp('NEQ', v('mapY'), v('lastMapY'))), cmp('NEQ', v('side'), v('lastSide'))),
        [line(v('x'), v('top'), v('x'), add(v('top'), sub(v('wallH'), n(1))), 'black')],
        undefined,
        '@edge',
      ),
      set('lastMapX', v('mapX')),
      set('lastMapY', v('mapY')),
      set('lastSide', v('side')),
    ]),
  ],
  '@walls',
);

// ponytail: a sprite is either fully seen or fully hidden, and sprites are drawn in sprite order, not
// far to near. Both need lists (wall distance per column, sorted sprites), which blocks do not have.
const project = func(
  'project',
  [
    set('relX', sub(prop('thing', 'x'), div(v('posX'), n(8)))),
    set('relY', sub(prop('thing', 'y'), div(v('posY'), n(8)))),
    set('depth', div(add(mul(v('relX'), v('dirX')), mul(v('relY'), v('dirY'))), n(64))),
    set('across', div(sub(mul(v('relY'), v('dirX')), mul(v('relX'), v('dirY'))), n(64))),
    set('seen', blk('logic_boolean', { f: { BOOL: 'FALSE' } })),
    ifThen(cmp('GT', v('depth'), n(2)), [
      set('screenX', add(n(64), div(mul(v('across'), n(96)), v('depth')))),
      set('size', div(n(512), v('depth'))),
      ifThen(and(cmp('GT', add(v('screenX'), v('size')), n(0)), cmp('LT', sub(v('screenX'), v('size')), n(128))), [
        set('seen', blk('logic_boolean', { f: { BOOL: 'TRUE' } })),
        forRange('k', n(1), n(15), [
          ifThen(isWall(add(v('posX'), div(mul(v('relX'), v('k')), n(2))), add(v('posY'), div(mul(v('relY'), v('k')), n(2)))), [
            set('seen', blk('logic_boolean', { f: { BOOL: 'FALSE' } })),
            breakLoop(),
          ]),
        ], '@sight'),
      ]),
    ]),
  ],
  '@project',
);

const drawThings = func(
  'drawThings',
  [
    forKind('ghost', 'Enemy', [
      set('thing', v('ghost')),
      call('project'),
      ifThen(v('seen'), [
        set('r', div(mul(v('size'), n(3)), n(10))),
        set('cy', sub(add(n(32), div(v('size'), n(2))), v('r'))),
        circle(v('screenX'), v('cy'), add(v('r'), n(1)), 'black'),
        rect(sub(v('screenX'), add(v('r'), n(1))), v('cy'), add(mul(v('r'), n(2)), n(3)), add(v('r'), n(2)), 'black'),
        circle(v('screenX'), v('cy'), v('r')),
        rect(sub(v('screenX'), v('r')), v('cy'), add(mul(v('r'), n(2)), n(1)), add(v('r'), n(1))),
        set('eye', div(mul(v('r'), n(2)), n(5))),
        circle(sub(v('screenX'), v('eye')), sub(v('cy'), div(v('r'), n(4))), div(v('r'), n(4)), 'black'),
        circle(add(v('screenX'), v('eye')), sub(v('cy'), div(v('r'), n(4))), div(v('r'), n(4)), 'black'),
        line(sub(v('screenX'), v('eye')), add(v('cy'), div(v('r'), n(2))), add(v('screenX'), v('eye')), add(v('cy'), div(v('r'), n(2))), 'black'),
        circle(sub(v('screenX'), div(v('r'), n(2))), add(v('cy'), v('r')), div(v('r'), n(4)), 'black'),
        circle(add(v('screenX'), div(v('r'), n(2))), add(v('cy'), v('r')), div(v('r'), n(4)), 'black'),
      ]),
    ], '@ghosts'),
    forKind('bullet', 'Projectile', [
      set('thing', v('bullet')),
      call('project'),
      ifThen(and(v('seen'), cmp('LT', v('size'), n(48))), [circle(v('screenX'), add(n(32), div(v('size'), n(6))), add(div(v('size'), n(12)), n(1)))]),
    ]),
  ],
  '@things',
);

const walk = func(
  'walk',
  [
    ifThen(not(isWall(add(v('posX'), mul(v('moveX'), n(4))), v('posY'))), [set('posX', add(v('posX'), v('moveX')))]),
    ifThen(not(isWall(v('posX'), add(v('posY'), mul(v('moveY'), n(4))))), [set('posY', add(v('posY'), v('moveY')))]),
  ],
  '@walk',
);

const turn = func(
  'turn',
  [
    ifThen(cmp('LT', v('angle'), n(0)), [set('angle', add(v('angle'), n(360)))]),
    ifThen(cmp('GTE', v('angle'), n(360)), [set('angle', sub(v('angle'), n(360)))]),
    set('dirX', sin(add(v('angle'), n(90)))),
    set('dirY', sin(v('angle'))),
    set('planeX', div(mul(neg(v('dirY')), n(2)), n(3))),
    set('planeY', div(mul(v('dirX'), n(2)), n(3))),
  ],
  '@turn',
);

const sinFn = funcRet(
  'sin',
  ['degrees'],
  [
    set('sinX', v('degrees')),
    ifThen(cmp('GTE', v('sinX'), n(360)), [set('sinX', sub(v('sinX'), n(360)))]),
    set('sinSign', n(1)),
    ifThen(cmp('GTE', v('sinX'), n(180)), [set('sinX', sub(v('sinX'), n(180))), set('sinSign', n(-1))]),
    set('sinP', mul(v('sinX'), sub(n(180), v('sinX')))),
  ],
  mul(v('sinSign'), div(v('sinP'), div(sub(n(10125), div(v('sinP'), n(4))), n(64)))),
  '@sin',
);

const isWallFn = funcRet('isWall', ['atX', 'atY'], [], not(tileEmpty(div(v('atX'), n(64)), div(v('atY'), n(64)))), '@isWall');

const speed = 10;
const wander = func(
  'wander',
  [
    set('pick', random(0, 3)),
    ifThen(cmp('EQ', v('pick'), n(0)), [velocity('ghost', n(speed), n(0))]),
    ifThen(cmp('EQ', v('pick'), n(1)), [velocity('ghost', n(-speed), n(0))]),
    ifThen(cmp('EQ', v('pick'), n(2)), [velocity('ghost', n(0), n(speed))]),
    ifThen(cmp('EQ', v('pick'), n(3)), [velocity('ghost', n(0), n(-speed))]),
  ],
  '@wander',
);

const chase = func(
  'chase',
  [
    set('dx', sub(div(v('posX'), n(8)), prop('ghost', 'x'))),
    set('dy', sub(div(v('posY'), n(8)), prop('ghost', 'y'))),
    ifThen(
      cmp('GT', abs(v('dx')), abs(v('dy'))),
      [ifThen(cmp('GT', v('dx'), n(0)), [velocity('ghost', n(speed), n(0))], [velocity('ghost', n(-speed), n(0))])],
      [ifThen(cmp('GT', v('dy'), n(0)), [velocity('ghost', n(0), n(speed))], [velocity('ghost', n(0), n(-speed))])],
    ),
  ],
  '@chase',
);

const spawn = func(
  'spawnGhost',
  [
    repeat(20, [
      set('col', random(1, 14)),
      set('row', random(1, 6)),
      ifThen(
        and(
          tileEmpty(v('col'), v('row')),
          cmp('GT', add(abs(sub(v('col'), div(v('posX'), n(64)))), abs(sub(v('row'), div(v('posY'), n(64))))), n(4)),
        ),
        [
          set('ghost', blk('ab_sprite_create', { f: { IMAGE: 'ghost', KIND: 'Enemy' } })),
          blk('ab_place_on_tile', { i: { SPRITE: v('ghost'), COL: v('col'), ROW: v('row') } }),
          call('wander'),
          breakLoop(),
        ],
      ),
    ]),
  ],
  '@spawn',
);

export const maze3d: TemplateSource = {
  id: 'maze3d',
  order: 4,
  title: { en: '3D ghost hunt', nb: '3D-spøkelsesjakt', es: 'Caza de fantasmas 3D', fr: 'Chasse aux fantômes 3D', de: '3D-Geisterjagd' },
  description: {
    en: 'Walk around a 3D maze and shoot the ghosts. Up and down walk, left and right turn, A shoots, hold B to see the map.',
    nb: 'Gå rundt i en 3D-labyrint og skyt spøkelsene. Opp og ned går, venstre og høyre snur, A skyter, hold B for å se kartet.',
    es: 'Recorre un laberinto 3D y dispara a los fantasmas. Arriba y abajo caminan, izquierda y derecha giran, A dispara, mantén B para ver el mapa.',
    fr: 'Parcours un labyrinthe 3D et tire sur les fantômes. Haut et bas pour marcher, gauche et droite pour tourner, A pour tirer, garde B pour voir la carte.',
    de: 'Lauf durch ein 3D-Labyrinth und schieß auf die Geister. Hoch und runter laufen, links und rechts drehen, A schießt, halte B für die Karte.',
  },
  tips: [
    { en: 'Build your own maze in the Tile map tab. The 3D view follows the map.', nb: 'Bygg din egen labyrint i fanen Tilekart. 3D-bildet følger kartet.', es: 'Construye tu propio laberinto en la pestaña Mapa. La vista 3D sigue el mapa.', fr: 'Construis ton propre labyrinthe dans l’onglet Carte. La vue 3D suit la carte.', de: 'Bau dein eigenes Labyrinth im Tab Karte. Die 3D-Ansicht folgt der Karte.' },
    { en: 'Hold B to see the world from above: it is the same map and sprites.', nb: 'Hold B for å se verden ovenfra: det er det samme kartet og de samme spritene.', es: 'Mantén B para ver el mundo desde arriba: es el mismo mapa con los mismos sprites.', fr: 'Garde B pour voir le monde d’en haut : c’est la même carte et les mêmes sprites.', de: 'Halte B, um die Welt von oben zu sehen: Es ist dieselbe Karte mit denselben Sprites.' },
    { en: 'Make the walls taller: change 4096 in "drawWalls".', nb: 'Gjør veggene høyere: endre 4096 i "drawWalls".', es: 'Haz las paredes más altas: cambia 4096 en "drawWalls".', fr: 'Rends les murs plus hauts : change 4096 dans « drawWalls ».', de: 'Mach die Wände höher: ändere 4096 in "drawWalls".' },
    { en: 'Make the ghosts faster: change 10 in "wander" and "chase".', nb: 'Gjør spøkelsene raskere: endre 10 i "wander" og "chase".', es: 'Haz los fantasmas más rápidos: cambia 10 en "wander" y "chase".', fr: 'Rends les fantômes plus rapides : change 10 dans « wander » et « chase ».', de: 'Mach die Geister schneller: ändere 10 in "wander" und "chase".' },
  ],
  strings: {
    en: {
      start: 'Load the maze and stand in the top left corner, looking right. posX and posY are in 1/64 of a tile, so walking is smooth.',
      turn: 'Angle in degrees. dirX and dirY point where you look (64 long). The camera plane (planeX, planeY) points to the right and sets how wide you see.',
      sin: 'Sine times 64, from a formula that only needs whole numbers (Bhaskara). Cosine is sine of the angle plus 90.',
      isWall: 'Is there a wall at this point? 64 units is one tile.',
      walk: 'Move one axis at a time and stop a little before walls, so you can slide along them.',
      update: 'Left and right turn, up and down walk. The invisible player sprite follows, so ghosts can touch you.',
      wander: 'Pick a random direction: right, left, down or up.',
      chase: 'Walk toward the player along the longest way.',
      think: 'Every 2 seconds each ghost chooses: mostly chase you, sometimes wander.',
      spawn: 'Find an empty tile far from the player and put a new ghost there.',
      walls: 'Ray casting: send one ray for every 2 pixel column and draw a wall line as tall as the wall is near.',
      ray: 'Direction of the ray: the look direction plus a part of the camera plane, from the left edge to the right edge of the screen.',
      dda: 'Walk from grid line to grid line (DDA) until the ray finds a wall. sideX and sideY are how far the ray goes to the next line.',
      height: 'Near walls are tall, far walls are short. dist is measured straight ahead, so walls do not bend (no fish eye).',
      shade: 'Walls facing east or west are full white. Walls facing north or south are drawn with stripes, so corners show.',
      edge: 'A black line where a new tile starts.',
      project: 'Where on the screen is a sprite? depth is how far in front of you, across is how far to the side.',
      sight: 'Look along the line to the sprite. If a wall is in between, it is hidden.',
      things: 'Draw the ghosts and bullets on top of the walls, bigger when they are near.',
      ghosts: 'A ghost: black edge, white body, two eyes, a mouth and a wavy bottom.',
      draw: 'Draw the 3D view, the gun and the cross hair. Hold B to see the map from above instead.',
      shoot: 'Shoot a bullet the way you look.',
      hit: 'A bullet hits a ghost: both disappear and you get a point.',
      hurt: 'A ghost touches you: you lose a life and the screen flashes.',
    },
    nb: {
      start: 'Last inn labyrinten og stå i øvre venstre hjørne, med blikket mot høyre. posX og posY er i 1/64 rute, så du går jevnt.',
      turn: 'Vinkel i grader. dirX og dirY peker dit du ser (64 lang). Kameraplanet (planeX, planeY) peker til høyre og bestemmer hvor bredt du ser.',
      sin: 'Sinus ganger 64, fra en formel som bare trenger hele tall (Bhaskara). Cosinus er sinus av vinkelen pluss 90.',
      isWall: 'Er det en vegg i dette punktet? 64 enheter er én rute.',
      walk: 'Flytt én akse om gangen og stopp litt før vegger, så du kan gli langs dem.',
      update: 'Venstre og høyre snur, opp og ned går. Den usynlige spillersprite-en følger med, så spøkelsene kan ta deg.',
      wander: 'Velg en tilfeldig retning: høyre, venstre, ned eller opp.',
      chase: 'Gå mot spilleren langs den lengste veien.',
      think: 'Hvert 2. sekund velger hvert spøkelse: som regel jage deg, noen ganger vandre.',
      spawn: 'Finn en tom rute langt fra spilleren og sett et nytt spøkelse der.',
      walls: 'Ray casting: send én stråle for hver kolonne på 2 piksler og tegn en vegglinje som er like høy som veggen er nær.',
      ray: 'Retningen til strålen: blikkretningen pluss en del av kameraplanet, fra venstre til høyre kant av skjermen.',
      dda: 'Gå fra rutelinje til rutelinje (DDA) til strålen treffer en vegg. sideX og sideY er hvor langt strålen går til neste linje.',
      height: 'Nære vegger er høye, fjerne vegger er lave. dist måles rett fram, så veggene ikke bøyer seg (ikke fiskeøye).',
      shade: 'Vegger mot øst eller vest er helt hvite. Vegger mot nord eller sør tegnes med striper, så hjørnene synes.',
      edge: 'En svart strek der en ny rute begynner.',
      project: 'Hvor på skjermen er en sprite? depth er hvor langt foran deg, across er hvor langt til siden.',
      sight: 'Se langs linjen til spriten. Står det en vegg imellom, er den skjult.',
      things: 'Tegn spøkelsene og skuddene oppå veggene, større når de er nære.',
      ghosts: 'Et spøkelse: svart kant, hvit kropp, to øyne, en munn og bølgete kant nederst.',
      draw: 'Tegn 3D-bildet, pistolen og siktet. Hold B for å se kartet ovenfra i stedet.',
      shoot: 'Skyt et skudd dit du ser.',
      hit: 'Et skudd treffer et spøkelse: begge forsvinner og du får et poeng.',
      hurt: 'Et spøkelse tar deg: du mister et liv og skjermen blinker.',
    },
    es: {
      start: 'Carga el laberinto y ponte en la esquina superior izquierda, mirando a la derecha. posX y posY van en 1/64 de casilla, así caminas suave.',
      turn: 'Ángulo en grados. dirX y dirY apuntan hacia donde miras (largo 64). El plano de la cámara (planeX, planeY) apunta a la derecha y decide cuánto ves de ancho.',
      sin: 'Seno por 64, con una fórmula que solo usa números enteros (Bhaskara). El coseno es el seno del ángulo más 90.',
      isWall: '¿Hay una pared en este punto? 64 unidades son una casilla.',
      walk: 'Mueve un eje cada vez y para un poco antes de las paredes, así puedes deslizarte junto a ellas.',
      update: 'Izquierda y derecha giran, arriba y abajo caminan. El sprite invisible del jugador te sigue para que los fantasmas puedan tocarte.',
      wander: 'Elige una dirección al azar: derecha, izquierda, abajo o arriba.',
      chase: 'Camina hacia el jugador por el camino más largo.',
      think: 'Cada 2 segundos cada fantasma decide: casi siempre te persigue, a veces pasea.',
      spawn: 'Busca una casilla vacía lejos del jugador y pon allí un fantasma nuevo.',
      walls: 'Ray casting: lanza un rayo por cada columna de 2 píxeles y dibuja una línea de pared tan alta como cerca esté la pared.',
      ray: 'Dirección del rayo: la dirección de la mirada más una parte del plano de la cámara, del borde izquierdo al derecho de la pantalla.',
      dda: 'Avanza de línea en línea de la cuadrícula (DDA) hasta que el rayo encuentra una pared. sideX y sideY son lo que falta hasta la siguiente línea.',
      height: 'Las paredes cercanas son altas y las lejanas bajas. dist se mide hacia delante, así las paredes no se curvan (sin ojo de pez).',
      shade: 'Las paredes que miran al este o al oeste son blancas. Las que miran al norte o al sur llevan rayas, así se ven las esquinas.',
      edge: 'Una línea negra donde empieza una casilla nueva.',
      project: '¿Dónde está un sprite en la pantalla? depth es cuánto está delante de ti, across cuánto a un lado.',
      sight: 'Mira por la línea hasta el sprite. Si hay una pared en medio, queda oculto.',
      things: 'Dibuja los fantasmas y las balas sobre las paredes, más grandes cuando están cerca.',
      ghosts: 'Un fantasma: borde negro, cuerpo blanco, dos ojos, una boca y el borde de abajo ondulado.',
      draw: 'Dibuja la vista 3D, la pistola y la mira. Mantén B para ver el mapa desde arriba.',
      shoot: 'Dispara una bala hacia donde miras.',
      hit: 'Una bala toca un fantasma: los dos desaparecen y ganas un punto.',
      hurt: 'Un fantasma te toca: pierdes una vida y la pantalla parpadea.',
    },
    fr: {
      start: 'Charge le labyrinthe et place-toi en haut à gauche, en regardant à droite. posX et posY sont en 1/64 de case, pour marcher en douceur.',
      turn: 'Angle en degrés. dirX et dirY pointent là où tu regardes (longueur 64). Le plan de la caméra (planeX, planeY) pointe à droite et fixe la largeur de la vue.',
      sin: 'Sinus fois 64, avec une formule qui n’utilise que des nombres entiers (Bhaskara). Le cosinus est le sinus de l’angle plus 90.',
      isWall: 'Y a-t-il un mur à ce point ? 64 unités font une case.',
      walk: 'Bouge un axe à la fois et arrête-toi un peu avant les murs, pour glisser le long d’eux.',
      update: 'Gauche et droite tournent, haut et bas avancent. Le sprite invisible du joueur suit, pour que les fantômes puissent te toucher.',
      wander: 'Choisis une direction au hasard : droite, gauche, bas ou haut.',
      chase: 'Marche vers le joueur dans la direction la plus longue.',
      think: 'Toutes les 2 secondes chaque fantôme choisit : le plus souvent il te poursuit, parfois il se promène.',
      spawn: 'Trouve une case vide loin du joueur et places-y un nouveau fantôme.',
      walls: 'Ray casting : lance un rayon pour chaque colonne de 2 pixels et dessine un trait de mur aussi haut que le mur est proche.',
      ray: 'Direction du rayon : la direction du regard plus une partie du plan de la caméra, du bord gauche au bord droit de l’écran.',
      dda: 'Avance de ligne en ligne de la grille (DDA) jusqu’à ce que le rayon trouve un mur. sideX et sideY disent combien il reste jusqu’à la ligne suivante.',
      height: 'Les murs proches sont hauts, les murs lointains bas. dist est mesuré droit devant, donc les murs ne se courbent pas (pas d’œil de poisson).',
      shade: 'Les murs tournés vers l’est ou l’ouest sont blancs. Ceux tournés vers le nord ou le sud ont des rayures, pour voir les coins.',
      edge: 'Un trait noir là où commence une nouvelle case.',
      project: 'Où est un sprite sur l’écran ? depth dit à quelle distance devant toi, across à quelle distance sur le côté.',
      sight: 'Regarde le long de la ligne jusqu’au sprite. S’il y a un mur entre vous, il est caché.',
      things: 'Dessine les fantômes et les balles par-dessus les murs, plus grands quand ils sont proches.',
      ghosts: 'Un fantôme : bord noir, corps blanc, deux yeux, une bouche et le bas ondulé.',
      draw: 'Dessine la vue 3D, le pistolet et le viseur. Garde B pour voir la carte d’en haut.',
      shoot: 'Tire une balle là où tu regardes.',
      hit: 'Une balle touche un fantôme : les deux disparaissent et tu gagnes un point.',
      hurt: 'Un fantôme te touche : tu perds une vie et l’écran clignote.',
    },
    de: {
      start: 'Lade das Labyrinth und stell dich in die Ecke oben links, Blick nach rechts. posX und posY sind in 1/64 Feld, damit du weich läufst.',
      turn: 'Winkel in Grad. dirX und dirY zeigen, wohin du schaust (Länge 64). Die Kameraebene (planeX, planeY) zeigt nach rechts und legt fest, wie breit du siehst.',
      sin: 'Sinus mal 64, mit einer Formel, die nur ganze Zahlen braucht (Bhaskara). Kosinus ist der Sinus des Winkels plus 90.',
      isWall: 'Ist an diesem Punkt eine Wand? 64 Einheiten sind ein Feld.',
      walk: 'Beweg eine Achse nach der anderen und halte kurz vor Wänden an, damit du an ihnen entlanggleitest.',
      update: 'Links und rechts drehen, hoch und runter laufen. Das unsichtbare Spieler-Sprite folgt, damit Geister dich berühren können.',
      wander: 'Wähle eine zufällige Richtung: rechts, links, runter oder hoch.',
      chase: 'Lauf zum Spieler, entlang der längeren Richtung.',
      think: 'Alle 2 Sekunden entscheidet jeder Geist: meistens jagt er dich, manchmal wandert er.',
      spawn: 'Such ein leeres Feld weit weg vom Spieler und setz dort einen neuen Geist hin.',
      walls: 'Ray Casting: Schick einen Strahl für jede Spalte von 2 Pixeln und zeichne einen Wandstrich, der so hoch ist, wie nah die Wand ist.',
      ray: 'Richtung des Strahls: die Blickrichtung plus ein Teil der Kameraebene, vom linken bis zum rechten Bildschirmrand.',
      dda: 'Geh von Gitterlinie zu Gitterlinie (DDA), bis der Strahl eine Wand trifft. sideX und sideY sagen, wie weit es bis zur nächsten Linie ist.',
      height: 'Nahe Wände sind hoch, ferne Wände niedrig. dist wird geradeaus gemessen, deshalb biegen sich die Wände nicht (kein Fischauge).',
      shade: 'Wände nach Osten oder Westen sind ganz weiß. Wände nach Norden oder Süden haben Streifen, damit man die Ecken sieht.',
      edge: 'Ein schwarzer Strich, wo ein neues Feld anfängt.',
      project: 'Wo auf dem Bildschirm ist ein Sprite? depth ist, wie weit vor dir, across, wie weit zur Seite.',
      sight: 'Schau die Linie entlang bis zum Sprite. Ist eine Wand dazwischen, ist es versteckt.',
      things: 'Zeichne die Geister und Kugeln über die Wände, größer, wenn sie nah sind.',
      ghosts: 'Ein Geist: schwarzer Rand, weißer Körper, zwei Augen, ein Mund und ein welliger Saum.',
      draw: 'Zeichne die 3D-Ansicht, die Pistole und das Fadenkreuz. Halte B, um stattdessen die Karte von oben zu sehen.',
      shoot: 'Schieß eine Kugel in Blickrichtung.',
      hit: 'Eine Kugel trifft einen Geist: beide verschwinden und du bekommst einen Punkt.',
      hurt: 'Ein Geist berührt dich: Du verlierst ein Leben und der Bildschirm blinkt.',
    },
  },
  kinds: [],
  images: [
    { id: 'me', name: 'me', width: 4, height: 4, frames: [['.11.', '1111', '1111', '.11.']] },
    { id: 'ghost', name: 'ghost', width: 6, height: 6, frames: [['.1111.', '111111', '1.11.1', '111111', '111111', '1.11.1']] },
    { id: 'bullet', name: 'bullet', width: 2, height: 2, frames: [['11', '11']] },
    {
      id: 'gun',
      name: 'gun',
      width: 16,
      height: 12,
      frames: [[
        '......0110......',
        '.....011110.....',
        '.....010010.....',
        '....01111110....',
        '....01011010....',
        '...0111111110...',
        '...0110110110...',
        '..011111111110..',
        '..011011110110..',
        '.01111111111110.',
        '.01111111111110.',
        '0111111111111110',
      ]],
    },
    { id: 'flash', name: 'flash', width: 8, height: 6, frames: [['...11...', '.1.11.1.', '..1111..', '111..111', '..1111..', '.1.11.1.']] },
  ],
  tiles: [
    { id: 'wall', name: 'wall', solid: true, pixels: ['11111111', '1...1...', '1...1...', '11111111', '..1...1.', '..1...1.', '11111111', '1...1...'] },
    { id: 'ghostStart', name: 'ghost start', solid: false, pixels: ['..1111..', '.111111.', '11.11.11', '11111111', '11111111', '11111111', '1.1..1.1', '........'] },
  ],
  tilemaps: [{ id: 'maze', name: 'maze', width: 16, height: 8, cells: MAP.flatMap((row) => [...row].map((c) => CELL[c])) }],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        blk('ab_set_tilemap', { f: { MAP: 'maze' } }),
        set('posX', n(96)),
        set('posY', n(96)),
        set('angle', n(0)),
        call('turn'),
        set('me', blk('ab_sprite_create', { f: { IMAGE: 'me', KIND: 'Player' } })),
        blk('ab_spawn_on_tiles', { f: { TILE: 'ghostStart', IMAGE: 'ghost', KIND: 'Enemy' } }),
        forKind('ghost', 'Enemy', [call('wander')]),
        blk('ab_life_set', { i: { VALUE: n(3) } }),
        blk('ab_score_set', { i: { VALUE: n(0) } }),
      ],
    }),
    blk('ab_on_update', {
      comment: '@update',
      body: [
        ifThen(pressed('left'), [set('angle', sub(v('angle'), n(5))), call('turn')]),
        ifThen(pressed('right'), [set('angle', add(v('angle'), n(5))), call('turn')]),
        ifThen(pressed('up'), [set('moveX', div(v('dirX'), n(16))), set('moveY', div(v('dirY'), n(16))), call('walk')]),
        ifThen(pressed('down'), [set('moveX', div(neg(v('dirX')), n(16))), set('moveY', div(neg(v('dirY')), n(16))), call('walk')]),
        blk('ab_sprite_set_position', { i: { SPRITE: v('me'), X: div(v('posX'), n(8)), Y: div(v('posY'), n(8)) } }),
        forKind('ghost', 'Enemy', [
          ifThen(or(or(hitting('ghost', 'left'), hitting('ghost', 'right')), or(hitting('ghost', 'top'), hitting('ghost', 'bottom'))), [call('wander')]),
        ]),
        ifThen(cmp('GT', v('hurt'), n(0)), [
          set('hurt', sub(v('hurt'), n(1))),
          ifThen(cmp('EQ', v('hurt'), n(0)), [blk('ab_invert', { f: { ON: 'off' } })]),
        ]),
      ],
    }),
    blk('ab_on_draw', {
      comment: '@draw',
      body: [
        ifThen(
          not(pressed('b')),
          [
            call('drawWalls'),
            call('drawThings'),
            rect(n(0), n(0), add(mul(blk('ab_life'), n(7)), n(1)), n(7), 'black'),
            line(n(61), n(32), n(67), n(32), 'invert'),
            line(n(64), n(29), n(64), n(35), 'invert'),
            ifThen(cmp('GT', v('flash'), n(0)), [image('flash', 60, 45), set('flash', sub(v('flash'), n(1)))]),
            image('gun', 56, 52),
          ],
          [line(div(v('posX'), n(8)), div(v('posY'), n(8)), add(div(v('posX'), n(8)), div(v('dirX'), n(8))), add(div(v('posY'), n(8)), div(v('dirY'), n(8))))],
        ),
      ],
    }),
    blk('ab_on_button', {
      f: { BUTTON: 'a', EVENT: 'pressed' },
      comment: '@shoot',
      body: [
        set('shot', blk('ab_sprite_projectile', { f: { IMAGE: 'bullet' }, i: { FROM: v('me'), VX: mul(v('dirX'), n(2)), VY: mul(v('dirY'), n(2)) } })),
        set('flash', n(3)),
        sfx('shoot'),
      ],
    }),
    blk('ab_on_every', {
      f: { MS: 2000 },
      comment: '@think',
      body: [
        forKind('ghost', 'Enemy', [ifThen(cmp('EQ', random(0, 2), n(0)), [call('wander')], [call('chase')])]),
        set('ghosts', n(0)),
        forKind('ghost', 'Enemy', [set('ghosts', add(v('ghosts'), n(1)))]),
        ifThen(cmp('LT', v('ghosts'), n(4)), [call('spawnGhost')]),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Projectile', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@hit',
      body: [
        blk('ab_sprite_destroy', { i: { SPRITE: v('sprite') } }),
        blk('ab_sprite_destroy', { i: { SPRITE: v('otherSprite') } }),
        blk('ab_score_change', { i: { VALUE: n(1) } }),
        sfx('explosion'),
      ],
    }),
    blk('ab_on_overlap', {
      f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Enemy' },
      comment: '@hurt',
      body: [
        blk('ab_sprite_destroy', { i: { SPRITE: v('otherSprite') } }),
        blk('ab_invert', { f: { ON: 'on' } }),
        set('hurt', n(4)),
        sfx('hit'),
        blk('ab_life_change', { i: { VALUE: n(-1) } }),
      ],
    }),
    turn,
    sinFn,
    walk,
    isWallFn,
    wander,
    chase,
    spawn,
    castRays,
    project,
    drawThings,
  ]),
};
