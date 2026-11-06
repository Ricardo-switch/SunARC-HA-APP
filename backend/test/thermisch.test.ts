/*
 * Hoe je huis warmte vasthoudt (besluit 231): uit een nagemaakt logboek met
 * een bekende kamer haalt het leren dezelfde getallen terug.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { SiteConfig } from '../src/core/model.js';
import { THERMISCH_FILE, ThermischLeer, leerThermisch, type ThermischMoment } from '../src/web/thermisch.js';

const BUITEN = 5;
const K = 0.01;
const ZON_PER_KW = 0.3;
const AIRCO = -0.5;

/**
 * Een kamer volgens Newton, per minuut: 's nachts niets, overdag 2 kW zon,
 * aan het eind van de middag de airco op koelen. 's Ochtends vraagt de Nest om
 * warmte zonder dat er iets gebeurt. De badkamer staat de hele tijd uit op 18.
 */
function logboek(dagen: number): ThermischMoment[] {
  const uit: ThermischMoment[] = [];
  let T = 20;
  const start = Date.UTC(2026, 9, 1);
  for (let m = 0; m < dagen * 24 * 60; m++) {
    const uur = Math.floor(m / 60) % 24;
    const zonKw = uur >= 10 && uur < 15 ? 2 : 0;
    const airco = uur >= 16 && uur < 19;
    const nest = uur === 9;
    uit.push({
      tMs: start + m * 60_000,
      zones: [{ id: 'kamer', temperatureC: Math.round(T * 100) / 100 }],
      observed: { nest: nest ? 'heat@30' : 'off', airco: airco ? 'cool@10' : 'off', badkamer: 'off@18' },
      outdoorC: BUITEN,
      solarW: zonKw * 1000,
    });
    T += (-K * (T - BUITEN) + ZON_PER_KW * zonKw + (airco ? AIRCO : 0)) / 60;
  }
  return uit;
}

const ZONES = [{ id: 'kamer', naam: 'Kamer', apparaten: [{ id: 'nest', naam: 'Nest', verwarmen: true, koelen: false }, { id: 'airco', naam: 'Airco kamer', verwarmen: true, koelen: true }] }];

describe('hoe je huis warmte vasthoudt (besluit 231)', () => {
  const r = leerThermisch(logboek(25), ZONES, Date.UTC(2026, 9, 26));
  const kamer = r.zones[0]!;

  it('leert hoe snel de kamer afkoelt, uit de rustige nachten', () => {
    expect(kamer.k).toBeCloseTo(K, 3);
    expect(kamer.tauUur).toBeGreaterThan(90);
    expect(kamer.tauUur).toBeLessThan(110);
    expect(kamer.zeker.afkoelen).toBe(4);
  });

  it('leert wat de zon doet per kW', () => {
    expect(kamer.zonPerKw).toBeCloseTo(ZON_PER_KW, 1);
    expect(kamer.zeker.zon).toBeGreaterThanOrEqual(2);
  });

  it('leert wat de airco doet, bovenop het afkoelen', () => {
    const koelt = kamer.apparaten.find((a) => a.id === 'airco' && a.stand === 'koelt')!;
    expect(koelt.perUur).toBeCloseTo(AIRCO, 1);
    expect(koelt.zeker).toBeGreaterThanOrEqual(2);
  });

  it('noemt een verwarmer die niets merkbaars doet onduidelijk, en wat nooit gebeurde nog niet gezien', () => {
    const nest = kamer.apparaten.find((a) => a.id === 'nest')!;
    expect(nest.perUur).toBeNull();
    expect(nest.kwartieren).toBeGreaterThanOrEqual(8);
    const aircoWarmt = kamer.apparaten.find((a) => a.id === 'airco' && a.stand === 'verwarmt')!;
    expect(aircoWarmt.kwartieren).toBe(0);
    expect(r.stand).toBe('leert');
  });

  it('heeft zonder logboek niets te zeggen', () => {
    expect(leerThermisch([], ZONES, Date.now()).zones).toEqual([]);
  });
});

/*
 * Rekenen op de achtergrond (6 november 2026): per kwartier optellen tijdens
 * het lezen, de uitkomst bewaren, en een pagina krijgt meteen wat er is.
 */
describe('warmte vasthouden op de achtergrond', () => {
  const CONFIG = {
    timezone: 'Europe/Amsterdam',
    zones: [{ id: 'kamer', name: 'Kamer', actuatorIds: ['nest', 'airco'] }],
    actuators: [
      { id: 'nest', name: 'Nest', capabilities: { canHeat: true, canCool: false } },
      { id: 'airco', name: 'Airco kamer', capabilities: { canHeat: true, canCool: true } },
    ],
  } as unknown as SiteConfig;

  /** Het nagemaakte logboek als dagbestanden, in de vorm van het echte logboek. */
  async function logMap(dagen: number): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'hems-thermisch-'));
    const perDag = new Map<string, string[]>();
    for (const m of logboek(dagen)) {
      const dag = new Date(m.tMs).toISOString().slice(0, 10);
      const regel = { t: m.tMs, zonesT: m.zones.map((z) => [z.id, z.temperatureC, 'none']), obs: m.observed, buitenC: m.outdoorC, zonW: m.solarW };
      (perDag.get(dag) ?? perDag.set(dag, []).get(dag)!).push(JSON.stringify(regel));
    }
    for (const [dag, regels] of perDag) await writeFile(join(dir, `decisions-${dag}.ndjson`), `${regels.join('\n')}\n`);
    return dir;
  }

  it('leert uit het logboek hetzelfde als uit de momenten, en bewaart het', async () => {
    const dir = await logMap(25);
    try {
      const nu = Date.UTC(2026, 9, 26, 12);
      const leer = new ThermischLeer({ logDir: dir, now: () => nu });
      expect(await leer.bewaard()).toBeNull();
      const r = (await leer.bijwerken(CONFIG))!;
      const verwacht = leerThermisch(logboek(25), ZONES, nu, 'Europe/Amsterdam');
      expect(r).toEqual(verwacht);
      expect(r.dag).toBe('2026-10-26');
      const opSchijf = JSON.parse(await readFile(join(dir, THERMISCH_FILE), 'utf-8'));
      expect(opSchijf).toEqual(verwacht);
      // Na een herstart komt het van schijf, zonder te rekenen.
      const weer = new ThermischLeer({ logDir: dir, now: () => nu });
      expect(await weer.bewaard()).toEqual(verwacht);
      expect(weer.nodig('Europe/Amsterdam')).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('vernieuwt een rapport van gisteren pas in de nacht, in de tijdzone van het huis', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hems-thermisch-'));
    try {
      await writeFile(join(dir, THERMISCH_FILE), JSON.stringify({ versie: 1, dag: '2026-11-05', sindsMs: null, dagen: 0, zones: [], stand: 'leert' }));
      let nu = Date.UTC(2026, 10, 6, 1, 30); // 02:30 in Amsterdam
      const leer = new ThermischLeer({ logDir: dir, now: () => nu });
      await leer.bewaard();
      expect(leer.nodig('Europe/Amsterdam')).toBe(false);
      nu = Date.UTC(2026, 10, 6, 2, 30); // 03:30
      expect(leer.nodig('Europe/Amsterdam')).toBe(true);
      // Zonder rapport altijd.
      expect(new ThermischLeer({ logDir: dir }).nodig('Europe/Amsterdam')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rekent op de achtergrond als er nog niets is, en schrijft het bestand', async () => {
    const dir = await logMap(3);
    const leer = new ThermischLeer({ logDir: dir });
    try {
      const meldingen: string[] = [];
      leer.achtergrond(() => CONFIG, { eersteMs: 0, elkeMs: 60_000, meld: (t) => meldingen.push(t) });
      await vi.waitFor(() => expect(meldingen.length).toBe(1), { timeout: 5_000 });
      expect(meldingen[0]).toMatch(/uitgerekend/);
      expect(leer.current).not.toBeNull();
      expect(JSON.parse(await readFile(join(dir, THERMISCH_FILE), 'utf-8')).versie).toBe(1);
    } finally {
      leer.stop();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
