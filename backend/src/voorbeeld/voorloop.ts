/*
 * Vandaag van vóór het openen (besluit 242).
 *
 * Het voorbeeldhuis begint als iemand het opent, op het uur van de dagschuif.
 * Het logboek begon dan pas op dat moment, en Vandaag was tot dan leeg: geen
 * temperaturen, geen apparaten, geen besluiten. Hier rekent de gewone regeling
 * de uren ervoor na, om de paar minuten op de standen van dat moment, en zet
 * die besluiten in het logboek, net alsof het voorbeeld de hele dag al draaide.
 *
 * Zonder verbinding en zonder iets te sturen: een eigen ShadowRunner met een
 * eigen klok, in een tijdelijke map. Alleen het beslislogboek gaat mee; de
 * eigen stand van de echte runner blijft leeg, zoals bij elk begin.
 */

import { appendFile, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HaClient, HaEntityState } from '../adapters/homeassistant/client.js';
import { ShadowRunner } from '../adapters/homeassistant/shadow.js';
import type { SiteConfig } from '../core/model.js';
import type { StrategyRegistry } from '../core/strategy.js';

/** Om de drie minuten: korter dan het gat (tien minuten) waarbij Vandaag een periode afbreekt. */
const STAP_MS = 3 * 60_000;

const LOGBOEK = /^decisions-\d{4}-\d{2}-\d{2}\.ndjson$/;

export interface VoorloopOpties {
  readonly config: SiteConfig;
  readonly strategies: StrategyRegistry;
  /** De map van het beslislogboek van de dienst. */
  readonly logDir: string;
  /** De standen van het voorbeeld op een moment. */
  readonly standen: (nuMs: number) => HaEntityState[];
  readonly vanMs: number;
  readonly totMs: number;
}

/** Rekent de besluiten van `vanMs` tot `totMs` na en zet ze achter het logboek. Geeft het aantal momenten. */
export async function vulAan(o: VoorloopOpties): Promise<number> {
  if (o.totMs - o.vanMs < STAP_MS) return 0;
  const map = await mkdtemp(join(tmpdir(), 'sunarc-voorloop-'));
  let nu = o.vanMs;
  // Hij verbindt nooit: naRekenen krijgt de standen zelf.
  const client = { on: () => client, connect: () => {}, close: () => {} } as unknown as HaClient;
  const runner = new ShadowRunner({
    config: o.config,
    strategies: o.strategies,
    client,
    logDir: map,
    minIntervalSeconds: 0,
    watchdogMinutes: 0,
    write: () => {},
    now: () => nu,
  });
  let n = 0;
  try {
    for (; nu < o.totMs; nu += STAP_MS, n++) await runner.naRekenen(o.standen(nu));
    await runner.stateSettled();
    // Per dagbestand in één keer erachter, zodat de dienst er niet tussendoor schrijft.
    for (const naam of (await readdir(map)).filter((x) => LOGBOEK.test(x)).sort()) {
      await appendFile(join(o.logDir, naam), await readFile(join(map, naam), 'utf-8'), 'utf-8');
    }
  } finally {
    await rm(map, { recursive: true, force: true });
  }
  return n;
}

/** Het laatste moment in het logboek tussen twee tijden, of null: vanaf daar ontbreekt het. */
export async function laatsteMoment(logDir: string, vanMs: number, totMs: number): Promise<number | null> {
  let laatste: number | null = null;
  const namen = await readdir(logDir).catch(() => [] as string[]);
  for (const naam of namen.filter((x) => LOGBOEK.test(x))) {
    const tekst = await readFile(join(logDir, naam), 'utf-8').catch(() => '');
    for (const regel of tekst.split('\n')) {
      const t = /^\{"t":(\d+)/.exec(regel)?.[1];
      const ms = t == null ? NaN : Number(t);
      if (ms >= vanMs && ms <= totMs && (laatste == null || ms > laatste)) laatste = ms;
    }
  }
  return laatste;
}
