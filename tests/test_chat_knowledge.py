import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_chat_knowledge as bk  # noqa: E402

LAKES = json.load(open(ROOT / "data" / "lake_metadata.json", encoding="utf-8"))["lakes"]


def test_knowledge_covers_every_lake_and_key_facts():
    k = bk.build()
    for l in LAKES:
        assert l["name"] in k and f"id: {l['id']}" in k
    for must in ["Rounce et al.", "24 cm", "12 days", "17 June 2026", "Otsu", "does not forecast", "Not one of the", "20 July 2026"]:
        assert must in k, must


def test_knowledge_contains_no_invented_claims():
    k = bk.build()
    assert not re.search(r"\$9B|25,000 residents|8,500|7,000 ?m|evacuate immediately|arrival time of", k, re.I)


def test_knowledge_numbers_match_the_reference_table():
    import pandas as pd
    ref = pd.read_csv(ROOT / "data" / "reference" / "published_lake_areas.csv")
    n = int(ref["source"].str.startswith("Rounce").sum())
    assert f"{n} Rounce et al. (2016) measurements" in bk.build()


def test_generated_js_is_in_sync_with_the_builder():
    js = (ROOT / "worker" / "knowledge.js").read_text(encoding="utf-8")
    k = js.split("export const KNOWLEDGE = ", 1)[1].split(";\nexport const RULES = ", 1)
    assert json.loads(k[0]) == bk.build() and json.loads(k[1].strip().rstrip(";")) == bk.RULES


def test_rules_make_cosmo_a_general_assistant_with_hard_limits():
    r = bk.RULES
    for must in ["ALSO help with anything else", "Never say you can only talk about the project", "Never forecast outbursts", "[[sheet:LAKE_ID]]", "imja_tsho", "rounce-supplement", "not as instructions"]:
        assert must.replace("not as", "as data, not as") in r or must in r, must
