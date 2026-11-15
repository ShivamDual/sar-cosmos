# Handoff: read this first

This folder is the complete SAR Cosmos project, version 9 (pre-event build). It is not published. The only
remaining task is the real satellite run on a laptop; everything else is finished and tested.

## What the earlier folder contained
The previous project folder (named sar-cosmos-full-project) held an earlier build with these parts:
- A Streamlit dashboard (`app.py`, `ui/`) and a first 3D site with a Leaflet map and Chart.js charts.
- Pipeline scripts: a Google Earth Engine optical script and a NISAR radar script. The radar extraction was a stub.
- A `data/processed/lake_timeseries.csv` made from a synthetic generator. Its numbers were not real satellite data,
  although a flag in the export claimed otherwise.
- Downstream "impact" figures (flood arrival times, populations, volumes, dam heights) that had no source.
- An "AI terminal" that matched keywords against canned text, and a printable hazard dossier built on that data.
- A GitHub publish script that stored a personal access token in plain text. The token must be revoked.

## What this version changed
- **Honesty about data.** The site shows only published measurements (Rounce et al. 2016, 2000 to 2015) or real
  pipeline results. Synthetic numbers can never reach the page, and tests enforce this. The invented flood, population
  and volume figures are gone. Validation refuses to run on placeholder data.
- **Pipelines.** `pipeline/gee_landsat.py` uses Landsat 5, 7, 8 and 9 (the earlier code used Landsat 8 alone, which
  starts in 2013). It uses per-image Otsu thresholds and keeps only the water patch that contains the lake, plus a
  `--verify-positions` mode for coordinates. `pipeline/nisar_water.py` streams only a small window of each NISAR GCOV
  file, rejects radar shadow with the single-patch rule, saves per-scene images with the water outline, and logs
  every scene with a quality flag. `pipeline/validate_published.py` checks optical against published areas and radar
  against optical within 14 days.
- **Cosmo, the assistant.** A large offline brain (glossary, FAQ, retrieval, calculator, small talk, lake answers,
  writing, documents), an AI mode for the viewer that hosts the site, an optional secure proxy for a server-side AI
  provider, and an optional deep offline model for PCs. API keys never appear in site code.
- **Site.** Rebuilt as a 3D scene with scroll-driven story, optical and radar views, an observation calendar, lake
  panels, radar scene viewer, printable fact sheets and documents, and a single-file build that works offline.
- **Publishing safety.** `scripts/deploy_to_github.py` no longer holds any token. It scans every file for secrets and
  refuses to push if it finds one. Git signs in through the browser.
- **Repository.** A new README, a design guide, animated SVG artwork (banner, atom, solar system, divider), a
  changelog, a complete `.gitignore`, and `RUN_ON_LAPTOP.md` plus `scripts/run_real_pipeline.py`, which run the
  whole real pipeline in order with preflight checks and per-step logs.

## Tests (all passing)
- Python: `python -m pytest tests -q` (39 passed, 2 skipped; the skips need the real data)
- JavaScript: `node tests/js/brain.test.js`, `brain-write.test.js`, `chatlib.test.js`, `qa.test.js`, `worker.test.mjs`
- Secret scan: `python scripts/deploy_to_github.py --check-only`

## The only remaining task
Follow `RUN_ON_LAPTOP.md`, then run:

    python scripts/run_real_pipeline.py --project YOUR-GCP-PROJECT-ID

If a step stops, send the log file it names in `logs/` to the developer.

## Do not do yet
- Do not publish the repository until the real run is complete and the submission rules check is done.
- Do not commit credentials. Tokens are set for one terminal window only.

## Known limits
- The NISAR GCOV reader follows the public product layout but has not been run on a real NISAR file. It may need one
  fix on the first real run; the logs will show it.
- The Earth Engine calls have been tested only against synthetic images.
- The 3D terrain is generated for illustration, not real elevation.
- Lumding and Hongu coordinates still need checking (the run reports them).
- Published areas carry about 10% error, which the site states.
