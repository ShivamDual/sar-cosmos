"""
ONE command to produce the REAL results on your laptop, in the right order, stopping at the first problem.

Run from the project folder (the one with pipeline/ and scripts/):

    python scripts/run_real_pipeline.py --project YOUR-GCP-PROJECT-ID

It checks your setup first (no secrets are printed), then:
  1. verify the lake coordinates against real water (Landsat)
  2. Landsat test on one lake, then all lakes
  3. NISAR radar test on one lake, then all lakes
  4. validation against published numbers
  5. rebuild the website data (the site switches to your results automatically)

Every step writes its log to logs/. If a step fails, the message says what to do, and you send the developer the
last 20 lines of that log file. No AI tool is needed for any of this.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "logs"
PY = sys.executable


def say(msg: str) -> None:
    print(msg, flush=True)


def preflight(project: str | None) -> list[str]:
    problems = []
    for mod, pipname in [("ee", "earthengine-api"), ("earthaccess", "earthaccess"), ("h5py", "h5py"),
                         ("scipy", "scipy"), ("pyproj", "pyproj"), ("pandas", "pandas"), ("numpy", "numpy"), ("asf_search", "asf_search")]:
        try:
            importlib.import_module(mod)
        except Exception:
            problems.append(f"Missing Python package '{pipname}'. Fix: pip install -U -r requirements.txt")
    has_token = bool(os.environ.get("EARTHDATA_TOKEN"))
    has_login = bool(os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD"))
    if not (has_token or has_login):
        problems.append("NASA Earthdata not set. In PowerShell, set EARTHDATA_TOKEN (or EARTHDATA_USERNAME and EARTHDATA_PASSWORD) for this window only. Never paste it into a file or chat.")
    if not project:
        problems.append("Give your Google Cloud project id: --project YOUR-ID (the id, not a secret).")
    return problems


def step(title: str, args: list[str], log_name: str) -> None:
    LOGS.mkdir(exist_ok=True)
    log = LOGS / f"{log_name}.log"
    say(f"\n== {title}")
    say(f"   command: {' '.join(args)}")
    stamp = dt.datetime.now().isoformat(timespec="seconds")
    with open(log, "w", encoding="utf-8") as f:
        f.write(f"# {stamp}\n# {' '.join(args)}\n\n")
        p = subprocess.run(args, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT, text=True)
    tail = log.read_text(encoding="utf-8", errors="replace").splitlines()[-6:]
    for line in tail:
        say("   | " + line)
    if p.returncode != 0:
        say(f"\nSTOPPED at: {title}.")
        say(f"Send the developer the file: {log}  (or its last 20 lines).")
        sys.exit(p.returncode)
    say(f"   ok ({title})")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", help="your Google Cloud project id for Earth Engine")
    ap.add_argument("--skip-landsat", action="store_true")
    ap.add_argument("--skip-nisar", action="store_true")
    a = ap.parse_args()

    say("== Preflight")
    problems = preflight(a.project)
    if problems:
        for p in problems:
            say("  - " + p)
        say("\nFix the items above, then run this again.")
        sys.exit(2)
    say("   packages, NASA login and project id: ok")

    lp = ["--project", a.project]
    if not a.skip_landsat:
        step("Check lake coordinates against real water", [PY, "pipeline/gee_landsat.py", *lp, "--verify-positions"], "1_verify_positions")
        step("Landsat test, one lake (Imja, 2013-2015)", [PY, "pipeline/gee_landsat.py", *lp, "--lake", "Imja", "--years", "2013-2015"], "2_landsat_test")
        step("Landsat, all lakes, write results", [PY, "pipeline/gee_landsat.py", *lp, "--write"], "3_landsat_full")
    if not a.skip_nisar:
        step("NISAR radar test, one lake (2 scenes)", [PY, "pipeline/nisar_water.py", "--lake", "Imja", "--limit", "2"], "4_nisar_test")
        step("NISAR radar, all lakes, write results and images", [PY, "pipeline/nisar_water.py", "--write"], "5_nisar_full")
    step("Validate against published numbers", [PY, "pipeline/validate_published.py"], "6_validate")
    step("Rebuild the website data", [PY, "scripts/export_static_data.py"], "7_export")
    step("Rebuild the single-file site", [PY, "scripts/build_single_file.py"], "8_build")
    say("\nDONE. Open dist/sar-cosmos-single.html. The lake panel should now say 'Landsat and NISAR pipeline'.")


if __name__ == "__main__":
    main()
