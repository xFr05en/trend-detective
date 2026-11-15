"""Simulation study: how often does each check get it wrong?

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.

Part A (false alarms): series with NO trend and AR(1) noise. A sound 5% test should
declare a trend in about 5% of them.
Part B (missed trends): series WITH a real trend, a seasonal cycle and AR(1) noise.
Compares how often the quick check and the careful check find the trend.

Usage:  python pipeline/simulate.py [reps]
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np
from scipy import stats
import pymannkendall as mk

sys.path.insert(0, os.path.dirname(__file__))
import trendlib as tl   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ar1(n, phi, sd, rng):
    e = rng.normal(0, sd * np.sqrt(1 - phi ** 2), n)
    x = np.empty(n)
    x[0] = rng.normal(0, sd)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + e[i]
    return x


def run(reps=1000, n_years=45, seed=2026):
    rng = np.random.default_rng(seed)
    n = n_years * 12
    months = np.tile(np.arange(1, 13), n_years)
    t = (np.arange(n) + 0.5) / 120.0
    out = {"reps": reps, "n_years": n_years, "alpha": tl.ALPHA, "seed": seed,
           "false_alarms": [], "missed_trends": []}

    for phi in (0.0, 0.3, 0.6, 0.8):
        hits = {"naive_ols": 0, "adjusted_ols": 0, "hac": 0, "mann_kendall_plain": 0,
                "mann_kendall_modified": 0, "careful": 0}
        for _ in range(reps):
            y = ar1(n, phi, 1.0, rng)
            a = tl.ols_trend(t, y)["p"] < tl.ALPHA
            b = tl.santer_trend(t, y)["p"] < tl.ALPHA
            c = tl.hac_trend(t, y)["p"] < tl.ALPHA
            d = mk.original_test(y).p < tl.ALPHA
            e = tl.mann_kendall(y)["p"] < tl.ALPHA
            hits["naive_ols"] += a; hits["adjusted_ols"] += b; hits["hac"] += c
            hits["mann_kendall_plain"] += d; hits["mann_kendall_modified"] += e
            hits["careful"] += (b and e)
        out["false_alarms"].append({"phi": phi, **{k: round(100 * v / reps, 1) for k, v in hits.items()}})
        print("false alarms phi", phi, out["false_alarms"][-1], flush=True)

    # Part B: real trend of 0.25 units per decade, seasonal swing of +-10, noise sd 1.5
    for phi in (0.0, 0.3, 0.6):
        found = {"quick": 0, "careful": 0}
        for _ in range(reps // 2):
            y = 0.25 * t + 10 * np.cos(2 * np.pi * (months - 1) / 12) + ar1(n, phi, 1.5, rng)
            found["quick"] += tl.ols_trend(t, y)["p"] < tl.ALPHA
            anom, _c = tl.monthly_anomalies(y, months)
            found["careful"] += (tl.santer_trend(t, anom)["p"] < tl.ALPHA
                                 and tl.mann_kendall(anom)["p"] < tl.ALPHA)
        m = reps // 2
        out["missed_trends"].append({"phi": phi, "trend_per_decade": 0.25, "seasonal_amplitude": 10,
                                     "noise_sd": 1.5,
                                     "quick_found": round(100 * found["quick"] / m, 1),
                                     "careful_found": round(100 * found["careful"] / m, 1)})
        print("missed trends phi", phi, out["missed_trends"][-1], flush=True)

    dest = os.path.join(ROOT, "site", "data", "simulation.json")
    json.dump(out, open(dest, "w", encoding="utf-8"), indent=1, allow_nan=False)
    return out


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 1000)
