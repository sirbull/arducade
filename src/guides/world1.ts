// World 1: first games.

import { blk, get, num, set, workspace } from '../templates/dsl';
import type { LocalizedText } from '../project/model';
import { blocksOfType, hasTop, numIn, type Check, type Guide, type Pattern } from './guide';
import { level13, level14, castle1 } from './world1-games';
import { COURSES } from './courses';
import { auditGuide } from './audit';

const L = (en: string, nb: string, es: string, fr: string, de: string): LocalizedText => ({ en, nb, es, fr, de });

const HERO = 'hero-run';
const ARROWS = 0b1111;

// Blocks used in the solutions.
const create = () => set('mySprite', blk('ab_sprite_create', { f: { IMAGE: HERO, KIND: 'Player' } }));
const position = () => blk('ab_sprite_set_position', { i: { SPRITE: get('mySprite'), X: num(16), Y: num(48) } });
const animate = () => blk('ab_sprite_animate', { i: { SPRITE: get('mySprite'), MS: num(200) } });
const move = (vy = 60) => blk('ab_move_sprite', { i: { SPRITE: get('mySprite'), VX: num(60), VY: num(vy) } });
const stay = () => blk('ab_sprite_set_flag', { f: { FLAG: 'stayInScreen', ON: 'on' }, i: { SPRITE: get('mySprite') } });
const onStart = (body: object[]) => workspace([blk('ab_on_start', { body: body as never })]);

// Checks.
const inStart = (...contains: Pattern[]) => (c: { blocks: object }) => hasTop(c.blocks, { type: 'ab_on_start', contains });
const createPattern: Pattern = { type: 'variables_set', inputs: { VALUE: { type: 'ab_sprite_create' } } };

const hasStart: Check = {
  text: L('"on start" is on the workspace', '«når spillet starter» ligger på flaten', '«al iniciar» está en el área de trabajo', '« au démarrage » est sur l’espace de travail', '„beim Start“ liegt auf der Arbeitsfläche'),
  ok: (c) => hasTop(c.blocks, { type: 'ab_on_start' }),
};
const hasHero: Check = {
  text: L('The hero is made in "on start"', 'Helten lages i «når spillet starter»', 'El héroe se crea en «al iniciar»', 'Le héros est créé dans « au démarrage »', 'Der Held wird in „beim Start“ erstellt'),
  ok: inStart(createPattern),
  run: async (e) => e.sprites.some((s) => s.alive && s.kind === 0),
};
const played: Check = {
  text: L('You pressed ▶', 'Du har trykket ▶', 'Has pulsado ▶', 'Tu as appuyé sur ▶', 'Du hast ▶ gedrückt'),
  ok: (c) => c.played > 0,
};
const hasPosition: Check = {
  text: L('The position block is in "on start"', 'Posisjon-blokken er i «når spillet starter»', 'El bloque de posición está en «al iniciar»', 'Le bloc de position est dans « au démarrage »', 'Der Positionsblock ist in „beim Start“'),
  ok: inStart({ type: 'ab_sprite_set_position' }),
};
const bottomLeft: Check = {
  text: L('x is 40 or less, and y is 40 or more', 'x er 40 eller mindre, og y er 40 eller mer', 'x es 40 o menos, e y es 40 o más', 'x vaut 40 ou moins, et y 40 ou plus', 'x ist 40 oder weniger, und y ist 40 oder mehr'),
  ok: inStart({ type: 'ab_sprite_set_position', inputs: { X: numIn(0, 40), Y: numIn(40, 63) } }),
};
const hasAnimate: Check = {
  text: L('The hero is animated', 'Helten er animert', 'El héroe está animado', 'Le héros est animé', 'Der Held ist animiert'),
  ok: inStart({ type: 'ab_sprite_animate' }),
  run: async (e, frame) => {
    const hero = e.sprites.find((s) => s.alive && s.kind === 0);
    if (!hero || hero.animRate <= 0) return false;
    const before = hero.frame;
    for (let i = 0; i < 120; i++) { await frame(); if (hero.frame !== before) return true; }
    return false;
  },
};
const hasMove: Check = {
  text: L('"move with buttons" is in "on start"', '«flytt med knappene» er i «når spillet starter»', '«mover con los botones» está en «al iniciar»', '« déplacer avec les boutons » est dans « au démarrage »', '„bewege mit den Tasten“ ist in „beim Start“'),
  ok: inStart({ type: 'ab_move_sprite' }),
  run: async (e, frame) => {
    const hero = e.sprites.find((s) => s.alive && s.kind === 0);
    if (!hero) return false;
    const x = hero.x;
    await frame(1 << 3, 15);
    return hero.x > x;
  },
};
const movedHero: Check = {
  text: L('You moved the hero with the arrows', 'Du har flyttet helten med pilene', 'Has movido al héroe con las flechas', 'Tu as déplacé le héros avec les flèches', 'Du hast den Helden mit den Pfeilen bewegt'),
  ok: (c) => (c.pressed & ARROWS) !== 0,
};
const hasStay: Check = {
  text: L('"stay in screen" is on', '«hold deg på skjermen» er på', '«quedarse en pantalla» está activado', '« rester à l’écran » est activé', '„im Bildschirm bleiben“ ist an'),
  ok: inStart({ type: 'ab_sprite_set_flag', fields: { FLAG: 'stayInScreen', ON: 'on' } }),
};
const sideOnly: Check = {
  text: L('vy is 0', 'vy er 0', 'vy es 0', 'vy vaut 0', 'vy ist 0'),
  ok: inStart({ type: 'ab_move_sprite', inputs: { VY: numIn(0, 0) } }),
  run: async (e, frame) => {
    const hero = e.sprites.find((s) => s.alive && s.kind === 0);
    if (!hero) return false;
    const { x, y } = hero;
    await frame(1 << 3, 15);
    if (hero.x <= x) return false;
    await frame(1, 15);
    return hero.y === y;
  },
};

export const level11: Guide = {
  id: 'w1-hello',
  number: '1-1',
  title: L('Hello, hero!', 'Hei, helt!', '¡Hola, héroe!', 'Salut, héros !', 'Hallo, Held!'),
  description: L('Put a hero on the screen and make it move its legs.', 'Sett en helt på skjermen og få den til å gå.', 'Pon un héroe en la pantalla y haz que mueva las piernas.', 'Mets un héros à l’écran et fais-le marcher.', 'Setz einen Helden auf den Bildschirm und lass ihn laufen.'),
  images: [HERO],
  start: workspace([]),
  steps: [
    {
      text: L(
        'Welcome! Here you make your first game. Everything that happens when the game starts goes into one block. Open the "Game" category on the left and drag "on start" out onto the big area.',
        'Velkommen! Her lager du ditt første spill. Alt som skal skje når spillet starter, legger du i én blokk. Åpne kategorien «Spill» til venstre og dra «når spillet starter» ut på den store flaten.',
        '¡Bienvenido! Aquí haces tu primer juego. Todo lo que pasa cuando empieza el juego va en un bloque. Abre la categoría «Juego» a la izquierda y arrastra «al iniciar» al área grande.',
        'Bienvenue ! Ici, tu crées ton premier jeu. Tout ce qui se passe au début du jeu va dans un seul bloc. Ouvre la catégorie « Jeu » à gauche et fais glisser « au démarrage » sur la grande zone.',
        'Willkommen! Hier machst du dein erstes Spiel. Alles, was beim Spielstart passiert, kommt in einen Block. Öffne links die Kategorie „Spiel“ und zieh „beim Start“ auf die große Fläche.',
      ),
      show: [blk('ab_on_start')],
      solution: onStart([]),
      checks: [hasStart],
    },
    {
      text: L(
        'Now we make the hero. Open "Sprites" and drag the top block into "on start". It makes a sprite: a figure that can move. The picture in the block is the hero.',
        'Nå lager vi helten. Åpne «Sprites» og dra den øverste blokken inn i «når spillet starter». Den lager en sprite: en figur som kan bevege seg. Bildet i blokken er helten.',
        'Ahora creamos al héroe. Abre «Sprites» y arrastra el primer bloque dentro de «al iniciar». Crea un sprite: una figura que se puede mover. La imagen del bloque es el héroe.',
        'Maintenant, on crée le héros. Ouvre « Sprites » et fais glisser le premier bloc dans « au démarrage ». Il crée un sprite : un personnage qui peut bouger. L’image dans le bloc est le héros.',
        'Jetzt machen wir den Helden. Öffne „Sprites“ und zieh den obersten Block in „beim Start“. Er macht ein Sprite: eine Figur, die sich bewegen kann. Das Bild im Block ist der Held.',
      ),
      show: [create()],
      solution: onStart([create()]),
      checks: [hasHero],
      hint: L('The block must click into place inside "on start". If it looks pale, it is not inside.', 'Blokken må klikke seg fast inni «når spillet starter». Hvis den ser blek ut, ligger den ikke inni.', 'El bloque debe encajar dentro de «al iniciar». Si se ve pálido, no está dentro.', 'Le bloc doit s’emboîter dans « au démarrage ». S’il est pâle, il n’est pas dedans.', 'Der Block muss in „beim Start“ einrasten. Wenn er blass aussieht, ist er nicht drin.'),
    },
    {
      text: L(
        'Press ▶ above the game screen. Can you see the hero in the middle of the screen?',
        'Trykk ▶ over spillskjermen. Ser du helten midt på skjermen?',
        'Pulsa ▶ encima de la pantalla del juego. ¿Ves al héroe en el centro?',
        'Appuie sur ▶ au-dessus de l’écran du jeu. Tu vois le héros au milieu ?',
        'Drück ▶ über dem Spielbildschirm. Siehst du den Helden in der Mitte?',
      ),
      solution: onStart([create()]),
      checks: [hasHero, played],
    },
    {
      text: L(
        'The screen is 128 dots wide and 64 dots high. x counts across from the left, y counts down from the top. Drag the position block from "Sprites" in under the hero, and change the numbers so the hero stands at the bottom left.',
        'Skjermen er 128 punkter bred og 64 punkter høy. x teller bortover fra venstre, y teller nedover fra toppen. Dra posisjon-blokken fra «Sprites» inn under helten, og endre tallene så helten står nede til venstre.',
        'La pantalla mide 128 puntos de ancho y 64 de alto. x cuenta hacia la derecha desde la izquierda, y cuenta hacia abajo desde arriba. Arrastra el bloque de posición de «Sprites» debajo del héroe y cambia los números para que quede abajo a la izquierda.',
        'L’écran fait 128 points de large et 64 de haut. x compte vers la droite depuis la gauche, y compte vers le bas depuis le haut. Fais glisser le bloc de position de « Sprites » sous le héros, et change les nombres pour qu’il soit en bas à gauche.',
        'Der Bildschirm ist 128 Punkte breit und 64 Punkte hoch. x zählt von links nach rechts, y von oben nach unten. Zieh den Positionsblock aus „Sprites“ unter den Helden und ändere die Zahlen, damit der Held unten links steht.',
      ),
      show: [position()],
      solution: onStart([create(), position()]),
      checks: [hasPosition, bottomLeft],
      hint: L('Click a number in the block to change it. Try x 16 and y 48.', 'Klikk på et tall i blokken for å endre det. Prøv x 16 og y 48.', 'Haz clic en un número del bloque para cambiarlo. Prueba x 16 e y 48.', 'Clique sur un nombre du bloc pour le changer. Essaie x 16 et y 48.', 'Klick auf eine Zahl im Block, um sie zu ändern. Probier x 16 und y 48.'),
    },
    {
      text: L(
        'The hero has two pictures. When they switch, it looks like it walks. Drag "animate" from "Sprites" in under the position block.',
        'Helten har to bilder. Når de byttes, ser det ut som den går. Dra «animer» fra «Sprites» inn under posisjon-blokken.',
        'El héroe tiene dos imágenes. Al cambiar entre ellas, parece que camina. Arrastra «animar» de «Sprites» debajo del bloque de posición.',
        'Le héros a deux images. Quand elles alternent, on dirait qu’il marche. Fais glisser « animer » de « Sprites » sous le bloc de position.',
        'Der Held hat zwei Bilder. Wenn sie wechseln, sieht es aus, als würde er laufen. Zieh „animiere“ aus „Sprites“ unter den Positionsblock.',
      ),
      show: [animate()],
      solution: onStart([create(), position(), animate()]),
      checks: [hasAnimate],
    },
    {
      text: L(
        'Press ▶ and watch the hero walk on the spot! Try another number in the animate block: a smaller number is faster.',
        'Trykk ▶ og se helten gå på stedet! Prøv et annet tall i animer-blokken: et mindre tall går fortere.',
        '¡Pulsa ▶ y mira al héroe caminar en el sitio! Prueba otro número en el bloque animar: un número más pequeño va más rápido.',
        'Appuie sur ▶ et regarde le héros marcher sur place ! Essaie un autre nombre dans le bloc animer : plus petit, c’est plus rapide.',
        'Drück ▶ und schau, wie der Held auf der Stelle läuft! Probier eine andere Zahl im Animieren-Block: kleiner ist schneller.',
      ),
      solution: onStart([create(), position(), animate()]),
      checks: [hasAnimate, played],
    },
  ],
  bonus: {
    text: L(
      'Bonus: pick another hero. Open the Sprites tab, take one from the Library, and choose it in the sprite block.',
      'Bonus: velg en annen helt. Åpne fanen Sprites, hent en fra Biblioteket, og velg den i sprite-blokken.',
      'Extra: elige otro héroe. Abre la pestaña Sprites, toma uno de la Biblioteca y elígelo en el bloque sprite.',
      'Bonus : choisis un autre héros. Ouvre l’onglet Sprites, prends-en un dans la Bibliothèque et choisis-le dans le bloc sprite.',
      'Bonus: Nimm einen anderen Helden. Öffne den Tab Sprites, hol einen aus der Bibliothek und wähle ihn im Sprite-Block.',
    ),
    ok: (c) => blocksOfType(c.blocks, 'ab_sprite_create').some((b) => b.fields?.IMAGE && b.fields.IMAGE !== HERO),
  },
};

const level11Done = [create(), position(), animate()];

export const level12: Guide = {
  id: 'w1-move',
  number: '1-2',
  title: L('Move it', 'Beveg deg', 'Muévete', 'Bouge !', 'Beweg dich'),
  description: L('Steer the hero with the buttons.', 'Styr helten med knappene.', 'Controla al héroe con los botones.', 'Dirige le héros avec les boutons.', 'Steuere den Helden mit den Tasten.'),
  images: [HERO],
  start: onStart(level11Done),
  steps: [
    {
      text: L(
        'Here is your hero from the last level. Now you steer it. Open "Controller" and drag "move with buttons" into "on start".',
        'Her er helten fra forrige brett. Nå skal du styre den. Åpne «Knapper» og dra «flytt med knappene» inn i «når spillet starter».',
        'Aquí está tu héroe del nivel anterior. Ahora lo vas a controlar. Abre «Controles» y arrastra «mover con los botones» dentro de «al iniciar».',
        'Voici ton héros du niveau précédent. Maintenant, tu vas le diriger. Ouvre « Manette » et fais glisser « déplacer avec les boutons » dans « au démarrage ».',
        'Hier ist dein Held aus dem letzten Level. Jetzt steuerst du ihn. Öffne „Tasten“ und zieh „bewege mit den Tasten“ in „beim Start“.',
      ),
      show: [move()],
      solution: onStart([...level11Done, move()]),
      checks: [hasMove],
    },
    {
      text: L(
        'Press ▶ and move the hero with the arrows on the screen, or with the arrow keys on the keyboard.',
        'Trykk ▶ og flytt helten med pilene på skjermen, eller med piltastene på tastaturet.',
        'Pulsa ▶ y mueve al héroe con las flechas de la pantalla o con las flechas del teclado.',
        'Appuie sur ▶ et déplace le héros avec les flèches à l’écran ou les flèches du clavier.',
        'Drück ▶ und beweg den Helden mit den Pfeilen auf dem Bildschirm oder den Pfeiltasten.',
      ),
      solution: onStart([...level11Done, move()]),
      checks: [hasMove, played, movedHero],
    },
    {
      text: L(
        'Oops, the hero can walk off the screen. Drag the "set … stay in screen" block from "Sprites" into "on start", and make sure it says "on".',
        'Oi, helten kan gå ut av skjermen. Dra blokken «sett … hold deg på skjermen» fra «Sprites» inn i «når spillet starter», og pass på at det står «på».',
        'Vaya, el héroe puede salirse de la pantalla. Arrastra el bloque «fijar … quedarse en pantalla» de «Sprites» dentro de «al iniciar» y comprueba que dice «sí».',
        'Oups, le héros peut sortir de l’écran. Fais glisser le bloc « mettre … rester à l’écran » de « Sprites » dans « au démarrage », et vérifie qu’il est activé.',
        'Hoppla, der Held kann aus dem Bildschirm laufen. Zieh den Block „setze … im Bildschirm bleiben“ aus „Sprites“ in „beim Start“ und achte darauf, dass er an ist.',
      ),
      show: [stay()],
      solution: onStart([...level11Done, move(), stay()]),
      checks: [hasStay],
      hint: L('In the block, choose "stay in screen" in the middle menu.', 'Velg «hold deg på skjermen» i menyen midt i blokken.', 'En el bloque, elige «quedarse en pantalla» en el menú del medio.', 'Dans le bloc, choisis « rester à l’écran » dans le menu du milieu.', 'Wähle im Block im mittleren Menü „im Bildschirm bleiben“.'),
    },
    {
      text: L(
        'vx is the speed sideways and vy is the speed up and down. Set vy to 0, so the hero can only walk sideways, like in a platform game.',
        'vx er farten bortover og vy er farten opp og ned. Sett vy til 0, så helten bare kan gå til siden, som i et plattformspill.',
        'vx es la velocidad hacia los lados y vy la velocidad hacia arriba y abajo. Pon vy a 0 para que el héroe solo camine hacia los lados, como en un juego de plataformas.',
        'vx est la vitesse sur les côtés et vy la vitesse vers le haut et le bas. Mets vy à 0 pour que le héros ne marche que sur les côtés, comme dans un jeu de plateformes.',
        'vx ist das Tempo zur Seite und vy das Tempo nach oben und unten. Setz vy auf 0, damit der Held nur zur Seite läuft, wie in einem Jump and Run.',
      ),
      solution: onStart([...level11Done, move(0), stay()]),
      checks: [sideOnly],
    },
    {
      text: L(
        'Press ▶ and try it. Now the hero only walks sideways!',
        'Trykk ▶ og prøv. Nå går helten bare til siden!',
        'Pulsa ▶ y pruébalo. ¡Ahora el héroe solo camina hacia los lados!',
        'Appuie sur ▶ et essaie. Maintenant, le héros ne marche que sur les côtés !',
        'Drück ▶ und probier es. Jetzt läuft der Held nur zur Seite!',
      ),
      solution: onStart([...level11Done, move(0), stay()]),
      checks: [sideOnly, played, movedHero],
    },
  ],
  bonus: {
    text: L('Bonus: make the hero twice as fast. Change vx to 120.', 'Bonus: gjør helten dobbelt så rask. Endre vx til 120.', 'Extra: haz que el héroe sea el doble de rápido. Cambia vx a 120.', 'Bonus : rends le héros deux fois plus rapide. Mets vx à 120.', 'Bonus: Mach den Helden doppelt so schnell. Ändere vx auf 120.'),
    ok: inStart({ type: 'ab_move_sprite', inputs: { VX: numIn(100) } }),
  },
};

export const GUIDES: Guide[] = [...[level11, level12, level13, level14, castle1].map(auditGuide), ...COURSES];
