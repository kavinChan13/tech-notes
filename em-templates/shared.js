/* ============================================================
   EM Templates Library · Shared Behavior
   - Tab switching with deep-link (URL hash)
   - Copy-to-clipboard on code blocks
   - Mermaid initialization (paper theme)
   ============================================================ */

(function () {
  'use strict';

  // ----------------------------------------------------------
  // Mermaid: paper-doc theme
  // ----------------------------------------------------------
  function initMermaid() {
    if (typeof mermaid === 'undefined') return;
    try {
      mermaid.initialize({
        startOnLoad: true,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '13px',
          primaryColor: '#fcfaf5',
          primaryTextColor: '#1a1a1a',
          primaryBorderColor: '#1c3a5e',
          lineColor: '#6b6b6b',
          secondaryColor: '#e8eef5',
          tertiaryColor: '#faf2dc',
          background: '#fdfcf7',
          mainBkg: '#ffffff',
          secondBkg: '#fcfaf5',
          tertiaryBkg: '#f4efe3',
          textColor: '#1a1a1a',
          nodeBorder: '#1c3a5e',
          clusterBkg: 'rgba(28,58,94,.04)',
          clusterBorder: 'rgba(28,58,94,.2)',
          edgeLabelBackground: '#fdfcf7'
        },
        flowchart: { curve: 'basis', padding: 16, htmlLabels: true, useMaxWidth: true }
      });
    } catch (e) {
      console.error('mermaid init failed', e);
    }
  }

  // ----------------------------------------------------------
  // Tabs with hash deep-link
  // ----------------------------------------------------------
  function initTabs() {
    const tabContainers = document.querySelectorAll('.tabs');
    tabContainers.forEach(container => {
      const buttons = container.querySelectorAll('.tab-btn');
      const scope = container.closest('[data-tab-scope]') || document;
      const panels = scope.querySelectorAll('.tab-panel');

      function activate(tabId, updateHash) {
        buttons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        panels.forEach(p => p.classList.toggle('active', p.dataset.tab === tabId));
        if (updateHash) {
          history.replaceState(null, '', '#' + tabId);
        }
      }

      buttons.forEach(btn => {
        btn.addEventListener('click', () => activate(btn.dataset.tab, true));
      });

      // Honor hash on load
      const hash = window.location.hash.slice(1);
      const validTabs = Array.from(buttons).map(b => b.dataset.tab);
      if (hash && validTabs.includes(hash)) {
        activate(hash, false);
      }
    });
  }

  // ----------------------------------------------------------
  // Copy-to-clipboard buttons
  // ----------------------------------------------------------
  function initCopy() {
    document.querySelectorAll('pre.code').forEach(pre => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'COPY';
      btn.setAttribute('aria-label', 'Copy to clipboard');
      pre.appendChild(btn);

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const code = pre.querySelector('code');
        let text = code ? code.innerText : pre.innerText.replace(/COPY\s*$/, '');
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          btn.textContent = '✓ COPIED';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'COPY';
            btn.classList.remove('copied');
          }, 1800);
        } catch (err) {
          console.error('Copy failed', err);
          btn.textContent = 'FAILED';
          setTimeout(() => { btn.textContent = 'COPY'; }, 1800);
        }
      });
    });
  }

  // ----------------------------------------------------------
  // Init
  // ----------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initMermaid();
    initTabs();
    initCopy();
  });
})();
