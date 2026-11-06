/*
 * De grens per omvormer (besluit 254, stap 4): elke omvormer kapt zijn eigen
 * vlakken af. Een vlak zonder omvormer met een bekende grens telt samen met de
 * rest bij de oude grens voor het hele dak.
 */
import type { Geometry, SolarPlane } from '../core/model.js';

/**
 * Wat de vlakken samen leveren, afgekapt per omvormer (besluit 254, stap 4):
 * een vlak met een omvormer met een bekende grens telt bij die omvormer, de
 * rest samen bij `inverterMaxW`. `wattVan` geeft per vlak wat het nu levert.
 */
export function naOmvormers(geometry: Geometry, wattVan: (p: SolarPlane) => number): number {
  const grens = new Map((geometry.inverters ?? []).map((i) => [i.id, i.maxW]));
  const som = new Map<string, number>();
  for (const p of geometry.solarPlanes) {
    const k = p.inverter && grens.has(p.inverter) ? p.inverter : '';
    som.set(k, (som.get(k) ?? 0) + wattVan(p));
  }
  let totaal = 0;
  for (const [k, w] of som) totaal += Math.min(w, k ? grens.get(k)! : (geometry.inverterMaxW ?? Infinity));
  return totaal;
}

/** Wat alle omvormers samen hooguit leveren; Infinity als het niet bekend is. */
export function omvormersSamenW(geometry: Geometry): number {
  const grens = new Map((geometry.inverters ?? []).map((i) => [i.id, i.maxW]));
  if (!grens.size) return geometry.inverterMaxW ?? Infinity;
  const eigen = [...new Set(geometry.solarPlanes.map((p) => p.inverter).filter((x): x is string => !!x && grens.has(x)))];
  const rest = geometry.solarPlanes.some((p) => !p.inverter || !grens.has(p.inverter));
  return eigen.reduce((s, id) => s + grens.get(id)!, 0) + (rest ? (geometry.inverterMaxW ?? Infinity) : 0);
}
