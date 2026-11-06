/**
 * De thuisbatterij en de auto herkennen in Home Assistant (besluit 182): per
 * apparaat, op wat het meet en wie het levert.
 */

import { describe, expect, it } from 'vitest';

import type { HaEntityState } from '../src/adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../src/adapters/homeassistant/discovery.js';
import { autoApparaten, ladenView, leesLaden, vindOpslag, type LadenKeuze } from '../src/web/opslag.js';

type Meting = { id: string; klasse?: string; staat: string; eenheid?: string; naam?: string; platform: string; apparaat: string; extra?: Record<string, unknown> };

function registers(apparaten: HaDevice[], metingen: Meting[]) {
  const entities: HaRegistryEntity[] = metingen.map((m) => ({ entity_id: m.id, device_id: m.apparaat, platform: m.platform, original_device_class: m.klasse ?? null, original_name: m.naam ?? null }));
  const states = new Map<string, HaEntityState>(
    metingen.map((m) => [m.id, { entity_id: m.id, state: m.staat, attributes: { ...(m.eenheid ? { unit_of_measurement: m.eenheid } : {}), ...(m.naam ? { friendly_name: m.naam } : {}), ...(m.extra ?? {}) }, last_changed: '', last_updated: '' }]),
  );
  return { reg: { devices: apparaten, entities }, states };
}
function huis(apparaten: HaDevice[], metingen: Meting[], keuze: LadenKeuze | null = null) {
  const { reg, states } = registers(apparaten, metingen);
  return vindOpslag(reg, states, keuze);
}
const geenKeuze = { plek: null, accuKWh: null, laadpaal: null };

const knop: HaDevice = { id: 'knop', area_id: null, name: 'Knop hal', manufacturer: 'IKEA', model: 'STYRBAR' };
const knopBatterij: Meting = { id: 'sensor.knop_batterij', klasse: 'battery', staat: '80', eenheid: '%', platform: 'zha', apparaat: 'knop' };

describe('de thuisbatterij en de auto (besluit 182)', () => {
  it('vindt niets in een huis zonder, ook niet de batterij van een knop', () => {
    expect(huis([knop], [knopBatterij])).toEqual({ batterij: null, auto: null, autos: [] });
  });

  it('herkent een thuisbatterij, met laden en leveren uit het vermogen', () => {
    const sessy: HaDevice = { id: 'sessy', area_id: null, name: 'Sessy', manufacturer: 'Charged', model: 'Sessy' };
    const met = (w: string) => huis([knop, sessy], [
      knopBatterij,
      { id: 'sensor.sessy_state_of_charge', klasse: 'battery', staat: '78', eenheid: '%', platform: 'sessy', apparaat: 'sessy' },
      { id: 'sensor.sessy_power', klasse: 'power', staat: w, eenheid: 'W', naam: 'Sessy battery power', platform: 'sessy', apparaat: 'sessy' },
    ]);
    expect(met('1800').batterij).toEqual({ id: 'sessy', naam: 'De batterij', pct: 78, vermogenW: 1800, stand: 'laadt' });
    expect(met('-900').batterij).toMatchObject({ vermogenW: -900, stand: 'levert' });
    expect(met('12').batterij).toMatchObject({ stand: 'rust' });
    expect(met('unavailable').batterij).toMatchObject({ pct: 78, vermogenW: null, stand: null });
    expect(met('1800').auto).toBeNull();
  });

  it('leest apart laden en ontladen, en een Powerwall die leveren positief noemt', () => {
    const accu: HaDevice = { id: 'accu', area_id: null, name: 'Thuisbatterij', manufacturer: 'Huawei', model: 'LUNA2000' };
    const twee = huis([accu], [
      { id: 'sensor.luna_soc', klasse: 'battery', staat: '54', eenheid: '%', platform: 'huawei_solar', apparaat: 'accu' },
      { id: 'sensor.luna_charge_power', klasse: 'power', staat: '0', eenheid: 'kW', naam: 'Battery charge power', platform: 'huawei_solar', apparaat: 'accu' },
      { id: 'sensor.luna_discharge_power', klasse: 'power', staat: '0.9', eenheid: 'kW', naam: 'Battery discharge power', platform: 'huawei_solar', apparaat: 'accu' },
    ]);
    expect(twee.batterij).toMatchObject({ pct: 54, vermogenW: -900, stand: 'levert' });
    const pw: HaDevice = { id: 'pw', area_id: null, name: 'Powerwall', manufacturer: 'Tesla', model: 'Powerwall 2' };
    const powerwall = huis([pw], [
      { id: 'sensor.powerwall_charge', klasse: 'battery', staat: '90', eenheid: '%', platform: 'powerwall', apparaat: 'pw' },
      { id: 'sensor.powerwall_battery_power', klasse: 'power', staat: '1.2', eenheid: 'kW', naam: 'Powerwall Battery Power', platform: 'powerwall', apparaat: 'pw' },
    ]);
    expect(powerwall.batterij).toMatchObject({ vermogenW: -1200, stand: 'levert' });
    expect(powerwall.auto).toBeNull();
  });

  it('herkent een auto met zijn lading, bereik, stekker en laden', () => {
    const tesla: HaDevice = { id: 'tesla', area_id: null, name: 'Tesla Model 3', manufacturer: 'Tesla', model: 'Model 3' };
    const op = huis([tesla], [
      { id: 'sensor.model_3_battery', klasse: 'battery', staat: '62', eenheid: '%', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'sensor.model_3_range', klasse: 'distance', staat: '280', eenheid: 'km', naam: 'Battery range', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'sensor.model_3_charger_power', klasse: 'power', staat: '3.2', eenheid: 'kW', naam: 'Charger power', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'binary_sensor.model_3_charge_cable', klasse: 'plug', staat: 'on', platform: 'teslemetry', apparaat: 'tesla' },
      { id: 'binary_sensor.model_3_charging', klasse: 'battery_charging', staat: 'on', platform: 'teslemetry', apparaat: 'tesla' },
    ]);
    expect(op.auto).toEqual({ id: 'tesla', naam: 'Tesla Model 3', pct: 62, aangesloten: true, laadt: true, vermogenW: 3200, bereikKm: 280, ...geenKeuze });
    // Een auto is geen thuisbatterij, ook al heeft hij een lading in procenten.
    expect(op.batterij).toBeNull();
  });

  it('neemt een laadpaal zonder auto in Home Assistant als de auto', () => {
    const easee: HaDevice = { id: 'easee', area_id: null, name: 'Easee Home', manufacturer: 'Easee', model: 'Home' };
    const paal = (status: string, w: string) => huis([easee], [
      { id: 'sensor.easee_status', staat: status, naam: 'Easee status', platform: 'easee', apparaat: 'easee' },
      { id: 'sensor.easee_power', klasse: 'power', staat: w, eenheid: 'kW', naam: 'Easee power', platform: 'easee', apparaat: 'easee' },
    ]).auto;
    expect(paal('charging', '7.4')).toEqual({ id: 'easee', naam: 'De auto', pct: null, aangesloten: true, laadt: true, vermogenW: 7400, bereikKm: null, ...geenKeuze });
    expect(paal('disconnected', '0')).toMatchObject({ aangesloten: false, laadt: false });
    expect(paal('awaiting_start', '0')).toMatchObject({ aangesloten: true, laadt: false });
  });
});

describe('meer auto’s en laadpalen, en wat de bewoner koos (besluit 259)', () => {
  const tesla: HaDevice = { id: 'tesla', area_id: null, name: 'Model 3', manufacturer: 'Tesla', model: 'Model 3' };
  const kia: HaDevice = { id: 'kia', area_id: null, name: 'EV6', manufacturer: 'Kia', model: 'EV6' };
  const easee: HaDevice = { id: 'easee', area_id: null, name: 'Easee Home', manufacturer: 'Easee', model: 'Home' };
  const micra: HaDevice = { id: 'micra', area_id: null, name: 'MICRA', manufacturer: 'Nissan', model: 'MICRA' };
  const metingen: Meting[] = [
    { id: 'sensor.model_3_battery', klasse: 'battery', staat: '62', eenheid: '%', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'sensor.model_3_range', klasse: 'distance', staat: '280', eenheid: 'km', naam: 'Battery range', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'number.model_3_charge_limit', staat: '80', eenheid: '%', naam: 'Charge limit', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'device_tracker.model_3_location', staat: 'home', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'climate.model_3_climate', staat: 'off', platform: 'teslemetry', apparaat: 'tesla' },
    { id: 'sensor.ev6_battery', klasse: 'battery', staat: '40', eenheid: '%', platform: 'kia_uvo', apparaat: 'kia' },
    { id: 'binary_sensor.ev6_plugged_in', klasse: 'plug', staat: 'off', platform: 'kia_uvo', apparaat: 'kia' },
    { id: 'sensor.easee_status', staat: 'charging', naam: 'Easee status', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_power', klasse: 'power', staat: '7.4', eenheid: 'kW', naam: 'Easee power', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.easee_session_energy', klasse: 'energy', staat: '12', eenheid: 'kWh', naam: 'Session energy', platform: 'easee', apparaat: 'easee' },
    { id: 'number.easee_dynamic_charger_limit', staat: '16', eenheid: 'A', naam: 'Dynamic charger limit', platform: 'easee', apparaat: 'easee', extra: { min: 6, max: 32 } },
    { id: 'switch.easee_charger_enabled', staat: 'on', naam: 'Charger enabled', platform: 'easee', apparaat: 'easee' },
    { id: 'sensor.knop_batterij', klasse: 'battery', staat: '80', eenheid: '%', platform: 'zha', apparaat: 'knop' },
  ];

  it('vindt twee auto’s en een laadpaal, met wat elk meet en kan', () => {
    const { reg, states } = registers([tesla, kia, easee, knop], metingen);
    const v = ladenView(reg, states, null);
    expect(v.apparaten.map((x) => [x.id, x.rol, x.aan, x.zelf])).toEqual([
      ['kia', 'auto', true, false],
      ['tesla', 'auto', true, false],
      ['easee', 'laadpaal', true, false],
    ]);
    expect(v.apparaten.find((x) => x.id === 'tesla')!.wat).toEqual(['lading', 'bereik', 'laadgrens', 'thuis']);
    expect(v.apparaten.find((x) => x.id === 'kia')!.wat).toEqual(['lading', 'kabel']);
    const paal = v.apparaten.find((x) => x.id === 'easee')!;
    expect(paal).toMatchObject({ merk: 'Easee', stroomA: { min: 6, max: 32 } });
    expect(paal.wat).toEqual(['vermogen', 'sessie', 'stand', 'stroomZetten', 'pauzeren']);
    // De knop meet een batterij: die is te kiezen, maar niet gevonden als auto.
    expect(v.kandidaten).toEqual([{ id: 'knop', naam: 'Knop hal' }]);
  });

  it('koppelt een auto aan de enige laadpaal, of aan de gekozen', () => {
    const zonder = huis([tesla, kia, easee], metingen);
    expect(zonder.autos.map((a) => [a.id, a.laadpaal, a.vermogenW])).toEqual([
      ['kia', 'easee', 7400],
      ['tesla', 'easee', 7400],
    ]);
    const keuze: LadenKeuze = { aan: { kia: false }, rol: {}, instelling: { tesla: { accuKWh: 75, laadpaal: 'easee', plek: 'garage' } } };
    const met = huis([tesla, kia, easee], metingen, keuze);
    expect(met.autos).toHaveLength(1);
    expect(met.auto).toMatchObject({ id: 'tesla', naam: 'Model 3', pct: 62, laadt: true, plek: 'garage', accuKWh: 75, laadpaal: 'easee' });
  });

  it('neemt een zelf gekozen apparaat als auto, en zet een laadpaal zonder auto in zijn plek', () => {
    const vreemd: HaDevice = { id: 'vreemd', area_id: null, name: 'Mijn wagen', manufacturer: 'Onbekend', model: 'X' };
    const m: Meting[] = [{ id: 'sensor.wagen_soc', klasse: 'battery', staat: '55', eenheid: '%', platform: 'mqtt', apparaat: 'vreemd' }];
    expect(huis([vreemd], m).auto).toBeNull();
    const zelf = huis([vreemd], m, { aan: {}, rol: { vreemd: 'auto' }, instelling: {} });
    expect(zelf.auto).toMatchObject({ id: 'vreemd', naam: 'Mijn wagen', pct: 55 });
    const { reg, states } = registers([vreemd], m);
    expect(ladenView(reg, states, { aan: {}, rol: { vreemd: 'auto' }, instelling: {} }).apparaten[0]).toMatchObject({ zelf: true, rol: 'auto' });
    const paal = huis([easee], metingen.filter((x) => x.apparaat === 'easee'), { aan: {}, rol: {}, instelling: { easee: { accuKWh: null, laadpaal: null, plek: 'carport' } } });
    expect(paal.auto).toMatchObject({ id: 'easee', naam: 'De auto', plek: 'carport', accuKWh: null });
  });

  it('kent evcc apart: zijn laadpunt is geen auto', () => {
    const lp: HaDevice = { id: 'lp1', area_id: null, name: 'Laadpunt garage', manufacturer: 'evcc', model: 'Loadpoint' };
    const m: Meting[] = [
      { id: 'sensor.evcc_lp1_vehicle_soc', klasse: 'battery', staat: '50', eenheid: '%', platform: 'evcc_intg', apparaat: 'lp1' },
      { id: 'sensor.evcc_lp1_vehicle_range', klasse: 'distance', staat: '200', eenheid: 'km', naam: 'Vehicle range', platform: 'evcc_intg', apparaat: 'lp1' },
    ];
    const { reg, states } = registers([lp], m);
    expect(ladenView(reg, states, null)).toMatchObject({ apparaten: [], evcc: [{ id: 'lp1', naam: 'Laadpunt garage' }] });
    expect(huis([lp], m).auto).toBeNull();
  });

  it('herkent een Nissan via NissanConnect als auto, voor zijn klimaat (melding 132)', () => {
    const { reg, states } = registers([micra, knop], [
      { id: 'climate.micra_climate', staat: 'off', platform: 'nissan_connect', apparaat: 'micra' },
      { id: 'sensor.micra_battery', klasse: 'battery', staat: '70', eenheid: '%', platform: 'nissan_connect', apparaat: 'micra' },
      knopBatterij,
    ]);
    expect([...autoApparaten(reg, states)]).toEqual(['micra']);
  });

  it('leest wat de pagina stuurt, en weigert wat niet klopt', () => {
    expect(leesLaden(null)).toEqual({ keuze: null });
    expect(leesLaden({ aan: {}, rol: {}, instelling: {} })).toEqual({ keuze: null });
    expect(leesLaden({ aan: { kia: false }, instelling: { tesla: { accuKWh: 75.04, plek: 'garage' } } })).toEqual({
      keuze: { aan: { kia: false }, rol: {}, instelling: { tesla: { accuKWh: 75, laadpaal: null, plek: 'garage' } } },
    });
    expect(leesLaden({ rol: { x: 'fiets' } })).toHaveProperty('fout');
    expect(leesLaden({ instelling: { x: { accuKWh: 900 } } })).toHaveProperty('fout');
    expect(leesLaden({ instelling: { x: { plek: 'dak' } } })).toHaveProperty('fout');
    expect(leesLaden({ aan: { 'kapot id met spaties': true } })).toHaveProperty('fout');
  });
});
