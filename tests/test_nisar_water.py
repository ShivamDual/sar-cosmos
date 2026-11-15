"""Tests for pipeline/nisar_water.py using a synthetic file shaped like a NISAR GCOV product."""
import json
import sys
from pathlib import Path

import h5py
import numpy as np
import pytest
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline import nisar_water as nw  # noqa: E402

LAKE = {"name": "Test Lake", "lat": 27.898, "lon": 86.928}
A_M, B_M = 700.0, 500.0                  # lake semi-axes (m)
TRUE_KM2 = np.pi * A_M * B_M / 1e6       # 1.0996 km2


def make_gcov(path, *, lake=True, shadow=True, seed=1, speckle_looks=4):
    rng = np.random.default_rng(seed)
    tf = Transformer.from_crs(4326, 32645, always_xy=True)
    cx, cy = tf.transform(LAKE["lon"], LAKE["lat"])
    x = cx + np.arange(-6000, 6001, 20.0)
    y = cy + np.arange(6000, -6001, -20.0)          # y descends, like real rasters
    X, Y = np.meshgrid(x - cx, y - cy)
    land_db = rng.normal(-9.0, 2.5, X.shape)
    db = land_db.copy()
    if lake:
        db[(X / A_M) ** 2 + (Y / B_M) ** 2 <= 1] = rng.normal(-24.0, 1.0, (X.shape))[(X / A_M) ** 2 + (Y / B_M) ** 2 <= 1]
    if shadow:   # radar shadow: dark, but NOT the lake
        db[((X + 1100) / 350) ** 2 + ((Y - 1000) / 250) ** 2 <= 1] = -22.0
    power = 10 ** (db / 10) * rng.gamma(speckle_looks, 1 / speckle_looks, X.shape)
    with h5py.File(path, "w") as h5:
        g = h5.create_group(nw.GRID)
        g.create_dataset("HHHH", data=power.astype("float32"), chunks=(256, 256))
        g.create_dataset("HVHV", data=(power * 0.1).astype("float32"))
        g.create_dataset("xCoordinates", data=x)
        g.create_dataset("yCoordinates", data=y)
        p = g.create_dataset("projection", data=np.uint32(32645))
        p.attrs["epsg_code"] = 32645


def run(path, **kw):
    make_gcov(path, **kw)
    with h5py.File(path, "r") as h5:
        return nw.process_h5(h5, [LAKE], half_km=2.2)[0]


def test_area_close_to_truth_and_ignores_shadow(tmp_path):
    r = run(tmp_path / "a.h5")
    assert r["flag"] == ""
    assert r["polarisation"] == "HHHH"
    assert r["area_km2"] == pytest.approx(TRUE_KM2, rel=0.03)   # measured error ~0.6%


def test_shadow_alone_is_not_called_a_lake(tmp_path):
    r = run(tmp_path / "b.h5", lake=False, shadow=True)
    assert np.isnan(r["area_km2"]) or r["flag"] != ""


def test_lake_outside_frame_is_skipped(tmp_path):
    make_gcov(tmp_path / "c.h5")
    far = dict(LAKE, lon=88.5)
    with h5py.File(tmp_path / "c.h5", "r") as h5:
        r = nw.process_h5(h5, [far], half_km=2.2)[0]
    assert np.isnan(r["area_km2"]) and r["flag"] == "lake_outside_frame"


def test_seed_slightly_off_still_finds_the_lake(tmp_path):
    make_gcov(tmp_path / "d.h5")
    off = dict(LAKE, lon=LAKE["lon"] + 0.012)   # ~1.1 km east: lands on land
    with h5py.File(tmp_path / "d.h5", "r") as h5:
        r = nw.process_h5(h5, [off], half_km=2.5)[0]
    assert r["area_km2"] == pytest.approx(TRUE_KM2, rel=0.05)
    assert "seed_on_land" in r["flag"] and r["seed_offset_px"] > 0


def test_otsu_splits_two_populations():
    rng = np.random.default_rng(0)
    db = np.concatenate([rng.normal(-23, 1.5, 3000), rng.normal(-8, 2.5, 9000)])
    thr, dark, bright = nw.otsu_db(db)
    assert -20 < thr < -11 and dark < -20 and bright > -10


def test_full_run_with_fake_network(tmp_path, monkeypatch):
    """Search -> group by file -> stream -> segment -> QC log -> CSV, with the network faked."""
    import argparse
    import asf_search
    import earthaccess
    import pandas as pd

    files, results = {}, []
    for k, d in enumerate(["2026-07-01", "2026-07-13", "2026-07-25", "2026-08-06"]):
        f = tmp_path / f"scene{k}.h5"
        make_gcov(f, seed=10 + k)
        url = f"https://fake.example/{f.name}"
        files[url] = f
        results.append(type("R", (), {"properties": {"startTime": d + "T12:00:00Z", "fileID": f"SCENE_{k}", "url": url}})())

    monkeypatch.setattr(asf_search, "search", lambda **kw: results)
    monkeypatch.setattr(earthaccess, "login", lambda **kw: None)

    class FakeFS:
        def open(self, url, mode="rb", **kw):
            return open(files[url], "rb")

    monkeypatch.setattr(earthaccess, "get_fsspec_https_session", lambda: FakeFS())

    lakes_json = tmp_path / "lakes.json"
    lakes_json.write_text(json.dumps({"lakes": [dict(LAKE, id="t", bbox_buffer_km=1.0)]}))
    ts_csv = tmp_path / "ts.csv"
    pd.DataFrame({"lake_name": ["Test Lake"], "date": ["2020-01-01"], "area_km2": [0.9],
                  "source": ["optical"], "cloud_pct": [3.0]}).to_csv(ts_csv, index=False)
    monkeypatch.setattr(nw, "LAKES_JSON", lakes_json)
    monkeypatch.setattr(nw, "TIMESERIES_CSV", ts_csv)
    monkeypatch.setattr(nw, "SCENE_LOG_CSV", tmp_path / "log.csv")
    monkeypatch.setattr(nw, "RADAR_DIR", tmp_path / "radar")

    nw.run(argparse.Namespace(lake=None, limit=0, start="2026-06-17", half_window_km=2.2,
                              write=True, accept_offset_seeds=False, chips=True))
    out = pd.read_csv(ts_csv)
    sar = out[out.source == "SAR"]
    assert len(sar) == 4 and (out.source == "optical").sum() == 1       # optical row untouched
    assert sar.area_km2.between(TRUE_KM2 * 0.97, TRUE_KM2 * 1.03).all()
    assert (tmp_path / "log.csv").exists()


def test_radar_images_and_manifest_are_written_and_merge(tmp_path):
    import re
    from PIL import Image
    make_gcov(tmp_path / "m.h5")
    with h5py.File(tmp_path / "m.h5", "r") as h5:
        db_row = nw.process_h5(h5, [LAKE], half_km=2.2, want_chips=True)[0]
    stem = nw.save_chip("test_lake", "2026-08-01", "SCENE_A", db_row["_db"], db_row["_mask"], out_dir=tmp_path / "radar")
    assert stem.startswith("radar/test_lake/2026-08-01_")
    img = Image.open(tmp_path / (stem.replace("radar/", "radar/", 1) + ".png"))
    outline = Image.open(tmp_path / (stem + "_mask.png"))
    assert img.mode == "L" and outline.mode == "RGBA" and img.size == outline.size
    assert np.asarray(outline)[..., 3].sum() > 0                              # an outline was drawn
    dark = np.asarray(img)[db_row["_mask"]].mean()
    assert dark < np.asarray(img)[~db_row["_mask"]].mean() - 40               # lake is clearly darker than land

    nw.write_manifest({"a": [{"d": "2026-07-01", "a": 1.0, "ok": True, "f": "x", "flag": ""}]}, out_dir=tmp_path / "radar")
    nw.write_manifest({"b": [{"d": "2026-07-02", "a": 2.0, "ok": True, "f": "y", "flag": ""}]}, out_dir=tmp_path / "radar")
    txt = (tmp_path / "radar" / "manifest.js").read_text()
    data = json.loads(re.search(r"=\s*(\{.*\})\s*;", txt, re.S).group(1))
    assert set(data["lakes"]) == {"a", "b"}                                   # second run did not erase the first lake
