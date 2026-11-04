/*
 * Daken en panelen (besluit 254, stap 1): elk dakvlak apart.
 *
 * Een huis heeft niet één dak met twee kanten: een hoofddak met meer vlakken,
 * een uitbouw met een plat dak (oost-west, zoals idee #121), een garage,
 * panelen op de grond. Elk vlak heeft een letter, een plek, een opstelling,
 * een richting, een helling, een aantal panelen en de Wp per paneel, en de
 * meter (omvormer, string of micro-omvormers) die zijn opbrengst meet.
 *
 * Wat de bewoner bewaarde, staat bij de antwoorden (`daken`). Zonder dat
 * volgen de vlakken uit wat er al was: de ligging van het hoofddak (gemeten,
 * bevestigd, de configuratie of een schatting) en de panelen op de garage,
 * carport of het tuinhuis (besluit 187). Die tellen sindsdien mee.
 */
import type { Geometry, GeometrySource, SolarPlane } from '../core/model.js';

export const DAK_PLEKKEN = ['hoofddak', 'dwarskap', 'uitbouw', 'garage', 'carport', 'tuinhuis', 'grond', 'gevel'] as const;
export type DakPlek = (typeof DAK_PLEKKEN)[number];

/**
 * Hoe de panelen liggen: `schuin` op een schuin dak, `rek` op rekken naar één
 * kant (plat dak of de grond), `oostwest` in ruggen met de helft naar elke
 * kant, `plat` plat liggend.
 */
export const OPSTELLINGEN = ['schuin', 'rek', 'oostwest', 'plat'] as const;
export type Opstelling = (typeof OPSTELLINGEN)[number];

/** Waar de richting en de helling vandaan komen; dezelfde woorden als de configuratie. */
export type VlakBron = GeometrySource;
const VLAK_BRONNEN: readonly VlakBron[] = ['bewoner', 'gemeten', 'schatting'];

export interface DakVlak {
  /** A tot Z, vast zolang het vlak bestaat. */
  readonly letter: string;
  readonly plek: DakPlek;
  readonly opstelling: Opstelling;
  /** Waar het vlak naartoe kijkt; bij oost-west de eerste kant, de tweede kijkt er tegenover. */
  readonly azimuthDeg: number;
  /** 0 is plat, 90 staat rechtop. */
  readonly tiltDeg: number;
  /** De panelen op dit vlak; bij oost-west op de eerste kant. */
  readonly aantal: number;
  /** Bij oost-west de panelen op de andere kant. */
  readonly aantal2?: number;
  readonly wpPerPaneel: number;
  /** De sensor die de opbrengst van dit vlak meet, of null als de bewoner het niet weet. */
  readonly meter: string | null;
  readonly bron: VlakBron;
}

export interface Daken {
  readonly vlakken: readonly DakVlak[];
  /** Waar de voorkant naartoe kijkt; voor de gevels. Null: zoals de ligging hem vond. */
  readonly voorgevelDeg: number | null;
  /** Wat de omvormer hooguit levert; null als het niet bekend is. */
  readonly omvormerW: number | null;
}

/** Panelen op een ander dak (besluit 187), zoals bij de antwoorden. */
export type EldersAantal = Partial<Record<'garage' | 'carport' | 'tuinhuis', number>>;

export const MAX_VLAKKEN = 26;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const hoekVerschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Wattpiek van een vlak: alle panelen, bij oost-west beide kanten. */
export function piekVan(v: DakVlak): number {
  return (v.aantal + (v.opstelling === 'oostwest' ? (v.aantal2 ?? 0) : 0)) * v.wpPerPaneel;
}

export function panelenVan(v: DakVlak): number {
  return v.aantal + (v.opstelling === 'oostwest' ? (v.aantal2 ?? 0) : 0);
}

/** De vlakken zoals de berekening ze kent; oost-west wordt twee vlakken. */
export function zonnevlakken(d: Daken): SolarPlane[] {
  const uit: SolarPlane[] = [];
  for (const v of d.vlakken) {
    const id = `vlak-${v.letter.toLowerCase()}`;
    const kanten: [number, number, string][] =
      v.opstelling === 'oostwest' ? [[v.azimuthDeg, v.aantal, id], [v.azimuthDeg + 180, v.aantal2 ?? 0, `${id}-2`]] : [[v.azimuthDeg, v.aantal, id]];
    for (const [az, n, kantId] of kanten) {
      const peakW = Math.round(n * v.wpPerPaneel);
      if (peakW > 0) uit.push({ id: kantId, azimuthDeg: Math.round(norm(az)), tiltDeg: Math.round(v.tiltDeg), peakW, source: v.bron });
    }
  }
  return uit;
}

/* ------------------------------------------------------------ lezen */

const getal = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const heel = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/**
 * De daken zoals de pagina of het bestand ze geeft. Null of zonder vlakken:
 * niet bewaard, dan volgen ze uit wat er al was.
 */
export function leesDaken(raw: unknown): { daken: Daken | null } | { fout: string } {
  if (raw == null) return { daken: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { fout: 'onbekende daken' };
  const r = raw as Record<string, unknown>;
  const lijst = r['vlakken'];
  if (!Array.isArray(lijst) || lijst.length > MAX_VLAKKEN) return { fout: `de daken zijn tot ${MAX_VLAKKEN} vlakken` };
  if (lijst.length === 0) return { daken: null };
  const voorgevel = r['voorgevelDeg'] ?? null;
  if (voorgevel !== null && !getal(voorgevel, 0, 360)) return { fout: 'de voorkant is 0 tot 360°' };
  const omvormerW = r['omvormerW'] ?? null;
  if (omvormerW !== null && !getal(omvormerW, 100, 100_000)) return { fout: 'de omvormer is 100 tot 100.000 W' };
  const letters = new Set<string>();
  const vlakken: DakVlak[] = [];
  for (const x of lijst) {
    if (typeof x !== 'object' || x == null || Array.isArray(x)) return { fout: 'een vlak is een object' };
    const v = x as Record<string, unknown>;
    const letter = v['letter'];
    if (typeof letter !== 'string' || letter.length !== 1 || !LETTERS.includes(letter) || letters.has(letter)) return { fout: 'elk vlak heeft een eigen letter van A tot Z' };
    letters.add(letter);
    if (!DAK_PLEKKEN.includes(v['plek'] as DakPlek)) return { fout: `onbekende plek voor vlak ${letter}` };
    if (!OPSTELLINGEN.includes(v['opstelling'] as Opstelling)) return { fout: `onbekende opstelling voor vlak ${letter}` };
    if (!getal(v['azimuthDeg'], 0, 360) || !getal(v['tiltDeg'], 0, 90)) return { fout: `vlak ${letter}: de richting is 0 tot 360°, de helling 0 tot 90°` };
    const ow = v['opstelling'] === 'oostwest';
    const aantal2 = ow ? (v['aantal2'] ?? 0) : null;
    if (!heel(v['aantal'], ow ? 0 : 1, 200) || (ow && !heel(aantal2, 0, 200)) || (ow && (v['aantal'] as number) + (aantal2 as number) < 1)) {
      return { fout: `vlak ${letter}: het aantal panelen is een heel getal van 1 tot 200` };
    }
    if (!getal(v['wpPerPaneel'], 50, 1000)) return { fout: `vlak ${letter}: een paneel is 50 tot 1000 Wp` };
    const meter = v['meter'] ?? null;
    if (meter !== null && (typeof meter !== 'string' || !/^sensor\.[a-z0-9_]{1,160}$/.test(meter))) return { fout: `vlak ${letter}: de meter is een sensor uit Home Assistant` };
    const bron = v['bron'] ?? 'bewoner';
    if (!VLAK_BRONNEN.includes(bron as VlakBron)) return { fout: `vlak ${letter}: onbekende bron` };
    vlakken.push({
      letter,
      plek: v['plek'] as DakPlek,
      opstelling: v['opstelling'] as Opstelling,
      azimuthDeg: norm(v['azimuthDeg'] as number),
      tiltDeg: v['tiltDeg'] as number,
      aantal: v['aantal'] as number,
      ...(ow ? { aantal2: aantal2 as number } : {}),
      wpPerPaneel: v['wpPerPaneel'] as number,
      meter: meter as string | null,
      bron: bron as VlakBron,
    });
  }
  return { daken: { vlakken, voorgevelDeg: voorgevel as number | null, omvormerW: omvormerW as number | null } };
}

/* ------------------------------------------------------------ uit wat er al was */

/** Waar panelen op een ander dak liggen, zolang de bewoner het niet zei. */
const ELDERS: Record<keyof EldersAantal, { opstelling: Opstelling; tiltDeg: number }> = {
  garage: { opstelling: 'rek', tiltDeg: 15 },
  carport: { opstelling: 'schuin', tiltDeg: 10 },
  tuinhuis: { opstelling: 'schuin', tiltDeg: 25 },
};

export interface OudeDaken {
  /** De ligging van het hoofddak zoals hij nu geldt, of null. */
  readonly geometry: Geometry | null;
  /** Het aantal panelen op het huis, als de bewoner het zei. */
  readonly aantal: number | null;
  /** Lag het dak plat (de kant "plat" in Inrichten)? */
  readonly plat: boolean;
  readonly elders: EldersAantal | null;
  /**
   * De wattpiek van het hoofddak komt uit de meting van alle panelen samen
   * (ook die op de garage): dan gaat het deel van de andere daken eraf.
   */
  readonly gemetenTotaal: boolean;
}

/** Een aantal over de vlakken verdeeld naar hun wattpiek, elk minstens één. */
function verdeel(totaal: number, delen: readonly number[]): number[] {
  const som = delen.reduce((s, d) => s + d, 0) || 1;
  const ruw = delen.map((d) => (totaal * d) / som);
  const uit = ruw.map((x) => Math.max(1, Math.floor(x)));
  let rest = totaal - uit.reduce((s, n) => s + n, 0);
  const volgorde = ruw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && volgorde.length; k++, rest--) uit[volgorde[k % volgorde.length]![1]]! += 1;
  return uit;
}

/**
 * De vlakken uit wat er al was (besluit 254: vanzelf vlakken). Het hoofddak
 * krijgt de vlakken van de ligging; twee bijna platte vlakken tegenover
 * elkaar zijn één vlak oost-west. De garage, de carport en het tuinhuis
 * krijgen een eigen vlak, gericht als het zonnigste vlak van het huis.
 */
export function dakenUitOud(o: OudeDaken): Daken {
  const planes = o.geometry?.solarPlanes.filter((p) => p.peakW > 0) ?? [];
  const elders = (Object.keys(ELDERS) as (keyof EldersAantal)[]).filter((p) => (o.elders?.[p] ?? 0) > 0);
  const eldersN = elders.reduce((s, p) => s + (o.elders?.[p] ?? 0), 0);
  const schaal = o.gemetenTotaal && o.aantal && eldersN ? o.aantal / (o.aantal + eldersN) : 1;

  // Twee bijna platte vlakken tegenover elkaar: één vlak oost-west.
  type Groep = { planes: SolarPlane[]; ow: boolean };
  const groepen: Groep[] =
    planes.length === 2 && planes.every((p) => p.tiltDeg < 20) && hoekVerschil(planes[0]!.azimuthDeg, planes[1]!.azimuthDeg + 180) <= 15
      ? [{ planes: [...planes], ow: true }]
      : planes.map((p) => ({ planes: [p], ow: false }));
  const aantallen = o.aantal ? verdeel(o.aantal, planes.map((p) => p.peakW)) : planes.map((p) => Math.max(1, Math.round(p.peakW / 400)));
  const nVan = (p: SolarPlane) => aantallen[planes.indexOf(p)]!;
  const totaalPiek = planes.reduce((s, p) => s + p.peakW, 0) * schaal;
  const totaalN = planes.reduce((s, p) => s + nVan(p), 0);
  const gemWp = totaalN ? totaalPiek / totaalN : 400;

  const vlakken: DakVlak[] = [];
  const letter = () => LETTERS[vlakken.length]!;
  for (const g of groepen) {
    const [a, b] = g.planes;
    const n = nVan(a!);
    const n2 = b ? nVan(b) : 0;
    const piek = g.planes.reduce((s, p) => s + p.peakW, 0) * schaal;
    vlakken.push({
      letter: letter(),
      plek: 'hoofddak',
      opstelling: g.ow ? 'oostwest' : o.plat || a!.tiltDeg < 10 ? 'rek' : 'schuin',
      azimuthDeg: norm(a!.azimuthDeg),
      tiltDeg: a!.tiltDeg,
      aantal: n,
      ...(g.ow ? { aantal2: n2 } : {}),
      wpPerPaneel: piek / (n + n2),
      meter: null,
      bron: a!.source,
    });
  }
  // Het zonnigste vlak: het dichtst bij het zuiden.
  const zuid = [...planes].sort((x, y) => hoekVerschil(x.azimuthDeg, 180) - hoekVerschil(y.azimuthDeg, 180))[0];
  for (const p of elders) {
    vlakken.push({
      letter: letter(),
      plek: p,
      opstelling: ELDERS[p].opstelling,
      azimuthDeg: norm(zuid?.azimuthDeg ?? 180),
      tiltDeg: ELDERS[p].tiltDeg,
      aantal: o.elders![p]!,
      wpPerPaneel: gemWp,
      meter: null,
      bron: 'schatting',
    });
  }
  return {
    vlakken,
    voorgevelDeg: o.geometry?.facades.find((f) => f.id === 'voorgevel')?.azimuthDeg ?? null,
    omvormerW: o.geometry?.inverterMaxW ?? null,
  };
}

export const heeftElders = (e: EldersAantal | null | undefined) => Object.values(e ?? {}).some((n) => (n ?? 0) > 0);
