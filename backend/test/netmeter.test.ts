/**
 * De netmeter en de omvormers (testerronde, november 2026).
 *
 * Betatesters liepen tegen drie dingen aan: een meter in kW (DSMR) werd als
 * watt gelezen, DSMR geeft afname en teruglevering als twee sensoren, en twee
 * omvormers konden niet samen de opbrengst van nu zijn. Daarbij was de
 * netmeter na de eerste ontdekking nergens meer te kiezen.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import { discover, type HaRegistryEntity, type Registers } from '../src/adapters/homeassistant/discovery.js';
import { buildSystemState } from '../src/adapters/homeassistant/mapping.js';
import { EntityStore } from '../src/adapters/homeassistant/store.js';
import { parseSiteConfig } from '../src/config/schema.js';
import type { SiteConfig } from '../src/core/model.js';
import { defaultStrategies } from '../src/index.js';
import { connectionView, findPowers, validateConnection, withConnection, type ConnectionAnswers } from '../src/web/aansluiting.js';
import { somPerVak } from '../src/web/historie.js';
import { exampleSite } from './site.js';

function st(entity_id: string, state: string, attributes: Record<string, unknown> = {}): HaEntityState {
  return { entity_id, state, attributes, last_changed: '2026-11-04T12:00:00+00:00', last_updated: '2026-11-04T12:00:00+00:00' };
}

const NU = Date.parse('2026-11-04T12:00:30+00:00');

function stateMet(config: SiteConfig, states: HaEntityState[]) {
  const store = new EntityStore();
  store.replaceAll(states);
  return buildSystemState(config, store, NU);
}

describe('het netvermogen en de opbrengst lezen', () => {
  it('rekent kW om naar W, en trekt een aparte teruglevering af', () => {
    const config: SiteConfig = {
      ...exampleSite,
      power: { ...exampleSite.power, gridPower: { adapter: 'homeassistant', id: 'sensor.electricity_meter_power_consumption' }, gridExport: { adapter: 'homeassistant', id: 'sensor.electricity_meter_power_production' } },
    };
    const s = stateMet(config, [
      st('sensor.electricity_meter_power_consumption', '0.0', { unit_of_measurement: 'kW', device_class: 'power' }),
      st('sensor.electricity_meter_power_production', '1.25', { unit_of_measurement: 'kW', device_class: 'power' }),
    ]);
    expect(s.power.gridPowerW).toMatchObject({ ok: true, value: -1250 });
  });

  it('is onbekend als de teruglevering niets geeft, in plaats van alles als afname te tellen', () => {
    const config: SiteConfig = {
      ...exampleSite,
      power: { ...exampleSite.power, gridPower: { adapter: 'homeassistant', id: 'sensor.afname' }, gridExport: { adapter: 'homeassistant', id: 'sensor.terug' } },
    };
    const s = stateMet(config, [st('sensor.afname', '300', { unit_of_measurement: 'W' }), st('sensor.terug', 'unavailable')]);
    expect(s.power.gridPowerW.ok).toBe(false);
  });

  it('telt de omvormers op, ook in kW, en telt er een die niets geeft niet mee', () => {
    const config: SiteConfig = {
      ...exampleSite,
      solarProduction: { adapter: 'homeassistant', id: 'sensor.solaredge_1_power' },
      solarExtra: [{ adapter: 'homeassistant', id: 'sensor.solaredge_2_power' }, { adapter: 'homeassistant', id: 'sensor.garage_omvormer' }],
    };
    const s = stateMet(config, [
      st('sensor.solaredge_1_power', '1800', { unit_of_measurement: 'W' }),
      st('sensor.solaredge_2_power', '1.2', { unit_of_measurement: 'kW' }),
      st('sensor.garage_omvormer', 'unavailable'),
    ]);
    expect(s.solarProductionW).toMatchObject({ ok: true, value: 3000 });
  });

  it('legt reeksen per vak van vijf minuten bij elkaar', () => {
    const a = [{ startMs: 0, meanW: 100 }, { startMs: 300_000, meanW: 200 }];
    const b = [{ startMs: 0, meanW: 40 }];
    expect(somPerVak([a, b])).toEqual([{ startMs: 0, meanW: 140 }, { startMs: 300_000, meanW: 200 }]);
    expect(somPerVak([a, b], [1, -1], true)).toEqual([{ startMs: 0, meanW: 60 }]);
  });
});

describe('de keuze in de app', () => {
  const sensoren = [
    st('sensor.electricity_meter_power_consumption', '0.42', { unit_of_measurement: 'kW', friendly_name: 'Electricity Meter Power consumption' }),
    st('sensor.electricity_meter_power_production', '0', { unit_of_measurement: 'kW', friendly_name: 'Electricity Meter Power production' }),
    st('sensor.electricity_meter_power_consumption_phase_l1', '0.2', { unit_of_measurement: 'kW' }),
    st('sensor.netvermogen_template', '-350', { unit_of_measurement: 'W', friendly_name: 'Homey Energy Dongle vermogen' }),
    st('sensor.solaredge_1_power', '1800', { unit_of_measurement: 'W', friendly_name: 'SolarEdge 1 vermogen' }),
    st('sensor.solaredge_2_power', 'unavailable', { unit_of_measurement: 'W', friendly_name: 'SolarEdge 2 vermogen' }),
    st('sensor.electricity_meter_energy_consumption_tarif_1', '1234', { unit_of_measurement: 'kWh' }),
  ];
  const vermogens = findPowers(sensoren);

  it('zoekt alle sensoren in W en kW, zonder kWh, met wat ze nu zeggen en waar ze op lijken', () => {
    const per = Object.fromEntries(vermogens.map((v) => [v.id, [v.rol, v.w]]));
    expect(per).toEqual({
      'sensor.electricity_meter_power_consumption': ['net', 420],
      'sensor.netvermogen_template': ['net', -350],
      'sensor.electricity_meter_power_production': ['terug', 0],
      'sensor.solaredge_1_power': ['zon', 1800],
      'sensor.solaredge_2_power': ['zon', null],
      'sensor.electricity_meter_power_consumption_phase_l1': [null, 200],
    });
    expect(vermogens[0]!.rol).toBe('net');
  });

  const found = { fasen: [], apparaten: [], vermogens };

  it('bewaart de netmeter en de omvormers, en houdt ze als de pagina ze niet meestuurt', () => {
    const eerst = validateConnection({ netmeter: { afname: 'sensor.electricity_meter_power_consumption', terug: 'sensor.electricity_meter_power_production' }, omvormers: ['sensor.solaredge_1_power', 'sensor.solaredge_2_power'] }, found);
    if (!eerst.ok) throw new Error(eerst.reden);
    expect(eerst.answers.netmeter).toEqual({ afname: 'sensor.electricity_meter_power_consumption', terug: 'sensor.electricity_meter_power_production' });
    const daarna = validateConnection({ zekering: { fasen: 3, ampere: 25 } }, found, eerst.answers);
    if (!daarna.ok) throw new Error(daarna.reden);
    expect(daarna.answers.netmeter).toEqual(eerst.answers.netmeter);
    expect(daarna.answers.omvormers).toEqual(['sensor.solaredge_1_power', 'sensor.solaredge_2_power']);
    // Leeg en null zetten het weer op de configuratie.
    const weg = validateConnection({ netmeter: null, omvormers: [] }, found, eerst.answers);
    expect(weg.ok && [weg.answers.netmeter, weg.answers.omvormers]).toEqual([undefined, undefined]);
  });

  it('weigert een sensor die geen vermogen meet, of twee keer dezelfde', () => {
    expect(validateConnection({ netmeter: { afname: 'sensor.electricity_meter_energy_consumption_tarif_1' } }, found).ok).toBe(false);
    expect(validateConnection({ netmeter: { afname: 'sensor.netvermogen_template', terug: 'sensor.netvermogen_template' } }, found).ok).toBe(false);
    expect(validateConnection({ omvormers: ['sensor.solaredge_1_power', 'sensor.solaredge_1_power'] }, found).ok).toBe(false);
  });

  it('zet de keuze in de configuratie, en dat past in het schema', async () => {
    const real = JSON.parse(await readFile(join(import.meta.dirname, 'fixtures', 'voorbeeld-huis.json'), 'utf-8')) as Record<string, unknown>;
    const checked = validateConnection({ netmeter: { afname: 'sensor.electricity_meter_power_consumption', terug: 'sensor.electricity_meter_power_production' }, omvormers: ['sensor.solaredge_1_power', 'sensor.solaredge_2_power'] }, found);
    if (!checked.ok) throw new Error(checked.reden);
    const applied = withConnection(real, checked.answers as ConnectionAnswers);
    expect(applied.toegevoegd).toEqual(['de netmeter: sensor.electricity_meter_power_consumption min sensor.electricity_meter_power_production', '2 omvormers, opgeteld']);
    const parsed = parseSiteConfig(applied.raw, { knownStrategies: defaultStrategies().ids });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
    expect(parsed.config.power.gridPower?.id).toBe('sensor.electricity_meter_power_consumption');
    expect(parsed.config.power.gridExport?.id).toBe('sensor.electricity_meter_power_production');
    expect(parsed.config.solarProduction?.id).toBe('sensor.solaredge_1_power');
    expect(parsed.config.solarExtra?.map((p) => p.id)).toEqual(['sensor.solaredge_2_power']);
    // Al zo in de configuratie: niets toe te voegen, dus geen herstart nodig.
    expect(withConnection(applied.raw, checked.answers as ConnectionAnswers).toegevoegd).toEqual([]);
  });

  it('zegt dat een nieuwe keuze pas na de volgende start ingaat', () => {
    const checked = validateConnection({ omvormers: ['sensor.solaredge_1_power'] }, found);
    if (!checked.ok) throw new Error(checked.reden);
    const view = connectionView({ base: exampleSite, found, applied: { toegevoegd: [], overgeslagen: [] }, answersAtStart: null, answers: checked.answers, solar: null });
    expect(view.volgendeStart).toBe(true);
    expect(view.antwoorden?.omvormers).toEqual(['sensor.solaredge_1_power']);
    expect(view.vermogens.length).toBe(6);
  });
});

describe('de ontdekking', () => {
  const huis = (entities: HaRegistryEntity[], states: HaEntityState[]): Registers => ({
    config: { time_zone: 'Europe/Amsterdam' },
    areas: [{ area_id: 'woonkamer', name: 'Woonkamer' }],
    devices: [{ id: 'dev-airco', area_id: 'woonkamer' }, { id: 'dev-sensor', area_id: 'woonkamer' }, { id: 'dev-dsmr', area_id: null }],
    entities: [
      { entity_id: 'climate.airco', device_id: 'dev-airco', area_id: null },
      { entity_id: 'sensor.woonkamer_temp', device_id: 'dev-sensor', area_id: null, original_device_class: 'temperature' },
      ...entities,
    ],
    states: [
      st('climate.airco', 'off', { hvac_modes: ['off', 'cool', 'heat'], min_temp: 16, max_temp: 30 }),
      st('sensor.woonkamer_temp', '21.4', { device_class: 'temperature' }),
      ...states,
    ],
  });

  it('vindt DSMR in kW, met afname en teruglevering als paar', () => {
    const r = huis(
      [
        { entity_id: 'sensor.electricity_meter_power_consumption', device_id: 'dev-dsmr', area_id: null },
        { entity_id: 'sensor.electricity_meter_power_production', device_id: 'dev-dsmr', area_id: null },
        { entity_id: 'sensor.electricity_meter_power_consumption_phase_l1', device_id: 'dev-dsmr', area_id: null },
      ],
      [
        st('sensor.electricity_meter_power_consumption', '0.42', { device_class: 'power', unit_of_measurement: 'kW' }),
        st('sensor.electricity_meter_power_production', '0', { device_class: 'power', unit_of_measurement: 'kW' }),
        st('sensor.electricity_meter_power_consumption_phase_l1', '0.2', { device_class: 'power', unit_of_measurement: 'kW' }),
      ],
    );
    expect(discover(r).config['power']).toEqual({ gridPower: 'sensor.electricity_meter_power_consumption', gridExport: 'sensor.electricity_meter_power_production' });
  });

  it('vindt een Homey-dongle zonder device_class aan zijn eenheid', () => {
    const r = huis(
      [{ entity_id: 'sensor.homey_energy_dongle_power', device_id: null, area_id: null }],
      [st('sensor.homey_energy_dongle_power', '-640', { unit_of_measurement: 'W' })],
    );
    expect(discover(r).config['power']).toEqual({ gridPower: 'sensor.homey_energy_dongle_power' });
  });
});
