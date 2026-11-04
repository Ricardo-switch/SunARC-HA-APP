/*
 * Het logboek om te delen (4 november 2026): wat erin mag, en wat er altijd
 * uit gaat.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { bewaarRegel, leegLogboek, logboek, schoon } from '../src/web/logboek.js';

describe('het logboek om te delen', () => {
  beforeEach(() => leegLogboek());

  it('haalt adressen, sleutels, wachtwoorden en e-mail weg, en laat entiteiten staan', () => {
    const tekst = schoon(
      'sensor.slaapkamer_sepp_temperatuur gaf niets via http://192.168.67.52:8123 met Bearer abc.def-ghi, token=geheim123 en "password": "hunter2", mail ricardo@example.nl, ' +
        'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl, lang ' + 'a'.repeat(48) + ', ipv6 fe80::1:2:3:4 en https://gebruiker:pw@example.nl/pad',
    );
    expect(tekst).toContain('sensor.slaapkamer_sepp_temperatuur');
    for (const weg of ['192.168.67.52', 'abc.def-ghi', 'geheim123', 'hunter2', 'ricardo@example.nl', 'eyJhbGci', 'a'.repeat(48), 'fe80::1:2:3:4', 'gebruiker:pw']) expect(tekst).not.toContain(weg);
    expect(tekst).toContain('[ip]');
    expect(tekst).toContain('Bearer [weg]');
  });

  it('houdt de laatste honderd regels, met fouten en de eerste regels van hun stapel', () => {
    for (let i = 0; i < 120; i++) bewaarRegel('waarschuwing', [`regel ${i}`], i);
    bewaarRegel('fout', ['Opbrengst:', new Error('kapot')], 999);
    const r = logboek();
    expect(r).toHaveLength(100);
    expect(r[0]!.tekst).toBe('regel 21');
    expect(r.at(-1)).toMatchObject({ niveau: 'fout', ms: 999 });
    expect(r.at(-1)!.tekst).toMatch(/^Opbrengst: kapot\n\s+at /);
  });
});
