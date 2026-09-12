/* =====================================================================
 * Tech Notes — Unified Light/Dark Toggle
 * ---------------------------------------------------------------------
 * Single toggle mechanism for the whole site:
 *   attribute : <html data-theme="light|dark">   (default = light)
 *   storage   : localStorage['theme']
 *   buttons   : #tn-theme-toggle (articles) and/or #themeBtn (home/dir)
 *
 * Migrates the legacy article system (localStorage['tn-theme'] +
 * data-tn-theme) on first load so a previously-saved preference carries
 * over. A tiny inline <head> snippet applies the attribute before paint
 * to avoid a flash; this file wires up the buttons and persistence.
 * ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function apply(theme) {
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', theme); } catch (e) {}
    syncButtons(theme);
  }

  function syncButtons(theme) {
    var t = document.getElementById('tn-theme-toggle');
    if (t) t.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  }

  // --- Resolve initial theme (storage -> legacy -> default light) ---
  var saved;
  try {
    saved = localStorage.getItem('theme');
    if (!saved) {
      var legacy = localStorage.getItem('tn-theme');
      if (legacy) { saved = legacy; localStorage.setItem('theme', legacy); }
    }
  } catch (e) {}
  if (saved === 'dark') root.setAttribute('data-theme', 'dark');
  else if (saved === 'light') root.removeAttribute('data-theme');

  // --- Back-to-top: guarantee every page has one working button with a
  //     consistent >400px show threshold (creates it if missing, and wires a
  //     toggle even on pages whose own button lacked a working handler). ---
  function ensureBackTop() {
    if (!document.body) return;
    var btn = document.querySelector('.back-top');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'back-top';
      btn.id = 'backTop';
      btn.type = 'button';
      btn.setAttribute('aria-label', '回到顶部');
      btn.innerHTML = '↑';
      document.body.appendChild(btn);
    }
    if (btn.dataset.tnBt) return;
    btn.dataset.tnBt = '1';
    // Pages ship their own arrow-only button; label it too, not just ours.
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', '回到顶部');
    if (!btn.getAttribute('onclick') && !btn.onclick) {
      btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
    function toggle() { btn.classList.toggle('show', window.scrollY > 400); }
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  // --- Wide tables: give each one its own horizontal scroll box. Guides put
  //     raw <table> straight in the flow, so on a phone a 5-column comparison
  //     table used to drag the whole page sideways. CSS alone can't fix it:
  //     `display:block` on the table just re-lays the columns out at viewport
  //     width, squeezing them to one character per line. A wrapper element is
  //     the only way to let the table keep its natural width and scroll. ---
  function wrapWideTables() {
    var scope = document.querySelector('main') || document.body;
    if (!scope) return;
    var tables = scope.querySelectorAll('table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      var p = t.parentNode;
      if (!p || !p.classList || p.classList.contains('table-scroll')) continue;
      var box = document.createElement('div');
      box.className = 'table-scroll';
      p.insertBefore(box, t);
      box.appendChild(t);
    }
  }

  // --- Mobile table of contents. Below 900px the .toc rail is parked
  //     off-screen (article.css §5) and there was no other way to reach it,
  //     so a 40-chapter guide could only be read by scrolling. Turn the same
  //     <aside class="toc"> into a slide-in drawer behind a topnav button;
  //     nothing per-page changes, and above 900px none of this is visible. ---
  function setupTocDrawer() {
    var toc = document.querySelector('aside.toc');
    var links = document.querySelector('.tn-topnav .tn-navlinks');
    if (!toc || !links || document.querySelector('.tn-toc-btn')) return;
    if (!toc.id) toc.id = 'tn-toc';

    var btn = document.createElement('button');
    btn.className = 'tn-toc-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '本页目录');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', toc.id);
    btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">' +
      '<path d="M2 3.5h12v1.6H2zM2 7.2h12v1.6H2zM2 10.9h8v1.6H2z"/></svg>';

    var backdrop = document.createElement('div');
    backdrop.className = 'tn-toc-backdrop';

    function close() {
      document.body.classList.remove('toc-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      var open = document.body.classList.toggle('toc-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    btn.addEventListener('click', toggle);
    backdrop.addEventListener('click', close);
    // jumping to a section is the whole point of opening it
    toc.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    // the rail comes back on its own past 900px; leave no stuck state behind
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) close();
    }, { passive: true });

    links.insertBefore(btn, links.firstChild);
    document.body.appendChild(backdrop);
  }

  // --- Second TOC level. Long guides list only their chapters in the rail:
  //     management_knowledge_system.html offers 18 links for 112 subsections,
  //     so the only way to reach 11.3 was to scroll the article hunting for it.
  //     The subsections are already anchored (`h3[id]`), so the rail can be
  //     derived rather than hand-maintained — nothing per-page changes.
  //
  //     Only the current chapter's sub-list is expanded: showing all 112 at
  //     once would turn the rail into a wall longer than the viewport. ---
  function buildTocSubnav() {
    var nav = document.querySelector('aside.toc nav');
    var main = document.querySelector('main');
    if (!nav || !main) return;
    // Pages that already ship a two-level TOC (159 of them) keep theirs.
    if (nav.querySelector('ol ol, ul ul, ol ul, ul ol')) return;

    var tops = [];
    nav.querySelectorAll(':scope > ol > li > a[href^="#"], :scope > ul > li > a[href^="#"]')
      .forEach(function (a) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (el) tops.push({ link: a, li: a.parentNode, el: el });
      });
    if (tops.length < 2) return;

    var subs = Array.prototype.slice.call(main.querySelectorAll('h3[id]'));
    if (subs.length < 4) return;

    // Assign each h3 to the last chapter that starts before it. Comparing
    // document position rather than offsetTop: this runs before images and
    // mermaid diagrams settle, so measured offsets are not final yet.
    var groups = tops.map(function () { return []; });
    subs.forEach(function (h) {
      var idx = -1;
      for (var i = 0; i < tops.length; i++) {
        var pos = tops[i].el.compareDocumentPosition(h);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING || tops[i].el.contains(h)) idx = i;
        else break;
      }
      if (idx >= 0) groups[idx].push(h);
    });

    var built = 0;
    groups.forEach(function (list, i) {
      if (list.length < 2) return;
      var ol = document.createElement('ol');
      ol.className = 'toc-sub';
      list.forEach(function (h) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + h.id;
        // Drop a leading "11.3" — the parent link already gives the chapter.
        a.textContent = (h.textContent || '').trim().replace(/^\d+(\.\d+)*[.、\s]\s*/, '');
        li.appendChild(a);
        ol.appendChild(li);
      });
      tops[i].li.appendChild(ol);
      tops[i].li.classList.add('toc-has-sub');
      built++;
    });
    if (!built) return;

    function current() {
      var y = window.scrollY + 100;
      // Default to the first chapter: at the very top of the page no heading
      // has passed the line yet, and leaving every group shut there makes the
      // feature look broken exactly where the reader first sees the rail.
      var found = tops[0];
      for (var i = 0; i < tops.length; i++) {
        if (tops[i].el.getBoundingClientRect().top + window.scrollY <= y) found = tops[i];
        else break;
      }
      for (var j = 0; j < tops.length; j++) {
        tops[j].li.classList.toggle('toc-open-sub', tops[j] === found);
      }
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { current(); ticking = false; });
    }, { passive: true });
    current();
  }

  function bind() {
    syncButtons(currentTheme());
    ['tn-theme-toggle', 'themeBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn || btn.dataset.tnBound) return;
      btn.dataset.tnBound = '1';
      btn.addEventListener('click', function () {
        apply(currentTheme() === 'dark' ? 'light' : 'dark');
      });
    });
    ensureBackTop();
    wrapWideTables();
    setupTocDrawer();
    buildTocSubnav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
