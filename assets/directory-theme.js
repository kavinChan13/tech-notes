(function () {
  'use strict';
  var root = document.documentElement;
  var tb = document.getElementById('themeBtn');
  if (!tb) return;
  var saved = localStorage.getItem('theme');
  if (saved) root.setAttribute('data-theme', saved);
  tb.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark';
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();
