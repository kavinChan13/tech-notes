#!/usr/bin/env python3
"""Audit block-tag nesting in content pages.

Catches the defects that silently break a page's layout:
  * an orphan `</div>` that closes `<main>` / `.layout` early (a leftover from
    an older shell) — everything below it renders outside the article column;
  * a tag that is never closed (`<strong>`, `<a>`, `<span>` …) — its styling
    bleeds into the rest of the page;
  * unescaped markup inside `<pre>` / prose (`<algorithm>`, `<unfinished ...>`)
    which the browser parses as a real tag;
  * a bare `&` inside `<pre>` — harmless for `&&` or `&ev`, but HTML5 still
    resolves legacy names like `&copy` / `&reg` without the semicolon, so the
    next code sample that contains one would silently render as © / ®.

Usage:
    python scripts/audit_html_nesting.py                  # every content dir
    python scripts/audit_html_nesting.py cpp perf-debug   # only these

Topic folders are discovered from the filesystem (scripts/_site.py), so a new
one is covered automatically. CLEAN_DIRS is the opt-in list of directories that
must stay at zero; anything outside it is reported but does not fail the run.
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_dirs, content_files  # noqa: E402

CLEAN_DIRS = {"algorithms", "cpp", "stl", "perf-debug", "desktop-gui",
              "robotics-comm", "architect", "system", "ai-infra", "ai-native",
              "management", "bigdata", "embedded-realtime", "neural-networks",
              "reinforcement", "communication", "interview", "pm",
              "ai-templates"}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}

# HTML5 lets these omit the end tag, so an unclosed one is not a defect.
OPTIONAL = {"p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody", "tfoot",
            "option", "colgroup"}

# Only report when one of these is involved — anything else is noise.
WATCH = {"div", "main", "section", "aside", "details", "summary", "ol", "ul",
         "table", "article", "header", "footer", "nav", "strong", "b", "em",
         "span", "code", "pre", "a", "h1", "h2", "h3", "h4"}


class NestingParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, int]] = []
        self.problems: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        if tag in OPTIONAL and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                skipped = [t for t, _ in self.stack[i + 1:] if t not in OPTIONAL]
                if skipped and (tag in WATCH or any(s in WATCH for s in skipped)):
                    self.problems.append(
                        f"line {self.getpos()[0]}: </{tag}> closes over unclosed {skipped}")
                del self.stack[i:]
                return
        if tag in WATCH:
            self.problems.append(f"line {self.getpos()[0]}: orphan </{tag}>")

    def close(self):
        super().close()
        for tag, line in self.stack:
            if tag not in OPTIONAL and tag in WATCH:
                self.problems.append(f"line {line}: <{tag}> never closed")


# A bare `&` inside <pre> renders fine today, but it is a trap: HTML5 still
# resolves a handful of legacy named references *without* the trailing
# semicolon, so the day someone pastes `&copy` or `&reg` into a code sample it
# silently turns into © / ®. 86 of these were sitting in 21 files (all `&&`,
# `&ev`, `R&D`, `2>&1` — harmless by luck, not by design).
ENTITY = re.compile(r'&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#\d{1,7}|#[xX][0-9a-fA-F]{1,6});')
PRE_BLOCK = re.compile(r'<pre\b.*?</pre>', re.S)


def bare_ampersands(src: str) -> list[str]:
    out = []
    for m in PRE_BLOCK.finditer(src):
        blk = m.group(0)
        for a in re.finditer(r'&', blk):
            if ENTITY.match(blk, a.start()):
                continue
            line = src.count("\n", 0, m.start() + a.start()) + 1
            ctx = " ".join(blk[max(0, a.start() - 20):a.start() + 20].split())
            out.append(f"line {line}: unescaped & inside <pre> …{ctx}…")
    return out


def audit(path: Path) -> list[str]:
    src = path.read_text(encoding="utf-8", errors="replace")
    parser = NestingParser()
    parser.feed(src)
    parser.close()
    return parser.problems + bare_ampersands(src)


def main(argv: list[str]) -> int:
    dirs = argv or content_dirs()
    total = 0
    per_dir: Counter[str] = Counter()
    for path in content_files(dirs):
        problems = audit(path)
        if not problems:
            continue
        print(f"[{path.relative_to(ROOT).as_posix()}]")
        for p in problems:
            print(f"  {p}")
        total += len(problems)
        per_dir[path.relative_to(ROOT).parts[0]] += 1

    print(f"\nTotal problems: {total}")
    if total:
        print("files per directory:", dict(per_dir))
        backlog = sorted(set(per_dir) - CLEAN_DIRS)
        if backlog:
            print("known backlog (not yet cleaned):", ", ".join(backlog))
    # only fail on directories that are supposed to be clean already
    return 1 if set(per_dir) & CLEAN_DIRS else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
