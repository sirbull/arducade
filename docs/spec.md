# Blokkeditor for Arduboy og hjemmelagde varianter

Spesifikasjon for versjon 1.0. Oppdatert 9. oktober 2026.

## 1. Mål

En nettbasert editor der man lager spill for Arduboy og hjemmelagde Arduboy-kloner med blokkprogrammering, omtrent som MakeCode Arcade. Editoren skal generere kompakt C++, vise spillet i en simulator, kompilere, vise hvor mye plass som er brukt, og laste opp til enheten over USB.

Alt kjører i nettleseren. Løsningen er en statisk nettside som legges på en vanlig webserver (for eksempel one.com) uten backend, PHP eller database.

Editoren skal virke med alt fra en original Arduboy til hjemmelagde løsninger med andre skjermer, chiper og pinner.

## 2. Rammer fra maskinvaren

* ATmega328P: 32 KB flash (ca. 30,5 KB ledig med Optiboot), 2 KB RAM, 1 KB EEPROM.
* ATmega32U4: 32 KB flash (ca. 28,5 KB ledig), 2,5 KB RAM, 1 KB EEPROM.
* Skjerm: 128x64 piksler, 1 bit. Skjermbufferen tar 1024 byte RAM, altså halvparten av RAM på en 328P.
* All generert kode må derfor være kompakt: små datatyper, ingen flyttall, grafikk i flash (PROGMEM).

## 3. Arkitektur

1. **Blokker:** Google Blockly med egne blokker.
2. **Felles mellomformat (IR):** Blokker, JavaScript og Python gjøres alle om til samme mellomformat, et typet syntakstre for spillet. Fra mellomformatet lages C++ for enheten, JavaScript for simulatoren, og blokker, JavaScript eller Python når man bytter visning. Simulatorkoden regner med samme heltallsbredder som AVR (8 og 16 bit), slik at simulator og enhet oppfører seg likt. Mellomformatet bygges inn fra starten, selv om tekstspråkene kommer i runde 2.
3. **Maskinvarelag:** Et eget tynt C++ lag (skjerm, knapper, lyd, EEPROM). Arduboy2 brukes ikke direkte, fordi pinnene der er hardkodet for originalen. Profilen blir til en `config.h`, og bare det valgte oppsettet kompileres inn. Egen minimal I2C-kode i stedet for `Wire` for å spare RAM. Sprites bruker samme byteformat som Arduboy2.
4. **Kompilering i nettleseren:** avr-gcc kompilert til WebAssembly, kjørt i en Web Worker. Kompilatoren lastes ned første gang og lagres i nettleseren. All kode samles i én fil før kompilering, og ubrukt kode fjernes med `--gc-sections`.
   * Reserveplan hvis dette ikke holder: ferdig kompilert program per profil som kjører spillet som bytekode. Custom-blokker med C++ virker da ikke.
5. **Opplasting:** Web Serial fra nettleseren (Chrome eller Edge på PC og Mac).
6. **Lagring:** Alt lagres i nettleseren (IndexedDB), og kan lastes ned og opp som filer. Ingen brukerkontoer.

## 4. Funksjoner

### Runde 1

* Blokkeditor med kategorier: Spill, Sprites, Grafikk, Input, Lyd, Logikk, Løkker, Matte, Variabler, Funksjoner, Custom.
* Enkel spillmotor bak blokkene, som i MakeCode Arcade (se punkt 12).
* Maler som man kan starte fra: Pong, Space shooter, Platformer, Snake og Breakout (se punkt 13).
* Editoren på flere språk, med engelsk som standard (se punkt 14).
* Ikon på hver blokk, tegnet som enkel strekgrafikk i én farge slik at det følger temaet.
* Custom-blokk der man skriver C++ direkte.
* Kodevisning: fane som viser generert C++ fortløpende og markerer koden til valgt blokk.
* Sprite-editor for 1 bit grafikk, med flere bilder per sprite for animasjon.
* Simulator som kjører spillet i nettleseren, styrt med tastatur og knapper på skjermen.
* Temaer og innstillinger (se punkt 6).
* Maskinvareprofiler med nedlasting og opplasting som mal (se punkt 5).
* Prosjekter lagres i nettleseren og kan lastes ned og opp som filer (se punkt 10).

### Runde 2

* Kompilering i nettleseren.
* Plassmåler for flash og RAM etter hver kompilering, med advarsel når det nærmer seg fullt.
* Opplasting over Web Serial.
* Flere spill på enheten: valgte prosjekter kompileres sammen til ett program med meny. Spillene deler maskinvarelag. Realistisk to til fire små spill.
* Kode tilbake til blokker: gjenkjent kode blir vanlige blokker, alt annet blir custom-blokker. Bruker tree-sitter (WebAssembly).
* Konverter til kode: gjør prosjektet om til et rent tekstprosjekt. Går én vei, blokkene beholdes som kopi.
* Skriv spillet i JavaScript eller Python, og bytt fritt mellom dem og blokkene, som i MakeCode Arcade (se punkt 15).

### Senere

* AVR-emulator i nettleseren (for eksempel avr8js) som kjører det kompilerte programmet, slik at custom-kode også virker i simulatoren.
* Støtte for ekstern flash for mange spill.
* Deling av spill.
* Flere chiper, for eksempel LGT8F328P og ATmega2560.
* Steg for steg-veiledninger som bygger et spill sammen med brukeren, som i MakeCode.

## 5. Maskinvareprofiler

En profil består av mikrokontroller, skjerm, buss, pinner for knapper, skjerm og lyd, og noen skjerminnstillinger. Profilen lagres i hvert prosjekt og blir til en `config.h` ved kompilering.

**Faste valg**

* Original Arduboy (ATmega32U4, SSD1306 over SPI).
* Nano med SSD1306 over I2C.
* Nano med SH1106 over I2C.
* Pro Micro med SSD1306 over SPI.

**Custom**

* Mikrokontroller: alle chiper med nok minne for en Arduboy-skjerm (minst 2 KB RAM og 32 KB flash):
  * Kompileres og lastes opp i nettleseren: ATmega328P, ATmega328PB, ATmega32U4 og ATmega644P.
  * Lastes ned som sketch til Arduino IDE: ATmega1284P, ATmega2560, ATmega4809, LGT8F328P, RP2040, ESP32, ESP8266, SAMD21 og STM32F103.
  * Chiper med for lite RAM (ATmega168, ATmega8) vises med en forklaring.
  * ATtiny85 er skjult (se «Hemmelig: ATtiny85 Pico» under).
* Skjerm: SSD1306, SH1106 eller SSD1309. Buss: I2C eller SPI.
* I2C: adresse 0x3C eller 0x3D.
* SPI: valgfri pinne for CS, DC og RST.
* Skjerminnstillinger: rotering 180 grader, speiling, kontrast.
* Fritt valg av pinne for hver av de seks knappene.
* Én eller to lydpinner.

**Kontroller i editoren**

* I2C ligger fast på A4 og A5 på 328P, og på D2 og D3 på 32U4.
* Maskinvare-SPI ligger fast på D11 og D13 på 328P, og på egne SPI-pinner på 32U4.
* A6 og A7 på Nano er kun analoge innganger uten pullup.
* D0 og D1 bør holdes fri for opplasting.
* Varsel når samme pinne er valgt to ganger.
* Merknad om at I2C gir lavere bildefrekvens enn SPI (rundt 25 ms per full skjermoppdatering).

**Hemmelig: ATtiny85 Pico**

* Hold innstillinger-knappen inne i 5 sekunder (mus, berøring eller mellomrom). Da vises en hemmelig seksjon der man kan slå på ATtiny85 Pico: en liten konsoll med SSD1306 over I2C, to knapper og buzzer.
* Pinner: venstre PB0, høyre PB2, buzzer PB1, skjerm SDA PB3 og SCL PB4. PB5 er reset.
* 8 KB flash og 512 byte RAM. Motoren tegner skjermen én side (8 rader) om gangen i et buffer på 128 byte, og kjører tegningen 8 ganger per bilde. Det gir maks 5 sprites, 4 partikler og 21 tegn tekst.
* Venstre og høyre samtidig er A. Splash vises på svart bakgrunn, og «vis og vent» viser ikke det som er tegnet.
* Ingen Arduino-kjerne: `ab_tiny.h` har millis, pinner og tone. Programvare-I2C i `ab_display.h`.
* Generatoren definerer `AB_NO_SPRITES`, `AB_NO_MAP`, `AB_NO_OUTLINE` og `AB_NO_HUD` når spillet ikke bruker dem, så koden blir mindre på alle chiper.
* Ingen USB: last ned .hex og brenn med en ISP-programmerer. Spillet setter klokka til 8 MHz selv, så sikringene kan stå som fra fabrikk.

**Profiler som mal**

* En profil kan lastes ned som fil (`.abprofile`, JSON) og lastes opp igjen. Da slipper man å stille inn samme oppsett hver gang.
* Opplastede profiler legges i et profilbibliotek i nettleseren og vises sammen med de faste valgene, i oppstartsdialogen og ved nytt prosjekt.
* Profiler valideres med de samme kontrollene som over når de lastes opp.
* Filer i mappen `profiles/` på webserveren vises også som faste valg. Nye profiler kan dermed legges til ved å laste opp en fil til serveren, uten å endre koden.
* En lenke kan peke på en profil, for eksempel `?profile=profiles/my-nano.abprofile`.

## 6. Utseende og temaer

* **Arduboy (standard):** svart bakgrunn, grå paneler, lys brun aksentfarge, blokker i dempede jordtoner.
* **Color:** sterke farger per kategori, som i MakeCode.
* **Greyscale, Blue, Green:** én fargetone i flere sjatteringer. Kategoriene skilles med lyshet, ikon og kantmarkering.
* Pikselfarge i simulatoren: hvit, blå, gul eller grønn.
* Oppstartsdialog første gang: tema, pikselfarge og maskinvareprofil. Her kan man også laste opp en profilfil. Alt kan endres under innstillinger.

## 7. Simulator

* Kjører JavaScript generert fra blokkene, så den starter umiddelbart uten kompilering.
* Etterligner 128x64 skjerm, seks knapper og enkel lyd.
* Custom-blokker med C++ kan ikke kjøres. Simulatoren hopper over dem og sier tydelig fra.

## 8. Kompilering og plass

* avr-gcc i WebAssembly med `-Os`, `-ffunction-sections`, `-fdata-sections` og `--gc-sections`.
* Generatoren bidrar med: 8 bits typer der det går, heltall og fastpunkt i stedet for flyttall, grafikk i PROGMEM, valgfri komprimering av store bilder, og bare de delene av maskinvarelaget som brukes.
* Måleren viser eksakte tall lest fra den kompilerte ELF-filen. Mellom kompileringer vises et grovt anslag.

## 9. Opplasting og gjenkjenning

* Nettleseren krever at brukeren velger port første gang. Deretter huskes porten.
* ATmega328P: STK500v1. Optiboot bruker 115200 baud, gammel bootloader 57600. Editoren prøver begge.
* ATmega32U4: AVR109, med reset ved å åpne porten på 1200 baud.
* Chip-signaturen leses før opplasting og sjekkes mot profilen.
* Størrelsen sjekkes mot ledig flash før opplasting starter.

## 10. Prosjekter og filer

* Prosjekter lagres automatisk i nettleseren (IndexedDB).
* Et prosjekt lastes ned som et spill (**Last ned spill**): én PNG-fil som ser ut som en spillkassett. Hele prosjektet ligger lagret inne i bildet, så bildet fungerer som en kassett som kan åpnes igjen med Importer, også på en annen maskin eller i en annen nettleser. Eldre `.abproject`-filer (JSON) kan fortsatt importeres.
* Prosjektfilen inneholder blokker, sprites, lyder, innstillinger og en kopi av maskinvareprofilen.
* Når et prosjekt lastes opp med en profil man ikke har fra før, tilbys det å legge profilen i profilbiblioteket.
* Filene har et formatnummer, slik at eldre filer kan oppgraderes når formatet endres.
* Eksempelprosjekter kan legges i mappen `examples/` på webserveren.
* Ingen brukerkontoer i versjon 1.0.

## 11. Teknologi og drift

* Blockly, TypeScript, Vite.
* All kode er på engelsk: navn på variabler, funksjoner og filer, kommentarer, generert C++ og JavaScript, filformater, mapper og commit-meldinger.
* Bygges til statiske filer med `npm run build`.
* Legges på webserveren med SFTP, i roten eller en undermappe. Vite settes opp med relative stier.
* Krav til serveren: HTTPS (Web Serial krever det), og at `.wasm` sendes som `application/wasm`. En medfølgende `.htaccess` setter filtyper, komprimering og hurtigbuffer, og ved behov headerne COOP og COEP.
* Appen kan installeres som PWA og virker uten nett etter første besøk.
* Valgfritt: GitHub Action som laster opp til webserveren automatisk.

## 12. Spillmotor og blokknivå

Editoren skal være like enkel og forståelig som MakeCode Arcade. Derfor har den en liten spillmotor, og blokkene jobber med spillbegreper i stedet for piksler.

**Prinsipper**

* Man lager spill med hendelser i stedet for å skrive egen hovedløkke: "når spillet starter", "hver frame", "når knapp A trykkes", "når sprite av type Spiller treffer sprite av type Fiende".
* Motoren tar seg av tegning, bevegelse, kollisjon, poeng, liv og "game over". Man trenger ikke tenke på skjermbuffer eller bildefrekvens.
* Blokkene har korte tekster på valgt språk og fornuftige standardverdier, slik at en blokk virker med en gang den er dratt inn.
* Grafikk- og pikselblokker finnes fortsatt under Grafikk for de som vil lenger ned.

**Innhold i motoren**

* Sprites med posisjon, fart, akselerasjon, type (Player, Enemy, Projectile, Food, eller egne typer, vist på valgt språk) og animasjon.
* Fast maks antall sprites (for eksempel 16), slik at RAM-bruken er kjent på forhånd.
* Kollisjon mellom sprites, og mellom sprite og skjermkant (stopp, sprett, forsvinn eller gå rundt).
* "Styr sprite med knappene", med valgfri fart, som i MakeCode.
* Tyngdekraft og hopp for plattformspill.
* Tilekart med 8x8 ruter lagret i flash, med tile-editor, kamera som følger en sprite, og kollisjon mot vegger.
* Poeng, liv, nedtelling og innebygd "game over"-skjerm med rekord i EEPROM.
* Enkle lydeffekter og melodier.
* All bevegelse regnes med fastpunkt, aldri flyttall.
* Bare de delene av motoren som brukes blir med i det kompilerte programmet.

## 13. Maler

**Galleri**

* Ved "Nytt prosjekt" vises et galleri med kort for hver mal: navn, en linje om spillet, og et bilde fra simulatoren.
* Når en mal åpnes, starter spillet med en gang i simulatoren, slik at man kan prøve før man endrer noe.
* En mal åpnes alltid som en kopi. Originalen endres aldri.
* Malene er spillkassetter (`.png`) eller eldre prosjektfiler (`.abproject`) i mappen `templates/` på webserveren. Nye maler kan legges til ved å laste opp en fil.
* Egne prosjekter kan lastes ned og legges i `templates/`, slik at for eksempel en lærer kan lage maler til en klasse.

**Malene i versjon 1.0**

| Mal | Viser hvordan man bruker |
|---|---|
| Tomt prosjekt | Bare "når spillet starter" og "hver frame" |
| Pong | Sprites, fart, sprett mot kanter, kollisjon, poeng, enkel motstander |
| Space shooter | Styring med knapper, skudd, fiender som dukker opp, liv, game over |
| Platformer | Tyngdekraft, hopp, tilekart, kamera, mynter |
| Snake | Rutenett, lister, voksende slange, rekord i EEPROM |
| Breakout | Flere sprites av samme type, ødelegging, nivåer |

**Platformer**

Platformer er den viktigste malen, fordi mange vil prøve den først. Den vises øverst i galleriet, rett etter Tomt prosjekt, og bygges rett etter Pong.

* Spilleren går med venstre og høyre og hopper med A. Hopphøyden blir litt lavere hvis man slipper A tidlig.
* Et brett på rundt 64x8 ruter i tilekartet, der kameraet følger spilleren sidelengs.
* Mynter som gir poeng, fiender som går fram og tilbake, og pigger som tar et liv.
* Man kan hoppe på fiender for å fjerne dem.
* Et flagg ved målet som viser "You win" (på valgt språk når malen åpnes) og poengsummen.
* Tre liv. Når man mister et liv, starter man fra begynnelsen av brettet.
* Forslag til endringer: "Hopp høyere", "Tegn ditt eget brett i tile-editoren", "Legg til flere fiender".
* Brettet lagres i flash, så det bruker nesten ikke RAM. Et brett på 64x8 ruter tar 512 byte flash.
* En utvidet versjon med flere brett kommer i "examples/".

**Krav til malene**

* Hver mal er kort: rundt 10 til 30 blokker.
* Hver mal har kommentarer på blokkene som forklarer hva de gjør.
* Hver mal har tre forslag til endringer, vist i et lite panel. For eksempel: "Gjør ballen raskere", "Gi spilleren tre liv", "Tegn ditt eget romskip".
* Alle maler skal kunne kompileres og kjøre på en Nano med SH1106 over I2C, med god margin på flash og RAM.

## 14. Språk

Editoren kan vises på flere språk, slik som MakeCode Arcade. All kode er likevel alltid på engelsk.

**Valg av språk**

* Engelsk er standard.
* Språket velges i oppstartsdialogen og under innstillinger, og huskes i nettleseren.
* Språket kan også settes i lenken, for eksempel `?lang=nb`.
* Første språk: engelsk, norsk (bokmål), spansk, fransk og tysk.

**Hva som oversettes**

* Alle menyer, knapper, dialoger, feilmeldinger og varsler.
* Tekstene på blokkene og kategoriene. Blockly har ferdige oversettelser for sine standardblokker på over 100 språk. Våre egne blokker bruker meldingsnøkler (`%{BKY_...}`) med oversettelser per språk.
* Navn på sprite-typer, knapper og andre valg i nedtrekkslister. Bak hvert valg ligger en engelsk verdi som brukes i koden.
* Malene: navn, beskrivelse, kommentarer på blokkene og forslag til endringer.

**Hva som ikke oversettes**

* Generert C++ og JavaScript. Navn i koden er alltid engelske, for eksempel `SpriteKind::Player`, uansett hvilket språk editoren vises på.
* Navn som brukeren selv skriver, for eksempel variabler og sprites. Disse gjøres om til gyldige navn i koden, slik at også `æ`, `ø`, `å` og andre tegn virker.
* Filformater og navn på mapper.

**Oppbygging**

* Én JSON-fil per språk i `locales/`, for eksempel `locales/en.json` og `locales/nb.json`.
* Engelsk er referansen. Tekster som mangler i et språk, vises på engelsk.
* Malene lagrer tekst som nøkler med oversettelser, slik at samme mal vises på alle språk.
* Et nytt språk legges til ved å legge en ny fil i `locales/`, uten å endre koden.
* Et lite skript lister opp tekster som mangler i hvert språk.
* Senere: oversettelse via en tjeneste som Crowdin, slik at andre kan bidra.

## 15. JavaScript og Python

Man kan skrive spillet som tekst i JavaScript eller Python i stedet for blokker. Koden gjøres om til C++ som virker på alle chiper og profiler, akkurat som blokkene.

**Visning**

* Faner øverst: Blocks, JavaScript og Python, som i MakeCode Arcade. Man kan bytte fritt, og koden gjøres om mellom dem.
* C++ vises i en egen fane som kun kan leses. Den kan gjøres om til et rent C++ prosjekt (se Konverter til kode).
* Kodeeditoren er Monaco (samme som i VS Code), med fargelegging, autofullføring og forklaring av funksjonene i spillmotoren på valgt språk.

**Slik virker det**

* JavaScript leses med en liten parser (for eksempel acorn), og Python med tree-sitter, begge i nettleseren.
* Koden gjøres om til mellomformatet. Derfra lages C++ til enheten og JavaScript til simulatoren. Brukerens kode kjøres altså aldri direkte, slik at simulatoren regner likt med enheten.
* Kode som tilsvarer blokker, blir blokker når man bytter tilbake.

**Bytte mellom språk**

* All oversetting går via mellomformatet. JavaScript blir til Python og omvendt uten at noe går tapt, så lenge koden holder seg innenfor det forenklede språket.
* Kommentarer følger med når koden oversettes, og blir kommentarer på blokkene.
* Navn som brukeren har valgt, beholdes. Bare navnene i spillmotoren endres mellom camelCase og snake_case.

**Kodeblokk**

* Kode som ikke har en egen blokk, blir en kodeblokk. Den viser koden inni blokken, og man kan skrive og endre kode direkte i den.
* Kodeblokken finnes også i verktøykassen under Custom, slik at man kan dra den inn og skrive kode selv.
* Kodeblokken lagrer koden i mellomformatet, ikke som tekst. Den vises derfor på det tekstspråket man sist brukte (JavaScript eller Python), og oversettes når man bytter. Hvilket språk kodeblokker viser, kan også velges under innstillinger.
* Kodeblokken virker i simulatoren og på enheten, akkurat som andre blokker.
* Skriver man noe som ikke er gyldig, blir blokken merket med en feil og en forklaring på valgt språk. Teksten man skrev beholdes, slik at man kan rette den.

**C++ blokk**

* C++ blokken (Custom) er noe annet enn kodeblokken. Den inneholder ren C++ som ikke kan oversettes.
* Den beholdes uendret i alle visninger. I JavaScript og Python vises den som et kall med C++ koden som tekst, for eksempel `custom.cpp("...")`.
* Den kjøres ikke i simulatoren før AVR-emulatoren er på plass, og simulatoren sier tydelig fra om det.

**Et forenklet språk**

En mikrokontroller med 2 KB RAM kan ikke kjøre fullt JavaScript eller Python. Begge språkene er derfor et avgrenset utvalg, med samme regler:

* Variabler får fast type som finnes ut fra koden: heltall, desimaltall (fastpunkt), sann/usann, tekst, sprite og lister.
* Desimaltall gjøres om til fastpunkt, aldri flyttall.
* Lister har en fast maks lengde.
* Tekst er faste tekster som lagres i flash, pluss tall som skrives ut.
* Funksjoner, hendelser, `if`, `while`, `for` og spillmotorens API er med.
* Ikke med: egne klasser, closures, dynamiske objekter og ordbøker, unntak, `eval`, og import av andre biblioteker.
* Bruker man noe som ikke er med, gir editoren en vennlig feilmelding på valgt språk som peker på linjen og foreslår et alternativ.

**Eksempel (Python)**

```python
player = sprites.create(images.ship, SpriteKind.Player)
controller.move_sprite(player, 60, 0)

def on_a_pressed():
    shot = sprites.create_projectile(images.shot, 0, -80, player)
controller.A.on_event(ControllerButtonEvent.PRESSED, on_a_pressed)
```

Samme spill i JavaScript bruker de samme navnene i camelCase, som i MakeCode: `controller.moveSprite(player, 60, 0)`.

## 16. Status

Versjon 0.1 (9. oktober 2026) har:

* Blokkeditor med alle kategoriene, ikoner, fem temaer og fem språk.
* Spillmotor i C++ og en simulator som regner likt.
* Malene Tomt prosjekt, Platformer, Pong og Romskyting.
* Bilde-, rute- og tilekarteditor, sprite-typer.
* Maskinvareprofiler med kontroll av pinner, lagring som fil og lenker.
* Prosjekter i nettleseren, nedlasting og opplasting som fil.
* Kompilering i nettleseren for ATmega328P, 328PB, 32U4 og 644P, med nøyaktig plassmåler.
* Opplasting over Web Serial med STK500v1 og AVR109.
* Nedlasting av sketch for Arduino IDE for alle chiper.

Gjenstår: JavaScript og Python (punkt 15), kode tilbake til blokker, flere spill på én enhet, kompilering i nettleseren for flere chiper, maler for Snake og Breakout.

## 17. Åpne spørsmål

* Hvilken skjerm, buss og pinner har den første enheten (Nano)?
* Hvilken bootloader har den?
* Holder avr-gcc i WebAssembly mål for størrelse og fart? Avgjøres i steg 0.
