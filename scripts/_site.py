#!/usr/bin/env python3
"""Shared site discovery for the audit / build scripts.

Every audit used to carry its own hardcoded `CONTENT_DIRS` list. Forgetting to
register a new topic folder in one of them was invisible: the audit still
printed `Total problems: 0`, it just never opened a single file in that folder.
Discovery is derived from the filesystem instead, so a new topic folder is
covered the moment it exists.

Only *exclusions* stay explicit, and they are non-content by nature (tooling,
assets, caches), so the list does not grow when notes are added.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Folders that never hold reader-facing notes.
EXCLUDE_DIRS = {
    "assets",
    "scripts",
    "tools",
    "node_modules",
    "__pycache__",
    "dist",
}


def _is_excluded(rel: Path) -> bool:
    parts = rel.parts
    if any(p.startswith(".") for p in parts):
        return True
    return any(p in EXCLUDE_DIRS for p in parts)


def content_dirs() -> list[str]:
    """Top-level folders that contain at least one .html file."""
    found = set()
    for p in ROOT.rglob("*.html"):
        rel = p.relative_to(ROOT)
        if len(rel.parts) < 2 or _is_excluded(rel):
            continue
        found.add(rel.parts[0])
    return sorted(found)


def content_files(dirs: list[str] | None = None, recursive: bool = True) -> list[Path]:
    """Every note .html under the given topic folders (all of them by default)."""
    targets = dirs if dirs else content_dirs()
    out: set[Path] = set()
    for d in targets:
        base = ROOT / d
        if not base.is_dir():
            continue
        for p in base.rglob("*.html") if recursive else base.glob("*.html"):
            rel = p.relative_to(ROOT)
            if _is_excluded(rel):
                continue
            out.add(p)
    # Sort on the posix string so report order is identical on Windows (where
    # Path comparison is case-insensitive) and Linux/CI (where it is not).
    return sorted(out, key=lambda p: p.as_posix())


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


if __name__ == "__main__":
    dirs = content_dirs()
    print(f"{len(dirs)} content dirs:", ", ".join(dirs))
    print(f"{len(content_files())} note files")
