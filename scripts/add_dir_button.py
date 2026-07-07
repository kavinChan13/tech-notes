#!/usr/bin/env python3
"""Inject a "← 目录" link into the unified `#tn-nav` bar of every content article.

Every content article carries the `<!-- tn-nav:v2 -->` nav block (which already has
a "← 主页" link to the site root). This script adds a sibling "← 目录" link pointing
to the article's *domain directory page* (its theme page).

- Idempotent: files that already contain `tn-dir-link` are skipped.
- Directory/theme pages, template galleries and the root index have no
  `tn-nav:v2` block, so they are never touched.
- Template sub-pages (ai-templates/, pm/templates/, management/em-templates/) are
  skipped: their existing "← 主页" already points at their local gallery index.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

NAV_MARKER = "<!-- tn-nav:v2 -->"
NAV_OPEN = '<div id="tn-nav">'
DIR_LINK_CLASS = "tn-dir-link"

# top-level folder -> domain directory page (relative to repo root, posix)
FOLDER_TARGET = {
    "cpp": "cpp/modern_cpp_stl_directory.html",
    "stl": "cpp/modern_cpp_stl_directory.html",
    "ai-native": "ai-native/ai_engineering_directory.html",
    "ai-infra": "ai-infra/ai_infra_directory.html",
    "bigdata": "bigdata/bigdata_directory.html",
    "architect": "architect/system_architecture_directory.html",
    "system": "system/linux_system_directory.html",
    "perf-debug": "perf-debug/perf_debug_directory.html",
    "embedded-realtime": "embedded-realtime/embedded_realtime_directory.html",
    "interview": "interview/interview_directory.html",
    "management": "management/leadership_pm_directory.html",
    "pm": "management/leadership_pm_directory.html",
}

# folders whose sub-pages already return to their theme page via "← 主页"
SKIP_SUBDIRS = {
    ("ai-templates",),
    ("pm", "templates"),
    ("management", "em-templates"),
}


def target_for(rel_parts: tuple[str, ...]) -> str | None:
    """Return the repo-relative target directory page, or None to skip."""
    if not rel_parts:
        return None
    top = rel_parts[0]
    # skip template galleries' sub-pages
    for skip in SKIP_SUBDIRS:
        if rel_parts[: len(skip)] == skip:
            return None
    return FOLDER_TARGET.get(top)


def rel_href(from_file: Path, target_rel: str) -> str:
    import os

    target_abs = ROOT / target_rel
    rel = os.path.relpath(target_abs, start=from_file.parent)
    return rel.replace("\\", "/")


def process(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    if NAV_MARKER not in text:
        return "no-nav"
    if DIR_LINK_CLASS in text:
        return "already"

    rel_parts = path.relative_to(ROOT).parts[:-1]  # drop filename
    target_rel = target_for(rel_parts)
    if target_rel is None:
        return "skip-template"

    href = rel_href(path, target_rel)

    nav_idx = text.find(NAV_OPEN)
    if nav_idx == -1:
        return "no-open-tag"
    close_idx = text.find("</a>", nav_idx)
    if close_idx == -1:
        return "no-home-link"
    insert_at = close_idx + len("</a>")

    snippet = (
        f'\n  <a class="{DIR_LINK_CLASS}" href="{href}" title="返回本主题目录">← 目录</a>'
    )
    new_text = text[:insert_at] + snippet + text[insert_at:]
    path.write_text(new_text, encoding="utf-8", newline="")
    return "modified"


def main() -> None:
    counts: dict[str, int] = {}
    modified: list[str] = []
    for path in sorted(ROOT.rglob("*.html")):
        # never descend into tooling/skill sample dirs
        rel = path.relative_to(ROOT)
        if rel.parts and rel.parts[0] in {".cursor", "assets", "tools", "scripts", "node_modules"}:
            continue
        status = process(path)
        counts[status] = counts.get(status, 0) + 1
        if status == "modified":
            modified.append(str(rel).replace("\\", "/"))

    for name in modified:
        print(f"[modified] {name}")
    print("\n--- summary ---")
    for k in sorted(counts):
        print(f"{k}: {counts[k]}")


if __name__ == "__main__":
    main()
