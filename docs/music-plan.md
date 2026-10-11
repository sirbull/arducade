# Oppdrag: pipelyd og flerstemt musikk, Musikk-fanen og tangent-opptak

Du jobber i ArduCade, en blokkbasert spilleditor for Arduboy og hjemmelagde
Arduboy-kompatible konsoller. Les `CLAUDE.md` og `AGENTS.md` før du begynner,
og følg reglene der hele veien:

- Bare skarpe hjørner eller ekte sirkler (`border-radius: 0`, eller `50 %` på
  kvadratiske sirkler). Gjelder dialoger, knapper, tangenter og canvas.
- Alt må virke med touch på iPad, mus og tastatur. Hurtigtaster må ha et
  alternativ på skjermen. Trykk må slippes ved `pointercancel`, når vinduet
  mister fokus og når dialogen lukkes.
- Ikke rør filene i `public/docs/`. De er tegnet for hånd.
- Ikke commit noe med mindre eieren ber om det.

Oppdraget har fire deler (A–D). Gjør dem i rekkefølge, og kjør testene etter
hver del. Sang-editoren med flere spor (piano-rull og trommesequencer) og
flerstemte lydeffekter er **ikke** en del av oppdraget. Ikke bygg noe for dem
ennå, men ikke lås deg heller til valg som stenger for dem.

## Slik virker lyd i dag

Les disse filene før du endrer noe:

| Fil | Hva den gjør |
| --- | --- |
| `src/blocks/defs.ts`, `toolbox.ts`, `toIR.ts` | Lydblokkene `ab_play_effect`, `ab_play_tone`, `ab_note`, `ab_pitch`, `ab_play_melody`, `ab_play_song`, `ab_stop_song` og `ab_stop_sound`. Alle ligger i dag i kategorien `MUSIC` (vist som «Lyd» på norsk). |
| `src/engine/api.ts` | `music.*`-funksjonene, med C++- og JS-mal. |
| `src/ir/ir.ts` | Enum-typene `sfx`, `melody` og `song`. |
| `src/engine/melody.ts` | `parseMelody()`: notetekst som `C D E:2 G:1/2 R`. Lengden regnes i kvart slag (1 slag = 4), fra 1 til 64. Oktav og lengde gjelder videre til neste note. H er det samme som B. |
| `src/engine/enums.ts` | `SFX`, `SFX_MENU` (menyrekkefølgen) og `SFX_STEPS`: lydeffekter som par av frekvens og millisekunder. |
| `src/engine/songs.ts` | De 16 ferdige sangene med fire stemmer. `songBytes()` gjør dem om til ATMlib-data. |
| `src/sim/atm.ts`, `core/ardublocks/ab_atm.h` | ATMlib-spilleren i simulatoren og på enheten. Les `docs/songs.md`. |
| `src/gen/common.ts`, `cpp.ts`, `js.ts` | Generatorene. Melodier, sanger og lydeffekter blir tabeller **bare** når spillet bruker dem. |
| `src/sim/engine.ts`, `src/sim/runner.ts` | Lyd i simulatoren: én firkantoscillator for pip, og en AudioBuffer for sanger. |
| `core/ardublocks/ardublocks.h` | Lyd på enheten: `toneStart` (Timer1), `playSound`, `playMelody`, `updateSound`. |
| `src/text/languages.ts` | JavaScript og Python: `Sound.*`, `Song.*` og `melody("...")`. |
| `src/ui/docs.ts` + `public/locales/*.json` | Dokumentasjonen i appen: `docs.more.<blokk>`, `docs.ex.<blokk>` og guideseksjonen `docs.sound.*`. |
| `src/project/model.ts`, `src/blocks/assets.ts` | Prosjektformatet (`upgradeProject`) og nedtrekkslister for ressurser (`AssetDropdown`), som bilder og tilemaps bruker. |
| `index.html`, `src/ui/app.ts`, `src/ui/assets-panes.ts` | Fanene Blocks, Sprites, Tiles, Map osv. |

Disse fakta må du ta hensyn til:

- `updateSound()` kjører én gang per bilde (33 ms) både på enheten og i
  simulatoren. Pip-steg blir derfor aldri kortere enn ett bilde.
- **Flash er trangt.** ATtiny85-shooteren bruker 8190 av 8192 byte
  (`tests/compile.test.ts`). Spill som ikke bruker en ny funksjon, skal bli
  byte for byte like. Bruk `#ifdef`-flagg som generatoren setter, slik
  `AB_HAS_SONGS` gjør, og la generatoren bare ta med data som spillet bruker.
- Simulatoren og enheten skal oppføre seg likt. Se mønsteret i
  `tests/songs.test.ts` (avr8js) og `tests/tone.test.ts`.
- Alle tekster finnes på fem språk (`en`, `nb`, `de`, `fr`, `es`).
  `npm run check-locales` må gå gjennom.
- `tests/block-search-map.test.ts` feiler allerede før du begynner (24 mot 23
  sprite-blokker). Ikke la det skjule nye feil, men det er ikke ditt ansvar.

## A. Del lyd i «Pip» og «Flerstemt»

Det er to ulike måter å lage lyd på, og enhetene støtter ulike ting. Det skal
synes i editoren.

1. **To kategorier i stedet for én:**
   - **Pip – alle enheter:** spill lyd (effekter), spill melodi, spill tone,
     note, tonehøyde, stopp lyd.
   - **Flerstemt – Arduboy:** spill sang, stopp sang, og senere volum (del D).

   Bruk forskjellige farger eller nyanser på de to kategoriene. Navn og
   tooltips skal finnes på fem språk. Oppdater dokumentasjonen, som bygger
   seksjonene ut fra verktøykassen, og `docs.sound.body`.
2. **Hvilke enheter som har fire stemmer:** En profil har fire stemmer når
   brikken er `atmega32u4` og `sound.pin1` er `D5` eller `D13`. Det er den
   samme regelen som `AB_ATM_SYNTH` bruker i `ab_atm.h`. Lag én TS-funksjon for
   dette i `src/hw/profile.ts` og bruk den overalt.
3. **Info-melding i problemlisten:** Når spillet bruker flerstemte blokker og
   profilen ikke har fire stemmer, skal det komme en melding med nivå `info`,
   for eksempel «Sanger spilles med én stemme og uten trommer på denne
   enheten». Når profilen har lyd slått av, skal meldingen si at lyden er av.
4. **Simulatoren følger profilen:** Uten fire stemmer skal simulatoren spille
   sanger slik enheten gjør, med én stemme (se `atm_update()` i reservemodus i
   `ab_atm.h`): den første stemmen som lyder av melodi, stemme og bass, som en
   firkanttone. Den skal heller ikke ha trommer. Gjenbruk `AtmPlayer` i
   `src/sim/atm.ts`. Legg til en test som sammenligner med enheten.
5. Eksisterende prosjekter skal virke uten endring. Blokktypene beholder
   navnene sine; bare plasseringen i verktøykassen endres.

## B. Musikk-fanen med pipemelodier som har navn

1. **Ny fane «Musikk»** etter Map og Backgrounds, i `index.html`, `app.ts` og
   `assets-panes.ts`. Følg mønsteret fra de andre ressursfanene: en liste til
   venstre, og legg til, gi nytt navn, dupliser og slett.
2. **Prosjektformat:** Legg til `melodies: { id, name, notes, tempo }[]` i
   `Project`.
   - `upgradeProject` må gi gamle prosjekter en tom liste og validere feltene.
   - Melodiene skal være med når prosjektet lagres, lastes og eksporteres
     (`.abproject`-filen, se `exportProject` i `app.ts`), og i malene om det
     er naturlig.
   - Øk versjonen hvis formatet har en.
3. **Redigering av en melodi:**
   - Et tekstfelt med samme syntaks som `parseMelody`, der ugyldige ord vises
     tydelig (`bad`).
   - Tempo.
   - Spill av og stopp. Avspillingen skal bruke den samme lydveien som
     simulatoren.
   - En knapp med tangent-ikon som åpner opptaket fra del C.
4. **Ny blokk** «spill melodi [navn] [gjenta / én gang]» i Pip-kategorien.
   - Den bruker en nedtrekksliste over prosjektets melodier, som
     `AssetDropdown`.
   - Generatorene skal gjenbruke melodi-tabellene (`melodies()` i
     `gen/common.ts`), så to blokker med samme melodi deler én tabell.
   - Gi en feilmelding når melodien er slettet.
5. **Den gamle blokken** `ab_play_melody` med tekst i blokken blir værende.
   Den skal også få tangent-ikonet (del C).
6. **Tekstspråk:** melodier med navn skal kunne skrives som
   `melodies.<navn>`, slik `images.<navn>` virker. Oppdater
   `docs/text-languages.md`.

## C. Spill inn melodier med tangenter

Et vindu for å spille inn en melodi i stedet for å skrive den.

1. **Hvor det åpnes:** fra et tangent-ikon i `ab_play_melody`-blokken og fra
   Musikk-fanen. Se `src/blocks/info-icon.ts` og `point-picker.ts` for hvordan
   blokkene i dag får egne ikoner og felt. Ikonet må kunne nås med tastatur og
   touch.
2. **Tangenter på skjermen:**
   - To oktaver, med knapper for å flytte oktav opp og ned.
   - Store nok for fingre på iPad. Sorte og hvite tangenter med skarpe hjørner.
   - Pekerhendelser (`pointerdown/up/cancel`). Bare én tone lyder om gangen;
     den siste tasten vinner.
3. **Datatastatur:**
   - `A W S E D F T G Y H U J K` gir C til C (sorte tangenter på W E T Y U).
   - `Z` og `X` flytter oktav ned og opp.
   - Vis tastene på tangentene. Tangentene på skjermen er alternativet for
     dem som ikke har tastatur.
4. **Opptak:**
   - Tempo hentes fra blokken eller melodien, og kan endres.
   - Valgfri metronom med inntelling på én takt.
   - Knapper for opptak, stopp, spill av og tøm.
   - Tiden en tangent holdes nede, rundes til nærmeste kvart slag (minst 1,
     høyst 64). Pauser mellom tonene blir `R` hvis de er minst et halvt kvart
     slag.
5. **Fra opptak til tekst:** Lag `formatMelody(steps)` i
   `src/engine/melody.ts`, den motsatte funksjonen av `parseMelody`.
   - Skriv bare oktav og lengde når de endrer seg.
   - Bruk `#` for halvtoner.
   - `parseMelody(formatMelody(x))` skal gi `x` tilbake. Lag en test for det.
6. **Rette etterpå:** Resultatet vises i et tekstfelt under tangentene. Det
   kan redigeres, og ugyldige ord markeres med en gang. «Bruk» skriver teksten
   tilbake til blokken eller melodien. «Avbryt» endrer ingenting.
7. **Lyd:** samme firkantlyd som pipelyden i simulatoren. Tonen må stoppe ved
   `pointercancel`, `blur`, når fanen skjules og når dialogen lukkes.
8. Alle tekster på fem språk. Legg til et avsnitt om opptak i
   `docs.more.ab_play_melody`.

## D. Volum

Volum kan bare styres der lyden er flerstemt:

- **Flerstemt (ATMlib):** Hver stemme har et volum fra 0 til 63, så et
  hovedvolum virker både på Arduboy og i simulatoren.
- **Pip:** Pinnen er bare av eller på, så volumet kan ikke endres. Det gjelder
  også sanger på enheter uten fire stemmer.

Det du skal gjøre:

1. **Blokken «sett sangvolum (0–100)»** i Flerstemt-kategorien, og
   `music.setSongVolume` i API og tekstspråk.
   - På enheten (`ab_atm.h`): skaler `osc.vol` der playroutine skriver den,
     for eksempel `vol * master >> 8`. Gjør det samme i `src/sim/atm.ts`, og
     utvid paritetstesten i `tests/songs.test.ts`.
   - Volumet nullstilles til 100 når spillet starter på nytt.
   - Spill uten blokken skal bli byte for byte like (bruk et `#ifdef`).
2. **Dokumenter i tooltip og hjelpetekst** at volumet bare virker på enheter
   med fire stemmer. Bruker spillet blokken på en profil uten fire stemmer,
   skal del A sin info-melding også nevne volumet.
3. **Ingen volumblokk for pip.** Skriv i `docs.sound.body` at pip bare kan
   slås av og på.

## Når du er ferdig

- Kjør `npx tsc --noEmit`, `npx vitest run` og `npm run check-locales`.
  Kompileringstestene bruker den ekte WebAssembly-kompilatoren og viser flash
  og RAM. Sjekk at ATtiny85-shooteren fortsatt får plass.
- Sjekk i en ekte nettleser med `npx vite`, for eksempel med Playwright mot en
  allerede installert `chrome-headless-shell` i `~/Library/Caches/ms-playwright`.
  Sjekk de to lydkategoriene, Musikk-fanen, tangentvinduet med mus og med
  touch-emulering, og at tonen stopper når dialogen lukkes.
- Oppdater `docs/songs.md` og `README.md` der de beskriver lyd, og legg til et
  avsnitt om Musikk-fanen og opptak.
- Rapporter kort på norsk:
  - hva som er gjort, og hva som er testet,
  - hva du ikke fikk til, eller valgte annerledes, og hvorfor,
  - flash og RAM for Arduboy, Nano og ATtiny85 før og etter.
