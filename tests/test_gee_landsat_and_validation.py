import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline import gee_landsat as gl          # noqa: E402
from pipeline import validate_published as vp   # noqa: E402


def fake_ndwi(rows=146, cols=146, seed=0, lake=True, decoy=True):
    """30 m NDWI window: land ~ -0.25, lake ~ +0.45 (an ellipse of known area), plus a decoy shadow blob."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:rows, 0:cols]
    r0, c0 = rows // 2, cols // 2
    nd = rng.normal(-0.25, 0.10, (rows, cols))
    if lake:
        a, b = 23.0, 17.0                                    # semi-axes in pixels
        nd[((xx - c0) / a) ** 2 + ((yy - r0) / b) ** 2 <= 1] = rng.normal(0.45, 0.08, (rows, cols))[((xx - c0) / a) ** 2 + ((yy - r0) / b) ** 2 <= 1]
    if decoy:
        nd[((xx - c0 + 45) / 9) ** 2 + ((yy - r0 - 30) / 7) ** 2 <= 1] = 0.40
    true_km2 = math.pi * 23 * 17 * 900 / 1e6
    return nd, true_km2


def test_ndwi_area_and_decoy_rejected():
    nd, truth = fake_ndwi()
    r = gl.segment_ndwi(nd, (73, 73), 50)
    assert r["flag"] == "" and r["area_km2"] == pytest.approx(truth, rel=0.05)


def test_cloud_gaps_do_not_break_it():
    nd, truth = fake_ndwi(seed=3)
    nd[5:40, 5:60] = np.nan                                   # a masked cloud patch far from the lake
    r = gl.segment_ndwi(nd, (73, 73), 50)
    assert r["area_km2"] == pytest.approx(truth, rel=0.06)


def test_no_lake_means_no_area():
    nd, _ = fake_ndwi(lake=False, decoy=False)
    assert np.isnan(gl.segment_ndwi(nd, (73, 73), 50)["area_km2"])


def test_blob_candidates_gives_correct_coordinates():
    nd, truth = fake_ndwi()
    lat0, lon0 = 27.80, 86.87
    # shift the lake 20 px east and 10 px south of window centre -> coordinates must move accordingly
    shifted = np.full_like(nd, -0.25); shifted[10:, :-20] = nd[:-10, 20:] if False else -0.25
    nd2 = np.roll(np.roll(nd, 20, axis=1), 10, axis=0)
    tab = gl.blob_candidates(nd2, lat0, lon0)
    best = tab.sort_values("area_km2", ascending=False).iloc[0]
    assert best["area_km2"] == pytest.approx(truth, rel=0.08)
    assert best["lat"] == pytest.approx(lat0 - 10 * 30 / 110540, abs=0.0006)
    assert best["lon"] == pytest.approx(lon0 + 20 * 30 / (111320 * math.cos(math.radians(lat0))), abs=0.0006)


def test_seed_off_lake_is_flagged():
    nd, truth = fake_ndwi(decoy=False)
    r = gl.segment_ndwi(nd, (73, 73 + 40), 80)               # seed 40 px east of the lake edge
    assert "seed_on_land" in r["flag"] and r["area_km2"] == pytest.approx(truth, rel=0.06)


def test_earth_engine_functions_exist():
    import ee
    assert hasattr(ee.Geometry, "Rectangle") and hasattr(ee.Image, "sampleRectangle")
    for name in ("bitwiseAnd", "normalizedDifference", "updateMask", "mask", "reduceRegion", "toDictionary", "multiply", "add"):
        assert hasattr(ee.Image, name), name
    assert hasattr(ee.Filter, "notNull") and hasattr(ee.Filter, "gte") and hasattr(ee.Reducer, "mean")
    assert hasattr(ee.ImageCollection, "toList") and hasattr(ee.ImageCollection, "merge")


# ---------------------------------------------------------------- validation
def _ts():
    return pd.DataFrame([
        ("Lake A", "2010-10-20", 1.00, "optical"), ("Lake A", "2015-10-02", 1.10, "optical"),
        ("Lake A", "2026-08-10", 1.30, "optical"), ("Lake A", "2026-08-16", 1.28, "SAR"),
        ("Lake A", "2026-10-01", 1.31, "SAR"),                               # no optical within 14 days
    ], columns=["lake_name", "date", "area_km2", "source"])


def test_optical_vs_published_and_sar_vs_optical():
    ref = pd.DataFrame([("Lake A", "2010-10-26", 1.05, "Rounce"), ("Lake A", "2015-09-30", 1.20, "Rounce")],
                       columns=["lake_name", "date", "area_km2", "source"])
    o = vp.optical_vs_published(_ts(), ref)
    assert list(o["diff_pct"]) == [pytest.approx(-4.8, abs=0.1), pytest.approx(-8.3, abs=0.1)]
    s = vp.sar_vs_optical(_ts())
    assert len(s) == 1 and s.iloc[0]["diff_pct"] == pytest.approx(-1.5, abs=0.1)


def test_summary_reports_no_overlap_honestly():
    rep = vp.sar_vs_optical(_ts())
    summ = vp.summarise(rep, ["Lake A", "Lake B"])
    b = summ[(summ.lake_name == "Lake B") & (summ.check == "sar_vs_optical")].iloc[0]
    assert b["verdict"] == "no overlap" and b["n"] == 0


def test_reference_table_is_sane():
    ref = pd.read_csv(ROOT / "data" / "reference" / "published_lake_areas.csv")
    assert {"lake_name", "date", "area_km2", "source"} <= set(ref.columns)
    assert ref["area_km2"].between(0.3, 2.5).all() and ref["source"].str.len().min() > 10
    assert ref["lake_name"].nunique() == 6
