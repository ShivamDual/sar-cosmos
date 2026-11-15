"""
Quick check: does NISAR actually have public scenes over your six lakes?

Run this BEFORE spending time on the radar pipeline. It needs no login (it only
searches metadata). NISAR calibrated public data starts with acquisitions on or
after 2026-06-17, so a lake can only have a handful of scenes so far.

    pip install -U asf_search
    python scripts/check_nisar_coverage.py

Send the printed table to the developer.
"""
import json
from pathlib import Path

import asf_search as asf

ROOT = Path(__file__).resolve().parent.parent
LAKES = json.load(open(ROOT / "data" / "lake_metadata.json"))["lakes"]
START = "2026-06-17"  # first calibrated NISAR acquisitions released to the public


def box_wkt(lake):
    d = lake["bbox_buffer_km"] / 111.0
    x0, x1, y0, y1 = lake["lon"] - d, lake["lon"] + d, lake["lat"] - d, lake["lat"] + d
    return f"POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))"


print(f"{'lake':26} {'GCOV scenes':>11}  first / last acquisition")
for lake in LAKES:
    try:
        res = asf.search(
            dataset=asf.DATASET.NISAR,
            processingLevel=asf.PRODUCT_TYPE.GCOV,
            intersectsWith=box_wkt(lake),
            start=START,
            maxResults=200,
        )
        dates = sorted(r.properties["startTime"][:10] for r in res)
        span = f"{dates[0]} / {dates[-1]}" if dates else "none found"
        print(f"{lake['name']:26} {len(dates):>11}  {span}")
    except Exception as exc:  # keep going so one failure doesn't hide the rest
        print(f"{lake['name']:26} {'error':>11}  {str(exc)[:80]}")
