/* =====================================================================
 * Card Extras — Shared "Interviewer's View" renderer
 * ---------------------------------------------------------------------
 * 4 个 *_interview_cards.html 的 renderCards() 和 mock-interview.js 的
 * renderAnswerHtml() 共用本文件，渲染卡片 JSON 里 Phase 1 新增的 4 个字段：
 *   why_asked / answers (mid|senior|staff) / failure_modes / follow_ups
 *
 * 输出一个默认折叠的 <details class="mi-extras"> 块；卡片 JSON 里完全没
 * 这些字段时返回空串，保持原版"翻卡片"零回归。
 *
 * 命名前缀 `mi-extras-`，与 mock-interview / cards 的样式都不冲突。
 * 暴露：window.MICardExtras.render(card) -> string (HTML)
 * ===================================================================== */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hasExtras(card) {
    if (!card) return false;
    if (card.why_asked && String(card.why_asked).trim()) return true;
    if (card.answers && (card.answers.mid || card.answers.senior || card.answers.staff)) return true;
    if (Array.isArray(card.failure_modes) && card.failure_modes.length) return true;
    if (Array.isArray(card.follow_ups) && card.follow_ups.length) return true;
    return false;
  }

  function renderWhy(card) {
    if (!card.why_asked || !String(card.why_asked).trim()) return '';
    // why_asked 是普通字符串，不允许 HTML 注入
    return `
      <section class="mi-extras-sec mi-extras-why">
        <h5>❓ 为什么问这道题</h5>
        <div class="mi-extras-text">${esc(card.why_asked)}</div>
      </section>`;
  }

  function renderAnswers(card) {
    const a = card.answers;
    if (!a || (!a.mid && !a.senior && !a.staff)) return '';
    const tiers = [
      { key: 'mid',    label: 'L4 / IC2 · Mid',      tagClass: 'tier-mid',    hint: '合格线 · 知道是什么' },
      { key: 'senior', label: 'L5 · Senior',         tagClass: 'tier-senior', hint: '加分线 · 知道为什么、误读、对比' },
      { key: 'staff',  label: 'L6+ · Staff / Lead',  tagClass: 'tier-staff',  hint: 'Offer 线 · 演进、跨域、案例' },
    ];
    const items = tiers.filter(t => a[t.key]).map(t => `
      <article class="mi-extras-tier ${t.tagClass}">
        <header class="mi-extras-tier-head">
          <span class="mi-extras-tier-pill">${esc(t.label)}</span>
          <span class="mi-extras-tier-hint">${esc(t.hint)}</span>
        </header>
        <div class="mi-extras-tier-body">${a[t.key]}</div>
      </article>`).join('');
    return `
      <section class="mi-extras-sec mi-extras-answers">
        <h5>🎚️ 三档样例答案</h5>
        ${items}
      </section>`;
  }

  function renderFailureModes(card) {
    const fm = card.failure_modes;
    if (!Array.isArray(fm) || fm.length === 0) return '';
    const items = fm.map(s => `<li>${s}</li>`).join('');
    return `
      <section class="mi-extras-sec mi-extras-failure">
        <h5>🚫 典型失分模式</h5>
        <ul>${items}</ul>
      </section>`;
  }

  function renderFollowUps(card) {
    const fu = card.follow_ups;
    if (!Array.isArray(fu) || fu.length === 0) return '';
    const items = fu.map((entry, i) => {
      const q = (entry && entry.q) ? entry.q : '';
      const hint = (entry && entry.hint) ? entry.hint : '';
      return `
        <li>
          <div class="mi-extras-fu-q">Q${i + 1}. ${esc(q)}</div>
          ${hint ? `<div class="mi-extras-fu-hint">💡 ${esc(hint)}</div>` : ''}
        </li>`;
    }).join('');
    return `
      <section class="mi-extras-sec mi-extras-followups">
        <h5>↪️ 考官追问</h5>
        <ul>${items}</ul>
      </section>`;
  }

  // 主入口：返回完整 HTML 字符串。无任何 extras 字段 → 返回 ''
  function render(card) {
    if (!hasExtras(card)) return '';
    const body = [renderWhy(card), renderAnswers(card), renderFailureModes(card), renderFollowUps(card)].join('');
    return `
      <details class="mi-extras" data-card-id="${card.id}">
        <summary>🎯 面试官视角 · 深度信号（点击展开）</summary>
        <div class="mi-extras-body">${body}</div>
      </details>`;
  }

  window.MICardExtras = { render, hasExtras };
})();

/* =====================================================================
 * URL Param Filter — 让外部链接能"一键过滤"卡片
 * ---------------------------------------------------------------------
 * 支持的 query param:
 *   ?ids=51,53,54     — 只显示指定 id 的卡（精确卡集）
 *   ?cats=值类别,模板  — 累加到 activeCats（OR 关系）
 *   ?diffs=high,mid   — 累加到 activeDiffs
 *   ?q=move           — 填入搜索框
 *
 * 在 inline renderCards() 之后通过 DOMContentLoaded 钩入；不破坏现有
 * 过滤逻辑（cats / diffs / search 沿用 inline filter()，ids 通过
 * monkey-patch filter() 追加限制 + 顶部 banner 提示）。
 * ===================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    const params = new URLSearchParams(location.search);
    if (!params.toString()) return;

    const idsParam   = params.get('ids');
    const catsParam  = params.get('cats');
    const diffsParam = params.get('diffs');
    const qParam     = params.get('q');

    let touched = false;

    // ---- ids: 精确卡集限制 ----
    if (idsParam) {
      const wanted = new Set(
        idsParam.split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite)
      );
      if (wanted.size > 0) {
        window.__urlRestrictIds = wanted;
        touched = true;

        // 顶部 banner 提示已被外链筛选
        const banner = document.createElement('div');
        banner.className = 'url-filter-banner';
        banner.style.cssText = [
          'background:linear-gradient(90deg,#1e3a5f,#2a4a7f)',
          'color:#cfe9ff',
          'padding:.7rem 1rem',
          'text-align:center',
          'border-bottom:1px solid rgba(255,255,255,.1)',
          'font-size:.9rem',
          'position:sticky',
          'top:0',
          'z-index:100',
        ].join(';');
        const clearHref = location.pathname;
        banner.innerHTML =
          '🔗 已通过外部链接精确筛选 <strong>' + wanted.size +
          '</strong> 张卡片 · <a href="' + clearHref +
          '" style="color:#fff;text-decoration:underline;font-weight:600;">清除筛选看全部</a>';
        document.body.insertBefore(banner, document.body.firstChild);

        // monkey-patch filter() 追加 id 白名单
        if (typeof window.filter === 'function') {
          const origFilter = window.filter;
          window.filter = function () {
            origFilter.apply(this, arguments);
            const ids = window.__urlRestrictIds;
            if (ids && ids.size) {
              document.querySelectorAll('.card').forEach(function (card) {
                const cid = parseInt(card.dataset.id, 10);
                if (!ids.has(cid)) card.classList.add('hidden');
              });
              if (typeof window.updateStats === 'function') window.updateStats();
            }
          };
        }
      }
    }

    // ---- cats: 加入 activeCats 集合 ----
    // activeCats / activeDiffs / filter 都是 inline <script> 用 `let` 声明的
    // 顶层绑定，不会出现在 window 上，必须用裸名访问全局词法环境。
    if (catsParam) {
      try {
        if (typeof activeCats !== 'undefined' && activeCats && typeof activeCats.add === 'function') {
          const wantedCats = catsParam.split(',').map(s => s.trim()).filter(Boolean);
          wantedCats.forEach(c => activeCats.add(c));
          document.querySelectorAll('[onclick^="toggleCat("]').forEach(function (el) {
            const m = /toggleCat\(\s*['"]([^'"]+)['"]/.exec(el.getAttribute('onclick') || '');
            if (m && activeCats.has(m[1])) el.classList.add('active');
          });
          touched = true;
        }
      } catch (_) { /* TDZ / undeclared — silently skip */ }
    }

    // ---- diffs: 加入 activeDiffs 集合 ----
    if (diffsParam) {
      try {
        if (typeof activeDiffs !== 'undefined' && activeDiffs && typeof activeDiffs.add === 'function') {
          const wantedDiffs = diffsParam.split(',').map(s => s.trim()).filter(Boolean);
          wantedDiffs.forEach(d => activeDiffs.add(d));
          document.querySelectorAll('[onclick^="toggleDiff("]').forEach(function (el) {
            const m = /toggleDiff\(\s*['"]([^'"]+)['"]/.exec(el.getAttribute('onclick') || '');
            if (m && activeDiffs.has(m[1])) el.classList.add('active');
          });
          touched = true;
        }
      } catch (_) { /* skip */ }
    }

    // ---- q: 填入搜索框 ----
    if (qParam) {
      const inp = document.getElementById('searchInput');
      if (inp) inp.value = qParam;
      touched = true;
    }

    // 触发一次 filter() 让上面的状态生效
    if (touched) {
      try {
        if (typeof filter === 'function') filter();
      } catch (_) { /* skip */ }
    }
  });
})();
