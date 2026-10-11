import { and, arith, blk, bool, call, cmp, func, get, hitting, ifThen, minmax, not, num, or, pressed, prop, random, set, setProp, txt, whileDo, workspace, type B } from './dsl';
import { runnerBackgrounds, runnerDeck, runnerImages } from './endlessrunner-art';
import { runnerSongs } from './endlessrunner-music';
import type { TemplateSource } from './types';

export const RUNNER_RULES = { startSpeed: 60, maxSpeed: 108, jumpSpeed: -160, gravity: 400, resetDistance: 512, spawnX: 140, cooldownFrames: 12, maxSlideCentiseconds: 150 } as const;
export const RUNNER_HAZARDS = [
  { image: 'cargo', width: 14, height: 12, y: 50, action: 'jump' },
  { image: 'reactor', width: 18, height: 14, y: 49, action: 'jump' },
  { image: 'plasmaSpikes', width: 20, height: 10, y: 51, action: 'jump' },
  { image: 'securityDrone', width: 22, height: 12, y: 40, action: 'slide' },
  { image: 'laserGate', width: 14, height: 18, y: 37, action: 'slide' },
] as const;

const n = num, v = get;
const eq = (name: string, value: number) => cmp('EQ', v(name), n(value));
const add = (a: B, b: B) => arith('ADD', a, b);
const sub = (a: B, b: B) => arith('MINUS', a, b);
const mul = (a: B, b: B) => arith('MULTIPLY', a, b);
const div = (a: B, b: B) => arith('DIVIDE', a, b);
const mod = (a: B, b: number) => blk('math_modulo', { i: { DIVIDEND: a, DIVISOR: n(b) } });
const jumpPressed = () => or(pressed('up'), pressed('a'));
const slidePressed = () => or(pressed('down'), pressed('b'));
const image = (sprite: string, id: string) => blk('ab_sprite_set_image', { i: { SPRITE: v(sprite) }, f: { IMAGE: id } });
const at = (sprite: string, x: B, y: B) => blk('ab_sprite_set_position', { i: { SPRITE: v(sprite), X: x, Y: y } });
const text = (x: B | number, y: B | number, value: B | string, color = 'white') => blk('ab_draw_text', { f: { COLOR: color }, i: { X: typeof x === 'number' ? n(x) : x, Y: typeof y === 'number' ? n(y) : y, TEXT: typeof value === 'string' ? txt(value) : value } });
const rect = (x: number, y: number, w: number, h: number, color: string, filled = true) => blk('ab_draw_rect', { f: { COLOR: color, FILL: filled ? 'filled' : 'outline' }, i: { X: n(x), Y: n(y), W: n(w), H: n(h) } });
const line = (x0: number, y0: number, x1: number, y1: number) => blk('ab_draw_line', { f: { COLOR: 'white' }, i: { X0: n(x0), Y0: n(y0), X1: n(x1), Y1: n(y1) } });
const timer = () => blk('ab_timer', { f: { TIMER: '0' } });
const timerRun = (mode: number) => blk('ab_timer_run', { f: { TIMER: '0', MODE: String(mode) } });
const load = (slot: number) => blk('ab_storage_load', { i: { SLOT: n(slot) } });
const save = (slot: number, value: B) => blk('ab_storage_save', { i: { SLOT: n(slot), VALUE: value } });
const song = (name: string) => blk('ab_play_song', { f: { SONG: name, MODE: 'loop' } });
// The player resumes interrupted music at its saved position.
const sfx = (name: string) => blk('ab_play_poly_effect', { f: { SFX: name } });
const timeArgs = ['minutes', 'centiseconds', 'textX', 'textY'];
const drawTime = (m: B, t: B, x: number, y: number) => call('draw time', timeArgs, [m, t, n(x), n(y)]);
const currentTicks = () => add(mul(timer(), n(100)), div(blk('ab_timer_millis', { f: { TIMER: '0' } }), n(10)));
const beats = (rank: number) => or(cmp('GT', v('runMinutes'), v('bestMinutes' + rank)), and(cmp('EQ', v('runMinutes'), v('bestMinutes' + rank)), cmp('GT', v('runTicks'), v('bestTicks' + rank))));
const copyRecord = (from: number, to: number) => [set('bestMinutes' + to, v('bestMinutes' + from)), set('bestTicks' + to, v('bestTicks' + from))];
const newRecord = (rank: number) => [set('bestMinutes' + rank, v('runMinutes')), set('bestTicks' + rank, v('runTicks')), set('recordRank', n(rank))];

export const endlessrunner: TemplateSource = {
  id: 'endlessrunner', order: 9,
  title: { en: 'Void Runner', nb: 'Void Runner', de: 'Void Runner', es: 'Void Runner', fr: 'Void Runner' },
  description: {
    en: 'A sci-fi endless runner. Jump with Up/A, slide with Down/B, and beat your best survival time.',
    nb: 'En sci-fi-endlessrunner. Hopp med opp/A, skli med ned/B og slå din beste overlevelsestid.',
    de: 'Ein Sci-Fi-Endlosläufer. Mit Oben/A springen, mit Unten/B rutschen und die beste Überlebenszeit schlagen.',
    es: 'Un corredor infinito de ciencia ficción. Salta con Arriba/A, deslízate con Abajo/B y supera tu mejor tiempo.',
    fr: 'Une course sans fin de science-fiction. Saute avec Haut/A, glisse avec Bas/B et bats ton meilleur temps.',
  },
  thumbnail: { frames: 1 },
  tips: [
    { en: 'Edit Void Drive in Music Studio. Polyphonic effects briefly interrupt the music; the music continues from the same position after each effect.', nb: 'Rediger Void Drive i Musikkstudio. Polyfoniske effekter avbryter musikken kort; musikken fortsetter fra samme sted etter hver effekt.', de: 'Void Drive im Musikstudio bearbeiten. Polyphone Effekte unterbrechen die Musik kurz; danach läuft die Musik an derselben Stelle weiter.', es: 'Edita Void Drive en el estudio de música. Los efectos polifónicos interrumpen brevemente la música; la música continúa desde la misma posición.', fr: 'Modifie Void Drive dans le studio musical. Les effets polyphoniques interrompent brièvement la musique ; la musique reprend ensuite au même endroit.' },
    { en: 'Jump over cargo, reactors and plasma spikes. Slide under drones and laser gates with Down/B for up to 1.5 seconds. Release before sliding again.', nb: 'Hopp over last, reaktorer og plasmapigger. Skli under droner og laserporter med ned/B i maks 1,5 sekunder. Slipp før du sklir igjen.', de: 'Über Fracht, Reaktoren und Plasmaspitzen springen. Mit Unten/B höchstens 1,5 Sekunden unter Drohnen und Lasertoren rutschen. Vor erneutem Rutschen loslassen.', es: 'Salta sobre carga, reactores y púas de plasma. Usa Abajo/B para pasar bajo drones y láseres durante un máximo de 1,5 segundos. Suelta antes de deslizarte de nuevo.', fr: 'Saute par-dessus la cargaison, les réacteurs et les pointes de plasma. Glisse sous les drones et lasers avec Bas/B pendant 1,5 seconde maximum. Relâche avant de glisser à nouveau.' },
    { en: 'Speed rises from 60 to 108. Keep the cap and the pause between obstacles to preserve fair jumps.', nb: 'Farten øker fra 60 til 108. Behold fartstaket og pausen mellom hindrene for å bevare rettferdige hopp.', de: 'Das Tempo steigt von 60 auf 108. Obergrenze und Hindernispausen beibehalten, damit Sprünge fair bleiben.', es: 'La velocidad sube de 60 a 108. Conserva el límite y la pausa entre obstáculos para mantener saltos justos.', fr: 'La vitesse monte de 60 à 108. Garde la limite et la pause entre obstacles pour préserver des sauts équitables.' },
    { en: 'Edit the mountains and skyline in Backgrounds. The two layers scroll at 25% and 50%.', nb: 'Rediger fjellene og bysilhuetten i Bakgrunner. De to lagene ruller med 25 % og 50 %.', de: 'Berge und Skyline unter Hintergründe bearbeiten. Die zwei Ebenen scrollen mit 25 % und 50 %.', es: 'Edita las montañas y la ciudad en Fondos. Las dos capas se desplazan al 25 % y 50 %.', fr: 'Modifie les montagnes et la ville dans Fonds. Les deux calques défilent à 25 % et 50 %.' },
  ],
  strings: {
    en: { setup: 'Two repeating parallax layers behind a solid deck. The title and record screens are drawn without blocking input.', fair: 'Only one obstacle exists at a time. Wait until it leaves the screen, then wait 12 frames. Speed is capped at 108 so every jump remains possible.', loop: 'Scroll wraps at 512 pixels. This is a whole number of repeats for both backgrounds, the deck and the static stars. Shift the obstacle too, so nothing jumps.', controls: 'Up/A jumps on a fresh press, only on the ground. Down/B slides for at most 1.5 seconds; release to stand and rearm. The countdown also works across minute rollover. Sliding takes priority when both are held.', records: 'Store the best three times as minutes plus centiseconds within the minute. This avoids the 16-bit millisecond limit. Slots 21–27 belong to this game.', ready: 'A/^ START', retry: 'A/^ RETRY', help: 'A/^ JUMP  B/v SLIDE', board: 'FLIGHT RECORDS', newBest: 'NEW BEST TIME', last: 'LAST', time: 'TIME' },
    nb: { setup: 'To gjentatte parallax-lag bak en solid bane. Tittel- og rekordskjermen tegnes uten å blokkere knappene.', fair: 'Bare ett hinder finnes om gangen. Vent til det er ute av skjermen, og deretter 12 bilder. Farten stopper på 108 så alle hopp fortsatt er mulige.', loop: 'Rullingen går i loop etter 512 piksler. Det er hele gjentakelser av begge bakgrunnene, banen og stjernene. Flytt også hinderet så ingenting hopper.', controls: 'Opp/A hopper ved et nytt trykk, bare på bakken. Ned/B sklir i maks 1,5 sekunder; slipp for å stå og kunne skli igjen. Nedtellingen virker også over et minuttskifte. Skli prioriteres hvis begge holdes inne.', records: 'Lagre de tre beste tidene som minutter og hundredeler innenfor minuttet. Dette unngår 16-bitsgrensen for millisekunder. Plass 21–27 tilhører dette spillet.', ready: 'A/^ START', retry: 'A/^ IGJEN', help: 'A/^ HOPP  B/v SKLI', board: 'BESTE TIDER', newBest: 'NY TIDSREKORD', last: 'SIST', time: 'TID' },
    de: { setup: 'Zwei wiederholte Parallaxebenen hinter einem festen Deck. Titel und Rekorde werden ohne blockierende Eingabe gezeichnet.', fair: 'Nur ein Hindernis gleichzeitig. Warten, bis es den Bildschirm verlässt, dann 12 Bilder pausieren. Tempo höchstens 108, damit alle Sprünge möglich bleiben.', loop: 'Nach 512 Pixeln wiederholen sich beide Hintergründe, Deck und Sterne nahtlos. Auch das Hindernis verschieben.', controls: 'Oben/A springt bei neuem Tastendruck am Boden. Unten/B rutscht höchstens 1,5 Sekunden; zum Stehen und erneuten Rutschen loslassen. Rutschen hat Vorrang.', records: 'Die drei besten Zeiten als Minuten und Hundertstel innerhalb der Minute speichern. So wird die 16-Bit-Millisekundengrenze vermieden. Plätze 21–27 gehören diesem Spiel.', ready: 'A/^ START', retry: 'A/^ NEU', help: 'A/^ SPRUNG B/v TIEF', board: 'BESTE ZEITEN', newBest: 'NEUER REKORD', last: 'LAUF', time: 'ZEIT' },
    es: { setup: 'Dos capas de paralaje repetidas detrás de una pista sólida. Título y récords se dibujan sin bloquear los controles.', fair: 'Solo un obstáculo a la vez. Espera a que salga de pantalla y luego 12 fotogramas. Velocidad máxima 108 para que todos los saltos sean posibles.', loop: 'Tras 512 píxeles, ambos fondos, la pista y las estrellas se repiten sin cortes. Mueve también el obstáculo.', controls: 'Arriba/A salta al pulsar de nuevo y solo en el suelo. Abajo/B desliza durante un máximo de 1,5 segundos; suelta para levantarte y volver a deslizarte. Deslizarse tiene prioridad.', records: 'Guarda los tres mejores tiempos como minutos y centésimas dentro del minuto, evitando el límite de 16 bits. Este juego usa las posiciones 21–27.', ready: 'A/^ INICIO', retry: 'A/^ OTRA', help: 'A/^ SALTO B/v BAJO', board: 'MEJORES TIEMPOS', newBest: 'NUEVO RECORD', last: 'FIN', time: 'TIEMPO' },
    fr: { setup: 'Deux calques de parallaxe répétés derrière une piste solide. Le titre et les records sont dessinés sans bloquer les commandes.', fair: 'Un seul obstacle à la fois. Attends sa sortie puis 12 images. Vitesse maximale 108 pour que tous les sauts restent possibles.', loop: 'Après 512 pixels, les deux fonds, la piste et les étoiles se répètent sans coupure. Déplace aussi l’obstacle.', controls: 'Haut/A saute sur une nouvelle pression, au sol seulement. Bas/B glisse pendant 1,5 seconde maximum ; relâche pour te relever et glisser à nouveau. Glisser est prioritaire.', records: 'Les trois meilleurs temps sont sauvegardés en minutes et centièmes dans la minute pour éviter la limite de 16 bits. Ce jeu utilise les emplacements 21–27.', ready: 'A/^ DEPART', retry: 'A/^ ENCORE', help: 'A/^ SAUT B/v BAS', board: 'MEILLEURS TEMPS', newBest: 'NOUVEAU RECORD', last: 'FIN', time: 'TEMPS' },
  },
  kinds: ['Hazard'], images: runnerImages, backgrounds: runnerBackgrounds, songs: runnerSongs, tiles: runnerDeck,
  tilemaps: [{ id: 'deck', name: 'looping deck', width: 80, height: 8, cells: Array.from({ length: 640 }, (_, i) => i < 560 ? 0 : (i % 4 === 0 ? 2 : 1)) }],
  blocks: workspace([
    blk('ab_on_start', { comment: '@setup', body: [
      set('state', n(0)), set('jumpHeld', bool(false)), set('slideHeld', bool(false)), set('restartDelay', n(0)),
      song('cave'),
      blk('ab_bg_set', { f: { BG: 'starfield' } }),
      blk('ab_bg_layer_set', { f: { LAYER: '1', BG: 'colonyMountains' }, i: { PERCENT: n(25) } }),
      blk('ab_bg_layer_set', { f: { LAYER: '2', BG: 'colonySkyline' }, i: { PERCENT: n(50) } }),
      blk('ab_set_tilemap', { f: { MAP: 'deck' } }),
      blk('ab_timer_format', { f: { TIMER: '0', FORMAT: '5' } }),
      ifThen(cmp('NEQ', load(21), n(20050)), [
        ...Array.from({ length: 6 }, (_, i) => save(22 + i, n(0))), save(21, n(20050)),
      ]),
      ...[1, 2, 3].flatMap(rank => [set('bestMinutes' + rank, load(20 + rank * 2)), set('bestTicks' + rank, load(21 + rank * 2))]),
    ] }),
    func('start run', [
      blk('ab_sprite_destroy_all', { f: { KIND: 'Player' } }), blk('ab_sprite_destroy_all', { f: { KIND: 'Hazard' } }),
      set('hero', blk('ab_sprite_create', { f: { IMAGE: 'runner', KIND: 'Player' } })),
      at('hero', n(32), n(48)), setProp('hero', 'ay', n(RUNNER_RULES.gravity)),
      blk('ab_sprite_set_z', { i: { SPRITE: v('hero'), Z: n(1) } }),
      blk('ab_sprite_set_outline', { f: { OUTLINE: '1' }, i: { SPRITE: v('hero') } }),
      blk('ab_sprite_animate', { i: { SPRITE: v('hero'), MS: n(100) } }),
      set('pose', n(0)), set('slideHeld', slidePressed()), set('slideStartTicks', n(0)), set('scroll', n(0)), set('camera', n(0)), set('previousCamera', n(0)),
      set('speed', n(RUNNER_RULES.startSpeed)), set('minutesElapsed', n(0)), set('spawnDelay', n(30)),
      set('state', n(1)), set('recordRank', n(0)), set('obstacleActive', bool(false)),
      blk('ab_set_camera', { i: { X: n(0), Y: n(0) } }),
      blk('ab_timer_set', { f: { TIMER: '0' }, i: { SECONDS: n(0) } }), timerRun(1), song('asset:voidDrive'),
    ]),
    func('spawn obstacle', [
      set('hazardType', random(1, 5)),
      ...RUNNER_HAZARDS.map((hazard, i) => ifThen(eq('hazardType', i + 1), [
        set('obstacle', blk('ab_sprite_create', { f: { IMAGE: hazard.image, KIND: 'Hazard' } })),
        at('obstacle', add(v('camera'), n(RUNNER_RULES.spawnX)), n(hazard.y)),
        blk('ab_sprite_set_outline', { f: { OUTLINE: '1' }, i: { SPRITE: v('obstacle') } }),
      ])),
      set('obstacleActive', bool(true)),
    ], '@fair'),
    blk('ab_on_every', { f: { MS: 2000 }, body: [ifThen(and(eq('state', 1), cmp('LT', v('speed'), n(RUNNER_RULES.maxSpeed))), [set('speed', add(v('speed'), n(1)))])] }),
    blk('ab_on_update', { body: [
      ifThen(eq('state', 1), [
        whileDo(cmp('GTE', timer(), n(60)), [set('minutesElapsed', add(v('minutesElapsed'), n(1))), blk('ab_timer_change', { f: { TIMER: '0' }, i: { VALUE: n(-60) } })]),
        set('scroll', mod(add(v('scroll'), v('speed')), RUNNER_RULES.resetDistance * 30)),
        set('camera', div(v('scroll'), n(30))),
        ifThen(and(v('obstacleActive'), cmp('LT', v('camera'), v('previousCamera'))), [setProp('obstacle', 'x', sub(prop('obstacle', 'x'), n(RUNNER_RULES.resetDistance)))], undefined, '@loop'),
        blk('ab_set_camera', { i: { X: v('camera'), Y: n(0) } }), set('previousCamera', v('camera')),
        setProp('hero', 'x', add(v('camera'), n(32))),
        ifThen(hitting('hero', 'bottom'), [
          ifThen(and(slidePressed(), not(v('slideHeld'))), [
            image('hero', 'slide'), setProp('hero', 'y', n(52)), set('pose', n(1)), set('slideStartTicks', currentTicks()),
            sfx('laser'),
          ], undefined, '@controls'),
          ifThen(not(and(eq('pose', 1), and(slidePressed(), cmp('LT', mod(add(sub(currentTicks(), v('slideStartTicks')), n(6000)), 6000), n(RUNNER_RULES.maxSlideCentiseconds))))), [
            ifThen(cmp('NEQ', v('pose'), n(0)), [image('hero', 'runner'), setProp('hero', 'y', n(48)), set('pose', n(0))]),
            ifThen(and(jumpPressed(), not(v('jumpHeld'))), [image('hero', 'jump'), set('pose', n(2)), setProp('hero', 'vy', n(RUNNER_RULES.jumpSpeed)), sfx('jump')]),
          ]),
        ]),
        ifThen(v('obstacleActive'), [
          ifThen(cmp('LT', prop('obstacle', 'right'), sub(v('camera'), n(8))), [
            blk('ab_sprite_destroy', { i: { SPRITE: v('obstacle') } }), set('obstacleActive', bool(false)), set('spawnDelay', n(RUNNER_RULES.cooldownFrames)),
          ]),
        ], [
          set('spawnDelay', sub(v('spawnDelay'), n(1))), ifThen(cmp('LTE', v('spawnDelay'), n(0)), [call('spawn obstacle')]),
        ]),
      ], [
        set('restartDelay', minmax('max', n(0), sub(v('restartDelay'), n(1)))),
        ifThen(and(cmp('EQ', v('restartDelay'), n(0)), and(jumpPressed(), not(v('jumpHeld')))), [call('start run')]),
      ]),
      set('jumpHeld', jumpPressed()), set('slideHeld', slidePressed()),
    ] }),
    blk('ab_on_overlap', { f: { SPRITE: { name: 'sprite' }, KIND_A: 'Player', OTHER: { name: 'otherSprite' }, KIND_B: 'Hazard' }, body: [ifThen(eq('state', 1), [call('finish run')])] }),
    func('finish run', [
      blk('ab_stop_song'),
      timerRun(0), set('state', n(2)), set('restartDelay', n(24)), setProp('hero', 'vy', n(0)), setProp('hero', 'ay', n(0)),
      set('runMinutes', v('minutesElapsed')), set('runTicks', currentTicks()), set('recordRank', n(0)),
      ifThen(beats(1), [...copyRecord(2, 3), ...copyRecord(1, 2), ...newRecord(1)], [
        ifThen(beats(2), [...copyRecord(2, 3), ...newRecord(2)], [ifThen(beats(3), newRecord(3))]),
      ]),
      ifThen(cmp('GT', v('recordRank'), n(0)), [
        ...[1, 2, 3].flatMap(rank => [save(20 + rank * 2, v('bestMinutes' + rank)), save(21 + rank * 2, v('bestTicks' + rank))]),
      ]), song('menu'),
    ], '@records'),
    func('draw time', [
      set('timeSeconds', div(v('centiseconds'), n(100))), set('timeFraction', mod(v('centiseconds'), 100)),
      set('timeDigits', n(2)),
      ifThen(cmp('GTE', v('minutes'), n(100)), [set('timeDigits', n(3))]),
      ifThen(cmp('GTE', v('minutes'), n(1000)), [set('timeDigits', n(4))]),
      ifThen(cmp('GTE', v('minutes'), n(10000)), [set('timeDigits', n(5))]),
      ifThen(cmp('LT', v('minutes'), n(10)), [text(v('textX'), v('textY'), '0'), text(add(v('textX'), n(6)), v('textY'), v('minutes'))], [text(v('textX'), v('textY'), v('minutes'))]),
      set('timeColumn', add(v('textX'), mul(v('timeDigits'), n(6)))),
      text(v('timeColumn'), v('textY'), ':'),
      ifThen(cmp('LT', v('timeSeconds'), n(10)), [text(add(v('timeColumn'), n(6)), v('textY'), '0'), text(add(v('timeColumn'), n(12)), v('textY'), v('timeSeconds'))], [text(add(v('timeColumn'), n(6)), v('textY'), v('timeSeconds'))]),
      text(add(v('timeColumn'), n(18)), v('textY'), '.'),
      ifThen(cmp('LT', v('timeFraction'), n(10)), [text(add(v('timeColumn'), n(24)), v('textY'), '0'), text(add(v('timeColumn'), n(30)), v('textY'), v('timeFraction'))], [text(add(v('timeColumn'), n(24)), v('textY'), v('timeFraction'))]),
    ], undefined, timeArgs),
    blk('ab_on_draw', { body: [
      ifThen(eq('state', 0), [
        blk('ab_draw_image', { f: { IMAGE: 'titleScreen' }, i: { X: n(0), Y: n(0) } }),
        rect(3, 55, 85, 8, 'black'), text(6, 56, '@ready'),
      ], [ifThen(eq('state', 1), [
        rect(0, 0, 128, 10, 'black'), line(0, 9, 127, 9), text(3, 1, '@time'), drawTime(v('minutesElapsed'), currentTicks(), 38, 1),
        ifThen(and(eq('minutesElapsed', 0), cmp('LT', timer(), n(2))), [rect(3, 12, 122, 9, 'black'), text(5, 13, '@help')]),
      ], [
        rect(2, 0, 124, 64, 'black'), rect(2, 0, 124, 64, 'white', false), line(5, 12, 122, 12),
        ifThen(eq('recordRank', 1), [text(22, 3, '@newBest')], [text(19, 3, '@board')]),
        ...[1, 2, 3].flatMap(rank => [
          rect(7, 15 + (rank - 1) * 11, 14, 10, 'white'), text(8, 17 + (rank - 1) * 11, '0' + rank, 'black'),
          drawTime(v('bestMinutes' + rank), v('bestTicks' + rank), 46, 17 + (rank - 1) * 11),
          line(27, 25 + (rank - 1) * 11, 119, 25 + (rank - 1) * 11),
        ]),
        text(6, 49, '@last'), drawTime(v('runMinutes'), v('runTicks'), 38, 49), text(37, 56, '@retry'),
      ])]),
    ] }),
  ]),
};
