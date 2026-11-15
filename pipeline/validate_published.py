"""
Validation: does the pipeline reproduce areas that other scientists measured?

Two honest checks, because a 2026 radar scene can't be compared with a 2015
paper directly (lakes grow):

 1. OPTICAL vs PUBLISHED   pipeline optical areas vs Rounce et al. (2016) Table S.7,
                           2000-2015 (Landsat/ASTER, ~10% average error), plus ICIMOD and
                           Watanabe et al. points. Same dates, same lake. This validates the
                           optical method.
 2. SAR vs OPTICAL         NISAR area vs an optical area from within +-14 days of the SAME
                           lake. This validates the radar method against the method we just
                           validated.

Chain of evidence: radar ~ optical (2026)  and  optical ~ published (2000-2015).

Run:  python pipeline/validate_published.py
Writes data/processed/validation_report.csv and prints a summary you can quote.
Any lake/check with no overlapping dates is reported as "no overlap", never hidden.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TIMESERIES = ROOT / "data" / "processed" / "lake_timeseries.csv"
REFERENCE = ROOT / "data" / "reference" / "published_lake_areas.csv"
REPORT = ROOT / "data" / "processed" / "validation_report.csv"
OPTICAL_LOG = ROOT / "data" / "processed" / "optical_scene_log.csv"   # only the REAL Landsat run creates this
NISAR_LOG = ROOT / "data" / "processed" / "nisar_scene_log.csv"     # only the REAL NISAR run creates this

PUBLISHED_ERROR = 0.10   # Rounce et al. 2016: average error of their own areas ~10% (range 4-14%)


def _nearest(df: pd.DataFrame, date: pd.Timestamp, max_days: int):
    if df.empty:
        return None
    gap = (df["date"] - date).abs()
    i = gap.idxmin()
    return (df.loc[i], int(gap.loc[i].days)) if gap.loc[i].days <= max_days else None


def optical_vs_published(ts: pd.DataFrame, ref: pd.DataFrame, max_days: int = 45) -> pd.DataFrame:
    opt = ts[ts["source"] == "optical"].dropna(subset=["area_km2"]).copy()
    opt["date"] = pd.to_datetime(opt["date"])
    ref = ref.copy(); ref["date"] = pd.to_datetime(ref["date"])
    rows = []
    for _, r in ref.iterrows():
        hit = _nearest(opt[opt["lake_name"] == r["lake_name"]], r["date"], max_days)
        if hit is None:
            continue
        o, gap = hit
        rows.append({"check": "optical_vs_published", "lake_name": r["lake_name"], "date": r["date"].date(),
                     "pipeline_km2": round(o["area_km2"], 4), "reference_km2": r["area_km2"],
                     "diff_pct": round(100 * (o["area_km2"] - r["area_km2"]) / r["area_km2"], 1),
                     "date_gap_days": gap, "reference": r["source"][:48]})
    return pd.DataFrame(rows)


def sar_vs_optical(ts: pd.DataFrame, max_days: int = 14) -> pd.DataFrame:
    ts = ts.dropna(subset=["area_km2"]).copy(); ts["date"] = pd.to_datetime(ts["date"])
    rows = []
    for lake, g in ts.groupby("lake_name"):
        opt, sar = g[g["source"] == "optical"], g[g["source"] == "SAR"]
        for _, s in sar.iterrows():
            hit = _nearest(opt, s["date"], max_days)
            if hit is None:
                continue
            o, gap = hit
            rows.append({"check": "sar_vs_optical", "lake_name": lake, "date": s["date"].date(),
                         "pipeline_km2": round(s["area_km2"], 4), "reference_km2": round(o["area_km2"], 4),
                         "diff_pct": round(100 * (s["area_km2"] - o["area_km2"]) / o["area_km2"], 1),
                         "date_gap_days": gap, "reference": f"optical {o['date'].date()}"})
    return pd.DataFrame(rows)


def summarise(report: pd.DataFrame, lakes: list[str]) -> pd.DataFrame:
    out = []
    for check in ("optical_vs_published", "sar_vs_optical"):
        for lake in lakes:
            g = report[(report["check"] == check) & (report["lake_name"] == lake)] if not report.empty else report
            if g is None or len(g) == 0:
                out.append({"check": check, "lake_name": lake, "n": 0, "bias_pct": np.nan, "mean_abs_pct": np.nan,
                            "within_10pct": np.nan, "verdict": "no overlap"})
                continue
            d = g["diff_pct"].astype(float)
            w10 = float((d.abs() <= 100 * PUBLISHED_ERROR).mean())
            out.append({"check": check, "lake_name": lake, "n": len(g), "bias_pct": round(d.mean(), 1),
                        "mean_abs_pct": round(d.abs().mean(), 1), "within_10pct": round(w10, 2),
                        "verdict": "agrees" if d.abs().mean() <= 100 * PUBLISHED_ERROR * 1.5 else "check method / coordinates"})
    return pd.DataFrame(out)


def run() -> None:
    import sys
    if not OPTICAL_LOG.exists():
        print("STOP: no real optical run found (data/processed/optical_scene_log.csv is missing).\n"
              "Validating placeholder numbers against the literature would be meaningless and misleading.\n"
              "Run:  python pipeline/gee_landsat.py --project <id> --write   first.")
        sys.exit(1)
    ts = pd.read_csv(TIMESERIES)
    ref = pd.read_csv(REFERENCE)
    parts = [optical_vs_published(ts, ref)]
    if NISAR_LOG.exists():
        parts.append(sar_vs_optical(ts))
    else:
        print("(no real NISAR run yet, so the radar-vs-optical check is skipped)")
    report = pd.concat(parts, ignore_index=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report.to_csv(REPORT, index=False)
    summ = summarise(report, sorted(ts["lake_name"].unique()))
    print(summ.to_string(index=False))
    print(f"\nDetail -> {REPORT}")
    print("Note: published areas carry their own ~10% error, so 'agrees' means within ~15% on average.")


if __name__ == "__main__":
    run()
