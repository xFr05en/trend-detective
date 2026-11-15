"""Check that site/stats.js gives the same results as pipeline/trendlib.py.

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.
Needs Node.js. Run:  python tests/check_js_parity.py
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
import trendlib as tl                                   # noqa: E402
from loaders import LOADERS, trim_to_full_years         # noqa: E402

SEASONS = [[1], [3], [12, 1, 2], [6, 7, 8], [7, 8]]
TOL = 2e-4


def close(a, b):
    return abs(a - b) <= TOL * max(1.0, abs(a), abs(b))


def main():
    cat = json.load(open(os.path.join(ROOT, "config", "catalog.json"), encoding="utf-8"))
    jobs, refs, labels = [], [], []
    for s in cat["series"]:
        y, m, v = LOADERS[s["format"]](os.path.join(ROOT, s["file"]))
        y, m, v = trim_to_full_years(y, m, v)
        v = v * float(s.get("scale", 1))
        base = {"values": v.tolist(), "years": y.tolist(), "months": m.tolist()}
        res = tl.analyse(v, y, m)
        refs.append({"quick_p": res["quick"]["p"], "careful": res["careful"],
                     "windows": tl.expanding_window(v, y, m), "need": res["detection_years_needed"]})
        jobs.append(base); labels.append(s["id"] + " monthly")
        for sel in SEASONS:
            r = tl.analyse_season(v, y, m, sel)
            refs.append({"quick_p": r["quick"]["p"], "careful": r["careful"], "windows": r["windows"],
                         "need": r["detection_years_needed"]})
            jobs.append({**base, "selected": sel}); labels.append(f"{s['id']} season {sel}")
    out = subprocess.run(["node", os.path.join(ROOT, "tests", "js_runner.js")], input=json.dumps(jobs),
                         capture_output=True, text=True, check=True).stdout
    js = json.loads(out)
    bad = 0
    keys = ["slope", "lo", "hi", "p_adjusted_ols", "p_mann_kendall", "sen_slope", "r1", "n_effective", "resid_sd"]
    for label, ref, got in zip(labels, refs, js):
        problems = []
        if not close(ref["quick_p"], got["quick"]["p"]):
            problems.append(("quick_p", ref["quick_p"], got["quick"]["p"]))
        for k in keys:
            if not close(ref["careful"][k], got["careful"][k]):
                problems.append((k, ref["careful"][k], got["careful"][k]))
        if ref["careful"]["strength"] != got["careful"]["strength"]:
            problems.append(("strength", ref["careful"]["strength"], got["careful"]["strength"]))
        if not close(ref["need"], got["detection_years_needed"]):
            problems.append(("need", ref["need"], got["detection_years_needed"]))
        if len(ref["windows"]) != len(got["windows"]):
            problems.append(("n_windows", len(ref["windows"]), len(got["windows"])))
        else:
            for a, b in zip(ref["windows"], got["windows"]):
                for k in ["slope", "lo", "hi", "p_adjusted_ols", "p_mann_kendall", "quick_p"]:
                    if not close(a[k], b[k]):
                        problems.append((f"window {a['end_year']} {k}", a[k], b[k]))
                if a["strength"] != b["strength"] or a["end_year"] != b["end_year"]:
                    problems.append((f"window {a['end_year']} strength", a["strength"], b["strength"]))
        if problems:
            bad += 1
            print("MISMATCH", label, problems[:4])
    print(f"{len(labels) - bad} of {len(labels)} analyses match (tolerance {TOL})")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
