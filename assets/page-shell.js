/* =====================================================================
 * Tech Notes — Page Shell JS
 * ---------------------------------------------------------------------
 * Per-document interactions for the `.ps` page-shell layout:
 *   1) Sidebar scroll-spy (highlight current chapter while scrolling)
 *   2) Smooth anchor scrolling (CSS handles most; this fixes some edge cases)
 *
 * Back-to-top is deliberately NOT here: site-theme-toggle.js ships it for all
 * 481 pages with a single >400px threshold, and all 58 `.ps` pages load both
 * files. A second implementation here would only re-introduce two scroll
 * listeners disagreeing about when the button appears.
 *
 * Auto-init on DOMContentLoaded. No-ops if `.ps` markup isn't present.
 * ===================================================================== */
(function () {
  'use strict';

  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function $(sel, root)  { return (root || document).querySelector(sel); }

  /* ---------- 1. Sidebar scroll-spy ---------- */
  function bindScrollSpy() {
    var sidebarLinks = $$('.ps .sidebar a[href^="#"]');
    if (!sidebarLinks.length) return;

    var sections = sidebarLinks
      .map(function (a) {
        var id = a.getAttribute('href').slice(1);
        return { link: a, section: id ? document.getElementById(id) : null };
      })
      .filter(function (x) { return x.section; });

    if (!sections.length) return;

    function update() {
      var top = window.scrollY + 90; // account for sticky topbar
      var current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].section.offsetTop <= top) {
          current = sections[i];
        } else {
          break;
        }
      }
      sidebarLinks.forEach(function (a) { a.classList.remove('active'); });
      if (current) current.link.classList.add('active');
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () { update(); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
    update();
  }

  /* ---------- 2. Smooth anchor scrolling (with topbar offset) ---------- */
  function bindAnchorJump() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var hash = a.getAttribute('href');
      if (!hash || hash === '#') return;
      var target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: top, behavior: 'smooth' });
      try { history.replaceState(null, '', hash); } catch (_) {}
    });
  }

  function boot() {
    if (!$('.ps')) return;
    bindScrollSpy();
    bindAnchorJump();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
