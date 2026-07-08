#!/usr/bin/env python3
"""Migrate every content article to the unified light-first design system.

Idempotent transforms per page that carries the `<!-- tn-nav:v2 -->` block:
  1. theme-init script -> data-theme (localStorage['theme'] || legacy 'tn-theme')
  2. drop light-theme.css; ensure site-tokens.css + article.css are the LAST
     stylesheets (so they override inline :root + inline component darks)
  3. replace the floating #tn-nav pill (+ its inline toggle script) with the
     sticky .tn-topnav top bar; add `has-topnav` to <body>
  4. remove site-theme.js; ensure site-theme-toggle.js before </body>
  5. scope scroll-spy selectors from `nav a` to `aside.toc nav a`

Directory/index/hub pages have no tn-nav:v2 block and are left untouched.
Run scripts/gen_svg_map.py separately for the SVG fill remap.
"""
from __future__ import annotations
import os, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP_TOP = {'.cursor', 'assets', 'tools', 'scripts', 'node_modules', '.git'}

GH_PATH = ('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z')
CLOCK_PATH = ('M8 0a8 8 0 110 16A8 8 0 018 0ZM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.751.751 0 017 8.25v-3.5a.75.75 0 011.5 0Z')

FOLDER_TARGET = {
    'cpp': 'cpp/modern_cpp_stl_directory.html',
    'stl': 'cpp/modern_cpp_stl_directory.html',
    'ai-native': 'ai-native/ai_engineering_directory.html',
    'ai-infra': 'ai-infra/ai_infra_directory.html',
    'bigdata': 'bigdata/bigdata_directory.html',
    'architect': 'architect/system_architecture_directory.html',
    'system': 'system/linux_system_directory.html',
    'perf-debug': 'perf-debug/perf_debug_directory.html',
    'embedded-realtime': 'embedded-realtime/embedded_realtime_directory.html',
    'interview': 'interview/interview_directory.html',
    'management': 'management/leadership_pm_directory.html',
    'pm': 'management/leadership_pm_directory.html',
}
SUBDIR_TARGET = {
    ('ai-templates',): 'ai-templates/index.html',
    ('pm', 'templates'): 'pm/templates/index.html',
    ('management', 'em-templates'): 'management/em-templates/index.html',
}


def rel(from_dir: pathlib.Path, target_rel: str) -> str:
    return os.path.relpath(ROOT / target_rel, start=from_dir).replace('\\', '/')


def dir_target(rel_parts):
    for sub, tgt in SUBDIR_TARGET.items():
        if rel_parts[:len(sub)] == sub:
            return tgt
    return FOLDER_TARGET.get(rel_parts[0]) if rel_parts else None


def build_topnav(path: pathlib.Path, reading: str | None) -> str:
    d = path.parent
    home = rel(d, 'index.html')
    tgt = dir_target(path.relative_to(ROOT).parts[:-1])
    dirhref = rel(d, tgt) if tgt else home
    meta = ''
    if reading:
        meta = (f'\n      <span class="tn-readmeta" title="预计阅读时长">'
                f'<svg class="tn-clock" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true" style="vertical-align:-2px"><path d="{CLOCK_PATH}"/></svg> {reading}</span>')
    return (
        '<nav class="tn-topnav" aria-label="站点导航">\n'
        '  <div class="tn-topnav-in">\n'
        f'    <a class="tn-brand" href="{home}">Kavin <b>Tech Notes</b></a>\n'
        '    <div class="tn-navlinks">\n'
        f'      <a class="tn-home" href="{home}">← 主页</a>\n'
        f'      <a href="{dirhref}">目录</a>\n'
        f'      <a class="tn-icon" href="https://github.com/kavinChan13/tech-notes" target="_blank" rel="noopener" title="GitHub 仓库" aria-label="GitHub 仓库"><svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="{GH_PATH}"/></svg></a>'
        f'{meta}\n'
        '      <button class="theme-btn" id="themeBtn" type="button" aria-label="切换浅色 / 深色">◐</button>\n'
        '    </div>\n'
        '  </div>\n'
        '</nav>'
    )


def process(path: pathlib.Path) -> str:
    text = path.read_text(encoding='utf-8')
    if '<!-- tn-nav:v2 -->' not in text:
        return 'no-nav'
    orig = text
    depth = len(path.relative_to(ROOT).parts) - 1
    prefix = '../' * depth

    # 1. theme-init
    text = re.sub(
        r'<!-- tn-theme-init --><script>.*?</script>',
        "<!-- tn-theme-init --><script>try{var d=document.documentElement,t=localStorage.getItem('theme')||localStorage.getItem('tn-theme');if(t==='dark')d.setAttribute('data-theme','dark');}catch(e){}</script>",
        text, count=1, flags=re.DOTALL)

    # 2. drop light-theme + existing site-tokens/article links (repositioned below)
    text = re.sub(r'[ \t]*<link[^>]*assets/light-theme\.css[^>]*>\r?\n?', '', text)
    text = re.sub(r'[ \t]*<link[^>]*assets/site-tokens\.css[^>]*>\r?\n?', '', text)
    text = re.sub(r'[ \t]*<link[^>]*assets/article\.css[^>]*>\r?\n?', '', text)
    links = (f'<link rel="stylesheet" href="{prefix}assets/site-tokens.css">\n'
             f'<link rel="stylesheet" href="{prefix}assets/article.css">\n')
    text = text.replace('</head>', links + '</head>', 1)

    # 3. topbar (only if still the old pill)
    if '<div id="tn-nav">' in text:
        m = re.search(r'<!-- tn-nav:v2 -->.*?<!-- /tn-nav:v2 -->', text, flags=re.DOTALL)
        if m:
            block = m.group(0)
            rm = re.search(r'([0-9][0-9.]*)\s*min', block)
            reading = f'{rm.group(1)} min' if rm else None
            newblock = '<!-- tn-nav:v2 -->\n' + build_topnav(path, reading) + '\n<!-- /tn-nav:v2 -->'
            text = text[:m.start()] + newblock + text[m.end():]
        # body class
        if 'has-topnav' not in text:
            if re.search(r'<body[^>]*\bclass="', text):
                text = re.sub(r'(<body[^>]*\bclass=")', r'\1has-topnav ', text, count=1)
            else:
                text = re.sub(r'<body', '<body class="has-topnav"', text, count=1)

    # 4. drop site-theme.js; ensure toggle.js
    text = re.sub(r'[ \t]*<script[^>]*assets/site-theme\.js"[^>]*></script>\r?\n?', '', text)
    if 'assets/site-theme-toggle.js' not in text:
        text = text.replace('</body>', f'<script src="{prefix}assets/site-theme-toggle.js" defer></script>\n</body>', 1)

    # 5. scope scroll-spy so it targets the TOC, never the top bar
    text = text.replace("querySelectorAll('nav a')", "querySelectorAll('nav:not(.tn-topnav) a')")
    text = text.replace('querySelectorAll("nav a")', 'querySelectorAll("nav:not(.tn-topnav) a")')
    text = text.replace('`nav a[href="#', '`nav:not(.tn-topnav) a[href="#')
    text = text.replace("querySelector('nav a", "querySelector('nav:not(.tn-topnav) a")

    if text != orig:
        path.write_text(text, encoding='utf-8', newline='')
        return 'modified'
    return 'unchanged'


def main():
    import sys
    counts = {}
    if len(sys.argv) > 1:
        files = [ROOT / a for a in sys.argv[1:]]
    else:
        files = sorted(ROOT.rglob('*.html'))
    for p in files:
        parts = p.relative_to(ROOT).parts
        if parts and parts[0] in SKIP_TOP:
            continue
        st = process(p)
        counts[st] = counts.get(st, 0) + 1
        if st == 'modified':
            print('[modified]', p.relative_to(ROOT).as_posix())
    print('\n--- summary ---')
    for k in sorted(counts):
        print(k, counts[k])


if __name__ == '__main__':
    main()
