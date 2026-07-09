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
    if (!btn.getAttribute('onclick') && !btn.onclick) {
      btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }
    function toggle() { btn.classList.toggle('show', window.scrollY > 400); }
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
