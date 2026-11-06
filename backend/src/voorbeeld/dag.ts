/*
 * De dag van het voorbeeldhuis (besluit 237): wat het huis op elk moment van
 * een zomer- of winterdag doet, als getallen. Hetzelfde verloop als de schets
 * `design/app2/voorbeeldhuis.js`; het nagemaakte Home Assistant (nep-ha.ts)
 * maakt er de standen van de apparaten van, en de regeling van SunArc rekent
 * daar gewoon op.
 */

export type Seizoen = 'zomer' | 'winter';

/** Het weer in het voorbeeld (besluit 243). */
export type Weer = 'zon' | 'bewolkt' | 'regen' | 'sneeuw';
/** Wat de bezoeker kiest: een vast weer, of vanzelf het verloop van de dag. */
export type WeerKeuze = Weer | 'vanzelf';
export const WEER_KEUZES: readonly WeerKeuze[] = ['vanzelf', 'zon', 'bewolkt', 'regen', 'sneeuw'];

/** Waar de klok van het voorbeeld staat: een minuut van de dag, in de zomer of de winter, met het weer. */
export interface Klok {
  readonly minuut: number;
  readonly seizoen: Seizoen;
  /** Zonder: vanzelf. */
  readonly weer?: WeerKeuze;
}

/**
 * Het weer op een moment. Vanzelf: in de zomer zon, met 's middags een bui
 * (bewolkt vanaf twee uur, regen van drie tot half vijf); in de winter sneeuw
 * tot elf uur, dan bewolkt, opklaring tot vier uur, en weer bewolkt. Dezelfde
 * tijden staan in frontend/src/voorbeeld.js, voor de balk.
 */
export function weerOp({ minuut: m, seizoen, weer }: Klok): Weer {
  if (weer != null && weer !== 'vanzelf') return weer;
  if (seizoen === 'zomer') return m >= 900 && m < 990 ? 'regen' : m >= 840 && m < 1050 ? 'bewolkt' : 'zon';
  return m < 660 ? 'sneeuw' : m < 750 ? 'bewolkt' : m < 960 ? 'zon' : 'bewolkt';
}

/** Hoeveel van de zon de panelen halen bij dit weer; sneeuw ligt erop. */
const OP_PANELEN: Readonly<Record<Weer, number>> = { zon: 1, bewolkt: 0.35, regen: 0.12, sneeuw: 0.03 };

/** Zonsopkomst en -ondergang in minuten, op 15 juli en 13 januari. */
export const ZON: Readonly<Record<Seizoen, readonly [number, number]>> = { zomer: [334, 1312], winter: [522, 1012] };

/** De dag van het voorbeeld in het jaar van `nuMs`: 15 juli of 13 januari, om middernacht in Amsterdam. */
export function dagBegin(seizoen: Seizoen, nuMs: number): number {
  const jaar = new Date(nuMs).getUTCFullYear();
  // Zomertijd in juli (UTC+2), wintertijd in januari (UTC+1).
  return seizoen === 'zomer' ? Date.UTC(jaar, 6, 15) - 2 * 3_600_000 : Date.UTC(jaar, 0, 13) - 3_600_000;
}

/** Het voorbeeld op één moment. */
export interface Moment {
  /** De zon boven de horizon: 0 bij opkomst, 1 bij ondergang; 0 in de nacht. */
  readonly zonStand: number;
  readonly zonHoogte: number;
  /** Wat de panelen leveren, in watt. */
  readonly zonW: number;
  readonly buitenC: number;
  readonly weer: Weer;
  readonly licht: boolean;
  readonly avond: boolean;
  /** De droger draait (op zon). */
  readonly droger: boolean;
  /** De airco in de woonkamer koelt. */
  readonly koelt: boolean;
  /** De warmtepomp verwarmt. */
  readonly verwarmt: boolean;
  readonly autoLaadt: boolean;
  readonly autoPct: number;
  /** De auto is weg: 's avonds van half zeven tot negen (de pagina Auto, onderweg). */
  readonly autoWeg: boolean;
  readonly batterijPct: number;
  /** Positief is laden, negatief is het huis voeden. */
  readonly batterijW: number;
  readonly lampen: boolean;
  readonly screensDicht: boolean;
  /** Wat het huis zelf gebruikt, zonder auto en batterij. */
  readonly huisW: number;
  readonly temp: Readonly<Record<'woonkamer' | 'keuken' | 'badkamer' | 'slaapkamer' | 'kinderkamer' | 'zolder', number>>;
}

/** De laadgrens van de auto in het voorbeeldhuis. */
export const AUTO_GRENS = 90;

const rond = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Het voorbeeldhuis op minuut `m` van de dag, in seizoen `s`, bij het weer van dat moment. */
export function moment(klok: Klok): Moment {
  const { minuut: m, seizoen: s } = klok;
  const [op, onder] = ZON[s];
  const winter = s === 'winter';
  const weer = weerOp(klok);
  const licht = m > op && m < onder;
  const zonStand = licht ? (m - op) / (onder - op) : 0;
  const zonHoogte = licht ? Math.sin(Math.PI * zonStand) * (winter ? 0.45 : 0.95) : 0;
  const zonW = licht ? Math.round(zonHoogte * (winter ? 1600 : 4400) * OP_PANELEN[weer]) : 0;
  const avond = !licht || m > onder - 120;
  // De droger start op zon om half twaalf; regent het dan, dan wacht hij.
  const drogerStart = weerOp({ ...klok, minuut: 690 });
  const droger = !winter && m >= 690 && m < 860 && (drogerStart === 'zon' || drogerStart === 'bewolkt');
  // Koelen en laden op zon alleen als er echt zon is.
  const koelt = !winter && licht && m > 660 && m < 1020 && zonW > 1500;
  const verwarmt = winter && m > 360 && m < 1350;
  // Laden op zon tot de laadgrens van 90%, rond vier uur.
  const autoPct = winter ? 55 : Math.round(Math.min(AUTO_GRENS, 40 + Math.max(0, Math.min(m, 990) - 660) / 6));
  const autoLaadt = !winter && licht && m > 660 && m < 990 && zonW > 1500 && autoPct < AUTO_GRENS;
  const autoWeg = m >= 1110 && m < 1260;
  const huisW = 260 + (droger ? 700 : 0) + (koelt ? 900 : 0) + (verwarmt ? (zonW > 800 ? 1400 : 1100) : 0) + (avond && m < 1380 ? 350 : 0);
  const over = zonW - huisW - (autoLaadt ? 1400 : 0);
  const batterijPct = Math.round(Math.max(18, Math.min(96, winter ? 40 + zonW / 100 : 30 + (Math.min(m, 1020) - 540) / 7)));
  const batterijW = over > 300 && batterijPct < 96 ? Math.min(2000, over - 100) : avond && batterijPct > 20 ? -Math.min(huisW, 1200) : 0;
  // Buiten: het koelst vlak voor zonsopkomst, het warmst rond vier uur.
  const dagGang = Math.cos(((m - 960) / 1440) * 2 * Math.PI);
  // Een bui koelt de zomer af; bij sneeuw vriest het net.
  const afkoeling = weer === 'regen' ? (winter ? 0 : 5) : weer === 'bewolkt' ? (winter ? 0 : 2) : weer === 'sneeuw' ? 2.5 : 0;
  const buitenC = rond((winter ? 1 + 3 * dagGang : 20 + 6 * dagGang) - afkoeling);
  const binnen = (basis: number, zon: number) => rond(basis + zon * zonHoogte);
  const temp = winter
    ? { woonkamer: verwarmt ? 20.8 : 19.4, keuken: 20.4, badkamer: 21.5, slaapkamer: 18.1, kinderkamer: 18.6, zolder: binnen(16.6, 1.4) }
    : { woonkamer: koelt ? 23.6 : binnen(23.2, 1.4), keuken: binnen(22.8, 0.8), badkamer: 23.5, slaapkamer: binnen(22.0, 1.2), kinderkamer: binnen(22.3, 1.2), zolder: binnen(23.4, 3) };
  return {
    zonStand,
    zonHoogte,
    zonW,
    buitenC,
    weer,
    licht,
    avond,
    droger,
    koelt,
    verwarmt,
    autoLaadt,
    autoPct,
    autoWeg,
    batterijPct,
    batterijW: Math.round(batterijW),
    // Bij regen of sneeuw is het binnen grauw: de lampen gaan eerder aan.
    lampen: avond || (winter && m < 600) || (licht && (weer === 'regen' || weer === 'sneeuw') && m > 420 && m < 1380),
    // Een regensensor: bij een bui gaan de screens omhoog.
    screensDicht: weer !== 'regen' && (avond || (!winter && weer === 'zon' && m > 780 && m < 1020)),
    huisW,
    temp,
  };
}

/**
 * Wat de panelen op een willekeurige dag van het jaar per uur leveren, voor de
 * meterstanden van Opbrengst: tussen de winter- en de zomerdag in, naar de
 * stand van de zon in het jaar, met een paar bewolkte dagen.
 */
export function uurOpWelkeDag(dagVanJaar: number, uur: number): { zonWh: number; verbruikWh: number } {
  const zomer = (1 - Math.cos(((dagVanJaar - 15) / 365) * 2 * Math.PI)) / 2;
  const bewolkt = 0.45 + 0.55 * Math.abs(Math.sin(dagVanJaar * 12.9898) * 43758.5453 % 1);
  // Zon als basis: de bewolking per dag komt hieronder, los van het weer van het voorbeeld.
  const z = moment({ minuut: uur * 60 + 30, seizoen: 'zomer', weer: 'zon' });
  const w = moment({ minuut: uur * 60 + 30, seizoen: 'winter', weer: 'zon' });
  const zonWh = Math.round((w.zonW + (z.zonW - w.zonW) * zomer) * bewolkt);
  const verbruikWh = Math.round(w.huisW + (z.huisW - w.huisW) * zomer);
  return { zonWh, verbruikWh };
}
