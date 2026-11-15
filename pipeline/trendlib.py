"""Trend tests for monthly Earth science time series.

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.

Two checks are implemented:
  quick check   : ordinary least squares on the raw monthly values, textbook p-value.
  careful check : seasonal cycle removed, then
                  (a) OLS with the standard error adjusted for lag-1 autocorrelation
                      through an effective sample size (Santer et al. 2000), and
                  (b) the Hamed-Rao (1998) modified Mann-Kendall test with Sen's slope.
                  The trend is called "strong" only if (a) and (b) both give p < alpha.
"""
from __future__ import annotations

import math
import numpy as np
from scipy import stats
import statsmodels.api as sm
import pymannkendall as mk

ALPHA = 0.05


def monthly_anomalies(values, months):
    """Subtract each calendar month's mean. Returns (anomalies, climatology[12])."""
    values = np.asarray(values, float)
    months = np.asarray(months, int)
    clim = np.array([values[months == m].mean() for m in range(1, 13)])
    return values - clim[months - 1], clim


def lag1_autocorr(x):
    x = np.asarray(x, float) - np.mean(x)
    denom = np.sum(x * x)
    if denom == 0:
        return 0.0
    return float(np.sum(x[1:] * x[:-1]) / denom)


def ols_trend(t, y):
    """Classical OLS line fit. t in decades. Returns dict with slope per decade."""
    t = np.asarray(t, float)
    y = np.asarray(y, float)
    n = len(y)
    tc = t - t.mean()
    sxx = np.sum(tc * tc)
    slope = float(np.sum(tc * (y - y.mean())) / sxx)
    intercept = float(y.mean() - slope * t.mean())
    resid = y - (intercept + slope * t)
    s2 = float(np.sum(resid * resid) / (n - 2))
    se = math.sqrt(s2 / sxx)
    df = n - 2
    tstat = slope / se if se > 0 else float("inf")
    p = float(2 * stats.t.sf(abs(tstat), df))
    half = float(stats.t.ppf(1 - ALPHA / 2, df) * se)
    return {"slope": slope, "intercept": intercept, "se": se, "p": p,
            "lo": slope - half, "hi": slope + half, "df": df, "resid": resid}


def santer_trend(t, y):
    """OLS with effective-sample-size correction for AR(1) residuals (Santer et al. 2000)."""
    base = ols_trend(t, y)
    n = len(y)
    r1 = lag1_autocorr(base["resid"])
    r1c = min(max(r1, 0.0), 0.98)          # negative autocorrelation: no correction
    neff = n * (1 - r1c) / (1 + r1c)
    neff = max(neff, 3.0)
    se_adj = base["se"] * math.sqrt((n - 2) / (neff - 2))
    df = neff - 2
    tstat = base["slope"] / se_adj if se_adj > 0 else float("inf")
    p = float(2 * stats.t.sf(abs(tstat), df))
    half = float(stats.t.ppf(1 - ALPHA / 2, df) * se_adj)
    return {"slope": base["slope"], "intercept": base["intercept"], "se": se_adj, "p": p,
            "lo": base["slope"] - half, "hi": base["slope"] + half,
            "r1": r1, "neff": neff, "resid_sd": float(np.std(base["resid"], ddof=2))}


def hac_trend(t, y, maxlags=None):
    """OLS with Newey-West (HAC) standard errors. Reported as a cross-check."""
    n = len(y)
    if maxlags is None:
        maxlags = int(math.floor(4 * (n / 100.0) ** (2.0 / 9.0)))
    X = sm.add_constant(np.asarray(t, float))
    res = sm.OLS(np.asarray(y, float), X).fit(cov_type="HAC", cov_kwds={"maxlags": maxlags})
    return {"slope": float(res.params[1]), "se": float(res.bse[1]), "p": float(res.pvalues[1]),
            "maxlags": maxlags}


def mann_kendall(y, per_decade_factor=120.0):
    """Hamed-Rao modified Mann-Kendall test and Sen's slope (per decade for monthly data)."""
    # Round to 9 decimals first. Anomalies and season means of 2-decimal data contain values that
    # are equal in exact arithmetic but differ in the last floating-point bit; a rank test would
    # otherwise treat such pairs as "higher" or "lower" at random. Rounding makes them ties.
    y = np.round(np.asarray(y, float), 9)
    with np.errstate(invalid="ignore"):
        r = mk.hamed_rao_modification_test(y)
    p, fallback = float(r.p), False
    if not np.isfinite(p):
        # The Hamed-Rao variance correction can turn negative for short or heavily tied
        # series (for example rainfall with many dry months). Fall back to the unmodified test.
        r0 = mk.original_test(y)
        p, fallback = float(r0.p), True
    return {"p": p, "sen_slope": float(r.slope) * per_decade_factor, "tau": float(r.Tau),
            "fallback": fallback}


def detection_years(slope_per_decade, resid_sd, r1, points_per_year=12):
    """Years of data needed to detect this trend (Weatherhead et al. 1998 approximation,
    about 90% power at the 5% level). Assumes the trend and the noise stay as they are.

    For monthly data the slope standard error is about sd / n**1.5 per year (n in years).
    For one value per year it is sd * sqrt(12) / n**1.5, hence the factor k below."""
    omega = abs(slope_per_decade) / 10.0          # per year
    if omega == 0:
        return None
    phi = min(max(r1, 0.0), 0.98)
    k = 1.0 if points_per_year == 12 else math.sqrt(12.0 / points_per_year)
    return float((3.3 * k * resid_sd / omega * math.sqrt((1 + phi) / (1 - phi))) ** (2.0 / 3.0))


def verdict(p_a, p_b, slope):
    n_sig = int(p_a < ALPHA) + int(p_b < ALPHA)
    strength = {2: "strong", 1: "mixed", 0: "none"}[n_sig]
    direction = "rising" if slope > 0 else "falling"
    return strength, direction


def analyse(values, years, months):
    """Run both checks on one monthly series. years/months are integer arrays."""
    values = np.asarray(values, float)
    years = np.asarray(years, int)
    months = np.asarray(months, int)
    t = (years + (months - 0.5) / 12.0 - years[0]) / 10.0      # decades since start

    quick = ols_trend(t, values)
    anom, clim = monthly_anomalies(values, months)
    naive_anom = ols_trend(t, anom)
    careful = santer_trend(t, anom)
    hac = hac_trend(t, anom)
    mkr = mann_kendall(anom)
    strength, direction = verdict(careful["p"], mkr["p"], careful["slope"])
    n_years = len(values) / 12.0
    need = detection_years(careful["slope"], careful["resid_sd"], careful["r1"])
    return {
        "n_months": int(len(values)),
        "mean": float(values.mean()),
        "quick": {"slope": quick["slope"], "lo": quick["lo"], "hi": quick["hi"], "p": quick["p"],
                  "significant": bool(quick["p"] < ALPHA)},
        "seasons_removed_only": {"slope": naive_anom["slope"], "p": naive_anom["p"],
                                 "significant": bool(naive_anom["p"] < ALPHA)},
        "careful": {"slope": careful["slope"], "lo": careful["lo"], "hi": careful["hi"],
                    "p_adjusted_ols": careful["p"], "p_mann_kendall": mkr["p"],
                    "sen_slope": mkr["sen_slope"], "p_hac": hac["p"], "hac_maxlags": hac["maxlags"],
                    "r1": careful["r1"], "n_effective": careful["neff"],
                    "resid_sd": careful["resid_sd"], "intercept": careful["intercept"],
                    "strength": strength, "direction": direction,
                    "significant": bool(strength == "strong")},
        "detection_years_needed": need,
        "years_available": n_years,
        "anomalies": anom, "climatology": clim, "t_decades": t,
    }


def expanding_window(values, years, months, min_years=10):
    """Careful check re-run for every end year, for the 'replay' slider."""
    values = np.asarray(values, float)
    years = np.asarray(years, int)
    months = np.asarray(months, int)
    out = []
    for end in range(years[0] + min_years - 1, years[-1] + 1):
        sel = years <= end
        if sel.sum() % 12 != 0:
            continue
        v, yy, mm = values[sel], years[sel], months[sel]
        t = (yy + (mm - 0.5) / 12.0 - yy[0]) / 10.0
        q = ols_trend(t, v)
        anom, _ = monthly_anomalies(v, mm)
        c = santer_trend(t, anom)
        m = mann_kendall(anom)
        strength, direction = verdict(c["p"], m["p"], c["slope"])
        out.append({"end_year": int(end), "slope": c["slope"], "lo": c["lo"], "hi": c["hi"],
                    "p_adjusted_ols": c["p"], "p_mann_kendall": m["p"], "quick_p": q["p"],
                    "strength": strength, "direction": direction})
    return out


def first_stable_year(windows):
    """Earliest end year from which the verdict is 'strong' in every later window."""
    year = None
    for w in reversed(windows):
        if w["strength"] == "strong":
            year = w["end_year"]
        else:
            break
    return year


def slope_difference(a, b):
    """Two-sided z test for a difference between two independent careful-check slopes."""
    diff = a["slope"] - b["slope"]
    se_a = (a["hi"] - a["lo"]) / 2 / 1.96
    se_b = (b["hi"] - b["lo"]) / 2 / 1.96
    se = math.sqrt(se_a ** 2 + se_b ** 2)
    z = diff / se if se > 0 else float("inf")
    return {"difference": diff, "se": se, "p": float(2 * stats.norm.sf(abs(z)))}


# ---------------------------------------------------------------------------
# Season analysis: one value per year (mean of the chosen calendar months)
# ---------------------------------------------------------------------------

def season_series(values, years, months, selected):
    """Average the selected calendar months into one value per year.

    A season that runs across New Year (for example December to February) is assigned to the
    year in which it ends: the run of selected months ending in December is taken from the
    previous calendar year. Years with a missing month are dropped."""
    values = np.asarray(values, float)
    years = np.asarray(years, int)
    months = np.asarray(months, int)
    sel = sorted(set(int(m) for m in selected))
    wraps = len(sel) < 12 and 1 in sel and 12 in sel
    late = set()
    if wraps:
        m = 12
        while m >= 1 and m in sel:
            late.add(m)
            m -= 1
    lookup = {(int(y), int(m)): float(v) for y, m, v in zip(years, months, values)}
    out_y, out_v = [], []
    for y in range(int(years[0]), int(years[-1]) + 1):
        vals = [lookup.get(((y - 1) if m in late else y, m)) for m in sel]
        if all(v is not None for v in vals):
            out_y.append(y)
            out_v.append(sum(vals) / len(sel))
    return np.array(out_y), np.array(out_v)


def analyse_season(values, years, months, selected, min_years=20):
    """Both checks on a season series, plus the expanding-window replay."""
    sy, sv = season_series(values, years, months, selected)
    t = (sy - sy[0]) / 10.0
    quick = ols_trend(t, sv)
    c = santer_trend(t, sv)
    mkr = mann_kendall(sv, per_decade_factor=10.0)
    strength, direction = verdict(c["p"], mkr["p"], c["slope"])
    windows = []
    for k in range(min_years, len(sv) + 1):
        q = ols_trend(t[:k], sv[:k])
        w = santer_trend(t[:k], sv[:k])
        m = mann_kendall(sv[:k], per_decade_factor=10.0)
        s_, d_ = verdict(w["p"], m["p"], w["slope"])
        windows.append({"end_year": int(sy[k - 1]), "slope": w["slope"], "lo": w["lo"], "hi": w["hi"],
                        "p_adjusted_ols": w["p"], "p_mann_kendall": m["p"], "quick_p": q["p"],
                        "strength": s_, "direction": d_})
    need = detection_years(c["slope"], c["resid_sd"], c["r1"], points_per_year=1)
    return {"season_years": sy, "season_values": sv,
            "quick": {"slope": quick["slope"], "p": quick["p"]},
            "careful": {"slope": c["slope"], "lo": c["lo"], "hi": c["hi"], "p_adjusted_ols": c["p"],
                        "p_mann_kendall": mkr["p"], "sen_slope": mkr["sen_slope"], "r1": c["r1"],
                        "n_effective": c["neff"], "resid_sd": c["resid_sd"],
                        "strength": strength, "direction": direction},
            "windows": windows, "detection_years_needed": need}
