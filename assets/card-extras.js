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
