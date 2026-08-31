#!/usr/bin/env python3
"""Audit the page shell: offline-safety, theme wiring and stylesheet order.

These defects don't break a build and don't show up in a quick look at one
page, so they accumulate. Each check below corresponds to a rule in
.cursor/rules/ (self-contained-assets, light-dark-theming, file-format-
consistency, search-index):

  1. no external CDN <script>/<link> — pages must work from file:// offline
  2. <head> carries the pre-paint <!-- tn-theme-init --> snippet, reading BOTH
     localStorage['theme'] and the legacy localStorage['tn-theme']
  3. no page-local theme-toggle JS, and no assets/site-theme.js (it injects a
     duplicate floating home button)
  4. site-tokens.css + article.css are the last two stylesheets, after the
     page's own inline <style>
  5. topnav is wrapped in <!-- tn-nav:v2 --> markers and <body> has has-topnav
  6. scroll-spy targets `aside.toc nav a`, never a bare/negated nav selector
  7. no hardcoded dark background/border hexes in inline <style>
  8. the 12 MB search index is pulled in through search-index-loader.js, never
     linked directly

Chrome pages (home, *_directory.html, template indexes) deliberately use a
different shell — they get the checks that still apply (1, 2, 3, 7, 8).

Usage:
    python scripts/audit_page_shell.py            # whole site
    python scripts/audit_page_shell.py cpp system # only these dirs
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_files  # noqa: E402

HEAD_RE = re.compile(r"<head\b[^>]*>([\s\S]*?)</head>", re.I)
STYLE_RE = re.compile(r"<style\b[^>]*>([\s\S]*?)</style>", re.I)
LINK_CSS = re.compile(r'<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"', re.I)
CDN = re.compile(r'<(?:script|link)[^>]*(?:src|href)="https?://[^"]+\.(?:js|css)"', re.I)
INLINE_TOGGLE = re.compile(
    r"localStorage\.setItem\(\s*['\"]theme['\"]", re.I)
DARK_HEX = re.compile(
    r"(background(?:-color)?|border(?:-(?:left|right|top|bottom|color))?)\s*:\s*"
    r"[^;{}]*?(#[0-9a-fA-F]{6})\b", re.I)
# Declarations inside these blocks are *supposed* to be dark: the :root token
# defaults and anything explicitly scoped to the dark theme.
THEME_SCOPED = re.compile(r"[^{}]*(?::root|\[data-theme=[\"']?dark)[^{}]*\{[^}]*\}")

THEME_INIT = "tn-theme-init"
TOKENS = "site-tokens.css"
ARTICLE = "article.css"


def luminance(hexstr: str) -> float:
    h = hexstr.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def is_chrome(path: Path) -> bool:
    n = path.name
    return n == "index.html" or n.endswith("_directory.html")


def audit(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    head_m = HEAD_RE.search(text)
    head = head_m.group(1) if head_m else ""
    body = text[head_m.end():] if head_m else text
    out: list[str] = []
    chrome = is_chrome(path)

    # 1. offline safety
    for m in CDN.finditer(text):
        out.append(f"external CDN asset (breaks offline use): {m.group(0)[:90]}")

    # 2. pre-paint theme init
    if THEME_INIT not in head:
        out.append("<head> is missing the <!-- tn-theme-init --> pre-paint snippet")
    else:
        if "getItem('theme')" not in head and 'getItem("theme")' not in head:
            out.append("theme-init does not read localStorage['theme']")
        if "tn-theme" not in head:
            out.append("theme-init does not fall back to the legacy localStorage['tn-theme']")

    # 3. one toggle mechanism
    if "assets/site-theme.js" in text:
        out.append("loads assets/site-theme.js (duplicate floating home button)")
    uses_shared_toggle = (
        "site-theme-toggle.js" in text or "directory-theme.js" in text)
    for m in INLINE_TOGGLE.finditer(body):
        if uses_shared_toggle:
            continue
        out.append("defines its own theme-toggle JS instead of using the shared one")
        break

    # 4. stylesheet order
    sheets = LINK_CSS.findall(head)
    if not chrome:
        if not any(s.endswith(TOKENS) for s in sheets):
            out.append(f"does not load assets/{TOKENS}")
        elif not any(s.endswith(ARTICLE) for s in sheets):
            out.append(f"does not load assets/{ARTICLE}")
        elif [Path(s).name for s in sheets[-2:]] != [TOKENS, ARTICLE]:
            out.append(
                f"{TOKENS} + {ARTICLE} must be the last two stylesheets, got "
                f"{[Path(s).name for s in sheets[-2:]]}")
        else:
            last_style = max((m.end() for m in STYLE_RE.finditer(head)), default=-1)
            tokens_at = head.rfind(TOKENS)
            if last_style > tokens_at:
                out.append(f"an inline <style> comes after assets/{TOKENS}")

    # 5. topnav markers
    if "tn-topnav" in text:
        if "tn-nav:v2" not in text:
            out.append("topnav is not wrapped in <!-- tn-nav:v2 --> markers")
        if "has-topnav" not in text:
            out.append("has a topnav but <body> lacks the has-topnav class")
    elif "has-topnav" in text:
        out.append("<body> has has-topnav but the page has no .tn-topnav")

    # 6. scroll-spy scope
    for bad in ("nav:not(.tn-topnav) a", "'.sidebar a'", '".sidebar a"'):
        if bad in text:
            out.append(f"scroll-spy uses {bad}; it must target 'aside.toc nav a'")

    # 7. hardcoded darks in inline <style>
    for style in STYLE_RE.findall(text):
        for m in DARK_HEX.finditer(THEME_SCOPED.sub("", style)):
            if luminance(m.group(2)) < 0.35:
                out.append(
                    f"inline <style> hardcodes a dark colour: {m.group(1)}:{m.group(2)} "
                    "(use a var(--*) token)")

    # 8. search index must be lazy
    if re.search(r'src="[^"]*assets/search-index\.js"', text):
        out.append("links assets/search-index.js directly; use search-index-loader.js")

    return out


def main(argv: list[str]) -> int:
    targets = content_files(argv or None)
    if not argv:
        targets = [ROOT / "index.html"] + targets
    total = 0
    for path in targets:
        problems = audit(path)
        if not problems:
            continue
        print(f"[{path.relative_to(ROOT).as_posix()}]")
        for p in problems:
            print(f"  {p}")
        total += len(problems)
    print(f"\nTotal problems: {total}")
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
