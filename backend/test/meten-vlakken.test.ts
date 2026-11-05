/**
 * De meting per dakvlak (besluit 254, stap 4): beginnen bij wat de bewoner
 * invulde, per vlak binnen 60° zoeken, de invoer houden als het niet duidelijk
 * beter past, en wat één meter meet verdelen over zijn vlakken.
 *
 * De opbrengst is nagemaakt met hetzelfde model voor heldere lucht, zoals in
 * ligging.test.ts.
 */

import { describe, expect, it } from 'vitest';

import { clearSkyOnPlaneWm2, sunPosition } from '../src/core/sun.js';
import type { DakVlak } from '../src/web/daken.js';
import type { Geometry } from '../src/core/model.js';
import { kiesLigging } from '../src/web/ligging.js';
import { meetVlakken, metMeting, verdeelDag } from '../src/web/meten-vlakken.js';
import { naOmvormers, omvormersSamenW } from '../src/web/omvormers.js';
import type { PowerRow } from '../src/web/today.js';

const PLEK = { latDeg: 52.1, lonDeg: 5.1 };
const DAG = 86_400_000;
const START = Date.UTC(2026, 9, 6);

function rnd(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function opbrengst(vlakken: { azimuthDeg: number; tiltDeg: number; peakW: number }[], helder: number[]): PowerRow[] {
  const r = rnd(11);
  const rows: PowerRow[] = [];
  for (let d = 0; d < 10; d++) {
    for (let i = 0; i < 288; i++) {
      const startMs = START + d * DAG + i * 300_000;
      const sun = sunPosition(startMs + 150_000, PLEK.latDeg, PLEK.lonDeg);
      let w = vlakken.reduce((s, v) => s + (clearSkyOnPlaneWm2(sun, v) / 1000) * v.peakW, 0) * 1.02;
      w *= helder.includes(d) ? 0.97 + r() * 0.05 : 0.2 + r() * 0.35;
      rows.push({ startMs, meanW: w });
    }
  }
  return rows;
}

const vlak = (x: Partial<DakVlak>): DakVlak => ({ letter: 'A', plek: 'hoofddak', opstelling: 'schuin', azimuthDeg: 180, tiltDeg: 40, aantal: 6, wpPerPaneel: 390, meter: null, bron: 'bewoner', ...x });
const verschil = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('de meting per dakvlak', () => {
  // Zoals bij Ricardo: oost 97° en west 277°, 47°, elk 6 panelen.
  const echt = opbrengst(
    [
      { azimuthDeg: 97, tiltDeg: 47, peakW: 2340 },
      { azimuthDeg: 277, tiltDeg: 47, peakW: 2340 },
    ],
    [1, 4, 8],
  );

  it('vindt per vlak de richting en de helling, vanaf wat de bewoner ongeveer invulde', () => {
    const m = meetVlakken(echt, [vlak({ letter: 'A', azimuthDeg: 75, tiltDeg: 35 }), vlak({ letter: 'B', azimuthDeg: 255, tiltDeg: 35 })], PLEK)!;
    expect(m).not.toBeNull();
    expect(verschil(m.vlakken.A!.azimuthDeg, 97)).toBeLessThanOrEqual(8);
    expect(verschil(m.vlakken.B!.azimuthDeg, 277)).toBeLessThanOrEqual(8);
    expect(Math.abs(m.vlakken.A!.tiltDeg - 47)).toBeLessThanOrEqual(8);
    expect(m.peakW).toBeGreaterThan(4680 * 0.85);
  });

  it('houdt de invoer als die al past', () => {
    const m = meetVlakken(echt, [vlak({ letter: 'A', azimuthDeg: 97, tiltDeg: 47 }), vlak({ letter: 'B', azimuthDeg: 277, tiltDeg: 47 })], PLEK)!;
    expect(m.vlakken.A).toEqual({ azimuthDeg: 97, tiltDeg: 47 });
    expect(m.vlakken.B).toEqual({ azimuthDeg: 277, tiltDeg: 47 });
  });

  it('zoekt niet verder dan 60° van de invoer', () => {
    // A aan de verkeerde kant ingevuld: hij blijft in de buurt van het westen.
    const m = meetVlakken(echt, [vlak({ letter: 'A', azimuthDeg: 283 }), vlak({ letter: 'B', azimuthDeg: 272 })], PLEK);
    if (m) expect(verschil(m.vlakken.A!.azimuthDeg, 283)).toBeLessThanOrEqual(60);
  });

  it('meet niets als het vermogen niet bij het aantal panelen past', () => {
    // 3000 Wp gemeten, maar 30 panelen ingevuld: minstens 30 × 250 Wp.
    expect(meetVlakken(opbrengst([{ azimuthDeg: 180, tiltDeg: 40, peakW: 3000 }], [3]), [vlak({ aantal: 30 })], PLEK)).toBeNull();
  });

  it('meet een plat dak oost-west als één vlak met twee kanten', () => {
    const ow = opbrengst(
      [
        { azimuthDeg: 92, tiltDeg: 10, peakW: 24 * 430 },
        { azimuthDeg: 272, tiltDeg: 10, peakW: 24 * 430 },
      ],
      [2, 6],
    );
    const m = meetVlakken(ow, [vlak({ opstelling: 'oostwest', azimuthDeg: 80, tiltDeg: 15, aantal: 24, aantal2: 24, wpPerPaneel: 430 })], PLEK)!;
    expect(m).not.toBeNull();
    // Oost-west is symmetrisch: de eerste kant mag oost of west zijn.
    expect(Math.min(verschil(m.vlakken.A!.azimuthDeg, 92), verschil(m.vlakken.A!.azimuthDeg, 272))).toBeLessThanOrEqual(10);
  });
});

describe('verdelen', () => {
  it('geeft de ochtend aan oost en de middag aan west, en samen wat de meter mat', () => {
    const rows = opbrengst(
      [
        { azimuthDeg: 90, tiltDeg: 45, peakW: 2000 },
        { azimuthDeg: 270, tiltDeg: 45, peakW: 2000 },
      ],
      [8],
    );
    const v = verdeelDag(rows, [vlak({ letter: 'A', azimuthDeg: 90, tiltDeg: 45 }), vlak({ letter: 'B', azimuthDeg: 270, tiltDeg: 45 })], PLEK, 'UTC', START + 10 * DAG)!;
    expect(v.datum).toBe('2026-10-15');
    expect(v.letters).toEqual(['A', 'B']);
    const ochtend = v.punten.find((p) => p[0] === 8)!;
    const middag = v.punten.find((p) => p[0] === 15)!;
    expect(ochtend[1]!).toBeGreaterThan(ochtend[2]!);
    expect(middag[2]!).toBeGreaterThan(middag[1]!);
  });
});

describe('gemeten volgt vanzelf', () => {
  it('neemt de meting over bij gemeten en geschatte vlakken, niet bij zelf ingestelde', () => {
    const d = { vlakken: [vlak({ letter: 'A', bron: 'gemeten' }), vlak({ letter: 'B', bron: 'bewoner' }), vlak({ letter: 'C', bron: 'schatting' })], voorgevelDeg: 180, omvormerW: null };
    const uit = metMeting(d, { A: { azimuthDeg: 170, tiltDeg: 35 }, B: { azimuthDeg: 200, tiltDeg: 30 }, C: { azimuthDeg: 190, tiltDeg: 20 } });
    expect(uit.vlakken.map((v) => [v.letter, v.azimuthDeg, v.bron])).toEqual([['A', 170, 'gemeten'], ['B', 180, 'bewoner'], ['C', 190, 'gemeten']]);
  });
});

describe('de grens per omvormer', () => {
  const geo: Geometry = {
    facades: [],
    solarPlanes: [
      { id: 'a', azimuthDeg: 180, tiltDeg: 40, peakW: 4000, source: 'bewoner', inverter: 'sensor.huis' },
      { id: 'b', azimuthDeg: 180, tiltDeg: 15, peakW: 3000, source: 'bewoner', inverter: 'sensor.garage' },
    ],
    inverterMaxW: 5000,
    inverters: [
      { id: 'sensor.huis', maxW: 3000 },
      { id: 'sensor.garage', maxW: 3600 },
    ],
  };

  it('kapt elke omvormer zijn eigen vlakken af', () => {
    // Huis 4000 W naar 3000, garage 3000 W blijft: samen 6000, niet de 5000 van één grens.
    expect(naOmvormers(geo, (p) => p.peakW)).toBe(6000);
    expect(omvormersSamenW(geo)).toBe(6600);
  });

  it('houdt zonder omvormers per vlak de oude grens', () => {
    const { inverters: _weg, ...oud } = geo;
    expect(naOmvormers(oud, (p) => p.peakW)).toBe(5000);
  });

  it('geeft de daken een grens per meter: ingevuld, anders uit het typenummer', () => {
    const daken = {
      vlakken: [vlak({ letter: 'A', meter: 'sensor.huis' }), vlak({ letter: 'B', meter: 'sensor.garage', plek: 'garage' })],
      voorgevelDeg: 180,
      omvormerW: null,
      grenzen: { 'sensor.garage': 3600 },
    };
    const g = kiesLigging({ configuratie: undefined, dak: null, meting: null, panelen: null, voorkantZon: null, omvormerGevonden: null, daken, grenzen: { 'sensor.huis': 3000, 'sensor.garage': 4000 } })!;
    expect(g.geometry.inverters).toEqual([
      { id: 'sensor.huis', maxW: 3000 },
      { id: 'sensor.garage', maxW: 3600 },
    ]);
    expect(g.geometry.solarPlanes.map((p) => p.inverter)).toEqual(['sensor.huis', 'sensor.garage']);
  });
});
