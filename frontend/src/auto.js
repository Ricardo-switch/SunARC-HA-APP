/*
 * De pagina Auto (besluit 259, stap 2; schets Wand-Auto en Tel-Auto): om te
 * kijken. Per auto hoe vol hij is, of hij laadt en met hoeveel, de stroom per
 * fase, de kabel, het bereik, de laadgrens, hoe laat hij vol is en of hij
 * onderweg is. Alles komt van de dienst (`api/huis`, `opslag.autos`); de
 * pagina zet het neer. Of het laden op zon gaat, volgt uit het net nu
 * (`api/state`): komt er niets van het net, dan is het eigen zon.
 *
 * De laadbeurten (stap 3) komen apart (`api/laadbeurten`): uit de statistiek
 * van Home Assistant, de laatste week, met kWh, kosten en het deel eigen zon.
 *
 * Instellen gebeurt bij Energie › Auto en laadpaal; bedienen en advies komen
 * in de volgende stappen (docs/auto-en-laadpaal.md).
 */
'use strict';

const { $$, nl, esc, klokVan, wanneer, haal } = app;
const { t } = taal;

let huisData = null;
let state = null;
let fout = null;
/** De gekozen auto: uit het adres (auto.html#id), anders de eerste. */
let gekozen = decodeURIComponent(location.hash.slice(1)) || null;

async function laad() {
  const [h, s] = await Promise.allSettled([haal('api/huis'), haal('api/state')]);
  if (h.status === 'fulfilled') {
    huisData = h.value;
    fout = null;
  } else if (!huisData) fout = t('groep.geenVerbinding');
  if (s.status === 'fulfilled') state = s.value;
  teken();
}

/** De laadbeurten per auto: undefined is nog onderweg, null is niets te tonen. */
const beurten = new Map();
const BEURT_MS = 5 * 60_000;

async function laadBeurten(id, vers = false) {
  const b = beurten.get(id);
  if (b && (b.bezig || (!vers && Date.now() - b.at < BEURT_MS))) return;
  beurten.set(id, { at: Date.now(), data: b?.data, bezig: true });
  let data = b?.data ?? null;
  try {
    data = (await haal(`api/laadbeurten?auto=${encodeURIComponent(id)}`)).beurten ?? null;
  } catch {
    // Dan wat er al was.
  }
  beurten.set(id, { at: Date.now(), data, bezig: false });
  teken();
}

const autos = () => huisData?.opslag?.autos ?? [];
const deAuto = () => autos().find((a) => a.id === gekozen) ?? autos()[0] ?? null;

/** Laadt hij op zon? Uit het net nu: komt er niets van het net, dan is het eigen zon. */
function bron(a) {
  if (!a.laadt) return null;
  const s = state?.bewoner?.stromen;
  if (s?.netKw == null) return 'onbekend';
  if (s.netKw <= 0.05) return 'zon';
  return (s.zonKw ?? 0) > 0.1 ? 'deels' : 'net';
}

/** De stand in woorden, met zijn kleur. */
function stand(a) {
  if (a.thuis === false) return { tekst: t('auto.stand.weg'), kleur: 'var(--zacht)' };
  const b = bron(a);
  if (b === 'zon') return { tekst: t('auto.stand.zon'), kleur: 'var(--zon)', gloed: true };
  if (b === 'deels') return { tekst: t('auto.stand.deels'), kleur: 'var(--zon)', gloed: true };
  if (b === 'net') return { tekst: t('auto.stand.net'), kleur: 'var(--ijs)', gloed: true };
  if (b === 'onbekend') return { tekst: t('auto.stand.laadt'), kleur: 'var(--mint)', gloed: true };
  if (a.aangesloten && a.pct != null && a.pct >= (a.laadgrens ?? 100)) return { tekst: t('auto.stand.vol'), kleur: 'var(--mint)' };
  if (a.aangesloten === true) return { tekst: t('auto.stand.erin'), kleur: 'var(--zacht)' };
  if (a.aangesloten === false) return { tekst: t('auto.stand.eruit'), kleur: 'var(--zacht)' };
  return { tekst: t(a.thuis ? 'auto.stand.thuis' : 'auto.stand.onbekend'), kleur: 'var(--zacht)' };
}

/** De stroom per fase kort: "3 × 6 A" als ze gelijk zijn, anders "6 · 6 · 5 A". */
function fasenKort(stroomA) {
  const aan = (stroomA ?? []).filter((x) => x >= 0.5);
  if (!aan.length) return '';
  const gelijk = Math.max(...aan) - Math.min(...aan) < 0.6;
  return gelijk ? `${aan.length} × ${nl(Math.round(aan[0]), 0)} A` : `${aan.map((x) => nl(x, 0)).join(' · ')} A`;
}

/** Een tijd die nog komt: vandaag de klok, anders "morgen" erbij. */
function straks(iso) {
  const ms = Date.parse(iso);
  return new Date(ms).toDateString() === new Date().toDateString() ? klokVan(ms) : t('auto.morgen', { tijd: klokVan(ms) });
}
const geweest = (iso) => wanneer(Date.parse(iso));

function tekening(a) {
  const weg = a.thuis === false;
  const b = bron(a);
  const kabel = a.laadt ? (b === 'net' ? 'net' : 'zon') : a.aangesloten ? 'erin' : 'vrij';
  return autoTekening({
    pct: a.pct,
    grens: a.laadgrens,
    kabel,
    auto: !weg,
    // Een auto zonder laadpaal staat er alleen; een laadpaal zonder auto is de auto.
    paal: a.paalNaam != null,
    tekst: { leeg: t(`auto.tekening.leeg.${a.plek ?? 'oprit'}`) },
  });
}

/** Rechtsboven: hoe vol, of waarom de app het niet weet. */
function pctDeel(a) {
  if (a.thuis === false) return `<p>${esc(a.wegSinds ? t('auto.wegSinds', { tijd: geweest(a.wegSinds) }) : t('auto.weg'))}</p>`;
  if (a.pct == null) return `<p>${esc(t('auto.alleenPaal'))}</p>`;
  return `<b>${nl(a.pct, 0)}<sup>%</sup></b>${a.bereikKm != null ? `<span>${esc(t('auto.bereik', { km: nl(a.bereikKm, 0) }))}</span>` : ''}`;
}

/** Linksboven: de stand, en het vermogen met de stroom per fase. */
function standDeel(a) {
  const s = stand(a);
  let onder = '';
  if (a.thuis === false && a.pct != null) onder = `${nl(a.pct, 0)}%${a.bereikKm != null ? `<small>${esc(t('auto.bereik', { km: nl(a.bereikKm, 0) }))}</small>` : ''}`;
  else if (a.laadt && a.vermogenW != null) onder = `${nl(a.vermogenW / 1000)} kW${fasenKort(a.stroomA) ? `<small>${esc(fasenKort(a.stroomA))}</small>` : ''}`;
  return `<div><div class="stand"${s.gloed ? ' data-gloed' : ''} style="color: ${s.kleur}"><i></i><span>${esc(s.tekst)}</span></div>${onder ? `<div class="vermogen">${onder}</div>` : ''}</div>`;
}

/** Een paar woorden achter elkaar, met een hoofdletter vooraan. */
const huismodelZin = (delen) => {
  const s = delen.filter(Boolean).join(' · ');
  return s ? s[0].toUpperCase() + s.slice(1) : '';
};
const plekWoord = (a) => (a.plek ? t(`auto.plek.${a.plek}`) : '');

/* ---- de laadbeurten (stap 3) ---- */

const zonPct = (b) => (b.kWh > 0 && b.zonKWh != null ? Math.round((b.zonKWh / b.kWh) * 100) : null);
const zonBalk = (pct) => `<div class="zonbalk"><i style="width: ${pct}%"></i></div>`;

/** De dag van een beurt: vandaag, gisteren of de dag van de week. */
function dagVan(ms) {
  const d = new Date(ms).toDateString();
  if (d === new Date().toDateString()) return t('auto.beurt.vandaag');
  if (d === new Date(Date.now() - 86_400_000).toDateString()) return t('auto.beurt.gisteren');
  // Een week terug heeft dezelfde dag als vandaag: dan met de datum erbij.
  const oud = Date.now() - ms > 6 * 86_400_000;
  const w = taal.datum(ms, oud ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'long' });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function beurtRegel(b) {
  const tijd = `${klokVan(Date.parse(b.van))} – ${b.bezig ? t('auto.beurt.nu') : klokVan(Date.parse(b.tot))}`;
  const z = zonPct(b);
  return `<div class="beurt"${z != null ? ` title="${esc(t('auto.beurt.zonZin', { pct: z }))}"` : ''}>
      <div><b>${esc(dagVan(Date.parse(b.van)))}</b><span>${esc(tijd)}</span></div>
      <span class="kwh">${nl(b.kWh)} kWh</span><span class="eur">${b.kosten != null ? esc(taal.geld(b.kosten)) : ''}</span>
      ${z != null ? zonBalk(z) : ''}
    </div>`;
}

/** De laadbeurten van de laatste week: wat er samen geladen is, en per beurt. */
function beurtenKaart(a, hoeveel) {
  const o = beurten.get(a.id)?.data;
  // Zonder meter van het laadvermogen: niets, de laadpaal zegt al dat het niet gemeten wordt.
  if (o === null) return '';
  const kop = `<h2>${esc(t('auto.beurt.kop'))}</h2><p class="onder">${esc(t('auto.beurt.periode', { n: o?.dagen ?? 7 }))}</p>`;
  if (o === undefined) return `<section class="glas kaart beurten">${kop}<p class="kan">${esc(t('algemeen.laden'))}…</p></section>`;
  if (!o.beurten.length) return `<section class="glas kaart beurten">${kop}<p class="kan">${esc(o.statistiek ? t('auto.beurt.geen', { n: o.dagen }) : t('auto.beurt.geenStatistiek'))}</p></section>`;
  const zon = o.zonKWh != null && o.kWh > 0 ? Math.round((o.zonKWh / o.kWh) * 100) : null;
  const som = `<div class="som">
      <div><small>${esc(t('auto.beurt.geladen'))}</small><b>${nl(o.kWh)} kWh</b></div>
      ${o.kosten != null ? `<div><small>${esc(t('auto.beurt.kosten'))}</small><b>${esc(taal.geld(o.kosten))}</b></div>` : ''}
      ${zon != null ? `<div><small>${esc(t('auto.beurt.eigenZon'))}</small><b>${zon}%</b></div>` : ''}
    </div>`;
  const rest = o.beurten.length - hoeveel;
  const uitleg = o.zonKWh == null ? t('auto.beurt.zonderNet') : o.beurten.every((b) => b.kosten == null) ? t('auto.beurt.zonderPrijs') : t(o.perUur ? 'auto.beurt.uitlegUur' : 'auto.beurt.uitleg');
  return `<section class="glas kaart beurten">${kop}${som}
      <div class="lijst">${o.beurten.slice(0, hoeveel).map(beurtRegel).join('')}</div>
      <p class="meer" data-meer="${Math.max(0, rest)}"${rest > 0 ? '' : ' hidden'}>${esc(t('auto.beurt.meer', { n: Math.max(0, rest) }))}</p>
      <p class="kan">${esc(uitleg)}</p>
    </section>`;
}

/**
 * De wand scrolt nooit: past de kolom niet, dan gaan er beurten uit de lijst
 * (de oudste eerst), en zegt de regel eronder hoeveel er nog meer zijn.
 */
function pasIn(doos) {
  const lijst = doos.querySelector('.beurten .lijst');
  const meer = doos.querySelector('.beurten .meer');
  if (!lijst || !meer) return;
  let n = Number(meer.dataset.meer) || 0;
  while (doos.scrollHeight > doos.clientHeight + 1 && lijst.children.length > 1) {
    lijst.lastElementChild.remove();
    n += 1;
    meer.textContent = t('auto.beurt.meer', { n });
    meer.hidden = false;
  }
}

/** De beurt van nu, als de auto laadt. */
function dezeBeurt(a) {
  if (!a.laadt) return null;
  return beurten.get(a.id)?.data?.beurten?.find((b) => b.bezig) ?? null;
}

/** De drie feiten onder de auto: laadgrens en vol om, de kabel, de accu (of deze laadbeurt). */
function feiten(a) {
  const grens = a.laadgrens != null
    ? `<b>${nl(a.laadgrens, 0)}%</b><span>${esc(a.volOm ? t('auto.volOm', { tijd: straks(a.volOm) }) : a.pct != null && a.pct >= a.laadgrens ? t('auto.opGrens') : t('auto.inDeAuto'))}</span>`
    : `<b>${esc(t('auto.geenGrens'))}</b><span>${esc(a.volOm ? t('auto.volOm', { tijd: straks(a.volOm) }) : t('auto.geenGrensZin'))}</span>`;
  const kabelB = a.thuis === false ? t('auto.kabelEruit') : a.kabelSinds ? t('auto.kabelSinds', { tijd: geweest(a.kabelSinds) }) : a.aangesloten === true ? t('auto.kabelErin') : a.aangesloten === false ? t('auto.kabelEruit') : t('auto.kabelOnbekend');
  const waar = [a.paalNaam, plekWoord(a)].filter(Boolean).join(', ');
  // Een laadpaal zonder auto heeft geen accu; dan zegt het derde vak wat er nog kan.
  const accu = a.pct == null && a.paalNaam != null && a.accuKWh == null
    ? `<small>${esc(t('auto.feit.auto'))}</small><b>${esc(t('auto.nietInHA'))}</b><span><a href="energie.html#auto">${esc(t('auto.kiesBijEnergie'))}</a></span>`
    : a.accuKWh != null
    ? `<small>${esc(t('auto.feit.accu'))}</small><b>${esc(t('auto.accuKwh', { kwh: nl(a.accuKWh, a.accuKWh % 1 ? 1 : 0) }))}</b><span>${esc(t('auto.accuZin'))}</span>`
    : `<small>${esc(t('auto.feit.accu'))}</small><b>${esc(t('auto.accuLeeg'))}</b><span><a href="energie.html#auto">${esc(t('auto.accuWaarom'))}</a></span>`;
  // Tijdens het laden: deze laadbeurt in plaats van de accu (schets Wand-Auto).
  const nu = dezeBeurt(a);
  const z = nu ? zonPct(nu) : null;
  const derde = nu
    ? `<small>${esc(t('auto.beurt.deze'))}</small><b>${nl(nu.kWh)} kWh${nu.kosten != null ? ` · ${esc(taal.geld(nu.kosten))}` : ''}</b>${z != null ? `${zonBalk(z)}<span>${esc(t('auto.beurt.zonZin', { pct: z }))}</span>` : ''}`
    : accu;
  return `<div class="feiten">
      <div><small>${esc(t('auto.feit.laadgrens'))}</small>${grens}</div>
      <div><small>${esc(t('auto.feit.kabel'))}</small><b>${esc(kabelB)}</b>${waar ? `<span>${esc(waar)}</span>` : ''}</div>
      <div>${derde}</div>
    </div>`;
}

function held(a) {
  const zon = ['zon', 'deels'].includes(bron(a));
  return `<section class="glas held" data-zon="${zon ? 'ja' : 'nee'}">
      <div class="boven">${standDeel(a)}<div class="pct">${pctDeel(a)}</div></div>
      <div class="scene"><svg viewBox="0 52 760 228" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(a.pct == null ? a.naam : t('auto.tekeningLabel', { naam: a.naam, pct: nl(a.pct, 0) }))}">${tekening(a)}</svg></div>
      ${feiten(a)}
    </section>`;
}

/** De laadpaal: zijn stand, het vermogen en de stroom per fase. */
function paalKaart(a) {
  if (a.paalNaam == null) {
    return `<section class="glas kaart"><h2>${esc(t('auto.paal.geen'))}</h2><p class="onder">${esc(t('auto.paal.geenZin'))}</p></section>`;
  }
  // Is de auto weg, dan is de laadpaal vrij; een laadpaal is niet onderweg.
  const s = a.thuis === false ? { tekst: t('auto.paal.vrij'), kleur: 'var(--zacht)' } : stand(a);
  const max = Math.max(a.paalStroomA?.max ?? 16, ...(a.stroomA ?? [0]));
  const kleur = ['zon', 'deels'].includes(bron(a)) ? 'var(--zon)' : a.laadt ? 'var(--ijs)' : 'rgb(var(--wit) / 0.3)';
  const fasen = a.stroomA
    ? `<div class="fasen"><span>${esc(t(a.stroomA.length > 1 ? 'auto.paal.stroom' : 'auto.paal.stroomEen'))}</span>${a.stroomA
        .map((x, i) => `<div class="fase"><em>${a.stroomA.length > 1 ? `L${i + 1}` : ''}</em><div class="fbalk"><i style="width: ${Math.min(100, (x / max) * 100).toFixed(1)}%; background: ${kleur}"></i></div><b>${nl(x, x % 1 ? 1 : 0)} A</b></div>`)
        .join('')}</div>`
    : `<div class="regel"><span>${esc(t('auto.paal.stroom'))}</span><b>${esc(t('auto.paal.nietGemeten'))}</b></div>`;
  return `<section class="glas kaart">
      <h2>${esc(a.paalNaam)}</h2><p class="onder">${esc(huismodelZin([a.paalNaam === t('auto.paal.kop') ? '' : t('auto.paal.kop'), plekWoord(a)]))}</p>
      <div class="regel"><span>${esc(t('auto.paal.stand'))}</span><b style="color: ${s.kleur === 'var(--zacht)' ? 'var(--tekst)' : s.kleur}">${esc(s.tekst)}</b></div>
      <div class="regel"><span>${esc(t('auto.paal.vermogen'))}</span><b>${a.vermogenW != null ? `${nl(a.vermogenW / 1000)} kW` : esc(t('auto.paal.nietGemeten'))}</b></div>
      ${fasen}
      ${a.paalStroomA ? `<p class="kan">${esc(t('laden.paalKan', { min: nl(a.paalStroomA.min, 0), max: nl(a.paalStroomA.max, 0) }))}</p>` : ''}
    </section>`;
}

function instellenKaart() {
  return `<a class="glas kaart naar" href="energie.html#auto"><div><h2>${esc(t('auto.instellen'))}</h2><p class="onder">${esc(t('auto.instellenZin'))}</p></div><span class="pijl" aria-hidden="true">›</span></a>`;
}

function kiezer() {
  const lijst = autos();
  const a = deAuto();
  $$('[data-autos]').forEach((el) => {
    el.hidden = lijst.length < 2;
    el.innerHTML = lijst
      .map((x) => `<button type="button" data-kies="${esc(x.id)}" aria-pressed="${x.id === a?.id}"><i style="background: ${x.laadt ? 'var(--zon)' : 'var(--gedempt)'}"></i>${esc(x.naam)}</button>`)
      .join('');
  });
}

function tekenNu() {
  app.schaal();
  kiezer();
  const wandHeld = document.querySelector('[data-held]');
  const wandRechts = document.querySelector('[data-rechts]');
  const tel = document.querySelector('[data-telinhoud]');
  const a = deAuto();
  if (!a) {
    const leeg = `<section class="glas leeg"><h2>${esc(fout ? t('auto.nogNiet') : huisData ? t('laden.nietsKop') : t('algemeen.laden'))}</h2>${huisData || fout ? `<p>${esc(fout ?? t('auto.nietsZin'))}</p><a class="knop knop-licht" href="energie.html#auto">${esc(t('auto.naarEnergie'))}</a>` : ''}</section>`;
    wandHeld.innerHTML = leeg;
    wandRechts.innerHTML = '';
    tel.innerHTML = leeg;
    return;
  }
  void laadBeurten(a.id);
  wandHeld.innerHTML = held(a);
  // De wand scrolt nooit: daar de laatste beurten die passen, en Instellen bovenin; de telefoon heeft de hele week.
  wandRechts.innerHTML = `${paalKaart(a)}${beurtenKaart(a, 3)}`;
  pasIn(wandRechts);
  tel.innerHTML = `${held(a)}${paalKaart(a)}${beurtenKaart(a, 20)}${instellenKaart()}`;
}

const teken = app.gebundeld(tekenNu);
addEventListener('standwissel', teken);

document.addEventListener('click', (e) => {
  const knop = e.target.closest?.('[data-kies]');
  if (!knop) return;
  gekozen = knop.dataset.kies;
  history.replaceState(null, '', `#${encodeURIComponent(gekozen)}`);
  tekenNu();
});
addEventListener('hashchange', () => {
  gekozen = decodeURIComponent(location.hash.slice(1)) || null;
  teken();
});

app.start('apparaten');
void laad();
setInterval(() => void laad(), 30_000);
// In het voorbeeldhuis verschuift de klok (besluit 237): dan meteen vers.
addEventListener('voorbeeldklok', () => {
  void laad();
  const a = deAuto();
  if (a) void laadBeurten(a.id, true);
});
app.live((nieuw) => {
  state = nieuw;
  teken();
});
