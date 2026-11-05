/*
 * De meting per dakvlak (besluit 254, stap 4). De meting van besluit 157 kent
 * hooguit één vlak, of twee tegenover elkaar. Hier begint hij bij de vlakken
 * die de bewoner invulde, per meter (omvormer): voor elk vlak zoekt hij binnen
 * 60° van de ingevulde richting de richting en de helling die het best bij de
 * heldere momenten passen. De verhouding tussen de vlakken staat vast: het
 * aantal panelen maal de Wp. Wat niet duidelijk beter past dan de invoer,
 * blijft de invoer: twee vlakken die bijna dezelfde kant op kijken, zijn uit
 * één meter niet uit elkaar te halen.
 *
 * Daarnaast het verdelen: wat één meter meet, per vlak naar wat elk vlak bij
 * heldere lucht zou leveren.
 */
import { clearSkyOnPlaneWm2, sunPosition, type SunPosition } from '../core/sun.js';
import { panelenVan, piekVan, type DakVlak, type Daken } from './daken.js';
import { beoordeel, bovenkant, goedGenoeg, type Beoordeling } from './ligging.js';
import type { Location } from './sun.js';
import { partsIn, type PowerRow } from './today.js';

const norm = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/** Hoe ver de helling mag gaan, per opstelling. */
const BEREIK: Record<DakVlak['opstelling'], readonly [number, number]> = { schuin: [10, 60], rek: [5, 40], oostwest: [0, 25], plat: [0, 0] };
/** Tot zo ver van de ingevulde richting. */
const ZOEK_AZ = 60;
/** Zoveel beter moet het passen dan de invoer, anders blijft de invoer. */
const BETER = 0.01;

export interface VlakStand {
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
}

export interface MeterMeting {
  /** Per letter wat de meting vond. */
  readonly vlakken: Readonly<Record<string, VlakStand>>;
  readonly fout: number;
  /** Wat de meter bij heldere lucht haalt, in Wp. */
  readonly peakW: number;
}

/** De vlakken van een vlak voor het model: oost-west zijn er twee, met elk hun deel. */
function stukken(v: DakVlak, s: VlakStand): { azimuthDeg: number; tiltDeg: number; w: number }[] {
  if (v.opstelling === 'oostwest') {
    return [
      { azimuthDeg: s.azimuthDeg, tiltDeg: s.tiltDeg, w: v.aantal * v.wpPerPaneel },
      { azimuthDeg: norm(s.azimuthDeg + 180), tiltDeg: s.tiltDeg, w: (v.aantal2 ?? 0) * v.wpPerPaneel },
    ].filter((x) => x.w > 0);
  }
  return [{ azimuthDeg: s.azimuthDeg, tiltDeg: s.tiltDeg, w: piekVan(v) }];
}

/** Het model voor heldere lucht van een stel vlakken, per W/m² wattpiek. */
function modelVan(vlakken: readonly DakVlak[], stand: readonly VlakStand[]): (sun: SunPosition) => number {
  const delen = vlakken.flatMap((v, i) => stukken(v, stand[i]!));
  const som = delen.reduce((s, d) => s + d.w, 0) || 1;
  return (sun) => delen.reduce((s, d) => s + (clearSkyOnPlaneWm2(sun, d) * d.w) / som, 0);
}

/**
 * Meet de vlakken op één meter uit zijn opbrengst, of null zonder heldere dag
 * of als niets goed genoeg past. `omvormerW`: wat de omvormer hooguit levert.
 */
export function meetVlakken(rows: readonly PowerRow[], vlakken: readonly DakVlak[], location: Location, omvormerW?: number | null): MeterMeting | null {
  if (!vlakken.length) return null;
  const boven = bovenkant(rows, location, omvormerW);
  if (!boven) return null;
  const aantal = vlakken.reduce((s, v) => s + panelenVan(v), 0);
  const laag = Math.max(boven.maxW * 0.9, aantal * 250);
  const hoog = Math.min(boven.maxW * 4, aantal * 550);
  const invoer: VlakStand[] = vlakken.map((v) => ({ azimuthDeg: norm(v.azimuthDeg), tiltDeg: Math.round(v.tiltDeg) }));
  const score = (st: readonly VlakStand[]) => beoordeel(boven.punten, modelVan(vlakken, st), laag, hoog);
  const beter = (a: Beoordeling | null, b: Beoordeling | null) => a != null && (b == null || a.fout < b.fout);

  let stand = [...invoer];
  let huidig = score(stand);
  const rondes = vlakken.length > 8 ? 1 : 3;
  for (let ronde = 0; ronde < rondes; ronde++) {
    vlakken.forEach((v, i) => {
      // Plat liggend: geen richting en geen helling om te zoeken.
      if (v.opstelling === 'plat') return;
      const [t0, t1] = BEREIK[v.opstelling];
      const probeer = (az: number, tilt: number) => {
        const st = stand.map((x, j) => (j === i ? { azimuthDeg: norm(az), tiltDeg: tilt } : x));
        const r = score(st);
        if (beter(r, huidig)) {
          stand = st;
          huidig = r;
        }
      };
      const a0 = invoer[i]!.azimuthDeg;
      for (let d = -ZOEK_AZ; d <= ZOEK_AZ; d += 5) for (let t = t0; t <= t1; t += 5) probeer(a0 + d, t);
      // Fijner rond de beste.
      const b = stand[i]!;
      for (let d = -4; d <= 4; d++) {
        for (let t = Math.max(t0, b.tiltDeg - 4); t <= Math.min(t1, b.tiltDeg + 4); t++) {
          if (Math.abs(((b.azimuthDeg + d - a0 + 540) % 360) - 180) <= ZOEK_AZ) probeer(b.azimuthDeg + d, t);
        }
      }
    });
  }
  if (huidig == null || !goedGenoeg(huidig)) return null;
  // Wat niet duidelijk beter past dan de invoer, blijft de invoer.
  vlakken.forEach((_v, i) => {
    const terug = stand.map((x, j) => (j === i ? invoer[i]! : x));
    const r = score(terug);
    if (r != null && huidig != null && r.fout <= huidig.fout * (1 + BETER)) {
      stand = terug;
      huidig = r;
    }
  });
  return {
    vlakken: Object.fromEntries(vlakken.map((v, i) => [v.letter, stand[i]!])),
    fout: Math.round(huidig.fout * 1000) / 1000,
    peakW: Math.round(huidig.peakW / 10) * 10,
  };
}

/* ------------------------------------------------------------ verdelen */

export interface Verdeling {
  /** `JJJJ-MM-DD`, lokale tijd. */
  readonly datum: string;
  readonly letters: readonly string[];
  /** Per kwartier: het uur (lokaal, 9.25 is kwart over negen) en per letter de W. */
  readonly punten: readonly (readonly number[])[];
}

/**
 * Wat één meter mat op de laatste hele dag, verdeeld over zijn vlakken naar
 * wat elk vlak bij heldere lucht zou leveren. Null zonder zo'n dag.
 */
export function verdeelDag(rows: readonly PowerRow[], vlakken: readonly DakVlak[], location: Location, timeZone: string, nuMs: number): Verdeling | null {
  if (!vlakken.length) return null;
  const dagVan = (ms: number) => {
    const d = partsIn(ms, timeZone);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  };
  const vandaag = dagVan(nuMs);
  const dagen = [...new Set(rows.map((r) => dagVan(r.startMs)))].filter((d) => d < vandaag).sort();
  const datum = dagen.at(-1);
  if (!datum) return null;
  const opDag = rows.filter((r) => dagVan(r.startMs) === datum && Number.isFinite(r.meanW));
  const model = vlakken.map((v) => modelVan([v], [{ azimuthDeg: v.azimuthDeg, tiltDeg: v.tiltDeg }]));
  const gewicht = vlakken.map((v) => piekVan(v));
  const kwartieren = new Map<number, { som: number[]; n: number }>();
  for (const r of opDag) {
    const t = r.startMs + 150_000;
    const sun = sunPosition(t, location.latDeg, location.lonDeg);
    const helder = model.map((m, i) => m(sun) * gewicht[i]!);
    const totaal = helder.reduce((s, x) => s + x, 0);
    const delen = totaal > 0 ? helder.map((x) => x / totaal) : vlakken.map(() => 1 / vlakken.length);
    const d = partsIn(r.startMs, timeZone);
    const q = d.h * 4 + Math.floor(d.mi / 15);
    const k = kwartieren.get(q) ?? { som: vlakken.map(() => 0), n: 0 };
    delen.forEach((x, i) => (k.som[i]! += Math.max(0, r.meanW) * x));
    k.n += 1;
    kwartieren.set(q, k);
  }
  const punten = [...kwartieren]
    .sort((a, b) => a[0] - b[0])
    .map(([q, k]) => [q / 4, ...k.som.map((s) => Math.round(s / k.n))])
    .filter((p) => p.slice(1).some((w) => w > 15));
  return punten.length ? { datum, letters: vlakken.map((v) => v.letter), punten } : null;
}

/**
 * De daken met de meting erin (gemeten volgt vanzelf): een vlak dat gemeten
 * of geschat is, neemt de richting en de helling van de meting over; wat de
 * bewoner zelf instelde, blijft staan (daar staat de meting als voorstel bij).
 */
export function metMeting(d: Daken, gemeten: Readonly<Record<string, VlakStand>>): Daken {
  if (!Object.keys(gemeten).length) return d;
  return {
    ...d,
    vlakken: d.vlakken.map((v) => {
      const m = gemeten[v.letter];
      return m && v.bron !== 'bewoner' ? { ...v, azimuthDeg: m.azimuthDeg, tiltDeg: m.tiltDeg, bron: 'gemeten' as const } : v;
    }),
  };
}
