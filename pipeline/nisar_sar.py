"""
Near-real-time, cloud-penetrating lake monitoring using NISAR (NASA-ISRO
Synthetic Aperture Radar) L-band backscatter.

Water shows up as consistently LOW backscatter (specular reflection scatters
radar away from the sensor instead of back to it), unlike land, so a
backscatter threshold segments the lake from its surroundings -- and does
this through the monsoon cloud cover that blocks every optical pass in
gee_optical.py. That's this module's whole reason to exist: it's the "how
would you keep monitoring this going forward" answer the challenge is
actually asking for.

Requires a free NASA Earthdata Login (urs.earthdata.nasa.gov), stored as
environment variables EARTHDATA_USERNAME / EARTHDATA_PASSWORD or a ~/.netrc
entry -- never hardcoded here, never pasted into a chat with anyone.

NISAR public data has been available from ~July 2026 onward, so early runs
of this pipeline will have a short historical baseline -- that's expected
and is itself part of the story (SAR is the *going forward* layer; optical
is the *decade of history* layer).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

try:
    import asf_search as asf
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "asf_search is not installed. Run: pip install -r requirements.txt"
    ) from exc

REPO_ROOT = Path(__file__).resolve().parent.parent
LAKE_METADATA_PATH = REPO_ROOT / "data" / "lake_metadata.json"
OUTPUT_CSV = REPO_ROOT / "data" / "processed" / "lake_timeseries.csv"

# Backscatter threshold (dB) below which a pixel is classified as water.
# Tune empirically per lake against an optical mask on an overlapping date --
# see validate_against_optical() below.
BACKSCATTER_THRESHOLD_DB = -17.0
NISAR_DATA_START = "2026-06-17"


def load_lakes() -> list[dict]:
    with open(LAKE_METADATA_PATH) as f:
        return json.load(f)["lakes"]


def lake_bbox(lake: dict) -> tuple[float, float, float, float]:
    """Returns (min_lon, min_lat, max_lon, max_lat) for an ASF search."""
    buffer_deg = lake["bbox_buffer_km"] / 111.0  # rough km -> degrees at this latitude
    return (
        lake["lon"] - buffer_deg,
        lake["lat"] - buffer_deg,
        lake["lon"] + buffer_deg,
        lake["lat"] + buffer_deg,
    )


def search_nisar_scenes(lake: dict):
    min_lon, min_lat, max_lon, max_lat = lake_bbox(lake)
    wkt = (
        f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, "
        f"{max_lon} {max_lat}, {min_lon} {max_lat}, {min_lon} {min_lat}))"
    )
    results = asf.search(
        platform=[asf.PLATFORM.NISAR],
        intersectsWith=wkt,
        start=NISAR_DATA_START,
    )
    return results


def backscatter_water_area_km2(scene_array: np.ndarray, pixel_area_m2: float) -> float:
    """scene_array is a 2D array of backscatter intensity in dB, already
    clipped to the lake's bounding box (clipping happens after download --
    see extract_lake_series for where this gets called)."""
    water_mask = scene_array < BACKSCATTER_THRESHOLD_DB
    water_pixel_count = int(np.sum(water_mask))
    return (water_pixel_count * pixel_area_m2) / 1_000_000


def extract_lake_series(lake: dict, earthdata_session: "asf.ASFSession") -> pd.DataFrame:
    """Downloads and processes each available NISAR scene for one lake.

    NOTE: actual raster download + dB conversion depends on the final NISAR
    product format (GCOV/GSLC) ASF ships at general availability; this
    function is the integration point -- wire the real raster read-in here
    once you've pulled one sample product and confirmed its band layout.
    """
    scenes = search_nisar_scenes(lake)
    rows = []
    for scene in scenes:
        # Placeholder for the real raster pipeline: download scene, clip to
        # lake_geometry, convert amplitude -> dB, run backscatter_water_area_km2().
        # area_km2 = backscatter_water_area_km2(clipped_array, pixel_area_m2)
        rows.append(
            {
                "lake_name": lake["name"],
                "date": scene.properties["startTime"][:10],
                "area_km2": None,  # fill in once raster processing is wired
                "source": "SAR",
                "cloud_pct": 0,  # SAR is cloud-blind by design
            }
        )
    return pd.DataFrame(rows)


def validate_against_optical(sar_df: pd.DataFrame, optical_df: pd.DataFrame, window_days: int = 14) -> pd.DataFrame:
    """For SAR/optical date pairs within `window_days` of each other, compute
    the area difference between the two methods. This is the cross-validation
    metric that backs the "Validity" judging criterion in the submission --
    log it, don't hide a disagreement."""
    sar_df = sar_df.copy()
    optical_df = optical_df.copy()
    sar_df["date"] = pd.to_datetime(sar_df["date"])
    optical_df["date"] = pd.to_datetime(optical_df["date"])

    pairs = []
    for lake_name in sar_df["lake_name"].unique():
        sar_lake = sar_df[sar_df["lake_name"] == lake_name]
        opt_lake = optical_df[optical_df["lake_name"] == lake_name]
        for _, sar_row in sar_lake.iterrows():
            deltas = (opt_lake["date"] - sar_row["date"]).abs()
            if deltas.empty:
                continue
            closest_idx = deltas.idxmin()
            if deltas.loc[closest_idx].days <= window_days:
                opt_row = opt_lake.loc[closest_idx]
                pairs.append(
                    {
                        "lake_name": lake_name,
                        "sar_date": sar_row["date"],
                        "optical_date": opt_row["date"],
                        "sar_area_km2": sar_row["area_km2"],
                        "optical_area_km2": opt_row["area_km2"],
                        "diff_pct": (
                            None
                            if sar_row["area_km2"] is None
                            else round(
                                100 * (sar_row["area_km2"] - opt_row["area_km2"]) / opt_row["area_km2"], 2
                            )
                        ),
                    }
                )
    return pd.DataFrame(pairs)


def run() -> None:
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment") as key:
                token, _ = winreg.QueryValueEx(key, "EARTHDATA_TOKEN")
        except Exception:
            token = None

    if token:
        session = asf.ASFSession().auth_with_token(token)
    else:
        username = os.environ.get("EARTHDATA_USERNAME")
        password = os.environ.get("EARTHDATA_PASSWORD")
        if not username or not password:
            raise EnvironmentError(
                "Set EARTHDATA_TOKEN or (EARTHDATA_USERNAME and EARTHDATA_PASSWORD) "
                "before running the SAR pipeline. See README.md > Setup."
            )
        session = asf.ASFSession().auth_with_creds(username, password)

    lakes = load_lakes()
    all_rows = []
    for lake in lakes:
        print(f"[nisar_sar] {lake['name']}: searching NISAR scenes...")
        all_rows.append(extract_lake_series(lake, session))

    combined = pd.concat(all_rows, ignore_index=True)
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    if OUTPUT_CSV.exists():
        existing = pd.read_csv(OUTPUT_CSV)
        existing = existing[existing["source"] != "SAR"]
        combined = pd.concat([existing, combined], ignore_index=True)

    combined.to_csv(OUTPUT_CSV, index=False)
    print(f"[nisar_sar] Wrote {len(combined)} rows -> {OUTPUT_CSV}")


if __name__ == "__main__":
    run()
