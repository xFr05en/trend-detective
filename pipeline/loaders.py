"""Loaders for monthly time series files.

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.
"""
from __future__ import annotations

import csv
import io
import re
import numpy as np


def load_power_csv(path):
    """CSV written by this project from the NASA POWER monthly API: '#' comments, then date,value."""
    years, months, values = [], [], []
    with open(path, encoding="utf-8") as f:
        rows = [r for r in f if not r.startswith("#")]
    for row in csv.DictReader(io.StringIO("".join(rows))):
        y, m = row["date"].split("-")
        years.append(int(y)); months.append(int(m)); values.append(float(row["value"]))
    return np.array(years), np.array(months), np.array(values)


def load_giovanni_csv(path, fill_values=(-9999.0, -999.0)):
    """Area-averaged time series CSV downloaded from NASA Giovanni.

    Giovanni files start with a block of metadata lines, then a header row beginning with
    'time', then rows such as '2005-01-01 00:00:00,0.000123'. Fill values and blanks are
    dropped. Checked against a real Giovanni download (GPM IMERG, 14 Nov 2026).
    """
    years, months, values = [], [], []
    started = False
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not started:
                if line.lower().startswith("time"):
                    started = True
                continue
            parts = line.split(",")
            if len(parts) < 2:
                continue
            m = re.match(r"(\d{4})-(\d{2})", parts[0])
            if not m:
                continue
            try:
                v = float(parts[1])
            except ValueError:
                continue
            if v < -900 or any(abs(v - fv) < 1e-6 for fv in fill_values) or np.isnan(v):
                continue
            years.append(int(m.group(1))); months.append(int(m.group(2))); values.append(v)
    return np.array(years), np.array(months), np.array(values)


def trim_to_full_years(years, months, values):
    """Keep only calendar years that have all 12 months, so the seasonal cycle is balanced."""
    keep = np.zeros(len(years), bool)
    for y in np.unique(years):
        sel = years == y
        if sel.sum() == 12 and set(months[sel]) == set(range(1, 13)):
            keep |= sel
    return years[keep], months[keep], values[keep]


LOADERS = {"power": load_power_csv, "giovanni": load_giovanni_csv}
