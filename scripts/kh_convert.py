#!/usr/bin/env python3
"""Convert staged AI Knowledge Hub pages into tech-notes-conformant guide pages.

Reads a JSON job list (argv[1]) of:
  {"src": "...abs path...", "dst": "...abs path...",
   "cat": "Transformer", "dir_link": "ai_engineering_directory.html",
   "prefix": "..", "tags": "attention qkv"}

Emits a full guide page: tn-topnav v2, .layout + aside.toc + main,
hero + section.chapter, correct asset order, scroll-spy, theme toggle.
Guarantees TOC href <-> section id integrity and <details><summary> balance.
"""
from __future__ import annotations
import html as html_lib
import json
import re
import sys
from pathlib import Path

TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
BADGE_RE = re.compile(r"^\s*([A-Za-z]{1,3}\d{1,3})\b")
CONTAINER_RE = re.compile(r'<div class="container"[^>]*>', re.I)
SIDEBAR_RE = re.compile(r'<nav class="sidebar"[^>]*>.*?</nav>', re.I | re.S)
HOMEBTN_RE = re.compile(r'<a[^>]*class="[^"]*home-btn[^"]*"[^>]*>.*?</a>', re.I | re.S)
INTOC_RE = re.compile(r'<div class="toc"[^>]*>.*?</div>\s*', re.I | re.S)
H1_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.I | re.S)
SUBTITLE_RE = re.compile(r'<p class="subtitle"[^>]*>(.*?)</p>', re.I | re.S)
SCRIPTS_TAIL_RE = re.compile(r'<script[\s\S]*', re.I)
H2_RE = re.compile(r'<h2\b([^>]*)>(.*?)</h2>', re.I | re.S)
IDATTR_RE = re.compile(r'\bid="([^"]+)"')
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
# 去掉标题里的序号前缀：阿拉伯 "1." / "1.2" / 中文 "一、" / "第八章" / "八、" 等
NUMPREFIX_RE = re.compile(
    r"^\s*(?:第\s*[0-9一二三四五六七八九十百]+\s*[章节讲部篇]\s*[:：.、]?"
    r"|[0-9一二三四五六七八九十]+\s*[、.．）)]"
    r"|[0-9]+(?:\.[0-9]+)*[.、]?)\s*"
)
DIV_TAG_RE = re.compile(r'<div\b[^>]*>|</div>', re.I)
CLASS_ATTR_RE = re.compile(r'class="([^"]*)"', re.I)
SENT_RE = re.compile(r"(.+?[。.!?！？；;])")
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)


def strip_text(s: str) -> str:
    return WS_RE.sub(" ", html_lib.unescape(TAG_RE.sub(" ", s))).strip()


def unwrap_wrappers(html: str, classes: set[str]) -> str:
    """Remove <div class="X"> ... </div> wrapper tags (keep inner content) for
    the given class tokens, matching opens/closes with a depth stack so nested
    <div> content (arch-diagram, tables…) is preserved."""
    spans: list[tuple[int, int]] = []
    stack: list[bool] = []
    for m in DIV_TAG_RE.finditer(html):
        tag = m.group(0)
        if tag[:2] == "</":
            if stack:
                if stack.pop():
                    spans.append((m.start(), m.end()))
        else:
            cm = CLASS_ATTR_RE.search(tag)
            is_target = bool(cm and (set(cm.group(1).split()) & classes))
            if is_target:
                spans.append((m.start(), m.end()))
            stack.append(is_target)
    if not spans:
        return html
    spans.sort()
    out, last = [], 0
    for s, e in spans:
        out.append(html[last:s])
        last = e
    out.append(html[last:])
    return "".join(out)


def number_reflist(html: str) -> str:
    """给 <ol class="ref-list"> 里没有 id 的 <li> 顺序补上 id="ref-N"，
    让正文脚注 <a href="#ref-N"> 能命中（远程源常漏这些锚点）。"""
    counter = {"n": 0}

    def repl_ol(m: "re.Match[str]") -> str:
        def repl_li(lm: "re.Match[str]") -> str:
            counter["n"] += 1
            return f'<li id="ref-{counter["n"]}"'
        return re.sub(r'<li(?![^>]*\bid=)', repl_li, m.group(0))

    return re.sub(r'<ol class="ref-list">.*?</ol>', repl_ol, html, flags=re.S)


def derive_sub(inner: str) -> str:
    """一句话章节副标题：取章节首个段落（或直觉盒）的第一句。"""
    m = re.search(r'<p[^>]*>(.*?)</p>', inner, re.I | re.S)
    if not m:
        return ""
    t = strip_text(m.group(1))
    sm = SENT_RE.match(t)
    s = (sm.group(1) if sm else t).rstrip("。.!?！？；; ")
    if len(s) > 46:
        s = s[:46].rstrip("，,、 ") + "…"
    return s


def slugify(s: str, fallback: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or fallback


QA_ITEM_RE = re.compile(
    r'<div class="qa-item"[^>]*>\s*'
    r'<div class="qa-q"[^>]*>(.*?)</div>\s*'
    r'<div class="qa-a"[^>]*>(.*?)</div>\s*'
    r'</div>', re.I | re.S)
INTERVIEW_QA_RE = re.compile(
    r'<div class="interview-qa"[^>]*>\s*'
    r'<div class="q"[^>]*>(.*?)</div>\s*'
    r'<div class="a"[^>]*>(.*?)</div>\s*'
    r'</div>', re.I | re.S)


BLOCK_START_RE = re.compile(r'^\s*<(?:p|div|ul|ol|table|pre|h[1-6]|details|blockquote|figure)\b', re.I)


def _qa(m: re.Match) -> str:
    q = strip_text(m.group(1))
    a = m.group(2).strip()
    if not BLOCK_START_RE.match(a):
        a = f"<p>{a}</p>"
    return (f'<details class="qa"><summary>{q}</summary>'
            f'<div class="a">{a}</div></details>')


# ------------------------------------------------------------------ ASCII 图
# 自动把 ASCII 框线图转成结构化组件：竖向管线 -> .flow；网格/矩阵 -> 干净"示意图"卡
BOX_SET = set("┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬▼▲◄►◀▶△▽")
CONNECTOR_SET = set("│║▼▲△▽↓↑+· ")
ARROW_CHARS = "▼▲△▽↓↑→←➜➔"


def _strip_frame(line: str) -> str:
    """去掉框线字符，保留文字与箭头注释。"""
    out = "".join(" " if c in BOX_SET else c for c in line)
    out = out.strip().strip("".join(("←", "→", "·", "-", " ")))
    return WS_RE.sub(" ", out).strip()


def _is_border(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    return all((c in BOX_SET or c == " ") for c in s) and any(
        c in "─═┌┐└┘├┤┬┴┼╔╗╚╝╠╣╦╩╬" for c in s)


def _is_connector(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    return all(c in CONNECTOR_SET for c in s) and any(c in "│║▼▲△▽↓↑" for c in s)


def _has_box(text: str) -> bool:
    return any(c in BOX_SET for c in text)


def _is_grid(text: str) -> bool:
    if "┼" in text or "╬" in text:
        return True
    multi = sum(1 for ln in text.split("\n")
                if (ln.count("│") + ln.count("║")) >= 3)
    return multi >= 2


def _split_title(text: str):
    """若首个非空行不含框线字符，视为图标题，返回 (title, body)。"""
    lines = text.split("\n")
    idx = 0
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    if idx < len(lines) and not _has_box(lines[idx]):
        rest = "\n".join(lines[idx + 1:])
        if _has_box(rest):
            return lines[idx].strip().rstrip(":："), rest
    return "", text


LEADING_ARROW_RE = re.compile(r"^\s*(?:[↓▼△▽→➜⇒➔]+|[├└][─]+)\s*")


def ascii_to_flow_nodes(text: str):
    """把框线图解析成有序节点列表；每节点是若干文字片段。<2 节点返回 None。
    支持两类边界：① 纯连接/边框行；② 以箭头/树枝开头的行（↓ label / ├── label）。"""
    nodes: list[list[str]] = []
    cur: list[str] = []

    def flush():
        nonlocal cur
        frag = [f for f in (s.strip() for s in cur) if f]
        if frag:
            nodes.append(frag)
        cur = []

    for ln in text.split("\n"):
        if not ln.strip():
            continue
        if _is_border(ln) or _is_connector(ln):
            flush()
            continue
        if LEADING_ARROW_RE.match(ln):
            flush()
            t = _strip_frame(LEADING_ARROW_RE.sub("", ln))
            if t:
                cur.append(t)
            continue
        t = _strip_frame(ln)
        if t:
            cur.append(t)
    flush()
    return nodes if len(nodes) >= 2 else None


def _flow_html(title: str, nodes: list[list[str]]) -> str:
    parts = ['<div class="flow">']
    if title:
        parts.append(f'  <div class="flow-title">{html_lib.escape(title)}</div>')
    n = len(nodes)
    for i, frag in enumerate(nodes):
        cls = "flow-node accent" if i == 0 else ("flow-node good" if i == n - 1 else "flow-node")
        label = html_lib.escape(frag[0])
        sub = " · ".join(frag[1:])
        node = f'  <div class="{cls}"><div class="nlabel">{label}</div>'
        if sub:
            node += f'<div class="nsub">{html_lib.escape(sub)}</div>'
        node += "</div>"
        parts.append(node)
        if i < n - 1:
            parts.append('  <div class="flow-arrow"></div>')
    parts.append("</div>")
    return "\n".join(parts)


def _diagram_card(title: str, body: str) -> str:
    """无法结构化的图 -> 干净"示意图"卡（等宽但非代码样式，由 .arch-diagram 提供）。"""
    inner = (f"{title}\n{body}" if title else body).strip("\n")
    return f'<div class="arch-diagram">{inner}</div>'


def _convert_ascii_text(text: str) -> str:
    """给定框线图纯文本，返回 .flow 或 干净示意图卡。"""
    text = _strip_inline_tags(html_lib.unescape(text))
    if not _has_box(text):
        return None
    title, body = _split_title(text)
    if not _is_grid(body):
        nodes = ascii_to_flow_nodes(body)
        if nodes:
            return _flow_html(title, nodes)
    return _diagram_card(title, body)


DIAG_BLOCK_RE = re.compile(
    r'<div class="(?:arch-diagram|flow-diagram)"[^>]*>(.*?)</div>', re.I | re.S)
PRE_BLOCK_RE = re.compile(
    r'<pre>\s*(?:<code[^>]*>)?(.*?)(?:</code>)?\s*</pre>', re.I | re.S)
# 真代码信号：含这些多半是源码而非图（即便夹带少量 └── 目录树字符）
CODE_HINT_RE = re.compile(
    r'[{};]|//|/\*|\bdef |\breturn\b|\bvoid\b|\bpublic\b|\bclass \b|#include|\bimport ')
# 更宽松的代码判定（用于 .diagram 里混入的 Python/伪代码；RHS 限 ASCII 以避开中文散文里的 "＝"）
CODE_SIGNAL_RE = re.compile(
    r'[{};]|//|/\*|"""|\'\'\'|=>|\bdef |\bclass |\bimport |\bfrom \w+ import|'
    r'\breturn\b|#include|\.[A-Za-z_]\w*\(|=\s*[A-Za-z0-9_\[{("]')
FLOW_ARROW_CHARS = "↓▼"
# 远程图里常把 ASCII 用 <span class="stage/arrow"> 等内联标签包裹，解析前先剥掉
INLINE_TAG_RE = re.compile(r"</?(?:span|b|strong|em|i|code|small)[^>]*>", re.I)


def _strip_inline_tags(text: str) -> str:
    return INLINE_TAG_RE.sub("", text)


def _has_flow(text: str) -> bool:
    if any(c in text for c in FLOW_ARROW_CHARS):
        return True
    return any(LEADING_ARROW_RE.match(ln) for ln in text.split("\n"))


def _box_density(text: str) -> float:
    lines = [l for l in text.split("\n") if l.strip()]
    if not lines:
        return 0.0
    return sum(1 for l in lines if _has_box(l)) / len(lines)


def convert_ascii_blocks(html: str) -> str:
    def _diag(m):
        inner = m.group(1)
        txt = _strip_inline_tags(html_lib.unescape(inner))
        # ① 竖向管线（框线或 ↓/▼/树枝箭头）-> .flow
        if (_has_box(txt) or _has_flow(txt)) and not _is_grid(txt):
            title, body = _split_title(txt)
            nodes = ascii_to_flow_nodes(body)
            if nodes:
                return _flow_html(title, nodes)
        # ② 复杂框线/网格 -> 干净示意图卡
        if _has_box(txt):
            title, body = _split_title(txt)
            return _diagram_card(title, body)
        # ③ 无框线的 .diagram：远程常把「代码/模板」也塞进来 -> 还原为代码块
        if CODE_SIGNAL_RE.search(inner):
            return f"<pre><code>{inner.strip()}</code></pre>"
        return m.group(0)

    def _pre(m):
        inner = m.group(1)
        if not _has_box(inner):
            return m.group(0)  # 真代码块，保留
        # 含代码信号且框线字符占比不高 -> 判为源码（含目录树），保留
        if CODE_HINT_RE.search(html_lib.unescape(inner)) and _box_density(inner) < 0.5:
            return m.group(0)
        out = _convert_ascii_text(inner)
        return out if out else m.group(0)

    html = DIAG_BLOCK_RE.sub(_diag, html)
    html = PRE_BLOCK_RE.sub(_pre, html)
    return html


def map_components(html: str) -> str:
    # 统一各种问答标记 -> <details class="qa"><summary>…</summary><div class="a">…</div>
    html = QA_ITEM_RE.sub(_qa, html)
    html = INTERVIEW_QA_RE.sub(_qa, html)
    # 公式块 / ASCII 流程图 类名归一
    html = re.sub(r'<div class="formula-block"', '<div class="formula"', html, flags=re.I)
    html = re.sub(r'<div class="diagram"', '<div class="arch-diagram"', html, flags=re.I)
    # bare <details> -> qa; keep existing class if present
    html = re.sub(r'<details(?!\s+class)([^>]*)>', r'<details class="qa"\1>', html, flags=re.I)
    html = html.replace('<div class="answer">', '<div class="a">')
    # ASCII 框线图 -> .flow / 干净示意图卡（放最后，确保 .diagram 已归一为 arch-diagram）
    html = convert_ascii_blocks(html)
    return html


def extract_content(raw: str) -> str:
    # drop head
    body = re.sub(r"<head\b[\s\S]*?</head>", "", raw, flags=re.I)
    body = SIDEBAR_RE.sub("", body)
    body = HOMEBTN_RE.sub("", body)
    body = SCRIPTS_TAIL_RE.sub("", body)  # cut trailing scripts
    # take inside container if present
    m = CONTAINER_RE.search(body)
    if m:
        body = body[m.end():]
        # drop last </div> (container close) + any </body></html> leftovers
        idx = body.rfind("</div>")
        if idx != -1:
            body = body[:idx]
    body = re.sub(r"</?(body|html)>", "", body, flags=re.I)
    body = INTOC_RE.sub("", body)
    body = H1_RE.sub("", body, count=1)
    body = SUBTITLE_RE.sub("", body, count=1)
    # 去掉 HTML 注释（远程页用 <!-- Section N --> 做分节标记，会漏进正文）
    body = COMMENT_RE.sub("", body)
    # 拆掉纯结构性 section 包裹 div（保留内部内容，避免孤立 </div>）
    body = unwrap_wrappers(body, {"section", "qa-section", "content", "sections", "ref-section"})
    return body


def build_chapters(content: str):
    """Return (chapters, toc_items). chapters: list of (id, heading, inner)."""
    matches = list(H2_RE.finditer(content))
    chapters = []
    if not matches:
        cid = "overview"
        chapters.append((cid, "概览", content.strip()))
        return chapters
    pre = content[: matches[0].start()].strip()
    used = set()
    for i, m in enumerate(matches):
        attrs, inner = m.group(1), m.group(2)
        idm = IDATTR_RE.search(attrs or "")
        heading = strip_text(inner)
        heading = NUMPREFIX_RE.sub("", heading) or heading
        cid = idm.group(1) if idm else slugify(heading, f"ch{i+1}")
        if cid in used:
            cid = f"{cid}-{i+1}"
        used.add(cid)
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        body = content[m.end():end].strip()
        chapters.append((cid, heading, body))
    if pre and strip_text(pre):
        chapters.insert(0, ("overview", "概览", pre))
    return chapters


GH = ('<a class="tn-icon" href="https://github.com/kavinChan13/tech-notes" target="_blank" '
      'rel="noopener" title="GitHub 仓库" aria-label="GitHub 仓库"><svg viewBox="0 0 16 16" '
      'aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 '
      '5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-'
      '.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.'
      '28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 '
      '.67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92'
      '.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93'
      '-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>')
CLOCK = ('<svg class="tn-clock" viewBox="0 0 16 16" width="13" height="13" fill="currentColor" '
         'aria-hidden="true" style="vertical-align:-2px"><path d="M8 0a8 8 0 110 16A8 8 0 018 0ZM1.5 '
         '8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 01-.557 1.392l-2.5-1A.'
         '751.751 0 017 8.25v-3.5a.75.75 0 011.5 0Z"/></svg>')


def convert(job: dict) -> tuple[str, str, str]:
    src, dst = Path(job["src"]), Path(job["dst"])
    prefix = job.get("prefix", "..")
    dir_link = job["dir_link"]
    cat = job.get("cat", "")
    raw = src.read_text(encoding="utf-8", errors="ignore")
    tm = TITLE_RE.search(raw)
    title_raw = strip_text(tm.group(1)) if tm else src.stem
    title_raw = re.sub(r"\s*[-—]\s*AI Knowledge.*$", "", title_raw)
    title_raw = re.sub(r"\s*[-—]\s*AI Agent Sharing.*$", "", title_raw)
    bm = BADGE_RE.search(title_raw)
    badge = bm.group(1) if bm else ""
    main_title = title_raw
    if "·" in title_raw:
        main_title = title_raw.split("·", 1)[1].strip()
    elif badge:
        main_title = title_raw[len(badge):].strip(" ·-—")
    sm = SUBTITLE_RE.search(raw)
    sub = strip_text(sm.group(1)) if sm else ""

    content = map_components(extract_content(raw))
    chapters = build_chapters(content)
    plain_len = len(strip_text(content))
    readtime = max(6, round(plain_len / 850))

    # hero 副标题兜底：源页无 subtitle 时，用正文首段第一句
    if not sub:
        sub = derive_sub(content)

    toc, body = [], []
    num_off = 0 if (chapters and chapters[0][0] == "overview") else 1
    for i, (cid, heading, inner) in enumerate(chapters):
        num = f"{i + num_off:02d}"
        active = ' class="active"' if i == 0 else ""
        toc.append(f'        <li><a href="#{cid}"{active}>{html_lib.escape(heading)}</a></li>')
        csub = derive_sub(inner)
        sub_html = f'<div class="sub">{html_lib.escape(csub)}</div>' if csub else ""
        body.append(
            f'    <section class="chapter" id="{cid}">\n'
            f'      <div class="ch-head"><div class="num">{num}</div>'
            f'<div class="t"><h2>{html_lib.escape(heading)}</h2>{sub_html}</div></div>\n'
            f'      {inner}\n'
            f'    </section>'
        )
    toc_html = "\n".join(toc)
    body_html = "\n\n".join(body)
    roadmap = f"{badge} · {cat}".strip(" ·") or cat or main_title

    page = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<!-- tn-theme-init --><script>try{{var d=document.documentElement,t=localStorage.getItem('theme')||localStorage.getItem('tn-theme');if(t==='dark')d.setAttribute('data-theme','dark');}}catch(e){{}}</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html_lib.escape(main_title)} · {cat} — Tech Notes</title>
<meta name="description" content="{html_lib.escape(sub)[:150]}">
<link rel="stylesheet" href="{prefix}/assets/guide-theme.css">
<link rel="stylesheet" href="{prefix}/assets/kh-guide.css">
<link rel="stylesheet" href="{prefix}/assets/site-tokens.css">
<link rel="stylesheet" href="{prefix}/assets/article.css">
</head>
<body class="has-topnav">

<!-- tn-nav:v2 -->
<nav class="tn-topnav" aria-label="站点导航">
  <div class="tn-topnav-in">
    <a class="tn-brand" href="{prefix}/index.html">Kavin <b>Tech Notes</b></a>
    <div class="tn-navlinks">
      <a class="tn-home" href="{prefix}/index.html">← 主页</a>
      <a href="{dir_link}">目录</a>
      {GH}
      <span class="tn-readmeta" title="预计阅读时长">{CLOCK} {readtime} min</span>
      <button class="theme-btn" id="themeBtn" type="button" aria-label="切换浅色 / 深色">◐</button>
    </div>
  </div>
</nav>
<!-- /tn-nav:v2 -->
<div class="progress" id="progress"></div>

<div class="layout">
  <aside class="toc">
    <h2>{html_lib.escape(roadmap)}</h2>
    <nav>
      <ol>
{toc_html}
      </ol>
    </nav>
  </aside>

  <main>
    <header class="hero">
      <div class="badge">{html_lib.escape((badge + " · " + cat).strip(" ·"))}</div>
      <h1>{html_lib.escape(main_title)}</h1>
      <p class="sub">{html_lib.escape(sub)}</p>
      <div class="meta-row">
        <span class="pill cyan">{html_lib.escape(cat)}</span>
        <span class="pill green">阅读 ~{readtime} min</span>
        <span class="pill amber">{len(chapters)} 章</span>
      </div>
    </header>

{body_html}

    <footer>
      <div class="made">TECH NOTES · {html_lib.escape(cat)} · 整理自 AI Knowledge Hub</div>
    </footer>
  </main>
</div>

<script>
(function(){{var bar=document.getElementById('progress');function u(){{var h=document.documentElement;bar.style.width=h.scrollTop/(h.scrollHeight-h.clientHeight)*100+'%';}}window.addEventListener('scroll',u,{{passive:true}});u();}})();
(function(){{var links=document.querySelectorAll('aside.toc nav a');var secs=Array.from(document.querySelectorAll('section.chapter'));if(!secs.length)return;function u(){{var y=window.scrollY+100,cur=secs[0];for(var i=0;i<secs.length;i++){{if(secs[i].offsetTop<=y)cur=secs[i];}}var id=cur.id;links.forEach(function(a){{a.classList.toggle('active',a.getAttribute('href')==='#'+id);}});}}window.addEventListener('scroll',u,{{passive:true}});u();}})();
</script>
<script src="{prefix}/assets/site-theme-toggle.js" defer></script>
</body>
</html>
'''
    page = number_reflist(page)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(page, encoding="utf-8")
    # integrity check
    ids = set(re.findall(r'\bid="([^"]+)"', page))
    problems = [h for h in re.findall(r'href="#([^"]+)"', page) if h and h not in ids]
    n_open = len(re.findall(r"<details\b", page))
    n_close = len(re.findall(r"</details>", page))
    n_sum = len(re.findall(r"<summary\b", page))
    status = "ok"
    if problems:
        status = f"BROKEN_ANCHORS:{problems}"
    elif n_open != n_close:
        status = f"DETAILS_MISMATCH:{n_open}/{n_close}"
    elif n_open != n_sum:
        status = f"SUMMARY_MISSING:details={n_open} summary={n_sum}"
    return dst.name, f"{len(chapters)}ch/{readtime}min", status


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    for job in jobs:
        name, meta, status = convert(job)
        print(f"{status:22} {name:42} {meta}")


if __name__ == "__main__":
    main()
