/**
 * Wat kan bij jouw huis (Ricardo, 6 november 2026): de route van de kaart
 * zegt per kaart of hij het huis kent, alleen de wijk, niets, geen antwoord
 * gaf, of daar niet komt (3D BAG buiten Nederland).
 */

import type { ServerResponse } from 'node:http';

import { describe, expect, it } from 'vitest';

import type { Diensten } from '../src/web/diensten.js';
import { dakenKaartRoute } from '../src/web/routes/energie.js';

/** Een vierkant gebouw van `m` meter om een punt `n` meter noordelijk van de plek, zoals Overpass het geeft. */
function gebouw(lat: number, lon: number, n: number, m = 8) {
  const dLat = (x: number) => lat + x / 110_540;
  const dLon = (x: number) => lon + x / (111_320 * Math.cos((lat * Math.PI) / 180));
  const h = m / 2;
  return { geometry: [[n - h, -h], [n - h, h], [n + h, h], [n + h, -h], [n - h, -h]].map(([a, b]) => ({ lat: dLat(a!), lon: dLon(b!) })) };
}

async function vraag(lat: number, lon: number, kaart: () => Promise<unknown>, bag: () => Promise<unknown> = async () => null) {
  let status = 0;
  let tekst = '';
  const res = { writeHead: (s: number) => (status = s), end: (t: string) => (tekst = t) } as unknown as ServerResponse;
  const d = { options: { exacteLocatie: async () => ({ latDeg: lat, lonDeg: lon }), kaartAntwoord: kaart, bagVak: bag } } as unknown as Diensten;
  await dakenKaartRoute(d, res);
  return { status, body: JSON.parse(tekst) as { bron?: string; hoofdhuis?: unknown; bronnen: { osm: { stand: string }; bag3d: { stand: string } } } };
}

describe('wat kan bij jouw huis: de kaart', () => {
  it('buiten Nederland alleen de plattegrond, en 3D BAG komt er niet', async () => {
    let bagGevraagd = false;
    const { status, body } = await vraag(48.8566, 2.3522, async () => ({ elements: [gebouw(48.8566, 2.3522, 0)] }), async () => {
      bagGevraagd = true;
      return null;
    });
    expect(status).toBe(200);
    expect(body.bron).toBe('osm');
    expect(body.bronnen.osm.stand).toBe('huis');
    expect(body.bronnen.bag3d.stand).toBe('buiten');
    expect(bagGevraagd).toBe(false);
  });

  it('kent de kaart alleen de wijk, dan zegt hij dat; zonder kaartvak van 3D BAG niets', async () => {
    const { status, body } = await vraag(52.3702, 4.8952, async () => ({ elements: [gebouw(52.3702, 4.8952, 120)] }));
    expect(status).toBe(404);
    expect(body.bronnen).toMatchObject({ osm: { stand: 'wijk' }, bag3d: { stand: 'niets' } });
    expect(body.hoofdhuis).toBeUndefined();
  });

  it('zonder gebouwen is het niets, en zonder antwoord een fout', async () => {
    const leeg = await vraag(51.4416, 5.4697, async () => ({ elements: [] }));
    expect(leeg.body.bronnen.osm.stand).toBe('niets');
    const stuk = await vraag(53.2194, 6.5665, async () => {
      throw new Error('Overpass 504');
    }, async () => {
      throw new Error('3D BAG 503');
    });
    expect(stuk.status).toBe(502);
    expect(stuk.body.bronnen).toMatchObject({ osm: { stand: 'fout' }, bag3d: { stand: 'fout' } });
  });
});
