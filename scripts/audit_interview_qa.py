#!/usr/bin/env python3
"""Audit the canonical interview-Q&A format (see .cursor/rules/interview-qa-format.mdc).

Checks, per content directory:
  1. every <details class="qa"> sits inside <ol class="qa-list"> > <li>;
  2. its <summary> opens with a level badge <span class="lvl ...">;
  3. it holds a single answer container <div class="ans">;
  4. summaries do not hand-number questions ("Q1:" / "1." prefixes);
  5. no legacy non-collapsible layouts remain (div.qa>div.q, card/phase-card
     + <h4>Qn:</h4>, div.box.q + prose, bare <details><summary>Qn:</summary>);
  6. pages do not redefine the shared .qa / .qa-list / .lvl / .ans styles inline.

`details.qa.standalone` marks a collapsible that reuses the Q&A chrome without
being part of a numbered question set (a single Q&A in prose, a case-study
list). It is exempt from 1 and 2, but a hand-numbered "Qn" summary still fails:
that is an interview question dodging the list.

Usage:
    python scripts/audit_interview_qa.py                  # gate: the migrated dirs
    python scripts/audit_interview_qa.py --all            # survey the whole backlog
    python scripts/audit_interview_qa.py ai-infra         # one directory
    python scripts/audit_interview_qa.py --migrated stl   # also fail on legacy layouts
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CONTENT_DIRS = ["cpp", "stl", "perf-debug", "architect", "system", "ai-infra",
                "bigdata", "embedded-realtime", "ai-native", "neural-networks",
                "reinforcement", "communication", "desktop-gui"]

# Directories whose interview sections are already migrated: legacy layouts
# found there are hard failures rather than "not yet converted".
MIGRATED_DIRS = {"cpp", "perf-debug", "stl", "desktop-gui"}

LEVELS = {"basic": "基础", "principle": "原理", "mid": "中级", "pro": "进阶",
          "adv": "高级", "eng": "工程", "expert": "专家", "risk": "安全"}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}

NUMBERED = re.compile(r"^\s*(?:Q\s*\d+|\d+)\s*[:：.、)]")

LEGACY = [
    (re.compile(r'<div class="qa">\s*<div class="q">'), "div.qa > div.q (not collapsible)"),
    (re.compile(r'<div class="(?:card|phase-card)"[^>]*>\s*<h4>Q\d+\s*[:：]'), "card + <h4>Qn:</h4>"),
    (re.compile(r"<details>\s*<summary>(?:<[^>]+>\s*)*Q\d+\s*[:：.、]"), "bare <details> without .qa"),
    (re.compile(r'<span class="lvl pill'), "legacy '.lvl pill <colour>' badge"),
    (re.compile(r'<span class="lvl"[^>]*style='), "level badge with a hard-coded colour"),
]

# A `.box.q` is a legitimate inline "面试问" callout. What is not allowed is a run
# of one-line `.box.q` questions each answered by the paragraph right below —
# that is the old flat, non-collapsible Q&A list.
BOX_Q_LIST = re.compile(r'^[ \t]*<div class="box q">[^\n]*</div>[ \t]*\n[ \t]*<p[ >]', re.M)
BOX_Q_LIST_MIN = 3

INLINE_STYLE = re.compile(r"<style\b.*?</style>", re.S)
INLINE_DUPE = re.compile(r"^\s*(?:ol\.)?(?:details\.)?\.?qa-list\b|"
                         r"^\s*details\.qa\b|^\s*\.qa\s*[.{>]|^\s*\.qa\s+\.(?:q|lvl|ans|a)\b",
                         re.M)


class QAParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, list[str]]] = []
        self.problems: list[str] = []
        self.levels: Counter[str] = Counter()
        self.count = 0
        self.standalone = 0
        self._state: str | None = None
        self._line = 0
        self._ans = 0
        self._loose = False
        self._text: list[str] = []

    @staticmethod
    def _cls(attrs) -> list[str]:
        return (dict(attrs).get("class") or "").split()

    def handle_starttag(self, tag, attrs):
        cls = self._cls(attrs)
        if tag == "details" and "qa" in cls:
            self._loose = "standalone" in cls
            if self._loose:
                self.standalone += 1
            else:
                self.count += 1
            self._state, self._line, self._ans, self._text = "open", self.getpos()[0], 0, []
            chain = [t for t, _ in self.stack[-2:]]
            ol_cls = self.stack[-2][1] if len(self.stack) >= 2 else []
            if not self._loose and (chain != ["ol", "li"] or "qa-list" not in ol_cls):
                self.problems.append(
                    f"line {self._line}: details.qa not wrapped in <ol class=\"qa-list\"><li> (got {chain or 'nothing'})")
        elif self._state == "open" and tag == "summary":
            self._state = "summary"
        elif self._state == "summary" and tag == "span" and "lvl" in cls:
            named = [c for c in cls if c in LEVELS]
            if len(named) != 1:
                self.problems.append(
                    f"line {self.getpos()[0]}: .lvl badge needs exactly one level class, got {cls}")
            else:
                self.levels[named[0]] += 1
            self._state = "badged"
        elif self._state == "summary":
            if not self._loose:
                self.problems.append(
                    f"line {self._line}: <summary> does not start with a <span class=\"lvl …\"> badge")
            self._state = "badged"
        elif self._state in ("badged", "body") and tag == "div" and "ans" in cls:
            if len(self.stack) and self.stack[-1][0] == "details":
                self._ans += 1
        if tag not in VOID:
            self.stack.append((tag, cls))

    def handle_data(self, data):
        if self._state == "summary" and data.strip():
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if tag == "summary" and self._state in ("summary", "badged"):
            head = "".join(self._text).strip()
            if NUMBERED.match(head):
                self.problems.append(
                    f"line {self._line}: summary hand-numbers the question ({head[:16]!r}); "
                    "let <ol class=\"qa-list\"> number it"
                    + (" (drop .standalone and add it to the set)" if self._loose else ""))
            self._state = "body"
        elif tag == "details" and self._state is not None:
            if self._state == "open":
                self.problems.append(f"line {self._line}: details.qa without <summary>")
            elif self._ans != 1:
                self.problems.append(
                    f"line {self._line}: details.qa holds {self._ans} <div class=\"ans\"> (want exactly 1)")
            self._state = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return


def audit(path: Path, strict: bool) -> tuple[list[str], int, int, Counter]:
    text = path.read_text(encoding="utf-8")
    parser = QAParser()
    parser.feed(text)
    parser.close()
    problems = list(parser.problems)

    if strict:
        for pattern, label in LEGACY:
            n = len(pattern.findall(text))
            if n:
                problems.append(f"legacy interview layout x{n}: {label}")
        n = len(BOX_Q_LIST.findall(text))
        if n >= BOX_Q_LIST_MIN:
            problems.append(
                f"legacy interview layout x{n}: div.box.q + <p> used as a Q&A list")

    if parser.count:
        for block in INLINE_STYLE.findall(text):
            hit = INLINE_DUPE.search(block)
            if hit:
                problems.append(
                    f"inline <style> redefines shared Q&A styles ({hit.group(0).strip()}); "
                    "keep them in assets/article.css §4")
                break
    return problems, parser.count, parser.standalone, parser.levels


def main(argv: list[str]) -> int:
    strict_extra: set[str] = set()
    dirs: list[str] = []
    scan_all = False
    it = iter(argv)
    for arg in it:
        if arg == "--migrated":
            strict_extra.add(next(it))
        elif arg == "--all":
            scan_all = True
        else:
            dirs.append(arg)
    if not dirs:
        # default to the gate: directories that are supposed to be clean already
        dirs = CONTENT_DIRS if scan_all else sorted(MIGRATED_DIRS)

    total_problems = total_q = total_loose = 0
    for d in dirs:
        strict = d in MIGRATED_DIRS or d in strict_extra
        for path in sorted((ROOT / d).glob("*.html")):
            problems, n, loose, levels = audit(path, strict)
            if not problems and not n and not loose:
                continue
            rel = path.relative_to(ROOT).as_posix()
            summary = ", ".join(f"{LEVELS[k]} {v}" for k, v in sorted(levels.items()))
            extra = f" + {loose} standalone" if loose else ""
            print(f"[{rel}] {n} question(s){extra}" + (f" — {summary}" if summary else ""))
            for p in problems:
                print(f"  {p}")
            total_problems += len(problems)
            total_q += n
            total_loose += loose

    print(f"\n{total_q} interview questions ({total_loose} standalone), "
          f"Total problems: {total_problems}")
    return 1 if total_problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
