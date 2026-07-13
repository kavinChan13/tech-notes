/* Directory-page filter with in-directory full-text search.
 * Requires window.TN_SEARCH_INDEX (assets/search-index.js) to be loaded first.
 * DOM contract (shared by all *_directory.html):
 *   #q        search input
 *   .item     each card, containing an <a href> to a note in this directory
 *   .sec      optional section wrappers (hidden when they have no visible items)
 *   #empty    optional "no results" message
 * Body text is matched only for files this directory links to, so search stays
 * scoped to the current directory. Cards linking to non-indexed pages (e.g.
 * *_cards.html) gracefully fall back to title + data-search matching. */
(function () {
  'use strict';
  var q = document.getElementById('q');
  if (!q) return;

  var idx = window.TN_SEARCH_INDEX || [];
  var byPath = {};
  idx.forEach(function (e) {
    var t = e.t + ' ';
    (e.s || []).forEach(function (s) { t += s.x + ' '; });
    byPath[e.u.toLowerCase()] = t.toLowerCase();
  });

  // folder that this directory page lives in (last path segment before the file)
  var parts = location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
  var folder = parts.length >= 2 ? parts[parts.length - 2] : '';

  function bodyOf(a) {
    if (!a) return '';
    var href = (a.getAttribute('href') || '').split('#')[0].split('?')[0];
    if (!href) return '';
    var url;
    if (href.indexOf('../') === 0 || href.charAt(0) === '/') {
      var segs = (folder + '/' + href).split('/'), out = [];
      segs.forEach(function (s) {
        if (s === '..') out.pop();
        else if (s !== '.' && s !== '') out.push(s);
      });
      url = out.join('/');
    } else {
      url = (folder ? folder + '/' : '') + href.replace(/^\.\//, '');
    }
    return byPath[url.toLowerCase()] || '';
  }

  var items = [].slice.call(document.querySelectorAll('.item'));
  var secs = [].slice.call(document.querySelectorAll('.sec'));
  var empty = document.getElementById('empty');
  items.forEach(function (i) { i.__body = bodyOf(i.querySelector('a[href]')); });

  function f() {
    var kw = (q.value || '').toLowerCase().trim(), n = 0;
    items.forEach(function (i) {
      var t = (i.innerText + ' ' + (i.dataset.search || '') + ' ' + i.__body).toLowerCase();
      var show = !kw || t.indexOf(kw) >= 0;
      i.style.display = show ? '' : 'none';
      if (show) n++;
    });
    secs.forEach(function (s) {
      s.style.display = [].slice.call(s.querySelectorAll('.item'))
        .some(function (i) { return i.style.display !== 'none'; }) ? '' : 'none';
    });
    if (empty) empty.style.display = n ? 'none' : 'block';
  }

  q.addEventListener('input', f);
  f();
})();
