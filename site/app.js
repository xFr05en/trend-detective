/* Trend Detective front end.
   Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.

   Two sources of results:
   - Saved records: data/results.json, computed in advance by the Python pipeline.
   - Your own place and season: fetched live from NASA POWER and analysed in the browser by stats.js,
     which is checked against the Python code (tests/check_js_parity.py). */
(async function () {
  const $ = (id) => document.getElementById(id);
  const COLORS = { rising: '#FF8A4C', falling: '#5BB0FF', mixed: '#E8D44D', none: '#9AA7B4' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const PRESET_PLACES = [
    ['Seoul', 37.57, 126.98], ['Busan', 35.18, 129.08], ['Daegu', 35.87, 128.60], ['Gwangju', 35.16, 126.85],
    ['Daejeon', 36.35, 127.39], ['Chuncheon', 37.88, 127.73], ['Hwacheon', 38.11, 127.71], ['Gangneung', 37.75, 128.88],
    ['Jinhae', 35.13, 128.71], ['Jeju', 33.50, 126.53], ['Tokyo', 35.68, 139.69], ['London', 51.51, -0.13],
    ['New York', 40.71, -74.01], ['Nairobi', -1.29, 36.82], ['São Paulo', -23.55, -46.63], ['Sydney', -33.87, 151.21],
  ];
  const MONTH_PRESETS = [['Dec–Feb', [12, 1, 2]], ['Mar–May', [3, 4, 5]], ['Jun–Aug', [6, 7, 8]], ['Sep–Nov', [9, 10, 11]], ['All year', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]];
  const EXAMPLES = [
    { q: 'Is January still cold enough for a winter festival?', place: 'Hwacheon', months: [1], v: 'T2M' },
    { q: 'Is March warming where the cherry blossoms bloom?', place: 'Jinhae', months: [3], v: 'T2M' },
    { q: 'Are summers getting hotter for Daegu’s fruit growers?', place: 'Daegu', months: [6, 7, 8], v: 'T2M' },
    { q: 'Is the summer rainy season bringing more rain to Seoul?', place: 'Seoul', months: [6, 7, 8], v: 'PRECTOTCORR' },
  ];
  const LIVE_VARS = ['T2M', 'T2M_MIN', 'PRECTOTCORR'];
  const POWER = 'https://power.larc.nasa.gov/api/temporal/monthly/point';

  let R, SIM;
  try {
    [R, SIM] = await Promise.all([
      fetch('data/results.json').then((r) => r.json()),
      fetch('data/simulation.json').then((r) => r.json()).catch(() => null),
    ]);
  } catch (e) {
    $('p-headline').textContent = 'Could not load the data files.';
    $('p-def').textContent = 'Open this page through a web server (for example: python -m http.server inside the site folder).';
    return;
  }
  /* give saved series the same shape as live ones */
  Object.values(R.series).forEach((s) => { s.ppy = 12; s.series = s.anomalies; s.monthsLabel = 'all months'; });

  const state = { series: null, investigation: null, year: null, timer: null,
    custom: { name: 'Seoul', lat: 37.57, lon: 126.98, months: [12, 1, 2], v: 'T2M' } };
  const cache = new Map();
  let started = false;
  const S = (id) => R.series[id];
  const placeOf = (id) => R.places[S(id).place];
  const varOf = (id) => R.variables[S(id).variable];
  const seriesAt = (place) => Object.keys(R.series).filter((k) => S(k).place === place);

  /* ---------- formatting ---------- */
  const sign = (x, nd = 2) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(nd);
  const fmtP = (p) => (p < 0.001 ? 'p < 0.001' : 'p = ' + p.toFixed(3));
  function monthsLabel(sel) {
    if (sel.length === 12) return 'all months';
    const hit = MONTH_PRESETS.find(([, m]) => m.length === sel.length && m.every((x) => sel.includes(x)));
    if (hit) return hit[0];
    return [...sel].sort((a, b) => a - b).map((m) => MONTHS[m - 1]).join(', ');
  }
  function windowFor(id, year) {
    const w = S(id).windows;
    return w.find((x) => x.end_year === year) || w[w.length - 1];
  }
  function colorKey(w) { return w.strength === 'strong' ? w.direction : w.strength === 'mixed' ? 'mixed' : 'none'; }
  function stableSince(id, year) {
    const w = S(id).windows.filter((x) => x.end_year <= year);
    let y = null;
    for (let i = w.length - 1; i >= 0; i--) { if (w[i].strength === 'strong') y = w[i].end_year; else break; }
    return y;
  }

  /* ---------- left rail ---------- */
  function storyButton(q, sub, pressed, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'story'; b.setAttribute('aria-pressed', String(pressed));
    b.innerHTML = '<span class="q"></span><span class="caps"></span>';
    b.querySelector('.q').textContent = q; b.querySelector('.caps').textContent = sub;
    b.addEventListener('click', onClick);
    return b;
  }
  function renderRail() {
    const ex = $('examples'); ex.innerHTML = '';
    EXAMPLES.forEach((e) => {
      const c = state.custom;
      const on = state.series === 'custom' && c.name === e.place && c.v === e.v && monthsLabel(c.months) === monthsLabel(e.months);
      ex.appendChild(storyButton(e.q, `${e.place} · ${monthsLabel(e.months)} · ${R.variables[e.v].name}`, on, () => {
        const p = PRESET_PLACES.find((x) => x[0] === e.place);
        state.custom = { name: p[0], lat: p[1], lon: p[2], months: [...e.months], v: e.v };
        syncForm(); runCustom();
      }));
    });
    const box = $('investigations'); box.innerHTML = '';
    R.investigations.forEach((inv) => {
      const first = inv.series[0];
      const sub = inv.series.length === 2
        ? `${varOf(first).name} · ${placeOf(inv.series[0]).name} and ${placeOf(inv.series[1]).name}`
        : `${varOf(first).name} · ${S(first).start_year} to ${S(first).end_year}`;
      box.appendChild(storyButton(inv.question, sub, state.investigation === inv.id, () => select(first, inv.id)));
    });
  }

  /* ---------- season checker form ---------- */
  function buildForm() {
    const ps = $('c-place');
    PRESET_PLACES.forEach(([n], i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = n; ps.appendChild(o); });
    const o = document.createElement('option'); o.value = 'point'; o.textContent = 'Point clicked on the globe'; o.disabled = true; ps.appendChild(o);
    ps.addEventListener('change', () => {
      if (ps.value === 'point') return;
      const p = PRESET_PLACES[+ps.value]; Object.assign(state.custom, { name: p[0], lat: p[1], lon: p[2] }); syncForm();
    });
    const mb = $('c-months');
    MONTHS.forEach((m, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = m; b.dataset.m = String(i + 1);
      b.addEventListener('click', () => {
        const k = i + 1, sel = state.custom.months;
        state.custom.months = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]; syncForm();
      });
      mb.appendChild(b);
    });
    const pr = $('c-presets');
    MONTH_PRESETS.forEach(([label, months]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { state.custom.months = [...months]; syncForm(); });
      pr.appendChild(b);
    });
    const vs = $('c-var');
    LIVE_VARS.forEach((k) => { const o2 = document.createElement('option'); o2.value = k; o2.textContent = R.variables[k].name; vs.appendChild(o2); });
    vs.addEventListener('change', () => { state.custom.v = vs.value; });
    $('c-run').addEventListener('click', runCustom);
    syncForm();
  }
  function syncForm() {
    const c = state.custom, i = PRESET_PLACES.findIndex((p) => p[0] === c.name && p[1] === c.lat && p[2] === c.lon);
    const ps = $('c-place'), pt = ps.querySelector('option[value="point"]');
    if (i >= 0) { ps.value = String(i); pt.disabled = true; } else { pt.disabled = false; ps.value = 'point'; }
    $('c-coords').textContent = `${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}°. Or click anywhere on the globe.`;
    $('c-months').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(c.months.includes(+b.dataset.m))));
    $('c-var').value = c.v;
    $('c-run').disabled = c.months.length === 0;
    $('c-status').textContent = c.months.length === 0 ? 'Pick at least one month.' : '';
  }
  async function fetchPower(lat, lon) {
    const key = lat.toFixed(2) + ',' + lon.toFixed(2);
    if (cache.has(key)) return cache.get(key);
    const url = `${POWER}?parameters=${LIVE_VARS.join(',')}&community=AG&longitude=${lon.toFixed(2)}&latitude=${lat.toFixed(2)}&start=1981&end=2025&format=JSON`;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
    let j;
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); j = await r.json(); }
    finally { clearTimeout(timer); }
    const out = {};
    LIVE_VARS.forEach((v) => {
      const d = j.properties.parameter[v], years = [], months = [], values = [];
      Object.keys(d).sort().forEach((k) => {
        if (k.endsWith('13') || d[k] <= -900) return;       // 13 = annual value; -999 = missing
        years.push(+k.slice(0, 4)); months.push(+k.slice(4)); values.push(d[k]);
      });
      out[v] = { years, months, values };
    });
    cache.set(key, out);
    return out;
  }
  function fullYearsOnly(d) {
    const count = new Map(); d.years.forEach((y) => count.set(y, (count.get(y) || 0) + 1));
    const keep = d.years.map((y) => count.get(y) === 12);
    return { years: d.years.filter((_, i) => keep[i]), months: d.months.filter((_, i) => keep[i]), values: d.values.filter((_, i) => keep[i]) };
  }
  async function runCustom() {
    const c = state.custom; if (!c.months.length) return;
    stopPlay();
    $('c-run').disabled = true; $('c-status').textContent = 'Asking NASA for this place…';
    try {
      const all = await fetchPower(c.lat, c.lon);
      $('c-status').textContent = 'Running the tests…';
      await new Promise((r) => setTimeout(r, 20));
      const allYear = c.months.length === 12;
      const d = allYear ? fullYearsOnly(all[c.v]) : all[c.v];
      const res = allYear ? TD.analyseMonthly(d.values, d.years, d.months) : TD.analyseSeason(d.values, d.years, d.months, c.months);
      R.places.custom = { name: c.name, lat: c.lat, lon: c.lon };
      R.series.custom = { place: 'custom', variable: c.v, custom: true, ppy: res.points_per_year, monthsLabel: monthsLabel(c.months),
        start_year: res.start_year, end_year: res.end_year, mean: res.mean, series: res.series, climatology: res.climatology,
        season_years: res.season_years || null, windows: res.windows, careful: res.careful, more_years_needed: res.more_years_needed };
      $('c-status').textContent = '';
      select('custom', null);
    } catch (e) {
      $('c-status').textContent = 'NASA’s data service did not answer. Try again in a moment, or open a saved record below.';
    } finally { $('c-run').disabled = false; }
  }

  /* ---------- globe ---------- */
  let globe = null;
  function markerEl(placeId, flat) {
    const ids = seriesAt(placeId);
    const shown = ids.includes(state.series) ? state.series : ids[0];
    const key = colorKey(windowFor(shown, Math.min(state.year, S(shown).end_year)));
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'marker' + (S(state.series).place === placeId ? ' sel' : '') + (flat ? ' flat' : '');
    b.style.setProperty('--c', COLORS[key]);
    b.setAttribute('aria-label', `${R.places[placeId].name}: investigate`);
    b.innerHTML = '<span class="dot"></span><span class="name"></span>';
    b.querySelector('.name').textContent = R.places[placeId].name.toUpperCase();
    b.addEventListener('click', (ev) => { ev.stopPropagation(); select(shown, null); });
    return b;
  }
  function placeData() {
    return Object.keys(R.places).filter((id) => seriesAt(id).length).map((id) => ({ id, lat: R.places[id].lat, lng: R.places[id].lon }));
  }
  function initGlobe() {
    const el = $('globe');
    try {
      if (typeof Globe !== 'function') throw new Error('globe library missing');
      globe = Globe()(el)
        .globeImageUrl('vendor/earth-blue-marble.jpg')
        .backgroundColor('rgba(0,0,0,0)')
        .atmosphereColor('#5BB0FF').atmosphereAltitude(0.16)
        .htmlLat('lat').htmlLng('lng').htmlAltitude(0.01)
        .htmlElement((d) => markerEl(d.id, false))
        .htmlElementsData(placeData())
        .onGlobeClick(({ lat, lng }) => {
          Object.assign(state.custom, { name: 'Selected point', lat: Math.round(lat * 100) / 100, lon: Math.round(lng * 100) / 100 });
          syncForm(); $('c-status').textContent = 'Point set. Press “Check this season”.';
        })
        .width(el.clientWidth).height(el.clientHeight);
      const c = globe.controls();
      c.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      c.autoRotateSpeed = 0.35; c.enableZoom = true; c.minDistance = 160; c.maxDistance = 520;
      el.addEventListener('pointerdown', () => { c.autoRotate = false; }, { once: true });
      window.addEventListener('resize', () => globe.width(el.clientWidth).height(el.clientHeight));
    } catch (e) {
      globe = null; el.hidden = true; $('globe-fallback').hidden = false;
    }
  }
  function renderMarkers() {
    if (globe) { globe.htmlElementsData(placeData()); return; }
    const fb = $('globe-fallback'); fb.innerHTML = '';
    placeData().forEach((d) => fb.appendChild(markerEl(d.id, true)));
  }

  /* ---------- chart ---------- */
  function renderChart(id, year) {
    const s = S(id), w = windowFor(id, year), ppy = s.ppy, an = s.series, n = an.length;
    const W = 380, H = 200, L = 40, Rm = 8, T = 10, B = 26;
    const nShow = ppy === 12 ? (year - s.start_year + 1) * 12 : s.season_years.filter((y) => y <= year).length;
    const meanShown = an.slice(0, nShow).reduce((a, b) => a + b, 0) / nShow;
    let lo = Math.min(...an), hi = Math.max(...an);
    const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const X = (i) => L + (W - L - Rm) * (n > 1 ? i / (n - 1) : 0);
    const Y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const col = COLORS[colorKey(w)], tMid = (nShow - 1) / 2;
    const line = (slope, i) => meanShown + (slope / (10 * ppy)) * (i - tMid);
    const pt = (v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
    const shown = an.slice(0, nShow);
    let dataMarks;
    if (ppy === 12) {
      const ma = [];
      for (let i = 6; i <= nShow - 6; i++) { let sum = 0; for (let j = i - 6; j <= i + 5; j++) sum += an[j]; ma.push(pt(sum / 12, i)); }
      dataMarks = `<polyline points="${shown.map(pt).join(' ')}" fill="none" stroke="#9AA7B4" stroke-width="0.7" opacity="0.55"/>` +
        `<polyline points="${ma.join(' ')}" fill="none" stroke="#F2F5F8" stroke-width="1.4"/>`;
    } else {
      dataMarks = `<polyline points="${shown.map(pt).join(' ')}" fill="none" stroke="#F2F5F8" stroke-width="1.2"/>` +
        shown.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="1.9" fill="#F2F5F8"/>`).join('');
    }
    const b = [[0, w.lo], [nShow - 1, w.hi], [nShow - 1, w.lo], [0, w.hi]].map(([i, sl]) => pt(line(sl, i), i));
    let ticks = '';
    const span = hi - lo, step = span > 12 ? 5 : span > 5 ? 2 : span > 2 ? 1 : span > 0.8 ? 0.5 : 0.2;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      ticks += `<line x1="${L}" x2="${W - Rm}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${Math.abs(v) < 1e-9 ? '#5A6878' : '#1E2835'}" stroke-width="1"/>` +
        `<text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="#9AA7B4">${sign(v, step < 1 ? 1 : 0)}</text>`;
    }
    let years = '';
    for (let y = Math.ceil(s.start_year / 10) * 10; y <= s.end_year; y += 10) {
      years += `<text x="${X((y - s.start_year) * ppy).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#9AA7B4">${y}</text>`;
    }
    const v = varOf(id);
    $('chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${v.name} at ${placeOf(id).name}, ${s.monthsLabel}, ${s.start_year} to ${year}, with the fitted trend.">
      ${ticks}${years}
      <polygon points="${b[0]} ${b[1]} ${b[2]} ${b[3]}" fill="${col}" opacity="0.22"/>
      ${dataMarks}
      <line x1="${X(0).toFixed(1)}" y1="${Y(line(w.slope, 0)).toFixed(1)}" x2="${X(nShow - 1).toFixed(1)}" y2="${Y(line(w.slope, nShow - 1)).toFixed(1)}" stroke="${col}" stroke-width="2.4"/>
    </svg>`;
    $('chart-note').textContent = ppy === 12
      ? `Difference from the usual value for each calendar month (${v.unit}). Grey: monthly. White: 12-month average. Coloured line and band: trend and the range the careful check cannot rule out.`
      : `One value per year: the ${s.monthsLabel} average, shown as the difference from its long-term mean (${v.unit}). Coloured line and band: trend and the range the careful check cannot rule out.`;
  }

  /* ---------- answer panel ---------- */
  function row(dt, dd, small) { return `<div><dt>${dt}</dt><dd>${dd}${small ? `<small>${small}</small>` : ''}</dd></div>`; }
  function renderPanel() {
    const id = state.series, s = S(id), v = varOf(id), pl = placeOf(id), w = windowFor(id, state.year);
    const full = state.year === s.end_year;
    const tabs = $('tabs'); tabs.innerHTML = '';
    const tabIds = s.custom ? LIVE_VARS : seriesAt(s.place);
    if (tabIds.length > 1) tabIds.forEach((k) => {
      const b = document.createElement('button'), on = s.custom ? k === s.variable : k === id;
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(on));
      b.textContent = s.custom ? R.variables[k].name : varOf(k).name;
      b.addEventListener('click', () => { if (s.custom) { state.custom.v = k; syncForm(); runCustom(); } else select(k, null); });
      tabs.appendChild(b);
    });
    $('p-caps').textContent = `${pl.name} · ${v.name} · ${s.monthsLabel}`;
    const dir = w.direction === 'rising' ? 'Rising' : 'Falling';
    $('p-headline').textContent = w.strength === 'strong' ? `${dir}. The evidence is strong.`
      : w.strength === 'mixed' ? `Possibly ${dir.toLowerCase()}. The tests disagree.` : 'No clear shift yet.';
    const more = s.more_years_needed;
    $('p-meaning').textContent = w.strength === 'strong'
      ? 'This change is unlikely to be natural ups and downs. Both tests agree.'
      : w.strength === 'mixed' ? 'One test finds a change and the other does not. Treat it as unproven.'
      : (full && more !== null && more !== undefined
        ? `The record cannot yet tell a real shift from natural ups and downs. At this rate it would take ${more > 100 ? 'more than 100' : 'about ' + Math.max(1, Math.round(more))} more years of data.`
        : 'The record cannot yet tell a real shift from natural ups and downs.');
    $('p-def').innerHTML = `<b>${v.name}:</b> ${v.definition} <span>Data: ${v.dataset}, ${s.start_year} to ${state.year}${s.custom ? `, at ${pl.lat.toFixed(2)}°, ${pl.lon.toFixed(2)}°` : ''}.</span>`;
    renderChart(id, state.year);

    const unit = `${v.unit} per decade`;
    const pct = (v.unit === 'mm/day' && s.mean) ? ` (${sign(100 * w.slope / s.mean, 0)}% of the average)` : '';
    const quickSig = w.quick_p < R.alpha;
    const pWorst = Math.max(w.p_adjusted_ols, w.p_mann_kendall);
    let chance;
    if (w.strength === 'strong') chance = pWorst < 0.001 ? 'fewer than 1 time in 1,000' : `about 1 time in ${Math.round(1 / pWorst)}`;
    else if (w.strength === 'mixed') chance = 'not settled';
    else chance = `about ${Math.max(1, Math.round(100 * w.p_adjusted_ols))} times in 100`;
    $('rows').innerHTML =
      row('How fast', `${sign(w.slope)} ${unit}`, `likely range ${sign(w.lo)} to ${sign(w.hi)}${pct}`) +
      row('Quick check', quickSig ? 'Trend found' : 'No trend found', fmtP(w.quick_p)) +
      row('Careful check', w.strength === 'strong' ? 'Trend found' : w.strength === 'mixed' ? 'Tests disagree' : 'No trend found',
        `line fit ${fmtP(w.p_adjusted_ols)} · rank test ${fmtP(w.p_mann_kendall)}`) +
      row('If nothing were changing', chance, w.strength === 'mixed' ? 'the two tests give different answers' : 'how often chance alone would give a result this strong');

    const co = $('callout'); let msg = '';
    if (!quickSig && w.strength === 'strong') {
      msg = s.climatology
        ? `<b>The quick check misses this trend.</b> The seasons swing this measurement by about ${(Math.max(...s.climatology) - Math.min(...s.climatology)).toFixed(1)} ${v.unit} within a year, while the trend is ${Math.abs(w.slope).toFixed(2)} ${v.unit} per decade. Once the seasons are removed, the trend is clear.`
        : '<b>The quick check misses this trend.</b> The careful check, which uses two tests, finds it.';
    } else if (quickSig && w.strength !== 'strong') {
      msg = '<b>The quick check raises an alarm the careful check does not confirm.</b> After allowing for the memory between one period and the next, the evidence is not strong enough.';
    } else if (w.strength === 'mixed') {
      const lineSig = w.p_adjusted_ols < R.alpha;
      msg = `<b>The two careful tests disagree.</b> The ${lineSig ? 'line fit finds a trend but the rank-based test does not' : 'rank-based test finds a trend but the line fit does not'}. This can happen with lumpy data, such as rainfall with many dry months. Treat it as unproven.`;
    }
    co.hidden = !msg; co.innerHTML = msg;

    const cmpBox = $('compare');
    const inv = R.investigations.find((x) => x.id === state.investigation && x.series.length === 2 && x.series.includes(id));
    if (inv && full) {
      const c = R.comparisons[inv.id], a = S(c.a), b = S(c.b), other = id === c.a ? c.b : c.a;
      cmpBox.hidden = false;
      cmpBox.innerHTML = `<b>${placeOf(c.a).name}</b>: ${sign(a.careful.slope)} ${unit}. <b>${placeOf(c.b).name}</b>: ${sign(b.careful.slope)} ${unit}. ` +
        `The two trends ${c.significant ? 'differ by more than chance would explain' : 'do not differ by more than chance could explain'} (${fmtP(c.p)}). ` +
        `<button type="button" id="other" class="close" style="margin-top:8px;display:block">See ${placeOf(other).name}</button>`;
      $('other').addEventListener('click', () => select(other, inv.id));
    } else if (R.crosschecks && R.crosschecks[id] && full) {
      const x = R.crosschecks[id], o = x.other, agree = x.strength_this === x.strength_other;
      cmpBox.hidden = false;
      cmpBox.innerHTML = `<b>Cross-check.</b> Over ${x.start_year} to ${x.end_year}, this satellite record and the other NASA record for the same place (${varOf(o).dataset.split(')')[0]})) move together month to month (correlation ${x.anomaly_correlation.toFixed(2)}). ` +
        `Trend: ${sign(x.slope_this)} here against ${sign(x.slope_other)} ${unit} there. Both sources ${agree ? 'reach the same verdict' : 'reach different verdicts'}.`;
    } else { cmpBox.hidden = true; cmpBox.innerHTML = ''; }

    const since = stableSince(id, state.year);
    if (since !== null) {
      $('since-label').textContent = 'Evidence strong since';
      $('since-value').textContent = since === s.windows[0].end_year ? `${since} or earlier` : String(since);
    } else if (full && more !== null && more !== undefined && w.strength === 'none') {
      $('since-label').textContent = 'More data needed';
      $('since-value').textContent = more > 100 ? 'more than 100 years' : `about ${Math.max(1, Math.round(more))} more years`;
    } else {
      $('since-label').textContent = 'Evidence'; $('since-value').textContent = 'not yet strong';
    }
  }

  /* ---------- slider ---------- */
  function setupSlider() {
    const s = S(state.series), sl = $('year');
    sl.min = s.windows[0].end_year; sl.max = s.end_year; sl.value = state.year;
    $('year-label').textContent = state.year;
    const t = $('ticks'); t.innerHTML = '';
    const a = +sl.min, b = +sl.max;
    [a, Math.round(a + (b - a) / 3), Math.round(a + 2 * (b - a) / 3), b].forEach((y) => { const e = document.createElement('span'); e.textContent = y; t.appendChild(e); });
  }
  function setYear(y) { state.year = y; $('year').value = y; $('year-label').textContent = y; renderPanel(); renderMarkers(); }
  function stopPlay() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    $('play').setAttribute('aria-pressed', 'false'); $('play').querySelector('span').textContent = 'REPLAY';
  }
  $('year').addEventListener('input', (e) => { stopPlay(); setYear(+e.target.value); });
  $('play').addEventListener('click', () => {
    if (state.timer) { stopPlay(); return; }
    const s = S(state.series);
    setYear(s.windows[0].end_year);
    $('play').setAttribute('aria-pressed', 'true'); $('play').querySelector('span').textContent = 'PAUSE';
    state.timer = setInterval(() => { if (state.year >= s.end_year) { stopPlay(); return; } setYear(state.year + 1); }, 320);
  });

  /* ---------- selection ---------- */
  function select(id, invId) {
    stopPlay();
    state.series = id;
    state.investigation = id === 'custom' ? null : (invId || (R.investigations.find((x) => x.series.includes(id)) || {}).id || null);
    state.year = S(id).end_year;
    setupSlider(); renderRail(); renderPanel(); renderMarkers();
    if (globe) { const p = placeOf(id); globe.pointOfView({ lat: p.lat, lng: p.lon, altitude: 2.1 }, 1200); }
    if (started) {
      const r = document.querySelector('.panel').getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) document.querySelector('.panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- dialogs ---------- */
  function bar(label, value, color, max) {
    return `<div class="bar"><div class="lab"><span>${label}</span><b>${value}%</b></div><div class="track"><div class="fill" style="width:${Math.min(100, 100 * value / max)}%;background:${color}"></div></div></div>`;
  }
  function renderSim() {
    if (!SIM) { $('sim-intro').textContent = 'Simulation results are not available.'; return; }
    $('sim-intro').textContent = `We generated ${SIM.reps.toLocaleString()} artificial ${SIM.n_years}-year monthly records with no trend at all, for several strengths of memory between months. A sound test at the 5% level should declare a trend in about 5% of them.`;
    let h = '';
    SIM.false_alarms.forEach((f) => {
      h += `<p class="fine" style="margin:14px 0 0">Memory between months: ${f.phi === 0 ? 'none' : f.phi} ${f.phi === 0 ? '' : '(lag-1 autocorrelation)'}</p><div class="bars">` +
        bar('Line fit that ignores memory: false alarms', f.naive_ols, COLORS.rising, 60) +
        bar('Careful check: false alarms', f.careful, COLORS.falling, 60) + '</div>';
    });
    $('sim-false').innerHTML = h;
    const m = SIM.missed_trends.find((x) => x.phi === 0.3) || SIM.missed_trends[0];
    $('sim-missed').innerHTML = `<h3>And real trends that get missed</h3><p>Then we added a real trend (${m.trend_per_decade} units per decade) under a seasonal swing of ±${m.seasonal_amplitude} units, like temperature in a place with hot summers and cold winters.</p><div class="bars">` +
      bar('Quick check on raw months: trend found', m.quick_found, COLORS.rising, 100) +
      bar('Careful check: trend found', m.careful_found, COLORS.falling, 100) + '</div>';
    const cs = SIM.false_alarms.map((f) => f.careful);
    $('sim-note').textContent = `The careful check is not perfect. Its false alarm rate ranged from ${Math.min(...cs)}% to ${Math.max(...cs)}% across these cases, against the 5% it aims for. Simulation settings and code are in the project repository (pipeline/simulate.py).`;
  }
  function renderDataList() {
    const ul = $('data-list'); ul.innerHTML = '';
    Object.keys(R.series).filter((id) => !S(id).custom).forEach((id) => {
      const li = document.createElement('li'), p = placeOf(id);
      li.textContent = `${p.name} (${p.lat}, ${p.lon}): ${varOf(id).name}. ${varOf(id).dataset}, ${S(id).start_year} to ${S(id).end_year}.`;
      ul.appendChild(li);
    });
  }
  $('btn-why').addEventListener('click', () => $('why').showModal());
  $('btn-data').addEventListener('click', () => $('data').showModal());
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  /* ---------- start: a saved record, so the page works even if NASA's service is slow ---------- */
  const firstInv = R.investigations[0];
  state.series = firstInv.series[0]; state.investigation = firstInv.id; state.year = S(state.series).end_year;
  initGlobe(); buildForm(); renderSim(); renderDataList();
  select(state.series, state.investigation);
  started = true;
})();
