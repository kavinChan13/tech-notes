#!/usr/bin/env python3
"""Generate the light-mode SVG fill remap in assets/article.css.

Scans every content HTML page for hard-coded SVG `fill`/`stop-color` hex colors
and emits, between the AUTO-SVG markers in article.css, rules that (in LIGHT mode
only) remap:
  - dark surface fills  -> a light tint of the same hue
  - near-white/neutral text fills -> dark ink
  - mid neutral gray -> mid ink
Colored/bright fills are left untouched. Dark mode is unaffected.
"""
from __future__ import annotations
import colorsys, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP_TOP = {'.cursor', 'assets', 'tools', 'scripts', 'node_modules', '.git'}
CSS = ROOT / 'assets' / 'article.css'
START = '/* AUTO-SVG-START */'
END = '/* AUTO-SVG-END */'


def content_html():
    for p in ROOT.rglob('*.html'):
        parts = p.relative_to(ROOT).parts
        if parts and parts[0] in SKIP_TOP:
            continue
        yield p


def rgb(h):
    return int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)


def lum(h):
    r, g, b = rgb(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def hexof(r, g, b):
    return '#%02x%02x%02x' % (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


def classify(h):
    """Return replacement hex for light mode, or None to leave untouched.

    Diagrams are authored for dark backgrounds, so:
      - dark surfaces  -> light tint (same hue)      [rect/box fills]
      - near-white / light-gray neutral -> dark ink  [text]
      - light/bright COLOURED fills -> darker same hue [titles/labels/strokes]
    Mid/dark colours are already readable on light and left alone.
    """
    r, g, b = rgb(h)
    hh, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    L = lum(h)
    # dark surface -> light tint of same hue
    if L < 78:
        nr, ng, nb = colorsys.hls_to_rgb(hh, 0.94, min(s, 0.40))
        return hexof(round(nr * 255), round(ng * 255), round(nb * 255))
    # neutral (low saturation)
    if s < 0.25:
        if L >= 200:
            return '#1f2937'
        if L >= 150:
            return '#566074'
        return None
    # light / bright coloured fill (text, label or stroke) -> darker, same hue,
    # so it stays legible on a light background
    if L >= 120:
        nr, ng, nb = colorsys.hls_to_rgb(hh, 0.38, min(s, 0.9))
        return hexof(round(nr * 255), round(ng * 255), round(nb * 255))
    return None


def main():
    fills = set()
    for p in content_html():
        t = p.read_text(encoding='utf-8')
        for m in re.findall(r'(?:fill|stop-color)="(#[0-9a-fA-F]{6})"', t):
            fills.add(m.lower())

    # group source hexes by target replacement
    groups: dict[str, list[str]] = {}
    for h in sorted(fills):
        tgt = classify(h)
        if tgt:
            groups.setdefault(tgt, []).append(h)

    lines = []
    for tgt in sorted(groups):
        sels = ',\n'.join(
            f'html:not([data-theme="dark"]) svg [fill="{h}"], '
            f'html:not([data-theme="dark"]) svg [stop-color="{h}"]'
            for h in sorted(groups[tgt])
        )
        lines.append(f'{sels} {{ fill: {tgt}; stop-color: {tgt}; }}')
    block = '\n'.join(lines)

    css = CSS.read_text(encoding='utf-8')
    pat = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.DOTALL)
    css2 = pat.sub(START + '\n' + block + '\n' + END, css)
    CSS.write_text(css2, encoding='utf-8', newline='')
    n = sum(len(v) for v in groups.values())
    print(f'remapped {n} dark/neutral fills into {len(groups)} target groups')


if __name__ == '__main__':
    main()
