# Submission drafts (edit before pasting into the project page)

All text below is a draft generated with AI assistance. Rewrite it in your own words where you can.

## Project name
Trend Detective

## High-level summary (50 to 200 words)
[AUTHOR: write or rewrite. Draft:]
Trend Detective answers one question for people who plan around a season, such as festival
organisers, growers and local services: is my season really shifting, or were the last few years
just unusual? The user picks any place on a globe, the months that matter and a variable (air
temperature, coldest temperature, or rain and snow). The site pulls the NASA record for that point
and reports whether the change is real, how fast it is, and since when the evidence has been
strong. If the evidence is not there yet, it estimates how many more years of data are needed.
Every answer is tested twice, with the quick line fit most tools use and with a careful test that
handles seasonality and autocorrelation, because the quick test can miss real trends (it misses
45 years of warming in Seoul) and can raise false alarms. A simulation shows how often each test
is wrong.

## Link to project demo
[ADD: public link to 7 slides or a 30-second video]

## Link to final project
https://xfr05en.github.io/trend-detective/ and https://github.com/xFr05en/trend-detective

## Detailed project description
See README.md (what it does, how it works, results, limits, tools). Paste and shorten.

Tools: Python (NumPy, SciPy, statsmodels, pymannkendall), JavaScript, globe.gl, GitHub Pages.

## Use of SI
See docs/SI_USE.md. State it plainly on the project page.

## NASA data
- NASA POWER monthly API (MERRA-2): T2M, T2M_MIN, PRECTOTCORR at five points, 1981 to 2025.
- NASA Giovanni: GPM IMERG Final Run monthly V07 (GPM_3IMERGM) precipitation, area average over 126.5-127.5°E, 37.1-38.0°N, 2001 to 2024. Used as an independent satellite cross-check of the MERRA-2 rainfall for Seoul.
- NASA Blue Marble imagery for the globe texture.

## Space agency partner data and other references
Copy the References section of README.md. Add every tool and source you use later.

## 7-slide outline
1. Title, team, challenge. Hook: "The quick test says Seoul is not warming. It is."
2. Problem and users: students checking claims about a changing planet; significance is easy to get wrong.
3. Solution: globe, answer panel, two checks, replay slider.
4. Screens: Seoul temperature (checks disagree), Seoul rain (no clear trend), Niamey vs Santiago (opposite trends).
5. NASA data: POWER / MERRA-2, Giovanni.
6. How it works and validation: the simulation table.
7. Impact, limits, next steps, references.
