/*
 * Meldingen van de auto (besluit 263): vol, een fout van de laadpaal, kabel
 * vergeten en laden met de hand dat klaar is; bij de bel en op de telefoon.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { MeldingenStore, wat, type AutoBel, type MeldingenBron } from '../src/web/meldingen.js';
import { STANDAARD_MELDINGEN, groepVan, teSturen, type Ontvanger } from '../src/web/push.js';

const dirs: string[] = [];
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});

const T0 = Date.UTC(2026, 10, 7, 20, 0, 0);
const auto = (x: Partial<AutoBel> = {}): AutoBel => ({ id: 'tesla', naam: 'Model 3', pct: 64, grens: 80, aangesloten: true, thuis: true, fout: null, kabelSindsMs: T0 - 3_600_000, kabel: { om: 21 * 60, pct: 50 }, ...x });
const bron = (lijst: AutoBel[], minuut = 20 * 60, o: Partial<MeldingenBron> = {}): MeldingenBron => ({
  nu: T0, zonderRuimte: [], volgen: [], batterijen: [], filters: [], meters: [], versie: null, winterdagen: null,
  autos: { lijst, minuut, dag: '2026-11-07', gisteren: '2026-11-06' }, ...o,
});
const ids = (b: MeldingenBron) => wat(b).map((m) => m.id);

describe('meldingen van de auto (besluit 263)', () => {
  it('meldt vol op de laadgrens, per laadbeurt', () => {
    expect(ids(bron([auto()]))).toEqual([]);
    const vol = wat(bron([auto({ pct: 80 })]));
    expect(vol.map((m) => [m.id, m.titel, m.tekst])).toEqual([[`auto-vol:tesla:${T0 - 3_600_000}`, 'Model 3 is vol', 'Op 80%, de laadgrens. De kabel mag eruit.']]);
    expect(vol[0]!.en.titel).toBe('Model 3 is full');
    expect(vol[0]!.actie?.href).toBe('auto.html#tesla');
    // Zonder kabel, of onderweg: niet.
    expect(ids(bron([auto({ pct: 80, aangesloten: false })]))).toEqual([]);
    expect(ids(bron([auto({ pct: 80, thuis: false })]))).toEqual([]);
  });

  it('meldt een fout van de laadpaal', () => {
    const m = wat(bron([auto({ fout: 'error' })]));
    expect(m.map((x) => [x.titel, x.tekst])).toEqual([['Laden gestopt: Model 3', 'De laadpaal meldt een fout (error). Kijk in de app van de laadpaal.']]);
  });

  it('meldt kabel vergeten vanaf de tijd tot zes uur, alleen thuis, zonder kabel en te leeg', () => {
    const los = auto({ aangesloten: false, kabelSindsMs: null, pct: 41 });
    expect(ids(bron([los], 20 * 60 + 59))).toEqual([]);
    expect(ids(bron([los], 21 * 60))).toEqual(['auto-kabel:tesla:2026-11-07']);
    expect(wat(bron([los], 21 * 60))[0]!.tekst).toBe('Hij staat op 41%, onder de 50% die je koos. Doe je de kabel erin?');
    // Na middernacht dezelfde avond, om zes uur weg.
    expect(ids(bron([los], 2 * 60))).toEqual(['auto-kabel:tesla:2026-11-06']);
    expect(ids(bron([los], 6 * 60))).toEqual([]);
    // Vol genoeg, onderweg, of uit: niet.
    expect(ids(bron([{ ...los, pct: 55 }], 22 * 60))).toEqual([]);
    expect(ids(bron([{ ...los, thuis: false }], 22 * 60))).toEqual([]);
    expect(ids(bron([{ ...los, kabel: null }], 22 * 60))).toEqual([]);
  });

  it('meldt laden met de hand dat klaar is, een half uur', () => {
    const h = { auto: 'tesla', naam: 'Model 3', tot: 'pct' as const, pct: 70, ms: T0 - 10 * 60_000 };
    expect(wat(bron([], 0, { handKlaar: [h] })).map((m) => [m.titel, m.tekst])).toEqual([['Model 3: met de hand klaar', 'Op 70%. De laadpaal kiest weer zelf.']]);
    expect(ids(bron([], 0, { handKlaar: [{ ...h, ms: T0 - 31 * 60_000 }] }))).toEqual([]);
  });

  it('lost op als de kabel eruit gaat, en gaat naar de telefoon buiten de nachtrust', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hems-auto-'));
    dirs.push(dir);
    const s = new MeldingenStore({ logDir: dir });
    s.bij(bron([auto({ pct: 80 })]));
    expect(s.lijst(T0).actief.map((m) => m.titel)).toEqual(['Model 3 is vol']);
    expect(groepVan('auto')).toBe('auto');
    expect(STANDAARD_MELDINGEN.auto).toBe(true);
    const o: Ontvanger = { account: 'u', keus: STANDAARD_MELDINGEN, telefoon: { id: 'd', naam: 'Pixel', dienst: 'mobile_app_pixel', account: 'u' } };
    const eerst = teSturen(s.lijst(T0).actief.map((m) => ({ ...m })), [o], {}, T0, 'Europe/Amsterdam');
    expect(eerst.berichten.map((b) => b.titel)).toEqual(['Model 3 is vol']);
    // Ook een oude keuze zonder "de auto" krijgt hem.
    const { auto: _weg, ...oud } = STANDAARD_MELDINGEN;
    expect(teSturen(s.lijst(T0).actief, [{ ...o, keus: oud }], {}, T0, 'Europe/Amsterdam').berichten).toHaveLength(1);
    s.bij(bron([auto({ pct: 80, aangesloten: false, kabelSindsMs: null })], 20 * 60, { nu: T0 + 60_000 }));
    const l = s.lijst(T0 + 60_000);
    expect(l.actief).toEqual([]);
    expect(l.eerder.map((m) => m.titel)).toEqual(['Model 3: kabel eruit']);
  });
});
