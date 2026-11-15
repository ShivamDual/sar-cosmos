# Run the real results on your laptop (about 1 to 2 hours, mostly waiting)

You do not need any AI tool for this. Use Windows PowerShell.

## 1. Open PowerShell in the project folder
Right-click the `sar-cosmos` folder, choose "Open in Terminal" (or open PowerShell and `cd` into it).

## 2. Install the packages (once)
    python -m pip install -U -r requirements.txt

## 3. Earth Engine login (once)
    earthengine authenticate
A browser opens. Sign in with the Google account that has your Earth Engine access.

## 4. NASA login for this window only
Use your Earthdata token. It is typed here, into the window, and never saved in a file:
    $env:EARTHDATA_TOKEN = "paste-your-token-here"
(If you use a username and password instead: `$env:EARTHDATA_USERNAME="..."` and `$env:EARTHDATA_PASSWORD="..."`.)

## 5. Run everything, in order
    python scripts/run_real_pipeline.py --project YOUR-GCP-PROJECT-ID

It prints each step. If a step stops, it names a log file in the `logs` folder. Send that file to the developer.
The steps run in this order: check coordinates, Landsat test, Landsat full, NISAR test, NISAR full, validation,
rebuild data, rebuild the single-file site.

## 6. Look at the result
Open `dist/sar-cosmos-single.html`. The badge in the lake panel should read "Landsat and NISAR pipeline".
Check `data/processed/nisar_scene_log.csv`: scenes marked "seed_on_land" or "outlier" were left out on purpose.

## If something goes wrong
- "Missing Python package": run step 2 again.
- "NASA Earthdata not set": run step 4 in the same window.
- Earth Engine errors mentioning the project: check the project id spelling, and that the project has Earth Engine enabled.
- Anything else: send the developer the last 20 lines of the log named in the message.
