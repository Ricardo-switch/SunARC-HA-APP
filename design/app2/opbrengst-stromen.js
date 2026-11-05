/*
 * Opbrengst met de nieuwe stromen (schets, 5 november 2026), gedeeld door
 * Wand-Opbrengst-Stromen en Tel-Opbrengst-Stromen. De getallen van november
 * zijn die van Ricardo, kloppend gemaakt (3,8 zelf + 3,4 terug = 7,2
 * opgewekt); juli laat zien hoe het vol is: drie daken, accu en auto.
 */
'use strict';

(function (global) {
  const nl = (n, d = 1) => n.toLocaleString('nl-NL', { minimumFractionDigits: Math.abs(n) >= 100 ? 0 : d, maximumFractionDigits: Math.abs(n) >= 100 ? 0 : d });
  const euro = (n) => `€ ${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const KLEUR = ['#f7b548', '#f3d48a', '#d98c3a', '#ffc970'];
  const NET = '#9aaabb';
  const MINT = '#6ee7b7';

  const NOV = {
    titel: '6% van je stroom kwam van je eigen panelen', naam: 'November 2026', vorige: 'oktober: 463 kWh gebruikt',
    gebruikt: 63.2, net: 59.4, kosten: 36.80, kostenVorige: 166.98, gasM3: 10.9, gasVorige: 36.0, gasEuro: 13.10, terugEuro: 0.31,
    daken: [{ l: 'A', naam: 'Hoofddak oost', kwh: 3.1, n: 6 }, { l: 'B', naam: 'Hoofddak west', kwh: 4.1, n: 6 }],
    zelf: 3.8, terug: 3.4, verwacht: 'Verwacht 15,9 kWh over 4 dagen met een verwachting; opgewekt 12,5 (−21%).',
    doelen: [{ id: 'airco-wk', naam: 'Airco woonkamer', kwh: 0.1, zon: 0.05 }, { id: 'airco-zo', naam: 'Airco zolder', kwh: 0.1, zon: 0.05 }, { id: 'rest', naam: 'Rest van het huis', kwh: 63.0, zon: 3.7 }],
    accu: null, dagen: [[2.3, 9], [1.0, 11], [0.4, 12], [0.1, 8], [0.0, 6]],
  };
  const JUL = {
    titel: '74% van je stroom kwam van je eigen panelen', naam: 'Juli 2026', vorige: 'juni: 612 kWh gebruikt',
    gebruikt: 545, net: 99, kosten: -52.28, kostenVorige: -80.36, gasM3: 9.8, gasVorige: 10.4, gasEuro: 11.80, terugEuro: 21.40,
    daken: [{ l: 'A', naam: 'Hoofddak oost', kwh: 296, n: 6 }, { l: 'B', naam: 'Hoofddak west', kwh: 342, n: 6 }, { l: 'C', naam: 'Garage', kwh: 210, n: 8 }],
    zelf: 446, terug: 402, verwacht: 'Verwacht 812 kWh, opgewekt 848 (+4%).',
    doelen: [{ id: 'auto', naam: 'Auto', kwh: 150, zon: 128 }, { id: 'airco-wk', naam: 'Airco woonkamer', kwh: 95, zon: 84 }, { id: 'boiler', naam: 'Boiler', kwh: 42, zon: 40 }, { id: 'vaat', naam: 'Vaatwasser', kwh: 4, zon: 3 }, { id: 'rest', naam: 'Rest van het huis', kwh: 254, zon: 191 }],
    accu: { laden: 64, ontladen: 58 }, dagen: Array.from({ length: 31 }, (_, i) => [18 + 10 * Math.sin(i / 3), 8 + 3 * Math.cos(i / 4)]),
  };
  const data = () => (location.hash === '#zomer' ? JUL : NOV);
  const opgewekt = (D) => D.daken.reduce((s, d) => s + d.kwh, 0);

  function cijfers(D) {
    return [
      ['Stroom gebruikt', nl(D.gebruikt), 'kWh', `${nl(D.net)} van het net`],
      ['Kosten', euro(D.kosten), '', `vorige ${euro(D.kostenVorige)}`],
      ['Gas', nl(D.gasM3), 'm³', `vorige ${nl(D.gasVorige)} m³`],
    ].map(([k, g, e, o]) => `<div class="cijfer"><div class="mini">${k}</div><div class="getal">${g}${e ? `<small>${e}</small>` : ''}</div><div class="klein">${o}</div></div>`).join('');
  }

  function panelen(D) {
    const op = opgewekt(D);
    const hoogste = Math.max(...D.daken.map((d) => d.kwh));
    return `<div class="kopregel"><h2 class="kop-3">Je panelen</h2><span class="zon-t" style="font: 600 22px var(--kop)">${nl(op)} kWh</span></div>
      <div class="verdeel"><i style="width: ${(D.zelf / op) * 100}%; background: var(--zon)"></i><i style="width: ${(D.terug / op) * 100}%; background: ${MINT}"></i></div>
      <div class="klein tweezijdig"><span><b>${nl(D.zelf)}</b> zelf gebruikt, ${Math.round((D.zelf / op) * 100)}%</span><span>${nl(D.terug)} naar het net</span></div>
      <div style="margin-top: 12px"><span class="blik"><span>Samen</span><span class="aan">Per dak</span></span></div>
      ${D.daken.map((d, i) => `<div class="dakrij"><span class="letter" style="background: ${KLEUR[i]}">${d.l}</span><span>${d.naam}<div class="staaf"><i style="width: ${(d.kwh / hoogste) * 100}%; background: ${KLEUR[i]}"></i></div></span><b>${nl(d.kwh)} kWh<small>${nl(d.kwh / d.n)} per paneel</small></b></div>`).join('')}
      <p class="mini" style="margin: 12px 0 0">${D.verwacht}</p>`;
  }

  function perDag(D) {
    const max = Math.max(...D.dagen.map(([z, n]) => z + n));
    return `<div class="kopregel"><h2 class="kop-3">Per dag</h2><span class="blik"><span class="aan">Deze periode</span><span>Vergelijken</span></span></div>
      <div class="dagen">${D.dagen.map(([z, n]) => `<div style="height: ${((z + n) / max) * 100}%"><i style="flex: ${n}; background: ${NET}"></i><i style="flex: ${z}; background: var(--zon)"></i></div>`).join('')}</div>
      <div class="legenda"><span><i style="background: var(--zon)"></i>zon</span><span><i style="background: ${NET}"></i>net</span></div>`;
  }

  function apparaten(D) {
    const lijst = [...D.doelen].sort((a, b) => b.kwh - a.kwh);
    return `<h2 class="kop-3" style="margin-bottom: 4px">Per apparaat</h2>
      ${lijst.map((d) => `<div class="rij"><div class="boven"><b>${d.naam}</b><span>${nl(d.kwh)} kWh, ${euro(Math.max(0, d.kwh - d.zon) * 0.27)}</span></div><div class="verdeel dun"><i style="width: ${(d.zon / d.kwh) * 100}%; background: var(--zon)"></i><i style="width: ${(1 - d.zon / d.kwh) * 100}%; background: ${NET}"></i></div></div>`).join('')}
      ${D.accu ? `<div class="rij"><div class="boven"><b>Accu</b><span>${nl(D.accu.laden)} in, ${nl(D.accu.ontladen)} uit</span></div><div class="verdeel dun"><i style="width: 100%; background: ${MINT}"></i></div></div>` : ''}`;
  }

  /**
   * Het stroombeeld: links de daken, de accu en het net, rechts waar het heen
   * ging; kleine stromen (onder 2%) samen. Elke band loopt van de kleur van zijn
   * bron naar die van zijn bestemming. `o.breedte`, `o.hoogte`, `o.id` (voor de
   * namen van de kleurovergangen).
   */
  function stromen(D, o) {
    const W = o.breedte;
    const H = o.hoogte;
    const xL = o.links ?? 104;
    const xR = W - (o.rechts ?? 136);
    const nb = 10;
    const op = opgewekt(D);
    const totaal = op + D.net + (D.accu?.ontladen ?? 0);
    const groot = D.doelen.filter((d) => d.kwh >= totaal * 0.02);
    const klein = D.doelen.filter((d) => d.kwh < totaal * 0.02);
    const doelen = [...groot];
    if (klein.length) doelen.push({ id: 'overig', naam: klein.every((k) => k.naam.startsWith('Airco')) ? "Airco's" : 'Overig', kwh: klein.reduce((s, d) => s + d.kwh, 0), zon: klein.reduce((s, d) => s + d.zon, 0), kleur: 'rgba(233,239,246,0.6)' });
    for (const d of doelen) d.kleur ??= 'rgba(233,239,246,0.6)';
    if (D.accu) doelen.push({ id: 'accu', naam: 'Accu laden', kwh: D.accu.laden, zon: D.accu.laden, kleur: MINT, accu: true });
    doelen.push({ id: 'terug', naam: 'Terug naar het net', kwh: D.terug, zon: D.terug, kleur: MINT, terug: true });
    const bronnen = [
      ...D.daken.map((d, i) => ({ id: d.l, naam: `${d.l} · ${d.naam.replace('Hoofddak ', '')}`, kwh: d.kwh, kleur: KLEUR[i], zon: true })),
      ...(D.accu ? [{ id: 'accu-uit', naam: 'Accu', kwh: D.accu.ontladen, kleur: MINT }] : []),
      { id: 'net', naam: 'Net', kwh: D.net, kleur: NET, euro: D.kosten > 0 ? euro(D.kosten) : null },
    ];
    // De zon naar rato over zijn doelen; wat de zon niet dekte uit de accu en het net.
    const st = [];
    const zonSom = doelen.reduce((s, d) => s + d.zon, 0);
    for (const b of bronnen.filter((x) => x.zon)) for (const d of doelen) if (d.zon > 0) st.push({ van: b.id, naar: d.id, kwh: (b.kwh * d.zon) / zonSom });
    const rest = doelen.filter((d) => !d.terug && !d.accu).map((d) => ({ d, r: Math.max(0, d.kwh - d.zon) }));
    const restSom = rest.reduce((s, x) => s + x.r, 0) || 1;
    for (const { d, r } of rest) {
      if (!r) continue;
      const uitAccu = D.accu ? (r / restSom) * D.accu.ontladen : 0;
      if (uitAccu) st.push({ van: 'accu-uit', naar: d.id, kwh: uitAccu });
      st.push({ van: 'net', naar: d.id, kwh: r - uitAccu });
    }
    const som = (id, kant) => st.filter((s) => s[kant] === id).reduce((t, s) => t + s.kwh, 0);
    const gat = 14;
    // Onderaan ruimte voor de naam van het laatste blok.
    const schaal = (H - 52 - gat * (Math.max(bronnen.length, doelen.length) - 1)) / Math.max(...[bronnen, doelen].map((l, i) => l.reduce((t, x) => t + som(x.id, i ? 'naar' : 'van'), 0)));
    const plek = {};
    const leg = (lijst, kant) => {
      let y = 12;
      for (const x of lijst) {
        const echt = som(x.id, kant) * schaal;
        const h = Math.max(4, echt);
        plek[x.id] = { y, h, vrij: y, rek: h / Math.max(1e-9, echt) };
        y += h + gat;
      }
    };
    leg(bronnen, 'van');
    leg(doelen, 'naar');
    const kleur = Object.fromEntries([...bronnen, ...doelen].map((x) => [x.id, x.kleur]));
    let defs = '';
    let s = '';
    st.forEach((f, i) => {
      const a = plek[f.van];
      const b = plek[f.naar];
      const ha = f.kwh * schaal * a.rek;
      const hb = f.kwh * schaal * b.rek;
      const y1 = a.vrij;
      const y2 = b.vrij;
      a.vrij += ha;
      b.vrij += hb;
      const x1 = xL + nb;
      const x2 = xR;
      const m = (x1 + x2) / 2;
      const id = `${o.id}-${i}`;
      defs += `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${kleur[f.van]}" stop-opacity="0.55"/><stop offset="1" stop-color="${kleur[f.naar]}" stop-opacity="0.32"/></linearGradient>`;
      s += `<path d="M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2} L${x2},${y2 + hb} C${m},${y2 + hb} ${m},${y1 + ha} ${x1},${y1 + ha}Z" fill="url(#${id})"/>`;
    });
    const tekst = (x, y, anker, kop, regels) => `<text x="${x}" y="${y}" text-anchor="${anker}" font-family="Figtree" font-size="12.5" font-weight="700" fill="#e9eff6">${kop}</text>${regels.map((r, i) => `<text x="${x}" y="${y + 14 * (i + 1)}" text-anchor="${anker}" font-family="Figtree" font-size="11.5" font-weight="${r.vet ? 700 : 500}" fill="${r.kleur ?? '#9fb0c2'}">${r.t}</text>`).join('')}`;
    // De namen naast hun blok, maar nooit over elkaar: wat te dicht zit, schuift omlaag.
    const plaatsNamen = (lijst, regels) => {
      let vrij = -Infinity;
      return lijst.map((x) => {
        const n = regels(x).length;
        const y = Math.max(plek[x.id].y + plek[x.id].h / 2 - 2 - (n * 14) / 2 + 7, vrij);
        vrij = y + 14 * (n + 1) + 4;
        return y;
      });
    };
    const bronRegels = (b) => [{ t: `${nl(b.kwh)} kWh` }, ...(b.euro ? [{ t: b.euro, vet: true }] : [])];
    const doelRegels = (d) => (d.terug ? [{ t: `${nl(d.kwh)} kWh` }, { t: `+ ${euro(D.terugEuro)}`, vet: true, kleur: MINT }] : [{ t: `${nl(d.kwh)} kWh${!d.accu ? ` · ${Math.round((d.zon / d.kwh) * 100)}% zon` : ''}` }]);
    const yBron = plaatsNamen(bronnen, bronRegels);
    const yDoel = plaatsNamen(doelen, doelRegels);
    bronnen.forEach((b, i) => {
      const p = plek[b.id];
      s += `<rect x="${xL}" y="${p.y}" width="${nb}" height="${p.h}" rx="3" fill="${b.kleur}"/>`;
      s += tekst(xL - 8, yBron[i], 'end', b.naam, bronRegels(b));
    });
    doelen.forEach((d, i) => {
      const p = plek[d.id];
      s += `<rect x="${xR}" y="${p.y}" width="${nb}" height="${p.h}" rx="3" fill="${d.kleur}"/>`;
      s += tekst(xR + nb + 8, yDoel[i], 'start', d.naam, doelRegels(d));
    });
    return `<defs>${defs}</defs>${s}`;
  }

  function gas(D) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="#ff8a6b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1 1.5 2 1.5 3 1.5-1.5 1.5-5 1.5-8z"/></svg><span><b>Gas</b> naar de verwarming<small>apart: op dezelfde schaal zou het alles wegdrukken</small></span><b>${nl(D.gasM3)} m³<small>${euro(D.gasEuro)}</small></b>`;
  }

  global.opbrengstStromen = { data, cijfers, panelen, perDag, apparaten, stromen, gas };
})(window);
