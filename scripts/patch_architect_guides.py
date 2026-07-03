#!/usr/bin/env python3
"""Patch architect guide HTML: collapsible interviews, scroll spy, shared diagram CSS."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "architect/architecture_methodology.html",
    ROOT / "architect/architect_capstone.html",
    ROOT / "architect/large_scale_engineering.html",
    ROOT / "architect/observability_engineering.html",
    ROOT / "architect/storage_and_data_architecture.html",
]

INTERVIEW_SUMMARY_CSS = """
  .interview-card > summary{cursor:pointer;list-style:none;outline:none;}
  .interview-card > summary::-webkit-details-marker{display:none;}
  .interview-card > summary::marker{display:none;}
  .interview-card > summary{position:relative;padding-right:2.4rem;}
  .interview-card > summary::after{content:'▸';position:absolute;right:1.1rem;top:1.1rem;color:var(--purple);font-size:1.1rem;line-height:1;transition:transform .2s;}
  .interview-card[open] > summary::after{content:'▾';}
  .interview-card > summary:hover .ic-question{background:#221a3d;}
  .interview-card:not([open]) .ic-meta{border-bottom:none;}"""

FLOW_CSS = """
  .flow{display:flex;align-items:center;gap:.4rem;margin:1rem 0;flex-wrap:wrap;justify-content:center;}
  .flow-step{background:#0d1730;border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:6px;padding:.55rem .9rem;font-size:.85rem;min-width:90px;text-align:center;}
  .flow-arrow{color:var(--accent);font-size:1.3rem;font-weight:700;}
  .flow-step.start{border-left-color:var(--green);}.flow-step.end{border-left-color:var(--orange);}.flow-step.phase{border-left-color:var(--yellow);font-weight:600;}
  .flow-col{display:flex;flex-direction:column;gap:.35rem;margin:1rem 0;}
  .bit-row{display:flex;margin:1rem 0;border-radius:8px;overflow:hidden;border:1px solid var(--border);font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:.75rem;}
  .bit-seg{padding:.5rem .35rem;text-align:center;border-right:1px solid var(--border);color:var(--text-bright);line-height:1.35;}
  .bit-seg:last-child{border-right:none;}
  .bit-seg small{display:block;color:var(--text-dim);font-size:.68rem;margin-top:2px;}"""


def inject_css(content: str) -> str:
    if "interview-card > summary" not in content and ".interview-card{" in content:
        content = content.replace(
            ".interview-card{background:",
            INTERVIEW_SUMMARY_CSS + "\n  .interview-card{background:",
            1,
        )
    if ".flow{display:flex" not in content and "</style>" in content:
        content = content.replace("</style>", FLOW_CSS + "\n</style>", 1)
    return content


def fix_scroll_spy(content: str) -> str:
    return content.replace(
        "document.querySelectorAll('.sidebar a')",
        "document.querySelectorAll('.toc a')",
    )


def convert_interview_cards(content: str) -> str:
    if '<div class="interview-card">' not in content:
        return content

    # Add hint in ix-sub if missing
    if "点击题目展开答案" not in content and 'class="ix-sub"' in content:
        content = re.sub(
            r'(<div class="ix-sub">)(.*?)(</div>)',
            lambda m: m.group(1)
            + m.group(2).rstrip()
            + ('' if m.group(2).endswith('。') else '')
            + '<strong style="color:var(--text-bright);">点击题目展开答案</strong>'
            + m.group(3),
            content,
            count=1,
            flags=re.DOTALL,
        )

    pattern = re.compile(
        r'<div class="interview-card">\s*'
        r'(<div class="ic-question">.*?</div>\s*'
        r'<div class="ic-meta">.*?</div>)\s*'
        r'(<div class="ic-body">.*?</div>)\s*'
        r'</div>',
        re.DOTALL,
    )

    def repl(m: re.Match) -> str:
        return (
            '<details class="interview-card">\n    <summary>\n    '
            + m.group(1).strip()
            + "\n    </summary>\n    "
            + m.group(2).strip()
            + "\n  </details>"
        )

    return pattern.sub(repl, content)


def main() -> None:
    for path in FILES:
        text = path.read_text(encoding="utf-8")
        original = text
        text = inject_css(text)
        text = fix_scroll_spy(text)
        text = convert_interview_cards(text)
        if text != original:
            path.write_text(text, encoding="utf-8")
            print(f"patched {path.relative_to(ROOT)}")
        else:
            print(f"unchanged {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
