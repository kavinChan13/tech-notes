/* Directory-page filter with in-directory full-text search.
 * Requires assets/search-index-loader.js to be loaded first. Only this topic's
 * shard is fetched, and only on the first interaction with #q: filtering is
 * scoped to the current directory anyway, so pulling the whole index (14.7 MB)
 * to search 6–186 pages was 16 topics of waste. Shards run 22 KB – 2 MB.
 * Until the shard arrives, filtering falls back to title + data-search
 * matching, then re-runs.
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

  // folder that this directory page lives in (last path segment before the file)
  var parts = location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
  var folder = parts.length >= 2 ? parts[parts.length - 2] : '';

  var byPath = {};

  function indexBodies(idx) {
    byPath = {};
    idx.forEach(function (e) {
      var t = e.t + ' ';
      (e.s || []).forEach(function (s) { t += (s.h || '') + ' ' + (s.x || '') + ' '; });
      byPath[e.u.toLowerCase()] = t.toLowerCase();
    });
  }

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

  function attachBodies() {
    items.forEach(function (i) { i.__body = bodyOf(i.querySelector('a[href]')); });
  }
  attachBodies();

  function f() {
    var kw = (q.value || '').toLowerCase().trim(), n = 0;
    items.forEach(function (i) {
      var t = (i.innerText + ' ' + (i.dataset.search || '') + ' ' + (i.__body || '')).toLowerCase();
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

  function ensureIndex() {
    if (!window.TNSearchIndex || !folder) return;
    window.TNSearchIndex.loadTopic(folder, function (idx) {
      indexBodies(idx);
      attachBodies();
      f();
    });
  }

  // Warm the shard as soon as the user shows intent, so the body-text upgrade
  // is usually already in place by the time they finish typing.
  q.addEventListener('focus', ensureIndex, { once: true });
  q.addEventListener('input', function () { ensureIndex(); f(); });
  f();
})();
