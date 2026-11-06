/*
 * De pagina Auto (besluit 259, stap 2; schets Wand-Auto en Tel-Auto): om te
 * kijken. Per auto hoe vol hij is, of hij laadt en met hoeveel, de stroom per
 * fase, de kabel, het bereik, de laadgrens, hoe laat hij vol is en of hij
 * onderweg is. Alles komt van de dienst (`api/huis`, `opslag.autos`); de
 * pagina zet het neer. Of het laden op zon gaat, volgt uit het net nu
 * (`api/state`): komt er niets van het net, dan is het eigen zon.
 *
 * Instellen gebeurt bij Energie › Auto en laadpaal; bedienen, laadbeurten en
 * advies komen in de volgende stappen (docs/auto-en-laadpaal.md).
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

/** De drie feiten onder de auto: laadgrens en vol om, de kabel, de accu. */
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
  return `<div class="feiten">
      <div><small>${esc(t('auto.feit.laadgrens'))}</small>${grens}</div>
      <div><small>${esc(t('auto.feit.kabel'))}</small><b>${esc(kabelB)}</b>${waar ? `<span>${esc(waar)}</span>` : ''}</div>
      <div>${accu}</div>
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
  wandHeld.innerHTML = held(a);
  wandRechts.innerHTML = `${paalKaart(a)}${instellenKaart()}`;
  tel.innerHTML = `${held(a)}${paalKaart(a)}${instellenKaart()}`;
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
addEventListener('voorbeeldklok', () => void laad());
app.live((nieuw) => {
  state = nieuw;
  teken();
});
