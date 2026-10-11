import { blk, type B } from '../templates/dsl';
import { LIBRARY_IMAGES } from '../project/library';
import { localized, type LocalizedText } from '../project/model';
import { matchesSolution, type Guide } from './guide';
import { L } from './courses/shared';

type Json = Record<string, any>;
const roots = (value: Json): Json[] => value.blocks?.blocks ?? [];
const clean = (value: Json): Json => {
  const copy = structuredClone(value);
  delete copy.x; delete copy.y; delete copy.next;
  return copy;
};
const same = (a: Json, b: Json) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
const statements = (root: Json): Json[] => {
  const out: Json[] = [];
  for (let b = root.inputs?.DO?.block; b; b = b.next?.block) out.push(b);
  return out;
};
const walk = (value: Json): Json[] => {
  const out: Json[] = value.type ? [value] : [];
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(v => { if (v && typeof v === 'object') out.push(...walk(v)); });
    else if (child && typeof child === 'object') out.push(...walk(child));
  }
  return out;
};

/** Every guide gets setup directions and pictures from its cumulative solutions.
 * Hand-picked pictures must never hide another change required by the same step. */
export function auditGuide(guide: Guide): Guide {
  guide.steps.forEach((step, index) => {
    const before = index ? guide.steps[index - 1].solution : guide.start;
    const previous = walk(before);
    const current = walk(step.solution);
    const setup: LocalizedText[] = [];
    if (!previous.some(b => b.type === 'ab_on_start') && current.some(b => b.type === 'ab_on_start') && statements(roots(step.solution)[0]).length) {
      setup.push(L('First drag “on start” from Game onto the workspace. Connect the starting blocks inside it, in the order shown.', 'Dra først «når spillet starter» fra Spill ut på flaten. Koble startblokkene inni, i rekkefølgen som vises.', 'Primero arrastra «al iniciar» desde Juego. Conecta dentro los bloques iniciales en el orden mostrado.', 'Glisse d’abord « au démarrage » depuis Jeu. Relie les blocs de départ dedans, dans l’ordre indiqué.', 'Ziehe zuerst „beim Start“ aus Spiel auf die Arbeitsfläche. Verbinde die Startblöcke darin in der gezeigten Reihenfolge.'));
    }
    const creations = current.filter(b => b.type === 'variables_set' && b.inputs?.VALUE?.block?.type === 'ab_sprite_create');
    const creationKey = (b: Json) => JSON.stringify([b.fields.VAR.name, b.inputs.VALUE.block.fields]);
    const seen = new Set(previous.filter(b => b.type === 'variables_set' && b.inputs?.VALUE?.block?.type === 'ab_sprite_create').map(creationKey));
    for (const b of creations) {
      if (seen.has(creationKey(b))) continue;
      seen.add(creationKey(b));
      const name = b.fields.VAR.name;
      const { IMAGE: image, KIND: kind } = b.inputs.VALUE.block.fields;
      const asset = LIBRARY_IMAGES.find(a => a.id === image);
      const label = (lang: string) => asset ? localized(asset.name, lang) : image;
      const kinds: Record<string, string[]> = { Player: ['Player', 'Spiller', 'Jugador', 'Joueur', 'Spieler'], Enemy: ['Enemy', 'Fiende', 'Enemigo', 'Ennemi', 'Gegner'], Food: ['Food', 'Mat', 'Comida', 'Nourriture', 'Essen'], Projectile: ['Projectile', 'Skudd', 'Proyectil', 'Projectile', 'Geschoss'] };
      const kindLabel = (lang: number) => kinds[kind]?.[lang] ?? kind;
      setup.push(L(
        `From Sprites, use the first block, “set mySprite to sprite”. Create ${name} in Variables, select it in the block’s variable menu, then choose the picture “${label('en')}” and kind ${kindLabel(0)}. Connect this creation block before using ${name}; select ${name} in its position and other sprite blocks too.`,
        `Fra Sprites bruker du den første blokken, «sett mySprite til sprite». Opprett ${name} i Variabler, velg den i blokkens variabelmeny, og velg bildet «${label('nb')}» og typen ${kindLabel(1)}. Koble opprettelsesblokken før du bruker ${name}; velg også ${name} i posisjonsblokken og andre sprite-blokker.`,
        `Desde Sprites, usa el primer bloque, «fijar mySprite a sprite». Crea ${name} en Variables, selecciónala en el bloque y elige la imagen «${label('es')}» y el tipo ${kindLabel(2)}. Conecta este bloque antes de usar ${name}; elige también ${name} en posición y los demás bloques de sprite.`,
        `Depuis Sprites, utilise le premier bloc « mettre mySprite à sprite ». Crée ${name} dans Variables, sélectionne-la dans le bloc et choisis l’image « ${label('fr')} » et le type ${kindLabel(3)}. Relie ce bloc avant d’utiliser ${name} ; choisis aussi ${name} dans la position et les autres blocs de sprite.`,
        `Nimm aus Sprites den ersten Block „setze mySprite auf Sprite“. Erstelle ${name} in Variablen, wähle es im Block und wähle das Bild „${label('de')}“ und den Typ ${kindLabel(4)}. Verbinde diesen Block vor der Verwendung von ${name}; wähle ${name} auch in Position und anderen Sprite-Blöcken.`));
    }
    // Event parameters and loop/function variables are supplied by their blocks.
    const supplied = new Set<string>(creations.map(b => b.fields.VAR.name));
    for (const b of current) {
      if (['ab_on_overlap', 'ab_on_tile', 'ab_for_each_kind', 'controls_for'].includes(b.type)) {
        for (const value of Object.values<Json>(b.fields ?? {})) if (value?.name) supplied.add(value.name);
      }
      for (const p of b.extraState?.params ?? []) supplied.add(typeof p === 'string' ? p : p.name);
    }
    const names = new Set(previous.flatMap(b => Object.values<Json>(b.fields ?? {}).flatMap(v => v?.name ? [v.name] : [])));
    const added = [...new Set(current.filter(b => b.type === 'variables_set').map(b => b.fields.VAR.name))].filter(n => !names.has(n) && !supplied.has(n));
    if (added.length) {
      const list = added.join(', ');
      setup.push(L(`In Variables, create ${list}. Use “set … to” for the values shown, and choose the same variable in every block that reads or changes it.`, `Opprett ${list} i Variabler. Bruk «sett … til» for verdiene som vises, og velg samme variabel i alle blokker som leser eller endrer den.`, `Crea ${list} en Variables. Usa «fijar … a» con los valores mostrados y la misma variable en los bloques que la leen o cambian.`, `Crée ${list} dans Variables. Utilise « mettre … à » avec les valeurs indiquées et la même variable dans les blocs qui la lisent ou la modifient.`, `Erstelle ${list} in Variablen. Nutze „setze … auf“ für die gezeigten Werte und dieselbe Variable in allen Blöcken, die sie lesen oder ändern.`));
    }
    for (const b of current.filter(b => b.type?.startsWith('procedures_def') && !previous.some(p => p.type === b.type && p.fields?.NAME === b.fields?.NAME))) {
      const name = b.fields.NAME;
      const params = (b.extraState?.params ?? []).map((p: Json) => p.name).join(', ');
      setup.push(L(`From Functions, add a definition named ${name}${b.type === 'procedures_defreturn' ? ' with a return value' : ''}.${params ? ` Use its gear to add parameters ${params}.` : ''} Build the blocks inside the definition as shown. Use the matching call block from Functions wherever the guide calls ${name}.`, `Legg til en definisjon kalt ${name}${b.type === 'procedures_defreturn' ? ' med returverdi' : ''} fra Funksjoner.${params ? ` Bruk tannhjulet for å legge til parameterne ${params}.` : ''} Bygg blokkene inni definisjonen som vist. Bruk den tilhørende kalleblokken fra Funksjoner der guiden kaller ${name}.`, `En Funciones, añade la definición ${name}${b.type === 'procedures_defreturn' ? ' con retorno' : ''}.${params ? ` Usa el engranaje para añadir ${params}.` : ''} Construye dentro los bloques mostrados. Usa el bloque de llamada de Funciones donde se llama ${name}.`, `Depuis Fonctions, ajoute la définition ${name}${b.type === 'procedures_defreturn' ? ' avec résultat' : ''}.${params ? ` Ajoute ${params} avec l’engrenage.` : ''} Construis les blocs dedans comme indiqué. Utilise le bloc d’appel de Fonctions pour appeler ${name}.`, `Füge aus Funktionen die Definition ${name}${b.type === 'procedures_defreturn' ? ' mit Rückgabewert' : ''} hinzu.${params ? ` Füge ${params} über das Zahnrad hinzu.` : ''} Baue die gezeigten Blöcke darin. Nutze den Aufrufblock aus Funktionen, wenn ${name} aufgerufen wird.`));
    }
    step.setup = setup;
    const changed: B[] = [];
    for (const root of roots(step.solution)) {
      const old = roots(before).find(b => b.type === root.type && JSON.stringify(b.fields) === JSON.stringify(root.fields));
      if (old && same(old, root)) continue;
      if (old && root.type === 'ab_on_start') {
        const prior = statements(old);
        const additions = statements(root).filter(b => !prior.some(p => same(p, b))).map(clean);
        // Include the event wrapper so placement and ordering are visible.
        if (additions.length) changed.push(blk('ab_on_start', { body: additions }));
      } else changed.push(root);
    }
    step.show = changed.length ? structuredClone(changed) : undefined;
    if (changed.length && index > 0) setup.push(L(
      'Keep the blocks from earlier steps. Add the new starting blocks below the existing ones. When this step changes an event or function, update its existing stack to match the picture; only move or replace blocks when instructed.',
      'Behold blokkene fra tidligere trinn. Legg nye startblokker under de eksisterende. Når trinnet endrer en hendelse eller funksjon, oppdaterer du den eksisterende stabelen som vist; flytt eller erstatt blokker bare der guiden ber om det.',
      'Conserva los bloques anteriores. Añade los nuevos bloques iniciales debajo de los existentes. Si el paso cambia un evento o función, actualiza su pila como se muestra; mueve o sustituye bloques solo cuando se indique.',
      'Garde les blocs des étapes précédentes. Ajoute les nouveaux blocs de départ sous les anciens. Si cette étape modifie un événement ou une fonction, adapte sa pile comme indiqué ; déplace ou remplace les blocs seulement quand c’est demandé.',
      'Behalte die Blöcke früherer Schritte. Füge neue Startblöcke unter den bestehenden hinzu. Ändert dieser Schritt ein Ereignis oder eine Funktion, passe den bestehenden Stapel wie gezeigt an; verschiebe oder ersetze Blöcke nur nach Anweisung.'));
    const solution = step.solution;
    if (!step.checks.some(check => check.text.en === 'All required blocks are connected in order and use the correct variables')) step.checks.push({
      text: L('All required blocks are connected in order and use the correct variables', 'Alle nødvendige blokker er koblet i rekkefølge og bruker riktige variabler', 'Todos los bloques necesarios están conectados en orden y usan las variables correctas', 'Tous les blocs nécessaires sont reliés dans l’ordre et utilisent les bonnes variables', 'Alle nötigen Blöcke sind in Reihenfolge verbunden und verwenden die richtigen Variablen'),
      ok: c => matchesSolution(c.blocks, solution, guide.id === 'w1-hello' || guide.id === 'w1-move'),
    });
  });
  return guide;
}
