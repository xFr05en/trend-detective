# Methods note

Trend Detective, NASA Space Apps Challenge 2026. Author: xFr05en.
Numbers in this note are produced by `pipeline/run_pipeline.py` and `pipeline/simulate.py`.

## 1. Question

For a monthly Earth science series $y_t$ at one place, is there a linear trend, how large is it,
and is it distinguishable from chance at the 5% level?

## 2. Data

Monthly values for January 1981 to December 2025 ($n = 540$) from the NASA POWER API, which serves
MERRA-2 reanalysis fields at a point: 2 m air temperature (T2M), monthly minimum 2 m temperature
(T2M_MIN) and bias-corrected precipitation (PRECTOTCORR). Only complete calendar years are used.

A second, independent source is used as a cross-check for Seoul rainfall: the GPM IMERG Final Run monthly
satellite-gauge product (V07), area-averaged over 126.5-127.5°E, 37.1-38.0°N for 2001 to 2024 ($n = 288$),
downloaded from NASA Giovanni. Over the common period its monthly anomalies correlate at 0.94 with the MERRA-2
series, and both give the same verdict (no clear trend).

## 3. The quick check

Ordinary least squares on the raw values, $y_t = a + b\,t + e_t$, with the textbook standard
error and a $t$ test with $n-2$ degrees of freedom. This is what a spreadsheet trend line reports.

It fails in two ways:

1. **Seasonal cycle.** The seasonal swing sits in the residuals and inflates the standard error.
   Real trends are missed.
2. **Autocorrelation.** If the seasonal cycle is removed but residuals are positively
   autocorrelated, the textbook standard error is too small. False trends are declared.

## 4. The careful check

**Step 1, anomalies.** Subtract the mean of each calendar month:
$x_t = y_t - \bar y_{m(t)}$.

**Step 2, adjusted line fit (Santer et al. 2000).** Fit OLS to $x_t$. With $r_1$ the lag-1
autocorrelation of the residuals, the effective sample size is

$$ n_e = n\,\frac{1 - r_1}{1 + r_1} . $$

The standard error is inflated to $s_b\sqrt{(n-2)/(n_e-2)}$ and the test uses $n_e - 2$ degrees
of freedom. Negative $r_1$ is treated as zero (no correction).

**Step 3, rank test.** The Hamed-Rao (1998) modified Mann-Kendall test on $x_t$, with Sen's slope
as a robust slope estimate. If the variance correction fails (it can turn negative for series with
many ties, such as rainfall in a dry season), the unmodified test is used and flagged.

**Verdict.** "Strong" if both tests give $p < 0.05$, "tests disagree" if one does, otherwise
"no clear trend". Requiring agreement makes the check conservative.

A Newey-West (HAC) standard error is also computed and stored as a cross-check, with lag
$\lfloor 4 (n/100)^{2/9} \rfloor$.

## 5. Replay and detection time

The careful check is re-run on the record truncated at each end year from 1990 to 2025, with
anomalies recomputed inside each window. "Evidence strong since" is the first end year from which
every later window is "strong".

For a series with no clear trend, the number of years needed to detect a trend of size $\omega_0$
per year is approximated (Weatherhead et al. 1998) by

$$ n^* \approx \left[ \frac{3.3\,\sigma_N}{|\omega_0|} \sqrt{\frac{1+\phi}{1-\phi}} \right]^{2/3} , $$

with $\sigma_N$ the standard deviation of the monthly noise and $\phi$ its lag-1 autocorrelation.
This follows from the standard error of an OLS slope on monthly data, $\sigma_N / n^{3/2}$ per year
for $n$ years of white noise, inflated for AR(1) noise, and a requirement of
$|\omega_0| > 3.3\,\sigma_\omega$ (about 90% power at the 5% level). It assumes the estimated trend is the
true one and the noise does not change.

## 5a. Season mode (one value per year)

For a question about one season, the selected calendar months are averaged into one value per
year: $s_y = \frac{1}{|M|}\sum_{m \in M} y_{y,m}$. A season that crosses New Year (for example
December to February) is assigned to the year in which it ends. Years with a missing month are dropped.

The regression is $s_y = a + b\,t_y + u_y$ with $t_y$ in decades. There is no seasonal cycle left,
so step 1 is not needed. Steps 2 and 3 are applied to $s_y$ unchanged: the standard error is adjusted
with the lag-1 autocorrelation of the yearly residuals, and the modified Mann-Kendall test is run on
$s_y$. The replay starts at 20 years of data.

For one value per year, the OLS slope standard error under white noise is
$\sigma\sqrt{12}/n^{3/2}$ per year, so the detection-time approximation becomes

$$ n^* \approx \left[ \frac{3.3\,\sqrt{12}\,\sigma}{|\omega_0|} \sqrt{\frac{1+\phi}{1-\phi}} \right]^{2/3} . $$

With about 45 yearly values the tests have limited power, so weak shifts will often return
"no clear shift yet". A user who tries many month combinations inflates the false alarm rate;
the site asks users to choose their months first.

## 5b. Browser implementation

For a user-chosen location the site requests the monthly record from the NASA POWER API and runs
the tests in the browser (`site/stats.js`). `tests/check_js_parity.py` runs the JavaScript and the
Python reference on the same series (8 monthly analyses and 40 season analyses, including every
replay window) and requires agreement within $2 \times 10^{-4}$. All 48 agree.

Before the Mann-Kendall test, values are rounded to 9 decimals. Anomalies and season means of
two-decimal data contain values that are equal in exact arithmetic but differ in the last
floating-point bit, and a rank test would otherwise order such pairs arbitrarily.

## 6. Comparing two places

The difference of two careful-check slopes is tested with a $z$ test using the two adjusted
standard errors, assuming the two series are independent.

## 7. Results

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

## 8. Simulation study

Design: 2,000 replications, $n = 540$ months, Gaussian AR(1) noise with unit variance, seed 2026.

False alarm rate at the nominal 5% level, no trend present:

| Lag-1 autocorrelation | Plain OLS | Plain Mann-Kendall | Newey-West OLS | Modified Mann-Kendall | Adjusted OLS (Santer) | Careful check (both) |
|---|---|---|---|---|---|---|
| 0.0 | 5.7% | 5.2% | 6.5% | 9.9% | 5.2% | 3.9% |
| 0.3 | 15.2% | 14.6% | 8.3% | 10.8% | 5.8% | 5.5% |
| 0.6 | 31.6% | 30.8% | 10.8% | 14.6% | 4.2% | 4.2% |
| 0.8 | 51.9% | 50.5% | 20.1% | 22.0% | 5.8% | 5.8% |

Detection rate with a real trend of 0.25 per decade, seasonal amplitude 10, noise SD 1.5
(1,000 replications):

| Lag-1 autocorrelation | Quick check finds the trend | Careful check finds the trend |
|---|---|---|
| 0.0 | 0.0% | 99.7% |
| 0.3 | 0.0% | 95.5% |
| 0.6 | 0.5% | 70.3% |

Reading:

- Plain OLS and plain Mann-Kendall reach about 32% false alarms at $\phi = 0.6$ and about 52% at $\phi = 0.8$.
- The adjusted OLS test stays close to 5% across the range tested.
- Newey-West with the default lag and the modified Mann-Kendall test are both too liberal on
  their own here (up to 20% and 22%). With strong autocorrelation the default HAC lag is too short.
- The combined careful check ranges from 3.9% to 5.8%. With 2,000 replications the Monte Carlo
  standard error near 5% is about 0.5 percentage points.
- The quick check on raw data almost never finds the real trend under a seasonal cycle.

## 9. Limits

- AR(1) is a simplification. Longer memory would raise the false alarm rate above what is shown.
- The climatology is estimated from the same record that is tested.
- Reanalysis point data can contain artificial trends from observing-system changes.
- No correction for testing several places.
- Linear trends only.

## References

See the README.
