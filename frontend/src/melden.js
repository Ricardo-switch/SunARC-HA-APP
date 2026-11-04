/*
 * Meld een probleem (testerronde, november 2026): een klein blad met wat er
 * mis is, en bij een apparaat zijn gegevens (zonder namen of adressen, uit
 * `api/apparaat-gegevens`). "Verder op GitHub" opent het issueformulier
 * melding.yml, vooraf ingevuld. Elke melding krijgt een meldcode die alleen op
 * dit toestel bewaard wordt (`sc-meldingen`); staat die code na een update
 * bij een versie, dan zegt de app wat ermee gebeurde (basis.js).
 *
 * basis.js laadt dit bestand pas bij de eerste tik op een knop
 * `data-meld-probleem`, met `data-apparaat` en `data-naam` voor een apparaat.
 */
'use strict';

(function (global) {
  const { esc, haal } = global.app;
  const t = (k, p) => global.taal.t(k, p);
  const REPO = 'https://github.com/Ricardo-switch/SunArc';
  const OPSLAG = 'sc-meldingen';
  /** Langer dan dit wordt een adres te lang voor GitHub; dan gaan de gegevens via het klembord. */
  const MAX_URL = 7500;
  const SOORTEN = ['fout', 'apparaat', 'idee'];

  function meldingen() {
    try {
      const l = JSON.parse(global.localStorage.getItem(OPSLAG) ?? '[]');
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  }
  function onthoud(m) {
    try {
      global.localStorage.setItem(OPSLAG, JSON.stringify([...meldingen(), m].slice(-50)));
    } catch {
      // Zonder opslag geen terugkoppeling; de melding zelf gaat wel.
    }
  }
  /** Een korte code zonder letters die op elkaar lijken: SA-7F3K. */
  function nieuweCode() {
    const tekens = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = global.crypto.getRandomValues(new Uint8Array(4));
    return `SA-${[...r].map((x) => tekens[x % tekens.length]).join('')}`;
  }

  let s = null;

  async function open({ apparaat = null, naam = null } = {}) {
    s = { apparaat, naam, soort: apparaat ? 'apparaat' : 'fout', wat: '', mee: !!apparaat, gegevens: null, code: nieuweCode(), klaar: false, klembord: false };
    teken();
    const [g, v] = await Promise.all([apparaat ? haal(`api/apparaat-gegevens?id=${encodeURIComponent(apparaat)}`).catch(() => null) : null, haal('api/versie').catch(() => null)]);
    if (!s) return;
    s.gegevens = g;
    s.versie = v;
    teken();
  }

  function sluit() {
    s = null;
    document.querySelectorAll('[data-meldpop], [data-meldpop-achter]').forEach((el) => el.remove());
  }

  function teken() {
    const was = document.querySelector('[data-meldpop] textarea')?.value;
    if (was != null && s) s.wat = was;
    document.querySelectorAll('[data-meldpop], [data-meldpop-achter]').forEach((el) => el.remove());
    if (!s) return;
    const inhoud = s.klaar
      ? `<h2 class="kop-2" id="meldkop" style="margin: 0">${esc(t('melden.bedankt'))}</h2>
        <p class="klein" style="margin: 0">${esc(t('melden.bedanktZin', { code: s.code }))}</p>
        ${s.klembord ? `<p class="klein" style="margin: 0">${esc(t('melden.klembord'))}</p>` : ''}
        <div class="knoppen"><button type="button" class="knop knop-licht" data-meldpop-dicht>${esc(t('algemeen.oke'))}</button></div>`
      : `<h2 class="kop-2" id="meldkop" style="margin: 0">${esc(t('melden.kop'))}</h2>
        <div class="keuzes" role="group" aria-label="${esc(t('melden.soort'))}">${SOORTEN.filter((k) => k !== 'apparaat' || s.apparaat).map((k) => `<button type="button" data-meldsoort="${k}" aria-pressed="${s.soort === k}">${esc(t(`melden.soort.${k}`))}</button>`).join('')}</div>
        <label class="veldnaam">${esc(t(s.soort === 'idee' ? 'melden.watIdee' : 'melden.wat'))}<textarea class="invoer" data-meldwat rows="4" maxlength="2000" style="height: auto; padding: 10px 12px">${esc(s.wat)}</textarea></label>
        ${s.apparaat ? `<label class="klein" style="display: flex; gap: 8px; align-items: center"><input type="checkbox" data-meldmee ${s.mee ? 'checked' : ''}>${esc(t('melden.mee', { naam: s.naam ?? '' }))}</label>
          ${s.mee && s.gegevens ? `<details class="klein"><summary>${esc(t('melden.bekijk'))}</summary><pre style="white-space: pre-wrap; font-size: 11.5px; max-height: 180px; overflow: auto; margin: 6px 0 0">${esc(JSON.stringify(s.gegevens, null, 1))}</pre></details>` : ''}` : ''}
        <p class="mini" style="margin: 0">${esc(t('melden.github', { code: s.code }))}</p>
        <div class="knoppen"><button type="button" class="knop" data-meldpop-dicht>${esc(t('basis.versie.later'))}</button><button type="button" class="knop knop-licht" data-meldpop-stuur>${esc(t('melden.verder'))}</button></div>`;
    document.body.insertAdjacentHTML('beforeend', `<div class="meldachter" data-meldpop-achter></div><div class="glas nieuwpop" role="dialog" aria-modal="true" aria-labelledby="meldkop" data-meldpop>${inhoud}</div>`);
    (document.querySelector('[data-meldwat]') ?? document.querySelector('[data-meldpop] .knop-licht'))?.focus();
  }

  async function stuur() {
    s.wat = document.querySelector('[data-meldwat]')?.value.trim() ?? '';
    if (!s.wat) {
      document.querySelector('[data-meldwat]')?.focus();
      return;
    }
    const v = s.versie;
    const gegevens = s.mee && s.gegevens ? JSON.stringify(s.gegevens, null, 1) : '';
    const titel = `${t(`melden.soort.${s.soort}`)}${s.naam && s.soort === 'apparaat' ? ` (${s.naam.slice(0, 30)})` : ''}: ${s.wat.split('\n')[0].slice(0, 70)}`;
    const velden = {
      template: 'melding.yml',
      title: titel,
      soort: t(`melden.soort.${s.soort}`),
      wat: s.wat,
      versie: v?.nummer ? `${v.nummer} (${v.installatie ?? ''})` : '',
      waar: `${global.location.pathname.split('/').pop() || 'thuis.html'} · ${global.app.telStand() ? t('melden.telefoon') : t('melden.wand')} · ${global.taal.code}`,
      meldcode: s.code,
    };
    const adres = (extra) => `${REPO}/issues/new?${new URLSearchParams({ ...velden, ...extra })}`;
    let url = adres(gegevens ? { gegevens } : {});
    if (gegevens && url.length > MAX_URL) {
      // Te lang voor een adres: de gegevens op het klembord, en een zin in het vak om ze te plakken.
      try {
        await global.navigator.clipboard.writeText(gegevens);
        s.klembord = true;
      } catch {
        s.klembord = false;
      }
      url = adres({ gegevens: t('melden.plakHier') });
    }
    global.open(url, '_blank', 'noopener');
    onthoud({ code: s.code, titel: titel.slice(0, 120), soort: s.soort, ms: Date.now() });
    s.klaar = true;
    teken();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-meldsoort], [data-meldpop-dicht], [data-meldpop-achter], [data-meldpop-stuur], [data-meldmee]');
    if (!el || !s) return;
    if (el.dataset.meldsoort) {
      s.soort = el.dataset.meldsoort;
      teken();
    } else if (el.matches('[data-meldmee]')) {
      s.mee = el.checked;
      teken();
    } else if (el.matches('[data-meldpop-stuur]')) void stuur();
    else sluit();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && s) sluit();
  });

  global.melden = { open, meldingen };
})(window);
