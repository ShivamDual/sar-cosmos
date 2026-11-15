"""
Generates a PLACEHOLDER lake_timeseries.csv so the Streamlit app is fully
demoable before your Google Earth Engine / NASA Earthdata access is approved.

This is not fabricated-to-deceive data: it's staged UI data, a completely
standard thing to build against while a real pipeline is mid-flight. It is
shaped around the real, cited growth figures already in lake_metadata.json
(e.g. Imja Tsho's ~42% growth 2006-2016) so the demo *looks* right, but the
exact per-date numbers are synthetic.

DO NOT submit this as your NASA Space Apps data. Before submission, run
pipeline/gee_optical.py and pipeline/nisar_sar.py for real and let them
overwrite data/processed/lake_timeseries.csv -- both scripts already replace
only their own `source` rows, so re-running them is always safe.

Usage:
    python scripts/generate_demo_data.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
LAKE_METADATA_PATH = REPO_ROOT / "data" / "lake_metadata.json"
OUTPUT_CSV = REPO_ROOT / "data" / "processed" / "lake_timeseries.csv"

# Rough current-day (2026) surface areas in km^2, anchoring the synthetic
# curve -- ballpark figures consistent with published ICIMOD/Wikipedia
# numbers for each lake (Imja ~1.28 km2 in 2016, Lower Barun 2.7km x 0.6km,
# Thulagi 0.94 km2 in 2009, etc.), projected forward. Replace with real
# pipeline output; do not cite these specific numbers anywhere public.
CURRENT_AREA_KM2 = {
    "imja_tsho": 1.36,
    "tsho_rolpa": 1.68,
    "thulagi": 1.14,
    "lower_barun": 1.22,
    "lumding": 0.52,
    "hongu": 0.46,
}

RNG_SEED = 42


def load_lakes() -> list[dict]:
    with open(LAKE_METADATA_PATH) as f:
        return json.load(f)["lakes"]


def compound_backward(current_area: float, annual_growth: float, from_date: pd.Timestamp, to_date: pd.Timestamp) -> float:
    years = (from_date - to_date).days / 365.25
    return current_area / ((1 + annual_growth) ** years)


def monsoon_cloud_pct(date: pd.Timestamp, rng: np.random.Generator) -> float:
    """Nepal's monsoon (roughly June-September) means heavy optical cloud
    cover; give those months a much higher simulated cloud percentage so the
    optical series realistically thins out there -- which is exactly the gap
    the SAR series is built to fill."""
    if date.month in (6, 7, 8, 9):
        return float(np.clip(rng.normal(55, 20), 5, 95))
    return float(np.clip(rng.normal(12, 10), 0, 60))


def generate_optical_series(lake: dict, rng: np.random.Generator) -> pd.DataFrame:
    current_area = CURRENT_AREA_KM2[lake["id"]]
    annual_growth = lake["growth_rate_5yr_pct"] / 100 / 5  # 5yr figure -> annualized
    now = pd.Timestamp("2026-09-20")
    start = pd.Timestamp("2000-06-01")

    rows = []
    # Landsat era: 2000-06 through 2015-06, ~quarterly candidate passes
    for date in pd.date_range(start, pd.Timestamp("2015-06-23"), freq="45D"):
        cloud = monsoon_cloud_pct(date, rng)
        if cloud > 20:  # spec's CLOUD_FILTER_PCT -- scene gets dropped, same as real GEE query
            continue
        area = compound_backward(current_area, annual_growth, now, date)
        area *= 1 + rng.normal(0, 0.01)  # small measurement noise
        rows.append({"lake_name": lake["name"], "date": date.strftime("%Y-%m-%d"),
                      "area_km2": round(area, 4), "source": "optical", "cloud_pct": round(cloud, 1)})

    # Sentinel-2 era: 2015-06 onward, ~monthly candidate passes
    for date in pd.date_range(pd.Timestamp("2015-06-23"), now, freq="16D"):
        cloud = monsoon_cloud_pct(date, rng)
        if cloud > 20:
            continue
        area = compound_backward(current_area, annual_growth, now, date)
        area *= 1 + rng.normal(0, 0.008)
        rows.append({"lake_name": lake["name"], "date": date.strftime("%Y-%m-%d"),
                      "area_km2": round(area, 4), "source": "optical", "cloud_pct": round(cloud, 1)})

    return pd.DataFrame(rows)


def generate_sar_series(lake: dict, rng: np.random.Generator) -> pd.DataFrame:
    """NISAR public data availability starts ~July 2026 -- short window, but
    zero gaps through the monsoon, which is the entire point."""
    current_area = CURRENT_AREA_KM2[lake["id"]]
    annual_growth = lake["growth_rate_5yr_pct"] / 100 / 5
    now = pd.Timestamp("2026-09-20")
    rows = []
    for date in pd.date_range(pd.Timestamp("2026-07-01"), now, freq="12D"):
        area = compound_backward(current_area, annual_growth, now, date)
        area *= 1 + rng.normal(0, 0.015)  # SAR speckle noise is a bit higher than optical
        rows.append({"lake_name": lake["name"], "date": date.strftime("%Y-%m-%d"),
                      "area_km2": round(area, 4), "source": "SAR", "cloud_pct": 0.0})
    return pd.DataFrame(rows)


def main() -> None:
    rng = np.random.default_rng(RNG_SEED)
    lakes = load_lakes()
    frames = []
    for lake in lakes:
        frames.append(generate_optical_series(lake, rng))
        frames.append(generate_sar_series(lake, rng))

    combined = pd.concat(frames, ignore_index=True)
    combined = combined.sort_values(["lake_name", "date"]).reset_index(drop=True)
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(OUTPUT_CSV, index=False)
    print(f"[generate_demo_data] Wrote {len(combined)} PLACEHOLDER rows -> {OUTPUT_CSV}")
    print("[generate_demo_data] Replace with real pipeline output before submitting.")


if __name__ == "__main__":
    main()
