"""
Optical lake-area extraction using NDWI (Normalized Difference Water Index).

For each lake in data/lake_metadata.json, this pulls Sentinel-2 (2015+) and
falls back to Landsat 8/9 for older dates, thresholds NDWI to isolate water
pixels, and writes a time series of surface area (km^2) to
data/processed/lake_timeseries.csv with source="optical".

Requires: `earthengine authenticate` already run once on this machine, and a
registered (noncommercial) Google Cloud project. See README.md > Setup.

This module makes real calls to Earth Engine and will not run inside a
sandboxed environment with no network access to earthengine.googleapis.com --
run it locally or in CI once your GEE access is approved.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

try:
    import ee
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "earthengine-api is not installed. Run: pip install -r requirements.txt"
    ) from exc

REPO_ROOT = Path(__file__).resolve().parent.parent
LAKE_METADATA_PATH = REPO_ROOT / "data" / "lake_metadata.json"
OUTPUT_CSV = REPO_ROOT / "data" / "processed" / "lake_timeseries.csv"

# NDWI threshold above which a pixel is classified as water. Start at 0.2 per
# the build spec; raise it for lakes showing false positives from snow/cloud
# shadow (check against a visual GEE inspector export before trusting a lake's
# numbers blindly).
NDWI_THRESHOLD = 0.2
CLOUD_FILTER_PCT = 20

SENTINEL2_COLLECTION = "COPERNICUS/S2_SR_HARMONIZED"
LANDSAT7_COLLECTION = "LANDSAT/LE07/C02/T1_L2"
LANDSAT8_COLLECTION = "LANDSAT/LC08/C02/T1_L2"


def init_earth_engine(project: str | None = "sar-cosmos") -> None:
    """Initialize the EE session. `project` is your GCP project ID (required
    for the noncommercial/Academic tier as of the current EE API)."""
    try:
        ee.Initialize(project=project)
    except Exception:
        ee.Authenticate()
        ee.Initialize(project=project)


def load_lakes() -> list[dict]:
    with open(LAKE_METADATA_PATH) as f:
        return json.load(f)["lakes"]


def lake_geometry(lake: dict) -> "ee.Geometry":
    buffer_m = lake["bbox_buffer_km"] * 1000
    point = ee.Geometry.Point([lake["lon"], lake["lat"]])
    return point.buffer(buffer_m).bounds()


def _ndwi_sentinel2(image: "ee.Image") -> "ee.Image":
    return image.normalizedDifference(["B3", "B8"]).rename("NDWI")


def _ndwi_landsat7(image: "ee.Image") -> "ee.Image":
    optical = image.select("SR_B.*").multiply(0.0000275).add(-0.2)
    return optical.normalizedDifference(["SR_B2", "SR_B4"]).rename("NDWI")


def _ndwi_landsat8(image: "ee.Image") -> "ee.Image":
    # Landsat Collection 2 SR bands are scaled; apply the standard scale factor
    # before differencing so the NDWI threshold stays comparable to Sentinel-2.
    optical = image.select("SR_B.*").multiply(0.0000275).add(-0.2)
    return optical.normalizedDifference(["SR_B3", "SR_B5"]).rename("NDWI")


def water_area_km2(image: "ee.Image", ndwi_fn, geometry: "ee.Geometry", scale_m: float) -> float:
    ndwi = ndwi_fn(image)
    water_mask = ndwi.gt(NDWI_THRESHOLD)
    pixel_area = ee.Image.pixelArea()
    water_area = water_mask.multiply(pixel_area).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=geometry, scale=scale_m, maxPixels=1e9
    )
    area_m2 = water_area.get("NDWI")
    return ee.Number(area_m2).divide(1_000_000)  # m^2 -> km^2


def extract_sentinel2_series(lake: dict) -> pd.DataFrame:
    geometry = lake_geometry(lake)
    collection = (
        ee.ImageCollection(SENTINEL2_COLLECTION)
        .filterBounds(geometry)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", CLOUD_FILTER_PCT))
    )

    def per_image(image):
        area = water_area_km2(image, _ndwi_sentinel2, geometry, scale_m=10)
        return ee.Feature(
            None,
            {
                "date": image.date().format("YYYY-MM-dd"),
                "area_km2": area,
                "cloud_pct": image.get("CLOUDY_PIXEL_PERCENTAGE"),
            },
        )

    features = collection.map(per_image).getInfo()["features"]
    rows = [f["properties"] for f in features]
    df = pd.DataFrame(rows)
    df["lake_name"] = lake["name"]
    df["source"] = "optical"
    return df


def extract_landsat_series(lake: dict) -> pd.DataFrame:
    """Fills in years before Sentinel-2's 2015 launch using Landsat 7 (2000-2013) and Landsat 8 (2013-2015)."""
    geometry = lake_geometry(lake)
    dfs = []

    # Landsat 7: 2000 through early 2013
    col_l7 = (
        ee.ImageCollection(LANDSAT7_COLLECTION)
        .filterBounds(geometry)
        .filter(ee.Filter.lt("CLOUD_COVER", CLOUD_FILTER_PCT))
        .filterDate("2000-01-01", "2013-04-11")
    )
    def per_image_l7(image):
        area = water_area_km2(image, _ndwi_landsat7, geometry, scale_m=30)
        return ee.Feature(
            None,
            {
                "date": image.date().format("YYYY-MM-dd"),
                "area_km2": area,
                "cloud_pct": image.get("CLOUD_COVER"),
            },
        )
    try:
        features_l7 = col_l7.map(per_image_l7).getInfo()["features"]
        if features_l7:
            df_l7 = pd.DataFrame([f["properties"] for f in features_l7])
            dfs.append(df_l7)
    except Exception as e:
        print(f"Warning fetching Landsat 7 for {lake['name']}: {e}")

    # Landsat 8: April 2013 to Sentinel-2 launch in June 2015
    col_l8 = (
        ee.ImageCollection(LANDSAT8_COLLECTION)
        .filterBounds(geometry)
        .filter(ee.Filter.lt("CLOUD_COVER", CLOUD_FILTER_PCT))
        .filterDate("2013-04-11", "2015-06-23")
    )
    def per_image_l8(image):
        area = water_area_km2(image, _ndwi_landsat8, geometry, scale_m=30)
        return ee.Feature(
            None,
            {
                "date": image.date().format("YYYY-MM-dd"),
                "area_km2": area,
                "cloud_pct": image.get("CLOUD_COVER"),
            },
        )
    try:
        features_l8 = col_l8.map(per_image_l8).getInfo()["features"]
        if features_l8:
            df_l8 = pd.DataFrame([f["properties"] for f in features_l8])
            dfs.append(df_l8)
    except Exception as e:
        print(f"Warning fetching Landsat 8 for {lake['name']}: {e}")

    if not dfs:
        return pd.DataFrame(columns=["lake_name", "date", "area_km2", "source", "cloud_pct"])

    df = pd.concat(dfs, ignore_index=True)
    df["lake_name"] = lake["name"]
    df["source"] = "optical"
    return df


def run(project: str | None = None) -> None:
    init_earth_engine(project=project)
    lakes = load_lakes()
    all_rows = []
    for lake in lakes:
        print(f"[gee_optical] {lake['name']}: Sentinel-2...")
        all_rows.append(extract_sentinel2_series(lake))
        print(f"[gee_optical] {lake['name']}: Landsat backfill...")
        all_rows.append(extract_landsat_series(lake))

    combined = pd.concat(all_rows, ignore_index=True)
    combined = combined.sort_values(["lake_name", "date"])
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    if OUTPUT_CSV.exists():
        existing = pd.read_csv(OUTPUT_CSV)
        existing = existing[existing["source"] != "optical"]  # replace prior optical rows
        combined = pd.concat([existing, combined], ignore_index=True)

    combined.to_csv(OUTPUT_CSV, index=False)
    print(f"[gee_optical] Wrote {len(combined)} rows -> {OUTPUT_CSV}")


if __name__ == "__main__":
    import sys

    gcp_project = sys.argv[1] if len(sys.argv) > 1 else None
    run(project=gcp_project)
