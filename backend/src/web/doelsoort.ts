/**
 * Wat het doel van een klimaatapparaat is (testerronde, november 2026).
 *
 * Niet elk `climate.` stelt een kamertemperatuur in. Een Luxtronik-warmtepomp
 * zonder slimme kamerunit geeft als doel een correctie op de stooklijn, van
 * −5 tot +5; een warmtepomp via Midea (de zones van de Heat Pump Wi-Fi
 * Controller) kan in watertemperatuur werken, van 25 tot 60. SunArc las "+2"
 * als 2 °C en "35" als een kamer van 35°. Het bereik zegt het: een kamer ligt
 * ergens tussen 5 en 35.
 */

export type DoelSoort = 'kamer' | 'stooklijn' | 'water';

export function doelSoort(minC: number | null | undefined, maxC: number | null | undefined): DoelSoort {
  if (minC == null || maxC == null || !Number.isFinite(minC) || !Number.isFinite(maxC)) return 'kamer';
  // Een correctie rond nul: tot onder nul en niet hoger dan tien.
  if (minC < 0 && maxC <= 10) return 'stooklijn';
  // Water voor de vloer of de radiatoren: begint pas bij twintig en gaat ver boven een kamer uit.
  if (minC >= 20 && maxC >= 45) return 'water';
  return 'kamer';
}
