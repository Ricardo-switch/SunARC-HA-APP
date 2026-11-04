/*
 * Het huis van boven met zijn dakvlakken (schets daken, 4 november 2026),
 * gedeeld door Wand-Daken, Tel-Daken, Wand-Inrichten-Daken en Wand-Daken-Elders.
 * Het noorden boven, de straat onder. Elk vlak: een rechthoek, zijn panelen,
 * een pijl naar waar het kijkt, en een letter.
 */
'use strict';

(function (global) {
  const METER = { huis: '#f7b548', micro: '#6fd3ff', garage: '#a99cff' };
  const STANDKLEUR = { gemeten: '#6ee7b7', zelf: '#6fd3ff', leert: '#f7b548', mis: '#ff8a6b' };
  const STAND = { gemeten: '✓ gemeten', zelf: '✎ zelf ingesteld', leert: 'leert nog · 2 dagen', mis: '! levert minder' };

  const VLAKKEN = [
    { l: 'A', naam: 'Hoofddak, zuidkant', kort: 'Hoofddak zuid', waar: 'zuid · 180° · 40°', n: 14, wp: 410, stand: 'gemeten', meter: 'huis', x: 170, y: 262, w: 280, h: 66, soort: 'schuin', naar: [[0, 1]] },
    { l: 'B', naam: 'Dwarskap, westkant', kort: 'Dwarskap west', waar: 'west · 268° · 45°', n: 4, wp: 410, stand: 'zelf', meter: 'huis', x: 170, y: 328, w: 50, h: 110, soort: 'schuin', naar: [[-1, 0]] },
    { l: 'C', naam: 'Dwarskap, oostkant', kort: 'Dwarskap oost', waar: 'oost · 88° · 45°', n: 4, wp: 410, stand: 'zelf', meter: 'huis', x: 220, y: 328, w: 50, h: 110, soort: 'schuin', naar: [[1, 0]] },
    { l: 'D', naam: 'Uitbouw, plat dak', kort: 'Uitbouw', waar: 'oost-west · 94° en 274° · 10°', n: 16, wp: 430, stand: 'gemeten', meter: 'micro', x: 300, y: 130, w: 150, h: 66, soort: 'ow', naar: [[-1, 0], [1, 0]] },
    { l: 'E', naam: 'Garage, plat dak', kort: 'Garage', waar: 'zuid · 180° · 15° op rekken', n: 8, wp: 430, stand: 'gemeten', meter: 'garage', x: 475, y: 232, w: 100, h: 96, soort: 'rek', naar: [[0, 1]] },
    { l: 'F', naam: 'In de tuin, op de grond', kort: 'Tuin', waar: 'zuid · 175° · 30°', n: 6, wp: 400, stand: 'leert', meter: 'garage', x: 50, y: 70, w: 120, h: 44, soort: 'grond', naar: [[0, 1]] },
  ];
  const kwp = (v) => (v.n * v.wp / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 });

  const paneel = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="#3f6f9e" stroke="#9cc0e4" stroke-width="0.8"/>`;
  function panelen(v) {
    let p = '';
    if (v.soort === 'schuin' && v.w > v.h) for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) p += paneel(v.x + 12 + k * 37, v.y + 8 + r * 27, 34, 24);
    if (v.soort === 'schuin' && v.w <= v.h) for (let r = 0; r < 4; r++) p += paneel(v.x + 9, v.y + 8 + r * 25, 32, 22);
    if (v.soort === 'ow') for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const x = v.x + 10 + k * 34, y = v.y + 8 + r * 26;
      p += paneel(x, y, 14, 23) + paneel(x + 15, y, 14, 23) + `<path d="M${x + 14.5} ${y}v23" stroke="#cfe2f5" stroke-width="1"/>`;
    }
    if (v.soort === 'rek') for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) p += paneel(v.x + 10 + k * 41, v.y + 8 + r * 21, 38, 15) + `<path d="M${v.x + 10 + k * 41} ${v.y + 25 + r * 21}h38" stroke="rgb(0 0 0 / .35)" stroke-width="2"/>`;
    if (v.soort === 'grond') for (let k = 0; k < 6; k++) p += paneel(v.x + 4 + k * 19, v.y + 6, 17, 30);
    return p;
  }

  /**
   * De tekening als SVG-inhoud.
   * opts.kleur: 'stand' (standaard) of 'meter'; opts.open: een letter die
   * uitgelicht is (de rest gedimd), 'nieuw' voor een vlak dat je aanwijst;
   * opts.waarden: per letter een tekst in de letter-ballon (zoals "3,2 kW");
   * opts.mis: een letter met een rode rand en een schaduwvlek; opts.spook:
   * alles gestippeld en zonder pijlen, zoals vóór de meting (Inrichten);
   * opts.alleen: alleen deze letters tekenen.
   */
  function vanBoven(opts = {}) {
    const kleurVan = (v) => (opts.spook ? 'rgb(255 255 255 / 0.55)' : opts.kleur === 'meter' ? METER[v.meter] : opts.mis === v.l ? STANDKLEUR.mis : STANDKLEUR[v.stand]);
    let s = '<defs><marker id="dk-punt" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ffd27a"/></marker></defs>';
    s += '<rect x="20" y="20" width="600" height="470" rx="22" fill="rgb(110 190 130 / 0.10)" stroke="rgb(110 190 130 / 0.25)"/>';
    s += '<rect x="20" y="510" width="600" height="56" rx="12" fill="rgb(255 255 255 / 0.05)"/><text x="320" y="544" text-anchor="middle" font-family="Figtree" font-size="13" font-weight="700" fill="rgb(255 255 255 / .4)">straat</text>';
    s += '<path d="M612 300 Q320 760 28 300" fill="none" stroke="rgb(247 181 72 / 0.45)" stroke-width="2" stroke-dasharray="5 7"/>';
    s += `<circle cx="${opts.zonX ?? 470}" cy="${opts.zonY ?? 470}" r="13" fill="#f7b548"/><circle cx="${opts.zonX ?? 470}" cy="${opts.zonY ?? 470}" r="20" fill="none" stroke="rgb(247 181 72 / .35)" stroke-width="2"/>`;
    // De boom die 's ochtends op de dwarskap valt.
    if (opts.boom) s += '<g><ellipse cx="330" cy="430" rx="62" ry="22" fill="rgb(0 0 0 / 0.28)" transform="rotate(-20 330 430)"/><circle cx="372" cy="414" r="26" fill="#3f8f63" stroke="#6fc08f" stroke-width="1.5"/><text x="372" y="456" text-anchor="middle" font-family="Figtree" font-size="11" font-weight="700" fill="rgb(255 255 255 / .55)">boom</text></g>';
    // De gebouwen.
    const gebouw = (x, y, w, h, licht) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgb(255 255 255 / ${licht ? 0.07 : 0.10})" stroke="rgb(255 255 255 / ${licht ? 0.3 : 0.35})" stroke-width="1.5"/>`;
    s += gebouw(170, 196, 280, 132) + '<path d="M170 262H450" stroke="rgb(255 255 255 / 0.5)" stroke-width="2"/>';
    s += gebouw(170, 328, 100, 110) + '<path d="M220 328V438" stroke="rgb(255 255 255 / 0.5)" stroke-width="2"/>';
    s += gebouw(300, 130, 150, 66, true) + gebouw(475, 232, 100, 96, true);
    s += `<g font-family="Figtree" font-size="11" font-weight="700" fill="rgb(255 255 255 / .45)" text-anchor="middle"><text x="525" y="346">garage</text><text x="375" y="122">uitbouw</text>${opts.alleen ? '' : '<text x="310" y="232" fill="rgb(255 255 255 / .35)">noordkant: geen panelen</text>'}</g>`;
    for (const v of VLAKKEN.filter((x) => !opts.alleen || opts.alleen.includes(x.l))) {
      const dim = opts.open && opts.open !== 'nieuw' && opts.open !== v.l ? ' opacity="0.42"' : '';
      const k = kleurVan(v);
      const dik = opts.open === v.l || opts.mis === v.l ? 3 : 1.8;
      const streep = opts.spook || (v.stand === 'leert' && opts.kleur !== 'meter') ? ' stroke-dasharray="6 5"' : '';
      const omlijn = `<rect x="${v.x + 1}" y="${v.y + 1}" width="${v.w - 2}" height="${v.h - 2}" rx="4" fill="${opts.mis === v.l ? 'rgb(255 138 107 / 0.10)' : 'none'}" stroke="${k}" stroke-width="${dik}"${streep}/>`;
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      const pijlen = opts.spook ? '' : v.naar.map(([dx, dy]) => {
        const x0 = dx ? (dx < 0 ? v.x - 3 : v.x + v.w + 3) : v.l === 'A' ? cx + 46 : cx;
        const y0 = dy ? v.y + v.h - 4 : cy;
        return `<path d="M${x0} ${y0}l${dx * 26} ${dy * 26}" stroke="#ffd27a" stroke-width="3" stroke-linecap="round" marker-end="url(#dk-punt)"/>`;
      }).join('');
      const waarde = opts.waarden?.[v.l];
      const lx = v.l === 'B' ? v.x + 2 : v.l === 'C' ? v.x + v.w - 2 : v.x + v.w - 2;
      const ly = v.l === 'B' || v.l === 'C' ? v.y + v.h + 16 : v.y - 2;
      const breed = waarde ? 30 + waarde.length * 8 : 26;
      const letter = `<g transform="translate(${lx} ${ly})"><rect x="${-13}" y="-13" width="${breed}" height="26" rx="8" fill="${k}"/><text x="0" y="5" text-anchor="middle" font-family="Bricolage Grotesque" font-size="15" font-weight="800" fill="#0b1424">${v.l}</text>${waarde ? `<text x="13" y="5" font-family="Figtree" font-size="12" font-weight="800" fill="#0b1424">${waarde}</text>` : ''}</g>`;
      s += `<g${dim}${opts.spook ? ' opacity="0.75"' : ''}>${panelen(v)}${omlijn}${pijlen}${opts.spook ? '' : letter}</g>`;
    }
    if (opts.open === 'nieuw') s += '<rect x="176" y="200" width="268" height="58" rx="4" fill="rgb(247 181 72 / 0.08)" stroke="#f7b548" stroke-width="2" stroke-dasharray="7 6"/><text x="310" y="234" text-anchor="middle" font-family="Figtree" font-size="13" font-weight="800" fill="#f7b548">tik waar het nieuwe vlak ligt</text>';
    if (opts.open === 'D') s += '<g font-family="Figtree" font-size="12" font-weight="700" fill="#ffd27a"><text x="262" y="168" text-anchor="end">oost 94°</text><text x="488" y="168">west 274°</text></g>';
    s += '<g transform="translate(580 64)"><circle r="26" fill="rgb(11 20 36 / 0.6)" stroke="rgb(255 255 255 / 0.3)"/><path d="M0 -18l6 14h-12z" fill="#f7b548"/><text y="13" text-anchor="middle" font-family="Figtree" font-size="12" font-weight="800" fill="#fff">N</text></g>';
    return s;
  }

  global.daken = { VLAKKEN, METER, STANDKLEUR, STAND, kwp, vanBoven };
})(window);
