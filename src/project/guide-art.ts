import type { LibraryImage } from './library';
import type { LocalizedText } from './model';
const L = (en: string, nb: string, es: string, fr: string, de: string): LocalizedText => ({ en, nb, es, fr, de });
/** Rows are separated by spaces; animation frames by ` | `. */
const sprite = (id: string, name: LocalizedText, rows: string, group = 'characters'): LibraryImage => {
  const frames = rows.split(' | ').map(f => f.split(' '));
  return { id, name, group, view: 'any', width: frames[0][0].length, height: frames[0].length, frames };
};
/** Original, editable artwork (8×8 unless the rows say otherwise; pet pictures have two animation frames; maze runners are 6×6 to fit 8 px corridors) supplied with the five guided projects. */
export const GUIDE_IMAGES: LibraryImage[] = [
  sprite('maze-explorer', L('Maze explorer','Labyrintvandrer','Explorador','Explorateur','Labyrinthforscher'), '.1111. .1..1. .1111. 1.11.1 ..11.. .1..1.'),
  sprite('maze-key', L('Maze key','Labyrintnøkkel','Llave','Clé','Schlüssel'), '..111... .1...1.. .1...1.. ..111... ...1.... ...111.. ...1.... ...111..', 'items'),
  sprite('maze-door', L('Maze exit','Labyrintutgang','Salida','Sortie','Ausgang'), '.111111. .1....1. .1....1. .1..1.1. .1....1. .1....1. .1....1. .111111.', 'items'),
  sprite('guard-runner', L('Guard runner','Vaktvandrer','Corredor','Coureur','Läufer'), '..111... .11111.. .10101.. ..111... .11111.. ...11... ..1..1.. .11..11.'),
  sprite('guard-calm', L('Calm guard','Rolig vakt','Guardia tranquilo','Garde calme','Ruhige Wache'), '.111111. 11....11 1.1..1.1 1......1 1..11..1 .111111. ..1..1.. .11..11.', 'enemies'),
  sprite('guard-alert', L('Alert guard','Våken vakt','Guardia alerta','Garde alerte','Wachsame Wache'), '.111111. 11....11 1.1111.1 1.1..1.1 1..11..1 .111111. ..1..1.. .11..11.', 'enemies'),
  sprite('guard-gem', L('Guard gem','Vaktens diamant','Gema','Gemme','Edelstein'), '...11... ..1111.. .111111. 11.11.11 .111111. ..1111.. ...11... ........', 'items'),
  sprite('pet-happy', L('Happy pet','Glad venn','Mascota feliz','Compagnon heureux','Fröhliches Tier'), '.1....1. .11..11. .111111. 11.11.11 11111111 .1.11.1. .111111. ..1..1.. | .1....1. .11..11. .111111. 11.11.11 11111111 .1.11.1. .111111. .1....1.'),
  sprite('pet-sad', L('Sad pet','Trist venn','Mascota triste','Compagnon triste','Trauriges Tier'), '........ 11....11 .111111. 11.11.11 11111111 .11..11. .111111. ..1..1.. | ........ 11....11 .111111. 11.11.11 11111111 .11..11. .111111. .1....1.'),
  sprite('pet-eat', L('Eating pet','Spisende venn','Mascota comiendo','Compagnon qui mange','Fressendes Tier'), '.1....1. .11..11. .111111. 11.11.11 11111111 11....11 .1....1. .111111. | .1....1. .11..11. .111111. 11.11.11 11111111 11111111 111..111 .111111.'),
  sprite('pet-play', L('Playing pet','Lekende venn','Mascota jugando','Compagnon qui joue','Spielendes Tier'), '........ .1....1. .11..11. .111111. 11.11.11 11111111 .1.11.1. .111111. | .11..11. .111111. 11.11.11 11111111 .1.11.1. .111111. 1.1..1.1 ........'),
  sprite('pet-sleep', L('Sleeping pet','Sovende venn','Mascota dormida','Compagnon endormi','Schlafendes Tier'), '.....111 ......1. .....111 .1....1. .111111. 1..11..1 11111111 .111111. | ....111. .....1.. ....111. .1....1. .111111. 1..11..1 11111111 11111111'),
  sprite('pet-food', L('Food','Mat','Comida','Nourriture','Futter'), '....1... ...1.... .11.11.. 1111111. 1111111. 1111111. .11111.. ..1.1...', 'items'),
  sprite('pet-ball', L('Ball','Ball','Pelota','Balle','Ball'), '..1111.. .1.11.1. 1..11..1 11111111 11111111 1..11..1 .1.11.1. ..1111..', 'items'),
  sprite('pet-moon', L('Moon','Måne','Luna','Lune','Mond'), '..111... .11..... 11...... 11...... 11...... 11...... .11..... ..111...', 'items'),
  sprite('pet-cursor', L('Menu frame','Menyramme','Marco del menú','Cadre du menu','Menürahmen'), '111......111 1..........1 1..........1 ............ ............ ............ ............ ............ ............ 1..........1 1..........1 111......111', 'items'),
  sprite('ttt-cursor', L('Board cursor','Brettmarkør','Cursor','Curseur','Spielfeldcursor'), '111..111 1......1 1......1 ........ ........ 1......1 1......1 111..111', 'items'),
  sprite('ttt-x', L('Cross','Kryss','Cruz','Croix','Kreuz'), '11....11 .11..11. ..1111.. ...11... ...11... ..1111.. .11..11. 11....11', 'items'),
  sprite('ttt-o', L('Circle','Sirkel','Círculo','Cercle','Kreis'), '..1111.. .11..11. 11....11 11....11 11....11 11....11 .11..11. ..1111..', 'items'),
  sprite('bomb-runner', L('Bomb runner','Bombeløper','Corredor de bombas','Poseur de bombes','Bombenläufer'), '..11.. .1..1. ..11.. 111111 ..11.. .1..1.'),
  sprite('bomb-fuse', L('Bomb with fuse','Bombe med lunte','Bomba con mecha','Bombe à mèche','Bombe mit Lunte'), '....1.1. ...111.. ..1111.. .111111. 11111111 11111111 .111111. ..1111..', 'items'),
  sprite('bomb-blast', L('Blast','Eksplosjon','Explosión','Explosion','Explosion'), '1..11..1 .1.11.1. ..1111.. 11111111 11111111 ..1111.. .1.11.1. 1..11..1', 'effects'),
  sprite('bomb-bot', L('Bomb robot','Bomberobot','Robot','Robot','Roboter'), '.1111. 1.11.1 111111 .1111. 1.11.1 11..11', 'enemies'),
  sprite('bomb-exit', L('Bomb exit','Bombeutgang','Salida de bombas','Sortie des bombes','Bombenausgang'), '11111111 1......1 1..11..1 1.1111.1 1..11..1 1..11..1 1......1 11111111', 'items'),
  sprite('jump-hero', L('Jumping hero','Hoppehelt','Héroe saltarín','Héros sauteur','Springheld'), '..111... ..1.1... ..111... .11111.. 1.111.1. ..111... ..1.1... .11.11.. | ..111... ..1.1... ..111... .11111.. 1.111.1. ..111... ...1.... ..111...'),
  sprite('jump-slime', L('Walking slime','Gående slim','Limo andante','Slime marcheur','Laufschleim'), '........ ........ ..1111.. .111111. 11.11.11 11111111 11111111 .1.11.1. | ........ ........ ........ .111111. 11.11.11 11111111 11111111 11111111', 'enemies'),
  sprite('jump-bat', L('Flying bat','Flygende flaggermus','Murciélago volador','Chauve souris volante','Fliegende Fledermaus'), '1......1 11....11 111..111 11111111 1.1..1.1 ..1111.. ...11... ........ | ........ ........ ..1..1.. .111111. 11.11.11 1.1111.1 1..11..1 ........', 'enemies'),
];
