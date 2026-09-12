/* Tech Notes — on-demand loader for the split search index
 * ---------------------------------------------------------------------
 * The index used to be one 14.7 MB file (5.9 MB gzipped) that every consumer
 * pulled in full. Body text is 94% of it, and the 16 directory pages only ever
 * match against the files they link to, so each of them was downloading the
 * other 15 topics for nothing. It is now split by scripts/build_search_index.py
 * into a lite index (titles + section headings, ~149 KB gzipped) and one
 * full-text shard per topic folder.
 *
 * Uses injected <script src> rather than fetch() on purpose: pages must work by
 * double-click (file://), where fetch() of a local file is blocked by CORS but
 * <script src> still loads.
 *
 * API — every loader is idempotent and safe to call repeatedly:
 *   TNSearchIndex.loadLite(cb)        -> cb(liteRecords)   titles + headings
 *   TNSearchIndex.loadTopic(t, cb)    -> cb(records)        one topic, full text
 *   TNSearchIndex.load(cb)            -> cb(allRecords)     every shard
 *   TNSearchIndex.lite()              -> lite records so far ([] until loaded)
 *   TNSearchIndex.get()               -> full records so far ([] until loaded)
 *   TNSearchIndex.ready               -> true once every shard is in
 *
 * Record shape is identical in both tiers except that lite sections carry no
 * `x` (body text), so the same rendering code works against either — consumers
 * must read `sec.x || ''`.
 */
(function () {
  'use strict';
  if (window.TNSearchIndex) return;

  // Resolve sibling assets relative to this file, so pages at any depth
  // (./assets/… or ../assets/…) work without extra configuration.
  var self = document.currentScript;
  var dir = self && self.src
    ? self.src.replace(/search-index-loader\.js(?:\?.*)?$/, '')
    : 'assets/';

  // url -> { state, waiting[] }
  var files = {};

  function fetchScript(url, done) {
    var f = files[url];
    if (f && (f.state === 'done' || f.state === 'error')) { done(); return; }
    if (!f) f = files[url] = { state: 'idle', waiting: [] };
    f.waiting.push(done);
    if (f.state === 'loading') return;
    f.state = 'loading';
    var s = document.createElement('script');
    s.src = url;
    s.async = true;
    function finish(state) {
      f.state = state;
      var cbs = f.waiting;
      f.waiting = [];
      cbs.forEach(function (cb) { try { cb(); } catch (e) {} });
    }
    s.onload = function () { finish('done'); };
    s.onerror = function () { finish('error'); };
    (document.head || document.documentElement).appendChild(s);
  }

  function shardsLoaded() {
    var topics = window.TN_SEARCH_TOPICS || [];
    var have = window.TN_SEARCH_SHARD || {};
    if (!topics.length) return false;
    for (var i = 0; i < topics.length; i++) {
      if (!have[topics[i]]) return false;
    }
    return true;
  }

  function allRecords() {
    var have = window.TN_SEARCH_SHARD || {};
    var out = [];
    (window.TN_SEARCH_TOPICS || Object.keys(have)).forEach(function (t) {
      if (have[t]) out = out.concat(have[t]);
    });
    return out;
  }

  var api = {
    get ready() { return shardsLoaded(); },
    lite: function () { return window.TN_SEARCH_LITE || []; },
    get: function () { return allRecords(); },

    loadLite: function (cb) {
      fetchScript(dir + 'search-index-lite.js', function () {
        if (cb) cb(api.lite());
      });
    },

    loadTopic: function (topic, cb) {
      if (!topic) { if (cb) cb([]); return; }
      fetchScript(dir + 'search-index/' + topic + '.js', function () {
        var have = window.TN_SEARCH_SHARD || {};
        if (cb) cb(have[topic] || []);
      });
    },

    load: function (cb) {
      // The topic list lives in the lite file, so that always comes first.
      api.loadLite(function () {
        var topics = window.TN_SEARCH_TOPICS || [];
        if (!topics.length) { if (cb) cb([]); return; }
        var left = topics.length;
        topics.forEach(function (t) {
          api.loadTopic(t, function () {
            if (--left === 0 && cb) cb(allRecords());
          });
        });
      });
    }
  };

  window.TNSearchIndex = api;
})();
