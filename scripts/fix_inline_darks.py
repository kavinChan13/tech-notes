#!/usr/bin/env python3
"""Convert hard-coded dark colors in page inline CSS to theme tokens.

Targets CSS color contexts only (so they flip with the theme):
  - solid `background:#dark` / `background-color:#dark`  -> hue-preserving token
  - dark hex stops inside linear/radial-gradient(...)     -> var(--bg-card)
  - near-white / neutral-light `color:#light`             -> var(--text)/--text-dim
Colored text, borders, shadows and non-dark values are left untouched.
Run repo-wide; idempotent (tokens contain no #hex so re-runs are no-ops).
"""
from __future__ import annotations
import colorsys, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP_TOP = {'.cursor', 'assets', 'tools', 'scripts', 'node_modules', '.git'}


def content_html():
    for p in ROOT.rglob('*.html'):
        parts = p.relative_to(ROOT).parts
        if parts and parts[0] in SKIP_TOP:
            continue
        yield p


def hls(hx):
    r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return h * 360, l, s, lum


def bg_token(hx):
    hue, l, s, lum = hls(hx)
    if lum >= 72:
        return None
    if s < 0.18:
        return 'var(--bg-card)'
    if hue < 20 or hue >= 345:
        t = 'red'
    elif hue < 45:
        t = 'orange'
    elif hue < 70:
        t = 'yellow'
    elif hue < 165:
        t = 'green'
    elif hue < 255:
        t = 'accent'
    elif hue < 300:
        t = 'purple'
    else:
        t = 'pink'
    return f'color-mix(in srgb, var(--{t}) 13%, var(--bg-card))'


def text_token(hx):
    hue, l, s, lum = hls(hx)
    if lum >= 200 and s < 0.35:
        return 'var(--text)'
    if 150 <= lum < 200 and s < 0.30:
        return 'var(--text-dim)'
    return None


HEX = r'#[0-9a-fA-F]{6}'
RGBA = r'rgba?\([^)]*\)'


def rgba_dark(s):
    m = re.match(r'rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?', s)
    if not m:
        return False
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    a = float(m.group(4)) if m.group(4) else 1.0
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return lum < 70 and a >= 0.5


def fix_gradients(text):
    def repl(m):
        val = m.group(0)
        val = re.sub(HEX, lambda mm: 'var(--bg-card)' if hls(mm.group(0))[3] < 72 else mm.group(0), val)
        val = re.sub(RGBA, lambda mm: 'var(--bg-card)' if rgba_dark(mm.group(0)) else mm.group(0), val)
        return val
    return re.sub(r'(?:linear|radial)-gradient\([^;{}]*\)', repl, text)


def main():
    import sys
    total = 0
    changed_files = 0
    files = [ROOT / a for a in sys.argv[1:]] if len(sys.argv) > 1 else list(content_html())
    for p in files:
        t = p.read_text(encoding='utf-8')
        # only touch migrated pages that load the token system (which defines
        # --bg-card etc); directory/index pages use their own palette.
        if 'assets/article.css' not in t:
            continue
        orig = t

        # gradients first (covers background:linear-gradient(...) dark stops)
        t = fix_gradients(t)

        # solid backgrounds (hex)
        def bg(m):
            tok = bg_token(m.group(2).lower())
            return m.group(1) + tok if tok else m.group(0)
        t = re.sub(r'(background(?:-color)?\s*:\s*)(' + HEX + r')', bg, t)

        # solid backgrounds (dark rgba/rgb)
        def bgr(m):
            return m.group(1) + 'var(--bg-card)' if rgba_dark(m.group(2)) else m.group(0)
        t = re.sub(r'(background(?:-color)?\s*:\s*)(' + RGBA + r')', bgr, t)

        # light neutral text
        def col(m):
            tok = text_token(m.group(2).lower())
            return m.group(1) + tok if tok else m.group(0)
        t = re.sub(r'(color\s*:\s*)(' + HEX + r')', col, t)

        if t != orig:
            p.write_text(t, encoding='utf-8', newline='')
            changed_files += 1
            total += 1
            print('[fixed]', p.relative_to(ROOT).as_posix())
    print(f'\nfiles changed: {changed_files}')


if __name__ == '__main__':
    main()
