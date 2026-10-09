# Plan: Oppstartsguider og «spillverden»

Utkast 9. oktober 2026. Skal diskuteres før vi bygger.

## 1. Mål

Målgruppen er barn og unge som aldri har kodet før. De skal lære å lage spill, og senere å programmere, gjennom guider de følger trinn for trinn i editoren. Guidene skal føles som et lite videospill: man starter på brett 1 på et kart, låser opp nye brett og velger selv retning videre.

* Først flere små spill, så ett litt større.
* Senere egne guider for grunnleggende programmering: variabler, betingelser, løkker, funksjoner og tilfeldighet.
* Brukeren bygger koden selv. Guiden viser hvordan blokkene skal se ut, men legger dem ikke inn.
* Editoren sjekker hva brukeren har laget. Man kommer bare videre når trinnet er gjort riktig.
* En hjelp-knapp viser hele koden slik den skal være på dette trinnet. Brukeren bygger den selv ut fra bildet. Ingenting kopieres inn.
* Alle prosjekter har ferdige sprites og ruter fra biblioteket (se punkt 8).

## 2. Spillverdenen (overworld)

Spillverdenen vises på startskjermen, over «Mine prosjekter» og «Spillmaler». Den er et lite 1-bit kart, som på Arduboy-skjermen, tegnet med rutesettene fra biblioteket (sti i gress, vann, skog). Brettene er punkter langs stiene.

* En liten figur (spriten «vandrer» fra biblioteket) står på brettet man er på, og går langs stien når man velger et nytt brett. Man styrer med piltaster eller klikk.
* Hvert brett har tre tilstander: låst, åpent og fullført. Brettene låses opp i rekkefølge. En avkrysningsboks, «Velg brett fritt», åpner alle brett.
* Fullførte brett får en stjerne, og en ekstra stjerne for bonusoppgaven.
* Et slott på slutten av hver verden er det «større spillet» som setter sammen det man har lært.
* Etter verden 1 deler stien seg i tre, og man velger selv rekkefølgen.

```
            [2a-1]─[2a-2]─[2a-3]─[2a-4]─(Slott: Plattform)
           /
[1-1]─[1-2]─[1-3]─[1-4]─(Slott 1)─[2b-1]─[2b-2]─[2b-3]─(Slott: Rom)──┐
           \                                                          ├─(Det store spillet)
            [2c-1]─[2c-2]─[2c-3]─[2c-4]─(Slott: Eventyr)─────────────┘
                 \
                  Verden P: Programmering (åpnes etter 1-2)
```

## 3. Brettene

| Brett | Spill | Hva man lærer |
|---|---|---|
| **Verden 1: Første spill** | | |
| 1-1 Hei, helt! | En figur på skjermen | Hendelsen «ved start», lage en sprite, posisjon |
| 1-2 Beveg deg | Figuren styres med knappene | Knappehendelser, fart |
| 1-3 Myntjakt | Samle mynter | Kollisjon mellom sprites, poeng |
| 1-4 Pass deg! | En fiende som går fram og tilbake | Liv, game over, enkel «hvis» |
| Slott 1: Myntjakt deluxe | Samle alt før tiden går ut | Alt over, pluss en tidtaker |
| **Verden 2a: Plattform (fra siden)** | | |
| 2a-1 Tyngdekraft | Hopp og land | Akselerasjon, «treffer bakken» |
| 2a-2 Bygg et brett | Tilekart med bakke-settet | Ruter, faste ruter, tilekart |
| 2a-3 Kamera | Et langt brett | Kamera som følger |
| 2a-4 Fiender som snur | Fiender på plattformer | «Hvis treffer vegg», for hver fiende |
| Slott: Plattformspill | Mynter, pigger, flagg | Hendelser på ruter, flere liv |
| **Verden 2b: Rommet** | | |
| 2b-1 Skyt! | Skip som skyter | Prosjektiler |
| 2b-2 Angrep | Fiender som kommer ovenfra | «Hver N ms», tilfeldige tall |
| 2b-3 Eksplosjon | Treff og animasjon | Animasjon, ødelegge sprites |
| Slott: Romskyter | Poeng og rekord | Rekord (hiscore) |
| **Verden 2c: Eventyr (ovenfra)** | | |
| 2c-1 Gå rundt | Fire retninger med riktig animasjon | Bytte bilde etter retning |
| 2c-2 Vegger og vann | Kart med vegger og vann | Faste ruter ovenfra |
| 2c-3 Nøkkel og dør | Finn nøkkelen og åpne døren | Variabel som husker noe (har nøkkel) |
| 2c-4 Flere rom | Gå mellom rom | Koblinger mellom brett |
| Slott: Eventyr | Et lite Zelda-aktig spill | Alt over |
| **Det store spillet** | Flere brett, fiender, rekord | Sette sammen alt |
| **Verden P: Programmering** | | |
| P-1 Teller | Tell hopp og vis tallet | Variabler |
| P-2 Valg | Ulik reaksjon etter poeng | Hvis / ellers, sammenligning |
| P-3 Stjernehimmel | Mange stjerner med én blokk | Løkker (gjenta, for hver) |
| P-4 Egne blokker | Rydd koden | Funksjoner |
| P-5 Terning | Tilfeldige tall og sjanse | Tilfeldighet |

Hvert brett tar 5 til 10 trinn og omtrent 5 til 15 minutter.

## 4. Guidepanelet i editoren

Når man åpner et brett, starter editoren med brettets prosjekt (sprites og ruter er ferdige, blokkområdet er tomt eller delvis fylt). Guidepanelet ligger fast til høyre, der «Prøv dette» står i dag, ved siden av simulatoren.

```
┌ Brett 1-3 Myntjakt ─────── trinn 3 av 7 ┐
│ Forklaring: hva blokken gjør og hvorfor │
│ ┌─────────────────────────────────────┐ │
│ │  bilde av blokkene for dette trinnet │ │
│ └─────────────────────────────────────┘ │
│ ✓ «når Player treffer Food»             │
│ ○ legg til 1 poeng                      │
│ ○ fjern mynten                          │
│ [Hjelp]                      [Neste ▶]  │
└─────────────────────────────────────────┘
```

* **Bilde av koden:** en liten Blockly-flate der man bare kan se, ikke redigere. Blokkene ser helt like ut som i editoren, og bildet følger språk og tema. Man kan ikke dra blokker derfra, så de må lages i editoren.
* **Sjekkliste:** hvert krav vises som en linje som får ✓ når det er oppfylt. Brukeren ser hva som mangler, i stedet for bare «feil».
* **Neste** er grå til alle krav er oppfylt. Da kommer en liten feiring (lyd og animasjon), og knappen lyser.
* **Hjelp** viser først et hint. Trykker man igjen, vises hele koden for trinnet som bilde. Brukeren bygger den selv. Hjelp koster ingenting.
* Noen trinn er «Prøv spillet»-trinn: man må trykke Play og gjøre noe i spillet (for eksempel ta en mynt).

## 5. Hvordan editoren sjekker koden

To typer krav, som kan blandes i samme trinn.

**Strukturkrav** sjekkes hver gang blokkene endres (med en kort forsinkelse). Kravene er mønstre som sammenlignes med blokkene slik Blockly lagrer dem:

```ts
{ block: 'ab_on_button', fields: { BUTTON: 'a', EVENT: 'pressed' },
  contains: [{ block: 'ab_sprite_set_prop', fields: { PROP: 'vy' }, value: { max: -1 } }] }
```

* Rekkefølgen på blokkene på toppnivå spiller ingen rolle, og ekstra blokker er lov.
* Tall kan ha et område (`min`, `max`), så brukeren kan velge egne verdier.
* Variabelnavn kan sjekkes som «samme variabel som i krav X», så brukeren kan velge navn selv.
* Krav kan også gjelde prosjektet: at en sprite er lagt til, eller at tilekartet har bakke under helten.

**Kjørekrav** kjører spillet i simulatoren uten skjerm i et gitt antall bilder, med et innspilt sett tastetrykk, og sjekker resultatet: for eksempel at poengene øker når helten går inn i mynten, eller at helten lander og ikke faller gjennom bakken. Simulatoren kjører allerede uten nettleservindu i testene, så dette gjenbruker det som finnes. Kjørekrav fanger kode som ser riktig ut, men ikke virker.

Hvert krav har en kort tekst (sjekklisten) og eventuelt et hint som vises når kravet har vært uoppfylt en stund.

## 6. Format og fremgang

* Guidene skrives i TypeScript som malene (`src/guides/`, med hjelpespråket i `src/templates/dsl.ts`). Alle tekster skrives på alle fem språk, og en test sjekker at ingen mangler.
* Et brett består av: id, tittel, beskrivelse, plass på kartet, hvilke brett som må være fullført først, startprosjekt og trinn. Et trinn består av: forklaring, blokker til bildet, fasit (hele blokkoden etter trinnet), krav og hint.
* Fasiten for hvert trinn testes automatisk: en test sjekker at fasiten for trinn N oppfyller kravene i trinn N, og at den ikke allerede oppfyller kravene før trinn N. Da blir guider ikke ødelagt når blokkene endres.
* Fremgangen lagres lokalt i nettleseren, siden det ikke finnes kontoer ennå (IndexedDB, som prosjektene): fullførte brett, stjerner og brukerens eget prosjekt for hvert brett, så man kan fortsette der man slapp. Den kan eksporteres og importeres som fil.

## 7. Stjerner og belønning

* ★ for fullført brett, og ★ for en valgfri bonusoppgave på slutten (for eksempel «gjør helten raskere», «legg til en ekstra fiende»).
* Merker for milepæler: første spill, første animasjon, første spill lastet opp til en ekte enhet.
* Når man fullfører et slott, blir spillet lagret som eget prosjekt i «Mine prosjekter», og kan lastes opp til enheten.

## 8. Ferdig grafikk (gjort)

Bibliotek med sprites og ruter i `src/project/library.ts`, åpnes med «Bibliotek» i fanene Sprites og Ruter.

* Sprites i grupper (helter, fiender, rommet, ting, effekter, former). Animerte sprites har et film-ikon og spilles av i biblioteket. Man fjerner bilder med «Slett rute» hvis man vil ha et stillbilde.
* Rutesett med kanter, hjørner og innerhjørner (13 ruter, 14 med bakken rundt), som tegnes av regler så de alltid passer sammen. Sett fra siden: bakke med gress, snø, fjell og mur. Sett ovenfra: sti i gress, vann med strand, vegger og skog.
* Enkeltruter: plattformdeler, rør, stige, pigger, vann, lava, dør, skyer og ting sett ovenfra (tre, stein, busk, trapp, gjerder, bro, gulv).
* Filter: alle, sett fra siden, sett ovenfra.
* Et prosjekt kan nå ha 31 ruter (før: 15), slik at et helt sett får plass sammen med andre ruter.

Guidebrettene bruker bare grafikk fra biblioteket.

## 9. Rekkefølge for å bygge

1. **Guidemotor:** panel, strukturkrav, hjelp med fasit, «Neste». Ett testbrett (1-1).
2. **Kjørekrav** og «Prøv spillet»-trinn.
3. **Verden 1** (fire brett og slottet), med test av alle fasiter.
4. **Spillverdenen** på startskjermen, med fremgang og stjerner.
5. **Verdenene 2a, 2b og 2c** og det store spillet.
6. **Verden P: Programmering.**

Det lønner seg også å lage en «auto-pensel» i tilekarteditoren, som velger riktig kant eller hjørne når man maler med et rutesett. Logikken finnes allerede (`autoPosition` i biblioteket).

## 10. Avgjort

* Målgruppe: barn og unge som aldri har kodet før. Korte tekster, ett nytt begrep per trinn.
* Ingen «Kopier inn». Hjelp viser hele koden som bilde, og koster ingenting.
* Brettene låses opp i rekkefølge, med «Velg brett fritt» for å åpne alle.
* Fremgang lagres lokalt i nettleseren til vi har kontoer.
* Alle guider på alle fem språk.
