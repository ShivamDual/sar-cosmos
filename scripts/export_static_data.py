"""
Builds site/data.js, the single data file the website reads.

HONESTY RULE (this fixed a real bug: the site once showed synthetic numbers as real):
the website never shows data that did not come from a real source. For each lake:

  * OPTICAL series  = your Landsat pipeline output ONLY IF that lake appears in
                      data/processed/optical_scene_log.csv (a file only the real run creates).
                      Otherwise it is the PUBLISHED series (Rounce et al. 2016, 2000-2015).
  * RADAR series    = your NISAR output ONLY IF that lake appears in
                      data/processed/nisar_scene_log.csv. Otherwise there is no radar series.

The synthetic generator (scripts/generate_demo_data.py) can still exist for development, but nothing
it writes can reach the site, because those rows are never read unless a real log exists.

Run:  python scripts/export_static_data.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline.risk_scoring import TIER_COLORS, latest_and_5yr_prior, tier_for_growth_rate, growth_rate, trailing_change  # noqa: E402

PROCESSED = ROOT / "data" / "processed"
LAKES_JSON = ROOT / "data" / "lake_metadata.json"
TIMESERIES = PROCESSED / "lake_timeseries.csv"
OPTICAL_LOG = PROCESSED / "optical_scene_log.csv"
NISAR_LOG = PROCESSED / "nisar_scene_log.csv"
REFERENCE = ROOT / "data" / "reference" / "published_lake_areas.csv"
OUTPUT_JS = ROOT / "site" / "data.js"

REFERENCES = [
    {"id": "rounce", "text": "Rounce, D. R. et al. (2016). Glacial lake change and hazard assessment in the Everest region and beyond. Hydrology and Earth System Sciences 20, 3455-3475, supplement Table S.7 (Landsat and ASTER areas, average error about 10%)."},
    {"id": "icimod2011", "text": "ICIMOD (2011). Glacial lakes and glacial lake outburst floods in Nepal. Study identifying 21 critically dangerous lakes, only two with proper mitigation."},
    {"id": "icimod-undp2020", "text": "ICIMOD and UNDP Nepal (2020). Report on potentially dangerous glacial lakes in the Koshi, Gandaki and Karnali basins (26 GLOF events since 1977, 14 starting in Nepal)."},
    {"id": "icimod2019", "text": "ICIMOD (2019). Reassessing Tsho Rolpa glacial lake."},
    {"id": "watanabe2009", "text": "Watanabe, T. et al. (2009). Norsk Geografisk Tidsskrift 63(4), 255-267 (Imja Tsho area, 21 Nov 2009)."},
    {"id": "nisar", "text": "NASA-ISRO NISAR L-band GCOV products, via ASF DAAC (calibrated public data for acquisitions from 2026-06-17)."},
    {"id": "landsat", "text": "Landsat 5, 7, 8 and 9 Collection 2 Level 2 surface reflectance, via Google Earth Engine."},
]


def _rows(df: pd.DataFrame) -> list[dict]:
    return [{"date": pd.Timestamp(d).strftime("%Y-%m-%d"), "area": round(float(a), 4)} for d, a in zip(df["date"], df["area_km2"])]


def _real_lakes(log_path: Path) -> set[str]:
    if not log_path.exists():
        return set()
    log = pd.read_csv(log_path)
    return set(log.loc[log["area_km2"].notna(), "lake_name"])


def build_payload() -> dict:
    lakes_meta = json.load(open(LAKES_JSON, encoding="utf-8"))["lakes"]
    ref = pd.read_csv(REFERENCE, parse_dates=["date"])
    rounce = ref[ref["source"].str.startswith("Rounce")]
    ts = pd.read_csv(TIMESERIES, parse_dates=["date"]) if TIMESERIES.exists() else pd.DataFrame(columns=["lake_name", "date", "area_km2", "source"])

    opt_real, sar_real = _real_lakes(OPTICAL_LOG), _real_lakes(NISAR_LOG)
    lakes_out = []
    for lake in lakes_meta:
        name = lake["name"]
        published = rounce[rounce["lake_name"] == name].sort_values("date")
        use_opt = name in opt_real
        use_sar = name in sar_real
        optical = ts[(ts["lake_name"] == name) & (ts["source"] == "optical")].sort_values("date") if use_opt else published
        sar = ts[(ts["lake_name"] == name) & (ts["source"] == "SAR")].sort_values("date") if use_sar else ts.iloc[0:0]

        latest_area, prior_area, latest_date = latest_and_5yr_prior(optical)
        rate = growth_rate(latest_area, prior_area)
        tier = tier_for_growth_rate(rate)
        basis = f"Five-year growth to {str(latest_date)[:4]}, " + ("from the pipeline's Landsat series" if use_opt else "from published measurements")
        lakes_out.append({
            "id": lake["id"], "name": name, "basin": lake["basin"], "district": lake["district"],
            "lat": lake["lat"], "lon": lake["lon"], "altitude_m": lake["altitude_m"],
            "monitored": lake["monitored"], "context": lake["context"], "keyStat": lake["key_stat"],
            "exposure": lake.get("exposure"),
            "riskTier": tier, "riskColor": TIER_COLORS.get(tier, "#9CA3AF"), "riskBasis": basis,
            "latestAreaKm2": None if latest_area is None else round(float(latest_area), 4), "latestDate": latest_date,
            "change3yrPct": trailing_change(optical, years=3), "change5yrPct": trailing_change(optical, years=5),
            "opticalIsPipeline": bool(use_opt), "sarIsReal": bool(use_sar),
            "optical": _rows(optical), "sar": _rows(sar), "published": _rows(published),
        })

    n, n_opt, n_sar = len(lakes_meta), len(opt_real & {l["name"] for l in lakes_meta}), len(sar_real & {l["name"] for l in lakes_meta})
    if n_opt == 0 and n_sar == 0:
        label = "Published data, 2000 to 2015"
        note = ("Showing published lake-area measurements (Rounce et al. 2016, about 10% error). "
                "The Landsat and NISAR pipeline results will replace and extend them once they have been run.")
    elif n_opt == n and n_sar == n:
        label = "Landsat and NISAR pipeline"
        note = "Areas come from this project's Landsat and NISAR pipelines; published measurements are shown as the reference."
    else:
        label = f"Partial pipeline run: optical {n_opt}/{n}, NISAR {n_sar}/{n}"
        note = "Lakes without pipeline results fall back to published measurements."

    # observation calendar: how many published optical measurements fall in each month (a real, checkable pattern)
    pub_months = [int((rounce["date"].dt.month == m).sum()) for m in range(1, 13)]
    coverage = {"publishedPerMonth": pub_months, "publishedTotal": int(len(rounce))}
    if NISAR_LOG.exists():
        nl = pd.read_csv(NISAR_LOG, parse_dates=["date"]).dropna(subset=["area_km2"])
        key = nl["scene"] if "scene" in nl.columns else nl["date"].astype(str)
        uniq = nl.assign(_k=key).drop_duplicates("_k")
        coverage["nisarPerMonth"] = [int((uniq["date"].dt.month == m).sum()) for m in range(1, 13)]
    if OPTICAL_LOG.exists():
        ol = pd.read_csv(OPTICAL_LOG, parse_dates=["date"]).dropna(subset=["area_km2"])
        coverage["pipelineOpticalPerMonth"] = [int((ol["date"].dt.month == m).sum()) for m in range(1, 13)]

    return {
        "generatedAt": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "demoData": not (n_opt == n and n_sar == n),
        "dataLabel": label, "dataNote": note,
        "stats": {"dangerousLakes": 21, "mitigatedLakes": 2, "gloFsSince1977": 26, "gloFsInsideNepal": 14, "households": 6000},
        "coverage": coverage, "references": REFERENCES, "lakes": lakes_out,
    }


def main() -> None:
    payload = build_payload()
    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JS.write_text("window.SAR_COSMOS_DATA = " + json.dumps(payload, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"[export_static_data] {len(payload['lakes'])} lakes -> {OUTPUT_JS}")
    print(f"[export_static_data] data mode: {payload['dataLabel']}")
    for l in payload["lakes"]:
        print(f"    {l['name']:24} {l['riskTier']:9} optical={'pipeline' if l['opticalIsPipeline'] else 'published'}  radar={'real' if l['sarIsReal'] else 'none'}")


if __name__ == "__main__":
    main()
