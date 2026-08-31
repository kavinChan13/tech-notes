#!/usr/bin/env python3
"""Audit block-tag nesting in content pages.

Catches the defects that silently break a page's layout:
  * an orphan `</div>` that closes `<main>` / `.layout` early (a leftover from
    an older shell) — everything below it renders outside the article column;
  * a tag that is never closed (`<strong>`, `<a>`, `<span>` …) — its styling
    bleeds into the rest of the page;
  * unescaped markup inside `<pre>` / prose (`<algorithm>`, `<unfinished ...>`)
    which the browser parses as a real tag.

Usage:
    python scripts/audit_html_nesting.py                  # every content dir
    python scripts/audit_html_nesting.py cpp perf-debug   # only these

Topic folders are discovered from the filesystem (scripts/_site.py), so a new
one is covered automatically. CLEAN_DIRS is the opt-in list of directories that
must stay at zero; anything outside it is reported but does not fail the run.
"""
from __future__ import annotations

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


def audit(path: Path) -> list[str]:
    parser = NestingParser()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    parser.close()
    return parser.problems


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
