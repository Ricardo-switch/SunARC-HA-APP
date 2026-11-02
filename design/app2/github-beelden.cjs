/*
 * De beelden voor GitHub (2 november 2026): uit de echte app in het
 * voorbeeldhuis, in het Nederlands en in het Engels. Start eerst het
 * voorbeeldhuis (in het Engels met HEMS_VOORBEELD_TAAL=en), dan:
 *
 *   node github-beelden.cjs <poort> <nl|en>
 *
 * De beelden komen in screens/github/<taal>-*.png.
 */
'use strict';
const path = require('node:path');
const { chromium } = require(path.join(__dirname, '../../backend/node_modules/playwright'));

const [poort, taal] = process.argv.slice(2);
if (!poort || !['nl', 'en'].includes(taal)) {
  console.error('gebruik: node github-beelden.cjs <poort> <nl|en>');
  process.exit(1);
}
const basis = `http://127.0.0.1:${poort}`;
const uit = (naam) => path.join(__dirname, 'screens', 'github', `${taal}-${naam}.png`);
const VRAAG = { nl: 'Hoe warm is het in de woonkamer?', en: 'How warm is the living room?' };

(async () => {
  const browser = await chromium.launch({ channel: process.env.HEMS_PAGE_BROWSER || 'msedge' });
  const opzet = async (viewport) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: taal === 'en' ? 'en-GB' : 'nl-NL', timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce' });
    // Dezelfde tijd als het voorbeeldhuis: 15 juli, kwart voor één (start.ts begint om 12:40).
    await context.clock.setFixedTime(new Date(`${new Date().getFullYear()}-07-15T12:45:00+02:00`));
    await context.addInitScript((code) => {
      localStorage.setItem('sc-taal', code);
      localStorage.setItem('sc-rondleiding-gezien', '1');
    }, taal);
    return context;
  };
  const foto = async (p, url, naam, voor) => {
    await p.goto(`${basis}/${url}`);
    await p.waitForTimeout(3500);
    if (voor) await voor(p);
    await p.screenshot({ path: uit(naam) });
    console.log('ok', naam);
  };

  const wand = await opzet({ width: 1280, height: 800 });
  const w = await wand.newPage();
  await foto(w, 'thuis.html', 'wand-thuis');
  await foto(w, 'vandaag.html', 'wand-vandaag');
  await foto(w, 'assistent.html', 'wand-assistent', async (p) => {
    await p.locator('#wand form[data-vrij] input').fill(VRAAG[taal]);
    await p.locator('#wand form[data-vrij] input').press('Enter');
    await p.waitForTimeout(4000);
  });
  await foto(w, 'huis-kan.html', 'wand-huis-kan');
  await foto(w, 'klaarzetten.html', 'wand-klaarzetten');

  const tel = await opzet({ width: 390, height: 844 });
  const t = await tel.newPage();
  await foto(t, 'thuis.html', 'tel-thuis');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
