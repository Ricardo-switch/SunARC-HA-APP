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
  /**
   * De naam van een vlak (Ricardo, 5 november 2026): de eigen naam, of de plek;
   * liggen er meer vlakken op dezelfde plek, dan met de richting erbij
   * ("Hoofddak oost"), zodat je ze ook zonder tekening uit elkaar houdt.
   */
  function naam(v, alle = []) {
    if (v.naam) return v.naam;
    const plek = t(`daken.plek.${v.plek}`);
    if (!alle.some((x) => x.letter !== v.letter && x.plek === v.plek && !x.naam)) return plek;
    const richting = v.opstelling === 'plat' ? t('daken.opstelling.plat') : v.opstelling === 'oostwest' ? `${kort(v.azimuthDeg)}-${kort(v.azimuthDeg + 180)}` : kort(v.azimuthDeg);
    return `${plek} ${richting.toLowerCase()}`;
  }
  const letter = (v, kleur) => `<span class="dk-letter" style="background: ${kleur}">${esc(v.letter)}</span>`;

  /** Het kopje boven de lijst: hoe zeker het samen is. */
  function chip(vlakken, achter) {
    if (!vlakken.length) return '';
    if (achter) return `<span class="pan-chip dk-chipmis">${esc(t('daken.achter.chip'))}</span>`;
    if (vlakken.some((v) => v.bron === 'schatting')) return `<span class="pan-chip leert">${esc(t('daken.chip.schatting'))}</span>`;
    if (vlakken.every((v) => v.bron === 'gemeten')) return `<span class="pan-chip gemeten">${esc(t('panelen3.chip.gemeten'))}</span>`;
    return `<span class="pan-chip zelf">${esc(t('panelen3.chip.zelf'))}</span>`;
  }

  /* ---------------------------------------------- de schermen */

  function kaartje(v, _i, alle) {
    return `<button type="button" class="dk-vlak" data-dak-open="${esc(v.letter)}" aria-label="${esc(t('daken.open', { letter: v.letter, naam: naam(v, alle) }))}">
      ${letter(v, STANDKLEUR[v.bron])}
      <span><b>${esc(naam(v, alle))}</b><small>${esc(waar(v))} · <em class="dk-stand ${v.bron}">${esc(t(`daken.stand.${v.bron}`))}</em></small></span>
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
    // Een vlak dat achterblijft (stap 5): bovenaan, zolang het niet nagekeken is.
    const zorg = o.achter ?? '';
    return `${zorg}<div class="pan-kop3"><h3 class="kop-3">${esc(t('daken.waarKop'))}</h3>${vlakken.length < LETTERS.length ? `<button type="button" class="lig-link" data-dak-scherm="erbij">${esc(t('daken.erbij'))}</button>` : ''}</div>
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
    // De meting per dakvlak (stap 4): wat de meting voor dit vlak vond.
    const eigen = d.vlakMeting?.[v.letter];
    if (eigen && v.opstelling !== 'plat') {
      const woorden = { richting: `${norm(eigen.azimuthDeg)}°`, helling: `${Math.round(eigen.tiltDeg)}°` };
      if (hoek(eigen.azimuthDeg, v.azimuthDeg) <= 5 && Math.abs(eigen.tiltDeg - v.tiltDeg) <= 3) return `<div class="dk-meting"><b>${esc(t('daken.meting.klopt', woorden))}</b></div>`;
      return `<div class="dk-meting">${esc(t('daken.meting.zegt', woorden))} <button type="button" class="lig-link" data-dak-neem>${esc(t('daken.meting.neem'))}</button></div>`;
    }
    if (!d.meting?.length || v.plek !== 'hoofddak' || v.opstelling === 'plat') return '';
    const m = [...d.meting].sort((a, b) => hoek(a.azimuthDeg, v.azimuthDeg) - hoek(b.azimuthDeg, v.azimuthDeg))[0];
    if (!m) return '';
    // Geen gemeten vlak in de buurt: zeg wat de meting wel ziet.
    if (hoek(m.azimuthDeg, v.azimuthDeg) > 60) {
      const ziet = d.meting.map((x) => `${norm(x.azimuthDeg)}° (${kort(x.azimuthDeg).toLowerCase()})`).join(` ${t('algemeen.en')} `);
      return `<div class="dk-meting">${esc(t('daken.meting.elders', { richtingen: ziet }))}</div>`;
    }
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
    // Met één omvormer is er niets uit te leggen.
    return `<div class="dk-seg">${knoppen}</div>${meters.length === 1 ? '' : `<span class="klein">${esc(uitleg)}</span>`}`;
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
    // De kop is de naam, zelf in te vullen (5 november 2026); leeg is de plek met de richting.
    const anderen = [...d.vlakken.filter((x) => x.letter !== v.letter), { ...v, naam: '' }];
    const naamVeld = `<input class="dk-naamveld" type="text" maxlength="30" data-dak-naam value="${esc(v.naam ?? '')}" placeholder="${esc(naam({ ...v, naam: '' }, anderen))}" aria-label="${esc(t('daken.naamLabel'))}" title="${esc(t('daken.naamLabel'))}">`;
    return `<div class="dk-vlak open">${letter(v, STANDKLEUR[v.bron])}<span>${nieuw ? `<small class="dk-nieuw">${esc(t('daken.nieuwKort'))}</small>` : ''}${naamVeld}<small>${esc(waar(v))}</small></span><span class="dk-rechts"><b>${esc(kWp(piek(v)))}</b> kWp</span></div>
      ${ligtOp(d, v)}
      ${veld(t('daken.hoeLiggen'), `<div class="dk-opstel" role="group" aria-label="${esc(t('daken.hoeLiggen'))}">${OPSTELLINGEN.map((o) => `<button type="button" data-dak-opstel="${o}" aria-pressed="${v.opstelling === o}" class="${v.opstelling === o ? 'aan' : ''}"><svg viewBox="0 0 90 38" aria-hidden="true">${OPSTEL_BEELD[o]}</svg>${esc(t(`daken.opstelling.${o}`))}</button>`).join('')}</div>`)}
      ${v.opstelling === 'plat' ? '' : `<div class="dk-richting">${kompas(v)}
        ${veld(t('daken.richting'), `<div class="dk-rij">${stapper('richting', `${norm(v.azimuthDeg)}°`, t('daken.richting'))}${v.opstelling === 'oostwest' ? `<span class="klein">${esc(t('daken.enTegenover', { graden: `${norm(v.azimuthDeg + 180)}°` }))}</span>` : `<span class="klein">${esc(kort(v.azimuthDeg))}</span>`}</div>
          <input class="lig-draai" type="range" min="0" max="355" step="1" value="${norm(v.azimuthDeg) % 360}" data-dak-draai aria-label="${esc(t('daken.draai'))}">
          <span class="klein dk-uitleg">${esc(t(v.opstelling === 'oostwest' ? 'daken.richtingOw' : 'daken.richtingUitleg'))}</span>`)}</div>
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
    // Wat de omvormer hooguit levert, met een vak om het zelf in te vullen.
    const grens = (m) => `<label class="dk-grens"><span>${esc(m.grensW == null ? t('daken.grens.onbekend') : t(`daken.grens.${m.grensBron}`, { w: m.grensW.toLocaleString(window.taal.locale) }))}</span><input class="invoer" type="number" inputmode="numeric" min="100" max="100000" step="100" data-dak-grens="${esc(m.id)}" value="${m.grensBron === 'zelf' ? m.grensW : ''}" placeholder="${esc(t('daken.grens.vul'))}" aria-label="${esc(t('daken.grens.aria', { naam: m.naam }))}"></label>`;
    // Eén omvormer: met één tik ook de vlakken zonder meter erbij.
    const een = (d.meters ?? []).length === 1 ? d.meters[0] : null;
    const allesKnop = een ? `<button type="button" class="lig-knop zacht dk-alles" data-dak-alles="${esc(een.id)}">${esc(t('daken.meter.alles', { naam: een.naam }))}</button>` : '';
    const lijst = [
      ...groepen.map((g) => kaart(kleur.get(g.m.id), g.m.naam, t(g.vlakken.length > 1 ? 'daken.meter.samen' : 'daken.meter.precies'), g.vlakken, `${grens(g.m)}${verdeelGrafiek(d, g.m.id, g.vlakken)}`)),
      ...(zonder.length ? [kaart('rgb(255 255 255 / 0.35)', t('daken.meter.geen'), t('daken.meter.geenZin'), zonder, allesKnop)] : []),
    ].join('');
    return `<div class="pan-kop3"><h3 class="kop-3">${esc(t('daken.metersKop'))}</h3></div>
      <div class="dk-lijst">${lijst || `<p class="mini">${esc(t('daken.leeg'))}</p>`}</div>
      ${zonder.length || !groepen.some((g) => g.vlakken.length > 1) ? `<p class="mini">${esc(t('daken.metersUitleg'))}</p>` : ''}
      ${o.omvormers}
      ${o.sensor}
      <div class="dk-voet"><span class="mini">${esc(t('daken.naarVlakkenZin'))}</span><button type="button" class="lig-knop" data-dak-scherm="alle">${esc(t('daken.naarVlakken'))}</button></div>`;
  }

  /* ---------------------------------------------- van boven (stap 2a) */

  /** Welke plek een nieuw vlak krijgt op dit soort gebouw. */
  const NAAR_PLEK = { hoofdhuis: 'hoofddak', uitbouw: 'uitbouw', garage: 'garage', carport: 'carport', tuinhuis: 'tuinhuis', grond: 'grond', anders: 'tuinhuis' };
  const DAKVORMEN = ['zadel', 'schild', 'lessenaar', 'plat'];
  const VORM_BEELD = {
    zadel: '<path d="M3 19 15 6l12 13z" fill="#4d7eac" stroke="#9cc0e4"/><path d="M15 6v13" stroke="#cfe2f5"/>',
    schild: '<path d="M3 19 10 7h10l7 12z" fill="#4d7eac" stroke="#9cc0e4"/><path d="M10 7v12M20 7v12" stroke="#cfe2f5" stroke-width="0.8"/>',
    lessenaar: '<path d="M3 19V8l24 11z" fill="#4d7eac" stroke="#9cc0e4"/>',
    plat: '<path d="M3 19v-6h24v6z" fill="#4d7eac" stroke="#9cc0e4"/>',
  };
  const gebouwNaam = (g) => t(`daken.gebouw.${g.soort}`);
  const sleutelVan = (kant) => (kant == null ? 'plat' : String(kant));
  /** De gebouwen zoals de dienst ze leest, uit de tekening. */
  const gebouwenUit = (d) => (d.tekening?.gebouwen ?? []).map(({ id, soort, bron, omtrek, dakvorm, nokDeg, kaart }) => ({ id, soort, bron, omtrek, dakvorm, nokDeg, ...(kaart ? { kaart } : {}) }));
  /** Waar een vlak ligt: wat in het open vlak staat, anders wat de dienst vond. */
  function plaatsVan(d, v) {
    if (v.gebouw) return { gebouw: v.gebouw, kant: v.kant ?? null, getekend: true };
    return d.tekening?.plaats?.[v.letter] ?? { gebouw: null, kant: null, getekend: false };
  }
  /** Weg met de verwijzing naar een gebouw dat er niet meer is of anders ligt. */
  const losVan = (vlakken, ids) => vlakken.map((v) => (ids.includes(v.gebouw) ? (({ gebouw: _g, kant: _k, ...rest }) => rest)(kaal(v)) : kaal(v)));

  /** Het huis van boven als SVG: het noorden boven, in meters. */
  function bovenSvg(d, s) {
    const tk = d.tekening;
    const pts = [...tk.gebouwen.flatMap((g) => g.omtrek), ...tk.omgeving.flat()];
    if (!pts.length) return '';
    const midden = (lijst) => [lijst.reduce((x, p) => x + p[0], 0) / lijst.length, lijst.reduce((x, p) => x + p[1], 0) / lijst.length];
    const doos = (lijst) => {
      const xs = lijst.map((p) => p[0]);
      const ys = lijst.map((p) => p[1]);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    // De naam boven elk gebouw, midden boven zijn hoogste punt.
    const naamPlek = (g, f) => [midden(g.omtrek)[0], Math.max(...g.omtrek.map((p) => p[1])) + f * 1.1];
    const ruw = doos(pts);
    const fs = Math.max(ruw.x1 - ruw.x0, ruw.y1 - ruw.y0, 12) * 0.045;
    // De namen passen er ook in.
    const extra = tk.gebouwen.flatMap((g) => {
      const [x, y] = naamPlek(g, fs);
      const br = gebouwNaam(g).length * fs * 0.5 + fs;
      return [[x - br / 2, y + fs], [x + br / 2, y + fs]];
    });
    // De straat voor de voorgevel past er ook in.
    const huis0 = tk.gebouwen.find((g) => g.soort === 'hoofdhuis');
    if (huis0 && d.voorgevelDeg != null) {
      const c = midden(huis0.omtrek);
      const F = [Math.sin((d.voorgevelDeg * Math.PI) / 180), Math.cos((d.voorgevelDeg * Math.PI) / 180)];
      const voor = Math.max(...huis0.omtrek.map((p) => (p[0] - c[0]) * F[0] + (p[1] - c[1]) * F[1]));
      const s0 = [c[0] + F[0] * (voor + fs * 2.6), c[1] + F[1] * (voor + fs * 2.6)];
      extra.push([s0[0] - fs * 2.2, s0[1] - fs], [s0[0] + fs * 2.2, s0[1] + fs]);
    }
    const b = doos([...pts, ...extra]);
    const w0 = b.x1 - b.x0;
    const h0 = b.y1 - b.y0;
    const m = Math.max(2.5, 0.08 * Math.max(w0, h0));
    const vb = [b.x0 - m, -(b.y1 + m), w0 + 2 * m, h0 + 2 * m];
    const sw = Math.max(vb[2], vb[3]) * 0.0035;
    const P = (p) => `${p[0].toFixed(2)},${(-p[1]).toFixed(2)}`;
    const poly = (lijst) => lijst.map(P).join(' ');
    // Welke vlakken op welk dakvlak liggen; het open vlak op zijn nieuwe plek.
    const open = s.scherm === 'vlak' && s.concept ? s.concept : null;
    const per = new Map();
    for (const v of [...d.vlakken.filter((x) => x.letter !== open?.letter), ...(open ? [open] : [])]) {
      const p = plaatsVan(d, v);
      if (!p.gebouw || !p.getekend) continue;
      const k = `${p.gebouw}|${sleutelVan(p.kant)}`;
      per.set(k, [...(per.get(k) ?? []), v]);
    }
    // De namen in de tekening krijgen per scherm een eigen voorvoegsel (energie.js): wand en telefoon staan allebei in de pagina.
    let svg = `<defs><pattern id="dkid-paneel" width="1.15" height="1.75" patternUnits="userSpaceOnUse"><rect x="0.05" y="0.05" width="1.05" height="1.65" fill="#3f6f9e" stroke="#9cc0e4" stroke-width="0.06"/></pattern></defs>`;
    // De gebouwen eromheen: grijs, aan te tikken.
    svg += tk.omgeving.map((o, i) => {
      const c = midden(o);
      const aan = s.scherm === 'kandidaat' && s.kandidaat === i;
      return `<g class="dk-kand${aan ? ' aan' : ''}" data-dak-kandidaat="${i}" role="button" tabindex="0" aria-label="${esc(t('daken.kandidaatAria'))}"><polygon points="${poly(o)}" stroke-width="${sw}" stroke-dasharray="${sw * 4} ${sw * 3}"/><text x="${c[0].toFixed(2)}" y="${(-c[1] + fs * 0.35).toFixed(2)}" font-size="${fs * 1.2}" text-anchor="middle">+</text></g>`;
    }).join('');
    // De straat voor de voorgevel.
    const huis = tk.gebouwen.find((g) => g.soort === 'hoofdhuis');
    if (huis && d.voorgevelDeg != null) {
      const c = midden(huis.omtrek);
      const F = [Math.sin((d.voorgevelDeg * Math.PI) / 180), Math.cos((d.voorgevelDeg * Math.PI) / 180)];
      const voor = Math.max(...huis.omtrek.map((p) => (p[0] - c[0]) * F[0] + (p[1] - c[1]) * F[1]));
      const s0 = [c[0] + F[0] * (voor + fs * 2.6), c[1] + F[1] * (voor + fs * 2.6)];
      svg += `<text class="dk-straat" x="${s0[0].toFixed(2)}" y="${(-s0[1]).toFixed(2)}" font-size="${fs * 0.9}" text-anchor="middle">${esc(t('daken.straat'))}</text>`;
    }
    for (const g of tk.gebouwen) {
      const gekozen = s.scherm === 'gebouw' && s.gebouw === g.id;
      svg += `<g class="dk-gebouw${g.bron === 'schatting' ? ' geschat' : ''}${gekozen ? ' aan' : ''}"><clipPath id="dkid-k-${esc(g.id)}"><polygon points="${poly(g.omtrek)}"/></clipPath><polygon class="dk-romp" points="${poly(g.omtrek)}" stroke-width="${sw * 1.6}"${g.bron === 'schatting' ? ` stroke-dasharray="${sw * 5} ${sw * 4}"` : ''}/><g clip-path="url(#dkid-k-${esc(g.id)})">`;
      for (const dv of g.dakvlakken) {
        const k = `${g.id}|${sleutelVan(dv.kant)}`;
        const op = per.get(k) ?? [];
        const hier = open && op.some((v) => v.letter === open.letter);
        const richting = dv.kant == null ? t('daken.platDak') : t('daken.dakvlakKant', { richting: kort(dv.kant).toLowerCase() });
        svg += `<polygon class="dk-dv${op.length ? ' vol' : ''}${hier ? ' open' : ''}" points="${poly(dv.punten)}" stroke-width="${sw}" data-dak-dakvlak="${esc(k)}" role="button" tabindex="0" aria-label="${esc(t('daken.dakvlakAria', { richting, gebouw: gebouwNaam(g) }))}"/>`;
      }
      svg += '</g>';
      if (g.nok) svg += `<line class="dk-nok" x1="${g.nok[0][0]}" y1="${-g.nok[0][1]}" x2="${g.nok[1][0]}" y2="${-g.nok[1][1]}" stroke-width="${sw * 1.4}"/>`;
      // De naam boven het gebouw, om aan te tikken; de dakvorm staat dan rechts.
      const top = naamPlek(g, fs);
      const tekst = gebouwNaam(g);
      const br = tekst.length * fs * 0.5 + fs;
      svg += `<g class="dk-gnaam" data-dak-gebouw="${esc(g.id)}" role="button" tabindex="0" aria-label="${esc(`${tekst}, ${t(`daken.dakvorm.${g.dakvorm}`)}`)}" transform="translate(${top[0].toFixed(2)} ${(-top[1]).toFixed(2)})"><rect x="${(-br / 2).toFixed(2)}" y="${(-fs * 0.8).toFixed(2)}" width="${br.toFixed(2)}" height="${(fs * 1.3).toFixed(2)}" rx="${(fs * 0.4).toFixed(2)}"/><text font-size="${(fs * 0.78).toFixed(2)}" text-anchor="middle" y="${(fs * 0.12).toFixed(2)}">${esc(tekst)}</text></g>`;
    }
    // De panelen zelf, zoveel als er zijn (het open vlak zoals het nu bewaard is).
    for (const [, rects] of Object.entries(tk.panelen ?? {})) {
      svg += rects.map((r) => `<polygon class="dk-paneel" points="${poly(r)}" stroke-width="${(sw * 0.6).toFixed(3)}"/>`).join('');
    }
    // De letters, met een pijl naar waar het dakvlak kijkt.
    for (const g of tk.gebouwen) {
      for (const dv of g.dakvlakken) {
        const op = per.get(`${g.id}|${sleutelVan(dv.kant)}`) ?? [];
        if (!op.length) continue;
        // De letter naast de panelen van het eerste vlak, aan de kant waar het dakvlak naartoe kijkt.
        const eigen = (tk.panelen?.[op[0].letter] ?? []).flat();
        const pm = midden(eigen.length ? eigen : dv.punten);
        const kant = dv.kant ?? op[0].azimuthDeg;
        const K = [Math.sin((kant * Math.PI) / 180), Math.cos((kant * Math.PI) / 180)];
        const ver = eigen.length ? Math.max(...eigen.map((p) => (p[0] - pm[0]) * K[0] + (p[1] - pm[1]) * K[1])) : 0;
        const c = [pm[0] + K[0] * (ver + fs * 0.9), pm[1] + K[1] * (ver + fs * 0.9)];
        if (dv.kant != null) {
          svg += `<line class="dk-pijl" x1="${(c[0] + K[0] * fs * 0.75).toFixed(2)}" y1="${(-c[1] - K[1] * fs * 0.75).toFixed(2)}" x2="${(c[0] + K[0] * fs * 1.9).toFixed(2)}" y2="${(-c[1] - K[1] * fs * 1.9).toFixed(2)}" stroke-width="${sw * 3}"/>`;
        }
        op.forEach((v, i) => {
          const x = c[0] + (i - (op.length - 1) / 2) * fs * 1.6;
          const kleur = STANDKLEUR[v.bron];
          svg += `<g class="dk-badge${open?.letter === v.letter ? ' open' : ''}" transform="translate(${x.toFixed(2)} ${(-c[1]).toFixed(2)})"><rect x="${(-fs * 0.7).toFixed(2)}" y="${(-fs * 0.7).toFixed(2)}" width="${(fs * 1.4).toFixed(2)}" height="${(fs * 1.4).toFixed(2)}" rx="${(fs * 0.35).toFixed(2)}" fill="${kleur}"/><text font-size="${(fs * 0.95).toFixed(2)}" text-anchor="middle" y="${(fs * 0.33).toFixed(2)}">${esc(v.letter)}</text></g>`;
        });
      }
    }
    // Een groep, geen plaatje: de dakvlakken erin zijn aan te tikken.
    return `<svg class="dk-boven" viewBox="${vb.map((n) => n.toFixed(2)).join(' ')}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="${esc(t('daken.bovenAria'))}">${svg}</svg>`;
  }

  /** Het grote vak links: van boven, met de kaart en wat er nog niet in staat. */
  function podium(d, s) {
    if (s.zicht === 'huis') return `<div class="pan-podium" data-pan-podium role="img" aria-label="${esc(t('panelen3.huisLabel'))}"></div>`;
    const tk = d.tekening;
    const huis = tk?.gebouwen.find((g) => g.soort === 'hoofdhuis');
    const k = s.kaart;
    let balk = '';
    if (k === 'bezig') balk = `<div class="dk-kaart"><small>${esc(t('daken.kaartBezig'))}</small></div>`;
    else if (d.kaart && huis?.bron === 'schatting') balk = `<div class="dk-kaart"><button type="button" class="lig-knop zacht" data-dak-kaart>${esc(t('daken.kaartKnop'))}</button><small>${esc(k?.fout ?? t('daken.kaartZin'))}</small></div>`;
    // Uit de kaart (5 november 2026): experimenteel, met de bron en altijd Zonder kaart.
    else if (huis?.bron === 'kaart') balk = kaartBalk(huis, tk);
    const mist = d.vlakken.filter((v) => !plaatsVan(d, v).getekend).map((v) => v.letter);
    const noten = [...(mist.length ? [t('daken.nietBoven', { n: mist.length, letters: mist.join(', ') })] : []), ...(huis?.bron === 'kaart' && tk?.omgeving.length ? [t('daken.kandidaatTip')] : [])];
    const noot = noten.length ? `<p class="dk-noot">${esc(noten.join(' '))}</p>` : '';
    return `<div class="pan-podium dk-podium">${tk ? bovenSvg(d, s) : ''}<span class="dk-noord" aria-hidden="true">N</span>${noot}${balk}</div>`;
  }

  function gebouwScherm(d, s) {
    const g = d.tekening.gebouwen.find((x) => x.id === s.gebouw);
    if (!g) return alle(d, {});
    const op = d.vlakken.filter((v) => plaatsVan(d, v).gebouw === g.id);
    const nok = g.dakvorm === 'plat' ? '' : `<button type="button" class="lig-knop zacht" data-dak-nok="${esc(g.id)}">${esc(t(g.dakvorm === 'lessenaar' ? 'daken.andereKant' : 'daken.nokDraaien'))}</button>`;
    return `<div class="dk-vlak open"><span class="dk-letter dk-gicoon" style="background: rgb(255 255 255 / 0.14)"><svg viewBox="0 0 30 22" aria-hidden="true">${VORM_BEELD[g.dakvorm]}</svg></span><span><b>${esc(gebouwNaam(g))}</b><small>${esc(t(`daken.gebouwBron.${g.bron}`))}</small></span><span></span></div>
      ${veld(t('daken.dakvormKop'), `<div class="dk-opstel" role="group" aria-label="${esc(t('daken.dakvormKop'))}">${DAKVORMEN.map((v) => `<button type="button" data-dak-dakvorm="${v}" aria-pressed="${g.dakvorm === v}" class="${g.dakvorm === v ? 'aan' : ''}"><svg viewBox="0 0 30 22" aria-hidden="true">${VORM_BEELD[v]}</svg>${esc(t(`daken.dakvorm.${v}`))}</button>`).join('')}</div>`)}
      ${nok ? `<div class="dk-rij">${nok}</div>` : ''}
      <p class="mini">${esc(t('daken.gebouwUitleg'))}</p>
      ${op.length ? `<div class="dk-lijst">${op.map((v, i) => kaartje(v, i, d.vlakken)).join('')}</div>` : ''}
      <div class="dk-voet"><button type="button" class="lig-knop zacht" data-dak-scherm="alle">${esc(t('daken.alle'))}</button>${g.soort !== 'hoofdhuis' && g.bron === 'kaart' ? `<button type="button" class="lig-link dk-weg" data-dak-gebouwweg="${esc(g.id)}">${esc(t('daken.hoortNiet'))}</button>` : ''}</div>`;
  }

  function kandidaatScherm() {
    return `<div class="pan-kop3"><h3 class="kop-3">${esc(t('daken.kandidaatKop'))}</h3></div>
      <p class="mini">${esc(t('daken.kandidaatZin'))}</p>
      <div class="dk-tegels">${['uitbouw', 'garage', 'carport', 'tuinhuis', 'anders'].map((p) => `<button type="button" class="dk-tegel" data-dak-erbijgebouw="${p}"><svg viewBox="0 0 44 36" fill="none" stroke="#f7b548" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${TEGEL_BEELD[p === 'anders' ? 'tuinhuis' : p]}</svg><b>${esc(t(`daken.gebouw.${p}`))}</b><span></span></button>`).join('')}</div>
      <div class="dk-voet"><button type="button" class="lig-knop zacht" data-dak-scherm="alle">${esc(t('daken.nietVanOns'))}</button></div>`;
  }

  /** Waar het open vlak ligt, onder de kop. */
  function ligtOp(d, v) {
    const p = plaatsVan(d, v);
    const g = d.tekening?.gebouwen.find((x) => x.id === p.gebouw);
    if (!g || !p.getekend) return `<p class="mini dk-ligt">${esc(t('daken.ligtNergens'))}</p>`;
    const kant = p.kant == null ? t('daken.platDak') : t('daken.dakvlakKant', { richting: kort(p.kant).toLowerCase() });
    return `<p class="mini dk-ligt">${esc(t('daken.ligtOp', { gebouw: gebouwNaam(g), kant }))}</p>`;
  }

  /**
   * De omtrek uit de kaart (besluit 254): het hoofdhuis krijgt de omtrek uit
   * OpenStreetMap, geschatte blokken ernaast vallen weg (die zet SunArc opnieuw
   * neer), en de gebouwen eromheen komen grijs in de tekening.
   */
  async function vanKaart(d, s) {
    let body = null;
    let ok = false;
    try {
      const res = await app.deur('api/daken-kaart', {});
      body = res ? await res.json().catch(() => ({})) : {};
      ok = !!res?.ok;
    } catch {
      body = { fout: t('panelen.kaart.geenVerbinding') };
    }
    if (!ok || !body?.hoofdhuis) {
      s.kaart = { fout: body?.fout ?? body?.wachten ?? t('panelen.kaart.geenAntwoord') };
      return null;
    }
    s.kaart = null;
    const oud = gebouwenUit(d);
    const weg = oud.filter((g) => g.soort !== 'hoofdhuis' && g.bron === 'schatting').map((g) => g.id);
    // Uit 3D BAG ook het dak: de vorm en hoe de nok loopt (5 november 2026).
    const dak = body.dak && DAKVORMEN.includes(body.dak.dakvorm) ? { dakvorm: body.dak.dakvorm, nokDeg: body.dak.nokDeg } : {};
    const kaart = body.bron === 'bag3d' || body.bron === 'osm' ? { kaart: body.bron } : {};
    const gebouwen = oud.filter((g) => !weg.includes(g.id)).map((g) => (g.soort === 'hoofdhuis' ? { ...g, ...dak, omtrek: body.hoofdhuis, bron: 'kaart', ...kaart } : g));
    // Een ander dak: de kanten van het huis kunnen anders liggen, dus de vlakken op het huis opnieuw plaatsen.
    const huisId = oud.find((g) => g.soort === 'hoofdhuis')?.id;
    return { vlakken: losVan(d.vlakken, [...weg, ...(body.dak && huisId ? [huisId] : [])]), gebouwen, omgeving: body.omgeving ?? [] };
  }

  /*
   * De kaart is experimenteel (schets Wand-Daken-Kaart, 5 november 2026): de
   * balk onder de tekening met de bron en Zonder kaart, de melding voor het
   * ophalen, en de vraag voor Zonder kaart.
   */
  const PROEF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/></svg>';
  const proef = () => `<span class="kk-proef">${PROEF}${esc(t('daken.kk.proef'))}</span>`;
  function kaartBalk(huis, tk) {
    // Naamsvermelding: 3D BAG vraagt de naam met een link en dat de vorm aangepast is; OpenStreetMap ook een link.
    const bag = huis.kaart === 'bag3d';
    const osm = !bag || (tk?.omgeving?.length ?? 0) > 0;
    const bronnen = [
      ...(bag ? [`<a href="https://docs.3dbag.nl/en/copyright" target="_blank" rel="noopener">${esc(t('daken.kk.bag'))}</a>`] : []),
      ...(osm ? [`<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">${esc(t('daken.kk.osm'))}</a>`] : []),
    ].join(' · ');
    return `<div class="dk-kaart kk-balk">${proef()}<span class="kk-balktekst"><b>${esc(t('daken.kk.balk'))}</b><small>${bronnen}</small></span><button type="button" class="lig-knop zacht" data-dak-zonderkaart>${esc(t('daken.kk.zonder'))}</button></div>`;
  }
  const KK_IK = {
    kaart: '<path d="M4 7l5-2 6 2 5-2v12l-5 2-6-2-5 2z"/><path d="M9 5v12M15 7v12"/>',
    dak: '<path d="M3 13 9 7l6 4 6-5v12H3z"/><path d="M9 7v11M15 11v7"/>',
    huis: '<path d="M3 12 12 4l9 8"/><path d="M6 10v10h12V10"/>',
    let: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/>',
    vak: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16" stroke-dasharray="2 2.5"/>',
    plek: '<path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    slot: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    terug: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  };
  const kkIk = (soort, kleur) => `<span class="kk-ik kk-${kleur}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${KK_IK[soort]}</svg></span>`;
  const kkRegel = (soort, kleur, sleutel) => `<div class="kk-regel">${kkIk(soort, kleur)}<span><b>${esc(t(`daken.kk.${sleutel}b`))}</b> ${esc(t(`daken.kk.${sleutel}`))}</span></div>`;
  /** De melding voor het ophalen: wat het doet, de privacy en altijd terug. */
  function kaartVenster() {
    return `<div class="kk-dim" data-kk-dicht></div><section class="kk-venster" role="dialog" aria-modal="true" aria-labelledby="kk-kop">
      <div class="kk-inhoud">
        <div class="kk-kop"><h2 class="kop-2" id="kk-kop">${esc(t('daken.kk.kop'))}</h2>${proef()}</div>
        <p class="kk-lead">${esc(t('daken.kk.lead'))}</p>
        <div class="kk-twee">
          <div class="kk-blok"><h3>${esc(t('daken.kk.doetKop'))}</h3>${kkRegel('kaart', 'zon', 'doet1')}${kkRegel('dak', 'zon', 'doet2')}${kkRegel('huis', 'zon', 'doet3')}${kkRegel('let', 'zon', 'doet4')}</div>
          <div class="kk-blok"><h3>${esc(t('daken.kk.privKop'))}</h3>${kkRegel('vak', 'mint', 'priv1')}${kkRegel('plek', 'mint', 'priv2')}${kkRegel('slot', 'mint', 'priv3')}</div>
        </div>
        <div class="kk-terug">${kkIk('terug', 'ijs')}<span><b>${esc(t('daken.kk.terugb'))}</b> ${esc(t('daken.kk.terug'))}</span></div>
      </div>
      <div class="kk-voet"><button type="button" class="kk-niet" data-kk-dicht>${esc(t('daken.kk.nee'))}</button><button type="button" class="knop knop-licht" data-kk-kaart>${esc(t('daken.kk.ja'))}</button></div>
    </section>`;
  }
  /** De vraag voor Zonder kaart: wat er blijft. */
  function zonderVenster() {
    return `<div class="kk-dim" data-kk-dicht></div><section class="kk-venster kk-klein" role="dialog" aria-modal="true" aria-labelledby="kk-kop">
      <div class="kk-inhoud"><div class="kk-kop"><h2 class="kop-2" id="kk-kop">${esc(t('daken.kk.zonderKop'))}</h2></div><p class="kk-lead">${esc(t('daken.kk.zonderZin'))}</p></div>
      <div class="kk-voet"><button type="button" class="kk-niet" data-kk-dicht>${esc(t('daken.kk.annuleren'))}</button><button type="button" class="knop knop-licht" data-kk-zonder>${esc(t('daken.kk.zonder'))}</button></div>
    </section>`;
  }
  /** Zonder kaart: geen gebouwen en geen omgeving meer, dan tekent SunArc weer een rechthoek; de vlakken blijven, los van de gebouwen. */
  function zonderKaart(d) {
    return { vlakken: losVan(d.vlakken, gebouwenUit(d).map((g) => g.id)), gebouwen: [], omgeving: [] };
  }

  /** Een kleur per letter voor de verdeling. */
  const LETTERKLEUR = ['#f7b548', '#6fd3ff', '#a99cff', '#6ee7b7', '#ff8a6b', '#f3d48a', '#9cc0e4', '#d98c3a'];

  /** Wat de meter gisteren mat, gestapeld per vlak (stap 4); alleen als hij meer vlakken meet. */
  function verdeelGrafiek(d, id, vlakken) {
    const v = d.verdeling?.[id];
    if (!v || v.letters.length < 2 || !v.punten.length) return '';
    const W = 400;
    const H = 64;
    const van = Math.floor(v.punten[0][0]);
    const tot = Math.ceil(v.punten.at(-1)[0] + 0.25);
    const top = Math.max(...v.punten.map((p) => p.slice(1).reduce((s, x) => s + x, 0))) * 1.05 || 1;
    const X = (h) => ((h - van) / Math.max(1, tot - van)) * W;
    const Y = (w) => H - 12 - (w / top) * (H - 16);
    let onder = v.punten.map(() => 0);
    let lagen = '';
    v.letters.forEach((l, i) => {
      const boven = v.punten.map((p, j) => onder[j] + p[i + 1]);
      const pad = `M${v.punten.map((p, j) => `${X(p[0]).toFixed(1)},${Y(boven[j]).toFixed(1)}`).join(' L')} L${v.punten.map((p, j) => `${X(p[0]).toFixed(1)},${Y(onder[j]).toFixed(1)}`).reverse().join(' L')}Z`;
      lagen += `<path d="${pad}" fill="${LETTERKLEUR[i % LETTERKLEUR.length]}" fill-opacity="0.85"/>`;
      onder = boven;
    });
    const uren = [];
    for (let h = Math.ceil(van / 3) * 3; h <= tot; h += 3) uren.push(h);
    const as = uren.map((h) => `<text x="${X(h).toFixed(1)}" y="${H - 1}" font-size="9" text-anchor="middle" fill="var(--gedempt)">${h}:00</text>`).join('');
    const datum = new Date(`${v.datum}T12:00:00`).toLocaleDateString(window.taal.locale, { weekday: 'long', day: 'numeric', month: 'long' });
    const legenda = v.letters.map((l, i) => `<span><i style="background: ${LETTERKLEUR[i % LETTERKLEUR.length]}"></i>${esc(l)}</span>`).join('');
    return `<div class="dk-verdeel"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t('daken.verdeelAria', { letters: v.letters.join(', ') }))}">${lagen}<line x1="0" x2="${W}" y1="${H - 12}" y2="${H - 12}" stroke="rgb(255 255 255 / .2)"/>${as}</svg><div class="dk-legenda"><small>${esc(t('daken.verdeel', { datum }))}</small>${legenda}</div></div>`;
  }

  /**
   * De hele pagina. `d`: `aInfo.daken`; `s`: het scherm en het vlak dat open
   * staat; `o.helderW`: de zon bij heldere lucht nu; `o.omvormers` en
   * `o.sensor`: de blokken over de omvormers, van energie.js; `o.geen`: de
   * bewoner zei geen zonnepanelen.
   */
  function vorm(d, s, o = {}) {
    const vlakken = d?.vlakken ?? [];
    const rechts = !d
      ? ''
      : s.scherm === 'vlak' && s.concept
        ? vlakScherm(d, s)
        : s.scherm === 'erbij'
          ? erbij()
          : s.scherm === 'meters'
            ? meters(d, o)
            : s.scherm === 'gebouw'
              ? gebouwScherm(d, s)
              : s.scherm === 'kandidaat'
                ? kandidaatScherm()
                : alle(d, { ...o, achter: achterKaart(d, s) });
    // Van boven of het huis (besluit 254): standaard van boven.
    const wissel = `<span class="dk-wissel" role="group">${['boven', 'huis'].map((z) => `<button type="button" data-dak-zicht="${z}" aria-pressed="${(s.zicht ?? 'boven') === z}">${esc(t(`daken.zicht.${z}`))}</button>`).join('')}</span>`;
    return `<div class="pan3 dk">
      <div class="pan-kop"><h2 class="kop-2">${esc(t('daken.titel'))}</h2>${chip(vlakken, d?.achter && s.achterGezien !== `${d.achter.letter}:${d.achter.wanneer}`)}${d ? `${wissel}<button type="button" class="pil dk-vraag" data-dak-uitleg aria-label="${esc(t('daken.uitleg'))}" title="${esc(t('daken.uitleg'))}">?</button>` : ''}</div>
      <div class="pan-veld">
        ${d ? podium(d, s) : ''}
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
    // Ik kijk het na: de melding weg tot er iets anders achterblijft.
    if (ds.dakGezien) {
      s.achterGezien = ds.dakGezien;
      try {
        localStorage.setItem('sc-dak-gezien', ds.dakGezien);
      } catch {
        // Zonder opslag komt hij bij de volgende keer terug.
      }
      return 'teken';
    }
    if (ds.dakZicht) {
      s.zicht = ds.dakZicht;
      return 'teken';
    }
    if (knop.hasAttribute('data-dak-kaart')) {
      s.kaart = 'bezig';
      return { kaart: true };
    }
    if (ds.dakDakvlak) {
      const [gid, k] = ds.dakDakvlak.split('|');
      const kant = k === 'plat' ? null : Number(k);
      const c0 = s.scherm === 'vlak' ? s.concept : null;
      // Een vlak staat open: tik om te wisselen naar dit dakvlak.
      if (c0) {
        c0.gebouw = gid;
        c0.kant = kant;
        if (kant != null && c0.opstelling === 'schuin' && c0.bron !== 'gemeten') c0.azimuthDeg = kant;
        if (kant == null && c0.opstelling === 'schuin') {
          c0.opstelling = 'rek';
          c0.tiltDeg = 15;
        }
        return 'teken';
      }
      const hier = d.vlakken.filter((v) => {
        const p = plaatsVan(d, v);
        return p.getekend && p.gebouw === gid && sleutelVan(p.kant) === k;
      });
      s.scherm = 'vlak';
      if (hier.length) {
        s.concept = { ...kaal(hier[0]), wpPerPaneel: wp(hier[0].wpPerPaneel) };
        s.origineel = { ...s.concept };
        return 'teken';
      }
      // Een leeg dakvlak: een nieuw vlak dat erop ligt.
      const g = d.tekening.gebouwen.find((x) => x.id === gid);
      const v = nieuwVlak(d, NAAR_PLEK[g?.soort] ?? 'hoofddak');
      v.gebouw = gid;
      v.kant = kant;
      if (kant != null) {
        v.opstelling = 'schuin';
        v.azimuthDeg = kant;
        delete v.aantal2;
        if (v.tiltDeg < 20) v.tiltDeg = 35;
      } else if (v.opstelling === 'schuin') {
        v.opstelling = 'rek';
        v.tiltDeg = 15;
      }
      s.concept = v;
      s.origineel = null;
      return 'teken';
    }
    if (ds.dakKandidaat != null) {
      s.scherm = 'kandidaat';
      s.kandidaat = Number(ds.dakKandidaat);
      return 'teken';
    }
    if (ds.dakErbijgebouw) {
      const soort = ds.dakErbijgebouw;
      const omtrek = d.tekening.omgeving[s.kandidaat];
      if (!omtrek) return null;
      const gebouwen = gebouwenUit(d);
      const geschat = gebouwen.find((g) => g.soort === soort && g.bron === 'schatting');
      let id;
      if (geschat) {
        Object.assign(geschat, { omtrek, bron: 'kaart' });
        id = geschat.id;
      } else {
        id = soort;
        for (let i = 2; gebouwen.some((g) => g.id === id); i++) id = `${soort}-${i}`;
        gebouwen.push({ id, soort, bron: 'kaart', omtrek, dakvorm: soort === 'tuinhuis' || soort === 'anders' ? 'zadel' : 'plat', nokDeg: 0 });
      }
      s.scherm = 'gebouw';
      s.gebouw = id;
      return { vlakken: losVan(d.vlakken, geschat ? [geschat.id] : []), gebouwen, omgeving: d.tekening.omgeving.filter((_o, i) => i !== s.kandidaat) };
    }
    if (ds.dakGebouw) {
      s.scherm = 'gebouw';
      s.gebouw = ds.dakGebouw;
      return 'teken';
    }
    if (ds.dakDakvorm || ds.dakNok) {
      const id = ds.dakNok ?? s.gebouw;
      const gebouwen = gebouwenUit(d).map((g) => {
        if (g.id !== id) return g;
        if (ds.dakDakvorm) return { ...g, dakvorm: ds.dakDakvorm };
        return { ...g, nokDeg: g.dakvorm === 'lessenaar' ? norm(g.nokDeg + 90) : (g.nokDeg + 90) % 180 };
      });
      // De dakvlakken veranderen: wat erop lag, zoekt SunArc opnieuw.
      return { vlakken: losVan(d.vlakken, [id]), gebouwen };
    }
    if (ds.dakGebouwweg) {
      const g = gebouwenUit(d).find((x) => x.id === ds.dakGebouwweg);
      if (!g) return null;
      s.scherm = 'alle';
      return { vlakken: losVan(d.vlakken, [g.id]), gebouwen: gebouwenUit(d).filter((x) => x.id !== g.id), omgeving: [...d.tekening.omgeving, g.omtrek] };
    }
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
      const m = d.vlakMeting?.[c.letter] ?? [...(d.meting ?? [])].sort((a, b) => hoek(a.azimuthDeg, c.azimuthDeg) - hoek(b.azimuthDeg, c.azimuthDeg))[0];
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
  function verander(el, s, d) {
    // Wat een omvormer hooguit levert (stap 4): leeg is weer zoals uit het typenummer.
    if (el.dataset.dakGrens && d) {
      const w = el.value === '' ? null : Math.round(Number(el.value));
      if (w != null && (!Number.isFinite(w) || w < 100 || w > 100000)) return null;
      const grenzen = { ...(d.grenzen ?? {}) };
      if (w == null) delete grenzen[el.dataset.dakGrens];
      else grenzen[el.dataset.dakGrens] = w;
      return { vlakken: d.vlakken.map(kaal), grenzen };
    }
    const c = s.concept;
    if (!c) return null;
    const n = Math.round(Number(el.value));
    // Een eigen naam: alleen in het concept, Bewaar bewaart hem; leeg is weer de plek.
    if (el.hasAttribute('data-dak-naam')) {
      const x = el.value.trim().replace(/\s+/g, ' ').slice(0, 30);
      if (x) c.naam = x;
      else delete c.naam;
      return null;
    }
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

  /** Wanneer, in woorden, voor een vlak dat achterblijft. */
  const wanneerVan = (w) => t(`daken.wanneer.${w}`);

  /**
   * De zin bij een vlak dat achterblijft (stap 5): met een eigen meter per
   * paneel vergeleken; met één meter "waarschijnlijk".
   */
  function achterZin(a) {
    if (!a) return '';
    if (a.eigenMeter && a.vergelijk) return t('daken.achter.vergelijk', { letter: a.letter ?? '?', pct: a.minderPct, ander: a.vergelijk });
    if (a.letter) return t(a.eigenMeter ? 'daken.achter.zeker' : 'daken.achter.waarschijnlijk', { letter: a.letter, pct: a.minderPct, wanneer: wanneerVan(a.wanneer) });
    return t('daken.achter.dak', { pct: a.minderPct, wanneer: wanneerVan(a.wanneer) });
  }

  /** De lijn van de zonnige dagen: verwacht gestippeld, gemeten in oranje, het deel van de dag gekleurd. */
  function achterLijn(a) {
    const l = a?.lijn ?? [];
    if (l.length < 6) return '';
    const W = 400;
    const H = 96;
    const van = Math.floor(l[0][0]);
    const tot = Math.ceil(l.at(-1)[0]);
    const top = Math.max(...l.map((p) => Math.max(p[1], p[2]))) * 1.05 || 1;
    const X = (h) => ((h - van) / Math.max(1, tot - van)) * W;
    const Y = (w) => H - 12 - (w / top) * (H - 16);
    const pad = (k) => l.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ');
    const uren = [];
    for (let h = Math.ceil(van / 3) * 3; h <= tot; h += 3) uren.push(h);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t('daken.achter.lijnAria'))}">
      <path d="${pad(1)} L${X(l.at(-1)[0]).toFixed(1)},${H - 12} L${X(l[0][0]).toFixed(1)},${H - 12}Z" fill="rgba(255, 138, 107, 0.22)"/>
      <path d="${pad(2)}" fill="none" stroke="var(--zacht)" stroke-width="1.8" stroke-dasharray="5 5"/>
      <path d="${pad(1)}" fill="none" stroke="#ff8a6b" stroke-width="2.2"/>
      <line x1="0" x2="${W}" y1="${H - 12}" y2="${H - 12}" stroke="rgb(255 255 255 / .2)"/>
      ${uren.map((h) => `<text x="${X(h).toFixed(1)}" y="${H - 1}" font-size="9" text-anchor="middle" fill="var(--gedempt)">${h}:00</text>`).join('')}
    </svg>`;
  }

  /** De melding bovenaan Daken en panelen (schets #klopt). */
  function achterKaart(d, s) {
    const a = d.achter;
    if (!a || s.achterGezien === `${a.letter}:${a.wanneer}`) return '';
    // Met één meter weet SunArc alleen wanneer het dak minder geeft: de kop noemt dan geen vlak.
    const kop = a.letter && a.eigenMeter ? t('daken.achter.kop', { letter: a.letter, wanneer: wanneerVan(a.wanneer) }) : t('daken.achter.kopDak', { wanneer: wanneerVan(a.wanneer) });
    return `<div class="dk-zorg"><h3>${esc(kop)}</h3>${achterLijn(a)}<div class="dk-legenda"><span><i style="background: var(--zacht)"></i>${esc(t('daken.achter.helder'))}</span><span><i style="background: #ff8a6b"></i>${esc(t('daken.achter.gemeten'))}</span></div>
      <p>${esc(achterZin(a))} ${esc(t(a.wanneer === 'dag' ? 'daken.achter.uitlegDag' : 'daken.achter.uitlegDeel'))}</p>
      <div class="dk-rij"><button type="button" class="lig-knop zacht" data-dak-gezien="${esc(`${a.letter}:${a.wanneer}`)}">${esc(t('daken.achter.nakijken'))}</button>${a.letter ? `<button type="button" class="lig-knop zacht" data-dak-open="${esc(a.letter)}">${esc(t('daken.achter.aanpassen'))}</button>` : ''}</div></div>`;
  }

  /** Het huis van boven met wat elk vlak nu levert, voor Thuis (stap 5). */
  function nuBlad(d) {
    const nu = d.nu ?? {};
    const vlakken = d.vlakken ?? [];
    const top = Math.max(1, ...vlakken.map((v) => Math.max(nu[v.letter]?.w ?? 0, nu[v.letter]?.helderW ?? 0)));
    const kw = (w) => (w / 1000).toLocaleString(window.taal.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const som = vlakken.reduce((s, v) => s + (nu[v.letter]?.w ?? 0), 0);
    const helder = vlakken.reduce((s, v) => s + (nu[v.letter]?.helderW ?? 0), 0);
    const achter = d.achter?.letter;
    const rijen = vlakken.map((v) => {
      const n = nu[v.letter] ?? { w: null, helderW: 0 };
      const kleur = achter === v.letter ? '#ff8a6b' : '#f7b548';
      return `<div class="dk-nurij"><span class="dk-letter" style="background: ${kleur}">${esc(v.letter)}</span><span>${esc(naam(v, vlakken))}</span><span class="dk-staaf"><i style="width: ${(((n.w ?? 0) / top) * 100).toFixed(1)}%; background: ${kleur}"></i><em style="left: ${((n.helderW / top) * 100).toFixed(1)}%"></em></span><b>${n.w == null ? '–' : `${kw(n.w)} kW`}</b></div>`;
    }).join('');
    const svg = d.tekening ? bovenSvg(d, { scherm: 'alle', zicht: 'boven' }).replaceAll('dkid-', 'dkthuis-') : '';
    return `<div class="dk-bladkop"><h2>${esc(t('daken.nu.kop'))}</h2><button type="button" class="dk-sluit" data-dakblad-sluit aria-label="${esc(t('algemeen.sluiten'))}">×</button></div>
      <p class="klein">${esc(t('daken.nu.zin', { nu: kw(som), helder: kw(helder) }))}</p>
      <div class="dk-bladboven">${svg}</div>
      <div class="dk-nurijen">${rijen}</div>
      <p class="klein">${esc(t('daken.nu.streep'))}</p>
      ${d.achter ? `<p class="dk-opval">${esc(achterZin(d.achter))}</p>` : ''}`;
  }

  /*
   * De korte stap in Inrichten (besluit 254, stap 3; schets
   * Wand-Inrichten-Daken): per plek hoeveel panelen, en bij het hoofddak
   * hoeveel kanten. Elke plek wordt meteen een vlak, geschat: de meting zet
   * richting en helling daarna vanzelf goed (stap 4). Wat de bewoner bij Daken
   * en panelen al instelde, blijft staan; alleen het aantal verandert.
   */
  const KORT_PLEKKEN = ['hoofddak', 'uitbouw', 'garage', 'grond', 'carport', 'tuinhuis', 'gevel'];
  const isHoofd = (v) => v.plek === 'hoofddak' || v.plek === 'dwarskap';
  /** De kanten van het hoofddak: per kant het vlak en welk aantal (oost-west zijn er twee). */
  const kantenVan = (vlakken) => vlakken.filter(isHoofd).flatMap((v) => (v.opstelling === 'oostwest' ? [[v, 'aantal'], [v, 'aantal2']] : [[v, 'aantal']]));

  /** Wat de korte stap laat zien: per plek het aantal, en de kanten van het hoofddak. */
  function kortVan(d) {
    const vl = d?.vlakken ?? [];
    const aan = {};
    for (const p of KORT_PLEKKEN) {
      const n = vl.filter((v) => (p === 'hoofddak' ? isHoofd(v) : v.plek === p)).reduce((s, v) => s + panelen(v), 0);
      if (n > 0) aan[p] = n;
    }
    const kanten = kantenVan(vl);
    return { aan, kanten: Math.min(3, kanten.length), perKant: kanten.slice(0, 3).map(([v, k]) => v[k] ?? 0) };
  }

  /** Zet het aantal van een vlak; oost-west houdt zijn verhouding. */
  function zetTotaal(v, n) {
    if (v.opstelling !== 'oostwest') {
      v.aantal = Math.max(1, Math.min(200, n));
      return;
    }
    const tot = panelen(v) || 1;
    v.aantal = Math.min(200, Math.round((n * v.aantal) / tot));
    v.aantal2 = Math.min(200, Math.max(0, n - v.aantal));
    if (v.aantal + v.aantal2 < 1) v.aantal = 1;
  }

  /**
   * De vlakken na één wijziging in de korte stap: `{ plek, n }` (0 haalt de
   * plek weg), `{ kanten }` (1 tot 3) of `{ kant, n }`. Zonder `peakW`, zoals
   * de dienst ze leest.
   */
  function kortNaar(d, w) {
    let vl = (d?.vlakken ?? []).map((v) => ({ ...kaal(v) }));
    const voor = d?.voorgevelDeg ?? null;
    // De zonnigste kant van het huis, zolang de meting het niet weet.
    const zonnig = voor == null ? 180 : hoek(voor, 180) <= 90 ? norm(voor) : norm(voor + 180);
    const nieuw = (plek, extra) => {
      const v = nieuwVlak({ ...d, vlakken: vl }, plek);
      Object.assign(v, { bron: 'schatting' }, extra);
      if (v.opstelling !== 'oostwest') delete v.aantal2;
      vl.push(v);
      return v;
    };
    const n = Math.max(0, Math.min(200, Math.round(w.n ?? 0)));
    if (w.plek && w.plek !== 'hoofddak') {
      const hier = vl.filter((v) => v.plek === w.plek);
      if (!n) vl = vl.filter((v) => v.plek !== w.plek);
      else if (!hier.length) zetTotaal(nieuw(w.plek, {}), n);
      // Meer vlakken op één plek: de eerste krijgt het verschil.
      else zetTotaal(hier[0], n - hier.slice(1).reduce((s, v) => s + panelen(v), 0));
      return vl;
    }
    if (w.plek === 'hoofddak' && !n) return vl.filter((v) => !isHoofd(v));
    let kanten = kantenVan(vl);
    if (w.plek === 'hoofddak') {
      if (!kanten.length) nieuw('hoofddak', { azimuthDeg: zonnig, aantal: Math.max(1, n) });
      else if (kanten.length === 1) zetTotaal(kanten[0][0], n);
      return vl;
    }
    if (w.kanten != null) {
      const k = Math.max(1, Math.min(3, w.kanten));
      // Minder kanten: vlakken van achteren weg, een oost-west wordt een rek naar één kant.
      while (kanten.length > k) {
        const [v, sleutel] = kanten[kanten.length - 1];
        if (sleutel === 'aantal2') {
          v.opstelling = 'rek';
          v.aantal += v.aantal2 ?? 0;
          delete v.aantal2;
        } else vl = vl.filter((x) => x !== v);
        kanten = kantenVan(vl);
      }
      const eerste = kanten[0]?.[0];
      const basis = eerste ? eerste.azimuthDeg : zonnig;
      const tal = eerste ? eerste[kanten[0][1]] || 1 : 8;
      for (let i = kanten.length; i < k; i++) nieuw('hoofddak', { azimuthDeg: norm(basis + [0, 180, 90][i]), aantal: tal, tiltDeg: eerste?.tiltDeg ?? 40 });
      return vl;
    }
    if (w.kant != null && kanten[w.kant]) {
      const [v, sleutel] = kanten[w.kant];
      if (v.opstelling === 'oostwest') {
        v[sleutel] = n;
        if (v.aantal + (v.aantal2 ?? 0) < 1) v[sleutel] = 1;
      } else v.aantal = Math.max(1, n);
    }
    return vl;
  }

  /** De kant bij het huis: voorkant, achterkant of opzij, als de voorgevel bekend is. */
  function kantNaam(d, i) {
    const v = kantenVan(d?.vlakken ?? [])[i];
    const voor = d?.voorgevelDeg;
    if (!v || voor == null) return t('inr.dak.kantN', { n: i + 1 });
    const az = v[1] === 'aantal2' ? v[0].azimuthDeg + 180 : v[0].azimuthDeg;
    const h = hoek(az, voor);
    return t(h <= 45 ? 'energie.kant.voorkant' : h >= 135 ? 'energie.kant.achterkant' : 'inr.dak.opzij');
  }

  /*
   * De rondleiding de eerste keer dat Daken en panelen opent (besluit 254):
   * zes stops op de pagina zelf, met rondleiding.eigen; het vraagteken
   * bovenin laat hem opnieuw zien.
   */
  const RONDJE = [
    { plek: 'daken', id: 'dakBoven', doel: ['#wand .dk-boven, #wand [data-pan-podium]', '#tel .dk-boven, #tel [data-pan-podium]'] },
    { plek: 'daken', id: 'dakLijst', doel: ['#wand .pan-rechts .dk-lijst', '#tel .pan-rechts .dk-lijst'] },
    { plek: 'daken', id: 'dakZicht', doel: ['#wand .dk-wissel', '#tel .dk-wissel'] },
    // Het huis (Ricardo, 5 november 2026): de wissel gaat vanzelf om, en bij de volgende stop terug.
    { plek: 'daken', id: 'dakHuis', doe: ['#wand [data-dak-zicht="huis"]', '#tel [data-dak-zicht="huis"]'], doel: ['#wand [data-pan-podium]', '#tel [data-pan-podium]'] },
    { plek: 'daken', id: 'dakErbij', doe: ['#wand [data-dak-zicht="boven"]', '#tel [data-dak-zicht="boven"]'], doel: ['#wand [data-dak-scherm="erbij"]', '#tel [data-dak-scherm="erbij"]'] },
    { plek: 'daken', id: 'dakMeters', doel: ['#wand [data-dak-scherm="meters"]', '#tel [data-dak-scherm="meters"]'], klaar: true },
  ];

  return { naam, kaartVenster, zonderVenster, zonderKaart, RONDJE, vorm, klik, verander, oudeAntwoorden, opHetHuis, nietGetekend, kortZin, piek, panelen, vanKaart, gebouwenUit, nuBlad, achterZin, KORT_PLEKKEN, STANDKLEUR, kortVan, kortNaar, kantNaam, kaal, waar };
})();
