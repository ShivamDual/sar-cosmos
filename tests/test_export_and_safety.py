"""The tests that guard the mistake that actually happened: synthetic numbers reaching the site as 'real'."""
import json
import shutil
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
import export_static_data as ex          # noqa: E402
from pipeline import validate_published as vp   # noqa: E402
import deploy_to_github as dep           # noqa: E402

NAMES = [l["name"] for l in json.load(open(ROOT / "data" / "lake_metadata.json", encoding="utf-8"))["lakes"]]


@pytest.fixture()
def sandbox(tmp_path, monkeypatch):
    (tmp_path / "data" / "processed").mkdir(parents=True)
    (tmp_path / "data" / "reference").mkdir(parents=True)
    shutil.copy(ROOT / "data" / "lake_metadata.json", tmp_path / "data")
    shutil.copy(ROOT / "data" / "reference" / "published_lake_areas.csv", tmp_path / "data" / "reference")
    proc = tmp_path / "data" / "processed"
    monkeypatch.setattr(ex, "LAKES_JSON", tmp_path / "data" / "lake_metadata.json")
    monkeypatch.setattr(ex, "REFERENCE", tmp_path / "data" / "reference" / "published_lake_areas.csv")
    monkeypatch.setattr(ex, "PROCESSED", proc)
    monkeypatch.setattr(ex, "TIMESERIES", proc / "lake_timeseries.csv")
    monkeypatch.setattr(ex, "OPTICAL_LOG", proc / "optical_scene_log.csv")
    monkeypatch.setattr(ex, "NISAR_LOG", proc / "nisar_scene_log.csv")
    # an obviously fake CSV, exactly like the synthetic generator would leave behind
    rows = [(n, "2026-09-01", 999.0, s) for n in NAMES for s in ("optical", "SAR")]
    pd.DataFrame(rows, columns=["lake_name", "date", "area_km2", "source"]).to_csv(proc / "lake_timeseries.csv", index=False)
    return proc


def test_synthetic_csv_never_reaches_the_site_without_real_logs(sandbox):
    p = ex.build_payload()
    assert p["demoData"] is True and p["dataLabel"].startswith("Published data")
    for l in p["lakes"]:
        assert not l["opticalIsPipeline"] and not l["sarIsReal"]
        assert l["sar"] == [] and all(pt["area"] < 5 for pt in l["optical"])      # 999 never appears
        assert max(pt["date"] for pt in l["optical"]) <= "2015-12-31"


def test_real_data_is_used_per_lake_only_when_its_log_exists(sandbox):
    pd.DataFrame({"lake_name": [NAMES[0]], "date": ["2026-09-01"], "area_km2": [1.5]}).to_csv(sandbox / "optical_scene_log.csv", index=False)
    pd.read_csv(sandbox / "lake_timeseries.csv").assign(area_km2=lambda d: d.area_km2.where(d.area_km2 != 999.0, 1.5)).to_csv(sandbox / "lake_timeseries.csv", index=False)
    p = ex.build_payload()
    by = {l["name"]: l for l in p["lakes"]}
    assert by[NAMES[0]]["opticalIsPipeline"] and by[NAMES[0]]["optical"][-1]["area"] == 1.5
    assert not by[NAMES[1]]["opticalIsPipeline"]
    assert p["dataLabel"].startswith("Partial pipeline run") and p["demoData"] is True


def test_fully_real_run_flips_the_site_to_pipeline_mode(sandbox):
    for log in ("optical_scene_log.csv", "nisar_scene_log.csv"):
        pd.DataFrame({"lake_name": NAMES, "date": ["2026-09-01"] * 6, "area_km2": [1.0] * 6, "scene": list("abcdef")}).to_csv(sandbox / log, index=False)
    p = ex.build_payload()
    assert p["demoData"] is False and p["dataLabel"] == "Landsat and NISAR pipeline"
    assert all(l["sarIsReal"] and l["opticalIsPipeline"] for l in p["lakes"])
    assert sum(p["coverage"]["nisarPerMonth"]) == 6


def test_published_calendar_shows_the_real_monsoon_gap(sandbox):
    cov = ex.build_payload()["coverage"]["publishedPerMonth"]
    assert sum(cov[:8]) == 0 and sum(cov[8:]) == ex.build_payload()["coverage"]["publishedTotal"]   # none Jan-Aug


def test_validation_refuses_to_run_on_placeholder_data(monkeypatch, tmp_path):
    monkeypatch.setattr(vp, "OPTICAL_LOG", tmp_path / "nope.csv")
    with pytest.raises(SystemExit):
        vp.run()


def test_secret_scanner_catches_tokens_but_not_env_usage(tmp_path):
    (tmp_path / "bad.py").write_text('x = "' + "gh" + "p_" + "a1B2c3D4e5" * 4 + '"\n')
    (tmp_path / "bad2.py").write_text('password = "' + "hunter2hunter2hunter2" + '"\n')
    (tmp_path / "ok.py").write_text('import os\ntoken = os.environ["EARTHDATA_TOKEN"]\n')
    hits = dep.scan_for_secrets(tmp_path)
    flagged = {h[0] for h in hits}
    assert flagged == {"bad.py", "bad2.py"}
    assert all(len(h) == 3 and "a1B2" not in str(h) for h in hits)             # reports where, never the value


def test_project_itself_is_secret_free():
    assert dep.scan_for_secrets(ROOT) == []
