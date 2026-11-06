# Auto en laadpaal: het bouwplan

Stand 6 november 2026. Het ontwerp is besloten ([besluit 259](../DECISIONS.md#259-auto-en-laadpaal-een-eigen-pagina-en-met-de-hand-laden-ontwerp));
er is nog niets van gebouwd. Dit document is de overdracht: alles wat nodig is
om het in een nieuwe sessie op te pakken, zonder het gesprek van 6 november.

## Waarom

Auto en laadpaal is de functie waar testers het vaakst om vragen, en hoort bij
de kern van een energie-app. Het is stap 6 uit het plan van de testerronde.

- **Idee #123** (René, SA-XSNV): zelf kiezen welk apparaat uit Home Assistant
  de auto in de tekening is; de auto ook in de garage (nu alleen oprit of
  carport); later de thuisbatterij in de garage. Hem is gevraagd welke
  autokoppeling hij heeft; nog geen antwoord.
- **Melding #132** (BZBHL, dicht): de klimaatregeling van een Nissan MICRA
  (`climate`, koppeling `nissan_connect`) stond als klimaatapparaat in huis.
  Dat hoort niet: het klimaat van een auto is van de auto.

## De keuzes van de bewoner (6 november 2026)

Ronde 1, het plan:

1. **Bedienen met de hand**, zoals klimaat met de hand (besluit 235): de
   hoogste laadstroom in A en pauzeren, alleen als de laadpaal het kan, nooit
   boven wat de laadpaal en de hoofdzekering toestaan. Automatisch laden op
   zon komt pas in B (besluit 85). Met evcc in huis zet SunArc de stand van
   evcc, niet de laadpaal zelf.
2. **Plek:** bij Energie › Auto en laadpaal stel je in; een eigen pagina Auto
   is om te kijken en te bedienen.
3. **Meerdere** auto's en laadpalen, elk apart te koppelen.
4. **Extra's:** laadbeurten (kWh, kosten, deel eigen zon), advies bij zon en
   prijs (met de ruimte op de zekering), en meldingen. Niet gekozen: een
   overzicht voor de werkgever.

Ronde 2, na de schetsen:

5. **De auto zelf is de meter:** de tekening vult zich van achter naar voren
   tot de lading, met een streep bij de laadgrens.
6. **Geen eigen tab:** de pagina opent vanaf de Thuis-kaart van de auto en
   vanaf de auto bij Apparaten; in het menu licht Apparaten op.
7. **Hoe lang** bij Laden: 1 uur, tot een tijd, **tot een %** (los van de
   laadgrens in de auto, nooit erboven; daarna kiest de laadpaal weer zelf),
   en tot de kabel eruit gaat.
8. **Het advies** staat er alleen als het iets zegt, en krijgt **een eigen
   kaart op Thuis**, met één tik "Laad met 8 A".

## De schetsen

In `design/app2/`, met beelden in `screens/` (zie de README daar):

| Schets | Standen | Wat |
| --- | --- | --- |
| `Wand-Auto.html` | (zonder), `#hand`, `#beurten`, `#paal`, `#twee` | De pagina Auto op de wand: de auto als meter, de kabel, laadgrens en laadbeurt, het advies, het blad Laden |
| `Tel-Auto.html` | (zonder), `#laden` | Dezelfde pagina op de telefoon, Laden als blad van onderen |
| `Wand-Energie-Auto.html` | (zonder), `#evcc`, `#niets` | Energie › Auto en laadpaal |
| `Thuis-Tel-Auto-Advies.html` | (zonder), `#goedkoop`, `#niets` | De advieskaart op Thuis naast de kaart van de auto |
| `auto-tekening.js` | | De tekening van de auto als meter; hoort straks in `frontend/kit/` |

De schets is de code (besluit 104): de app gebruikt dezelfde tekening.

Twee dingen om bij het bouwen recht te zetten: in de schets van Energie staat
"SunArc mag de Easee bedienen" onder de tab van de Model 3; dat hoort bij de
tab van de laadpaal. En de uitleg-alinea onder de schets van Thuis is uitleg
voor de bewoner bij de schets, geen tekst voor de app.

## Wat er nu al is

- `backend/src/web/opslag.ts` (besluit 182): herkent **één** auto en **één**
  laadpaal aan de koppeling (`AUTO_KOPPELING`, `LAADPAAL_KOPPELING`) en aan
  wat ze meten. Geeft `Auto { pct, aangesloten, laadt, vermogenW, bereikKm }`.
  Zonder auto in Home Assistant is de laadpaal de auto.
- `frontend/src/thuis.js` (de kaart `auto`, rond regel 700) en
  `frontend/src/apparaten.js` (de kaart van de auto, rond regel 293).
- `backend/src/web/house.ts` rond regel 1690: een buitenruimte is `oprit` of
  `carport` met een auto; de garage kent nog geen auto.
  `frontend/kit/huis.js` tekent de auto op de oprit of onder de carport.
- `backend/src/web/hand.ts`: klimaat met de hand, met een eindtijd en
  `handbediening.json`; wie intussen zelf iets verzette, wint. Het voorbeeld
  voor laden met de hand.
- `backend/src/adapters/homeassistant/client.ts`: schrijven is dicht, op een
  paar smalle deuren na (`isHandCall`, `isKnopCall`, `isStartCall`, ...). Laden
  wordt een nieuwe smalle deur.
- `backend/src/web/aansluiting.ts`: de zekering (fasen × A) en de
  stroommeters per fase; nodig voor de ruimte op de zekering.
- Energie heeft nu de delen Contract en prijzen, Daken en panelen, Aansluiting,
  Meters en Verwarming (`frontend/src/energie.js`, rond regel 128).

## Welke gegevens we willen

Herkennen per rol, niet per merk: Home Assistant heeft geen vaste soort voor
een auto of een laadpaal. Eerst op `device_class`, dan op koppeling en naam.

**De auto**

| Wat | Hoe te herkennen | Nodig voor |
| --- | --- | --- |
| Lading % | `sensor`, klasse `battery`, eenheid % | de meter |
| Bereik | `sensor`, klasse `distance`, naam range/bereik | de meter |
| Laadt ja/nee | `binary_sensor` klasse `battery_charging`, of de stand | de stand |
| Kabel erin | `binary_sensor` klasse `plug` | de stand |
| Laadgrens % | `number` of `sensor` met charge limit / target SoC | de streep, tot een % |
| Klaar om | `sensor` klasse `timestamp` of `duration` (charge end, remaining) | vol om |
| Thuis of weg | `device_tracker` van het apparaat (`home`) | onderweg |
| Kilometerstand | `sensor` klasse `distance`, naam odometer | later, kWh per 100 km |
| Klimaat | `climate` van het apparaat | **niet** als klimaat in huis (#132) |
| Accu in kWh | geeft bijna geen koppeling: de bewoner vult hem in | vol om |

**De laadpaal**

| Wat | Hoe te herkennen | Nodig voor |
| --- | --- | --- |
| Stand | `sensor` (enum) met status/state; woorden als charging, connected, awaiting, completed, error, disconnected | de stand, fouten |
| Vermogen nu | `sensor` klasse `power` | kW, laadbeurt |
| Stroom per fase | `sensor` klasse `current` (per fase) | A, fasen in gebruik |
| Energie deze sessie | `sensor` klasse `energy`, naam session/sessie | laadbeurt |
| Energie totaal | `sensor` klasse `energy`, `total_increasing` | laadbeurten uit de statistiek |
| Hoogste stroom | `number` in A (max/dynamic current, charging current) | **bedienen** |
| Laadmodus | `select` (bijvoorbeeld zappi, Peblar, Ohme, go-e) | later |
| Pauzeren | `switch` of `button` (charge, pause/resume) | **bedienen** |

**Per merk, uit kennis en niet getoetst.** Dit huis heeft geen auto of
laadpaal. Vóór het bouwen echte gegevens van testers verzamelen met de
deelknop bij Apparaten (besluit 250): vraag in de Facebookgroep wie een
laadpaal of elektrische auto in Home Assistant heeft.

- Stroom in A te zetten: Wallbox, Peblar, Ohme, OCPP, go-e, Easee (via een
  eigen dienst `easee.set_charger_dynamic_limit`), Zaptec (op de installatie),
  Alfen. Alleen lezen: Tesla Wall Connector.
- Een eigen zonnestand: zappi (Eco, Eco+), Peblar, go-e.
- Auto's: Tesla (Fleet, Teslemetry, Tessie) geeft veel, ook de laadstroom en
  de laadgrens; Kia/Hyundai, Volkswagen, Renault, BMW, Polestar, MG en
  Nissan geven lading, bereik, kabel en vaak de laadgrens.
- **evcc** (HACS): per laadpunt een stand (Uit, Zon, Zon en net, Snel), de
  lading, de laadgrens en het vermogen. Is evcc er, dan bedient SunArc evcc.

## Rekenregels

- **Stroom en vermogen:** W = A × 230 × fasen (3 × 6 A ≈ 4,1 kW, 3 × 8 A ≈
  5,5 kW).
- **Zon over voor de auto:** opgewekt min wat het huis zonder de auto
  gebruikt. "Op zon tot X A" is de hoogste stroom die daarin past.
- **Ruimte op de zekering:** de zekering per fase min de stroom van het huis
  zonder de auto, per fase gemeten; zonder stroommeters per fase niet tonen.
  Nooit een stroom aanbieden boven de laadpaal of boven die ruimte.
- **Vol om:** (laadgrens − lading) × accu in kWh / vermogen nu. Zonder accu
  in kWh of zonder lading: niet tonen, tenzij de auto zelf een eindtijd geeft.
- **Een laadbeurt:** van kabel erin tot kabel eruit (of van laden tot
  stoppen). Per kwartier: wat de auto nam, en welk deel daarvan zon over was;
  de rest kwam van het net. **Kosten** = het deel van het net × de prijs van
  dat moment (Contract en prijzen, bij een prijs per uur de prijs van dat
  uur). Eigen zon telt als gratis; zo staat het ook onder de lijst.
- **Goedkoopste uren:** alleen met een prijs per uur, uit de prijzen van
  morgen en vannacht (besluit 251).
- Bedragen alleen als ze uit eigen meters en prijzen kloppen (besluit 88).

## Bedienen: de smalle deur

Naar Home Assistant schrijft de app alleen door smalle deuren (besluit 15, de
lijst in `client.ts`). Laden wordt er een, naar het voorbeeld van `isHandCall`:

- alleen de laadpalen die de bewoner bij Energie aanzette voor bedienen;
- alleen de hoogste stroom (`number.set_value` op die ene entiteit, of de
  eigen dienst van het merk) binnen het bereik van de entiteit, en nooit boven
  de ruimte op de zekering; en pauzeren of hervatten;
- met evcc: alleen de stand van het laadpunt (`select`);
- altijd met een eindtijd (1 uur, tot een tijd, tot een %, tot de kabel
  eruit). Daarna terug naar de stand van vóór, maar alleen als die nog staat
  zoals de app hem zette: wie intussen zelf iets verzette, wint. Bewaren in
  een bestand naast `handbediening.json`, zodat een herstart het niet vergeet;
- de stroom gaat met de hand niet vanzelf omlaag bij een wolk; dat is B.

## De stappen, elk een eigen versie

1. **Kiezen en herkennen.** `opslag.ts` naar lijsten van auto's en laadpalen,
   met de rollen van hierboven en evcc. Energie › Auto en laadpaal: wat
   gevonden is met een schakelaar, een ander apparaat kiezen, per auto de accu
   in kWh, aan welke laadpaal hij laadt en de plek (oprit, carport, garage).
   De garage krijgt een auto in `house.ts` en `huis.js` (#123). Het klimaat van
   een auto telt niet meer als klimaat in huis (#132). Bewaren bij de
   antwoorden (`aansluiting.json`), zoals de daken.
2. **De pagina Auto (kijken).** `frontend/src/auto.html` en `auto.js`, de
   tekening naar `frontend/kit/`. Per auto: lading, laden, kW, A per fase,
   kabel, bereik, laadgrens, vol om, onderweg. De Thuis-kaart en Apparaten
   openen de pagina; de Thuis-kaart toont de auto als meter.
3. **Laadbeurten.** Uit de statistiek van Home Assistant (de energie van de
   laadpaal, het net, de zon), per beurt kWh, kosten en deel eigen zon; deze
   week en de som.
4. **Advies.** Zon over en de goedkoopste uren onder de auto, alleen als het
   iets zegt, met de ruimte op de zekering; de eigen advieskaart op Thuis.
   Loopt samen met stap 7 van de testerronde (bewaking per fase).
5. **Met de hand.** Het blad Laden en de smalle deur van hierboven; "Laad met
   8 A" op de advieskaart. Een aanvulling op de schrijfgrens, dus een eigen
   besluit bij het bouwen.
6. **Meldingen.** Auto vol, laden gestopt met een fout, kabel vergeten. Voor
   "kabel vergeten" is een vertrektijd nodig: eerst vragen waar die vandaan komt.

Daarna, in B: automatisch laden op zon, binnen de volgorde van besluit 85
(comfort, dan de batterij, dan de auto).

## Nog open

- Echte gegevens van testers per merk (zie hierboven).
- René (#123): welke autokoppeling.
- De vertrektijd voor de melding "kabel vergeten".
- Een auto die aan meer laadpalen laadt, en een laadpaal met twee punten.
- Laders op één fase, en wisselen tussen één en drie fasen.
- De Engelse teksten (de app is tweetalig, besluit 185).

## Werkwijze bij het bouwen

- Eerst `git fetch` en beta bijwerken: er werken soms meer sessies tegelijk.
- Elke stap is een versie: `VERSIE` en een regel bovenaan `NIEUW` in
  `backend/src/version.ts`, hetzelfde nummer in `backend/` en `frontend/`
  `package.json` en `package-lock.json` en in `addon/config.yaml`. Vóór elke
  versie de issues op GitHub nalopen; lost een versie een melding op, dan de
  meldcode meegeven (besluit 250).
- Vóór elke push in `backend/`: `npm run typecheck`, `npm run lint` en
  `TZ=UTC npx vitest run`; raakt het `frontend/`, dan eerst daar bouwen en de
  paginatest draaien. Na een nieuw besluit `npm run decisions:index`.
- Werk op beta; naar main gaat het via een PR die de bewoner samenvoegt. Bij
  een PR naar main de versie in `OP_MAIN` en `npm run changelog` (besluit 258).
- Teksten kort en gewoon, geen ik-vorm; altijd "verwarmen", nooit het kale
  werkwoord zonder "ver-" (de test in `teksten.test.ts`); weinig bubbels:
  segmentbalk, regel met waarde, schakelaar.
