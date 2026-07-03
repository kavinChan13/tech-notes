#!/usr/bin/env python3
"""Generate full TOC nav from chapter/section headings in architect HTML guides."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "architect/architecture_methodology.html",
    ROOT / "architect/architect_capstone.html",
    ROOT / "architect/large_scale_engineering.html",
    ROOT / "architect/observability_engineering.html",
    ROOT / "architect/storage_and_data_architecture.html",
    ROOT / "architect/distributed_systems_fundamentals.html",
]

CHAPTER_RE = re.compile(
    r'<section class="chapter" id="(ch\d+)">\s*'
    r'<div class="ch-head">.*?<h2>([^<]+)</h2>',
    re.DOTALL,
)
H3_RE = re.compile(r'<h3 id="(ch\d+-\d+)">([^<]+)</h3>')
NAV_RE = re.compile(
    r'(<aside class="toc">.*?<nav>\s*<ol>)(.*?)(</ol>\s*</nav>)',
    re.DOTALL,
)
INTERVIEW_RE = re.compile(
    r'<section class="chapter" id="(?:ch-)?interview">.*?<h2[^>]*>([^<]+)</h2>',
    re.DOTALL,
)


def strip_num(title: str) -> str:
    return re.sub(r"^\d+\.\d+\s+", "", title.strip())


def build_toc(html: str) -> str:
    chapters: list[tuple[str, str, list[tuple[str, str]]]] = []
    for m in CHAPTER_RE.finditer(html):
        cid, title = m.group(1), m.group(2).strip()
        start = m.end()
        next_ch = CHAPTER_RE.search(html, start)
        end = next_ch.start() if next_ch else len(html)
        subs = [(sid, strip_num(st)) for sid, st in H3_RE.findall(html[start:end])]
        chapters.append((cid, title, subs))

    lines = []
    for cid, title, subs in chapters:
        lines.append(f'        <li><a href="#{cid}">{title}</a>')
        if subs:
            lines.append("          <ol>")
            for sid, st in subs:
                lines.append(f'            <li><a href="#{sid}">{st}</a></li>')
            lines.append("          </ol>")
        lines.append("        </li>")

    im = INTERVIEW_RE.search(html)
    if im:
        lines.append(f'        <li><a href="#ch-interview">{im.group(1).strip()}</a></li>')

    return "\n".join(lines) + "\n"


def patch_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    toc_body = build_toc(text)
    m = NAV_RE.search(text)
    if not m:
        raise SystemExit(f"no nav in {path}")
    new_text = NAV_RE.sub(lambda m: m.group(1) + "\n" + toc_body + "      " + m.group(3), text, count=1)
    path.write_text(new_text, encoding="utf-8")
    n_ch = len(CHAPTER_RE.findall(text))
    print(f"{path.name}: {n_ch} chapters, TOC updated")


def main() -> None:
    for p in FILES:
        patch_file(p)


if __name__ == "__main__":
    main()
