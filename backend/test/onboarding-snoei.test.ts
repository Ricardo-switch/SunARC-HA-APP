/*
 * De eerste start robuust (4 november 2026): een tester bleef hangen op "De
 * configuratie is zo niet bruikbaar". Wat de toets afkeurt en weg kan, laat
 * SunArc weg; de rest gaat door.
 */

import { describe, expect, it } from 'vitest';

import { applyChoices, discover, type Registers } from '../src/adapters/homeassistant/discovery.js';
import { parseSiteConfig } from '../src/config/schema.js';
import { defaultStrategies } from '../src/index.js';
import { snoeiVoorstel } from '../src/web/onboarding.js';

const staat = (entity_id: string, state: string, attributes: Record<string, unknown>) => ({ entity_id, state, attributes, last_changed: '2026-11-04T12:00:00+00:00', last_updated: '2026-11-04T12:00:00+00:00' });

describe('de eerste start, met wat SunArc nog niet begrijpt', () => {
  it('laat een afgekeurd apparaat weg, en zijn zone als die dan leeg is', () => {
    const config = {
      actuators: [{ id: 'a1', name: 'Airco' }, { id: 'a2', name: 'Kapotte kachel' }],
      zones: [{ id: 'z1', name: 'Woonkamer', actuatorIds: ['a1'] }, { id: 'z2', name: 'Zolder', actuatorIds: ['a2'] }],
      outdoorTemperature: 'sensor.buiten',
    };
    const toets = (c: Record<string, unknown>) => {
      const problems = [
        ...((c['actuators'] as { id: string }[]).some((a) => a.id === 'a2') ? [{ path: 'actuators[1].capabilities', message: 'kan niet verwarmen en niet koelen', severity: 'error' as const }] : []),
        ...(c['outdoorTemperature'] ? [{ path: 'outdoorTemperature', message: 'geen sensor', severity: 'error' as const }] : []),
      ];
      return (problems.length ? { ok: false, problems } : { ok: true, config: c }) as ReturnType<typeof parseSiteConfig>;
    };
    const uit = snoeiVoorstel(config, toets)!;
    expect(uit.config['actuators']).toEqual([{ id: 'a1', name: 'Airco' }]);
    expect(uit.config['zones']).toEqual([{ id: 'z1', name: 'Woonkamer', actuatorIds: ['a1'] }]);
    expect(uit.config['outdoorTemperature']).toBeUndefined();
    expect(uit.weggelaten).toEqual(['apparaat Kapotte kachel: kan niet verwarmen en niet koelen', 'zone Zolder: zonder apparaat', 'outdoorTemperature: geen sensor']);
    // Het begin blijft zoals het was.
    expect(config.actuators).toHaveLength(2);
  });

  it('geeft het op als een bezwaar nergens bij hoort dat weg kan', () => {
    const toets = () => ({ ok: false, problems: [{ path: 'schemaVersion', message: 'onbekende versie', severity: 'error' as const }] }) as ReturnType<typeof parseSiteConfig>;
    expect(snoeiVoorstel({ schemaVersion: 9 }, toets)).toBeNull();
  });

  it('haalt een echt voorstel met één kapot apparaat door de echte toets', () => {
    const registers: Registers = {
      config: { time_zone: 'Europe/Amsterdam' },
      areas: [{ area_id: 'woonkamer', name: 'Woonkamer' }, { area_id: 'zolder', name: 'Zolder' }],
      devices: [{ id: 'd1', area_id: 'woonkamer' }, { id: 'd2', area_id: 'zolder' }],
      entities: [
        { entity_id: 'climate.woonkamer', device_id: 'd1' },
        { entity_id: 'sensor.woonkamer_temp', device_id: 'd1', original_device_class: 'temperature' },
        { entity_id: 'climate.zolder', device_id: 'd2' },
        { entity_id: 'sensor.zolder_temp', device_id: 'd2', original_device_class: 'temperature' },
      ],
      states: [
        staat('climate.woonkamer', 'off', { hvac_modes: ['off', 'heat'], min_temp: 10, max_temp: 30 }),
        staat('sensor.woonkamer_temp', '19.0', { device_class: 'temperature' }),
        staat('climate.zolder', 'off', { hvac_modes: ['off', 'heat', 'cool'], min_temp: 16, max_temp: 30 }),
        staat('sensor.zolder_temp', '21.0', { device_class: 'temperature' }),
      ],
    };
    const config = applyChoices(discover(registers), {});
    const toets = (c: Record<string, unknown>) => parseSiteConfig(c, { knownStrategies: defaultStrategies().ids });
    expect(toets(config).ok).toBe(true);
    // Zoals bij een huis dat SunArc niet kent: het tweede apparaat kan niets volgens de toets.
    const kapot = structuredClone(config);
    const apparaten = kapot['actuators'] as Record<string, unknown>[];
    apparaten[1] = { ...apparaten[1], capabilities: 'kapot' };
    expect(toets(kapot).ok).toBe(false);
    const uit = snoeiVoorstel(kapot, toets)!;
    expect(uit).not.toBeNull();
    expect(toets(uit.config).ok).toBe(true);
    expect((uit.config['actuators'] as unknown[]).length).toBe(1);
    expect((uit.config['zones'] as unknown[]).length).toBe(1);
    expect(uit.weggelaten[0]).toMatch(/^apparaat /);
  });
});
