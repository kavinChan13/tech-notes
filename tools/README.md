# Tools

仓库的维护脚本集合。所有脚本均为**纯 Node.js（≥18）**或 PowerShell，**零外部依赖**——保持仓库"clone 即用"、不引入 `node_modules`。

---

## `build-cards.mjs` — 卡片数据 → HTML 注入

将 `interview/data/<slug>.json` 注入到 `interview/<slug>_interview_cards.html` 的
`// <CARDS:BEGIN ...> ... // <CARDS:END>` 标记之间。

```bash
# 构建所有 4 套面试卡
npm run build:cards

# 只构建指定 slug
node tools/build-cards.mjs architect

# CI 模式：只校验是否最新，不写文件，过期则 exit 1
npm run build:cards:check
```

**Slug**：`architect` / `cpp` / `em` / `pm`

**设计原则**：
- HTML 仍是**单文件可离线**（双击即开），数据 inline 在 `<script>` 里。
- JSON 是**唯一可编辑的真源**；HTML 的注入区块由脚本生成，git 里跟随提交（不用 `.gitignore`）。
- 幂等：连续运行不产生 diff。

**编辑流程**：

```bash
# 1. 改 interview/data/architect.json
# 2. 重新生成 HTML
npm run build:cards
# 3. git diff → 提交 JSON + HTML 一起
git add interview/data/architect.json interview/architect_interview_cards.html
git commit -m "docs(interview): add 3 cards to architect set"
```

---

## `extract-cards.mjs` — 从 HTML 反向抽取 JSON

一次性迁移用，把现有 HTML 里的 `const CARDS = [...]` / `const CAT_GROUPS = [...]` 两段 JS 字面量解析出来，转成 JSON 写入 `interview/data/<slug>.json`。

```bash
node tools/extract-cards.mjs architect
```

实现要点：用 `vm.createContext` 沙盒安全 eval（避免 RCE），用括号配对扫描（避免被字符串里的 `[` `]` 干扰）。

迁移完成后，这个脚本仍可用于"从 HTML 反推 JSON 做 round-trip 校验"。

---

## `migrate-cards-html.mjs` — 给 HTML 加注入标记

一次性脚本：把现有的裸 `const CARDS = [...]; const CAT_GROUPS = [...];` 替换成 `<CARDS:BEGIN>` ... `<CARDS:END>` 占位标记。**对已有标记的文件自动跳过（幂等）**。

```bash
node tools/migrate-cards-html.mjs architect
node tools/build-cards.mjs architect  # 再用真数据填回
```

---

## `inject-shell.ps1` — 共享主题注入（旧）

> **TODO**：路径在 2026-05 重构后过期，待修复。

批量给文档注入 `assets/site-theme.css` + `assets/site-theme.js` 引用，并为带左侧栏的长文标记 `tn-shell-overlay`。

---

## 添加新工具脚本的约定

1. **零依赖**：只用 Node ≥18 内置模块（`fs` / `path` / `vm` / `url` / `crypto` 等）或 PowerShell 5+。
2. **幂等**：能多次运行不出错、不产生 diff。
3. **明确退出码**：成功 0、失败 1、有 `--check` 用 `--check` 模式表示"只验证不写"。
4. **顶部一段使用说明 + 例子**。
