/*
 * Daken en panelen (besluit 254, stap 1; schetsen Wand-Daken en Tel-Daken):
 * elk dakvlak apart, als kaartje met een letter. Een vlak openen laat de
 * opstelling, de richting, de helling, het aantal en de meter aanpassen; erbij
 * kiest eerst wat voor dak het is. De vlakken komen van de dienst
 * (`api/aansluiting`, veld `daken`): bewaard, of uit wat er al was. De
 * tekening van boven volgt in stap 2; tot dan staat het huis ernaast.
 */
'use strict';

const dakvlakken = (() => {
  const { esc } = app;
  const t = (k, p) => window.taal.t(k, p);

  const PLEKKEN = ['hoofddak', 'dwarskap', 'uitbouw', 'garage', 'carport', 'tuinhuis', 'grond', 'gevel'];
  const OPSTELLINGEN = ['schuin', 'rek', 'oostwest', 'plat'];
  /** Hoe een nieuw vlak begint, per plek: de opstelling en de helling. */
  const BEGIN = { hoofddak: ['schuin', 40], dwarskap: ['schuin', 45], uitbouw: ['oostwest', 10], garage: ['rek', 15], carport: ['schuin', 10], tuinhuis: ['schuin', 25], grond: ['rek', 30], gevel: ['schuin', 90] };
  const HELLINGEN = { schuin: [20, 30, 35, 40, 45, 50], rek: [10, 15, 20, 30, 35], oostwest: [5, 10, 15, 20] };
  const STANDKLEUR = { gemeten: '#6ee7b7', bewoner: '#6fd3ff', schatting: '#f7b548' };
  const METERKLEUR = ['#f7b548', '#6fd3ff', '#a99cff', '#6ee7b7', '#ff8a6b', '#f3d48a', '#9cc0e4', '#d98c3a'];
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const RICHTINGEN = ['n', 'no', 'o', 'zo', 'z', 'zw', 'w', 'nw'];

  const norm = (d) => ((Math.round(d) % 360) + 360) % 360;
  const hoek = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const kort = (deg) => t(`panelen3.kort.${RICHTINGEN[Math.round(norm(deg) / 45) % 8]}`);
  const kWp = (w) => (w / 1000).toLocaleString(window.taal.locale, { maximumFractionDigits: 1 });
  const wp = (x) => Math.round(x);
  const panelen = (v) => v.aantal + (v.opstelling === 'oostwest' ? (v.aantal2 ?? 0) : 0);
  const piek = (v) => panelen(v) * v.wpPerPaneel;

  /* ---------------------------------------------- woorden bij een vlak */

  function waar(v) {
    const g = `${norm(v.azimuthDeg)}°`;
    const h = `${Math.round(v.tiltDeg)}°`;
    if (v.opstelling === 'plat') return t('daken.waar.plat');
    if (v.opstelling === 'oostwest') return t('daken.waar.oostwest', { richting: `${kort(v.azimuthDeg)}-${kort(v.azimuthDeg + 180)}`.toLowerCase(), a: g, b: `${norm(v.azimuthDeg + 180)}°`, helling: h });
    return t(v.opstelling === 'rek' ? 'daken.waar.rek' : 'daken.waar.schuin', { richting: kort(v.azimuthDeg).toLowerCase(), graden: g, helling: h });
  }
  const naam = (v) => t(`daken.plek.${v.plek}`);
  const letter = (v, kleur) => `<span class="dk-letter" style="background: ${kleur}">${esc(v.letter)}</span>`;

  /** Het kopje boven de lijst: hoe zeker het samen is. */
  function chip(vlakken) {
    if (!vlakken.length) return '';
    if (vlakken.some((v) => v.bron === 'schatting')) return `<span class="pan-chip leert">${esc(t('daken.chip.schatting'))}</span>`;
    if (vlakken.every((v) => v.bron === 'gemeten')) return `<span class="pan-chip gemeten">${esc(t('panelen3.chip.gemeten'))}</span>`;
    return `<span class="pan-chip zelf">${esc(t('panelen3.chip.zelf'))}</span>`;
  }

  /* ---------------------------------------------- de schermen */

  function kaartje(v) {
    return `<button type="button" class="dk-vlak" data-dak-open="${esc(v.letter)}" aria-label="${esc(t('daken.open', { letter: v.letter, naam: naam(v) }))}">
      ${letter(v, STANDKLEUR[v.bron])}
      <span><b>${esc(naam(v))}</b><small>${esc(waar(v))} · <em class="dk-stand ${v.bron}">${esc(t(`daken.stand.${v.bron}`))}</em></small></span>
      <span class="dk-rechts"><b>${esc(kWp(piek(v)))}</b> kWp<br>${esc(t('daken.nKeer', { n: panelen(v), wp: wp(v.wpPerPaneel) }))}</span>
    </button>`;
  }

  function alle(d, o) {
    const vlakken = d.vlakken;
    const n = vlakken.reduce((s, v) => s + panelen(v), 0);
    const samen = vlakken.reduce((s, v) => s + piek(v), 0);
    const helder = o.helderW;
    const lijst = vlakken.length
      ? `<div class="dk-lijst">${vlakken.map(kaartje).join('')}</div>
        <div class="dk-som">
          <div class="pan-feit"><small>${esc(t('daken.panelen'))}</small><b>${n}</b></div>
          <div class="pan-feit"><small>${esc(t('daken.samen'))}</small><b>${esc(kWp(samen))} kWp</b></div>
          <div class="pan-feit"><small>${esc(t('daken.helderNu'))}</small><b>${helder == null ? '–' : `${esc((helder / 1000).toLocaleString(window.taal.locale, { maximumFractionDigits: 1 }))} kW`}</b></div>
        </div>`
      : `<div class="dk-leeg"><p>${esc(t(o.geen ? 'daken.geenZin' : 'daken.leeg'))}</p>${o.geen ? '' : `<button type="button" class="lig-link" data-dak-geen>${esc(t('daken.geenPanelen'))}</button>`}</div>`;
    return `<div class="pan-kop3"><h3 class="kop-3">${esc(t('daken.waarKop'))}</h3>${vlakken.length < LETTERS.length ? `<button type="button" class="lig-link" data-dak-scherm="erbij">${esc(t('daken.erbij'))}</button>` : ''}</div>
      ${lijst}
      <div class="dk-voet"><span class="mini">${esc(t('daken.uitleg'))}</span><button type="button" class="lig-knop zacht" data-dak-scherm="meters">${esc(t('daken.meters'))}</button></div>`;
  }

  /** Een plaatje per opstelling, zoals de schets. */
  const OPSTEL_BEELD = {
    schuin: '<path d="M6 32h78" stroke="rgb(255 255 255 / .35)" stroke-width="2"/><path d="M20 31 45 12l25 19" fill="none" stroke="rgb(255 255 255 / .45)" stroke-width="1.5"/><path d="M24 28 45 12.5l3 2.2-20.5 15.3z" fill="#4d7eac" stroke="#9cc0e4" stroke-width="1.2"/>',
    rek: '<path d="M6 32h78" stroke="rgb(255 255 255 / .35)" stroke-width="2"/><path d="M18 31l22-14v14z M50 31l22-14v14z" fill="#4d7eac" stroke="#9cc0e4" stroke-width="1.2"/>',
    oostwest: '<path d="M6 32h78" stroke="rgb(255 255 255 / .35)" stroke-width="2"/><path d="M12 31l14-9 14 9z M50 31l14-9 14 9z" fill="#4d7eac" stroke="#9cc0e4" stroke-width="1.2"/>',
    plat: '<path d="M6 32h78" stroke="rgb(255 255 255 / .35)" stroke-width="2"/><path d="M14 30h28v-3H14z M48 30h28v-3H48z" fill="#4d7eac" stroke="#9cc0e4" stroke-width="1.2"/>',
  };

  /** Het kompas bij Richting: een pijl naar waar het vlak kijkt, bij oost-west twee. */
  function kompas(v) {
    const pt = (deg, r) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r];
    const pijl = (deg) => {
      const [x1, y1] = pt(deg, 6);
      const [x2, y2] = pt(deg, 28);
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="var(--zon)" stroke-width="3" stroke-linecap="round"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="5" fill="var(--zon)"/>`;
    };
    return `<svg class="dk-kompas" viewBox="-50 -50 100 100" aria-hidden="true">
      <circle r="46" fill="rgb(255 255 255 / 0.04)" stroke="rgb(255 255 255 / 0.3)" stroke-width="1.5"/>
      <g font-size="12" font-weight="800" text-anchor="middle">${[['n', 0], ['o', 90], ['z', 180], ['w', 270]].map(([k, d]) => {
        const [x, y] = pt(d, 38);
        return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" fill="${k === 'n' ? 'var(--zon)' : 'var(--tekst)'}">${esc(t(`panelen.windroos.${k}`))}</text>`;
      }).join('')}</g>
      ${pijl(v.azimuthDeg)}${v.opstelling === 'oostwest' ? pijl(v.azimuthDeg + 180) : ''}
    </svg>`;
  }

  const stapper = (veld, waarde, label, eenheid = '') =>
    `<div class="dk-stapper"><button type="button" data-dak-stap="${veld}" data-d="-1" aria-label="${esc(t('daken.minder', { wat: label }))}">−</button><b>${esc(String(waarde))}${eenheid}</b><button type="button" data-dak-stap="${veld}" data-d="1" aria-label="${esc(t('daken.meer', { wat: label }))}">+</button></div>`;
  const veld = (kop, inhoud) => `<div class="dk-veld"><small>${esc(kop)}</small>${inhoud}</div>`;
  const seg = (attr, waarde, tekst, aan, extra = '') => `<button type="button" ${attr}="${esc(String(waarde))}" aria-pressed="${aan}" class="${aan ? 'aan' : ''}${extra}">${esc(tekst)}</button>`;

  /** Wat de meting over het hoofddak zegt, naast dit vlak (besluit 157). */
  function metingBij(d, v) {
    if (!d.meting?.length || v.plek !== 'hoofddak' || v.opstelling === 'plat') return '';
    const m = [...d.meting].sort((a, b) => hoek(a.azimuthDeg, v.azimuthDeg) - hoek(b.azimuthDeg, v.azimuthDeg))[0];
    if (!m || hoek(m.azimuthDeg, v.azimuthDeg) > 60) return '';
    const woorden = { richting: `${norm(m.azimuthDeg)}°`, helling: `${Math.round(m.tiltDeg)}°` };
    if (hoek(m.azimuthDeg, v.azimuthDeg) <= 10 && Math.abs(m.tiltDeg - v.tiltDeg) <= 5) return `<div class="dk-meting"><b>${esc(t('daken.meting.klopt', woorden))}</b></div>`;
    return `<div class="dk-meting">${esc(t('daken.meting.zegt', woorden))} <button type="button" class="lig-link" data-dak-neem>${esc(t('daken.meting.neem'))}</button></div>`;
  }

  /**
   * Welke omvormer dit vlak meet: alleen de omvormers die bij Omvormers en
   * meters gekozen zijn, of Weet ik niet. Meer vlakken aan één omvormer kiezen
   * allemaal die omvormer.
   */
  function meterKeuze(d, v) {
    const meters = d.meters ?? [];
    const bekend = meters.some((m) => m.id === v.meter);
    const knoppen = `${meters.map((m) => seg('data-dak-meter', m.id, m.naam, v.meter === m.id)).join('')}${seg('data-dak-meter', '', t('daken.weetNiet'), !bekend)}`;
    const uitleg = meters.length ? t('daken.gemetenDoorUitleg') : t('daken.geenMeters');
    return `<div class="dk-seg">${knoppen}</div><span class="klein">${esc(uitleg)}</span>`;
  }

  function vlakScherm(d, s) {
    const v = s.concept;
    const nieuw = !d.vlakken.some((x) => x.letter === v.letter);
    const hellingen = v.plek === 'gevel' ? [60, 70, 80, 90] : HELLINGEN[v.opstelling] ?? [];
    const eigen = !hellingen.includes(Math.round(v.tiltDeg));
    const metersHier = d.meters ?? [];
    const kanten = v.opstelling === 'oostwest'
      ? `${veld(kort(v.azimuthDeg), stapper('aantal', v.aantal, kort(v.azimuthDeg)))}${veld(kort(v.azimuthDeg + 180), stapper('aantal2', v.aantal2 ?? 0, kort(v.azimuthDeg + 180)))}`
      : veld(t('daken.aantal'), stapper('aantal', v.aantal, t('daken.aantal')));
    return `<div class="dk-vlak open">${letter(v, STANDKLEUR[v.bron])}<span><b>${esc(nieuw ? t('daken.nieuw', { naam: naam(v) }) : naam(v))}</b><small>${esc(waar(v))}</small></span><span class="dk-rechts"><b>${esc(kWp(piek(v)))}</b> kWp</span></div>
      ${veld(t('daken.hoeLiggen'), `<div class="dk-opstel" role="group" aria-label="${esc(t('daken.hoeLiggen'))}">${OPSTELLINGEN.map((o) => `<button type="button" data-dak-opstel="${o}" aria-pressed="${v.opstelling === o}" class="${v.opstelling === o ? 'aan' : ''}"><svg viewBox="0 0 90 38" aria-hidden="true">${OPSTEL_BEELD[o]}</svg>${esc(t(`daken.opstelling.${o}`))}</button>`).join('')}</div>`)}
      ${v.opstelling === 'plat' ? '' : `<div class="dk-richting">${kompas(v)}
        ${veld(t('daken.richting'), `<div class="dk-rij">${stapper('richting', `${norm(v.azimuthDeg)}°`, t('daken.richting'))}${v.opstelling === 'oostwest' ? `<span class="klein">${esc(t('daken.enTegenover', { graden: `${norm(v.azimuthDeg + 180)}°` }))}</span>` : `<span class="klein">${esc(kort(v.azimuthDeg))}</span>`}</div>
          <input class="lig-draai" type="range" min="0" max="355" step="1" value="${norm(v.azimuthDeg) % 360}" data-dak-draai aria-label="${esc(t('daken.draai'))}">
          <span class="klein">${esc(t(v.opstelling === 'oostwest' ? 'daken.richtingOw' : 'daken.richtingUitleg'))}</span>`)}</div>
        ${veld(t('daken.helling'), `<div class="dk-seg">${hellingen.map((h) => seg('data-dak-helling', h, `${h}°`, !eigen && Math.round(v.tiltDeg) === h)).join('')}<label class="lig-zelf${eigen ? ' aan' : ''}">${esc(t('daken.anders'))}<input type="number" inputmode="numeric" min="0" max="90" step="1" data-dak-hellingzelf value="${eigen ? Math.round(v.tiltDeg) : ''}" placeholder="°" aria-label="${esc(t('daken.helling'))}"></label></div>`)}`}
      <div class="dk-aantallen">${kanten}${veld(t('daken.perPaneel'), stapper('wp', wp(v.wpPerPaneel), t('daken.perPaneel'), ' Wp'))}</div>
      ${veld(t('daken.gemetenDoor'), meterKeuze(d, v))}
      ${metingBij(d, v)}
      <div class="dk-voet"><button type="button" class="lig-knop zacht" data-dak-scherm="alle">${esc(t('daken.alle'))}</button>${nieuw ? '' : `<button type="button" class="lig-link dk-weg" data-dak-weg>${esc(t('daken.weg'))}</button>`}<button type="button" class="lig-knop" data-dak-bewaar>${esc(t('daken.bewaar'))}</button></div>`;
  }

  const TEGEL_BEELD = {
    hoofddak: '<path d="M4 22 22 8l18 14"/><path d="M8 19v13h28V19"/><path d="M26 13l8 6" stroke-width="4" stroke="#4d7eac"/>',
    dwarskap: '<path d="M4 24 16 14l12 10"/><path d="M14 16 22 9l18 14"/><path d="M8 22v10h28V21"/><path d="M17 17l6 5" stroke-width="4" stroke="#4d7eac"/>',
    uitbouw: '<path d="M4 18 16 8l12 10v14H4z"/><path d="M28 22h12v10H28z"/><path d="M29 21h10" stroke-width="3" stroke="#4d7eac"/>',
    garage: '<path d="M5 14h34v18H5z"/><path d="M11 32V21h22v11"/><path d="M8 13h28" stroke-width="3" stroke="#4d7eac"/>',
    carport: '<path d="M5 12h34M8 12v20M36 12v20"/><path d="M7 10h30" stroke-width="3" stroke="#4d7eac"/>',
    tuinhuis: '<path d="M8 18l14-9 14 9v14H8z"/><path d="M19 32v-8h6v8"/><path d="M24 12l9 6" stroke-width="3" stroke="#4d7eac"/>',
    grond: '<path d="M4 32h36"/><path d="M8 30 20 16h16L24 30" fill="#4d7eac" stroke="#9cc0e4"/>',
    gevel: '<path d="M8 6h20v26H8z"/><path d="M28 14l8 3v10l-8-3z" fill="#4d7eac" stroke="#9cc0e4"/>',
  };

  function erbij() {
    return `<div class="dk-stappen"><i class="nu">1</i>${esc(t('daken.stap1'))}<i>2</i>${esc(t('daken.stap2'))}</div>
      <div class="dk-tegels">${PLEKKEN.map((p) => `<button type="button" class="dk-tegel" data-dak-plek="${p}"><svg viewBox="0 0 44 36" fill="none" stroke="#f7b548" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${TEGEL_BEELD[p]}</svg><b>${esc(t(`daken.tegel.${p}`))}</b><span>${esc(t(`daken.tegelZin.${p}`))}</span></button>`).join('')}</div>
      <p class="mini">${esc(t('daken.erbijUitleg'))}</p>
      <div class="dk-voet"><button type="button" class="lig-knop zacht" data-dak-scherm="alle">${esc(t('daken.terug'))}</button></div>`;
  }

  function meters(d, o) {
    const kleur = new Map((d.meters ?? []).map((m, i) => [m.id, METERKLEUR[i % METERKLEUR.length]]));
    const groepen = (d.meters ?? []).map((m) => ({ m, vlakken: d.vlakken.filter((v) => v.meter === m.id) })).filter((g) => g.vlakken.length);
    const zonder = d.vlakken.filter((v) => v.meter == null || !kleur.has(v.meter));
    const kaart = (k, kop, zin, vlakken, knop = '') => `<div class="dk-meter"><i style="background: ${k}"></i><span class="dk-naar">${vlakken.map((v) => letter(v, k)).join('')}</span><b>${esc(kop)}</b><small>${esc(zin)}</small>${knop}</div>`;
    // Eén omvormer: met één tik ook de vlakken zonder meter erbij.
    const een = (d.meters ?? []).length === 1 ? d.meters[0] : null;
    const allesKnop = een ? `<button type="button" class="lig-knop zacht dk-alles" data-dak-alles="${esc(een.id)}">${esc(t('daken.meter.alles', { naam: een.naam }))}</button>` : '';
    const lijst = [
      ...groepen.map((g) => kaart(kleur.get(g.m.id), g.m.naam, t(g.vlakken.length > 1 ? 'daken.meter.samen' : 'daken.meter.precies'), g.vlakken)),
      ...(zonder.length ? [kaart('rgb(255 255 255 / 0.35)', t('daken.meter.geen'), t('daken.meter.geenZin'), zonder, allesKnop)] : []),
    ].join('');
    return `<div class="pan-kop3"><h3 class="kop-3">${esc(t('daken.metersKop'))}</h3></div>
      <div class="dk-lijst">${lijst || `<p class="mini">${esc(t('daken.leeg'))}</p>`}</div>
      <p class="mini">${esc(t('daken.metersUitleg'))}</p>
      ${o.omvormers}
      ${o.sensor}
      <div class="dk-voet"><button type="button" class="lig-knop zacht" data-dak-scherm="alle">${esc(t('daken.alle'))}</button></div>`;
  }

  /**
   * De hele pagina. `d`: `aInfo.daken`; `s`: het scherm en het vlak dat open
   * staat; `o.helderW`: de zon bij heldere lucht nu; `o.omvormers` en
   * `o.sensor`: de blokken over de omvormers, van energie.js; `o.geen`: de
   * bewoner zei geen zonnepanelen.
   */
  function vorm(d, s, o = {}) {
    const vlakken = d?.vlakken ?? [];
    const rechts = !d ? '' : s.scherm === 'vlak' && s.concept ? vlakScherm(d, s) : s.scherm === 'erbij' ? erbij() : s.scherm === 'meters' ? meters(d, o) : alle(d, o);
    return `<div class="pan3 dk">
      <div class="pan-kop"><h2 class="kop-2">${esc(t('daken.titel'))}</h2>${chip(vlakken)}</div>
      <div class="pan-veld">
        <div class="pan-podium" data-pan-podium role="img" aria-label="${esc(t('panelen3.huisLabel'))}"></div>
        <div class="pan-rechts">${rechts}</div>
      </div>
    </div>`;
  }

  /* ---------------------------------------------- doen */

  /** Een nieuw vlak op een plek, gericht als het zonnigste vlak dat er al is. */
  function nieuwVlak(d, plek) {
    const vrij = [...LETTERS].find((l) => !d.vlakken.some((v) => v.letter === l));
    const zuid = [...d.vlakken].sort((a, b) => hoek(a.azimuthDeg, 180) - hoek(b.azimuthDeg, 180))[0];
    const [opstelling, tiltDeg] = BEGIN[plek];
    return {
      letter: vrij,
      plek,
      opstelling,
      azimuthDeg: opstelling === 'oostwest' ? 90 : norm(zuid?.azimuthDeg ?? 180),
      tiltDeg,
      aantal: opstelling === 'oostwest' ? 4 : 8,
      ...(opstelling === 'oostwest' ? { aantal2: 4 } : {}),
      wpPerPaneel: wp(zuid?.wpPerPaneel ?? 430),
      meter: d.meters?.length === 1 ? d.meters[0].id : null,
      bron: 'bewoner',
    };
  }

  /** Zonder `peakW`, zoals de dienst een vlak leest. */
  const kaal = ({ peakW: _weg, ...v }) => v;

  /**
   * Een klik. Zet het scherm in `s`; geeft de nieuwe daken terug als er iets
   * te bewaren is, 'teken' als alleen het scherm verandert, of null.
   */
  function klik(knop, d, s) {
    const ds = knop.dataset;
    if (!d) return null;
    if (ds.dakScherm) {
      s.scherm = ds.dakScherm;
      s.concept = null;
      s.origineel = null;
      return 'teken';
    }
    if (ds.dakOpen) {
      const v = d.vlakken.find((x) => x.letter === ds.dakOpen);
      if (!v) return null;
      s.scherm = 'vlak';
      s.concept = { ...kaal(v), wpPerPaneel: wp(v.wpPerPaneel) };
      s.origineel = { ...s.concept };
      return 'teken';
    }
    if (ds.dakPlek) {
      s.scherm = 'vlak';
      s.concept = nieuwVlak(d, ds.dakPlek);
      s.origineel = null;
      return 'teken';
    }
    if (knop.hasAttribute('data-dak-geen')) return { geen: true };
    // Alle vlakken zonder meter bij deze omvormer.
    if (ds.dakAlles) return { vlakken: d.vlakken.map((v) => ({ ...kaal(v), meter: (d.meters ?? []).some((m) => m.id === v.meter) ? v.meter : ds.dakAlles })) };
    const c = s.concept;
    if (!c) return null;
    if (knop.hasAttribute('data-dak-bewaar')) {
      // Een andere richting of helling dan gemeten is zelf ingesteld.
      const o = s.origineel;
      const anders = !o || o.opstelling !== c.opstelling || norm(o.azimuthDeg) !== norm(c.azimuthDeg) || Math.round(o.tiltDeg) !== Math.round(c.tiltDeg);
      const vlak = { ...c, bron: c.bron === 'gemeten' && s.genomen ? 'gemeten' : anders ? 'bewoner' : c.bron };
      if (vlak.opstelling !== 'oostwest') delete vlak.aantal2;
      const bestaat = d.vlakken.some((v) => v.letter === c.letter);
      const vlakken = bestaat ? d.vlakken.map((v) => (v.letter === c.letter ? vlak : kaal(v))) : [...d.vlakken.map(kaal), vlak];
      s.scherm = 'alle';
      s.concept = null;
      s.origineel = null;
      s.genomen = false;
      return { vlakken };
    }
    if (knop.hasAttribute('data-dak-weg')) {
      const vlakken = d.vlakken.filter((v) => v.letter !== c.letter).map(kaal);
      s.scherm = 'alle';
      s.concept = null;
      return { vlakken };
    }
    if (knop.hasAttribute('data-dak-neem')) {
      const m = [...(d.meting ?? [])].sort((a, b) => hoek(a.azimuthDeg, c.azimuthDeg) - hoek(b.azimuthDeg, c.azimuthDeg))[0];
      if (m) {
        c.azimuthDeg = norm(m.azimuthDeg);
        c.tiltDeg = Math.round(m.tiltDeg);
        c.bron = 'gemeten';
        s.genomen = true;
      }
      return 'teken';
    }
    if (ds.dakOpstel) {
      const was = c.opstelling;
      c.opstelling = ds.dakOpstel;
      if (c.opstelling === 'plat') c.tiltDeg = 0;
      else if (was === 'plat' || !(HELLINGEN[c.opstelling] ?? []).includes(Math.round(c.tiltDeg))) c.tiltDeg = HELLINGEN[c.opstelling][Math.floor(HELLINGEN[c.opstelling].length / 2)];
      if (c.opstelling === 'oostwest' && was !== 'oostwest') {
        // De panelen over twee kanten; de richting oost.
        const n = c.aantal;
        c.aantal = Math.ceil(n / 2);
        c.aantal2 = Math.floor(n / 2);
        if (hoek(c.azimuthDeg, 90) > 45 && hoek(c.azimuthDeg, 270) > 45) c.azimuthDeg = 90;
      } else if (was === 'oostwest' && c.opstelling !== 'oostwest') {
        c.aantal = Math.max(1, c.aantal + (c.aantal2 ?? 0));
        delete c.aantal2;
      }
      return 'teken';
    }
    if (ds.dakHelling) {
      c.tiltDeg = Number(ds.dakHelling);
      return 'teken';
    }
    if (ds.dakMeter != null) {
      c.meter = ds.dakMeter || null;
      return 'teken';
    }
    if (ds.dakStap) {
      const dd = Number(ds.d);
      if (ds.dakStap === 'richting') c.azimuthDeg = norm(c.azimuthDeg + dd * 5);
      else if (ds.dakStap === 'wp') c.wpPerPaneel = Math.min(1000, Math.max(50, wp(c.wpPerPaneel) + dd * 5));
      else if (ds.dakStap === 'aantal' || ds.dakStap === 'aantal2') {
        const ow = c.opstelling === 'oostwest';
        const min = ow ? 0 : 1;
        c[ds.dakStap] = Math.min(200, Math.max(min, (c[ds.dakStap] ?? 0) + dd));
        // Oost-west mag één kant leeg hebben, niet allebei.
        if (ow && c.aantal + (c.aantal2 ?? 0) < 1) c[ds.dakStap] = 1;
      }
      return 'teken';
    }
    return null;
  }

  /** Een veld: de richting met de schuif, of een eigen helling. */
  function verander(el, s) {
    const c = s.concept;
    if (!c) return null;
    const n = Math.round(Number(el.value));
    if (el.hasAttribute('data-dak-draai')) c.azimuthDeg = norm(n);
    else if (el.hasAttribute('data-dak-hellingzelf') && el.value !== '' && n >= 0 && n <= 90) c.tiltDeg = n;
    else return null;
    return 'teken';
  }

  /**
   * De oude antwoorden uit de vlakken, voor wat ze nog leest (de tekening van
   * het huis, Thuis, Inrichten): de kant van het hoofddak met het aantal, en de
   * panelen op de garage, carport en het tuinhuis.
   */
  function oudeAntwoorden(vlakken, voorgevelDeg, vorige) {
    const hoofd = vlakken.filter((v) => v.plek === 'hoofddak');
    const elders = {};
    for (const p of ['garage', 'carport', 'tuinhuis']) {
      const n = vlakken.filter((v) => v.plek === p).reduce((s, v) => s + panelen(v), 0);
      if (n > 0) elders[p] = Math.min(200, n);
    }
    if (!vlakken.length) return { panelen: { ligging: 'geen', aantal: null, voorkant: null, achterkant: null }, elders };
    if (!hoofd.length) return { panelen: vorige, elders };
    const plat = hoofd.every((v) => v.opstelling !== 'schuin');
    const tot = Math.min(200, hoofd.reduce((s, v) => s + panelen(v), 0));
    if (plat) return { panelen: { ligging: 'plat', aantal: tot, voorkant: null, achterkant: null }, elders };
    const voorDeg = voorgevelDeg ?? hoofd[0].azimuthDeg;
    const voor = Math.min(200, hoofd.filter((v) => hoek(v.azimuthDeg, voorDeg) <= 90).reduce((s, v) => s + panelen(v), 0));
    const achter = Math.min(200, tot - voor);
    if (voor && achter) return { panelen: { ligging: 'beide', aantal: voor + achter, voorkant: voor, achterkant: achter }, elders };
    return { panelen: { ligging: voor ? 'voorkant' : 'achterkant', aantal: tot, voorkant: null, achterkant: null }, elders };
  }

  /**
   * Wat de tekening van het huis kan laten zien (stap 1): per vlak waar het
   * staat, en welke letters er nog niet in staan.
   */
  function opHetHuis(d, a, tek) {
    const labels = [];
    const mist = [];
    const voorDeg = d.voorgevelDeg;
    let voorkant = false;
    let achterkant = false;
    for (const v of d.vlakken) {
      let bij = null;
      if (v.plek === 'hoofddak') {
        // Zoals panelenOpDak (huismodel.js) ze tekent: de achterkant op het andere vlak.
        const achter = a.panelen.ligging === 'achterkant' || (v.opstelling === 'schuin' && voorDeg != null && hoek(v.azimuthDeg, voorDeg) > 90);
        if (achter && !achterkant) bij = 'panelenLinks';
        else if (!achter && !voorkant) bij = 'panelen';
        if (bij === 'panelen') voorkant = true;
        if (bij === 'panelenLinks') achterkant = true;
      } else if (v.plek === 'garage' && tek?.garage) bij = 'panelenGarage';
      else if ((v.plek === 'carport' && tek?.oprit?.carport) || (v.plek === 'tuinhuis' && tek?.tuin?.tuinhuis)) bij = 'getekend';
      if (!bij) mist.push(v.letter);
      else if (bij !== 'getekend') {
        labels.push({
          bij,
          titel: `${v.letter} · ${kort(v.azimuthDeg).toLowerCase()}`,
          toon: 'zon',
          regels: [t('panelen3.labelRegel', { helling: `${Math.round(v.tiltDeg)}°`, n: panelen(v) })],
          dx: bij === 'panelen' ? 24 : bij === 'panelenGarage' ? -40 : 34,
          dy: bij === 'panelen' ? -64 : bij === 'panelenGarage' ? -80 : -130,
        });
      }
    }
    return { labels, mist };
  }

  /** De zin onder de tekening: welke vlakken hij nog niet laat zien. */
  const nietGetekend = (mist) => (mist.length ? t('daken.nietGetekend', { n: mist.length, letters: mist.join(', ') }) : '');

  /** Voor de rij op Energie: "3 vlakken, 7,2 kWp". */
  const kortZin = (d) => (d?.vlakken?.length ? t('daken.zin', { n: d.vlakken.length, kwp: kWp(d.vlakken.reduce((s, v) => s + piek(v), 0)) }) : null);

  return { vorm, klik, verander, oudeAntwoorden, opHetHuis, nietGetekend, kortZin, piek, panelen };
})();
