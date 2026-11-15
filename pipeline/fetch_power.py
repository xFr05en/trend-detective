"""Download monthly series from the NASA POWER API and save them in data/raw/.

Generated with AI assistance (Claude) for the NASA Space Apps Challenge 2026.
NOTE: not yet run from this script. The CSVs in data/raw/ were retrieved from the same
API endpoint through a web browser on 2026-11-14 and checked against the API's values.

Usage:  python pipeline/fetch_power.py
"""
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = ("https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={p}&community=AG"
       "&longitude={lon}&latitude={lat}&start={a}&end={b}&format=JSON")
START, END = 1981, 2025


def main():
    cat = json.load(open(os.path.join(ROOT, "config", "catalog.json"), encoding="utf-8"))
    for s in cat["series"]:
        if s["format"] != "power":
            continue
        place = cat["places"][s["place"]]
        url = API.format(p=s["variable"], lon=place["lon"], lat=place["lat"], a=START, b=END)
        with urllib.request.urlopen(url, timeout=60) as r:
            j = json.load(r)
        d = j["properties"]["parameter"][s["variable"]]
        info = j["parameters"][s["variable"]]
        path = os.path.join(ROOT, s["file"])
        with open(path, "w", encoding="utf-8") as o:
            o.write("# Source: NASA POWER monthly API (MERRA-2), https://power.larc.nasa.gov/\n")
            o.write(f"# Parameter: {s['variable']} ({info['longname']}), units: {info['units']}\n")
            o.write(f"# Point: lat {place['lat']}, lon {place['lon']}; period {START}-01 to {END}-12\n")
            o.write(f"# Request: {url}\n")
            o.write("date,value\n")
            for key in sorted(d):
                if key.endswith("13"):          # month 13 is the annual value
                    continue
                if d[key] <= -900:              # fill value
                    continue
                o.write(f"{key[:4]}-{key[4:]},{d[key]:.2f}\n")
        print("saved", s["file"])


if __name__ == "__main__":
    main()
