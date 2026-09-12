#!/usr/bin/env python3
"""Generate the social-preview / canonical `<head>` block for every note page.

Only the root `index.html` ever had `canonical`, `og:*`, `twitter:*` or a
favicon. All ~500 notes had none, which has one very visible consequence: paste
any article link into WeChat / Slack / Feishu and you get a bare URL instead of
a preview card, and search engines have no canonical address for pages that are
reachable under more than one path.

`<title>` and `<meta name="description">` are already present and audited on
every page, so everything here is derived from them — nothing to hand-maintain.

The block is delimited by `<!-- tn-social:v1 -->` markers so re-running replaces
it in place rather than stacking duplicates, the same way `tn-nav:v2` lets the
navigation scripts find and rewrite the top bar.

Usage:
    python scripts/gen_social_meta.py            # write
    python scripts/gen_social_meta.py --check    # CI: is any page stale?
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_files, rel  # noqa: E402

BASE = "https://kavinchan13.github.io/tech-notes/"
COVER = BASE + "assets/og-cover.jpg"
SITE_NAME = "Kavin Tech Notes"

BEGIN = "<!-- tn-social:v1 -->"
END = "<!-- /tn-social:v1 -->"
BLOCK_RE = re.compile(re.escape(BEGIN) + r"[\s\S]*?" + re.escape(END) + r"\n?")

TITLE_RE = re.compile(r"<title>([\s\S]*?)</title>", re.I)
DESC_RE = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"\s*/?>', re.I)

# `·` is used both as a main/subtitle separator and as a plain list separator
# ("限流 · 熔断 · 降级 · 隔离 — 弹性与过载保护"), so splitting on the first one
# mangles titles. Only the site suffix is safe to strip.
SUFFIX_RE = re.compile(r"\s*[—·|-]\s*(?:Tech Notes|Kavin Tech Notes)\s*$")


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def page_title(text: str) -> str | None:
    m = TITLE_RE.search(text)
    if not m:
        return None
    t = re.sub(r"\s+", " ", m.group(1)).strip()
    return SUFFIX_RE.sub("", t) or t


def og_type(rel_path: str) -> str:
    name = rel_path.rsplit("/", 1)[-1]
    if name == "index.html" or name.endswith(("_directory.html", "_study_path.html")):
        return "website"
    return "article"


def depth_prefix(rel_path: str) -> str:
    """`../` per directory level, so the favicon resolves under file:// too."""
    return "../" * (len(Path(rel_path).parts) - 1) or "./"


def build_block(rel_path: str, title: str, desc: str) -> str:
    url = BASE + rel_path
    t, d = esc(title), esc(desc)
    icon = depth_prefix(rel_path) + "assets/favicon.svg"
    return "\n".join([
        BEGIN,
        f'<link rel="canonical" href="{url}">',
        f'<link rel="icon" type="image/svg+xml" href="{icon}">',
        '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">',
        '<meta name="theme-color" content="#0b0d12" media="(prefers-color-scheme: dark)">',
        f'<meta property="og:type" content="{og_type(rel_path)}">',
        f'<meta property="og:site_name" content="{SITE_NAME}">',
        '<meta property="og:locale" content="zh_CN">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:title" content="{t}">',
        f'<meta property="og:description" content="{d}">',
        f'<meta property="og:image" content="{COVER}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="628">',
        '<meta property="og:image:alt" content="技术笔记 · 系统 / 架构 / 工程">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{t}">',
        f'<meta name="twitter:description" content="{d}">',
        f'<meta name="twitter:image" content="{COVER}">',
        END,
    ]) + "\n"


def render(path: Path) -> tuple[str | None, str | None]:
    """(new_text, problem). Pure: never touches the file.

    `--check` must not write. An earlier version called the writer and restored
    the original afterwards, which on a CRLF working copy silently rewrote line
    endings as a side effect of *checking*.
    """
    text = path.read_text(encoding="utf-8")
    rel_path = rel(path)

    title = page_title(text)
    if not title:
        return None, f"{rel_path}: no <title> to derive og:title from"
    dm = DESC_RE.search(text)
    if not dm:
        return None, f'{rel_path}: no <meta name="description"> to derive og:description from'

    block = build_block(rel_path, title, dm.group(1))
    stripped = BLOCK_RE.sub("", text)

    # Sits straight after the description, i.e. with the rest of the metadata
    # and before the first stylesheet — the load order article.css depends on
    # (site-tokens.css + article.css last) is untouched.
    anchor = DESC_RE.search(stripped)
    new = stripped[:anchor.end()] + "\n" + block.rstrip("\n") + stripped[anchor.end():]
    return new, None


def main(argv: list[str]) -> int:
    check = "--check" in argv
    pages = [ROOT / "index.html"] + content_files([])

    changed: list[str] = []
    problems: list[str] = []
    for p in pages:
        if p.parent == ROOT:
            continue  # index.html / 404.html are hand-written shells, not notes
        new, prob = render(p)
        if prob:
            problems.append(prob)
            continue
        if new == p.read_text(encoding="utf-8"):
            continue
        changed.append(rel(p))
        if not check:
            p.write_text(new, encoding="utf-8", newline="\n")

    for prob in problems:
        print(f"  {prob}")
    if check:
        for c in changed:
            print(f"  stale social block: {c}")
        total = len(changed) + len(problems)
        print(f"\nTotal problems: {total}")
        if changed:
            print("run python scripts/gen_social_meta.py and commit the result")
        return 1 if total else 0

    print(f"\nUpdated {len(changed)} page(s), {len(problems)} problem(s).")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
