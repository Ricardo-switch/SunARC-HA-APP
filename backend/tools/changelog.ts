/**
 * Schrijft `addon/CHANGELOG.md` uit `NIEUW` in `src/version.ts` (21 oktober 2026):
 *
 *   npm run changelog
 *
 * De Supervisor leest dat bestand van GitHub, en Home Assistant geeft het als
 * releasenotes van de nieuwste versie; per uitgave op main (`OP_MAIN`) één
 * overzicht, ook als er versies alleen op beta tussen zaten; zo ziet de app bij een update wat er
 * nieuw is (`src/web/bijwerken.ts`). Een test eist dat het bestand klopt.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { changelog, perUitgave } from '../src/web/bijwerken.js';
import { NIEUW, OP_MAIN } from '../src/version.js';

const PATH = fileURLToPath(new URL('../../addon/CHANGELOG.md', import.meta.url));
await writeFile(PATH, changelog(NIEUW, OP_MAIN));
console.log(`addon/CHANGELOG.md bijgewerkt: ${NIEUW.length} versies in ${perUitgave(NIEUW, OP_MAIN).length} uitgaven.`);
