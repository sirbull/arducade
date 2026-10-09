// Match three: swap two neighbours to make lines of three or more.
// Blocks have no lists, and the device only remembers 8 changed tiles. So the
// board lives in tile map rows below the screen: each layer holds one on/off
// tile per square. Setting a tile back to its own picture or to empty only
// flips a bit in RAM, so every square can change as often as it likes.
import { and, arith, blk, bool, callRet, chain, cmp, forRange, funcRet, get, ifThen, minmax, neg, not, num, or, set, txt, whileDo, workspace, type B } from './dsl';
import type { TemplateSource } from './types';

const W = 8, H = 5, CELL = 10, OX = 24, OY = 2;
const MEM = 8; // first tile map row of the hidden layers, just below the screen
const PLAY = 0, SHOW = 1, FALL = 2, SWAP = 3, BACK = 4;
const STEP = 2; // pixels a swapped figure slides each frame
const BOMB = 6, PRISM = 7;
// Layers 0-2 hold the figure number (1 + 2 + 4), 3-5 are marks for the next clear.
const LAYERS = ['bit1', 'bit2', 'bit4', 'gone', 'newBomb', 'newPrism'];
const GEMS = ['heart', 'cheese', 'gift', 'drop', 'star', 'bomb', 'prism'];

const n = num, v = get;
const add = (a: B, b: B) => arith('ADD', a, b), sub = (a: B, b: B) => arith('MINUS', a, b), mul = (a: B, b: B) => arith('MULTIPLY', a, b);
const eq = (a: B, b: B | number) => cmp('EQ', a, typeof b === 'number' ? n(b) : b);
const mod = (a: B, b: number) => blk('math_modulo', { i: { DIVIDEND: a, DIVISOR: n(b) } });
const inc = (name: string, by: B | number = 1) => set(name, add(v(name), typeof by === 'number' ? n(by) : by));
const inBoard = (x: B, y: B) => and(and(cmp('GTE', x, n(0)), cmp('LT', x, n(W))), and(cmp('GTE', y, n(0)), cmp('LT', y, n(H))));
const layerRow = (layer: number, y: B) => add(y, n(MEM + layer * H));
const isOn = (layer: number, x: B, y: B) => blk('ab_tile_is', { f: { TILE: LAYERS[layer] }, i: { COL: x, ROW: layerRow(layer, y) } });
const setBit = (layer: number, x: B, y: B, on: boolean) => blk('ab_set_tile', { f: { TILE: on ? LAYERS[layer] : 'empty' }, i: { COL: x, ROW: layerRow(layer, y) } });
const each = (xv: string, yv: string, body: B[]) => forRange(yv, n(0), n(H - 1), [forRange(xv, n(0), n(W - 1), body)]);
const text = (x: number, y: number, t: B) => blk('ab_draw_text', { f: { COLOR: 'white' }, i: { X: n(x), Y: n(y), TEXT: t } });
const sound = (s: string) => blk('ab_play_effect', { f: { SFX: s } });
const image = (id: string, x: B, y: B) => blk('ab_draw_image', { f: { IMAGE: id }, i: { X: x, Y: y } });

// Functions with inputs. Inputs are local; every other variable is shared, so
// each function uses its own variable names.
function proc(name: string, params: string[], body: B[], comment?: string): B {
  const b = blk('procedures_defnoreturn', { f: { NAME: name }, comment, extra: { params: params.map((p) => ({ name: p })) } });
  b.inputs = { STACK: { block: chain(body) } };
  return b;
}
const run = (name: string, params: string[], args: B[]): B => ({
  type: 'procedures_callnoreturn',
  extraState: { name, params },
  inputs: Object.fromEntries(args.map((a, i) => [`ARG${i}`, { block: a }])),
});
const read = (x: B, y: B) => callRet('readCell', ['rx', 'ry'], [x, y]);
const write = (x: B, y: B, k: B | number) => run('writeCell', ['wx', 'wy', 'wk'], [x, y, typeof k === 'number' ? n(k) : k]);
const swap = (ax: B, ay: B, bx: B, by: B) => run('swapCells', ['ax', 'ay', 'bx', 'by'], [ax, ay, bx, by]);
const matchAt = (x: B, y: B) => callRet('matchAt', ['mx', 'my'], [x, y]);
const callProc = (name: string) => run(name, [], []);
const randomKind = () => blk('ab_random', { i: { FROM: n(1), TO: v('kinds') } });
// Draws the figure k of square (x, y), moved by (ox, oy) pixels.
const gemAt = (k: B, x: B, y: B, ox: B, oy: B) =>
  run('drawGem', ['dk', 'gemX', 'gemY'], [k, add(add(n(OX), mul(x, n(CELL))), ox), add(add(n(OY), mul(y, n(CELL))), oy)]);
const show = () => [set('state', n(SHOW)), set('timer', n(12))];

// Looks for lines along one direction: rows when dx is 1, columns when dy is 1.
function findLines(dx: number, dy: number): B {
  const lines = dx ? H : W, len = dx ? W : H;
  const x = (step: B) => (dx ? add(v('fp'), step) : v('fl'));
  const y = (step: B) => (dx ? v('fl') : add(v('fp'), step));
  return forRange('fl', n(0), n(lines - 1), [
    set('fp', n(0)),
    whileDo(cmp('LT', v('fp'), n(len)), [
      set('fk', read(x(n(0)), y(n(0)))),
      set('fn', n(1)),
      whileDo(and(cmp('LT', add(v('fp'), v('fn')), n(len)), eq(read(x(v('fn')), y(v('fn'))), v('fk'))), [inc('fn')]),
      ifThen(and(cmp('GTE', v('fn'), n(3)), and(cmp('GTE', v('fk'), n(1)), cmp('LTE', v('fk'), n(BOMB)))), [
        run('markRun', ['rx0', 'ry0', 'rdx', 'rdy', 'rn', 'rk'], [x(n(0)), y(n(0)), n(dx), n(dy), v('fn'), v('fk')]),
      ]),
      inc('fp', v('fn')),
    ]),
  ]);
}

const directions = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]] as const;
const digit = (rows: string[]) => [...rows, '........'];

export const match3: TemplateSource = {
  id: 'match3',
  order: 7,
  title: { en: 'Match three', nb: 'Tre på rad', es: 'Tres en raya', fr: 'Trois d’affilée', de: 'Drei gewinnt' },
  description: {
    en: 'Swap figures to make lines of three. Four makes a bomb, five makes a prism. The game ends when no swap makes a line.',
    nb: 'Bytt figurer for å få tre på rad. Fire gir en bombe, fem gir et prisme. Spillet er slutt når ingen bytter gir tre på rad.',
    es: 'Intercambia figuras para hacer líneas de tres. Cuatro dan una bomba, cinco un prisma. El juego acaba cuando ningún cambio hace una línea.',
    fr: 'Échange des figures pour aligner trois. Quatre donnent une bombe, cinq un prisme. La partie finit quand aucun échange ne fait de ligne.',
    de: 'Tausche Figuren, um drei in einer Reihe zu bekommen. Vier geben eine Bombe, fünf ein Prisma. Das Spiel endet, wenn kein Tausch eine Reihe ergibt.',
  },
  tips: [
    {
      en: 'Move the frame with the arrows. Press A to pick a figure, then an arrow to swap it. B lets go.',
      nb: 'Flytt rammen med pilene. Trykk A for å velge en figur, og så en pil for å bytte den. B slipper.',
      es: 'Mueve el marco con las flechas. Pulsa A para elegir una figura y luego una flecha para cambiarla. B la suelta.',
      fr: 'Déplace le cadre avec les flèches. Appuie sur A pour choisir une figure, puis sur une flèche pour l’échanger. B la lâche.',
      de: 'Beweg den Rahmen mit den Pfeilen. Drück A, um eine Figur zu wählen, dann einen Pfeil zum Tauschen. B lässt los.',
    },
    {
      en: 'Three bombs in a line blow up everything near them. Swap a prism with a figure to clear all figures of that kind.',
      nb: 'Tre bomber på rad sprenger alt rundt seg. Bytt et prisme med en figur for å fjerne alle figurer av den typen.',
      es: 'Tres bombas en línea explotan todo lo que hay cerca. Cambia un prisma con una figura para quitar todas las de ese tipo.',
      fr: 'Trois bombes alignées font exploser tout autour. Échange un prisme avec une figure pour enlever toutes celles de ce type.',
      de: 'Drei Bomben in einer Reihe sprengen alles in der Nähe. Tausch ein Prisma mit einer Figur, um alle Figuren dieser Art zu entfernen.',
    },
    {
      en: 'Make the game easier: change kinds from 5 to 4. Make bombs stronger: change blast from 2 to 3.',
      nb: 'Gjør spillet lettere: endre kinds fra 5 til 4. Gjør bombene sterkere: endre blast fra 2 til 3.',
      es: 'Haz el juego más fácil: cambia kinds de 5 a 4. Bombas más fuertes: cambia blast de 2 a 3.',
      fr: 'Rends le jeu plus facile : change kinds de 5 à 4. Des bombes plus fortes : change blast de 2 à 3.',
      de: 'Mach das Spiel leichter: ändere kinds von 5 auf 4. Stärkere Bomben: ändere blast von 2 auf 3.',
    },
  ],
  strings: {
    en: {
      start: 'The board is stored in the tile map rows below the screen. Each square keeps its figure number as three on/off tiles: 1, 2 and 4.',
      read: 'Adds up the on/off tiles of a square to get its figure: 0 is empty, 1-5 are figures, 6 is a bomb and 7 is a prism.',
      write: 'Turns the three tiles of a square on or off so they add up to the figure number.',
      find: 'Walks along every row and column. Three or more of the same figure in a line get marked.',
      mark: 'Marks a line to be cleared. Four make a bomb and five make a prism. Three bombs blow up everything within blast squares.',
      moves: 'Tries every swap of two neighbours. If none makes a line (and there is no prism), the game is over.',
      fall: 'Every other frame, figures above an empty square fall one step and new figures appear at the top.',
      draw: 'Draws the figures, the frame, the score and the best score.',
    },
    nb: {
      start: 'Brettet lagres i tilekartet under skjermen. Hver rute husker figurnummeret sitt som tre av/på-ruter: 1, 2 og 4.',
      read: 'Legger sammen av/på-rutene for en rute og finner figuren: 0 er tom, 1-5 er figurer, 6 er bombe og 7 er prisme.',
      write: 'Slår de tre rutene for en rute av eller på slik at de blir figurnummeret til sammen.',
      find: 'Går gjennom alle rader og kolonner. Tre eller flere like figurer på rad blir merket.',
      mark: 'Merker en rad som skal fjernes. Fire gir en bombe og fem gir et prisme. Tre bomber sprenger alt innenfor blast ruter.',
      moves: 'Prøver alle bytter av to naboer. Gir ingen av dem tre på rad (og det ikke finnes et prisme), er spillet slutt.',
      fall: 'Annethvert bilde faller figurer over en tom rute ett steg, og nye figurer kommer inn på toppen.',
      draw: 'Tegner figurene, rammen, poengene og rekorden.',
    },
    es: {
      start: 'El tablero se guarda en las filas del mapa debajo de la pantalla. Cada casilla guarda su número de figura como tres casillas encendidas o apagadas: 1, 2 y 4.',
      read: 'Suma las casillas encendidas de una casilla para saber su figura: 0 es vacía, 1-5 son figuras, 6 es una bomba y 7 un prisma.',
      write: 'Enciende o apaga las tres casillas para que sumen el número de la figura.',
      find: 'Recorre todas las filas y columnas. Tres o más figuras iguales en línea quedan marcadas.',
      mark: 'Marca una línea para quitarla. Cuatro dan una bomba y cinco un prisma. Tres bombas explotan todo a blast casillas.',
      moves: 'Prueba todos los cambios entre vecinos. Si ninguno hace una línea (y no hay prisma), se acaba el juego.',
      fall: 'Cada dos imágenes, las figuras sobre una casilla vacía caen un paso y aparecen figuras nuevas arriba.',
      draw: 'Dibuja las figuras, el marco, los puntos y el récord.',
    },
    fr: {
      start: 'Le plateau est gardé dans les lignes de la carte sous l’écran. Chaque case garde son numéro de figure avec trois tuiles allumées ou éteintes : 1, 2 et 4.',
      read: 'Additionne les tuiles allumées d’une case pour trouver sa figure : 0 est vide, 1-5 sont des figures, 6 une bombe et 7 un prisme.',
      write: 'Allume ou éteint les trois tuiles pour qu’elles fassent le numéro de la figure.',
      find: 'Parcourt toutes les lignes et colonnes. Trois figures pareilles ou plus alignées sont marquées.',
      mark: 'Marque une ligne à enlever. Quatre donnent une bombe et cinq un prisme. Trois bombes font tout exploser à blast cases.',
      moves: 'Essaie chaque échange entre voisins. Si aucun ne fait de ligne (et qu’il n’y a pas de prisme), la partie est finie.',
      fall: 'Une image sur deux, les figures au-dessus d’une case vide tombent d’un cran et de nouvelles arrivent en haut.',
      draw: 'Dessine les figures, le cadre, les points et le record.',
    },
    de: {
      start: 'Das Brett steht in den Zeilen der Karte unter dem Bildschirm. Jedes Feld merkt sich seine Figurnummer als drei An/Aus-Kacheln: 1, 2 und 4.',
      read: 'Zählt die An/Aus-Kacheln eines Feldes zusammen: 0 ist leer, 1-5 sind Figuren, 6 ist eine Bombe und 7 ein Prisma.',
      write: 'Schaltet die drei Kacheln eines Feldes an oder aus, sodass sie zusammen die Figurnummer ergeben.',
      find: 'Geht alle Zeilen und Spalten durch. Drei oder mehr gleiche Figuren in einer Reihe werden markiert.',
      mark: 'Markiert eine Reihe zum Entfernen. Vier geben eine Bombe, fünf ein Prisma. Drei Bomben sprengen alles im Umkreis von blast Feldern.',
      moves: 'Probiert jeden Tausch zweier Nachbarn. Ergibt keiner eine Reihe (und gibt es kein Prisma), ist das Spiel vorbei.',
      fall: 'Jedes zweite Bild fallen Figuren über einem leeren Feld einen Schritt, und oben kommen neue dazu.',
      draw: 'Zeichnet die Figuren, den Rahmen, die Punkte und den Rekord.',
    },
  },
  kinds: [],
  images: [
    ['heart', ['.11...11.', '1111.1111', '111111111', '111111111', '.1111111.', '..11111..', '...111...', '....1....', '.........']],
    ['cheese', ['........1', '......111', '....11111', '..1111111', '111111111', '11.111.11', '111111.11', '111111111', '.........']],
    ['gift', ['111111111', '1...1...1', '1...1...1', '111111111', '1...1...1', '1...1...1', '1...1...1', '111111111', '.........']],
    ['drop', ['....1....', '....1....', '...111...', '..11111..', '.1111111.', '.1.111111', '.1.111111', '..11111..', '...111...']],
    ['star', ['....1....', '....1....', '...111...', '111111111', '.1111111.', '..11111..', '..11.11..', '.11...11.', '.1.....1.']],
    ['bomb', ['......1.1', '.....1...', '..11111..', '.1111111.', '11.111111', '11.111111', '111111111', '.1111111.', '..11111..']],
    ['prism', ['..11111..', '.1.1.1.1.', '11.1.1.11', '1.1.1.1.1', '11.1.1.11', '1.1.1.1.1', '11.1.1.11', '.1.1.1.1.', '..11111..']],
  ].map(([id, pixels]) => ({ id: id as string, name: id as string, width: 9, height: 9, frames: [pixels as string[]] })),
  tiles: [
    ['bit1', digit(['...11...', '..111...', '...11...', '...11...', '...11...', '..1111..', '........'])],
    ['bit2', digit(['..111...', '.1...1..', '.....1..', '...11...', '..1.....', '.11111..', '........'])],
    ['bit4', digit(['....1...', '...11...', '..1.1...', '.1..1...', '.11111..', '....1...', '........'])],
    ['gone', digit(['.1...1..', '..1.1...', '...1....', '..1.1...', '.1...1..', '........', '........'])],
    ['newBomb', digit(['.1111...', '.1...1..', '.1111...', '.1...1..', '.1...1..', '.1111...', '........'])],
    ['newPrism', digit(['.1111...', '.1...1..', '.1...1..', '.1111...', '.1......', '.1......', '........'])],
  ].map(([id, pixels]) => ({ id: id as string, name: id as string, solid: false, pixels: pixels as string[] })),
  tilemaps: [{
    id: 'memory',
    name: 'memory',
    width: W,
    height: MEM + LAYERS.length * H,
    cells: Array.from({ length: W * (MEM + LAYERS.length * H) }, (_, i) => {
      const row = Math.floor(i / W);
      return row < MEM ? 0 : Math.floor((row - MEM) / H) + 1;
    }),
  }],
  blocks: workspace([
    blk('ab_on_start', {
      comment: '@start',
      body: [
        blk('ab_splash_screen', {
          body: [
            text(31, 4, txt('MATCH THREE')),
            ...GEMS.map((id, i) => image(id, n(20 + i * 13), n(18))),
            text(10, 34, txt('4 = BOMB  5 = PRISM')),
            text(31, 50, txt('PRESS A')),
          ],
        }),
        blk('ab_set_tilemap', { f: { MAP: 'memory' } }),
        set('kinds', n(5)),
        set('blast', n(2)),
        set('points', n(0)),
        set('combo', n(0)),
        set('cx', n(W / 2 - 1)),
        set('cy', n(Math.floor(H / 2))),
        set('selected', bool(false)),
        set('state', n(PLAY)),
        set('timer', n(0)),
        callProc('fillBoard'),
      ],
    }),
    funcRet('readCell', ['rx', 'ry'], [
      set('cell', n(0)),
      ifThen(inBoard(v('rx'), v('ry')), [
        ifThen(isOn(0, v('rx'), v('ry')), [inc('cell', 1)]),
        ifThen(isOn(1, v('rx'), v('ry')), [inc('cell', 2)]),
        ifThen(isOn(2, v('rx'), v('ry')), [inc('cell', 4)]),
      ]),
    ], v('cell'), '@read'),
    proc('writeCell', ['wx', 'wy', 'wk'], [
      ifThen(eq(mod(v('wk'), 2), 1), [setBit(0, v('wx'), v('wy'), true)], [setBit(0, v('wx'), v('wy'), false)]),
      ifThen(eq(mod(arith('DIVIDE', v('wk'), n(2)), 2), 1), [setBit(1, v('wx'), v('wy'), true)], [setBit(1, v('wx'), v('wy'), false)]),
      ifThen(cmp('GTE', v('wk'), n(4)), [setBit(2, v('wx'), v('wy'), true)], [setBit(2, v('wx'), v('wy'), false)]),
    ], '@write'),
    proc('swapCells', ['ax', 'ay', 'bx', 'by'], [
      set('sa', read(v('ax'), v('ay'))),
      set('sb', read(v('bx'), v('by'))),
      write(v('ax'), v('ay'), v('sb')),
      write(v('bx'), v('by'), v('sa')),
    ]),
    proc('fillBoard', [], [
      set('ready', n(0)),
      whileDo(eq(v('ready'), 0), [
        each('ix', 'iy', [
          set('ik', randomKind()),
          // Pick again while this figure would finish a line of three.
          whileDo(or(
            and(eq(read(sub(v('ix'), n(1)), v('iy')), v('ik')), eq(read(sub(v('ix'), n(2)), v('iy')), v('ik'))),
            and(eq(read(v('ix'), sub(v('iy'), n(1))), v('ik')), eq(read(v('ix'), sub(v('iy'), n(2))), v('ik'))),
          ), [set('ik', randomKind())]),
          write(v('ix'), v('iy'), v('ik')),
        ]),
        set('ready', callRet('hasMove', [], [])),
      ]),
    ]),
    funcRet('matchAt', ['mx', 'my'], [
      set('lined', n(0)),
      set('mk', read(v('mx'), v('my'))),
      ifThen(and(cmp('GTE', v('mk'), n(1)), cmp('LTE', v('mk'), n(BOMB))), [
        forRange('ma', n(0), n(1), [
          set('mdx', sub(n(1), v('ma'))),
          set('mdy', v('ma')),
          set('mn', n(1)),
          set('mi', n(1)),
          whileDo(eq(read(sub(v('mx'), mul(v('mi'), v('mdx'))), sub(v('my'), mul(v('mi'), v('mdy')))), v('mk')), [inc('mn'), inc('mi')]),
          set('mi', n(1)),
          whileDo(eq(read(add(v('mx'), mul(v('mi'), v('mdx'))), add(v('my'), mul(v('mi'), v('mdy')))), v('mk')), [inc('mn'), inc('mi')]),
          ifThen(cmp('GTE', v('mn'), n(3)), [set('lined', n(1))]),
        ]),
      ]),
    ], v('lined')),
    funcRet('hasMove', [], [
      set('moves', n(0)),
      each('hx', 'hy', [
        ifThen(eq(read(v('hx'), v('hy')), PRISM), [set('moves', n(1))]),
        forRange('hd', n(0), n(1), [
          set('hx2', add(v('hx'), sub(n(1), v('hd')))),
          set('hy2', add(v('hy'), v('hd'))),
          ifThen(and(eq(v('moves'), 0), inBoard(v('hx2'), v('hy2'))), [
            swap(v('hx'), v('hy'), v('hx2'), v('hy2')),
            ifThen(or(cmp('GT', matchAt(v('hx'), v('hy')), n(0)), cmp('GT', matchAt(v('hx2'), v('hy2')), n(0))), [set('moves', n(1))]),
            swap(v('hx'), v('hy'), v('hx2'), v('hy2')),
          ]),
        ]),
      ]),
    ], v('moves'), '@moves'),
    proc('clearMarks', [], [
      each('ex', 'ey', [setBit(3, v('ex'), v('ey'), false), setBit(4, v('ex'), v('ey'), false), setBit(5, v('ex'), v('ey'), false)]),
    ]),
    proc('findMatches', [], [
      set('found', n(0)),
      callProc('clearMarks'),
      findLines(1, 0),
      findLines(0, 1),
    ], '@find'),
    proc('markRun', ['rx0', 'ry0', 'rdx', 'rdy', 'rn', 'rk'], [
      set('found', n(1)),
      // The new bomb or prism goes where the player moved, or else second in the line.
      set('spot', n(1)),
      forRange('ri', n(0), sub(v('rn'), n(1)), [
        set('px', add(v('rx0'), mul(v('ri'), v('rdx')))),
        set('py', add(v('ry0'), mul(v('ri'), v('rdy')))),
        setBit(3, v('px'), v('py'), true),
        ifThen(or(and(eq(v('px'), v('fromX')), eq(v('py'), v('fromY'))), and(eq(v('px'), v('toX')), eq(v('py'), v('toY')))), [set('spot', v('ri'))]),
        ifThen(eq(v('rk'), BOMB), [
          forRange('qy', sub(v('py'), v('blast')), add(v('py'), v('blast')), [
            forRange('qx', sub(v('px'), v('blast')), add(v('px'), v('blast')), [
              ifThen(inBoard(v('qx'), v('qy')), [setBit(3, v('qx'), v('qy'), true)]),
            ]),
          ]),
        ]),
      ]),
      set('px', add(v('rx0'), mul(v('spot'), v('rdx')))),
      set('py', add(v('ry0'), mul(v('spot'), v('rdy')))),
      ifThen(eq(v('rk'), BOMB), [sound('explosion')], [
        ifThen(cmp('GTE', v('rn'), n(5)), [setBit(5, v('px'), v('py'), true)], [
          ifThen(eq(v('rn'), 4), [setBit(4, v('px'), v('py'), true)]),
        ]),
      ]),
    ], '@mark'),
    proc('clearKind', ['target'], [
      each('kx', 'ky', [
        ifThen(or(eq(read(v('kx'), v('ky')), v('target')), eq(v('target'), PRISM)), [setBit(3, v('kx'), v('ky'), true)]),
      ]),
    ]),
    // Runs when the two figures have slid into each other's place.
    proc('finishSwap', [], [
      set('ta', read(v('fromX'), v('fromY'))),
      set('tb', read(v('toX'), v('toY'))),
      swap(v('fromX'), v('fromY'), v('toX'), v('toY')),
      ifThen(or(eq(v('ta'), PRISM), eq(v('tb'), PRISM)), [
        callProc('clearMarks'),
        ifThen(eq(v('ta'), PRISM), [run('clearKind', ['target'], [v('tb')])], [run('clearKind', ['target'], [v('ta')])]),
        setBit(3, v('fromX'), v('fromY'), true),
        setBit(3, v('toX'), v('toY'), true),
        sound('powerUp'),
        set('found', n(1)),
      ], [callProc('findMatches')]),
      ifThen(eq(v('found'), 1), [set('combo', n(1)), ...show(), set('cx', v('toX')), set('cy', v('toY'))], [
        // No line: swap back and let the figures slide home.
        swap(v('fromX'), v('fromY'), v('toX'), v('toY')),
        sound('hit'),
        set('state', n(BACK)),
        set('timer', n(CELL)),
      ]),
    ]),
    proc('clearBoard', [], [
      set('cleared', n(0)),
      each('gx', 'gy', [
        ifThen(isOn(4, v('gx'), v('gy')), [write(v('gx'), v('gy'), BOMB)], [
          ifThen(isOn(5, v('gx'), v('gy')), [write(v('gx'), v('gy'), PRISM)], [
            ifThen(isOn(3, v('gx'), v('gy')), [write(v('gx'), v('gy'), 0), inc('cleared')]),
          ]),
        ]),
      ]),
      // Each figure gives 10 points, times the number of chain reactions.
      set('gain', mul(mul(v('cleared'), n(10)), v('combo'))),
      ifThen(cmp('GT', v('gain'), sub(n(30000), v('points'))), [set('points', n(30000))], [inc('points', v('gain'))]),
      sound('coin'),
    ]),
    proc('fallStep', [], [
      set('moved', n(0)),
      forRange('gr', n(0), n(H - 2), [
        set('gy', sub(n(H - 1), v('gr'))),
        forRange('gx', n(0), n(W - 1), [
          ifThen(eq(read(v('gx'), v('gy')), 0), [
            set('above', read(v('gx'), sub(v('gy'), n(1)))),
            ifThen(cmp('GT', v('above'), n(0)), [
              write(v('gx'), v('gy'), v('above')),
              write(v('gx'), sub(v('gy'), n(1)), 0),
              set('moved', n(1)),
            ]),
          ]),
        ]),
      ]),
      forRange('gx', n(0), n(W - 1), [
        ifThen(eq(read(v('gx'), n(0)), 0), [write(v('gx'), n(0), randomKind()), set('moved', n(1))]),
      ]),
    ], '@fall'),
    blk('ab_on_update', {
      body: [
        ifThen(eq(v('state'), SHOW), [
          inc('timer', -1),
          ifThen(cmp('LTE', v('timer'), n(0)), [callProc('clearBoard'), set('state', n(FALL))]),
        ]),
        ifThen(eq(v('state'), FALL), [
          inc('timer'),
          ifThen(eq(mod(v('timer'), 2), 0), [
            callProc('fallStep'),
            ifThen(eq(v('moved'), 0), [
              callProc('findMatches'),
              ifThen(eq(v('found'), 1), [set('combo', minmax('min', add(v('combo'), n(1)), n(9))), ...show()], [
                set('combo', n(0)),
                set('state', n(PLAY)),
                ifThen(eq(callRet('hasMove', [], []), 0), [
                  blk('ab_score_set', { i: { VALUE: v('points') } }),
                  blk('ab_game_over', { f: { WIN: 'lose' } }),
                ]),
              ]),
            ]),
          ]),
        ]),
        ifThen(eq(v('state'), SWAP), [
          inc('timer', STEP),
          ifThen(cmp('GTE', v('timer'), n(CELL)), [callProc('finishSwap')]),
        ]),
        ifThen(eq(v('state'), BACK), [
          inc('timer', -STEP),
          ifThen(cmp('LTE', v('timer'), n(0)), [set('state', n(PLAY))]),
        ]),
      ],
    }),
    blk('ab_on_button', {
      f: { BUTTON: 'a', EVENT: 'pressed' },
      body: [ifThen(eq(v('state'), PLAY), [set('selected', not(v('selected'))), blk('ab_play_tone', { i: { FREQ: n(880), MS: n(30) } })])],
    }),
    blk('ab_on_button', { f: { BUTTON: 'b', EVENT: 'pressed' }, body: [set('selected', bool(false))] }),
    ...directions.map(([button, dx, dy]) => blk('ab_on_button', {
      f: { BUTTON: button, EVENT: 'pressed' },
      body: [
        set('nx', add(v('cx'), n(dx))),
        set('ny', add(v('cy'), n(dy))),
        ifThen(inBoard(v('nx'), v('ny')), [
          ifThen(and(v('selected'), eq(v('state'), PLAY)), [
            set('fromX', v('cx')),
            set('fromY', v('cy')),
            set('toX', v('nx')),
            set('toY', v('ny')),
            set('selected', bool(false)),
            set('state', n(SWAP)),
            set('timer', n(0)),
          ], [set('cx', v('nx')), set('cy', v('ny'))]),
        ]),
      ],
    })),
    proc('drawGem', ['dk', 'gemX', 'gemY'], GEMS.map((id, i) => ifThen(eq(v('dk'), i + 1), [image(id, v('gemX'), v('gemY'))]))),
    blk('ab_on_draw', {
      comment: '@draw',
      body: [
        blk('ab_draw_rect', { f: { COLOR: 'white', FILL: 'outline' }, i: { X: n(OX - 2), Y: n(OY - 2), W: n(W * CELL + 3), H: n(H * CELL + 3) } }),
        each('dx', 'dy', [
          set('hide', bool(false)),
          // Squares that are about to be cleared blink.
          ifThen(and(eq(v('state'), SHOW), and(cmp('LT', mod(v('timer'), 4), n(2)), isOn(3, v('dx'), v('dy')))), [set('hide', bool(true))]),
          // The two swapped figures are drawn sliding, below.
          ifThen(and(cmp('GTE', v('state'), n(SWAP)), or(and(eq(v('dx'), v('fromX')), eq(v('dy'), v('fromY'))), and(eq(v('dx'), v('toX')), eq(v('dy'), v('toY'))))), [set('hide', bool(true))]),
          ifThen(not(v('hide')), [gemAt(read(v('dx'), v('dy')), v('dx'), v('dy'), n(0), n(0))]),
        ]),
        ifThen(cmp('GTE', v('state'), n(SWAP)), [
          set('slideX', mul(sub(v('toX'), v('fromX')), v('timer'))),
          set('slideY', mul(sub(v('toY'), v('fromY')), v('timer'))),
          gemAt(read(v('fromX'), v('fromY')), v('fromX'), v('fromY'), v('slideX'), v('slideY')),
          gemAt(read(v('toX'), v('toY')), v('toX'), v('toY'), neg(v('slideX')), neg(v('slideY'))),
        ]),
        blk('ab_draw_rect', { f: { COLOR: 'white', FILL: 'outline' }, i: { X: add(n(OX - 1), mul(v('cx'), n(CELL))), Y: add(n(OY - 1), mul(v('cy'), n(CELL))), W: n(CELL + 1), H: n(CELL + 1) } }),
        ifThen(v('selected'), [
          blk('ab_draw_rect', { f: { COLOR: 'invert', FILL: 'filled' }, i: { X: add(n(OX), mul(v('cx'), n(CELL))), Y: add(n(OY), mul(v('cy'), n(CELL))), W: n(CELL - 1), H: n(CELL - 1) } }),
        ]),
        text(0, 56, txt('SCORE')),
        text(36, 56, v('points')),
        text(74, 56, txt('BEST')),
        text(100, 56, blk('ab_hiscore')),
      ],
    }),
  ]),
};
