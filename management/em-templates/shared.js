/* ============================================================
   EM Templates Library · Shared Behavior
   - Tab switching with deep-link (URL hash)
   - Copy-to-clipboard on code blocks
   - Mermaid initialization (paper theme)
   ============================================================ */

(function () {
  'use strict';

  // ----------------------------------------------------------
  // Mermaid 由 assets/mermaid-theme.js 统一初始化
  //
  // 这里原本写死了一套 paper 风格的浅色 themeVariables。但这些模板页
  // 是支持明暗切换的（<head> 里有 tn-theme-init），于是深色模式下图表
  // 变成「深底上一块白纸」。配色是 initialize() 时烘进 SVG 的，改 CSS
  // 变量救不回来，只能按主题重新渲染 —— 那件事交给共享脚本做。
  //
  // 有图的页面请在 mermaid.min.js 之后引入 assets/mermaid-theme.js，
  // 不要在这里或页面里再调一次 mermaid.initialize()。
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
    initTabs();
    initCopy();
  });
})();
