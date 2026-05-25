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
    timerEnabled: true,
  };

  /**
   * @type {{
   *   state:string, cfg:any, pool:any[], cursor:number,
   *   answers:string[], peeked:boolean[], questionTimes:number[],
   *   sessionStartedAt:number, questionStartedAt:number,
   *   questionPausedAt:number, questionPausedMs:number,
   *   timerHandle:number|null, timerPaused:boolean,
   * }}
   */
  const mock = {
    state: STATES.IDLE,
    cfg: { ...DEFAULT_CFG },
    pool: [],
    cursor: 0,
    answers: [],
    peeked: [],
    ratings: [],             // 0 = 未评，1-5 = 自评星级（仅 Review 阶段填充）
    questionTimes: [],       // 单题用时 (ms)，按 pool 顺序填充；切题/提交/时间到时记录
    sessionStartedAt: 0,     // 整轮 mock 开始的 timestamp
    sessionFinishedAt: 0,    // finish 调用时的 timestamp（用于 history）
    questionStartedAt: 0,    // 当前题开始的 timestamp
    questionPausedAt: 0,     // 暂停瞬时的 timestamp（0 = 未暂停）
    questionPausedMs: 0,     // 当前题累计暂停毫秒
    timerHandle: null,       // setInterval handle
    timerPaused: false,
    slug: 'unknown',         // 由 URL 推断，用于 history key
  };

  // 用 URL pathname 末尾文件名作 slug（cpp_interview_cards.html → cpp / architect_interview_cards.html → architect）
  function detectSlug() {
    const m = /([a-z]+)_interview_cards\.html/.exec(location.pathname);
    return m ? m[1] : 'unknown';
  }
  mock.slug = detectSlug();

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

  // ---------- 时间格式化 ----------
  function fmtMSS(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function fmtDuration(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }

  // ---------- 计时器 ----------
  function elapsedOnCurrent() {
    if (!mock.questionStartedAt) return 0;
    const paused = mock.timerPaused
      ? Date.now() - mock.questionPausedAt + mock.questionPausedMs
      : mock.questionPausedMs;
    return Date.now() - mock.questionStartedAt - paused;
  }

  function startQuestionTimer() {
    stopQuestionTimer();
    mock.questionStartedAt = Date.now();
    mock.questionPausedAt = 0;
    mock.questionPausedMs = 0;
    mock.timerPaused = false;
    if (!mock.cfg.timerEnabled) {
      updateTimerUi();
      return;
    }
    mock.timerHandle = setInterval(tickTimer, 250);
    updateTimerUi();
  }

  function stopQuestionTimer() {
    if (mock.timerHandle != null) {
      clearInterval(mock.timerHandle);
      mock.timerHandle = null;
    }
  }

  function togglePause() {
    if (!mock.cfg.timerEnabled || mock.state !== STATES.ANSWERING) return;
    if (mock.timerPaused) {
      // resume
      mock.questionPausedMs += Date.now() - mock.questionPausedAt;
      mock.questionPausedAt = 0;
      mock.timerPaused = false;
    } else {
      mock.questionPausedAt = Date.now();
      mock.timerPaused = true;
    }
    updateTimerUi();
  }

  function tickTimer() {
    if (mock.state !== STATES.ANSWERING) { stopQuestionTimer(); return; }
    if (mock.timerPaused) { updateTimerUi(); return; }
    const elapsed = elapsedOnCurrent();
    const remainMs = mock.cfg.perQuestionSec * 1000 - elapsed;
    if (remainMs <= 0) { onTimeUp(); return; }
    updateTimerUi();
  }

  function updateTimerUi() {
    const timerEl = document.getElementById('mi-timer');
    if (!timerEl) return;
    if (!mock.cfg.timerEnabled) {
      timerEl.textContent = '⏱ 学习模式';
      timerEl.classList.remove('warn', 'danger', 'paused');
      return;
    }
    const elapsed = elapsedOnCurrent();
    const remainMs = Math.max(0, mock.cfg.perQuestionSec * 1000 - elapsed);
    timerEl.textContent = (mock.timerPaused ? '⏸ ' : '⏱ ') + fmtMSS(remainMs);
    timerEl.classList.toggle('paused', mock.timerPaused);
    timerEl.classList.toggle('danger', !mock.timerPaused && remainMs <= 10_000);
    timerEl.classList.toggle('warn', !mock.timerPaused && remainMs > 10_000 && remainMs <= 30_000);
    const pauseBtn = document.getElementById('mi-pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = mock.timerPaused ? '▶ 继续' : '⏸ 暂停';
    }
  }

  function onTimeUp() {
    // 时间到：记录用时（满预算），切下一题；最后一题则进 finish。
    stopQuestionTimer();
    recordCurrentQuestionTime();
    showToast('⏰ 时间到！自动进入下一题', 1500);
    setTimeout(() => {
      // 注意：此期间用户不能再操作（toast 阻挡），但 mock 状态还在 ANSWERING
      saveCurrentAnswer();
      mock.cursor++;
      renderQuestion();
    }, 900);
  }

  function recordCurrentQuestionTime() {
    if (mock.cursor < 0 || mock.cursor >= mock.pool.length) return;
    const elapsed = mock.questionStartedAt ? elapsedOnCurrent() : 0;
    // 覆盖式记录：本题如果是从 prev 回来再走的，更新到最新一次。
    mock.questionTimes[mock.cursor] = elapsed;
  }

  // ---------- Toast ----------
  function showToast(msg, durationMs = 1500) {
    let toast = document.getElementById('mi-toast');
    if (!toast) {
      toast = el('div', { id: 'mi-toast', class: 'mi-toast' });
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), durationMs);
  }

  // ---------- localStorage History ----------
  const HISTORY_KEY = (slug) => `mi_history_${slug}`;
  const HISTORY_MAX = 10;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY(mock.slug));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[mock-interview] history load failed:', e);
      return [];
    }
  }

  function saveHistoryEntry(entry) {
    try {
      const arr = loadHistory();
      arr.unshift(entry);
      if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
      localStorage.setItem(HISTORY_KEY(mock.slug), JSON.stringify(arr));
    } catch (e) {
      console.warn('[mock-interview] history save failed:', e);
    }
  }

  // 评分变化时调用：用最新 snapshot 替换 head entry（同一 session 内）。
  function updateCurrentHistoryEntry() {
    if (mock.state !== STATES.DONE) return;
    try {
      const arr = loadHistory();
      if (arr.length > 0 && arr[0].ts === mock.sessionFinishedAt) {
        arr[0] = buildHistoryEntry();
        localStorage.setItem(HISTORY_KEY(mock.slug), JSON.stringify(arr));
      }
    } catch (e) {
      console.warn('[mock-interview] history update failed:', e);
    }
  }

  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY(mock.slug)); } catch {}
  }

  // ---------- 弱项分析 ----------
  // 以 cats 维度统计：每个分类下"自评 ≤ 2"的题占比，挑 ratio 最高的 Top 3。
  // 至少 1 道弱题 + 分类总题数 ≥ 1。未自评（rating=0）不算弱项。
  function computeWeakCats() {
    const totalByCat = new Map();
    const weakByCat = new Map();
    mock.pool.forEach((card, i) => {
      const r = mock.ratings[i] || 0;
      (card.cats || []).forEach(c => {
        totalByCat.set(c, (totalByCat.get(c) || 0) + 1);
        if (r >= 1 && r <= 2) {
          weakByCat.set(c, (weakByCat.get(c) || 0) + 1);
        }
      });
    });
    const rows = [];
    for (const [c, weak] of weakByCat.entries()) {
      const total = totalByCat.get(c) || 1;
      rows.push({ cat: c, weak, total, ratio: weak / total });
    }
    rows.sort((a, b) => b.ratio - a.ratio || b.weak - a.weak);
    return rows.slice(0, 3);
  }

  // ---------- 星级自评（render helper） ----------
  function buildStarRater(qIndex) {
    const wrap = el('div', { class: 'mi-stars', dataset: { qi: String(qIndex) } });
    const current = mock.ratings[qIndex] || 0;
    for (let s = 1; s <= 5; s++) {
      const star = el('button', {
        type: 'button',
        class: 'mi-star' + (s <= current ? ' on' : ''),
        title: `自评 ${s} 星`,
        dataset: { star: String(s) },
        onclick: (e) => {
          e.stopPropagation();
          // 再点已选的最高星 → 清零
          const newVal = (mock.ratings[qIndex] === s) ? 0 : s;
          mock.ratings[qIndex] = newVal;
          // 只更新本行 stars + label，不重建整个 body（保持滚动 / 焦点）
          wrap.querySelectorAll('.mi-star').forEach(btn => {
            const v = +btn.dataset.star;
            btn.classList.toggle('on', v <= newVal);
          });
          const lbl = wrap.querySelector('.mi-star-label');
          if (lbl) lbl.textContent = newVal === 0 ? '未评' : `${newVal} / 5`;
          refreshStats();
          refreshWeakSection();
          updateCurrentHistoryEntry();
        },
      }, '★');
      wrap.appendChild(star);
    }
    const label = el('span', { class: 'mi-star-label' }, current === 0 ? '未评' : `${current} / 5`);
    wrap.appendChild(label);
    return wrap;
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
        confirmExit();
      } else if (e.key === ' ' && mock.state === STATES.ANSWERING && document.activeElement?.id !== 'mi-answer-input') {
        // 空格暂停 / 继续（仅当焦点不在 textarea 时）
        e.preventDefault();
        togglePause();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && mock.state === STATES.ANSWERING) {
        // Ctrl+Enter / Cmd+Enter 提交本题 → 下一题（焦点在 textarea 也响应）
        e.preventDefault();
        flushCurrentQuestion();
        mock.cursor++;
        renderQuestion();
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
      opts.showTimer ? el('span', { class: 'mi-timer', id: 'mi-timer' }, '') : null,
      opts.showTimer && mock.cfg.timerEnabled
        ? el('button', { type: 'button', id: 'mi-pause-btn', class: 'mi-pause-btn', onclick: togglePause }, '⏸ 暂停')
        : null,
      el('button', { type: 'button', class: 'mi-exit', onclick: confirmExit }, '✕ 退出'),
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
    stopQuestionTimer();
    mock.state = STATES.IDLE;
    document.body.classList.remove('mi-active');
    const ov = $('#mi-overlay');
    if (ov) ov.hidden = true;
  }
  function confirmExit() {
    // 已答 ≥ 1 题（answers 非空或 cursor > 0）且在答题中 → 二次确认；否则直接退。
    const inSession = mock.state === STATES.ANSWERING || mock.state === STATES.DONE;
    const hasProgress = inSession && (mock.cursor > 0 || (mock.answers[0] || '').trim().length > 0);
    if (hasProgress) {
      if (!confirm('退出模拟？当前进度（答题内容 + 用时）会丢弃。')) return;
    }
    closeOverlay();
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

    // 计时模式
    root.appendChild(buildFieldset('计时模式', '模拟面试 = 倒计时 + 时间到自动切题；学习模式 = 不计时，纯练习', () => {
      const wrap = el('div', { class: 'mi-chips' });
      wrap.append(
        el('button', {
          type: 'button',
          class: 'mi-chip' + (mock.cfg.timerEnabled ? ' on' : ''),
          onclick: () => { mock.cfg.timerEnabled = true; refreshConfig(); },
        }, '⏱ 计时（推荐）'),
        el('button', {
          type: 'button',
          class: 'mi-chip' + (!mock.cfg.timerEnabled ? ' on' : ''),
          onclick: () => { mock.cfg.timerEnabled = false; refreshConfig(); },
        }, '📚 学习模式（不计时）'),
      );
      return wrap;
    }));

    // 每题时长（学习模式下灰掉）
    root.appendChild(buildFieldset(
      `每题时长${mock.cfg.timerEnabled ? '' : '（学习模式下不生效）'}`,
      '时间到自动进入下一题。可按空格暂停 / 继续。',
      () => {
        const wrap = el('div', { class: 'mi-chips' });
        PRESET_DURATIONS.forEach(({ label, sec }) => {
          wrap.appendChild(el('button', {
            type: 'button',
            class: 'mi-chip' + (mock.cfg.perQuestionSec === sec ? ' on' : ''),
            disabled: !mock.cfg.timerEnabled,
            onclick: () => { mock.cfg.perQuestionSec = sec; refreshConfig(); }
          }, label));
        });
        return wrap;
      }
    ));

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
    mock.ratings = mock.pool.map(() => 0);
    mock.questionTimes = mock.pool.map(() => 0);
    mock.cursor = 0;
    mock.sessionStartedAt = Date.now();
    mock.sessionFinishedAt = 0;
    mock.state = STATES.ANSWERING;
    renderQuestion();
  }

  // 切题前共用清理：记录当前题用时 + 保存答案
  function flushCurrentQuestion() {
    saveCurrentAnswer();
    recordCurrentQuestionTime();
    stopQuestionTimer();
  }

  function renderQuestion() {
    if (mock.cursor >= mock.pool.length) return finishSession();

    const card = mock.pool[mock.cursor];
    const total = mock.pool.length;
    const idx = mock.cursor + 1;
    const pct = Math.round(((mock.cursor) / total) * 100);

    renderTopbar('🎯 模拟面试 · 答题中', {
      progress: `第 ${idx} / ${total} 题`,
      progressPercent: pct,
      showTimer: true,
    });
    // 每题进入时启动 / 重置计时（即便用户从上一题返回，也是新一轮计时；M3 可改为累计）
    startQuestionTimer();

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

    // Peek — 就地切换 peek-content 显隐，避免重渲染整页（重渲染会
    // 重启 startQuestionTimer() 把倒计时重置回满预算）。
    const peekRow = el('div', { class: 'mi-peek-row' });
    const peekContent = el('div', { class: 'mi-peek-content', id: 'mi-peek-content', hidden: !mock.peeked[mock.cursor] });
    peekContent.innerHTML = mock.peeked[mock.cursor] ? renderAnswerHtml(card) : '';
    const peekBtn = el('button', {
      type: 'button',
      class: 'mi-peek-toggle' + (mock.peeked[mock.cursor] ? ' on' : ''),
      onclick: () => {
        const now = !mock.peeked[mock.cursor];
        mock.peeked[mock.cursor] = now;
        peekBtn.classList.toggle('on', now);
        peekBtn.textContent = now ? '👀 已展开（点击隐藏）' : '👀 我不会，看答案';
        if (now && !peekContent.innerHTML) {
          peekContent.innerHTML = renderAnswerHtml(card);
        }
        peekContent.hidden = !now;
      },
    }, mock.peeked[mock.cursor] ? '👀 已展开（点击隐藏）' : '👀 我不会，看答案');
    peekRow.appendChild(peekBtn);
    qCard.appendChild(peekRow);
    qCard.appendChild(peekContent);

    wrap.appendChild(qCard);

    // 导航
    const nav = el('div', { class: 'mi-nav' });
    nav.append(
      el('button', {
        type: 'button',
        class: 'mi-skip',
        disabled: mock.cursor === 0,
        onclick: () => { flushCurrentQuestion(); mock.cursor--; renderQuestion(); },
      }, '← 上一题'),
      el('span', { class: 'mi-spacer' }),
      el('button', {
        type: 'button',
        class: 'mi-skip',
        onclick: () => { flushCurrentQuestion(); mock.cursor++; renderQuestion(); },
      }, '跳过 →'),
      el('button', {
        type: 'button',
        class: 'mi-submit',
        onclick: () => { flushCurrentQuestion(); mock.cursor++; renderQuestion(); },
      }, mock.cursor === total - 1 ? '✓ 完成' : '提交本题 →'),
    );
    wrap.appendChild(nav);

    // 快捷键提示（小字、屏幕大时可见，移动端自动隐藏）
    const hints = el('div', { class: 'mi-kbd-hints' });
    hints.append(
      el('span', {}, '快捷键: '),
      el('kbd', {}, 'Ctrl'),
      ' + ',
      el('kbd', {}, 'Enter'),
      el('span', {}, ' 提交 · '),
      el('kbd', {}, 'Space'),
      el('span', {}, ' 暂停 / 继续 · '),
      el('kbd', {}, 'Esc'),
      el('span', {}, ' 退出'),
    );
    wrap.appendChild(hints);

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
    if (typeof MICardExtras !== 'undefined' && MICardExtras.hasExtras && MICardExtras.hasExtras(card)) {
      parts.push(MICardExtras.render(card));
    }
    return parts.join('');
  }

  // ---------- 完成（M3：Review + 自评 + 弱项 + history） ----------
  function finishSession() {
    stopQuestionTimer();
    mock.state = STATES.DONE;
    mock.sessionFinishedAt = Date.now();

    // 保存历史（只保存关键统计，不存答题内容，节省 localStorage）
    saveHistoryEntry(buildHistoryEntry());

    renderTopbar('🎯 模拟面试 · 完成', { progress: `${mock.pool.length} 题已结束`, progressPercent: 100 });

    const wrap = el('div', { class: 'mi-done' });
    wrap.append(
      el('h1', {}, '🎉 模拟结束'),
      el('p', { class: 'mi-done-sub' }, '给每道题打个自评，下方会自动汇总你的弱项分类。本次模拟的统计已保存到浏览器历史。'),
    );

    // 三统计卡（动态刷新区域）
    const statsWrap = el('div', { id: 'mi-stats-wrap' });
    statsWrap.appendChild(buildStatsCards());
    wrap.appendChild(statsWrap);

    // 弱项卡（动态刷新区域）
    const weakWrap = el('div', { id: 'mi-weak-wrap' });
    weakWrap.appendChild(buildWeakCard());
    wrap.appendChild(weakWrap);

    // Review 列表（每题可展开）
    const reviewSection = el('div', { class: 'mi-done-table' });
    reviewSection.appendChild(el('h3', {}, `📝 逐题 Review（${mock.pool.length} 题 · 点击展开）`));
    const list = el('div', { class: 'mi-done-rows', id: 'mi-review-rows' });
    mock.pool.forEach((card, i) => list.appendChild(buildReviewRow(card, i)));
    reviewSection.appendChild(list);
    wrap.appendChild(reviewSection);

    // 操作按钮
    const actions = el('div', { class: 'mi-done-actions' });
    actions.append(
      el('button', { type: 'button', class: 'mi-btn-primary', onclick: openConfig }, '🔁 再来一轮'),
      el('button', { type: 'button', class: 'mi-btn-secondary', onclick: closeOverlay }, '回到题库'),
    );
    wrap.appendChild(actions);

    // 历史折叠区
    wrap.appendChild(buildHistorySection());

    setContent(wrap);
  }

  function buildStatsCards() {
    const answered = mock.answers.filter(a => a && a.trim().length > 0).length;
    const peeked = mock.peeked.filter(Boolean).length;
    const totalMs = mock.sessionStartedAt ? (mock.sessionFinishedAt || Date.now()) - mock.sessionStartedAt : 0;
    const budgetMs = mock.cfg.timerEnabled ? mock.pool.length * mock.cfg.perQuestionSec * 1000 : 0;
    const rated = mock.ratings.filter(r => r > 0);
    const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;

    const stats = el('div', { class: 'mi-done-stats' });
    stats.append(
      mkStatCard('答题', `${answered} / ${mock.pool.length}`, peeked > 0 ? `偷看答案 ${peeked} 次` : ''),
      mkStatCard('总用时', fmtDuration(totalMs),
        mock.cfg.timerEnabled
          ? `预算 ${fmtDuration(budgetMs)}（${totalMs <= budgetMs ? '在预算内' : '超出 ' + fmtDuration(totalMs - budgetMs)}）`
          : '学习模式（不计时）'),
      mkStatCard('平均自评',
        rated.length ? `${avgRating.toFixed(1)} / 5` : '— / 5',
        rated.length ? `已评 ${rated.length} / ${mock.pool.length} 题` : '点每题展开后打分'),
    );
    return stats;
  }

  function refreshStats() {
    const wrap = document.getElementById('mi-stats-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.appendChild(buildStatsCards());
  }

  function buildWeakCard() {
    const weak = computeWeakCats();
    const card = el('div', { class: 'mi-weak-card' });
    const rated = mock.ratings.filter(r => r > 0).length;
    if (rated === 0) {
      card.append(
        el('div', { class: 'mi-weak-title' }, '🎯 弱项分类（待评估）'),
        el('div', { class: 'mi-weak-empty' }, '展开下方每道题打 1-5 星，系统会自动汇总自评 ≤ 2 的题最多的分类。'),
      );
    } else if (weak.length === 0) {
      card.append(
        el('div', { class: 'mi-weak-title' }, '🎯 弱项分类'),
        el('div', { class: 'mi-weak-empty' }, '✅ 没有自评 ≤ 2 的题，你这一轮表现稳定。'),
      );
    } else {
      card.append(el('div', { class: 'mi-weak-title' }, `🎯 弱项分类 Top ${weak.length}（你最该补的方向）`));
      const grid = el('div', { class: 'mi-weak-grid' });
      weak.forEach(({ cat, weak: w, total, ratio }) => {
        const item = el('div', { class: 'mi-weak-item' });
        item.append(
          el('div', { class: 'mi-weak-cat' }, cat),
          el('div', { class: 'mi-weak-bar-wrap' },
            el('div', { class: 'mi-weak-bar', style: `width:${Math.round(ratio * 100)}%` })
          ),
          el('div', { class: 'mi-weak-meta' }, `弱题 ${w} / ${total}（${Math.round(ratio * 100)}%）`),
        );
        grid.appendChild(item);
      });
      card.appendChild(grid);
    }
    return card;
  }

  function refreshWeakSection() {
    const wrap = document.getElementById('mi-weak-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    wrap.appendChild(buildWeakCard());
  }

  function buildReviewRow(card, i) {
    const t = mock.questionTimes[i] || 0;
    const usedPct = mock.cfg.timerEnabled
      ? Math.min(100, Math.round(t / (mock.cfg.perQuestionSec * 1000) * 100))
      : 0;
    const hasAns = (mock.answers[i] || '').trim().length > 0;
    const wasPeeked = mock.peeked[i];

    const row = el('div', { class: 'mi-review-row', dataset: { qi: String(i) } });

    // 行头（可点击展开 / 折叠）
    const head = el('div', { class: 'mi-review-head', onclick: () => toggleReviewRow(i) });
    head.append(
      el('span', { class: 'mi-review-toggle' }, '▶'),
      el('span', { class: `mi-q-pill ${card.diff || ''}` }, ({ basic: '🟢', mid: '🟡', high: '🔴' }[card.diff] || '·')),
      el('span', { class: 'mi-q-id' }, `#${String(card.id).padStart(3, '0')}`),
      el('span', { class: 'mi-done-q' }, stripHtml(card.q).slice(0, 70)),
      el('span', { class: 'mi-spacer' }),
      el('span', { class: 'mi-done-flags' }, (hasAns ? '✓' : '·') + (wasPeeked ? ' 👀' : '')),
      el('span', { class: 'mi-done-time' + (usedPct >= 100 ? ' over' : usedPct >= 80 ? ' warn' : '') }, fmtDuration(t)),
    );
    row.appendChild(head);

    // 行体（默认隐藏）
    const body = el('div', { class: 'mi-review-body', hidden: true });
    body.appendChild(buildReviewBody(card, i));
    row.appendChild(body);

    return row;
  }

  function buildReviewBody(card, i) {
    const body = el('div');

    // 题干（完整 HTML）
    const qFull = el('div', { class: 'mi-review-question' });
    qFull.innerHTML = `<strong>题目</strong>: ${card.q || ''}`;
    body.appendChild(qFull);

    // 两栏：你的答案 vs 标准答案
    const cols = el('div', { class: 'mi-review-cols' });
    const yours = el('div', { class: 'mi-review-col mi-review-yours' });
    yours.append(
      el('h5', {}, '✍️ 你的答案'),
      ((mock.answers[i] || '').trim().length > 0)
        ? el('pre', {}, mock.answers[i])
        : el('div', { class: 'mi-review-empty' }, mock.peeked[i] ? '— 未作答（偷看过答案）—' : '— 未作答 —'),
    );
    const standard = el('div', { class: 'mi-review-col mi-review-standard' });
    const stdInner = el('div');
    stdInner.innerHTML = renderAnswerHtml(card);
    standard.append(el('h5', {}, '📖 标准答案'), stdInner);
    cols.append(yours, standard);
    body.appendChild(cols);

    // 自评 + ref
    const rateRow = el('div', { class: 'mi-review-rate' });
    rateRow.append(
      el('span', { class: 'mi-review-rate-label' }, '我的自评：'),
      buildStarRater(i),
    );
    if (card.ref) {
      const refLink = el('a', {
        class: 'mi-review-ref',
        href: `${card.ref}.html`,
        target: '_blank',
        rel: 'noopener',
      }, `📚 深度阅读 ${card.ref.split('/').pop()}.html`);
      rateRow.appendChild(el('span', { class: 'mi-spacer' }));
      rateRow.appendChild(refLink);
    }
    body.appendChild(rateRow);

    return body;
  }

  function toggleReviewRow(i) {
    const row = document.querySelector(`.mi-review-row[data-qi="${i}"]`);
    if (!row) return;
    const body = row.querySelector('.mi-review-body');
    const toggle = row.querySelector('.mi-review-toggle');
    const open = !body.hidden;
    if (open) {
      body.hidden = true;
      toggle.textContent = '▶';
      row.classList.remove('open');
    } else {
      body.hidden = false;
      toggle.textContent = '▼';
      row.classList.add('open');
    }
  }

  function buildHistorySection() {
    const all = loadHistory();
    const wrap = el('details', { class: 'mi-history' });
    wrap.appendChild(el('summary', {}, `📜 历史（最近 ${Math.min(all.length, 5)} 次 / 共保留最近 ${HISTORY_MAX} 次）`));

    if (all.length === 0) {
      wrap.appendChild(el('div', { class: 'mi-history-empty' }, '本浏览器还没有 mock 历史记录。'));
      return wrap;
    }

    const list = el('div', { class: 'mi-history-list' });
    all.slice(0, 5).forEach((entry, idx) => {
      const row = el('div', { class: 'mi-history-row' });
      const when = new Date(entry.ts);
      const dateStr = `${when.getFullYear()}-${pad2(when.getMonth() + 1)}-${pad2(when.getDate())} ${pad2(when.getHours())}:${pad2(when.getMinutes())}`;
      const ratingStr = entry.rated > 0 ? `⭐ ${entry.avgRating.toFixed(1)}` : '⭐ —';
      const weakStr = (entry.weakCats && entry.weakCats.length)
        ? '弱项: ' + entry.weakCats.slice(0, 3).join(' / ')
        : '弱项: 未评估';
      row.append(
        el('span', { class: 'mi-history-idx' }, `#${all.length - idx}`),
        el('span', { class: 'mi-history-date' }, dateStr),
        el('span', { class: 'mi-history-stat' }, `${entry.answered} / ${entry.count} 题`),
        el('span', { class: 'mi-history-stat' }, fmtDuration(entry.totalMs)),
        el('span', { class: 'mi-history-stat' }, ratingStr),
        el('span', { class: 'mi-history-stat mi-history-weak' }, weakStr),
      );
      list.appendChild(row);
    });
    wrap.appendChild(list);

    const actions = el('div', { class: 'mi-history-actions' });
    actions.appendChild(el('button', {
      type: 'button',
      class: 'mi-btn-secondary',
      onclick: () => {
        if (!confirm(`清空 ${mock.slug} 题库的所有 mock 历史记录?`)) return;
        clearHistory();
        // 重渲染整个完成视图：简单做法是替换 history 区
        const old = wrap.parentElement;
        const fresh = buildHistorySection();
        old.replaceChild(fresh, wrap);
      },
    }, '清空历史'));
    wrap.appendChild(actions);

    return wrap;
  }

  function buildHistoryEntry() {
    const answered = mock.answers.filter(a => a && a.trim().length > 0).length;
    const peeked = mock.peeked.filter(Boolean).length;
    const totalMs = mock.sessionStartedAt ? mock.sessionFinishedAt - mock.sessionStartedAt : 0;
    const rated = mock.ratings.filter(r => r > 0);
    const avgRating = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
    const weak = computeWeakCats().map(w => w.cat);
    return {
      ts: mock.sessionFinishedAt,
      slug: mock.slug,
      count: mock.pool.length,
      answered,
      peeked,
      totalMs,
      timerEnabled: mock.cfg.timerEnabled,
      perQuestionSec: mock.cfg.perQuestionSec,
      rated: rated.length,
      avgRating,
      weakCats: weak,
    };
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function mkStatCard(label, value, sub) {
    const card = el('div', { class: 'mi-done-stat' });
    card.append(
      el('div', { class: 'mi-done-stat-label' }, label),
      el('div', { class: 'mi-done-stat-value' }, value),
      sub ? el('div', { class: 'mi-done-stat-sub' }, sub) : null,
    );
    return card;
  }

  function stripHtml(s) {
    return String(s || '').replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();
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
