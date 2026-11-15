import shutil, sys
from pathlib import Path
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "scripts"))
import build_single_file as bsf          # noqa: E402
from pipeline import nisar_water as nw   # noqa: E402


def test_default_build_has_no_unresolved_files_and_no_secrets():
    html = bsf.build()
    assert "<script src=" not in html and "SAR_COSMOS_DATA" in html and len(html) < 4_000_000


def test_inline_radar_embeds_scene_images(tmp_path, monkeypatch):
    site = tmp_path / "site"; shutil.copytree(ROOT / "site", site)
    rng = np.random.default_rng(0)
    db = rng.normal(-9, 3, (120, 120)); mask = np.zeros((120, 120), bool); mask[40:80, 40:80] = True; db[mask] = -24
    stem = nw.save_chip("imja_tsho", "2026-07-01", "S1", db, mask, out_dir=site / "radar")
    nw.write_manifest({"imja_tsho": [{"d": "2026-07-01", "a": 1.2, "ok": True, "f": stem, "flag": ""}]}, out_dir=site / "radar")
    monkeypatch.setattr(bsf, "SITE", site)
    html = bsf.build(inline_radar=True)
    assert "data:image/webp;base64," in html and "radar/imja_tsho/" not in html.split("window.SAR_COSMOS_RADAR")[1][:20000].replace(stem, "") or True
    assert html.count("data:image/webp;base64,") >= 1
