/* ============================================================
   Mermaid 主题桥接（全站共享）

   要解决的两件事：

   1) mermaid 的配色是 initialize() 时**烘进 SVG** 的，之后改 CSS 变量
      不会生效。所以页面里写死 theme:'dark' 的图，在浅色模式下就是深底
      浅字 —— 「浅底深块」那一类回归。

   2) 但「切主题就整页重画」同样不可接受：io_linux_kernel_guide.html
      有 23 张图，第一版这么做的结果是**首屏 13.6 秒、每次切换 4.4 秒**。

   做法：渲染一次，然后把 SVG 里烘死的颜色**替换成 CSS 变量**
   （`fill:#f1f5f9` → `fill:var(--mmc-3)`），两套值由 CSS 按 data-theme
   给。此后切主题是纯 CSS 的事，零 JS、零重绘，和别的页面一样快。
   再配合滚动到视口附近才渲染，首屏也不用等 23 张图。

   用法（放在 mermaid.min.js 之后，两个都带 defer）：
     <script src="../assets/vendor/mermaid.min.js" defer></script>
     <script src="../assets/mermaid-theme.js" defer></script>

   页面要调 flowchart / sequence / gantt 参数，在引入**之前**设
   window.TN_MERMAID_CONFIG，会被合并进来。

   ⚠️ 不要再在页面里调 mermaid.initialize()——本文件会接管。
   ============================================================ */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.mermaid) return;

  /* ---- 两套 themeVariables：键必须一一对应，配对结果就是颜色映射表 ---- */
  var LIGHT = {
    background: 'transparent',
    primaryColor: '#f1f5f9', primaryTextColor: '#111827', primaryBorderColor: '#94a3b8',
    secondaryColor: '#eef2ff', secondaryTextColor: '#111827', secondaryBorderColor: '#94a3b8',
    tertiaryColor: '#f8fafc', tertiaryTextColor: '#111827', tertiaryBorderColor: '#94a3b8',
    mainBkg: '#f1f5f9', secondBkg: '#eef2ff', tertiaryBkg: '#f8fafc',
    textColor: '#111827', nodeBorder: '#94a3b8', lineColor: '#475569',
    clusterBkg: '#eef4ff', clusterBorder: '#cbd5e1', edgeLabelBackground: '#ffffff',
    // 时序图
    actorBkg: '#f1f5f9', actorBorder: '#2563eb', actorTextColor: '#111827',
    actorLineColor: '#94a3b8', signalColor: '#475569', signalTextColor: '#111827',
    labelBoxBkgColor: '#eef2ff', labelBoxBorderColor: '#94a3b8', labelTextColor: '#111827',
    loopTextColor: '#111827', noteBkgColor: '#fef9c3', noteTextColor: '#111827',
    noteBorderColor: '#eab308', activationBkgColor: '#e2e8f0', activationBorderColor: '#94a3b8',
    sequenceNumberColor: '#ffffff',
    // 甘特图
    altSectionBkgColor: '#f8fafc', sectionBkgColor: '#eef2ff', sectionBkgColor2: '#f1f5f9',
    taskBkgColor: '#dbeafe', taskTextColor: '#111827', taskTextDarkColor: '#111827',
    taskTextOutsideColor: '#111827', taskBorderColor: '#2563eb', gridColor: '#cbd5e1',
    doneTaskBkgColor: '#e2e8f0', doneTaskBorderColor: '#94a3b8',
    critBkgColor: '#fee2e2', critBorderColor: '#dc2626', todayLineColor: '#dc2626'
  };

  var DARK = {
    background: 'transparent',
    primaryColor: '#1a2138', primaryTextColor: '#e5e7eb', primaryBorderColor: '#2a3556',
    secondaryColor: '#161b2e', secondaryTextColor: '#e5e7eb', secondaryBorderColor: '#2a3556',
    tertiaryColor: '#0f1424', tertiaryTextColor: '#e5e7eb', tertiaryBorderColor: '#2a3556',
    mainBkg: '#1a2138', secondBkg: '#161b2e', tertiaryBkg: '#0f1424',
    textColor: '#e5e7eb', nodeBorder: '#2a3556', lineColor: '#8a93b8',
    clusterBkg: '#141d33', clusterBorder: '#2a3556', edgeLabelBackground: '#141a2c',
    actorBkg: '#1a2138', actorBorder: '#60a5fa', actorTextColor: '#e5e7eb',
    actorLineColor: '#2a3556', signalColor: '#8a93b8', signalTextColor: '#e5e7eb',
    labelBoxBkgColor: '#161b2e', labelBoxBorderColor: '#2a3556', labelTextColor: '#e5e7eb',
    loopTextColor: '#e5e7eb', noteBkgColor: '#3a3218', noteTextColor: '#f3f4f6',
    noteBorderColor: '#facc15', activationBkgColor: '#232b45', activationBorderColor: '#2a3556',
    sequenceNumberColor: '#0b0d12',
    altSectionBkgColor: '#0f1424', sectionBkgColor: '#161b2e', sectionBkgColor2: '#1a2138',
    taskBkgColor: '#1e3a5f', taskTextColor: '#e5e7eb', taskTextDarkColor: '#e5e7eb',
    taskTextOutsideColor: '#e5e7eb', taskBorderColor: '#60a5fa', gridColor: '#2a3556',
    doneTaskBkgColor: '#232b45', doneTaskBorderColor: '#2a3556',
    critBkgColor: '#4a1d1d', critBorderColor: '#f87171', todayLineColor: '#f87171'
  };

  /* ---- 图元级配色：mermaid 源码里的 `style X fill:#…` / `classDef … fill:#…`
     themeVariables 管不到它们，而 mermaid 的解析器**不接受** `fill:var(--x)`
     （直接 Parse error），所以源码里一律写**浅色值**，由这张表配出深色。
     新增配色成对加进来，不要在页面里另发明一组。 ---- */
  var SRC = {
    '#dbeafe': '#1e3a5f', '#e0e7ff': '#232b45', '#ede9fe': '#2e2547',
    '#fce7f3': '#3d1f33', '#d1fae5': '#14372a', '#ccfbf1': '#10353a',
    '#fef3c7': '#3a2e0f', '#fee2e2': '#3a1a1a',
    '#e8eef5': '#1e293b', '#f7ecec': '#3a1a1a', '#ecf3ed': '#14372a',
    '#fcfaf5': '#1a2138', '#f0eaf3': '#2e2547', '#faf2dc': '#3a2e0f',
    '#2563eb': '#60a5fa', '#4f46e5': '#818cf8', '#7c3aed': '#a78bfa',
    '#db2777': '#f472b6', '#059669': '#34d399', '#0d9488': '#5eead4',
    '#b45309': '#fbbf24', '#dc2626': '#f87171',
    '#1c3a5e': '#93c5fd', '#8a2e2e': '#fca5a5', '#2c6042': '#86efac',
    '#5d3a6a': '#d8b4fe', '#6b6b6b': '#9ca3af',
    '#1a1a1a': '#e5e7eb',
    // mermaid 自己派生、不在 themeVariables 里的几个
    '#000000': '#e5e7eb', '#333333': '#c9d2ee'
  };

  /* ---- 把「浅色 hex → 深色 hex」编成 CSS 变量 ---- */
  var norm = function (h) {
    h = h.toLowerCase();
    return h.length === 4 ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h;
  };

  var pairs = {};
  Object.keys(LIGHT).forEach(function (k) {
    var l = LIGHT[k], d = DARK[k];
    if (typeof l === 'string' && l.charAt(0) === '#' && d) pairs[norm(l)] = d;
  });
  Object.keys(SRC).forEach(function (h) { pairs[norm(h)] = SRC[h]; });

  var varName = {};
  var lightDecl = [], darkDecl = [], i = 0;
  Object.keys(pairs).forEach(function (hex) {
    var n = '--mmc-' + (i++);
    varName[hex] = n;
    lightDecl.push(n + ':' + hex);
    darkDecl.push(n + ':' + pairs[hex]);
  });

  var st = document.createElement('style');
  st.id = 'tn-mermaid-vars';
  st.textContent = ':root{' + lightDecl.join(';') + '}\n'
    + 'html[data-theme="dark"]{' + darkDecl.join(';') + '}';
  document.head.appendChild(st);

  // 把烘死的 hex 换成 var(--mmc-N)，此后配色由 CSS 接管
  function varize(text) {
    return text.replace(/#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b/g, function (h) {
      var n = varName[norm(h)];
      return n ? 'var(' + n + ')' : h;
    });
  }

  function varizeSvg(host) {
    var svg = host.querySelector('svg');
    if (!svg) return;
    var s = svg.querySelector('style');
    if (s) s.textContent = varize(s.textContent);
    var nodes = svg.querySelectorAll('[style],[fill],[stroke],[stop-color]');
    for (var k = 0; k < nodes.length; k++) {
      var el = nodes[k];
      ['style', 'fill', 'stroke', 'stop-color'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v && v.indexOf('#') !== -1) el.setAttribute(a, varize(v));
      });
    }
  }

  /* ---- 初始化：只做一次 ---- */
  var cfg = {
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: LIGHT,          // 永远按浅色烘，深色靠上面的变量翻转
    flowchart: { curve: 'basis', padding: 16, useMaxWidth: true },
    sequence: { actorMargin: 50, messageFontSize: 13, useMaxWidth: true },
    gantt: { barHeight: 22, fontSize: 12, useMaxWidth: true }
  };
  var extra = window.TN_MERMAID_CONFIG;
  if (extra) {
    Object.keys(extra).forEach(function (k) {
      if (k === 'theme' || k === 'startOnLoad' || k === 'themeVariables') return;
      if (cfg[k] && typeof cfg[k] === 'object' && typeof extra[k] === 'object') {
        Object.keys(extra[k]).forEach(function (p) { cfg[k][p] = extra[k][p]; });
      } else {
        cfg[k] = extra[k];
      }
    });
  }
  window.mermaid.initialize(cfg);

  /* ---- 渲染：滚到附近才画。23 张图一次性画要 13 秒，首屏等不起 ---- */
  function renderOne(host) {
    if (host.dataset.mmDone) return;
    host.dataset.mmDone = '1';
    try {
      var r = window.mermaid.run({ nodes: [host] });
      if (r && typeof r.then === 'function') {
        r.then(function () { varizeSvg(host); },
               function (e) { console.error('mermaid run failed', e); });
      } else {
        varizeSvg(host);
      }
    } catch (e) {
      console.error('mermaid render failed', e);
    }
  }

  function start() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid'));
    if (!nodes.length) return;

    if (!('IntersectionObserver' in window)) {
      nodes.forEach(renderOne);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        renderOne(e.target);
      });
    }, { rootMargin: '800px 0px' });     // 提前一屏多开始画，滚到时已经好了
    nodes.forEach(function (n) { io.observe(n); });

    // 锚点直达页面深处时，IntersectionObserver 只会盯住目标附近那几张；
    // 其余的留给滚动触发即可，不必在这里补画。
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
