#!/usr/bin/env python3
"""Audit guide HTML: TOC anchor integrity, <details> well-formedness, scroll-spy selector."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ARCHITECT = sorted((ROOT / "architect").glob("*.html"))
EDITED_P12 = [
    ROOT / "ai-infra/inference_serving.html",
    ROOT / "perf-debug/crash_debugging_guide.html",
    ROOT / "system/async_networking_guide.html",
    ROOT / "architect/large_scale_engineering.html",
    ROOT / "architect/observability_engineering.html",
    ROOT / "architect/storage_and_data_architecture.html",
]

ID_RE = re.compile(r'\bid="([^"]+)"')
HREF_RE = re.compile(r'href="#([^"]+)"')
DETAILS_OPEN = re.compile(r"<details\b")
DETAILS_CLOSE = re.compile(r"</details>")
SUMMARY = re.compile(r"<summary\b")


def audit_anchors(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    ids = set(ID_RE.findall(text))
    problems = []
    for href in HREF_RE.findall(text):
        if not href:
            continue
        # skip JS-constructed anchors (template strings / concatenations)
        if any(tok in href for tok in ("'", '"', "${", "+", " ")):
            continue
        if href not in ids:
            problems.append(f"  broken anchor #{href}")
    return problems


def audit_details(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    n_open = len(DETAILS_OPEN.findall(text))
    n_close = len(DETAILS_CLOSE.findall(text))
    problems = []
    if n_open != n_close:
        problems.append(f"  details open={n_open} close={n_close} (mismatch)")
    # every interview-card details should contain a <summary>
    for m in re.finditer(r'<details class="interview-card">(.*?)</details>', text, re.DOTALL):
        if "<summary" not in m.group(1):
            problems.append("  interview-card details without <summary>")
    return problems


def audit_scrollspy(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    problems = []
    uses_toc_dom = 'class="toc"' in text or "aside.toc" in text or "class='toc'" in text
    m = re.search(r"querySelectorAll\(['\"]\.sidebar a['\"]\)", text)
    if m and uses_toc_dom:
        problems.append("  scroll-spy queries '.sidebar a' but DOM uses .toc")
    return problems


def audit_leftover(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    problems = []
    if "AADR" in text:
        problems.append("  contains 'AADR' (double-prefix bug)")
    return problems


CONTENT_DIRS = ["architect", "cpp", "system", "perf-debug", "ai-infra", "bigdata",
                 "stl", "embedded-realtime"]


def main() -> None:
    all_files = sorted(
        {p for d in CONTENT_DIRS for p in (ROOT / d).glob("*.html")}
    )
    total = 0
    for path in all_files:
        probs = []
        probs += audit_anchors(path)
        probs += audit_details(path)
        probs += audit_scrollspy(path)
        probs += audit_leftover(path)
        if probs:
            print(f"[{path.relative_to(ROOT)}]")
            for p in probs:
                print(p)
            total += len(probs)
    print(f"\nTotal problems: {total}")


if __name__ == "__main__":
    main()
