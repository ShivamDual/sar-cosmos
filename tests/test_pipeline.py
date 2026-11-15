"""Sanity checks for the data pipeline. Run with: pytest tests/"""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pipeline.risk_scoring import growth_rate, tier_for_growth_rate, score_all_lakes  # noqa: E402

LAKE_METADATA_PATH = REPO_ROOT / "data" / "lake_metadata.json"
TIMESERIES_CSV = REPO_ROOT / "data" / "processed" / "lake_timeseries.csv"


def test_lake_metadata_has_six_lakes():
    with open(LAKE_METADATA_PATH) as f:
        lakes = json.load(f)["lakes"]
    assert len(lakes) == 6


def test_lake_metadata_required_fields():
    with open(LAKE_METADATA_PATH) as f:
        lakes = json.load(f)["lakes"]
    required = {"id", "name", "basin", "lat", "lon", "bbox_buffer_km", "context", "key_stat"}
    for lake in lakes:
        assert required.issubset(lake.keys()), f"{lake.get('name')} missing fields"
        assert -90 <= lake["lat"] <= 90
        assert -180 <= lake["lon"] <= 180


@pytest.mark.parametrize(
    "now,prior,expected",
    [
        (110, 100, 0.10),
        (100, 100, 0.0),
        (125, 100, 0.25),
    ],
)
def test_growth_rate(now, prior, expected):
    assert growth_rate(now, prior) == pytest.approx(expected)


def test_growth_rate_handles_missing_data():
    assert growth_rate(None, 100) is None
    assert growth_rate(100, None) is None
    assert growth_rate(100, 0) is None


@pytest.mark.parametrize(
    "rate,expected_tier",
    [
        (0.05, "Low"),
        (0.15, "Moderate"),
        (0.35, "High"),
        (0.50, "Critical"),
        (None, "Unknown"),
    ],
)
def test_tier_for_growth_rate(rate, expected_tier):
    assert tier_for_growth_rate(rate) == expected_tier


def test_timeseries_csv_exists_and_has_expected_columns():
    if not TIMESERIES_CSV.exists():
        pytest.skip("Run scripts/generate_demo_data.py (or the real pipeline) first.")
    df = pd.read_csv(TIMESERIES_CSV)
    expected_cols = {"lake_name", "date", "area_km2", "source", "cloud_pct"}
    assert expected_cols.issubset(df.columns)
    assert set(df["source"].unique()).issubset({"optical", "SAR"})


def test_score_all_lakes_returns_one_row_per_lake():
    if not TIMESERIES_CSV.exists():
        pytest.skip("Run scripts/generate_demo_data.py (or the real pipeline) first.")
    scores = score_all_lakes(TIMESERIES_CSV)
    with open(LAKE_METADATA_PATH) as f:
        lake_count = len(json.load(f)["lakes"])
    assert len(scores) == lake_count
    assert set(scores["risk_tier"].unique()).issubset({"Low", "Moderate", "High", "Critical", "Unknown"})
