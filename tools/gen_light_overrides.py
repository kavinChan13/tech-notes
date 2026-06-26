import os, re, colorsys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUDE = {"li-hongyi-ml-2026", "assets", ".git"}
CSS = os.path.join(ROOT, "assets", "light-theme.css")
MARKER = "/* === AUTO-GENERATED PAGE OVERRIDES === */"

def parse_hex(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c*2 for c in h)
    return int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)

def lum(r,g,b):
    return (0.2126*r + 0.7152*g + 0.0722*b)/255.0

def to_hex(r,g,b):
    return '#%02x%02x%02x' % (max(0,min(255,int(round(r)))),max(0,min(255,int(round(g)))),max(0,min(255,int(round(b)))))

def lighten_rgb(r,g,b):
    h,l,s = colorsys.rgb_to_hls(r/255,g/255,b/255)
    s = min(s, 0.40)
    l = 0.94
    rr,gg,bb = colorsys.hls_to_rgb(h,l,s)
    return rr*255,gg*255,bb*255

def darken_rgb(r,g,b):
    h,l,s = colorsys.rgb_to_hls(r/255,g/255,b/255)
    # near-white inputs report misleadingly high saturation; cap it so darkened
    # text stays neutral/readable instead of turning into a saturated hue.
    s = min(s, 0.22)
    l = 0.24
    rr,gg,bb = colorsys.hls_to_rgb(h,l,s)
    return rr*255,gg*255,bb*255

HEX = re.compile(r'#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
RGBA = re.compile(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)')
VARDEF = re.compile(r'(--[\w-]+)\s*:\s*([^;]+)')

def classify_var(name):
    n = name.lower()
    if re.search(r'text|ink|fg|foreground|heading|title|muted|dim|subtle|secondary|tertiary|copy', n):
        return 'text'
    if re.search(r'bg|background|surface|card|panel|doc|paper|canvas|elevat|fill', n):
        return 'bg'
    if re.search(r'border|rule|divider|stroke|outline', n):
        return 'border'
    return None

DARK_BG = 0.30
LIGHT_TEXT = 0.62

def transform_value(val, darken_dark=True):
    """Lighten dark colors inside a background value. Returns (newval, changed)."""
    changed = [False]
    def rh(m):
        r,g,b = parse_hex(m.group(0))
        if lum(r,g,b) < DARK_BG:
            changed[0] = True
            return to_hex(*lighten_rgb(r,g,b))
        return m.group(0)
    def rr(m):
        r,g,b = int(m.group(1)),int(m.group(2)),int(m.group(3))
        a = m.group(4)
        if lum(r,g,b) < DARK_BG:
            changed[0] = True
            nr,ng,nb = lighten_rgb(r,g,b)
            if a is not None:
                return 'rgba(%d,%d,%d,%s)' % (int(nr),int(ng),int(nb),a)
            return 'rgb(%d,%d,%d)' % (int(nr),int(ng),int(nb))
        return m.group(0)
    val2 = HEX.sub(rh, val)
    val2 = RGBA.sub(rr, val2)
    return val2, changed[0]

def darken_text_value(val):
    """If val is a light solid color, return darkened hex; else None."""
    val = val.strip()
    mh = re.fullmatch(r'#[0-9a-fA-F]{3,6}', val)
    if mh:
        r,g,b = parse_hex(val)
        if lum(r,g,b) > LIGHT_TEXT:
            return to_hex(*darken_rgb(r,g,b))
        return None
    mr = RGBA.fullmatch(val)
    if mr:
        r,g,b = int(mr.group(1)),int(mr.group(2)),int(mr.group(3))
        if lum(r,g,b) > LIGHT_TEXT:
            return to_hex(*darken_rgb(r,g,b))
        return None
    if val.lower() in ('white','#fff','#ffffff','snow','ivory'):
        return '#1f2937'
    return None

SKIP_SEL = ('tn-nav', 'tn-theme-toggle', 'tn-progress')
RULE = re.compile(r'([^{}]+)\{([^{}]*)\}')
SVG_ATTR = re.compile(r'\b(fill|stop-color)\s*=\s*"([^"]+)"')

def _color_lum(val):
    """Return luminance for a hex/rgb/white color string, or None if not a plain color."""
    v = val.strip()
    if v.lower() in ('none', 'transparent', 'currentcolor') or v.startswith('url('):
        return None
    if v.lower() in ('white', '#fff', '#ffffff'):
        return 1.0
    if v.lower() in ('black', '#000', '#000000'):
        return 0.0
    if re.fullmatch(r'#[0-9a-fA-F]{3,6}', v):
        try:
            return lum(*parse_hex(v))
        except Exception:
            return None
    m = RGBA.fullmatch(v)
    if m:
        return lum(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None

def _lighten_color(val):
    v = val.strip()
    if v.lower() in ('white', '#fff', '#ffffff'):
        return '#f5f7fb'
    if v.lower() in ('black', '#000', '#000000'):
        return '#ebeff4'
    if v.startswith('#'):
        return to_hex(*lighten_rgb(*parse_hex(v)))
    m = RGBA.fullmatch(v)
    if m:
        nr, ng, nb = lighten_rgb(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        a = m.group(4)
        return ('rgba(%d,%d,%d,%s)' % (int(nr), int(ng), int(nb), a)) if a is not None else ('rgb(%d,%d,%d)' % (int(nr), int(ng), int(nb)))
    return None

def _darken_color(val):
    v = val.strip()
    if v.lower() in ('white', '#fff', '#ffffff'):
        return '#1f2937'
    if v.startswith('#'):
        return to_hex(*darken_rgb(*parse_hex(v)))
    m = RGBA.fullmatch(v)
    if m:
        return to_hex(*darken_rgb(int(m.group(1)), int(m.group(2)), int(m.group(3))))
    return None

def scoped(selector):
    parts = [p.strip() for p in selector.split(',') if p.strip()]
    out = []
    for p in parts:
        if p.startswith('@') or '%' in p or p in ('from','to') or 'keyframes' in p:
            return None
        if any(s in p for s in SKIP_SEL):
            continue
        out.append('html[data-tn-theme="light"] ' + p)
    if not out:
        return None
    return ', '.join(out)

INLINE_BG = re.compile(r'background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))')

def var_emit_selector(sel):
    s = sel.strip()
    parts = [p.strip() for p in s.split(',')]
    if all(p in (':root', 'html', 'body', ':where(:root)') for p in parts):
        return 'html[data-tn-theme="light"]'
    return scoped(sel)

def process_html(path, acc, svg_acc, inline_acc, var_acc):
    try:
        with open(path,'r',encoding='utf-8') as f:
            text = f.read()
    except Exception:
        return
    # inline style="...background:#dark..." attributes (can't be reached by
    # class selectors; matched via [style*="..."] + !important)
    for sm in re.finditer(r'style="([^"]*)"', text):
        for bm in INLINE_BG.finditer(sm.group(1)):
            substr = bm.group(0)
            if substr in inline_acc:
                continue
            l = _color_lum(bm.group(1))
            if l is not None and l < DARK_BG:
                nv, ch = transform_value(bm.group(1))
                if ch:
                    inline_acc[substr] = nv
    # SVG fill / stop-color attributes (whole document).
    # Slightly wider thresholds than CSS: dark shapes -> light, and any
    # non-dark fill that would be low-contrast on white -> darkened, so
    # colored diagram TEXT/labels stay readable (strokes are untouched).
    SVG_DARK, SVG_LIGHT = 0.32, 0.50
    for prop, val in SVG_ATTR.findall(text):
        l = _color_lum(val)
        if l is None:
            continue
        key = (prop, val)
        if key in svg_acc:
            continue
        if l < SVG_DARK:
            nv = _lighten_color(val)
            if nv:
                svg_acc[key] = nv
        elif l > SVG_LIGHT:
            nv = _darken_color(val)
            if nv:
                svg_acc[key] = nv
    for style in re.findall(r'<style[^>]*>(.*?)</style>', text, re.S):
        style = re.sub(r'/\*.*?\*/', '', style, flags=re.S)
        for sel, body in RULE.findall(style):
            sel = sel.strip()
            if not sel or sel.startswith('@') or '%' in sel:
                continue
            # CSS custom-property remapping (text light->dark, bg/border dark->light)
            if '--' in body:
                vsel = var_emit_selector(sel)
                if vsel:
                    for vname, vval in VARDEF.findall(body):
                        cat = classify_var(vname)
                        if not cat:
                            continue
                        l = _color_lum(vval)
                        if l is None:
                            continue
                        new = None
                        if cat == 'text' and l > 0.55:
                            new = _darken_color(vval)
                        elif cat in ('bg', 'border') and l < 0.50:
                            new = _lighten_color(vval)
                        if new:
                            var_acc.setdefault(vsel, {}).setdefault(vname, new)
            decls = {}
            for d in body.split(';'):
                if ':' not in d:
                    continue
                prop, _, v = d.partition(':')
                decls[prop.strip().lower()] = v.strip().replace('!important','').strip()
            bg = decls.get('background-color') or decls.get('background')
            bg_dark = False
            out = {}
            if bg:
                nv, ch = transform_value(bg)
                if ch:
                    out['background'] = nv
                    bg_dark = True
            bc = decls.get('border-color') or decls.get('border')
            # only lighten standalone border-color (avoid mangling shorthand border with width/style? keep simple: only border-color)
            if 'border-color' in decls:
                nv, ch = transform_value(decls['border-color'])
                if ch:
                    out['border-color'] = nv
            col = decls.get('color')
            if col and (('background' not in decls and 'background-color' not in decls) or bg_dark):
                dk = darken_text_value(col)
                if dk:
                    out['color'] = dk
            if not out:
                continue
            ssel = scoped(sel)
            if not ssel:
                continue
            key = ssel
            if key not in acc:
                acc[key] = out
            else:
                for k,v in out.items():
                    acc[key].setdefault(k,v)

def main():
    acc = {}
    svg_acc = {}
    inline_acc = {}
    var_acc = {}
    for dp,dns,fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in EXCLUDE]
        if os.path.relpath(dp,ROOT).replace('\\','/').split('/')[0] == 'bigdata':
            continue
        for fn in fns:
            if fn.endswith('.html'):
                process_html(os.path.join(dp,fn), acc, svg_acc, inline_acc, var_acc)
    lines = []
    # custom-property remaps first (so var()-based colors flip)
    lines.append('/* --- CSS variable remaps --- */')
    for vsel in sorted(var_acc):
        body = ''.join('%s:%s !important;' % (k, v) for k, v in sorted(var_acc[vsel].items()))
        lines.append('%s{%s}' % (vsel, body))
    for sel in sorted(acc):
        decls = acc[sel]
        body = ''.join('%s:%s !important;' % (k,v) for k,v in decls.items())
        lines.append('%s{%s}' % (sel, body))
    # SVG fill / stop-color overrides (global, attribute-selector based)
    lines.append('/* --- SVG diagram fills --- */')
    for (prop, val) in sorted(svg_acc):
        nv = svg_acc[(prop, val)]
        lines.append('html[data-tn-theme="light"] svg [%s="%s"]{%s:%s !important;}' % (prop, val, prop, nv))
    # inline style="" backgrounds (matched by substring)
    lines.append('/* --- inline style backgrounds --- */')
    for substr in sorted(inline_acc):
        lines.append('html[data-tn-theme="light"] [style*="%s"]{background:%s !important;}' % (substr, inline_acc[substr]))
    with open(CSS,'r',encoding='utf-8') as f:
        css = f.read()
    idx = css.find(MARKER)
    head = css[:idx+len(MARKER)]
    # keep the explanatory comment that follows the marker
    after = css[idx+len(MARKER):]
    mcomment = re.match(r'\s*/\*.*?\*/', after, re.S)
    comment = mcomment.group(0) if mcomment else ''
    newcss = head + comment + '\n' + '\n'.join(lines) + '\n'
    with open(CSS,'w',encoding='utf-8') as f:
        f.write(newcss)
    print('Generated %d selector overrides' % len(acc))

if __name__ == '__main__':
    main()
