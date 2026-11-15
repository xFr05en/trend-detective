# Use of AI (SI) tools

The challenge rules require a clear statement of where AI tools were used. This file is the record.

## Tool

Claude (Anthropic), 14 November 2026.

## What Claude generated

| Item | Files |
|---|---|
| Statistics code | `pipeline/trendlib.py`, `pipeline/loaders.py`, `pipeline/run_pipeline.py`, `pipeline/simulate.py`, `pipeline/fetch_power.py` |
| Unit tests | `tests/test_trendlib.py`, `tests/check_js_parity.py`, `tests/js_runner.js` |
| Browser statistics | `site/stats.js` (JavaScript version of the tests, checked against the Python code) |
| Website | `site/index.html`, `site/style.css`, `site/app.js` |
| Configuration and plain-language definitions | `config/catalog.json` |
| Documentation drafts | `README.md`, `docs/methods.md`, `docs/submission_draft.md`, this file |
| Data retrieval | The seven NASA POWER series in `data/raw/` were requested from the NASA POWER API through a browser session driven by Claude, then checked against the API's own totals |
| Giovanni data | Claude submitted the Giovanni request (GPM IMERG, Seoul box) in a browser session; the author signed in, downloaded the CSV and supplied it; Claude added it to the pipeline |
| Design mockup | An early screen mockup |

Each generated source file carries a header line stating that it was generated with AI assistance.
