/* Trend tests in JavaScript, for live analysis of any location in the browser.
   Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.

   This file mirrors pipeline/trendlib.py, which is the reference implementation.
   tests/check_js_parity.py runs both on the same series and requires matching results. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ALPHA = 0.05;

  /* ---------- special functions ---------- */
  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function betacf(a, b, x) {
    const FPMIN = 1e-300, EPS = 1e-14;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d; let h = d;
    for (let m = 1; m <= 400; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  /* two-sided p-value of Student's t with (possibly non-integer) df */
  function tTwoSided(t, df) { return betai(df / 2, 0.5, df / (df + t * t)); }
  function tQuantile975(df) {            // t such that two-sided p = 0.05
    let lo = 0, hi = 50;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (tTwoSided(mid, df) > ALPHA) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function normTwoSided(z) { return erfc(Math.abs(z) / Math.SQRT2); }
  const Z975 = 1.959963984540054;

  /* ---------- basics ---------- */
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  function median(a) {
    const s = Float64Array.from(a).sort(); const n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function monthlyAnomalies(values, months) {
    const sum = new Array(13).fill(0), cnt = new Array(13).fill(0);
    values.forEach((v, i) => { sum[months[i]] += v; cnt[months[i]]++; });
    const clim = []; for (let m = 1; m <= 12; m++) clim.push(sum[m] / cnt[m]);
    return { anomalies: values.map((v, i) => v - clim[months[i] - 1]), climatology: clim };
  }
  function lag1(x) {
    const m = mean(x); let num = 0, den = 0;
    for (let i = 0; i < x.length; i++) { den += (x[i] - m) * (x[i] - m); if (i > 0) num += (x[i] - m) * (x[i - 1] - m); }
    return den === 0 ? 0 : num / den;
  }
  function olsTrend(t, y) {
    const n = y.length, tm = mean(t), ym = mean(y);
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (t[i] - tm) * (t[i] - tm); sxy += (t[i] - tm) * (y[i] - ym); }
    const slope = sxy / sxx, intercept = ym - slope * tm;
    const resid = y.map((v, i) => v - (intercept + slope * t[i]));
    const s2 = resid.reduce((s, e) => s + e * e, 0) / (n - 2);
    const se = Math.sqrt(s2 / sxx), df = n - 2;
    const p = tTwoSided(slope / se, df), half = tQuantile975(df) * se;
    return { slope, intercept, se, p, lo: slope - half, hi: slope + half, df, resid };
  }
  function santerTrend(t, y) {
    const b = olsTrend(t, y), n = y.length;
    const r1 = lag1(b.resid), r1c = Math.min(Math.max(r1, 0), 0.98);
    const neff = Math.max(n * (1 - r1c) / (1 + r1c), 3);
    const se = b.se * Math.sqrt((n - 2) / (neff - 2)), df = neff - 2;
    const p = tTwoSided(b.slope / se, df), half = tQuantile975(df) * se;
    const residSd = Math.sqrt(b.resid.reduce((s, e) => s + (e - mean(b.resid)) ** 2, 0) / (n - 2));
    return { slope: b.slope, intercept: b.intercept, se, p, lo: b.slope - half, hi: b.slope + half, r1, neff, residSd };
  }

  /* ---------- Mann-Kendall (Hamed-Rao 1998), following pymannkendall ---------- */
  function mkScore(x) {
    let s = 0; const n = x.length;
    for (let k = 0; k < n - 1; k++) for (let j = k + 1; j < n; j++) s += x[j] > x[k] ? 1 : x[j] < x[k] ? -1 : 0;
    return s;
  }
  function mkVariance(x) {
    const n = x.length, counts = new Map();
    x.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    let tie = 0; counts.forEach((tp) => { tie += tp * (tp - 1) * (2 * tp + 5); });
    return (n * (n - 1) * (2 * n + 5) - tie) / 18;
  }
  function senSlopeIndex(x) {
    const n = x.length, d = new Float64Array(n * (n - 1) / 2); let idx = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) d[idx++] = (x[j] - x[i]) / (j - i);
    return median(d);
  }
  function rankAverage(x) {
    const n = x.length, order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
    const r = new Array(n); let i = 0;
    while (i < n) { let j = i; while (j + 1 < n && x[order[j + 1]] === x[order[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[order[k]] = avg; i = j + 1; }
    return r;
  }
  function zFrom(s, v) { return s > 0 ? (s - 1) / Math.sqrt(v) : s < 0 ? (s + 1) / Math.sqrt(v) : 0; }
  function mannKendall(xRaw, perDecadeFactor) {
    /* Round to 9 decimals so values equal in exact arithmetic are treated as ties (see trendlib.py). */
    const x = xRaw.map((v) => Math.round(v * 1e9) / 1e9);
    const n = x.length, s = mkScore(x), var0 = mkVariance(x);
    const slope = senSlopeIndex(x);
    const det = x.map((v, i) => v - (i + 1) * slope), I = rankAverage(det), m = mean(I);
    const y = I.map((v) => v - m); let c0 = 0; for (let i = 0; i < n; i++) c0 += y[i] * y[i];
    const bound = Z975 / Math.sqrt(n); let sni = 0;
    for (let k = 1; k < n; k++) {
      let ck = 0; for (let i = 0; i + k < n; i++) ck += y[i] * y[i + k];
      const ac = ck / c0;
      if (!(ac <= bound && ac >= -bound)) sni += (n - k) * (n - k - 1) * (n - k - 2) * ac;
    }
    const nns = 1 + (2 / (n * (n - 1) * (n - 2))) * sni, v = var0 * nns;
    let p, fallback = false;
    if (v > 0 && isFinite(v)) p = normTwoSided(zFrom(s, v));
    else { p = normTwoSided(zFrom(s, var0)); fallback = true; }
    return { p, senSlope: slope * perDecadeFactor, tau: s / (0.5 * n * (n - 1)), fallback };
  }

  function verdict(pA, pB, slope) {
    const k = (pA < ALPHA ? 1 : 0) + (pB < ALPHA ? 1 : 0);
    return { strength: ['none', 'mixed', 'strong'][k], direction: slope > 0 ? 'rising' : 'falling' };
  }
  /* Years of data needed to detect the trend (Weatherhead et al. 1998 approximation).
     pointsPerYear = 12 for monthly data, 1 for one value per year. */
  function detectionYears(slopePerDecade, residSd, r1, pointsPerYear) {
    const omega = Math.abs(slopePerDecade) / 10; if (omega === 0) return null;
    const phi = Math.min(Math.max(r1, 0), 0.98);
    const k = pointsPerYear === 12 ? 1 : Math.sqrt(12 / pointsPerYear);
    return Math.pow(3.3 * k * residSd / omega * Math.sqrt((1 + phi) / (1 - phi)), 2 / 3);
  }

  /* ---------- one generic analysis: t in decades, y the series to test ---------- */
  function careful(t, y, perDecadeFactor) {
    const c = santerTrend(t, y), m = mannKendall(y, perDecadeFactor), v = verdict(c.p, m.p, c.slope);
    return { slope: c.slope, lo: c.lo, hi: c.hi, intercept: c.intercept, p_adjusted_ols: c.p, p_mann_kendall: m.p,
      sen_slope: m.senSlope, r1: c.r1, n_effective: c.neff, resid_sd: c.residSd, strength: v.strength, direction: v.direction };
  }

  /* ---------- monthly ("all year") analysis ---------- */
  function monthlyTime(years, months) { return years.map((y, i) => (y + (months[i] - 0.5) / 12 - years[0]) / 10); }
  function analyseMonthly(values, years, months, minYears) {
    minYears = minYears || 10;
    const t = monthlyTime(years, months), quick = olsTrend(t, values);
    const a = monthlyAnomalies(values, months), c = careful(t, a.anomalies, 120);
    const windows = [];
    for (let end = years[0] + minYears - 1; end <= years[years.length - 1]; end++) {
      const idx = []; years.forEach((y, i) => { if (y <= end) idx.push(i); });
      if (idx.length % 12 !== 0) continue;
      const v = idx.map((i) => values[i]), yy = idx.map((i) => years[i]), mm = idx.map((i) => months[i]);
      const tt = monthlyTime(yy, mm), q = olsTrend(tt, v), w = careful(tt, monthlyAnomalies(v, mm).anomalies, 120);
      windows.push({ end_year: end, slope: w.slope, lo: w.lo, hi: w.hi, p_adjusted_ols: w.p_adjusted_ols,
        p_mann_kendall: w.p_mann_kendall, quick_p: q.p, strength: w.strength, direction: w.direction });
    }
    const need = detectionYears(c.slope, c.resid_sd, c.r1, 12), have = values.length / 12;
    return { mode: 'monthly', points_per_year: 12, n: values.length, mean: mean(values),
      start_year: years[0], end_year: years[years.length - 1],
      quick: { slope: quick.slope, lo: quick.lo, hi: quick.hi, p: quick.p }, careful: c, windows,
      series: a.anomalies, climatology: a.climatology,
      detection_years_needed: need, more_years_needed: c.strength === 'none' && need !== null && need < 300 ? Math.max(0, need - have) : null };
  }

  /* ---------- season analysis: one value per year ---------- */
  function seasonSeries(values, years, months, selected) {
    const sel = Array.from(new Set(selected)).sort((a, b) => a - b);
    const wraps = sel.length < 12 && sel.includes(1) && sel.includes(12);
    const late = new Set();
    if (wraps) { for (let m = 12; m >= 1 && sel.includes(m); m--) late.add(m); }
    const byKey = new Map(); values.forEach((v, i) => byKey.set(years[i] * 100 + months[i], v));
    const outY = [], outV = [];
    for (let y = years[0]; y <= years[years.length - 1]; y++) {
      let sum = 0, ok = true;
      for (const m of sel) { const v = byKey.get((late.has(m) ? y - 1 : y) * 100 + m); if (v === undefined) { ok = false; break; } sum += v; }
      if (ok) { outY.push(y); outV.push(sum / sel.length); }
    }
    return { years: outY, values: outV };
  }
  function analyseSeason(values, years, months, selected, minYears) {
    minYears = minYears || 20;
    const s = seasonSeries(values, years, months, selected), y0 = s.years[0];
    const t = s.years.map((y) => (y - y0) / 10), quick = olsTrend(t, s.values), c = careful(t, s.values, 10);
    const windows = [];
    for (let k = minYears; k <= s.values.length; k++) {
      const tt = t.slice(0, k), v = s.values.slice(0, k), q = olsTrend(tt, v), w = careful(tt, v, 10);
      windows.push({ end_year: s.years[k - 1], slope: w.slope, lo: w.lo, hi: w.hi, p_adjusted_ols: w.p_adjusted_ols,
        p_mann_kendall: w.p_mann_kendall, quick_p: q.p, strength: w.strength, direction: w.direction });
    }
    const m = mean(s.values), need = detectionYears(c.slope, c.resid_sd, c.r1, 1), have = s.values.length;
    return { mode: 'season', points_per_year: 1, n: s.values.length, mean: m, start_year: y0, end_year: s.years[s.years.length - 1],
      season_years: s.years, season_values: s.values,
      quick: { slope: quick.slope, lo: quick.lo, hi: quick.hi, p: quick.p }, careful: c, windows,
      series: s.values.map((v) => v - m), climatology: null,
      detection_years_needed: need, more_years_needed: c.strength === 'none' && need !== null && need < 300 ? Math.max(0, need - have) : null };
  }

  return { ALPHA, olsTrend, santerTrend, mannKendall, monthlyAnomalies, seasonSeries, analyseMonthly, analyseSeason,
    detectionYears, tTwoSided, normTwoSided };
});
