# Rekkefølge i blokkategoriene

De vanligste nybegynnerblokkene ligger øverst i hver kategori. Rekkefølgen er
vurdert ut fra vanlige oppgaver i de første spillene, ikke målt bruksstatistikk.
Beslektede blokker står sammen. Detaljerte innstillinger og avanserte
operasjoner kommer lenger ned.

| Kategori | Øverst og mest tilgjengelig | Lenger ned |
| --- | --- | --- |
| Spill | Start, oppdatering, intervall, spill slutt og melding | Egen meldingsskjerm, kjøretid og invertering |
| Sprites | Opprett, plasser, hastighet, hold på skjermen, kollisjon og slett | Typer, alle sprites av en type, tegnelag, kontur og tegnereferanser |
| Knapper | Styr sprite, når knapp trykkes, knapp holdes inne | Alle tre blokkene beholdes i denne rekkefølgen |
| Scene | Bakgrunn, tilekart, kamera som følger, plassering og kollisjon med ruter | Manuelt kamera, bakgrunnsbevegelse og parallakselag |
| Info | Poeng, liv, tomt for liv og vanlig timer | HUD-plassering, millisekundtimere og permanent lagring |
| Grafikk | Tekst, sett sammen tekst, tegnehendelse, tekst og bilde | Pikselavlesning, tegnemodus og spritereferanse |
| Partikler | Effekt fra sprite, effekt på posisjon, fjern effekt og ferdige oppskrifter | Egen oppskrift, detaljert partikkeloppsett og tegnemodus |
| Lyd | Vanlig lydeffekt, sang, stopp sang og navngitt melodi | Enkelttoner, polyfon effekt og tonehøydevariasjon |
| Logikk | Hvis, hvis/ellers, sammenligning og sann/usann | Og/eller og ikke |
| Løkker | Gjenta et antall ganger og telleløkke | Mens/inntil og avbryt/fortsett |
| Matte | Tall, regning og tilfeldig tall | Begrensning, min/maks, absoluttverdi, rest og skalering |
| Variabler | Opprett variabel, sett verdi og hent verdi | Endre med et tall |
| Funksjoner | Funksjon uten returverdi og kall til slike funksjoner | Returverdier og betinget retur |
| Egen kode | Kommentar og kommentargruppe | C++ |

Variabler og funksjoner fylles inn automatisk når prosjektet endres. De
følger også denne prioriteringen. Navnene beholdes alfabetisk innenfor hver
blokkgruppe. Hjelpen og blokksøket følger den samme rekkefølgen som paletten.
Blokkreferansen viser også hver variant (for eksempel hvis og hvis/ellers)
og beholder blokker som finnes i flere kategorier i hver av disse kategoriene.
Forklaringer til eldre blokker som ikke lenger er i menyen, ligger til slutt
i den relevante kategorien. Favourites beskrives i hjelpeguiden.

Eksempel: For et enkelt myntspill, finn først **opprett sprite** og
**sett posisjon** i Sprites, **styr sprite med knappene** i Knapper og
**når sprites overlapper** i Sprites. **Endre poeng** ligger øverst i Info.
Du kan bygge dette før du trenger tegnelag, konturer eller lagring.
