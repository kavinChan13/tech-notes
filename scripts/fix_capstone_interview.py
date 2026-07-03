#!/usr/bin/env python3
"""Convert capstone interview-card divs to details (nested ic-body)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
p = ROOT / "architect" / "architect_capstone.html"
text = p.read_text(encoding="utf-8")

OPEN = '<div class="interview-card">'
converted = 0
out = []
pos = 0

while True:
    idx = text.find(OPEN, pos)
    if idx == -1:
        out.append(text[pos:])
        break
    out.append(text[pos:idx])
    body_start = idx + len(OPEN)
    # find matching closing </div> for interview-card
    depth = 1
    i = body_start
    while i < len(text):
        div_open = text.find("<div", i)
        div_close = text.find("</div>", i)
        if div_close == -1:
            raise SystemExit("unclosed interview-card")
        if div_open != -1 and div_open < div_close:
            depth += 1
            i = div_open + 4
            continue
        depth -= 1
        i = div_close + len("</div>")
        if depth == 0:
            inner = text[body_start:div_close]
            # split header (question + meta) from body
            meta_end = inner.find('</div>', inner.find('<div class="ic-meta">'))
            if meta_end == -1:
                raise SystemExit("ic-meta not found in card")
            header = inner[: meta_end + len("</div>")].strip()
            body = inner[meta_end + len("</div>") :].strip()
            out.append(
                '<details class="interview-card">\n    <summary>\n    '
                + header
                + "\n    </summary>\n    "
                + body
                + "\n  </details>"
            )
            converted += 1
            pos = i
            break
        continue

if converted != 4:
    raise SystemExit(f"expected 4 replacements, got {converted}")
p.write_text("".join(out), encoding="utf-8")
print(f"Converted {converted} interview cards in {p.name}")
