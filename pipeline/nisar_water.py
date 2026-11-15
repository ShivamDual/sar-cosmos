"""
NISAR L-band GCOV -> lake surface area (km^2) per scene.

Why this works: calm water bounces the radar pulse away from the sensor, so a
lake shows up as a dark patch in L-band backscatter (gamma0, in dB). The catch
is that radar SHADOW behind steep slopes is dark too, and the Himalaya is full
of it. So the code only accepts the dark blob that contains (or is nearest to)
the lake's own location, never a dark blob somewhere else in the window.

What it does NOT do: download the huge GCOV files. Each file is streamed with
earthaccess + h5py and only a small window around the lake is read.

Setup (once):
    pip install -U earthaccess h5py scipy pyproj asf_search pandas numpy
    set EARTHDATA_TOKEN (or EARTHDATA_USERNAME / EARTHDATA_PASSWORD)

Run in stages, so a problem shows up early and cheaply:
    python pipeline/nisar_water.py --lake "Imja Tsho" --limit 2
        -> processes 2 scenes, prints results, writes ONLY the QC log
    python pipeline/nisar_water.py --limit 40 --write
        -> all lakes, updates data/processed/lake_timeseries.csv (SAR rows only)

Safety: if the dark blob is not at the lake's coordinates (flag 'seed_on_land') the
scene is logged but NOT written, because that is how a wrong coordinate or a
radar-shadow patch would end up as 'lake area'.

Output files:
    data/processed/nisar_scene_log.csv   one row per lake per scene, with QC flags
    data/processed/lake_timeseries.csv   SAR rows replaced when --write is used

NOTE: the HDF5 layout names below follow the NISAR GCOV product spec
(/science/LSAR/GCOV/grids/frequencyA/<HHHH|HVHV|...>, xCoordinates,
yCoordinates, projection). It was tested here on a synthetic file with that
layout, NOT on a real NISAR file. If a real file raises a KeyError, print
`list(h5["science/LSAR/GCOV/grids/frequencyA"].keys())` and send it to the developer.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
LAKES_JSON = ROOT / "data" / "lake_metadata.json"
TIMESERIES_CSV = ROOT / "data" / "processed" / "lake_timeseries.csv"
SCENE_LOG_CSV = ROOT / "data" / "processed" / "nisar_scene_log.csv"
RADAR_DIR = ROOT / "site" / "radar"      # per-scene images + manifest.js for the website viewer

DATA_START = "2026-06-17"            # first calibrated public NISAR acquisitions
GRID = "science/LSAR/GCOV/grids/frequencyA"
POL_PREFERENCE = ("HHHH", "VVVV", "HVHV", "VHVH")  # co-pol first: best water contrast
DB_LO, DB_HI = -24.0, -12.0          # allowed range for the water threshold (dB)
MIN_SEPARATION_DB = 5.0              # water vs land must differ by at least this
MAX_NODATA_FRAC = 0.30


# ---------------------------------------------------------------- pure maths --

def to_db(power: np.ndarray) -> np.ndarray:
    p = np.where(np.isfinite(power) & (power > 0), power, np.nan)
    return 10.0 * np.log10(p)


def despeckle_db(db: np.ndarray, size: int = 3) -> np.ndarray:
    """3x3 median in dB: calms speckle WITHOUT smearing the lake edge.
    (A plain linear average pulled bright land into edge pixels and shrank
    lakes by ~7% in testing; the median keeps the error under 1%.)"""
    ok = np.isfinite(db)
    filled = np.where(ok, db, -30.0)
    out = ndi.median_filter(filled, size=size, mode="nearest")
    out[~ok] = np.nan
    return out


def otsu_db(db: np.ndarray) -> tuple[float, float, float]:
    """Return (threshold, mean_dark, mean_bright) of an Otsu split of the dB values."""
    v = db[np.isfinite(db)]
    if v.size < 200:
        return float("nan"), float("nan"), float("nan")
    hist, edges = np.histogram(v, bins=80, range=(-35.0, 5.0))
    centers = (edges[:-1] + edges[1:]) / 2
    w = hist.astype(float)
    w0 = np.cumsum(w)
    w1 = w0[-1] - w0
    m = np.cumsum(w * centers)
    with np.errstate(invalid="ignore", divide="ignore"):
        mu0 = m / w0
        mu1 = (m[-1] - m) / w1
        between = w0 * w1 * (mu0 - mu1) ** 2
    k = int(np.nanargmax(between))
    return float(centers[k]), float(mu0[k]), float(mu1[k])


def segment_lake(db: np.ndarray, seed_rc: tuple[int, int], px_area_m2: float,
                 max_seed_dist_px: float) -> dict:
    """Pick the dark blob that is the lake. Returns a dict with area and QC info."""
    thr, mu_dark, mu_bright = otsu_db(db)
    out = {"area_km2": np.nan, "threshold_db": thr, "water_px": 0, "flag": "", "seed_offset_px": 0.0}
    if not np.isfinite(thr):
        out["flag"] = "too_few_valid_pixels"
        return out
    if (mu_bright - mu_dark) < MIN_SEPARATION_DB:
        out["flag"] = "low_contrast"  # no clear water/land split (wind, ice, or no lake in window)
        return out
    thr = float(np.clip(thr, DB_LO, DB_HI))
    out["threshold_db"] = thr

    water = np.isfinite(db) & (db < thr)
    water = ndi.binary_opening(water, structure=np.ones((3, 3)))   # drop speckle specks
    water = ndi.binary_closing(water, structure=np.ones((3, 3)))
    labels, n = ndi.label(water)
    if n == 0:
        out["flag"] = "no_water_found"
        return out

    r, c = seed_rc
    chosen = labels[r, c] if 0 <= r < labels.shape[0] and 0 <= c < labels.shape[1] else 0
    if chosen == 0:  # seed landed on land (coordinates are approximate): nearest blob
        idx = np.arange(1, n + 1)
        cents = np.array(ndi.center_of_mass(water, labels, idx))
        areas = ndi.sum(water, labels, idx)
        d = np.hypot(cents[:, 0] - r, cents[:, 1] - c)
        d[areas < 30] = np.inf  # ignore tiny blobs
        j = int(np.argmin(d))
        if not np.isfinite(d[j]) or d[j] > max_seed_dist_px:
            out["flag"] = "no_blob_near_lake"
            return out
        chosen = idx[j]
        out["flag"] = "seed_on_land"
        out["seed_offset_px"] = float(d[j])
    blob = labels == chosen
    px = int(blob.sum())
    out["_mask"] = blob
    out["water_px"] = px
    out["area_km2"] = px * px_area_m2 / 1e6
    return out


# ------------------------------------------------------------- HDF5 reading --

def _epsg(grp) -> int:
    """Read the grid's EPSG code from the 'projection' dataset, defensively."""
    from pyproj import CRS
    proj = grp["projection"]
    for key in ("epsg_code", "epsg", "EPSG"):
        if key in proj.attrs:
            return int(np.asarray(proj.attrs[key]).ravel()[0])
    try:
        val = int(np.asarray(proj[()]).ravel()[0])
        if val > 1000:
            return val
    except Exception:
        pass
    for key in ("spatial_ref", "crs_wkt", "projection_wkt"):
        if key in proj.attrs:
            raw = proj.attrs[key]
            raw = raw.decode() if isinstance(raw, bytes) else str(raw)
            code = CRS.from_wkt(raw).to_epsg()
            if code:
                return int(code)
    raise KeyError("could not find an EPSG code in 'projection'")


def read_lake_window(h5, lake: dict, half_km: float):
    """Return (power_window, px_area_m2, seed_rc, pol) or (None, reason)."""
    from pyproj import Transformer
    grp = h5[GRID]
    pol = next((p for p in POL_PREFERENCE if p in grp), None)
    if pol is None:
        return None, f"no_usable_polarisation (have: {list(grp.keys())[:8]})"
    x = np.asarray(grp["xCoordinates"][:], dtype=float)
    y = np.asarray(grp["yCoordinates"][:], dtype=float)
    epsg = _epsg(grp)
    tf = Transformer.from_crs(4326, epsg, always_xy=True)
    cx, cy = tf.transform(lake["lon"], lake["lat"])
    dx, dy = abs(float(np.median(np.diff(x)))), abs(float(np.median(np.diff(y))))
    if not (x.min() - dx <= cx <= x.max() + dx and y.min() - dy <= cy <= y.max() + dy):
        return None, "lake_outside_frame"
    ci, rj = int(np.argmin(np.abs(x - cx))), int(np.argmin(np.abs(y - cy)))
    hw, hh = int(half_km * 1000 / dx), int(half_km * 1000 / dy)
    c0, c1 = max(0, ci - hw), min(x.size, ci + hw + 1)
    r0, r1 = max(0, rj - hh), min(y.size, rj + hh + 1)
    if (c1 - c0) < hw or (r1 - r0) < hh:
        return None, "window_clipped_by_frame_edge"
    win = np.asarray(grp[pol][r0:r1, c0:c1], dtype=np.float32)
    return (win, dx * dy, (rj - r0, ci - c0), pol), ""


def process_h5(h5, lakes: list[dict], half_km: float, want_chips: bool = False) -> list[dict]:
    rows = []
    for lake in lakes:
        base = {"lake_name": lake["name"]}
        try:
            got, why = read_lake_window(h5, lake, half_km)
        except KeyError as exc:
            rows.append({**base, "area_km2": np.nan, "flag": f"layout_error:{exc}"})
            continue
        if got is None:
            rows.append({**base, "area_km2": np.nan, "flag": why})
            continue
        win, px_area, seed, pol = got
        nodata = 1 - np.isfinite(win).mean()
        if nodata > MAX_NODATA_FRAC:
            rows.append({**base, "area_km2": np.nan, "flag": f"nodata_{nodata:.2f}", "polarisation": pol})
            continue
        db = despeckle_db(to_db(win.astype(float)), 3)
        seg = segment_lake(db, seed, px_area, max_seed_dist_px=1500 / np.sqrt(px_area))
        if want_chips:
            seg["_db"] = db
        else:
            seg.pop("_mask", None)
        rows.append({**base, **seg, "polarisation": pol, "window_px": int(win.size)})
    return rows


# ------------------------------------------------- images for the website --

def save_chip(lake_id: str, date: str, scene: str, db: np.ndarray, mask: np.ndarray, out_dir: Path = None) -> str:
    """Write a grayscale backscatter image and a transparent water-outline image. Returns the path stem
    (relative to site/) that the website uses. Dark = low backscatter = water."""
    from PIL import Image
    out_dir = out_dir or RADAR_DIR
    short = hashlib.md5(scene.encode()).hexdigest()[:6]
    stem = f"{date}_{short}"
    folder = Path(out_dir) / lake_id
    folder.mkdir(parents=True, exist_ok=True)
    lo, hi = -30.0, 0.0
    g = np.clip((np.nan_to_num(db, nan=lo) - lo) / (hi - lo), 0, 1)
    Image.fromarray((g * 255).astype(np.uint8), "L").save(folder / f"{stem}.png", optimize=True)
    edge = mask & ~ndi.binary_erosion(mask)
    rgba = np.zeros(mask.shape + (4,), np.uint8)
    rgba[edge] = (79, 227, 208, 255)
    Image.fromarray(rgba, "RGBA").save(folder / f"{stem}_mask.png", optimize=True)
    return f"radar/{lake_id}/{stem}"


def write_manifest(entries: dict[str, list[dict]], out_dir: Path = None) -> None:
    """site/radar/manifest.js, merged with what is already there so a one-lake test run keeps other lakes."""
    out_dir = Path(out_dir or RADAR_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "manifest.js"
    current: dict = {}
    if path.exists():
        m = re.search(r"=\s*(\{.*\})\s*;", path.read_text(encoding="utf-8"), re.S)
        if m:
            try:
                current = json.loads(m.group(1)).get("lakes", {})
            except json.JSONDecodeError:
                current = {}
    current.update({k: sorted(v, key=lambda r: r["d"]) for k, v in entries.items()})
    payload = {"generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"), "lakes": current}
    path.write_text("window.SAR_COSMOS_RADAR = " + json.dumps(payload) + ";\n", encoding="utf-8")


# ---------------------------------------------------------------- the run --

def _lake_point_wkt(lake: dict) -> str:
    return f"POINT({lake['lon']} {lake['lat']})"


def run(args) -> None:
    import asf_search as asf
    import earthaccess
    import h5py

    lakes = json.load(open(LAKES_JSON))["lakes"]
    if args.lake:
        lakes = [l for l in lakes if args.lake.lower() in l["name"].lower()]
        if not lakes:
            sys.exit(f"no lake matches {args.lake!r}")

    # 1) find scenes covering each lake, then group by file so each is opened once
    scenes: dict[str, dict] = {}
    for lake in lakes:
        res = asf.search(dataset=asf.DATASET.NISAR, processingLevel=asf.PRODUCT_TYPE.GCOV,
                         intersectsWith=_lake_point_wkt(lake), start=args.start, maxResults=300)
        res = sorted(res, key=lambda r: r.properties["startTime"])
        if args.limit:
            res = res[: args.limit]
        for r in res:
            name = r.properties.get("fileID") or r.properties.get("sceneName")
            url = r.properties.get("url", "")
            if not url.endswith(".h5"):
                urls = [u for u in (r.properties.get("additionalUrls") or []) if u.endswith(".h5")]
                url = urls[0] if urls else url
            entry = scenes.setdefault(name, {"url": url, "date": r.properties["startTime"][:10], "lakes": []})
            entry["lakes"].append(lake)
    print(f"[nisar_water] {len(scenes)} unique scenes to read for {len(lakes)} lake(s)")

    # 2) stream each scene once, extract every lake inside it
    earthaccess.login(strategy="environment")
    fs = earthaccess.get_fsspec_https_session()
    log_rows = []
    for i, (name, sc) in enumerate(sorted(scenes.items(), key=lambda kv: kv[1]["date"]), 1):
        print(f"[nisar_water] ({i}/{len(scenes)}) {sc['date']}  {name[:60]}")
        rows = None
        for attempt in (1, 2):
            try:
                with fs.open(sc["url"], mode="rb", block_size=4 * 1024 * 1024, cache_type="blockcache") as f:
                    with h5py.File(f, "r") as h5:
                        rows = process_h5(h5, sc["lakes"], args.half_window_km, want_chips=getattr(args, "chips", True))
                break
            except Exception as exc:  # network hiccup or unexpected layout
                print(f"    attempt {attempt} failed: {type(exc).__name__}: {str(exc)[:120]}")
        if rows is None:
            rows = [{"lake_name": l["name"], "area_km2": np.nan, "flag": "open_failed"} for l in sc["lakes"]]
        ids = {l["name"]: l["id"] for l in sc["lakes"]}
        for r in rows:
            r.update({"date": sc["date"], "scene": name})
            db_img, blob = r.pop("_db", None), r.pop("_mask", None)
            if getattr(args, "chips", True) and blob is not None and db_img is not None and r.get("area_km2") == r.get("area_km2"):
                r["chip"] = save_chip(ids[r["lake_name"]], sc["date"], name, db_img, blob)
            a = r.get("area_km2")
            print(f"    {r['lake_name']:24} {'%.3f km2' % a if a == a else 'skipped':>11}  {r.get('flag', '')}")
        log_rows += rows

    log = pd.DataFrame(log_rows)
    if log.empty:
        sys.exit("[nisar_water] nothing processed")

    # 3) outlier flag: a scene far from that lake's own median is probably ice, wind or a bad segment
    log["flag"] = log["flag"].fillna("")
    for name, g in log.groupby("lake_name"):
        med = g["area_km2"].median()
        bad = g.index[(g["area_km2"] < 0.5 * med) | (g["area_km2"] > 1.6 * med)]
        log.loc[bad, "flag"] = (log.loc[bad, "flag"] + " outlier").str.strip()

    SCENE_LOG_CSV.parent.mkdir(parents=True, exist_ok=True)
    log.sort_values(["lake_name", "date"]).to_csv(SCENE_LOG_CSV, index=False)
    print(f"[nisar_water] QC log -> {SCENE_LOG_CSV}")

    # "seed_on_land" means the dark blob was NOT at the lake's coordinates. That is how a wrong
    # coordinate (or a radar-shadow patch) would sneak into the data, so such rows are kept in the
    # QC log only, until you have checked the coordinates and pass --accept-offset-seeds.
    flags = log["flag"]
    if args.accept_offset_seeds:
        flags = flags.str.replace("seed_on_land", "", regex=False).str.strip()
    good = log[log["area_km2"].notna() & (flags == "")]
    print(f"[nisar_water] usable measurements: {len(good)} of {len(log)}")
    if getattr(args, "chips", True) and "chip" in log.columns:
        entries: dict[str, list[dict]] = {}
        ok_idx = set(good.index)
        id_of = {l["name"]: l["id"] for l in lakes}
        for i, r in log[log["chip"].notna()].iterrows():
            entries.setdefault(id_of[r["lake_name"]], []).append(
                {"d": r["date"], "a": round(float(r["area_km2"]), 4), "ok": bool(i in ok_idx), "f": r["chip"], "flag": r["flag"]})
        write_manifest(entries)
        print(f"[nisar_water] radar images -> {RADAR_DIR}")
    if not args.write:
        print("[nisar_water] dry run: lake_timeseries.csv NOT changed (add --write to update it)")
        return
    rows = pd.DataFrame({"lake_name": good["lake_name"], "date": good["date"],
                         "area_km2": good["area_km2"].round(4), "source": "SAR", "cloud_pct": 0.0})
    existing = pd.read_csv(TIMESERIES_CSV) if TIMESERIES_CSV.exists() else pd.DataFrame()
    if not existing.empty:
        existing = existing[existing["source"] != "SAR"]
    pd.concat([existing, rows], ignore_index=True).sort_values(["lake_name", "date"]).to_csv(TIMESERIES_CSV, index=False)
    print(f"[nisar_water] wrote {len(rows)} SAR rows -> {TIMESERIES_CSV}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lake", help="only lakes whose name contains this text")
    ap.add_argument("--limit", type=int, default=0, help="max scenes per lake (0 = all)")
    ap.add_argument("--start", default=DATA_START)
    ap.add_argument("--half-window-km", type=float, default=2.2, help="half size of the window read around each lake")
    ap.add_argument("--accept-offset-seeds", action="store_true",
                    help="also keep scenes where the lake blob was not at the given coordinates")
    ap.add_argument("--no-chips", dest="chips", action="store_false", help="do not save scene images for the website")
    ap.add_argument("--write", action="store_true", help="update lake_timeseries.csv (SAR rows only)")
    run(ap.parse_args())


if __name__ == "__main__":
    main()
