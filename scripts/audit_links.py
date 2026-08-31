#!/usr/bin/env python3
"""Audit cross-file links: does the target file exist, and does the #anchor exist in it?

audit_guides.py only validates same-page `href="#id"` anchors, so a link to
another page that was renamed or never created stays invisible (that is how
`perf-debug/perf_landscape.html` was referenced from three pages for a while
without anyone noticing).

The whole site is at zero, so any finding is a hard failure. Pass directory
names as arguments to scope the run while working on one area.
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]

SKIP_TOP = {".cursor", ".private", "assets", "tools", "scripts", "node_modules", ".git"}

HREF = re.compile(r'href="([^"#][^"]*?)(#[^"]*)?"')
ID = re.compile(r'\bid="([^"]+)"')

EXTERNAL = ("http://", "https://", "mailto:", "javascript:", "data:", "tel:", "//")


def is_dynamic(href: str) -> bool:
    """Skip hrefs built by JS at runtime (template strings / concatenation)."""
    return any(tok in href for tok in ("${", "'+", '"+', "<%"))


def audit(path: Path, id_cache: dict[Path, set[str]]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    problems = []
    for raw, frag in HREF.findall(text):
        if raw.startswith(EXTERNAL) or is_dynamic(raw):
            continue
        # query strings are filter params for card pages, not part of the path
        href = unquote(raw.split("?", 1)[0])
        if not href:
            continue
        target = (path.parent / href).resolve()
        if not target.exists():
            problems.append(f"  missing file  {raw}")
            continue
        if frag and len(frag) > 1 and target.suffix == ".html":
            if target not in id_cache:
                id_cache[target] = set(ID.findall(target.read_text(encoding="utf-8")))
            if frag[1:] not in id_cache[target]:
                problems.append(f"  missing anchor  {raw}{frag}")
    return problems


def content_html(dirs: list[str] | None):
    if dirs:
        for d in dirs:
            yield from sorted((ROOT / d).rglob("*.html"))
        return
    for path in sorted(ROOT.rglob("*.html")):
        parts = path.relative_to(ROOT).parts
        if parts and parts[0] in SKIP_TOP:
            continue
        yield path


def main(argv: list[str]) -> int:
    id_cache: dict[Path, set[str]] = {}
    per_dir: Counter[str] = Counter()
    total = 0
    for path in content_html(argv or None):
        problems = audit(path, id_cache)
        if not problems:
            continue
        rel = path.relative_to(ROOT)
        print(f"[{rel.as_posix()}]")
        for p in problems:
            print(p)
        total += len(problems)
        per_dir[rel.parts[0] if len(rel.parts) > 1 else "."] += len(problems)

    print(f"\nTotal problems: {total}")
    if per_dir:
        print("problems per directory:", dict(per_dir))
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
