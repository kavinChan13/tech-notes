#!/usr/bin/env python3
"""Audit the reading-time labels on note pages and topic directory cards.

The same number is written in up to three places and used to drift apart
silently, exactly like the article counters in `audit_counts.py`:

  * the article's top bar   -> `.tn-readmeta` ... "N min"
  * the article's hero pill -> "阅读时长 ~N min" / "阅读 ~N min" / "~N min 阅读"
                               / `<div class="meta">…<span>~N min</span>`
  * the directory card      -> `<span>阅读：N 分钟</span>`

Nobody recomputed these after editing a page, so they drifted in *both*
directions. Reverse-engineering the implied "characters per minute" across the
site gave a 29x spread (30/min .. 867/min): skeleton pages claimed 40 minutes
for ten minutes of content, while some 200 KB deep-dives claimed 38 minutes for
what is really a two-hour read.

Estimate
--------
    minutes = 中文字符 / 300  +  <pre> 内字符 / 600     rounded to nearest 5

`中文字符` counts CJK codepoints in the prose after stripping <script>,
<style>, <svg> and <pre>; code is assumed to be skimmed at twice the prose
rate. The two constants were calibrated against the pages whose numbers had
clearly been set by hand and already looked right (system/ipc_guide 32,
system/process_scheduling 40, system/cgroup_namespace_containers 38): the
formula reproduces those within one rounding step.

Study-path pages are out of scope: their hour figures are reading *plus*
hands-on practice, which is legitimately a different (larger) number.

Usage:
    python scripts/audit_read_time.py            # report, non-zero exit on drift
    python scripts/audit_read_time.py --fix      # rewrite the labels in place
    python scripts/audit_read_time.py system     # limit to one topic folder
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_dirs, content_files, rel  # noqa: E402

INDEX = ROOT / "index.html"

PROSE_CPM = 300      # CJK chars per minute, careful technical reading
CODE_CPM = 600       # chars per minute for skimmed code / command blocks
ROUND_TO = 5

NAV = re.compile(r'(tn-readmeta.*?</svg>\s*)(\d+)(\s*min\s*</span>)', re.S)
PILL = re.compile(r'(阅读时长[:：]?\s*~?\s*)(\d+)(\s*min)')
META = re.compile(r'(~\s*)(\d+)(\s*min 阅读)')
# The hero pill has two more spellings that the first version of this script
# did not know about, so a site-wide --fix rewrote the top bar on 266 pages and
# left their hero showing the *old* number -- i.e. it manufactured exactly the
# drift it exists to catch, and then reported "Total problems: 0".
# Keep every spelling here; they are mutually exclusive by construction
# ("阅读时长" is followed by 时长, never by a digit, so PILL2 cannot match it).
PILL2 = re.compile(r'(>\s*阅读\s*~?\s*)(\d+)(\s*min\s*<)')
# `<div class="meta"><span>8 章</span><span>~35 min</span>`. Scoped to the meta
# block: a bare `<span>~35 min</span>` is too generic to rewrite site-wide.
META_BLOCK = re.compile(r'<div class="meta">.*?</div>', re.S)
META_MIN = re.compile(r'(<span>\s*~\s*)(\d+)(\s*min\s*</span>)')
CARD = re.compile(r'<div class="item".*?</div></div>', re.S)
CARD_TIME = re.compile(r'(阅读[：:]\s*)(\d+)(\s*分钟)')
CARD_HREF = re.compile(r'href="\./([^"]+)"')
L_ROW = re.compile(r'<a class="l-row"[\s\S]*?</a>')
L_TIME = re.compile(r'(<span class="l-time">)([^<]*)(</span>)')


def is_note(path: Path) -> bool:
    name = path.name
    return not (name.endswith(("_directory.html", "_study_path.html"))
                or name == "index.html"
                or name == "STUDY_PATH.html")


def estimate(src: str) -> int:
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", src, flags=re.S)
    body = re.sub(r"<svg\b.*?</svg>", "", body, flags=re.S)
    # Navigation is not prose. The page-tail .footer-nav quotes the titles of
    # neighbouring articles, and adding it to 309 pages pushed 18 of them across
    # a rounding step — the estimate has to ignore chrome, or every navigation
    # change silently rewrites reading times.
    body = re.sub(r'<div class="footer-nav">.*?</div>', "", body, flags=re.S)
    body = re.sub(r'<nav class="tn-topnav">.*?</nav>', "", body, flags=re.S)
    body = re.sub(r'<aside class="toc"\b.*?</aside>', "", body, flags=re.S)
    code = "".join(re.findall(r"<pre\b.*?</pre>", body, re.S))
    code_n = len(re.sub(r"\s+", "", re.sub(r"<[^>]+>", "", code)))
    prose = re.sub(r"<pre\b.*?</pre>", "", body, flags=re.S)
    cjk_n = len(re.findall(r"[\u4e00-\u9fff]", re.sub(r"<[^>]+>", "", prose)))
    raw = cjk_n / PROSE_CPM + code_n / CODE_CPM
    return max(ROUND_TO, round(raw / ROUND_TO) * ROUND_TO)


def main(argv: list[str]) -> int:
    fix = "--fix" in argv
    dirs = [a for a in argv if not a.startswith("-")] or content_dirs()

    minutes: dict[str, int] = {}      # "topic/file.html" -> minutes
    problems: list[str] = []
    fixed = 0

    # ---- 1. article pages ------------------------------------------------
    for path in content_files(dirs):
        if not is_note(path):
            continue
        src = path.read_text(encoding="utf-8")
        if "tn-readmeta" not in src:
            continue
        want = estimate(src)
        minutes[rel(path)] = want

        new = src
        stated: list[int] = []
        for pattern in (NAV, PILL, META, PILL2):
            for m in pattern.finditer(new):
                stated.append(int(m.group(2)))
            new = pattern.sub(lambda m: f"{m.group(1)}{want}{m.group(3)}", new)

        def patch_meta(m: re.Match) -> str:
            for hit in META_MIN.finditer(m.group(0)):
                stated.append(int(hit.group(2)))
            return META_MIN.sub(
                lambda t: f"{t.group(1)}{want}{t.group(3)}", m.group(0))

        new = META_BLOCK.sub(patch_meta, new)

        if any(v != want for v in stated):
            shown = "/".join(str(v) for v in dict.fromkeys(stated))
            problems.append(f"  {rel(path)}: 标注 {shown} min, 估算 {want} min")
            if fix and new != src:
                path.write_text(new, encoding="utf-8")
                fixed += 1

    # ---- 2. directory cards ---------------------------------------------
    for d in dirs:
        for dp in sorted((ROOT / d).glob("*_directory.html")):
            src = dp.read_text(encoding="utf-8")
            hits: list[str] = []

            def patch(m: re.Match) -> str:
                block = m.group(0)
                href = CARD_HREF.search(block)
                if not href:
                    return block
                key = f"{d}/{href.group(1)}"
                if key not in minutes:
                    return block
                want = minutes[key]
                cur = CARD_TIME.search(block)
                if cur and int(cur.group(2)) != want:
                    hits.append(f"  {rel(dp)} -> {href.group(1)}: "
                                f"卡片 {cur.group(2)} 分钟, 估算 {want} 分钟")
                return CARD_TIME.sub(
                    lambda t: f"{t.group(1)}{want}{t.group(3)}", block)

            new = CARD.sub(patch, src)
            problems.extend(hits)
            if fix and hits and new != src:
                dp.write_text(new, encoding="utf-8")
                fixed += 1

    # ---- 3. home page "最新更新" rows that describe a single page ---------
    if INDEX.exists() and not [a for a in argv if not a.startswith("-")]:
        src = INDEX.read_text(encoding="utf-8")

        # Rewrite inside each row block: several rows can carry the identical
        # label text, so a document-wide str.replace() would keep hitting the
        # first one and silently leave the rest stale.
        def patch_row(m: re.Match) -> str:
            block = m.group(0)
            href = CARD_HREF.search(block)
            time = L_TIME.search(block)
            if not href or not time or href.group(1) not in minutes:
                return block
            label = time.group(2)
            single = re.fullmatch(r"\s*(\d+)\s*分钟\s*", label)
            if not single:
                return block              # composite row ("3 篇 · ~105 分钟")
            want = minutes[href.group(1)]
            if int(single.group(1)) == want:
                return block
            problems.append(f"  index.html -> {href.group(1)}: "
                            f"最新更新 {single.group(1)} 分钟, 估算 {want} 分钟")
            return L_TIME.sub(lambda t: f"{t.group(1)}{want} 分钟{t.group(3)}",
                              block, count=1)

        new = L_ROW.sub(patch_row, src)
        if fix and new != src:
            INDEX.write_text(new, encoding="utf-8")
            fixed += 1

    for p in problems:
        print(p)
    print(f"\nTotal problems: {len(problems)}")
    if fix:
        print(f"Applied fixes to {fixed} file(s). Re-run without --fix to verify.")
        return 0
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
