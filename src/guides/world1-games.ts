import { blk, cmp, get, ifThen, num, set, workspace, change, flag } from '../templates/dsl';
import type { B } from '../templates/dsl';
import type { LocalizedText } from '../project/model';
import { hasTop, numIn, type Check, type Guide, type Pattern, type GuideStep } from './guide';

const L = (en: string, nb: string, es: string, fr: string, de: string): LocalizedText => ({ en, nb, es, fr, de });
const create = (name: string, image: string, kind: string) => set(name, blk('ab_sprite_create', { f: { IMAGE: image, KIND: kind } }));
const pos = (name: string, x: number, y: number) => blk('ab_sprite_set_position', { i: { SPRITE: get(name), X: num(x), Y: num(y) } });
const score = () => blk('ab_score_change', { i: { VALUE: num(1) } });
const remove = () => blk('ab_sprite_destroy', { i: { SPRITE: get('otherSprite') } });
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
const removeCoin = event(L('Remove the collected coin', 'Fjern mynten du har tatt', 'Elimina la moneda recogida', 'Supprime la pièce ramassée', 'Entferne die eingesammelte Münze'), 'Food', [{ type: 'ab_sprite_destroy' }]);
const play: Check = { text: L('Press ▶ and try your game', 'Trykk ▶ og prøv spillet ditt', 'Pulsa ▶ y prueba tu juego', 'Appuie sur ▶ et essaie ton jeu', 'Drücke ▶ und probiere dein Spiel'), ok: (c) => c.played > 0 };
const collect: Check = {
  text: L('Your game gives points and removes coins', 'Spillet ditt gir poeng og fjerner mynter', 'Tu juego da puntos y elimina monedas', 'Ton jeu donne des points et supprime les pièces', 'Dein Spiel gibt Punkte und entfernt Münzen'),
  ok: () => true,
  run: async (e, frame) => {
    const hero = e.sprites.find((s) => s.alive && s.kind === 0);
    const coin = e.sprites.find((s) => s.alive && s.kind === 3);
    if (!hero || !coin) return false;
    const before = e.score;
    for (let i = 0; i < 240 && coin.alive; i++) {
      const dx = coin.x - hero.x, dy = coin.y - hero.y;
      await frame((Math.abs(dx) > 256 ? 1 << (dx > 0 ? 3 : 2) : 0) | (Math.abs(dy) > 256 ? 1 << (dy > 0 ? 1 : 0) : 0));
    }
    if (coin.alive || e.score !== before + 1) return false;
    await frame(0, 10);
    return e.score === before + 1;
  },
};
const step = (text: LocalizedText, solution: B, checks: Check[], show?: B[]): GuideStep => ({ text, solution, checks, show });
const coinBody = [...initial, ...coins];
const coinEvents = [overlap('Food', [score(), remove()])];

export const level13: Guide = {
  id: 'w1-coins', number: '1-3',
  title: L('Coin hunt', 'Myntjakt', 'Caza de monedas', 'Chasse aux pièces', 'Münzjagd'),
  description: L('Collect a coin and earn your first point.', 'Ta en mynt og få ditt første poeng.', 'Recoge una moneda y gana tu primer punto.', 'Ramasse une pièce et gagne ton premier point.', 'Sammle eine Münze und erhalte deinen ersten Punkt.'),
  images: ['hero-run', 'coin'], start: start(initial),
  steps: [
    step(L('We use all four arrows again. Make a new sprite in “on start”. Choose the coin picture and Food as its kind. A kind groups sprites with the same job. Name its variable myCoin.', 'Vi bruker alle fire pilene igjen. Lag en ny sprite i «når spillet starter». Velg myntbildet og Mat som type. En type samler figurer med samme oppgave. Kall variabelen myCoin.', 'Usamos las cuatro flechas otra vez. Crea un sprite en «al iniciar». Elige la moneda y el tipo Comida. Un tipo agrupa figuras con la misma tarea. Llama myCoin a su variable.', 'On utilise à nouveau les quatre flèches. Crée un sprite dans «au démarrage». Choisis la pièce et le type Nourriture. Un type regroupe les figures ayant le même rôle. Nomme sa variable myCoin.', 'Wir nutzen wieder alle vier Pfeile. Erstelle ein Sprite in „beim Start“. Wähle die Münze und den Typ Essen. Ein Typ gruppiert Figuren mit derselben Aufgabe. Nenne die Variable myCoin.'), start([...initial, coins[0]]), [coinMade], [coins[0]]),
    step(L('Put myCoin at x 64, y 48. It must have its own position block: select myCoin, so you move the coin rather than the hero.', 'Sett myCoin på x 64, y 48. Den trenger sin egen posisjon-blokk: velg myCoin, slik at du flytter mynten.', 'Pon myCoin en x 64, y 48. Necesita su propio bloque de posición: selecciona myCoin para mover la moneda.', 'Place myCoin à x 64, y 48. Il lui faut son propre bloc de position : sélectionne myCoin pour déplacer la pièce.', 'Setze myCoin auf x 64, y 48. Sie braucht einen eigenen Positionsblock: Wähle myCoin, um die Münze zu verschieben.'), start(coinBody), [coinMade, inStart(L('Place the coin at x 64, y 48', 'Plasser mynten på x 64, y 48', 'Coloca la moneda en x 64, y 48', 'Place la pièce à x 64, y 48', 'Platziere die Münze bei x 64, y 48'), { type: 'ab_sprite_set_position', inputs: { X: numIn(64,64), Y: numIn(48,48) } })], [coins[1]]),
    step(L('Drag “when sprite overlaps” from Sprites onto the workspace. Choose Player and Food. This event runs when the hero touches a coin.', 'Dra «når sprite overlapper» fra Sprites ut på flaten. Velg Spiller og Mat. Denne hendelsen kjører når helten treffer en mynt.', 'Arrastra el evento de contacto de Sprites al área de trabajo. Elige Jugador y Comida. Se ejecuta cuando el héroe toca una moneda.', 'Glisse l’événement de contact depuis Sprites sur la zone de travail. Choisis Joueur et Nourriture. Il se déclenche quand le héros touche une pièce.', 'Zieh das Berührungsereignis aus Sprites auf die Arbeitsfläche. Wähle Spieler und Essen. Es läuft, wenn der Held eine Münze berührt.'), start(coinBody, [overlap('Food', [])]), [coinMade, coinEvent], [overlap('Food', [])]),
    step(L('From Info, put “change score by 1” inside the contact event. The score counts the coins you collect.', 'Fra Info legger du «endre poeng med 1» inni treff-hendelsen. Poengene teller myntene du samler.', 'Desde Info, pon «cambiar puntos por 1» dentro del evento. Los puntos cuentan las monedas recogidas.', 'Depuis Info, mets «changer le score de 1» dans l’événement. Le score compte les pièces ramassées.', 'Setze aus Info „ändere Punkte um 1“ in das Ereignis. Die Punkte zählen die gesammelten Münzen.'), start(coinBody, [overlap('Food', [score()])]), [coinMade, addPoint], [score()]),
    step(L('Add “destroy sprite” under the point block. Select otherSprite: in this event, that is the coin. Without removing it, you could score again every frame!', 'Legg «fjern sprite» under poengblokken. Velg otherSprite: i denne hendelsen er det mynten. Uten å fjerne den kan du få poeng på nytt hvert bilde!', 'Añade «eliminar sprite» debajo. Elige otherSprite: aquí es la moneda. ¡Si no la eliminas, recibirás puntos en cada fotograma!', 'Ajoute «détruire le sprite» en dessous. Choisis otherSprite : ici, c’est la pièce. Sinon, tu pourrais gagner des points à chaque image !', 'Füge „zerstöre Sprite“ darunter ein. Wähle otherSprite: Hier ist das die Münze. Sonst könntest du in jedem Bild erneut Punkte bekommen!'), start(coinBody, coinEvents), [coinMade, addPoint, removeCoin], [remove()]),
    step(L('Press ▶ and steer into the coin. It should disappear and the score should become 1. The guide also tests that your code does this.', 'Trykk ▶ og gå inn i mynten. Den skal forsvinne og poengene bli 1. Guiden tester også at koden din gjør dette.', 'Pulsa ▶ y ve hacia la moneda. Debe desaparecer y los puntos subir a 1. La guía también comprueba tu código.', 'Appuie sur ▶ et va vers la pièce. Elle doit disparaître et le score passer à 1. Le guide teste aussi ton code.', 'Drücke ▶ und gehe zur Münze. Sie soll verschwinden und der Punktestand auf 1 steigen. Die Anleitung prüft auch deinen Code.'), start(coinBody, coinEvents), [coinMade, addPoint, removeCoin, play, collect]),
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
    step(L('Press ▶. Collect the coin and try touching the enemy. With no lives left, the engine ends the game for you. Restart to try again.', 'Trykk ▶. Ta mynten og prøv å treffe fienden. Når du ikke har flere liv, avslutter spillmotoren spillet for deg. Start på nytt for å prøve igjen.', 'Pulsa ▶. Recoge la moneda y prueba a tocar al enemigo. Sin vidas, el motor termina el juego. Reinicia para intentarlo otra vez.', 'Appuie sur ▶. Ramasse la pièce et essaie de toucher l’ennemi. Sans vies, le moteur termine le jeu. Relance-le pour réessayer.', 'Drücke ▶. Sammle die Münze und berühre den Gegner. Ohne Leben beendet die Spielengine das Spiel. Starte neu und versuche es wieder.'), start(dangerBody,dangerEvents), [play,collect,bouncing,dangerWorks]),
  ],
  bonus: inStart(L('Bonus: start with 5 lives.', 'Bonus: start med 5 liv.', 'Extra: empieza con 5 vidas.', 'Bonus : commence avec 5 vies.', 'Bonus: Starte mit 5 Leben.'), {type:'ab_life_set',inputs:{VALUE:numIn(5,5)}}),
};

const moreCoins = [create('coin2','coin','Food'),pos('coin2',96,48),create('coin3','coin','Food'),pos('coin3',112,48)];
const timeStart = set('timeLeft',num(20));
const lose = ifThen(cmp('LTE',get('timeLeft'),num(0)),[blk('ab_game_over',{f:{WIN:'lose'}})]);
const timer = (finish: boolean) => blk('ab_on_every',{f:{MS:1000},body:[change('timeLeft',-1), ...(finish ? [lose] : [])]});
const win = ifThen(cmp('GTE',blk('ab_score'),num(3)),[blk('ab_game_over',{f:{WIN:'win'}})]);
const castleBody = [...dangerBody,...moreCoins,timeStart];
const castleEvents = [overlap('Food',[score(),remove(),win]),overlap('Enemy',hurt),timer(true)];
const timedOut: Check = {text:L('The game ends when time runs out', 'Spillet slutter når tiden går ut', 'El juego termina al agotarse el tiempo', 'Le jeu se termine quand le temps est écoulé', 'Das Spiel endet, wenn die Zeit abläuft'),ok:()=>true,
  run:async(e,frame)=>{
    await frame(0,600); await frame(0,590);
    if (e.gameOverPending) return false;
    await frame(0,100);
    return e.gameOverPending && !e.gameOverWin;
  }};
const victory: Check = {text:L('Collecting all 3 coins wins the game', 'Alle 3 myntene gir seier', 'Recoger las 3 monedas gana el juego', 'Ramasser les 3 pièces fait gagner', 'Alle 3 Münzen bringen den Sieg'),ok:()=>true,
  run:async(e,frame)=>{ await frame(1<<3,115); return e.score===3 && e.gameOverPending && e.gameOverWin; }};
export const castle1: Guide = {
  id:'w1-castle',number:'1-5',title:L('Coin hunt deluxe','Myntjakt deluxe','Caza de monedas deluxe','Chasse aux pièces deluxe','Münzjagd deluxe'),
  description:L('Your first complete game: coins, an enemy and a time limit.', 'Ditt første hele spill: mynter, en fiende og en tidsfrist.', 'Tu primer juego completo: monedas, un enemigo y un límite de tiempo.', 'Ton premier jeu complet : des pièces, un ennemi et un temps limité.', 'Dein erstes vollständiges Spiel: Münzen, ein Gegner und ein Zeitlimit.'),
  images:['hero-run','coin','slime'],start:start(dangerBody,dangerEvents),
  steps:[
    step(L('Welcome to the castle! Add two more Food coins, at x 96 and x 112, both at y 48. Use separate variables coin2 and coin3. The same contact event works for every Food sprite.', 'Velkommen til slottet! Legg til to Mat-mynter, på x 96 og x 112, begge på y 48. Bruk egne variabler coin2 og coin3. Den samme treff-hendelsen virker for alle Mat-sprites.', '¡Bienvenido al castillo! Añade dos monedas Comida en x 96 y x 112, ambas en y 48. Usa variables coin2 y coin3. El mismo evento funciona para todos los sprites Comida.', 'Bienvenue au château ! Ajoute deux pièces Nourriture à x 96 et x 112, toutes deux à y 48. Utilise coin2 et coin3. Le même événement fonctionne pour tous les sprites Nourriture.', 'Willkommen im Schloss! Füge zwei Essen-Münzen bei x 96 und x 112 hinzu, beide bei y 48. Nutze coin2 und coin3. Dasselbe Ereignis funktioniert für alle Essen-Sprites.'),start([...dangerBody,...moreCoins],dangerEvents),[{
      text:L('There are 3 coins in the game','Det er 3 mynter i spillet','Hay 3 monedas en el juego','Il y a 3 pièces dans le jeu','Es gibt 3 Münzen im Spiel'),ok:()=>true,run:async(e)=>e.sprites.filter(s=>s.alive&&s.kind===3).length===3}],moreCoins),
    step(L('Create a variable named timeLeft in Variables. In “on start”, set it to 20. A variable remembers a value; this one remembers how many seconds remain.', 'Lag en variabel kalt timeLeft i Variabler. Sett den til 20 i «når spillet starter». En variabel husker en verdi; denne husker hvor mange sekunder som er igjen.', 'Crea una variable timeLeft en Variables. En «al iniciar», fíjala en 20. Una variable recuerda un valor; esta recuerda los segundos restantes.', 'Crée une variable timeLeft dans Variables. Dans «au démarrage», mets-la à 20. Une variable mémorise une valeur ; celle-ci retient les secondes restantes.', 'Erstelle in Variablen timeLeft. Setze sie in „beim Start“ auf 20. Eine Variable merkt sich einen Wert; diese merkt sich die übrigen Sekunden.'),start(castleBody,dangerEvents),[inStart(L('Set a variable to 20','Sett en variabel til 20','Fija una variable en 20','Mets une variable à 20','Setze eine Variable auf 20'),{type:'variables_set',inputs:{VALUE:numIn(20,20)}})], [timeStart]),
    step(L('Drag “every 1000 ms” from Game onto the workspace. 1000 milliseconds is one second. Inside, change timeLeft by -1, so it counts down once per second.', 'Dra «hver 1000 ms» fra Spill ut på flaten. 1000 millisekunder er ett sekund. Inni endrer du timeLeft med -1, så den teller ned én gang i sekundet.', 'Arrastra «cada 1000 ms» desde Juego. 1000 milisegundos son un segundo. Dentro, cambia timeLeft por -1 para contar hacia atrás.', 'Glisse «toutes les 1000 ms» depuis Jeu. 1000 millisecondes font une seconde. Dedans, change timeLeft de -1 pour compter à rebours.', 'Zieh „alle 1000 ms“ aus Spiel auf die Fläche. 1000 Millisekunden sind eine Sekunde. Ändere darin timeLeft um -1, damit sie herunterzählt.'),start(castleBody,[...dangerEvents,timer(false)]),[structure(L('Count down every second','Tell ned hvert sekund','Cuenta atrás cada segundo','Compte à rebours chaque seconde','Zähle jede Sekunde herunter'),{type:'ab_on_every',fields:{MS:'1000'},contains:[{type:'math_change',inputs:{DELTA:numIn(-1,-1)}}]})],[timer(false)]),
    step(L('From Logic, put an “if” under the countdown. If timeLeft ≤ 0, use “game over: lose” from Game. An if block only runs its inside blocks when its question is true.', 'Fra Logikk legger du «hvis» under nedtellingen. Hvis timeLeft ≤ 0, bruk «spill slutt: tap» fra Spill. En hvis-blokk kjører bare blokkene inni når spørsmålet er sant.', 'Desde Lógica, pon «si» debajo. Si timeLeft ≤ 0, usa «fin del juego: perder» de Juego. Un bloque si ejecuta su interior cuando la condición es verdadera.', 'Depuis Logique, mets «si» sous le compte à rebours. Si timeLeft ≤ 0, utilise «fin du jeu : perdu». Un bloc si exécute son contenu quand sa condition est vraie.', 'Setze aus Logik „wenn“ unter den Countdown. Wenn timeLeft ≤ 0, nutze „Spielende: verloren“. Ein Wenn-Block führt seinen Inhalt aus, wenn seine Bedingung wahr ist.'),start(castleBody,[...dangerEvents,timer(true)]),[timedOut],[timer(true)]),
    step(L('In the coin contact event, after removing the coin, add another if: if score ≥ 3, game over: win. Now your game has both a way to win and a way to lose!', 'I myntens treff-hendelse, etter at mynten fjernes, legger du til en hvis: hvis poeng ≥ 3, spill slutt: seier. Nå har spillet både en måte å vinne og en måte å tape på!', 'En el evento de moneda, después de eliminarla, añade si: si puntos ≥ 3, fin del juego: ganar. ¡Ya puedes ganar o perder!', 'Dans l’événement de pièce, après sa suppression, ajoute si : si score ≥ 3, fin du jeu : gagné. On peut maintenant gagner ou perdre !', 'Füge im Münzereignis nach dem Entfernen ein Wenn hinzu: Wenn Punkte ≥ 3, Spielende: gewonnen. Jetzt kann man gewinnen und verlieren!'),start(castleBody,castleEvents),[timedOut,victory],[win]),
    step(L('Press ▶ and collect all three coins before 20 seconds pass. Avoid the slime! Try again with a different route. You have made your first complete game.', 'Trykk ▶ og samle alle tre myntene før 20 sekunder har gått. Unngå slimet! Prøv igjen med en annen vei. Du har laget ditt første hele spill.', 'Pulsa ▶ y recoge las tres monedas antes de 20 segundos. ¡Evita el limo! Prueba otra ruta. Has creado tu primer juego completo.', 'Appuie sur ▶ et ramasse les trois pièces en moins de 20 secondes. Évite le slime ! Essaie un autre chemin. Tu as créé ton premier jeu complet.', 'Drücke ▶ und sammle die drei Münzen vor Ablauf der 20 Sekunden. Meide den Schleim! Probiere einen anderen Weg. Du hast dein erstes vollständiges Spiel gebaut.'),start(castleBody,castleEvents),[play,timedOut,victory]),
  ],
  bonus: event(L('Bonus: add a victory sound before winning.', 'Bonus: legg til en seierslyd før du vinner.', 'Extra: añade un sonido de victoria antes de ganar.', 'Bonus : ajoute un son de victoire avant de gagner.', 'Bonus: Füge vor dem Sieg einen Siegton hinzu.'),'Food',[{type:'ab_play_effect',fields:{SFX:'win'}}]),
};
