/**
 * De gegevens van een apparaat om te delen (testerronde, november 2026). Een
 * tester met een merk dat SunArc niet goed kent (Luxtronik, Clivet/Midea),
 * stuurt mee wat Home Assistant van het apparaat zegt, zodat het herkennen
 * beter kan. Alleen wat over het soort apparaat gaat: de integratie, het merk
 * en model, de stand en de eigenschappen. Geen namen, geen entiteiten, geen
 * adressen, geen serienummers; strings alleen bij eigenschappen die een stand
 * of eenheid noemen. De bewoner ziet het eerst, en stuurt het zelf.
 */

import type { HaEntityState } from '../adapters/homeassistant/client.js';
import type { HaDevice, HaRegistryEntity } from '../adapters/homeassistant/discovery.js';

/** Eigenschappen met een tekst die over het soort apparaat gaat, niet over het huis. */
const TEKST_MAG = new Set([
  'hvac_mode', 'hvac_modes', 'hvac_action', 'preset_mode', 'preset_modes', 'fan_mode', 'fan_modes', 'swing_mode', 'swing_modes',
  'swing_horizontal_mode', 'swing_horizontal_modes', 'operation_mode', 'operation_list', 'current_operation', 'state_class',
  'device_class', 'unit_of_measurement', 'temperature_unit', 'target_temp_step', 'supported_features', 'away_mode', 'aux_heat',
  'is_on', 'mode', 'modes', 'options', 'status', 'action', 'heating', 'cooling',
]);
/** Wat nooit mee gaat, ook als het een getal is. */
const NOOIT = /name|picture|icon|serial|mac|ip(?:_|$)|address|adres|latitude|longitude|gps|token|key|password|ssid|id$|_id|url|host|user|friendly/i;
const KORT = /^[\w .+:%/°-]{1,40}$/;

type Waarde = string | number | boolean | null | readonly (string | number)[];

function veilig(sleutel: string, v: unknown): Waarde | undefined {
  if (NOOIT.test(sleutel)) return undefined;
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') return TEKST_MAG.has(sleutel) && KORT.test(v) ? v : undefined;
  if (Array.isArray(v) && TEKST_MAG.has(sleutel)) {
    const lijst = v.filter((x): x is string | number => (typeof x === 'string' && KORT.test(x)) || (typeof x === 'number' && Number.isFinite(x)));
    return lijst.slice(0, 30);
  }
  return undefined;
}

function eigenschappen(st: HaEntityState | undefined): Record<string, Waarde> {
  const uit: Record<string, Waarde> = {};
  for (const [k, v] of Object.entries(st?.attributes ?? {})) {
    const w = veilig(k, v);
    if (w !== undefined) uit[k] = w;
  }
  return uit;
}

/** De stand zelf: een getal of een korte stand, anders weg. */
const stand = (s: string | undefined): string | null => (s != null && KORT.test(s) ? s : null);

export interface ApparaatGegevens {
  readonly domein: string;
  readonly koppeling: string | null;
  readonly merk: string | null;
  readonly model: string | null;
  readonly stand: string | null;
  readonly eigenschappen: Record<string, Waarde>;
  /** De andere entiteiten van hetzelfde apparaat, zonder hun naam: wat voor soort, en wat ze nu zeggen. */
  readonly ernaast: readonly { domein: string; soort: string | null; eenheid: string | null; stand: string | null }[];
}

export function apparaatGegevens(
  entityId: string,
  states: ReadonlyMap<string, HaEntityState>,
  entities: readonly HaRegistryEntity[],
  devices: readonly HaDevice[],
): ApparaatGegevens | null {
  const st = states.get(entityId);
  if (!st) return null;
  const reg = entities.find((e) => e.entity_id === entityId);
  const dev = reg?.device_id ? devices.find((d) => d.id === reg.device_id) : undefined;
  const merkModel = (v: unknown) => (typeof v === 'string' && KORT.test(v) ? v : null);
  const ernaast = reg?.device_id
    ? entities
        .filter((e) => e.device_id === reg.device_id && e.entity_id !== entityId && !e.disabled_by)
        .slice(0, 40)
        .map((e) => {
          const s = states.get(e.entity_id);
          const a = (s?.attributes ?? {}) as Record<string, unknown>;
          return {
            domein: e.entity_id.split('.')[0] ?? '',
            soort: typeof a['device_class'] === 'string' ? (a['device_class'] as string) : null,
            eenheid: typeof a['unit_of_measurement'] === 'string' ? (a['unit_of_measurement'] as string) : null,
            stand: stand(s?.state),
          };
        })
    : [];
  return {
    domein: entityId.split('.')[0] ?? '',
    koppeling: reg?.platform ?? null,
    merk: merkModel(dev?.manufacturer),
    model: merkModel(dev?.model),
    stand: stand(st.state),
    eigenschappen: eigenschappen(st),
    ernaast,
  };
}
