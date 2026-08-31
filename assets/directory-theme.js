/* Theme toggle for chrome pages (home / *_directory.html / template indexes).
 * These pages don't load assets/site-theme-toggle.js because that file also
 * injects a .back-top button styled by article.css, which chrome pages don't
 * load. The storage contract is identical, though:
 *   attribute : <html data-theme="dark">, absent = light
 *   storage   : localStorage['theme'], falling back to legacy 'tn-theme'
 * The pre-paint apply lives in the <!-- tn-theme-init --> snippet in <head>;
 * this file only wires up #themeBtn and persistence. */
(function () {
  'use strict';
  var root = document.documentElement;
  var tb = document.getElementById('themeBtn');
  if (!tb) return;

  // Migrate a preference saved by the older article-only toggle.
  try {
    if (!localStorage.getItem('theme')) {
      var legacy = localStorage.getItem('tn-theme');
      if (legacy) localStorage.setItem('theme', legacy);
    }
  } catch (e) {}

  tb.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (next === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();
