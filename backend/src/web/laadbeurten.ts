/**
 * De laadbeurten van een auto (besluit 259, stap 3): uit de statistiek van
 * Home Assistant per vijf minuten wat de auto nam en wat het net deed. Alleen
 * lezen, met dezelfde vraag als Opbrengst en het sluipverbruik.
 *
 * - Een beurt is van laden tot stoppen: vakken waarin de auto laadt, met
 *   hooguit een uur pauze ertussen (een wolk, of de laadpaal die wacht).
 * - Eigen zon is wat de auto nam zonder dat het net het leverde: het deel van
 *   het laadvermogen boven wat er van het net kwam. Levert het huis terug,
 *   dan is alles zon; neemt het huis meer van het net dan de auto, dan niets.
 * - Kosten zijn het deel van het net × de prijs van dat moment: de prijs van
 *   elk uur bij een prijs per uur, anders het normaal- of daltarief. Eigen zon
 *   telt als gratis. Zonder prijs of zonder netmeter geen bedrag (besluit 88).
 *
 * Home Assistant bewaart de vakken van vijf minuten tien dagen; de week past
 * daarin.
 */

import type { DeviceRef, MeasurementPoint, SiteConfig } from '../core/model.js';
import { isDal, type Tarieven } from './tarief.js';
import type { PowerRow } from './today.js';
import { somPerVak } from './historie.js';

/** Zo ver terug: de laatste zeven dagen. */
export const BEURT_DAGEN = 7;
const VAK_MS = 5 * 60_000;
/** Onder dit vermogen laadt de auto niet; een paar watt is de laadpaal zelf. */
const LAADT_W = 150;
/** Een pauze van hooguit zo lang hoort nog bij dezelfde beurt. */
const PAUZE_MS = 60 * 60_000;
/** Een beurt van minder dan dit telt niet: een korte test of een opwarmrondje van de auto. */
const MIN_KWH = 0.2;
/** Zo lang bewaard per auto. */
const BEWAAR_MS = 5 * 60_000;

export interface Laadbeurt {
  /** Begin en eind (ISO), het eind van het laatste vak. */
  readonly van: string;
  readonly tot: string;
  /** Of hij nog loopt: het laatste vak is van de laatste twintig minuten. */
  readonly bezig: boolean;
  readonly kWh: number;
  /** Het deel van de eigen zon; null zonder netmeter. */
  readonly zonKWh: number | null;
  /** Wat het net kostte in euro; null zonder prijs of netmeter. */
  readonly kosten: number | null;
}

export interface LaadOverzicht {
  readonly dagen: number;
  /** De nieuwste eerst. */
  readonly beurten: readonly Laadbeurt[];
  readonly kWh: number;
  readonly zonKWh: number | null;
  readonly kosten: number | null;
  /** Of de kosten met de prijs van elk uur zijn, zoals bij een dynamisch contract. */
  readonly perUur: boolean;
  /** Of Home Assistant een statistiek van het laadvermogen heeft; zonder kan er niets in de lijst. */
  readonly statistiek: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * De prijs per kWh van het net op een moment: van dat uur bij een prijs per
 * uur, anders het normaal- of daltarief; null als er niets bekend is.
 */
export function prijsOp(p: Tarieven | null, timeZone: string, perUur: ReadonlyMap<number, number> | null): (ms: number) => number | null {
  return (ms) => {
    if (perUur?.size) {
      const v = perUur.get(Math.floor(ms / 3_600_000) * 3_600_000);
      if (v != null) return v;
      if (p?.dynamisch) return null;
    }
    if (p?.stroom == null) return null;
    if (p.stroomDal != null && isDal(ms, timeZone, p.dalUren ?? 'nl', p.dalEigen ?? null)) return p.stroomDal;
    return p.stroom;
  };
}

/** De beurten uit het laadvermogen en het net per vijf minuten (`net` positief is afname). */
export function beurtenUit(auto: readonly PowerRow[], net: readonly PowerRow[] | null, prijs: ((ms: number) => number | null) | null, nuMs: number, perUur = false): LaadOverzicht {
  const netVan = net ? new Map(net.map((r) => [r.startMs, r.meanW])) : null;
  type Open = { van: number; tot: number; kWh: number; zon: number; kosten: number; zonder: boolean; zonderPrijs: boolean };
  const open: Open[] = [];
  for (const r of [...auto].sort((a, b) => a.startMs - b.startMs)) {
    if (!(r.meanW >= LAADT_W)) continue;
    const kWh = (r.meanW / 1000) * (VAK_MS / 3_600_000);
    const netW = netVan?.get(r.startMs);
    // Zonder meting van het net in dit vak: alles van het net, dan klopt het bedrag niet te laag.
    const zonW = netW == null ? 0 : Math.max(0, Math.min(r.meanW, r.meanW - netW));
    const zon = (zonW / 1000) * (VAK_MS / 3_600_000);
    const p = prijs?.(r.startMs) ?? null;
    const laatste = open[open.length - 1];
    const b = laatste && r.startMs - laatste.tot <= PAUZE_MS ? laatste : null;
    const doel = b ?? { van: r.startMs, tot: r.startMs, kWh: 0, zon: 0, kosten: 0, zonder: false, zonderPrijs: false };
    if (!b) open.push(doel);
    doel.tot = r.startMs + VAK_MS;
    doel.kWh += kWh;
    doel.zon += zon;
    if (p == null) doel.zonderPrijs = true;
    else doel.kosten += (kWh - zon) * p;
    if (netW == null) doel.zonder = true;
  }
  const beurten: Laadbeurt[] = open
    .filter((b) => b.kWh >= MIN_KWH)
    .map((b) => ({
      van: new Date(b.van).toISOString(),
      tot: new Date(b.tot).toISOString(),
      bezig: nuMs - b.tot < 20 * 60_000,
      kWh: r1(b.kWh),
      zonKWh: netVan ? r1(b.zon) : null,
      kosten: netVan && prijs && !b.zonderPrijs ? r2(b.kosten) : null,
    }))
    .reverse();
  const som = (f: (b: Laadbeurt) => number | null) => (beurten.some((b) => f(b) == null) ? null : beurten.reduce((s, b) => s + (f(b) ?? 0), 0));
  const zonKWh = som((b) => b.zonKWh);
  const kosten = som((b) => b.kosten);
  return {
    dagen: BEURT_DAGEN,
    beurten,
    kWh: r1(beurten.reduce((s, b) => s + b.kWh, 0)),
    zonKWh: zonKWh == null ? null : r1(zonKWh),
    kosten: kosten == null ? null : r2(kosten),
    perUur,
    statistiek: auto.length > 0,
  };
}

type Statistiek = Record<string, { start: number | string; mean?: number | null }[]>;

export interface LaadbeurtenOpties {
  readonly config: () => SiteConfig | null;
  /** De sensor met het laadvermogen van een auto, of null. */
  readonly meter: (auto: string) => string | null;
  readonly prijzen: () => Tarieven | null;
  /** De eenheid van een entiteit, voor een prijs in €/MWh. */
  readonly eenheid?: (id: string) => string | null;
  /** Een vraag aan Home Assistant: hier `recorder/statistics_during_period`. */
  readonly vraag: (type: string, velden: Record<string, unknown>) => Promise<Statistiek | null>;
  readonly nu?: () => number;
}

const reeks = (raw: Statistiek | null, id: string | null): PowerRow[] =>
  id == null
    ? []
    : (raw?.[id] ?? [])
        .filter((r) => typeof r.mean === 'number' && Number.isFinite(r.mean))
        .map((r) => ({ startMs: typeof r.start === 'number' ? r.start : Date.parse(r.start), meanW: r.mean as number }));

export class Laadbeurten {
  readonly #o: LaadbeurtenOpties;
  readonly #bewaard = new Map<string, { at: number; uit: LaadOverzicht }>();

  constructor(o: LaadbeurtenOpties) {
    this.#o = o;
  }

  /** De beurten van de laatste week van een auto; null zonder meter van het laadvermogen. */
  async van(auto: string): Promise<LaadOverzicht | null> {
    const config = this.#o.config();
    const meter = this.#o.meter(auto);
    if (!config || !meter) return null;
    const nu = (this.#o.nu ?? Date.now)();
    const b = this.#bewaard.get(auto);
    if (b && nu - b.at < BEWAAR_MS) return b.uit;
    const punt = (p: MeasurementPoint | DeviceRef | undefined) => (p && !('attribute' in p && p.attribute) ? p.id : null);
    const netId = punt(config.power.gridPower);
    const terugId = netId ? punt(config.power.gridExport) : null;
    const van = new Date(nu - BEURT_DAGEN * 86_400_000).toISOString();
    const tot = new Date(nu).toISOString();
    const raw = await this.#o.vraag('recorder/statistics_during_period', {
      start_time: van,
      end_time: tot,
      statistic_ids: [meter, netId, terugId].filter((x): x is string => x != null),
      period: '5minute',
      types: ['mean'],
      units: { power: 'W' },
    });
    if (raw == null) return null;
    const net = netId ? (terugId ? somPerVak([reeks(raw, netId), reeks(raw, terugId)], [1, -1], true) : reeks(raw, netId)) : null;
    // Een prijs per uur (dynamisch contract): het gemiddelde van de prijs-entiteit per uur.
    const p = this.#o.prijzen();
    const prijsId = p?.dynamisch?.prijsEntiteit ?? null;
    let perUur: Map<number, number> | null = null;
    if (prijsId) {
      const prijs = await this.#o.vraag('recorder/statistics_during_period', { start_time: van, end_time: tot, statistic_ids: [prijsId], period: 'hour', types: ['mean'] }).catch(() => null);
      const deel = /mwh/i.test(this.#o.eenheid?.(prijsId) ?? '') ? 1000 : 1;
      perUur = new Map(reeks(prijs, prijsId).map((r) => [r.startMs, r.meanW / deel]));
    }
    const heeftPrijs = (perUur?.size ?? 0) > 0 || p?.stroom != null;
    const uit = beurtenUit(reeks(raw, meter), net, heeftPrijs ? prijsOp(p, config.timezone, perUur) : null, nu, (perUur?.size ?? 0) > 0);
    this.#bewaard.set(auto, { at: nu, uit });
    return uit;
  }
}
