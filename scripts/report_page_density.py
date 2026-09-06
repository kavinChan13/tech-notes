#!/usr/bin/env python3
"""按页统计「正文字数 / 代码块 / 图 / 表」，用来判断一页是不是代码墙或文字墙。

    python scripts/report_page_density.py system communication
    python scripts/report_page_density.py --all --sort pre
    python scripts/report_page_density.py --all --over          # 只列超标的

判据见 .cursor/rules/content-quality.mdc：
  - `<pre>` 一页 3–6 块（长内核/协议篇可放宽到 10），超过就是代码墙
  - 讲流程/结构/状态/时序的地方应该有图；图少而 pre 多 = 该转图
  - 正文字数不是越多越好，深度靠洞见不靠堆字

⚠️ 「正文」这一列有两处会让压缩幅度**看起来比实际小**，看数字时要知道：

  1. 它**不数 `<pre>` 里的字，却数表格单元格**。把命令输出改写成
     「字段 → 含义 → 判据」的表是我们鼓励的做法，但那批文字会从
     "不计数"搬进"计数"，于是正文数字不降反升。
  2. 面试题答案不该压，可它也在「正文」里。一页三分之一是面试题时，
     整页百分比会明显小于实际压缩幅度 —— 所以另列了「可编辑」。

判断一次改造压得够不够，看**可编辑**那一列。

这个脚本**只报数、不改文件**，也不判失败——密度是编辑判断，不是能自动化的对错。
"""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import content_dirs, content_files  # noqa: E402

# 一页允许的 <pre> 数：超过就该问「这些代码是不是在复述正文」
PRE_SOFT = 6
PRE_HARD = 10


def _cjk(html: str) -> int:
    return len(re.findall(r'[\u4e00-\u9fff]', re.sub(r'<[^>]+>', '', html)))


def measure(path: Path) -> dict:
    s = path.read_text(encoding='utf-8', errors='replace')
    body = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', s, flags=re.S)
    prose = re.sub(r'<pre.*?</pre>|<svg.*?</svg>', '', body, flags=re.S)
    cjk = _cjk(prose)
    # 面试题答案属于「不该压」的部分，单列出来才看得出正文到底砍了多少。
    # 一页三分之一是面试题时，整页百分比会明显小于实际压缩幅度。
    qa_cjk = sum(_cjk(m) for m in
                 re.findall(r'<details class="qa">.*?</details>', prose, flags=re.S))
    return {
        'cjk': cjk,
        'qa_cjk': qa_cjk,
        'edit': cjk - qa_cjk,          # 可编辑正文
        'pre': len(re.findall(r'<pre[\s>]', s)),
        # 只数信息性图：装饰图标是 aria-hidden，不带 role="img"
        'svg': len(re.findall(r'role="img"', s)),
        'tbl': len(re.findall(r'<table[\s>]', s)),
        'qa': len(re.findall(r'<details class="qa"', s)),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('dirs', nargs='*', help='内容目录名（不是文件路径）')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--over', action='store_true', help='只列 pre 超标或图明显偏少的')
    ap.add_argument('--sort', default='pre', choices=['pre', 'cjk', 'svg', 'file'])
    args = ap.parse_args()

    dirs = content_dirs() if (args.all or not args.dirs) else args.dirs
    root = Path(__file__).resolve().parent.parent
    rows = []
    for f in content_files(dirs):
        m = measure(f)
        try:
            m['file'] = f.resolve().relative_to(root).as_posix()
        except ValueError:
            m['file'] = f.as_posix()
        rows.append(m)

    if args.over:
        rows = [r for r in rows if r['pre'] > PRE_HARD or (r['pre'] > PRE_SOFT and r['pre'] > r['svg'])]

    key = (lambda r: r['file']) if args.sort == 'file' else (lambda r: -r[args.sort])
    rows.sort(key=key)

    print(f'{"file":58} {"正文":>6} {"可编辑":>6} {"pre":>4} {"图":>4} {"表":>4} {"题":>4}')
    for r in rows:
        flag = ''
        if r['pre'] > PRE_HARD:
            flag = '  ← 代码墙'
        elif r['pre'] > PRE_SOFT and r['pre'] > r['svg']:
            flag = '  ← pre 多于图'
        print(f'{r["file"]:58} {r["cjk"]:6} {r["edit"]:6} '
              f'{r["pre"]:4} {r["svg"]:4} {r["tbl"]:4} {r["qa"]:4}{flag}')

    if rows:
        n = len(rows)
        print(f'\n{n} 个页面 · 正文合计 {sum(r["cjk"] for r in rows)} 字 · '
              f'pre {sum(r["pre"] for r in rows)} · 图 {sum(r["svg"] for r in rows)} · '
              f'表 {sum(r["tbl"] for r in rows)}')
        over = sum(1 for r in rows if r['pre'] > PRE_HARD)
        print(f'其中 pre > {PRE_HARD} 的有 {over} 个')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
