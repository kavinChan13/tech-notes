#!/usr/bin/env python3
"""Replace dark-theme-only inline hex colors with theme tokens (light-mode fix).

Targets guide pages that load assets/article.css. Idempotent: skips values
already using var(--*).
"""
from __future__ import annotations
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP_TOP = {'.cursor', 'assets', 'tools', 'scripts', 'node_modules', '.git'}

# Order matters: longer / more specific patterns first.
REPLACEMENTS: list[tuple[str, str]] = [
    # white text on card surfaces (light mode invisible)
    ('.pipeline .stage strong{display:block;font-size:13px;margin-bottom:4px;color:#fff}',
     '.pipeline .stage strong{display:block;font-size:13px;margin-bottom:4px;color:var(--text)}'),
    ('.formula h4{margin:6px 0 10px;color:#fff', '.formula h4{margin:6px 0 10px;color:var(--text)'),
    ('.method h4.m-title{margin:6px 0 2px;color:#fff', '.method h4.m-title{margin:6px 0 2px;color:var(--text)'),
    ('.nav-card h4{margin:0 0 6px;font-size:15px;color:#fff', '.nav-card h4{margin:0 0 6px;font-size:15px;color:var(--text)'),
    ('.matrix .cell h4{margin:0 0 8px;color:#fff', '.matrix .cell h4{margin:0 0 8px;color:var(--text)'),
    ('.persona-card .name{font-size:18px;color:#fff', '.persona-card .name{font-size:18px;color:var(--text)'),
    # gradients
    ('linear-gradient(90deg,#7dd3fc,#a78bfa,#34d399)',
     'linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-3))'),
    ('linear-gradient(180deg,#7dd3fc,#a78bfa)',
     'linear-gradient(180deg,var(--accent),var(--accent-2))'),
    # borders (compound)
    ('border-bottom:1px solid #1f2740', 'border-bottom:1px solid var(--border)'),
    ('border-bottom:1px solid #2a3556', 'border-bottom:1px solid var(--border-2)'),
    ('border-top:1px solid #1f2740', 'border-top:1px solid var(--border)'),
    ('border-top:1px solid #2a3556', 'border-top:1px solid var(--border-2)'),
    ('border-left:4px solid #fbbf24', 'border-left:4px solid var(--accent-4)'),
    ('border-left:3px solid #fbbf24', 'border-left:3px solid var(--accent-4)'),
    ('border-left:3px solid #34d399', 'border-left:3px solid var(--accent-3)'),
    ('border-left:3px solid #f87171', 'border-left:3px solid var(--danger)'),
    ('border-left:3px solid #7dd3fc', 'border-left:3px solid var(--accent)'),
    ('border-left:3px solid #a78bfa', 'border-left:3px solid var(--accent-2)'),
    ('border:1px dashed #475569', 'border:1px dashed var(--border-2)'),
    ('border:1px solid #2a3556', 'border:1px solid var(--border-2)'),
    ('border:1px solid #1f2740', 'border:1px solid var(--border)'),
    ('border-color:#2a3556', 'border-color:var(--border-2)'),
    ('border-color:#1f2740', 'border-color:var(--border)'),
    ('border-color:#fbbf24', 'border-color:var(--accent-4)'),
    ('border-color:#7dd3fc', 'border-color:var(--accent)'),
    ('border-bottom:2px solid #7dd3fc', 'border-bottom:2px solid var(--accent)'),
    ('border-bottom:2px solid #a78bfa', 'border-bottom:2px solid var(--accent-2)'),
    ('border-bottom:2px solid #34d399', 'border-bottom:2px solid var(--accent-3)'),
    ('border-bottom:2px solid #fbbf24', 'border-bottom:2px solid var(--accent-4)'),
    # rgba borders → token mix
    ('border:1px solid rgba(125,211,252,.25)',
     'border:1px solid color-mix(in srgb, var(--accent) 28%, var(--border))'),
    ('border:1px dashed rgba(125,211,252,.2)',
     'border:1px dashed color-mix(in srgb, var(--accent) 25%, var(--border))'),
    ('border:1px dashed rgba(167,139,250,.3)',
     'border:1px dashed color-mix(in srgb, var(--accent-2) 35%, var(--border))'),
    # backgrounds (active states)
    ('background:#fbbf24;color:#0a0e1a', 'background:var(--accent-4);color:var(--bg)'),
    ('background:#fbbf24;color:var(--bg)', 'background:var(--accent-4);color:var(--bg)'),
    # accent-color
    ('accent-color:#7dd3fc', 'accent-color:var(--accent)'),
    # text colors (light-on-light offenders)
    ('color:#e4e9f5', 'color:var(--text)'),
    ('color:#f1f5f9', 'color:var(--text)'),
    ('color:#f8fafc', 'color:var(--text)'),
    ('color:#cbd5e1', 'color:var(--text-dim)'),
    ('color:#94a3b8', 'color:var(--text-dim)'),
    ('color:#64748b', 'color:var(--text-mute)'),
    ('color:#475569', 'color:var(--text-mute)'),
    # semantic accent text
    ('color:#7dd3fc', 'color:var(--accent)'),
    ('color:#60a5fa', 'color:var(--info)'),
    ('color:#a78bfa', 'color:var(--accent-2)'),
    ('color:#c084fc', 'color:var(--accent-2)'),
    ('color:#34d399', 'color:var(--accent-3)'),
    ('color:#6ee7b7', 'color:var(--accent-3)'),
    ('color:#4ade80', 'color:var(--accent-3)'),
    ('color:#fbbf24', 'color:var(--accent-4)'),
    ('color:#fde68a', 'color:var(--accent-4)'),
    ('color:#f87171', 'color:var(--danger)'),
    ('color:#fca5a5', 'color:var(--danger)'),
    ('color:#bae6fd', 'color:var(--accent)'),
    ('color:#ddd6fe', 'color:var(--accent-2)'),
    # contrast text on bright fills
    ('color:#0a0e1a', 'color:var(--text-bright)'),
    # head/bg fills for tags
    ('background:rgba(248,113,113,.18);color:#fca5a5',
     'background:color-mix(in srgb, var(--danger) 18%, var(--bg-card));color:var(--danger)'),
    ('background:rgba(52,211,153,.18);color:#6ee7b7',
     'background:color-mix(in srgb, var(--accent-3) 18%, var(--bg-card));color:var(--accent-3)'),
    # box-shadow tints
    ('box-shadow:0 8px 28px -10px rgba(125,211,252,.25)',
     'box-shadow:var(--shadow)'),
    ('box-shadow:0 0 16px rgba(251,191,36,.5)',
     'box-shadow:0 0 16px color-mix(in srgb, var(--accent-4) 45%, transparent)'),
    # axis lines
    ('background:#475569', 'background:var(--border-2)'),
    # read-hint tints
    ('color:#34d399;border-color:rgba(52,211,153,.25);background:rgba(52,211,153,.06)',
     'color:var(--accent-3);border-color:color-mix(in srgb, var(--accent-3) 30%, var(--border));background:color-mix(in srgb, var(--accent-3) 8%, var(--bg-card))'),
    ('color:#a78bfa;border-color:rgba(167,139,250,.25);background:rgba(167,139,250,.06)',
     'color:var(--accent-2);border-color:color-mix(in srgb, var(--accent-2) 30%, var(--border));background:color-mix(in srgb, var(--accent-2) 8%, var(--bg-card))'),
    # intuition / skip backgrounds
    ('background:rgba(251,191,36,.05)', 'background:color-mix(in srgb, var(--accent-4) 8%, var(--bg-card))'),
    ('background:rgba(167,139,250,.05)', 'background:color-mix(in srgb, var(--accent-2) 6%, var(--bg-card))'),
    ('background:rgba(125,211,252,.05)',
     'background:color-mix(in srgb, var(--accent) 8%, var(--bg-card))'),
    # head blocks
    ('.gqa-row .head.q{background:#7dd3fc}', '.gqa-row .head.q{background:var(--accent)}'),
    ('.gqa-row .head.kv{background:#a78bfa', '.gqa-row .head.kv{background:var(--accent-2)'),
    ('.gqa-row .head.kv-mqa{background:#34d399', '.gqa-row .head.kv-mqa{background:var(--accent-3)'),
    ('.gqa-row .head.kv-mla{background:#fbbf24', '.gqa-row .head.kv-mla{background:var(--accent-4)'),
    # roofline points
    ('.roofline .point.compute{background:#f87171;color:#f87171',
     '.roofline .point.compute{background:var(--danger);color:var(--danger)'),
    ('.roofline .point.memory{background:#fbbf24;color:#fbbf24',
     '.roofline .point.memory{background:var(--accent-4);color:var(--accent-4)'),
]

# Chunk highlight backgrounds: keep hue via color-mix
CHUNK_BG = [
    ('background:rgba(125,211,252,.15)', 'background:color-mix(in srgb, var(--accent) 15%, transparent)'),
    ('background:rgba(167,139,250,.15)', 'background:color-mix(in srgb, var(--accent-2) 15%, transparent)'),
    ('background:rgba(52,211,153,.15)', 'background:color-mix(in srgb, var(--accent-3) 15%, transparent)'),
    ('background:rgba(251,191,36,.15)', 'background:color-mix(in srgb, var(--accent-4) 15%, transparent)'),
]

REPLACEMENTS.extend(CHUNK_BG)


def iter_html(extra_roots: list[pathlib.Path] | None = None):
    roots = extra_roots or [ROOT]
    seen: set[pathlib.Path] = set()
    for base in roots:
        for p in base.rglob('*.html'):
            if p in seen:
                continue
            if p.parts and p.parts[0] in SKIP_TOP:
                continue
            if p.parts and p.parts[0].startswith('.') and 'bili-to-note' not in p.parts:
                continue
            seen.add(p)
            yield p


BORDER_HEX = [
    (re.compile(r'(border(?:-(?:left|right|top|bottom))?:\s*\d+px\s+(?:solid|dashed)\s*)#2a3556', re.I),
     r'\1var(--border-2)'),
    (re.compile(r'(border(?:-(?:left|right|top|bottom))?:\s*\d+px\s+(?:solid|dashed)\s*)#1f2740', re.I),
     r'\1var(--border)'),
    (re.compile(r'(border:\s*\d+px\s+(?:solid|dashed)\s*)#2a3556', re.I),
     r'\1var(--border-2)'),
    (re.compile(r'(border:\s*\d+px\s+(?:solid|dashed)\s*)#1f2740', re.I),
     r'\1var(--border)'),
]

# Dark hexes that survived the exact-match lists above. Neutral navy/slate
# greys collapse onto the border tokens; hued ones keep their hue via
# color-mix so the semantic colour still reads in light mode.
DARK_NEUTRAL_BORDERS = {
    '#243352': 'var(--border-2)',
    '#2e3a5a': 'var(--border-2)',
    '#2a3756': 'var(--border-2)',
    '#3a4670': 'var(--border-2)',
    '#1e2a44': 'var(--border)',
    '#1a2440': 'var(--border)',
    '#2a3347': 'var(--border)',
    '#34405c': 'var(--border-2)',
    '#2d3a52': 'var(--border-2)',
}
DARK_HUED_BORDERS = {
    '#3d2d6e': 'color-mix(in srgb, var(--purple) 45%, var(--border))',
    '#5a2d8c': 'color-mix(in srgb, var(--purple) 45%, var(--border))',
    '#2a5a8c': 'color-mix(in srgb, var(--accent) 45%, var(--border))',
    '#6b4f00': 'color-mix(in srgb, var(--yellow) 45%, var(--border))',
    '#2d6e2d': 'color-mix(in srgb, var(--green) 45%, var(--border))',
    '#6e2d2d': 'color-mix(in srgb, var(--red) 45%, var(--border))',
}
GENERIC_BORDER = re.compile(
    r'(border(?:-(?:left|right|top|bottom))?\s*:\s*[\d.]+px\s+(?:solid|dashed|dotted)\s+)'
    r'(#[0-9a-fA-F]{6})\b', re.I)

# Dark tints used as a gradient stop / fill next to a token-driven colour.
DARK_TINT_BG = [
    ('linear-gradient(135deg,#624b14,var(--bg-card))',
     'linear-gradient(135deg,color-mix(in srgb, var(--yellow) 22%, var(--bg-card)),var(--bg-card))'),
    ('linear-gradient(135deg, #624b14, var(--bg-card))',
     'linear-gradient(135deg, color-mix(in srgb, var(--yellow) 22%, var(--bg-card)), var(--bg-card))'),
]

# Mid-tone text that only has contrast on a dark card.
DARK_ONLY_TEXT = {
    'color:#8ec8f6': 'color:var(--accent)',
    'color:#f0c040': 'color:var(--yellow)',
    'color:#d4a0ff': 'color:var(--purple)',
    'color:#7fdf7f': 'color:var(--green)',
    'color:#ff9090': 'color:var(--red)',
    'color: #8ec8f6': 'color: var(--accent)',
    'color: #f0c040': 'color: var(--yellow)',
    'color: #d4a0ff': 'color: var(--purple)',
    'color: #7fdf7f': 'color: var(--green)',
    'color: #ff9090': 'color: var(--red)',
}

# Page-local :root aliases whose names site-tokens.css does NOT define, so the
# light theme can never override them. Point them at the real tokens.
ORPHAN_ROOT_TOKENS = {
    '--border2': 'var(--border-2)',
    '--border-accent': 'var(--border-2)',
}
ORPHAN_DECL = re.compile(
    r'(' + '|'.join(re.escape(k) for k in ORPHAN_ROOT_TOKENS) + r')\s*:\s*#[0-9a-fA-F]{3,8}')

# `var(--border, #1e2a44)`: the fallback never fires (site-tokens.css always
# defines these) but it records a dark-only value that gets copy-pasted into
# places where it does fire. Strip it for tokens site-tokens.css guarantees.
SITE_TOKENS = set(re.findall(
    r'(--[\w-]+)\s*:',
    (ROOT / 'assets' / 'site-tokens.css').read_text(encoding='utf-8')))
VAR_FALLBACK = re.compile(r'var\((--[\w-]+),\s*#[0-9a-fA-F]{3,8}\)')

# Outline drawn in the page background colour, not a real border colour.
OUTLINE_AS_BG = {'#080c18': 'var(--bg)'}
OUTLINE_RE = re.compile(
    r'(border\s*:\s*[\d.]+px\s+solid\s+)(' + '|'.join(OUTLINE_AS_BG) + r')\b', re.I)


def fix_text(text: str) -> tuple[str, int]:
    n = 0
    for old, new in REPLACEMENTS:
        if old not in text:
            continue
        count = text.count(old)
        text = text.replace(old, new)
        n += count
    for pat, repl in BORDER_HEX:
        text, c = pat.subn(repl, text)
        n += c

    def border_sub(m):
        nonlocal n
        hexv = m.group(2).lower()
        repl = DARK_NEUTRAL_BORDERS.get(hexv) or DARK_HUED_BORDERS.get(hexv)
        if not repl:
            return m.group(0)
        n += 1
        return m.group(1) + repl

    text = GENERIC_BORDER.sub(border_sub, text)

    for old, new in DARK_TINT_BG:
        if old in text:
            n += text.count(old)
            text = text.replace(old, new)
    for old, new in DARK_ONLY_TEXT.items():
        if old in text:
            n += text.count(old)
            text = text.replace(old, new)

    def orphan_sub(m):
        nonlocal n
        n += 1
        return f'{m.group(1)}: {ORPHAN_ROOT_TOKENS[m.group(1)]}'

    text = ORPHAN_DECL.sub(orphan_sub, text)

    def fallback_sub(m):
        nonlocal n
        if m.group(1) not in SITE_TOKENS:
            return m.group(0)
        n += 1
        return f'var({m.group(1)})'

    text = VAR_FALLBACK.sub(fallback_sub, text)

    def outline_sub(m):
        nonlocal n
        n += 1
        return m.group(1) + OUTLINE_AS_BG[m.group(2).lower()]

    text = OUTLINE_RE.sub(outline_sub, text)
    return text, n


def main():
    extra = [ROOT / '.cursor' / 'skills' / 'bili-to-note']
    changed = 0
    total = 0
    for p in iter_html([ROOT, *extra]):
        t = p.read_text(encoding='utf-8')
        if 'assets/article.css' not in t:
            continue
        new_t, n = fix_text(t)
        if n and new_t != t:
            p.write_text(new_t, encoding='utf-8', newline='')
            changed += 1
            total += n
            print(f'[fixed] {p.relative_to(ROOT).as_posix()} ({n} replacements)')
    print(f'\nfiles changed: {changed}, total replacements: {total}')


if __name__ == '__main__':
    main()
