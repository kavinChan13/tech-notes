/* Tech Notes — on-demand loader for assets/search-index.js
 * ---------------------------------------------------------------------
 * The full-text index is ~12 MB, but most visits never open search. Pages
 * therefore ship this ~1 KB loader instead of the index itself and pull the
 * index in on the first search interaction.
 *
 * Uses an injected <script src> rather than fetch() on purpose: pages must
 * work by double-click (file://), where fetch() of a local file is blocked
 * by CORS but <script src> still loads.
 *
 * API:
 *   TNSearchIndex.ready              -> true once window.TN_SEARCH_INDEX exists
 *   TNSearchIndex.get()              -> the index array (empty until ready)
 *   TNSearchIndex.load(cb)           -> load if needed, then call cb(index).
 *                                       Safe to call repeatedly; loads once.
 */
(function () {
  'use strict';
  if (window.TNSearchIndex) return;

  // Resolve assets/search-index.js relative to this file, so pages at any
  // depth (./assets/… or ../assets/…) work without extra configuration.
  var self = document.currentScript;
  var url = self && self.src
    ? self.src.replace(/search-index-loader\.js(?:\?.*)?$/, 'search-index.js')
    : 'assets/search-index.js';

  var state = 'idle'; // idle | loading | done | error
  var waiting = [];

  function flush() {
    var list = window.TN_SEARCH_INDEX || [];
    var cbs = waiting;
    waiting = [];
    cbs.forEach(function (cb) { try { cb(list); } catch (e) {} });
  }

  var api = {
    get ready() { return state === 'done'; },
    get: function () { return window.TN_SEARCH_INDEX || []; },
    load: function (cb) {
      if (state === 'done' || state === 'error') {
        if (cb) cb(api.get());
        return;
      }
      if (cb) waiting.push(cb);
      if (state === 'loading') return;
      state = 'loading';
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = function () { state = 'done'; flush(); };
      s.onerror = function () { state = 'error'; flush(); };
      (document.head || document.documentElement).appendChild(s);
    }
  };

  window.TNSearchIndex = api;
})();
