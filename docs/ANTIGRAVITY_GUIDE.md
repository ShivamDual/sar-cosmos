# Guide for the assistant running SAR Cosmos on this laptop

Read this whole file before you run anything. It explains what the project is, what the rules require, what has
already been built and tested, what still needs to happen, and the exact steps. It is written so you can work
through the project without guessing.

## 1. Who the owner is, and the situation

SAR Cosmos is a solo entry from one participant, Shivam, for the NASA Space Apps Challenge 2026. The challenge is
"Dancing with the SARs": build an interactive application that uses NISAR radar data (a NASA and ISRO mission) to
track and visualise surface change. The team is registered to the Bhaktapur local event, in virtual participation.
The owner is not in the room. He is working from his friend's home, and this laptop belongs to that friend. The
owner will give you his tokens during the session. Treat every token as temporary and never write one to a file,
commit, log, screenshot or the chat.

The project is judged on a submission made through the official platform: a high-level summary, a project demo
(either a seven-slide deck or a 30-second video), a publicly accessible final project link, project details, a
statement of how NASA data was used, and a list of references. To qualify for global awards, the project must use
NASA data. This project does: NISAR GCOV radar products (through the Alaska Satellite Facility), and Landsat
surface reflectance from the NASA and USGS Landsat programme, through Google Earth Engine.

## 2. What is in this folder

The folder `sar-cosmos` is the whole project. The important parts:

- `site/` is the website: a 3D scene of the Himalaya with six lakes, the optical and radar views, the observation
  calendar, lake panels, the radar scene viewer, printable fact sheets and documents, and Cosmo, the assistant.
- `dist/` is produced by the build. `dist/sar-cosmos-single.html` is the whole site in one file that opens offline.
- `pipeline/` contains the satellite pipelines: `gee_landsat.py` (Landsat optical history, 2000 to present),
  `nisar_water.py` (NISAR radar scenes, streamed in small windows), and `validate_published.py` (checks results
  against published numbers, and refuses to run on placeholder data).
- `scripts/` contains the tools: `run_real_pipeline.py` (runs the whole real pipeline in order, with checks and logs),
  `export_static_data.py` (writes the site's data file), `build_single_file.py` (builds the one-file site),
  `build_chat_knowledge.py` (builds Cosmo's knowledge), `deploy_to_github.py` (scans for secrets, then publishes).
- `data/` holds the lake metadata, the published reference areas (Rounce et al. 2016), and the processed results.
- `docs/` holds the design guide, artwork, submission text, video notes and this guide.
- `tests/` holds the Python and JavaScript test suites.
- `worker/` is an optional, separate AI proxy. Leave it alone unless the owner asks for it.
- `logs/` is created by the pipeline runner. Every step writes its log here.
- `RUN_ON_LAPTOP.md` is the short runbook for the pipeline.

Important: the site currently shows **published** lake areas (Rounce et al. 2016, 2000 to 2015). It shows real pipeline
results only after the pipelines have run. Synthetic data cannot reach the site: the export refuses to use data
unless a real run's log exists, and tests enforce this. Do not change that behaviour to make the site look fuller.

## 3. What has been changed, and why

The owner's earlier build (a folder called sar-cosmos-full-project) had problems that are now fixed:

- It displayed synthetic lake data as if it were real. The export now uses real results only, and says which mode is on.
- It showed flood arrival times, populations, volumes and dam heights with no source. These were removed. The site now
  only states public facts, and says that flood timing needs flood modelling run by the responsible authorities.
- It had an "AI terminal" that matched keywords against canned text. It is replaced by Cosmo: a documented offline
  brain with retrieval, a calculator, lake answers, writing and documents, plus optional AI modes.
- The publish script stored a personal access token in plain text. The token must be revoked by the owner. The new
  publish script holds no token: it scans every file for secrets and refuses to push if it finds one.
- The Landsat pipeline used Landsat 8 alone, which starts in 2013. It now uses Landsat 5, 7, 8 and 9 for the full
  history.
- The NISAR pipeline was a stub. It now streams small windows of each GCOV file, chooses the single dark water patch
  that contains each lake's coordinates, rejects radar shadow (which is also dark), saves per-scene images with the
  water outline, and logs every scene with a quality flag.
- The validation now compares optical results with published areas for the same lakes and dates, and radar results
  with optical results from within 14 days.

Everything above is tested. The test suites are listed in section 7.

## 4. What is left, in order

Only one task is left: the real satellite run. Everything else is built and tested. Your job, in order:

1. Check the environment (section 5).
2. Install the requirements (section 5).
3. Authenticate Earth Engine once (section 5).
4. Set the NASA token for this terminal session only (section 5).
5. Run the real pipeline with the project id the owner gives you (section 6).
6. If a step fails, read the log it names, fix the cause if it's a small code problem, rerun that step, and continue.
7. When every step passes, rebuild the data and the one-file site, then test the site in a browser (section 8).
8. Assemble the submission text from the real results only (section 9).
9. Wait for the owner's instruction before publishing (section 10).

## 5. Environment and setup

Work from the `sar-cosmos` folder. Confirm you are there with `pwd` (or `cd` on Windows) before you run anything.

1. Check Python: `python --version` should be 3.11 or newer.
2. Install the requirements: `python -m pip install -U -r requirements.txt`. If a package fails, install it on its
   own and read the error. Do not change the version pins unless the error requires it, and tell the owner if you do.
3. Authenticate Earth Engine once: `earthengine authenticate`. A browser opens. The owner signs in with the Google
   account that has Earth Engine access. Do not use any other account.
4. Set the NASA Earthdata token for this terminal session only. The owner types or pastes it when asked, in the
   terminal, as: `$env:EARTHDATA_TOKEN = "<the token>"` on PowerShell, or `export EARTHDATA_TOKEN="<the token>"`
   on bash. Never write it to a file, a `.env` file, the shell history file, the project, a log, or the chat.
   If the owner is unsure, ask them to type it themselves.
5. The Earth Engine project id is an identifier, not a secret. The owner will give it to you. Use it as
   `--project <id>`.

Run the setup check without any step: `python scripts/run_real_pipeline.py` with no project id. It lists anything
missing without printing any secret. Fix each listed item and run it again.

## 6. The real pipeline run

Run the whole pipeline with one command:

    python scripts/run_real_pipeline.py --project <EARTH-ENGINE-PROJECT-ID>

It runs these steps in order, and stops at the first failure:

1. **verify_positions**: prints water blobs near each lake's coordinates from a recent Landsat image. Read the output.
   Lumding and Hongu coordinates are not yet verified. If a blob clearly sits elsewhere, do not edit the coordinates
   without telling the owner, because the coordinates change the results.
2. **landsat_test**: one lake, 2013 to 2015. This checks Earth Engine works end to end. Look at the log for the
   per-year areas. They should be close to the published values for Imja Tsho (about 1.1 to 1.3 square kilometres).
3. **landsat_full**: every lake, every year. This writes the optical rows into `data/processed/lake_timeseries.csv`
   and a QC log at `data/processed/optical_scene_log.csv`.
4. **nisar_test**: two NISAR scenes over Imja Tsho. Check that the run finds scenes, streams them, and writes images
   to `site/radar/`.
5. **nisar_full**: every NISAR scene over every lake, writing `data/processed/nisar_scene_log.csv`, the radar images,
   and the radar manifest.
6. **validate**: compares results with the published values and writes `data/processed/validation_report.csv`.
7. **export**: rebuilds `site/data.js`. The site then switches its label to the pipeline mode when every lake has real
   results.
8. **build**: rebuilds `dist/sar-cosmos-single.html`.

Every step writes a log to `logs/`. The runner prints the last lines of each log, and names the log file when a step
fails. Keep these logs. They are the evidence the judges may ask for.

### What to expect

- The Landsat run takes a while, because it queries many images per lake. Let it finish.
- The NISAR run downloads small windows, not whole files. A lake usually has 28 to 36 calibrated scenes since June 2026.
- Some scenes will be excluded. That is correct behaviour. The scene log shows the reason: `seed_on_land` means the dark
  patch was not at the lake's coordinates, `outlier` means the area differs too much from the others, and
  `no_clear_water` means there was no clear water signal. Excluded scenes are not used in the growth charts.

### If a step fails

- **Earth Engine errors about the project or permissions:** check the project id, and that Earth Engine is enabled for
  that project. Do not change the code to get around permissions.
- **Earthdata or login errors:** check the token is set in this terminal session. Do not print it. Ask the owner for a
  fresh token if it has expired.
- **A missing Python package:** install that package and rerun the step.
- **Errors inside the NISAR reader** (a key error about a dataset path): this may mean the file layout differs from
  the one the code expects. Use the NISAR Data User Guide (listed in section 11) to confirm the layout. Print the
  dataset names from one file with `f.visit(print)` in a short script, and compare. Fix the path in
  `pipeline/nisar_water.py` only if you are sure, and rerun the test suite afterwards.
- **Anything else:** read the log, fix the smallest cause you can prove, rerun only the failed step, and keep a note
  of what you changed for the owner.

Never delete the logs, the QC files or the processed CSVs to get a clean run. Never make the code report synthetic or
invented numbers. If a lake has no real result, the site must keep showing its published value.

## 7. Tests, and how to check the project is healthy

Run these after any code change:

- `python -m pytest tests -q` (Python tests; the two skipped tests need the real data)
- `node tests/js/brain.test.js`
- `node tests/js/brain-write.test.js`
- `node tests/js/chatlib.test.js`
- `node tests/js/qa.test.js`
- `node tests/js/worker.test.mjs`
- `python scripts/deploy_to_github.py --check-only` (secret scan; it must say "Secret scan clean")

If a test fails after you change something, undo the change first and tell the owner what happened.

## 8. Rebuild and check the site

After the real run:

1. Confirm `site/data.js` reports the pipeline mode: the lake panel label should read "Landsat and NISAR pipeline".
   If it still says "Published data", a lake is missing real results. Read the export output to see which one.
2. Run `python scripts/build_single_file.py`. For the radar scene images to appear in the one-file build, run
   `python scripts/build_single_file.py --inline-radar`. It produces a larger file. Keep both files, and say which one
   the owner should submit.
3. Open `dist/sar-cosmos-single.html` in a browser at PC size and at phone size (use the browser's device mode).
   Check: the header, the orb button labelled Ask Cosmo, the lake panel, the radar tab, the observation calendar, the
   fact sheet, and the Cosmo chat. Ask Cosmo "what is NISAR" and "how big is Imja Tsho" and check the answers.
4. Write down any problem you see with the exact steps to reproduce it, and report it to the owner.

## 9. The submission

The official rules (from the Project Submission guide) ask for these fields on the project page:

- **High-level summary:** what the project is, why it matters, and how it addresses the challenge.
- **Project demo:** either a seven-slide deck or a 30-second video. The owner decides which. Check the 2026 guide for
  any updated length.
- **Final project link:** a publicly accessible link. The site folder can be hosted as described in section 10.
- **Project details:** how the project works, the tools used, and the goals.
- **Use of NASA data:** how the NISAR and Landsat data were used.
- **References:** every external resource, data source and tool, including open source libraries.

Write every number from the real run's outputs. The validation report tells you the agreement with published values.
State the limits plainly:

- The growth tiers are our own rule on five-year growth. They are not flood probabilities.
- Published areas carry about 10% error.
- The 3D terrain is generated for illustration, and lake spacing is not real.
- Radar covers one season so far, since calibrated public NISAR data starts in June 2026.
- The project does not forecast outbursts, flood timing or evacuation.

Declare AI assistance honestly. The owner will decide the wording, but the project was built with substantial AI coding
assistance, and the team directed and checked every figure. Do not remove that disclosure.

Name the teammate-free status honestly too: the project was built by one participant with AI coding assistance.

## 10. Publishing (only when the owner says so)

Do not publish until the owner explicitly says to, after the real run and the rules check are done. When the owner
says go:

1. The owner creates a public repository on their GitHub account. You must not sign in as the owner.
2. Commit the project folder, but not `dist/` or `logs/` (both are in `.gitignore`), and not any credential. Run the
   secret scan first: `python scripts/deploy_to_github.py --check-only`.
3. Push to the `main` branch. The included workflow `.github/workflows/pages.yml` then deploys the `site/` folder to
   GitHub Pages. In the repository settings, the owner selects "GitHub Actions" as the Pages source once.
4. The live site link is then the Pages address, which the owner adds to the submission as the final project link.

Use the owner's own GitHub login only when the owner types it. Never store a GitHub token in a file.

## 11. The NASA and partner resources (open in this order)

These are official resources listed on the challenge page. Use them to check every technical choice:

1. **NASA Earthdata Search**: discover and compare NASA's Earth science data.
2. **ASF Data Search Vertex**: search the NASA SAR archive. Use it to confirm the NISAR scenes over each lake.
3. **NISAR Data User Guide (ASF)**: the file layout, product names and access rules. Use it to check the reader.
4. **Intro to Remote Sensing** and **Intro to Synthetic Aperture Radar (SAR)**: background for the write-up. Cite them
   if you use their explanations.
5. **NASA ARSET trainings**: short courses on SAR and NISAR, in English and Spanish.
6. **NISAR StoryMaps**: examples of SAR applications for floods, wildfires, subsidence and glacial motion. Good for
   comparison and for the video's storytelling.
7. **NISAR Applications White Papers**: two-page overviews of societal applications.
8. **UAVSAR Postcards**: false-colour radar composites, useful as visual references.
9. **Partner resources (CSA, CONAE)**: Radarsat and SAOCOM. Only relevant if the owner adds a second radar source later.
   Do not add them without the owner's decision.

Also check the official submission guide and the local event page for any rule that changes, and report it.

## 12. Cosmo, the assistant

Cosmo answers questions on the site. Its knowledge is generated from the project's own data by
`scripts/build_chat_knowledge.py`. After any change to the lake data or the references, run that script, then the
tests. The offline brain is tested by `tests/js/brain.test.js` and `tests/js/brain-write.test.js`. The optional AI
modes are off unless the owner turns them on, and they need keys that stay on the owner's side. Do not set up the
AI proxy (`worker/`) unless the owner asks.

## 13. Things you must not do

- Do not print, store, commit or screenshot any token or password.
- Do not change the data honesty rules: no synthetic numbers on the site, no invented figures, no flood forecasts.
- Do not remove the AI disclosure from the submission.
- Do not publish, push or make the repository public without the owner's explicit instruction.
- Do not sign in to any account as the owner. The owner types their own credentials.
- Do not delete logs, QC files or processed results.
- Do not add the NASA logo or other trademarked images to the site or the submission. Use the team's own patch.
- Do not make video content with recognisable people under 18.

## 14. Final check before the owner reviews

- The pipeline reports every step as passed.
- The site label reads "Landsat and NISAR pipeline".
- The tests pass.
- The secret scan is clean.
- The submission text uses only real numbers and states the limits.
- The logs and the QC files are saved in the project.
- A short list of anything that failed, and what you changed, is ready for the owner.

Report back in plain language: what ran, what failed, what you changed, and what the owner must decide next.
