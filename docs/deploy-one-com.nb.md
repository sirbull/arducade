# Publisere ArduCade på one.com

ArduCade er bare statiske filer. Det trengs ingen database, ingen PHP og
ingen backend. Du bygger nettsiden én gang og laster opp filene.

## 1. Bygg nettsiden

På din egen maskin (Node 20 eller nyere):

```
npm install
npm run build
```

Resultatet ligger i mappen `dist/`. Den er rundt 25 MB, og det meste er
kompilatoren.

## 2. Slå på HTTPS

Opplasting til enheten (Web Serial) virker bare over HTTPS.

1. Logg inn på one.com.
2. Gå til innstillingene for domenet og sjekk at SSL er slått på.
3. Filen `.htaccess` som følger med, sender besøkende fra `http://` til
   `https://` automatisk.

## 3. Last opp filene

Bruk SFTP (for eksempel FileZilla) eller filbehandleren til one.com.

1. Koble til med SFTP-opplysningene fra kontrollpanelet til one.com.
2. Velg hvor editoren skal ligge:
   * i roten: `https://dittdomene.no/`
   * eller i en undermappe, for eksempel `https://dittdomene.no/arduboy/`
3. Last opp **alt innholdet** i `dist/` dit, også den skjulte filen
   `.htaccess`. I FileZilla må du kanskje slå på visning av skjulte filer
   (Server, Vis skjulte filer).

Begge plasseringene virker, fordi nettsiden bruker relative stier.

## 4. Sjekk at det virker

1. Åpne adressen i Chrome eller Edge.
2. Velg en mal, for eksempel Platformer, og se at spillet kjører i
   simulatoren.
3. Trykk Kompiler. Første gang lastes kompilatoren ned (rundt 17 MB), og
   det kan ta litt tid. Etterpå husker nettleseren den.

Hvis kompileringen ikke starter, sjekk at `.htaccess` ble lastet opp. Den
sørger for at `.wasm`-filene sendes med riktig filtype.

## Legge til egne maler og profiler

Du kan legge til innhold uten å bygge nettsiden på nytt:

* **Maler:** lagre et spill fra editoren (Lagre → Last ned spill), legg `.png`-filen
  i mappen `templates/` på serveren, og legg filnavnet til i
  `templates/index.json`.
* **Maskinvareprofiler:** lagre profilen fra editoren (Lagre som fil), legg
  `.abprofile`-filen i mappen `profiles/`, og legg filnavnet til i
  `profiles/index.json`. Profilen vises da som et fast valg for alle.
* **Lenke til en profil:** `https://dittdomene.no/arduboy/?profile=profiles/min-nano.abprofile`
  laster profilen direkte. Med `&lang=nb` åpnes editoren på norsk.

## Oppdatere

Kjør `npm run build` på nytt og last opp innholdet i `dist/` igjen. Filene i
`assets/` har nye navn for hver versjon, så du kan trygt slette de gamle.
