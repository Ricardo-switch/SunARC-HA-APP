/**
 * Deel apparaatgegevens (testerronde, november 2026): wat over het soort
 * apparaat gaat wel, wat over het huis of de bewoner gaat nooit.
 */

import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import { apparaatGegevens } from '../src/web/apparaat-gegevens.js';

const st = (entity_id: string, state: string, attributes: Record<string, unknown>): HaEntityState => ({ entity_id, state, attributes, last_changed: '', last_updated: '' });

describe('apparaatgegevens om te delen', () => {
  const states = new Map([
    st('climate.luxtronik_verwarming_bij_jansen', 'heat', {
      friendly_name: 'Verwarming familie Jansen',
      hvac_modes: ['heat', 'off'],
      hvac_action: 'heating',
      preset_modes: ['none', 'away', 'boost'],
      min_temp: -5,
      max_temp: 5,
      temperature: 1,
      current_temperature: 20.4,
      supported_features: 401,
      ip_address: '192.168.1.40',
      serial_number: 'LX123456',
      entity_picture: '/api/image/x',
      some_note: 'Woonkamer van Jan',
    }),
    st('sensor.luxtronik_flow_in_temperature', '34.5', { device_class: 'temperature', unit_of_measurement: '°C', friendly_name: 'Aanvoer' }),
  ].map((s) => [s.entity_id, s]));
  const entities = [
    { entity_id: 'climate.luxtronik_verwarming_bij_jansen', device_id: 'd1', platform: 'luxtronik2' },
    { entity_id: 'sensor.luxtronik_flow_in_temperature', device_id: 'd1', platform: 'luxtronik2' },
  ];
  const devices = [{ id: 'd1', area_id: 'woonkamer', name: 'Warmtepomp Jansen', name_by_user: 'WP Jan', manufacturer: 'Alpha Innotec', model: 'LWD 50A' }];

  it('geeft het soort, de stand en de eigenschappen, zonder namen, adressen of id', () => {
    const g = apparaatGegevens('climate.luxtronik_verwarming_bij_jansen', states, entities, devices)!;
    expect(g).toEqual({
      domein: 'climate',
      koppeling: 'luxtronik2',
      merk: 'Alpha Innotec',
      model: 'LWD 50A',
      stand: 'heat',
      eigenschappen: { hvac_modes: ['heat', 'off'], hvac_action: 'heating', preset_modes: ['none', 'away', 'boost'], min_temp: -5, max_temp: 5, temperature: 1, current_temperature: 20.4, supported_features: 401 },
      ernaast: [{ domein: 'sensor', soort: 'temperature', eenheid: '°C', stand: '34.5' }],
    });
    expect(JSON.stringify(g)).not.toMatch(/Jansen|Jan\b|192\.168|LX123456|woonkamer/i);
  });

  it('kent geen apparaat dat er niet is', () => {
    expect(apparaatGegevens('climate.bestaat_niet', states, entities, devices)).toBeNull();
  });
});
