"""Read the catalog and raw series, run both checks, write site/data/results.json.

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.
Usage:  python pipeline/run_pipeline.py
"""
from __future__ import annotations

import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import trendlib as tl            # noqa: E402
from loaders import LOADERS, trim_to_full_years   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def r(x, nd=4):
    return None if x is None else round(float(x), nd)


def main():
    cat = json.load(open(os.path.join(ROOT, "config", "catalog.json"), encoding="utf-8"))
    out = {"generated_by": "pipeline/run_pipeline.py", "alpha": tl.ALPHA,
           "variables": cat["variables"], "places": cat["places"],
           "investigations": cat["investigations"], "series": {}, "comparisons": {}}
    careful_by_id = {}
    raw_by_id = {}
    out["crosschecks"] = {}
    for s in cat["series"]:
        years, months, values = LOADERS[s["format"]](os.path.join(ROOT, s["file"]))
        years, months, values = trim_to_full_years(years, months, values)
        values = values * float(s.get("scale", 1))
        raw_by_id[s["id"]] = (years, months, values)
        res = tl.analyse(values, years, months)
        windows = tl.expanding_window(values, years, months)
        c = res["careful"]
        careful_by_id[s["id"]] = c
        need = res["detection_years_needed"]
        more = None
        if c["strength"] == "none" and need is not None and need < 300:
            more = max(0.0, need - res["years_available"])
        out["series"][s["id"]] = {
            "place": s["place"], "variable": s["variable"], "source_file": s["file"],
            "start_year": int(years[0]), "end_year": int(years[-1]), "n_months": res["n_months"],
            "mean": r(res["mean"], 3),
            "quick": {k: (v if isinstance(v, bool) else r(v, 5)) for k, v in res["quick"].items()},
            "seasons_removed_only": {k: (v if isinstance(v, bool) else r(v, 5))
                                     for k, v in res["seasons_removed_only"].items()},
            "careful": {k: (v if isinstance(v, (bool, str, int)) and not isinstance(v, float) else r(v, 5))
                        for k, v in c.items()},
            "percent_per_decade": r(100 * c["slope"] / res["mean"], 2) if abs(res["mean"]) > 1e-9 else None,
            "detection_years_needed": r(need, 1),
            "more_years_needed": r(more, 1),
            "first_stable_year": tl.first_stable_year(windows),
            "stable_from_first_window": bool(windows and tl.first_stable_year(windows) == windows[0]["end_year"]),
            "windows": [{k: (v if isinstance(v, (str, int)) and not isinstance(v, float) else r(v, 5))
                         for k, v in w.items()} for w in windows],
            "values": [r(v, 2) for v in values],
            "anomalies": [r(v, 3) for v in res["anomalies"]],
            "climatology": [r(v, 3) for v in res["climatology"]],
        }
    # Cross-check one source against another over their common years
    for s in cat["series"]:
        other = s.get("crosscheck")
        if not other:
            continue
        ya, ma, va = raw_by_id[s["id"]]
        yb, mb, vb = raw_by_id[other]
        lo_y, hi_y = max(ya[0], yb[0]), min(ya[-1], yb[-1])
        sa, sb = (ya >= lo_y) & (ya <= hi_y), (yb >= lo_y) & (yb <= hi_y)
        ra = tl.analyse(va[sa], ya[sa], ma[sa])
        rb = tl.analyse(vb[sb], yb[sb], mb[sb])
        corr = float(np.corrcoef(ra["anomalies"], rb["anomalies"])[0, 1])
        out["crosschecks"][s["id"]] = {
            "other": other, "start_year": int(lo_y), "end_year": int(hi_y),
            "anomaly_correlation": r(corr, 3),
            "mean_this": r(va[sa].mean(), 3), "mean_other": r(vb[sb].mean(), 3),
            "slope_this": r(ra["careful"]["slope"], 4), "slope_other": r(rb["careful"]["slope"], 4),
            "strength_this": ra["careful"]["strength"], "strength_other": rb["careful"]["strength"]}
        print("crosscheck", s["id"], out["crosschecks"][s["id"]])
    for inv in cat["investigations"]:
        if len(inv["series"]) == 2:
            a, b = inv["series"]
            d = tl.slope_difference(careful_by_id[a], careful_by_id[b])
            out["comparisons"][inv["id"]] = {"a": a, "b": b, "difference": r(d["difference"], 5),
                                             "se": r(d["se"], 5), "p": r(d["p"], 5),
                                             "significant": bool(d["p"] < tl.ALPHA)}
    dest = os.path.join(ROOT, "site", "data", "results.json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    json.dump(out, open(dest, "w", encoding="utf-8"), separators=(",", ":"), allow_nan=False)
    for sid, s in out["series"].items():
        c = s["careful"]
        print(f"{sid:24s} slope/decade {c['slope']:+.3f} [{c['lo']:+.3f},{c['hi']:+.3f}]  "
              f"quick p={s['quick']['p']:.4f}  seasons-only p={s['seasons_removed_only']['p']:.4f}  "
              f"adjOLS p={c['p_adjusted_ols']:.4f}  MK p={c['p_mann_kendall']:.4f}  HAC p={c['p_hac']:.4f}  "
              f"r1={c['r1']:.2f} neff={c['n_effective']:.0f}  {c['strength']}/{c['direction']}  "
              f"stable since {s['first_stable_year']}  more years {s['more_years_needed']}")
    for k, v in out["comparisons"].items():
        print("comparison", k, v)


if __name__ == "__main__":
    main()
