# Changelog

## 0.9 (November 2026, pre-event build)
- Website rebuilt as a 3D scene: generated Himalaya, six lakes, NISAR orbit, scroll-driven camera story.
- Optical and radar views with a scanning wipe; observation calendar built from published measurement dates.
- Lake panel: growth, radar scene viewer with water outline, downstream facts (public sources only), fact sheets.
- Cosmo: offline brain (general knowledge, lake answers, writing and documents, calculator), AI mode when opened inside a supported viewer, an optional AI proxy and an optional deep offline model.
- Data honesty: the site shows only published or pipeline results, never synthetic numbers. Tests enforce this.
- Removed unverified claims: flood arrival times, populations, the USD 9B figure, invented downstream volumes.
- Landsat pipeline (Landsat 5, 7, 8, 9) and NISAR GCOV pipeline with single-patch radar shadow rejection.
- Validation against published areas; validation refuses to run on placeholder data.
- One-command pipeline runner with preflight and per-step logs (`scripts/run_real_pipeline.py`).
- Secret-free publish check (`scripts/deploy_to_github.py --check-only`).

## 0.1 (earlier prototype)
- Streamlit dashboard and the first synthetic-data pipeline (retired).
