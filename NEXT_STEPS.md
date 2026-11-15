# What is left

Everything in the repository is finished except one thing: **the real satellite run**.

## The only remaining step
Follow [`RUN_ON_LAPTOP.md`](RUN_ON_LAPTOP.md). It takes one command after setup:

    python scripts/run_real_pipeline.py --project YOUR-GCP-PROJECT-ID

It checks the setup, runs Landsat and NISAR for every lake, validates against published numbers, rebuilds the
site, and stops with a log file if anything fails. When it finishes, the lake panel reads
"Landsat and NISAR pipeline" and the radar tab fills with real scenes.

## Before the event (you, not the code)
- Confirm the Lumding and Hongu coordinates (`--verify-positions` reports them as part of the run).
- Choose a licence for the repository.
- Decide the team's Space Apps submission text from `docs/submission_text.md`, using only the real numbers.

## At the event (team)
- Fix anything the real run reveals, rerun the affected step, and rebuild.
- Final check of the single-file site on a PC and a phone.
- Publish the repository only after the rules check is complete.
