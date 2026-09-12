#!/usr/bin/env python3
"""Audit the article counters on the home page and the topic directory pages.

Three numbers describe the same thing and used to drift apart silently:

  * `index.html`  -> each `.domain-head > span.cnt` ("N 篇")
  * `<topic>/<topic>_directory.html` -> the `.meta` header ("N 篇")
  * that directory page's actual number of `.item` cards

The directory page's `.item` count is the source of truth: it is the catalogue
a reader actually browses, and it is the only one that cannot lie about what is
reachable. The other two must agree with it.

The home page aggregates are then derived:
  文章总数 = sum of all `.cnt` badges, floored to the nearest 10 and suffixed "+"
  分类     = number of `.domain-head h3` cards
  学习路径 = number of `.path` cards under `#paths`

Also reports notes that exist on disk but are not linked from their directory
page (orphans), `*_study_path.html` files missing from `#paths`, and rows in
the home page's 最新更新 timeline that are out of chronological order.

That last check exists because the timeline is the one place on the site where
a *correct* edit still produces a *wrong* page: appending a new entry anywhere
but the top leaves it buried mid-list, where nobody scrolls. Nothing about the
HTML is malformed, so every other audit stays green.

Usage:
    python scripts/audit_counts.py            # report, non-zero exit on drift
    python scripts/audit_counts.py --fix      # rewrite the counters in place
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _site import ROOT, content_dirs, git_lastmod  # noqa: E402

INDEX = ROOT / "index.html"

DOMAIN_CARD = re.compile(
    r'<h3>(?P<title>[^<]+)</h3>\s*<span class="cnt">(?P<cnt>\d+) 篇</span>'
    r'\s*<a class="more" href="\./(?P<dir>[^/]+)/(?P<file>[^"]+)"'
)
DOMAIN_H3 = re.compile(r'<div class="domain-head">\s*<h3>')
PATH_CARD = re.compile(r'<a class="sp-link" href="\./([^"]+)"')
STAT = re.compile(r"<div class=\"stat\"><dt>(?P<label>[^<]+)</dt><dd>(?P<value>[^<]+)</dd></div>")

ITEM = re.compile(r'<div class="item"[^>]*>')
DIR_META_CNT = re.compile(r"(<span>)(~?)(\d+) 篇(</span>)")

LATEST_BLOCK = re.compile(r'<div class="latest">([\s\S]*?)\n\s*</div>')
LATEST_ROW = re.compile(
    r'<a class="l-row" href="([^"]+)"[\s\S]*?<span class="l-date">([^<]+)</span>')

# `.upd` used to carry a relative date typed by hand ("今天更新", "2 个月前更新").
# Nothing recomputed it, so every one of them was a lie within days — a home
# page that is wrong while every audit stays green. Derive it from the linked
# page's last commit date and print an absolute month, which cannot rot.
FEATURED_CARD = re.compile(
    r'<a class="f-card" href="\./(?P<href>[^"]+)"[\s\S]*?'
    r'<span class="upd">(?P<upd>[^<]*)</span>')
FOOTER_UPDATED = re.compile(r"(最后更新[：:]\s*)(\d{4}-\d{2})")


def upd_text(month: str) -> str:
    return f"{month} 更新"


def directory_pages() -> dict[str, Path]:
    out = {}
    for d in content_dirs():
        for p in sorted((ROOT / d).glob("*_directory.html")):
            out[d] = p
    return out


def item_count(path: Path) -> int:
    return len(ITEM.findall(path.read_text(encoding="utf-8")))


def site_dates() -> tuple[dict[str, str], str]:
    """(path -> YYYY-MM-DD, newest month across all notes as YYYY-MM)."""
    lastmod = git_lastmod()
    note_dates = [
        d for rel_path, d in lastmod.items()
        if rel_path.endswith(".html") and d and not rel_path.startswith(".")
    ]
    newest = max(note_dates)[:7] if note_dates else ""
    return lastmod, newest


def main(argv: list[str]) -> int:
    fix = "--fix" in argv
    index_src = INDEX.read_text(encoding="utf-8")
    dirs = directory_pages()
    problems: list[str] = []
    lastmod, site_month = site_dates()

    # ---- per-topic: home cnt == directory meta == directory .item count ----
    seen_dirs = set()
    for m in DOMAIN_CARD.finditer(index_src):
        d, cnt = m.group("dir"), int(m.group("cnt"))
        seen_dirs.add(d)
        dir_page = dirs.get(d)
        if dir_page is None:
            problems.append(f"home card 「{m.group('title')}」 links to {d}/ which has no *_directory.html")
            continue
        actual = item_count(dir_page)
        if cnt != actual:
            problems.append(
                f"{d}: home cnt={cnt} but {dir_page.name} lists {actual} .item cards")
        meta = DIR_META_CNT.search(dir_page.read_text(encoding="utf-8"))
        if meta is None:
            problems.append(f"{d}: {dir_page.name} has no 「N 篇」 in its .meta header")
        elif int(meta.group(3)) != actual:
            problems.append(
                f"{d}: {dir_page.name} meta says {meta.group(3)} 篇 but lists {actual} .item cards")

    for d, p in dirs.items():
        if d not in seen_dirs:
            problems.append(f"{d}: has {p.name} but no .domain card on the home page")

    # ---- home aggregates ----
    counts = [int(m.group("cnt")) for m in DOMAIN_CARD.finditer(index_src)]
    n_domains = len(DOMAIN_H3.findall(index_src))
    paths_block = index_src.split('id="paths"', 1)[-1]
    n_paths = len(PATH_CARD.findall(paths_block))
    expected = {
        "文章总数": f"{sum(counts) // 10 * 10}+",
        "分类": str(n_domains),
        "学习路径": str(n_paths),
        "最后更新": site_month,
    }
    stats = {m.group("label"): m.group("value") for m in STAT.finditer(index_src)}
    for label, want in expected.items():
        got = stats.get(label)
        if got != want:
            problems.append(f"index.html 站点统计「{label}」= {got}, expected {want}")
    if len(counts) != n_domains:
        problems.append(
            f"index.html: {n_domains} .domain-head cards but only {len(counts)} parsed .cnt badges")

    # ---- every study path must be reachable: #paths card or its directory page ----
    linked = {m.group(1) for m in PATH_CARD.finditer(paths_block)}
    for d in content_dirs():
        dir_html = dirs[d].read_text(encoding="utf-8") if d in dirs else ""
        for p in sorted((ROOT / d).glob("*_study_path.html")):
            rel = f"{d}/{p.name}"
            if rel in linked or f'href="{p.name}"' in dir_html or f'href="./{p.name}"' in dir_html:
                continue
            problems.append(
                f"{rel} is reachable from neither the #paths section nor its directory page")

    # ---- 最新更新 timeline must read newest-first ----
    block = LATEST_BLOCK.search(index_src)
    if block is None:
        problems.append('index.html has no <div class="latest"> timeline')
    else:
        rows = LATEST_ROW.findall(block.group(1))
        if not rows:
            problems.append("index.html 最新更新 timeline is empty")
        for (prev_href, prev_date), (href, date) in zip(rows, rows[1:]):
            if date > prev_date:
                problems.append(
                    f"index.html 最新更新 out of order: {href} ({date}) sits below "
                    f"{prev_href} ({prev_date}); new entries go at the top of the list")
        # One target, several rows: the reader sees the same link repeatedly and
        # the duplicates push genuinely different entries out of the visible
        # window (the list renders only the first LATEST_MAX rows).
        seen: dict[str, str] = {}
        for href, date in rows:
            if href in seen:
                problems.append(
                    f"index.html 最新更新 lists {href} twice ({seen[href]} and {date}); "
                    f"fold repeat updates of one target into a single row")
            else:
                seen[href] = date

    # ---- 精选卡片 .upd and the two 最后更新 labels must come from git ----
    for m in FEATURED_CARD.finditer(index_src):
        href = m.group("href")
        date = lastmod.get(href)
        if not date:
            problems.append(f"index.html 精选卡片 links to {href}, which git has no commit for")
            continue
        want = upd_text(date[:7])
        if m.group("upd") != want:
            problems.append(
                f"index.html 精选卡片 {href}: .upd says 「{m.group('upd')}」, expected 「{want}」")

    footer = FOOTER_UPDATED.search(index_src)
    if footer is None:
        problems.append("index.html footer has no 「最后更新：YYYY-MM」")
    elif footer.group(2) != site_month:
        problems.append(
            f"index.html footer 最后更新 = {footer.group(2)}, expected {site_month} "
            f"(the stat block says {stats.get('最后更新')})")

    # ---- notes nothing else on the site links to ----
    # A page can legitimately live outside its directory listing (cross-topic
    # hubs, for instance), so "orphan" means *no other page* links to it.
    inbound: set[str] = set()
    for p in ROOT.rglob("*.html"):
        rel_p = p.relative_to(ROOT)
        if any(s.startswith(".") for s in rel_p.parts):
            continue
        src = p.read_text(encoding="utf-8", errors="ignore")
        for href in re.findall(r'href="([^"#?]+\.html)', src):
            target = (p.parent / href).resolve()
            if target != p.resolve():
                inbound.add(target.as_posix())

    for d in sorted(dirs):
        for p in sorted((ROOT / d).glob("*.html")):
            if p.name == "index.html":
                continue
            if p.resolve().as_posix() not in inbound:
                problems.append(f"{d}/{p.name} is an orphan: no other page links to it")

    if fix:
        return apply_fix(index_src, dirs)

    for p in problems:
        print(f"  {p}")
    print(f"\nTotal problems: {len(problems)}")
    return 1 if problems else 0


def apply_fix(index_src: str, dirs: dict[str, Path]) -> int:
    """Rewrite home `.cnt` badges, directory `.meta` counts and the stat block."""
    changed = []

    def fix_card(m: re.Match) -> str:
        d = m.group("dir")
        dir_page = dirs.get(d)
        if dir_page is None:
            return m.group(0)
        actual = item_count(dir_page)
        if int(m.group("cnt")) == actual:
            return m.group(0)
        changed.append(f"index.html cnt for {d}: {m.group('cnt')} -> {actual}")
        return m.group(0).replace(f'>{m.group("cnt")} 篇<', f">{actual} 篇<")

    src = DOMAIN_CARD.sub(fix_card, index_src)

    for d, dir_page in sorted(dirs.items()):
        actual = item_count(dir_page)
        text = dir_page.read_text(encoding="utf-8")
        new, n = DIR_META_CNT.subn(
            lambda m: f"{m.group(1)}{m.group(2)}{actual} 篇{m.group(4)}", text, count=1)
        if n and new != text:
            dir_page.write_text(new, encoding="utf-8", newline="")
            changed.append(f"{dir_page.name} meta -> {actual} 篇")

    lastmod, site_month = site_dates()

    def fix_upd(m: re.Match) -> str:
        date = lastmod.get(m.group("href"))
        if not date:
            return m.group(0)
        want_upd = upd_text(date[:7])
        if m.group("upd") == want_upd:
            return m.group(0)
        changed.append(f"index.html 精选 {m.group('href')} .upd -> {want_upd}")
        return m.group(0).replace(
            f'<span class="upd">{m.group("upd")}</span>',
            f'<span class="upd">{want_upd}</span>')

    src = FEATURED_CARD.sub(fix_upd, src)

    def fix_footer(m: re.Match) -> str:
        if m.group(2) == site_month:
            return m.group(0)
        changed.append(f"index.html footer 最后更新: {m.group(2)} -> {site_month}")
        return f"{m.group(1)}{site_month}"

    src = FOOTER_UPDATED.sub(fix_footer, src)

    counts = [int(m.group("cnt")) for m in DOMAIN_CARD.finditer(src)]
    n_domains = len(DOMAIN_H3.findall(src))
    n_paths = len(PATH_CARD.findall(src.split('id="paths"', 1)[-1]))
    want = {
        "文章总数": f"{sum(counts) // 10 * 10}+",
        "分类": str(n_domains),
        "学习路径": str(n_paths),
        "最后更新": site_month,
    }

    def fix_stat(m: re.Match) -> str:
        label, value = m.group("label"), m.group("value")
        if label in want and want[label] != value:
            changed.append(f"index.html 站点统计「{label}」: {value} -> {want[label]}")
            return m.group(0).replace(f"<dd>{value}</dd>", f"<dd>{want[label]}</dd>")
        return m.group(0)

    src = STAT.sub(fix_stat, src)
    if src != index_src:
        INDEX.write_text(src, encoding="utf-8", newline="")

    for c in changed:
        print(f"  {c}")
    print(f"\nApplied {len(changed)} fix(es). Re-run without --fix to verify.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
