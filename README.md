# Hummerlaget – kveldens bord

Isolert felles poengtavle. Ingen pengeoverføringer eller plassering av innsatser.

## Bruk

Gjestene åpner appens URL. Verten velger **Vert** og bruker det private vertspassordet. Bare verten kan legge til spillere, føre resultater, justere saldo, angre og importere sikkerhetskopi. Gjestene oppdateres omtrent hvert 2,5 sekund mens fanen er synlig.

Vent på «Lagret på felles tavle» etter endringer. Ved avbrudd vises siste tavle og en eventuell ubekreftet endring beholdes i den åpne fanen. Velg «Prøv å lagre igjen» når nettet er tilbake. Ikke lukk eller oppdater fanen mens en endring venter. Gjentatt sending gir ikke dobbeltføring. En konkurrerende endring gir konflikt og henter gjeldende tavle; før ønsket endring på nytt.

Ta JSON-sikkerhetskopi underveis og CSV/JSON etter avslutning. Ved serveromstart beholdes poengene, men verten må logge inn igjen. Vertstilgang varer opptil 12 timer. Ikke del vertspassordet med gjestene.

Introen varer normalt 12 sekunder, kan hoppes over og spilles igjen. Med redusert bevegelse går man videre manuelt. Preferansen ligger bare lokalt på enheten og endrer aldri felles data.

## Regler og beregninger

1 000 kroner i pott og 1 000 startpoeng per spiller; ingen gjenkjøp. Maks 25 poeng på ett tall og 100 poeng totalt per spiller per runde håndheves ved det fysiske bordet. Før kun resultater etter spinn. Europeiske standardutbetalinger beregnes netto. Oppgjør: spillerpoeng / totale poeng × pott.

Appens avrundingsforslag er hele kroner etter største desimalrest, spillerrekkefølge avgjør ved lik rest. Avtal dette før start. Ved total null beregnes ikke oppgjør eller CSV; tell sjetongene og avtal særskilt løsning dersom null er riktig. Pott eller poeng betales aldri ut av appen.

## Drift

Node >=22.16. `npm ci`, deretter `HOST_PASSWORD=<privat verdi på minst 12 tegn> npm start`.
Lokal utvikling bruker SQLite i `.data/`. Produksjon krever `NODE_ENV=production`, `HOST_PASSWORD`, `DATABASE_URL` og valgfri `PORT`. Produksjon nekter å bruke flyktig SQLite.

Bruk en egen PostgreSQL-instans for denne appen. Appen oppretter kun sin egen tabell `roulette_board`. Databasepassord og vertspassord skal bare finnes i tjenestens miljøvariabler, aldri i kildekoden. Nettleseren får en HttpOnly/SameSite=Strict/Secure-økt i produksjon. Skriving krever gyldig vertsinnlogging, versjonskontroll og samme opprinnelse.

Render Free Postgres utløper etter 30 dager. Eksporter etter arrangementet. Gratis webtjeneste hviler etter 15 minutter uten trafikk, så første åpning kan ta ca. ett minutt. Åpne tavlen før gjestene kommer. Ingen betalt oppgradering er konfigurert.

## Kontroll

`npm test` kjører oppgjør, validering, tilgangskontroll, konflikt/dobbeltsending, angre, omstart/lagring og isolert introstatus. Den opprinnelige offline-appen er bevart i `original/roulette.html`.

## Digitale runder (versjon 2)

Alle åpner samme adresse. Velg eget navn under «Min plass» uten passord; dette er tillitsbasert, og andre kan velge samme navn. Velg tilskuer for bare å se.

Verten logger inn, åpner runden, låser før spinn og fører vinnertallet én gang. Spillerne lager et utkast og trykker «Bekreft innsatser». Bare bekreftede innsatser er med. Maks 100 poeng samlet per spiller/runde, maks 25 per enkelttall og aldri mer enn saldo. Standard europeiske innsatser, inkludert nullkombinasjoner, beregnes på serveren. Null taper på rødt/svart, oddetall/partall, høy/lav, dusiner og kolonner.

«Gjenta forrige» lager bare et utkast. Samme navn på to enheter gir konflikt ved samtidige endringer; hent serverens innsatser før du redigerer igjen. Ved nettbrudd beholdes en ubekreftet sending i fanen, og «Prøv igjen» bruker samme forespørsels-ID. Ikke lukk før lagringen er bekreftet. Serveren lagrer låsing og hele rundeoppgjøret atomisk. Manuelle saldoendringer er sperret under åpen/låst runde.

Verten kan angre siste rundeoppgjør før neste runde/manuelle korrigering. Alle saldoer tilbakeføres og runden blir låst igjen, slik at riktig vinnertall kan føres. JSON-sikkerhetskopi inneholder navn, saldo, historikk og rundesnapshot; gjenoppretting henter navn/saldo/historikk, men starter uten aktiv digital runde.

### Tekst som må inn i regel-PDF

Erstatt manuell registrering per spiller med: «Velg eget navn på telefonen. Verten åpner runden. Registrer poenginnsatser og trykk Bekreft innsatser. Verten låser før spinn og fører vinnertallet én gang; appen beregner alle saldoer.»
Legg til: «Kun serverbekreftede innsatser før låsing teller. Maks 100 poeng samlet per runde og 25 på hvert enkelttall, begrenset av saldo. Gjenta forrige er et utkast som må bekreftes. Navnevalg er tillitsbasert. Ved konflikt: hent lagrede innsatser. Ved nettbrudd: vent på bekreftelse eller prøv samme sending igjen.»
Behold ordinære utbetalingssatser og nullregelen. Presiser at angre tilbakefører hele siste runde, bare før ny runde/manuell korrigering. Appen utfører ingen betalinger.

Custom domain registrert i Render: rulle.rammelaus.no. DNS CNAME: rulle → hummerlaget-roulette.onrender.com. TLS må være utstedt før custom-adressen deles.

## Nybegynnervisning og felles demo

Standardvalgene er Farge, Partall/oddetall og Ett tall; Flere valg åpner øvrige innsatser. Kategoribytte endrer ikke innsatser. Hver valgt innsats viser konkrete poeng tilbake ved treff, inkludert innsatsen; ulike innsatser summeres ikke til en lovet gevinst. Eksempel: 25 poeng på ett tall gir 900 tilbake ved treff (875 netto), mens 25 poeng på rødt gir 50 tilbake (25 netto).

Verten starter Demo for hele bordet, også mens ekte runde er åpen. Demo kopierer spillernavn og starter med 1 000 lekepoeng hver, uten ekte innsatser. Åpne, bekreft, lås og før vinnertall som vanlig. Avslutt demo gjenopptar uendret ekte spill; Nullstill demo starter bare demoen på nytt. Demo har ingen premiepott, import eller eksport. Alle nye klienter viser en fast DEMO-markør; hjelp viser også DEMO.

Demotilstanden lagres separat i samme database-dokument og overlever restart. Hver skrivende forespørsel må ha gjeldende modusgenerasjon. Bytte og nullstilling endrer generasjonen, så gamle klienter ikke kan skrive inn i neste modus eller øvingsøkt. Hele dokumentet oppdateres atomisk med revisjonskontroll. Realspilldata, historikk, rundebook og angregrunnlag endres ikke av demo.

Etter denne oppdateringen må eksisterende nettleserfaner lastes på nytt før de kan skrive. Verten logger inn igjen etter deploy. Ingen produksjonsdata brukes til muterende tester.


### Ny kveld og serverkopier

Innlogget vert kan velge **Start ny kveld** også under en åpen eller låst runde. En egen dialog beskriver endringen og har Avbryt. Bekreftet ny kveld starter med tom spillerliste, ingen innsatser/runder og ny historikk; nye spillere legges til med 1 000 poeng. Ingen runde gjøres opp ved avbrudd.

Før byttet lagres hele den ekte kvelden (spillere, poeng, historikk, innsatser, runder og angredata) i samme atomiske databaseoppdatering. **Gjenopprett en kveld** viser lagrede serverkopier bare for verten. Gjenoppretting krever bekreftelse og lagrer også kvelden den erstatter. Kopiene slettes ikke ved en ny kveld eller gjenoppretting. De ligger i den eksisterende databasens dokument; databasens levetid gjelder også kopiene.

Serveren krever vertsinnlogging, korrekt kontekst og den eksakte revisjonen som ble vist da bekreftelsen ble åpnet. Samtidig aktivitet gir konflikt og krever ny kontroll/bekreftelse. Forespørsels-ID gjør retry idempotent. Ny kontekst hindrer gamle spillerfaner i å skrive til en ny eller gjenopprettet kveld. Demo må avsluttes før ekte kveld kan startes/gjenopprettes; Nullstill demo er fortsatt separat.
