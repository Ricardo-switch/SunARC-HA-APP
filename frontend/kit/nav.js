/*
 * De navigatie: zes plekken, op de wand links en op de telefoon onderin. Te
 * doen kwam erbij als eigen tab (besluit 217); op de telefoon staan daarom
 * alleen iconen, en de gekozen tab met zijn naam in een pil.
 *
 * Bedienen gebeurt in het huis zelf (etage, kamer, apparaat); er is geen
 * aparte tab Bediening. Waarom en Plan zijn samen Vandaag. Apparaten (op zon,
 * de auto, de batterij) heeft een eigen tab. Instellen is een tandwiel: op de
 * wand onderaan de balk, op de telefoon rechtsboven op Thuis.
 */
(function (global) {
  'use strict';
  const ICOON = {
    thuis: iconen.binnen('thuis'),
    vandaag: iconen.binnen('vandaag'),
    tedoen: iconen.binnen('tedoen'),
    apparaten: iconen.binnen('apparaten'),
    opbrengst: iconen.binnen('opbrengst'),
    assistent: iconen.binnen('assistent'),
    meldingen: iconen.binnen('meldingen'),
    instellingen: iconen.binnen('instellingen'),
  };
  /** De zes plekken; hun namen staan in teksten.*.js (besluit 185). */
  const NAMEN = ['thuis', 'vandaag', 'tedoen', 'apparaten', 'opbrengst', 'assistent'];
  const t = (k) => global.t(k);
  /** Zonder panelen heet Opbrengst Verbruik (besluit 196); basis.js onthoudt wat het huis heeft. */
  const naam = (id) => {
    if (id === 'opbrengst') {
      try {
        if (JSON.parse(global.localStorage.getItem('sc-huissoort'))?.zon === false) return t('nav.verbruik');
      } catch {
        // Dan de gewone naam.
      }
    }
    return t(`nav.${id}`);
  };
  const svg = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICOON[id]}</svg>`;

  /** `links` geeft per plek het adres; zonder staat er "#". */
  function balk(el, actief, links = {}) {
    const href = (id) => links[id] ?? '#';
    // De bel boven het tandwiel (besluit 136): op elke pagina, met een getal als er iets is.
    const bel = `<button type="button" class="meldbel" data-meldbel aria-label="${t('nav.meldingen')}" aria-haspopup="dialog">${svg('meldingen')}<b data-meldaantal hidden></b></button>`;
    // Het logo brengt je bij Over deze app.
    el.innerHTML = `<a class="logo" href="over.html" aria-label="${t('over.kop')}"></a>${NAMEN.map((id) => `<a href="${href(id)}" data-tab="${id}" ${id === actief ? 'aria-current="page"' : ''}>${svg(id)}${naam(id)}</a>`).join('')}${bel}<a href="${href('instellingen')}" class="onder" ${actief === 'instellingen' ? 'aria-current="page"' : ''} aria-label="${t('nav.instellingen')}">${svg('instellingen')}</a>`;
  }
  function tabs(el, actief, links = {}) {
    // Alleen het icoon; de naam staat er wel, voor wie voorleest, en is te zien bij de gekozen tab.
    el.innerHTML = NAMEN.map((id) => `<a href="${links[id] ?? '#'}" data-tab="${id}" aria-label="${naam(id)}" ${id === actief ? 'aria-current="page"' : ''}>${svg(id)}<span>${naam(id)}</span></a>`).join('');
  }
  global.nav = { balk, tabs, svg };
})(window);
