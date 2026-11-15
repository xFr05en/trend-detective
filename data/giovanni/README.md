# NASA Giovanni series

Currently here: `giovanni_seoul_GPM_3IMERGM_07_precipitation_2001-2024.csv` (GPM IMERG monthly rainfall,
Seoul box, 2001 to 2024). To add another series:

1. Open https://giovanni.gsfc.nasa.gov/ and sign in with Earthdata Login.
2. Plot type: **Time Series, Area-Averaged**.
3. Pick a date range, a bounding box (West, South, East, North) and one **monthly** variable.
   Example: OMI NO2 tropospheric column, monthly, box around Seoul.
4. Click **Plot Data**, then **Downloads** and save the **CSV** file into this folder.
5. Add the series to `config/catalog.json`:
   - a `variables` entry (name, unit, plain definition, dataset name and version)
   - a `places` entry if the place is new
   - a `series` entry with `"format": "giovanni"` and the file path
   - optionally an `investigations` entry with a question
6. Run `python pipeline/run_pipeline.py` and reload the site.

Check the unit Giovanni serves (the IMERG series comes in mm/hr; the catalog entry uses `"scale": 24`).
