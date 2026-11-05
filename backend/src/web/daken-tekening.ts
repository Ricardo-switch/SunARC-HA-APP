/*
 * Het huis van boven (besluit 254, stap 2a): de gebouwen met hun omtrek, de
 * dakvlakken uit de dakvorm, en op welk dakvlak elk vlak met panelen ligt.
 *
 * Alles in meters vanaf de plek van het huis in Home Assistant, x naar het
 * oosten en y naar het noorden. De dakvlakken volgen uit de kleinste
 * rechthoek om de omtrek: een zadeldak heeft er twee, een schilddak vier, een
 * lessenaar en een plat dak één. Zonder kaart staat het hoofdhuis als blok in
 * de richting van de voorgevel, en krijgen een uitbouw, garage, carport,
 * tuinhuis of rek op de grond een blok op een gangbare plek.
 *
 * De tekening verandert niets aan de berekening: die rekent met de richting
 * en de helling van elk vlak (daken.ts).
 */
import type { DakPlek, DakVlak, Daken, Dakvorm, Gebouw, GebouwSoort, Xy } from './daken.js';

const RAD = Math.PI / 180;
const norm = (deg: number) => ((deg % 360) + 360) % 360;
const hoekVerschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
/** Het verschil tussen twee assen, op 180° na. */
const asVerschil = (a: number, b: number) => Math.min(hoekVerschil(a, b), hoekVerschil(a, b + 180));
const richting = (deg: number): Xy => [Math.sin(deg * RAD), Math.cos(deg * RAD)];
const rond = (n: number) => Math.round(n * 100) / 100;

export interface Rechthoek {
  readonly midden: Xy;
  /** De lange as, 0 tot 180°. */
  readonly asDeg: number;
  readonly lengte: number;
  readonly breedte: number;
}

/** De kleinste rechthoek om de omtrek, per graad gezocht. */
export function rechthoekOm(omtrek: readonly Xy[]): Rechthoek {
  let beste: { a: number; opp: number; s: [number, number]; t: [number, number] } | null = null;
  for (let a = 0; a < 180; a++) {
    const u = richting(a);
    const p = richting(a + 90);
    let s0 = Infinity;
    let s1 = -Infinity;
    let t0 = Infinity;
    let t1 = -Infinity;
    for (const [x, y] of omtrek) {
      const s = x * u[0] + y * u[1];
      const t = x * p[0] + y * p[1];
      s0 = Math.min(s0, s);
      s1 = Math.max(s1, s);
      t0 = Math.min(t0, t);
      t1 = Math.max(t1, t);
    }
    const opp = (s1 - s0) * (t1 - t0);
    if (beste == null || opp < beste.opp - 1e-6) beste = { a, opp, s: [s0, s1], t: [t0, t1] };
  }
  const b = beste!;
  const u = richting(b.a);
  const p = richting(b.a + 90);
  const sm = (b.s[0] + b.s[1]) / 2;
  const tm = (b.t[0] + b.t[1]) / 2;
  const midden: Xy = [u[0] * sm + p[0] * tm, u[1] * sm + p[1] * tm];
  const l = b.s[1] - b.s[0];
  const w = b.t[1] - b.t[0];
  return l >= w ? { midden, asDeg: b.a, lengte: l, breedte: w } : { midden, asDeg: (b.a + 90) % 180, lengte: w, breedte: l };
}

export interface Dakvlakje {
  /** Waar het dakvlak naartoe kijkt, of null bij een plat dak. */
  readonly kant: number | null;
  readonly punten: readonly Xy[];
}

export interface GebouwVanBoven {
  readonly dakvlakken: readonly Dakvlakje[];
  /** De nok als lijn, of null. */
  readonly nok: readonly [Xy, Xy] | null;
  /** De nok (of bij een lessenaar de kant) zoals hij op de rechthoek valt. */
  readonly nokDeg: number;
}

/** De dakvlakken van een gebouw uit zijn dakvorm, op de rechthoek om de omtrek. */
export function vanBoven(g: Pick<Gebouw, 'omtrek' | 'dakvorm' | 'nokDeg'>): GebouwVanBoven {
  const r = rechthoekOm(g.omtrek);
  const pt = (o: Xy, a: number, as: Xy, b: number, dw: Xy): Xy => [rond(o[0] + a * as[0] + b * dw[0]), rond(o[1] + a * as[1] + b * dw[1])];
  const c = r.midden;
  if (g.dakvorm === 'plat' || g.dakvorm === 'lessenaar') {
    const u = richting(r.asDeg);
    const p = richting(r.asDeg + 90);
    const l = r.lengte / 2;
    const w = r.breedte / 2;
    const punten = [pt(c, -l, u, -w, p), pt(c, l, u, -w, p), pt(c, l, u, w, p), pt(c, -l, u, w, p)];
    if (g.dakvorm === 'plat') return { dakvlakken: [{ kant: null, punten }], nok: null, nokDeg: norm(g.nokDeg) };
    // Een lessenaar kijkt naar een van de vier kanten van de rechthoek.
    const kant = [r.asDeg, r.asDeg + 90, r.asDeg + 180, r.asDeg + 270].map(norm).sort((a, b) => hoekVerschil(a, g.nokDeg) - hoekVerschil(b, g.nokDeg))[0]!;
    return { dakvlakken: [{ kant, punten }], nok: null, nokDeg: kant };
  }
  // Zadel- en schilddak: de nok langs de as van de rechthoek die het dichtst bij de gekozen nok ligt.
  const langs = asVerschil(g.nokDeg, r.asDeg) <= asVerschil(g.nokDeg, r.asDeg + 90);
  const n = langs ? r.asDeg : (r.asDeg + 90) % 180;
  const N = richting(n);
  const P = richting(n + 90);
  const l = (langs ? r.lengte : r.breedte) / 2;
  const w = (langs ? r.breedte : r.lengte) / 2;
  const p = (a: number, b: number) => pt(c, a, N, b, P);
  if (g.dakvorm === 'zadel') {
    return {
      dakvlakken: [
        { kant: norm(n + 90), punten: [p(-l, 0), p(l, 0), p(l, w), p(-l, w)] },
        { kant: norm(n + 270), punten: [p(-l, 0), p(l, 0), p(l, -w), p(-l, -w)] },
      ],
      nok: [p(-l, 0), p(l, 0)],
      nokDeg: n,
    };
  }
  const k = Math.max(0, l - w);
  return {
    dakvlakken: [
      { kant: norm(n + 90), punten: [p(-k, 0), p(k, 0), p(l, w), p(-l, w)] },
      { kant: norm(n + 270), punten: [p(-k, 0), p(k, 0), p(l, -w), p(-l, -w)] },
      { kant: norm(n), punten: [p(k, 0), p(l, w), p(l, -w)] },
      { kant: norm(n + 180), punten: [p(-k, 0), p(-l, w), p(-l, -w)] },
    ],
    nok: [p(-k, 0), p(k, 0)],
    nokDeg: n,
  };
}

/* ------------------------------------------------------------ gebouwen neerzetten */

/** Op welk soort gebouw een vlak met deze plek ligt; aan de gevel tekent hij nog niet. */
export const SOORT_VAN_PLEK: Readonly<Record<DakPlek, GebouwSoort | null>> = {
  hoofddak: 'hoofdhuis',
  dwarskap: 'hoofdhuis',
  uitbouw: 'uitbouw',
  garage: 'garage',
  carport: 'carport',
  tuinhuis: 'tuinhuis',
  grond: 'grond',
  gevel: null,
};

/**
 * Waar een blok staat zonder kaart, ten opzichte van het hoofdhuis: van links
 * naar rechts gezien vanaf de straat (u) en van de voorgevel naar achteren (v),
 * in meters vanaf de rand van het huis.
 */
const PLEK_BLOK: Partial<Record<GebouwSoort, (hw: number, voor: number, achter: number) => [number, number, number, number]>> = {
  uitbouw: (_hw, _v, a) => [-3, 3, a, a + 4],
  garage: (hw, v) => [hw + 0.6, hw + 3.8, -v, -v + 6],
  carport: (hw, v) => [-hw - 3.8, -hw - 0.6, -v, -v + 5.5],
  tuinhuis: (hw, _v, a) => [hw - 3.5, hw - 0.5, a + 9, a + 12],
  grond: (hw, _v, a) => [-hw + 0.5, -hw + 6.5, a + 6, a + 8],
};

/** Een voorstel voor de dakvorm, uit het soort gebouw en de vlakken die erop liggen. */
export function dakvormVoorstel(soort: GebouwSoort, vlakken: readonly DakVlak[], voorgevelDeg: number): { dakvorm: Dakvorm; nokDeg: number } {
  const schuin = vlakken.filter((v) => v.opstelling === 'schuin');
  if (soort === 'hoofdhuis' || soort === 'tuinhuis') {
    // Een schuin vlak: de nok loopt haaks op waar het naartoe kijkt.
    if (schuin.length) return { dakvorm: 'zadel', nokDeg: norm(schuin[0]!.azimuthDeg + 90) % 180 };
    if (vlakken.length) return { dakvorm: 'plat', nokDeg: norm(voorgevelDeg + 90) % 180 };
    return { dakvorm: 'zadel', nokDeg: norm(voorgevelDeg + 90) % 180 };
  }
  if (schuin.length) return { dakvorm: 'lessenaar', nokDeg: norm(schuin[0]!.azimuthDeg) };
  return { dakvorm: 'plat', nokDeg: norm(voorgevelDeg + 90) % 180 };
}

/** Een rechthoek als omtrek: van links naar rechts (u) en van voor naar achter (v) in het huis. */
function blok(midden: Xy, voorDeg: number, u0: number, u1: number, v0: number, v1: number): Xy[] {
  // Rechts, gezien vanaf de straat: wie naar het huis kijkt, kijkt tegen de voorgevel in.
  const R = richting(voorDeg - 90);
  const F = richting(voorDeg);
  const pos = (u: number, v: number): Xy => [rond(midden[0] + u * R[0] - v * F[0]), rond(midden[1] + u * R[1] - v * F[1])];
  return [pos(u0, v0), pos(u1, v0), pos(u1, v1), pos(u0, v1)];
}

/**
 * De gebouwen voor de tekening: wat de bewoner bewaarde, en wat nog mist. Zonder
 * hoofdhuis een blok van 10 bij 9 meter met de voorgevel naar de voorkant; voor
 * een vlak op de garage, de uitbouw of elders zonder gebouw een blok ernaast.
 */
export function gebouwenNu(d: Daken): Gebouw[] {
  const voor = d.voorgevelDeg ?? 180;
  const uit: Gebouw[] = [...(d.gebouwen ?? [])];
  const vlakkenOp = (soort: GebouwSoort) => d.vlakken.filter((v) => (v.gebouw ? uit.find((g) => g.id === v.gebouw)?.soort === soort : SOORT_VAN_PLEK[v.plek] === soort));
  if (!uit.some((g) => g.soort === 'hoofdhuis')) {
    uit.unshift({ id: 'huis', soort: 'hoofdhuis', bron: 'schatting', omtrek: blok([0, 0], voor, -5, 5, -4.5, 4.5), ...dakvormVoorstel('hoofdhuis', vlakkenOp('hoofdhuis'), voor) });
  }
  const huis = uit.find((g) => g.soort === 'hoofdhuis')!;
  // De maat van het huis langs de voorgevel en naar achteren, vanuit zijn midden.
  const r = rechthoekOm(huis.omtrek);
  const R = richting(voor - 90);
  const F = richting(voor);
  const langs = (p: Xy, as: Xy) => (p[0] - r.midden[0]) * as[0] + (p[1] - r.midden[1]) * as[1];
  const hw = Math.max(...huis.omtrek.map((p) => Math.abs(langs(p, R))));
  const vv = Math.max(...huis.omtrek.map((p) => langs(p, F)));
  const aa = Math.max(...huis.omtrek.map((p) => -langs(p, F)));
  for (const soort of ['uitbouw', 'garage', 'carport', 'tuinhuis', 'grond'] as const) {
    const op = d.vlakken.filter((v) => !v.gebouw && SOORT_VAN_PLEK[v.plek] === soort);
    if (!op.length || uit.some((g) => g.soort === soort)) continue;
    const [u0, u1, v0, v1] = PLEK_BLOK[soort]!(hw, vv, aa);
    uit.push({ id: soort, soort, bron: 'schatting', omtrek: blok(r.midden, voor, u0, u1, v0, v1), ...dakvormVoorstel(soort, op, voor) });
  }
  return uit;
}

/* ------------------------------------------------------------ vlakken op de tekening */

export interface VlakPlaats {
  readonly gebouw: string | null;
  /** Het dakvlak waar het op ligt: zijn richting, of null bij een plat dak. */
  readonly kant: number | null;
  /** Staat het in de tekening? Niet als geen dakvlak die kant op kijkt. */
  readonly getekend: boolean;
}

/**
 * Op welk dakvlak elk vlak ligt (vanzelf, tik om te wisselen): wat de bewoner
 * aanwees, anders het gebouw bij de plek en het dakvlak dat dezelfde kant op
 * kijkt. Een schuin vlak dat meer dan 60° afwijkt, staat er niet in.
 */
export function plaatsVlakken(vlakken: readonly DakVlak[], gebouwen: readonly Gebouw[]): Record<string, VlakPlaats> {
  const boven = new Map(gebouwen.map((g) => [g.id, vanBoven(g)]));
  const uit: Record<string, VlakPlaats> = {};
  for (const v of vlakken) {
    const aangewezen = v.gebouw ? gebouwen.filter((g) => g.id === v.gebouw) : [];
    const soort = SOORT_VAN_PLEK[v.plek];
    const kandidaten = aangewezen.length ? aangewezen : soort ? gebouwen.filter((g) => g.soort === soort) : [];
    let beste: { g: Gebouw; kant: number | null; af: number } | null = null;
    for (const g of kandidaten) {
      for (const dv of boven.get(g.id)!.dakvlakken) {
        // Aangewezen: het dakvlak dat het dichtst bij de gekozen kant ligt; anders bij de richting van het vlak.
        const doel = aangewezen.length && v.kant !== undefined ? v.kant : v.azimuthDeg;
        const af = dv.kant == null ? (doel == null || v.opstelling !== 'schuin' ? 0 : 90) : doel == null ? 90 : hoekVerschil(dv.kant, doel);
        if (beste == null || af < beste.af) beste = { g, kant: dv.kant, af };
      }
    }
    if (beste == null) uit[v.letter] = { gebouw: null, kant: null, getekend: false };
    else uit[v.letter] = { gebouw: beste.g.id, kant: beste.kant, getekend: aangewezen.length > 0 || v.opstelling !== 'schuin' || beste.af <= 60 };
  }
  return uit;
}

/** Het midden van een omtrek. */
export const middenVan = (omtrek: readonly Xy[]): Xy => [omtrek.reduce((s, p) => s + p[0], 0) / omtrek.length, omtrek.reduce((s, p) => s + p[1], 0) / omtrek.length];

/** Ligt het punt binnen de omtrek? */
export function binnenOmtrek(p: Xy, omtrek: readonly Xy[]): boolean {
  let erin = false;
  for (let i = 0, j = omtrek.length - 1; i < omtrek.length; j = i++) {
    const a = omtrek[i]!;
    const b = omtrek[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) erin = !erin;
  }
  return erin;
}

export interface Tekening {
  readonly gebouwen: readonly (Gebouw & GebouwVanBoven)[];
  /** De gebouwen eromheen die nog niet bij het huis horen. */
  readonly omgeving: readonly (readonly Xy[])[];
  readonly plaats: Readonly<Record<string, VlakPlaats>>;
}

/** Alles wat de pagina nodig heeft om het huis van boven te tekenen. */
export function tekening(d: Daken): Tekening {
  const gebouwen = gebouwenNu(d);
  const omgeving = (d.omgeving ?? []).filter((o) => !gebouwen.some((g) => binnenOmtrek(middenVan(o), g.omtrek)));
  return {
    gebouwen: gebouwen.map((g) => ({ ...g, ...vanBoven(g) })),
    omgeving,
    plaats: plaatsVlakken(d.vlakken, gebouwen),
  };
}
