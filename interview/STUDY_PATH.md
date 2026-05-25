# 学习路径 · Study Path

> 按 **角色** × **经验等级** 推荐内容顺序，让 578 张卡 + 50+ 深度页不再"无从下手"。
> 适用：自学 / 准备面试 / onboarding 团队新人。

---

## 怎么读这个文档

- 找到自己的 **当前角色**（C++ Dev / EM / PM / 通用面试备战）。
- 找到自己的 **目标等级**（mid → senior → staff / principal）。
- 按顺序读：① 卡片（5-10 min）→ ② 深度页（30-60 min）→ ③ 自测（mock 模式）。
- **🎯 标记**：该卡有完整"面试官视角"折叠区（mid / senior / staff 三档答案 + 失分模式 + 追问树）。
- **时间**：所有 "X h" 都是 **专注阅读 + 笔记** 时间，不含练手。

---

## 🅐 C++ 开发者路径

### A1 · Mid → Senior（3-5 年 → 5-8 年）·  目标 ~80-100 h

| 步骤 | 内容 | 时间 |
|---|---|---|
| 1 | 🎯 [值类别 / 移动语义 6 题](./cpp_interview_cards.html?cats=值类别) #51 #53 #54 #55 #60 #62 | 4 h |
| 2 | 深度：[值类别完整指南](../cpp/value_categories_guide.html) | 2 h |
| 3 | 🎯 [现代特性 5 题](./cpp_interview_cards.html?cats=现代特性) #25 #26 #27 #156 #158 | 3 h |
| 4 | 深度：[Modern C++ PPT](../cpp/modern_features_ppt.html)（C++11/14/17/20/23 全景） | 4 h |
| 5 | 🎯 [模板 / SFINAE 5 题](./cpp_interview_cards.html?cats=模板) #98 #99 #157 #180 #183 | 3 h |
| 6 | 深度：[Templates 指南](../cpp/templates_guide.html) | 3 h |
| 7 | 🎯 [对象模型 8 题](./cpp_interview_cards.html?cats=对象模型) #145 #213 #214 #216 #218 #222 #225 #227 | 4 h |
| 8 | 深度：[Object Model](../cpp/object_model.html) + [Memory Model](../cpp/memory_model.html) | 6 h |
| 9 | 🎯 [并发 / Memory Order 10 题](./cpp_interview_cards.html?cats=并发) #77 #78 #79 #80 #81 #84 #86 #87 #89 #90 | 6 h |
| 10 | 深度：[Concurrency Patterns](../stl/concurrency_patterns_guide.html) | 3 h |
| 11 | 🎯 [Sanitizer 2 题](./cpp_interview_cards.html?cats=Sanitizer) #117 ASan / #118 TSan | 1.5 h |
| 12 | 深度：[Sanitizers 指南](../perf-debug/sanitizers_guide.html) + [Memory Leak](../perf-debug/memory_leak_guide.html) | 4 h |
| 13 | 🎯 [I/O 4 题](./cpp_interview_cards.html?cats=I/O) #124 #125 #127 #171 | 2.5 h |
| 14 | 深度：[Linux Kernel I/O](../system/io_linux_kernel_guide.html) + [Async Networking](../system/async_networking_guide.html) | 5 h |
| 15 | 🎯 [类型擦除 / 异常 / 性能 5 题](./cpp_interview_cards.html?cats=性能) #64 #94 #106 #108 #110 | 3 h |
| 16 | 深度：[Performance](../perf-debug/performance_guide.html) + [Low-Latency](../perf-debug/low_latency_guide.html) | 5 h |
| 17 | 🎯 [系统设计 3 题](./cpp_interview_cards.html?cats=系统设计) #148 LRU / #149 限流 / #152 NETCONF | 2 h |
| 18 | 🎯 [工程思维 4 题](./cpp_interview_cards.html?cats=思维) #173 #174 #191 #198 | 2 h |
| 19 | Mock 实战：随机抽 20 题用模拟面试模式跑 30 min | 1 h |

**总：~64 h（深度读 + 卡片）**

### A2 · Senior → Staff（8 年+）· 目标 ~120-150 h

A1 全部 + 以下额外深度：

| 主题 | 资源 | 时间 |
|---|---|---|
| ABI / 编译 | 🎯 #113 #114 #189 + [ABI Compatibility](../perf-debug/abi_compatibility_guide.html) + [Compilation Guide](../cpp/compilation_guide.html) | 6 h |
| 低延时编程 | 🎯 #91 SPSC / #164 CPU pinning + [Low-Latency Guide](../perf-debug/low_latency_guide.html) | 6 h |
| 网络协议 | 🎯 #172 zero-copy / #256 TLS + [Networking](../system/networking_guide.html) | 5 h |
| 协程 / 异步 | 🎯 #27 协程 + [Coroutines Deep Dive](../cpp/coroutines_deep_dive.html) | 4 h |
| Crash / Deadlock 调试 | [Crash Debug](../perf-debug/crash_debugging_guide.html) + [Deadlock Debug](../perf-debug/deadlock_debugging_guide.html) | 5 h |
| 构建 / CI / 现代库 | [CMake CI](../perf-debug/cmake_ci_guide.html) + [Modern Libs](../perf-debug/modern_libs_guide.html) | 4 h |
| OS 基础 | [OS Fundamentals](../system/os_fundamentals.html) + [FD Deep Dive](../system/filedescriptor_deepdive.html) | 5 h |
| 安全加固 | [Security Hardening](../perf-debug/security_hardening_guide.html) | 2 h |

**自检**：能不能给 junior 讲清"为什么 std::move 后对象是 lvalue"+ "vector 扩容怎么选 move vs copy"+ "lock-free SPSC 为什么需要 release-acquire pair"？能 → Staff 候选。

---

## 🅑 EM / Tech Lead 路径

### B1 · 新晋 EM / 准备转 EM · 目标 ~40-60 h

| 步骤 | 内容 | 时间 |
|---|---|---|
| 1 | 🎯 [新晋 EM 必读 8 题](./em_interview_cards.html) #1 EM 是什么 / #2 vs Tech Lead / #3 第一周 / #6 不再写代码 / #10 1on1 / #14 反馈 / #15 招聘 / #17 绩效 | 5 h |
| 2 | 深度：[Software Management Guide](../management/software_management_guide.html)（200 页综合） | 8 h |
| 3 | 深度：[Management Knowledge System](../management/management_knowledge_system.html) | 6 h |
| 4 | 模板：[EM 模板 12 件套](../management/em-templates/index.html)（1on1 / 周报 / 30-60-90 / RACI / ADR / Postmortem 等） | 4 h |
| 5 | 🎯 [跨部门 / 影响力 PM 题](./pm_interview_cards.html) #2 #3 #4（也适用 EM） | 1.5 h |

### B2 · Senior EM → Director（5 年+ EM）· 目标 ~80-100 h

B1 全部 + 以下：

| 主题 | 资源 | 时间 |
|---|---|---|
| Senior EM 知识体系 | [Senior Manager Knowledge System](../management/senior_manager_knowledge_system.html)（120 页） | 8 h |
| AI-Native EM | [AI-Native EM](../management/ai_native_engineering_management.html) | 4 h |
| Layoff / 危机 / Burnout | 🎯 EM #22 #25 #28 #30（含失业潮处理） | 3 h |
| 财务 / 商业 | 🎯 EM #32 #33（burn rate / ARR / unit economics） | 2 h |
| 招聘漏斗 | 🎯 EM #50 #52 #55 + [Hiring Scorecard 模板](../management/em-templates/08-hiring-scorecard.html) | 3 h |
| 决策 / ADR | [ADR 模板](../management/em-templates/09-adr.html) + [Decision Log](../management/em-templates/10-decision-log.html) | 2 h |

**自检**：能不能 30 min 写一份给 VP 的 "项目红区 + 3 选项 + 推荐 + ask" 备忘？能 → Senior+ EM。

---

## 🅒 PM 路径

### C1 · 转 PM / 新晋 PM · 目标 ~40-60 h

| 步骤 | 内容 | 时间 |
|---|---|---|
| 1 | 🎯 [STAR 框架](./pm_interview_cards.html?ids=1) #1 | 0.5 h |
| 2 | 🎯 [PdM 核心 5 题](./pm_interview_cards.html?cats=PdM) #52 北极星 / #53 AARRR / #55 真假需求 / #56 JTBD / #64 RICE | 3 h |
| 3 | 深度：[Dual-Track Overview](../pm/dual_track_overview.html) + [Discovery JTBD](../pm/discovery_jtbd.html) | 4 h |
| 4 | 🎯 [PgM 3 题](./pm_interview_cards.html?cats=PgM) #32 EVM / #33 SPI/CPI / #45 RACI | 2 h |
| 5 | 深度：[EVM Planning Guide](../pm/evm_planning_guide.html) + [Stakeholder Influence](../pm/stakeholder_influence.html) | 4 h |
| 6 | 模板：[PM 模板 12 件套](../pm/templates/index.html)（Charter / WBS / RACI / RAID / PRD 等） | 3 h |
| 7 | 🎯 [行为题 7 题](./pm_interview_cards.html?cats=行为题) #2-#4 #14 #22 #23 #26 | 5 h |
| 8 | 🎯 [Case / Estimation 3 题](./pm_interview_cards.html?cats=Case) #77 CIRCLES / #87 留存 / #88 Estimation | 3 h |
| 9 | 🎯 [红旗 #93](./pm_interview_cards.html?ids=93)（"我们" vs "我"） | 0.5 h |

### C2 · Senior PdM / Group PM · 目标 ~80-100 h

C1 全部 + 以下：

| 主题 | 资源 | 时间 |
|---|---|---|
| A/B 实验设计 | [Data A/B Testing](../pm/data_ab_testing.html) + 🎯 PM #68 D17 #69 D18 | 4 h |
| PRD / 文档 | [PRD Writing Kit](../pm/prd_writing_kit.html) + [PRD 模板](../pm/templates/11-prd-template.html) | 3 h |
| LTV / CAC / Unit Economics | 🎯 PM #76 D25 | 2 h |
| PMBOK / PgM 体系 | [PMBOK Overview](../pm/pmbok_overview.html) | 3 h |

**自检**：能不能用 30 min 把一个 vague "提升 retention 10%" 转成 OST + 3 个 testable hypotheses + 1 个 A/B test 设计？能 → Senior PdM。

---

## 🅓 面试备战通用路径

### D1 · 30 天突击（找工作中）· 目标 ~60-80 h

**优先级**：先攻克<u>必考题</u>，再补深度。

#### Week 1 · 框架打底（10-15 h）

- 🎯 PM #1 STAR / 🎯 PM #77 CIRCLES（无论什么角色都用）
- 🎯 PM #2 #3 #4（影响力 / 跨部门 → EM 也用）
- 🎯 PM #14 #22 #23（失败 / 弱点 / 自我认知）
- 🎯 PM #93（"我们" vs "我"红旗）
- 准备 **6-8 个 STAR 故事**，每个 90s + 4 min 两版本（mock 录音）

#### Week 2 · 技术深度（视角色侧重）

**C++ 岗**：
- 🎯 cpp 60 张全过一遍（重点 mid / senior 档答案）
- 🎯 cpp #173 / #174 / #198（review / debug / API 设计）
- 深度页：[Memory Model](../cpp/memory_model.html) + [Modern C++ PPT](../cpp/modern_features_ppt.html)

**EM 岗**：
- 🎯 EM 30 张全过
- 准备 **5 个领导力故事**（推 / 拉 / 帮 / 救 / 学）
- 深度：[Software Management Guide](../management/software_management_guide.html)

**PM 岗**：
- 🎯 PM 20 张全过
- 模板：[PM 模板](../pm/templates/index.html) 中 RAID / Charter / PRD 各看一份样例
- 深度：[Dual-Track](../pm/dual_track_overview.html) + [Discovery JTBD](../pm/discovery_jtbd.html)

#### Week 3 · 系统设计（C++ / 后端 / Staff 必考）

- 🎯 cpp #148 LRU / #149 限流 / #152 大型 RPC 服务优化
- 🎯 architect #11 微服务拆分 / #19 DDD / #22 CAP/PACELC / #28 Raft / #38 LSM / #47 Outbox
- 深度：[Distributed Systems Fundamentals](../architect/distributed_systems_fundamentals.html) + [Storage & Data Architecture](../architect/storage_and_data_architecture.html)

#### Week 4 · Mock + 反思（10-15 h）

- 用 [Mock 模式](./cpp_interview_cards.html)（点 🎯 模拟面试按钮）跑 3-5 次：每次 4 维度 / 30 min
- 把每次得分低的题加入 weak topic 列表 → 针对性复习
- 录音 / 录视频自己讲 STAR → 听 "我" vs "我们" 比例 + 数字密度

### D2 · 长期面试就绪（6 个月+）· 目标 ~200 h

D1 + 全部 A1/A2/B1/B2/C1/C2 对应角色路径。重点：
1. 每月跑 1 次完整 mock，记录 trend
2. 每季度复盘自己的 STAR 故事库（项目变了，故事也要换）
3. 关注 [Tech Lead Interview Guide](./tech_lead_interview_guide.html) 跨角色综合

---

## FAQ

**Q1：我时间有限，最起码读哪几个文件？**

按角色挑：
- C++ Dev → 🎯 cpp 卡 60 张 + [Modern C++ PPT](../cpp/modern_features_ppt.html)
- EM → 🎯 EM 卡 30 张 + [Software Management Guide](../management/software_management_guide.html)
- PM → 🎯 PM 卡 20 张 + [Dual-Track Overview](../pm/dual_track_overview.html)

**Q2：🎯 标记的卡片跟普通卡片区别？**

普通卡：1 个简短答案。
🎯 卡：3 档样例答案（mid 合格 / senior 加分 / staff Offer）+ 失分模式 + 追问树 + 真实案例。

打开任一卡片，看 "🎯 面试官视角 · 深度信号" 折叠区。

**Q3：怎么用模拟面试模式？**

任一卡片应用页面右上角点 "🎯 模拟面试" → 选维度（4 个 MVP 维度）→ 答题（开计时）→ 看 review + 自评 → 弱项列表自动累计。

**Q4：内容更新频率？**

主线（架构 / EM / C++ / PM）季度大更，新热点（AI-Native / LLM tooling / RT-Linux）月度增量。订阅 GitHub repo watch。

**Q5：我想给团队一起用怎么办？**

整个 repo 是 static HTML，clone 后直接打开 [index.html](../index.html) 即可。或者 fork 后改 README 加自己团队的 onboarding 路径。

---

## 进度自检（Cheat Sheet）

| 角色 | 看完 50% 内容 ≈ | 看完 100% 内容 ≈ |
|---|---|---|
| C++ Dev | Mid 候选 / 跳槽稳进 senior | Senior+ 候选 / Staff 可争取 |
| EM | 新晋 EM 不慌 | Senior EM / Group Manager 准备好 |
| PM | 新晋 PM 上手 | Senior PdM / Group PM 准备好 |
| 综合面试 | 大厂 / 中厂常规岗 | 大厂 senior+ / 创业公司 founding+ |

---

最后更新：2026-05-25 · 累计深度内容 160 / 578 张（28%）· 持续推进中。
