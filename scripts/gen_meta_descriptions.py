#!/usr/bin/env python3
"""Fill in the missing <meta name="description"> tags.

More than half the pages had no description, so search engines were inventing
snippets from whatever text happened to be near the top of the page.

Source of the text, in order of preference:
  1. the hero `<p class="sub">`, with the format boilerplate stripped
     ("11 章 · 6 个生活类比 · 12 道面试题" describes the page's shape, not its
     subject, and makes a useless snippet);
  2. a `.lead` / `.intro` paragraph;
  3. the first paragraph inside <main>;
  4. the `<title>` tail — titles follow "主标题 · 关键点1 / 关键点2", which is
     already written to be descriptive.

The title's main heading is always prefixed, so a snippet reads
"《值类别》：…" rather than starting mid-sentence.

    python scripts/gen_meta_descriptions.py --dry-run   # preview
    python scripts/gen_meta_descriptions.py             # write
"""
from __future__ import annotations

import html as html_lib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_files  # noqa: E402

MAX = 150

TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")
HAS_DESC = re.compile(r'<meta[^>]+name=["\']description["\']', re.I)
TITLE = re.compile(r"<title[^>]*>([\s\S]*?)</title>", re.I)
HERO_SUB = re.compile(r'<p class="sub"[^>]*>([\s\S]*?)</p>', re.I)
LEAD = re.compile(r'<p class="(?:lead|intro)"[^>]*>([\s\S]*?)</p>', re.I)
FIRST_P = re.compile(r"<main\b[\s\S]*?<p[^>]*>([\s\S]*?)</p>", re.I)
CHARSET = re.compile(r'<meta[^>]+charset=[^>]*>', re.I)
VIEWPORT = re.compile(r'<meta[^>]+name=["\']viewport["\'][^>]*>', re.I)
TITLE_TAG = re.compile(r"<title[^>]*>[\s\S]*?</title>", re.I)

# "11 章", "6 个生活类比", "1 个交互演示", "12 道面试题", "3 段代码" … these count
# the page's parts rather than describing its subject, and make a useless
# search snippet. A whole `·` segment matching this is dropped.
SHAPE_WORD = r"章|篇|节|类比|演示|案例|对比|事故|图|坑|导览|清单|题|代码|实验|翻车|拆解|教训|体系|路径"
# Allow a trailing parenthetical, e.g. "3 段 GEMM 演化代码（朴素 → tiled → …）".
SHAPE_SEG = re.compile(
    rf"^[\d\s]*[个道段篇章]?[^。]*?(?:{SHAPE_WORD})"
    r"\s*(?:（[^）]*）|\([^)]*\))?\s*$")
STARTS_NUM = re.compile(r"^\s*\d")
SEP = re.compile(r"\s*[·|]\s*")
# Tag stripping leaves a space where an inline <strong>/<span> used to be,
# which shows up as "对位读者 ：" in the snippet.
CJK_PUNCT = re.compile(r"\s+([：、。，；！？）】」])|([（【「])\s+")


def txt(s: str) -> str:
    return WS.sub(" ", html_lib.unescape(TAG.sub(" ", s))).strip()


def tidy(s: str) -> str:
    s = CJK_PUNCT.sub(lambda m: m.group(1) or m.group(2), s)
    return WS.sub(" ", s).strip(" ·—-。，,")


def clean(s: str) -> str:
    """Drop the "N 章 · M 个类比 · K 道题" segments, keep the prose."""
    kept: list[str] = []
    for part in SEP.split(s):
        part = part.strip()
        if not part:
            continue
        # A segment may hold a count followed by a real sentence
        # ("12 道面试题。对位读者：…") — judge each sentence separately.
        sentences = [x for x in re.split(r"(?<=。)", part) if x.strip()]
        keep = []
        for sent in sentences:
            body = sent.strip()
            if SHAPE_SEG.match(body.rstrip("。")) and STARTS_NUM.match(body):
                continue
            keep.append(body)
        rest = "".join(keep).strip()
        # a leftover like "交互演示" or "（含 …）" is a fragment, not a description
        if not rest or (len(rest) < 8 and SHAPE_SEG.match(rest)) or rest.startswith(("（", "(")):
            continue
        kept.append(rest)
    return tidy(" · ".join(kept) if kept else s)


def truncate(s: str, limit: int = MAX) -> str:
    """Cut at a clause boundary, never mid-quote or mid-bracket."""
    if len(s) <= limit:
        return s
    cut = s[:limit]
    # Prefer a sentence end, then a bullet separator, then a comma.
    for stops in ("。！？!?", "·", "；;，,、"):
        best = max((cut.rfind(c) for c in stops), default=-1)
        if best > limit * 0.55:
            out = cut[: best + 1].rstrip("·，,、；; ")
            if out.count('"') % 2 == 0 and out.count("（") == out.count("）"):
                return out.rstrip("。")
    out = cut.rstrip()
    # Drop a dangling opening quote/bracket rather than truncate inside it.
    for opener in ('"', "（", "("):
        if out.count(opener) % 2 == 1 or (opener == "（" and out.count("（") > out.count("）")):
            out = out[: out.rfind(opener)].rstrip("·，,、；; ")
    return out + "…"


def describe(text: str) -> str | None:
    m = TITLE.search(text)
    raw_title = txt(m.group(1)) if m else ""
    bits = [b for b in SEP.split(raw_title) if b.strip()]
    head = bits[0] if bits else ""
    tail = " / ".join(bits[1:])

    body = ""
    for rx in (HERO_SUB, LEAD, FIRST_P):
        m = rx.search(text)
        if m:
            cand = clean(txt(m.group(1)))
            if len(cand) >= 20:
                body = cand
                break
    if not body:
        body = tail
    if not body:
        return None

    # Avoid "值类别：值类别 …" when the body already opens with the title.
    if head and body.startswith(head):
        desc = body
    else:
        desc = f"{head}：{body}" if head else body
    return truncate(tidy(desc))


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    limit = 8 if "--sample" in argv else None

    changed = skipped = 0
    for p in content_files():
        text = p.read_text(encoding="utf-8", errors="ignore")
        if HAS_DESC.search(text):
            continue
        desc = describe(text)
        if not desc:
            skipped += 1
            print(f"  [skip] {p.relative_to(ROOT).as_posix()} — no usable source text")
            continue

        if dry:
            if limit is None or changed < limit:
                print(f"\n{p.relative_to(ROOT).as_posix()}\n   {desc}  ({len(desc)} chars)")
            changed += 1
            continue

        tag = f'<meta name="description" content="{html_lib.escape(desc, quote=True)}">'
        # place it right after <title>, else after viewport, else after charset
        anchor = TITLE_TAG.search(text) or VIEWPORT.search(text) or CHARSET.search(text)
        if not anchor:
            skipped += 1
            continue
        text = text[: anchor.end()] + "\n" + tag + text[anchor.end():]
        p.write_text(text, encoding="utf-8", newline="")
        changed += 1

    verb = "would add" if dry else "added"
    print(f"\n{verb} {changed} description(s); {skipped} skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
