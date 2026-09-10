#!/usr/bin/env python3
"""临时探针：拆解 management_knowledge_system.html 的可编辑字数构成。"""
import re
from pathlib import Path

P = Path('management/management_knowledge_system.html')
s = P.read_text(encoding='utf-8')
body = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
prose = re.sub(r'<pre.*?</pre>|<svg.*?</svg>', '', body, flags=re.S)


def cjk(h):
    return len(re.findall(r'[\u4e00-\u9fff]', re.sub(r'<[^>]+>', '', h)))


out = []
total = cjk(prose)
tables = sum(cjk(m) for m in re.findall(r'<table[\s>].*?</table>', prose, flags=re.S))
notab = re.sub(r'<table[\s>].*?</table>', '', prose, flags=re.S)
out.append(f'total={total} tables={tables} non-table={cjk(notab)}')

# 行号定位：在原文里找每个块的起始行
lines = s.split('\n')
offsets = []
pos = 0
for i, ln in enumerate(lines, 1):
    offsets.append((pos, i))
    pos += len(ln) + 1


def lineno(idx):
    lo, hi = 0, len(offsets) - 1
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if offsets[mid][0] <= idx:
            lo = mid
        else:
            hi = mid - 1
    return offsets[lo][1]


chunks = []
pats = [
    ('p', r'<p(?:\s[^>]*)?>.*?</p>'),
    ('ul', r'<ul(?:\s[^>]*)?>.*?</ul>'),
    ('ol', r'<ol(?:\s[^>]*)?>.*?</ol>'),
    ('mrow', r'<div class="m-row[^"]*">.*?</div>'),
    ('pit', r'<div class="pit">.*?</div>\s*</div>'),
    ('win', r'<div class="win">.*?</div>'),
]
seen = []
for tag, pat in pats:
    for m in re.finditer(pat, notab, flags=re.S):
        c = cjk(m.group(0))
        if c >= 25:
            txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m.group(0)))[:100]
            # 在原文中定位
            frag = m.group(0)[:60]
            idx = s.find(frag)
            chunks.append((c, lineno(idx) if idx >= 0 else 0, tag, txt))
chunks.sort(key=lambda x: -x[0])
out.append(f'\n块 >=25 字：{len(chunks)} 个，合计 {sum(c[0] for c in chunks)} 字\n')
for c, ln, tag, t in chunks:
    out.append(f'{c:5} L{ln:<5} {tag:5} {t}')

Path('scripts/_tmp_mks_report.txt').write_text('\n'.join(out), encoding='utf-8')
print('written', total)
