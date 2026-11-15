"""Tests on simulated data. Run:  python -m pytest tests  (or python tests/test_trendlib.py)

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "pipeline"))
import trendlib as tl   # noqa: E402


def make(n_years=40, slope=0.5, amp=8.0, sd=0.5, seed=1):
    rng = np.random.default_rng(seed)
    years = np.repeat(np.arange(1985, 1985 + n_years), 12)
    months = np.tile(np.arange(1, 13), n_years)
    t = (years + (months - 0.5) / 12 - years[0]) / 10
    y = slope * t + amp * np.cos(2 * np.pi * (months - 1) / 12) + rng.normal(0, sd, len(t))
    return y, years, months


def test_anomalies_remove_seasonal_cycle():
    y, years, months = make(slope=0.0, sd=0.0)
    anom, clim = tl.monthly_anomalies(y, months)
    assert np.allclose(anom, 0, atol=1e-9)
    assert abs(clim.max() - 8.0) < 1e-9


def test_slope_is_recovered():
    y, years, months = make(slope=0.5)
    res = tl.analyse(y, years, months)
    assert abs(res["careful"]["slope"] - 0.5) < 0.05
    assert res["careful"]["lo"] < 0.5 < res["careful"]["hi"]
    assert res["careful"]["strength"] == "strong" and res["careful"]["direction"] == "rising"


def test_no_correction_without_autocorrelation():
    rng = np.random.default_rng(3)
    t = np.arange(240) / 120
    y = rng.normal(0, 1, 240)
    y = y - tl.lag1_autocorr(y) * 0          # white noise
    a, b = tl.ols_trend(t, y), tl.santer_trend(t, y)
    if b["r1"] <= 0:
        assert abs(a["se"] - b["se"]) < 1e-12
    assert b["se"] >= a["se"] - 1e-12


def test_autocorrelation_widens_interval():
    rng = np.random.default_rng(4)
    n = 480
    x = np.zeros(n)
    for i in range(1, n):
        x[i] = 0.7 * x[i - 1] + rng.normal()
    t = np.arange(n) / 120
    a, b = tl.ols_trend(t, x), tl.santer_trend(t, x)
    assert (b["hi"] - b["lo"]) > 1.5 * (a["hi"] - a["lo"])
    assert b["neff"] < n / 3


def test_detection_years_formula():
    # white noise, sd 1, trend 0.1 per year: n* = (3.3 * 1 / 0.1) ** (2/3)
    assert abs(tl.detection_years(1.0, 1.0, 0.0) - (33.0) ** (2 / 3)) < 1e-9


def test_expanding_window_and_stable_year():
    y, years, months = make(slope=0.5)
    w = tl.expanding_window(y, years, months)
    assert w[0]["end_year"] == 1994 and w[-1]["end_year"] == years[-1]
    fs = tl.first_stable_year(w)
    assert fs is not None and fs <= years[-1]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
