# Card Schema · `interview/data/<slug>.json`

文件结构：

```jsonc
{
  "slug":          "architect" | "cpp" | "em" | "pm",
  "sourceHtml":    "<slug>_interview_cards.html",
  "cardCount":     <number>,
  "categoryGroups": [{ "name": "🎯 优先级", "cats": ["P0","P1"] }, ...],
  "cards":         [<Card>, ...]
}
```

---

## Card 字段（核心，每张卡必填）

| 字段     | 类型                          | 说明                                                              |
| -------- | ----------------------------- | ----------------------------------------------------------------- |
| `id`     | `number`                      | 唯一自增 ID（与该 slug 内的 cardCount 对齐）                      |
| `cats`   | `string[]`                    | 至少 1 个分类（含 `"P0"` / `"P1"` 优先级标签）                    |
| `diff`   | `"basic" \| "mid" \| "high"`  | 难度等级                                                          |
| `q`      | `string (HTML 允许)`          | 题干                                                              |
| `ans`    | `string (HTML 允许)`          | 标准答案（一段式总结，~50-150 字）                                |

## Card 字段（旧扩展，按需）

| 字段    | 类型                  | 说明                                                              |
| ------- | --------------------- | ----------------------------------------------------------------- |
| `code`  | `string (HTML <pre>)` | 示例代码 / SQL / 配置片段，通常包在 `<pre>...</pre>` 里           |
| `bonus` | `string (HTML 允许)`  | ⭐ 加分点（讲到能加分但非必须）                                   |
| `trap`  | `string (HTML 允许)`  | ⚠️ 常见陷阱（一段式总结）                                         |
| `ref`   | `string`              | 关联深度文档相对路径（不带 `.html` 后缀，例：`../architect/foo`） |

## Card 字段（**Phase 1 新增 · D1 起**）

这 4 个字段是 Top 100 高频题的"训练器升级"。**全部可选**。**未填的卡**在 UI 上完全
不显示新区块（保持原版"翻卡片"体验，零回归）。

### 1. `why_asked` · 考官视角

> 这道题考官想验证候选人的什么真实信号？

| 字段        | 类型     | 说明                                       |
| ----------- | -------- | ------------------------------------------ |
| `why_asked` | `string` | 1-3 句话，说清楚"考官期待看到什么信号"     |

**示例**：
```json
"why_asked": "验证候选人能否区分 DDD 的'语义边界'与工程的'部署边界'。能区分的人通常能避免'为了拆而拆'的微服务过度设计。"
```

### 2. `answers` · 三档样例答案

> 同一题，不同 senority 应该答到什么程度。

| 字段             | 类型     | 说明                                              |
| ---------------- | -------- | ------------------------------------------------- |
| `answers.mid`    | `string` | L4 / IC2 mid 级合格线 —— 答出"知道是什么"即可     |
| `answers.senior` | `string` | L5 / Senior 加分线 —— 加"为什么、误读、对比"      |
| `answers.staff`  | `string` | L6+ / Staff offer 线 —— 加"演进、跨域影响、案例"  |

**示例**：
```json
"answers": {
  "mid": "BC 是 DDD 中的边界概念...一个微服务对应一个 BC。",
  "senior": "BC 是语言学边界，微服务是物理边界，不是 1:1...",
  "staff": "Conway's Law: 软件结构反映组织结构...Monolith First (Fowler)..."
}
```

**与 `ans` 的关系**：`ans` 是"一段式标准答案"，`answers.*` 是"按级别拆开的样例答案"。
两者可共存：`ans` 给"翻卡片"快速复习用；`answers` 给"面试官视角"对照用。

### 3. `failure_modes` · 典型失分模式

> 这道题常见的"答错 / 答偏"模式。比 `trap` 更系统。

| 字段              | 类型       | 说明                              |
| ----------------- | ---------- | --------------------------------- |
| `failure_modes`   | `string[]` | 3-7 条，每条一段一行（要点级）   |

**示例**：
```json
"failure_modes": [
  "把 CAP 的 C 等同于 ACID 的 C",
  "说 'MySQL 是 CA 系统'（暴露不懂'分布式必有 P'）",
  "用 '三选二' 做绝对化判断（忽略 PACELC 在正常时的取舍）",
  "不能举出真实系统的 CAP 定位（如不知道 etcd 是 CP）"
]
```

**与 `trap` 的关系**：`trap` 是一段式陷阱总结；`failure_modes` 是结构化的失分模式
清单。两者可共存。

### 4. `follow_ups` · 考官追问树

> 答完主题后，考官顺势会追问什么。

| 字段                 | 类型                              | 说明                          |
| -------------------- | --------------------------------- | ----------------------------- |
| `follow_ups`         | `{ q: string, hint: string }[]`   | 2-4 条，每条带答题提示要点    |

**示例**：
```json
"follow_ups": [
  { "q": "什么时候不拆微服务？",     "hint": "团队 ≤ 30 人 / 模块变更节奏相近 / QoS 需求一致 → 用模块化 monolith 即可" },
  { "q": "BC 之间怎么集成？",        "hint": "Context Map 7 种模式：Shared Kernel / Customer-Supplier / Conformist / ACL / OHS / PL / Separate Ways" },
  { "q": "讲一次你重构 BC 边界的经历", "hint": "结合 Event Storming 发现的领域事件，用 Strangler Fig 渐进迁移" }
]
```

---

## 渲染规则

### 原版"翻卡片"
1. 题目标题（点击展开）
2. `ans`（📝 标准答案）
3. `code`（💻 示例）— 若有
4. `bonus`（⭐ 加分点 / 进阶）— 若有
5. `trap`（⚠️ 常见陷阱）— 若有
6. **`MICardExtras.render(card)` 输出的"🎯 面试官视角"区块**（默认折叠）—— 若有任一新字段
7. `ref`（📚 深度阅读链接）— 若有

### Mock Review
顺序与"翻卡片"一致；区别仅在 Review 是与"你的答案"并排显示。

### 折叠区块结构
"🎯 面试官视角"折叠区内部按顺序展示：
- ❓ 为什么问这道题（`why_asked`）
- 🎚️ 三档样例答案（`answers`，每档独立小卡）
- 🚫 典型失分模式（`failure_modes`，bullet 列表）
- ↪️ 考官追问（`follow_ups`，Q + hint 缩进展示）

---

## 编辑指引

1. 编辑 `interview/data/<slug>.json` 中对应卡片，添加新字段。
2. **保持 `ans` / `bonus` / `trap` 不变**（向后兼容 + 翻卡片速读体验）。
3. 跑 `npm run build:cards` 重新 inline 到 HTML。
4. 在浏览器打开对应页面，展开题目 → 点 "🎯 面试官视角" 检查渲染。
5. commit 时 JSON + HTML 一起提交。

## 优先级（Phase 1 第二阶段填充顺序）

按 ROI：
| Slug      | 选题范围                                              | 数量 |
| --------- | ----------------------------------------------------- | ---- |
| architect | 全部 P0 + 关键 P1                                     | ~50  |
| cpp       | Staff 级（diff=high）+ 高频 P0                        | ~60  |
| em        | Senior EM 转型 + AI-Native + 危机/裁员                | ~30  |
| pm        | 行为题 + Case 题（STAR 高频）                         | ~20  |
| **合计**  |                                                       | ~160 |

**架构师作为模板优先做**（你最熟，质量易把控），然后批量复制结构到其他 slug。
