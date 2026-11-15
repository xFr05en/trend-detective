# Trend Detective

**Is your season really shifting?**

A website for the NASA Space Apps Challenge 2026, challenge "Be An Earth System Trend Detective!".

**Who it is for:** people who plan around a season, such as festival organisers, growers and local
services. **The question it answers:** has this season really changed where I am, or were the last
few years just unusual?

Pick a place (any point on Earth), the months that matter and what to measure. The site pulls the
NASA record for that point and reports whether the change is real, how fast it is, and since when
the evidence has been strong. If the evidence is not there yet, it estimates how many more years of
data are needed. Every answer is tested twice: with the quick line fit most tools use, and with a
careful test that allows for the memory between one period and the next. When the two disagree,
the site says so and explains why.

- **Live site:** https://xfr05en.github.io/trend-detective/ (code: https://github.com/xFr05en/trend-detective)
- **Demo:** [ADD LINK TO 7-SLIDE DECK OR 30-SECOND VIDEO]
- **Author:** xFr05en (solo), NASA Space Apps Seoul 2026

> Student project. Not affiliated with or endorsed by NASA.

## What a visitor does

1. Picks a place from the list or by clicking the globe.
2. Picks the months that matter (for example January, or June to August) and a variable:
   air temperature, coldest temperature of the month, or rain and snow.
3. Reads the answer: a one-line verdict, what it means, the chart, the rate of change with its
   range, and both checks.
4. Drags the year slider to replay the record and see when the evidence became strong.
5. Opens a worked example, a saved all-year record, or "Why two checks?" for the reasoning and
   the simulation that tests the tests.

## Results for the saved all-year records (monthly)

| Place | Variable | Trend per decade (95% range) | Quick check p | Adjusted line fit p | Modified Mann-Kendall p | Lag-1 autocorrelation | Careful verdict |
|---|---|---|---|---|---|---|---|
| Seoul | Air temperature (1981 to 2025) | +0.36 (+0.25 to +0.47) °C | 0.207 | <0.001 | <0.001 | 0.32 | Strong, rising |
| Seoul | Coldest temperature of the month (1981 to 2025) | +0.42 (+0.29 to +0.55) °C | 0.199 | <0.001 | <0.001 | 0.04 | Strong, rising |
| Seoul | Rain and snow (1981 to 2025) | +0.05 (-0.12 to +0.21) mm/day | 0.665 | 0.578 | 0.970 | 0.03 | No clear trend |
| Svalbard | Air temperature (1981 to 2025) | +0.77 (+0.55 to +0.99) °C | <0.001 | <0.001 | <0.001 | 0.31 | Strong, rising |
| Singapore | Air temperature (1981 to 2025) | +0.18 (+0.12 to +0.24) °C | <0.001 | <0.001 | <0.001 | 0.70 | Strong, rising |
| Niamey | Rain and snow (1981 to 2025) | +0.10 (+0.04 to +0.15) mm/day | 0.135 | <0.001 | 0.160 | 0.10 | Tests disagree |
| Santiago | Rain and snow (1981 to 2025) | -0.15 (-0.22 to -0.07) mm/day | <0.001 | <0.001 | <0.001 | 0.16 | Strong, falling |
| Seoul | Rain and snow (satellite) (2001 to 2024) | -0.17 (-0.65 to +0.30) mm/day | 0.712 | 0.471 | 0.695 | 0.06 | No clear trend |

Three findings worth noting:

- **The quick check misses Seoul's warming.** A line fitted to the raw monthly temperatures
  gives p = 0.207, because the seasonal cycle swamps the trend. After removing the seasonal
  cycle the trend is clear.
- **Opposite rainfall trends.** Niamey (Sahel) trends wetter and Santiago (central Chile) trends drier;
  the slopes differ (p <0.001). Niamey's own trend is flagged "tests disagree"
  because the rank-based test does not confirm the line fit.

- **Two independent NASA sources agree on Seoul's rain.** Satellite rainfall (GPM IMERG, from Giovanni) and
  reanalysis rainfall (MERRA-2) have a month-to-month anomaly correlation of 0.94 over 2001 to 2024,
  and both give "no clear trend".

## How the checks work

| | Quick check | Careful check |
|---|---|---|
| Seasonal cycle | Left in | Removed (monthly anomalies) |
| Memory between months | Ignored | Standard error widened using an effective sample size from the lag-1 autocorrelation (Santer et al. 2000) |
| Second opinion | None | Hamed-Rao modified Mann-Kendall test with Sen's slope |
| Verdict | p < 0.05 | "Strong" only if both tests give p < 0.05; "tests disagree" if only one does |

In season mode the chosen months are averaged into one value per year and the same two tests are
applied to that yearly series. The year slider re-runs the careful check on the record up to each end year. For trends that are
not yet detectable, the site estimates how many more years are needed (Weatherhead et al. 1998).
Details and limits are in [docs/methods.md](docs/methods.md).

## Testing the tests (simulation)

2,000 simulated 45-year monthly records with **no trend**. Share in which each test
declared a trend at the 5% level (should be about 5%):

| Lag-1 autocorrelation | Plain OLS | Plain Mann-Kendall | Newey-West OLS | Modified Mann-Kendall | Adjusted OLS (Santer) | Careful check (both) |
|---|---|---|---|---|---|---|
| 0.0 | 5.7% | 5.2% | 6.5% | 9.9% | 5.2% | 3.9% |
| 0.3 | 15.2% | 14.6% | 8.3% | 10.8% | 5.8% | 5.5% |
| 0.6 | 31.6% | 30.8% | 10.8% | 14.6% | 4.2% | 4.2% |
| 0.8 | 51.9% | 50.5% | 20.1% | 22.0% | 5.8% | 5.8% |

1,000 simulated records with a **real trend** (0.25 units per decade) under a seasonal swing of
±10 units and noise SD 1.5:

| Lag-1 autocorrelation | Quick check finds the trend | Careful check finds the trend |
|---|---|---|
| 0.0 | 0.0% | 99.7% |
| 0.3 | 0.0% | 95.5% |
| 0.6 | 0.5% | 70.3% |

The careful check stayed between 3.9% and 5.8% false alarms. Two methods that are often recommended
for autocorrelated data, Newey-West standard errors with the default lag and the modified
Mann-Kendall test, were both too liberal on their own in this setting.

## Data

| Source | Use | Access |
|---|---|---|
| NASA POWER monthly API (MERRA-2 reanalysis; Gelaro et al. 2017) | Air temperature, monthly minimum temperature, precipitation, 1981 to 2025: saved records at 5 points, and live requests for any point a visitor chooses | https://power.larc.nasa.gov/ , retrieved 14 Nov 2026 |
| NASA Giovanni: GPM IMERG Final Run monthly V07 (GPM_3IMERGM), satellite-gauge precipitation | Area-averaged rainfall over a box around Seoul (126.5-127.5°E, 37.1-38.0°N), 2001 to 2024; cross-check of the MERRA-2 rainfall | https://giovanni.gsfc.nasa.gov/ , retrieved 14 Nov 2026. The reproduce URL is in the file header |
| NASA Blue Marble imagery | Globe texture, as bundled with three-globe | https://visibleearth.nasa.gov/ |

Raw files are in `data/raw/` and `data/giovanni/`, each with its request URL in the header.
The IMERG values are served in mm/hr and are multiplied by 24 to give mm/day (annual mean about 1,425 mm, consistent with Seoul's climate).

## Run it yourself

```bash
pip install -r requirements.txt
python tests/test_trendlib.py          # unit tests on simulated data
python tests/check_js_parity.py        # browser statistics must match the Python reference (needs Node.js)
python pipeline/run_pipeline.py        # writes site/data/results.json
python pipeline/simulate.py 2000       # writes site/data/simulation.json (about 5 minutes)
cd site && python -m http.server 8000  # then open http://localhost:8000
```

## Project layout

```
config/catalog.json      places, variables, plain definitions, investigations
data/raw/                NASA POWER monthly series (CSV)
data/giovanni/           NASA Giovanni downloads (GPM IMERG rainfall over Seoul)
pipeline/trendlib.py     the statistics
pipeline/loaders.py      file loaders (POWER, Giovanni)
pipeline/run_pipeline.py catalog + data -> site/data/results.json
pipeline/simulate.py     simulation study -> site/data/simulation.json
pipeline/fetch_power.py  re-download the POWER series
site/stats.js            the same tests in JavaScript, for live analysis of any location
site/                    the static website (deployed to GitHub Pages)
tests/                   unit tests, and the JavaScript-versus-Python parity check
docs/                    methods note, AI use log, submission drafts
```

## Known limits

- Each series is one MERRA-2 grid cell (about 50 km), not a weather station. Reanalysis trends can
  include artefacts from changes in the observing system, especially for precipitation.
- The careful check models memory as lag-1 autocorrelation. Longer memory would make it too liberal.
- Only straight-line trends are tested. No change points or curves.
- A season series has about 45 yearly values, so weak shifts often return "no clear shift yet".
- Trying many month combinations will eventually produce a "significant" result by chance.
- The site reports whether the weather in a season is shifting. It does not predict bloom dates, ice thickness or yields.
- Live checks depend on the NASA POWER service being available.
- Eight series are tested with no correction for multiple testing.
- The comparison of two places assumes their series are independent.
- The "more years needed" estimate assumes the trend and noise stay as they are.
- `pipeline/fetch_power.py` has not been run against the live API yet. The Giovanni loader has been run on one real download.

## Use of AI (SI) tools

Code, website and documentation drafts in this repository were generated with Claude (Anthropic).
See [docs/SI_USE.md](docs/SI_USE.md) for what was generated with AI assistance.

## References

- Santer, B. D., et al. (2000). Statistical significance of trends and trend differences in layer-average atmospheric temperature time series. *J. Geophys. Res.*, 105(D6), 7337-7356.
- Hamed, K. H., & Rao, A. R. (1998). A modified Mann-Kendall trend test for autocorrelated data. *J. Hydrol.*, 204, 182-196.
- Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. *J. Amer. Statist. Assoc.*, 63, 1379-1389.
- Weatherhead, E. C., et al. (1998). Factors affecting the detection of trends: Statistical considerations and applications to environmental data. *J. Geophys. Res.*, 103(D14), 17149-17161.
- Newey, W. K., & West, K. D. (1987). A simple, positive semi-definite, heteroskedasticity and autocorrelation consistent covariance matrix. *Econometrica*, 55, 703-708.
- Gelaro, R., et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). *J. Climate*, 30, 5419-5454.
- Hussain, M., & Mahmud, I. (2019). pyMannKendall: a python package for non parametric Mann Kendall family of trend tests. *J. Open Source Softw.*, 4(39), 1556.
- NASA POWER Project, NASA Langley Research Center. https://power.larc.nasa.gov/
- Huffman, G. J., et al. (2023). GPM IMERG Final Precipitation L3 1 month 0.1 degree x 0.1 degree V07. NASA GES DISC. Accessed through NASA Giovanni, https://giovanni.gsfc.nasa.gov/
- Software: NumPy, SciPy, statsmodels, pymannkendall (Python); globe.gl / three-globe (MIT licence) for the globe.

## Licence

MIT. See [LICENSE](LICENSE).
