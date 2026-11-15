"""
Transparent, explainable risk-tier scoring.

Deliberately a plain formula, not a model -- judges reward a risk score they
can follow line-by-line over an opaque black box, and it's genuinely more
defensible on stage when someone asks "how did you calculate that."
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
TIMESERIES_CSV = REPO_ROOT / "data" / "processed" / "lake_timeseries.csv"

# Starting thresholds -- tune once real pipeline data is in, using the
# growth_rate_5yr_pct figures already researched per lake in lake_metadata.json
# as a sanity check on where these bands should sit.
TIER_THRESHOLDS = {
    "Low": 0.10,
    "Moderate": 0.25,
    "High": 0.40,
    # anything >= 0.40 is "Critical"
}

TIER_ORDER = ["Low", "Moderate", "High", "Critical"]

TIER_COLORS = {
    "Low": "#4ADE80",
    "Moderate": "#FBBF24",
    "High": "#FB923C",
    "Critical": "#EF4444",
}


def growth_rate(area_now: float, area_5_years_ago: float) -> float:
    if area_5_years_ago in (0, None) or area_now is None:
        return None
    return (area_now - area_5_years_ago) / area_5_years_ago


def tier_for_growth_rate(rate: float | None) -> str:
    if rate is None:
        return "Unknown"
    if rate < TIER_THRESHOLDS["Low"]:
        return "Low"
    if rate < TIER_THRESHOLDS["Moderate"]:
        return "Moderate"
    if rate < TIER_THRESHOLDS["High"]:
        return "High"
    return "Critical"


def latest_and_5yr_prior(lake_series: pd.DataFrame) -> tuple[float | None, float | None, str | None]:
    """lake_series: rows for one lake, columns include date (str/Timestamp) and area_km2."""
    df = lake_series.dropna(subset=["area_km2"]).copy()
    if df.empty:
        return None, None, None
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    latest_row = df.iloc[-1]
    latest_date, latest_area = latest_row["date"], latest_row["area_km2"]

    target_date = latest_date - pd.DateOffset(years=5)
    df["date_diff"] = (df["date"] - target_date).abs()
    prior_row = df.loc[df["date_diff"].idxmin()]

    return latest_area, prior_row["area_km2"], latest_date.strftime("%Y-%m-%d")


def score_all_lakes(timeseries_csv: Path = TIMESERIES_CSV) -> pd.DataFrame:
    df = pd.read_csv(timeseries_csv)
    rows = []
    for lake_name, group in df.groupby("lake_name"):
        latest_area, prior_area, latest_date = latest_and_5yr_prior(group)
        rate = growth_rate(latest_area, prior_area)
        tier = tier_for_growth_rate(rate)
        rows.append(
            {
                "lake_name": lake_name,
                "latest_date": latest_date,
                "latest_area_km2": latest_area,
                "area_5yr_prior_km2": prior_area,
                "growth_rate_5yr": rate,
                "risk_tier": tier,
                "risk_color": TIER_COLORS.get(tier, "#9CA3AF"),
            }
        )
    return pd.DataFrame(rows)


def trailing_change(lake_series: pd.DataFrame, years: int) -> float | None:
    """% change over a trailing N-year window -- used for the 3yr/5yr stats
    the UI shows alongside the risk tier."""
    df = lake_series.dropna(subset=["area_km2"]).copy()
    if df.empty:
        return None
    df["date"] = pd.to_datetime(df["date"]).copy()
    df = df.sort_values("date")
    latest_date, latest_area = df.iloc[-1]["date"], df.iloc[-1]["area_km2"]
    target_date = latest_date - pd.DateOffset(years=years)
    df["date_diff"] = (df["date"] - target_date).abs()
    prior_row = df.loc[df["date_diff"].idxmin()]
    rate = growth_rate(latest_area, prior_row["area_km2"])
    return None if rate is None else round(rate * 100, 1)


if __name__ == "__main__":
    result = score_all_lakes()
    print(result.to_string(index=False))
