import { describe, expect, it } from 'vitest';
import { Laadbeurten, beurtenUit, prijsOp } from '../src/web/laadbeurten.js';
import type { SiteConfig } from '../src/core/model.js';
import type { Tarieven } from '../src/web/tarief.js';

const VAK = 5 * 60_000;
const t0 = Date.parse('2026-11-04T10:00:00Z');
/** Een reeks vakken van vijf minuten met hetzelfde vermogen. */
const vakken = (van: number, n: number, w: number) => Array.from({ length: n }, (_, i) => ({ startMs: van + i * VAK, meanW: w }));

describe('de laadbeurten (besluit 259, stap 3)', () => {
  it('maakt een beurt van laden tot stoppen, met eigen zon en kosten', () => {
    // Twee uur 3,6 kW: 7,2 kWh. Het eerste uur levert het huis 1 kW terug (alles zon), het tweede neemt het 1,2 kW af.
    const auto = vakken(t0, 24, 3600);
    const net = [...vakken(t0, 12, -1000), ...vakken(t0 + 12 * VAK, 12, 1200)];
    const uit = beurtenUit(auto, net, () => 0.25, t0 + 5 * 3_600_000);
    expect(uit.beurten).toHaveLength(1);
    const b = uit.beurten[0]!;
    expect(b).toMatchObject({ van: '2026-11-04T10:00:00.000Z', tot: '2026-11-04T12:00:00.000Z', bezig: false, kWh: 7.2 });
    // Zon: 3,6 kWh in het eerste uur en 2,4 kWh in het tweede; van het net 1,2 kWh × € 0,25.
    expect(b.zonKWh).toBe(6);
    expect(b.kosten).toBe(0.3);
    expect(uit).toMatchObject({ kWh: 7.2, zonKWh: 6, kosten: 0.3, statistiek: true });
  });

  it('houdt een korte pauze bij dezelfde beurt en begint na een lange een nieuwe', () => {
    const auto = [...vakken(t0, 6, 2000), ...vakken(t0 + 6 * VAK + 40 * 60_000, 6, 2000), ...vakken(t0 + 6 * 3_600_000, 6, 7000)];
    const uit = beurtenUit(auto, null, null, t0 + 6 * 3_600_000 + 35 * 60_000);
    expect(uit.beurten.map((b) => b.kWh)).toEqual([3.5, 2]);
    // De nieuwste eerst, en die loopt nog.
    expect(uit.beurten[0]!.bezig).toBe(true);
    expect(uit.beurten[1]!.bezig).toBe(false);
    // Zonder netmeter geen zon en geen bedrag.
    expect(uit).toMatchObject({ zonKWh: null, kosten: null });
  });

  it('telt een paar watt en een te korte beurt niet', () => {
    const auto = [...vakken(t0, 50, 8), ...vakken(t0 + 5 * 3_600_000, 1, 2000)];
    const uit = beurtenUit(auto, [], () => 0.25, t0 + 8 * 3_600_000);
    expect(uit.beurten).toEqual([]);
    expect(uit.kWh).toBe(0);
  });

  it('rekent met het daltarief, en met de prijs van elk uur als die er is', () => {
    const vast: Tarieven = { stroom: 0.3, stroomDal: 0.2, dalUren: 'nl', teruglevering: null, gas: null, vastPerMaand: null };
    const p = prijsOp(vast, 'Europe/Amsterdam', null);
    // Woensdag 4 november: 11:00 is normaal, 02:00 is dal.
    expect(p(Date.parse('2026-11-04T10:00:00Z'))).toBe(0.3);
    expect(p(Date.parse('2026-11-04T01:00:00Z'))).toBe(0.2);
    const uur = new Map([[Date.parse('2026-11-04T10:00:00Z'), 0.11]]);
    const dyn = prijsOp({ ...vast, stroom: null, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: [], terug: [] } }, 'Europe/Amsterdam', uur);
    expect(dyn(Date.parse('2026-11-04T10:25:00Z'))).toBe(0.11);
    // Een uur zonder prijs bij een dynamisch contract: geen bedrag, geen gok.
    expect(dyn(Date.parse('2026-11-04T11:25:00Z'))).toBeNull();
    expect(prijsOp(null, 'Europe/Amsterdam', null)(t0)).toBeNull();
  });

  it('vraagt Home Assistant de week per vijf minuten, met de prijs per uur in €/MWh', async () => {
    const vragen: Record<string, unknown>[] = [];
    const nu = t0 + 3 * 3_600_000;
    const config = { timezone: 'Europe/Amsterdam', power: { gridPower: { id: 'sensor.p1_afname' }, gridExport: { id: 'sensor.p1_terug' } } } as unknown as SiteConfig;
    const lb = new Laadbeurten({
      config: () => config,
      meter: (a) => (a === 'tesla' ? 'sensor.easee_power' : null),
      prijzen: () => ({ stroom: null, teruglevering: null, gas: null, vastPerMaand: null, dynamisch: { prijsEntiteit: 'sensor.prijs', afname: [], terug: [] } }),
      eenheid: () => '€/MWh',
      vraag: async (_type, velden) => {
        vragen.push(velden);
        const ids = velden['statistic_ids'] as string[];
        if (ids[0] === 'sensor.prijs') return { 'sensor.prijs': [{ start: t0, mean: 120 }] };
        return {
          'sensor.easee_power': vakken(t0, 12, 4000).map((r) => ({ start: r.startMs, mean: r.meanW })),
          'sensor.p1_afname': vakken(t0, 12, 2000).map((r) => ({ start: r.startMs, mean: r.meanW })),
          'sensor.p1_terug': vakken(t0, 12, 0).map((r) => ({ start: new Date(r.startMs).toISOString(), mean: r.meanW })),
        };
      },
      nu: () => nu,
    });
    expect(await lb.van('kia')).toBeNull();
    const uit = (await lb.van('tesla'))!;
    expect(vragen[0]).toMatchObject({ statistic_ids: ['sensor.easee_power', 'sensor.p1_afname', 'sensor.p1_terug'], period: '5minute', types: ['mean'] });
    expect(Date.parse(vragen[0]!['start_time'] as string)).toBe(nu - 7 * 86_400_000);
    // 4 kWh, waarvan 2 van het net × € 0,12.
    expect(uit).toMatchObject({ kWh: 4, zonKWh: 2, kosten: 0.24, perUur: true });
    // Vijf minuten bewaard: geen nieuwe vraag.
    await lb.van('tesla');
    expect(vragen).toHaveLength(2);
  });
});
