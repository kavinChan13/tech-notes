/* =====================================================================
 * Tech Notes — Unified Site Theme JS
 * ---------------------------------------------------------------------
 * 共享外壳层逻辑：
 *   1) 顶部阅读进度条（监听文档滚动）
 *   2) 顶部 nav bar 自动注入（如果 HTML 没有显式写）
 *   3) 顶部页脚自动注入
 * 命名前缀 `tn-`，不与各文档自身组件冲突。
 * ===================================================================== */
(function () {
  'use strict';

  // -------- 1. Inject top nav bar & progress bar (if missing) --------
  function ensureShell() {
    var body = document.body;
    if (!body) return;

    // Pages that already have their own sticky/fixed top nav should mark
    // themselves with class `tn-shell-overlay` to suppress this shell.
    if (body.classList.contains('tn-shell-overlay')) {
      // Still inject a progress bar (it overlays anything else).
      if (!document.getElementById('tn-progress')) {
        var p0 = document.createElement('div');
        p0.id = 'tn-progress';
        body.insertBefore(p0, body.firstChild);
      }
      return;
    }

    body.classList.add('tn-shell');

    // Progress bar
    if (!document.getElementById('tn-progress')) {
      var p = document.createElement('div');
      p.id = 'tn-progress';
      body.insertBefore(p, body.firstChild);
    }

    // Top nav
    if (!document.querySelector('.tn-topbar')) {
      var nav = document.createElement('nav');
      nav.className = 'tn-topbar';

      var title = (document.title || '').split('·')[0].split('|')[0].trim() || 'Document';
      // Strip overly long suffixes, keep short title for the nav.
      if (title.length > 40) title = title.slice(0, 38) + '…';

      // Compute relative path back to index.html based on current page.
      var here = location.pathname.replace(/\\/g, '/');
      var depth = (here.match(/\/[^/]+\/(?=[^/]+$)/g) || []).length;
      // simpler: count slashes after the repo root we don't know; use href fallback.
      var indexHref = './index.html';
      // If page is under a subdirectory (e.g. em-templates/foo.html), go up one.
      var seg = here.split('/').filter(Boolean);
      if (seg.length >= 2 && /\.html?$/i.test(seg[seg.length - 1])) {
        // if there are >= 2 segments after the repo root we can't know,
        // fall back to checking for known subdirs.
        if (here.indexOf('/em-templates/') !== -1) indexHref = '../index.html';
      }

      nav.innerHTML =
        '<a class="tn-brand" href="' + indexHref + '">' +
          '<span class="tn-dot"></span>' +
          '<span>Tech <span style="color:var(--tn-accent-1)">Notes</span></span>' +
          '<small>· Knowledge Base</small>' +
        '</a>' +
        '<span class="tn-doc-title">' + escapeHtml(title) + '</span>' +
        '<span class="tn-spacer"></span>' +
        '<div class="tn-links">' +
          '<a class="tn-home" href="' + indexHref + '">← 主页</a>' +
          '<a href="https://github.com/kavinChan13/tech-notes" target="_blank" rel="noopener">GitHub</a>' +
        '</div>';
      body.insertBefore(nav, body.firstChild);
    }

    // Footer
    if (!document.querySelector('.tn-footer')) {
      var footer = document.createElement('footer');
      footer.className = 'tn-footer';
      footer.innerHTML =
        'Tech Notes · Personal Knowledge Base' +
        '<span class="tn-sep">·</span>' +
        '<a href="' + ((typeof indexHref !== 'undefined') ? indexHref : './index.html') + '">主页</a>' +
        '<span class="tn-sep">·</span>' +
        '<a href="https://github.com/kavinChan13/tech-notes" target="_blank" rel="noopener">GitHub</a>' +
        '<span class="tn-sep">·</span>' +
        '<span>© 2026 · MIT</span>';
      body.appendChild(footer);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------- 2. Progress bar updater --------
  function bindProgress() {
    var bar = document.getElementById('tn-progress');
    if (!bar) return;
    function update() {
      var doc = document.documentElement;
      var scrolled = (doc.scrollTop || document.body.scrollTop || 0);
      var total = (doc.scrollHeight - doc.clientHeight) || 0;
      var pct = total > 0 ? (scrolled / total) * 100 : 0;
      bar.style.width = pct.toFixed(2) + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  // -------- Boot --------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ensureShell(); bindProgress(); });
  } else {
    ensureShell();
    bindProgress();
  }
})();
