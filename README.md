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
