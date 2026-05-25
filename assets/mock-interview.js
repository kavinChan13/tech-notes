/* =====================================================================
 * Mock Interview — Shared module
 * ---------------------------------------------------------------------
 * 在 *_interview_cards.html 上叠加"模拟面试"模式。
 *
 *   IDLE → CONFIG → ANSWERING → DONE → IDLE
 *
 * 数据：直接读取页面全局的 `CARDS` / `CAT_GROUPS`（由各页面自身定义）。
 * 入口：toolbar-row 末尾自动注入 "🎯 模拟面试" 按钮；URL `?mode=mock` 自动打开 config。
 * 离开：ESC / 顶部 "✕ 退出" 按钮。退出即丢弃进度（M1 不做恢复）。
 *
 * M1 范围（今天）：config → 抽题 → 单题展示 → peek 答案 → 翻页 → 完成占位
 * M2 / M3 待加：倒计时、Review 页、总结统计、localStorage 历史
 * =================================================================== */
(function () {
  'use strict';

  // 各 *_interview_cards.html 在底部 inline <script> 里用 `const CARDS = [...]`
  // 声明数据。const/let 全局声明不会挂到 window，所以这里直接走标识符引用。
  // 通过 `defer` 保证本脚本在那段 inline 脚本之后执行，CARDS 此时已初始化。
  let CARDS_REF, CAT_GROUPS_REF;
  try {
    CARDS_REF = CARDS;
    CAT_GROUPS_REF = (typeof CAT_GROUPS !== 'undefined') ? CAT_GROUPS : [];
  } catch (e) {
    console.warn('[mock-interview] CARDS not found; mock mode disabled.', e);
    return;
  }
  if (!Array.isArray(CARDS_REF) || CARDS_REF.length === 0) {
    console.warn('[mock-interview] CARDS is empty or not an array; mock mode disabled.');
    return;
  }

  // ---------- 状态 ----------
  const STATES = Object.freeze({ IDLE: 'idle', CONFIG: 'config', ANSWERING: 'answering', DONE: 'done' });

  const PRESET_COUNTS = [10, 20, 30];
  const PRESET_DURATIONS = [
    { label: '3 min', sec: 180 },
    { label: '5 min', sec: 300 },
    { label: '10 min', sec: 600 },
  ];
  const DEFAULT_CFG = {
    count: 10,
    diffs: ['basic', 'mid', 'high'],
    cats: [],          // 空 = 不筛选分类
    perQuestionSec: 300,
  };

  /** @type {{state:string, cfg:any, pool:any[], cursor:number, answers:string[], peeked:boolean[]}} */
  const mock = {
    state: STATES.IDLE,
    cfg: { ...DEFAULT_CFG },
    pool: [],
    cursor: 0,
    answers: [],
    peeked: [],
  };

  // ---------- 工具 ----------
  function $(sel, root = document) { return root.querySelector(sel); }
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v != null && v !== false) node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function filterCards(cfg) {
    return CARDS_REF.filter(c => {
      if (cfg.diffs.length && !cfg.diffs.includes(c.diff)) return false;
      if (cfg.cats.length && !c.cats.some(t => cfg.cats.includes(t))) return false;
      return true;
    });
  }

  // ---------- 入口按钮 ----------
  function injectEntryButton() {
    const row = $('.toolbar .toolbar-row') || $('.toolbar-row') || $('.toolbar');
    if (!row || $('.mi-entry')) return;
    const btn = el('button', { class: 'mi-entry', onclick: openConfig }, '🎯 模拟面试');
    row.appendChild(btn);
  }

  // ---------- Overlay 容器（懒构造） ----------
  function ensureOverlay() {
    let ov = $('#mi-overlay');
    if (ov) return ov;
    ov = el('div', { id: 'mi-overlay', class: 'mi-overlay', hidden: true });
    ov.appendChild(el('div', { class: 'mi-topbar' }));
    ov.appendChild(el('div', { class: 'mi-progress-bar', id: 'mi-progress' }));
    ov.appendChild(el('div', { class: 'mi-content', id: 'mi-content' }));
    document.body.appendChild(ov);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mock.state !== STATES.IDLE) {
        if (confirm('退出模拟? 当前进度会丢弃。')) closeOverlay();
      }
    });
    return ov;
  }
  function renderTopbar(title, opts = {}) {
    const bar = $('#mi-overlay .mi-topbar');
    bar.innerHTML = '';
    // DOM 的 append(null) 会把 null 当字符串转成 "null" 文本节点，所以要过滤掉。
    const nodes = [
      el('h2', {}, title),
      el('span', { class: 'mi-spacer' }),
      opts.progress ? el('span', { class: 'mi-progress-text', id: 'mi-progress-text' }, opts.progress) : null,
      el('button', { type: 'button', onclick: () => { if (confirm('退出模拟? 当前进度会丢弃。')) closeOverlay(); } }, '✕ 退出'),
    ].filter(Boolean);
    bar.append(...nodes);
    if (opts.progressPercent != null) {
      $('#mi-progress').style.width = opts.progressPercent + '%';
    } else {
      $('#mi-progress').style.width = '0%';
    }
  }
  function setContent(node) {
    const wrap = $('#mi-content');
    wrap.innerHTML = '';
    wrap.appendChild(node);
    wrap.scrollTop = 0;
    // 也让外层 overlay 滚回顶部
    $('#mi-overlay').scrollTop = 0;
  }
  function openOverlay() {
    document.body.classList.add('mi-active');
    ensureOverlay().hidden = false;
  }
  function closeOverlay() {
    mock.state = STATES.IDLE;
    document.body.classList.remove('mi-active');
    const ov = $('#mi-overlay');
    if (ov) ov.hidden = true;
  }

  // ---------- Config 视图 ----------
  function openConfig() {
    mock.state = STATES.CONFIG;
    mock.cfg = { ...DEFAULT_CFG, ...mock.cfg };
    openOverlay();
    renderTopbar('🎯 模拟面试 · 配置');
    setContent(buildConfigView());
  }

  function buildConfigView() {
    const root = el('div', { class: 'mi-config' });
    root.append(
      el('h1', {}, '配置你的模拟面试'),
      el('p', { class: 'mi-lead' }, '从当前题库中按题数 / 难度 / 分类抽题，每题给定固定时长。完成后可对照标准答案做自评。'),
    );

    // 题数
    root.appendChild(buildFieldset('题数', '建议先用 10 题试一遍流程', () => {
      const wrap = el('div', { class: 'mi-chips' });
      PRESET_COUNTS.forEach(n => {
        wrap.appendChild(el('button', {
          type: 'button',
          class: 'mi-chip' + (mock.cfg.count === n ? ' on' : ''),
          onclick: (e) => { mock.cfg.count = n; refreshConfig(); }
        }, String(n)));
      });
      return wrap;
    }));

    // 难度
    root.appendChild(buildFieldset('难度', '至少选一个；可多选', () => {
      const wrap = el('div', { class: 'mi-chips' });
      [
        { k: 'basic', label: '🟢 基础' },
        { k: 'mid', label: '🟡 中级' },
        { k: 'high', label: '🔴 高级' },
      ].forEach(({ k, label }) => {
        wrap.appendChild(el('button', {
          type: 'button',
          class: `mi-chip diff-${k}` + (mock.cfg.diffs.includes(k) ? ' on' : ''),
          onclick: () => {
            const i = mock.cfg.diffs.indexOf(k);
            if (i >= 0) mock.cfg.diffs.splice(i, 1);
            else mock.cfg.diffs.push(k);
            refreshConfig();
          },
        }, label));
      });
      return wrap;
    }));

    // 分类（按 CAT_GROUPS 分行）
    root.appendChild(buildFieldset('分类', '不选 = 全部分类参与抽题', () => {
      const wrap = el('div');
      const groups = CAT_GROUPS_REF;
      const catCount = {};
      CARDS_REF.forEach(c => c.cats.forEach(t => { catCount[t] = (catCount[t] || 0) + 1; }));
      const used = new Set();
      groups.forEach(g => {
        const validCats = g.cats.filter(c => catCount[c]);
        if (!validCats.length) return;
        validCats.forEach(c => used.add(c));
        const groupWrap = el('div', { class: 'mi-cat-group' });
        groupWrap.appendChild(el('div', { class: 'mi-cat-group-name' }, g.name));
        const chips = el('div', { class: 'mi-chips' });
        validCats.forEach(c => {
          chips.appendChild(el('button', {
            type: 'button',
            class: 'mi-chip' + (mock.cfg.cats.includes(c) ? ' on' : ''),
            onclick: () => {
              const i = mock.cfg.cats.indexOf(c);
              if (i >= 0) mock.cfg.cats.splice(i, 1);
              else mock.cfg.cats.push(c);
              refreshConfig();
            },
          }, `${c} (${catCount[c]})`));
        });
        groupWrap.appendChild(chips);
        wrap.appendChild(groupWrap);
      });
      // 其他没在 CAT_GROUPS 列出的（兜底）
      const allCats = Array.from(new Set(CARDS_REF.flatMap(c => c.cats))).sort();
      const rest = allCats.filter(c => !used.has(c));
      if (rest.length) {
        const groupWrap = el('div', { class: 'mi-cat-group' });
        groupWrap.appendChild(el('div', { class: 'mi-cat-group-name' }, '📌 其它'));
        const chips = el('div', { class: 'mi-chips' });
        rest.forEach(c => {
          chips.appendChild(el('button', {
            type: 'button',
            class: 'mi-chip' + (mock.cfg.cats.includes(c) ? ' on' : ''),
            onclick: () => {
              const i = mock.cfg.cats.indexOf(c);
              if (i >= 0) mock.cfg.cats.splice(i, 1);
              else mock.cfg.cats.push(c);
              refreshConfig();
            },
          }, `${c} (${catCount[c]})`));
        });
        groupWrap.appendChild(chips);
        wrap.appendChild(groupWrap);
      }
      return wrap;
    }));

    // 每题时长（M1 不强制使用，先展示，M2 真正接计时）
    root.appendChild(buildFieldset('每题时长', 'M2 接计时器；本版本只记录预算时间', () => {
      const wrap = el('div', { class: 'mi-chips' });
      PRESET_DURATIONS.forEach(({ label, sec }) => {
        wrap.appendChild(el('button', {
          type: 'button',
          class: 'mi-chip' + (mock.cfg.perQuestionSec === sec ? ' on' : ''),
          onclick: () => { mock.cfg.perQuestionSec = sec; refreshConfig(); }
        }, label));
      });
      return wrap;
    }));

    // 预览 + 开始按钮
    const matched = filterCards(mock.cfg);
    const willPick = Math.min(matched.length, mock.cfg.count);
    const previewLine = el('div', { class: 'mi-pool-preview' });
    previewLine.append(
      '从匹配的 ',
      el('strong', {}, String(matched.length)),
      ' 题中将随机抽取 ',
      el('strong', {}, String(willPick)),
      ' 题。',
    );
    if (matched.length === 0) {
      previewLine.appendChild(el('div', { class: 'mi-empty' }, '⚠ 当前筛选下没有匹配题目，请放宽难度或分类。'));
    }
    root.appendChild(previewLine);

    const actions = el('div', { class: 'mi-action-row' });
    actions.append(
      el('button', {
        type: 'button',
        class: 'mi-btn-primary',
        disabled: willPick === 0 || mock.cfg.diffs.length === 0,
        onclick: startSession,
      }, `开始模拟 (${willPick} 题)`),
      el('button', { type: 'button', class: 'mi-btn-secondary', onclick: closeOverlay }, '取消'),
    );
    root.appendChild(actions);

    return root;
  }

  function buildFieldset(title, hint, bodyBuilder) {
    const fs = el('fieldset', { class: 'mi-fieldset' });
    fs.appendChild(el('legend', {}, title));
    fs.appendChild(bodyBuilder());
    if (hint) fs.appendChild(el('div', { class: 'mi-hint' }, hint));
    return fs;
  }

  function refreshConfig() {
    setContent(buildConfigView());
  }

  // ---------- 开始 / 答题 ----------
  function startSession() {
    const matched = filterCards(mock.cfg);
    if (!matched.length) return;
    mock.pool = shuffle(matched).slice(0, mock.cfg.count);
    mock.answers = mock.pool.map(() => '');
    mock.peeked = mock.pool.map(() => false);
    mock.cursor = 0;
    mock.state = STATES.ANSWERING;
    renderQuestion();
  }

  function renderQuestion() {
    if (mock.cursor >= mock.pool.length) return finishSession();

    const card = mock.pool[mock.cursor];
    const total = mock.pool.length;
    const idx = mock.cursor + 1;
    const pct = Math.round(((mock.cursor) / total) * 100);

    renderTopbar('🎯 模拟面试 · 答题中', {
      progress: `第 ${idx} / ${total} 题  ·  预算 ${Math.round(mock.cfg.perQuestionSec / 60)} min/题`,
      progressPercent: pct,
    });

    const diffLabel = { basic: '🟢 基础', mid: '🟡 中级', high: '🔴 高级' }[card.diff] || card.diff;

    const wrap = el('div');
    const qCard = el('div', { class: `mi-question-card diff-${card.diff || 'mid'}` });

    const meta = el('div', { class: 'mi-q-meta' });
    meta.append(
      el('span', { class: 'mi-q-id' }, `#${String(card.id).padStart(3, '0')}`),
      el('span', { class: `mi-q-pill ${card.diff || ''}` }, diffLabel),
      ...(card.cats || []).map(t => el('span', { class: 'mi-q-cat' }, t)),
    );
    qCard.appendChild(meta);

    const qText = el('div', { class: 'mi-q-text' });
    qText.innerHTML = String(card.q || '');
    qCard.appendChild(qText);

    const ta = el('textarea', {
      class: 'mi-answer-area',
      id: 'mi-answer-input',
      placeholder: '写下你的答题要点（提交后可与标准答案对照）…\n\n建议结构：\n  1. 核心定义 / 主张\n  2. 实现机制 / 关键细节\n  3. 边界 / 注意点 / 取舍',
    });
    ta.value = mock.answers[mock.cursor];
    ta.addEventListener('input', () => { mock.answers[mock.cursor] = ta.value; });
    qCard.appendChild(ta);

    // Peek
    const peekRow = el('div', { class: 'mi-peek-row' });
    const peekBtn = el('button', {
      type: 'button',
      class: 'mi-peek-toggle' + (mock.peeked[mock.cursor] ? ' on' : ''),
      onclick: () => {
        mock.peeked[mock.cursor] = !mock.peeked[mock.cursor];
        renderQuestion(); // 重渲染以更新折叠状态（保留 textarea 内容）
      },
    }, mock.peeked[mock.cursor] ? '👀 已展开（点击隐藏）' : '👀 我不会，看答案');
    peekRow.appendChild(peekBtn);
    qCard.appendChild(peekRow);

    if (mock.peeked[mock.cursor]) {
      const ans = el('div', { class: 'mi-peek-content' });
      ans.innerHTML = renderAnswerHtml(card);
      qCard.appendChild(ans);
    }

    wrap.appendChild(qCard);

    // 导航
    const nav = el('div', { class: 'mi-nav' });
    nav.append(
      el('button', {
        type: 'button',
        class: 'mi-skip',
        disabled: mock.cursor === 0,
        onclick: () => { saveCurrentAnswer(); mock.cursor--; renderQuestion(); },
      }, '← 上一题'),
      el('span', { class: 'mi-spacer' }),
      el('button', {
        type: 'button',
        class: 'mi-skip',
        onclick: () => { saveCurrentAnswer(); mock.cursor++; renderQuestion(); },
      }, '跳过 →'),
      el('button', {
        type: 'button',
        class: 'mi-submit',
        onclick: () => { saveCurrentAnswer(); mock.cursor++; renderQuestion(); },
      }, mock.cursor === total - 1 ? '✓ 完成' : '提交本题 →'),
    );
    wrap.appendChild(nav);

    setContent(wrap);
    // 自动聚焦到 textarea，让用户立即可输入
    requestAnimationFrame(() => $('#mi-answer-input')?.focus());
  }

  function saveCurrentAnswer() {
    const ta = $('#mi-answer-input');
    if (ta) mock.answers[mock.cursor] = ta.value;
  }

  function renderAnswerHtml(card) {
    const parts = [];
    parts.push('<h5>📝 标准答案</h5>');
    parts.push(`<div>${card.ans || ''}</div>`);
    if (card.code) parts.push(`<h5 class="code">💻 示例</h5>${card.code}`);
    if (card.bonus) parts.push(`<h5 class="bonus">⭐ 加分点 / 进阶</h5><div>${card.bonus}</div>`);
    if (card.trap) parts.push(`<h5 class="trap">⚠️ 常见陷阱</h5><div>${card.trap}</div>`);
    return parts.join('');
  }

  // ---------- 完成（M1 占位） ----------
  function finishSession() {
    mock.state = STATES.DONE;
    const answered = mock.answers.filter(a => a && a.trim().length > 0).length;
    const peeked = mock.peeked.filter(Boolean).length;

    renderTopbar('🎯 模拟面试 · 完成', { progress: `${mock.pool.length} 题已结束`, progressPercent: 100 });

    const wrap = el('div', { class: 'mi-done' });
    wrap.append(
      el('h1', {}, '🎉 模拟结束'),
      el('p', { class: 'mi-done-sub' },
        '完整的 Review / 自评 / 弱项统计在 M3 上线。本版本仅保存内存进度，关页面会丢弃。'),
      el('p', {},
        '答题: ', el('span', { class: 'mi-stat' }, `${answered} / ${mock.pool.length}`),
        '  ·  偷看答案: ', el('span', { class: 'mi-stat' }, `${peeked} 次`),
      ),
    );
    const actions = el('div', { class: 'mi-done-actions' });
    actions.append(
      el('button', { type: 'button', class: 'mi-btn-primary', onclick: openConfig }, '🔁 再来一轮'),
      el('button', { type: 'button', class: 'mi-btn-secondary', onclick: closeOverlay }, '回到题库'),
    );
    wrap.appendChild(actions);

    setContent(wrap);
  }

  // ---------- Boot ----------
  function boot() {
    injectEntryButton();
    // URL 触发自动打开
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'mock') {
      // 等其他脚本初始化完毕
      setTimeout(openConfig, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 暴露一点点接口，方便调试
  window.MockInterview = { open: openConfig, close: closeOverlay, state: () => mock };
})();
