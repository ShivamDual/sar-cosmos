"""
Optical lake areas, 2000 to now, from Landsat 5/7/8/9 via Google Earth Engine.

Why this exists: the first gee_optical.py asked for pre-2015 history from
Landsat 8, which only launched in 2013, so the decade of history would have come
back almost empty. This file uses the right satellite for each period:

    Landsat 5  2000-2011     Landsat 7  2000-now (stripes after 2003)
    Landsat 8  2013-now      Landsat 9  2022-now

How it measures (the same idea as the published reference paper):
  * one clear post-monsoon image per year (Sep 15 - Dec 15), because the monsoon is cloud
  * NDWI = (green - NIR) / (green + NIR) in a small window around the lake
  * the water threshold is chosen PER IMAGE (Otsu), not a fixed number, since glacial-lake
    water is milky and a fixed 0.2 fails
  * only the water blob that contains the lake's coordinates counts (shadows are not lakes)
For the current year it keeps the clearest few images from Jun 1 onward, to sit next to NISAR dates.

Run in stages:
    python pipeline/gee_landsat.py --project sar-cosmos --verify-positions
        prints candidate lake blobs near each coordinate. Use it to fix Lumding / Hongu.
    python pipeline/gee_landsat.py --project sar-cosmos --lake Imja --years 2013-2015
        small test, writes only the QC log
    python pipeline/gee_landsat.py --project sar-cosmos --write
        everything, replaces the optical rows in data/processed/lake_timeseries.csv

NOT tested against live Earth Engine (no access from where it was written). The
segmentation maths ARE tested on synthetic images. If an Earth Engine call errors,
send the developer the exact message.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
LAKES_JSON = ROOT / "data" / "lake_metadata.json"
TIMESERIES_CSV = ROOT / "data" / "processed" / "lake_timeseries.csv"
LOG_CSV = ROOT / "data" / "processed" / "optical_scene_log.csv"
REFERENCE_CSV = ROOT / "data" / "reference" / "published_lake_areas.csv"

# collection id, green band, NIR band
SENSORS = {
    "LT05": ("LANDSAT/LT05/C02/T1_L2", "SR_B2", "SR_B4"),
    "LE07": ("LANDSAT/LE07/C02/T1_L2", "SR_B2", "SR_B4"),
    "LC08": ("LANDSAT/LC08/C02/T1_L2", "SR_B3", "SR_B5"),
    "LC09": ("LANDSAT/LC09/C02/T1_L2", "SR_B3", "SR_B5"),
}
PX = 30.0                    # Landsat pixel size (m)
MIN_VALID_FRAC = 0.85        # window must be at least this free of cloud / stripes
MIN_CONTRAST = 0.20          # mean NDWI of water minus land, below this there is no clear lake


# ----------------------------------------------------------- pure maths ----

def otsu(values: np.ndarray, lo: float, hi: float, bins: int = 85):
    v = values[np.isfinite(values)]
    if v.size < 200:
        return float("nan"), float("nan"), float("nan")
    hist, edges = np.histogram(v, bins=bins, range=(lo, hi))
    c = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(hist.astype(float)); w1 = w0[-1] - w0
    m = np.cumsum(hist * c)
    with np.errstate(invalid="ignore", divide="ignore"):
        mu0 = m / w0; mu1 = (m[-1] - m) / w1
        between = w0 * w1 * (mu0 - mu1) ** 2
    k = int(np.nanargmax(between))
    return float(c[k]), float(mu0[k]), float(mu1[k])   # threshold, mean of low side, mean of high side


def water_blobs(ndwi: np.ndarray):
    """Threshold NDWI and return (labels, n_blobs, threshold, contrast) or None if no clear water."""
    thr, mu_land, mu_water = otsu(ndwi, -0.8, 0.9)
    if not np.isfinite(thr) or (mu_water - mu_land) < MIN_CONTRAST:
        return None
    water = np.isfinite(ndwi) & (ndwi > thr)
    water = ndi.binary_fill_holes(water)          # floating ice or a stray cloud pixel is still lake
    labels, n = ndi.label(water)
    return labels, n, float(thr), float(mu_water - mu_land)


def segment_ndwi(ndwi: np.ndarray, seed_rc: tuple[int, int], max_seed_dist_px: float) -> dict:
    out = {"area_km2": np.nan, "threshold": np.nan, "flag": "", "seed_offset_px": 0.0}
    wb = water_blobs(ndwi)
    if wb is None:
        out["flag"] = "no_clear_water"
        return out
    labels, n, thr, _ = wb
    out["threshold"] = thr
    if n == 0:
        out["flag"] = "no_water_found"
        return out
    r, c = seed_rc
    chosen = labels[r, c] if 0 <= r < labels.shape[0] and 0 <= c < labels.shape[1] else 0
    if chosen == 0:
        idx = np.arange(1, n + 1)
        cents = np.array(ndi.center_of_mass(labels > 0, labels, idx))
        sizes = ndi.sum(labels > 0, labels, idx)
        d = np.hypot(cents[:, 0] - r, cents[:, 1] - c); d[sizes < 8] = np.inf
        j = int(np.argmin(d))
        if not np.isfinite(d[j]) or d[j] > max_seed_dist_px:
            out["flag"] = "no_blob_near_lake"
            return out
        chosen = idx[j]; out["flag"] = "seed_on_land"; out["seed_offset_px"] = float(d[j])
    out["area_km2"] = float((labels == chosen).sum()) * PX * PX / 1e6
    return out


def blob_candidates(ndwi: np.ndarray, lat0: float, lon0: float, min_km2: float = 0.12) -> pd.DataFrame:
    """List water blobs in a window centred on (lat0, lon0) with centroid lat/lon. For --verify-positions."""
    wb = water_blobs(ndwi)
    if wb is None:
        return pd.DataFrame()
    labels, n, _, _ = wb
    rc, cc = (ndwi.shape[0] - 1) / 2, (ndwi.shape[1] - 1) / 2
    rows = []
    for k in range(1, n + 1):
        m = labels == k
        area = m.sum() * PX * PX / 1e6
        if area < min_km2:
            continue
        r, c = ndi.center_of_mass(m)
        dy, dx = (r - rc) * PX, (c - cc) * PX
        lat = lat0 - dy / 110540.0
        lon = lon0 + dx / (111320.0 * math.cos(math.radians(lat0)))
        rows.append({"lat": round(lat, 4), "lon": round(lon, 4), "area_km2": round(area, 3),
                     "dist_from_given_km": round(math.hypot(dx, dy) / 1000, 2)})
    return pd.DataFrame(rows).sort_values("dist_from_given_km").reset_index(drop=True) if rows else pd.DataFrame()


# ----------------------------------------------------------- Earth Engine ---

def _ee():
    import ee
    return ee


def window(ee, lake: dict, half_km: float):
    d_lat = half_km / 111.0
    d_lon = half_km / (111.0 * math.cos(math.radians(lake["lat"])))
    return ee.Geometry.Rectangle([lake["lon"] - d_lon, lake["lat"] - d_lat, lake["lon"] + d_lon, lake["lat"] + d_lat])


def ndwi_collection(ee, geom, start: str, end: str):
    """All Landsat scenes in the window, as masked NDWI images with a 'valid_frac' property."""
    def make(key, cid, g, n):
        def prep(im):
            sr = im.select([g, n]).multiply(0.0000275).add(-0.2).rename(["green", "nir"])
            bad = im.select("QA_PIXEL").bitwiseAnd(0b11110).neq(0)       # dilated cloud, cirrus, cloud, shadow
            ndwi = sr.normalizedDifference(["green", "nir"]).rename("ndwi").toFloat().updateMask(bad.Not())
            frac = ndwi.mask().reduceRegion(ee.Reducer.mean(), geom, PX).get("ndwi")
            return ndwi.set({"valid_frac": frac, "sensor": key, "date": im.date().format("YYYY-MM-dd")})
        return ee.ImageCollection(cid).filterBounds(geom).filterDate(start, end).map(prep)
    col = None
    for key, (cid, g, n) in SENSORS.items():
        c = make(key, cid, g, n)
        col = c if col is None else col.merge(c)
    return col.filter(ee.Filter.notNull(["valid_frac"])).filter(ee.Filter.gte("valid_frac", MIN_VALID_FRAC))


def best_images(ee, geom, start: str, end: str, n: int):
    """Metadata + NDWI arrays for the n clearest images in the date range."""
    col = ndwi_collection(ee, geom, start, end).sort("valid_frac", False)
    imgs = col.toList(n)
    out = []
    for i in range(int(col.size().min(n).getInfo())):
        img = ee.Image(imgs.get(i))
        meta = img.toDictionary(["valid_frac", "sensor", "date"]).getInfo()
        arr = img.toFloat().sampleRectangle(region=geom, properties=["ndwi"], defaultValue=-9999).getInfo()["properties"]["ndwi"]
        a = np.array(arr, dtype=float); a[a < -5] = np.nan
        out.append((meta, a))
    return out


def lake_years(ee, lake: dict, years: range, half_km: float, per_year_now: int = 4):
    geom = window(ee, lake, half_km)
    this_year = dt.date.today().year
    rows = []
    for y in years:
        if y == this_year:
            start, end, n = f"{y}-06-01", dt.date.today().isoformat(), per_year_now
        else:
            start, end, n = f"{y}-09-15", f"{y}-12-15", 1
        try:
            found = best_images(ee, geom, start, end, n)
        except Exception as exc:
            rows.append({"lake_name": lake["name"], "date": f"{y}-10-15", "area_km2": np.nan,
                         "flag": f"ee_error:{type(exc).__name__}:{str(exc)[:80]}"})
            continue
        if not found:
            rows.append({"lake_name": lake["name"], "date": f"{y}-10-15", "area_km2": np.nan, "flag": "no_clear_image"})
        for meta, arr in found:
            seg = segment_ndwi(arr, (arr.shape[0] // 2, arr.shape[1] // 2), max_seed_dist_px=1500 / PX)
            vf = float(meta["valid_frac"])
            if seg["flag"] == "" and vf < 0.97:
                seg["flag"] = "partial_coverage"      # stripes or cloud edge: area may be a little low
            rows.append({"lake_name": lake["name"], "date": meta["date"], "sensor": meta["sensor"],
                         "cloud_pct": round(100 * (1 - vf), 1), **seg})
        print(f"    {lake['name']:24} {y}: " + ", ".join(
            f"{r.get('area_km2', float('nan')):.3f}" for r in rows if str(r['date']).startswith(str(y))))
    return rows


# ------------------------------------------------------------------ CLI ----

def verify_positions(ee, lakes: list[dict]) -> None:
    ref = pd.read_csv(REFERENCE_CSV, parse_dates=["date"]) if REFERENCE_CSV.exists() else pd.DataFrame()
    print("For each lake: water blobs near the given coordinate. Pick the blob whose area matches the")
    print("published area (newest published value shown); copy its lat/lon into data/lake_metadata.json.\n")
    for lake in lakes:
        found = []
        for year in (2025, 2024, 2023):
            found = best_images(ee, window(ee, lake, 6.0), f"{year}-09-20", f"{year}-12-10", 1)
            if found:
                break
        print(f"== {lake['name']}  (given {lake['lat']}, {lake['lon']})")
        if not found:
            print("   no clear autumn image found for 2023-2025\n"); continue
        meta, arr = found[0]
        tab = blob_candidates(arr, lake["lat"], lake["lon"])
        if not ref.empty and (ref["lake_name"] == lake["name"]).any():
            last = ref[ref["lake_name"] == lake["name"]].sort_values("date").iloc[-1]
            print(f"   published: {last['area_km2']} km2 around {last['date'].year}   (image {meta['date']} {meta['sensor']})")
        print("   none found\n" if tab.empty else tab.to_string(index=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", required=True, help="your Google Cloud project id for Earth Engine")
    ap.add_argument("--lake", help="only lakes whose name contains this text")
    ap.add_argument("--years", default="2000-" + str(dt.date.today().year), help="e.g. 2013-2015")
    ap.add_argument("--half-window-km", type=float, default=2.2)
    ap.add_argument("--verify-positions", action="store_true")
    ap.add_argument("--write", action="store_true", help="replace optical rows in lake_timeseries.csv")
    ap.add_argument("--accept-offset-seeds", action="store_true")
    a = ap.parse_args()

    ee = _ee()
    try:
        ee.Initialize(project=a.project)
    except Exception:
        ee.Authenticate(); ee.Initialize(project=a.project)

    lakes = json.load(open(LAKES_JSON))["lakes"]
    if a.lake:
        lakes = [l for l in lakes if a.lake.lower() in l["name"].lower()] or sys.exit(f"no lake matches {a.lake!r}")
    if a.verify_positions:
        return verify_positions(ee, lakes)

    y0, y1 = (int(x) for x in a.years.split("-"))
    log = []
    for lake in lakes:
        print(f"[gee_landsat] {lake['name']}")
        log += lake_years(ee, lake, range(y0, y1 + 1), a.half_window_km)
    log = pd.DataFrame(log)
    log["flag"] = log["flag"].fillna("")
    LOG_CSV.parent.mkdir(parents=True, exist_ok=True)
    log.to_csv(LOG_CSV, index=False)
    print(f"[gee_landsat] QC log -> {LOG_CSV}")

    flags = log["flag"]
    if a.accept_offset_seeds:
        flags = flags.str.replace("seed_on_land", "", regex=False).str.strip()
    good = log[log["area_km2"].notna() & flags.isin(["", "partial_coverage"])]
    print(f"[gee_landsat] usable: {len(good)} of {len(log)}  (flags are in the log)")
    if not a.write:
        print("[gee_landsat] dry run: lake_timeseries.csv NOT changed (add --write)")
        return
    if a.lake or a.years != "2000-" + str(dt.date.today().year):
        print("WARNING: partial run. The CSV will mix real rows for these lakes/years with older rows.")
    new = pd.DataFrame({"lake_name": good["lake_name"], "date": good["date"], "area_km2": good["area_km2"].round(4),
                        "source": "optical", "cloud_pct": good.get("cloud_pct", 0)})
    old = pd.read_csv(TIMESERIES_CSV) if TIMESERIES_CSV.exists() else pd.DataFrame(columns=new.columns)
    drop = old["lake_name"].isin(new["lake_name"].unique()) & (old["source"] == "optical")
    pd.concat([old[~drop], new], ignore_index=True).sort_values(["lake_name", "date"]).to_csv(TIMESERIES_CSV, index=False)
    print(f"[gee_landsat] wrote {len(new)} optical rows -> {TIMESERIES_CSV}")


if __name__ == "__main__":
    main()
