import { blk, cmp, get, ifThen, num, random, set, workspace, change, flag } from '../templates/dsl';
import type { B } from '../templates/dsl';
import type { LocalizedText } from '../project/model';
import { hasTop, matchesSolution, numIn, type Check, type Guide, type Pattern, type GuideStep } from './guide';

const L = (en: string, nb: string, es: string, fr: string, de: string): LocalizedText => ({ en, nb, es, fr, de });
const create = (name: string, image: string, kind: string) => set(name, blk('ab_sprite_create', { f: { IMAGE: image, KIND: kind } }));
const pos = (name: string, x: number, y: number) => blk('ab_sprite_set_position', { i: { SPRITE: get(name), X: num(x), Y: num(y) } });
const score = () => blk('ab_score_change', { i: { VALUE: num(1) } });
const respawn = () => blk('ab_sprite_set_position', { i: { SPRITE: get('otherSprite'), X: random(8, 112), Y: random(16, 48) } });
const overlap = (kind: string, body: B[]) => blk('ab_on_overlap', {
  f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: kind }, body,
});
const initial = [create('mySprite', 'hero-run', 'Player'), pos('mySprite', 16, 48),
  blk('ab_sprite_animate', { i: { SPRITE: get('mySprite'), MS: num(200) } }),
  blk('ab_move_sprite', { i: { SPRITE: get('mySprite'), VX: num(60), VY: num(60) } }), flag('mySprite', 'stayInScreen')];
const coins = [create('myCoin', 'coin', 'Food'), pos('myCoin', 64, 48)];
const start = (body: B[], events: B[] = []) => workspace([blk('ab_on_start', { body }), ...events]);
const structure = (text: LocalizedText, pattern: Pattern): Check => ({ text, ok: (c) => hasTop(c.blocks, pattern) });
const inStart = (text: LocalizedText, ...contains: Pattern[]) => structure(text, { type: 'ab_on_start', contains });
const event = (text: LocalizedText, kind: string, contains: Pattern[] = []) => structure(text, { type: 'ab_on_overlap', fields: { KIND_A: 'Player', KIND_B: kind }, contains });
const coinMade = inStart(L('Create a Food sprite', 'Lag en sprite av typen Mat', 'Crea un sprite de tipo Comida', 'Crée un sprite de type Nourriture', 'Erstelle ein Sprite vom Typ Essen'), { type: 'ab_sprite_create', fields: { KIND: 'Food', IMAGE: 'coin' } });
const coinEvent = event(L('When Player touches Food', 'Når Spiller treffer Mat', 'Cuando Jugador toca Comida', 'Quand Joueur touche Nourriture', 'Wenn Spieler Essen berührt'), 'Food');
const addPoint = event(L('Add 1 point on contact', 'Legg til 1 poeng ved treff', 'Suma 1 punto al tocar', 'Ajoute 1 point au contact', 'Füge bei Berührung 1 Punkt hinzu'), 'Food', [{ type: 'ab_score_change', inputs: { VALUE: numIn(1, 1) } }]);
const moveCoin = event(L('Move the collected coin to a random place', 'Flytt mynten du har tatt til et tilfeldig sted', 'Mueve la moneda recogida a un lugar al azar', 'Déplace la pièce ramassée au hasard', 'Versetze die eingesammelte Münze an einen zufälligen Ort'), 'Food', [{ type: 'ab_sprite_set_position', inputs: { X: { type: 'ab_random' }, Y: { type: 'ab_random' } } }]);
const play: Check = { text: L('Press ▶ and try your game', 'Trykk ▶ og prøv spillet ditt', 'Pulsa ▶ y prueba tu juego', 'Appuie sur ▶ et essaie ton jeu', 'Drücke ▶ und probiere dein Spiel'), ok: (c) => c.played > 0 };
const collect: Check = {
  text: L('Your game gives points and moves the coin', 'Spillet ditt gir poeng og flytter mynten', 'Tu juego da puntos y mueve la moneda', 'Ton jeu donne des points et déplace la pièce', 'Dein Spiel gibt Punkte und versetzt die Münze'),
  ok: () => true,
  run: async (e, frame) => {
    const hero = e.sprites.find((s) => s.alive && s.kind === 0);
    const coin = e.sprites.find((s) => s.alive && s.kind === 3);
    if (!hero || !coin) return false;
    const before = e.score, x = coin.x, y = coin.y;
    for (let i = 0; i < 240 && coin.x === x && coin.y === y; i++) {
      const dx = coin.x - hero.x, dy = coin.y - hero.y;
      await frame((Math.abs(dx) > 256 ? 1 << (dx > 0 ? 3 : 2) : 0) | (Math.abs(dy) > 256 ? 1 << (dy > 0 ? 1 : 0) : 0));
    }
    // ponytail: checked the same frame the coin moves; it may respawn on the hero and score again later
    return coin.alive && (coin.x !== x || coin.y !== y) && e.score === before + 1;
  },
};
const step = (text: LocalizedText, solution: B, checks: Check[], show?: B[]): GuideStep => ({ text, solution, checks, show });
const coinBody = [...initial, ...coins];
const coinEvents = [overlap('Food', [score(), respawn()])];

export const level13: Guide = {
  id: 'w1-coins', number: '1-3',
  title: L('Coin hunt', 'Myntjakt', 'Caza de monedas', 'Chasse aux pièces', 'Münzjagd'),
  description: L('Collect coins and earn points.', 'Ta mynter og få poeng.', 'Recoge monedas y gana puntos.', 'Ramasse des pièces et gagne des points.', 'Sammle Münzen und erhalte Punkte.'),
  images: ['hero-run', 'coin'], start: start(initial),
  steps: [
    step(L('We use all four arrows again. Make a new sprite in “on start”. Choose the coin picture and Food as its kind. A kind groups sprites with the same job. Name its variable myCoin.', 'Vi bruker alle fire pilene igjen. Lag en ny sprite i «når spillet starter». Velg myntbildet og Mat som type. En type samler figurer med samme oppgave. Kall variabelen myCoin.', 'Usamos las cuatro flechas otra vez. Crea un sprite en «al iniciar». Elige la moneda y el tipo Comida. Un tipo agrupa figuras con la misma tarea. Llama myCoin a su variable.', 'On utilise à nouveau les quatre flèches. Crée un sprite dans «au démarrage». Choisis la pièce et le type Nourriture. Un type regroupe les figures ayant le même rôle. Nomme sa variable myCoin.', 'Wir nutzen wieder alle vier Pfeile. Erstelle ein Sprite in „beim Start“. Wähle die Münze und den Typ Essen. Ein Typ gruppiert Figuren mit derselben Aufgabe. Nenne die Variable myCoin.'), start([...initial, coins[0]]), [coinMade], [coins[0]]),
    step(L('Put myCoin at x 64, y 48. It must have its own position block: select myCoin, so you move the coin rather than the hero.', 'Sett myCoin på x 64, y 48. Den trenger sin egen posisjon-blokk: velg myCoin, slik at du flytter mynten.', 'Pon myCoin en x 64, y 48. Necesita su propio bloque de posición: selecciona myCoin para mover la moneda.', 'Place myCoin à x 64, y 48. Il lui faut son propre bloc de position : sélectionne myCoin pour déplacer la pièce.', 'Setze myCoin auf x 64, y 48. Sie braucht einen eigenen Positionsblock: Wähle myCoin, um die Münze zu verschieben.'), start(coinBody), [coinMade, inStart(L('Place the coin at x 64, y 48', 'Plasser mynten på x 64, y 48', 'Coloca la moneda en x 64, y 48', 'Place la pièce à x 64, y 48', 'Platziere die Münze bei x 64, y 48'), { type: 'ab_sprite_set_position', inputs: { X: numIn(64,64), Y: numIn(48,48) } })], [coins[1]]),
    step(L('Drag “when sprite overlaps” from Sprites onto the workspace. Choose Player and Food. This event runs when the hero touches a coin.', 'Dra «når sprite overlapper» fra Sprites ut på flaten. Velg Spiller og Mat. Denne hendelsen kjører når helten treffer en mynt.', 'Arrastra el evento de contacto de Sprites al área de trabajo. Elige Jugador y Comida. Se ejecuta cuando el héroe toca una moneda.', 'Glisse l’événement de contact depuis Sprites sur la zone de travail. Choisis Joueur et Nourriture. Il se déclenche quand le héros touche une pièce.', 'Zieh das Berührungsereignis aus Sprites auf die Arbeitsfläche. Wähle Spieler und Essen. Es läuft, wenn der Held eine Münze berührt.'), start(coinBody, [overlap('Food', [])]), [coinMade, coinEvent], [overlap('Food', [])]),
    step(L('From Info, put “change score by 1” inside the contact event. The score counts the coins you collect.', 'Fra Info legger du «endre poeng med 1» inni treff-hendelsen. Poengene teller myntene du samler.', 'Desde Info, pon «cambiar puntos por 1» dentro del evento. Los puntos cuentan las monedas recogidas.', 'Depuis Info, mets «changer le score de 1» dans l’événement. Le score compte les pièces ramassées.', 'Setze aus Info „ändere Punkte um 1“ in das Ereignis. Die Punkte zählen die gesammelten Münzen.'), start(coinBody, [overlap('Food', [score()])]), [coinMade, addPoint], [score()]),
    step(L('Add “set position” from Sprites under the point block. Select otherSprite: in this event, that is the coin. From Math, put “pick random” in x (8 to 112) and in y (16 to 48). The coin jumps to a new place, so there is always another one to catch. Without moving it, you could score again every frame!', 'Legg «sett posisjon» fra Sprites under poengblokken. Velg otherSprite: i denne hendelsen er det mynten. Fra Matte legger du «tilfeldig tall» i x (8 til 112) og i y (16 til 48). Mynten hopper til et nytt sted, så det er alltid en ny å ta. Uten å flytte den kan du få poeng på nytt hvert bilde!', 'Añade «fijar posición» de Sprites debajo. Elige otherSprite: aquí es la moneda. Desde Matemáticas, pon «número al azar» en x (8 a 112) y en y (16 a 48). La moneda salta a otro lugar, así siempre hay otra que atrapar. ¡Si no la mueves, recibirás puntos en cada fotograma!', 'Ajoute «mettre la position» depuis Sprites en dessous. Choisis otherSprite : ici, c’est la pièce. Depuis Maths, mets «nombre au hasard» dans x (8 à 112) et dans y (16 à 48). La pièce saute ailleurs, il y en a donc toujours une à attraper. Sinon, tu pourrais gagner des points à chaque image !', 'Füge „setze Position“ aus Sprites darunter ein. Wähle otherSprite: Hier ist das die Münze. Setze aus Mathe „Zufallszahl“ in x (8 bis 112) und in y (16 bis 48). Die Münze springt an einen neuen Ort, so gibt es immer eine neue zu fangen. Sonst könntest du in jedem Bild erneut Punkte bekommen!'), start(coinBody, coinEvents), [coinMade, addPoint, moveCoin], [respawn()]),
    step(L('Press ▶ and steer into the coin. It should jump to a new place and the score should go up by 1. How many can you catch? The guide also tests that your code does this.', 'Trykk ▶ og gå inn i mynten. Den skal hoppe til et nytt sted og poengene øke med 1. Hvor mange klarer du å ta? Guiden tester også at koden din gjør dette.', 'Pulsa ▶ y ve hacia la moneda. Debe saltar a otro lugar y los puntos subir 1. ¿Cuántas puedes atrapar? La guía también comprueba tu código.', 'Appuie sur ▶ et va vers la pièce. Elle doit sauter ailleurs et le score augmenter de 1. Combien peux-tu en attraper ? Le guide teste aussi ton code.', 'Drücke ▶ und gehe zur Münze. Sie soll an einen neuen Ort springen und der Punktestand um 1 steigen. Wie viele schaffst du? Die Anleitung prüft auch deinen Code.'), start(coinBody, coinEvents), [coinMade, addPoint, moveCoin, play, collect]),
  ],
  bonus: event(L('Bonus: play the coin sound when collecting a coin.', 'Bonus: spill myntlyden når du tar en mynt.', 'Extra: reproduce el sonido de moneda al recogerla.', 'Bonus : joue le son de pièce quand tu la ramasses.', 'Bonus: Spiele beim Einsammeln den Münzton.'), 'Food', [{ type: 'ab_play_effect', fields: { SFX: 'coin' } }]),
};

const enemy = [create('myEnemy', 'slime', 'Enemy'), pos('myEnemy', 96, 20)];
const velocity = blk('ab_sprite_set_velocity', { i: { SPRITE: get('myEnemy'), VX: num(30), VY: num(0) } });
const bounce = flag('myEnemy', 'bounceOnWall');
const lives = blk('ab_life_set', { i: { VALUE: num(3) } });
const hurt = [blk('ab_life_change', { i: { VALUE: num(-1) } }), pos('sprite', 16, 48)];
const enemyMade = inStart(L('Create an Enemy sprite', 'Lag en Fiende-sprite', 'Crea un sprite Enemigo', 'Crée un sprite Ennemi', 'Erstelle ein Gegner-Sprite'), { type: 'ab_sprite_create', fields: { KIND: 'Enemy' } });
const lifeCheck = inStart(L('Start with 3 lives', 'Start med 3 liv', 'Empieza con 3 vidas', 'Commence avec 3 vies', 'Starte mit 3 Leben'), { type: 'ab_life_set', inputs: { VALUE: numIn(3,3) } });
const hurtCheck = event(L('Lose one life on contact with Enemy', 'Mist ett liv ved treff med Fiende', 'Pierde una vida al tocar Enemigo', 'Perds une vie au contact de Ennemi', 'Verliere bei Berührung mit Gegner ein Leben'), 'Enemy', [{ type: 'ab_life_change', inputs: { VALUE: numIn(-1,-1) } }, { type: 'ab_sprite_set_position' }]);
const dangerBody = [...coinBody, ...enemy, velocity, bounce, lives];
const dangerEvents = [...coinEvents, overlap('Enemy', hurt)];
const dangerWorks: Check = {
  text: L('Contact costs one life; no lives ends the game', 'Treff koster ett liv; ingen liv avslutter spillet', 'El contacto cuesta una vida; sin vidas termina el juego', 'Le contact coûte une vie ; sans vies, le jeu se termine', 'Berührung kostet ein Leben; ohne Leben endet das Spiel'), ok: () => true,
  run: async (e, frame) => {
    const h = e.sprites.findIndex((s) => s.alive && s.kind === 0), enemy = e.sprites.find((s) => s.alive && s.kind === 1);
    if (h < 0 || !enemy || e.life !== 3) return false;
    for (let i = 0; i < 3; i++) {
      e.setPosition(h, enemy.x / 256, enemy.y / 256);
      await frame();
      if (e.life !== 2-i) return false;
      if (i < 2) { await frame(0, 3); if (e.life !== 2-i) return false; }
    }
    return e.gameOverPending && !e.gameOverWin;
  },
};
const bouncing: Check = { text: L('The enemy moves and turns at the edge', 'Fienden beveger seg og snur ved kanten', 'El enemigo se mueve y gira en el borde', 'L’ennemi bouge et fait demi-tour au bord', 'Der Gegner bewegt sich und dreht am Rand um'), ok: () => true,
  run: async (e, frame) => {
    const enemy = e.sprites.find((s) => s.alive && s.kind === 1);
    if (!enemy || !enemy.vx) return false;
    const x = enemy.x, vx = enemy.vx;
    for (let i = 0; i < 300; i++) { await frame(); if (enemy.x !== x && enemy.vx * vx < 0) return true; }
    return false;
  } };

export const level14: Guide = {
  id: 'w1-danger', number: '1-4', title: L('Watch out!', 'Pass deg!', '¡Cuidado!', 'Attention !', 'Pass auf!'),
  description: L('Avoid a moving enemy and learn about lives.', 'Unngå en fiende i bevegelse og lær om liv.', 'Evita un enemigo en movimiento y aprende sobre vidas.', 'Évite un ennemi en mouvement et découvre les vies.', 'Weiche einem beweglichen Gegner aus und lerne über Leben.'),
  images: ['hero-run', 'coin', 'slime'], start: start(coinBody, coinEvents),
  steps: [
    step(L('Add a slime sprite called myEnemy in “on start”. Choose Enemy as its kind and put it at x 96, y 20.', 'Legg til en slim-sprite kalt myEnemy i «når spillet starter». Velg Fiende som type og plasser den på x 96, y 20.', 'Añade un sprite de limo llamado myEnemy en «al iniciar». Elige Enemigo y colócalo en x 96, y 20.', 'Ajoute un slime nommé myEnemy dans «au démarrage». Choisis Ennemi et place-le à x 96, y 20.', 'Füge in „beim Start“ einen Schleim namens myEnemy hinzu. Wähle Gegner und platziere ihn bei x 96, y 20.'), start([...coinBody,...enemy],coinEvents), [enemyMade], enemy),
    step(L('Set myEnemy’s velocity to vx 30, vy 0. Velocity keeps a sprite moving without pressing buttons.', 'Sett farten til myEnemy til vx 30, vy 0. Fart holder en sprite i bevegelse uten at du trykker på knapper.', 'Fija la velocidad de myEnemy en vx 30, vy 0. La velocidad mueve un sprite sin pulsar botones.', 'Règle la vitesse de myEnemy à vx 30, vy 0. La vitesse fait bouger un sprite sans appuyer sur les boutons.', 'Setze das Tempo von myEnemy auf vx 30, vy 0. Damit bewegt sich ein Sprite ohne Tastendruck.'), start([...coinBody,...enemy,velocity],coinEvents), [enemyMade,inStart(L('Set a sideways velocity', 'Sett fart til siden', 'Fija velocidad lateral', 'Règle une vitesse horizontale', 'Setze ein seitliches Tempo'), { type:'ab_sprite_set_velocity', inputs:{VX:numIn(1,60),VY:numIn(0,0)} })], [velocity]),
    step(L('Turn on “bounce on wall” for myEnemy. At the screen edge it reverses direction. The guide tests the movement.', 'Slå på «sprett mot vegg» for myEnemy. Ved skjermkanten snur den. Guiden tester bevegelsen.', 'Activa «rebotar en pared» para myEnemy. En el borde cambia de dirección. La guía comprueba el movimiento.', 'Active «rebondir sur les murs» pour myEnemy. Au bord, il change de direction. Le guide teste le mouvement.', 'Aktiviere „an Wand abprallen“ für myEnemy. Am Rand dreht er um. Die Anleitung prüft die Bewegung.'), start([...coinBody,...enemy,velocity,bounce],coinEvents), [enemyMade,bouncing], [bounce]),
    step(L('From Info, set life to 3 in “on start”. Lives show how many chances you have left.', 'Fra Info setter du liv til 3 i «når spillet starter». Liv viser hvor mange sjanser du har igjen.', 'Desde Info, fija las vidas en 3 en «al iniciar». Las vidas muestran las oportunidades que te quedan.', 'Depuis Info, règle les vies à 3 dans «au démarrage». Les vies indiquent combien de chances il te reste.', 'Setze aus Info die Leben in „beim Start“ auf 3. Leben zeigen, wie viele Chancen du noch hast.'), start(dangerBody,coinEvents), [enemyMade,lifeCheck], [lives]),
    step(L('Make a Player–Enemy contact event. Inside, change life by -1, then put sprite at x 16, y 48. Here sprite is the hero. Moving it away prevents losing all lives in one touch.', 'Lag en treff-hendelse for Spiller og Fiende. Inni endrer du liv med -1, og setter så sprite på x 16, y 48. Her er sprite helten. Flyttingen hindrer at ett treff tar alle livene.', 'Crea un evento de contacto Jugador–Enemigo. Dentro, cambia las vidas por -1 y coloca sprite en x 16, y 48. Aquí sprite es el héroe. Alejarlo evita perder todas las vidas con un toque.', 'Crée un événement de contact Joueur–Ennemi. Dedans, change les vies de -1, puis place sprite à x 16, y 48. Ici sprite est le héros. L’éloigner évite de perdre toutes les vies au même contact.', 'Erstelle ein Spieler–Gegner-Berührungsereignis. Ändere darin Leben um -1 und setze sprite auf x 16, y 48. Hier ist sprite der Held. Das Wegbewegen verhindert den Verlust aller Leben bei einer Berührung.'), start(dangerBody,dangerEvents), [enemyMade,lifeCheck,hurtCheck], [overlap('Enemy',hurt)]),
    step(L('Press ▶. Collect coins and try touching the enemy. With no lives left, the engine ends the game for you. Restart to try again.', 'Trykk ▶. Ta mynter og prøv å treffe fienden. Når du ikke har flere liv, avslutter spillmotoren spillet for deg. Start på nytt for å prøve igjen.', 'Pulsa ▶. Recoge monedas y prueba a tocar al enemigo. Sin vidas, el motor termina el juego. Reinicia para intentarlo otra vez.', 'Appuie sur ▶. Ramasse des pièces et essaie de toucher l’ennemi. Sans vies, le moteur termine le jeu. Relance-le pour réessayer.', 'Drücke ▶. Sammle Münzen und berühre den Gegner. Ohne Leben beendet die Spielengine das Spiel. Starte neu und versuche es wieder.'), start(dangerBody,dangerEvents), [play,collect,bouncing,dangerWorks]),
  ],
  bonus: inStart(L('Bonus: start with 5 lives.', 'Bonus: start med 5 liv.', 'Extra: empieza con 5 vidas.', 'Bonus : commence avec 5 vies.', 'Bonus: Starte mit 5 Leben.'), {type:'ab_life_set',inputs:{VALUE:numIn(5,5)}}),
};

const randomCoinPosition = (name: string) => blk('ab_sprite_set_position', {
  i: { SPRITE: get(name), X: random(8, 112), Y: random(16, 48) },
});
const deluxeCoinBody = [...initial, coins[0], randomCoinPosition('myCoin')];
const deluxeVelocity = blk('ab_sprite_set_velocity', { i: { SPRITE: get('myEnemy'), VX: num(30), VY: num(22) } });
const deluxeBouncing: Check = {
  text: L('The enemy moves and bounces horizontally and vertically', 'Fienden beveger seg og spretter både vannrett og loddrett', 'El enemigo se mueve y rebota horizontal y verticalmente', 'L’ennemi bouge et rebondit horizontalement et verticalement', 'Der Gegner bewegt sich und prallt horizontal und vertikal ab'),
  ok: () => true,
  run: async (e, frame) => {
    const enemy = e.sprites.find(s => s.alive && s.kind === 1);
    const hero = e.sprites.findIndex(s => s.alive && s.kind === 0);
    if (!enemy || hero < 0 || !enemy.vx || !enemy.vy) return false;
    const { x, y, vx, vy } = enemy;
    let movedX = false, movedY = false, bouncedX = false, bouncedY = false;
    for (let i = 0; i < 600; i++) {
      // Keep contact damage separate from this movement check.
      e.setPosition(hero, enemy.x > 64 * 256 ? 16 : 112, enemy.y > 32 * 256 ? 12 : 56);
      await frame();
      movedX ||= enemy.x !== x;
      movedY ||= enemy.y !== y;
      bouncedX ||= enemy.vx * vx < 0;
      bouncedY ||= enemy.vy * vy < 0;
      if (movedX && movedY && bouncedX && bouncedY) return true;
      if (e.gameOverPending) return false;
    }
    return false;
  },
};
const deluxeDangerBody = [...deluxeCoinBody, ...enemy, deluxeVelocity, bounce, lives];
const moreCoins = [create('coin2','coin','Food'), randomCoinPosition('coin2'), create('coin3','coin','Food'), randomCoinPosition('coin3')];
const timeStart = set('timeLeft',num(300));
const lose = ifThen(cmp('LTE',get('timeLeft'),num(0)),[blk('ab_game_over',{f:{WIN:'lose'}})]);
const timer = (finish: boolean) => blk('ab_on_every',{f:{MS:1000},body:[change('timeLeft',-1), ...(finish ? [lose] : [])]});
const win = ifThen(cmp('GTE',blk('ab_score'),num(100)),[blk('ab_game_over',{f:{WIN:'win'}})]);
const castleBody = [...deluxeDangerBody,...moreCoins,timeStart];
const castleEvents = [overlap('Food',[score(),respawn(),win]),overlap('Enemy',hurt),timer(true)];
const timedOut: Check = {text:L('The game ends when time runs out', 'Spillet slutter når tiden går ut', 'El juego termina al agotarse el tiempo', 'Le jeu se termine quand le temps est écoulé', 'Das Spiel endet, wenn die Zeit abläuft'),ok:()=>true,
  run:async(e,frame)=>{
    // Keep the timeout check independent of random coin positions and contact damage.
    e.sprites.forEach((s, i) => { if (s.alive) { e.setPosition(i, s.kind === 0 ? 16 : 96, s.kind === 0 ? 56 : 20); e.setVelocity(i, 0, 0); } });
    for (let remaining = 18749; remaining > 0; remaining -= 600) await frame(0, Math.min(remaining, 600));
    if (e.gameOverPending) return false;
    await frame(0, 2);
    return e.gameOverPending && !e.gameOverWin;
  }};
const victory: Check = {text:L('Collecting 100 coins wins, but 99 does not', '100 mynter gir seier, men 99 gjør ikke det', 'Recoger 100 monedas gana, pero 99 no', '100 pièces font gagner, mais pas 99', '100 Münzen bringen den Sieg, aber 99 nicht'),ok:()=>true,
  run:async(e,frame)=>{
    const hero = e.sprites.findIndex(s => s.alive && s.kind === 0);
    const food = e.sprites.flatMap((s, i) => s.alive && s.kind === 3 ? [i] : []);
    if (hero < 0 || food.length !== 3 || e.score !== 0) return false;
    e.sprites.forEach((s, i) => { if (s.alive && s.kind === 1) { e.setPosition(i, 0, 0); e.setVelocity(i, 0, 0); } });
    for (let count = 1; count <= 100; count++) {
      food.forEach(i => e.setPosition(i, 112, 48));
      const collected = food[(count - 1) % food.length];
      e.setPosition(collected, 64, 32);
      e.setPosition(hero, 64, 32);
      await frame();
      if (e.score !== count || (count < 100 && e.gameOverPending)) return false;
      const coin = e.sprites[collected];
      if (!coin.alive || coin.x < 8 * 256 || coin.x > 112 * 256 || coin.y < 16 * 256 || coin.y > 48 * 256) return false;
    }
    return e.gameOverPending && e.gameOverWin;
  }};

// Each chapter builds on the previous one, starting with an empty workspace.
// Validate the cumulative code, including sprite references, ordering and random ranges.
const deluxeStep = (s: GuideStep): GuideStep => ({ ...s, checks: [
  ...s.checks,
  { text: L('All blocks are connected as shown', 'Alle blokkene er koblet sammen som vist', 'Todos los bloques están conectados como se muestra', 'Tous les blocs sont reliés comme indiqué', 'Alle Blöcke sind wie gezeigt verbunden'),
    ok: c => matchesSolution(c.blocks, s.solution) },
] });
const deluxePrelude: GuideStep[] = [
  step(L('Start with “on start” from Game. Inside, create a Player sprite with the hero picture and name its variable mySprite. Add “set position” for mySprite: x 16, y 48. The screen is 128 by 64 pixels; x goes right and y goes down.', 'Start med «når spillet starter» fra Spill. Inni lager du en Spiller-sprite med heltebildet og variabelnavnet mySprite. Legg til «sett posisjon» for mySprite: x 16, y 48. Skjermen er 128 ganger 64 punkter; x går mot høyre og y nedover.', 'Empieza con «al iniciar» de Juego. Dentro, crea un sprite Jugador con el héroe y la variable mySprite. Fija su posición: x 16, y 48. La pantalla es de 128 por 64 píxeles; x va a la derecha e y hacia abajo.', 'Commence par «au démarrage» depuis Jeu. Crée dedans un sprite Joueur avec le héros et la variable mySprite. Place-le à x 16, y 48. L’écran mesure 128 sur 64 pixels ; x va à droite et y vers le bas.', 'Beginne mit „beim Start“ aus Spiel. Erstelle darin einen Spieler mit dem Heldenbild und der Variable mySprite. Setze seine Position auf x 16, y 48. Der Bildschirm hat 128 mal 64 Pixel; x geht nach rechts, y nach unten.'), start(initial.slice(0, 2)), [], [blk('ab_on_start', { body: initial.slice(0, 2) })]),
  step(L('Under the position block, add “animate” from Sprites for mySprite, every 200 ms. It switches between the hero’s pictures to make its legs move.', 'Under posisjon-blokken legger du «animer» fra Sprites for mySprite, hver 200 ms. Den bytter mellom heltens bilder slik at beina beveger seg.', 'Debajo de la posición, añade «animar» de Sprites para mySprite cada 200 ms. Alterna las imágenes del héroe para mover las piernas.', 'Sous la position, ajoute «animer» depuis Sprites pour mySprite toutes les 200 ms. Cela alterne les images du héros pour faire bouger ses jambes.', 'Füge unter der Position „animieren“ aus Sprites für mySprite alle 200 ms ein. Es wechselt die Heldenbilder und bewegt so die Beine.'), start(initial.slice(0, 3)), [], [initial[2]]),
  step(L('Add “move with buttons” from Controller for mySprite: vx 60, vy 60. These speeds let you move in all four directions using arrows or the simulator’s on-screen buttons.', 'Legg til «flytt med knappene» fra Kontroller for mySprite: vx 60, vy 60. Denne farten lar deg gå i alle fire retninger med piltastene eller knappene på simulatorskjermen.', 'Añade «mover con botones» de Controlador para mySprite: vx 60, vy 60. Muévete en las cuatro direcciones con flechas o botones en pantalla.', 'Ajoute «déplacer avec les boutons» depuis Contrôleur pour mySprite : vx 60, vy 60. Utilise les flèches ou les boutons à l’écran dans les quatre directions.', 'Füge „mit Tasten bewegen“ aus Controller für mySprite hinzu: vx 60, vy 60. Nutze Pfeile oder Bildschirmtasten für alle vier Richtungen.'), start(initial.slice(0, 4)), [], [initial[3]]),
  step(L('Add the sprite flag “stay in screen” from Sprites for mySprite and turn it on. The hero now stops at the screen edges.', 'Legg til sprite-flagget «hold deg på skjermen» fra Sprites for mySprite og slå det på. Nå stopper helten ved skjermkantene.', 'Activa «quedarse en pantalla» de Sprites para mySprite. El héroe se detiene en los bordes.', 'Active «rester à l’écran» depuis Sprites pour mySprite. Le héros s’arrête aux bords.', 'Aktiviere „im Bildschirm bleiben“ aus Sprites für mySprite. Der Held hält am Rand an.'), start(initial), [], [initial[4]]),
  step(L('Create a Food sprite with the coin picture and variable myCoin in “on start”. Add its position block. From Math, use “pick random” for x (8 to 112) and y (16 to 48). The two random numbers place the coin inside the screen at each new start, below the score and hearts.', 'Lag en Mat-sprite med myntbildet og variabelen myCoin i «når spillet starter». Legg til posisjon-blokken. Fra Matte bruker du «tilfeldig tall» for x (8 til 112) og y (16 til 48). De to tilfeldige tallene plasserer mynten innenfor skjermen ved hver ny start, under poengene og hjertene.', 'Crea un sprite Comida con la moneda y variable myCoin en «al iniciar». Añade su posición con «número al azar» de Matemáticas: x de 8 a 112, y de 16 a 48. Empieza dentro de la pantalla, bajo los puntos y corazones.', 'Crée un sprite Nourriture avec la pièce et la variable myCoin au démarrage. Positionne-le avec deux nombres au hasard depuis Maths : x de 8 à 112, y de 16 à 48. Il commence dans l’écran, sous le score et les cœurs.', 'Erstelle beim Start eine Essen-Münze mit der Variable myCoin. Setze ihre Position mit Zufallszahlen aus Mathe: x von 8 bis 112, y von 16 bis 48. So startet sie im Bildschirm unter Punkten und Herzen.'), start(deluxeCoinBody), [coinMade], deluxeCoinBody.slice(initial.length)),
  ...level13.steps.slice(2, 5).map((s, i) => ({ ...s, solution: start(deluxeCoinBody, [overlap('Food', [[], [score()], [score(), respawn()]][i])]) })),
  ...level14.steps.slice(0, 5).map((s, i) => ({ ...s,
    ...(i === 1 ? {
      text: L('Set myEnemy’s velocity to vx 30, vy 22. vx moves it sideways and vy moves it downwards, so it travels diagonally across the play area. Both speeds are in pixels per second.', 'Sett farten til myEnemy til vx 30, vy 22. vx flytter den sidelengs og vy nedover, så den går diagonalt over spilleflaten. Begge hastighetene er i punkter per sekund.', 'Fija la velocidad de myEnemy en vx 30, vy 22. vx lo mueve de lado y vy hacia abajo: cruza el área en diagonal. Ambas velocidades se miden en píxeles por segundo.', 'Règle la vitesse de myEnemy à vx 30, vy 22. vx le déplace sur le côté et vy vers le bas : il traverse le terrain en diagonale. Les vitesses sont en pixels par seconde.', 'Setze die Geschwindigkeit von myEnemy auf vx 30, vy 22. vx bewegt ihn seitlich, vy nach unten: Er läuft diagonal über das Spielfeld. Beide Werte sind Pixel pro Sekunde.'),
      show: [deluxeVelocity],
      checks: [enemyMade, inStart(L('Set both horizontal and vertical velocity', 'Sett både vannrett og loddrett fart', 'Fija velocidad horizontal y vertical', 'Règle les vitesses horizontale et verticale', 'Setze horizontale und vertikale Geschwindigkeit'), { type: 'ab_sprite_set_velocity', inputs: { VX: numIn(30, 30), VY: numIn(22, 22) } })],
    } : {}),
    ...(i === 2 ? {
      text: L('Turn on “bounce on wall” from Sprites for myEnemy. At the left and right edges vx reverses; at the top and bottom vy reverses. The slime now moves up, down and sideways instead of staying on one line.', 'Slå på «sprett mot vegg» fra Sprites for myEnemy. Ved venstre og høyre kant snur vx; ved toppen og bunnen snur vy. Nå beveger slimet seg opp, ned og sidelengs i stedet for å holde seg på én linje.', 'Activa «rebotar en pared» de Sprites para myEnemy. En los bordes izquierdo y derecho se invierte vx; arriba y abajo, vy. El limo se mueve en ambas direcciones.', 'Active «rebondir sur les murs» depuis Sprites pour myEnemy. À gauche et à droite, vx s’inverse ; en haut et en bas, vy s’inverse. Le slime se déplace dans les deux directions.', 'Aktiviere „an Wand abprallen“ aus Sprites für myEnemy. Links und rechts kehrt vx um; oben und unten vy. Der Schleim bewegt sich nun auf und ab und seitlich.'),
      checks: [enemyMade, deluxeBouncing],
    } : {}),
    solution: start(deluxeDangerBody.slice(0, deluxeCoinBody.length + [2, 3, 4, 5, 5][i]), i === 4 ? dangerEvents : coinEvents),
  })),
];
export const castle1: Guide = {
  id:'w1-castle',number:'1-5',title:L('Coin hunt deluxe','Myntjakt deluxe','Caza de monedas deluxe','Chasse aux pièces deluxe','Münzjagd deluxe'),
  description:L('Your first complete game: coins, an enemy and a time limit.', 'Ditt første hele spill: mynter, en fiende og en tidsfrist.', 'Tu primer juego completo: monedas, un enemigo y un límite de tiempo.', 'Ton premier jeu complet : des pièces, un ennemi et un temps limité.', 'Dein erstes vollständiges Spiel: Münzen, ein Gegner und ein Zeitlimit.'),
  images:['hero-run','coin','slime'],start:workspace([]),
  chapters: [
    { start: 0, title: L('Build the hero', 'Lag helten', 'Crea el héroe', 'Crée le héros', 'Baue den Helden') },
    { start: 4, title: L('Random coins and points', 'Tilfeldige mynter og poeng', 'Monedas al azar y puntos', 'Pièces au hasard et points', 'Zufällige Münzen und Punkte') },
    { start: 8, title: L('Enemy and lives', 'Fiende og liv', 'Enemigo y vidas', 'Ennemi et vies', 'Gegner und Leben') },
    { start: 13, title: L('100 coins against the clock', '100 mynter på tid', '100 monedas contra reloj', '100 pièces contre la montre', '100 Münzen gegen die Uhr') },
  ],
  steps:[
    ...deluxePrelude,
    step(L('Welcome to the castle! Add two more Food coins, with random x (8 to 112) and y (16 to 48), just like myCoin. Use separate variables coin2 and coin3. The same contact event works for every Food sprite.', 'Velkommen til slottet! Legg til to Mat-mynter, med tilfeldig x (8 til 112) og y (16 til 48), akkurat som myCoin. Bruk egne variabler coin2 og coin3. Den samme treff-hendelsen virker for alle Mat-sprites.', '¡Bienvenido al castillo! Añade dos monedas Comida con x al azar (8 a 112) e y al azar (16 a 48), como myCoin. Usa variables coin2 y coin3. El mismo evento funciona para todos los sprites Comida.', 'Bienvenue au château ! Ajoute deux pièces Nourriture avec x au hasard (8 à 112) et y au hasard (16 à 48), comme myCoin. Utilise coin2 et coin3. Le même événement fonctionne pour tous les sprites Nourriture.', 'Willkommen im Schloss! Füge zwei Essen-Münzen mit zufälligem x (8 bis 112) und y (16 bis 48) hinzu, wie myCoin. Nutze coin2 und coin3. Dasselbe Ereignis funktioniert für alle Essen-Sprites.'),start([...deluxeDangerBody,...moreCoins],dangerEvents),[{
      text:L('There are 3 coins in the game','Det er 3 mynter i spillet','Hay 3 monedas en el juego','Il y a 3 pièces dans le jeu','Es gibt 3 Münzen im Spiel'),ok:()=>true,run:async(e)=>e.sprites.filter(s=>s.alive&&s.kind===3).length===3}],moreCoins),
    step(L('Create a variable named timeLeft in Variables. In “on start”, set it to 300. A variable remembers a value; this one remembers how many seconds remain.', 'Lag en variabel kalt timeLeft i Variabler. Sett den til 300 i «når spillet starter». En variabel husker en verdi; denne husker hvor mange sekunder som er igjen.', 'Crea una variable timeLeft en Variables. En «al iniciar», fíjala en 300. Una variable recuerda un valor; esta recuerda los segundos restantes.', 'Crée une variable timeLeft dans Variables. Dans «au démarrage», mets-la à 300. Une variable mémorise une valeur ; celle-ci retient les secondes restantes.', 'Erstelle in Variablen timeLeft. Setze sie in „beim Start“ auf 300. Eine Variable merkt sich einen Wert; diese merkt sich die übrigen Sekunden.'),start(castleBody,dangerEvents),[inStart(L('Set a variable to 300','Sett en variabel til 300','Fija una variable en 300','Mets une variable à 300','Setze eine Variable auf 300'),{type:'variables_set',inputs:{VALUE:numIn(300,300)}})], [timeStart]),
    step(L('Drag “every 1000 ms” from Game onto the workspace. 1000 milliseconds is one second. Inside, change timeLeft by -1, so it counts down once per second.', 'Dra «hver 1000 ms» fra Spill ut på flaten. 1000 millisekunder er ett sekund. Inni endrer du timeLeft med -1, så den teller ned én gang i sekundet.', 'Arrastra «cada 1000 ms» desde Juego. 1000 milisegundos son un segundo. Dentro, cambia timeLeft por -1 para contar hacia atrás.', 'Glisse «toutes les 1000 ms» depuis Jeu. 1000 millisecondes font une seconde. Dedans, change timeLeft de -1 pour compter à rebours.', 'Zieh „alle 1000 ms“ aus Spiel auf die Fläche. 1000 Millisekunden sind eine Sekunde. Ändere darin timeLeft um -1, damit sie herunterzählt.'),start(castleBody,[...dangerEvents,timer(false)]),[structure(L('Count down every second','Tell ned hvert sekund','Cuenta atrás cada segundo','Compte à rebours chaque seconde','Zähle jede Sekunde herunter'),{type:'ab_on_every',fields:{MS:'1000'},contains:[{type:'math_change',inputs:{DELTA:numIn(-1,-1)}}]})],[timer(false)]),
    step(L('From Logic, put an “if” under the countdown. If timeLeft ≤ 0, use “game over: lose” from Game. An if block only runs its inside blocks when its question is true.', 'Fra Logikk legger du «hvis» under nedtellingen. Hvis timeLeft ≤ 0, bruk «spill slutt: tap» fra Spill. En hvis-blokk kjører bare blokkene inni når spørsmålet er sant.', 'Desde Lógica, pon «si» debajo. Si timeLeft ≤ 0, usa «fin del juego: perder» de Juego. Un bloque si ejecuta su interior cuando la condición es verdadera.', 'Depuis Logique, mets «si» sous le compte à rebours. Si timeLeft ≤ 0, utilise «fin du jeu : perdu». Un bloc si exécute son contenu quand sa condition est vraie.', 'Setze aus Logik „wenn“ unter den Countdown. Wenn timeLeft ≤ 0, nutze „Spielende: verloren“. Ein Wenn-Block führt seinen Inhalt aus, wenn seine Bedingung wahr ist.'),start(castleBody,[...dangerEvents,timer(true)]),[timedOut],[timer(true)]),
    step(L('In the coin contact event, after moving the coin, add another if: if score ≥ 100, game over: win. Use the score value from Info in the comparison from Logic. Now your game has both a way to win and a way to lose!', 'I myntens treff-hendelse, etter at mynten flyttes, legger du til en hvis: hvis poeng ≥ 100, spill slutt: seier. Bruk poengverdien fra Info i sammenligningen fra Logikk. Nå har spillet både en måte å vinne og en måte å tape på!', 'En el evento de moneda, después de moverla, añade si: si puntos ≥ 100, fin del juego: ganar. Usa el valor de puntos de Info en la comparación de Lógica. ¡Ya puedes ganar o perder!', 'Dans l’événement de pièce, après l’avoir déplacée, ajoute si : si score ≥ 100, fin du jeu : gagné. Utilise la valeur du score depuis Info dans la comparaison de Logique. On peut maintenant gagner ou perdre !', 'Füge im Münzereignis nach dem Versetzen ein Wenn hinzu: Wenn Punkte ≥ 100, Spielende: gewonnen. Nutze den Punktewert aus Info im Vergleich aus Logik. Jetzt kann man gewinnen und verlieren!'),start(castleBody,castleEvents),[timedOut,victory],[win]),
    step(L('Press ▶ and collect 100 coins before 300 seconds pass. Avoid the slime! Try again with a different route. You have made your first complete game.', 'Trykk ▶ og samle 100 mynter før 300 sekunder har gått. Unngå slimet! Prøv igjen med en annen vei. Du har laget ditt første hele spill.', 'Pulsa ▶ y recoge 100 monedas antes de 300 segundos. ¡Evita el limo! Prueba otra ruta. Has creado tu primer juego completo.', 'Appuie sur ▶ et ramasse 100 pièces en moins de 300 secondes. Évite le slime ! Essaie un autre chemin. Tu as créé ton premier jeu complet.', 'Drücke ▶ und sammle 100 Münzen vor Ablauf der 300 Sekunden. Meide den Schleim! Probiere einen anderen Weg. Du hast dein erstes vollständiges Spiel gebaut.'),start(castleBody,castleEvents),[play,timedOut,victory,deluxeBouncing]),
  ].map(deluxeStep),
  bonus: event(L('Bonus: inside the score ≥ 100 if block, add the win sound from Music before “game over: win”.', 'Bonus: inni hvis-blokken for poeng ≥ 100 legger du seierslyden fra Musikk før «spill slutt: seier».', 'Extra: dentro de si puntos ≥ 100, añade el sonido de victoria de Música antes de ganar.', 'Bonus : dans si score ≥ 100, ajoute le son de victoire depuis Musique avant la fin du jeu.', 'Bonus: Füge im Wenn-Block Punkte ≥ 100 den Siegton aus Musik vor dem Spielende hinzu.'),'Food',[{type:'ab_play_effect',fields:{SFX:'win'}}]),
};
