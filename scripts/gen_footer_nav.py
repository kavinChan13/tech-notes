#!/usr/bin/env python3
"""Add the page-tail 上一篇 / 下一篇 / 相关 / 目录 / 主页 nav to notes missing it.

Directory pages and the home page are *indexes*; they are not context. A reader
who finishes `bigdata/spark_internals.html` has nowhere to go without first
navigating back out, and 343 of 465 notes ended like that — 0% coverage in
interview / neural-networks / pm / reinforcement, 3% in ai-native (6 of 185,
the largest folder on the site).

The ordering is not invented here: it is read from `<topic>_directory.html`,
where the cards are already curated and grouped into `.sec` sections. Previous
and next therefore mean "previous and next in the reading order the directory
lays out", and siblings come from the same section rather than from a guess.

Pages that already carry a `.footer-nav` are left alone — several were written
by hand with genuinely cross-topic links, which are better than anything
derivable from a listing.

Usage:
    python scripts/gen_footer_nav.py --dry-run     # report only
    python scripts/gen_footer_nav.py               # write
    python scripts/gen_footer_nav.py system cpp    # limit to some folders
"""
from __future__ import annotations

import html as html_lib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_dirs  # noqa: E402

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
SEC_SPLIT = re.compile(r'<section class="sec"', re.I)
ITEM_RE = re.compile(
    r'<div class="item"[^>]*>[\s\S]*?<a class="title" href="([^"]+)"[^>]*>([\s\S]*?)</a>',
    re.I)
SEC_H2_RE = re.compile(r"<h2[^>]*>([\s\S]*?)</h2>", re.I)

# Where the block goes: after the last </section> inside <main>, before </main>.
MAIN_CLOSE_RE = re.compile(r"\n?([ \t]*)</main>")

MAX_SIBLINGS = 3


def text_of(fragment: str) -> str:
    return WS_RE.sub(" ", html_lib.unescape(TAG_RE.sub(" ", fragment))).strip()


def read_directory(dir_page: Path) -> list[list[tuple[str, str]]]:
    """Cards grouped by `.sec`, in document order: [[(href, title), ...], ...]."""
    src = dir_page.read_text(encoding="utf-8")
    main = src.split("<main", 1)[-1]
    chunks = SEC_SPLIT.split(main)
    groups: list[list[tuple[str, str]]] = []
    for chunk in chunks:
        cards = [
            (m.group(1).split("#")[0].split("?")[0], text_of(m.group(2)))
            for m in ITEM_RE.finditer(chunk)
        ]
        if cards:
            groups.append(cards)
    return groups


def study_path(folder: str) -> str | None:
    paths = sorted((ROOT / folder).glob("*_study_path.html"))
    return paths[0].name if paths else None


def build_block(indent: str, links: list[tuple[str, str]]) -> str:
    inner = "".join(f'{indent}  <a href="{h}">{html_lib.escape(t)}</a>\n' for h, t in links)
    return f'{indent}<div class="footer-nav">\n{inner}{indent}</div>\n'


def href_between(src: Path, dst: Path) -> str:
    """Relative href from one page to another, forward slashes.

    Needed because a directory page may list notes in another folder:
    `pm/` and `stl/` have no directory page of their own and hang off
    `management/` and `cpp/`. Assuming same-folder links would have silently
    produced 24 broken ones.
    """
    if src.parent == dst.parent:
        return dst.name
    ups = "../" * (len(src.relative_to(ROOT).parts) - 1)
    return ups + dst.relative_to(ROOT).as_posix()


def plan(folder: str) -> tuple[list[tuple[Path, list[tuple[str, str]]]], list[str]]:
    dir_pages = sorted((ROOT / folder).glob("*_directory.html"))
    notes: list[tuple[Path, list[tuple[str, str]]]] = []
    skipped: list[str] = []
    if not dir_pages:
        return notes, []
    dir_page = dir_pages[0]
    groups = read_directory(dir_page)

    for gi, cards in enumerate(groups):
        resolved = [((ROOT / folder / h).resolve(), t) for h, t in cards]
        for ci, (page, title) in enumerate(resolved):
            if not page.is_file():
                skipped.append(f"{dir_page.name} card -> {cards[ci][0]} does not exist")
                continue
            text = page.read_text(encoding="utf-8", errors="ignore")
            if "footer-nav" in text:
                continue
            if not MAIN_CLOSE_RE.search(text):
                skipped.append(f"{page.relative_to(ROOT).as_posix()}: no </main> to insert before")
                continue

            def link(target: Path, label: str) -> tuple[str, str]:
                return href_between(page, target), label

            links: list[tuple[str, str]] = []
            if ci > 0:
                links.append(link(resolved[ci - 1][0], f"← 上一篇 · {resolved[ci - 1][1]}"))
            if ci + 1 < len(resolved):
                links.append(link(resolved[ci + 1][0], f"下一篇 · {resolved[ci + 1][1]} →"))
            # Siblings from this section, nearest first, skipping prev/next.
            skip_idx = {ci - 1, ci, ci + 1}
            near = sorted(
                (i for i in range(len(resolved)) if i not in skip_idx),
                key=lambda i: abs(i - ci))
            for i in near[:MAX_SIBLINGS]:
                if resolved[i][0].is_file():
                    links.append(link(resolved[i][0], f"相关 · {resolved[i][1]}"))
            # A one-card section gives no siblings; fall back to the next section.
            if len(links) < 2 and gi + 1 < len(groups):
                for h, t in groups[gi + 1][:2]:
                    nxt = (ROOT / folder / h).resolve()
                    if nxt != page and nxt.is_file():
                        links.append(link(nxt, f"相关 · {t}"))

            sp = study_path(page.parent.name)
            if sp and (page.parent / sp) != page:
                links.append(link(page.parent / sp, "学习路径"))
            links.append(link(dir_page, "目录"))
            links.append((href_between(page, ROOT / "index.html"), "主页"))
            notes.append((page, links))
    return notes, skipped


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    folders = [a for a in argv if not a.startswith("--")] or content_dirs()

    total = 0
    problems: list[str] = []
    for folder in folders:
        notes, skipped = plan(folder)
        problems += skipped
        if notes:
            print(f"{folder}: +{len(notes)} footer-nav")
        for page, links in notes:
            total += 1
            if dry:
                continue
            text = page.read_text(encoding="utf-8")
            m = MAIN_CLOSE_RE.search(text)
            indent = m.group(1) + "  " if m.group(1) else "  "
            block = build_block(indent, links)
            text = text[:m.start()] + "\n" + block + m.group(1) + "</main>" + text[m.end():]
            page.write_text(text, encoding="utf-8", newline="\n")

    for p in problems:
        print(f"  skip {p}")
    print(f"\n{'Would add' if dry else 'Added'} {total} footer-nav block(s); "
          f"{len(problems)} skipped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
