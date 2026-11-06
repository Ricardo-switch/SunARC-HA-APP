/*
 * Energie › Auto en laadpaal (besluit 259, schets Wand-Energie-Auto): hier
 * stel je in; kijken en bedienen komt op de pagina Auto (stap 2 en 5). Links
 * wat de app in Home Assistant vond, elk met een schakelaar, en een ander
 * apparaat kiezen. Rechts per auto de accu, aan welke laadpaal hij laadt en
 * waar hij in de tekening staat (ook de garage, idee 123).
 *
 * De dienst zoekt de apparaten (`api/aansluiting`, veld `laden`); deze kant
 * zet ze neer en zet de keuzes in de antwoorden (`laden`): `aan` per
 * apparaat, `rol` voor wat de bewoner zelf koos, en `instelling` per auto.
 */
'use strict';

const laden = (() => {
  const { esc } = app;
  const t = (k, p) => window.taal.t(k, p);
  const PLEKKEN = ['oprit', 'carport', 'garage'];

  /** De keuzes zoals ze nu zijn; leeg als er nog niets gekozen is. */
  const keuzeVan = (a) => (a.laden ??= { aan: {}, rol: {}, instelling: {} });
  const leeg = { accuKWh: null, laadpaal: null, plek: null };
  const instelling = (a, id) => ({ ...leeg, ...(keuzeVan(a).instelling[id] ?? {}) });
  const lijst = (info) => info?.laden?.apparaten ?? [];
  const aan = (info) => lijst(info).filter((x) => x.aan);

  /** Wat er in het lijstje links staat: wat hij meet, of dat hij uit staat. */
  function watZin(x) {
    if (!x.aan) return t('laden.uitZin');
    const wat = x.wat.filter((w) => !(w === 'stroomZetten' && x.stroomA)).slice(0, 4).map((w) => t(`laden.wat.${w}`));
    if (x.stroomA) wat.unshift(t('laden.stroomVan', { min: x.stroomA.min, max: x.stroomA.max }));
    return [x.merk, wat.join(', ') || t('laden.watNiets')].filter(Boolean).join(' · ');
  }

  /** Het korte zinnetje bij Energie in de lijst links: hoeveel auto's en laadpalen. */
  function kortZin(info) {
    if (!info?.laden) return null;
    const x = aan(info);
    const autos = x.filter((y) => y.rol === 'auto').length;
    const palen = x.filter((y) => y.rol === 'laadpaal').length;
    if (!autos && !palen) return t('laden.nietsKort');
    return [autos ? t('laden.nAutos', { n: autos }) : null, palen ? t('laden.nPalen', { n: palen }) : null].filter(Boolean).join(', ');
  }

  const ik = (rol) => `<span class="ld-ik" style="color: ${rol === 'auto' ? 'var(--mint)' : 'var(--ijs)'}">${iconen.svg(rol === 'auto' ? 'auto' : 'laadpaal')}</span>`;

  /** Een ander apparaat kiezen, uit wat iets meet wat bij laden hoort. */
  function kiezen(info, label) {
    const k = info.laden.kandidaten;
    if (!k.length) return '';
    return `<select class="invoer" data-laad-kies aria-label="${esc(label)}"><option value="">${esc(label)}</option>${k.map((x) => `<option value="${esc(x.id)}">${esc(x.naam)}</option>`).join('')}</select>`;
  }

  /** Rechts: wat je bij het gekozen apparaat instelt. */
  function instellen(info, a, x, staat) {
    const autos = aan(info).filter((y) => y.rol === 'auto');
    const palen = aan(info).filter((y) => y.rol === 'laadpaal');
    const i = instelling(a, x.id);
    const keuzes = (sleutel, opties, huidig) => `<div class="keuzes" role="group">${opties.map(([w, tekst]) => `<button type="button" data-laad="${sleutel}" data-id="${esc(x.id)}" data-waarde="${esc(w ?? '')}" aria-pressed="${w === huidig}">${esc(tekst)}</button>`).join('')}</div>`;
    const plek = `<div class="ld-vraag"><b>${esc(t('laden.plek'))}</b>${keuzes('plek', PLEKKEN.map((p) => [p, t(`laden.plek.${p}`)]), i.plek)}<p class="mini">${esc(t('laden.plekUitleg'))}</p></div>`;
    const rol = x.zelf ? `<div class="ld-vraag"><b>${esc(t('laden.watIsHet'))}</b>${keuzes('rol', [['auto', t('laden.rol.auto')], ['laadpaal', t('laden.rol.laadpaal')]], x.rol)}<button type="button" class="knop" data-laad="weg" data-id="${esc(x.id)}" style="align-self: start">${esc(t('laden.weghalen'))}</button></div>` : '';
    if (x.rol === 'auto') {
      const paalOpties = [['', palen.length === 1 ? t('laden.paalVanzelf', { naam: palen[0].naam }) : t('laden.geenPaal')], ...palen.map((p) => [p.id, p.naam])];
      return `${rol}
        <label class="veldnaam">${esc(t('laden.accu'))}<span class="ld-met"><input class="invoer" type="number" inputmode="decimal" min="5" max="250" step="0.1" data-laad-accu="${esc(x.id)}" value="${i.accuKWh ?? ''}" placeholder="${esc(t('laden.accuVoorbeeld'))}"><span>kWh</span></span></label>
        <p class="mini">${esc(t('laden.accuUitleg'))}</p>
        ${palen.length ? `<label class="veldnaam">${esc(t('laden.laadtAan'))}<select class="invoer" data-laad-paal="${esc(x.id)}">${paalOpties.map(([w, tekst]) => `<option value="${esc(w)}" ${(i.laadpaal ?? '') === w ? 'selected' : ''}>${esc(tekst)}</option>`).join('')}</select></label>` : ''}
        ${plek}`;
    }
    // Een laadpaal: wat hij kan, en zonder auto in Home Assistant ook de plek.
    const kan = x.stroomA ? t('laden.paalKan', { min: x.stroomA.min, max: x.stroomA.max }) : t('laden.paalKanNiet');
    return `${rol}<div class="ld-vraag"><b>${esc(t('laden.watHijKan'))}</b><p class="uitleg" style="margin: 0">${esc(kan)}</p><p class="mini">${esc(t('laden.bedienenLater'))}</p></div>${autos.length ? '' : plek}`;
  }

  function vorm(info, a, staat) {
    const kop = `<div class="kopregel"><h2 class="kop-2">${esc(t('laden.titel'))}</h2></div>`;
    if (!info?.laden) return `${kop}<p class="uitleg">${esc(t('laden.geenHA'))}</p>`;
    const x = lijst(info);
    const evcc = info.laden.evcc.length ? `<div class="ld-evcc"><span class="stip" style="background: var(--ijs)"></span><span><b>${esc(t('laden.evccKop'))}</b> ${esc(t('laden.evccZin'))}</span></div>` : '';
    if (!x.length) {
      return `${kop}${evcc}<div class="ld-leeg"><b>${esc(t('laden.nietsKop'))}</b><p class="uitleg">${esc(t('laden.nietsZin'))}</p>${kiezen(info, t('laden.eenKiezen'))}</div>`;
    }
    const gekozen = x.find((y) => y.id === staat.wie && y.aan) ?? x.find((y) => y.aan) ?? null;
    staat.wie = gekozen?.id ?? null;
    const rijen = x.map((y) => `<div class="ld-rij${y.aan ? '' : ' uit'}${y === gekozen ? ' nu' : ''}">${ik(y.rol)}<button type="button" class="ld-tekst" data-laad="wie" data-id="${esc(y.id)}" ${y.aan ? '' : 'disabled'}><b>${esc(y.naam)}</b><span>${esc(watZin(y))}</span></button><button type="button" class="schakelaar" role="switch" aria-checked="${y.aan}" aria-label="${esc(t('laden.vanDitHuis', { naam: y.naam }))}" data-laad="aan" data-id="${esc(y.id)}"></button></div>`).join('');
    const klimaat = x.some((y) => y.rol === 'auto') ? `<p class="mini">${esc(t('laden.klimaatNoot'))}</p>` : '';
    const links = `<div class="deelvraag"><h3 class="kop-3">${esc(t('laden.gevonden'))}</h3>${rijen}${kiezen(info, t('laden.anderKiezen'))}${klimaat}</div>`;
    const wie = aan(info).length > 1 ? `<div class="keuzes ld-wie" role="tablist">${aan(info).map((y) => `<button type="button" role="tab" data-laad="wie" data-id="${esc(y.id)}" aria-pressed="${y === gekozen}">${esc(y.naam)}</button>`).join('')}</div>` : '';
    const rechts = gekozen ? `<div class="deelvraag">${wie}${instellen(info, a, gekozen, staat)}${evcc}</div>` : `<div class="deelvraag"><p class="uitleg">${esc(t('laden.allesUit'))}</p>${evcc}</div>`;
    return `${kop}<div class="kolommen"><div>${links}</div><div>${rechts}</div></div>`;
  }

  /** Een tik; true als er iets te bewaren is, 'teken' als alleen het beeld verandert. */
  function klik(el, info, a, staat) {
    const knop = el.closest('[data-laad]');
    if (!knop) return false;
    const { laad, id } = knop.dataset;
    const k = keuzeVan(a);
    if (laad === 'wie') {
      staat.wie = id;
      return 'teken';
    }
    if (laad === 'aan') {
      const nu = knop.getAttribute('aria-checked') === 'true';
      const zelf = lijst(info).find((y) => y.id === id)?.zelf;
      // Wat de app vond, staat zonder keuze aan; uit is een keuze.
      if (!nu && !zelf) delete k.aan[id];
      else k.aan[id] = !nu;
      return true;
    }
    if (laad === 'rol') {
      k.rol[id] = knop.dataset.waarde;
      return true;
    }
    if (laad === 'weg') {
      delete k.rol[id];
      delete k.aan[id];
      delete k.instelling[id];
      if (staat.wie === id) staat.wie = null;
      return true;
    }
    if (laad === 'plek') {
      const w = knop.dataset.waarde;
      const i = instelling(a, id);
      k.instelling[id] = { ...i, plek: i.plek === w ? null : w };
      return true;
    }
    return false;
  }

  /** Een veld of keuzelijst; true als er iets te bewaren is. */
  function verander(el, info, a, staat) {
    const k = keuzeVan(a);
    if (el.matches('[data-laad-kies]')) {
      if (!el.value) return false;
      // Een gekozen apparaat is eerst een auto; rechts kies je anders.
      k.rol[el.value] = 'auto';
      k.aan[el.value] = true;
      staat.wie = el.value;
      return true;
    }
    if (el.dataset.laadAccu) {
      const n = Number(el.value.replace(',', '.'));
      const accu = el.value === '' || !Number.isFinite(n) ? null : Math.min(250, Math.max(5, Math.round(n * 10) / 10));
      if (accu != null) el.value = String(accu);
      k.instelling[el.dataset.laadAccu] = { ...instelling(a, el.dataset.laadAccu), accuKWh: accu };
      return true;
    }
    if (el.dataset.laadPaal) {
      k.instelling[el.dataset.laadPaal] = { ...instelling(a, el.dataset.laadPaal), laadpaal: el.value || null };
      return true;
    }
    return false;
  }

  return { vorm, klik, verander, kortZin };
})();
