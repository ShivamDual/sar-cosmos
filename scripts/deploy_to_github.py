"""
Publish this project to GitHub WITHOUT any secret living in a file.

How sign-in works now: git itself handles it. On Windows, Git Credential Manager
opens a browser window the first time you push. Or install the GitHub CLI and run
`gh auth login` once. You never paste a token into this project.

Before it pushes anything, this script scans every file that would be uploaded for
things that look like secrets (GitHub tokens, Google API keys, Earthdata JWTs,
private keys, "TOKEN=..." lines). If it finds one it stops and tells you where.

    python scripts/deploy_to_github.py --check-only      # just scan, push nothing
    python scripts/deploy_to_github.py                    # scan, commit, push
    python scripts/deploy_to_github.py --repo https://github.com/ShivamDual/sar-cosmos.git
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REPO = "https://github.com/ShivamDual/sar-cosmos.git"

SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".pytest_cache", "fonts", "vendor", "raw"}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2", ".zip", ".h5", ".pdf", ".ico"}

SECRET_PATTERNS = [
    ("GitHub token", re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_\-]{30,}\b")),
    ("Generic AI provider key", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("JWT (Earthdata tokens look like this)", re.compile(r"\beyJ[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{15,}\.[A-Za-z0-9_\-]{15,}\b")),
    ("Private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("Credential assigned in code",
     re.compile(r"(?i)\b(token|password|passwd|secret|api[_-]?key)\b\s*[:=]\s*['\"][A-Za-z0-9_\-./+]{12,}['\"]")),
]


def iter_files(root: Path):
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(root).parts):
            continue
        if p.suffix.lower() in SKIP_SUFFIXES or p.stat().st_size > 2_000_000:
            continue
        yield p


def scan_for_secrets(root: Path = ROOT) -> list[tuple[str, int, str]]:
    """Return (relative path, line number, kind) for every suspected secret. Values are never returned."""
    hits = []
    for p in iter_files(root):
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for n, line in enumerate(text.splitlines(), 1):
            for kind, rx in SECRET_PATTERNS:
                if rx.search(line):
                    hits.append((str(p.relative_to(root)), n, kind))
    return hits


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("  $", " ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT, check=check, text=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", default=DEFAULT_REPO)
    ap.add_argument("--message", default="SAR Cosmos")
    ap.add_argument("--check-only", action="store_true")
    a = ap.parse_args()

    hits = scan_for_secrets()
    if hits:
        print("STOP: possible secrets found. Nothing was pushed.\n")
        for path, line, kind in hits:
            print(f"  {path}:{line}   {kind}")
        print("\nRemove them (use environment variables), REVOKE anything that was ever real, then run again.")
        sys.exit(1)
    print("Secret scan clean.")
    if a.check_only:
        return

    if not (ROOT / ".git").exists():
        run(["git", "init"])
    run(["git", "add", "-A"])
    run(["git", "commit", "-m", a.message], check=False)       # fine if there is nothing new to commit
    have_origin = subprocess.run(["git", "remote"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    if "origin" not in have_origin:
        run(["git", "remote", "add", "origin", a.repo])
    run(["git", "branch", "-M", "main"])
    r = run(["git", "push", "-u", "origin", "main"], check=False)
    if r.returncode != 0:
        print("\nPush failed. Most likely you are not signed in. Fix with ONE of:")
        print("  1) install GitHub CLI, then run:  gh auth login")
        print("  2) run the push again and sign in when the browser window opens (Git Credential Manager)")
        sys.exit(r.returncode)
    print("Pushed.")


if __name__ == "__main__":
    main()
