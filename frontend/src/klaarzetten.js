/*
 * Klaarzetten per niveau (besluit 246, schets Wand-Klaarzetten): het laatste
 * deel van Inrichten. Drie niveaus: voor iedereen (alles blijft in huis),
 * gevorderd (een dienst buiten je huis) en expert (je eigen netwerk). Links de
 * functies van het niveau met hoe ver ze zijn, rechts de stappen van de
 * gekozen functie; op de telefoon in een blad van onderen.
 *
 * Wat er staat, rekent de dienst uit (klaarzetten-functies.ts); deze pagina
 * zet het neer. Het adres zegt wat open is: #assistent een functie, #n-expert
 * alleen een niveau.
 */
'use strict';

const { $$, esc } = app;

let functies = null;

async function laad() {
  try {
    functies = (await klaarstappen.laad()).functies ?? [];
  } catch {
    functies ??= [];
  }
  teken();
}

const NIVEAUS = ['iedereen', 'gevorderd', 'expert'];

const IK = {
  huis: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  klimaat: '<path d="M12 3v10M8.5 16a3.5 3.5 0 1 0 7 0c0-1.3-.7-2.4-1.5-3V5a2 2 0 0 0-4 0v8c-.8.6-1.5 1.7-1.5 3z"/>',
  energie: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  licht: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  witgoed: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M7 6.5h2"/>',
  weer: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>',
  assistent: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  wand: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6"/>',
  taalmodel: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 3 5 3 3 0 0 0 5 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-3 5 3 3 0 0 1-5 1"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/><path d="M12 10v6M9.5 13.5 12 16l2.5-2.5"/>',
  telefoon: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
};
const LET_IK = {
  assistent: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/>',
  wand: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6"/>',
  telefoon: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
};

/** De drie routes naar de cloud, met waar je in Home Assistant begint. */
const ROUTES = [
  ['cloud', '/config/cloud/login'],
  ['google', '/config/integrations/dashboard/add?domain=google_cloud'],
  ['openai', '/config/integrations/dashboard/add?domain=openai_conversation'],
];

const isKlaar = (f) => f.van > 0 && f.klaar >= f.van;
/** Niets dat telt: het kan erbij, het hoeft niet. */
const isLeeg = (f) => f.van === 0;
const vanNiveau = (n) => (functies ?? []).filter((f) => f.niveau === n);

/** Wat het adres zegt: een functie, of alleen een niveau. */
function keuze() {
  const h = decodeURIComponent(location.hash.slice(1));
  const f = (functies ?? []).find((x) => x.id === h);
  if (f) return { niveau: f.niveau, functie: f };
  const niveau = NIVEAUS.find((n) => h === `n-${n}`) ?? 'iedereen';
  return { niveau, functie: null };
}
/** Op de wand staat er altijd een functie open: de eerste die nog niet klaar is. */
const eersteVan = (n) => vanNiveau(n).find((f) => f.klaar < f.van) ?? vanNiveau(n)[0] ?? null;

function niveausHtml(nu) {
  return NIVEAUS.filter((n) => vanNiveau(n).length).map((n) => {
    // Wat erbij kan maar niet nodig is, telt niet mee.
    const lijst = vanNiveau(n).filter((f) => !isLeeg(f));
    const klaar = lijst.filter(isKlaar).length;
    const stip = lijst.length && klaar === lijst.length ? 'klaar' : klaar ? 'half' : '';
    return `<a href="#n-${n}" aria-current="${n === nu ? 'page' : 'false'}"><b><i class="${stip}"></i>${esc(t(`kz.niveau.${n}`))}</b><span>${esc(t('kz.vanKlaar', { n: klaar, van: lijst.length }))}</span></a>`;
  }).join('');
}

function functiesHtml(niveau, open) {
  const rijen = vanNiveau(niveau).map((f) => {
    const klaar = isKlaar(f);
    return `<a class="functie${f.id === open?.id ? ' open' : ''}${klaar ? ' klaar' : isLeeg(f) ? '' : ' half'}" href="#${esc(f.id)}"><span class="ik"><svg viewBox="0 0 24 24" fill="none" stroke="${klaar || isLeeg(f) ? 'var(--zacht)' : 'var(--zon-t)'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IK[f.id] ?? IK.huis}</svg></span><b>${esc(f.titel)}</b>${klaarstappen.ring(f)}<span class="zin">${esc(f.zin)}</span></a>`;
  }).join('');
  return `${rijen}<p class="onder">${esc(t(`kz.onder.${niveau}`))}</p>`;
}

function routesHtml(f) {
  const gekozen = new Set(f.wolken ?? []);
  const inHA = app.inHA();
  return `<div class="routes">${ROUTES.map(([id, pad]) => `<div class="route${gekozen.has(id) ? ' gekozen' : ''}">
      <h3>${esc(t(`kz.route.${id}`))}</h3>
      <p>${esc(t(`kz.route.${id}Zin`))}</p>
      <dl><dt>${esc(t('kz.route.kost'))}</dt><dd>${esc(t(`kz.route.${id}Kost`))}</dd><dt>${esc(t('kz.route.sleutel'))}</dt><dd>${esc(t(`kz.route.${id}Sleutel`))}</dd></dl>
      ${inHA ? `<button type="button" class="kz-doe ha naar" data-route-pad="${esc(pad)}">${esc(t(gekozen.has(id) ? 'kz.route.bekijk' : 'kz.route.begin'))}</button>` : ''}
    </div>`).join('')}</div>`;
}

function stappenHtml(f) {
  if (!f) return '';
  const open = f.van - f.klaar;
  const stand = f.id === 'cloud' && !(f.wolken ?? []).length ? `<span class="stand half">${esc(t('kz.kiesRoute'))}</span>` : isLeeg(f) ? '' : open ? `<span class="stand half">${esc(f.zin)}</span>` : `<span class="stand klaar">${esc(t('kz.allesKlaar'))}</span>`;
  const letOp = LET_IK[f.id] ? `<p class="let"><svg viewBox="0 0 24 24" fill="none" stroke="var(--zacht)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LET_IK[f.id]}</svg><span><b>${esc(t(`kz.let.${f.id}`))}</b> ${esc(t(`kz.let.${f.id}Zin`))}</span></p>` : '';
  return `<button type="button" class="sluit" data-sluit aria-label="${esc(t('kz.sluit'))}">×</button>
    <div class="boven"><div><h2>${esc(f.titel)}</h2><p class="wat">${esc(f.wat)}</p></div>${stand}</div>
    ${f.id === 'cloud' ? routesHtml(f) : ''}
    ${klaarstappen.lijst(f.stappen)}
    ${letOp}`;
}

function tekenNu() {
  app.schaal();
  if (!functies) {
    $$('[data-functies]').forEach((el) => (el.innerHTML = `<p class="onder">${esc(t('kz.lezen'))}</p>`));
    return;
  }
  const tel = app.telStand();
  const k = keuze();
  // Op de wand staat altijd een functie open; op de telefoon alleen na een tik.
  const open = k.functie ?? (tel ? null : eersteVan(k.niveau));
  $$('[data-niveaus]').forEach((el) => (el.innerHTML = niveausHtml(k.niveau)));
  $$('[data-functies]').forEach((el) => (el.innerHTML = functiesHtml(k.niveau, open)));
  $$('[data-stappen]').forEach((el) => {
    el.hidden = !open;
    el.innerHTML = stappenHtml(open);
  });
  $$('[data-achter]').forEach((el) => (el.hidden = !(tel && open)));
}

/* -------------------------------------------------------------- starten */

/** Gebundeld: hooguit één keer per beeld (basis.js). */
const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);
addEventListener('hashchange', teken);

app.start('instellingen');
function sluit() {
  const f = keuze().functie;
  history.replaceState(null, '', f ? `#n-${f.niveau}` : location.pathname);
  teken();
}
document.addEventListener('click', (e) => {
  if (klaarstappen.klik(e, laad)) return;
  const route = e.target.closest('[data-route-pad]');
  if (route) app.naarHAScherm(route.dataset.routePad);
  else if (e.target.closest('[data-sluit], [data-achter]')) sluit();
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.telStand() && keuze().functie) sluit();
});
void laad();
// Een stap vinkt zichzelf af: wie in Home Assistant iets deed, ziet het bij terugkomen.
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void laad();
});
setInterval(() => void laad(), 60_000);
