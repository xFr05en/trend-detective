// Runs site/stats.js on a JSON job from stdin. Used by tests/check_js_parity.py.
const TD = require('../site/stats.js');
let buf = '';
process.stdin.on('data', (d) => (buf += d)).on('end', () => {
  const jobs = JSON.parse(buf);
  const out = jobs.map((j) => (j.selected
    ? TD.analyseSeason(j.values, j.years, j.months, j.selected)
    : TD.analyseMonthly(j.values, j.years, j.months)));
  process.stdout.write(JSON.stringify(out.map((r) => ({ quick: r.quick, careful: r.careful, windows: r.windows,
    detection_years_needed: r.detection_years_needed, n: r.n }))));
});
