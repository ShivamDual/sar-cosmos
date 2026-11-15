"""
Bundles the whole site (3D engine, fonts, logo, data, chat) into ONE html file: dist/sar-cosmos-single.html.

Use it to open the site on a phone, send it to someone, or drop it on any host with no folders.
No internet is needed once the file is on the device. Re-run it after you change anything in site/.

    python scripts/build_single_file.py
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE, DIST = ROOT / "site", ROOT / "dist"


def data_uri(path: Path) -> str:
    mime = {".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png"}[path.suffix]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def read(rel: str) -> str:
    return (SITE / rel).read_text(encoding="utf-8")


def safe_js(code: str) -> str:
    return code.replace("</script", "<\\/script")


def radar_manifest_inline() -> str:
    """Manifest with every scene image embedded (grayscale WebP, outline PNG). Keeps the file offline-complete."""
    from PIL import Image
    txt = read("radar/manifest.js")
    m = re.search(r"=\s*(\{.*\})\s*;", txt, re.S)
    if not m:
        return txt
    data = json.loads(m.group(1))
    for scenes in data["lakes"].values():
        for s in scenes:
            chip = Image.open(SITE / (s["f"] + ".png")).convert("L")
            buf = io.BytesIO(); chip.save(buf, "WEBP", quality=72); s["i"] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
            s["m"] = data_uri(SITE / (s["f"] + "_mask.png"))
    return "window.SAR_COSMOS_RADAR = " + json.dumps(data) + ";\n"


def build(inline_radar: bool = False) -> str:
    html = read("index.html")
    logo256, logo640 = data_uri(SITE / "assets" / "logo-256.webp"), data_uri(SITE / "assets" / "logo-640.webp")

    fonts = re.sub(r"url\(\.\./fonts/([^)]+)\)", lambda m: f"url({data_uri(SITE / 'fonts' / m.group(1))})", read("css/fonts.css"))
    css = fonts + "\n" + read("css/style.css")
    html = re.sub(r'<link rel="stylesheet" href="css/fonts.css">\s*<link rel="stylesheet" href="css/style.css">', lambda m: f"<style>{css}</style>", html)
    html = html.replace('<link rel="icon" type="image/png" href="assets/logo-256.webp">', f'<link rel="icon" href="{logo256}">')

    def inline_script(m: re.Match) -> str:
        src = m.group(1)
        code = radar_manifest_inline() if (inline_radar and src == "radar/manifest.js") else read(src)
        code = code.replace("assets/logo-256.webp", logo256).replace("assets/logo-640.webp", logo640)
        return f"<script>{safe_js(code)}</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)
    html = html.replace('src="assets/logo-256.webp"', f'src="{logo256}"').replace('src="assets/logo-640.webp"', f'src="{logo640}"')
    markup = re.sub(r"<(script|style)\b.*?</\1>", "", html, flags=re.S)       # only the page markup, not code strings
    left = re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', markup)
    assert not left, f"unresolved local references: {left}"
    return html


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inline-radar", action="store_true", help="embed radar scene images (bigger file)")
    a = ap.parse_args()
    DIST.mkdir(exist_ok=True)
    out = DIST / "sar-cosmos-single.html"
    out.write_text(build(a.inline_radar), encoding="utf-8")
    print(f"[build_single_file] {out}  ({out.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
