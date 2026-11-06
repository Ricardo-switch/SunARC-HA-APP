/*
 * De thuisbatterij, de auto's en de laadpalen (besluit 182, schets
 * Thuis-Tel-Kaarten; meerdere sinds besluit 259): wat de app ervan laat zien,
 * alleen lezen. Tot besluit 182 sloeg de app ze bewust over, bij de batterijen
 * van kleine apparaten (besluit 127); nu krijgen ze een eigen kaart op Thuis
 * en bij Apparaten, als het huis ze heeft.
 *
 * Home Assistant kent geen vaste soort voor een thuisbatterij, een auto of een
 * laadpaal. Herkennen gaat daarom per apparaat, per rol, op wat het meet en
 * wie het levert (docs/auto-en-laadpaal.md):
 *
 *  - **een auto:** een apparaat met een actieradius (`distance`), of van een
 *    koppeling voor auto's (Tesla, Volkswagen, Kia, Nissan, ...);
 *  - **een laadpaal:** een apparaat van een koppeling voor laadpalen (Easee,
 *    Zaptec, Wallbox, ...). Zonder auto in Home Assistant is de laadpaal de
 *    auto: hij weet of er een auto aan hangt en of die laadt;
 *  - **evcc:** de laadpunten van evcc (HACS). Die regelen zelf het laden; ze
 *    tellen niet als auto of laadpaal, maar de app zegt dat evcc er is;
 *  - **een thuisbatterij:** een apparaat met een lading in procenten dat
 *    energie opslaat (`energy_storage`), of van een koppeling of een type
 *    voor thuisbatterijen (Powerwall, Sessy, Marstek, ...), en geen auto.
 *
 * Wat de app vond, kan de bewoner bij Energie › Auto en laadpaal uitzetten,
 * en hij kan zelf een ander apparaat kiezen als auto of laadpaal (besluit
 * 259, stap 1). Per auto vult hij de accu in, aan welke laadpaal hij laadt en
 * waar hij in de tekening staat; dat staat in `aansluiting.json`.
 *
 * Wat een batterij doet, volgt uit het vermogen: wat er naar de batterij gaat
 * is laden, wat eruit komt is leveren. Niet elke koppeling telt even: een
 * vermogen met "discharge" of "ontlaad" in de naam is leveren, en een paar
 * merken tellen omgekeerd (`LEVEREN_POSITIEF`). Weet de app het niet zeker,
 * dan zegt hij alleen het percentage.
 */

import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../adapters/homeassistant/discovery.js';

export interface Thuisbatterij {
  readonly id: string;
  readonly naam: string;
  /** De lading in procenten, of null als het apparaat het niet zegt. */
  readonly pct: number | null;
  /** Het vermogen in watt: positief is laden, negatief is leveren aan het huis. */
  readonly vermogenW: number | null;
  readonly stand: 'laadt' | 'levert' | 'rust' | null;
}

/** Waar een auto in de tekening staat (besluit 259, idee 123). */
export const AUTO_PLEKKEN = ['oprit', 'carport', 'garage'] as const;
export type AutoPlek = (typeof AUTO_PLEKKEN)[number];
export type LaadRol = 'auto' | 'laadpaal';

export interface Auto {
  readonly id: string;
  readonly naam: string;
  readonly pct: number | null;
  /** Of er een kabel in zit; null als niets het meet. */
  readonly aangesloten: boolean | null;
  readonly laadt: boolean | null;
  /** Het laadvermogen in watt, of null. */
  readonly vermogenW: number | null;
  /** Het bereik in kilometers, of null. */
  readonly bereikKm: number | null;
  /** Waar hij in de tekening staat, als de bewoner het koos; null: zoals de indeling zegt. */
  readonly plek: AutoPlek | null;
  /** De accu in kWh, als de bewoner hem invulde. */
  readonly accuKWh: number | null;
  /** De laadpaal waar hij aan laadt, of null. */
  readonly laadpaal: string | null;
}

export interface Opslag {
  readonly batterij: Thuisbatterij | null;
  /** De eerste auto, voor de kaart op Thuis en bij Apparaten; null zonder auto of laadpaal. */
  readonly auto: Auto | null;
  /** Alle auto's (besluit 259); een laadpaal zonder auto telt als auto. */
  readonly autos: readonly Auto[];
}

/** Per auto wat de bewoner invulde (besluit 259). */
export interface AutoInstelling {
  readonly accuKWh: number | null;
  readonly laadpaal: string | null;
  readonly plek: AutoPlek | null;
}

/** De keuzes bij Energie › Auto en laadpaal (besluit 259), in `aansluiting.json`. */
export interface LadenKeuze {
  /** Per apparaat aan of uit; weg is aan, voor wat de app vond. */
  readonly aan: Readonly<Record<string, boolean>>;
  /** Apparaten die de bewoner zelf koos, of waarvan hij de rol verbeterde. */
  readonly rol: Readonly<Record<string, LaadRol>>;
  /** Per auto of laadpaal de accu, de laadpaal en de plek. */
  readonly instelling: Readonly<Record<string, AutoInstelling>>;
}

/** Wat een auto of laadpaal in Home Assistant meet of kan (docs/auto-en-laadpaal.md). */
export const LAAD_WAT = ['lading', 'bereik', 'laadgrens', 'kabel', 'laadt', 'thuis', 'vermogen', 'stroom', 'sessie', 'stand', 'stroomZetten', 'pauzeren'] as const;
export type LaadWat = (typeof LAAD_WAT)[number];

export interface LaadApparaat {
  readonly id: string;
  readonly naam: string;
  readonly rol: LaadRol;
  /** Het merk of de koppeling, zoals "Tesla" of "Easee". */
  readonly merk: string | null;
  readonly wat: readonly LaadWat[];
  readonly aan: boolean;
  /** Zelf gekozen: de app vond hem niet vanzelf. */
  readonly zelf: boolean;
  /** Bij een laadpaal: de laagste en hoogste stroom die hij kent, in A. */
  readonly stroomA: { readonly min: number; readonly max: number } | null;
}

/** Energie › Auto en laadpaal (besluit 259): wat gevonden is, en wat er nog te kiezen is. */
export interface LadenView {
  readonly apparaten: readonly LaadApparaat[];
  /** Andere apparaten die iets meten wat bij laden hoort, om zelf te kiezen. */
  readonly kandidaten: readonly { readonly id: string; readonly naam: string }[];
  /** De laadpunten van evcc, als evcc er is. */
  readonly evcc: readonly { readonly id: string; readonly naam: string }[];
  readonly instelling: Readonly<Record<string, AutoInstelling>>;
}

const AUTO_KOPPELING = /^(tesla_fleet|teslemetry|tessie|tesla_custom|volkswagencarnet|volkswagen_we_connect_id|renault|kia_uvo|hyundai|bmw_connected_drive|mercedes_me|mbapi2020|polestar_api|nissan_leaf|nissan_connect|audiconnect|skodaconnect|myskoda|peugeot|stellantis|toyota|volvo|volvo_cars|ford|fordpass|mg_saic|byd|smart_hashtag|lynkco)$/;
const AUTO_MERK = /\b(volkswagen|renault|kia|hyundai|polestar|bmw|mercedes|audi|skoda|škoda|nissan|peugeot|toyota|volvo|ford|mg|cupra|lynk)\b/i;
const LAADPAAL_KOPPELING = /^(easee|zaptec|wallbox|alfen_wallbox|peblar|ohme|myenergi|go_echarger|goecharger|openevse|nrgkick|tesla_wall_connector|ocpp|evse_load_balancer|smappee)$/;
const LAADPAAL_MERK = /\b(easee|zaptec|wallbox|alfen|peblar|ohme|zappi|go-e|openevse|nrgkick|wall connector)\b/i;
/**
 * Koppelingen die een afstand of een plek meten maar nooit een auto of een
 * laadpaal zijn (6 november 2026): een iBeacon meet hoe ver de telefoon is,
 * Proximity hoe ver iemand van huis is. Eerst telde elke afstand als auto.
 */
const GEEN_AUTO_KOPPELING = /^(ibeacon|proximity|bermuda|private_ble_device|bluetooth_le_tracker|ble_monitor|espresense|mqtt_room|room_assistant|mobile_app|owntracks|life360|google_maps|icloud|icloud3|find_my|tile|homekit_controller|browser_mod|waze_travel_time|google_travel_time|here_travel_time|places|zone|person|sun|met|buienradar|openweathermap)$/;
/** Een sensor met het bereik van een auto: niet een afstand, maar hoe ver hij nog kan rijden. */
const BEREIK = /range|bereik|actieradius|autonomy|reichweite|autonomie/;
/** Een afstand die geen bereik is, zoals een geschatte afstand of een kilometerstand. */
const GEEN_BEREIK = /estimated|geschat|odometer|kilometerstand|mileage|distance.?to|afstand/;
/** evcc uit HACS (`evcc_intg`): laadpunten die zelf het laden regelen. */
const EVCC_KOPPELING = /^evcc/;
const BATTERIJ_KOPPELING = /^(powerwall|tesla_gateway|sessy|marstek|zendure|zendure_ha|victron|huawei_solar|sungrow|goodwe|solaredge|enphase_envoy|growatt_server|ecoflow|ecoflow_cloud|anker_solix|sonnen|sonnenbatterie|fronius|byd)$/;
const BATTERIJ_TYPE = /\b(batter(y|ij)|accu|powerwall|luna|storage|opslag|sessy|venus|solarbank|delta|sonnen)\b/i;
/** Merken die het vermogen van de batterij positief noemen als hij levert. */
const LEVEREN_POSITIEF = /^(powerwall|tesla_gateway|ecoflow|ecoflow_cloud)$/;
/** Onder dit vermogen doet hij niets: een paar watt is ruis. */
const RUST_W = 40;
/** Klassen die bij laden horen: een apparaat zonder geen ervan is geen kandidaat. */
const LAAD_KLASSEN = new Set(['battery', 'distance', 'power', 'current', 'energy', 'plug', 'battery_charging']);

const getal = (s: HaEntityState | undefined): number | null => {
  if (!s || s.state === '' || s.state === 'unknown' || s.state === 'unavailable') return null;
  const n = Number(s.state);
  return Number.isFinite(n) ? n : null;
};
/** Een vermogen in watt, ook als het in kW staat. */
const watt = (s: HaEntityState | undefined): number | null => {
  const n = getal(s);
  if (n == null) return null;
  const eenheid = String(s?.attributes['unit_of_measurement'] ?? 'W');
  return eenheid === 'kW' ? n * 1000 : eenheid === 'MW' ? n * 1e6 : n;
};

interface Apparaat {
  readonly device: HaDevice;
  readonly entiteiten: readonly HaRegistryEntity[];
  readonly platform: string;
}

type Registers = { readonly devices: readonly HaDevice[]; readonly entities: readonly HaRegistryEntity[] };

/** Per apparaat zijn entiteiten, en de hulpjes om te lezen wat ze meten. */
function lezer(registers: Registers, states: ReadonlyMap<string, HaEntityState>) {
  const klasse = (e: HaRegistryEntity) => e.device_class ?? e.original_device_class ?? (states.get(e.entity_id)?.attributes['device_class'] as string | undefined) ?? null;
  const perApparaat = new Map<string, HaRegistryEntity[]>();
  for (const e of registers.entities) {
    if (!e.device_id || e.disabled_by) continue;
    perApparaat.set(e.device_id, [...(perApparaat.get(e.device_id) ?? []), e]);
  }
  const apparaten: Apparaat[] = registers.devices.flatMap((d) => {
    const entiteiten = perApparaat.get(d.id) ?? [];
    return entiteiten.length ? [{ device: d, entiteiten, platform: entiteiten.find((e) => e.platform)?.platform ?? '' }] : [];
  });
  const merk = (a: Apparaat) => `${a.device.manufacturer ?? ''} ${a.device.model ?? ''} ${a.device.name ?? ''}`;
  const heeft = (a: Apparaat, k: string) => a.entiteiten.some((e) => klasse(e) === k);
  const naamVan = (e: HaRegistryEntity) => `${e.entity_id} ${e.name ?? e.original_name ?? ''} ${String(states.get(e.entity_id)?.attributes['friendly_name'] ?? '')}`.toLowerCase();
  /** De lading in procenten: een sensor met de klasse batterij. */
  const pctVan = (a: Apparaat): number | null => {
    for (const e of a.entiteiten) {
      if (!e.entity_id.startsWith('sensor.') || klasse(e) !== 'battery') continue;
      const s = states.get(e.entity_id);
      const n = getal(s);
      if (n != null && n >= 0 && n <= 100 && s?.attributes['unit_of_measurement'] === '%') return n;
    }
    return null;
  };
  const isEvcc = (a: Apparaat) => EVCC_KOPPELING.test(a.platform);
  /** Nooit een auto of laadpaal: evcc, of een koppeling voor plek en afstand. */
  const nooit = (a: Apparaat) => isEvcc(a) || GEEN_AUTO_KOPPELING.test(a.platform);
  /** Een bereik in km of mijl, met een naam die bij een auto past. */
  const heeftBereik = (a: Apparaat) =>
    a.entiteiten.some((e) => e.entity_id.startsWith('sensor.') && klasse(e) === 'distance' && BEREIK.test(naamVan(e)) && !GEEN_BEREIK.test(naamVan(e)));
  /** Iets wat alleen een auto meet: laden of een kabel erin. */
  const laadTeken = (a: Apparaat) => heeft(a, 'battery_charging') || heeft(a, 'plug');
  /*
   * Een auto (6 november 2026, strenger): een koppeling voor auto's, of een
   * bereik samen met een lading of laden, of een automerk met een lading en
   * een bereik of laden. Een afstand alleen is geen auto meer.
   */
  const isAuto = (a: Apparaat) =>
    !nooit(a) &&
    (AUTO_KOPPELING.test(a.platform) ||
      (heeftBereik(a) && (pctVan(a) != null || laadTeken(a))) ||
      (AUTO_MERK.test(merk(a)) && !BATTERIJ_TYPE.test(merk(a)) && pctVan(a) != null && (heeftBereik(a) || laadTeken(a))));
  /** Een laadpaal: een koppeling voor laadpalen, of een merk van laadpalen dat een vermogen, stroom of energie meet. */
  const isLaadpaal = (a: Apparaat) =>
    !nooit(a) && (LAADPAAL_KOPPELING.test(a.platform) || (LAADPAAL_MERK.test(merk(a)) && (heeft(a, 'power') || heeft(a, 'current') || heeft(a, 'energy'))));
  const isBatterij = (a: Apparaat) =>
    !isEvcc(a) && !isAuto(a) && !isLaadpaal(a) && pctVan(a) != null && (heeft(a, 'energy_storage') || BATTERIJ_KOPPELING.test(a.platform) || BATTERIJ_TYPE.test(merk(a)));
  return { klasse, apparaten, merk, heeft, naamVan, pctVan, isEvcc, isAuto, isLaadpaal, isBatterij };
}

/**
 * De auto's in Home Assistant, herkend aan wat ze meten (melding 132): hun
 * klimaatregeling hoort bij de auto, niet bij het huis.
 */
export function autoApparaten(registers: Registers, states: ReadonlyMap<string, HaEntityState>): Set<string> {
  const l = lezer(registers, states);
  return new Set(l.apparaten.filter(l.isAuto).map((a) => a.device.id));
}

const naamVanApparaat = (d: HaDevice) => d.name_by_user?.trim() || d.name?.trim() || d.model?.trim() || d.id;

/** Wat de app van een auto of laadpaal weet (besluit 259). */
function watVan(a: Apparaat, l: ReturnType<typeof lezer>, states: ReadonlyMap<string, HaEntityState>): { wat: LaadWat[]; stroomA: LaadApparaat['stroomA'] } {
  const wat = new Set<LaadWat>();
  let stroomA: LaadApparaat['stroomA'] = null;
  for (const e of a.entiteiten) {
    const k = l.klasse(e);
    const n = l.naamVan(e);
    const d = e.entity_id.split('.')[0];
    const s = states.get(e.entity_id);
    const eenheid = String(s?.attributes['unit_of_measurement'] ?? '');
    if (d === 'sensor' && k === 'battery' && eenheid === '%') wat.add('lading');
    if (d === 'sensor' && k === 'distance' && BEREIK.test(n) && !GEEN_BEREIK.test(n)) wat.add('bereik');
    if ((d === 'number' || d === 'sensor') && /charge.?limit|target.?soc|charge.?target|laadgrens|max.?soc|limit.?soc|soc.?limit/.test(n)) wat.add('laadgrens');
    if (d === 'binary_sensor' && k === 'plug') wat.add('kabel');
    if (d === 'binary_sensor' && k === 'battery_charging') wat.add('laadt');
    if (d === 'device_tracker') wat.add('thuis');
    if (d === 'sensor' && k === 'power') wat.add('vermogen');
    if (d === 'sensor' && k === 'current') wat.add('stroom');
    if (d === 'sensor' && k === 'energy' && /session|sessie/.test(n)) wat.add('sessie');
    if (d === 'sensor' && k !== 'power' && k !== 'current' && k !== 'energy' && /status|state|stand/.test(n)) wat.add('stand');
    if (d === 'number' && eenheid === 'A') {
      wat.add('stroomZetten');
      const min = Number(s?.attributes['min']);
      const max = Number(s?.attributes['max']);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min && max <= 80) stroomA = { min, max };
    }
    if ((d === 'switch' || d === 'button') && /charg|laad|pause|resume|start|stop/.test(n)) wat.add('pauzeren');
  }
  return { wat: LAAD_WAT.filter((w) => wat.has(w)), stroomA };
}

/** De auto's en laadpalen: wat de app vond en wat de bewoner zelf koos (besluit 259). */
function laadApparaten(l: ReturnType<typeof lezer>, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null): { lijst: (LaadApparaat & { readonly bron: Apparaat })[]; evcc: Apparaat[] } {
  const rolZelf = keuze?.rol ?? {};
  const lijst: (LaadApparaat & { readonly bron: Apparaat })[] = [];
  for (const a of l.apparaten) {
    const gevonden: LaadRol | null = l.isAuto(a) ? 'auto' : l.isLaadpaal(a) ? 'laadpaal' : null;
    const rol = rolZelf[a.device.id] ?? gevonden;
    if (!rol) continue;
    const { wat, stroomA } = watVan(a, l, states);
    lijst.push({
      id: a.device.id,
      naam: naamVanApparaat(a.device),
      rol,
      merk: a.device.manufacturer?.trim() || a.platform || null,
      wat,
      aan: keuze?.aan[a.device.id] ?? true,
      zelf: gevonden == null,
      stroomA: rol === 'laadpaal' ? stroomA : null,
      bron: a,
    });
  }
  // Auto's eerst, dan de laadpalen; zo staat het ook op de pagina.
  lijst.sort((x, y) => (x.rol === y.rol ? 0 : x.rol === 'auto' ? -1 : 1) || x.naam.localeCompare(y.naam, 'nl'));
  return { lijst, evcc: l.apparaten.filter(l.isEvcc) };
}

/** De thuisbatterij en de auto's in Home Assistant, met de keuzes van de bewoner (besluit 259). */
export function vindOpslag(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null = null): Opslag {
  const l = lezer(registers, states);
  const { klasse, naamVan, pctVan } = l;
  const vermogens = (a: Apparaat) => a.entiteiten.filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) === 'power');
  const aanUit = (a: Apparaat, k: string): boolean | null => {
    const e = a.entiteiten.find((x) => x.entity_id.startsWith('binary_sensor.') && klasse(x) === k);
    const s = e ? states.get(e.entity_id) : undefined;
    return s == null || s.state === 'unavailable' || s.state === 'unknown' ? null : s.state === 'on';
  };

  /* ---- de thuisbatterij ---- */
  // Wat de bewoner als auto of laadpaal koos, is geen thuisbatterij.
  const accu = l.apparaten.find((a) => l.isBatterij(a) && keuze?.rol[a.device.id] == null) ?? null;
  let batterij: Thuisbatterij | null = null;
  if (accu) {
    const p = vermogens(accu);
    // Bij voorkeur een vermogen van de batterij zelf, niet dat van de panelen of het net.
    const eigen = p.filter((e) => /batter|accu|charge|laad/.test(naamVan(e)));
    let w: number | null = null;
    const laad = eigen.find((e) => /(?<!dis)charg|(?<!ont)laad/.test(naamVan(e)) && !/discharg|ontlaad/.test(naamVan(e)));
    const ontlaad = eigen.find((e) => /discharg|ontlaad/.test(naamVan(e)));
    if (laad || ontlaad) {
      w = (laad ? (watt(states.get(laad.entity_id)) ?? 0) : 0) - (ontlaad ? (watt(states.get(ontlaad.entity_id)) ?? 0) : 0);
    } else {
      const een = eigen[0] ?? (p.length === 1 ? p[0] : undefined);
      const n = een ? watt(states.get(een.entity_id)) : null;
      w = n == null ? null : LEVEREN_POSITIEF.test(accu.platform) ? -n : n;
    }
    const stand = w == null ? null : w > RUST_W ? 'laadt' : w < -RUST_W ? 'levert' : 'rust';
    batterij = { id: accu.device.id, naam: accu.device.name_by_user || 'De batterij', pct: pctVan(accu), vermogenW: w == null ? null : Math.round(w), stand };
  }

  /* ---- de auto's, met hun laadpaal; een laadpaal zonder auto is de auto ---- */
  const { lijst } = laadApparaten(l, states, keuze);
  const wagens = lijst.filter((x) => x.aan && x.rol === 'auto');
  const palen = lijst.filter((x) => x.aan && x.rol === 'laadpaal');
  const instelling = (id: string): AutoInstelling => keuze?.instelling[id] ?? { accuKWh: null, laadpaal: null, plek: null };
  /** De laadpaal van een auto: de gekozen, of de enige als er één is. */
  const paalVan = (id: string) => {
    const gekozen = instelling(id).laadpaal;
    return palen.find((p) => p.id === gekozen) ?? (palen.length === 1 && gekozen == null ? palen[0]! : null);
  };

  const maak = (wagen: Apparaat | null, paal: Apparaat | null, naam: string): Auto => {
    const bron = [wagen, paal].filter((x): x is Apparaat => x != null);
    const eerst = <T>(f: (a: Apparaat) => T | null): T | null => {
      for (const a of bron) {
        const v = f(a);
        if (v != null) return v;
      }
      return null;
    };
    // Het laadvermogen: van de laadpaal, anders een laadvermogen van de auto.
    const laadW = eerst((a) => {
      const e = vermogens(a).find((x) => a === paal || /charg|laad/.test(naamVan(x)));
      return e ? watt(states.get(e.entity_id)) : null;
    });
    /** De stand van een laadpaal als woord, zoals "charging" of "connected". */
    const status = paal
      ? paal.entiteiten
          .filter((e) => e.entity_id.startsWith('sensor.') && klasse(e) !== 'power' && /status|state|stand|mode/.test(naamVan(e)))
          .map((e) => String(states.get(e.entity_id)?.state ?? '').toLowerCase())
          .find((s) => /charg|laad|connect|disconnect|awaiting|ready|available|idle|paused|completed|vol/.test(s)) ?? null
      : null;
    const laadtStatus = status == null ? null : /^(charging|laden|laadt)$|charging/.test(status) && !/not.?charging|discharg/.test(status);
    const losStatus = status == null ? null : /disconnect|available|idle|niet aangesloten|vrij/.test(status);
    const laadt = eerst((a) => aanUit(a, 'battery_charging')) ?? laadtStatus ?? (laadW == null ? null : laadW > 200);
    const aangesloten = eerst((a) => aanUit(a, 'plug')) ?? (losStatus == null ? null : !losStatus) ?? (laadt ? true : null);
    const bereik = wagen
      ? (() => {
          const e = wagen.entiteiten.find((x) => x.entity_id.startsWith('sensor.') && klasse(x) === 'distance' && BEREIK.test(naamVan(x)) && !GEEN_BEREIK.test(naamVan(x)));
          const s = e ? states.get(e.entity_id) : undefined;
          const n = getal(s);
          if (n == null) return null;
          return String(s?.attributes['unit_of_measurement'] ?? 'km') === 'mi' ? Math.round(n * 1.609) : Math.round(n);
        })()
      : null;
    const id = (wagen ?? paal)!.device.id;
    const ins = instelling(id);
    return {
      id,
      naam,
      pct: eerst(pctVan),
      aangesloten,
      laadt,
      vermogenW: laadW == null ? null : Math.round(laadW),
      bereikKm: bereik,
      plek: ins.plek,
      accuKWh: wagen ? ins.accuKWh : null,
      laadpaal: paal && wagen ? paal.device.id : null,
    };
  };

  const autos: Auto[] = wagens.length
    ? wagens.map((w) => maak(w.bron, paalVan(w.id)?.bron ?? null, w.naam))
    : palen.map((p) => maak(null, p.bron, palen.length === 1 ? 'De auto' : p.naam));
  return { batterij, auto: autos[0] ?? null, autos };
}

/** Energie › Auto en laadpaal (besluit 259): gevonden, zelf gekozen, evcc, en wat er nog te kiezen is. */
export function ladenView(registers: Registers, states: ReadonlyMap<string, HaEntityState>, keuze: LadenKeuze | null): LadenView {
  const l = lezer(registers, states);
  const { lijst, evcc } = laadApparaten(l, states, keuze);
  const al = new Set([...lijst.map((x) => x.id), ...evcc.map((a) => a.device.id)]);
  // Kiezen kan uit apparaten die iets meten wat bij laden hoort; geen thuisbatterij.
  const kandidaten = l.apparaten
    .filter((a) => !al.has(a.device.id) && !l.isBatterij(a) && a.entiteiten.some((e) => LAAD_KLASSEN.has(l.klasse(e) ?? '')))
    .map((a) => ({ id: a.device.id, naam: naamVanApparaat(a.device) }))
    .sort((x, y) => x.naam.localeCompare(y.naam, 'nl'))
    .slice(0, 300);
  return {
    apparaten: lijst.map(({ bron: _b, ...x }) => x),
    kandidaten,
    evcc: evcc.map((a) => ({ id: a.device.id, naam: naamVanApparaat(a.device) })),
    instelling: keuze?.instelling ?? {},
  };
}

const ID = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * Leest de keuzes zoals de pagina ze stuurt (besluit 259): alleen vormen, geen
 * entiteiten. Een onbekend apparaat kan geen kwaad: wat Home Assistant niet
 * kent, telt nergens mee.
 */
export function leesLaden(raw: unknown): { keuze: LadenKeuze | null } | { fout: string } {
  if (raw == null) return { keuze: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { fout: 'auto en laadpaal: verwacht een object' };
  const r = raw as Record<string, unknown>;
  const obj = (v: unknown) => (v == null ? {} : typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  const aanRaw = obj(r['aan']);
  const rolRaw = obj(r['rol']);
  const insRaw = obj(r['instelling']);
  if (!aanRaw || !rolRaw || !insRaw) return { fout: 'auto en laadpaal: aan, rol en instelling zijn per apparaat' };
  if (Object.keys(aanRaw).length > 40 || Object.keys(rolRaw).length > 20 || Object.keys(insRaw).length > 20) return { fout: 'auto en laadpaal: te veel apparaten' };
  const aan: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(aanRaw)) {
    if (!ID.test(id) || typeof v !== 'boolean') return { fout: 'auto en laadpaal: aan is per apparaat ja of nee' };
    aan[id] = v;
  }
  const rol: Record<string, LaadRol> = {};
  for (const [id, v] of Object.entries(rolRaw)) {
    if (!ID.test(id) || (v !== 'auto' && v !== 'laadpaal')) return { fout: 'auto en laadpaal: een apparaat is een auto of een laadpaal' };
    rol[id] = v;
  }
  const instelling: Record<string, AutoInstelling> = {};
  for (const [id, v] of Object.entries(insRaw)) {
    const i = obj(v);
    if (!ID.test(id) || !i) return { fout: 'auto en laadpaal: onbekende instelling' };
    const accu = i['accuKWh'] ?? null;
    if (accu !== null && (typeof accu !== 'number' || !Number.isFinite(accu) || accu < 5 || accu > 250)) return { fout: 'de accu is 5 tot 250 kWh' };
    const paal = i['laadpaal'] ?? null;
    if (paal !== null && (typeof paal !== 'string' || !ID.test(paal))) return { fout: 'de laadpaal is een apparaat uit Home Assistant' };
    const plek = i['plek'] ?? null;
    if (plek !== null && !AUTO_PLEKKEN.includes(plek as AutoPlek)) return { fout: 'de auto staat op de oprit, onder de carport of in de garage' };
    instelling[id] = { accuKWh: accu === null ? null : Math.round((accu as number) * 10) / 10, laadpaal: paal as string | null, plek: plek as AutoPlek | null };
  }
  if (!Object.keys(aan).length && !Object.keys(rol).length && !Object.keys(instelling).length) return { keuze: null };
  return { keuze: { aan, rol, instelling } };
}
