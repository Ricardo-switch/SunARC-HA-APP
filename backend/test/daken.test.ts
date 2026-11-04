/**
 * Daken en panelen (besluit 254, stap 1): elk vlak apart, lezen wat de pagina
 * stuurt, de vlakken uit wat er al was, en wat de berekening ervan krijgt.
 */

import { describe, expect, it } from 'vitest';

import type { Geometry } from '../src/core/model.js';
import { validateConnection } from '../src/web/aansluiting.js';
import { dakenUitOud, leesDaken, piekVan, zonnevlakken, type DakVlak, type Daken } from '../src/web/daken.js';
import { dakenNu, kiesLigging, type LiggingInput, type Meting } from '../src/web/ligging.js';

const vlak = (x: Partial<DakVlak> = {}): DakVlak => ({
  letter: 'A',
  plek: 'hoofddak',
  opstelling: 'schuin',
  azimuthDeg: 180,
  tiltDeg: 40,
  aantal: 14,
  wpPerPaneel: 410,
  meter: null,
  bron: 'bewoner',
  ...x,
});

// Idee #121: 48 panelen op een plat dak, de helft oost en de helft west op 10°.
const wendy: Daken = {
  vlakken: [vlak({ letter: 'A', plek: 'uitbouw', opstelling: 'oostwest', azimuthDeg: 90, tiltDeg: 10, aantal: 24, aantal2: 24, wpPerPaneel: 430 })],
  voorgevelDeg: 180,
  omvormerW: null,
};

const basis: LiggingInput = { configuratie: undefined, dak: null, meting: null, panelen: null, voorkantZon: null, omvormerGevonden: null };

describe('een vlak', () => {
  it('telt bij oost-west beide kanten', () => {
    expect(piekVan(wendy.vlakken[0]!)).toBe(48 * 430);
  });

  it('wordt bij oost-west twee vlakken voor de berekening, tegenover elkaar', () => {
    const p = zonnevlakken(wendy);
    expect(p).toEqual([
      { id: 'vlak-a', azimuthDeg: 90, tiltDeg: 10, peakW: 24 * 430, source: 'bewoner' },
      { id: 'vlak-a-2', azimuthDeg: 270, tiltDeg: 10, peakW: 24 * 430, source: 'bewoner' },
    ]);
  });

  it('laat een kant zonder panelen weg', () => {
    const d: Daken = { ...wendy, vlakken: [{ ...wendy.vlakken[0]!, aantal2: 0 }] };
    expect(zonnevlakken(d).map((p) => p.id)).toEqual(['vlak-a']);
  });
});

describe('lezen', () => {
  it('neemt een goed vlak over en vult de bron aan', () => {
    const { bron: _weg, ...zonder } = vlak();
    const r = leesDaken({ vlakken: [zonder], voorgevelDeg: 180, omvormerW: null });
    expect('daken' in r && r.daken?.vlakken[0]?.bron).toBe('bewoner');
  });

  it('zonder vlakken is niet bewaard', () => {
    expect(leesDaken({ vlakken: [] })).toEqual({ daken: null });
    expect(leesDaken(null)).toEqual({ daken: null });
  });

  it('weigert dubbele letters, een onbekende plek en een rare meter', () => {
    expect(leesDaken({ vlakken: [vlak(), vlak()] })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [{ ...vlak(), plek: 'kelder' }] })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [vlak({ meter: 'switch.omvormer' })] })).toHaveProperty('fout');
    expect(leesDaken({ vlakken: [vlak({ aantal: 0 })] })).toHaveProperty('fout');
  });

  it('staat oost-west met één lege kant toe, maar niet helemaal leeg', () => {
    expect(leesDaken({ vlakken: [{ ...wendy.vlakken[0]!, aantal: 0, aantal2: 6 }] })).toHaveProperty('daken');
    expect(leesDaken({ vlakken: [{ ...wendy.vlakken[0]!, aantal: 0, aantal2: 0 }] })).toHaveProperty('fout');
  });

  it('blijft bij de antwoorden als de pagina hem niet meestuurt', () => {
    const found = { fasen: [], apparaten: [] };
    const eerst = validateConnection({ panelen: { ligging: 'plat', aantal: 48 }, daken: wendy }, found);
    expect(eerst.ok).toBe(true);
    const daarna = validateConnection({ panelen: { ligging: 'plat', aantal: 48 } }, found, eerst.ok ? eerst.answers : null);
    expect(daarna.ok && daarna.answers.daken).toEqual(wendy);
    const weg = validateConnection({ panelen: { ligging: 'plat', aantal: 48 }, daken: null }, found, eerst.ok ? eerst.answers : null);
    expect(weg.ok && weg.answers.daken).toBeUndefined();
  });
});

describe('uit wat er al was', () => {
  const zuid: Geometry = {
    facades: [{ id: 'voorgevel', name: 'Voorgevel', azimuthDeg: 180, zoneIds: [], source: 'gemeten' }],
    solarPlanes: [{ id: 'dak-zuid', azimuthDeg: 180, tiltDeg: 40, peakW: 5600, source: 'gemeten' }],
  };

  it('geeft het hoofddak een vlak met het aantal van de bewoner', () => {
    const d = dakenUitOud({ geometry: zuid, aantal: 14, plat: false, elders: null, gemetenTotaal: false });
    expect(d.vlakken).toHaveLength(1);
    expect(d.vlakken[0]).toMatchObject({ letter: 'A', plek: 'hoofddak', opstelling: 'schuin', azimuthDeg: 180, aantal: 14, wpPerPaneel: 400, bron: 'gemeten' });
    expect(d.voorgevelDeg).toBe(180);
  });

  it('maakt van twee platte vlakken tegenover elkaar één vlak oost-west', () => {
    const ow: Geometry = {
      facades: [],
      solarPlanes: [
        { id: 'dak-oost', azimuthDeg: 92, tiltDeg: 10, peakW: 10_000, source: 'gemeten' },
        { id: 'dak-west', azimuthDeg: 271, tiltDeg: 10, peakW: 10_000, source: 'gemeten' },
      ],
    };
    const d = dakenUitOud({ geometry: ow, aantal: 48, plat: true, elders: null, gemetenTotaal: false });
    expect(d.vlakken).toHaveLength(1);
    expect(d.vlakken[0]).toMatchObject({ opstelling: 'oostwest', azimuthDeg: 92, aantal: 24, aantal2: 24 });
    expect(piekVan(d.vlakken[0]!)).toBeCloseTo(20_000);
  });

  it('geeft de garage een eigen vlak, en haalt zijn deel van een meting van alles af', () => {
    const d = dakenUitOud({ geometry: zuid, aantal: 14, plat: false, elders: { garage: 6 }, gemetenTotaal: true });
    expect(d.vlakken.map((v) => [v.letter, v.plek, v.aantal])).toEqual([['A', 'hoofddak', 14], ['B', 'garage', 6]]);
    // De meting zag 5600 Wp voor alle 20 panelen: 280 Wp per paneel.
    expect(piekVan(d.vlakken[0]!) + piekVan(d.vlakken[1]!)).toBeCloseTo(5600);
    expect(d.vlakken[1]).toMatchObject({ opstelling: 'rek', azimuthDeg: 180, bron: 'schatting' });
  });
});

describe('wat de berekening krijgt', () => {
  const meting: Meting = { vlakken: [{ azimuthDeg: 180, tiltDeg: 38, peakW: 5600, kant: null }], peakW: 5600, fout: 0.1, dag: { datum: '2026-06-01', kWh: 30, punten: [] } };
  const panelen = { ligging: 'voorkant' as const, aantal: 14, voorkant: null, achterkant: null };

  it('blijft zonder andere daken precies zoals het was', () => {
    const zonder = kiesLigging({ ...basis, meting, panelen });
    expect(kiesLigging({ ...basis, meting, panelen, elders: {} })).toEqual(zonder);
  });

  it('telt de garage mee zonder dubbel te tellen', () => {
    const g = kiesLigging({ ...basis, meting, panelen, elders: { garage: 6 } })!;
    expect(g.geometry.solarPlanes).toHaveLength(2);
    expect(g.geometry.solarPlanes.reduce((s, p) => s + p.peakW, 0)).toBeCloseTo(5600, -1);
  });

  it('rekent met de bewaarde daken, ook boven een bevestigd dak', () => {
    const g = kiesLigging({ ...basis, meting, panelen, daken: wendy })!;
    expect(g.bron).toBe('app');
    expect(g.geometry.solarPlanes.map((p) => p.azimuthDeg)).toEqual([90, 270]);
    expect(g.geometry.facades.find((f) => f.id === 'voorgevel')?.azimuthDeg).toBe(180);
  });

  it('laat de pagina zien waar de berekening mee rekent', () => {
    const i = { ...basis, meting, panelen, elders: { garage: 6 } };
    const nu = dakenNu(i);
    expect(nu.bewaard).toBe(false);
    expect(zonnevlakken(nu.daken)).toEqual(kiesLigging(i)!.geometry.solarPlanes);
    expect(dakenNu({ ...i, daken: wendy })).toEqual({ daken: wendy, bewaard: true });
  });
});
