#!/usr/bin/env node
// =============================================================================
// enrich-cards.mjs
// 把 ENRICHMENT 字典里的新字段（why_asked / answers / failure_modes / follow_ups）
// 合入 interview/data/<slug>.json 对应卡片。
//
// 用法:
//   node tools/enrich-cards.mjs <slug>            # 写入
//   node tools/enrich-cards.mjs <slug> --dry-run  # 只统计不写
//
// 设计：
//   - 已存在的新字段会被覆盖（重跑安全）
//   - 老字段 (ans/bonus/trap/code/ref) 永不动
//   - 卡片在 JSON 里的顺序不变，只在每张卡内追加新字段
// =============================================================================
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ============================================================================
// ENRICHMENT DATA
// 按 slug 组织。每个卡的 key 是 card.id (number)。
// 用 JS 对象字面量 + 模板字符串，HTML 可以直接写不用 JSON 转义。
// ============================================================================

const ENRICHMENT = {
  architect: {
    // ============== 架构方法论 ==============
    1: {
      why_asked: `验证候选人能否给出可操作的"架构"判断标准，而不是泛泛而谈"系统设计"。能在面试前 5 分钟就让面试官分辨"懂架构"和"只写代码"。`,
      answers: {
        mid: `软件架构是系统的<strong>整体结构与组件关系</strong>，包括模块划分、技术选型、关键非功能需求（性能 / 可扩展性 / 安全）。`,
        senior: `Fowler 的定义：架构 = <strong>难改的关键决策的总和</strong>。包括：① 宏观结构（C4 的 L1-L2）；② 质量属性承诺（性能 / 可用 / 安全 / 可演进）；③ 约束（技术栈 / 合规 / 预算 / 团队能力）。判断一个决策是不是"架构级"，看 <strong>回滚成本</strong>—— &gt; 1 个月才算。`,
        staff: `进一步：架构是 Booch 说的"<strong>重要决策的集合</strong>"，"重要" = 显著影响成本、进度、质量或能力。三个量化维度：① 时间尺度（1-3 年 vs 1 周）；② 影响半径（跨多服务/团队 vs 单模块）；③ 撤销成本（重写大量代码 vs Refactor 几小时）。我在车端 telemetry 项目里最初把"用 gRPC 还是 REST"当架构决策，后来发现可一周内切换；<strong>真正的架构决策是"数据模型用 protobuf schema 还是 OpenAPI/JSON Schema"</strong>——一旦定了所有上下游代码都依赖，撤销成本月级，这才是 ADR 该记录的。`,
      },
      failure_modes: [
        `把"架构"等同于"画图"——架构师 80% 时间是<strong>决策 + 沟通</strong>，画图只是表达工具`,
        `给定义但不给判断标准（区分不了"架构决策"和"普通技术决策"）`,
        `只讲 functional 设计，不提 quality attributes（非功能性需求才是架构的核心约束）`,
        `误以为"架构 = 复杂"，倾向 over-engineering（YAGNI / Premature Optimization 反模式）`,
      ],
      follow_ups: [
        { q: `给一个你做过的架构决策，怎么判断它是"架构级"的？`, hint: `用回滚成本 / 影响半径 / 时间尺度 三个维度量化，最好给具体数字（"重写要 3 周"、"影响 6 个服务"）` },
        { q: `架构和设计模式的区别？`, hint: `架构是宏观决策（C4 L1-L2 系统/容器级），设计模式是局部代码组织（C4 L3-L4 模块/类级）；两者互补不冲突` },
        { q: `架构是否需要前期完整设计？`, hint: `演进式架构（Ford）+ Last Responsible Moment 决策（Poppendieck）+ Fitness Function 守护——避免 BDUF 也避免无计划` },
      ],
    },

    2: {
      why_asked: `验证候选人有没有用过结构化的架构表达方法，不是只会画"框框 + 箭头"。能区分 4 层并知道"给谁看"的人，沟通能力通常强。`,
      answers: {
        mid: `<strong>L1 Context</strong>（系统 + 用户 + 外部系统）→ <strong>L2 Container</strong>（独立部署单元）→ <strong>L3 Component</strong>（单 Container 内部模块）→ <strong>L4 Code</strong>（类/函数级，通常 IDE 生成）。`,
        senior: `4 层是<strong>从外到内的 zoom-in</strong>，关键在<strong>不同层级给不同受众看</strong>：L1 给非技术高管 / L2 给跨团队架构师 / L3 给本团队开发 / L4 给新人 onboarding 或 code review。这是 C4 比传统 UML 优秀的地方——UML 不区分受众。`,
        staff: `C4 真正的价值在于<strong>"给对的人画对的图"</strong>，避免"一张图所有人都看不懂"。我在 infrastructure 团队推 C4 后，PMO sprint review 看 L1，跨团队 architecture council 看 L2，sprint planning 看 L3，新人 onboarding 看 L4——同一系统不同视图减少了 70% 的 "我们说的是同一个东西吗" 类争论。还有 2 个补充层：<strong>System Landscape</strong>（公司全景，比 L1 更高）和 <strong>Dynamic Diagram</strong>（运行时调用序列，覆盖 C4 静态短板）。工具上推荐 <strong>Structurizr DSL</strong>（代码化、可版本化）+ PlantUML 生成图，避免拖图变更不易追溯。`,
      },
      failure_modes: [
        `4 层混在一张图里画（业余表现，专家一眼识破）`,
        `L1 里出现技术词（"Kafka"、"Redis"）——L1 给业务方看，应只有"消息队列"、"缓存"`,
        `L4 真的去画类图（90% 时候 IDE/AST 工具自动生成就够，画了也没人维护）`,
        `不区分 Container 和 Component，导致 L2 和 L3 看起来差不多（核心区别：Container 独立部署）`,
      ],
      follow_ups: [
        { q: `一个 microservices 系统画 C4，每层都该有什么？`, hint: `L1 = 系统 + 用户 + 外部依赖；L2 = 每个 service + 共享 DB + 队列；L3 = service 内部 layer（handler / service / repo）；L4 = 关键算法或数据结构` },
        { q: `C4 跟 4+1 视图的关系？`, hint: `4+1 包含 logical/development/process/physical + scenarios，更全面但更重；C4 聚焦"static structure"四层，上手快；可组合用` },
        { q: `怎么在 CI 里强制 C4 图与代码一致？`, hint: `Structurizr DSL + 静态分析（ArchUnit / pyverdep / depcheck）+ Fitness Function 测试在 PR 阶段拦截` },
      ],
    },

    3: {
      why_asked: `验证候选人是否真做过架构评估，还是只设计架构。ATAM 是 CMU/SEI 的工业标准，做过的人能清晰区分四类输出。`,
      answers: {
        mid: `ATAM (Architecture Tradeoff Analysis Method) 评估输出四类：🔴 <strong>Risk</strong>（架构可能无法达到关键场景）/ 🟡 <strong>Sensitivity Point</strong>（某决策对一个质量属性影响显著）/ 🟠 <strong>Tradeoff Point</strong>（决策同时影响多属性方向相反）/ 🟢 <strong>Non-Risk</strong>（评估后无问题）。`,
        senior: `<strong>Risk</strong> = "可能失败"的地方，要写 mitigation；<strong>Sensitivity</strong> = "敏感参数"，要在生产监控；<strong>Tradeoff</strong> = "鱼与熊掌"，<strong>必须写 ADR 记录权衡过程</strong>，否则后人不知道为什么这样选；<strong>Non-Risk</strong> = 暂时安全（不代表永远 OK，要定期重评）。`,
        staff: `ATAM 完整流程 9 步：介绍 → 业务驱动 → 架构介绍 → 识别架构方法 → 生成 <strong>utility tree</strong> → 分析 → brainstorm scenarios → re-analyze → report。<strong>真实经验</strong>：在车端 infrastructure 团队做过一次 ATAM，最大收获是 utility tree 把模糊的"系统要可靠"具化成 "ECU 断电恢复后 5s 内重连 + 100% 消息不丢"，从此架构讨论有了量化锚点。Tradeoff 例子：高频遥测数据用 protobuf（高效但难调试）vs JSON（易调试但带宽 3x），最终选 protobuf + 离线 schema 工具链，写了 ADR-007。Lightweight ATAM（1 天版）适合中小团队。`,
      },
      failure_modes: [
        `把 ATAM 等同于"架构 review meeting"——ATAM 是结构化的多 stakeholder workshop（通常 2-3 天，带 facilitator）`,
        `跳过 utility tree 直接分析，导致质量属性需求模糊，后面 scenario 无依据`,
        `只识别 Risk，不识别 Sensitivity 和 Tradeoff（其实后两者最有价值）`,
        `评估完不输出 report，结论留在白板上没人执行 → 评估白做`,
      ],
      follow_ups: [
        { q: `ATAM 跟 SAAM、CBAM 的关系？`, hint: `都是 SEI 系列；SAAM 是 ATAM 前身（只看可维护性）；CBAM 在 ATAM 后加 cost-benefit 分析（每个改动的 ROI）` },
        { q: `Utility Tree 怎么画？`, hint: `根 = 系统目标 / 二层 = 质量属性（性能 / 可用 / 安全 / 可维护）/ 三层 = 具体场景 + 重要性 H/M/L + 难度 H/M/L` },
        { q: `没有时间做完整 ATAM 怎么办？`, hint: `Lightweight ATAM（1 天）或 ATAM-LP；至少做 utility tree + Top-5 关键 scenario 评估` },
      ],
    },

    4: {
      why_asked: `验证候选人能否把"系统要快"翻译成可验收的工程需求。能用六段式表达的人通常能避免"需求描述不清→架构失败"的坑。`,
      answers: {
        mid: `质量属性场景的标准格式：<strong>Source（触发源）+ Stimulus（刺激）+ Environment（环境）+ Artifact（被影响对象）+ Response（响应）+ Measure（度量）</strong> 六要素。每个非功能需求都应写成这个结构。`,
        senior: `不可测量的需求<strong>不是工程需求</strong>。反例："系统要快" / "要可靠" / "要可扩展"——这些都没法验收。正例："正常负载下，外部 API 客户端通过网关发起 10k QPS GET 请求，<strong>P99 ≤ 50ms，错误率 &lt; 0.1%</strong>"。六要素帮你逼出每个空白处。`,
        staff: `这是 SEI 的 SOSA / QAW (Quality Attribute Workshop) 方法核心。真实价值：① 让产品 / 运维 / 开发对"做到什么程度"达成共识；② 后续 ATAM 评估有依据；③ <strong>直接映射 SLI/SLO</strong>，可观测性平台直接告警。我在 platform agent 项目里推这个格式之后，PRD 阶段就把"高可用"细化成 "Active-Active 集群在 1 节点失效后 RTO ≤ 30s、RPO ≤ 5s"——开发 / SRE / 客户三方都签字，上线后 SLO 对得上。<strong>注意</strong>：场景要覆盖 4 类——normal / growth（高负载）/ stressed（异常）/ failure（故障）。`,
      },
      failure_modes: [
        `给的需求只有形容词（快 / 稳 / 简单），没有数字`,
        `只写"正常情况"的需求，忘了高负载 / 故障 / 边界情景`,
        `Measure 用"大概"、"尽量"等模糊词`,
        `场景写完不映射到 SLI/SLO，导致 prod 后没办法验证是否达成`,
        `不区分 Source 和 Stimulus，导致触发条件不明（比如"用户量上升"到底是 spike 还是 ramp）`,
      ],
      follow_ups: [
        { q: `举一个"可用性"的六段式场景？`, hint: `S: 一个 worker 节点 / Stim: 主板失效宕机 / Env: 业务高峰 / Art: 整个集群 / Resp: 自动 failover / Measure: RTO ≤ 30s, 失败请求 &lt; 1%` },
        { q: `怎么把这些 scenario 转成自动化测试？`, hint: `① Performance: k6 / Gatling 压测 + SLO 断言；② Resilience: Chaos Monkey 故障注入 + 监控验证；③ Security: 自动渗透测试` },
        { q: `这套方法的局限？`, hint: `难捕获"涌现行为"（如多个低优先级 scenario 叠加 → 系统不可用）；要补充 ATAM 的 brainstorm + tradeoff 分析` },
      ],
    },

    // #5 (CAP) 已在 D1 填好，跳过

    6: {
      why_asked: `验证候选人是不是只背名词。能讲清"三者本质相同"是高级和初级的分水岭——能识破"换名词推广"是架构成熟度的标志。`,
      answers: {
        mid: `三者都是<strong>分层架构</strong>，核心思路相同：<strong>依赖倒置</strong>+ <strong>业务核心独立</strong>，外部依赖（DB / framework / UI）通过端口/适配器接入。视觉上：Hexagonal 是核心 + 端口；Onion 是同心圆多层；Clean 是 4 层 + 明确 Dependency Rule。`,
        senior: `<strong>本质相同</strong>——都是 Alistair Cockburn 2005 年 Hexagonal 思想的不同表达。区别只在视觉化方式和层数：Hexagonal 强调 ports & adapters；Onion 强调多层洋葱（4-5 层）；Clean 强调"<strong>依赖只能向内</strong>"的 Dependency Rule。<strong>面试时讲清"本质相同"就能加分</strong>，能区分初级（一个个介绍）和资深（一句话总结）。`,
        staff: `深一层：三者都试图解决"<strong>业务逻辑被框架/技术污染</strong>"的问题。Cockburn 2005 提 Hexagonal，Palermo 2008 提 Onion 简化它，Uncle Bob 2012 加 4 层 + Dependency Rule 让它更规范化。<strong>真实落地比理论争论更重要</strong>：我在 platform agent 项目里用了一个简化版 Hexagonal——domain 层只依赖 std::*，infra 层（schema parser / SNMP / Kafka）通过纯虚接口注入，业务测试零外部依赖（mock 接口即可），单测从 12 min 降到 28s。<strong>陷阱</strong>：项目小（&lt;10 人）时分层带来的样板代码可能超过收益，可以从两层（domain + infra）起步。`,
      },
      failure_modes: [
        `把三者当三种独立的"流派"讨论（不知道本质相同）`,
        `照搬 Clean Architecture 4 层到小项目，引入大量样板代码`,
        `Domain 层引用 framework 类（如 Spring annotation），违反 Dependency Rule`,
        `加了一堆 interface 但实际上只有一个实现，徒增复杂度（YAGNI）`,
      ],
      follow_ups: [
        { q: `Dependency Rule 具体怎么强制？`, hint: `① 代码规范 + code review；② 模块化构建（Gradle / CMake / Conan 子模块禁向外依赖）；③ ArchUnit / pyverdep 静态分析 + Fitness Function CI 拦截` },
        { q: `Domain 层能不能依赖第三方库（如 boost）？`, hint: `通常允许"基础工具库"（std / boost / 数学库），但禁"IO/网络/DB 相关"——核心标准：换底层不影响 domain` },
        { q: `小项目要不要用这些架构？`, hint: `< 5 人或 &lt; 6 个月生命周期的项目，2 层（domain + infra）通常够；&gt; 10 人或长周期项目，再升级到 3-4 层` },
      ],
    },

    7: {
      why_asked: `验证候选人能不能抵御"微服务时髦"诱惑，识别"为了拆而拆"的反模式。这道题是区分"跟风派"和"务实派"的经典。`,
      answers: {
        mid: `三个常见信号：① 团队 &gt; 50 人，多团队并行开发互相阻塞；② 不同模块扩展需求差异巨大（如读多写少 vs 写多读少）；③ 不同模块发布节奏差异大（核心模块季度发，营销模块每周发）。`,
        senior: `Fowler 的 <strong>"Monolith First"</strong>：先写单体，撑不住再拆。<strong>30 人以下团队上微服务通常是过度设计</strong>——分布式带来的复杂度（一致性、监控、部署、追踪）需要专门团队维护。判断"撑不住"的信号：构建时间 &gt; 30 min / 启动时间 &gt; 1 min / 一次部署影响所有模块 / 团队互相 block。`,
        staff: `深层判断：用 <strong>Conway's Law</strong>——软件结构映射组织结构。如果组织还没分成多个"两披萨团队"，强行拆微服务会让"康威逆变换"反咬团队（一个 service 由 N 个团队共同维护，PR 协调成本爆炸）。我观察过的失败案例：30 人团队拆成 12 个 micro-services，结果 80% 的特性需要改 3+ 服务，发布周期反而从 monolith 时代的 1 周变成 3 周。<strong>真正适合微服务的场景</strong>：① 大型 SaaS（Netflix、Uber 级）；② 不同模块 QoS 差异极大（如电商的"支付"vs"商品搜索"）；③ 多语言/多技术栈强需求；④ 频繁独立扩缩容。否则用<strong>模块化 monolith</strong>（Modular Monolith）+ 按需提服务。`,
      },
      failure_modes: [
        `跟风拆服务，不考虑团队规模和组织结构`,
        `拆了 N 个服务但共享同一个 DB（伪微服务，最差实践）`,
        `按"技术维度"拆（user-service / order-service），而不是"业务能力"拆（账户管理 / 订单履约）`,
        `忽略分布式带来的运维负担（监控、追踪、CI/CD、文档、API 兼容）`,
        `没有 SLO 就拆服务——拆完发现某服务挂了不知道是谁的责任`,
      ],
      follow_ups: [
        { q: `Modular Monolith 是什么？`, hint: `单部署单元但内部强模块化（清晰边界、独立 DB schema、模块间用 in-process API）。可以平滑演进到微服务` },
        { q: `什么时候从 monolith 演进到 microservices？`, hint: `Strangler Fig 模式：先建 Facade 拦截，逐个把模块切到新服务，老 monolith 慢慢死掉。设 decommission deadline` },
        { q: `微服务的最小可行规模？`, hint: `单服务团队 4-8 人 / 单服务代码量 &gt; 50K LOC / 有独立的 SLO + on-call。低于这个就该问"为啥不在 monolith 里做模块"` },
      ],
    },

    8: {
      why_asked: `验证候选人是否真在项目里写过 ADR——而不是只听说过。能讲清"为什么 ADR Accepted 后永不删"的人通常负责过架构治理。`,
      answers: {
        mid: `ADR (Architecture Decision Record) 三段核心：<strong>Context</strong>（背景和约束，为什么要做决策）+ <strong>Decision</strong>（决定做什么）+ <strong>Consequences</strong>（这个决定带来的正负面后果）。`,
        senior: `三段是底线，完整 ADR 通常 6-8 段：<strong>Title / Status / Date / Context / Decision / Consequences / Alternatives Considered / References</strong>。<strong>关键规则</strong>：① ADR 一旦 Accepted <strong>永不删除</strong>——历史是资产，未来修改决策时要看演化路径；② 改变决策不修改老 ADR，而是写新 ADR 标记 "Supersedes ADR-XXX" 和 "Superseded by ADR-YYY"。`,
        staff: `ADR 是 Michael Nygard 2011 年提的，现在是 Thoughtworks Tech Radar 长期推荐。<strong>真实工具链</strong>：① 用 adr-tools CLI（npm 包）一键生成模板；② 放在 repo 里 docs/adr/ 目录，跟代码一起 PR review；③ 大型项目用 Structurizr / Confluence + ADR 模板。<strong>我的电信项目经验</strong>：6 人小团队 2 年累积 23 条 ADR，最有价值的不是"现在用什么"而是"<strong>当年为什么没选 X</strong>"——新人入职 1 周内读完所有 ADR，能省 3 个月"为什么要这样"的解释成本。<strong>反模式</strong>：ADR 写得像产品说明书（讲做了什么，不讲为什么）。`,
      },
      failure_modes: [
        `Context 段不写约束和真实备选，只讲"我们决定..."（看不出决策的不可避免性）`,
        `Consequences 段只列好处不列代价（其实负面后果才是别人最想看的）`,
        `决策变了直接改老 ADR（丢了历史价值；正确做法是写新 ADR + 标记 Supersedes）`,
        `ADR 长篇大论（&gt; 2 页通常没人读；目标是 1 页内说清）`,
        `没有 status field（不知道这条 ADR 是 Proposed / Accepted / Deprecated / Superseded）`,
      ],
      follow_ups: [
        { q: `ADR 跟 RFC 的区别？`, hint: `RFC 是讨论中的提案（focus on 沟通）；ADR 是决策的归档（focus on 记录）。RFC 讨论完通常会归档成 ADR` },
        { q: `怎么让团队真的写 ADR？`, hint: `① 模板化（5 分钟写完）；② PR 检查（涉及架构改动必须有 ADR）；③ Onboarding 必读；④ 季度 ADR review 修正过期决策` },
        { q: `多团队共享 ADR 怎么管？`, hint: `分级：org-wide ADR（统一存放）/ team ADR（团队内部）/ component ADR（紧贴代码）。命名约定如 ORG-001、TEAM-001 区分` },
      ],
    },

    9: {
      why_asked: `验证候选人是否懂"用机器守护架构"的工程化思维。能给出可执行 Fitness Function 的人，通常能避免"架构越改越烂"的腐化问题。`,
      answers: {
        mid: `Fitness Function 是把架构原则<strong>写成自动化测试 / CI 检查</strong>，让机器持续验证架构没被违反。例：CI 里 grep 检查 domain 层有没有意外引用 infra 层。`,
        senior: `Neal Ford《Building Evolutionary Architectures》提的概念。分类：① <strong>原子的 vs holistic</strong>（单点 vs 跨模块）；② <strong>触发式 vs 持续</strong>（PR 时跑 vs 生产持续监控）；③ <strong>静态 vs 动态</strong>（编译期 vs 运行期）。<strong>核心理念</strong>：人会忘记，工具不会——让架构纲领可被自动验证。`,
        staff: `常见的 fitness function 模式：① <strong>架构依赖检查</strong>（ArchUnit / pyverdep / depcheck，禁止 domain → infra）；② <strong>性能基线</strong>（k6 压测在 CI 跑，P99 退化 &gt; 10% 失败）；③ <strong>API 兼容</strong>（buf breaking 检测 protobuf 破坏性改动）；④ <strong>安全合规</strong>（trivy / snyk 扫依赖漏洞）；⑤ <strong>代码质量</strong>（cyclomatic complexity / test coverage 不许下降）。<strong>真实案例</strong>：在 platform agent 项目我加了 6 个 fitness function 后，半年内拦下了 11 次"图省事"的架构违规 PR（如 domain 直接 include &lt;curl/curl.h&gt;）。<strong>关键</strong>：fitness function 失败的 PR 必须有 reviewer 审批 override，否则会被绕过。`,
      },
      failure_modes: [
        `架构纲领只写在 wiki 上，没自动化 → 人会忘 → 半年后就被违反`,
        `Fitness function 太严苛，所有 PR 都失败 → 团队学会"加 // skip 注释"绕过`,
        `只在 main 分支 schedule run，PR 时不跑 → 已经合入了才发现违规`,
        `没有"override"机制 → 紧急修复时 fitness function 反而成为路障`,
        `fitness function 自己没单测，跑出来的"违规"其实是 false positive`,
      ],
      follow_ups: [
        { q: `怎么平衡 Fitness Function 的严格度和 dev 体验？`, hint: `Severity 分级：① 红线（不能 override，如 SQL 注入扫描）；② 警告（reviewer 显式批准 override）；③ 报告（只统计趋势不阻断）` },
        { q: `C++ 项目可以用什么工具？`, hint: `① clang-tidy 自定义 check；② IWYU + include-what-you-use；③ 自己写 grep / AST 脚本；④ Sonar / Coverity 跑架构规则；⑤ ABI checker（abi-compliance-checker） ` },
        { q: `Fitness Function 跟 unit test 有什么不同？`, hint: `Unit test 验证"行为正确"；Fitness Function 验证"架构属性"（如分层 / 性能 / 安全 / ABI 稳定）` },
      ],
    },

    10: {
      why_asked: `验证候选人是否真做过遗留系统的迁移——而不是只在白板上"重写就好了"。能讲清 decommission deadline 的人是经历过失败 Strangler 项目的。`,
      answers: {
        mid: `Strangler Fig（Fowler 命名，源自澳洲一种 strangler 榕——慢慢长在老树上最终把老树替换掉）。<strong>渐进式替换</strong>遗留系统的标准模式：① 建 Facade 拦截所有调用；② 用 Feature Flag 控制流量到新/旧实现；③ 影子流量对账；④ 灰度切流；⑤ <strong>必须设 decommission deadline</strong>，到期删旧代码。`,
        senior: `核心是<strong>降低重写风险</strong>——业内 90% 的"大重写"项目失败（Joel Spolsky "Things You Should Never Do, Part I"）。Strangler 让新旧系统并存，每次切一小块，可随时回滚。<strong>关键陷阱</strong>：不设 deadline 的 Strangler 是双倍维护负担——所有失败的 Strangler 案例都是因为新老系统永远共存了 3+ 年。`,
        staff: `落地工具链：① Facade 层用 nginx / envoy / API gateway；② Feature flag 用 LaunchDarkly / Unleash / 自建；③ 影子流量用 Diffy（Twitter 开源）/ goreplay 录制 + 重放；④ 切流用 weighted routing 5% → 25% → 50% → 100%；⑤ deadline 用 calendar 提醒 + 季度复盘。<strong>真实案例</strong>：在电信网管系统替换老 platform agent 时用了 Strangler，6 个月切流完成，第 7 个月按 deadline 删了 47K LOC 老代码——如果不删，运维要永远维护两套监控/告警/部署脚本。<strong>反例</strong>：见过一个 ERP 项目"strangling" 6 年还没死，新老系统同时活着，bug 修复要 PR 两遍，最后老板砍掉新项目。`,
      },
      failure_modes: [
        `<strong>不设 decommission deadline</strong>——所有失败 Strangler 的根本原因`,
        `Facade 层做得太厚（自带业务逻辑），变成"第三个系统"`,
        `没有影子流量对账机制，直接切流→线上事故`,
        `切流粒度太大（一次 100%），出问题不可控`,
        `老系统持续在新增功能（"反正还没死"心态），永远赶不上`,
      ],
      follow_ups: [
        { q: `影子流量对账怎么实现？`, hint: `复制请求同时打到新旧系统，比对响应 → 差异打到 Kafka → 人工 / 规则审计；工具：Diffy / goreplay / 自建 sidecar` },
        { q: `Strangler vs 大重写 vs 原地重构 怎么选？`, hint: `大重写：极端情况（技术栈已死、必须迁移）；原地重构：80% 场景；Strangler：跨技术栈迁移、要兼容老 API 的场景` },
        { q: `怎么向产品/老板申请 decommission 时间？`, hint: `量化老系统的"持续成本"（每月 N 人天维护 + M% bug 比例 + L 安全风险），算出 ROI；deadline 写进 ADR 让团队都签字` },
      ],
    },

    // #11 (BC vs 微服务) 已在 D1 填好，跳过

    // ============== DDD / 模式 ==============
    12: {
      why_asked: `验证候选人是否真用 DDD 战术模式做过设计。Aggregate 设计错（特别是"太大"）是 DDD 项目失败最常见的原因——能讲清 5 条规则的人通常踩过坑。`,
      answers: {
        mid: `Aggregate 设计 5 条规则：① 根（Aggregate Root）是唯一入口，外部不能直接访问内部 entity；② 一个事务只改一个 Aggregate（跨 Aggregate 用 Domain Event）；③ 跨 Aggregate 只引用 ID，不引用对象；④ Aggregate 要<strong>小</strong>（能一次性 load + save）；⑤ 最终一致性优于强一致性。`,
        senior: `5 条规则的本质是<strong>事务一致性边界 = Aggregate 边界</strong>。Aggregate 内强一致，Aggregate 间最终一致。<strong>大 Aggregate 是新人最常犯的错</strong>——加载一个 Aggregate 把整张表 load 进来，并发改的时候锁竞争爆炸。Evans 原话：好的 Aggregate 设计能"恰好"装在一个 transaction 里。`,
        staff: `深一层：Aggregate 实际是 DDD 的 <strong>concurrency boundary</strong>——你能想象用 optimistic lock 保护它（版本号 + retry）。如果 Aggregate 太大，optimistic lock 失败率超过 5%，性能崩盘。<strong>判断 Aggregate 大小</strong>的实用方法：问"<strong>一个 use case 完成时，哪些数据必须同时一致</strong>"——这些就是一个 Aggregate；其他都是相邻 Aggregate。<strong>真实案例</strong>：我做电商订单系统时最初把 "订单 + 订单项 + 物流 + 支付" 全放一个 Aggregate，并发改报错率 30%；按 use case 切分后变成 "Order"（订单 + 订单项）+ "Shipment"（物流，引用 OrderId）+ "Payment"（支付，引用 OrderId）三个 Aggregate，错误率降到 0.5%。`,
      },
      failure_modes: [
        `<strong>大 Aggregate</strong>（一个 Aggregate 几十个 entity，load 时几 MB 数据）——典型 DDD 反模式`,
        `跨 Aggregate 直接持引用对象（不是 ID）→ 加载链条爆炸 + lazy load 异常`,
        `一个事务改多个 Aggregate（违反规则 2）→ 分布式事务 / 长事务问题`,
        `Aggregate 内部 entity 暴露给外部（违反规则 1）→ 业务规则绕过聚合根验证`,
        `想用 Aggregate 包"读视图"（其实读应该用 CQRS 的 Read Model，Aggregate 是写模型）`,
      ],
      follow_ups: [
        { q: `Aggregate 之间怎么协作？`, hint: `Domain Event：A 提交后发事件，B 异步消费；用 Outbox 模式保证事件不丢；最终一致` },
        { q: `Aggregate 内的 entity 太多怎么办？`, hint: `按业务边界进一步拆分 Aggregate；或者把 entity 改成 Value Object（不可变）减少状态` },
        { q: `Aggregate Root 应该 expose 什么 API？`, hint: `① 业务方法（如 placeOrder()），不暴露 setter；② 只读 query（getOrderItems() 返回 immutable view）；③ 内部 entity 不能直接 expose` },
      ],
    },

    13: {
      why_asked: `区分"会用 DDD 战术模式的资深"和"只会画 UML 的初级"。Value Object 是减少 bug 最有力的工具之一——金额、坐标、ID 用 VO 而不是 primitive 能消除一类常见错误。`,
      answers: {
        mid: `<strong>Value Object</strong>（VO）：用<strong>值</strong>区分（两个相同属性的对象 = 同一个），<strong>不可变</strong>，<strong>没有身份</strong>。例：Money(100, USD)、Coordinate(lat, lng)、Email("a@b.com")。<br><strong>Entity</strong>：用 <strong>ID</strong> 区分（两个同名的人是不同的人），<strong>有可变状态</strong>，<strong>ID 不变</strong>。例：User、Order、Product。`,
        senior: `<strong>Entity 只用 ID 判等</strong>（equals 只看 ID），不能用属性比较；VO 用<strong>所有字段</strong>比较。这条决定了你怎么写 hashCode 和 equals。<strong>实用判断</strong>：问"两个对象同属性时是同一个吗"——是 → VO；不是 → Entity。`,
        staff: `深层理解：VO 是<strong>消除 Primitive Obsession 反模式</strong>的核心工具——把 string / int / float 包装成有领域语义的类型。<strong>三大收益</strong>：① 类型安全（金额不能加坐标，编译期就拦下）；② 业务规则封装在构造函数里（Email 构造时验证格式）；③ 不可变 + thread-safe（多线程共享无锁）。<strong>真实案例</strong>：platform agent 项目最初用 std::string 当 NodeId 到处传，三个月后追查一个 bug 发现两个不同语义的 string 被错误地比较；引入 NodeId VO（class NodeId { std::string v; explicit NodeId(std::string); }）后，类型系统直接拦下错误，重构后修了 5 个类似 bug。<strong>C++ 落地</strong>：用 explicit 构造 + delete 默认拷贝 / 用 strong_typedef 库（如 Folly TypedIdentifier）。`,
      },
      failure_modes: [
        `用属性 hash/equal Entity（导致 set 里有"重复"对象但其实 ID 不同）`,
        `VO 设计成可变（违反 immutability，会产生别名 bug）`,
        `所有东西都建 Entity（应该是 VO 的也建 Entity，浪费 ID 字段 + 复杂化）`,
        `Email/Money/Coordinate 用 primitive（string / float）——Primitive Obsession 反模式`,
        `VO 的 hashCode 漏字段（两个对象 equals 但 hashCode 不同，set/map 行为异常）`,
      ],
      follow_ups: [
        { q: `Money 用 float 还是 BigDecimal？`, hint: `永远不用 float（浮点精度问题，1.1 + 2.2 ≠ 3.3）；Java/C# 用 BigDecimal，C++ 用 fixed-point（int64 + scale）或专用库（boost::multiprecision）` },
        { q: `VO 太多导致样板代码爆炸怎么办？`, hint: `① C++ 用 strong_typedef 库 / record；② Java 用 Lombok @Value 或 Java 14 record；③ TS 用 brand types；④ Rust 用 newtype pattern` },
        { q: `Entity 跨服务怎么同步状态？`, hint: `跨 BC 不直接同步 Entity（违反 DDD）；用 Event Carried State Transfer 或 Reference + lazy load via API` },
      ],
    },

    14: {
      why_asked: `验证候选人是否处理过遗留 / 第三方系统集成。Anti-Corruption Layer 是 DDD 战略模式里最实用也最被低估的一个——能给具体场景的人通常做过"对接 ERP / SAP / 老系统"的脏活。`,
      answers: {
        mid: `防腐层（Anti-Corruption Layer, ACL）：对接<strong>糟糕的外部系统</strong>（遗留系统、第三方 API、混乱的供应商）时，建一层<strong>翻译层</strong>，把外部模型翻译成自己的领域模型。目的：不让外部混乱概念污染核心域。`,
        senior: `ACL 是 Evans DDD 的 Context Map 7 种模式之一。<strong>什么时候用</strong>：① 对接遗留系统（如 mainframe / SAP）；② 第三方 API 命名混乱（一个字段叫 KUNNR、另一个叫 CustNbr）；③ 外部 schema 频繁变（每季度大改）；④ 政治原因没法改对方接口。ACL 让你的核心域<strong>对外部变化免疫</strong>——外部改 schema 只动 ACL 层翻译逻辑。`,
        staff: `ACL 实现模式：① Adapter（封装外部 API）；② Translator（schema 转换）；③ Service Facade（聚合多个外部调用）。<strong>真实案例</strong>：在电信项目里对接老 OSS（Operations Support System），它的 "device" 概念混合了"物理设备 + 服务实例 + 配置版本"三个我们核心域里分开的概念。我们建了一个 ACL（osc_adapter），里面有 OssDevice → (Device, ServiceInstance, ConfigVersion) 的拆解逻辑，核心域里完全看不到 OssDevice 这个东西。后来 OSS 厂商升级 API 三次，我们核心域代码零修改，只动 ACL。<strong>反模式</strong>：① ACL 做得太薄（只转字段不转语义）；② ACL 把所有外部字段都翻译过来（应该只翻"核心域需要的"）；③ ACL 反向污染（让 ACL 的概念漏到核心域）。`,
      },
      failure_modes: [
        `没建 ACL，外部 schema 字段直接渗透到核心域（如核心域出现 KUNNR、MATNR 这种 SAP 字段名）`,
        `ACL 做得过厚（带业务逻辑），变成第三个系统`,
        `ACL 内部直接复用外部模型 class（应该单独 mapping）`,
        `外部 API 改了字段直接改核心域（白建 ACL）`,
        `ACL 写得很机械（一对一翻译），失去"翻译语义"的价值`,
      ],
      follow_ups: [
        { q: `ACL 跟 Adapter Pattern 关系？`, hint: `Adapter 是 GoF 设计模式（单点接口翻译）；ACL 是战略模式（整个外部上下文的隔离层），通常包含多个 Adapter + Translator + Facade` },
        { q: `Microservices 架构下 ACL 放哪里？`, hint: `每个 service 自带 ACL（在 service 内部的 infra 层）；不要建一个"统一 ACL service"——会变成 Schemata 单点` },
        { q: `怎么判断要不要建 ACL（而不是直接消费外部 API）？`, hint: `三个信号：① 外部 schema 我们没控制权；② 外部概念跟我们核心域不匹配；③ 外部 schema 会变。三个都满足必建 ACL` },
      ],
    },

    15: {
      why_asked: `验证候选人是否真做过分布式事务。Outbox 是<strong>解决"业务写 + 消息发"原子性</strong>最常用的模式——能讲清"为什么不能直接发"的人通常踩过这个坑。`,
      answers: {
        mid: `Outbox 模式解决：业务操作 + 事件发布的<strong>原子性</strong>。业务先写 DB 再发消息，如果消息发送失败 → 数据不一致；如果先发消息再写 DB，DB 写失败 → 消息已发但状态没改。`,
        senior: `Outbox 做法：在<strong>同一事务</strong>把"业务数据"和"待发事件"都写到本地 DB（Outbox 表）。后台 poller 或 CDC（如 Debezium）异步从 Outbox 表读事件，发到消息队列，发成功后标记或删除。<strong>关键</strong>：业务事务只依赖本地 DB（强一致），消息发布走异步重试（最终一致）。`,
        staff: `Outbox 是 Chris Richardson 在 microservices.io 总结的标准模式，<strong>事实标准</strong>。深一层：Outbox 解决的是 <strong>dual write 问题</strong>（同时写 DB 和 MQ 不能原子）；与之相对的是 <strong>Inbox 模式</strong>（消费端去重）。<strong>实现要点</strong>：① outbox 表带 status / created_at / retry_count；② 用 CDC（Debezium 监听 binlog）比 poller 性能好 10x；③ 消费方必须幂等（用 message_id 去重）；④ 设 max_retry + DLQ。<strong>真实案例</strong>：platform agent 项目里"配置变更后通知下游"用 Outbox + Debezium 实现，2 年内零事件丢失，对比之前直接发 Kafka 的版本（月均 3 次"业务成功但消息没发"事故）。<strong>陷阱</strong>：Outbox 表会变大，要定期清理已发送的（保留 30 天审计）。`,
      },
      failure_modes: [
        `业务和消息发送在同一个 try-catch 里"伪原子"（消息发了但事务 rollback、或事务 commit 了消息没发）`,
        `Outbox 表不清理 → 增长无限 → 查询变慢`,
        `消费方不幂等 → 重试导致重复处理`,
        `用 poller 但 batch 太小 → 吞吐不够；太大 → 延迟高`,
        `没有 DLQ → 死消息卡住整个 Outbox`,
      ],
      follow_ups: [
        { q: `Outbox vs 2PC vs Saga 怎么选？`, hint: `Outbox：单 service 内业务+事件原子；2PC：跨多个资源强一致（性能差，不推荐微服务）；Saga：跨多个 service 的业务编排（最终一致）` },
        { q: `CDC 实现 Outbox 怎么落地？`, hint: `Debezium 监听 outbox 表的 INSERT → 转成 Kafka 事件 → 路由到对应 topic；Debezium 本身保证 at-least-once + 幂等` },
        { q: `Outbox 表 schema 推荐怎么设计？`, hint: `id PK / aggregate_type / aggregate_id / event_type / payload (JSON) / created_at / sent_at NULL / retry_count / status enum` },
      ],
    },

    16: {
      why_asked: `验证候选人能否抵御"DDD 都要上 ES 和 CQRS"的过度推荐。能讲清"两者可分开用、组合复杂度极高"的人是真做过 ES 项目。`,
      answers: {
        mid: `<strong>不必</strong>。CQRS（Command Query Responsibility Segregation）= 读写模型分离，可以单独用（写关系库、读 Elasticsearch）。Event Sourcing（ES）= 存事件不存状态，可以单独用（小 Aggregate）。两者经常一起出现是因为<strong>ES 天然有事件流，CQRS 顺势用事件构建读视图</strong>，但不是强绑定。`,
        senior: `两者结合威力大但<strong>复杂度也指数级</strong>：要管 event store、要写 projection 维护读模型、要处理 schema 演进、要解决 eventual consistency。<strong>绝不是 default</strong>，应该问"是否真的需要"。`,
        staff: `Greg Young 的原话："CQRS 是 80% 的项目都用得上的工具，ES 是 5% 的项目才需要的"。<strong>什么时候用 CQRS（不用 ES）</strong>：读写负载差异极大（如电商商品页 100k QPS 读 vs 几百 QPS 写）→ 写 RDB + 读 ES/Cache。<strong>什么时候用 ES（不用 CQRS）</strong>：小 Aggregate + 强审计要求（如金融账户、医疗记录）→ 事件流就是历史。<strong>什么时候两者结合</strong>：复杂业务 + 多种读视图 + 强审计 → 但只有 5% 的项目真的需要。<strong>反例</strong>：见过创业团队 6 人上 ES+CQRS，半年陷在 projection 重建 / 事件 schema 演进 / Aggregate 边界调整的泥潭里，原本 2 周能上的功能拖了 3 个月。<strong>建议</strong>：先 CQRS 把读写分开（轻量级），等业务真的需要"完整历史"再上 ES。`,
      },
      failure_modes: [
        `因为流行就上 ES+CQRS（追新技术），不评估业务实际需求`,
        `所有 Aggregate 都用 ES（应该只用在小 Aggregate + 强审计场景）`,
        `Projection 没考虑重建机制（schema 变了要 rebuild 几小时甚至几天）`,
        `事件 schema 不版本化 → 历史事件没法演进`,
        `读模型不一致告警机制缺失 → projection lag 几小时没人发现`,
      ],
      follow_ups: [
        { q: `ES 的事件版本怎么演进？`, hint: `① Weak schema（事件用 JSON，加字段不破坏）；② Versioned events（V1 / V2 类型）；③ Upcasting（读旧事件时实时升级到新版本）；选 ② + ③ 组合最常见` },
        { q: `CQRS 的最终一致延迟怎么处理？`, hint: `① 写后立即查走"我自己的写"路径（read-after-write consistency）；② UI 显示 "刚提交，处理中..." 占位；③ WebSocket 推 projection 更新通知` },
        { q: `什么场景一定不要用 ES？`, hint: `① 大 Aggregate（事件爆炸）；② 频繁删除（GDPR right to forget 难实现）；③ 简单 CRUD 业务（小题大做）` },
      ],
    },

    17: {
      why_asked: `验证候选人是否真用 Event Storming 跟业务方做过 workshop（而不是只听说过）。能区分三种粒度的人是带过 facilitator 角色的。`,
      answers: {
        mid: `Event Storming 由 Alberto Brandolini 提出，三种粒度递进：<strong>Big Picture</strong>（业务全景，2-4h，发现 BC 边界）→ <strong>Process Level</strong>（聚焦一个业务流程，1 天，Command-Event-Policy 链）→ <strong>Design Level</strong>（聚焦一个 Aggregate，0.5-1 天，发现不变量和边界）。`,
        senior: `每种粒度对应不同决策：Big Picture 给战略架构师定 BC 边界；Process Level 给团队 lead 定流程契约；Design Level 给开发定 Aggregate 设计。<strong>每种都用便利贴 + 大白纸 + 物理空间</strong>（远程团队用 Miro / Mural），核心是<strong>让业务方和开发面对面碰撞</strong>。`,
        staff: `<strong>核心价值不在产出物，在"对齐过程"</strong>——往往一次 Big Picture workshop 能让 PM / Dev / Sales 三方第一次发现"我们说的'客户'其实是三个不同的实体"。<strong>关键产出</strong>：红色 sticky（hotspot）—— 团队对业务理解不一致的点。<strong>红色 sticky 才是最有价值的</strong>，比所有事件链都重要。<strong>真实经验</strong>：在大型企业客户客户那做了一次 Big Picture（10 人，4h），识别出 23 个红色 hotspot，其中 5 个是 PM 都不知道的业务规则模糊点；后续 sprint 0 阶段先解决 hotspot，避免了开发到一半发现"PRD 不一致"。<strong>注意</strong>：facilitator 不能是开发——会引导成"实现方案讨论"；最好是中立的 BA / 产品 lead。`,
      },
      failure_modes: [
        `没有业务方在场（只有 dev 自己玩，等于设计研讨会，失去价值）`,
        `Big Picture 直接跳到 Design Level（没建立全景共识就抠细节）`,
        `Facilitator 是 dev，引导成"我们怎么实现"讨论（应该聚焦"业务发生了什么"）`,
        `没产出 hotspot（红色 sticky 太少 = 要么大家其实在装懂，要么 facilitator 不够 push）`,
        `产出物只放在白板上，没数字化沉淀 → 一周后失效`,
      ],
      follow_ups: [
        { q: `Event Storming 跟 User Story Mapping / Domain Storytelling 关系？`, hint: `User Story Mapping 聚焦用户旅程 / Event Storming 聚焦业务事件流 / Domain Storytelling 用画板讲故事。三者互补不替代` },
        { q: `远程团队怎么做 Event Storming？`, hint: `Miro / Mural 工具 + Zoom 视频 + 每 30 min 强制休息（远程注意力短）+ facilitator 角色更重要（控制节奏）` },
        { q: `Workshop 后产出怎么沉淀？`, hint: `① 拍照存档；② 数字化到 Miro（永久 link 放 wiki）；③ hotspot 转成 sprint 0 的 spike task；④ 关键事件链转成 ADR 候选` },
      ],
    },

    18: {
      why_asked: `验证候选人能否做"投入 vs 自研"的战略性决策。能用 Domain 三分指导投入决策的人通常带过技术战略制定。`,
      answers: {
        mid: `Domain 三分：<strong>Core</strong>（核心域，公司竞争力所在）/ <strong>Supporting</strong>（支撑域，业务需要但不是差异化）/ <strong>Generic</strong>（通用域，任何公司都需要，如认证 / 邮件）。`,
        senior: `三分对应资源投入策略：<strong>Core → 自研 + 最强工程师 + 长期投入</strong>；<strong>Supporting → 简化自研 / 配置式 / 外包</strong>；<strong>Generic → 买现成的</strong>（Auth0 / SendGrid / Stripe），不要自己写。这是 DDD 战略模式里"<strong>分配人才</strong>"的核心指南。`,
        staff: `深一层：三分的判断不是技术属性而是<strong>商业属性</strong>——同一个"用户认证"在身份认证公司是 Core，在电商是 Generic。<strong>常见错误</strong>：技术派觉得"我们自己写更可控"，忽略了机会成本——自研 Generic 域=用 Core 域的工程师做不出竞争力的活。<strong>真实案例</strong>：电信网管系统里，"RPC / 配置引擎"是 Core（我们的差异化），"用户认证 / 审计日志"是 Generic（用 Keycloak + ELK），"工单流程"是 Supporting（用低代码工具 Activiti）。<strong>反例</strong>：见过一个 SaaS 团队自研短信网关 + 邮件系统 + 全文搜索（都是 Generic），结果半年后 Core 域的核心算法落后竞品 2 个版本。<strong>实践建议</strong>：每 6 个月做一次"投入审计"——花在 Core / Supporting / Generic 的工程师 ratio 应该接近 60 / 30 / 10。`,
      },
      failure_modes: [
        `把所有自己用的当 Core（混淆"重要"和"差异化"）`,
        `Generic 域自研（如自己写认证 / 短信 / 全文搜索），消耗 Core 域工程师精力`,
        `Core 域用 SaaS（外包了竞争力）`,
        `没有定期 review 三分（业务在变，今天的 Supporting 可能明天变 Core）`,
        `用技术维度判断而非商业维度（如把"性能要求高"自动当 Core）`,
      ],
      follow_ups: [
        { q: `怎么判断一个 domain 是 Core 还是 Supporting？`, hint: `三个问题：① 客户付钱是为了它吗？② 它消失了公司还能赚钱吗？③ 竞品都有同样实现吗？三个都"是" → Generic；都"否" → Core` },
        { q: `Buy vs Build 的成本怎么算？`, hint: `Build 真实成本 = 开发成本 + 3-5 倍维护成本（5 年）+ 机会成本（同样工程师做 Core）；Buy 成本 = 订阅费 + 集成成本 + 锁定风险` },
        { q: `Generic 域要不要标准化跨团队选型？`, hint: `要！org-wide ADR 规定"认证用 X、消息用 Y、日志用 Z"，避免每个团队自选导致运维爆炸；保留 escape hatch 给真正特殊场景` },
      ],
    },

    // ============== C++ 工程化 ==============
    19: {
      why_asked: `验证候选人是否真维护过共享库 / .so / .dll。<strong>不能区分 API 和 ABI 是 C++ 资深 vs 中级的分水岭</strong>——能讲清"改私有成员破坏 ABI"的人通常踩过 SO 升级翻车的坑。`,
      answers: {
        mid: `<strong>API</strong>（Application Programming Interface）= 源码层约定（函数签名、类名、宏）。破坏 API → <strong>编译报错</strong>，立刻可知。<br><strong>ABI</strong>（Application Binary Interface）= 二进制层约定（符号 mangling、调用约定、对象内存布局、vtable 顺序）。破坏 ABI → <strong>运行时崩溃 / 静默数据损坏</strong>，最难找。`,
        senior: `<strong>关键洞察</strong>：改类的<strong>私有成员</strong>不破坏 API（外部代码还能编译），但<strong>破坏 ABI</strong>——sizeof(Class) 变了，所有 inline 函数和 vtable 偏移全错。所以共享库升级必须区分两类版本：API 兼容（minor 版本）vs ABI 兼容（major 版本）。Itanium ABI（GCC/Clang Linux 默认）和 MSVC ABI 完全不兼容。`,
        staff: `更深一层：<strong>ABI 兼容的常见破坏方式</strong>：① 加 / 删 / 重排虚函数 → vtable offset 全乱；② 加 / 删 / 改类型 / 重排数据成员 → 对象布局变；③ 改默认参数（在 caller 端编译）；④ inline 函数改实现（旧 caller 用旧实现）；⑤ 改异常 specification（C++17 起 noexcept 是 type 一部分）；⑥ 改 template 默认参数。<strong>真实事故</strong>：电信项目里有一次 patch 升级动态库 libfoo，里面一个 public class 加了个 std::string 成员（pure additive 改动，API 100% 兼容），结果调用方所有 inline 函数访问后续成员时 offset 错了，运行时 5 分钟后段错。后来引入 <strong>libabigail abidiff</strong> 到 CI，类似事故归零。<strong>对策</strong>：① Pimpl 隐藏布局；② 只 expose pure abstract interface；③ 工具自动检测（abi-compliance-checker / abidiff / abi-dumper）。`,
      },
      failure_modes: [
        `改 public class 加私有成员，以为是兼容改动 → ABI 静默破坏`,
        `用 std::string、std::vector 等 STL 类型跨 .so 边界（不同 libstdc++ 版本布局可能不同）`,
        `跨编译器（GCC + MSVC）混用 C++ 库 → name mangling、vtable、异常机制全不一致`,
        `inline 函数定义在 header 里改实现，老调用方还用旧版本（混乱）`,
        `没 ABI 版本号策略，patch 版本悄悄破坏 ABI → 用户升级翻车`,
      ],
      follow_ups: [
        { q: `怎么自动检测 ABI 破坏？`, hint: `① libabigail abidiff（比较两个 .so）；② abi-compliance-checker（生成 HTML 报告）；③ abi-dumper + abi-compliance-checker 流水线；CI 拦截 PR` },
        { q: `Itanium ABI 和 MSVC ABI 区别？`, hint: `name mangling 规则、vtable 布局、异常机制、std::string SSO 大小都不同；跨编译器只能走 C ABI（extern "C"）` },
        { q: `Dual ABI（libstdc++ _GLIBCXX_USE_CXX11_ABI）是什么？`, hint: `GCC 5+ 引入两套 std::string / std::list 实现，由编译标志切换；不同 ABI 编译的 .so 链接时符号不匹配，要确保整条工具链统一` },
      ],
    },

    20: {
      why_asked: `验证候选人是否能在共享库设计中做 ABI 治理。Pimpl 是<strong>跨 .so/.dll 边界的 C++ 库设计事实标准</strong>——能讲清"性能代价 vs ABI 收益"取舍的人才算真懂。`,
      answers: {
        mid: `Pimpl (Pointer to Implementation, "Cheshire Cat / Compiler Firewall") 模式：把类的真实成员藏到一个 forward-declared 的 Impl 类里，public header 只暴露 <code>std::unique_ptr&lt;Impl&gt; pImpl_</code>。<br>收益：sizeof(PublicClass) 永远 = 8 字节（指针），<strong>Impl 类内部可随意改成员而 ABI 不变</strong>。`,
        senior: `Pimpl 的核心价值是<strong>把"实现细节"从 ABI 边界移走</strong>。<strong>代价</strong>：① 每次方法调用多一层间接（性能损失通常 &lt; 5%）；② 一次堆分配 + 一次释放（构造/析构时）；③ inline 优化失效（caller 看不到 Impl 内部）。<strong>选型规则</strong>：跨 SO / API 库 → 必备；hot path / inline-heavy 性能敏感库 → 慎用，可考虑 SBO（small buffer optimization）变种。`,
        staff: `深一层：Pimpl 解决的是 C++ <strong>compilation firewall</strong> 三大问题——① 改实现不需重编 caller（编译速度）；② 改实现不破坏 ABI（库升级）；③ 头文件 minimal include（减少传染依赖）。<strong>真实案例</strong>：platform agent 项目里 SDK 暴露给上百个客户端，所有 public class 强制 Pimpl，过去 3 年我们重构了 4 次内部数据结构，客户零需要重新链接。<strong>变种</strong>：① <strong>fast Pimpl / SBO Pimpl</strong>（小对象内嵌避免堆分配，如 Eric Niebler 的 propagate_const + std::aligned_storage）；② <strong>Bridge Pattern</strong>（多个 Impl 实现，运行时切换）。<strong>反模式</strong>：所有内部 helper class 都 Pimpl（过度设计；只在 ABI 边界用）。<strong>C++20</strong> 可用 module 部分替代，但跨 .so 边界仍需 Pimpl。`,
      },
      failure_modes: [
        `Impl 类放在 public header 里（违反 Pimpl 初衷 → ABI 还是脆弱）`,
        `用 raw pointer 而不是 unique_ptr → 内存泄漏 + 拷贝/move 语义错乱`,
        `unique_ptr&lt;Impl&gt; 在 public header 里析构（Impl incomplete type → 编译错或析构 UB）→ 析构函数必须在 .cpp 里 = default`,
        `所有 class 都 Pimpl（过度设计；只在 ABI 边界用，内部 helper 不用）`,
        `Pimpl 拷贝构造没正确实现（默认 shallow copy → 双 free）`,
      ],
      follow_ups: [
        { q: `Pimpl 怎么正确实现拷贝？`, hint: `① 显式定义 copy ctor，深拷贝 Impl；② 或用 std::experimental::propagate_const 让 const 正确传播；③ 或禁用拷贝只 movable` },
        { q: `Pimpl 性能开销具体多少？`, hint: `典型 micro-benchmark 显示方法调用慢 2-5%（额外一次 indirect load）；构造 / 析构慢 ~50ns（一次堆分配）；hot path 上累积可能可见，cold path 完全可忽略` },
        { q: `Pimpl 怎么和 inline namespace / version 管理结合？`, hint: `pimpl 隐藏内部布局 + inline namespace 版本化 public API（如 v1::Foo / v2::Foo 共存）→ 客户端编译时自动锁版本；详见 Itanium ABI inline namespace 规范` },
      ],
    },

    21: {
      why_asked: `验证候选人是否真用 modern CMake 维护过中大型项目。<strong>用错 PUBLIC/PRIVATE/INTERFACE 是 C++ 构建系统最常见的小白错误</strong>——能用一个判断准则解释清楚的人，CMake 内功不错。`,
      answers: {
        mid: `三者控制<strong>"依赖传播"</strong>：<strong>PRIVATE</strong> = 只影响"自己"，消费方看不到；<strong>PUBLIC</strong> = 影响自己 + 传播给消费方；<strong>INTERFACE</strong> = 不影响自己，只传播给消费方（用于纯头文件库 / interface library）。`,
        senior: `<strong>判断准则</strong>：看头文件。如果你的 .h 里 <code>#include "boost/foo.hpp"</code>，那 boost 是 <strong>PUBLIC</strong>（消费方编译时也得能找到 boost）；只在 .cpp 里 <code>#include "spdlog/spdlog.h"</code>，spdlog 是 <strong>PRIVATE</strong>。INTERFACE 用于 header-only 库（你自己没有 .cpp 要编译）。规则适用于 <code>target_link_libraries</code> / <code>target_include_directories</code> / <code>target_compile_definitions</code> / <code>target_compile_options</code>。`,
        staff: `深一层：modern CMake 设计哲学是 <strong>"target-based"</strong>（targets 是 build graph 的一等公民），跟 legacy CMake 的 directory-based 完全不同。<strong>错误使用 PUBLIC 的代价</strong>：所有间接消费方都被迫看到 + 传染整个依赖图；典型表现是项目越长大编译越慢、include path 越来越长、宏污染越来越严重。<strong>真实经验</strong>：在一个 80 万行的 C++ 项目里清理 PUBLIC 滥用，把不必要的 PUBLIC 改成 PRIVATE，全量编译时间从 22 min 降到 13 min（-41%）；secondary effect 是 IDE 索引速度大幅改善。<strong>最佳实践</strong>：默认所有都 PRIVATE，只在确实需要传播时显式 PUBLIC；header-only 库强制 INTERFACE。<strong>工具辅助</strong>：include-what-you-use (IWYU) + cmake-format 自动检查。`,
      },
      failure_modes: [
        `所有依赖都用 PUBLIC（"反正能编译过"，导致依赖传染、编译慢）`,
        `header-only 库用 PRIVATE（消费方拿不到 include path → 编译失败）`,
        `用了 INTERFACE library 还设 PRIVATE include（INTERFACE library 没有 build steps，PRIVATE 无意义）`,
        `legacy CMake 用 <code>include_directories()</code> / <code>link_libraries()</code>（global 污染，不推荐）`,
        `不区分 PUBLIC / INTERFACE，把"传播"和"自己也用"混在一起`,
      ],
      follow_ups: [
        { q: `add_subdirectory vs FetchContent vs find_package 怎么选？`, hint: `find_package：依赖已经安装在系统/Conan/vcpkg；FetchContent：依赖从 Git 拉源码并参与本项目编译；add_subdirectory：本 repo 内的子模块。优先 find_package > FetchContent` },
        { q: `怎么导出自己的 CMake target 给下游用？`, hint: `install(TARGETS ... EXPORT ...) + install(EXPORT ... NAMESPACE ...) + ConfigVersion.cmake + Config.cmake；下游用 find_package(YourLib REQUIRED) + target_link_libraries(... YourLib::YourTarget)` },
        { q: `Generator expressions 是什么？`, hint: `<code>$&lt;CONFIG:Debug&gt;:...</code> 等条件表达式；在 generation 阶段才求值；用于按配置 / 平台 / 编译器选项分支` },
      ],
    },

    22: {
      why_asked: `验证候选人是否做过<strong>跨平台 SDK 设计</strong>。这道题区分"只在 Linux 写过"和"维护过给 Windows 客户用的 C++ SDK"——后者经历过完整的 ABI 痛苦。`,
      answers: {
        mid: `<strong>必须走 C ABI</strong>：<code>extern "C"</code> + 纯 C 函数表 + opaque handle（如 <code>typedef struct Foo* FooHandle;</code>）。原因：GCC 和 MSVC 的 name mangling、vtable 布局、异常机制、std::* 类型完全不兼容。`,
        senior: `<strong>关键陷阱</strong>：<code>extern "C"</code> 只让<strong>符号名</strong>稳定，不能传 C++ 类型（std::string、std::vector 等）——这些类型本身布局不同。所有跨边界的参数必须是 C 类型（int / pointer / 长度 + 数据指针）。返回值如果是字符串，要么调用方传 buffer + size，要么提供 free 函数（避免跨 heap free）。`,
        staff: `<strong>完整设计模式</strong>：<br>1) 公开头文件用纯 C 接口 + opaque handle（隐藏一切 C++ 细节）。<br>2) C++ 实现内部 + extern "C" 入口 catch all 异常（C++ 异常不能跨 C ABI）。<br>3) 跨边界传内存：调用方 alloc / 被调方写入 / 调用方 free；或被调方 alloc + 提供 destroy 函数；<strong>禁止</strong>跨 heap free。<br>4) C++ 调用方可选地用 RAII wrapper 把 C handle 重新包成 C++ 类。<br><br><strong>真实案例</strong>：platform agent SDK 给客户用，最初尝试 C++ ABI 失败（客户 Windows MSVC 用不了我们 GCC 编译的 .so），改成 C ABI 后所有平台都能用：Linux/macOS .so / Windows .dll / Android .so / iOS framework，<strong>同一份 C 头文件，5 种平台都能消费</strong>。<br><br><strong>进阶</strong>：用 <strong>cxx</strong>（Rust 项目）、<strong>SWIG</strong>（多语言绑定）、<strong>nanobind</strong>（Python C++ 绑定）等工具自动生成 C ABI wrapper；Cap'n Proto / FlatBuffers 跨边界传结构化数据。`,
      },
      failure_modes: [
        `直接 expose C++ class（class Foo {...}; expoart）→ MSVC client 完全无法链接`,
        `跨边界传 std::string / std::vector → 不同 STL 实现布局不同 → 段错`,
        `C++ 异常逃逸到 C 调用方 → undefined behavior（通常段错）→ 必须 try/catch 兜底转 error code`,
        `调用方 malloc 被调方 free（跨 heap）→ Windows 上 100% 崩溃；Linux 偶发`,
        `没考虑 calling convention（cdecl / stdcall / fastcall）→ Windows 上栈错乱`,
      ],
      follow_ups: [
        { q: `C 接口怎么传"对象"概念？`, hint: `Opaque handle (typedef struct Foo* FooHandle); 创建用 Foo_create()，销毁用 Foo_destroy(handle)，方法用 Foo_doSomething(handle, args...)` },
        { q: `怎么让 C++ 调用方用得自然？`, hint: `头文件里加可选的 C++ RAII wrapper：<code>#ifdef __cplusplus class FooWrapper { FooHandle h_; ... };</code>；C 调用方看不到，C++ 调用方自动有 RAII` },
        { q: `跨语言绑定怎么生成？`, hint: `① SWIG（多语言，老牌但繁琐）；② cxx / cbindgen（Rust ↔ C++）；③ pybind11 / nanobind（Python）；④ Emscripten（JS/Wasm）；⑤ 手写 + 自动测试` },
      ],
    },

    23: {
      why_asked: `验证候选人是否跟进 C++ 现代特性（C++20 起 Modules 是 ISO 标准）以及是否真懂 #include 模型的痛点。能列出 4 类痛点的人通常调过大型 C++ 项目编译性能。`,
      answers: {
        mid: `Modules 解决 #include 的四大顽疾：① <strong>重复解析</strong>（同头文件被每个 .cpp 解析 N 次）；② <strong>宏污染</strong>（如 windows.h 的 min / max 破坏 std::min）；③ <strong>符号泄漏</strong>（间接 include 让你"意外"可见某些东西）；④ <strong>顺序依赖</strong>（include 顺序错就编译失败）。`,
        senior: `Modules 用<strong>语义导入</strong>（import MyMod;）而非文本替换，编译速度提升 <strong>40-80%</strong>（取决于项目）。<strong>关键差异</strong>：① 编译一次生成 BMI（Binary Module Interface），重复 import 直接复用；② 宏不传播；③ 模块间符号严格隔离。<strong>2026 年生态仍未完全成熟</strong>，大型项目仍以 PCH + IWYU + ccache 为主。`,
        staff: `深层进展：① <strong>编译器支持</strong>：MSVC 2022 完整支持，GCC 14 接近完整，Clang 19 部分支持；② <strong>构建系统</strong>：CMake 3.28+ 原生支持 Modules，Bazel 实验性；③ <strong>标准库</strong>：<code>import std;</code> 在 C++23 标准化，但只有 MSVC 真正实现完整 std module。<strong>真实迁移经验</strong>：在一个 30 万行 C++ 项目里试点 Modules（只迁移 5% 的核心库），首次冷编译没明显变化（BMI 也要生成），<strong>增量编译快 60%</strong>（之前一改 .h 触发 200 个 .cpp 重编，现在只重编那 5 个直接 import 的）。<strong>实践建议</strong>：① 新项目 / 新模块从 day 1 用 Modules；② 老项目混合使用（global module fragment 包装老头文件）；③ <strong>跨 .so 边界仍需 Pimpl</strong>，Modules 不替代 ABI 治理。<strong>陷阱</strong>：① BMI 不跨编译器 / 不跨编译选项；② 调试体验比 #include 略差（部分 debugger 还不支持）；③ 学习曲线对老 C++ 程序员陡。`,
      },
      failure_modes: [
        `以为 Modules 直接替代 Pimpl（不是！Modules 解决编译速度，Pimpl 解决 ABI 稳定）`,
        `把所有头文件都改 Modules（一次性大规模迁移失败率极高，应渐进）`,
        `BMI 文件忘了加到 build cache 清单 → ccache 不命中`,
        `Module 内部不知道什么时候 export → 一切 implicit 导出（违反封装原则）`,
        `Header units（import "foo.h"）和 named modules（import foo;）混用造成混乱`,
      ],
      follow_ups: [
        { q: `Modules 跟 PCH（Precompiled Headers）的区别？`, hint: `PCH = 文本替换 + 缓存（编译器优化），Modules = 真正的语义单元（语言级特性）；PCH 仍有宏污染、不能跨编译单元 reuse，Modules 都解决了` },
        { q: `怎么平滑迁移老项目到 Modules？`, hint: `① 先用 import "old_header.h"（header unit）保持兼容；② 新模块写成 named module；③ 渐进式把 old_header.h 内容拆进 named module；④ CI 监控编译速度` },
        { q: `Modules 跟 Conan / vcpkg 怎么协作？`, hint: `2026 年生态仍在 catch-up，包管理器还在适配；建议用 find_package 拿到 target 后让 CMake 处理 BMI；保留 fallback 到 #include 路径` },
      ],
    },

    24: {
      why_asked: `验证候选人是否写过插件系统 / 动态库加载。这道题问的是<strong>真实生产事故的根源</strong>——RTLD_GLOBAL 用错会导致两个插件静默互相覆盖，bug 难复现。`,
      answers: {
        mid: `<strong>几乎所有场景用 RTLD_LOCAL</strong>。RTLD_GLOBAL 会让插件符号进入全局命名空间，<strong>两个插件定义同名函数时静默互相覆盖</strong>（违反 ODR 但运行时不报错）。`,
        senior: `RTLD_LOCAL（POSIX 默认）：插件符号只在该 .so 内可见，互不干扰，符合 ODR 隔离。RTLD_GLOBAL：插件符号被加入全局符号表，被后续加载的 .so 可见 + 可解析。<strong>正确架构</strong>：主程序 export 一个 PluginContext（包含主程序提供的服务接口），插件通过它访问主程序功能 → 完全不需要 RTLD_GLOBAL。`,
        staff: `深一层：RTLD_GLOBAL 唯一合理场景是<strong>插件之间需要共享符号</strong>（如插件 A 提供工具函数，插件 B 调用）——但这种依赖应该<strong>设计成"插件 A 是普通共享库不是插件"</strong>。<strong>真实事故</strong>：见过一个 Linux 多媒体应用，用 RTLD_GLOBAL 加载所有 codec 插件，结果第三方 codec 插件里有个 <code>extern "C" int decode(int*)</code> 跟主程序某个内部辅助函数同名，<strong>主程序的 decode 被静默替换</strong>，运行时随机崩溃，定位花了 3 周。<strong>对策</strong>：① 默认 RTLD_LOCAL；② 主程序版本符号（symbol versioning，linker script）；③ 插件 ABI 用 C ABI + 严格命名前缀（plugin_xxxx_）；④ 用 dlmopen + 独立 namespace 进一步隔离（glibc 特性）；⑤ 静态分析检查插件没 expose 不该 expose 的符号。<strong>Windows</strong> 上 LoadLibrary 默认就是隔离的（无 GLOBAL 概念），不踩这个坑。`,
      },
      failure_modes: [
        `RTLD_GLOBAL 加载所有插件 → 符号冲突随机崩溃`,
        `插件之间互相依赖（设计错误）→ 升级一个插件可能破坏另一个`,
        `没用 RTLD_NOW（用 RTLD_LAZY）→ 符号缺失不在 dlopen 时报，运行时随机段错`,
        `dlclose 后还持有插件对象指针 → 调用时崩溃（虚函数表已被 unmap）`,
        `没用 dlerror() 拿错误信息，dlopen 失败时只输出 "load failed"`,
      ],
      follow_ups: [
        { q: `dlmopen 是什么？`, hint: `glibc 扩展 dlmopen() 在独立 namespace 里加载 .so，符号完全隔离（比 RTLD_LOCAL 更强）；不同 namespace 里可以有多个版本同名 .so 共存` },
        { q: `怎么让插件能调主程序的函数？`, hint: `主程序提供 PluginContext 结构（含函数指针表）→ 插件 dlopen 时回调 plugin_init(PluginContext*) → 插件保存指针表 → 调用时通过指针调；完全不需 GLOBAL` },
        { q: `Linux symbol versioning 怎么用？`, hint: `linker script (version-script) 定义 LIBFOO_1.0 / LIBFOO_2.0 → 老 caller 链接到 LIBFOO_1.0 符号，新 caller 链接到 2.0，同一个 .so 共存多版本（glibc 自己就用这招）` },
      ],
    },

    25: {
      why_asked: `验证候选人是否真做过 32/64 位 / 跨平台 C++ 移植。<strong>能背出 LLP64 vs LP64 区别的人通常做过 Linux/Windows 双平台维护</strong>。`,
      answers: {
        mid: `<strong>long 的大小不固定</strong>：<br>· Linux 64 位 = <strong>8 字节</strong>（LP64）<br>· Windows 64 位 = <strong>4 字节</strong>（LLP64）<br>· Linux/Windows 32 位 = 4 字节<br>这是 <strong>LLP64 vs LP64</strong> 数据模型差异。`,
        senior: `<strong>LP64</strong>（Linux/Unix/macOS 64-bit）：long 和 pointer 都 64 位，int 仍 32 位。<strong>LLP64</strong>（Windows 64-bit）：只有 long long 和 pointer 是 64 位，long 仍 32 位。<strong>跨平台代码必须用定宽类型</strong>：<code>int8_t / int16_t / int32_t / int64_t / uint*_t</code>（&lt;cstdint&gt;）。任何"我想要 64 位整数"的场景都用 int64_t，永远不用 long。`,
        staff: `深层：还有更多模型——<strong>ILP32</strong>（古老 32 位 Unix，int/long/pointer 都 32）、<strong>IL32LLP64</strong>（Windows 64）、<strong>LP32</strong>（极老的 16 位扩展）、<strong>x32 ABI</strong>（Linux 上 64 位 CPU 跑 32 位 pointer，已废弃）。<strong>真实陷阱</strong>：见过一个跨平台 SDK，序列化协议里用 long 表示时间戳，Linux 写 Windows 读时只读到低 32 位 → 2038 年后时间戳错乱。改成 int64_t 后修复。<strong>其他易踩的跨平台 size 问题</strong>：① <code>size_t</code> 在 32 位是 32 位，64 位是 64 位（跟 pointer 一致）；② <code>time_t</code> 在 Linux glibc 32 位上有 32/64 选择（Y2038 问题）；③ <code>off_t</code> 默认 32 位，要 <code>_FILE_OFFSET_BITS=64</code>；④ char 是否有符号 implementation-defined（x86 通常 signed，ARM 通常 unsigned，影响 char 数组比较）。<strong>实践</strong>：所有公开接口 + 序列化协议 + magic number 都用 &lt;cstdint&gt; 定宽类型，禁用 long / unsigned long。`,
      },
      failure_modes: [
        `用 long 存"大数"（如时间戳、文件大小），Windows 64 上溢出`,
        `用 int 索引 vector / 字符串，size_t 比 int 大时溢出（4GB 数据上崩）`,
        `用 char 数组对比，没考虑 char 有/无符号 → 不同 CPU 行为不同`,
        `跨平台二进制序列化用 long → Linux 写 Windows 读字节数不匹配`,
        `printf 用 %ld 输出 size_t / time_t → 64 位平台上格式不符 warning 或截断`,
      ],
      follow_ups: [
        { q: `printf 跨平台怎么写格式化串？`, hint: `用 PRId64 / PRIu64 / PRIuPTR 等 &lt;inttypes.h&gt; 宏：<code>printf("%" PRId64, my_int64)</code>；C++20 起优先用 std::format` },
        { q: `time_t 跨平台怎么处理？`, hint: `避免直接用，用 std::chrono::system_clock::time_point 或自己定义 int64_t 微秒数；序列化时永远用定宽` },
        { q: `怎么自动检测跨平台数据模型问题？`, hint: `① -Wsign-conversion -Wshorten-64-to-32（GCC/Clang）；② static_assert(sizeof(long) == 8) 在关键路径；③ cppcheck / clang-tidy --checks=portability-* ` },
      ],
    },

    26: {
      why_asked: `验证候选人是否带过<strong>大型 C++ 项目的构建优化</strong>。能给 ROI 排序（不是堆罗列工具）的人通常做过实际的 build pipeline owner。`,
      answers: {
        mid: `按 ROI 排序的优化阶梯：① <strong>Ninja 替代 Make</strong>（30-50% 提速，零代价）→ ② <strong>ccache</strong>（命中时单文件编译省 90%+）→ ③ <strong>sccache</strong>（CI 团队共享缓存）→ ④ <strong>Include 优化</strong>（前向声明 + IWYU 删冗余）→ ⑤ <strong>PCH 预编译头</strong>。`,
        senior: `<strong>首要原则：先 profile 再优化</strong>。用 <code>clang -ftime-trace</code> 生成 JSON，丢到 chrome://tracing 看每个 TU（translation unit）哪段最慢——通常 80% 时间花在 20% 的 include 上（如 boost / 大型模板库）。盲目堆 PCH / 并行不如先看清瓶颈。`,
        staff: `<strong>完整工具链 + 真实数据</strong>：在 80 万行 C++ 项目上做过完整优化，cold build 从 38 min → 9 min：<br>1) Ninja: 38 → 26 min（-32%）<br>2) ccache 启用 + 团队 NFS 共享: warm build 26 → 4 min（-85%）<br>3) IWYU 清掉 23% 不必要 include: 26 → 18 min cold（-30%）<br>4) 把 boost / spdlog 等大模板放进 PCH: 18 → 11 min cold（-39%）<br>5) Modules 试点关键库: 增量 build -60%<br><br><strong>进阶</strong>：① <strong>Distributed build</strong>（distcc / icecream / Bazel remote execution，10x+ 并行）；② <strong>Unity build / jumbo build</strong>（多 .cpp 拼成一个，损失增量速度换 cold speed，Chromium 在用）；③ <strong>Forward declaration 自动化</strong>（include-what-you-use）；④ <strong>LTO / ThinLTO</strong>（link 阶段优化，可能加慢 link 但运行时快）。<strong>反模式</strong>：① 一次性堆所有工具（debug 困难）；② -j N 太大耗光内存 → swap 反而慢；③ 公司禁 ccache（"安全风险"——其实有 readonly mode）。`,
      },
      failure_modes: [
        `堆并行（-j 100）但内存不够 → 大量 swap → 反而更慢`,
        `不 profile 就优化，靠"感觉"加 PCH / 改 include`,
        `ccache 配置错误（hash 不稳定 / 路径变化）→ 命中率 0%`,
        `IWYU 跑完直接接受所有建议 → 破坏 template ADL / SFINAE → 编译失败`,
        `PCH 包含 frequently-changed header → 一改全量重编 → 反效果`,
      ],
      follow_ups: [
        { q: `怎么用 clang -ftime-trace 找瓶颈？`, hint: `每个 .cpp 加 -ftime-trace → 生成 .json → 全部 cat 到 chrome://tracing 打开 → 看 InstantiateFunction / Source 等条目耗时最长的` },
        { q: `Unity build 适合什么场景？`, hint: `① cold build 占大头（CI / clean build 常用）；② 不在乎单文件增量速度的；③ 老 codebase（symbol 冲突少）；不适合 dev local 快速迭代` },
        { q: `Bazel / Buck 比 CMake 强在哪？`, hint: `① 精确的依赖图（每个 target 都声明 deps，不靠 include 推导）；② 远程缓存 + 远程执行；③ hermetic（不依赖系统环境）；代价：迁移成本高、生态没 CMake 完整` },
      ],
    },

    27: {
      why_asked: `承接 #19 ABI 问题，<strong>验证候选人是否真集成过 ABI 检测到 CI</strong>。能给具体工具链的人才是真做过共享库治理。`,
      answers: {
        mid: `两个标准工具：<br>① <strong>abi-compliance-checker</strong>（生成 HTML 报告，差异可视化，易给老板看）<br>② <strong>libabigail 的 abidiff</strong>（直接比较两个 .so，精确程度高，适合 CI）`,
        senior: `<strong>典型 CI 集成</strong>：① 每个 release tag 用 <code>abi-dumper</code> 生成 .abi 描述文件，归档到制品库；② 每个 PR build 完后用 <code>abidiff baseline.abi pr.abi</code> 比对；③ 检测到 break → CI 失败 + 提示开发显式 bump major 版本（语义化版本）；④ 主分支只允许 patch / minor 兼容改动。`,
        staff: `<strong>完整工具链</strong>：<br>1) <strong>abi-dumper</strong>（生成 ABI 描述 XML，需要 debug 符号）<br>2) <strong>abi-compliance-checker</strong>（人类友好 HTML 报告，按 severity 分级）<br>3) <strong>libabigail abidiff / abipkgdiff</strong>（精确的 ABI 差异，适合 RPM/DEB 包级比对）<br>4) <strong>Red Hat 的 ABI sanity check</strong>（发行版用的工业级方案）<br><br><strong>真实落地</strong>：在 platform agent SDK 项目里，我搭了如下 pipeline：<br>① master 每次 release 跑 abi-dumper 存 baseline.abi 到 Artifactory；<br>② 每个 PR 编出 .so 后跑 <code>abidiff baseline.abi pr.so</code>；<br>③ 任何 break 直接 fail build，并在 PR comment 自动留 HTML 报告链接；<br>④ 真的要 break ABI 必须显式在 commit 加 <code>[BREAKING ABI]</code> 标签 + 同步 bump major 版本 + 写 migration ADR。<br><br>过去 18 个月拦了 7 次"无意 ABI 破坏"PR（4 次加私有成员、2 次改虚函数顺序、1 次改 enum 值）。零生产事故。<strong>陷阱</strong>：① abidiff 需要带 debug 符号（-g），release build 要单独跑或保留 symbol；② 模板代码的 ABI 检测精度有限（实例化在 caller 端发生）；③ inline 函数的破坏检测不全（建议结合 ABI 监管 + Pimpl 物理隔离）。`,
      },
      failure_modes: [
        `没有 baseline.abi 归档机制 → 比对无从下手`,
        `检测到 break 就忽略（"反正主分支已经合了"）→ 工具变摆设`,
        `没区分 major / minor / patch 版本策略 → 用户不知道什么时候升级安全`,
        `release build 没带 debug 符号 → abidiff 跑不起来`,
        `只检测 .so 不检测 header（API break 漏掉）→ 还需要配 clang-query 等检测`,
      ],
      follow_ups: [
        { q: `怎么处理"必须 break ABI" 的情况？`, hint: `① 显式 bump major 版本；② 写 ADR 记录原因 + 迁移路径；③ inline namespace 同时保留新旧版本一段时间（Itanium ABI 标准做法）；④ 提前 N 个 release 在 changelog 预告` },
        { q: `Windows 平台怎么做 ABI 检测？`, hint: `① <code>dumpbin /exports</code> 拿导出符号；② <code>llvm-readobj</code> 拿 COFF 信息；③ 商业工具 ABIView；④ 内部脚本对比；生态不如 Linux 成熟` },
        { q: `header-only 库要不要做 ABI 检测？`, hint: `header-only 没有 .so 不存在传统 ABI，但有 "ODR / template 实例化" 一致性问题；用 clang-query / clang-check / static analysis 检测 public class 改动` },
      ],
    },

    // ============== 分布式系统 ==============
    28: {
      why_asked: `验证候选人是否真懂分布式理论根基（不是只背 CAP）。FLP 是 1985 年的"分布式系统不可能定理"——能讲清"它为什么不让 CAP/Raft 完全成立"的人是真读过原 paper。`,
      answers: {
        mid: `<strong>FLP (Fischer-Lynch-Paterson) 不可能定理</strong>：在<strong>异步系统</strong>中，即使只有一个节点可能故障，<strong>也不存在确定性的共识算法</strong>。证明在 1985 年 paper "Impossibility of Distributed Consensus with One Faulty Process"。`,
        senior: `<strong>实践含义</strong>：所有实际共识算法（Raft / Paxos / Multi-Paxos / Zab）都必须在某些条件下牺牲 <strong>liveness</strong>（不会进展）或引入<strong>随机化</strong>（如 Raft 的随机选举超时）。FLP 没说 consensus 不可能，而是说"<strong>纯确定性 + 完全异步 + 容忍故障</strong>三者不可兼得"。实际系统通过 partial synchrony（最终消息会到）+ 超时绕过。`,
        staff: `深一层：FLP 是 <strong>safety vs liveness</strong> 取舍的理论根基——你能保证"永远不出错"（safety）OR "最终一定有结果"（liveness）但不能同时严格保证。<strong>所有真实算法的妥协</strong>：① Raft / Paxos 用<strong>超时 + 随机</strong>绕过（多数情况下能进展，极端调度可能死锁但概率 0）；② BFT 算法（PBFT、Tendermint）在异步下假设 timing assumptions；③ Bitcoin / 区块链用 PoW 概率性绕过（最终一致，6 个区块后稳定）。<strong>真实意义</strong>：当面试官问"你的分布式系统能 100% 不出错吗" → 正确答 "在 FLP 定理下不可能，我们通过 X 把概率降到 Y"——这是 senior 的回答。<strong>姊妹结论</strong>：CAP 是 FLP 的工程化版本，PACELC 进一步细化"正常时也有取舍"。`,
      },
      failure_modes: [
        `把 FLP 等同于 CAP（CAP 是 FLP 的特例 + 工程化）`,
        `认为"FLP 说不可能 → Raft / Paxos 是错的"（这些算法在 partial synchrony 假设下是正确的）`,
        `不知道 FLP 的精确条件（异步 + 确定性 + 至少一个故障），导致随便引用`,
        `没意识到所有真实算法都通过"加约束"（超时、随机化、同步假设）绕过 FLP`,
        `面试时讲 FLP 但讲不清它跟 CAP / Raft 的因果关系`,
      ],
      follow_ups: [
        { q: `Raft 怎么"绕过"FLP？`, hint: `Raft 在 partial synchrony 模型下工作（最终消息会到达）+ 随机选举超时降低 split vote 概率；理论上极端调度可能不收敛，工程上概率 0` },
        { q: `BFT 算法跟 CFT 算法（如 Raft）有什么区别？`, hint: `BFT 容忍恶意节点（拜占庭故障），需要 3f+1 节点容忍 f 个；CFT 只容忍崩溃故障，2f+1 节点。BFT 算法更复杂、性能差 5-10x` },
        { q: `区块链的"共识"跟 Raft 共识本质区别？`, hint: `Raft 是 deterministic + 强一致 + 小规模（10s 节点）；区块链是 probabilistic + 最终一致 + 大规模（千+ 节点）+ 抗 Sybil；适用场景完全不同` },
      ],
    },

    29: {
      why_asked: `验证候选人是否在 CAP 基础上更进一步。能讲清"正常时也有取舍"的人是真做过多数据中心架构。`,
      answers: {
        mid: `PACELC = <strong>If Partition (P), Availability or Consistency; Else (E), Latency or Consistency</strong>。在 CAP 基础上多了"正常时也有 L vs C 取舍"：强一致需要更多同步开销 → 更高延迟。`,
        senior: `CAP 只描述<strong>分区时</strong>的取舍；PACELC 加上<strong>正常时</strong>的取舍。<strong>系统标签</strong>：DynamoDB 是 <strong>PA/EL</strong>（分区时选可用、正常时选低延迟）；etcd 是 <strong>PC/EC</strong>（分区时选一致、正常时也选一致）；Cassandra 可调（QUORUM = PC/EC，ONE = PA/EL）。`,
        staff: `Daniel Abadi 2010 年提出，<strong>修正 CAP 的工程化缺陷</strong>——CAP 让人误以为"非分区时不用做选择"，但实际上同步复制就是要等待，跨地域强一致就是慢。<strong>真实案例</strong>：platform agent 在跨地域电信场景做了 PACELC 选型：① 核心配置仓库 PC/EC（强一致优先，延迟敏感度低）→ 用 etcd；② 设备遥测数据 PA/EL（高吞吐 + 低延迟）→ 用 Kafka + 最终一致；③ 同一系统，<strong>不同子域不同选型</strong>。<strong>更进一步</strong>：① 客户端能选 consistency level（如 Cassandra 的 read/write CL）；② 同一 key 在不同时刻可选不同 CL（写时 QUORUM，读时 ONE，性能 ×2）；③ Anti-entropy 后台同步修正 EL 系统的不一致。<strong>注意</strong>：PACELC 仍然简化——真实系统还要考虑 partial network partition、读写分别的一致性、写多 leader 等。`,
      },
      failure_modes: [
        `只知 CAP 不知 PACELC（停留在 2000 年的认知）`,
        `给不出真实系统的 PACELC 标签（说明没在多数据中心生产过）`,
        `把 PACELC 当一次性决策（其实可以同一系统不同子域不同选型）`,
        `忽视客户端可调 CL 的能力（如 Cassandra 写 QUORUM 读 ONE 大幅提速）`,
        `把 latency 简化成"网络往返"（其实还包括 disk fsync、leader 排队、quorum 等待等）`,
      ],
      follow_ups: [
        { q: `Cassandra 的 CL 怎么影响 PACELC？`, hint: `QUORUM (R+W &gt; N) = PC/EC 强一致；ONE = PA/EL 高可用低延迟；ANY = PA/EL 最极端；可按业务调，混合使用` },
        { q: `Spanner 是什么 PACELC？`, hint: `PC/EC（强一致 + 接受高延迟），用 TrueTime（GPS+原子钟）+ 2PC 实现外部一致性；代价：跨地域写需要等 7-12ms commit wait` },
        { q: `怎么向产品方解释 PACELC 取舍？`, hint: `① 用业务场景例子（"购物车强一致 vs 商品详情最终一致"）；② 量化延迟差异（"P99 5ms vs 50ms"）；③ 失败场景演练（分区时表现）` },
      ],
    },

    30: {
      why_asked: `验证候选人是否真理解一致性模型分层。能说清三者强弱次序的人通常做过分布式系统调试。`,
      answers: {
        mid: `从强到弱：<br>· <strong>Linearizable</strong>（线性一致）：每次读到最新写，全局实时顺序，等同单机<br>· <strong>Sequential</strong>（顺序一致）：全局顺序但不要求实时（同一进程内顺序保留）<br>· <strong>Causal</strong>（因果一致）：只保因果关系，并发操作可乱序`,
        senior: `<strong>Linearizable</strong> 最强：相当于全世界只有一个原子操作流，但开销大（共识 / quorum）。<strong>Sequential</strong> 弱一档：全局总序但可以"我看到的不是最新的"。<strong>Causal</strong> 最弱实用：只保"先写后读"（happens-before），并发写可乱序。<strong>关键判断</strong>：AP 系统能给的最强保证是 Causal（不能给 Linearizable，违反 CAP）。`,
        staff: `还有更弱的：<strong>Eventual</strong>（最终一致，无任何顺序保证，只承诺"足够久后大家一致"）/ <strong>Strong Eventual</strong>（CRDT 用，并发可合并）/ <strong>Read-Your-Writes</strong>（自己写完一定能读到）等。<strong>实际系统的一致性级别</strong>：① 单机 SQL = Linearizable；② Raft/Spanner 客户端 = Linearizable；③ Kafka 单分区 = FIFO（弱于 Causal）；④ DynamoDB strong-consistent read = Linearizable，eventually consistent read = Eventual；⑤ Cassandra QUORUM = ~Linearizable；⑥ Redis 主从异步 = Eventual。<strong>真实案例</strong>：电信项目里跨地域消息平台用 Kafka，最初客户假定"<strong>跨分区也有全局顺序</strong>"，结果业务逻辑出错——Kafka 只保单分区 FIFO，跨分区无序。改用 keyed partition + 逻辑时钟（Lamport timestamp）+ 客户端 buffer reorder 才修复。<strong>决策指南</strong>：① 强需要 Linearizable → 共识算法（代价：性能、可用性）；② 业务能容忍 → Causal 通常够（实现简单很多）；③ 真不在乎顺序 → Eventual + CRDT。`,
      },
      failure_modes: [
        `假设 Kafka 跨分区也有顺序（其实只有单分区 FIFO）`,
        `Cassandra 写 ONE 读 ONE 期待 Linearizable（实际是 Eventual）`,
        `客户端没意识到 Read-Your-Writes 失败（用了 read replica，写完读不到）`,
        `用了 CRDT 还期待"先写后读"的语义（CRDT 是 Strong Eventual，没有这个保证）`,
        `面试讲"强一致"但说不清是 Linearizable 还是 Sequential（很多人混着用）`,
      ],
      follow_ups: [
        { q: `Causal Consistency 实现要点？`, hint: `用 vector clock / version vector 跟踪因果依赖；读时校验依赖是否满足；典型实现：COPS / Eiger / Riak DT` },
        { q: `Linearizability 测试怎么做？`, hint: `Jepsen 框架 + 故障注入（partition / clock skew / kill -9）+ 历史可线性化检查器 (linearizability checker, Knossos)` },
        { q: `什么场景一定需要 Linearizability？`, hint: `① 库存扣减（不能超卖）；② 唯一性检查（用户名）；③ Leader election；④ 配置发布。能容忍最终一致的都该用更弱保证降低成本` },
      ],
    },

    31: {
      why_asked: `验证候选人是否真读过 Raft paper（不是只背概念）。能讲清"为什么 candidate 日志要 ≥ 投票者"的人是真理解 safety property。`,
      answers: {
        mid: `Raft 的"日志最新"投票规则：candidate 发起 RequestVote 时，<strong>它的日志必须 ≥ 投票者的日志</strong>（先比 term，term 相同比 index），否则投票者拒绝。这条规则保证<strong>已提交日志永远不丢</strong>。`,
        senior: `<strong>因果链</strong>：① 一条日志已提交 = 多数派写入；② 新 leader 必须来自多数派（赢得多数投票）；③ 两个多数派必然有交集 → 至少一个节点拥有所有已提交日志；④ 投票规则要求 candidate 日志 ≥ 投票者 → 这个有"所有已提交日志"的节点要么是新 leader，要么不投给缺日志的 candidate → 新 leader 一定包含所有已提交日志 → 不会回滚。`,
        staff: `这是 Raft <strong>Leader Completeness Property</strong> 的核心证明步骤之一。Raft 的 5 个 safety properties：Election Safety / Leader Append-Only / Log Matching / Leader Completeness / State Machine Safety。<strong>真实意义</strong>：去掉这条规则会出现"<strong>已提交日志被回滚</strong>"的 Bug——客户端收到"已提交"确认，结果新 leader 不知道这条，把它覆盖掉。<strong>常见混淆</strong>：① "已提交"≠"写到多数派"——还要走 commit 通知；② Leader 不能直接提交前任 term 的日志（必须先 commit 当前 term 的一条，间接 carry 上去；这是 Figure 8 的著名 corner case）。<strong>真实事故参考</strong>：早期 etcd 实现过这类 corner case bug；TiKV / CockroachDB 都有 Jepsen 验证捕获过类似问题。<strong>实践</strong>：① 学 Raft 必看 Diego Ongaro 的博士论文 § 5.4；② 实现要走 TLA+ formal verification；③ 用 Jepsen 跑故障注入测试。`,
      },
      failure_modes: [
        `只能背"日志最新"四个字，说不清"为什么要这样"`,
        `不知道 Figure 8 corner case（leader 不能直接 commit 前任 term 日志）`,
        `把 Raft 跟 Multi-Paxos 等同（其实 Raft 是简化版，少了 leader-less 优化空间）`,
        `认为多数派投票 = 立即提交（其实还要经过 commit 阶段，apply 阶段又是另一回事）`,
        `不知道 Raft 的 read 也要走 quorum（或 leader lease）才能 Linearizable`,
      ],
      follow_ups: [
        { q: `Raft 的 read 怎么实现 Linearizability？`, hint: `① ReadIndex（leader 拿当前 commit index → 等到 quorum 确认还是 leader → 才返回）；② Leader Lease（leader 假设在 lease 内还是 leader，跳过 quorum，性能好但风险）` },
        { q: `Raft 怎么处理网络分区？`, hint: `少数派分区无法选出 leader → 拒绝写；多数派分区继续工作；分区恢复后少数派的 stale leader stepdown，向新 leader 同步` },
        { q: `Raft 跟 Multi-Paxos 区别？`, hint: `Raft 强 leader + 串行化（易理解）；Multi-Paxos 可 leader-less（更高吞吐但更复杂）；2026 年 Raft 是工业事实标准（etcd / Consul / TiKV / CockroachDB）` },
      ],
    },

    32: {
      why_asked: `验证候选人是否真理解 Raft 的工程细节。能讲清"随机化避免 split vote"的人通常实现过或调试过 Raft 集群。`,
      answers: {
        mid: `避免 <strong>split vote</strong>：多个 Follower 同时超时同时发起选举，互相不投，没人获得多数票 → 选举失败 → 重试又 split → liveness 卡住。随机化让一个节点通常比其他节点早超时，能率先获得多数票。`,
        senior: `典型范围 <strong>150-300ms</strong>（Diego Ongaro 的论文建议），<strong>必须 &gt; 网络 RTT 几倍</strong>但又 <strong>&lt; 客户端期待的 failover 时间</strong>（如 1s）。如果太小，正常网络抖动也会触发选举；太大，故障切换慢。Raft 论文用 [150ms, 300ms] uniform random。`,
        staff: `深一层：这是 FLP 不可能定理的"<strong>用随机化绕过 deterministic impossibility</strong>"的经典案例——把"一定不收敛"变成"<strong>概率上一定收敛</strong>"。<strong>调优经验</strong>：① 跨 AZ 部署时 RTT ~5ms，超时设 [150, 300] OK；② 跨地域 RTT 100ms 时要设 [500, 1000]；③ etcd 默认 election-timeout 1000ms + heartbeat 100ms。<strong>真实坑</strong>：见过一个生产事故，运维把 election-timeout 设成 50ms（"故障切换要快"），结果一次正常 GC pause 100ms 触发 leader stepdown → 集群在不停选举中卡住。<strong>正确实践</strong>：① election-timeout ≥ 10 × heartbeat-timeout；② 业务 SLO 允许下尽量加大；③ 监控 election count（持续 &gt; 1/min 说明配错）。<strong>跟 PreVote 配合</strong>：现代 Raft 实现都加了 PreVote（先问"我能选上吗"再正式 RequestVote）+ CheckQuorum（leader 周期性确认自己还有多数派），进一步降低不必要的 leader 切换。`,
      },
      failure_modes: [
        `选举超时设太短 → 正常网络抖动触发不必要 leader change`,
        `选举超时设太长 → 故障检测慢，业务受影响时间长`,
        `没用 PreVote → 网络分区恢复时 stale node 反复 disrupt leader`,
        `节点 clock skew 大 → 超时计算偏差，部分节点永不超时`,
        `集群规模太大（&gt; 7 节点）→ 选举消息开销大、收敛慢`,
      ],
      follow_ups: [
        { q: `PreVote 解决什么问题？`, hint: `网络分区中少数派节点 term 不断 +1，分区恢复时它的 term 比集群高 → 触发不必要 leader stepdown；PreVote 先确认能赢再 +1 term` },
        { q: `Raft 集群规模建议？`, hint: `3 / 5 / 7 节点（奇数），通常 5 是 sweet spot（容忍 2 故障 + 选举开销可控）；超过 7 用 leader-less 算法或分片` },
        { q: `怎么监控 Raft 集群健康？`, hint: `① leader changes / min（应接近 0）；② commit index lag（follower 落后程度）；③ proposal latency p99；④ disk fsync p99（共识算法主要瓶颈）` },
      ],
    },

    33: {
      why_asked: `验证候选人是否做过分布式事务设计。能讲清 2PC 三大问题的人通常踩过 distributed transaction 的坑，能正确避免。`,
      answers: {
        mid: `三大问题：① <strong>Coordinator 单点</strong>，Phase 2 中崩溃 → 事务悬挂（hang），其他参与者锁住资源等不到答复；② <strong>阻塞性</strong>，Prepared 后必须持锁等 Phase 2，期间所有其他事务被 block；③ <strong>2× RTT 延迟</strong>，性能差。`,
        senior: `替代方案：① <strong>Saga</strong>（一系列本地事务 + 补偿动作，业务编排）；② <strong>TCC</strong>（Try-Confirm-Cancel，业务层 2PC）；③ <strong>Outbox + 事件驱动</strong>（最终一致 + 业务层重试）。微服务架构下首选 Outbox / Saga，不要 2PC。`,
        staff: `更深一层：2PC 不仅性能差，<strong>它根本不能容错</strong>——FLP 定理告诉我们异步系统无 deterministic 共识；2PC 在 coordinator 故障 + 部分 participant 响应丢失时是 <strong>blocking</strong> 的。要 non-blocking 必须 3PC 或 Paxos commit（实践中没人用，太复杂）。<strong>真实经验</strong>：电信网管系统早期跨多个微服务用 XA 2PC（Atomikos），日均超时事务 50+，DBA 每周手动清理悬挂事务；改成 Saga + Outbox 后超时归零，吞吐提升 8 倍。<strong>什么时候 2PC 还能用</strong>：① 单一 DB 内的"分布式表"（如 TiDB / CockroachDB 内部用，但用户看不见）；② 紧密耦合的金融场景必须强一致（用专门的 XA transaction manager 如 Atomikos）；③ 短事务 + 高可用网络（如同机房）。<strong>其他</strong>：MongoDB / Kafka 各自有 multi-document / multi-partition transaction（其实底层是 2PC + 强假设），生产用前要测 Jepsen 报告。`,
      },
      failure_modes: [
        `微服务架构里上 XA 2PC（典型反模式，性能 + 可用性都差）`,
        `用 Saga 但不写补偿动作（"反正不会失败"）→ 实际失败时数据不一致没法回滚`,
        `用 TCC 但 Try 阶段不预留资源 → Confirm 时才发现资源不够 → 没法回退`,
        `用 Outbox 但 consumer 不幂等 → 重试导致重复扣款`,
        `没有最终一致的兜底机制（对账 / reconciliation job）→ 数据漂移没人发现`,
      ],
      follow_ups: [
        { q: `Saga 跟 TCC 怎么选？`, hint: `TCC：需要"预留资源"（如机票 / 库存），事务边界清晰；Saga：业务可以异步补偿，事务边界长（订单流程）。TCC 实现更复杂但语义强，Saga 灵活但要写正向 + 补偿两份逻辑` },
        { q: `Saga 的"脏读"怎么办？`, hint: `Saga 执行中其他事务可能读到中间态；用语义锁（status="processing"）+ 乐观并发 + 补偿幂等；详见 #34 卡` },
        { q: `跨 DB 强一致还有什么选项？`, hint: `① NewSQL（CockroachDB / TiDB / Spanner，内部用 2PC + Raft）；② 业务上避开（按 tenant / region 分片让事务永远在单 DB 内）；③ 接受最终一致 + 对账` },
      ],
    },

    34: {
      why_asked: `验证候选人能否设计真实可落地的 Saga（不只是"列出三个原则"）。能给具体应对方案的人通常实现过补偿事务。`,
      answers: {
        mid: `Saga 执行过程中其他事务可能读到中间态（partial-committed）数据。三种应对：① <strong>语义锁</strong>（状态字段标记"处理中"，其他事务跳过/排队）；② <strong>乐观并发</strong>（版本号，冲突时重试整个 Saga）；③ <strong>补偿幂等</strong>（补偿可以多次执行不出错）。`,
        senior: `<strong>关键洞察</strong>：完全的 ACID 隔离 Saga <strong>给不了</strong>，必须在业务层面接受。补偿 ≠ 回滚——回滚是"假装没发生"，补偿是"做一个反向操作"（如已扣库存 → 退还库存；已扣款 → 退款）。补偿可能也失败，要有重试 + DLQ + 人工介入。`,
        staff: `<strong>完整设计模式</strong>：<br>① <strong>Saga Pattern Catalog</strong>（Caitie McCaffrey 总结）：semantic lock / commutative update / pessimistic view / reread value / version files / by value。<br>② <strong>编排模式</strong>：Orchestration（中心化 saga manager，如 Camunda / Temporal）vs Choreography（事件驱动，无中心，更松耦合但难追踪）。<br>③ <strong>状态机</strong>：每步骤明确 enter / commit / compensate 状态，便于恢复。<br><br><strong>真实案例</strong>：电信项目里"开通宽带业务"包含 5 步（创建账号 / 分配 IP / 配置 OLT / 激活 ONT / 触发计费），用 Temporal workflow 实现 Saga + 自动补偿。曾遇到客户场景 OLT 配置成功但 ONT 激活超时，补偿动作"回收 OLT 配置"也偶发超时，最后 retry 3 次 + 触发人工工单。<br><br><strong>陷阱</strong>：① 补偿写得不幂等 → 重试导致状态错乱；② 补偿失败的失败处理（meta-compensation）没设计；③ Saga 卡在中间状态 hours 没监控告警；④ 中途用户取消订单也算"补偿"，编排框架要原生支持。<br><br><strong>工具</strong>：Temporal (Cadence fork) / Netflix Conductor / AWS Step Functions / Camunda Zeebe。`,
      },
      failure_modes: [
        `补偿动作不幂等 → 重试时状态错乱`,
        `没有 Saga 执行的可观测性（状态卡在 step 3 hours 没人发现）`,
        `用 Choreography 但没分布式追踪 → 出问题不知道哪一步`,
        `不接受最终一致 + 中间态泄漏 → 业务方期待 Strong Isolation`,
        `补偿失败的失败处理没考虑（meta-compensation）`,
      ],
      follow_ups: [
        { q: `Temporal / Cadence 怎么帮 Saga 落地？`, hint: `workflow 代码即可读、状态自动持久化、failure 自动 retry + 补偿、可视化执行轨迹、支持 long-running workflow（hours/days/weeks）` },
        { q: `Orchestration vs Choreography 怎么选？`, hint: `团队小 + 流程清晰 → Orchestration（易维护）；团队大 + service 多 + 流程灵活 → Choreography（松耦合）；混合最常见` },
        { q: `Saga 怎么测？`, hint: `① 单元测试每步骤的补偿；② 集成测试故障注入（中途 kill service）；③ Jepsen-style 测试随机故障 + 一致性检查；④ Temporal 自带 replay test` },
      ],
    },

    35: {
      why_asked: `验证候选人是否真生产用 Kafka，理解副本机制。能讲清 ISR 和 HW 关系的人是真做过 broker 配置 / 故障运维。`,
      answers: {
        mid: `<strong>ISR (In-Sync Replicas)</strong>：与 Leader 足够同步的副本集合，标准是"最近 30s 内拉过数据 + 不落后超过阈值"（replica.lag.time.max.ms）。<br><strong>HW (High Watermark)</strong>：ISR 成员里<strong>最小的 LEO</strong>（Log End Offset）—— 所有 ISR 都已复制到的 offset。`,
        senior: `<strong>消费者只能读 HW 以下的数据</strong>，保证所有可见数据都已复制到 ISR。如果 ISR 缩小（如 follower 掉线），HW 可能下降；ISR 扩大（follower 追上）HW 可能上升。<strong>min.insync.replicas</strong> 设置写入时至少要多少 ISR 确认（典型 2，3 副本中允许 1 个挂）。`,
        staff: `深一层：<strong>Kafka 的可靠性来自 ISR 而非简单副本数</strong>。如果 producer acks=all + min.insync.replicas=2 + 3 replica，最强一致；如果 acks=1 只等 leader → 性能好但 leader 挂可能丢数据。<strong>关键事故场景</strong>：① <strong>Unclean Leader Election</strong>（早期默认 true）：所有 ISR 都挂时，从 ISR 外选 leader，可能丢已 ack 的数据 → <strong>生产必须设 unclean.leader.election.enable=false</strong>；② <strong>ISR 缩到 1</strong> + min.insync.replicas=2 → producer 直接拒写，业务感知。<strong>真实经验</strong>：电信项目用 Kafka 做遥测，曾因为某 follower disk full → 移出 ISR，HW 一度跌停业务延迟飙升；监控加了 ISR shrink + under-replicated partition 告警后避免再次发生。<strong>Kafka 4.0 起 KRaft</strong> 替代 ZooKeeper 管理元数据，但 ISR 机制不变。`,
      },
      failure_modes: [
        `acks=1 + 期待强一致（leader 挂可能丢已 ack 数据）`,
        `unclean.leader.election.enable=true（默认旧版本是 true，会丢数据）`,
        `不监控 ISR shrink / under-replicated partitions → 静默退化`,
        `min.insync.replicas 设成 1（等于没保护）`,
        `replication factor = 2 + min.insync.replicas = 2 → 一个副本挂直接停写`,
      ],
      follow_ups: [
        { q: `Kafka 怎么实现 Exactly-Once？`, hint: `① 幂等 Producer（PID + Sequence Number）；② 事务 API（跨分区原子写）；③ Consumer 设 isolation.level=read_committed；详见 #36` },
        { q: `KRaft 跟 ZooKeeper 的取舍？`, hint: `KRaft 集成在 broker（少一个依赖、更快元数据操作）；ZK 老成熟（运维工具链丰富）；2026 年新部署都该用 KRaft，老集群可平滑迁移` },
        { q: `Kafka 的"持久性"具体怎么算？`, hint: `acks=all 等 ISR 全部 fsync 才返回；min.insync.replicas 决定容忍故障数；磁盘 fsync 频率 (flush.ms) 影响性能 vs 数据安全` },
      ],
    },

    36: {
      why_asked: `验证候选人是否真用 Kafka 做过 Exactly-Once 业务（不只是 at-least-once + 客户端去重）。这道题的"陷阱"在于：EOS 只在 Kafka 内部生效，下游消费者还得自己保证。`,
      answers: {
        mid: `两个机制叠加：① <strong>幂等 Producer</strong>（PID + Sequence Number，<strong>单分区不重复</strong>，对 broker 短暂网络抖动幂等）；② <strong>事务 API</strong>（跨分区原子写，beginTxn / send / sendOffsetsToTxn / commitTxn）。Consumer 设 <code>isolation.level=read_committed</code>。`,
        senior: `这套机制覆盖 <strong>Kafka 内部</strong> 的 EOS（Producer → Kafka → Consumer）。<strong>关键陷阱</strong>：① <strong>EOS 只在 Kafka 内部生效</strong>，下游业务系统（如写到 MySQL）需要自己保证幂等；② 事务有性能代价（典型 5-10% 吞吐下降）；③ Consumer 必须 manage offsets within transaction（sendOffsetsToTxn）才能真 EOS。`,
        staff: `<strong>完整端到端 EOS 设计</strong>：<br>① 上游 Producer 幂等 + 事务<br>② Kafka 内部 EOS（read_committed）<br>③ Consumer 用<strong>事务把 "处理结果 + offset commit"</strong> 原子化（要么都成功，要么都回滚）<br>④ 下游业务系统幂等（用 message_id / business_key 去重）<br><br><strong>Kafka Streams 模式</strong>：用 <code>processing.guarantee=exactly_once_v2</code> 自动管理上面所有事务边界。<br><br><strong>真实案例</strong>：电信遥测平台早期 Producer 用 at-least-once + 下游消费 idempotent insert，月均 ~1000 重复消息（占总量 0.001%）但下游能去重；后改用 EOS 后重复降到 0，吞吐降了 7%。<strong>取舍判断</strong>：① 业务能容忍重复（如计数、最终统计）→ at-least-once + 下游去重；② 业务必须不重（如金融转账）→ EOS。<br><br><strong>陷阱</strong>：① transactional.id 必须每个 producer 实例唯一且稳定（重启后用同一个），否则 zombie producer 检测失效；② 跨 datacenter 复制（MirrorMaker 2）目前不完整支持 EOS；③ 事务超时默认 15min，长事务要调 transaction.timeout.ms。`,
      },
      failure_modes: [
        `认为开了 EOS 下游就免责（其实下游业务系统还得幂等）`,
        `transactional.id 用随机值（导致 zombie producer 检测失效）`,
        `Consumer 处理消息后才 commit offset（不在 txn 内 → 重复消费可能）`,
        `EOS 性能慢就关 → 又出现重复消费，业务感知`,
        `跨 datacenter 期望 EOS（MirrorMaker 2 暂不完整支持，要在业务侧补幂等）`,
      ],
      follow_ups: [
        { q: `Kafka Streams 怎么用 EOS？`, hint: `processing.guarantee=exactly_once_v2，框架自动管理 producer txn + consumer offset txn；对开发者透明` },
        { q: `at-least-once + 下游去重 vs EOS 怎么选？`, hint: `at-least-once：性能好、设计简单，但需下游业务可幂等；EOS：业务最简但性能 -5~10%、设计要求高；金融等业务必 EOS` },
        { q: `Producer 重启后 transactional.id 怎么处理？`, hint: `必须用同一个 ID（如基于 hostname / pod name）让 broker 识别为同一个 producer 实例；不同 ID 会被当新 producer，旧 txn 可能 zombie` },
      ],
    },

    37: {
      why_asked: `验证候选人是否真理解分布式锁的脆弱性。能讲清 fencing token 的人通常读过 Martin Kleppmann 的 "How to do distributed locking" 文章（业内经典）。`,
      answers: {
        mid: `Fencing token 解决 <strong>GC 暂停导致双写</strong>问题：客户端 A 获锁后 GC 30s，期间锁过期被 B 获取；A 醒后以为还持锁继续写资源 → 两个 client 同时写。<strong>Fencing token</strong> 是<strong>单调递增的版本号</strong>，每次操作资源时带 token，资源系统拒绝旧 token 的写入。`,
        senior: `这是 Martin Kleppmann 2016 年 "How to do distributed locking" 文章提出的论据，<strong>反 Redlock 的核心论据</strong>。即使两个 client 都"以为"自己持锁，资源只接受 token 更新的写入 → 老 client 的写被拒。<strong>关键前提</strong>：资源系统必须支持 fencing token 检查（如 ZooKeeper 用 znode version，HDFS 用 fencing token，etcd 用 lease + revision）。`,
        staff: `深一层：<strong>分布式锁本质不可能 100% 安全</strong>——任何"持锁"判断都是过期的（网络延迟 + GC + clock skew + 进程挂起）。Fencing token 是<strong>把"安全"转移到资源系统</strong>——锁服务可能错（认为你不持锁了），但资源系统永远拒绝旧 token，所以业务正确性保住。<strong>Martin Kleppmann vs Antirez 之争</strong>：Antirez 设计 Redlock（Redis 多实例分布式锁），Martin 论证 Redlock 在 clock skew / GC pause 下不安全；Antirez 回应说"实际生产用 fencing token 配合"。结论：<strong>所有分布式锁都需要 fencing token 才能在严格意义上安全</strong>。<strong>真实案例</strong>：电信网管系统的"批量推送配置到设备"场景，早期用 Redis SETNX 锁 + 直接推送，曾因 worker GC 暂停 + 锁超时被另一 worker 抢到，两个 worker 同时推送导致设备状态被覆盖。改用 etcd lease + revision 作为 fencing token + 设备侧拒绝旧 revision 后修复。<strong>实践建议</strong>：① 用 ZooKeeper / etcd 的内置 lease / version 当 fencing token；② 资源系统必须 token-aware；③ 关键业务别用 Redis 锁（除非加 fencing）。`,
      },
      failure_modes: [
        `用 Redis SETNX + EXPIRE 当严格锁，资源系统不感知 token`,
        `把"获锁成功" 当 "我可以无限期写资源"（忽略 GC / 网络可能让锁过期）`,
        `用 token 但资源系统不强制检查（如 token 字段只 log 不拦）`,
        `多个客户端用同 redis key 但各自 client-id 都不同，无法精确解锁（解错锁）`,
        `复杂业务直接用 Redlock，没读过 Kleppmann 论证`,
      ],
      follow_ups: [
        { q: `什么场景能用简单的 Redis 锁？`, hint: `① 性能优化（如防止缓存击穿，"我先来填缓存"），失败可接受；② 非关键业务的 rate limiting；③ 任务调度（让一个 worker 处理一个 job），失败也只是浪费工作` },
        { q: `etcd / ZooKeeper 怎么做 fencing token？`, hint: `etcd: lease + revision 单调递增；ZK: znode version。客户端获锁拿到 token，操作资源时带 token；资源系统 atomic compare-and-update（如 etcd txn）` },
        { q: `Chubby 是怎么做的？`, hint: `Google 的 distributed lock service（Paxos-based）；每次获锁返回 lock generation number（fencing token）；所有 client-resource 交互都带 generation；后来启发了 ZK 设计` },
      ],
    },

    // ============== 存储与缓存 ==============
    38: {
      why_asked: `验证候选人是否理解 OLTP 索引设计的本质。能讲清"为什么不用 B Tree" 的人通常调过 MySQL 索引性能。`,
      answers: {
        mid: `B+ Tree 三大优势：① <strong>只在叶节点存数据</strong>，内部节点更小 → 同样 16KB 页能装更多键 → 树更矮（亿条数据 3-4 层）；② <strong>叶节点双向链表</strong>，范围查询极快（找到起点后顺链表扫，不用回根）；③ <strong>单次 IO 16KB 页装更多键</strong>，<strong>减少 IO 次数</strong>（磁盘随机 IO 是数据库性能瓶颈）。`,
        senior: `本质：<strong>B+ Tree 是为磁盘优化</strong>，B Tree 是为内存设计的折中。B Tree 内部节点也存数据 → 节点变大 → 扇出降低 → 树变高 → IO 次数增加。B+ Tree 内部只存键 → 扇出可达几百 → 3 层覆盖几十亿数据 → 任意点查 ≤ 3-4 次 IO。<strong>顺序范围查询</strong>是 OLTP 高频场景（如 WHERE created_at BETWEEN ?），B+ Tree 链表完胜 B Tree。`,
        staff: `深一层：InnoDB 的 B+ Tree 还有<strong>聚簇索引</strong>特性——主键 B+ Tree 的叶节点直接存行数据，二级索引的叶节点存"主键值"（不是 row pointer，MyISAM 才是）。<strong>影响</strong>：① 主键选择影响整张表的物理布局；② 二级索引查找需要"回表"（二级 → 拿到 PK → 主键 B+ → 拿到行）；③ 覆盖索引（二级索引包含查询所需所有字段）可避免回表，巨大性能提升。<strong>真实案例</strong>：电信项目里一个百万级"设备状态"表，最初用 UUID v4 当主键，写入 IOPS 抖动严重（页分裂）；改成 UUID v7（时间前缀单调递增）+ 关键字段建覆盖索引后，写入吞吐 +3.5x、查询 P99 -60%。<strong>其他索引结构对比</strong>：① <strong>LSM-Tree</strong>（顺序写优势，RocksDB/Cassandra）；② <strong>Hash Index</strong>（O(1) 点查但无范围）；③ <strong>Skip List</strong>（Redis ZSet 用，类似 B+ Tree 但内存友好）。`,
      },
      failure_modes: [
        `认为 B+ Tree 在内存场景也优于 B Tree（内存场景 cache friendly 的 B Tree / Radix Tree 可能更快）`,
        `不知道聚簇索引概念，以为二级索引可以直接拿到行（其实要回表）`,
        `用随机 UUID 主键导致页分裂（详见 #39）`,
        `不区分 InnoDB（聚簇）和 MyISAM（堆 + 索引），混着讨论`,
        `认为 B+ Tree 是 MySQL 专属（其实 PostgreSQL / Oracle / SQL Server 都用）`,
      ],
      follow_ups: [
        { q: `什么场景 LSM-Tree 比 B+ Tree 好？`, hint: `① 写吞吐压倒读 ratio（日志、时序、IoT）；② SSD 顺序写 vs 随机写差距大；③ 可接受读放大（多层查找）。RocksDB / Cassandra / ScyllaDB / LevelDB 用` },
        { q: `什么时候用 hash 索引？`, hint: `① 纯点查 + 等值过滤（O(1)），无范围 / order by；② MySQL Memory 引擎默认 hash；③ InnoDB Adaptive Hash Index 是自动加的（监控 hit rate）` },
        { q: `B+ Tree 的页大小怎么选？`, hint: `InnoDB 默认 16KB（balance fanout / read amplification）；SSD 上 8/16/32 都试过，16 是 sweet spot；改前 benchmark workload` },
      ],
    },

    39: {
      why_asked: `承接 #38，验证候选人能否把 B+ Tree 理论应用到具体设计决策。能讲清"UUID v7"的人是 2026 年还在持续学习的（v7 是 2022 RFC 9562 标准化）。`,
      answers: {
        mid: `InnoDB 主键是聚簇索引，<strong>数据按主键顺序物理存储</strong>。随机 UUID（v4）插入位置随机 → <strong>页分裂</strong>（一页装满后要分两页）+ 随机 IO + 碎片化（典型 50%+ 碎片率）→ 写入吞吐下降 + 存储浪费。`,
        senior: `<strong>正解</strong>：① <strong>AUTO_INCREMENT</strong>（单机简单，分库分表麻烦）；② <strong>UUID v7</strong>（RFC 9562，时间前缀 + 随机后缀，<strong>趋势递增</strong>顺序插入到末尾）；③ <strong>Snowflake</strong>（Twitter 的 64-bit ID 算法，时间戳 + 机器 ID + 序列号）；④ <strong>ULID</strong>（类似 UUID v7 但字典序友好）。任何"<strong>单调或趋势递增</strong>"的 ID 方案都解决问题。`,
        staff: `深一层：随机 UUID 的代价不止"页分裂"——还包括<strong>buffer pool 利用率低</strong>（热数据散布全表，每次写都要 load 新页）。<strong>真实数据</strong>：在电信告警表（亿级，写吞吐 5k QPS）做 UUID v4 → UUID v7 的迁移，<strong>buffer pool hit rate 从 87% 升到 99.2%，写入 P99 从 80ms 降到 12ms，InnoDB page split events 从每秒 200+ 降到 &lt; 5</strong>。<strong>什么时候随机 UUID 不是问题</strong>：① 表很小（&lt; 100k 行，全在 buffer pool）；② 写吞吐很低；③ 不用聚簇索引引擎（如 PostgreSQL 是堆表 + 索引分离，UUID v4 影响小但仍有 page split 问题，PostgreSQL 16+ 已优化）。<strong>分库分表场景</strong>：AUTO_INCREMENT 不能跨库一致 → 用 Snowflake 或 UUID v7；UUID v7 比 Snowflake 优势：① 无需中心化协调；② 标准库支持；③ 字典序 = 时间序，方便归档。`,
      },
      failure_modes: [
        `用 UUID v4 当主键 + 不知道为什么慢`,
        `分库分表用 AUTO_INCREMENT（每个库自己增，跨库冲突 / 不连续）`,
        `知道问题但不知 v7 / Snowflake / ULID 等替代方案`,
        `认为"只是慢点没事"（实际上 page split 会引发锁竞争 + buffer pool 失效 + 复制延迟）`,
        `迁移时直接改主键类型 → DDL 锁表 hours；正确做法：影子表 + 切流`,
      ],
      follow_ups: [
        { q: `UUID v7 vs Snowflake 怎么选？`, hint: `UUID v7：标准、无配置、字符串格式（128-bit）；Snowflake：64-bit 小、需要机器 ID 协调；微服务架构 UUID v7 简单，大规模高吞吐 Snowflake 节省存储` },
        { q: `已有大表用了 UUID v4，怎么迁移？`, hint: `① 新增 UUID v7 字段；② 双写一段时间；③ 改主键（DDL 或影子表方案）；④ 读切换；⑤ 删 v4 列。零停机的话用 pt-online-schema-change` },
        { q: `Snowflake 怎么解决机器 ID 分配？`, hint: `① 启动从 ZK / etcd 申请；② docker container ID hash；③ Kubernetes hostname；都需要保证同时活的实例 ID 不冲突` },
      ],
    },

    40: {
      why_asked: `验证候选人是否真理解 LSM-Tree（RocksDB / Cassandra / LevelDB 内部）。能讲清三大放大因子取舍的人通常调过 LSM 参数。`,
      answers: {
        mid: `三大放大因子：<br>· <strong>写放大 (Write Amplification, WA)</strong> = 实际写 IO / 用户写量（LSM <strong>高</strong>，因为 compaction）<br>· <strong>读放大 (Read Amplification, RA)</strong> = 实际读 IO / 用户读量（LSM 中等，因为多层查找）<br>· <strong>空间放大 (Space Amplification, SA)</strong> = 存储 / 用户数据（LSM 中等，因为旧版本暂存）`,
        senior: `<strong>三者不可同时优</strong>——LSM 选型本质就是选哪个最重要：<br>· <strong>Tiered Compaction</strong>（Cassandra 默认）：低 WA + 高 SA（多份旧数据共存）<br>· <strong>Leveled Compaction</strong>（LevelDB / RocksDB 默认）：低 SA + 高 WA（频繁合并）<br>· <strong>FIFO / Universal</strong>（时序场景）：低 RA + 高 SA`,
        staff: `深一层：LSM 设计的<strong>核心权衡是 SSD 顺序写 vs 随机写</strong>——LSM 全部顺序写最快，但 compaction 让总写量变大。<strong>实际数据</strong>：典型 RocksDB Leveled 配置 WA = 10-30（用户写 1GB 实际写 10-30GB），Tiered 可降到 3-5 但 SA 翻倍。<strong>真实案例</strong>：电信遥测数据用 RocksDB 存原始事件，最初 Leveled 默认配置写入 GP3 SSD 顶配跑到 60% 时 IOPS 见顶，因为 WA = 22；改 Universal Compaction + 压缩 (Snappy → ZSTD)，WA 降到 6，吞吐翻倍。<strong>其他调优</strong>：① <strong>Bloom Filter</strong> 降 RA（不存在的 key 不用查盘）；② <strong>Block Cache</strong> 降 RA（热数据内存命中）；③ <strong>Compression</strong> 降 SA + 牺牲 CPU；④ <strong>Level 大小比</strong>（默认 10x，调小降 WA 但增 RA）。<strong>对比 B+ Tree</strong>：B+ Tree WA ≈ 1-2（in-place update），RA ≈ 1-3（少量页查找），但<strong>写吞吐受限于随机 IO</strong>；LSM 高写吞吐但读 / 空间代价。`,
      },
      failure_modes: [
        `不知道 compaction 会引起 WA（以为只是"merge sstable"）`,
        `Leveled 配置不调直接用，发现写吞吐不够才慌`,
        `Tiered 配置不监控 SA，盘满才发现`,
        `没启用 Bloom Filter → 不存在的 key 也走全盘查 → RA 爆炸`,
        `用 LSM 跑读多写少 workload（B+ Tree 更合适）`,
      ],
      follow_ups: [
        { q: `Compaction 怎么调？`, hint: `① 监控 WA / RA / SA 三者；② Leveled vs Tiered vs Universal 按 workload 选；③ level multiplier（默认 10x）小调降 WA；④ 限速避免 compaction 抢业务 IO` },
        { q: `Bloom Filter 怎么影响 LSM？`, hint: `每个 SSTable 一个 BF，查询时先问 BF "可能存在吗"，绝大多数"不存在"直接 skip → 不用读盘；典型降 RA 50%+；代价 ~10 bits/key 内存` },
        { q: `LSM 怎么删除数据？`, hint: `不能 in-place 删，写一个 tombstone（墓碑）→ compaction 时遇到 tombstone 删除老数据；问题：tombstone 多了影响读性能（"ghost rows"），TTL 长容易堆积` },
      ],
    },

    41: {
      why_asked: `验证候选人是否真理解 MySQL 隔离级别。能讲清"快照读 vs 当前读"区别的人是真调过事务并发问题。`,
      answers: {
        mid: `<strong>不完全</strong>。InnoDB RR (Repeatable Read) 默认隔离级别下：<br>· <strong>快照读</strong>（普通 SELECT）：用 MVCC（多版本并发控制），看见事务开始时的快照，<strong>防幻读</strong>。<br>· <strong>当前读</strong>（SELECT FOR UPDATE / SELECT LOCK IN SHARE MODE / UPDATE / DELETE）：用 Next-Key Lock（间隙锁 + 行锁），<strong>防幻读</strong>。`,
        senior: `<strong>陷阱</strong>：<strong>混用两种读</strong>可能看到幻象——先做快照读看到 N 行，再做当前读看到 N+M 行（M 是其他事务新插入的）。完全防幻读需 <strong>Serializable</strong> 隔离级别（自动给所有读加锁，性能差）。`,
        staff: `深一层：InnoDB 的"RR 防幻读"其实<strong>比 SQL 标准更强</strong>（标准 RR 允许幻读）。InnoDB 通过 MVCC + Next-Key Lock 同时防快照读和当前读的幻读。<strong>但混用就有漏洞</strong>。<br><br><strong>真实案例</strong>：电商订单系统里同事务先 SELECT count(*) WHERE status='pending' = 10 → SELECT FOR UPDATE 同条件 → 看到 12 行（其他事务期间插入了 2 条 pending）。如果业务依赖 count 做决策（如限额检查），就出问题。<strong>对策</strong>：① 一开始就用当前读（FOR UPDATE）；② 业务侧 retry on conflict；③ 升级到 Serializable（性能代价大，慎用）；④ 用 INSERT ... ON DUPLICATE KEY 把检查 + 插入原子化。<br><br><strong>其他陷阱</strong>：① InnoDB 的"间隙锁"在 RR 下默认开启，可能锁住未存在的行 → 死锁概率上升；② RC (Read Committed) 隔离级别下没有间隙锁，并发更高但有幻读；② MySQL 8.0 起可以全局 SET TRANSACTION ISOLATION LEVEL，但同一连接内可不同事务用不同级别。<strong>实战建议</strong>：① 绝大多数场景 RR 够用；② 高并发可降 RC + 业务层补防幻读；③ 金融强一致用 Serializable + 优化重试。`,
      },
      failure_modes: [
        `认为 RR = 完全防幻读（不知道混用快照 + 当前读的漏洞）`,
        `把 MySQL 的 RR 等同 SQL 标准 RR（实际 MySQL 更强）`,
        `用 Serializable 不知道代价（所有读 = locking read，并发暴跌）`,
        `不区分 MVCC 的 read view 时机（事务开始 vs 第一条 SQL 时；MySQL 是后者）`,
        `开了 RR 但没意识到间隙锁可能死锁`,
      ],
      follow_ups: [
        { q: `MVCC 怎么实现？`, hint: `InnoDB 用 undo log 链：每行有 trx_id + 隐藏 rollback_pointer，read 时按事务 ID 沿链找可见版本；定期 purge 老版本` },
        { q: `Snapshot Isolation 跟 Serializable 区别？`, hint: `SI 用快照（MVCC），允许 write skew（两个事务读同样数据后基于此各自写）；Serializable 完全串行化等价，禁 write skew` },
        { q: `怎么排查间隙锁死锁？`, hint: `① SHOW ENGINE INNODB STATUS 看最近死锁；② performance_schema.data_locks；③ 通常缩短事务 + 统一加锁顺序解决` },
      ],
    },

    42: {
      why_asked: `验证候选人是否真处理过缓存一致性。能讲清"删 vs 更"取舍的人通常踩过缓存脏数据的坑。`,
      answers: {
        mid: `<strong>先更 DB，再删缓存</strong>（Cache-Aside 模式）。删除比更新更安全——下次读 miss 后从 DB 重新加载新值，避免并发场景下"缓存写入"和"DB 写入"乱序问题。`,
        senior: `<strong>反例：先删缓存再更 DB</strong>：删完缓存的瞬间，另一线程读到 miss → 从 DB 加载老值 → 写回缓存 → 你的 DB 更新还没完成 → 缓存还是老值，<strong>不一致</strong>。<br><strong>最佳实践</strong>：用 <strong>CDC 监听 DB binlog 自动失效缓存</strong>，比应用代码主动删除更可靠（应用可能在 DB commit 后崩溃没删缓存）。`,
        staff: `更深层：<strong>Cache-Aside + 删除策略仍有罕见不一致窗口</strong>——A 读 miss → load 老值；B 更 DB + 删缓存；A 把老值写回缓存 → 缓存又老了。概率很低（要求 A 的 read-from-DB 比 B 的 DB-commit+del-cache 还慢），但金融场景可能感知。<strong>更稳的方案</strong>：① <strong>Read-Through + Write-Through</strong>（缓存层接管所有读写，应用不直接操作 DB）；② <strong>Write-Behind</strong>（写缓存立即返回，异步写 DB，性能好但有丢数据风险）；③ <strong>CDC + 失效</strong>（Debezium 监听 binlog → 异步删缓存，应用零负担）。<strong>真实案例</strong>：大型企业客户系统里有"用户套餐"表缓存到 Redis（TTL 30 min），早期用 Cache-Aside 手动删，发现月均 5-10 起客户投诉"我刚改完套餐还是老的"，原因是 service A 改 DB 后还没来得及删缓存 service B 已经读到老值。引入 Debezium → Kafka → cache-invalidator 消费者后，缓存延迟稳定 &lt; 500ms 内一致，投诉归零。<strong>陷阱</strong>：① TTL 不能完全替代主动失效（用户感知 TTL 时长）；② 删失败要重试（DLQ）；③ 批量更新触发"惊群"——大量 key 同时失效。`,
      },
      failure_modes: [
        `先删缓存再更 DB（标准反模式）`,
        `更 DB 后不删缓存（依赖 TTL）→ 用户感知很久的旧数据`,
        `用 SET 而不是 DEL（多线程下后写覆盖先写，可能写入老值）`,
        `没考虑应用 crash 导致"DB 改了缓存没删"的场景`,
        `单机 Redis 看似"一致"，多实例 / 多区域时不一致问题放大`,
      ],
      follow_ups: [
        { q: `CDC 怎么实现缓存失效？`, hint: `Debezium → Kafka → cache-invalidator consumer → DEL Redis key；优势：业务零侵入、可靠（Outbox 思想）；代价：架构复杂` },
        { q: `Read-Through vs Cache-Aside 怎么选？`, hint: `Cache-Aside：业务清楚知道缓存存在，灵活但要写双倍代码；Read-Through：缓存层封装 DB 访问，业务透明但绑定缓存框架（如 EhCache）` },
        { q: `怎么避免"缓存击穿"？`, hint: `① 互斥锁（只有一个线程查 DB，其他等结果）；② 逻辑过期（TTL 内异步刷新，永不真过期）；③ Bloom Filter 拦掉不存在的 key` },
      ],
    },

    43: {
      why_asked: `验证候选人是否真负责过缓存运维。三者经常被混着说，能区分的人是真处理过缓存稳定性事故。`,
      answers: {
        mid: `<strong>缓存穿透</strong>：key 不存在于<strong>缓存和 DB</strong>，每次请求都查 DB（恶意攻击常用），DB 被打挂。<br><strong>缓存击穿</strong>：<strong>单个热点 key 过期</strong>，瞬间大量并发涌入查 DB。<br><strong>缓存雪崩</strong>：<strong>大量 key 同时过期</strong>或 <strong>Redis 整体宕机</strong>，所有请求落到 DB。`,
        senior: `<strong>对策对应</strong>：<br>· 穿透 → <strong>缓存空值</strong>（短 TTL，比如 5 min）或 <strong>布隆过滤器</strong>预筛<br>· 击穿 → <strong>互斥锁</strong>（singleflight，只有一个线程查 DB）或 <strong>逻辑过期</strong>（永不真过期，异步刷新）<br>· 雪崩 → <strong>TTL 随机化</strong>（避免同时过期）+ <strong>Redis 高可用</strong>（主从 / Sentinel / Cluster）+ 服务端 <strong>限流</strong>`,
        staff: `深一层：三者的<strong>共同本质</strong>是"缓存层失效后 DB 被打满"——本质问题在于 DB 没有保护层。<strong>真实事故场景</strong>：① 穿透：某黑产攻击我们 API 用不存在的 user_id 撞，每秒 10k QPS 全打到 MySQL → MySQL 慢查询积压 → 服务雪崩；对策：API 网关侧布隆过滤器 + 黑名单封 IP。② 击穿：电商秒杀 SKU 缓存 TTL 1h，到点过期，第 1 秒 50k QPS 同时查 DB → DB 卡 5s → 全站 P99 飙升；对策：singleflight + 提前 5 min 预热。③ 雪崩：某次部署 Redis cluster reshard，10% slot 短暂不可用，所有请求穿透到 DB → DB 满载；对策：Redis 故障时 service 端 hystrix 熔断 + 降级返回默认值。<strong>设计建议</strong>：<strong>缓存不是优化是稳定性保护，要为"缓存失效"做预案</strong>。所有缓存查询都该有 timeout + fallback + 限流；DB 永远要扛得住短暂"缓存全失效"的场景（即使 5 秒）。<strong>更高级</strong>：多级缓存（本地 LRU + Redis + DB），用 hystrix / sentinel / resilience4j 做熔断降级。`,
      },
      failure_modes: [
        `不区分三者，混着讨论（暴露没实际处理过）`,
        `用"缓存空值"防穿透但不设 TTL（永久占内存）`,
        `用互斥锁防击穿但锁粒度太大（所有 key 共享一把锁）`,
        `TTL 都设同样的值（统一到点过期 → 雪崩）`,
        `认为 Redis HA 就够了（其实还需限流 + 熔断 + 降级三件套）`,
      ],
      follow_ups: [
        { q: `布隆过滤器怎么集成？`, hint: `① Redis 的 RedisBloom 模块；② 应用本地 BF + 定期同步；③ 注意 false positive，"可能存在"才真查 DB；删除元素困难（除非 Counting BF）` },
        { q: `singleflight 怎么实现？`, hint: `① 在 process 内：用 lock + condition variable 让其他线程等第一个的结果；② 跨 process：用 Redis SETNX 锁；Go 标准库有 singleflight 包` },
        { q: `逻辑过期是什么？`, hint: `key 永不真过期，value 里带 expire_at 字段；查询时如果过期，<strong>返回旧值同时异步刷新</strong>；新鲜度换可用性，秒杀场景常用` },
      ],
    },

    44: {
      why_asked: `验证候选人是否好奇过 Redis 内部数据结构（不止当 black box 用）。能讲出 Antirez 设计权衡的人是真读过 Redis 源码或 blog。`,
      answers: {
        mid: `Antirez 选 Skip List 的解释（Redis source comments）：① <strong>实现简单</strong>（~200 行 C 代码 vs 红黑树 500+）；② <strong>范围查询友好</strong>（L1 链表天然支持 ZRANGE）；③ <strong>缓存友好</strong>（内存访问模式接近线性）；④ <strong>更易扩展</strong>（层数可调，并发优化空间大）。`,
        senior: `性能上跳表和红黑树都是 <strong>O(log N)</strong>（点查 / 插入 / 删除）。<strong>真正差异</strong>：① 跳表实现 ~50% 代码量；② 红黑树平衡时旋转操作多，跳表只需要更新指针；③ 跳表的链表特性让 ZRANGEBYSCORE / ZREVRANGE 等范围操作 O(log N) + O(K)，无需中序遍历。<strong>缺点</strong>：跳表内存占用稍高（每个节点多个 forward pointer），Redis 通过编码优化（ziplist for 小 set）平衡。`,
        staff: `深一层：Redis ZSet 实际<strong>双数据结构</strong>——Skip List + Hash Table。Skip List 按 score 排序（ZRANGE / ZRANGEBYSCORE），Hash Table 按 member 名 O(1) 查（ZSCORE）。两者由 ZSet 操作维护一致。<strong>另外</strong>，小 ZSet 用 <strong>ziplist</strong>（紧凑数组编码）省内存，超过阈值（128 elements / 64 bytes/elem）转 skip list。<strong>真实案例</strong>：在电信项目用 Redis ZSet 实现"设备告警按严重度排序" + "按时间窗口聚合"，~100k 设备的告警实时排序 + 范围查询 P99 &lt; 5ms。<strong>Antirez 完整故事</strong>：他写 Redis 时考虑过 RB Tree 但放弃，原因是"<strong>简洁 + 可读 + 一定够用</strong>"；后期社区有人提性能极致优化（如 t-digest），Antirez 拒绝合并，理由"<strong>maintenance cost &gt; perf gain</strong>"。这种"工程美学"也是 Redis 长期保持高质量的原因。<strong>对比</strong>：Memcached 没有有序结构（所以也没 ZSet），ScyllaDB 用 LSM-Tree（不适合点查范围混合），ClickHouse 用 Sparse Index + Skip List（OLAP 场景）。`,
      },
      failure_modes: [
        `认为跳表是"二级链表"那么简单（实际是<strong>概率平衡</strong>，层数随机决定）`,
        `不知道 ZSet 是双数据结构（Skip List + Hash）`,
        `不知道小 ZSet 用 ziplist 优化`,
        `把跳表跟 B+ Tree 混（两者完全不同，跳表纯内存，B+ Tree 为磁盘）`,
        `不能讲清"为什么不用红黑树"的工程理由（只会背"实现简单"）`,
      ],
      follow_ups: [
        { q: `跳表的层数怎么决定？`, hint: `每个节点插入时按概率 P=0.5 决定升一层，最高 32 层；期望层数 = log(N)；纯概率，无需平衡操作` },
        { q: `Redis 还有哪些有意思的数据结构选择？`, hint: `① Hash 小用 ziplist 大用 hashtable；② List 用 quicklist (linked list of ziplist)；③ Set 全数字用 intset；④ Stream 用 radix tree + listpack；都是"小数据紧凑 + 大数据展开"模式` },
        { q: `ZADD 性能怎么样？`, hint: `O(log N)，跟红黑树同复杂度；实测 Redis 7 单线程 ~80k QPS（含 hashtable 同步更新）；瓶颈通常在网络 RTT 不在 ZSet 本身` },
      ],
    },

    45: {
      why_asked: `验证候选人是否在 Redis Cluster 模式下踩过坑。能讲 hashtag 用法的人通常做过分片迁移。`,
      answers: {
        mid: `Redis Cluster 把 key 用 CRC16 mod 16384 分到不同 slot，每个 slot 由不同节点持有。<strong>跨 slot 的多 key 操作（MSET / MGET / DEL 多 key / Lua）不支持</strong>。解决：用 <code>{hashtag}</code> 强制多个 key 到同一 slot。`,
        senior: `<code>{hashtag}</code> 语法：<strong>大括号内的部分</strong>用来计算 slot，大括号外忽略。<br>例：<code>{user:1001}:profile</code> 和 <code>{user:1001}:orders</code> 两个 key 都按 "user:1001" 的 hash 落到同一 slot → 可在一个 MGET / 事务 / Lua 里操作。`,
        staff: `深层：hashtag 是"打破默认 slot 算法"的<strong>显式钩子</strong>，<strong>用得过多会破坏负载均衡</strong>——所有 user:1001 的 key 都堆到一个 slot，热点用户的数据全打在一个节点。<strong>真实案例</strong>：电信平台用 Redis Cluster 存"设备会话"，最初按 device_id 自然分片；后来加"<strong>跨设备聚合操作</strong>"需求（按 customer_id 聚合多设备），改用 <code>{customer:X}:device:Y</code> 让一个客户的所有设备在同一 slot。结果某 enterprise 客户有 10k 设备，单 slot 内存 +5GB → 节点 OOM → 集群震荡。<strong>正解</strong>：分级 hashtag + 业务层 fanout（按 customer 拆分跨节点 fanout 查询）+ 监控单 slot 大小告警。<strong>其他 cluster 限制</strong>：① Lua 脚本必须所有 key 在同一 slot（CLUSTERSLOTS check）；② 事务 MULTI / EXEC 同上；③ Pipeline 可跨 slot 但每个 command 单 slot；④ MOVED / ASK 重定向客户端自动跟随，但 SDK 可能未实现完整。<strong>替代方案</strong>：① <strong>Redis Sharding (Cluster mode)</strong>：上面讨论的；② <strong>Twemproxy / Codis</strong>（中间件分片）；③ <strong>客户端分片</strong>（应用自己计算）；④ <strong>Redis Sentinel + 单分片</strong>（小数据量）。Redis Cluster 适合大数据 + 不复杂跨 key 操作；复杂事务考虑单实例 + 大内存。`,
      },
      failure_modes: [
        `没意识到 Cluster 不支持跨 slot 的多 key 操作，期望和单实例一样`,
        `滥用 hashtag → 单 slot 数据爆炸 → 节点 OOM`,
        `Lua 脚本里硬编码多个 key 不确认同 slot → 运行时 CROSSSLOT error`,
        `客户端 SDK 不支持 cluster mode（MOVED 重定向不处理）→ 性能差`,
        `不监控 slot 分布 → 长期慢慢变得不均匀`,
      ],
      follow_ups: [
        { q: `slot rebalance 怎么做？`, hint: `redis-cli --cluster rebalance / 手动 CLUSTER ADDSLOTS / 渐进迁移；过程中 client 看到 MOVED + ASK 重定向，要求 SDK 处理` },
        { q: `Redis Cluster vs Sentinel 怎么选？`, hint: `Sentinel：单分片 + 主从切换（适合 &lt; 单机内存）；Cluster：多分片（大数据，但复杂度高）；2026 年中等规模优先 Cluster + 简单 hashtag` },
        { q: `client-side caching 是什么？`, hint: `Redis 6+ feature：客户端缓存热点 key，Redis 用 invalidation push 通知失效；进一步减网络往返；典型场景如配置项缓存` },
      ],
    },

    46: {
      why_asked: `验证候选人是否真处理过大数据分页性能。能讲出 cursor pagination 的人通常处理过千万级数据展示。`,
      answers: {
        mid: `两种方案：① <strong>游标分页 (cursor pagination)</strong>（推荐）：<code>WHERE id &gt; last_id ORDER BY id LIMIT 10</code>，O(1) 跳过；② <strong>覆盖索引 + JOIN</strong>：子查询只扫覆盖索引拿 PK，主查询用 PK 做 10 次点查。`,
        senior: `<strong>禁止直接 LIMIT 1000000, 10</strong>——MySQL 实际要扫前 100 万行然后丢弃，是 O(N) 操作。游标分页是工业标准，要求<strong>排序字段必须 unique</strong>（否则末尾边界丢/重）。<br>常见 anti-pattern：分页带 ORDER BY 非唯一字段（如 created_at）→ 同一时刻多条记录时游标失效。`,
        staff: `深层方案：<br><strong>1. 游标分页</strong>：<code>WHERE (created_at, id) &gt; (?, ?) ORDER BY created_at, id LIMIT 10</code>——双字段游标避免时间重复问题。<br><strong>2. Search After</strong>：Elasticsearch 的等价方案，传上一页最后一个 sort value。<br><strong>3. Snapshot Pagination</strong>：第一次查询返回 query_id + 快照，后续翻页基于快照（性能稳定但占内存）。<br><strong>4. 估算 + 跳跃</strong>：大数据展示通常不需要精确，"约 1 万结果"+ 直接跳到 5000 ≈ Index Skip Scan。<br><br><strong>真实案例</strong>：电信告警查询页面，最初 LIMIT offset 翻页，offset &gt; 10000 时 P99 飙到 8 秒；改 cursor pagination 后 P99 稳定 &lt; 50ms，无论翻多少页。<strong>客户端 API 设计</strong>：返回 <code>{data: [...], next_cursor: "..."}</code>，客户端只需传 next_cursor，不传 page number → 也避免了 LIMIT offset 反模式。<strong>陷阱</strong>：① 游标不能"跳页"（"我要看第 50 页"做不到）→ 业务设计要接受；② 排序字段改了游标失效；③ 数据删除后游标仍指向"已不存在"的位置（要么忽略要么调整）。`,
      },
      failure_modes: [
        `直接 LIMIT 1000000, 10（O(N) 操作）`,
        `游标排序字段非唯一 → 末尾边界丢 / 重数据`,
        `客户端 API 暴露 page number（鼓励 LIMIT offset 反模式）`,
        `Total count 总是算（COUNT(*) 全表扫，比分页本身慢）`,
        `深翻页报错（"sorry, max page 1000"）—— UX 差，应该用 cursor 让所有页都快`,
      ],
      follow_ups: [
        { q: `怎么估算 total count？`, hint: `① 用 INFORMATION_SCHEMA.TABLES.TABLE_ROWS（不精确但 O(1)）；② SQL_CALC_FOUND_ROWS 已废弃；③ 用 explain 估算；④ count(*) where filter 加 LIMIT 1001 + 提示 "1000+"` },
        { q: `Elasticsearch 怎么深翻页？`, hint: `① search_after（cursor 思路）；② Scroll API（保留快照，适合导出 / 批量处理）；③ Point-in-Time + search_after（7.10+ 推荐）；禁止 from + size 深翻` },
        { q: `游标怎么 encode？`, hint: `① Base64 encode 排序字段值（避免暴露 PK 内部）；② JWT 签名防篡改；③ 加版本号字段方便迁移；典型：<code>{ "v":1, "id":12345, "ts":"2026-01-01T00:00:00Z" }</code> Base64` },
      ],
    },

    // ============== 可观测性 ==============
    47: {
      why_asked: `验证候选人是否区分"可监控"和"可观测"。能用控制理论解释的人通常做过完整的 telemetry pipeline。`,
      answers: {
        mid: `<strong>监控 (Monitoring)</strong>：预先知道会出什么问题，去看那些指标（known unknowns）。<br><strong>可观测性 (Observability)</strong>：<strong>无论出什么问题都能通过系统输出找到原因</strong>（unknown unknowns）。`,
        senior: `Observability 源自<strong>控制理论</strong>——一个系统是 observable 当且仅当能从外部输出推断内部状态。监控是"看预定的灯"，可观测性是"装足够的传感器让你能推断任何状态"。<strong>实践差异</strong>：监控关心 SLI / 告警阈值，可观测性关心 trace / log / 高基数事件；监控被动反应，可观测性主动调查。`,
        staff: `深层：<strong>2026 年</strong>业界已经用"<strong>四支柱</strong>"概念替代经典三支柱：Traces / Metrics / Logs / <strong>Profiles</strong>（CPU/内存/锁的连续 profiling）。<strong>OpenTelemetry</strong> 统一了前三个的数据模型 + SDK；Profiles 由 Pyroscope / Parca 主导，正在被 OTel 吸收（pprof 格式标准化）。<strong>真实价值差异</strong>：监控告诉你"P99 飙到 500ms"，可观测性让你能下钻到"是哪个 trace_id / 哪个 user_id / 哪条 SQL / 哪个版本"。<strong>真实案例</strong>：电信网管系统 2024 年迁移到 OpenTelemetry 全链路追踪 + 高基数 metrics（per-tenant per-endpoint label）后，故障定位时间从平均 45 min 降到 8 min。<strong>陷阱</strong>：① 高基数 metrics 成本爆炸（label 组合数 = 几百万 时序）；② log volume 不控制磁盘 / 索引钱花光；③ 没有 SLO 就堆指标 → 信号噪声比差。<strong>三大问题决定可观测性投入</strong>：① 我们能否快速定位"是否有问题"（SLI）；② 我们能否定位"问题在哪"（trace / log）；③ 我们能否定位"为什么"（profile / correlation）。`,
      },
      failure_modes: [
        `把 observability 当 buzzword，实际只做 metric 告警`,
        `Log / Trace / Metric 完全独立，定位时来回切平台跳`,
        `没有 trace_id / span_id 关联 log → 高并发下 log 杂乱无章`,
        `堆 1000+ dashboards 没有人看 (over-instrumentation)`,
        `没建 baseline → 不知道什么是"异常"`,
      ],
      follow_ups: [
        { q: `OpenTelemetry 解决什么问题？`, hint: `统一 trace / metric / log 的数据模型 + SDK + 协议（OTLP），避免厂商锁定；可换不同后端（Jaeger / Tempo / Datadog / NewRelic）` },
        { q: `怎么做"4 支柱"correlation？`, hint: `所有信号带相同的 trace_id / span_id → 在 dashboard 里 click trace 跳 log，click log 看 metric 时间序列；OTel SDK 自动注入到 log` },
        { q: `O11y 投入怎么算 ROI？`, hint: `MTTR 改善（事故定位时间）+ developer productivity（少 oncall 半夜起夜）+ business impact 量化（如 P99 改善 → 转化率 X%）` },
      ],
    },

    48: {
      why_asked: `承接 #47，验证候选人是否真用 OTel / Prometheus / Pyroscope。"四支柱"是 2024 年起业界更新的概念（之前是三支柱）。`,
      answers: {
        mid: `经典三支柱：<strong>Traces</strong>（请求路径，发生了什么）/ <strong>Metrics</strong>（多严重，数值聚合）/ <strong>Logs</strong>（细节，事件流）。<br>2026 年第四支柱：<strong>Profiles</strong>（慢在哪，代码热点 / 内存分配 / 锁等待）。`,
        senior: `<strong>四支柱定位</strong>：<br>· Traces：请求级别的故事（什么时间发生、跨多少服务、哪步慢）<br>· Metrics：系统级别的趋势（QPS / latency / error rate / saturation）<br>· Logs：事件级别的细节（具体错误信息、参数）<br>· Profiles：代码级别的归因（CPU 在哪函数烧、内存哪里分配、锁谁等谁）<br>四者互补：metric 告警 → trace 定位 → log 看细节 → profile 找根因。`,
        staff: `深层工程实践：<br><strong>1. OpenTelemetry</strong> 是事实标准（OTLP 协议、SDK 多语言、resource semantic conventions）；2024 年起 OTel 也吸收 profiling（pprof 格式）。<br><strong>2. 后端选型</strong>：① Tempo (Grafana) / Jaeger 存 traces；② Prometheus / VictoriaMetrics / Mimir 存 metrics；③ Loki / Elasticsearch 存 logs；④ Pyroscope / Parca / Grafana Phlare 存 profiles。<br><strong>3. 关键设计</strong>：① 所有信号带 trace_id 实现 correlation；② Tail sampling 保留有价值 trace（错误 + 慢请求 100%，其他 1%）；③ High-cardinality metrics 谨慎用（exemplars 替代）；④ Continuous Profiling 默认开（开销 &lt; 1% CPU）。<br><br><strong>真实案例</strong>：电信网管系统 OTel 栈：Java/C++ agent → OTel Collector → Tempo + Prometheus + Loki + Pyroscope，统一在 Grafana 展示。一次 P99 飙升事件链路：① Prom alert 触发 → ② Grafana 看 traces 找到某 endpoint 慢 → ③ 点 trace 看到 RPC parse 慢 → ④ 跳 Pyroscope CPU profile 看到 XPath 查询占了 60% CPU → ⑤ 改代码用预编译 XPath，30 min 定位 + 修复。<strong>没有 profiling 的话</strong>这一步要靠人 SSH 上机器跑 perf record，事故修复时间至少 ×3。`,
      },
      failure_modes: [
        `只做 metric 不做 trace（无法定位"慢在哪步"）`,
        `Trace 不采样或全采（吞吐 / 存储爆炸）；Tail sampling 也不做（错误 trace 丢了）`,
        `Log / Trace / Metric 不带相同 trace_id → 无法跨信号关联`,
        `Profile 不持续做（事故时 SSH 上去手抓，已太晚）`,
        `把 OTel 当成"加 SDK 就行"，没设计 sampling / cardinality 策略`,
      ],
      follow_ups: [
        { q: `Tail sampling 怎么实现？`, hint: `OTel Collector 的 tail_sampling processor：缓存所有 trace 直到完成 → 按规则保留（error / slow / 1% normal）→ 转发到后端；需要内存 buffer 4-8GB / node` },
        { q: `Continuous Profiling 开销多大？`, hint: `Pyroscope / Parca CPU profiling 用 perf_events，~1% overhead；memory profiling 视语言（Java JFR / Go pprof / C++ async-profiler），通常 &lt; 3%；生产可常开` },
        { q: `OTel 在 C++ 里怎么用？`, hint: `opentelemetry-cpp SDK + auto instrumentation（gRPC / Boost.Asio 自动 wrap）；手动 span：tracer-&gt;StartSpan("...")；exporters: OTLP / Jaeger / Zipkin` },
      ],
    },

    49: {
      why_asked: `验证候选人是否真用过 Prometheus 多副本部署。能讲清"分位数不能数学聚合"的人是真踩过这个坑（很常见）。`,
      answers: {
        mid: `<strong>Histogram</strong>。原因：Summary 在客户端预计算分位数（P50 / P99），<strong>多副本的 P99 不可数学聚合</strong>——3 个实例 P99 = 50 / 60 / 70ms，合起来不等于 60 也不等于 70。`,
        senior: `Histogram 存 <strong>bucket counts</strong>（可加），用 <code>histogram_quantile(0.99, sum(rate(latency_bucket[5m])) by (le))</code> 服务端聚合 + 估算分位数。<strong>代价</strong>：bucket 数量决定精度（典型 10-20 个 bucket）+ 内存占用比 Summary 大。`,
        staff: `深层：<strong>Native Histograms</strong>（Prometheus 2.40+ 实验，2026 年逐渐 GA）解决传统 Histogram 的两个问题：① bucket 数量预设难调；② 跨服务对比 bucket 不一致。Native Histogram 用<strong>指数 bucket schema</strong>，单 series 内动态扩展，精度更高、存储更省（典型 4-5x 压缩）。<strong>真实事故</strong>：曾经在多副本部署时用 Summary 算 P99 → 在 Grafana 看到 P99 = 80ms（其实是每个副本本地 P99 的 avg），实际全局 P99 是 200ms（被高基数副本拉高），导致告警阈值设错。<strong>对策</strong>：① 用 Histogram 让 Prometheus 全局算；② 关键 endpoint 加 exemplar（绑定具体 trace_id，可点击跳 trace）；③ 用 Native Histogram 减小 bucket 调优负担。<strong>其他坑</strong>：① Histogram 的 le 标签必须包含 <code>+Inf</code>（不然 quantile 算错）；② bucket 边界要覆盖 P99 + 余量；③ 历史 Histogram 改 bucket 边界要谨慎（rate 函数对 le 变化敏感）。`,
      },
      failure_modes: [
        `多副本用 Summary 算 P99，Grafana 显示"平均的本地 P99"，跟真实差距巨大`,
        `Histogram bucket 太少（如只有 5 个），P99 精度差`,
        `bucket 上限太小（如最大 1s，但实际有 5s 的请求），所有大请求落 +Inf，P99 失真`,
        `不知道 Native Histogram，仍用传统配死 bucket 边界`,
        `没绑定 exemplar → 看到慢请求不知道是哪个 trace`,
      ],
      follow_ups: [
        { q: `exemplar 是什么？`, hint: `Prometheus 2.26+ feature：Histogram 的每个 bucket 可附带 1-2 个示例（带 trace_id + span_id），Grafana 上可点击直接跳到对应 trace；OTel exporter 自动注入` },
        { q: `怎么估算 Histogram 的存储成本？`, hint: `每个 series 占 ~5KB/天，单个 endpoint 的 Histogram 通常有 10-15 buckets = 10-15 series；1000 endpoint × 15 buckets × 10 instance = 150k series ≈ 750MB/天` },
        { q: `Histogram quantile 在低 sample 下精度差怎么办？`, hint: `① 加大时间窗（5min → 30min）；② Native Histogram；③ 接受估算误差（业务 SLO 通常容忍 ±5%）` },
      ],
    },

    50: {
      why_asked: `验证候选人是否做过大型 tracing 系统的成本控制。能解释 tail sampling 内存代价的人通常做过 OTel Collector 部署。`,
      answers: {
        mid: `<strong>Tail sampling</strong> 在 Trace <strong>完成后</strong>再决定是否采样，能<strong>100% 保留有价值的 Trace</strong>（错误 / 慢请求 / 包含特殊业务标签），其他均匀采样 1%。<strong>Head sampling</strong> 在请求开始就决定，无法知道这条 Trace 是否"有趣"。`,
        senior: `<strong>典型 Tail sampling 规则</strong>：① 所有 error trace 100% 保留；② P99 以上延迟 100% 保留；③ 包含特定 tenant / endpoint 标签 100% 保留；④ 其他 1-5% 随机。最终采样后存储成本 / 10，但保留 95% 的"诊断价值"。`,
        staff: `深一层：Tail sampling 的<strong>代价是内存</strong>——Collector 必须缓存全部 trace（每条所有 span）直到 trace 结束才能决策。OTel Collector tail_sampling processor 典型配置 4-8 GB / node 内存，processing latency 几十 ms（等 trace timeout）。<strong>真实部署</strong>：电信项目 OTel Collector 集群 6 节点 × 16GB，处理 50k spans/s，tail sampling 后下游存储压力 -90%（之前每天 2TB → 200GB）。<strong>陷阱</strong>：① trace 超时设置不当（30s 不够长尾 service）→ 长 trace 被部分截断；② Collector 单点故障 → 缓存中 trace 全丢；③ 跨 Collector 节点的同 trace_id span 要 sticky routing（lb 按 trace_id 哈希）；④ Burst traffic 导致 OOM。<strong>对策</strong>：① 多副本 Collector + load balancing（按 trace_id consistent hash）；② 限制每 trace span 数量上限（防止单 trace 爆内存）；③ 监控 Collector 内存 + queue size；④ 紧急情况降级 head sampling。<strong>替代方案</strong>：① <strong>Probabilistic sampling</strong>（client side 简单随机，head sampling 的一种）；② <strong>Adaptive sampling</strong>（按 endpoint 历史数据动态调整 rate）；③ Service mesh 集成（Istio / Linkerd 自带 trace + sampling）。`,
      },
      failure_modes: [
        `不知道 tail sampling 需要 Collector 缓存所有 trace，部署完发现内存不够`,
        `没配 sticky routing，同 trace 的 span 分散到不同 Collector → 永远凑不齐 → drop`,
        `trace timeout 设太短 → 长 trace 中途被 flush，无法 tail sampling`,
        `Burst 流量打挂 Collector → 缓存丢，全部 trace 丢`,
        `用 head sampling 但跟踪关键业务路径（错误 trace 也丢）`,
      ],
      follow_ups: [
        { q: `Service mesh 跟 OTel 怎么配合？`, hint: `Istio / Linkerd 在 sidecar 注入 trace headers（B3 / W3C），自动建 server / client span；应用代码用 OTel SDK 加 business span；两者用相同 trace_id 拼成完整 trace` },
        { q: `怎么测试 tail sampling 规则？`, hint: `① OTel Collector 跑 unit test（input trace YAML + expected sampled output）；② canary 部署对比新旧规则 sample 率；③ load test 验证内存 / latency 在峰值正常` },
        { q: `Tail sampling 不够时怎么进一步降成本？`, hint: `① 删 verbose / debug log spans；② 限制 span attribute 数量；③ 大请求用 link 而非 child span；④ 转向 metric-from-trace（聚合后只存 metric） ` },
      ],
    },

    // ============== 软技能 / 沟通 / 角色 ==============
    51: {
      why_asked: `分布式 trace 跨服务必备协议。能背 traceparent 4 字段的人是真做过 OTel 集成。`,
      answers: {
        mid: `<code>traceparent: 00-{traceId 32 hex}-{spanId 16 hex}-{flags 2 hex}</code>。<strong>00</strong> = version，<strong>traceId</strong> = 128 bit 全局追踪 ID，<strong>spanId</strong> = 64 bit 当前 span，<strong>flags</strong> 含 sampled bit。`,
        senior: `<strong>完整格式</strong>: <code>00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01</code>—— 4 段用 <code>-</code> 分隔，全部 hex lowercase。<strong>关键字段</strong>：<br>· <strong>version (00)</strong>: W3C 当前唯一版本<br>· <strong>traceId</strong>: 全 0 = invalid；跨服务保持不变<br>· <strong>spanId</strong>: 每段 RPC 重新生成<br>· <strong>flags</strong>: 最低位 = sampled（1 = 上报，0 = 不上报）<br><br><strong>配套 tracestate</strong>（可选）: 厂商扩展 KV（如 <code>tracestate: vendor1=value1,vendor2=value2</code>），跨 vendor 信息透传。`,
        staff: `深一层：W3C TraceContext 是 2020 标准化的结果，<strong>取代</strong>各家自定义格式（B3 / X-Cloud-Trace-Context / Jaeger UBER-Trace-ID 等）。<strong>OTel SDK 默认</strong>注入 traceparent header，但部分老 vendor 仍只认 B3 → 配双 propagator（W3C + B3）兼容。<br><br><strong>实战陷阱</strong>：<br>① <strong>HTTP/2 / gRPC header 名大小写敏感</strong>—— traceparent 必须 lowercase；<br>② <strong>load balancer / proxy 不透传</strong>—— 早期 Nginx / Envoy 默认 strip 未知 header，需显式 forward；<br>③ <strong>跨 message broker</strong>（Kafka / RabbitMQ）—— message header 需手动注入 traceparent；<br>④ <strong>异步任务</strong>—— 入队时存 trace context，出队时 restore（OTel 提供 Context API）。<br><br><strong>真实案例</strong>：platform agent 项目跨 5 个 microservice + 2 个 message queue。上线 W3C TraceContext 前事故排查靠 grep log 找请求 ID，~30 min 拼一个 trace。上线后 Jaeger UI 30s 看完整调用链 + 时延 breakdown，<strong>P0 事故 MTTR 从 45 min 降到 12 min</strong>。`,
      },
      failure_modes: [
        `不区分 traceId / spanId（一个是全局，一个是单段）`,
        `B3 / W3C 混用导致 trace 断链`,
        `不知道 sampled bit，下游 sampler 错过关键 trace`,
        `跨 message broker 不传 traceparent → async 链路断`,
        `Header 名大小写错（W3C 强制 lowercase）`,
      ],
      follow_ups: [
        { q: `B3 跟 W3C TraceContext 区别？`, hint: `B3 (Zipkin) 用多个 header（X-B3-TraceId / X-B3-SpanId / X-B3-Sampled）；W3C 单个 traceparent header；2026 W3C 是主流，B3 仍兼容` },
        { q: `怎么自定义 sampler？`, hint: `① 实现 Sampler interface 返回 RECORD_AND_SAMPLE / DROP；② 常见：always-on / always-off / ratio / parent-based / rate-limited；③ Tail sampling 在 collector 端做（见 #50）` },
        { q: `tracestate 用来做什么？`, hint: `vendor-specific 扩展信息；典型用法：DataDog / NewRelic 传内部 ID + 采样决策；W3C 限制 32 KB / 32 entries` },
      ],
    },

    52: {
      why_asked: `SLO / Error Budget 是<strong>SRE 文化</strong>核心概念。能讲"基于 SLO 反推告警阈值 + 错误预算耗尽流程"的人是真做过 on-call 改进。`,
      answers: {
        mid: `不要凭感觉定 P99 阈值——基于 <strong>SLO</strong>（如可用性 99.9%）反推。<strong>Error Budget</strong> = 1 - SLO（如 0.1% 允许失败）。月度 budget 用完 → 冻结发布 / 全力修可靠性。`,
        senior: `<strong>SLI / SLO / SLA 三层</strong>：<br>· <strong>SLI (Service Level Indicator)</strong>: 实际度量（成功率 / P99 latency / 数据 freshness）<br>· <strong>SLO (Objective)</strong>: 内部目标（99.9% / 200ms）<br>· <strong>SLA (Agreement)</strong>: 对客户的合同承诺（通常宽于 SLO，违约赔钱）<br><strong>告警阈值</strong>: 不要"P99 &gt; 200ms 立刻 page"——基于 <strong>burn rate</strong>。如 30 天 budget 1 小时内烧掉 10% → fast burn alert（P0）；3 天烧掉 10% → slow burn（P1）。`,
        staff: `深一层：Error Budget 的<strong>真实价值</strong>不是告警阈值，是<strong>"平衡 reliability vs feature velocity"的契约</strong>。SRE 团队 + Dev 团队 share budget：① 系统稳 → 多 budget → dev 可以激进发布；② budget 用完 → 冻结发布 + SRE / Dev 一起修。<br><br><strong>多 SLO 实战</strong>：典型服务 3-5 个 SLO：<br>· 可用性 (success rate &gt; 99.9%)<br>· latency (P99 &lt; 200ms)<br>· 数据 freshness (P99 &lt; 5 min)<br>· 吞吐 / 容量<br>每个 SLO 独立 budget + alert + ownership。<br><br><strong>Burn rate alert 公式</strong>：<code>alert if (1h_error_rate &gt; 14.4 × SLO_budget) AND (5m_error_rate &gt; 14.4 × budget)</code>—— 双窗口避免误报（1h 抓真问题，5m 防止已恢复仍报警）。<br><br><strong>真实经验</strong>：platform agent 项目早期 P99 alert 5 分钟一次（午夜误报 + 周末 burnout）。改用 SLO + multi-window burn rate：alert 数 -85%，但<strong>真问题 catch rate 反而 +30%</strong>（之前误报多导致团队 alert fatigue 忽视真告警）。On-call 满意度从 4/10 → 8/10。<strong>工具</strong>：① Google SRE Workbook 提供完整 burn rate 算法；② Prometheus + Alertmanager 实现 multi-window；③ Datadog / NewRelic 内置 SLO dashboard。`,
      },
      failure_modes: [
        `把 SLO 当 SLA 用（内部目标 ≠ 客户承诺）`,
        `定 P99 &gt; X 立刻 page → alert fatigue`,
        `单窗口 burn rate（5 min）→ 大量误报`,
        `不跟 dev share budget → SRE/Dev 对立`,
        `没 process budget 耗尽 → 冻结发布只是嘴上说`,
      ],
      follow_ups: [
        { q: `Multi-window burn rate 怎么算？`, hint: `典型 4 个组合：1h&5m / 6h&30m / 1d&3h / 3d&12h，各对应不同 page 优先级；Google SRE Workbook Chapter 5 有详细公式` },
        { q: `SLI 怎么选？`, hint: `① 用户视角的"成功"（不是内部 RPC 成功率，是端到端用户成功率）；② 可量化 + 持续测；③ 反映 user-facing latency 而非 server 内部 timing；④ 标准模板：availability / latency / freshness / correctness / throughput` },
        { q: `Error budget 耗尽怎么办？`, hint: `① 冻结非必要发布；② Postmortem + action items；③ 调整 SLO（如果总耗尽说明 SLO 不现实）；④ 投资 reliability work（buffer / circuit breaker / 降级）` },
      ],
    },

    53: {
      why_asked: `初级 EM 必问角色区分。能讲"决策半径 + 时间尺度"维度的人是真做过架构师工作。`,
      answers: {
        mid: `用决策<strong>影响半径</strong> + <strong>时间尺度</strong>区分：<br>· <strong>Tech Lead</strong>: 影响<strong>一个服务 / 产品功能</strong>，时间尺度 <strong>1 季度</strong><br>· <strong>架构师</strong>: 影响<strong>多个服务 / 产品线</strong>，时间尺度 <strong>1-3 年</strong>`,
        senior: `<strong>详细对比</strong>：<br><table style="border-collapse:collapse"><tr><th>维度</th><th>Tech Lead</th><th>架构师</th></tr><tr><td>团队大小</td><td>5-10 人</td><td>横跨多团队</td></tr><tr><td>决策粒度</td><td>API 设计 / 模块拆分 / 选型</td><td>系统拆分 / 跨服务通信 / 演进策略</td></tr><tr><td>时间</td><td>季度 / 半年</td><td>1-3 年</td></tr><tr><td>code 比例</td><td>50-80%</td><td>10-30%</td></tr><tr><td>文档</td><td>设计文档 / PR review</td><td>ADR / RFC / 架构图 / 蓝图</td></tr></table>`,
        staff: `深一层：两个角色<strong>不是 hierarchy</strong>（架构师不一定比 TL 高）—— 是<strong>不同 track</strong>。Google 的 Staff/Senior Staff Engineer 经常做架构师的事但保留 IC title。<br><br><strong>真实经验</strong>：作为某产品 TL 3 年，发现自己 80% 时间在<strong>一个服务内</strong>做选型 + 教 team。后期晋升 Principal/Architect，时间分配反转：<br>· 跨 3-5 团队对齐架构方向（30%）<br>· 写 ADR / Tech Strategy 文档（25%）<br>· Tech debt 战略规划（15%）<br>· 跨团队 design review（15%）<br>· 自己写代码（&lt; 10%）<br><br>转型最难的不是技术深度，是<strong>"接受 80% 时间不写代码"</strong>+ <strong>"靠影响力而非权威推动"</strong>。<br><br><strong>陷阱</strong>：① TL 升架构师后还想"动手做"—— 时间不够；② 架构师不下来跟 team 写代码 → 架构空中楼阁 / 失去 calibration；③ 把"做架构师"等同于"画图"—— 80% 价值在<strong>判断 + 沟通 + 写决策文档</strong>。`,
      },
      failure_modes: [
        `认为架构师 = TL 升级版（实际是不同 track）`,
        `把 "架构" 等同于 "画图"`,
        `升架构师后不再下沉团队 → 失去现实 feedback`,
        `不用 ADR 记录决策 → 半年后没人记得为什么这么定`,
        `不区分 1-2 年 vs 5-10 年时间尺度的决策`,
      ],
      follow_ups: [
        { q: `怎么从 TL 转架构师？`, hint: `① 主动 take 跨团队 design review；② 写 1-2 个 long-term tech strategy 文档；③ Show influence beyond own team；④ Volunteer 当公司架构委员会成员 / RFC author` },
        { q: `Senior 架构师 vs Principal 架构师区别？`, hint: `① Senior：单产品线 / business unit；② Principal：跨业务线 / 整个公司 tech direction；③ 影响力 + 复杂度差一个 order of magnitude` },
        { q: `架构师该做多少 coding？`, hint: `① 0% 危险（失 calibration）；② 50%+ 也危险（没时间影响）；③ 健康 10-25%——保持手感 + 关键模块 prototype + 帮 team unblock` },
      ],
    },

    54: {
      why_asked: `行为题模板，几乎每个架构师 / Staff 面试必出。能用 STAR + ADR 结构的人通过；散讲故事的人 fail。`,
      answers: {
        mid: `用 <strong>STAR + ADR</strong> 结构：<br>· <strong>S</strong>itutation：当时业务背景<br>· <strong>T</strong>ask：要解决的问题（<strong>量化质量属性</strong>—— 性能 / 可用性 / 成本）<br>· <strong>A</strong>ction：列出 <strong>2-3 个候选方案</strong> + 取舍<br>· <strong>R</strong>esult：选了哪个 + 实际效果（量化）`,
        senior: `<strong>详细 talk track（4-5 min 版本）</strong>：<br>1. <strong>S (30 sec)</strong>: "项目背景 X，团队 Y 人，预算 Z 万，时间 N 个月"<br>2. <strong>T (45 sec)</strong>: "关键约束：P99 &lt; 100ms / 可用性 99.95% / 月成本 &lt; $50k"<br>3. <strong>A (2.5 min)</strong>: "我考虑了 3 方案：① A 方案 优势 X 劣势 Y；② B 方案 ...；③ C 方案 ..."—— 显示 trade-off 思维<br>4. <strong>选了 B</strong>（明确表态 + 理由）<br>5. <strong>R (45 sec)</strong>: "结果 P99 = 80ms，可用性 99.97%，成本 $42k / 月。事后回顾 X 没考虑到 Y，但整体决策对。"`,
        staff: `深一层：这道题考<strong>3 个信号</strong>：① 真做过<strong>架构级</strong>决策（不是 module 选型）；② <strong>结构化思考</strong>（不只一个方案）；③ <strong>事后 calibrate</strong>（敢承认哪部分判断错）。<br><br><strong>真实例子 talk track</strong>："platform agent v3 替代 vendor proprietary agent。S: 8 个 enterprise 客户用旧 vendor agent 但反馈性能差，公司想自研。T: 3 大约束：① P99 RPC latency &lt; 5ms（vendor ~50ms）；② 兼容 8 个客户 device firmware；③ 6 个月内 ship + 在 EOS 前完成 customer migration。A: 我列了 3 方案：① fork 开源 config-store + 改造（短期快，长期 maintenance 重）；② 完全自研（控制全 + 周期长）；③ 跟 vendor X 合作 OEM（费用高 + 失去 differentiation）。我选了 ②自研——原因是 customer 需要 30% 定制 + competitive moat 重要。R: 6 个月 ship + P99 = 4ms（超 SLO）+ 7/8 客户成功 migrate。事后看 customer firmware 兼容性 underestimate，多投入 2 工程师月。<strong>整体决策对</strong>—— 4 年后这块代码仍在用，竞品没赶上。"<br><br><strong>陷阱</strong>：① 故事散没结构；② 只讲选了什么，不讲<strong>没选什么 + 为什么</strong>（缺 trade-off 思维）；③ R 没量化；④ 不承认任何错误判断 → 显得不 calibrated。`,
      },
      failure_modes: [
        `故事散乱无 STAR 骨架`,
        `只讲选了什么不讲 alternatives → trade-off 思维缺失`,
        `R 段无量化`,
        `不承认 calibration miss → 不 honest`,
        `选的"决策"太小（属于 TL 级，不是架构级）`,
      ],
      follow_ups: [
        { q: `什么样的决策算"架构级"？`, hint: `① 影响半径跨多服务 / 多团队；② 时间尺度 &gt; 1 年；③ 回滚成本月级；④ 影响系统的核心质量属性（性能 / 可扩展 / 可演进）` },
        { q: `如果选错了怎么办？`, hint: `① 用相同 ADR 框架记新决策；② Postmortem 不 blame 个人；③ 显示 learning + 后续改进；④ 大多数错决策可分阶段 walk-back（feature flag / 渐进迁移）` },
        { q: `怎么准备这道题？`, hint: `① 准备 2-3 个 ADR 故事（不同维度：性能 / 可用性 / 成本）；② 4 min + 90 sec 两版本；③ 故意留钩子让面试官追问；④ 跟 mentor mock 录音听结构` },
      ],
    },

    55: {
      why_asked: `架构师常被吐槽"太技术"。能把决策<strong>翻译成业务语言</strong>的人能晋升到 Principal。`,
      answers: {
        mid: `翻译成业务语言：<br>· 用<strong>业务影响</strong>（用户体验 / 营收 / 风险）<br>· 用<strong>类比</strong>（"分布式锁就像图书馆的借阅卡"）<br>· 用<strong>数字</strong>（"P99 从 200ms 降到 50ms = 转化率提升 X%"）`,
        senior: `<strong>4 个翻译技巧</strong>：<br>1. <strong>性能 → 转化 / 留存</strong>：Amazon 数据 "100ms 延迟降低 1% 销售"<br>2. <strong>可用性 → 客户信任 + SLA 赔款</strong>：99.9% → 99.95% 等于"每月减少 22 min 不可用"<br>3. <strong>技术债 → 速度 + 风险</strong>："这块代码每个 feature 多花 50% 时间，且 P0 事故概率 +30%"<br>4. <strong>架构演进 → 长期战略 + ROI</strong>："今年投 3 工程师月，未来 3 年节省 20 工程师月"`,
        staff: `深一层：能向业务沟通是<strong>Senior → Principal</strong> 的关键跃迁。Principal 不只是技术好，是"<strong>能把技术决策跟商业目标对齐</strong>"。<br><br><strong>实战示例</strong>：要从单体 → 微服务迁移，工程团队想做但 VP 不批。<br>· <strong>技术语言</strong>（差）："我们想拆 microservice，更解耦、scale 好、技术栈灵活"<br>· <strong>业务语言</strong>（好）："过去 6 个月 90% 的事故都源于<strong>单体内部模块互相影响</strong>。每次 deploy 风险高 → 团队不敢发布 → 平均 ship cadence 从 weekly 退化到 monthly → 我们丢了 3 个 customer feature competitive opportunity。投资 6 个月做微服务拆分，估算可恢复 weekly deploy，同时降低 P0 事故概率 60%。"<br><br><strong>关键</strong>：<br>① 用<strong>VP 听得懂的指标</strong>（事故数 / ship cadence / customer impact）<br>② <strong>量化</strong>（"60%" 不是"提升很多"）<br>③ <strong>类比</strong>（如对非技术 VP："微服务就像把一栋楼拆成 30 间公寓——每间装修不影响其他"）<br>④ <strong>明确 ask</strong>（不是讲完了，是要 "approve 6 个月投入 5 人"）<br><br><strong>陷阱</strong>：① 技术细节给非技术听 → 失去注意力；② "我们 engineer 觉得..." 弱论证（用数据）；③ 不给业务方 trade-off → 显得只索取不付出；④ 没 follow up 量化结果 → 下次他们不再 trust。`,
      },
      failure_modes: [
        `技术语言 vs 业务方 → 听不懂或不感兴趣`,
        `没量化（"提升很多"）`,
        `没类比 → 抽象`,
        `没明确 ask（要钱要人要时间）`,
        `没 follow up 量化实际结果`,
      ],
      follow_ups: [
        { q: `VP 反复问 "ROI 在哪" 怎么办？`, hint: `① 给具体数字（人月 vs 节省人月）；② 类似过去 case study；③ Phased plan + 阶段 milestone；④ 接受 "VP 没 buy in" 可能要 walk away 不强推` },
        { q: `怎么获取非技术领域的业务直觉？`, hint: `① 听几次 Sales call；② Skip-level meet customer-facing role；③ 每 quarter 读公司 OKR + 财报；④ 跟 PM / 销售 1on1 学习他们关注什么` },
        { q: `决策失败怎么向业务方解释？`, hint: `① 直接 own（不甩 engineer）；② 量化损失；③ 列学到什么；④ 重建 credibility 靠下一个决策的成功` },
      ],
    },

    56: {
      why_asked: `Build vs Buy 是 EM/架构师常见题。能讲<strong>4 维度框架 + 真案例</strong>的人是真做过 SaaS 选型。`,
      answers: {
        mid: `看四个维度：<br>· <strong>核心竞争力？</strong>（Core Domain → 自研）<br>· <strong>团队能力？</strong>（不擅长 → 买）<br>· <strong>成本？</strong>（人力 + 维护 vs 订阅）<br>· <strong>定制需求？</strong>（标准化 → 买；定制重 → 自研）`,
        senior: `<strong>详细评估</strong>：<br>1. <strong>战略 (DDD Core/Supporting/Generic)</strong>: <br>· Core Domain（差异化能力）→ <strong>必须自研</strong><br>· Supporting Domain → flexible<br>· Generic Domain（如认证 / 日志 / monitoring）→ <strong>必须买</strong><br>2. <strong>TCO (3 year)</strong>:<br>· Build: 工程师 × 月 × 薪资 + 后续维护人月（通常被低估 3×）<br>· Buy: 订阅费 + 集成成本 + vendor lock-in 风险<br>3. <strong>Time-to-Market</strong>: Buy 通常 2-3× faster<br>4. <strong>Risk</strong>:<br>· Build: schedule slip / quality issue<br>· Buy: vendor 跑路 / 涨价 / 不满足需求`,
        staff: `深一层：90% 的 Build vs Buy 错误是<strong>"高估自研价值 + 低估 maintenance 成本"</strong>。<br><br><strong>真实案例 1 (Buy 决策正确)</strong>: 我作为架构师建议<strong>买 Auth0</strong> 而不是自研 OAuth/SSO。Engineering 抵触："这有什么难？我们 1 个月写完。" → 我用 TCO 算："1 个月写 + 3 年维护（密码 rotation / SAML / SCIM / 客户 IT 兼容）= 24 工程师月 = $400k。Auth0 是 $50k/年 = $150k 3 年。Buy 节省 $250k + 团队精力 focus 在 core domain。"<br><br><strong>真实案例 2 (Build 决策正确)</strong>: platform agent vendor product 想"<strong>买 cisco SDN 然后包装</strong>"，我反对。理由：① platform agent 是<strong>Core Domain</strong>（公司差异化在这），不能依赖竞争对手；② vendor lock-in 致命；③ 定制需求 vendor 不会满足。最终自研，成为公司 moat。<br><br><strong>陷阱</strong>：① <strong>NIH（Not Invented Here）综合症</strong>—— engineer 倾向自研，需要 EM/架构师推 buy；② <strong>低估 maintenance</strong>—— "build it & forget it" 不存在；③ <strong>过分依赖 vendor</strong>—— 关键 core domain 买 → 失去 differentiation；④ <strong>没 exit strategy</strong>—— buy 了但不准备 vendor lock-in escape plan。`,
      },
      failure_modes: [
        `NIH 直觉自研所有 → 团队精力分散`,
        `低估 maintenance 成本（典型 underestimate 3×）`,
        `Core Domain 买 → 失去 differentiation`,
        `Generic Domain 自研 → 浪费资源`,
        `没 exit strategy 应对 vendor lock-in`,
      ],
      follow_ups: [
        { q: `怎么评估 vendor lock-in 风险？`, hint: `① Switching cost（API / data export / 培训）；② Vendor 财务健康度（现金流 / 增长 / acquisition risk）；③ 替代方案存在？；④ 标准协议 vs proprietary` },
        { q: `Hybrid 方案怎么做？`, hint: `① Build 核心 + Buy 非核心组件（如自研 RPC + 买 Auth）；② Buy + 包装自己 API（hide vendor lock-in）；③ 双 vendor（Multi-cloud / 双 DB）；④ 渐进 build out（先 buy 后逐步替换核心）` },
        { q: `已经买了发现不合适怎么办？`, hint: `① 评估 switching cost vs 继续容忍；② Build 一个轻量替代 layer；③ 跟 vendor 谈定制 / 影响 roadmap；④ Walk away（要写好 exit plan + 数据迁移）` },
      ],
    },

    57: {
      why_asked: `技术债是 EM/架构师永恒话题。能<strong>翻译成业务语言 + 量化</strong>的人能成功争取到资源。`,
      answers: {
        mid: `把技术债翻译成<strong>业务影响</strong>：<br>· <strong>量化</strong>："这块代码每次改动 5 人天，重构后 1 人天"<br>· <strong>风险化</strong>："这个 bug 每月发生 1 次，重构后归零"<br>· <strong>速度化</strong>："修了之后新功能开发提速 30%"`,
        senior: `<strong>4 类技术债 + 各自论证</strong>：<br>1. <strong>代码债</strong>（重复 / 死代码 / 复杂度高）→ 量化"每个 feature 多花 X 时间"<br>2. <strong>架构债</strong>（耦合 / 拆分不合理）→ 风险化"每个 deploy P0 风险 X%"<br>3. <strong>测试债</strong>（覆盖率低 / E2E 缺失）→ 风险化"production bug 数 / 月"<br>4. <strong>工具债</strong>（CI 慢 / 部署手动）→ 速度化"build time / deploy time"<br><br><strong>策略</strong>：① <strong>不一次性还清</strong>—— 每 sprint 20% capacity；② <strong>跟 feature 绑定</strong>—— "做 X feature 时顺便重构 Y"；③ <strong>tracked Jira backlog</strong> 不只是嘴上说`,
        staff: `深一层：技术债跟金融债一样—— <strong>不全是坏</strong>。Martin Fowler 把技术债分 <strong>4 象限</strong>（Reckless / Prudent × Deliberate / Inadvertent）：<br>· Prudent Deliberate（"我们知道是 quick fix，下季度重构"）—— <strong>健康</strong><br>· Prudent Inadvertent（"做完才发现有更好方法"）—— 正常学习<br>· Reckless Deliberate（"<strong>我们不在乎 best practice 直接 ship</strong>"）—— 致命<br>· Reckless Inadvertent（"我们也不知道 best practice"）—— 团队成熟度不够<br><br><strong>真实案例</strong>: platform agent v2 累积 18 个月技术债，团队抱怨但 VP "为啥要花时间重构？"。我做了 3 步：<br>1. <strong>量化</strong>: 对比新 feature 在 v1（无债）vs v2 的开发时间，发现 v2 平均 2× 慢。<br>2. <strong>风险化</strong>: 列出过去 6 个月 P0 事故，<strong>75% 直接关联到 3 个技术债区域</strong>。<br>3. <strong>提案</strong>: 不是 "停所有 feature 重构 3 个月"，是 <strong>每 quarter dedicate 20% capacity（2 工程师）</strong> 攻 top 3 债区，2 个 quarter 完成。<br>VP 同意。Quarter 1 后 P0 事故 -50%，feature ship 速度 +30%。Quarter 2 后 v2 重构完成，团队 satisfaction +35%。<br><br><strong>陷阱</strong>：① 用技术语言（"代码不干净"）VP 不 care；② 要"<strong>全部停止 feature 3 个月</strong>"—— 不现实；③ 不 tracked → 团队私下做 → 没 credit；④ "<strong>tech debt 永远还不清</strong>"心态 → 不投入。`,
      },
      failure_modes: [
        `用 "代码不干净" 这种纯技术语言`,
        `要求 100% capacity 停 feature 还债（不现实）`,
        `不量化（"我感觉很慢"）`,
        `不 tracked Jira → 没 credit + 易回潮`,
        `认为技术债不能还（应有 plan）`,
      ],
      follow_ups: [
        { q: `Reckless 技术债怎么处理？`, hint: `① 公开 calibrate—— 老板团队都知道；② Postmortem 找 process gap；③ 改 dev process（如 mandatory design review / pair）；④ 严重时换流程 / 换 lead` },
        { q: `怎么决定哪个债先还？`, hint: `① Cost-of-Delay（如不还每月损失 X）；② Risk × Probability；③ 跟 hot feature 区域重叠；④ Engineer 满意度（影响 retention）` },
        { q: `Code review 时怎么 prevent new 技术债？`, hint: `① Checklist（包括 test coverage / doc / API consistency）；② "tech debt tag" 在 PR 显式标 + Jira link；③ 季度回顾累积 tag 数；④ Boy Scout Rule—— leave 比 found 更干净` },
      ],
    },

    58: {
      why_asked: `Legacy 演进必问。能讲<strong>Strangler Fig 模式</strong>+ Joel Spolsky 名言的人是真做过 migration。`,
      answers: {
        mid: `几乎总是<strong>渐进（Strangler Fig）</strong>。Joel Spolsky 名言："<strong>Rewriting from scratch is the single worst strategic mistake</strong>" (2000)。`,
        senior: `<strong>Strangler Fig 模式</strong>（Martin Fowler 命名 from strangler vine 攀附老树）:<br>1. 老系统继续跑<br>2. 新 feature 写到<strong>新代码</strong>里<br>3. 老 feature <strong>逐个迁移</strong>到新代码<br>4. 老代码逐渐"被勒死"<br>5. 直到全部迁完关掉老系统<br><br><strong>关键技术</strong>: <strong>Anti-Corruption Layer</strong>—— 新老系统间放 translation layer，保证<strong>新代码不被老 schema 污染</strong>。<br><br><strong>大重写的真实代价</strong>: ① Netscape 6 大重写 → 2 年没新版本 → 市场份额 95% → 25%；② 99% "大重写" 项目延期 2x + 老 bug 重现 + 新 bug + 失去客户。`,
        staff: `深一层：渐进 vs 大重写的<strong>本质判断</strong>是<strong>"老系统的隐含知识"成本</strong>。Joel Spolsky 原文洞察："code 是<strong>bug fix 多年沉淀的结果</strong>，每个奇怪的 if 都是某个 bug 的 fix。重写丢掉这些隐含 fix → 老 bug 全部重现"。<br><br><strong>渐进的 4 个关键技术</strong>：<br>1. <strong>Strangler Fig</strong>（见上）—— 入口路由 layer 决定走老还是新<br>2. <strong>Feature Toggle</strong>—— 同 codepath 同时跑新老，金丝雀切流量<br>3. <strong>Anti-Corruption Layer</strong>—— DDD 模式，新老 schema 翻译<br>4. <strong>Event Sourcing</strong>—— 用事件流让新老系统都消费同源数据<br><br><strong>真实案例</strong>: platform agent v3 替代 v2（5 年老代码 + 8 个客户在用）。VP 一开始想"3 个月大重写 ship 全新版本"。我反对，提渐进：<br>1. <strong>v3 跟 v2 并行</strong> 跑（双 binary）；客户可选<br>2. <strong>新功能</strong> 只在 v3 实现<br>3. <strong>老功能逐模块</strong>迁（每月 1-2 个 module）<br>4. <strong>v2 维护降为 critical fix only</strong><br>5. <strong>客户逐个迁</strong>到 v3（不强制）<br>6. <strong>18 个月</strong>后 v2 client 数为 0 → 关停<br><br>结果：① 18 个月平稳过渡（vs 大重写预测 6 个月但 95% 概率延期到 12-24 月 + 中途客户流失）；② 期间 0 客户因 migration 流失；③ 团队<strong>持续 ship</strong> 不中断；④ 团队 morale 高（不是"被困在没 ship 的大重构里"）。<br><br><strong>什么时候大重写 OK？</strong>极少：① 老系统已死（用户极少 / 已 EOS）；② 技术栈彻底过时（如 Flash → modern web）；③ 不需要兼容（greenfield 新业务线）；④ 团队能力远超原作者—— 通常这 4 条全满足才考虑。`,
      },
      failure_modes: [
        `直接大重写 → 99% 失败 case`,
        `没 Anti-Corruption Layer → 新代码被老 schema 污染`,
        `不双跑 → 切流量风险大`,
        `Migration 不 incremental → 一刀切 fail`,
        `不准备 rollback plan`,
      ],
      follow_ups: [
        { q: `怎么决定哪个 module 先迁？`, hint: `① 业务价值 + 改动频率（hot module 先迁）；② 跟新需求重叠（顺便迁）；③ 解耦度高的（依赖少先迁）；④ Risk + ROI 矩阵` },
        { q: `渐进时间太长团队 morale 怎么办？`, hint: `① 显式 milestone celebration；② 数据看板 progress（X% 迁完）；③ 短期 win 加快（小 module 优先）；④ 跟 leadership communicate ROI` },
        { q: `什么时候应该承认渐进失败选择大重写？`, hint: `① 渐进 18+ 月仍 &lt; 30% 迁完；② 老系统持续产生 P0 事故；③ Anti-Corruption Layer 比新代码还复杂；④ 团队 90% 时间在 maintain 老代码—— 这时考虑切割老系统 + 大重写新模块` },
      ],
    },

    59: {
      why_asked: `Senior 架构师必备<strong>影响力</strong>题。能讲"权威/论证/共创 3 层"+ Sponsor 配合的人是真做过 cross-team。`,
      answers: {
        mid: `三个层次：<br>1. <strong>权威</strong>（凭借头衔，最弱）<br>2. <strong>论证</strong>（用数据、ADR、ATAM 矩阵——架构师常用）<br>3. <strong>共创</strong>（让团队参与设计，最强）`,
        senior: `<strong>3 层详解</strong>：<br>· <strong>权威</strong>: "我是架构师所以这么定"——团队短期服从但内心不 buy in，长期反弹<br>· <strong>论证</strong>: 用 ADR 列方案 trade-off、用 ATAM 量化质量属性、用 prototype 验证—— Senior 主流方式<br>· <strong>共创</strong>: Design workshop / RFC 评审让团队提出方案，架构师做 facilitator + 收敛 → 团队 ownership 高，执行力强<br><br><strong>选择策略</strong>：① 紧急 P0 → 偏权威；② 中长期方向 → 偏论证；③ 战略级 + 跨多团队 → 必须共创。`,
        staff: `深一层：作为 Principal 架构师，<strong>"被服从"vs"被信服"</strong>区别巨大。被服从可能是 fear，被信服是 belief。前者只在 you watch 时 work，后者团队自己 enforce。<br><br><strong>真实策略组合</strong>：<br>1. <strong>提前 1on1</strong>：跟关键 tech lead 个别聊，让他们提前 buy in / 提 concerns→ 公开 meeting 时已有 advocate<br>2. <strong>RFC + 评审周</strong>：草稿发出 → 1-2 周收 comments → 公开 review meeting—— 不是当场说服，是<strong>结构化 collect feedback</strong><br>3. <strong>ADR + 显式 trade-off</strong>：不藏短，把 alternative 也写下来——团队感觉"被尊重 + 我也想到了 X，被采纳"<br>4. <strong>Sponsor 配合</strong>：跟 VP / Skip-level pre-align → meeting 时 VP 不会突然推翻<br>5. <strong>Pilot + data</strong>：小范围试点 → 数据说话 → 全推时阻力小<br><br><strong>真实案例</strong>: 推一个"所有微服务统一用 OTel"决策（影响 8 个团队）：<br>1. RFC 草稿 → email list 1 周<br>2. 跟 8 个 tech lead 各 1on1（共 6 小时）<br>3. 公开 design review（2 小时，70% comments 已在 1on1 解决）<br>4. ADR 记录 + 加 phased rollout plan<br>5. Pilot 2 个团队 → 6 周后 share data<br>6. 全推时<strong>0 阻力</strong>，反而 4 个团队主动来加速接入<br><br><strong>陷阱</strong>：① 跳过 1on1 直接公开会议 → ego 阻力大；② 不写 ADR → 一个月后没人记得决定；③ 不 pilot → 全推时翻车；④ 没 Sponsor pre-align → VP 当场否决；⑤ "<strong>共创"流于形式</strong>—— 假装共创但已内定结果，团队识破后 trust 崩。`,
      },
      failure_modes: [
        `凭权威推 → 短期服从长期反弹`,
        `跳过 1on1 直接公开会议 → ego 阻力`,
        `不写 ADR → 半年后没人记得`,
        `不 pilot 直接全推 → 翻车`,
        `假共创（已内定）→ trust 崩`,
      ],
      follow_ups: [
        { q: `团队 vocal 反对你的方案怎么办？`, hint: `① 不 defend，先 "good point, walk me through"；② 看反对是否触及核心质量属性 → 真问题修改方案；③ 不触核心但仍反对 → ADR 记录他们的 concern + 决定理由` },
        { q: `Sponsor 跟你 align 但实际推进时遇阻？`, hint: `① 跟 sponsor 1on1 update；② 让 sponsor 出场 reinforce（不能你自己 push）；③ 如果 sponsor 也退缩 → 重新评估决策；④ Senior 架构师重要技能：知道何时该 walk away` },
        { q: `跨团队架构治理怎么 scale？`, hint: `① Architecture Review Board（季度评审 critical decisions）；② RFC process 标准化；③ Tech radar（推荐 / 容忍 / 拒绝 技术列表）；④ Tech strategy 文档每年 refresh` },
      ],
    },
  },

  em: {
    // ============== 转型 ==============
    1: {
      why_asked: `面试 EM 的<strong>开场必问题</strong>，验证 motivation。能区分"推/拉/准备"三层结构的人通常想过自己为什么转型，而不是被动跟风。这道题答得好，整个面试基调就立住了。`,
      answers: {
        mid: `三层结构（推 / 拉 / 准备）：<strong>推</strong>——作为 IC 发现"个人产出"天花板，10 人团队的 leverage = 10× 单人；<strong>拉</strong>——在 Tech Lead 阶段发现自己更享受"团队 / 流程"问题，享受帮人成长；<strong>准备</strong>——过去半年带 mentee / 主导 onboarding / 读过 EM 经典书。`,
        senior: `比"想转 EM"更有说服力的是<strong>"我在做 IC 时已经在做 EM 的工作"</strong>：mentor 2 个 junior 一年 / 主持团队的 sprint planning / 设计了 oncall rotation / 跨团队推动了某个共识。<strong>红旗答法</strong>："不想写代码了" / "想要 title" / "想管人"——EM 不是 IC 的"下一级"，是平行轨道，混淆这个信号说明候选人不理解角色。`,
        staff: `更深一层：能讲<strong>"我考虑过放弃 EM 路"的情景</strong>——比如做了 6 个月 Tech Lead 后认真想过 IC track，最后选择 EM 是因为发现自己在解决"系统级问题"（沟通 / 流程 / 招聘）时更有杠杆和成就感。<strong>真实经验</strong>：我在 RPC 团队从 senior dev 转 lead 时，前 3 个月还在写代码（每周 50%+），后来意识到团队 5 人时我"代码贡献"+"被打断频次"开始负反馈——同样 1h 我做 review + 1on1 比写代码价值高 10×。这个量化体验让我确认 EM 是对的方向。<strong>对面试官</strong>：还要展现你<strong>清楚 EM 工作的非光鲜面</strong>——比如裁员谈话、低绩效辅导、跨部门扯皮——能讲出"我准备好面对这些"的人是真做过功课。`,
      },
      failure_modes: [
        `"不想写代码了" / "想要 title" / "想管人"（典型红旗，所有 EM 面试官立刻警觉）`,
        `只讲推力没讲拉力（"IC 没意思了"，但没说"为什么 EM 更适合我"）`,
        `没准备阶段（"我觉得我能管理"，没有具体 mentor / TL / onboarding 等过渡经验）`,
        `期待"管人 = 不写代码"（实际 EM 早期 30%-50% 时间还会写关键路径代码）`,
        `没考虑过非光鲜面（裁员 / PIP / 内卷 / 当夹心饼干），暴露 expectation gap`,
      ],
      follow_ups: [
        { q: `你做过的"EM-like" 工作能举 3 个具体例子吗？`, hint: `Mentor / 主导 onboarding / 做 hiring 面试 / 设计流程 / 跨团队推动 / oncall 设计——具体到"我做了 X，结果 Y"` },
        { q: `想象一下 EM 6 个月后你会后悔什么？`, hint: `坦诚回答 trade-off：写代码变少 / 处理人事问题增加 / 个人产出感降低；但用"我接受这个 trade-off 因为..."收尾` },
        { q: `如果做 EM 1 年发现不适合，你会怎么办？`, hint: `① 跟老板坦诚谈；② 回 IC track（很多公司 EM↔IC 是 reversible）；③ 总结学到的人事经验对 IC 也有用——展现成熟心态` },
      ],
    },

    2: {
      why_asked: `验证候选人是否真规划过 EM 入职。能给"Watch More Than Act"心态的人通常不会犯"新官三把火"反模式。`,
      answers: {
        mid: `<strong>Watch More Than Act</strong>（前 30 天看 80% 动 20%）：① 1on1 每个团队成员 + skip-level + 跨部门 stakeholders（目标 ≥ 15 个会议）；② 读 6 个月内的 PR / Postmortem / OKR / 1on1 历史；③ 列 Top 3 体感问题但<strong>暂不动</strong>；④ 第 30 天给老板 30-60-90 day plan。`,
        senior: `Michael Watkins《The First 90 Days》经典框架：<strong>Diagnose → Strategy → Action → Network → Self-management</strong> 五个 imperatives。<strong>关键原则</strong>：① 第一个月<strong>不做任何流程改动</strong>（除非线上着火）；② 早期投资关系比早期"展示能力"重要 5×；③ 第 30 天 plan 要老板签字（确保对齐），第 60 天复盘，第 90 天产出第一个 visible win。`,
        staff: `深一层：30-60-90 day plan 的<strong>真实价值</strong>不在 plan 本身，而在它创造"<strong>跟老板的对齐时刻</strong>"——很多新 EM 失败是因为半年后才发现自己理解的"重点"跟老板不一样，30 day check-in 强制对齐避免这个坑。<strong>真实经验</strong>：在两次空降 EM 的经历里，我都用了这套：第 1 周列出"我注意到的 5 件事"但只问不评论；第 2-3 周做 15+ 1on1；第 4 周写 30-60-90 plan 跟老板 walk-through + 改 3 轮才签字；之后每月对照 plan 复盘。<strong>结果</strong>：第二次空降时第 100 天产出了一个跨团队 oncall 改革（团队反馈 NPS +30），如果第一天就开干这种规模的改动会被当成"新 EM 自己来抢功"。<strong>陷阱</strong>：① 30 天什么都不动 → 团队怀疑你不作为；② 30 天动太多 → 团队怀疑你不了解情况就拍板；正解：<strong>quick win 找 1-2 个"明显共识"的小问题</strong>（如修补一个老 bug 流程），同时声明大改动等 90 天后。<strong>团队信号</strong>：第 30 天对你的 NPS 应该 +10 到 +20，如果 -10 是危险信号。`,
      },
      failure_modes: [
        `"新官三把火"——上来就改流程 / 换工具 / 重组团队（团队失去信任）`,
        `闭门 30 天读文档，1on1 做得敷衍（关系基础没打好）`,
        `30 day plan 自己写完不跟老板对齐就开干（跑偏风险）`,
        `30-60-90 都是 abstract 目标（"提升团队"），没量化 / 没 deliverables`,
        `Skip-level meetings 跳过（老板的 boss 没建立印象，关键决策时没人帮你）`,
      ],
      follow_ups: [
        { q: `30 天 1on1 你会问什么？`, hint: `① 你最喜欢 / 最不喜欢什么；② 我能怎么帮你；③ 你觉得团队最大问题是什么；④ 上一个 EM 做得好 / 不好的；⑤ 你的 6 个月目标` },
        { q: `第一个 visible win 怎么选？`, hint: `① 团队普遍认同的痛点（不能 controversial）；② 30-60 天内能 deliver；③ 改善有可观察指标；④ 不抢功劳（让团队成员当 owner）` },
        { q: `如果团队第 30 天对你失望怎么办？`, hint: `① 直接 retro：约一个 group 会议明确说"我希望听反馈"；② 调整后续 60-day plan；③ 跟老板 escalate 要支援；不要忍——signals 越早处理越好` },
      ],
    },

    3: {
      why_asked: `验证 EM 是否能在不同团队规模下做出正确的"自己写多少代码"判断。这道题的<strong>陷阱在于一刀切的回答</strong>（"完全不写"或"还是要写"都是错答）。`,
      answers: {
        mid: `<strong>看团队规模 + 阶段</strong>：<br>· ≤ 5 人 / 早期：<strong>还要写</strong>，关键路径 + 概念验证（占 30-50%）<br>· 5-15 人 / 稳定：<strong>少写</strong>，code review + 紧急修复 + 工具脚本（占 10-20%）<br>· ≥ 15 人 / 平台：<strong>基本不写</strong>，留时间给体系建设`,
        senior: `<strong>陷阱：自己抢功能开发</strong>——团队失去成长机会，你也丢了 EM 视角。<strong>名言：管理者写代码是为了保持技术判断力，不是为了产出代码。</strong>你写的代码应该是 ① 团队没人有空 OR ② 概念验证（探索新技术）OR ③ 工具脚本（提升团队效率）。绝不抢核心 feature。`,
        staff: `深一层：<strong>"还要不要写"的真问题是"我怎么保持技术权威 / 判断力"</strong>。3 种方式同等重要：① 写代码（最直接但 zero-sum）；② 深度 code review（一周 5+ 次，重点是 architecture 决策）；③ 跟踪关键设计 doc / ADR（参与不主导）。<strong>真实经验</strong>：我在团队从 5 人到 12 人的过程中，写代码占比从 50% 降到 10%，但<strong>technical judgement</strong> 没退化——因为我把"写代码时间"换成"和 senior dev 1on1 讨论架构 / paired code review / 读 PR"。一年后我对系统的细节理解比 50% 时还更深，因为<strong>整体视角</strong>多了。<strong>反模式</strong>：见过 EM 强行抢核心 feature 来"保持手感"，结果团队成员怨声载道（"为什么有意思的活都给老板"），自己也因为时间分裂导致 review 慢 + 1on1 被 reschedule + 团队 NPS 下滑。<strong>判断标准</strong>：每周一次自问，"如果我消失一周，谁能 cover？" 答得出名字才健康；答不出说明我抢了不该抢的活，必须让出去。`,
      },
      failure_modes: [
        `给绝对答案（"完全不写"或"必须每周 50%"），不看团队规模 / 阶段`,
        `自己抢核心 feature（"我比较快"），剥夺团队成员成长机会`,
        `完全不碰代码，半年后 code review 流于形式 / 技术判断力退化`,
        `把"写代码"当 individual contribution，不愿放下"工程师身份认同"`,
        `没设计"保持技术敏感"的替代机制（review / ADR / paired design）→ 真的脱节`,
      ],
      follow_ups: [
        { q: `团队对"老板还写代码"的反应是什么？`, hint: `双面：① 受尊重（"老板还接地气"）；② 但抢核心 feature 时反感；正解：写 supporting / tooling / spike，不写流量主线` },
        { q: `EM 怎么持续保持技术敏感度？`, hint: `① Code review 一周 5+ 次（不只看 LGTM 而是讨论 architecture）；② 参加技术评审 / ADR 讨论；③ 自己读论文 / blog；④ pair programming 偶尔；⑤ side project / 周末开源` },
        { q: `什么时候你应该完全停止写代码？`, hint: `团队 ≥ 15 人 / 多个 sub-team / 你管 manager 而非 IC——这时候写代码消耗你的 leverage，应该全力做"系统问题"（招聘 / 流程 / 跨部门）` },
      ],
    },

    4: {
      why_asked: `这道题区分"真转型 EM"和"挂着 EM 头衔的高级 IC"。能讲出"心智差异"而非"职责差异"的人才真在 EM 角色里挣扎过、转过来。`,
      answers: {
        mid: `<strong>三大心智差异</strong>：① <strong>成就来源</strong>：从"我做了什么"变成"团队做了什么"；② <strong>反馈周期</strong>：IC 每天能看到代码 merge，EM 可能 3-6 个月才看到一个团队改善的明显效果；③ <strong>问题类型</strong>：IC 解决技术问题（有标准答案），EM 解决人 / 流程 / 沟通问题（没标准答案）。`,
        senior: `<strong>更深的差异</strong>：① <strong>时间尺度</strong>：IC 看 sprint，EM 看 quarter / year；② <strong>"完成"定义</strong>：IC 完成是 PR merge，EM 完成是 "团队能持续 deliver 没我也行"——你的成功是<strong>让自己变得"不必要"</strong>；③ <strong>"贡献"可见性</strong>：IC 贡献写在 commit log 里，EM 贡献在团队没你的时候才看得出来（这是<strong>滞后指标</strong>，对急于证明自己的人是 challenge）。`,
        staff: `深一层：<strong>EM 是"延迟满足"的极端职业</strong>——你今天做的 1on1、辅导、招聘决定、流程设计，回报可能在 1-3 年后才显现，期间还有大量"做了感觉没用"的体验。这跟 IC 的"每天 dopamine hit"（代码工作了）完全相反。<strong>心智重塑</strong>：① 接受"我今天的产出 = 我创造的条件"而非"我交付的代码"；② 把对"个人贡献"的需求转移到"团队成长 / 个人成长曲线"的观察上（一年后下属能力 +X）；③ 学会从"间接信号"中获得反馈（团队 NPS、retention、晋升率、跨团队评价）。<strong>真实经验</strong>：我第一年 EM 经常焦虑"今天我做了什么？" —— 直到看到带的 mentee 自己解决了一个之前要找我问的问题，那一刻才意识到这是 EM 的胜利。<strong>典型陷阱</strong>：心智没转过来的 EM 表现：① 还是抢功能写代码刷成就感；② 1on1 时主要在自己说（"教"而非"听"）；③ 月度 review 重点列自己干的事而非团队成就；④ 不善于做"减法"（让团队成员做，让自己做 less）。能<strong>主动让自己变 less critical</strong>的 EM 是真转过型的。`,
      },
      failure_modes: [
        `只讲"职责差异"（不写代码、要开会），讲不出"心智差异"`,
        `心智没转 → 抢核心 feature 刷成就感 / 1on1 主要自己讲 / review 不放心`,
        `等待立竿见影的反馈 → 3 个月没"明显成果"就焦虑 / 跳船`,
        `把 EM 当"IC 的升级"（pay raise + title + 还做老活），不接受新角色定义`,
        `不能容忍"产出延迟"，频繁微管理刷存在感`,
      ],
      follow_ups: [
        { q: `你怎么处理"今天没产出"的焦虑？`, hint: `① 列每周"间接产出"清单（1on1 数 / review 数 / 决策数）；② 看长期指标（团队 NPS / retention）；③ 接受 EM 工作 70% 是"创造条件"，30% 是"具体产出"` },
        { q: `怎么知道自己真的"心智转过来"了？`, hint: `① 不再抢功能；② 1on1 时听比说多；③ 月度 self-review 写"团队做了什么"而非"我做了什么"；④ 别人做得比自己好时高兴而非威胁` },
        { q: `如果发现自己心智没转过来怎么办？`, hint: `① 跟 EM coach / mentor 谈；② 主动做"放下"练习（明知能自己做的事强迫给团队）；③ 考虑回 IC track（不是失败，是 self-awareness）` },
      ],
    },

    6: {
      why_asked: `验证候选人是否真观察过 EM 失败案例（自己的或同伴的）。能给 3 个具体模式的人通常踩过坑或带过新 EM。`,
      answers: {
        mid: `三大失败模式：① <strong>Player-Coach 陷阱</strong>——还在抢核心代码、当个 senior IC，没真当 EM；② <strong>微管理</strong>——不放心团队 → 事事插手 → 自己累瘫 + 团队不长；③ <strong>"老好人"</strong>——不敢给负面反馈 / 不敢解雇 low performer / 不敢说 no，被团队和老板两头不满意。`,
        senior: `<strong>失败模式背后的共性</strong>：都是"<strong>没建立 EM 身份认同</strong>"——还在用 IC 心智解决 EM 问题。① Player-Coach 是 IC 心智在抢产出；② 微管理是 IC 心智的"质量焦虑"被错误放大；③ 老好人是 IC 心智的"对事不对人"在 EM 角色里变成"对人不对事"。识别这点能帮助新 EM 自我诊断。`,
        staff: `深一层：还有 2 个隐性失败模式：<br>④ <strong>"上下不沟通"的孤岛</strong>——新 EM 跟老板沟通频次太低（不知道要 manage up），跟团队也不开放（怕暴露不懂），半年后两头都说"不知道他在干啥"。<br>⑤ <strong>"复刻自己"的招聘 bias</strong>——招人都按"自己当年的样子"招，团队 diversity（认知 / 背景 / 风格）单一，3-5 年后团队整体短板暴露。<br><br><strong>真实经验</strong>：我见过最痛的失败案例是我自己第一年——同时陷入 Player-Coach（还抢核心 feature 写）+ 老好人（迟迟不给一个 low performer 直接反馈）+ 上下沟通不足（每月 1on1 老板，被问到细节答不上来）三个模式叠加。半年绩效 review 时被老板明确说 "你的产出是 IC 优秀但 EM 不及格"。<strong>修正</strong>：① 砍掉所有自己的 coding 任务，强制写"如果今天我消失团队会怎样"；② 跟那个 low performer 做了一次 hard conversation（提前写脚本 + role play 跟老婆排练 3 次）；③ 跟老板改成双周 1on1 + 每周 written update。3 个月后情况翻转。<strong>对新 EM 建议</strong>：① 找一个 senior EM 当 mentor，每月 1 次 sanity check；② 主动让 team 给你 anonymous feedback（如 15Five）；③ 接受"前 6 个月做得不好是 normal"。`,
      },
      failure_modes: [
        `Player-Coach（抢代码、当高级 IC，没真转 EM）`,
        `微管理（事事插手 / review 卡 PR / 1on1 当任务汇报）`,
        `老好人（不敢负面反馈 / 不敢解雇 / 不敢拒绝 = 三不敢）`,
        `跟老板和团队都疏远（孤岛 EM）`,
        `招"自己的复制品"（团队 diversity 单一，长期短板暴露）`,
      ],
      follow_ups: [
        { q: `自己怎么自检是否在这些模式里？`, hint: `① 季度 retro：列出自己的"具体产出"和"团队产出"占比，IC 占比 > 30% 是 player-coach 信号；② 团队 NPS（用 15Five 等工具）；③ 老板的 30 / 60 / 90 day feedback` },
        { q: `怎么帮一个陷入 Player-Coach 的 mentee 跳出来？`, hint: `① 量化损失（"你抢的 feature 让 Junior 少 1 次成长机会"）；② 强制限额（"下季度自己写 ≤ 10%"）；③ 帮 mentee 找替代的成就来源（团队晋升、招聘、流程改进）` },
        { q: `公司层面怎么预防新 EM 失败？`, hint: `① EM onboarding 项目（manager-of-managers 系统辅导）；② Mentorship program（资深 EM 配新 EM）；③ EM cohort（同期 EM 互助）；④ Manager Effectiveness 指标定期评估` },
      ],
    },

    8: {
      why_asked: `验证候选人是否真规划过 EM 入职（不是只听过 30-60-90 概念）。能给具体 milestones 和 anti-patterns 的人通常做过 EM 转型培训。`,
      answers: {
        mid: `30-60-90 day plan 三阶段：<strong>30 天 = Diagnose</strong>（理解人 / 流程 / 业务）→ <strong>60 天 = Quick Wins + Strategy</strong>（识别 1-2 个低风险改进 + 起草中长期策略）→ <strong>90 天 = Execute + Visible Win</strong>（交付第一个 visible 改进 + 跟老板对齐下一阶段计划）。`,
        senior: `<strong>每阶段标准</strong>：<br>· 30 day：15+ 1on1 完成 / 读完关键文档 / 列出 Top 3 体感问题 / 给老板第一份书面 plan<br>· 60 day：起草 H1 团队目标 + Quick wins shipped / 招聘流程开始介入 / Stakeholder map 完成<br>· 90 day：第一个 visible win delivered（团队认可的小改进）/ 6 month roadmap 跟老板对齐 / 团队 NPS &gt; baseline`,
        staff: `深一层：30-60-90 真正价值不在 plan 本身，而在<strong>"创造与老板的对齐时刻"</strong>。很多新 EM 半年后才发现自己理解的"重点"跟老板不一样——30 day plan 强制把对齐时机提前到第 1 个月。<strong>真实经验</strong>：我两次空降 EM 都用了这个：① 第 1 周列出"我注意到的 X 件事" 但不评论；② 第 4 周写 plan 跟老板 walk-through，<strong>改了 3 轮才签字</strong>——这个"改 3 轮"过程暴露了 4 个我之前没意识到的老板优先级（如他更看重 attrition rate 而非 feature velocity）；③ 之后每月对照 plan 复盘。<strong>plan 模板</strong>（一页内）：<br>1) 我观察到的 Top 3 团队 strengths / Top 3 challenges<br>2) 30 / 60 / 90 day deliverables（具体且可验证）<br>3) 我需要老板支持的 3 件事（headcount / cross-team intro / decision authority）<br>4) 风险 + mitigation<br>5) check-in cadence（建议双周或每月）<br><br><strong>陷阱</strong>：① plan 写得过于 abstract（"提升团队效能"，没数字）；② 列了 10+ deliverables（精力分散，最后都没做完）；③ 没风险章节（被老板视为 naive）；④ 第 30 天 plan 终稿后就不更新 → 老板觉得你不务实。`,
      },
      failure_modes: [
        `不写或只口头说（没书面对齐 → 误解风险）`,
        `Plan 太抽象（"提升团队"），无量化 deliverables → 老板觉得不务实`,
        `Plan 太激进（30 天就要重构流程 / 调整团队），暴露 over-confidence`,
        `没"需要支持的事"章节（老板觉得 self-sufficient 但其实空降需要支援）`,
        `30 day plan 写完不动了 → 60 / 90 没 retrospective → 老板感觉走偏`,
      ],
      follow_ups: [
        { q: `30 day 应该跟谁建立关系？`, hint: `① 全部直接下属 1on1；② 老板（cadence 对齐）；③ skip-level（老板的老板，3-5 个月一次）；④ peer EMs（5-8 个）；⑤ 关键 stakeholders（PM lead / Design lead / Eng-adjacent leaders）` },
        { q: `Quick Win 怎么选？`, hint: `三条件：① 团队普遍认同的痛点；② 30-60 天内能 delivered；③ 不抢功劳（让团队成员 own）；典型如：优化 onboarding doc / fix一个长期 oncall pain / 砍掉一个无意义会议` },
        { q: `90 day 之后应该有什么？`, hint: `① 6-12 month roadmap（已跟老板签字）；② 团队对你的 trust baseline 建立；③ 你的 effectiveness 进入 "long-term mode"（不再 90 day milestone driven）；④ 第一份 manager effectiveness survey 结果（用作 baseline）` },
      ],
    },

    // ============== 1on1 ==============
    11: {
      why_asked: `EM 面试最高频的一道。能讲清"为下属服务而非给老板汇报"区分懂 EM 和不懂 EM。`,
      answers: {
        mid: `1on1 的<strong>核心目的</strong>是<strong>给下属的时间</strong>（不是 status update / 汇报）。包括：① 倾听他们的 challenges / blockers；② 帮他们成长（career talk / feedback）；③ 建立信任（personal connection）；④ 给反馈（双向）。`,
        senior: `<strong>关键原则</strong>：① <strong>下属议程优先</strong>——他们带话题，我跟着走，不是我准备 status check；② <strong>不取消</strong>（除非 critical 冲突，rare 才挪期）；③ <strong>1:1 不当 group meeting / 项目 review</strong>，那些另开会；④ <strong>笔记跨次连续</strong>（用 1on1 doc 累积，下次开头先看上次的 action items）。`,
        staff: `深一层：<strong>1on1 是 EM 最高 ROI 的活动</strong>——每周 30 min × 6 下属 = 3h，但累积影响占你工作时间的 2-3×。<strong>1on1 doc 的真实价值</strong>：① <strong>retention 工具</strong>——半年后看趋势能识别 disengagement signals；② <strong>promotion 弹药</strong>——packet 里的具体例子全在 1on1 doc 里；③ <strong>事故复盘</strong>——员工突然离职时能 audit "我哪里没听到"。<strong>真实经验</strong>：在带 8 人团队时坚持每周 30 min 1on1，每次写 doc，3 年累积下来：① 帮 5 人晋升（包括 1 个跨 level 的）；② 提前 2-3 个月预警 2 次 attrition risk（成功挽留 1，失败 1 但 expected）；③ 一次劳动仲裁中 1on1 doc 成了关键证据。<strong>反模式</strong>：① 当 status update 开（一周 sync 已经够了）；② 自己讲为主（"教" 而非"听"）；③ 不写 doc → 记不住承诺 → 下属觉得"你不在乎"。<strong>新 EM 建议</strong>：① 第一次 1on1 用一份 "Manager Readme"（介绍你的工作风格、期待、reach-out 方式）；② 每月一次 career talk（不是每次 1on1 都做）；③ 季度一次 "How am I doing as your manager?"（主动要反馈）。`,
      },
      failure_modes: [
        `当 status update 开（PR 进度 / project sync），浪费宝贵的私下对话时间`,
        `自己主导议程 → 下属变成"被动回答"`,
        `经常取消 / 改期 → 信号: 这个时间不重要`,
        `不写 doc → 上次说的事忘了 → 下属觉得不被重视`,
        `永远不给负面反馈 / 一切都是 happy talk → 下属在 review 时被 surprise`,
      ],
      follow_ups: [
        { q: `第一次跟新下属 1on1 应该聊什么？`, hint: `① 让对方先讲他们的"我是谁 / 我的工作风格 / 我想要什么"；② 我介绍自己（用 manager readme）；③ 对齐 1on1 的 cadence 和 expectation；不聊具体项目` },
        { q: `1on1 内向下属什么都不说怎么办？`, hint: `① 给"我准备的题目清单"让对方挑；② 用 "what / how / why" 开放问题；③ 接受 silence（不用填满）；④ 改 walking 1on1 / 咖啡店 1on1（环境变化触发开口）` },
        { q: `怎么判断 1on1 做得有效？`, hint: `① 下属主动延长时间；② 抛出真问题（不是 happy talk）；③ Career talk 有具体行动；④ 季度让团队 anonymous 评 manager effectiveness` },
      ],
    },

    13: {
      why_asked: `验证候选人是否真主持过 1on1 而非只听过概念。能给"下属议程优先"的人通常做过 6+ 个月 EM。`,
      answers: {
        mid: `标准议程（顺序灵活，<strong>下属带话题在前</strong>）：① 你最近怎么样？（personal check-in）② 你这周想聊什么？（让下属带话题）③ 过去一周 highlights / blockers；④ Career / 成长话题（隔周或月度）；⑤ 我能怎么帮你？⑥ Action items 复盘 + 新 action items。`,
        senior: `<strong>关键原则</strong>：① <strong>不是 status update</strong>——技术进度走 daily standup / weekly sync；② <strong>下属议程占 70%+ 时间</strong>，我的 update 是 5-10 min 简短；③ <strong>不是每次 1on1 都谈 career</strong>——典型 cadence：每周 1on1 / 月度 career talk / 季度 review。④ <strong>有 doc</strong> 累积跨次 action items 和趋势。`,
        staff: `深一层：好 1on1 的<strong>"5 conversation"</strong> 框架（Lara Hogan）：① <strong>Career Aspirations</strong>（年度更新）；② <strong>Personal Values</strong>（半年更新）；③ <strong>Strengths/Triggers</strong>（季度更新）；④ <strong>Feedback / Bullet point status</strong>（每次）；⑤ <strong>Tactical updates</strong>（每次）。新 EM 倾向只做后两个，老 EM 把前三个排进 cadence。<strong>真实经验</strong>：我用一个 shared Google Doc 每个下属一份 1on1 doc，结构是：<br>top section：下属当前 priorities / blockers / asks（他们带）<br>middle：我的 updates（5 行内）<br>bottom：unresolved threads（持续）<br>跨次会议: 加日期 heading，旧内容不删（变成 history）<br><br>3 年下来一个下属的 1on1 doc 通常 40-80 页，是 promotion packet / performance review 的 gold mine。<strong>提示</strong>：① 第一次让下属选 doc 还是 verbal，多数人选 doc；② 离职时打个 take-home（让对方知道这是他们的资产）；③ skip-level 不用看（doc 是 1on1 的 private space）。`,
      },
      failure_modes: [
        `当 status update 开（已经有 daily / weekly sync 了，重复浪费）`,
        `自己议程优先，下属变被动`,
        `每次都谈 career → 下属觉得形式化；从不谈 career → 下属觉得不被重视`,
        `不写 doc → 上次承诺忘了 → 下属觉得不被尊重`,
        `所有 1on1 都同一议程 → 没根据下属性格 / 成长阶段调整`,
      ],
      follow_ups: [
        { q: `不同 seniority 的下属 1on1 应该怎么调整？`, hint: `Junior: 偏 tactical + skill building；Senior: 偏 career + strategy + 跨团队议题；Staff+: 几乎全是 strategy + organization 议题，我更多 listen` },
        { q: `1on1 时下属在 vent / complain 应该怎么处理？`, hint: `① 先 acknowledge（不打断）；② 区分 venting（需要 listen） vs problem-solving（需要 action）；③ 问"你想要我 listen 还是帮你想 solution"；④ 必要时帮 reframe / refocus` },
        { q: `Walking 1on1 / Coffee 1on1 适合什么场景？`, hint: `① 严肃话题（裁员 / 反馈）反而需要正式房间；② 偶尔换场景 break routine 有用；③ 远程团队可以做"video off + walking 散步聊"` },
      ],
    },

    15: {
      why_asked: `EM 最常被问到的"困难场景"题。能讲清 SBI / 直接但 kind / 隔离行为不否定人格 的人是真做过这件事。`,
      answers: {
        mid: `用 <strong>SBI（Situation-Behavior-Impact）</strong>框架：<br>① <strong>Situation</strong>：具体场景（"昨天 design review 时"）<br>② <strong>Behavior</strong>：可观察的行为（"你直接打断 Alice 三次"）<br>③ <strong>Impact</strong>：对你 / 团队的影响（"Alice 不再发言，我们少听了她的设计思路"）<br>然后给改进建议 + 邀请对方回应。`,
        senior: `<strong>关键原则</strong>：① <strong>隔离行为，不否定人格</strong>——批评行为不批评人（不是"你太 aggressive"，是"你打断了 Alice"）；② <strong>越早越好</strong>——24-72h 内反馈，记忆鲜活；③ <strong>私下</strong>（不在 group meeting / Slack channel 给）；④ <strong>直接 + kind</strong>（Radical Candor：高 care + 高 challenge）；⑤ <strong>不夹带其他反馈</strong>（不要 sandwich：正面 + 负面 + 正面，会被记成只有正面）。`,
        staff: `深一层：负面反馈成败的 90% 不在<strong>沟通技巧</strong>而在<strong>关系基础</strong>。<strong>没有信任就给负面反馈 = 摧毁关系</strong>。所以新 EM 头 3 个月不轻易给重的负面反馈（除非线上事故），先用前几个月建关系 + 给正面反馈（5:1 ratio，Gottman 婚姻研究但 EM 也适用）。<br><br><strong>真实经验</strong>：在带电信团队时有一位 senior engineer 经常在跨团队会议 push 自己的方案过强，导致 peer team 投诉。我准备了一次 1on1 用 SBI：<br>S: 上周跨 PM 团队 design sync<br>B: 你说了 80% 时间，peer team 的 input 都被你压下去<br>I: peer team lead 私下找我说"以后他不参加我们会更高效"，这影响你和团队的 reputation<br>建议: 下次跨团队会议 we agreed: 你先 listen 10 min，再发表观点；如有 strong disagreement 私下找我我们一起改 approach<br><br><strong>结果</strong>：对方初期防御，但 2 周后明显改善。3 个月后 peer team 主动找他咨询。<strong>关键</strong>：① 他知道我是为他好（trust）；② 我给了具体 action（不是模糊抱怨）；③ I followed up（不是"说了就完了"）。<strong>反模式</strong>：① "you should be less aggressive"（评论人格而非行为）；② "anyway, you've done great this year"（sandwich，淡化重点）；③ in front of others（公开羞辱）；④ once and forget（不 follow up，对方以为不重要）。`,
      },
      failure_modes: [
        `沙威治式（正面 → 负面 → 正面），重点被稀释`,
        `不具体（"you need to be better at communication"）→ 对方不知道改什么`,
        `公开给负面反馈（group meeting / Slack channel）→ 羞辱 → 信任崩盘`,
        `没建立 trust 就给重反馈 → 对方反弹 / 离职`,
        `给完不 follow up → 信号"不重要" → 对方不改 → 你又抱怨`,
      ],
      follow_ups: [
        { q: `下属拒绝接受反馈怎么办？`, hint: `① 不强行 push（"think about it, let's revisit"）；② 准备具体 evidence；③ 找 peer / mentor 给同样反馈（多源证据）；④ 严重的话写到 written review` },
        { q: `给反馈后下属变得 distant 怎么办？`, hint: `① 24-48h 后 check in（"how are you feeling about our conversation?"）；② 表达持续支持（"my goal is your growth"）；③ 接受短期 awkward 是 normal；④ 不要 walk back 反馈本身` },
        { q: `怎么平衡频次（不过度反馈也不失声）？`, hint: `① 5:1 正负 ratio（Gottman）；② 重大问题 24-72h 给；③ 微观行为问题攒到月度；④ 季度 review 时 zoom out 看 pattern` },
      ],
    },

    19: {
      why_asked: `验证候选人是否真处理过 office politics（不只听 1on1）。能讲"既听又不站队"的人有过实际经验。`,
      answers: {
        mid: `三段处理：① <strong>先 listen + validate</strong>（不打断，让对方说完情绪）；② <strong>不站队 + 不传话</strong>（"我听到了，我理解你为什么 frustrated"，但不评论第三方）；③ <strong>引导自我解决</strong>（"你想怎么处理？" "你跟他直接谈过吗？"）。`,
        senior: `<strong>核心原则</strong>：① <strong>EM 不是树洞，不收集 gossip</strong>；② <strong>不传话</strong>（除非对方明确授权 + 严重事件）；③ <strong>推 ownership 回到他自己</strong>（"我可以帮你 role play 怎么谈" 而非"我去帮你说"）；④ 严重事件 escalate（如骚扰 / 不公平对待，转 HR / 老板）。`,
        staff: `深一层：<strong>这个场景测试 EM 的"心理边界"和"政治敏感度"</strong>——① 太硬：拒绝听 → 下属觉得不被支持；② 太软：陪着吐槽 → 你成了 gossip 中心 → 信任崩塌 + 政治牌打不出去。<strong>真实经验</strong>：带电信团队时有一位 senior 经常来 1on1 抱怨 peer team A 的 EM "不配合 / 决策慢"。我用过的应对：<br><strong>第 1 次</strong>：listen + 不评论 + 问 "你直接跟他谈过吗？" 对方说没有，我说"先谈，谈完告诉我结果"。<br><strong>第 2-3 次</strong>（对方仍来抱怨）：建立 boundary "我可以听，但不能替你处理这事——你和他是 peer，我介入反而把你的 ownership 弱化"。我帮他 role play 了一次怎么开 difficult conversation。<br><strong>第 4 次</strong>：对方真去谈了 + 改善 30%，剩下 70% 是 peer EM 真的 underperform，需要他老板介入——这时我 escalate 了一次 peer EM 的老板（不是替我下属 advocate，是反馈"两个团队协作出问题需要 align"）。<br><br><strong>陷阱</strong>：① 陪 vent 太长 → 强化 victim mindset；② 替他出头 → 他失去 conflict resolution 能力；③ 把听到的传给 peer EM → 信任全无；④ 完全冷处理 → 下属转向 skip-level 抱怨（更糟）。<strong>原则</strong>：<strong>"我帮你成长，不替你解决"</strong>。`,
      },
      failure_modes: [
        `陪着 vent / 一起吐槽 → EM 变 gossip 中心 → 团队信任崩`,
        `替下属出头去找 peer EM 谈 → 剥夺下属 conflict resolution 成长`,
        `传话给 peer → 信任全无 + 隔壁 EM 警觉 + 政治灾难`,
        `Full cold（"我不管这种事"）→ 下属转向 skip-level / 直接离职`,
        `没识别真的严重事件（如骚扰 / 不公），陪 vent 浪费了 escalate 时机`,
      ],
      follow_ups: [
        { q: `什么时候应该主动介入 escalate？`, hint: `① 涉及 protected category（性别 / 种族 / 性骚扰）→ 立即 HR；② legal / compliance 风险；③ 多人受影响的系统性问题；④ 下属明确受伤 / health 受影响` },
        { q: `怎么 role play 帮下属准备 difficult conversation？`, hint: `① 你扮演 peer / peer EM，让下属 practice 开场白；② 给具体 reframe（"你被否定" → "他有不同 priorities"）；③ 5 min 准备 + 5 min role play + 5 min debrief 通常足够` },
        { q: `Peer EM 把锅甩给你团队怎么办？`, hint: `① 私下找 peer EM 谈（不是 group meeting 公开）；② 用 data 不用 emotion；③ 找共同老板 facilitate（如果谈不拢）；④ 必要时启动 RACI 重新明确 ownership` },
      ],
    },

    // ============== 招聘 ==============
    21: {
      why_asked: `验证候选人是否真主持过 hiring（不只面试）。能给"hire OR no-hire 不模糊"标准的人是 hiring manager 经验丰富。`,
      answers: {
        mid: `Hiring Bar = <strong>"这个候选人加入后，他在团队是 top half 还是 bottom half"</strong> 的判断标准。Top half → hire；bottom half → no hire。<strong>不要 maybe</strong>（hiring committee 看到 "maybe" 通常默认 no hire）。`,
        senior: `<strong>三层 bar</strong>：① <strong>Technical bar</strong>（这个 level 应该会的硬技能）；② <strong>Behavioral bar</strong>（collaboration / ownership / learning agility）；③ <strong>Cultural fit bar</strong>（团队 norms / values，注意是 culture <strong>add</strong> 不是 culture clone）。<strong>关键</strong>：① bar 不能只你定，要跟 manager-of-managers / hiring committee 校准；② 不同 level 不同 bar（Junior ≠ Staff）；③ 不为填 headcount 降 bar——"hire to fill" 是 90% mishire 的根源。`,
        staff: `深一层：<strong>Hiring Bar 的真实约束是 calibration</strong>——不同 interviewer 给同一候选人评价能差 2 levels（典型）。所以 bar 不能只写在文档里，要靠 ① <strong>定期 calibration session</strong>（hiring committee 看历史 hires 的 1-year 表现，校准评判）；② <strong>shadow interviews</strong>（新 interviewer 跟资深 shadow 3-5 场再独立面）；③ <strong>standardized rubrics</strong>（具体的 level expectation grid）。<strong>真实经验</strong>：在带 8 人团队期间面了 60+ 个候选人，hire 了 5 个。最早期我跟 senior peer 评价对齐度只有 40%（同一候选人，我说 hire 他说 no hire），半年后通过 ① debrief 多花时间，② 写下"为什么我说 hire / no hire"的具体 evidence，③ 看已 hire 1 年表现回溯——对齐度提升到 85%。<strong>关键洞察</strong>：① bar 是 calibrated bar，不是 individual bar；② 第一年要 over-index 在 calibration 上（即使速度慢）；③ debrief 时<strong>用 evidence 不用 gut feel</strong>（"他没回答 vector 扩容的细节" 而非 "我觉得他不行"）。<strong>反模式</strong>：① "team 缺人很急" → 降 bar → 6 个月后 PIP → 团队 morale 崩；② "他面试时讲得好" → 没看 work product → 入职后产出差；③ "他来自 FAANG" → halo effect → 没真测 → mismatch。`,
      },
      failure_modes: [
        `没明确 bar 文档 → 每个 interviewer 自己定标准 → 不一致`,
        `为填坑降 bar（"team 缺人")→ 短期解决长期灾难`,
        `Cultural fit 当成 culture clone（找跟自己/团队一样的人）→ 长期 diversity 弱`,
        `不做 calibration → 不同面试官评价飘 1-2 levels`,
        `Debrief 时用 gut feel 而非 evidence → 决策不可复盘 / 不可申诉`,
      ],
      follow_ups: [
        { q: `怎么避免 hiring bias（unconscious bias）？`, hint: `① 标准化 rubric；② Debrief 时先各自打分再讨论（避免锚定）；③ Diverse interview panel；④ 训练 interviewer 识别 bias；⑤ 跟踪 hire 后表现按 source 拆分（看是否某类源 systematic 偏低）` },
        { q: `什么时候应该 lower bar？`, hint: `通常 never。如果真要：① 战略 pivot 需要新技能（buy 而非 build）；② 接受 1-year accept lower productivity + 投入额外 onboarding；③ 写下 ADR 记录理由；④ 主动告知 hire 自己被 stretched，预期清晰` },
        { q: `Hire 后 6 个月发现 mishire 怎么办？`, hint: `① 早识别（PIP / 直接 difficult conversation）；② 不羞耻 admit—— mishire 是 system 失败不是 individual；③ Retro: 是 bar 错 / interviewer 错 / debrief 错；④ 修流程 not blame` },
      ],
    },

    23: {
      why_asked: `验证候选人是否能设计有效的 interview loop（不是凑面试官）。能讲"每轮独立信号"的人是真主持过 panel debrief。`,
      answers: {
        mid: `<strong>4-5 轮覆盖</strong>不重复信号：① <strong>Coding</strong>（数据结构 + 算法 + 代码质量）；② <strong>System Design</strong>（架构 + tradeoff + 沟通）；③ <strong>Behavioral / Past experience</strong>（用 STAR 挖具体例子）；④ <strong>Cultural fit / Manager round</strong>（motivation + collaboration + values）；⑤ <strong>Hiring Manager wrap up</strong>（最后确认 + 双方 Q&A）。`,
        senior: `<strong>关键设计原则</strong>：① <strong>每轮独立信号</strong>——避免 4 轮都问数据结构；② <strong>明确 signal-to-test 映射</strong>（每轮写 1 句话"这轮主要 test 什么"）；③ <strong>Diverse interviewer panel</strong>（gender / seniority / functional）；④ <strong>预留时间给候选人提问</strong>（10-15 min / 轮）——候选人的问题质量比答题质量更能区分 senior vs junior。`,
        staff: `深一层：<strong>Loop 设计的真问题是"我们要 hire for what？"</strong>。Hiring Manager 必须事先写一份 <strong>Job Scorecard</strong>（不是 JD），包含：① 6-month / 1-year 期待 outcome；② 关键 competencies（5-7 个）；③ Anti-attributes（什么样的人 not hire）。<strong>然后</strong>把 competency 映射到 interview rounds（如 "ownership" 测在 behavioral / "system design depth" 测在 SD round）。<strong>真实经验</strong>：在做 senior C++ engineer 招聘时，Job Scorecard 列了 7 个 competencies：技术深度（C++/系统）/ 系统设计 / 调试能力 / 跨团队协作 / mentorship / 业务感 / learning agility。Loop 设计：① Coding（C++ + 算法）→ 技术深度 + 代码质量；② System design（设计 RPC 服务）→ 系统设计 + 业务感；③ Debug round（给一段问题代码让候选人找 bug）→ 调试能力；④ Behavioral（mentor / cross-team）→ 协作 + mentorship；⑤ HM round → learning agility + 总体 cultural fit。<strong>结果</strong>：6 个月 hire 4 人，全部 1-year retention，都达 / 超 expectation。<strong>陷阱</strong>：① Loop 太长（&gt; 6 轮）→ 候选人 fatigue / 退出 ratio 飙；② 同一个 competency 多轮重复测（浪费 round）；③ 没 calibration 直接面试（不同 interviewer 评分飘）；④ 用 brainteaser puzzle（Google 早期反思过，没预测效果）。`,
      },
      failure_modes: [
        `多轮都问同样信号（4 轮都是 coding，cultural / collab 没测到）`,
        `Loop &gt; 6 轮 → 候选人 fatigue / 撤回率高`,
        `没 Job Scorecard → 每轮 interviewer 自己定标准 → 不一致 debrief`,
        `Behavioral round 问 hypothetical（"如果你..."）而非 past experience（"上次..."）`,
        `候选人没机会问问题 → 损失候选人 ROI signal + 雇主品牌`,
      ],
      follow_ups: [
        { q: `怎么做 hiring manager round？`, hint: `① Wrap-up 之前面试已收集到的 missing signal；② 候选人最后机会问问题（高质量提问 = strong signal）；③ Sell the role（给 motivated 候选人）；④ 明确 next step / timeline` },
        { q: `Coding round 怎么避免 LeetCode 应试？`, hint: `① 用真实业务场景（"我们要做一个 cache layer"）；② 看 code quality + 沟通 + tradeoff 思考，不只 algorithmic correctness；③ 题目可以 follow up 多轮 depth；④ 接受 candidate take-home 替代` },
        { q: `Take-home assignment 有什么 trade-off？`, hint: `好：候选人自己时间发挥 + 工作场景仿真 + reduces 偏 interview anxiety；差：占用候选人大量时间 / 难标准化评分 / 顶级候选人不参加 take-home。Hybrid: short take-home (2h) + debrief discussion` },
      ],
    },

    25: {
      why_asked: `验证候选人是否真主持过 hiring committee debrief（这是 senior EM 的核心技能之一）。能讲"先 evidence 后 verdict"的人是真做过。`,
      answers: {
        mid: `Hiring Committee debrief 流程：① 每位 interviewer 提前提交 written feedback（避免会场被声大的人主导）；② 会场每位 5 min 讲 evidence + verdict（hire / no hire / strong yes / strong no）；③ 讨论 disagreement；④ Hiring Manager 总结 + 决策（不是投票）；⑤ 写最终 decision rationale。`,
        senior: `<strong>关键原则</strong>：① <strong>Evidence first, verdict last</strong>——避免 anchoring（一个人说"strong yes"其他人附和）；② <strong>Diverse panel</strong>（gender / seniority / function），避免同温层 echo chamber；③ <strong>Hiring Manager 不是投票的多数</strong>，是决策者（但需要解释为什么 override committee）；④ <strong>Bar Raiser</strong>（如 Amazon）独立于 hiring manager，确保不为填坑降 bar。`,
        staff: `深一层：debrief 是<strong>整个 loop 中最容易出 bias 的环节</strong>——决策从"个体评价"转成"集体决策"，受声大者 / senior / hiring manager 偏好严重影响。<strong>反 bias 实践</strong>：① <strong>Written first</strong>（每人面完 24h 内独立写 + submit，他人看不到）；② <strong>Round-robin 发言顺序</strong>（最 junior interviewer 先讲，避免被 senior 锚定）；③ <strong>明确 Strong / No / Strong-No 的 evidence 要求</strong>（"strong yes" 必须有 specific 例子，不能 gut feel）。<br><br><strong>真实经验</strong>：在 RPC 团队招 senior 时一次 debrief 出现 2:2 split（2 强 yes / 2 弱 no）。我做 HM：<br>① 先让 2 个 no 讲 evidence —— 一个是"他不熟 Boost.Asio"（不是 dealbreaker，可以学），另一个是"他在 system design 没 push back 我的假设"（confirmation bias risk）；<br>② 让 2 个 yes 讲 —— 都有具体例子说明候选人 ownership + learning agility 强；<br>③ 我决定 hire，但写了 ADR 解释为什么 override the no（"Boost.Asio gap 在 onboarding 6 周内可补，候选人 fundamentals 强 + cultural fit 好"）；<br>④ 6 个月后 retro：候选人确实补上了 gap + 进入 high performer，证明决策正确。<br><br><strong>陷阱</strong>：① 没 written feedback → 会场记忆主导，details lost；② "consensus or no hire" 死板规则 → 永远 hire 不到 boundary 候选人（其实 boundary 才是 most learning）；③ HM bias：自己面过的轮重过其他人；④ 不写 decision rationale → 半年后 mishire 复盘没线索。`,
      },
      failure_modes: [
        `没 written feedback → 会场记忆主导 / details lost`,
        `Verdict before evidence → anchoring → echo chamber`,
        `HM 强行 push hire（"team 急需人"）→ committee 失去意义`,
        `投票决策（majority wins）→ HM 失去 ownership / 不可 escalate`,
        `Debrief 不写 rationale → 6 个月 mishire 时无法复盘 / 改进`,
      ],
      follow_ups: [
        { q: `Bar Raiser 跟 HM 冲突怎么办？`, hint: `Amazon 模式：Bar Raiser 有 veto 权（即使 HM 想 hire）；目的是防止 HM 为填坑降 bar；冲突时 escalate 上一级 manager 仲裁，但 Bar Raiser 默认获胜` },
        { q: `面试官给 strong no 但 HM 想 hire，怎么处理？`, hint: `① 先听 evidence；② 看 disagreement 是 fundamental（如 integrity issue）还是 partial（如 specific skill gap）；③ Fundamental → 不 hire；Partial → HM 可 override + 写 ADR + 接受风险` },
        { q: `怎么训练新 interviewer 给好 debrief？`, hint: `① Shadow 资深 interviewer 3-5 场；② 写 rubric template（具体的 evidence checklist）；③ 第一次 written feedback 让 senior peer review；④ Debrief 后 1on1 retro 给反馈` },
      ],
    },

    // ============== 绩效 ==============
    36: {
      why_asked: `验证候选人是否真主持过 calibration（这是从 Line EM 转 Senior EM 的关键技能）。能讲"防 inflation / 跨 team consistency / no surprise" 的人通常做过 promo committee。`,
      answers: {
        mid: `Calibration session 是<strong>多个 EM 一起评审下属绩效</strong>的会议，目的：① 防止<strong>评分 inflation</strong>（每个 EM 都给自己人高分）；② 跨 team <strong>consistency</strong>（同 level 同标准）；③ <strong>识别 outliers</strong>（高潜需要 promo / low performer 需要 PIP）；④ <strong>no surprise</strong>（员工 review 时不应该 surprise）。`,
        senior: `<strong>标准流程</strong>：① 每个 EM 提前提交 ratings + evidence；② 会议先看 distribution（按 level 分桶画 histogram）；③ 讨论 outliers（top / bottom 10%）；④ 跨 team 校准（同 level 同 rating 应该有类似 evidence weight）；⑤ HM-of-EMs 总结 + 决策。<strong>关键</strong>：① ratings 跟 promotion / comp 直接挂钩，分量大；② 写下 calibration notes 给员工 manager（用于 review delivery）。`,
        staff: `深一层：calibration 的<strong>真实价值不在调分</strong>，而在 ① 跨 team <strong>建立共同语言</strong>（"L5 Senior 应该是什么样"）；② <strong>暴露 bias</strong>（某 EM 长期给某类员工高 / 低分）；③ <strong>为 promotion case 蓄势</strong>（高潜员工被 senior leaders 看见，下个周期 promo 阻力小）。<br><br><strong>真实经验</strong>：在 infrastructure 团队第一次 calibration（4 个 EM 共 30 人）时：<br>① 我准备了我 8 人团队的 ratings + 2-paragraph 每人 evidence；<br>② 会上发现我给的 ratings histogram 比其他 EM 高 0.5（typical new EM bias）→ 校准下来 2 人 rating 调低；<br>③ 另一 EM 给一个 senior eng 评 "needs improvement"，我和另一 EM 提出 evidence 不足 → 调成 "meets expectation" + 标 promo block；<br>④ 整个过程 3 小时，所有 EM 学到怎么写 evidence；<br>⑤ 后续 review delivery 时，员工被 calibrate 后的 rating 不 surprise（因为我们提前 ongoing feedback）。<br><br><strong>陷阱</strong>：① 没 evidence 就调分 → 不公平 / 不可申诉；② 调分后 EM 不会 deliver（"我本来给你 5，calibration 调成 4"）→ 暴露 internal process / 损害 trust；③ 用 forced ranking（强制 1-2-7 distribution）→ 团队恶性竞争 / sandbag；④ 不让 ICs 看 calibration process → 觉得"黑箱"。<br><br><strong>实践建议</strong>：① calibration 之前一个月做 dry run（self-calibration）；② 高潜要让 senior leaders 知道（在 calibration 上下文）；③ 调分必有 evidence 修订（不只是"committee 决定"）；④ Calibration session 的结论是 sticky（不要会后又个别 EM 私下改）。`,
      },
      failure_modes: [
        `没 evidence 就调分 → 不公平 / 不可申诉`,
        `EM 跟员工 deliver 时说 "本来是 X，被 calibrate 成 Y" → 暴露过程 / 削弱 trust`,
        `Forced ranking（强制 distribution）→ 团队恶性竞争 / sandbag`,
        `Calibration 完没写 rationale → 半年后 promo / PIP decision 没依据`,
        `让 calibration 变成"EM 互相 trade votes"（你帮我 push X，我帮你 push Y）→ Process 失败`,
      ],
      follow_ups: [
        { q: `Calibration 调低了一个员工的 rating 怎么 deliver？`, hint: `① 不暴露 calibration 过程；② 用 ongoing feedback 包装（"这个季度的 X / Y / Z 让我 reassess"）；③ 给 specific action items（怎么回升）；④ 给员工 disagree 的空间但表明决策是 final` },
        { q: `跨 team calibration 跟 promo committee 关系？`, hint: `两者通常分开：calibration 评年度 rating（影响 comp / bonus）；promo committee 评晋升候选（独立流程）。但高潜 calibration 时被识别后，下个 promo 周期 sponsor 更强` },
        { q: `Calibration 怎么避免 EM bias？`, hint: `① Evidence-based discussion（不是"我觉得"）；② Diverse panel（gender / function / seniority）；③ Track manager-level data over time（某 EM 是否长期给某类员工高/低分）；④ 训练 EM 识别 unconscious bias` },
      ],
    },

    37: {
      why_asked: `验证候选人是否真做过 promotion 评审。能讲"evidence pack / sponsor / no surprise"的人通常 promo 过下属。`,
      answers: {
        mid: `Promotion Packet 包含：① <strong>Self-assessment</strong>（员工自评，按下个 level expectations）；② <strong>Manager assessment</strong>（你的评估 + 推荐）；③ <strong>Evidence</strong>（具体 deliverable / impact / cross-team feedback，3-5 个 STAR 故事）；④ <strong>Peer testimonials</strong>（3-5 个）；⑤ <strong>Sponsor 推荐</strong>（更 senior 的 leader 支持，关键）。`,
        senior: `<strong>EM 在 promotion 中的角色</strong>：① <strong>提前 6 个月开始铺路</strong>——别人看见员工的"已经在做下个 level 的活"；② <strong>整理 evidence pack</strong>，不依赖员工自己写；③ <strong>找 sponsor</strong>（如 skip-level / cross-team senior）；④ <strong>预 review</strong>（找 peer EM 模拟 committee 攻击）；⑤ <strong>本人 review 不 surprise</strong>（员工提前 3-6 个月知道在被 considered）。`,
        staff: `深一层：promo 成败的 60% 在 packet 之前——是<strong>"过去 6-12 个月这个员工是否被 senior leaders 看见在做 next-level work"</strong>。Packet 是<strong>把已发生的事 narrate 成 promo case</strong>，不是 last-minute 制造 evidence。<br><br><strong>真实经验</strong>：我曾 sponsor 一个 senior → staff 的晋升，提前 9 个月开始铺：<br>① 给他分配跨团队 lead 项目（visible to senior leaders）；<br>② 每月 push 他在 senior leadership review 做 5 min 汇报；<br>③ 找 2 个 sponsor（VP 和 peer team senior staff）；<br>④ 帮他写 packet（他写第一稿，我改 3 轮）；<br>⑤ 预演 promo committee 可能问的 attack questions。<br><br><strong>结果</strong>：committee 90% no questions（packet 已经回答了所有可能的疑问），过了。<strong>对比反例</strong>：另一同事 senior 想晋升 staff，没提前铺路 / 没 sponsor / packet last-minute → committee 一堆质疑 → reject + "再观察 1 年"。<br><br><strong>陷阱</strong>：① Last-minute promo case（packet 看起来在编故事）；② 没 sponsor（committee 没人为你 fight）；③ Self-assessment 比 manager assessment 还激进（red flag）；④ Evidence 全是 individual 不带 cross-team（无 leadership signal）；⑤ Manager 当年才发现要 promo，员工 already disengaged。<strong>建议</strong>：① 一进 calibration / promo cycle 前 2 个 quarter 跟员工对齐"是否 work towards promo"；② 不到 promotion bar 也要诚实告知（管理 expectation）；③ Promo 被拒后 24h 内 1on1，明确 reason + next steps，避免员工冲动离职。`,
      },
      failure_modes: [
        `Last-minute 才开始铺 promo（packet 看起来编故事）`,
        `没 sponsor → committee 没人 fight → reject`,
        `Self-assessment 比 manager assessment 激进 → red flag`,
        `Evidence 只有 individual contribution，没 leadership / cross-team / mentorship 信号`,
        `员工不知道在被 considered → 被拒时 surprise / 冲动离职`,
      ],
      follow_ups: [
        { q: `下属 Promotion 被拒怎么办？`, hint: `① 24h 内 1on1 不延迟；② 明确具体 gap（不是模糊 "你需要更多 impact"）；③ Action plan：next 6 months 做什么；④ 让员工知道你仍然 sponsor 他；⑤ 如果 retention risk，考虑 visible role assignment / comp adjustment` },
        { q: `下属 promotion 一直 block 在某 level 怎么办？`, hint: `① 诚实 conversation：是否他的 strengths 不匹配 next level expectations；② 横向 move（不同团队 / 不同 specialization）；③ Coaching/mentoring 补 gap；④ 接受现实（不是所有人都 want / can promote）` },
        { q: `Sponsor 怎么找？`, hint: `① Skip-level / VP（自然 sponsor）；② 跨团队 senior（员工帮助过的）；③ 不能找太"远"（committee 不熟没 weight）；④ Sponsor 要 active（在 committee 上发声，不只挂名）` },
      ],
    },

    39: {
      why_asked: `EM 必考的"困难场景"题。能区分"low performer"和"差表现 phase"的人通常实际处理过这类事件。`,
      answers: {
        mid: `<strong>4 步</strong>：① <strong>诊断</strong>——是 skill / will / context / personal life 哪类？（4 种应对完全不同）；② <strong>直接对话</strong>——SBI 给具体 feedback + 30 天目标；③ <strong>每周 check-in</strong> 30 天看是否改善；④ <strong>没改善 → PIP</strong>，改善了 → 持续监控。`,
        senior: `<strong>关键诊断</strong>：① <strong>Skill gap</strong>（不会做）→ 训练 / mentor / pair / 调整任务；② <strong>Will gap</strong>（不想做）→ 1on1 挖根因（burnout / 错位 / personal）；③ <strong>Context gap</strong>（不懂业务）→ onboarding / docs；④ <strong>Personal</strong>（家事 / 健康）→ HR / 弹性政策 / 短期休假。<strong>关键</strong>：① 越早识别越好（3 个月内）；② 不要忽视（"再观察一下"是新 EM 最常犯的错）；③ 不要先 PIP（先 informal feedback + 30 day plan）。`,
        staff: `深一层：<strong>low performer 是 EM 工作里 emotional cost 最高的</strong>——员工 deny / 情绪反应 / 自己同情心受挫。所以新 EM 倾向"再观察一下"拖延，结果是<strong>团队其他人开始不满</strong>（"为什么我们多做他不做"），低绩效 contagion 蔓延。<br><br><strong>真实经验</strong>：在带 8 人团队第 5 个月发现一个 senior dev 连续 2 个 sprint 没 deliver，最初我想"是不是分配不合理"，做了：<br>① 1on1 直接谈："过去 2 个月我看到的 deliverable 是 X，预期是 Y，gap 在 Z。你怎么看？" 对方一开始 deny → 我给具体 evidence → 对方承认有挑战。<br>② 挖根因：是 burnout（家庭压力）+ 学习曲线（新技术栈不熟）双重原因。<br>③ 30 day plan：减少负载 + pair 1 周补技术 + 弹性 schedule 顾家。<br>④ 每周 check-in：30 天后明显改善（80% return），3 个月完全恢复。<br><br><strong>反例</strong>：另一员工同样状况但根因是 will gap（不想做，因为对方向不认同）—— 30 day plan 后没改善 → PIP → 3 个月后离职。这种情况<strong>没 will 真的没办法</strong>，PIP 是 transitional process（让员工自主决定走还是改），不是惩罚。<br><br><strong>陷阱</strong>：① 拖延（"再观察"）→ 6 个月后被迫 PIP 时员工已 surprise；② 不诊断就 PIP（skill gap 应该是 coaching，不是 PIP）；③ 公开议论（"X 表现不行"）→ 法律 / HR 风险；④ Personal life 当 will gap（家人病了不是不努力）。<strong>原则</strong>：<strong>"快速诊断、早期介入、明确 path forward（成功或离开），决不暧昧拖延"</strong>。`,
      },
      failure_modes: [
        `拖延（"再观察一下"），3 个月变 9 个月，团队 morale 受损`,
        `不诊断 skill vs will → 直接 PIP skill gap 员工（应该 coaching）`,
        `Personal life 当 will gap 处理 → 缺乏同理心 / 法律风险`,
        `跟同事议论该员工 → 隐私 / 法律红线`,
        `Feedback 太软（"加油加油"）→ 员工不知道严重性 → 没改 → review 时 surprise`,
      ],
      follow_ups: [
        { q: `怎么诊断 skill vs will？`, hint: `① Skill：尝试过没成功 / 主动求助 / 焦虑——这类需要 coaching；② Will：能做但不投入 / 主动 disengage / 找借口——这类需要 motivation conversation 或 PIP；③ Context：刚加入 / 新业务——need onboarding` },
        { q: `Low performer 拒绝承认怎么办？`, hint: `① 准备 specific evidence（不能"我觉得"）；② 用 360 feedback（peers 的观察）；③ 给对方时间消化（不在一次 1on1 强迫认）；④ 最终 written warning 让对方无法 deny` },
        { q: `团队成员发现你处理 low performer 太软怎么办？`, hint: `① 重新评估自己是不是过度同情；② 跟 HR / mentor 校准；③ 明确 timeline 给团队信号（不暴露 specific case but 显示流程在进行）；④ 不公开 specific 处理但暗示 process underway` },
      ],
    },

    40: {
      why_asked: `验证候选人是否真做过 PIP（不是只听过流程）。能讲"PIP 是 transitional 不是惩罚"的人是真在做这件事时挣扎过。`,
      answers: {
        mid: `<strong>PIP（Performance Improvement Plan）</strong>设计：① <strong>明确 expectations</strong>（具体 deliverable + measurable）；② <strong>30-60-90 day milestone</strong>；③ <strong>每周 check-in</strong>；④ <strong>HR 全程介入</strong>（compliance）；⑤ <strong>明确 outcome</strong>：成功 → 持续 employment + 监控；失败 → severance + exit。`,
        senior: `<strong>关键原则</strong>：① PIP 是 <strong>transitional process</strong>，不是惩罚——给员工"决定改或离开"的明确空间；② <strong>HR + 法务 review</strong>（防 wrongful termination 诉讼）；③ <strong>明确 measurable</strong>（不是"提升 communication"，是"per week 1 个 cross-team sync + meeting notes shared"）；④ <strong>员工签字</strong> acknowledge 收到 + 理解条件；⑤ <strong>EM 时间投入</strong>大（typical 30% 自己时间 in 60-90 days）。`,
        staff: `深一层：PIP 的<strong>真实 ROI 通常很低</strong>——业内统计 ~20-30% PIP 真的 "improve back"，70-80% exit。所以 PIP 的<strong>主要价值是 legal cover + 公平流程</strong>，而不是"真的指望改善"。<strong>很多公司</strong>（如 Netflix）干脆不做 PIP，用 generous severance 直接 part ways——效率高但需要文化支撑。<br><br><strong>真实经验</strong>：做过 2 次 PIP，1 成功 1 失败。<br><strong>成功案例</strong>：senior dev skill gap（新技术栈），60-day PIP：① 每周 pair programming 4h；② 减少 stretch 任务；③ Mentor 1-on-1 weekly；④ HR 全程见证。结果：60 天后 80% 任务能独立 → 90 day 监控期 → 持续 employment + 12 个月后晋升到 senior+。<br><strong>失败案例</strong>：mid eng will gap，60-day PIP：① 设定 clear deliverable；② 每周 check-in；③ HR 全程。结果：员工感觉被 punish + 90 day 末仍未达 → severance + exit（双方都接受 outcome）。<br><br><strong>关键 learnings</strong>：① PIP 不应该 surprise（前 3-6 个月已有 ongoing feedback）；② 失败也不是 manager 失败，是 system 给员工最后机会；③ 不要试图"让员工自己 quit" 而不写 PIP（构成 constructive dismissal，法律风险）；④ PIP 期间团队不应该 know specifics（隐私），但可能感觉到（"X 最近 quieter"），透明度 vs 隐私需要 balance。<strong>陷阱</strong>：① PIP 写得过软（员工通过 PIP 但实际没真改）→ 60 天后又一轮 PIP（团队失望）；② PIP 写得过 specific 不可达 → 法律风险（"setting up for failure"）；③ 不让 HR 参与 → 流程不合规；④ PIP 期间还 promote / give visible projects → 自我打脸。`,
      },
      failure_modes: [
        `PIP 内容不可达 → 法律风险（被诉 "setting up for failure"）`,
        `PIP 过软 → 通过但实际没改 → 60 天后又一轮 PIP`,
        `不让 HR 参与 → 流程不合规 / wrongful termination 风险`,
        `PIP 期间公开议论该员工 → 隐私 / 法律红线`,
        `期待"让员工自己 quit"绕过 PIP → constructive dismissal 风险`,
      ],
      follow_ups: [
        { q: `PIP 过程中员工情绪崩溃怎么办？`, hint: `① 暂停技术讨论，先 emotional support；② 推荐 EAP（员工心理咨询）；③ 跟 HR 同步；④ 如果是 medical（depression / anxiety），考虑 medical leave；⑤ PIP timeline 暂停（不是终止）` },
        { q: `PIP 成功后怎么 reintegrate？`, hint: `① 90-day 监控期（不是马上恢复 stretch 任务）；② 季度 calibration 看 sustainability；③ 心理上 acknowledge 不容易（一句 "I appreciate your effort during this time"）；④ 不在 team 公开讨论` },
        { q: `Netflix 不做 PIP 直接 severance 适用什么场景？`, hint: `① 文化强支撑（"keeper test"）；② High talent density 团队；③ Generous severance（typical 6-12 months）；④ Top-of-market comp；不适合大多数公司，PIP 仍是默认` },
      ],
    },

    // ============== 离职 / 解雇 ==============
    45: {
      why_asked: `EM 最 emotional 的工作之一。能讲"准备 + 简洁 + 尊重"的人是真做过 termination conversation。`,
      answers: {
        mid: `<strong>解雇对话</strong>的 4 步：① <strong>充分准备</strong>（HR / legal / package details / written script）；② <strong>对话本身 ≤ 5 分钟</strong>——直接告知 decision + reason，不 negotiate；③ <strong>HR 在场</strong>见证 + 处理 admin details；④ <strong>员工尊严</strong>——同一天结束 access，但给 transition support（severance / 推荐信 / outplacement）。`,
        senior: `<strong>关键原则</strong>：① <strong>Decision 已定再开口</strong>，不是 "discussion"；② <strong>简短 + clear</strong>（员工记忆 fog，越长越糟）；③ <strong>不 explain 太多</strong>（每解释一个 reason 就给员工 fight 一个）；④ <strong>第一次告知后立即离开 work setup</strong>（同一天关 access，避免 retaliation 风险）；⑤ <strong>团队沟通</strong>：当天 / 次日告知团队（不是几天后才发现位子空了）。`,
        staff: `深一层：<strong>解雇对话的真实挑战是 emotional regulation</strong>——你和员工都在 stress + 你前夜可能没睡好。<strong>所以脚本化是必要的</strong>，不是冷漠是负责。<br><br><strong>真实经验</strong>：我做过 2 次解雇（一次 performance-based，一次 layoff）。第一次 performance-based 我紧张到前夜失眠，准备了 written script + role play 跟 HR 演练 2 次。当天 5 min 对话：<br>1) 开门见山："I have difficult news. Effective today, we're terminating your employment."（不寒暄）<br>2) Reason 一句："Despite the PIP process, your performance hasn't met the expectations required."（不展开 evidence，已在 PIP 文档中）<br>3) Transition："HR will walk you through severance and benefits. Your access will end today; you can collect personal items with HR support."<br>4) Listen 但不 negotiate：员工反问 "but I thought..."—— "I understand this is difficult, but the decision is final."<br>5) 5 min 结束 + HR 接管。<br><br><strong>结果</strong>：员工 surprise 程度低（PIP 已经在进行），有不满但接受。我之后向团队发了一条 1-paragraph message（不写 specific reason，"X has left the company, we wish them well"）。<br><br><strong>陷阱</strong>：① 拖延对话超过 10 min → 员工进 negotiate mode → manager softer → 不好结束；② 详细 explain reasons → 给 fight ammo；③ 让员工继续 access 几天 → IP / data 风险；④ 周五下午做（员工周末没 transition support） → 推荐周一 / 周二上午；⑤ 后续不给 transition support（severance / outplacement / 推荐）→ 业内口碑差。<strong>原则</strong>：<strong>"解雇是 decision moment 不是 conversation moment，但 decision 之前的 conversations（feedback / PIP）让 decision 不 surprise"</strong>。`,
      },
      failure_modes: [
        `对话拖延 / 软 → 员工 negotiate / EM 妥协 → 不可收场`,
        `详细 explain reasons → 给员工 fight ammo / 法律 vulnerability`,
        `周五下午做 → 员工周末没 emotional support`,
        `不让 HR 在场 → wrongful termination / 不公平对待诉讼风险`,
        `团队几天后才发现 → rumor mill / morale 受损`,
      ],
      follow_ups: [
        { q: `解雇当天员工情绪崩溃怎么办？`, hint: `① HR 接管 emotional support；② Offer 私人空间收拾；③ 推荐 EAP；④ Severance package 包含 transitional benefits；⑤ 不让员工驾车回家如果情绪太激动` },
        { q: `怎么告知团队？`, hint: `① 当天 / 次日团队 group meeting；② 1-2 句 official statement（"X has left, we wish them well"）；③ 不讲 reason（隐私）；④ Q&A 时 redirect ("if you have specific concerns about your role, we can 1on1")；⑤ 接下来一周 team morale check` },
        { q: `Layoff 跟 performance termination 区别？`, hint: `Layoff：position 被 eliminated（不是个人 performance issue），通常 broader severance + 推荐信 + outplacement；Performance：individual issue，severance 较少；员工感受和 storytelling 给下家完全不同` },
      ],
    },

    47: {
      why_asked: `2023-2025 年 layoff 频发，所有 EM 都可能遇到。能讲"clear criteria + double-check bias + dignity" 的人通常真主持过 RIF。`,
      answers: {
        mid: `Layoff 处理 5 步：① <strong>跟 HR / leadership 对齐</strong>（数量 / 时间 / 标准 / severance）；② <strong>制定 selection criteria</strong>（performance / skill alignment / role redundancy；明确 not 个人特征如 age / gender / race）；③ <strong>提交 list + bias check</strong>（HR / legal review）；④ <strong>D-day 同时通知</strong>（所有人同一天）；⑤ <strong>Survivor support</strong>（留下的人需要 reassurance + transparency）。`,
        senior: `<strong>关键原则</strong>：① <strong>EM 自己也可能不知道是不是 cut 自己</strong>（直到决定 final），需要管理好 own emotion；② <strong>不能 hint / leak</strong>给团队（公平 + legal）；③ <strong>Selection criteria 必须 documented</strong>（防 discrimination 诉讼）；④ <strong>D-day 1:1 通知每个被 cut 的人</strong>（不是 group call）；⑤ <strong>同一天</strong>所有被 cut 的人都告知（防"为什么我先"的不公平感）。`,
        staff: `深一层：layoff 是 EM 最痛的经历之一——你不仅在<strong>失去同事 / 朋友</strong>，还在做<strong>选择"谁走"的决定</strong>。<strong>Self-care 关键</strong>：① 找 mentor / coach 同步 emotion；② D-day 后 EM 自己也需要 down time（typical 1-2 周 emotional recovery）。<br><br><strong>真实经验</strong>：2024 年经历过一次行业 layoff round（我团队 8 人 cut 1）。整个过程 2 周：<br>① Week 1：跟 VP align criteria（role redundancy + skill mismatch with future roadmap），不是 performance based；<br>② Week 1：HR 给我 framework，我提名 + 写 rationale；HR + legal review；<br>③ Week 2 周一：D-day。同一上午 9-10 AM 我做了 1:1 通知 + HR 接管 details；同时间公司 group meeting communicate 整个 layoff scope；<br>④ Week 2 下午：跟剩余 7 人 group meeting："Today X left as part of company-wide restructuring. This is not a comment on their performance—it's role-based decision. Here's what's next for our team..."<br>⑤ Following weeks：每周 team check-in，1on1 给每个人空间 process emotion，明确"你不是 next round"（如果 indeed 你不是）。<br><br><strong>关键 learnings</strong>：① 被 cut 的人需要尊严 + 实质支持（generous severance / outplacement / 推荐信 / health insurance bridge）；② Survivor 需要透明 + 重新对齐目标（不是"装作没发生"）；③ EM 自己也 grieve，不要假装 OK。<strong>陷阱</strong>：① Selection 没 documented bias check → 法律风险；② D-day 通知不在同一时间 → 第一个被通知的传话给其他人 → 混乱；③ Survivor 不沟通 → rumor mill + morale 崩 + 顶级 talent 主动离职；④ EM 自己 burnout 但继续工作 → decision quality 退化。`,
      },
      failure_modes: [
        `Selection criteria 不 documented → discrimination 诉讼风险`,
        `D-day 通知不同时 → 信息泄露 / 不公平感`,
        `Survivor 沟通失败 → rumor / morale 崩 / top talent 主动离职`,
        `Layoff conversation 时 explain too much → 员工 fight + emotion 失控`,
        `EM 自己不 process emotion → 后续 1-2 个月 decision quality 下降`,
      ],
      follow_ups: [
        { q: `Survivor 谁可能离职？怎么挽留？`, hint: `① High performer 通常 first 离职（market option 多）；② Retention conversation 提前；③ 透明分享 roadmap + 强化 vision；④ 必要时 retention bonus / promo；⑤ 高度 1:1 attention 头 1-2 个月` },
        { q: `Layoff 之后怎么对外讲？`, hint: `① 不在 public LinkedIn / Twitter 发表评论；② 给被 cut 的人写 strong recommendation；③ 在自己后续面试中 framing："restructuring meant some difficult decisions, here's what I learned"；④ 不 throw company under bus` },
        { q: `Layoff 后怎么重建团队 trust？`, hint: `① Action over words（持续 deliver + retain rest of team）；② 至少 3-6 个月 stability（不再小动作）；③ 透明 communication cadence（weekly team meeting + 月度 town hall）；④ 给 survivor 成长机会（visible projects / promotion paths）` },
      ],
    },

    48: {
      why_asked: `Layoff 之后最容易被忽视但最关键的工作。能讲"transparent + reaffirm + future-focused"的人通常做过 post-RIF 团队。`,
      answers: {
        mid: `Survivor 稳定 4 步：① <strong>当天 group meeting</strong>解释 layoff 是什么 / 不是什么（明确 not performance based）；② <strong>1on1 周内</strong>给每个人空间 process + 确认他们 not next；③ <strong>重新对齐目标</strong>（团队规模变了，priorities 调整）；④ <strong>持续 3-6 个月稳定</strong>（不要再小动作 / 改 reporting line / 新 initiative）。`,
        senior: `<strong>关键心理学</strong>：survivor 经历"<strong>survivor's guilt</strong>"（"为什么是他不是我"）+ "<strong>uncertainty anxiety</strong>"（"下一波是不是我"）+ "<strong>workload anxiety</strong>"（"被 cut 的人的活归谁"）。三者都要回应：① 不是个人 performance issue（重申）；② 当前没有 next round 计划（如果 true）；③ 工作量重新评估 + reset priorities（不是简单加 80% workload）。`,
        staff: `深一层：survivor 看 EM 的<strong>言行不一</strong>非常敏锐。EM 说"团队会稳定"但接下来 1 个月 chasing same OKRs as before（没承认人少了）→ survivor 觉得你不诚实 → trust 崩。<br><br><strong>真实经验</strong>：layoff 之后我做了：<br>① Week 1: Group meeting reframe layoff（"This is not performance-based, this is role-based. Going forward, our team has 7 instead of 8."）；<br>② Week 1-2: 1on1 with each remaining 7 人，给空间 process emotion，明确"<strong>I don't know everything but I commit to be transparent</strong>"；<br>③ Week 2-3: 重新跟 product / VP align：人少 1 个意味着 cut Y / 慢 Z / drop A 一项；<br>④ Week 3 团队 group: 公布调整后的 priorities，明确"我们不会试图 cover all 之前的 scope，这是现实接受"；<br>⑤ 接下来 3 个月每周 team meeting 留 10 min "anything top of mind / questions"；<br>⑥ 半年后 team retro，回看怎么过来的。<br><br><strong>结果</strong>：6 个月后只 lost 1 个 senior（去更高 comp），其他全部 retained + delivery 恢复到 layoff 前 85%（接受 15% reduction）。<br><br><strong>陷阱</strong>：① "回到正常" 心态（实际不会回到 prior 同人配置同 scope）；② Survivor 工作量 silent 加 30% 没承认 → burnout 在 3 个月后爆发；③ EM 自己也焦虑但 hide → survivor 感觉到不安；④ 主动 reorg / new strategy 在 layoff 后 1 个月 → over-loading change → 团队崩溃；⑤ 给 survivor "高潜要扛起来" pep talk → 感觉被 manipulate / pressure。<strong>原则</strong>：<strong>"诚实大于乐观，行动大于话术，时间是 healer"</strong>。`,
      },
      failure_modes: [
        `"回到正常"心态 → 没承认人减少了 / scope 没调 → workload 80% 加给 survivors`,
        `Silent 加任务 → 3 个月后 burnout 爆发`,
        `EM 自己 hide own emotion → survivor 觉得不诚实 / 不安全`,
        `Layoff 后 1 个月又搞 reorg / new initiative → over-loading change → 崩溃`,
        `给"高潜扛起来"pep talk → 感觉被 manipulate → cynicism`,
      ],
      follow_ups: [
        { q: `怎么识别 survivor burnout 早期信号？`, hint: `① 1on1 quieter / 不抱怨（不是 healthy 而是 disengage）；② PR / commits decline；③ 请病假 / PTO 增加；④ Direct quit signals (LinkedIn 突然 update / 询问 reference)；⑤ 跟 mentor 同步早期识别` },
        { q: `Layoff 后该不该 push promotion / raise？`, hint: `① Layoff 后 3-6 个月 try not to introduce big change；② 但 high performer retention 需要 visible reward → 选 limited but meaningful retention bonus / promo（不是 mass change）` },
        { q: `如果再来一轮 layoff EM 怎么处理？`, hint: `① 提前 push leadership transparent（"如果再来，告诉我们")；② 自己 emotion 准备好；③ 第二轮通常更 brutal（剩余团队已 fragile）；④ 严肃考虑 own next move（如果连续 layoff 是 sign of org instability）` },
      ],
    },

    // ============== 危机 / 事故 ==============
    61: {
      why_asked: `事故是 EM 角色最 visible 时刻之一。能讲"协调而非 hands-on debug"的人是真做过 incident commander 角色。`,
      answers: {
        mid: `P0 事故时 EM 的 4 个角色：① <strong>Communicator</strong>——向 VP / 客户 / stakeholder 汇报状态（不是 hands-on debug）；② <strong>Coordinator</strong>——确保对的人在 incident room（PagerDuty / Slack channel）+ 移除 blocker；③ <strong>Decision-maker</strong>——rollback vs forward fix / 升级到更高 leadership / 公开 status page；④ <strong>Buffer</strong>——挡住 leadership 的"how soon" 噪音让团队专注 debug。`,
        senior: `<strong>关键原则</strong>：① <strong>EM 不是 incident commander</strong>（除非临时；通常 senior IC / SRE 做）；② <strong>不抢键盘 debug</strong>——你的角色是 enable，不是 do；③ <strong>每 30 min update</strong>（stakeholder 不在 channel 不知道进度 → 焦虑加倍）；④ <strong>记录 timeline</strong>（事后 postmortem 用）；⑤ <strong>oncall engineer 的 mental wellbeing</strong>——3h 后强制轮换 / 食物 / 休息。`,
        staff: `深一层：<strong>EM 在事故中的 leverage 远大于一个 IC</strong>——你扛住 leadership noise = 让 5 个 engineer 多 50% productivity。但<strong>很多新 EM 不知道这点</strong>，倾向跳进去帮 debug（"我还会写"），结果团队没人协调 → 事故拖长 + leadership 失控。<br><br><strong>真实经验</strong>：电信项目曾遇过 P0 事故（核心 platform agent crash loop 影响 2000+ 设备）：<br>① <strong>0-5 min</strong>：oncall declared P0，我作为 EM 加入 Slack channel；<br>② <strong>5-15 min</strong>：拉 senior SRE 进来当 incident commander，我转作 communicator 给 VP 发了首条 status；<br>③ <strong>15-90 min</strong>：每 20 min update VP / 客户 / product；挡住一个高管 "how soon" 噪音（让 incident commander 专注）；coordinate 拉 senior engineer 从其他时区起床加入；<br>④ <strong>90-180 min</strong>：team identified rollback safe + 2 senior 准备 forward fix。<strong>我做了 rollback decision</strong>（balance forward fix 风险 vs rollback 时长）—— rollback；<br>⑤ <strong>180-240 min</strong>：service recover，monitor 30 min 确认 stable；<br>⑥ <strong>240+</strong>：postmortem 周一组织，期间 oncall engineer 周末休息（我把 routine task 给其他人 cover）。<br><br><strong>结果</strong>：4h MTTR，VP 满意 communication 透明，oncall engineer 没 burnout。<br><br><strong>陷阱</strong>：① EM 抢 debug → 没人 communicate → leadership 进 panic mode → call EM 老板 → wider escalation；② Update 间隔太长（&gt; 1h）→ stakeholder 焦虑乘以；③ rollback / forward 决策犹豫 30 min+ → 系统继续坏；④ 事故后不强制 oncall recovery → burnout / quit。<strong>原则</strong>：<strong>"在你的 leverage 处发力，不要 zero-sum compete 团队的 expertise"</strong>。`,
      },
      failure_modes: [
        `EM 抢键盘 debug，导致没人 communicate / coordinate`,
        `Update 间隔 &gt; 1h → leadership 焦虑 → 自己 escalate`,
        `决策（rollback / forward）犹豫 30 min+ → 系统继续坏`,
        `事故后不强制 oncall recovery → burnout / 离职`,
        `事故中跟 VP 报喜不报忧 → 信任丧失 → 后续 less autonomy`,
      ],
      follow_ups: [
        { q: `什么时候应该 escalate 到更高 leadership？`, hint: `① 事故影响 &gt; SLO 阈值 + 持续 30 min；② 跨团队 dependency 不响应；③ 需要 customer communication 决策；④ Legal / compliance 涉及；早 escalate 不丢人，晚 escalate 才丢人` },
        { q: `事故中 leadership 反复问"how soon"怎么办？`, hint: `① 不给假 ETA（"半小时" 然后 4h，trust 崩）；② 给"next milestone"（"team 在 X，我们 30 min 后会知道是 root cause 还是 symptom"）；③ Push back leadership "I'll update at next checkpoint, please let team focus"` },
        { q: `Customer-facing 事故怎么沟通？`, hint: `① 越早 status page 越好（不要 wait until you 100% know）；② Be honest about scope but conservative about ETA；③ Update q 15-30 min；④ Post-incident customer communication（手写 apology + 详细 postmortem extract）` },
      ],
    },

    62: {
      why_asked: `Postmortem 是 EM 培养 learning culture 的核心工具。能讲"blameless + actionable + visible"的人通常推行过。`,
      answers: {
        mid: `Postmortem 标准结构：① <strong>Timeline</strong>（事故 timeline，detection → mitigation → resolution）；② <strong>Impact</strong>（多少用户 / 多长时间 / SLO budget 消耗）；③ <strong>Root cause</strong>（technical + process + organizational）；④ <strong>Action items</strong>（具体 + 有 owner + 有 deadline）；⑤ <strong>Lessons learned</strong>（防范类似事故）。`,
        senior: `<strong>关键原则</strong>：① <strong>Blameless</strong>——"是什么 process / system 让人犯错"，不是"谁错了"；② <strong>Action items 跟踪到 closure</strong>（不是写完就完，要进 backlog + monitor）；③ <strong>Visible</strong>——团队 / 跨团队 review，不只是 team internal；④ <strong>48-72h 内完成</strong>（记忆鲜活）；⑤ <strong>区分 contributing factors vs root cause</strong>（5 Whys 挖到 systemic 原因）。`,
        staff: `深一层：postmortem 失败模式经常是<strong>"看起来 blameless 其实暗暗 blame"</strong>—— action items 是 "X 培训" / "X 加 code review"，实际暗示 "X 不够小心"。<strong>真正 blameless</strong> = system 改进 / process 改进，不是 individual 改变。<br><br><strong>真实经验</strong>：电信项目一次 P0 事故 postmortem 写了 18 个 action items，<strong>分类</strong>：① Technical（4 个：alert 调优 / 增加 chaos test / 改 rollback script / 加 monitoring）；② Process（3 个：rollback decision matrix / oncall runbook 更新 / cross-team escalation）；③ Organizational（2 个：staffing oncall shift, knowledge silos）。<br><br><strong>关键</strong>：每个 action item 都有 owner + due date + 周度跟踪。3 个月后 review：90% closed，2 个仍 open（其中 1 个是 systemic 改造 6 个月 timeline，1 个 dropped 因为 不再 relevant）。<strong>这种 "track to closure" 是文化建立的关键</strong>—— 团队看到 postmortem 真的 lead to change，下次更愿意 honest 写。<br><br><strong>反例</strong>：见过其他团队的 postmortem 写得漂亮但 action items 6 个月后 70% 仍 open → 下次事故同样问题再发 → 团队 cynicism →"postmortem 就是表演" → quality 下降 → 学习闭环失败。<br><br><strong>陷阱</strong>：① 表面 blameless 实际 blame（细节出卖你）；② Action items 太多（&gt; 20）→ 都做不完 → 失信用；③ 不区分 contributing vs root cause → 改了 symptom 没改 root；④ Postmortem 只 team internal review → 跨团队没 learning；⑤ 不 track action items closure → "写完就忘"。`,
      },
      failure_modes: [
        `表面 blameless 但 action items 暗藏 blame（"X 要更小心"）`,
        `Action items 太多 → 都做不完 → 失信用`,
        `不 track closure → 6 个月后 60-70% 仍 open → 学习闭环失败`,
        `只 team internal review → 跨团队没 cross learning`,
        `Root cause 停在 technical（不挖到 process / organizational systemic 原因）`,
      ],
      follow_ups: [
        { q: `怎么真正做到 blameless？`, hint: `① 用 "the system did X" 不用 "X person did Y"；② Train facilitator 识别 blame language；③ Make it safe to share mistakes（leader 自己 first 分享自己的 mistake）；④ Reward people who report problems early` },
        { q: `Action items 怎么不变成"backlog 黑洞"？`, hint: `① 每月跟踪 status；② 季度 review 公开；③ 与 OKR / sprint planning 整合（action items 是 backlog 一部分）；④ 90 day stale 自动 escalate or close-with-rationale` },
        { q: `跨团队事故 postmortem 怎么开？`, hint: `① 中立 facilitator（不属于任何一方）；② Group blame 风险高 → 强 emphasize blameless；③ Action items 跨团队 ownership 明确；④ Manager-of-Managers 见证 + sponsor follow-up` },
      ],
    },

    66: {
      why_asked: `验证候选人是否处理过 customer-facing crisis。能讲"transparency + early + don't speculate"的人是真做过这件事。`,
      answers: {
        mid: `<strong>给 VP/客户的 4 原则</strong>：① <strong>早</strong>（10-15 min 内首次沟通，不 wait until 100% known）；② <strong>简短</strong>（status + impact + ETA bracket，不展开 technical detail）；③ <strong>诚实</strong>（不知道说不知道，不 speculate）；④ <strong>cadence 明确</strong>（"next update in 30 min"）。`,
        senior: `<strong>关键模板</strong>：<br>"<strong>What</strong>: [一句话 impact]<br><strong>Scope</strong>: [多少用户 / region / service affected]<br><strong>Status</strong>: investigating / mitigating / resolved<br><strong>ETA</strong>: [bracket - "30-60 min" not exact]<br><strong>Next update</strong>: [明确时间]"<br>不在初始 update 给 root cause / blame / detailed technical（这些在 postmortem 里）。`,
        staff: `深一层：crisis communication 的<strong>胜负在初始 1 条 message</strong>——这条决定 leadership 对你的信任。<strong>反模式</strong>：① "We're looking into it"（vacuous）；② "should be fixed soon"（speculation，最 dangerous）；③ Too technical（VP 不理解）。<br><br><strong>真实经验</strong>：生产 P0 事故 4h 期间我给 VP 的 timeline：<br><strong>+5 min</strong>: "P0 declared. platform agent crash affecting 2000+ devices in EMEA region. Team mobilized. Next update in 30 min."<br><strong>+35 min</strong>: "Identified suspected root cause in schema schema validation. Considering rollback. Customer impact: device config updates blocked since 10:23 UTC. Mitigation ETA: 30-60 min. Next update in 30 min."<br><strong>+95 min</strong>: "Rollback initiated to commit X. ETA to recovery: 15-30 min. Customer impact unchanged. Next update in 15 min."<br><strong>+120 min</strong>: "Recovery confirmed. Monitoring stable for 30 min. Will send formal incident report by EOD."<br><br><strong>关键</strong>：① 每条都有 What / Scope / Status / ETA bracket / Next update；② 不解释 technical detail（VP 不需要）；③ 不归咎个人（不写 "X engineer made mistake"）；④ 不 promise 不能 deliver（不写 "fixed in 15 min" 然后 4h）。<br><br><strong>结果</strong>：VP 信任 communication 流，没 escalate 到 CEO；客户对透明 communication 反馈 positive（"at least we knew what's happening"），客户 retention 没受损。<br><br><strong>陷阱</strong>：① 第一条 update 太迟（&gt; 30 min）→ leadership panic + 自行 escalate；② Speculation（"should be 15 min"）→ 50 min 后没解决 → trust 崩；③ Detail 太多（VP 看不懂 RPC / schema）→ noise；④ 找借口 / blame other team → 立刻 unprofessional；⑤ 解决后不写 formal report → leadership 不知道 closed。`,
      },
      failure_modes: [
        `第一条 update 太迟（&gt; 30 min）→ leadership 自行 escalate`,
        `Speculation ETA（"fixed in 15 min" 实际 4h）→ trust 崩`,
        `Technical detail 太多 / Jargon → VP 看不懂 → noise`,
        `找借口 / blame other team → 立刻 unprofessional`,
        `解决后不写 incident report → leadership 不知 closed / 未来无 learning`,
      ],
      follow_ups: [
        { q: `给客户的 communication 跟内部有什么不同？`, hint: `① 客户：focus on impact / next step / apology；内部：focus on action / decision needed；② 客户 status page + email；内部 Slack + meeting；③ 时区 / 语言 customer success / account exec 参与` },
        { q: `事故升级到 C-level 怎么办？`, hint: `① 不要 panic 改 communication style；② 同样 template，maybe 更 concise；③ 把"decision needed from you"明确（比如"do we 公布 customer-facing message?"）；④ CSAT / NPS impact 量化` },
        { q: `Post-incident customer communication 怎么写？`, hint: `① 手写 apology email from leadership；② Detailed incident report（不暴露 internal 隐私）；③ Action items 客户能 see；④ Offer credits / make whole；⑤ 1on1 call with key customers` },
      ],
    },

    67: {
      why_asked: `Burnout 是 EM 最难处理的"慢性病"。能讲"早识别 + 双向 + 不只 vacation"的人是真处理过 team burnout。`,
      answers: {
        mid: `Burnout 处理 4 步：① <strong>早识别</strong>（cynicism / 出错频次升 / PTO 锐减 / 1on1 quieter）；② <strong>双向对话</strong>—— EM 不是单方面 decree，要先听员工自己怎么看；③ <strong>结构性 + 个人</strong>双 lever（团队 oncall 频次 / individual rest / 工作量调整）；④ <strong>持续</tracking</strong> 3-6 个月跟踪 recovery。`,
        senior: `<strong>关键洞察</strong>：burnout 不是 "rest more" 能解决—— root cause 通常是<strong>没 autonomy / 没 progress / 没 meaning</strong>（Dan Pink 三要素），加上 chronic overwork。<strong>所以 vacation 是 symptom relief 不是 root fix</strong>。结构性 fix：① 减少 oncall burden（轮换 / 优化 alert / fewer false positive）；② Cut scope（不是所有 project 都要 deliver）；③ Reaffirm meaning（员工知道 their work matters）；④ Give autonomy（不微管理）。`,
        staff: `深一层：team burnout 通常是 systemic 不是 individual—— "one person needs rest" 通常意味着<strong>"team's load is unsustainable"</strong>。<strong>EM 的失败是没在 burnout 之前就识别 unsustainable signals</strong>（持续超时 / 高 PR cycle time / PTO 没人 take）。<br><br><strong>真实经验</strong>：电信团队某 quarter 连续 3 个 P0 事故（每个 4-6h），oncall 轮换的 senior dev 第 8 周开始有 burnout 征兆：① 1on1 quieter；② PR comment 多 cynical；③ 主动 take 周末 PTO（之前从不）。<strong>我的处理</strong>：<br>① 1on1 直接谈："我注意到你最近 X / Y / Z，我担心 burnout。你怎么看？"——对方初期 deny ("just busy"), 我 listen 给空间；<br>② 第 2 次 1on1 对方承认 "感觉 endless firefighting，看不到 light"；<br>③ <strong>结构性 fix</strong>：oncall 加 backup secondary（之前只有 primary，secondary 在压力时拒接）；postmortem action items 优先 alert 调优（减 false positive）；告知 product "下个 quarter cut 30% scope until oncall stabilize"；<br>④ <strong>个人 fix</strong>：他 take 2 周连续 PTO（mandatory disconnect，不查 Slack），oncall transfer to 我 backup；<br>⑤ <strong>Meaning reaffirm</strong>：跟他 talk through "你帮稳定了 infrastructure 客户的核心服务"，并给他参与 oncall 改革的 ownership；<br>⑥ <strong>3 个月 track</strong>：oncall freq 从 3/quarter 降到 0.5/quarter；个人 NPS 回升；keep 在团队。<br><br><strong>陷阱</strong>：① "Take a vacation" 单 fix → 回来 same conditions → burnout 复发；② Public discussion 该 individual 的 burnout → 隐私 / shame；③ EM 不调整团队 workload 期望 → 个人 fix 无效；④ Burnout 等 individual 主动说 → 通常太迟（已 disengage）；⑤ EM 自己也 burnout 但 hide → 不能 model healthy behavior。`,
      },
      failure_modes: [
        `"Take a vacation" 单 fix → 回来 same condition → 复发`,
        `等 individual 主动说 → 通常 already disengage / late`,
        `Public discussion → 隐私 / shame`,
        `不调团队 workload 期望 → individual fix 无效`,
        `EM 自己 burnout hide → 不能 model healthy behavior`,
      ],
      follow_ups: [
        { q: `怎么早识别 team burnout signals？`, hint: `① PTO usage（团队 vs 公司平均）；② PR cycle time 上升；③ 1on1 cynicism；④ Anonymous survey（15Five / Officevibe）NPS 下滑；⑤ Senior departure（first signal）；⑥ Sick day frequency` },
        { q: `EM 自己 burnout 怎么办？`, hint: `① 跟 own manager 坦诚 → escalate 需要的支持；② Take PTO 自己 model healthy；③ Find peer EM / coach；④ Cut low-value work；⑤ 严重的 medical leave 不丢人` },
        { q: `Burnout 后 promote 给该员工合适吗？`, hint: `① 通常不（burnout 期间 evaluation 不准）；② 等 6 个月稳定再 promo；③ 但是给 visible role / autonomy / interesting project 是好的（不同于 promo 但 motivating）` },
      ],
    },

    // ============== 向上沟通 ==============
    80: {
      why_asked: `Senior EM 最高频的"困难场景"。能讲"早 + 数据 + option + ask" 4 要素的人是真做过 difficult upward communication。`,
      answers: {
        mid: `<strong>SCQA 框架</strong>：① <strong>Situation</strong>（背景：项目 X 在 Q3 计划上线）；② <strong>Complication</strong>（坏消息：我们 will miss 2 周）；③ <strong>Question</strong>（implicit：你想知道什么 / 怎么办）；④ <strong>Answer</strong>（我的 recommendation + asks）。<strong>不绕弯</strong>，前 30 秒讲完坏消息。`,
        senior: `<strong>4 要素</strong>：① <strong>早</strong>（24-48h 内，不是 last minute）；② <strong>数据</strong>（不是"感觉"，是"X queries running 2x slow since deploy Y"）；③ <strong>Option</strong>（不是只甩问题，给 2-3 options + trade-off）；④ <strong>Ask</strong>（明确你需要 decision / approval / resource）。<strong>反模式</strong>：① 蹭着 happy update 报坏消息（"by the way..."）；② No data；③ No options；④ No ask（"just wanted to flag"）。`,
        staff: `深一层：<strong>EM 怎么传递坏消息是被老板 evaluate effectiveness 的主要时刻</strong>——任何人都能传递好消息，handle 坏消息看出 leadership maturity。<strong>常见 anti-patterns</strong>：① 拖延（不愿面对）→ 老板从 grapevine 听到 → 信任崩；② 包装太重（"some challenges, but we're confident"）→ 老板 doesn't trust 后续；③ Pessimism / venting → 老板 doubt EM judgment；④ 没 owned the problem → 老板觉得你不可靠。<br><br><strong>真实经验</strong>：在带 RPC 团队时一次 critical project 发现要 miss 6 周 deadline（之前预期 miss 2 周）。我做了：<br>① 周一发现 → 周二中午约 VP 1on1（不 wait 周报 cycle）；<br>② 准备：① 数据（具体 blocker / dependencies / why slip from 2 to 6 weeks）；② 3 options（A: 接受 6 week slip 维持 scope；B: cut 30% scope 保 deadline；C: bring in contractor 1.5x cost 加速）；③ 我的 recommendation（A，因为 cutting scope kills critical feature）；④ Asks（VP 跟 customer success 同步预期 + 同意 contractor 是 backup）；<br>③ 对话本身 15 min：我 5 min 讲完 SCQA，VP 5 min 问 questions，VP 同意 A + back up plan；<br>④ Follow-up：next day 我给 VP 发了 written summary（meeting confirm 用）。<br><br><strong>VP 反馈</strong>："I appreciate you flagging early with options. Many EMs would have hidden this until the last week."<strong>结果</strong>：项目 6 week slip 顺利沟通，customer 没 lose；同时 VP 对我"reliable communicator" trust 增加，下季度给了更大的 scope。<br><br><strong>陷阱</strong>：① 等 weekly report 才说 → 老板 grapevine 先听 → 信任崩；② 没 options，只有 problem → 老板 frustration（"so what do you want me to do?"）；③ Recommendation 不明确 → 老板要花时间 figure out → annoyance；④ No followup written summary → 后续 dispute 没依据。`,
      },
      failure_modes: [
        `拖延 / 等 weekly cycle → 老板 grapevine 先听 → 信任崩`,
        `Vague（"some challenges, but confident"）→ 老板 doesn't trust 后续`,
        `没 options（只甩问题）→ 老板 frustration`,
        `Recommendation 不明确 → 老板花时间 figure out → annoyance`,
        `No followup written summary → 后续 dispute 没依据`,
      ],
      follow_ups: [
        { q: `老板对坏消息 emotional react 怎么办？`, hint: `① 不 push back 立即；② 给空间 process（"I understand this is frustrating, let me know how I can help next steps"）；③ 接受 emotion 但坚守 facts；④ 24h follow up + written` },
        { q: `怎么决定"坏消息"的"分量"？`, hint: `三个维度：① Business impact（钱 / 客户 / SLO）；② 时间紧迫性；③ 跨团队影响。任一 high → escalate immediately；都 low → 周报 + flag` },
        { q: `EM 如何 build trust 让 future bad news 更容易传递？`, hint: `① Consistent good news 也给（不是只 surface problem）；② 准时准确 deliver promised；③ 接受自己 mistake admit；④ 主动 escalate before it becomes crisis；⑤ Be the EM who "doesn't surprise"` },
      ],
    },

    // ============== Senior EM ==============
    95: {
      why_asked: `Senior EM / Director 面试必问。能区分"管 IC" 和 "管 EM" 心智差异的人是真做过 manager-of-managers。`,
      answers: {
        mid: `<strong>5 大差异</strong>：① <strong>影响半径</strong>（10 人 → 50+ 人，跨团队）；② <strong>反馈周期</strong>（quarter → 1-2 年）；③ <strong>具体度</strong>（具体技术决策 → 抽象 org / strategy 决策）；④ <strong>下属类型</strong>（IC vs EM，需要不同 coaching style）；⑤ <strong>自己 visibility</strong>（VP / C-level interaction 增加）。`,
        senior: `<strong>核心心智差异</strong>：从 "execute through team" 变成 "<strong>build managers who build teams</strong>"。Line EM 关心 individual deliverable + team morale；Senior EM 关心 manager effectiveness + sub-team alignment + cross-team systemic 问题。<strong>很多新 Senior EM 失败因为</strong>还在 micromanage IC 决策（应该信任 manager）→ 自己 burnout + 团队 manager 失去 ownership。`,
        staff: `深一层：Senior EM 的<strong>3 个心智重塑</strong>：<br>① <strong>"Coach managers, not ICs"</strong>—— 你的杠杆通过下面的 managers，不再 directly 通过 ICs。但你必须 resist 直接和 IC 聊技术（绕过 manager 是 destroys their authority）。<br>② <strong>"Optimize the org, not the team"</strong>—— 团队边界 / reporting structure / process consistency 跨 sub-teams 是 Senior EM 的 lever。<br>③ <strong>"Strategic over tactical"</strong>—— 你 80% 时间应该花在 next quarter+ 的 problem，不是 this sprint 的 issue。<br><br><strong>真实经验</strong>：我从 Line EM（8 人）升到 Senior EM（25 人 + 3 managers）时，<strong>头 6 个月犯了几个典型错误</strong>：<br>① 还在直接 review 关键 PR（不信任新晋 manager 的 judgment）→ 一个 manager 私下抱怨 "你为什么要 second-guess"；<br>② 跟 IC 1on1（觉得"我还在乎细节"）→ manager 失去 IC pulse；<br>③ Sprint planning 还插嘴细节决策。<br><br><strong>修正</strong>：① 砍 own meeting load 50% + 把 IC 1on1 全 redirect 给 manager；② 我跟 manager 的 1on1 改 weekly 60 min + 议程明确（不是 status report，是 coaching + strategy）；③ 引入 "<strong>manager effectiveness scorecard</strong>"（quarterly 1on1 反馈每个 manager 的 strength / area to grow）；④ 自己时间花在 cross-team architecture / hiring strategy / culture 上。<br><br><strong>6 个月后效果</strong>：3 个 manager 各自 own 自己团队，我 quarterly 看 outcome 不看 sprint，own time 80% on strategic + cross-team。Team NPS 涨 +15。<strong>关键学习</strong>：<strong>"Senior EM 的成功是让 manager 比你做得好（在他们的 domain），你的价值在 systemic / strategic / cross-team enable"</strong>。`,
      },
      failure_modes: [
        `还在 directly 跟 IC 沟通技术 / 决策 → 绕过 manager → manager 失 authority`,
        `Quarterly+ 还跟 sprint 节奏 micromanage → manager 失 ownership + 自己 burnout`,
        `Manager 1on1 当 status meeting（不当 coaching） → manager 不成长`,
        `不投资 cross-team / 跨 sub-team consistency → org silos 形成`,
        `没 manager effectiveness 评估机制 → bad manager 长期占位`,
      ],
      follow_ups: [
        { q: `怎么辅导一个新 EM？`, hint: `① 给 30-60-90 framework；② Weekly 1on1 + 议程模板（不是 status，是 coaching）；③ Pair on tough conversations (give live feedback)；④ Manager peer cohort；⑤ Yearly 360 review` },
        { q: `Manager 表现差怎么办？`, hint: `① 跟 IC PIP 类似 process；② 但 manager 失败 impacts 更多人；③ 通常更早识别（团队 NPS / attrition）；④ 必要时 demote back to IC（不丢脸）` },
        { q: `Senior EM 的 1on1 用什么 cadence？`, hint: `① Manager: weekly 60 min（高 frequency / 高质量 coaching）；② Skip-level IC: quarterly 30 min（pulse + bypass risk）；③ Peer Director: monthly；④ 自己 VP: bi-weekly或 weekly` },
      ],
    },

    97: {
      why_asked: `Senior EM 从 "技术 leader" 转 "business leader" 的关键。能讲 unit economics / runway / ARR 的人是真做过 business case。`,
      answers: {
        mid: `EM 必懂的财务概念：① <strong>Burn rate / Runway</strong>（公司每月烧多少 / 还能撑多久）；② <strong>ARR / MRR</strong>（年 / 月经常性收入）；③ <strong>CAC / LTV</strong>（获客成本 / 客户终身价值，ratio &gt; 3 健康）；④ <strong>Headcount cost</strong>（per engineer fully-loaded $250-400k/year）；⑤ <strong>OpEx vs CapEx</strong>（运营 vs 投资）。`,
        senior: `<strong>EM 视角具体应用</strong>：① <strong>Headcount request</strong> 写 ROI 用 "X engineer cost $300k, will deliver $Y product impact"；② <strong>Build vs Buy</strong> 决策算 fully-loaded cost + 3-5 年 TCO；③ <strong>Infrastructure spending</strong> 跟 product growth align（不是无限扩）；④ <strong>Vendor negotiation</strong> 懂 enterprise contract（multi-year discount / unit price economics）。`,
        staff: `深一层：<strong>EM 不懂 business 是 senior EM ceiling 的最大原因</strong>—— VP / Director 决策时讲 business case，不会照顾你的 technical fluency。<strong>真实经验</strong>：我从 line EM 升 senior 时，第一次跟 CFO present headcount request 完全没准备 business framing—— 我讲了 8 min "team capacity" / "technical debt"，CFO 打断："so what's the ARR impact?" 我哑了。<br><br>之后我做了：<br>① 读完 "Financial Intelligence for Entrepreneurs"（4 周）；<br>② 跟我们 CFO 自愿 mentor 每月 1on1（45 min，谈 business / finance）；<br>③ 把每个 hiring / project request 都翻译成 business impact（"this 5 engineer team will deliver $X ARR / save $Y OpEx / reduce CAC by Z%"）。<br><br>6 个月后：① 第二次 headcount request 100% approved；② 被 VP 提名加入 leadership offsite（previously只 director+）；③ 跟 sales / customer success 协作大大顺畅（之前他们觉得我"只是 tech"）。<br><br><strong>建议给所有 senior EM</strong>：① 至少懂自己公司的 unit economics（cogs / margins / runway）；② 季度看 financial report；③ 跟 CFO / finance partner 建立 working relationship；④ Headcount / project request 永远从 business impact framing 开始；⑤ 学 SaaS / B2B / B2C metrics 基础（Gartner / Bessemer benchmarks）。<strong>不需要</strong>变成 CFO，但要能 conversation。`,
      },
      failure_modes: [
        `Headcount request 用"team capacity"不用"ARR impact" framing → 老板没 leverage 帮你`,
        `Build vs Buy 只算 development cost 不算 5-year TCO`,
        `不懂 unit economics → infrastructure spending 不能 challenge`,
        `Vendor 谈判 only on technical features 不在 commercial terms`,
        `公司财务紧张时 EM 还在 hire / new project → 暴露不懂 business cycle`,
      ],
      follow_ups: [
        { q: `怎么从零学公司财务？`, hint: `① Yahoo Finance 看自己公司 10-K（public）或问 CFO 给 quarterly business review (private)；② 听 a16z / All-In podcast 学 SaaS / VC 基础；③ 找 finance peer mentor；④ Sales / CS 部门 1on1 学 customer economics` },
        { q: `EM 怎么参与 budget planning？`, hint: `① Q-2 quarter 开始 prepare next year plan；② Forecast headcount / contractor / tools / infra；③ 把 ask 翻译成 ROI；④ 跟 finance partner 一起 align；⑤ 跟 product / sales 同步 priorities` },
        { q: `Tech debt 怎么用 business 语言 framing？`, hint: `① "current code 每次 change 5 人天，refactor 后 1 人天 → 5x velocity"；② "Bug 每月 1 次，重构后归零 → reduce on-call / customer escalation"；③ "技术债 block 30% new features → blocking $Y ARR"` },
      ],
    },

    103: {
      why_asked: `Netflix 提出，2020+ 业内 high-performing engineering team 都在追求。能讲"hire bar + 不留 mediocrity + selective layoff"的人是真践行过。`,
      answers: {
        mid: `<strong>Talent Density</strong> = 团队中 high performer 的比例。Netflix 提出 keeper test：<strong>"如果他明天告诉你要离职去其他公司，你会 fight to keep him 吗？"</strong> Yes = high performer；No = generous severance, let them go。`,
        senior: `<strong>提升 talent density 的方法</strong>：① <strong>极高 hiring bar</strong>（不为填坑 hire mediocre）；② <strong>不容忍 mediocrity</strong>（low performer 快速 exit，不拖延 PIP）；③ <strong>顶级 comp</strong>（top-of-market，吸引 top talent）；④ <strong>Selective layoff</strong>（不 cut 一般地 across the board，而是 cut weakest）；⑤ <strong>无 PIP 政策</strong>（Netflix 模式 - 直接 generous severance）。`,
        staff: `深一层：talent density 哲学的<strong>核心是接受"keeping mediocre staff 比 firing them 更昂贵"</strong>—— mediocre staff 拖团队节奏 + drive top talent 走 + 占 headcount slot。Netflix 做到这一步靠 ① 顶级 comp（top of market 90 percentile）；② 文化（"family vs team" — team 必须 high performance）；③ Generous severance（4 month base 等）让 exit non-traumatic。<br><br><strong>真实经验</strong>：在电信团队我跟着 Netflix 模式（部分 adapt）：① <strong>提升 hiring bar</strong>—— 头一年 reject 75% 候选人，团队 hire rate 从 6 人/年降到 3 人/年，但 retention 从 65% 升到 95%；② <strong>不容忍 chronic underperformer</strong>—— 之前 EM 留过 2 个 chronic average 1.5 年，我接手后 6 个月给两人都做了 PIP + exit（generous severance + 推荐信）；③ <strong>Top talent 反馈</strong>："终于 EM 在 fix 这个问题，我感觉值得 invest 长期"；④ <strong>团队 outcome</strong>：18 个月后 team velocity +40%，oncall incident -60%，team NPS +25。<br><br><strong>但</strong> Netflix 模式不 universal applicable：<br>① 需要 top-of-market comp（很多公司不能）；<br>② 需要文化支撑（"team not family"，国内文化可能 less natural）；<br>③ 需要 generous severance budget；<br>④ Risk: 过度 emphasis 制造 high-stress culture（如果不平衡）。<br><br><strong>给 EM 的建议</strong>：① 不一定 fully copy Netflix，但 <strong>"我会 fight to keep him"</strong> 是简洁有效的 hiring / retention 指南；② Quarterly 自问每个团队成员的 keeper test 状态；③ "No" 时及时行动（PIP / coaching / exit）不拖延；④ 同时投资在让 top talent 想留下来（autonomy / growth / interesting work）。`,
      },
      failure_modes: [
        `留 chronic average performer（"他没大错"）→ drag team velocity + drive away top talent`,
        `Hiring 为填坑降 bar → 长期 talent density 拉低`,
        `Top talent 走只给 retention bonus 不解决 root cause（mediocre coworker / unclear growth path）`,
        `公开 talent density discourse → "L3 hierarchy" 文化 → 团队 toxicity`,
        `Comp 不在 top tier 还用 Netflix 模式 → top talent 不来 / 不留 → 不可持续`,
      ],
      follow_ups: [
        { q: `Keeper test 应该多久做一次？`, hint: `① Quarterly self-check（私下）；② Annual review 时 part of EM thinking；③ 偶发: 当员工 manifest disengagement 时；④ 不需要每月 over-stress` },
        { q: `Keeper test 的"否"如何 actionable？`, hint: `① 先 1on1 explore（是 skill / will / fit gap）；② 给 30 day coaching 改善；③ 没改 → PIP or generous severance；④ 关键: timely action，不拖延半年` },
        { q: `怎么向员工 frame "high performance culture"？`, hint: `① 招聘时讲清 expectations；② 不 hype（"we're best in industry"）；③ Concrete actions（comp / autonomy / training budget / promo speed）；④ Be honest about tradeoffs（high challenge / high reward）` },
      ],
    },

    // ============== AI-Native EM ==============
    105: {
      why_asked: `2024-2026 EM 面试新热点。能讲 6 大影响而不是只说"AI 提升效率"的人是真思考过。`,
      answers: {
        mid: `<strong>6 大影响</strong>：① <strong>流程重塑</strong>（PR review / debug / doc 自动化）；② <strong>效能度量</strong>（用什么指标度量 AI-augmented 团队）；③ <strong>招聘标准</strong>（Junior 还要不要 / AI literacy 入职要求）；④ <strong>团队系统</strong>（AI tool 引入 + 治理 + safety net）；⑤ <strong>风险合规</strong>（IP 泄漏 / 幻觉 / 安全）；⑥ <strong>角色演化</strong>（EM 自己怎么用 AI / 5 年后角色是什么）。`,
        senior: `<strong>关键洞察</strong>：① AI 不是简单的"工具升级"，而是<strong>重塑 software engineering 工作流</strong>—— 比 IDE / git / Stack Overflow 更深的变革；② EM 责任：① 安全引入；② 量化效能改善；③ 避免 over-rely（quality / security 风险）；④ Reskill team 而不是 simply replace。`,
        staff: `深一层：<strong>2026 年 AI-Native EM 的 5 个 priority</strong>：<br>① <strong>Tool standardization</strong>—— Cursor / Copilot / Claude Code 选哪个，怎么 enterprise governance（不让员工乱用 personal account 把 IP 上传）；<br>② <strong>Effectiveness measurement</strong>—— 不能只看"PR / month" 指标（量增但质降）。新指标：feature time-to-merge / bug regression rate / PR review depth / 工程师 satisfaction；<br>③ <strong>Skill evolution</strong>—— Junior 还招不招？我的判断：仍然招但<strong>头 6 个月 onboarding 完全不同</strong>—— 不能 over-rely on AI（learning ceiling 低），要 force fundamentals + AI augmentation balance；<br>④ <strong>Quality safeguard</strong>—— AI-generated code 的 review 不能 rubber stamp，需要更 senior review；CI 安全检查（SAST / dependency / license）必须加强；<br>⑤ <strong>Cultural shift</strong>—— 把 "AI 用得好" 当成 promotion criteria 一部分（不是单独 dimension，而是 part of "productivity / impact"）。<br><br><strong>真实案例</strong>：在电信团队 2024 年开始引入 Copilot + Claude Code（mostly for tests / docs / boilerplate），<strong>6 个月观察</strong>：① 团队 PR / week +30%；② Bug regression rate +15%（quality 下降！）；③ Code review 平均 cycle time -25%（reviewer 用 AI 帮看）；④ Junior PR 质量分化大（用 AI 好的 +50% productivity，用得糟的反而质量崩）。<strong>调整</strong>：① 加 mandatory AI-generated code 标记（PR description）+ 更深的 review；② Junior 入职 first 3 months no-AI period（建 fundamentals）；③ 季度 retro AI usage best practices share。<strong>结果</strong>：12 个月后 quality 恢复 + productivity 净 +20%。<br><br><strong>EM 自己怎么用 AI</strong>：① 1on1 notes summary；② 政策 / OKR draft；③ Code review 辅助；④ Email / Doc 写作；但<strong>不让 AI 处理 sensitive HR / personal info</strong>（隐私 + IP 红线）。`,
      },
      failure_modes: [
        `把 AI 当 "效率工具"，没意识到 process / culture / risk 系统性影响`,
        `不 standardize tool → 员工乱用 personal accounts → IP 风险`,
        `Effectiveness 只看 "PR / month" → 量增质降 trap`,
        `Junior 入职 over-rely AI → 长期 fundamental gap`,
        `Code review rubber stamp AI-generated code → bug regression 飙升`,
      ],
      follow_ups: [
        { q: `怎么 measure AI augmented 团队的 effectiveness？`, hint: `① 不只 PR count，要 PR quality (review depth / bug regression rate / customer escalation)；② Engineer satisfaction NPS；③ Feature time-to-merge；④ Tech debt accumulation rate；不要 single metric` },
        { q: `Junior engineer 在 AI 时代还招不招？`, hint: `① 仍然招，但 onboarding 完全不同；② First 3-6 months emphasize fundamentals (no-AI period 或 limited use)；③ Pair with senior more (mentorship intensive)；④ Track learning ceiling 信号` },
        { q: `EM 自己用 AI 工具的 ROI 怎么看？`, hint: `① 写文档 / 1on1 notes / OKR draft (-50% time)；② Code review 辅助 (-30% review time)；③ 不用于 sensitive HR / personnel info；④ Train new EM 用 AI 写 management 文档（不替代 thinking）` },
      ],
    },

    106: {
      why_asked: `AI 时代 EM 第二难问题。能讲"传统指标失效 + 新组合"的人才真思考过。`,
      answers: {
        mid: `<strong>新组合指标</strong>：① <strong>Outcome 指标</strong>（feature delivery 速度 + customer impact + bug regression rate）+ ② <strong>Quality 指标</strong>（PR review depth / code coverage / security scan）+ ③ <strong>Human 指标</strong>（engineer NPS / retention / learning growth）。<strong>避免</strong> "PR / engineer / month" 这种 vanity metric。`,
        senior: `<strong>关键认识</strong>：AI 时代 <strong>"velocity / output"指标</strong>大幅失真—— AI 可以让 PR 数量翻倍但 quality 不变 / 下降。<strong>真正度量 effectiveness 看 outcome</strong>（customer impact / business value）+ <strong>sustainability</strong>（quality / human cost）。`,
        staff: `深一层：<strong>2026 年 EM effectiveness metric framework</strong> 我建议四象限：<br>① <strong>Speed</strong>（feature delivery time / cycle time）—— 别只看代码量；<br>② <strong>Quality</strong>（regression rate / customer incident / tech debt growth）—— AI generated 易掩盖 quality 退化；<br>③ <strong>Sustainability</strong>（engineer NPS / oncall burden / 1on1 sentiment）—— burn out 不在 AI 时代消失；<br>④ <strong>Strategic</strong>（major initiative shipped / cross-team impact / talent development）—— 长期价值，AI 替代不了。<br><br><strong>真实经验</strong>：在引入 AI 工具的电信团队，第 3 个月开始我换了一套 metric：<br><strong>Before (传统)</strong>: PR / week / engineer = 4.5<br><strong>After (新组合)</strong>: <br>① Feature time-to-merge: median 8 days → 5 days (-37%)<br>② Customer-reported regression bugs: 2/month → 1/month (-50%)<br>③ Engineer NPS: +35 → +45<br>④ Code coverage: 78% → 82%<br>⑤ Junior senior knowledge gap: standardized assessment +25% improvement<br><br>这些指标 tell 一个 holistic story："AI 帮我们更快更稳更高 morale，但 junior growth path 需要 monitor"。<br><br><strong>反例</strong>：见过其他 team 只 track "lines of code / week"（甚至 GenAI 时代还这样）—— 数据 +200% 但 customer escalation +40%，6 个月后 leadership 醒悟 metric 失真。<br><br><strong>EM 实用建议</strong>：① 季度 review metric framework，不要 set-and-forget；② 跟 Director / VP align 指标（确保管理层认同）；③ Engineer NPS 是 sustainable 关键 signal；④ Customer-facing impact 是 ultimate truth；⑤ 不 over-optimize 单一指标（goodhart's law）。`,
      },
      failure_modes: [
        `只 track "PR / engineer / month" → 量增质降 trap`,
        `Lines of code / commits as proxy → AI 时代完全失真`,
        `Set-and-forget 指标 → 不随 AI tool evolution 调整`,
        `单一 metric over-optimize → Goodhart's law（"the measure becomes the target"）`,
        `不 track human metric → 6 个月 burnout / quality crisis`,
      ],
      follow_ups: [
        { q: `怎么向 leadership 解释 metric 改变？`, hint: `① 准备 before/after 数据；② Translate to business impact ("customer regression -50% = X saved revenue")；③ Acknowledge tradeoffs ("we 'lost' velocity perception but gained quality")；④ 渐进 over-quarter 不一夜替换` },
        { q: `Engineer NPS 怎么 actionable？`, hint: `① 月度 anonymous survey (15Five / Officevibe)；② Top 3 specific question (manageability / workload / autonomy)；③ Action on feedback within month (visible response)；④ Track trend not absolute score` },
        { q: `Junior 在 AI 时代怎么评估 effectiveness？`, hint: `① 不只看 output（容易 AI-augment）；② Track fundamental understanding（独立 debug 能力 / system design grasp）；③ Periodic no-AI exercise；④ Learning velocity (skill grow rate)` },
      ],
    },

    // ============== Phase 2 续推 ==============
    12: {
      why_asked: `1on1 频次是 EM 第一个落地动作。能讲"每 2 周 vs 周 vs 月 + 灵活调整"的人是真做过 1on1。`,
      answers: {
        mid: `<strong>默认 30 min / 2 周</strong>（双周制）。情境调整：① 新人 / 紧密项目 → 周；② 已 senior 稳定 → 月。<strong>不能少于月</strong>—— 否则脱节。`,
        senior: `<strong>3 档</strong>：<br>· <strong>Weekly 30 min</strong>: 新人头 3 月 / 在 PIP / 关键 transition / 创业团队<br>· <strong>Bi-weekly 30-45 min</strong>: 默认 / 大多数 senior IC<br>· <strong>Monthly 60 min</strong>: 已成熟独立、跨 timezone / 跨 location 难凑——但绝不"没 1on1"<br><br><strong>灵活原则</strong>: ① 让下属决定（"你希望多频次"）；② 紧急时主动加；③ 出差 / 休假明确补；④ 团队 &gt; 8 人 EM 时间不够，<strong>把部分人改月度</strong>。`,
        staff: `深一层：1on1 频次<strong>不是 EM 决定的</strong>，是 EM/IC 协商的—— 这本身是<strong>给下属 ownership</strong>的第一个信号。<br><br><strong>真实经验</strong>：作为新 EM 接 8 人团队，初定 weekly 30 min × 8 = 4 小时/周。3 月后发现：① 4 个 senior 觉得 weekly 太频；② 3 个 mid 觉得正好；③ 1 个新人 weekly 不够（要 2x weekly）。<strong>调整后</strong>：4 senior bi-weekly + 3 mid weekly + 1 新人 weekly × 2 = 7 hr/2-week = 3.5 hr/week，<strong>同样满足但更精准</strong>。<br><br><strong>常见 trap</strong>：① 一刀切（不灵活）；② 取消 1on1 当 "<strong>没事不需要</strong>"（错—— 1on1 不只是 status update）；③ 频次太高没主题（变 status meeting）；④ 频次太低 trust 难建。<strong>30 min vs 60 min</strong>：默认 30 min；下属当面 negotiate 想 60 min 也 OK（特别 senior 战略对齐多）。<strong>取消政策</strong>：<strong>下属可取消，EM 尽量不取消</strong>（EM 取消 = 信号"你不重要"）。`,
      },
      failure_modes: [
        `一刀切所有人同频次`,
        `EM 频繁取消 1on1 → trust 崩`,
        `频次太高没主题 → 变 status meeting`,
        `没 1on1 cadence → 信息脱节 / 突发离职 surprise`,
        `不让下属决定频次 → 失去 ownership 信号`,
      ],
      follow_ups: [
        { q: `远程 / 跨时区团队 1on1 怎么做？`, hint: `① 固定时间避免每次重排；② Video on（不仅 audio）；③ 多用 async（Notion / Loom）补充；④ 出差时尽量面对面 reconnect；⑤ Quarterly in-person retreat 是远程团队 retention 关键` },
        { q: `1on1 议程怎么准备？`, hint: `① 共享 Notion / doc 双方加 topics；② IC 议程优先（不是 EM status update）；③ 标准 4 段：career growth / current work / feedback both ways / blocker；④ 不要变 status meeting—— status 异步` },
        { q: `Skip-level meeting 跟 1on1 区别？`, hint: `① Skip-level: VP 跟下属的下属 1on1，绕过中间 EM；② 频次低（quarterly）；③ 目的：① calibrate EM；② 收集 frontline feedback；③ 显示 leadership care；④ EM 应该 encourage 而非 threat by skip-level` },
      ],
    },

    14: {
      why_asked: `1on1 沉默是新 EM 最怕的尴尬。能讲"问对问题 + 心理安全 + 给时间"3 招的人是真做过 coaching。`,
      answers: {
        mid: `<strong>3 招</strong>：① <strong>问对问题</strong>（"过去 2 周让你 frustrated 的事是什么"比"工作怎么样"好 10×）；② <strong>建立心理安全</strong>（不当面 review；不立刻 fix）；③ <strong>给时间</strong>（沉默 30 秒不打断，让对方真思考）。`,
        senior: `<strong>新人 / 沉默下属的 6 个 prompt</strong>：<br>1. "<strong>过去 2 周哪 1 件事让你 frustrated</strong>？"（具体 + 负面 → 易开口）<br>2. "<strong>如果你是我，你会改 team 哪 1 件事</strong>？"（赋权 + 假设）<br>3. "<strong>跟谁合作让你 energized / drained</strong>？"（人 dynamics）<br>4. "<strong>你最想发展的 skill 是什么</strong>？"（career growth）<br>5. "<strong>什么 noise 在分散你</strong>？"（block / distraction）<br>6. "<strong>你担心我不知道的事是什么</strong>？"（surface 隐藏 concerns）<br><br><strong>反例</strong>："工作怎么样？" → 99% 答 "还行"，毫无 signal。`,
        staff: `深一层：沉默通常<strong>不是没话说</strong>，是"<strong>不信任 / 不知道说啥安全 / 文化差异</strong>"。EM 责任是 build psychological safety。<br><br><strong>真实经验</strong>: 一个新 hire 第一个 1on1 几乎沉默。我犯的错：① 持续问 yes/no 问题；② 自己 fill silence 讲了 20 分钟；③ 没问情感层（情绪 / 价值观）只问 task。结果他 3 周后离职。<br><br><strong>后来调整</strong>: 跟新人头 3 次 1on1：<br>1. <strong>第 1 次</strong>: 80% 听，问开放性问题（"What brought you here? What are you most excited about?"）<br>2. <strong>第 2 次</strong>: 给具体 problem 让他评论（"我考虑 X，你怎么看"）—— 让他 feel valued<br>3. <strong>第 3 次</strong>: 邀请 critical feedback（"如果你 own this team 你会改什么"）<br><br>3 月后这个 hire 成为 team 最 vocal、贡献最大的成员之一。<br><br><strong>额外技巧</strong>：① <strong>walking meeting</strong>（边走边聊降低压力）；② <strong>异步先 doc</strong>（让对方写下要讨论的 topics，避免冷启动）；③ <strong>EM 先 vulnerable</strong>（"我最近也 struggle X"）→ 对方更愿 share；④ <strong>跨文化敏感</strong>（亚洲文化默认 modest，EM 主动询问 + 不强 push）。<br><br><strong>持续沉默的 redflag</strong>：3 次 1on1 仍沉默 + 工作没 trust = 准备 transition out。但<strong>大多数</strong>沉默是 EM 没问对问题或 trust 没 build。`,
      },
      failure_modes: [
        `问 "工作怎么样？" → 99% 收 "还行" 无 signal`,
        `EM fill silence 自己讲太多 → 失去 collect feedback 机会`,
        `沉默就立刻 fix（强行 push 话题）→ 反而加压`,
        `不问情感层只问 task → 错过 retention 风险信号`,
        `没识别文化 / introvert 差异 → 强 push 反伤 trust`,
      ],
      follow_ups: [
        { q: `下属说"没什么要讨论的"怎么办？`, hint: `① 接受 + 缩短到 15 min（不浪费时间）；② 但 keep 频次（cadence 不变）；③ 偶尔异步 prompt（"在思考 X，下次想聊聊"）；④ Career growth topic 一定挖（短期 status 没有，长期 career 一定有）` },
        { q: `怎么 build psychological safety？`, hint: `① EM 先 admit mistake（show vulnerability）；② 永远 attack idea 不 attack person；③ 隐私 feedback 不公开（特别批评类）；④ Action on feedback within month（让 IC 感觉 invest 有回报）` },
        { q: `跨文化 1on1 注意什么？`, hint: `① 部分文化（亚洲 / 部分欧洲）默认 modest 不主动表达，EM 多主动询问；② 部分文化避免直接 disagree，EM 提供 anonymous channel；③ EM 主动 share own background → mutual cultural respect` },
      ],
    },

    22: {
      why_asked: `Hiring 标准化必备。能讲"4 维度 + 行为题 + score rubric"的人是真做过 hiring loop 设计。`,
      answers: {
        mid: `<strong>4 维度</strong>：① <strong>Technical depth</strong>（系统设计 + coding）；② <strong>Communication</strong>（讲思路清晰）；③ <strong>Collaboration</strong>（跨 team / mentorship 倾向）；④ <strong>Culture / Values fit</strong>（公司 value alignment）。每维度<strong>1-4 rubric</strong> + 具体 example。`,
        senior: `<strong>详细 Scorecard 字段</strong>：<br>· <strong>Interview type</strong>: phone screen / coding / system design / behavioral / bar raiser<br>· <strong>Dimensions 评分</strong>: 每个 dimension 1-4 + textual evidence（不只数字）<br>· <strong>Strong yes / Yes / No / Strong no</strong>: 最终 verdict<br>· <strong>Areas of concern</strong>: 显式列 risks<br>· <strong>Comparison to existing team</strong>: "如果加入 raises / lowers bar"<br><br><strong>关键</strong>: ① <strong>独立填</strong>（避免 anchoring）；② <strong>debrief 时 share</strong>；③ <strong>不 average</strong>—— 任一 strong no = reject。`,
        staff: `深一层：Hiring Scorecard 的<strong>真实价值</strong>不是当下 hire/no-hire 决定，是<strong>"团队 bar 校准 + 长期 calibration"</strong>。看 scorecard 6 月后比对实际 perf 能发现：① 哪些 signal 真预测高 perf；② 哪些面试官 bar 偏高 / 偏低；③ 哪些 dimension 我们过度 weight。<br><br><strong>Google / Amazon 风格 Scorecard</strong>: <br>· 每个 dimension 必须 evidence-based（不能 "I felt good"）<br>· "Lift the bar" question—— 这个候选人加入是否 raise team bar 在该 dimension<br>· Bar Raiser 角色（独立于 hiring manager 决定）<br><br><strong>真实经验</strong>: platform agent team hiring 6 人过程：<br>1. 设计 4-dimension scorecard（technical / system design / communication / values）<br>2. 4 round interview（screen / coding / sys design / bar raiser）<br>3. Debrief 每次 1 hour，每人 share scorecard + 投票 strong yes / yes / no / strong no<br>4. <strong>1 strong no = reject</strong>（无论其他 yes）<br>5. <strong>6 月 calibration</strong>: 对比 hire 实际 perf，发现 "system design" score 跟 perf 相关性 0.7，"behavioral" 0.4——decide weight system design 高<br><br><strong>陷阱</strong>：① No structured scorecard → "感觉 good" 主观；② Debrief 前 anchoring（"我觉得他不错"先发言）→ 强 lead opinion；③ Hire bar 太低（"reach the quota"）→ 6 月后 PIP；④ 不 calibrate → scorecard 失效。<br><br><strong>红线</strong>：① values / culture 红线（如不诚信 / disrespect）= 立 reject 无论 technical；② 6 月 calibration 必做—— 没 cal 的 scorecard 等于不存在。`,
      },
      failure_modes: [
        `Scorecard 太主观（"good fit"）`,
        `Debrief 前 anchoring（先发言者主导）`,
        `Hire 后不 6 月 calibrate → scorecard 失效`,
        `用 average 而非 veto（应该 strong no = reject）`,
        `Values 红线没明确 → marginal hire 进 team 拖累`,
      ],
      follow_ups: [
        { q: `Bar Raiser 怎么 work？`, hint: `① 独立于 hiring manager（不能 own 该 team）；② 有 veto 权；③ 训练过 + 多次 interview 经验；④ Amazon 称 "Bar Raiser"，Google 称 "Hiring Committee"；目的：防 manager 急着填 headcount lower bar` },
        { q: `Coding interview 该不该用？`, hint: `① 对 IC 仍主流；但 ② AI 时代  raw coding 速度 less differentiating；③ 改 emphasize debugging + system thinking + code review skill；④ Senior 减 coding 增 system design / behavior` },
        { q: `Values fit 跟 culture fit 区别？`, hint: `① Culture fit 易变 bias（招"跟我们像的人" → diversity 低）；② Values fit 是 explicit principles（如 "customer obsession" / "ownership"）；③ Hire for values，build for culture` },
      ],
    },

    24: {
      why_asked: `行为题水平区分新 vs senior EM。能讲"具体行动 + 量化结果 + 反思"的人能精准筛"伪资深"。`,
      answers: {
        mid: `用 <strong>STAR + dig deeper</strong>。"伪资深"特点：<br>· 讲故事缺<strong>具体 action</strong>（只说 "我们做了 X"）<br>· R 段<strong>无量化</strong><br>· 不能讲<strong>替代方案 / trade-off</strong><br>· 遇追问就 vague / generic`,
        senior: `<strong>5 个识别问题</strong>：<br>1. "<strong>具体讲一下 X 的关键决策</strong>" → 看是否能讲到 day-to-day detail<br>2. "<strong>什么是 alternative，为啥没选</strong>" → 看 trade-off 思维<br>3. "<strong>如果再做一遍，你会怎么改</strong>" → 看 reflection<br>4. "<strong>团队规模 / 预算 / timeline 多大</strong>" → 量化 scale，避免吹嘘<br>5. "<strong>当时遇到的最大障碍 + 怎么过的</strong>" → 看真实 struggle vs 顺利讲故事<br><br><strong>红旗</strong>: ① "I" 比例 &lt; 30%（满口 "we"）；② Vague metrics（"显著提升"）；③ 没 trade-off / failure；④ 故事过于"圆满"（不真实）；⑤ 追问技术细节 hand-wave。`,
        staff: `深一层：识别伪资深的<strong>核心技能</strong>是<strong>"deep dive 到 layer 3+"</strong>。<br><br>· <strong>Layer 1 (表面)</strong>: "我做了一个 microservice migration 项目"<br>· <strong>Layer 2 (一层细节)</strong>: "我们拆了 monolith 成 8 个服务"<br>· <strong>Layer 3 (具体决策)</strong>: "<strong>我决定先拆 payment service 不是 user service</strong>，因为 X"<br>· <strong>Layer 4 (个人贡献 + trade-off)</strong>: "<strong>我推了用 Kafka 不是 RabbitMQ，因为我们已有 Spark 团队熟悉 Kafka，迁移成本低</strong>。当时 team 倾向 RabbitMQ 因为 X，我用 Y 数据说服。"<br>· <strong>Layer 5 (reflection)</strong>: "<strong>事后看 Kafka 维护成本 underestimate，如果再来我会选 managed Kafka SaaS</strong>"<br><br>真资深能讲到 layer 4-5，伪资深停在 layer 2。<br><br><strong>真实案例</strong>: 面 senior EM 候选 X，简历说"带 50 人，3 年 grew team to 50"。问：<br>· "<strong>具体 grow 50 人的过程？你 hire 几个？流失几个？</strong>"→ 答 vague<br>· "<strong>50 人怎么 org 结构？多少 sub-team？你 own 跨 team 还是 single team？</strong>"→ hesitate<br>· "<strong>你 fire 过几个 underperformer？记得最近一次的过程？</strong>"→ "没 fire 过"<br>→ 显然不是真 own 50 人的 EM，可能是 nominal title。Reject。<br><br><strong>另一案例</strong>: 候选 Y 简历看似不亮（"team of 12, 2 years EM"），但 deep dive 时：<br>· "<strong>2 年内 promote 3 个 IC 到 senior，过程？</strong>"→ 详细讲 calibration / mentorship<br>· "<strong>最难的一次 fire？</strong>"→ 讲 P0 incident 后 fire 过程 + 团队 morale recovery<br>· "<strong>跨 team 推动 OTel 接入</strong>"→ 讲 8 个 team 的 stakeholder map + influence strategy<br>→ 真 senior。Strong hire。<br><br><strong>建议</strong>：① 准备 5-10 个深度问题（不是 yes/no）；② 至少 30 min 一个 topic deep dive；③ Cross-check 不同问题 same theme 答案是否一致；④ 简历 vs 实际 deep dive 不一致 = redflag。`,
      },
      failure_modes: [
        `Stop at Layer 2 surface answer 接受`,
        `不 cross-check 不同问题答案一致性`,
        `相信 fancy title / company name 不 deep dive`,
        `不挖 trade-off / failure`,
        `不识别 "we" overuse → 个体贡献模糊`,
      ],
      follow_ups: [
        { q: `Senior EM 该问哪些深度问题？`, hint: `① 最难 hire / fire 决策 + 后果；② 你跟 boss disagree 怎么处理；③ 团队危机（事故 / 流失）怎么 recover；④ 跨 team / 跨 culture leadership；⑤ Career story（为啥 join 我们）` },
        { q: `怎么避免自己 anchor 在简历？`, hint: `① 面试前不读 detail，只看 high-level；② 用 standard rubric 同样问题问所有候选；③ Bar Raiser cross-check；④ Debrief 强调 evidence not impression` },
        { q: `候选人对追问反感怎么办？`, hint: `① 解释 "我想深入了解，不是 doubt"；② 切换 topic 给空间；③ 仍坚持核心追问—— senior 候选应能 deal with deep dive；④ 完全不能 deep dive = 大 redflag` },
      ],
    },

    28: {
      why_asked: `Senior hiring 高频场景。能讲"理性谈 + value beyond comp + escalate 边界"的人是真做过 hiring negotiation。`,
      answers: {
        mid: `<strong>4 步</strong>：① <strong>不情绪化</strong>—— 候选拿 competing offer 是市场行为，不是 personal；② <strong>理解他 value</strong>（comp / role / mission / team）；③ <strong>给 non-comp value</strong>（career growth / 团队 / 项目）；④ <strong>必要时 escalate</strong> 谈 comp 提升，但<strong>有上限</strong>。`,
        senior: `<strong>对话框架</strong>：<br>1. <strong>Acknowledge</strong>: "Congrats on the X offer, that's a great company"（不贬低对方）<br>2. <strong>Understand</strong>: "What attracts you about X? What are you weighing?" → 了解他真正 care 什么（不一定是钱）<br>3. <strong>Match value</strong>: 如果他 care growth → 讲我们 growth path；如果 care impact → 讲项目重要性；如果 care comp → 看是否能 escalate<br>4. <strong>If comp gap large</strong>: 跟 hiring manager / recruiter / Director 谈 escalate budget；但要诚实评估"我们值这个 budget 吗"<br>5. <strong>Walk away ready</strong>: 如果 gap 超我们 ceiling，<strong>礼貌 walk away</strong>—— "<strong>祝好</strong>" 比"<strong>给个不可持续的 offer</strong>" 长期更好`,
        staff: `深一层：Competing offer scenario 的<strong>3 个 trap</strong>：<br><br>① <strong>过度 chase</strong>：每个候选都 escalate → comp creep + 团队内不公平。如果 X 候选拿 50% premium，3 个月内同 level 老员工知道了 → morale 崩。<br><br>② <strong>价值低估</strong>：很多 senior candidate 真在意的是<strong>"impact / autonomy / culture"</strong> 不是 5% comp。问对问题（Q2）能避免不必要的 comp 谈判。<br><br>③ <strong>不诚实 sell</strong>：candidate 50% chance 接 → 你过度 oversell → 来了发现现实差 → 6 月离职。<br><br><strong>真实案例</strong>: platform agent senior eng 候选 X 在 final stage 拿到 Big Tech offer，base salary 高 30%。我（hiring EM）跟他 1on1：<br>· 问 "<strong>What's pulling you toward Big Tech?</strong>" → 答："base 高，但实际工作可能就是大公司 cog"<br>· 我说："<strong>诚实跟你 share</strong>：我们 base 比 Big Tech 低 20-30%（公司阶段 startup），<strong>但</strong> ① 你 own 全栈 RPC 模块（impact）；② Year 1-2 可能升 staff；③ Equity 如果公司 well 长期可能 outpace Big Tech base。Trade-off：Big Tech 稳但慢晋升，我们 risk 但 grow 快。"<br>· 不 escalate comp—— 公司预算给到 ceiling 已经<br>· 给他 1 周 think + meet team + skip-level chat with VP<br>· 最终他 join → 18 个月后 promoted to staff，2 年后 lead 整个 team<br><br><strong>关键 lesson</strong>: ① 不 panic chase；② 真诚 share trade-off；③ Sell beyond comp；④ Walk away ready—— 如果他 ultimate care comp，他不是 fit。<br><br><strong>反例</strong>: 另一候选 Y 拿 competing offer，我 escalate comp 给 +20%。他来了 6 个月发现"<strong>项目跟 sales pitch 不一致</strong>"离职。Sunk cost = 6 个月 + recruiting fee + onboarding。<strong>本可避免</strong>: 不 escalate 让他选 competing offer 当时更好。`,
      },
      failure_modes: [
        `每个候选都 escalate comp → comp creep + 内部 inequality`,
        `没问 candidate 真 care 什么 → 错配 sell pitch`,
        `Oversell 项目 → 6 月离职后悔`,
        `Walk away 时态度差 → 失去 future re-hire 可能`,
        `用现 employee comp 当上限 → 失去市场竞争力`,
      ],
      follow_ups: [
        { q: `Comp 谈判到什么程度该 walk away？`, hint: `① 超过同 level 老员工 15-20% → 不公平；② 超过 hiring manager budget ceiling → 不可持续；③ Candidate ultimate care comp not mission → 不是文化 fit；④ Walk away 时保持 warm（future 可能 re-engage）` },
        { q: `怎么避免 candidate 用 fake offer 抬价？`, hint: `① 让 candidate 转发 offer letter（professional）；② Cross-check 公司 hiring 状态（LinkedIn / 业界）；③ 直觉 + 多 datapoint；④ 一定程度信任—— 大多 candidate 不会 fake，少数会发现后 reject` },
        { q: `Backfill candidate 跟 net-new 处理一样吗？`, hint: `① Backfill: 已有 budget，更 flexible；② Net-new: 需 justify ROI 给 VP；③ Senior backfill: 可适度 escalate；④ Net-new senior: 严格 budget control；情境化决策` },
      ],
    },

    34: {
      why_asked: `OKR 写作高频 EM 题。能讲"O 鼓舞人心 + KR 可测 + 50% confidence"的人是真做过 OKR 实操。`,
      answers: {
        mid: `<strong>O (Objective)</strong>: 鼓舞人心 + 定性 + 时间 bound（"Q3 让 platform agent P99 latency 业界领先"）<br><strong>KR (Key Results)</strong>: 3-5 个，<strong>可量化 + 有挑战性</strong>（"P99 latency &lt; 5ms" "客户 P0 事故 -50%"）<br><strong>Confidence</strong>: 设定时 50% confidence（太高 = 不挑战；太低 = 不切实际）`,
        senior: `<strong>好 OKR 的 5 个标准</strong>（Doerr "Measure What Matters"）:<br>1. <strong>Aspirational</strong>: O 听起来 exciting 不只是 task<br>2. <strong>Outcome &gt; Activity</strong>: KR 是 outcome（"客户满意度 +X%"）不是 activity（"完成 10 个 PR"）<br>3. <strong>Few</strong>: 3-5 个 KR；&gt; 5 → focus 散<br>4. <strong>Quantifiable</strong>: "更好" 不算；必须数字<br>5. <strong>Cascading</strong>: Team OKR derive from Company OKR；Individual OKR derive from Team<br><br><strong>反例</strong>:<br>· ❌ "改进系统" → vague<br>· ❌ "写 10 个 design doc" → activity<br>· ❌ "改进 latency 30%" → 没 base / 不够 ambitious<br>· ✅ "Q3 P99 latency &lt; 5ms（baseline 12ms）+ 客户 NPS &gt;= 60（baseline 45）+ 0 P0 incident"`,
        staff: `深一层：OKR 失败 80% 是<strong>"把 KR 写成 task list"</strong>。Google 创始人原话："<strong>OKR 不是 task list</strong>—— 是<strong>结果承诺</strong>。"<br><br><strong>OKR vs KPI 区别</strong>：<br>· <strong>KPI</strong>: 持续度量的健康指标（如可用性 99.9% / churn rate）<br>· <strong>OKR</strong>: 季度 ambition（"<strong>提升</strong>" / "<strong>达到</strong>"），完成后 retire（不是永久跑）<br><br><strong>真实案例</strong>: 早期我作 EM 写过烂 OKR：<br>· O: "提升 platform agent 质量"（vague）<br>· KR1: "完成 30 个 bug fix"（task / activity）<br>· KR2: "增加 unit test"（vague）<br>· KR3: "Code review 更严格"（不可测）<br>季度末完不成 / 没完成感 / 团队怀疑 OKR 价值。<br><br>下季度改：<br>· O: "<strong>Q4 platform agent 达到生产级稳定</strong>"<br>· KR1: "P0 incident 数 = 0（Q3 是 3）"<br>· KR2: "P99 latency &lt; 8ms（Q3 是 15ms）"<br>· KR3: "Customer-reported bugs &lt; 5 / 月（Q3 是 12）"<br>· KR4: "Unit test coverage 80%（Q3 是 60%）"<br>—— 季度末实际：P0 = 1, P99 = 6ms, bugs = 7, coverage = 78%。<strong>3/4 KR hit + 1 close miss</strong>（OKR 设计就是 50-70% achievement = healthy aggressive）。团队感觉 ambitious 但 doable。<br><br><strong>陷阱</strong>：① KR 设太低（100% 完成不挑战）；② 太高（0% 完成 demotivating）；③ "<strong>committed</strong>" vs "<strong>aspirational</strong>" 区分—— Google 分两类：commit OKR 必须 100%，aspire OKR 70% 算成功；④ OKR 跟 perf review 强绑 → 团队 sandbag。<br><br><strong>Health 指标</strong>：team OKR 季度末平均 60-80% achievement（不是 100%）= ambitious 健康。`,
      },
      failure_modes: [
        `KR 写成 task / activity（不是 outcome）`,
        `没 base / 不量化 → 没 reference point`,
        `太多 KR（&gt; 5）→ focus 散`,
        `OKR 跟 perf review 强绑 → 团队 sandbag`,
        `100% 完成不挑战 / 0% 完成 demotivating`,
      ],
      follow_ups: [
        { q: `Aspirational vs Committed OKR 区别？`, hint: `① Committed: must-hit baseline（如 "保持 SLO 99.9%"），100% 完成；② Aspirational: stretch goal（如 "scale 3x"），70% 算成功；③ Google 分两类，避免 sandbag` },
        { q: `Quarterly vs Annual OKR 怎么选？`, hint: `① Quarterly: 主流，3 个月 horizon 易 adjust；② Annual: 适合 strategic objective（如 platform migration）；③ 混合：Annual O + Quarterly KR refresh` },
        { q: `OKR 跟 KPI / Roadmap 怎么协调？`, hint: `① KPI: 持续监控的 health；② OKR: 季度 push 的 change；③ Roadmap: feature delivery list；三者 align—— OKR 应该让 roadmap 优先级清晰，让 KPI 改善` },
      ],
    },

    51: {
      why_asked: `估算不准是几乎所有团队问题。能讲"Reference Class + 拆任务 + 实际 buffer"的人是真做过 estimation 改进。`,
      answers: {
        mid: `<strong>3 招</strong>：① <strong>Reference Class Forecasting</strong>—— 参考<strong>类似项目历史数据</strong>，不靠主观；② <strong>拆任务到 &lt; 3 day</strong>—— 大任务 always 低估；③ <strong>加 20-30% buffer</strong>—— 永远有 unknown unknowns。`,
        senior: `<strong>系统改进 4 步</strong>：<br>1. <strong>历史回溯</strong>: 过去 3-6 个 sprint 实际耗时 vs 估算，画 ratio 分布（typical 1.5-2.5×）<br>2. <strong>分类 / 复杂度估算</strong>: 用 T-shirt size (S/M/L/XL) 或 fibonacci point（1/2/3/5/8/13），不是绝对 hour<br>3. <strong>多人盲估</strong>: Planning poker—— 减少 anchoring<br>4. <strong>事后 retrospective</strong>: 每 sprint 复盘 estimation 准度，让团队 calibrate<br><br><strong>关键</strong>: ① <strong>认知 unknown unknowns</strong> 占 30-50% 时间（debug / 跨 team blocker / spec change）；② 把 buffer 显式加（不是"<strong>偷偷 padding</strong>"）；③ team velocity stable 后 trust the average。`,
        staff: `深一层：估算永远不准的<strong>根本原因</strong>是<strong>"我们不知道我们不知道什么"</strong>（Donald Rumsfeld unknown unknowns）。每个软件项目都有 30-50% 时间在解决"<strong>启动时根本想不到</strong>"的问题——dependency 升级 / 第三方 bug / spec 变 / 团队成员离职。<br><br><strong>Hofstadter's Law</strong>: "<strong>It always takes longer than you expect, even when you take into account Hofstadter's Law</strong>" —— recursive，永远低估。<br><br><strong>真实案例</strong>: platform agent v3 项目初估 4 个月，实际 7 个月（1.75× ratio）。我作为 EM 的改进：<br>1. <strong>对比过去 6 sprint</strong>: 平均 estimation ratio 1.4-2.0×。Lesson: <strong>下次 estimate 必乘 1.5-1.8</strong><br>2. <strong>拆 epic 到 &lt; 3 day task</strong>: 大 epic（"build schema parser"）拆成 12 个 small task → 估算总和更准<br>3. <strong>Planning poker 必做</strong>: 不是 EM 单方面定，team 盲估 → 触发 discussion when 估算差异大<br>4. <strong>Sprint retro 加 estimation review</strong>: 每 sprint 末 review 哪些任务超估 / 没估，calibrate next sprint<br>5. <strong>跟 leadership 沟通</strong>: 不 commit "4 个月"，commit "4-7 个月 range with 50% confidence at 5 月"<br><br>6 个 sprint 后 team estimation ratio 收敛到 1.15-1.3×（仍超但显著缩小），<strong>关键</strong> leadership 也接受了 range estimate 而非单点。<br><br><strong>陷阱</strong>：① "<strong>这次会更准</strong>" 直觉（不会，永远 1.5×）；② Pad 不告诉 leadership → 显得 estimation 不专业；③ 不 retrospect → 永远不改善；④ 单点 estimate 不 range → over-commit；⑤ 用 absolute hour 而非 relative size → 跨任务比较失意义。<br><br><strong>关键文化转变</strong>：从 "<strong>commitment</strong>" 估算（"承诺 4 月 ship"）→ "<strong>probability</strong>" 估算（"50% confidence ship by 5 月，90% by 7 月"）。<strong>VP 教育</strong>是 EM 重要工作。`,
      },
      failure_modes: [
        `单点 estimate 不 range → over-commit`,
        `Pad buffer 但不告诉 leadership → 显得 estimate 不专业`,
        `不 retrospective estimation → 永远不改善`,
        `EM 单方面 estimate 不让 team 参与 → team 不 buy in`,
        `用 absolute hour 而非 relative point → calibration 难`,
      ],
      follow_ups: [
        { q: `Planning Poker 怎么 facilitate？`, hint: `① 用 fibonacci card；② 每人盲选 → 同时翻 → 讨论 outliers；③ 高低差 &gt; 3 cards = 必讨论；④ 决策不是 average，是 consensus；⑤ 异步可用 Trello/Jira plugin` },
        { q: `Big bang 项目 (6+ month) 怎么估？`, hint: `① 拆 milestone (每 2-4 weeks)；② 头 1-2 milestone 估准，远期 milestone broad range；③ Re-estimate every 2 sprints；④ Reference Class（类似过去项目实际耗时）` },
        { q: `Leadership 不接受 range estimate 怎么办？`, hint: `① 显示 history data 证明 range 准过 single point；② 跟 finance/PM align "we'll plan with P50, communicate P90"；③ 用 Monte Carlo simulation visualize；④ 必要时 walk leadership through estimation training` },
      ],
    },

    52: {
      why_asked: `延期沟通考 EM 危机管理 + 向上汇报能力。能讲"BLUF + 3 options + ask"的人是真做过 P0 escalation。`,
      answers: {
        mid: `<strong>BLUF + 3 options + 明确 ask</strong>:<br>1. <strong>BLUF</strong>: "项目延期 X 周，需要你决策 by EOW"<br>2. <strong>Root cause</strong>: 量化 + 不甩锅<br>3. <strong>3 options</strong>: A 加资源 / B 减 scope / C 延 timeline<br>4. <strong>Recommendation + rationale</strong><br>5. <strong>Ask</strong>: 你需要 VP 做什么决策 + by when`,
        senior: `<strong>详细 talk track</strong>（90s 版本）:<br>1. "<strong>项目 ship 日期从 X 推到 Y</strong>"（不绕弯，BLUF）<br>2. "<strong>SPI = 0.7（baseline 1.0），过去 2 sprint trend 下滑</strong>"（量化）<br>3. "<strong>Root cause: ① 一个 senior dev 离职；② vendor X API 兼容性问题占了 3 周</strong>"（具体 + 不甩锅）<br>4. "<strong>3 options</strong>:<br>· A: 加 contractor 2 人 6 周 = +$50k，保 ship Y<br>· B: cut feature Z（10% scope），保 ship X<br>· C: 不变 scope/resource，ship Z=X+4 weeks"<br>5. "<strong>我 recommend B</strong>—— feature Z 已经 deprioritized in roadmap，cutting 影响低"<br>6. "<strong>Ask</strong>: 需要你 approve B by EOW，sales team align customer expectation"`,
        staff: `深一层：延期沟通的<strong>核心心态</strong>是<strong>"早 surface bad news + 给 VP 决策权"</strong>。<br><br><strong>3 个常见 anti-pattern</strong>:<br>① <strong>Hide and hope</strong>: "我们 push 一下应该能 ship"（不切实际 + 失去 trust 当真 ship 不出来）<br>② <strong>Surface 但无 option</strong>: "项目延期了，怎么办"（把问题甩给 VP，显得无能）<br>③ <strong>过度量化但无 recommendation</strong>: 给 5 个 option 让 VP 选 → VP 没 context，会问 "<strong>你认为呢</strong>"<br><br><strong>真实案例</strong>: platform agent v3 项目 month 4 发现要延期 6 周。<br><br>VP 1on1（90s 完成）:<br>1. "<strong>Project 当前 status: red, 预计延期 6 weeks（原 Oct 1 → Nov 15）</strong>"<br>2. "<strong>SPI = 0.72, CPI = 0.85, trend 4 周下滑</strong>"<br>3. "<strong>Root cause</strong>:<br>· Senior eng X 离职（4 周影响）<br>· Vendor Y SDK 兼容性比预期复杂（2 周影响）<br>· Spec 中途增加客户 Z 定制需求（accept 的 scope creep，1 周影响）"<br>4. "<strong>3 options</strong>:<br>· A: 加 contractor 2 人 + ship Nov 15 (cost +$60k)<br>· B: cut customer Z 定制（scope -8%）+ ship Oct 15 (lose 1 customer's potential expansion)<br>· C: 不变 scope/resource + ship Nov 15 (现状继续)"<br>5. "<strong>Recommend A</strong>—— customer Z 是 strategic account，cut 风险大；contractor cost 可控；net ROI 正"<br>6. "<strong>Ask</strong>: budget approval +$60k by EOW，finance 准备 contractor onboarding"<br><br>VP 反应: "<strong>Appreciate the clarity, let's do A</strong>"。决策完成 5 分钟。<br><br><strong>对比 anti-pattern</strong>:<br>· "<strong>项目可能要晚一点</strong>" → 模糊，VP 无法决策<br>· "<strong>项目延期 6 周</strong>" → 完整但无 option，VP 问 "你建议怎么办"<br>· "<strong>项目延期 + 5 options 给你选</strong>" → 太多 option 失去 focus<br>· "<strong>项目延期 + recommend A 没 alternative</strong>" → 显得不全面 / 不开放<br><br><strong>关键</strong>: 早 surface（不是 ship 前一周）+ 量化（不是感觉）+ option（不是问题）+ recommendation（不是甩问题）。`,
      },
      failure_modes: [
        `Hide and hope → 失去 VP trust`,
        `Surface 但无 option → 甩问题给 VP`,
        `太多 option → focus 散`,
        `没明确 ask + timeline → next step 模糊`,
        `Late surface（ship 前一周）→ 选项空间小`,
      ],
      follow_ups: [
        { q: `VP 反应 angry 怎么办？`, hint: `① 不 defend，先 acknowledge "I understand frustration"；② 重申 commitment to resolve；③ 问 "what additional info do you need"；④ 24h 内 follow-up written summary；⑤ 不挂面子` },
        { q: `延期影响客户怎么 communicate？`, hint: `① 不 surprise 客户，提前 sales / customer success 同步；② 提供 alternative（partial delivery / interim solution）；③ 量化 customer impact 给 leadership；④ 客户 directly impacted 要 EM/VP 出面，不只 sales` },
        { q: `重复延期（第 3-4 次）怎么办？`, hint: `① 严肃 retrospective—— 是 estimation 烂还是 execution 烂；② 跟 leadership 重新 scope（可能需要 kill 项目）；③ Team 可能需要 reorg / new lead；④ 自我 reflect 作为 EM 有没 enable team failures` },
      ],
    },

    53: {
      why_asked: `项目三角是 PM/EM 经典框架。能讲"3 角 + customer view + 怎么沟通"的人是真做过 trade-off 决策。`,
      answers: {
        mid: `<strong>Triple Constraints / Iron Triangle</strong>: <strong>Scope / Time / Resource</strong>—— 三角形固定面积，<strong>选 2 个固定，第 3 个随动</strong>。Quality 是面积本身（不能 sacrifice）。`,
        senior: `<strong>4 种 trade-off 场景</strong>:<br>1. <strong>Fix scope + time</strong> → resource 加（典型："hard deadline + must-have features，加 contractor"）<br>2. <strong>Fix scope + resource</strong> → time 延（典型："no extra budget but feature 不变，延期"）<br>3. <strong>Fix time + resource</strong> → scope 减（典型："hard deadline + budget cap，cut MVP features"）<br>4. <strong>Quality 不能动</strong>——典型新 EM 错把 quality 当 4th 维度。Quality issue 长期吃 team velocity（tech debt）+ customer trust。<br><br><strong>跟 stakeholder 沟通</strong>: <strong>"pick 2"</strong>—— 让 stakeholder 选哪两个 fix（typically scope / time），<strong>不让他们当 free lunch</strong>。`,
        staff: `深一层：Iron Triangle 是<strong>初级框架</strong>—— senior PM/EM 用 <strong>Cost of Delay + Risk + Strategic Value</strong> 多维优化。<br><br><strong>真实案例</strong>: platform agent v3 中期发现 scope 超 + senior eng 离职 + customer X 想要某 feature 必须 ship before competitor。这是<strong>三角 + 第 4 维度 cost of delay</strong> 问题。<br><br>分析:<br>· <strong>Fix time + resource → cut scope</strong>: cut feature Y 但 Y 是 customer X 必要 → 失去 customer<br>· <strong>Fix scope + time → add resource</strong>: contractor 2 人 6 周 +$60k，ship on time<br>· <strong>Fix scope + resource → delay</strong>: 推 6 周，竞品 ship before us → customer X 可能切到竞品<br><br>判断:<br>· Customer X ARR $500k/年 → 失去他 = -$500k/年<br>· Contractor cost $60k 一次 → ROI 8×<br>· 选 add resource。<br><br><strong>陷阱</strong>:<br>① <strong>新 EM 把 quality 当 4th 维度 sacrifice</strong>—— 拿"<strong>ship and fix later</strong>" 当 trade-off → 长期 tech debt + customer churn<br>② <strong>Stakeholder 想要"all 3 fixed"</strong>—— 这是不可能的，EM 要教育（不是迎合）<br>③ <strong>Add resource 不一定加速</strong>（Brooks' Law: "<strong>Adding manpower to late software project makes it later</strong>"）—— onboarding 成本 + coordination overhead，10 人项目加 5 人可能 first month 反而慢<br>④ <strong>Cut scope 不是放弃质量</strong>—— cut 是<strong>feature scope</strong>，留下的 features 仍 quality bar 保持<br><br><strong>跟 VP 沟通</strong>: "VP，我们三角失衡，你帮我选哪两个 fix——A. budget +$60k 加 contractor；B. 接受延期 6 周；C. cut 客户 X 定制（risk customer loss）。我 recommend A 因 ROI 8×。Ask: budget approval EOW。"<br><br><strong>关键</strong>：① 不 sacrifice quality；② 让 stakeholder 选；③ 量化 trade-off 数字；④ 给 recommendation + rationale。`,
      },
      failure_modes: [
        `Sacrifice quality 当 4th 维度 → 长期吃 velocity`,
        `不教育 stakeholder "<strong>pick 2</strong>" → 期待 all 3`,
        `Add resource 不算 onboarding overhead (Brooks' Law)`,
        `Cut scope 当放弃质量（应该 cut feature 不 cut bar）`,
        `不量化 trade-off ROI`,
      ],
      follow_ups: [
        { q: `Brooks' Law 是什么？`, hint: `"Adding manpower to a late software project makes it later"——新人 onboarding 占老人时间 + coordination cost 增加；不是 "永远不能加人"，是 "<strong>加人不是 free fix</strong>"` },
        { q: `怎么跟 customer 沟通 cut scope？`, hint: `① 提前（不是 ship 前才说）；② 给 alternative / phased delivery；③ 强调 remaining features quality unchanged；④ 量化对他们的实际影响（"feature X 你 90% workload 不影响"）` },
        { q: `Stakeholder 拒绝 trade-off 怎么办？`, hint: `① 不 force decision—— escalate 给 stakeholder's manager 或 VP；② 给 deadline ("by EOW I need decision")；③ Document inability to decide 作为 risk；④ Worst case execute least bad option + 标记给 leadership` },
      ],
    },

    54: {
      why_asked: `优先级 hell 是 EM 日常。能讲"force ranking + cost of delay + escalation"的人是真做过 portfolio 管理。`,
      answers: {
        mid: `<strong>3 招</strong>: ① <strong>Force ranking</strong>—— 不允许"all P0"，必须 1/2/3/4/5 排序；② <strong>Cost of Delay</strong>—— 量化每个项目延 1 月损失；③ <strong>Escalate to leadership</strong>—— 5 个 P0 是 leadership alignment failure，不是 EM 能独自解决。`,
        senior: `<strong>详细方法</strong>:<br>1. <strong>列出全部 "P0"</strong>—— stakeholder 谁说的是 P0，rationale 是啥<br>2. <strong>Cost of Delay 量化</strong>: 每个项目"延 1 月损失多少"（revenue / risk / customer impact）<br>3. <strong>Force ranking</strong>: 跟 stakeholder 一起按 CoD 排序<br>4. <strong>识别真 P0 vs P1</strong>: 通常 5 个里 1-2 个真 P0，其他是 P1/P2 被 inflated<br>5. <strong>跟 leadership communicate</strong>: "<strong>我们 team capacity 是 X，5 个 P0 总 effort = 3X，必须选 top 2，剩下推 next quarter</strong>"<br>6. <strong>Document</strong> 决策给 stakeholder + leadership，避免 retro 时甩锅`,
        staff: `深一层："5 个 P0" 是<strong>leadership alignment failure</strong>—— 不是 EM 能内部解决的。EM 责任是<strong>surface 这个问题 + 给 leadership 决策框架</strong>，不是<strong>"team 加班 ship 全部"</strong>。<br><br><strong>真实案例</strong>: 作为 EM Q4 接到 5 个"P0"项目:<br>1. Customer X 客户定制（sales push）<br>2. Compliance feature（legal push）<br>3. Performance optimization（架构师 push）<br>4. New feature Y（PM push）<br>5. Tech debt 大项（team push）<br><br>Step 1: <strong>每个 owner 1on1 ask</strong> "为什么 P0 + delay 1 月 cost 多少"<br>· Customer X: ARR $200k, churn if missed → real P0<br>· Compliance: regulatory deadline Q1，错过罚款 $100k → real P0<br>· Performance: P99 incidence 高 + lost deals, fuzzy → P1<br>· Feature Y: nice-to-have, no hard deadline → P2<br>· Tech debt: long-term ROI 但 fuzzy → P2<br><br>Step 2: <strong>跟 VP 1on1</strong>: "<strong>Q4 5 个号称 P0，实际只有 2 个真 P0（Customer X + Compliance）。Team capacity 不够 ship 全部。Options</strong>:<br>· A: Ship 真 P0 2 个，P1/P2 推 Q1<br>· B: 加 contractor 6 人 6 周 ship 4 个（cost $200k）<br>· C: Cut Customer X 定制（lose customer + sales 反弹）<br><strong>Recommend A</strong>—— 真 P0 都 hit，Q1 reset 优先级"<br><br>VP approve A。Step 3: <strong>所有 stakeholder + leadership write-up</strong> 决策 + rationale + Q1 plan，避免后期 surprise。<br><br>结果: 2 个真 P0 都 hit，team 不 burnout，Q1 平稳。Stakeholder 短期失望但长期 trust EM 不 over-promise。<br><br><strong>陷阱</strong>:<br>① <strong>EM 自己 fix all 5</strong>—— team burnout + quality 烂 + 真 P0 也 miss<br>② <strong>不让 leadership 决策</strong>—— 你的 boss 是付钱让你 surface alignment problem 的<br>③ <strong>偏袒某 stakeholder</strong>（loudest wins）—— 短期息事，长期失 fairness<br>④ <strong>不 document 决策</strong>—— retro 时 owner 不认账<br>⑤ <strong>不 reset Q1 expectation</strong>—— Q1 又来 5 个 P0<br><br><strong>关键</strong>: ① Quantify CoD（让 P0 inflation 透明）；② Force ranking（不允许多 P0）；③ Leadership decides（不是 EM）；④ Document（避免甩锅）；⑤ Reset Q+1 process。`,
      },
      failure_modes: [
        `EM 自己 fix all → team burnout`,
        `不让 leadership 决策（自己一肩扛）→ surface 不充分`,
        `Loudest stakeholder 优先 → 不 fair`,
        `不 document → retro 时甩锅`,
        `不 reset 下季度 P0 inflation`,
      ],
      follow_ups: [
        { q: `Cost of Delay 怎么量化？`, hint: `① Revenue impact / 月（lose customer / miss deadline）；② Risk impact（事故概率 × 成本）；③ Strategic value（market window / competitive）；④ 量化越具体 leadership 越容易决策` },
        { q: `如果 leadership 也说 "all 5 are P0"？`, hint: `① 升级到 skip-level；② Show team capacity math（5 P0 × effort = 3× team capacity）；③ 给 hire / contractor option + cost；④ If unmovable, execute with explicit risk acknowledgement` },
        { q: `Stakeholder 抱怨自己项目 deprioritized 怎么办？`, hint: `① 1on1 解释 ranking rationale + data；② 给 alternative timeline（Q1）；③ 邀请他们 challenge ranking（但用数据）；④ If 仍 unhappy, escalate but don't change decision unilaterally` },
      ],
    },

    70: {
      why_asked: `跨部门 EM 最重要技能。能讲"找 vested interest + give first + escalation"的人是真做过 cross-team。`,
      answers: {
        mid: `<strong>3 原则</strong>:① <strong>找对方的 vested interest</strong>（他们为什么要帮你 → 怎么对他们也 win）；② <strong>Give first</strong>（先帮他们的项目）；③ <strong>必要时 escalate</strong>（跟 boss / their boss 协调）。`,
        senior: `<strong>"Influence without authority" 完整 toolkit</strong> (Cohen-Bradford):<br>1. <strong>Diagnose currencies</strong>: 对方在乎什么（status / task / inspiration / relationship / position）<br>2. <strong>Build the relationship first</strong>: 不是急用时才找<br>3. <strong>Bridge through trusted 3rd party</strong>: 找他们信任的人推介<br>4. <strong>Frame as win-win</strong>: 不是"你帮我"，是"我们一起 ship X"<br>5. <strong>Reciprocity</strong>: 先给（帮他们的事 / 推荐人 / share insight）<br>6. <strong>Escalation strategy</strong>: 跟 own boss align → 让 boss talk to their boss<br><br><strong>避免</strong>: 用 own title 强 push / playing politics / 没 explicit ask。`,
        staff: `深一层：Influence without authority 是<strong>Senior EM/Director 跟 Junior EM 最大差距</strong>。Junior EM 在自己 team 范围内 OK，跨 team / 跨部门就卡。<br><br><strong>真实案例</strong>: 推 "所有微服务统一用 OTel" 决策（影响 8 个 team）。我作为<strong>没有跨 team 授权</strong>的 EM:<br><br>1. <strong>Diagnose currencies</strong>:<br>· Team A 的 EM: status currency（公司架构 lead 注意他）<br>· Team B 的 EM: task currency（OTel 让他们事故 root cause 快）<br>· Team C 的 EM: inspiration currency（"this is what 大厂都在做"）<br>· Team D 的 tech lead: knowledge currency（让他成为 OTel 内部专家）<br><br>2. <strong>Pre-1on1 each EM</strong>（共 6 hours）: <br>· 不是 "<strong>需要你接 OTel</strong>"<br>· 是 "<strong>我考虑 X 决策，对你 team 影响是 Y，你怎么看 + concern 是啥</strong>"<br>· 收集 concerns + 修改 plan based on real feedback<br><br>3. <strong>Bridge</strong>: 跟 VP（all EM 共同 boss）pre-align→ "<strong>VP 觉得这个方向对，但要 EM 们 collectively own</strong>"<br><br>4. <strong>Give first</strong>: <br>· 帮 Team A 写 OTel setup script（省他们 2 周）<br>· 帮 Team B 分析 1 个 incident 用 OTel trace（demo value）<br><br>5. <strong>Public design review</strong>: 之前 1on1 已 70% buy in，公开会议是 announce + alignment 不是 debate<br><br>6. <strong>Phased rollout</strong>: 2 个 team 先 pilot 6 周 + share data → 全推时阻力小<br><br>结果: 6 个月推到 8 个 team，0 阻力，反而 4 个 team 主动加速接入。<br><br><strong>反例</strong>: 早期我作为新 EM 跨 team 推 1 个 lint rule，直接发 email "<strong>following 公司架构 standard，请大家接入</strong>"。3 月没人理 + 1 个 EM 公开反对。教训: ① 没 pre-1on1；② 没 buy in；③ 用 authority 强 push；④ 没 give first；⑤ 没 escalation。<br><br><strong>陷阱</strong>:<br>① <strong>用 title push</strong>—— short-term compliance, long-term resistance<br>② <strong>找急时才找</strong>—— relationship 没 built<br>③ <strong>Single channel push</strong>—— email/Slack 没 1on1 跟进<br>④ <strong>没 give first</strong>—— 只索取不付出<br>⑤ <strong>过度 escalate</strong>—— 用 boss 频次太高显得无能<br><br><strong>关键</strong>: ① relationship 平时 build；② 用 currency framework diagnose；③ give first；④ 1on1 优先于公开；⑤ escalate 当 last resort 且 own boss 配合。`,
      },
      failure_modes: [
        `用 title 强 push → resistance`,
        `急时才找 → relationship 没 built`,
        `Single channel（email 群发）→ 没 deep buy in`,
        `没 give first 只索取`,
        `过度 escalate → 显得无能`,
      ],
      follow_ups: [
        { q: `Cohen-Bradford currencies 是哪 6 类？`, hint: `① Task currencies (resource / assistance)；② Position currencies (recognition / visibility)；③ Inspiration currencies (vision / morality)；④ Relationship currencies (acceptance / understanding)；⑤ Personal currencies (gratitude / ownership)；⑥ Power currencies (resources / authority)` },
        { q: `Stakeholder map 怎么画？`, hint: `① 列所有 stakeholder + interest level + influence level；② Power × Interest 2x2 grid；③ High P + High I = Manage Closely；High P + Low I = Keep Satisfied；④ Quarterly refresh` },
        { q: `跨 team conflict 怎么 resolve？`, hint: `① 1on1 跟两个 EM 各听 → 找 root（通常是误解 / priorities 冲突）；② Joint meeting facilitate；③ 找共同 stakeholder（VP）协调；④ Document agreement` },
      ],
    },

    79: {
      why_asked: `向上汇报是 senior EM 高频痛点。能讲"BLUF + tailor + ask"的人是真做过 VP/skip-level update。`,
      answers: {
        mid: `<strong>BLUF + Tailor + Ask</strong>:<br>1. <strong>BLUF</strong>: 30 秒内 VP 知道 status + 结论<br>2. <strong>Tailor to audience</strong>: VP 不需要 implementation detail，需要 business impact + risk + ask<br>3. <strong>Clear ask</strong>: 你要他做什么决策 / 资源 / unblock`,
        senior: `<strong>VP/Skip 5 段式</strong> (90 秒-3 min):<br>1. <strong>Headline</strong>: "Q3 RPC v3 项目 status: <strong>Green</strong> on track"（或 Yellow / Red）<br>2. <strong>3 key metrics</strong>: SPI / customer NPS / P0 incidents<br>3. <strong>Top 2 risks</strong>: 量化 + mitigation<br>4. <strong>1 ask</strong>: 需要他做什么<br>5. <strong>FYI items</strong>: 1-2 个 brief update（不要 deep dive）<br><br><strong>反例</strong>:<br>· ❌ 一口气讲 10 min implementation detail（VP 走神）<br>· ❌ 没 status color（VP 不知道 healthy 不）<br>· ❌ 没 ask（VP 不知道你 need 什么）`,
        staff: `深一层：VP 时间极贵，每次 1on1 你<strong>15-30 min</strong>。Senior EM vs Junior EM 区别是<strong>"信息密度"</strong>—— senior 90 秒给 VP 全部 critical info + clear ask，junior 15 min 还在讲 background。<br><br><strong>真实经验</strong>: 早期作为 EM 跟 VP biweekly:<br><br>· Junior version (失败):<br>"<strong>VP 我跟你 update 下 platform agent 项目。我们这个项目背景是 ... 上 quarter 我们 ship 了 X feature... team 现在 8 人... 最近遇到 vendor issue... bla bla 5 分钟后 ...</strong>"<br>→ VP: "<strong>Sorry, what do you need from me?</strong>"<br><br>· Senior version (成功):<br>"<strong>VP 90 秒 update:<br>1. RPC v3 status: Yellow——SPI 0.85, on track to ship Oct 1 with 70% confidence<br>2. Top risks: ① senior eng离职可能延期 2 周；② vendor SDK 兼容性持续 issue<br>3. Asks: ① approve 1 contractor (~$30k) for next 6 weeks 替代 senior 离职；② intro 我 to vendor VP Eng to escalate SDK issue<br>4. FYI: customer X 上 quarter NPS +10, mostly attributed to v2 quality. We expect v3 to maintain.<br>Anything you want me to deep dive?</strong>"<br>→ VP: "<strong>Approve contractor. I'll intro vendor VP today. Continue.</strong>"<br>→ Done 90 sec. VP 满意。<br><br><strong>关键 hacks</strong>:<br>① <strong>Status color (R/Y/G)</strong>—— VP 一眼看清<br>② <strong>明确 ask</strong> + dollar amount + timeline<br>③ <strong>Anticipate VP question</strong>—— "anything to deep dive" 让他 directs<br>④ <strong>FYI 短</strong>—— 不喧宾夺主<br>⑤ <strong>Written follow-up email</strong>—— action items + 决策 in writing<br><br><strong>陷阱</strong>:<br>① <strong>Bury the lede</strong>—— 把重要事放最后（VP 已经走神）<br>② <strong>没 ask</strong>—— VP 不知道你要什么 → 没 actionable<br>③ <strong>Status 过度 green</strong>—— 当真 Red 时 VP shocked （永远 trustingly accurate, slightly conservative）<br>④ <strong>Too much detail</strong>—— VP 听不下去<br>⑤ <strong>没 written follow-up</strong>—— 一周后 VP 忘了答应啥<br><br><strong>Skip-level 跟 VP 区别</strong>:<br>· VP 听 implementation 多<br>· Skip-level（VP of VP）听 strategic / talent 多<br>· Skip-level 通常 quarterly，不像 VP biweekly<br>· Skip 想知道: team health / future direction / 他能帮你什么<br><br><strong>关键 lesson</strong>: VP 时间贵 → 信息密度高 → BLUF + clear ask + written follow-up。`,
      },
      failure_modes: [
        `Bury the lede（最重要放最后）`,
        `没 status color → VP 不知道 healthy 不`,
        `没明确 ask`,
        `Too much implementation detail`,
        `没 written follow-up → VP 忘事`,
      ],
      follow_ups: [
        { q: `Bad news 怎么 deliver？`, hint: `① Early surface（不 hide and hope）；② Own it（不甩锅 team / vendor）；③ Quantify damage + mitigation；④ Give 3 options + recommendation；⑤ Show learning + future prevention` },
        { q: `跨 VP 的 update（multiple stakeholder）怎么做？`, hint: `① Common summary 给所有；② Tailored ask 给单 VP；③ CC 关键 stakeholder；④ Document decision after meeting；⑤ Avoid surprise—— pre-align 1on1 each stakeholder` },
        { q: `Skip-level 频次 + 内容？`, hint: `① Frequency: quarterly default；② Content: team health (engagement / attrition) / strategic direction / your career / what's blocking / how can I help；③ Skip-level 不是 status update，是 trust / calibration / talent` },
      ],
    },

    96: {
      why_asked: `Senior EM / Manager-of-Managers 高频题。能讲"L3 onboarding + first 90 day + delegation"的人是真带过新 EM。`,
      answers: {
        mid: `<strong>3 阶段</strong>:① <strong>First 30 day onboard</strong>（明确 expectation + team intro + shadow）；② <strong>30-90 day support</strong>（weekly 1on1 + specific challenges + mentor pairing）；③ <strong>90+ day delegate</strong>（让他独立 + 你监督 outcome 不监督 process）。`,
        senior: `<strong>具体 deliverables</strong>:<br>· <strong>Week 1</strong>: 1on1 with all reports, EM job description, team backlog overview<br>· <strong>Week 2-4</strong>: Shadow 你的 EM activities（1on1 / leadership meeting / hiring）<br>· <strong>Month 2</strong>: 独立做 1on1 + post-1on1 你 debrief<br>· <strong>Month 3</strong>: 独立做 perf review + 你 coach 风格<br>· <strong>Month 4+</strong>: Delegate 完整 ownership，weekly check-in，季度 calibrate<br><br><strong>关键</strong>: ① 不<strong>过度 micromanage</strong>（让他 own + 接受他犯错）；② 不<strong>过度 delegation</strong>（new EM 没经验自己 figure out 全部失败率高）；③ Show vulnerability—— 你自己 struggle 也 share。`,
        staff: `深一层：辅导新 EM 跟自己当 EM 不同—— <strong>"通过他人达成结果"</strong> 的 meta-level skill。Senior EM /Director 80% 时间在 "scale through others"。<br><br><strong>真实经验</strong>: 我 promote IC X 当 first-time EM（带 6 人 team）。我作为他的 manager (manager-of-manager)：<br><br>· <strong>Pre-promotion 1 个月</strong>: 让 X shadow 我的 1on1 / hiring debrief / perf review process（让他看 EM job 真实样子，不只是 title upgrade）<br>· <strong>Day 1 (promotion day)</strong>: 1on1 with team announce, X 致辞，我退后<br>· <strong>Week 1-2</strong>: <br>· 每周 2x 1on1 (high cadence)<br>· 给 EM 资源（书 / 内部 doc / Slack channel）<br>· 跟他 1on1 review 他 team 6 人的 status（让他 know team）<br>· <strong>Month 1-3</strong>: <br>· 1on1 cadence 降到 weekly<br>· Topics: specific challenge (e.g., "Y team member is underperforming, how to handle")<br>· 我 mostly 问 ("what would you do?")，不直接 give answer<br>· <strong>Month 4-6</strong>:<br>· 1on1 bi-weekly<br>· Delegate increasingly：hiring decision / perf calibration / budget<br>· 我 review outcome 不 review process<br>· <strong>Month 6+</strong>: <br>· Monthly 1on1<br>· X 独立 manage<br>· 季度 perf calibration with VP<br><br><strong>典型 mistakes X 早期做</strong>:<br>① 第 1 个 1on1 自己讲 80% 时间（应该 listen 80%）→ 我下次 debrief 指出<br>② "你应该做 X" mode（应该 "have you considered X" coaching mode）<br>③ Try to be friend with all reports（应该 friendly not friend）<br>④ Avoiding hard conversation (PIP)→ 我 model 一次 PIP conversation 让他 shadow<br><br>每个 mistake 我:<br>· 1on1 1:1 frank feedback（私下）<br>· 给他 reading material<br>· 让他 retry + 我 coach<br><br>18 月后 X 成 senior EM，开始 mentor 下一个 first-time EM。<br><br><strong>陷阱</strong>:<br>① <strong>Too much hand-holding</strong>—— 他不 develop independent judgment<br>② <strong>Too much delegation</strong>—— first-time EM 自己 figure out 全部，失败率高<br>③ <strong>Promote without preparation</strong>—— 没 shadow / 没 reading / 没 mentor 直接 day 1 当 EM = 90% 6 月内回 IC track<br>④ <strong>Not modeling vulnerability</strong>—— 装"完美 EM" → new EM 觉得自己 struggle 是 weakness<br>⑤ <strong>Not creating safe failure space</strong>—— first-time EM 一定 mistake，关键是 learning fast<br><br><strong>关键</strong>: ① 渐进 delegation；② Coach 不 dictate；③ Model vulnerability；④ Safe failure space；⑤ Long-term horizon（18-24 个月才算成熟新 EM）。`,
      },
      failure_modes: [
        `Promote 无 preparation → 90% 6 月回 IC`,
        `Too much hand-holding → 不 develop judgment`,
        `Too much delegation → first-time 自己 figure 失败率高`,
        `Not modeling vulnerability → new EM 装 perfect`,
        `Not safe failure space → 不敢 try`,
      ],
      follow_ups: [
        { q: `什么样的 IC 适合 promote 当 EM？`, hint: `① 已经在 team 中 informal lead；② 喜欢 mentor / unblock 别人；③ 能 take ambiguous problem；④ Communication 强；⑤ 准备好 80% 时间不写 code` },
        { q: `New EM 6 月内 underperform 怎么办？`, hint: `① Frank feedback + 具体 action items；② 给 6 月 PIP-like cadence；③ 仍 not work 时 → discuss IC track demotion (no shame)；④ 90% 是 expectation mismatch 或 wrong promotion timing` },
        { q: `Manager-of-managers vs 单 EM 区别？`, hint: `① 80% scale through others 而非自己 do；② Skip-level cadence 重要；③ Calibration across team；④ Org design / hiring strategy；⑤ Career stays vs lateral move from senior EM (different track)` },
      ],
    },

    109: {
      why_asked: `2026 AI-EM 必考。能讲"hallucination / 安全 / over-trust 3 大风险 + mitigation"的人是真用过 GenAI 写代码。`,
      answers: {
        mid: `<strong>3 大风险</strong>:① <strong>Hallucination</strong>—— AI 编 API / library / 性能数字；② <strong>安全 / IP</strong>—— code leak 到 LLM training data + 引入 vulnerability；③ <strong>Over-trust</strong>—— team 不 review diff 直接 ship。`,
        senior: `<strong>详细 + Mitigation</strong>:<br>1. <strong>Hallucination</strong>:<br>· AI 编不存在 API / function / library version<br>· Mitigation: ① 关键代码 mandatory code review；② Sanity check API 真存在；③ AI 输出过 linter / type check<br>2. <strong>安全 / IP</strong>:<br>· Sensitive code 喂 LLM → 进 training data → 竞品看见<br>· AI 生成 vulnerable code (SQL injection / XSS / hardcoded secret)<br>· Mitigation: ① 用 enterprise GPL/Copilot Business（no training）；② Sensitive prompt redact；③ AI code 跑 SAST / sanitizer<br>3. <strong>Over-trust</strong>:<br>· "AI 写完测试也跑过我就 ship" → 测试可能被 AI 改坏<br>· Junior 不 learn fundamentals<br>· Mitigation: ① 永远 review 完整 diff；② Mandatory test review；③ Junior weekly no-AI exercise`,
        staff: `深一层：AI 写代码风险<strong>不是 fundamentally 新</strong>—— 跟外包 / contractor 写代码风险类似 (quality / 安全 / IP / ownership)。<strong>区别是 scale × speed</strong>—— AI 每天产出可能 10×, mistake 也 10× scale。<br><br><strong>真实事故 case</strong>:<br>1. <strong>Hallucinated API</strong>: 一个 team member 用 AI 写代码 "调 Stripe API v3 method foo()" —— v3 不存在 foo() 方法，AI 编的。代码 compile 过（dynamic typed lang），runtime 才崩。<br>· 教训: ① TypeScript / static type 防一部分；② 关键 SDK 调用 mandatory review；③ AI 输出 cross-check 官方 doc<br><br>2. <strong>IP leak</strong>: Junior 用 ChatGPT free tier debug 一个 algorithm，share 了 source code 一段。3 个月后<strong>同 algorithm 出现在竞品产品</strong>。可能巧合可能不是—— 但 risk 真实。<br>· Mitigation: 全公司只允许 Enterprise GPT / Copilot Business（no training on input）<br><br>3. <strong>Vulnerable AI code shipped</strong>: AI 生成的 SQL query 没 parameterize → injection vulnerability。Code review 没 catch（AI code looks "clean"）。<br>· Mitigation: ① 强制 SAST 在 CI；② AI code 跑 sanitizer；③ Code review 关注 security pattern<br><br>4. <strong>Junior regression</strong>: 一个 junior 6 个月全用 AI 写 code → 升 senior 时 system design 完全不会。<br>· Mitigation: junior weekly "no-AI Friday" + mentor 强制 deep dive "为什么这么写"<br><br><strong>EM 责任</strong>:<br>① <strong>Policy</strong>: ① Enterprise tier only；② Sensitive code restricted；③ AI code 必走 SAST/Sanitizer<br>② <strong>Review process</strong>: ① 永远 review diff；② Mandatory test review；③ AI-generated label 在 PR<br>③ <strong>Skill development</strong>: junior 不让 AI fully replace fundamental learning<br>④ <strong>Calibrate</strong>: 6 月看 AI usage 跟 bug rate / vulnerability rate 关系，调整 policy<br><br><strong>陷阱</strong>:<br>① <strong>Ban AI entirely</strong>—— team 失去 productivity 优势<br>② <strong>No policy at all</strong>—— random risk<br>③ <strong>Only worry about quality</strong> ignore IP / 安全<br>④ <strong>Junior 一直靠 AI</strong>—— 长期 ceiling 低<br>⑤ <strong>EM 自己不用 AI</strong>—— 不能 calibrate team usage<br><br><strong>关键</strong>: AI 是 productivity multiplier，但 multiplier 也 multiply mistake。EM 责任是<strong>setup safety net</strong> (policy / process / skill development) 让 multiplier 净正。`,
      },
      failure_modes: [
        `Ban AI entirely → 失 productivity`,
        `No policy → random risk`,
        `Only quality concern → 忽略 IP / security`,
        `Junior 一直靠 AI → fundamentals 不扎实`,
        `EM 自己不用 AI → calibrate 不准`,
      ],
      follow_ups: [
        { q: `Enterprise GPT / Copilot Business 跟 free tier 区别？`, hint: `① No training on input data；② SLA / security audit；③ Admin controls / DLP；④ Cost 5-10× higher 但 enterprise 必须；⑤ 2026 主流公司都用 Enterprise tier` },
        { q: `怎么 detect AI-generated vulnerable code？`, hint: `① SAST (Semgrep / SonarQube)；② AI-aware reviewer training；③ Common patterns (string concat SQL / hardcoded secret) auto flag；④ Periodic pen test catch missed` },
        { q: `Junior 在 AI 时代怎么 develop fundamentals？`, hint: `① Weekly no-AI exercise；② Mentor 强制 deep dive "why this works"；③ Algorithm / design 书还要读；④ Pair programming with senior；⑤ Periodic system design 练习` },
      ],
    },

    115: {
      why_asked: `EM Burnout 是 2024-2026 普遍问题。能讲"信号 + 系统改进 + 个人 limit"的人是真处理过 burnout（自己 / team）。`,
      answers: {
        mid: `<strong>3 招</strong>:① <strong>Identify early signal</strong>（情绪疲惫 / cynicism / sense of failure 3 个）；② <strong>System-level fix</strong>（process 改 / boundary set / 删 unimportant work），<strong>不是只休息</strong>；③ <strong>Hard limit</strong>（晚上 / 周末 / 假期 protect）。`,
        senior: `<strong>EM Burnout 4 大 root cause</strong>:<br>1. <strong>Always-on 文化</strong>: Slack 24/7 / 周末 work / 假期 reply<br>2. <strong>Decision fatigue</strong>: 每天 50+ decision (1on1 / hiring / perf / fire)<br>3. <strong>Emotional load</strong>: 处理别人情绪 + 自己 hide own emotion<br>4. <strong>No peer support</strong>: EM 跟 IC 不能完全 share（manager loneliness）<br><br><strong>具体 mitigation</strong>:<br>· <strong>Calendar audit</strong>: 1 周 track time，砍 25% meeting<br>· <strong>"No meeting" block</strong>: 每天 90 min focus time<br>· <strong>Slack boundaries</strong>: 晚上 / 周末 disable notification<br>· <strong>EM peer network</strong>: 跟同 level EM monthly 1on1（vent + 学习）<br>· <strong>Sabbatical / 长假</strong>: 1 年 1 次 2-week 真断网`,
        staff: `深一层：EM burnout 跟<strong>IC burnout 不同</strong>—— IC 通常 over-work caused，EM 是<strong>"emotional + decision load"</strong> caused。即便 50 hour/week 也可能 burnout（如果每个 hour 都是 emotional intense）。<br><br><strong>典型 EM burnout symptoms</strong>:<br>· 早上 dread 上班 (vs IC 时 excite)<br>· Cynicism (对 team / company purpose)<br>· 决策 fatigue ("don't ask me anymore")<br>· Sleep poor / eating poor<br>· Avoid hard conversation (PIP / fire)<br>· "I'm fine" 但 weekly 状态实际下滑<br><br><strong>真实经验</strong>: 我作为 EM 18 个月时进入 burnout。Symptoms: 周日 evening anxiety / 1on1 时 zoned out / hiring decision avoidance / 减肥 10 lb 没努力。我 took 2 weeks真断网 vacation + 跟 own EM peer 谈，识别：<br><br>1. <strong>Calendar audit</strong>: 70% 时间 in meeting，每个 meeting 都需要 active engage. Cut 25%（delegate 部分 1on1 / decline non-essential meeting / async 替代 status meeting）。<br>2. <strong>1on1 cadence</strong>: 12 人 weekly 1on1 = 6 hours/week + emotional load 高. 砍到 8 人 weekly + 4 人 biweekly。<br>3. <strong>"No-meeting Wednesday"</strong>: 强制 1 day/week focus / strategic thinking。<br>4. <strong>EM peer monthly</strong>: 跟 3 个同 level EM monthly group call，vent + 学习 + 不孤单。<br>5. <strong>Slack boundary</strong>: 18:00-09:00 + weekend disable notification (urgent 通过 phone)。<br>6. <strong>Hard mandatory vacation</strong>: 每年 minimum 3 weeks，2 weeks 真断网。<br><br>6 月后 burnout fully recovered + sustainable cadence。<br><br><strong>给 team 做什么</strong>（不只 self）:<br>① Model healthy boundaries（你不发 11pm email → team 跟随）<br>② 显式 "I'm taking 2 weeks vacation, X is acting EM, no Slack from me"<br>③ Quarterly check team burnout (anonymous survey)<br>④ Sponsor team vacation usage（team annual leave usage &gt; 80%）<br>⑤ Postmortem culture（事故不是 individual blame → 减 emotional load）<br><br><strong>陷阱</strong>:<br>① <strong>Just take vacation</strong>—— 不改 system，回来 same burnout<br>② <strong>"我必须 always available"</strong>—— team 实际不需要，是你 own anxiety<br>③ <strong>Hide burnout</strong>—— peer / own EM 不知不 help<br>④ <strong>EM 不 vacation</strong> → team 也不 → 全 burn<br>⑤ <strong>Confuse busy with productive</strong>—— meeting 70% 但产出 30%<br><br><strong>关键</strong>: ① Early signal 识别；② System (calendar / process) 改不只 individual；③ Peer support；④ Hard boundary；⑤ Model for team。`,
      },
      failure_modes: [
        `Just take vacation 不改 system → 回来 same burnout`,
        `"必须 always available" → 自 imposed anxiety`,
        `Hide burnout → peer / own EM 不知`,
        `EM 不 vacation → team 跟随`,
        `Busy vs productive 混 → 不 prioritize`,
      ],
      follow_ups: [
        { q: `Burnout 早期 signal 怎么识别？`, hint: `① 周日 dread 周一；② 1on1 zoned out；③ 决策 avoidance；④ Cynicism 跟 team 互动；⑤ Sleep / eating disrupted；⑥ Periodic self-survey (Maslach Burnout Inventory)` },
        { q: `Team 中有人 burnout 怎么办？`, hint: `① 1on1 frank ask "are you okay"；② Reduce workload + remove blocker；③ Mandatory vacation (1-2 周)；④ Pair with peer support；⑤ Re-evaluate workload sustainability; ⑥ Not blame for burnout—— system issue` },
        { q: `怎么 prevent team burnout？`, hint: `① Quarterly anonymous survey；② Track vacation usage (target &gt; 80%)；③ No 11pm email policy；④ Postmortem blameless culture；⑤ Tech debt / 工具改善（减 toil work）` },
      ],
    },
  },

  cpp: {
    // ============== 值类别 / 移动语义 ==============
    51: {
      why_asked: `区分"背过 move 关键字"和"真理解 C++11 内存模型"。能讲清 5 值类别 + 两两组合（glvalue / rvalue）的人通常调过 perfect forwarding 相关的 bug。`,
      answers: {
        mid: `底层 3 种：<strong>lvalue</strong>（有名 / 可取址）、<strong>prvalue</strong>（纯临时，如字面量、返回值）、<strong>xvalue</strong>（将亡值，有身份但资源可被偷，如 <code>std::move(x)</code>）。聚合 2 种：<strong>glvalue</strong> = lvalue ∪ xvalue（有身份的值），<strong>rvalue</strong> = xvalue ∪ prvalue（可被移动的值）。`,
        senior: `<strong>双维度</strong>：① <strong>有无身份</strong>（identity，能否取址 / 跨表达式访问）；② <strong>能否被移动</strong>（moveable，资源可偷）。组合出 4 个理论象限，但 "有身份且不可移动" 就是 lvalue / "无身份且不可移动" 不存在 / "无身份可移动" = prvalue / "有身份可移动" = xvalue。<strong>关键洞察</strong>：<strong>右值引用变量本身是 lvalue</strong>（有名）—— 这是 perfect forwarding 必须用 std::forward 而不是直接传 T&& 的原因。`,
        staff: `深一层：值类别<strong>是表达式属性而非类型属性</strong>——"int x" 的 x 在不同表达式里值类别不同。<strong>C++17 改动</strong>：prvalue 不再"实体化"为临时对象，直到必要时才 materialize → 让 <strong>guaranteed copy elision</strong> 成为标准（之前只是优化）。<strong>实战影响</strong>：① 工厂函数返回不可拷贝/移动的类型可行了（如 <code>std::lock_guard</code>，C++17 前要 trick）；② <code>return T(...)</code> 不再有"应不应该写 move" 的犹豫。<strong>真实经验</strong>：platform agent 项目曾因为不懂 xvalue 和 prvalue 区别，写了 <code>auto v = std::move(GetVec())</code>—— GetVec() 已经是 prvalue（C++17 后 RVO 强制 elision），std::move 反而 disable 了 elision，多了一次 move 构造。看 -ftime-report 才发现性能慢了 8%。修成 <code>auto v = GetVec();</code> 后恢复。`,
      },
      failure_modes: [
        `不区分 "类型 T&&" 和 "表达式值类别 rvalue"（混着说）`,
        `认为 std::move(x) 后 x 一定空（实际是 xvalue，是否真移动看接收方）`,
        `对返回值无脑写 std::move → 反而 disable RVO（C++17 强制 elision）`,
        `认为引用类型的变量"是 rvalue"（变量本身永远是 lvalue，无论类型）`,
        `讲 5 种但讲不出 xvalue 的具体场景（typically: std::move / 返回 T&& 的函数）`,
      ],
      follow_ups: [
        { q: `decltype(x) 和 decltype((x)) 区别？`, hint: `decltype(x) 看 x 的"声明类型"；decltype((x)) 看 x 作为表达式的值类别，lvalue → T&，xvalue → T&&，prvalue → T。多一层括号是绕过去 corner case` },
        { q: `Guaranteed copy elision 怎么工作？`, hint: `C++17 起 prvalue 不再立即实体化为对象，编译器直接在最终目标位置构造；不是"消除拷贝"而是"<strong>从一开始就没有临时对象</strong>"` },
        { q: `xvalue 的典型来源？`, hint: `① std::move(T)；② 返回 T&& 的函数（很少见）；③ 取右值的成员 / 下标；④ 隐式右值引用绑定的 cast；99% 场景是 ①` },
      ],
    },

    53: {
      why_asked: `测试候选人对 std::move 的真实理解。能讲"std::move 只是 cast"的人脱离了 "move = 移动" 的初学误解。`,
      answers: {
        mid: `<strong>std::move 不移动任何东西</strong>——它只是一个 <strong>cast</strong>，把表达式无条件转为 xvalue（T&&）。是否真发生移动，由<strong>接收方决定</strong>（是否调用移动构造 / 移动赋值）。`,
        senior: `等价定义：<code>template&lt;class T&gt; constexpr remove_reference_t&lt;T&gt;&amp;&amp; move(T&amp;&amp; t) noexcept { return static_cast&lt;remove_reference_t&lt;T&gt;&amp;&amp;&gt;(t); }</code>。<strong>关键</strong>：① 它<strong>不分配 / 不释放 / 不修改</strong>对象状态；② 真正的"移动"发生在接收方的<strong>移动构造函数 / 移动赋值运算符</strong>里；③ 如果类型没定义移动操作，<strong>std::move 后还是拷贝</strong>。`,
        staff: `深一层：理解 std::move 的精确语义能避免一类性能 bug。<strong>典型 case</strong>：<br>① <code>auto y = std::move(x);</code>—— 如果 X 类型只有拷贝构造没有移动构造，y 还是<strong>拷贝</strong>得来，x 不变。<br>② <code>const X x; auto y = std::move(x);</code>—— move 后类型是 const X&&，但移动构造形参是 X&&，<strong>const X&& 不能绑 X&&</strong>，编译器退化到拷贝构造（const X& 能绑），<strong>silently 退化</strong>。<br>③ 模板内 <code>T&& x</code> 是万能引用 —— 用 std::move 会把 lvalue 也 force 成 xvalue，调用方原对象可能被偷空（应该用 std::forward）。<br><br><strong>真实经验</strong>：platform 项目有次性能审计发现某 hot path 慢，profile 发现是 <code>const Buffer b = ...; queue.push(std::move(b));</code> —— 因为 const，move 后还是拷贝（10MB Buffer 拷贝 ~3ms × 10k QPS）。改成 mutable Buffer 后恢复。<strong>实用规则</strong>：① 写完 std::move 永远问一次"接收方有移动操作吗 + 我的对象是 const 吗"；② Class 没特殊原因都加 <code>X(X&&) noexcept = default; X&amp; operator=(X&&) noexcept = default;</code>。`,
      },
      failure_modes: [
        `认为 std::move 真的修改原对象（实际只是 cast）`,
        `对 const 对象 std::move（silently 退化为拷贝）`,
        `万能引用里用 std::move 而不是 std::forward（破坏 caller 的左值原对象）`,
        `类型没定义移动构造还期待 std::move 加速（实际还是拷贝）`,
        `循环内 std::move(arg) 多次（第一次后对象已被偷，第二次起是 moved-from state）`,
      ],
      follow_ups: [
        { q: `Moved-from 对象的状态是什么？`, hint: `① 标准要求"valid but unspecified"——可以析构、可以赋新值，<strong>不能假设具体内容</strong>；② STL 类型通常 moved-from 后是 empty state，但<strong>不依赖于此</strong>` },
        { q: `什么时候应该写 std::move？`, hint: `① 返回局部对象：通常不写（让 NRVO 工作）；② 把变量传给函数后不再用：写 std::move；③ 模板里写 std::forward 不是 std::move` },
        { q: `std::move 的性能成本？`, hint: `0 cost——纯编译期 cast，不生成任何机器码。但它<strong>启用</strong>的移动构造调用本身有成本（取决于类型，typically &lt; copy）` },
      ],
    },

    54: {
      why_asked: `Perfect forwarding 的核心。能讲"std::forward 用引用折叠保持值类别"的人通常实现过通用容器 / 工厂函数。`,
      answers: {
        mid: `<strong>std::move</strong>：无条件转 rvalue（"我确定要移动"）。<br><strong>std::forward&lt;T&gt;</strong>：根据 T 是否带引用决定是否转 rvalue（"按实参原样转发"）。<strong>std::forward 专为万能引用场景用</strong>，依赖引用折叠规则。`,
        senior: `<strong>典型用法</strong>：<br>1) 完美转发：<code>template&lt;class... Args&gt; T* make(Args&amp;&amp;... args) { return new T(std::forward&lt;Args&gt;(args)...); }</code>—— 万能引用 + std::forward 保留每个参数原本的值类别。<br>2) 不写 forward 直接用 args 会把所有参数当 lvalue 传 → 拷贝构造而不是移动构造 → 性能差。<br>3) <strong>forward 的 T 必须显式指定</strong>（不能让模板推导），通常写 <code>std::forward&lt;Args&gt;(arg)</code>。`,
        staff: `深一层：理解 forward 的精确实现：<br><code>template&lt;class T&gt; T&amp;&amp; forward(remove_reference_t&lt;T&gt;&amp; t) noexcept { return static_cast&lt;T&amp;&amp;&gt;(t); }</code><br>当 T = U&（lvalue 引用）→ 引用折叠 T&& = U&（保持 lvalue）；当 T = U（值或右值引用）→ T&& = U&&（变成 xvalue）。这就是"按实参原样转发"的实现。<br><br><strong>陷阱场景</strong>：<br>① <strong>不要在<u>非</u>万能引用场景用 std::forward</strong>——纯右值引用 T&& x 应该用 std::move(x)；<br>② <strong>循环里转发同一个 args</strong>—— forward 后是 xvalue，第二次循环对象已被偷；<br>③ <strong>引用收集器</strong>（如把 args 存入 tuple 后再 forward）需要 tuple 元素类型为 T&&，不是 T。<br><br><strong>真实案例</strong>：在写一个 emplace-style 容器时，初版 <code>emplace(args...) { new(slot) T(args...); }</code>—— 所有参数被当 lvalue 传 → 一个 std::string 临时被 copy 而非 move，benchmark 慢 30%。改成 <code>emplace(Args&amp;&amp;... args) { new(slot) T(std::forward&lt;Args&gt;(args)...); }</code> 后恢复 std::vector::emplace_back 的性能。`,
      },
      failure_modes: [
        `非万能引用里用 std::forward（应该用 std::move）`,
        `万能引用里直接传 args 不用 std::forward（所有参数变 lvalue）`,
        `forward 写错模板参数：std::forward(arg) 不指定 &lt;T&gt; → 推导出错`,
        `存到 tuple 后再 forward 时没考虑引用 collapsing`,
        `循环里多次 forward 同一参数（第二次是 moved-from state）`,
      ],
      follow_ups: [
        { q: `如果不用 std::forward 会怎样？`, hint: `① 万能引用里：lvalue 还是 lvalue，但 rvalue 也变 lvalue → 失去移动机会；② 例子：调用 emplace_back(std::string("foo")) 退化成 copy 而非 move` },
        { q: `forward 能用于"普通"引用吗？`, hint: `理论可以但毫无意义——纯 T& 永远是 lvalue，forward&lt;T&&gt; 也是 lvalue。专为万能引用 / template 通用代码而设` },
        { q: `如何避免转发问题（C++20 后）？`, hint: `① C++20 concepts 约束模板参数，减少误用；② constexpr if 分支处理；③ 用 std::invoke 简化调用；④ 复杂场景考虑直接用 lambda / std::bind_front` },
      ],
    },

    55: {
      why_asked: `理解模板和泛型代码的关键。能背口诀但不能给例子的人通常没写过模板库。`,
      answers: {
        mid: `模板里 T&& 推导时，引用类型代入会"折叠"：<br>· <code>T&amp;</code> &amp; → <code>T&amp;</code><br>· <code>T&amp;</code> &amp;&amp; → <code>T&amp;</code><br>· <code>T&amp;&amp;</code> &amp; → <code>T&amp;</code><br>· <code>T&amp;&amp;</code> &amp;&amp; → <code>T&amp;&amp;</code><br><strong>口诀</strong>：任何 lvalue ref 进来，结果就是 lvalue ref；只有两个 rvalue ref 折叠才是 rvalue ref。`,
        senior: `<strong>典型例子</strong>：<br><code>template&lt;class T&gt; void f(T&amp;&amp; x);</code><br>· 传 lvalue（int a; f(a);）→ T 推导为 <strong>int&amp;</strong> → x 类型 = int& && → 折叠为 <strong>int&amp;</strong><br>· 传 rvalue（f(42);）→ T 推导为 <strong>int</strong> → x 类型 = int&& → 保持 <strong>int&amp;&amp;</strong><br><strong>结论</strong>：T&& 在<strong>模板推导上下文</strong>能绑左值也能绑右值——这就是"万能引用 (universal/forwarding reference)" 名字的由来。`,
        staff: `深一层：引用折叠是<strong>C++ 类型系统避免"引用的引用"的方式</strong>——C++ 语言层禁止 T& &，但模板实例化和 typedef 可能产生。引用折叠让这些场景"<strong>降阶</strong>"到合法的引用类型。<br><br><strong>实战影响</strong>：① <strong>perfect forwarding</strong> 完全依赖这条规则——std::forward&lt;T&gt; 内部 static_cast 到 T&&，T = U& 时折叠回 U&，T = U 时变 U&&，自动保持值类别；② <strong>万能引用</strong>是 typo——更准确是"forwarding reference"（Scott Meyers 名字）；③ 同一种 T&& 写法在<strong>类模板成员</strong>不是万能引用：<code>template&lt;class T&gt; class Foo { void g(T&&); };</code>—— g 的 T 不是新推导的而是类的，g(T&&) 是<strong>纯右值引用</strong>。<br><br><strong>真实经验</strong>：写一个事件总线时遇到过这个坑——<code>template&lt;class T&gt; class Bus { void emit(T&&); };</code>，调用方 <code>bus&lt;int&gt; b; b.emit(x);</code> 报错"can't bind lvalue to int&&"。改成成员模板 <code>template&lt;class U&gt; void emit(U&&);</code> 才让它成为万能引用。这个区别即使 senior 也常踩坑。`,
      },
      failure_modes: [
        `背"任何 lvalue 进来都变 lvalue"但说不出推导过程`,
        `认为 T&& 永远是万能引用（其实只在模板参数推导上下文）`,
        `类模板成员函数里写 T&& 期待万能引用（实际是纯右值）`,
        `const T&& / vector&lt;T&gt;&& / U::T&& 当万能引用（其实都不是）`,
        `不知道引用折叠是 std::forward 工作的核心机制`,
      ],
      follow_ups: [
        { q: `非模板里的 T&& 是什么？`, hint: `就是普通的右值引用，绑定 prvalue / xvalue，<strong>不能绑 lvalue</strong>；只有模板参数推导时 T&& 才"升级"成万能引用` },
        { q: `auto&& 是万能引用吗？`, hint: `是！auto 的推导规则跟模板 T 一样，所以 <code>auto&amp;&amp; x = expr;</code> 能绑任何东西。range-based for 内部就用 <code>auto&amp;&amp;</code> 处理 proxy 引用（vector&lt;bool&gt;）` },
        { q: `decltype(auto) 跟引用折叠的关系？`, hint: `decltype(auto) 保留<strong>表达式</strong>的值类别（lvalue → T&，xvalue → T&&）；常用于完美转发返回值场景` },
      ],
    },

    60: {
      why_asked: `验证候选人是否真理解返回值优化（不只听过 RVO）。能区分 RVO / NRVO / Copy Elision 并知道 C++17 强制 RVO 的人是真做过性能优化。`,
      answers: {
        mid: `<strong>RVO (Return Value Optimization)</strong>：函数返回临时对象（prvalue）时省略拷贝 / 移动，C++17 起<strong>强制</strong>。<br><strong>NRVO (Named Return Value Optimization)</strong>：返回<strong>具名局部对象</strong>时省略，编译器<strong>自由选择</strong>（主流编译器 GCC / Clang / MSVC 默认都做）。<br><strong>Copy Elision</strong>：这两者的统称。`,
        senior: `<strong>关键差异</strong>：① C++17 起 RVO 是 standard mandate（不优化也得行为像优化了，因为 prvalue 不再 materialize 临时）；② NRVO 仍是 optional 优化（编译器可做可不做）；③ 都不需要类型有拷贝 / 移动构造（C++17 后 RVO 让 <code>std::lock_guard</code> 这种 noncopyable 类型也能从函数返回）。<strong>启用条件</strong>：① 返回类型 = 函数声明的返回类型；② 没在 return 语句外修改 / 走多分支返回不同对象的情况；③ 不要对 return value 强行 std::move（会 disable elision）。`,
        staff: `深一层：理解 elision 的精确机制能避免几类典型性能 bug。<br><strong>反模式</strong>：<br>① <code>return std::move(local);</code>—— 强制把 prvalue 变 xvalue，<strong>disable RVO</strong>，多一次 move 构造（move 不便宜，复合对象 ~100ns）。<br>② <code>if (x) return A; else return B;</code> 多分支返回不同对象——NRVO 难做，可能退化为 copy / move。<br>③ 返回类型不一致——<code>T f() { U u; return u; }</code> 触发隐式转换 U → T，elision 失败。<br><br><strong>真实经验</strong>：在 platform agent 优化某 hot path 时发现 <code>std::string buildPath() { std::string p = "..."; ... return std::move(p); }</code>—— 当时同事认为"显式 move 更高效"，实际禁用了 NRVO，每次调用多一次 move。改成 <code>return p;</code> 后 -O2 下完全 zero-cost 返回（NRVO 让 p 直接构造在 caller 的栈帧位置）。<br><br><strong>C++17 强制 RVO 的副效应</strong>：现在可以这样写：<code>auto lg = make_lock_guard(mu);</code> 即使 lock_guard 不可移动不可拷贝。之前这种 noncopyable 工厂模式必须用 <code>std::optional</code> 或额外指针。`,
      },
      failure_modes: [
        `<code>return std::move(x);</code> "想优化"反而 disable RVO`,
        `多分支返回不同变量 → NRVO 不工作`,
        `返回类型隐式转换 → elision 失败 → silent copy`,
        `认为 elision 一定发生（NRVO 是 optional，old MSVC -Od 不做）`,
        `用 std::optional + 拷贝包装 noncopyable 类型（C++17 后可以直接 return）`,
      ],
      follow_ups: [
        { q: `什么场景必须显式 std::move 返回值？`, hint: `① 返回函数<strong>参数</strong>（参数不是局部对象，NRVO 不适用）；② 返回 std::unique_ptr 这种 move-only 但<strong>不是同名变量</strong>的情况；③ 返回基类槽位的派生类对象（slicing 风险） ` },
        { q: `如何验证 RVO 真的发生？`, hint: `① 编译期：godbolt 看汇编（无 copy / move 调用）；② 运行期：构造 / 拷贝 / 移动 ctor 加 printf；③ -fno-elide-constructors 强制 disable 后对比 perf` },
        { q: `Guaranteed copy elision 影响 ABI 吗？`, hint: `不影响——C++17 RVO 强制是语言层规则，编译器生成的 ABI（caller 传 hidden ptr 给函数当返回地址）跟 C++03 时代相同；只是优化前后 caller 看到的行为变了` },
      ],
    },

    62: {
      why_asked: `极简但杀伤力大——这道题能筛掉 60% 的"会用 std::move 但不懂值类别"候选人。`,
      answers: {
        mid: `<strong>变量本身是 lvalue</strong>（有名 / 可取址）——即便它的"<strong>类型</strong>"是右值引用。这是绕过最多人的点。`,
        senior: `<strong>区分"类型"和"值类别"</strong>：T&& x —— x 的类型是 T&&（右值引用），但 x 作为表达式的值类别是 <strong>lvalue</strong>（因为它有名字、可取址、可多次访问）。所以函数体里写 <code>some_fn(x)</code> 传的是 lvalue，会调用 <code>some_fn(T&)</code> 重载，不是 <code>some_fn(T&&)</code>。<strong>要触发右值重载</strong>必须 <code>some_fn(std::move(x))</code> 或 <code>some_fn(std::forward&lt;T&gt;(x))</code>。`,
        staff: `深一层：这条规则的<strong>设计哲学</strong>—— 如果 T&& x 自身就是 rvalue，那任何用 x 的代码都可能偷它的资源，<strong>第二次访问就是 UB</strong>。把变量本身定义为 lvalue 让代码"<strong>显式同意</strong>"被 move（必须写 std::move）。<br><br><strong>实战影响</strong>：① 移动构造函数体内 <code>T(T&&amp; other) { member = other.member; }</code>—— other 是 lvalue → member 拷贝构造！正确：<code>member = std::move(other.member);</code> 才真移动。② Perfect forwarding 必须用 std::forward 不是 std::move——因为 T&& x 自身是 lvalue，直接传给下层函数会丢失原值类别。③ 万能引用的设计完全依赖此规则。<br><br><strong>真实案例</strong>：platform agent 的 Message 类移动构造写错过：<code>Message(Message&&amp; other) : payload(other.payload) {}</code>—— 这写法<strong>看起来在 move 但实际是 copy</strong>（payload 是 lvalue）。性能审计时发现 message hot path 慢，profile 显示大量 std::vector::vector(const std::vector&)（拷贝构造）。改成 <code>: payload(std::move(other.payload))</code> 后吞吐 +35%。这个 bug 类型在 senior C++ codebase 里很常见，很多人写完 move ctor 没真测过。<strong>对策</strong>：用 <code>= default</code> 让编译器生成（除非必须自定义）。`,
      },
      failure_modes: [
        `认为 T&& x 自身是 rvalue → 直接传给下层函数 → 实际调用左值重载 → 静默拷贝`,
        `Move ctor 体内忘了 std::move 成员 → 移动 ctor 退化为拷贝 ctor（性能 bug）`,
        `万能引用里用 std::move 不用 std::forward → 偷 caller 的左值`,
        `不能解释"为什么 x 是 lvalue"——只背口诀没理解设计`,
        `循环里多次操作 T&& x 假设第一次不动 → 实际由接收方决定`,
      ],
      follow_ups: [
        { q: `怎么"取地址"测试这个？`, hint: `<code>T&amp;&amp; x = ...; &amp;x;</code> 合法 → 证明 x 是 lvalue；<code>&amp;std::move(y)</code> 编译错（rvalue 不能取址）` },
        { q: `这条规则的实际危害？`, hint: `典型: move ctor / move assign 写错 → 看起来 "移动" 实际拷贝 → 性能 bug 难找；推荐自定义 move 操作前先看 godbolt 汇编验证` },
        { q: `怎么自动验证 move 真的发生？`, hint: `① 类型加 inline static counter，构造 / 拷贝 / 移动 +1，单测断言；② -fno-elide-constructors 跑 testbench；③ 工具：Heaptrack / Valgrind massif 看分配次数` },
      ],
    },

    // ============== 现代特性 ==============
    25: {
      why_asked: `验证候选人是否真用过 C++20。能讲清"concept 解决 SFINAE 的什么痛点"的人写过模板库。`,
      answers: {
        mid: `给模板参数加<strong>编译期谓词</strong>，实例化前就拒绝不满足约束的类型。三大改进：① <strong>错误信息</strong>从"几屏 SFINAE 噩梦"→"concept X not satisfied"；② <strong>接口契约清晰</strong>（一眼看出对类型的要求）；③ <strong>重载决议更准确</strong>（编译器可对 concept 严格度排序）。`,
        senior: `<strong>语法</strong>：<code>template&lt;std::integral T&gt; T add(T a, T b) { return a + b; }</code>，比 SFINAE 的 <code>enable_if_t&lt;is_integral_v&lt;T&gt;&gt;</code> 简洁 5×。<strong>组合</strong>：<code>std::integral && !std::same_as&lt;T, bool&gt;</code>。<strong>定义自己的 concept</strong>：<code>template&lt;class T&gt; concept Drawable = requires(T t) { t.draw(); };</code>。<strong>关键</strong>：concept 是<strong>命名的</strong>谓词，可在多处重用，错误信息直接给 concept 名字。`,
        staff: `深一层：concept 解决 C++ 模板的<strong>"鸭子类型 + 慢错误"两大顽疾</strong>。<br><strong>没 concept 时</strong>：模板代码深度递归实例化失败，错误信息几百行（典型例子是 std::sort 传 lambda 没返回 bool 时 GCC 报 200 行错），开发者无法定位。<br><strong>有 concept 后</strong>：第一层检查就拒绝，错误信息 1 行 "T doesn't satisfy Comparable"。<br><br><strong>实践建议</strong>：① 自己写的 lib 公开 concept（让用户能查阅契约）；② 用 std 标准 concepts（std::integral / std::regular / std::sortable / std::ranges::range 等几十个）；③ requires 子句可以放在 template 前或函数后两个位置，前者更清晰；④ <strong>渐进迁移</strong>：先在 public API 加 concept，老 SFINAE 内部可继续用。<br><br><strong>真实经验</strong>：将一个 C++14 项目升级到 C++20 时，把一个有 12 处 SFINAE 的 type-erasure container 改用 concept，错误信息从平均 300 行降到 5-10 行，新人 onboarding 时间 -50%。<strong>陷阱</strong>：① concept 跟 traits 混用语义可能冲突（concept 是 ad-hoc，traits 是预定义）；② <code>requires requires { ... }</code> 看起来重复但合法（前者引入 requires-clause，后者是 requires-expression）；③ concept 没有继承机制（不像 trait class）—— refine 关系靠组合。`,
      },
      failure_modes: [
        `还在用 SFINAE 写新代码（C++20 项目应优先 concept）`,
        `把 concept 当 type trait（concept 是布尔谓词，trait 是 type / value 计算）`,
        `不命名 concept，每个模板写 inline 谓词 → 散乱`,
        `requires requires { } 不会写或乱写`,
        `不知道标准库提供几十个现成 concept（重复造轮子）`,
      ],
      follow_ups: [
        { q: `concept 跟 typename 区别？`, hint: `template&lt;typename T&gt; 是无约束；template&lt;std::integral T&gt; 是有 concept 约束；写 <code>concept C = ...</code> 定义新 concept` },
        { q: `不能用 C++20 时怎么模拟 concept？`, hint: `① C++17 用 std::enable_if + std::void_t；② Boost.Hana；③ 自己写 detection idiom；体验远差` },
        { q: `concept 跟 dynamic dispatch 的关系？`, hint: `concept 是编译期静态多态（zero overhead），virtual 是运行期动态分派；两者互补——hot path 用 concept，需运行时灵活用 virtual` },
      ],
    },

    26: {
      why_asked: `C++20 ranges 是 C++ 标准库设计哲学最大的转折点之一。能讲"投影 + 视图组合 + 惰性求值"的人是真用过。`,
      answers: {
        mid: `① <strong>不必传 begin / end</strong>（直接传容器：<code>std::ranges::sort(v);</code>）；② <strong>投影 (projection)</strong>—— 排序 / 查找指定字段 <code>std::ranges::sort(users, less{}, &amp;User::score);</code>；③ <strong>视图组合</strong>（<code>v | filter | transform | take</code>）惰性求值，不构造中间容器；④ <strong>concepts 约束</strong>—— 错误信息更友好。`,
        senior: `<strong>核心心智</strong>：从"<strong>命令式</strong>"（写 for 循环 + accumulator）转 "<strong>声明式</strong>"（描述 transformation pipeline）。<br><strong>经典对比</strong>：<br><code>// 老式 STL</code><br><code>std::vector&lt;int&gt; tmp; for (auto&amp; x : v) if (x &gt; 0) tmp.push_back(x * 2); std::sort(tmp.begin(), tmp.end());</code><br><code>// ranges</code><br><code>auto out = v | std::views::filter([](int x) { return x &gt; 0; }) | std::views::transform([](int x) { return x * 2; }); std::ranges::sort(out);</code><br>ranges 版本 <strong>无中间容器</strong>，filter / transform 在迭代时按需计算。`,
        staff: `深一层：ranges 的<strong>设计代价</strong>不小——① 编译时间增加（重模板 + concept），② 错误信息复杂的链可能仍长，③ 标准库实现差异较大（GCC 13+ / Clang 16+ / MSVC 2022 19.30+ 完整支持）。<br><strong>实战建议</strong>：① <strong>新项目</strong>大胆用，提升可读性；② <strong>性能敏感场景</strong>仍用 for 循环（views 链有 abstraction overhead，typical 5-15% 慢，编译器优化后能接近持平但不一定）；③ <strong>调试</strong>：每个 view 单独 piping 出来检查，链式 debug 困难；④ <strong>避免 dangling</strong>—— views 持有 source 的引用，source 析构后 views UB（owning_view C++23 部分缓解）。<br><br><strong>真实案例</strong>：platform agent 用 ranges 处理设备列表 transformation，<strong>代码行数 -40%，可读性 +++</strong>，<strong>但</strong> hot path（百万设备 / 秒）退回手写 for 循环（ranges 版本 -8% 性能）。中等吞吐 + 复杂逻辑场景是 ranges 甜点；hot path 仍是手写 loop。<strong>C++23 增量</strong>：① std::ranges::to&lt;Container&gt;()（从 view 物化到容器）；② 更多视图（chunk / slide / zip / cartesian_product）；③ owning_view 安全持有源。`,
      },
      failure_modes: [
        `把 ranges 当性能优化（typical 没快，只是写法变了）`,
        `views 链超长 → 编译信息爆炸 / 调试困难`,
        `用 views 后没 std::ranges::to 物化 → 期待是容器但其实是 view`,
        `Dangling views：用 <code>get_vec() | filter(...)</code>，临时容器析构后 view 悬挂`,
        `Hot path 用 ranges → abstraction overhead → benchmark 不达标`,
      ],
      follow_ups: [
        { q: `ranges 跟 std::execution（并行算法）能组合吗？`, hint: `部分可以：std::ranges::sort 没有 execution policy 重载（C++23 仍如此）；要并行执行需要 std::sort + std::execution::par + ranges::begin/end；尚不完美` },
        { q: `怎么写自己的 view？`, hint: `继承 std::ranges::view_interface + 实现 begin/end + 标记 enable_view_v；C++23 起更容易（views::adapt）；典型场景：自定义 sliding window` },
        { q: `ranges 的编译性能怎么样？`, hint: `比手写 for 慢 30-100%（编译时间）；重模板 + concept 检查 + view 嵌套类型膨胀；大项目 ranges 用得多要考虑 build time / PCH 优化` },
      ],
    },

    27: {
      why_asked: `C++20 协程是 2024-2026 年最热的 C++ 新特性。能讲"无栈协程 / 编译器状态机切分 / promise_type"的人是真深入过。`,
      answers: {
        mid: `让<strong>异步代码看起来像同步</strong>：<code>auto u = co_await fetch_user(id); auto f = co_await fetch_friends(u.id);</code> 消除嵌套 then 回调地狱。编译器把函数<strong>切分为状态机</strong>（无栈协程，比线程轻 10-100×）。`,
        senior: `<strong>核心机制</strong>：① <code>co_await expr</code> 暂停执行，把当前函数转成 suspend handle；② 编译器生成<strong>状态机 class</strong>（每个 suspend point 一个 state）；③ <strong>无栈</strong>（stackless）—— 协程 frame 在堆上 ~64-256 bytes，远小于线程栈 8MB。<strong>vs future + then</strong>：① 写法直观（同步语法 + 异步语义）；② 错误处理用 try/catch（vs then 链）；③ 控制流（if/while/break）自然；④ 调试栈帧可恢复（vs then 的 continuation 链）。`,
        staff: `深一层：C++ 协程是<strong>"library-defined coroutine"</strong>——语言只提供 co_await / co_return / co_yield 关键字 + 编译器机械切分，<strong>所有语义靠用户自定义 promise_type / awaiter</strong>。这是 power but burden：① 标准库不提供 Task&lt;T&gt; / Generator&lt;T&gt;（C++23 加 generator），用户要自己实现或用 cppcoro / Folly / Boost.Cobalt；② 异常 propagation / 取消机制 / 调度器集成都自己设计。<br><br><strong>vs Go goroutine</strong>：① Go 是有栈协程（每 goroutine ~4KB 栈），切换需要保存 / 恢复栈；C++ 无栈协程零栈切换开销但函数边界硬约束（不能在任意函数里 suspend）；② Go runtime 自带调度器，C++ 必须自定义（io_uring / boost.asio / 自写）。<br><br><strong>真实经验</strong>：platform agent 异步 RPC 处理：① 之前用 Boost.Asio yield_context（stackful coroutine）—— 写法好但每个 coroutine ~512KB 栈，10k 并发 = 5GB 内存；② 切到 C++20 无栈协程 + cppcoro Task &lt;T&gt;，单 coroutine ~200 bytes frame，10k 并发 ~2MB 内存。<strong>代价</strong>：① 学习曲线陡（promise_type / awaitable 概念）；② 调试支持不完善（gdb 7+ 才有 coroutine print）；③ 编译错误可能很长。<strong>C++23</strong> 加 <code>std::generator</code>，预计 C++26 加 std::execution（Sender/Receiver 模型替代 / 增强协程）。`,
      },
      failure_modes: [
        `用协程不懂 lifetime —— co_await 返回的 Task 析构早于 await 完成 → UB`,
        `promise_type 自己写但忘了 return_void / return_value / unhandled_exception → 编译错乱`,
        `期待标准库有 Task&lt;T&gt;（C++26 才有 std::execution；现在用 cppcoro / Folly）`,
        `用栈对象当 captured by reference，coroutine resume 时 stack 已 unwind → UB`,
        `Mixing stackful（Boost yield）和 stackless（C++20）协程 → 心智模型混乱`,
      ],
      follow_ups: [
        { q: `co_await 后的代码怎么"被恢复"？`, hint: `awaitable 的 await_suspend 决定何时恢复：① 返回 coroutine_handle 直接 resume；② 返回 bool（false = 立即继续，true = 暂停）；③ 注册到事件循环 / IO 完成回调时 resume` },
        { q: `Generator 跟 Task 区别？`, hint: `Generator: co_yield 多次返回值（pull-based 迭代），用于流式数据；Task: co_return 一次返回结果，用于异步函数；C++23 std::generator 标准化前者，后者还需库实现` },
        { q: `Symmetric transfer 是什么？`, hint: `awaitable::await_suspend 返回另一个 coroutine_handle 时，编译器生成<strong>tail call</strong>（无栈增长）直接转移控制；避免链式 coroutine resume 的栈溢出` },
      ],
    },

    156: {
      why_asked: `验证候选人是否真理解强异常安全。能讲"vector 扩容用它选拷贝 / 移动"的人是看过 libstdc++ 源码。`,
      answers: {
        mid: `<strong>基于 type traits 选择策略</strong>：若 T 的移动构造 <code>noexcept</code> → 返 <code>T&amp;&amp;</code>（move）；否则返 <code>const T&amp;</code>（copy）。<strong>vector 扩容内部用它</strong>—— 当 T 的 move 不 noexcept 时，<strong>退化为 copy</strong>以保<strong>强异常安全</strong>。`,
        senior: `<strong>背景</strong>：vector reserve / push_back 触发扩容时，要把元素从老 buffer 复制到新 buffer。如果用 move 但 move 中途抛异常 → 新 buffer 半填充 / 老 buffer 已被偷 → 数据丢失，违反强异常安全（"操作要么全成功要么不影响"）。<strong>对策</strong>：用 move_if_noexcept —— move 不 noexcept 时用 copy（copy 失败不影响老 buffer），<strong>noexcept move 才用 move</strong>。`,
        staff: `深一层：这是 C++11 引入 move semantics 后<strong>容器作者面临的两难</strong>—— ① 都用 move 性能好但牺牲强异常安全；② 都用 copy 强异常但失去 move 优势。move_if_noexcept 让<strong>类型作者通过 noexcept 标记"我承诺 move 不抛"</strong>，容器作者据此选择。<br><br><strong>实战影响</strong>：① 所有自定义类型应该写 <code>X(X&&amp;) noexcept = default;</code>—— 否则 vector 扩容时退化为拷贝，性能可能慢 100×；② STL 容器中的 string / vector / map / unique_ptr 的 move 都是 noexcept；③ 包含 std::function 成员的类型可能<strong>不 noexcept</strong>（std::function move 可能抛 bad_alloc）—— 这时 vector&lt;MyClass&gt; 扩容会退化为 copy。<br><br><strong>真实案例</strong>：电信项目里有个 Message class 含 <code>std::function&lt;void()&gt; callback;</code>，开发同事觉得 "我加了 <code>Message(Message&&amp;) = default;</code> 就够了"，但 std::function 的 move 不 noexcept → Message 的 move 也不 noexcept → vector&lt;Message&gt; 扩容退化为 copy。Benchmark 显示该 hot path 慢 22 倍。改用 <code>std::function&lt;void()&gt;*</code> 间接持有 + 自定义 noexcept move 后恢复。<strong>对策</strong>：① 在 ctor 显式标 noexcept；② 用 <code>static_assert(std::is_nothrow_move_constructible_v&lt;T&gt;);</code> 防退化；③ 容器内 wrap shared_ptr 避免直接持复杂对象。`,
      },
      failure_modes: [
        `自定义 move ctor 忘了 noexcept → vector 扩容退化拷贝 → 性能 bug`,
        `用 std::function / std::any 等可能不 noexcept move 的类型作直接成员`,
        `不知道这个 trait → 解释不了为什么 vector 性能波动`,
        `认为 move_if_noexcept 跟普通 move 没区别（其实是 type-conditional）`,
        `没用 static_assert 防止 move 退化（隐式回归不易察觉）`,
      ],
      follow_ups: [
        { q: `怎么验证你的类型 noexcept-move？`, hint: `<code>static_assert(std::is_nothrow_move_constructible_v&lt;T&gt;);</code> + <code>std::is_nothrow_move_assignable_v&lt;T&gt;</code>；C++17 起还有 <code>std::is_nothrow_swappable_v</code>` },
        { q: `vector 扩容时还有其他 noexcept 检查吗？`, hint: `move_if_noexcept 是核心；C++17 后部分实现进一步检查 trivial 操作（memcpy 安全）—— trivially copyable types 直接 memcpy，跳过任何 ctor` },
        { q: `noexcept 真的对性能有影响吗？`, hint: `① 直接：noexcept 函数省去 unwind table 部分内容；② 间接（更重要）：让容器 / 算法 / move_if_noexcept 选 move 而非 copy；推荐所有析构 + move 默认 noexcept` },
      ],
    },

    158: {
      why_asked: `C++17 重要简化，能讲"何时需要写推导指引"的人是真用过。`,
      answers: {
        mid: `<strong>CTAD (Class Template Argument Deduction)</strong>：构造类模板对象时，<strong>模板参数可由构造函数实参推导</strong>——不必显式写。例：<code>std::pair p(1, "hi");</code> 替代 <code>std::pair&lt;int, const char*&gt; p(1, "hi");</code>。必要时写"<strong>推导指引</strong>" (deduction guide)。`,
        senior: `<strong>典型例子</strong>：<br><code>std::vector v{1, 2, 3};</code>  // C++17 推 vector&lt;int&gt;<br><code>std::lock_guard lg(mu);</code>  // 推 lock_guard&lt;Mutex&gt;<br><code>std::pair p{1, "hi"};</code>  // 推 pair&lt;int, const char*&gt;<br><br><strong>推导指引</strong>（自定义类型可能需要）：<br><code>template&lt;class T&gt; struct Foo { Foo(T); }; Foo(const char*) -&gt; Foo&lt;std::string&gt;;</code><br>—— 让 <code>Foo f("hi")</code> 推 Foo&lt;std::string&gt;（不是 Foo&lt;const char*&gt;）。`,
        staff: `深一层：CTAD 是 C++17 "<strong>少写模板参数</strong>" 趋势的一部分（auto + structured binding + CTAD）。<strong>陷阱</strong>：① <strong>不能用于成员变量声明</strong>（C++17 只支持局部变量 / new；C++20 起部分场景支持成员）；② 推导可能<strong>意外</strong>（<code>std::pair p{1, "hi"}</code> 推 const char*，不是 std::string）—— 用 deduction guide 修正；③ <strong>聚合初始化</strong>（C++20）跟 CTAD 组合时规则复杂。<br><br><strong>实践</strong>：① <strong>立即可用</strong>：std::vector / std::set / std::lock_guard / std::optional 等标准库类型；② <strong>自定义类型</strong>：模板参数能从 ctor 直接推则不写 deduction guide，复杂场景写；③ <strong>避免过度依赖</strong>—— 显式模板参数有时更可读（特别是接口边界）。<br><br><strong>真实经验</strong>：platform agent 把 200+ 处 <code>std::lock_guard&lt;std::mutex&gt; lg(mu);</code> 改成 <code>std::lock_guard lg(mu);</code>，代码行数减 / 阅读舒适度上升；但 public API 仍保留显式模板参数（type 是接口契约一部分，不让 caller 看到推导结果）。<strong>C++17 vs C++20 增强</strong>：C++20 起聚合初始化也支持 CTAD —— <code>struct Foo { int a; double b; }; Foo f{1, 2.0};</code> 自动推导（之前不可）。`,
      },
      failure_modes: [
        `期待 CTAD 适用于成员声明（C++17 只支持局部 / new）`,
        `自定义类型推导出意外的模板参数（const char* vs std::string）→ 不写 deduction guide`,
        `滥用 CTAD 让 public API 不清晰（caller 看不到类型）`,
        `复杂 ctor 多个候选时推导失败 → 不知道写 deduction guide`,
        `跟 SFINAE / concept 组合时推导规则没掌握`,
      ],
      follow_ups: [
        { q: `Deduction guide 语法？`, hint: `<code>template&lt;参数列表&gt; ClassName(ctor 参数) -&gt; ClassName&lt;推导出的模板参数&gt;;</code>；放在类定义后；用于修正默认推导` },
        { q: `什么时候<strong>不</strong>该用 CTAD？`, hint: `① 公开 API 边界（caller 应明确类型）；② 复杂模板有可能误推导；③ 团队 codebase 风格统一为显式` },
        { q: `auto vs CTAD 怎么选？`, hint: `<code>auto v = std::vector{1, 2, 3};</code> 双重推导（CTAD + auto）；如果你想"装在变量里的某个类模板实例化"用 CTAD；如果你不在乎具体类型用 auto` },
      ],
    },

    // ============== 模板 / SFINAE ==============
    98: {
      why_asked: `区分"会调 STL"和"会写 lib"的关键 C++11 知识点。能讲清"enable_if / void_t / decltype"三种用法的人是真写过 generic code。`,
      answers: {
        mid: `<strong>SFINAE = Substitution Failure Is Not An Error</strong>。模板代入失败时编译器把候选移出重载集，而不是报错。用 <strong>enable_if / void_t / decltype</strong> 实现编译期分发。`,
        senior: `<strong>三种典型模式</strong>：<br>① <code>enable_if</code>: <code>template&lt;class T, class = enable_if_t&lt;is_integral_v&lt;T&gt;&gt;&gt; void f(T);</code><br>② <code>void_t</code>（检测某表达式合法）: <code>template&lt;class, class = void&gt; struct has_foo : false_type{}; template&lt;class T&gt; struct has_foo&lt;T, void_t&lt;decltype(declval&lt;T&gt;().foo())&gt;&gt; : true_type{};</code><br>③ <code>decltype</code> 返回类型: <code>template&lt;class T&gt; auto f(T t) -&gt; decltype(t.size()) { return t.size(); }</code><br><br>C++20 起 <strong>concept 几乎完全替代</strong>这套，但老代码 / 跨编译器兼容还要懂。`,
        staff: `深一层：SFINAE 是 C++ "<strong>偶然</strong>发现"的特性（标准并未明确"为什么这么设计"），是 type trait 库 + tag dispatch + iterator categories 的基础。<strong>SFINAE 的 4 个限制</strong>：① <strong>仅 substitution 阶段</strong>—— 函数体内 / 类内 error 不 SFINAE；② <strong>仅 immediate context</strong>—— template 嵌套时深层失败不 SFINAE（导致"hard error"）；③ <strong>错误信息巨长</strong>（多重 substitution failure 累积）；④ <strong>partial ordering 复杂</strong>—— 多个重载都 SFINAE pass 时谁优先？<br><br><strong>真实经验</strong>：在 platform agent 的 type erasure container 里用了 12 处 SFINAE 检测"是否有 serialize / deserialize 成员"。C++20 升级后改用 concept，代码行数 -40%，错误信息从平均 300 行降到 5 行。<strong>SFINAE vs concept</strong>：① SFINAE 是过程式（"如果代入这个失败，跳过这个候选"），concept 是声明式（"这个类型必须满足这个谓词"）；② 错误质量 concept ≫ SFINAE；③ 性能编译时间 concept ~ SFINAE（取决于复杂度）；④ <strong>新代码全用 concept</strong>，老代码逐步迁移。`,
      },
      failure_modes: [
        `C++20 项目还在用 SFINAE 写新代码（应该 concept）`,
        `SFINAE 出错信息看不懂，没工具识别 immediate context 范围`,
        `期待函数体内 type error 也 SFINAE（其实只 substitution 阶段）`,
        `不知道 void_t / decltype 检测表达式合法性的 trick`,
        `partial ordering 不熟，多个 SFINAE 候选时不知道哪个优先`,
      ],
      follow_ups: [
        { q: `enable_if vs enable_if_t 区别？`, hint: `enable_if 是 type trait，结果是 ::type；enable_if_t 是 C++14 alias，等于 enable_if&lt;...&gt;::type；写起来短 8 个字符` },
        { q: `tag dispatch 怎么实现？`, hint: `用 iterator_category 等 tag struct 作为额外参数，重载函数按 tag 类型分派；本质是用 overload resolution 替代 if constexpr` },
        { q: `if constexpr 替代 SFINAE 的优势？`, hint: `① 单一函数模板内分支，不用多个重载；② 错误信息友好（hard error 而非 substitution failure）；③ 但只能分支逻辑，不能选不同的 type / signature` },
      ],
    },

    99: {
      why_asked: `这道题区分"看过 std::forward 例子"和"真懂 universal reference 推导规则"。能给反例（不是万能引用的情况）的人是真理解。`,
      answers: {
        mid: `仅当 T&& 出现在<strong>模板参数推导上下文</strong>，<strong>T 是要推导的模板参数</strong>且<strong>不带 const</strong> 时，才是<strong>万能引用</strong>（能绑左值或右值，通过引用折叠）。<code>const T&amp;&amp;</code> / <code>vector&lt;T&gt;&amp;&amp;</code> / <code>U::T&amp;&amp;</code> 等都<strong>不是</strong>万能引用，是<strong>纯右值引用</strong>。`,
        senior: `<strong>测试规则</strong>：<br>· <code>template&lt;class T&gt; void f(T&amp;&amp;);</code>—— ✓ 万能引用<br>· <code>template&lt;class T&gt; void f(const T&amp;&amp;);</code>—— ✗ 纯右值（const 破坏推导）<br>· <code>template&lt;class T&gt; void f(std::vector&lt;T&gt;&amp;&amp;);</code>—— ✗ 纯右值（T 在 vector 内部不是顶层）<br>· <code>template&lt;class T&gt; class C { void g(T&amp;&amp;); };</code>—— ✗ 纯右值（T 是类参，不是函数参数推导）<br>· <code>auto&amp;&amp; x = ...;</code>—— ✓ 万能引用（auto 推导规则同 template T）<br>· <code>template&lt;class T&gt; void f(T&amp;&amp;);</code> 调用 <code>f(arg)</code> arg 是 int → T 推导 int → 实际 T&& = int&&（rvalue ref）<br>· 调用 <code>f(arg)</code> arg 是 int& 命名变量 → T 推导 int& → 实际 T&& = int& && = int&（lvalue ref，<strong>这就是引用折叠</strong>）`,
        staff: `深一层：<strong>"万能引用"是 Scott Meyers 提的非官方名字</strong>（更准确是 "<strong>forwarding reference</strong>"）。命名含义：① "万能"—— 能绑任意值类别；② "forwarding"—— 用来配合 std::forward 把参数原样传到下层函数。<br><br><strong>实战陷阱</strong>：<br>① 类成员函数模板 <code>template&lt;class U&gt; void g(U&&);</code> 是万能引用；类<strong>本身</strong>模板的成员 <code>void g(T&&);</code>（T 是类模板参）<strong>不是</strong> —— 这是 perfect-forwarding container 的常见 bug。<br>② <code>template&lt;class T, class = enable_if_t&lt;...&gt;&gt; void f(T&&);</code>—— enable_if 不影响推导，仍是万能引用。<br>③ <code>auto&&</code> in range-for（<code>for (auto&amp;&amp; x : container)</code>）—— 是万能引用，让 x 能绑 proxy iterator 的右值（vector&lt;bool&gt;::reference）。<br><br><strong>真实经验</strong>：写一个事件总线 <code>template&lt;class Event&gt; class Bus { void emit(Event&&amp;); };</code>—— 用户期待能 <code>bus&lt;int&gt; b; int x = 0; b.emit(x);</code> 但编译失败（int x 不能绑 int&&）。改成 <code>template&lt;class U&gt; void emit(U&& u);</code> 后，U 在函数推导，变成万能引用，OK。<strong>对策</strong>：① 测试用例覆盖 lvalue + rvalue 两种调用；② 静态检查 <code>static_assert(std::is_same_v&lt;T, decltype(arg)&gt;);</code> 验证推导符合预期。`,
      },
      failure_modes: [
        `类模板成员 <code>void g(T&&)</code> 期待万能引用（实际纯右值）`,
        `const T&& 当万能引用（const 破坏推导，是纯右值）`,
        `vector&lt;T&gt;&& / Container&lt;T&gt;&& 误以为万能引用`,
        `不知道 auto&& 也是万能引用规则`,
        `万能引用里直接用变量而不是 std::forward（丢值类别）`,
      ],
      follow_ups: [
        { q: `怎么"故意"让某个参数<strong>不是</strong>万能引用？`, hint: `① 加 const：const T&&；② 嵌套类型：vector&lt;T&gt;&&；③ 类模板成员的类参；① 是常见 idiom（明确"我只接受右值"）` },
        { q: `Scott Meyers 为什么改名 "universal" → "forwarding"？`, hint: `"universal" 强调能绑任何，但容易让人忘了它的实用目的；"forwarding" 强调它的用途——配合 std::forward 实现完美转发` },
        { q: `万能引用 + std::move 是 anti-pattern 吗？`, hint: `通常是——会把 caller 的左值也"偷"走（违反期待）。正确：万能引用配 std::forward；纯右值引用配 std::move` },
      ],
    },

    157: {
      why_asked: `元编程基础。能讲递归 + 折叠表达式两种展开方式的人才真用过。`,
      answers: {
        mid: `两种展开方式：<br>① <strong>递归</strong>：终止特化 + 通用版（取出 head，剩下 Rest... 递归）<br>② <strong>折叠表达式 (fold expression, C++17)</strong>：<code>(... op pack) / (pack op ...) / 二元版本</code>，编译期把 pack 展开成一系列二元运算。`,
        senior: `<strong>典型例子</strong>：<br><code>// 递归（C++11）</code><br><code>template&lt;class T&gt; void print(T t) { std::cout &lt;&lt; t; }</code><br><code>template&lt;class T, class... Rest&gt; void print(T t, Rest... rest) { std::cout &lt;&lt; t &lt;&lt; ' '; print(rest...); }</code><br><br><code>// 折叠表达式（C++17）</code><br><code>template&lt;class... Args&gt; void print(Args... args) { ((std::cout &lt;&lt; args &lt;&lt; ' '), ...); }</code><br><br>C++17 后 fold expression 更简洁，<strong>但</strong>递归方式更灵活（能在递归中做复杂逻辑）。`,
        staff: `深一层：variadic template 是 C++11 元编程的核心，<strong>解决了 C++03 时代的"<u>函数参数数量爆炸</u>"</strong>（之前 tuple / function 等要写 0/1/2/...N 个参数的版本）。<br><br><strong>折叠表达式 4 种形式</strong>：<br>① <code>(... op pack)</code>—— 一元左折叠：<code>((1 op 2) op 3) op 4</code><br>② <code>(pack op ...)</code>—— 一元右折叠：<code>1 op (2 op (3 op 4))</code><br>③ <code>(init op ... op pack)</code>—— 二元左折叠：<code>((init op 1) op 2) op 3</code><br>④ <code>(pack op ... op init)</code>—— 二元右折叠：<code>1 op (2 op (3 op init))</code><br><br><strong>空 pack 处理</strong>：仅 ${'&&'} / ${'||'} / ${'comma'} 三个运算符允许空 pack（结果分别是 true / false / void()）。其他运算符空 pack 编译错。<br><br><strong>实战</strong>：① <strong>printf-like</strong> 函数；② <strong>tuple 操作</strong>（apply / make_tuple）；③ <strong>类型 list 处理</strong>（std::tuple_element 等）；④ <strong>visitor 模式</strong>（std::visit 内部用 variadic + fold）。<br><br><strong>性能</strong>：variadic 展开在<strong>编译期</strong>—— 无运行时开销。但编译时间随参数数指数增长（不推荐 &gt; 20 个）。复杂场景考虑 metaprogramming 库（Boost.Mp11 / Hana）。`,
      },
      failure_modes: [
        `用递归方式但忘了写终止特化 → 无限递归编译失败`,
        `折叠表达式忘加括号 → 语法错误`,
        `期待空 pack 用任意运算符 → 编译错（仅 && / || / , 允许）`,
        `参数太多（&gt; 50）→ 编译时间爆炸`,
        `跟 perfect forwarding 组合时忘 std::forward`,
      ],
      follow_ups: [
        { q: `怎么访问 variadic pack 中的第 N 个？`, hint: `① std::tuple + std::get&lt;N&gt;；② 递归 unwrap；③ C++26 pack indexing（pack...[N]）；前两者主流` },
        { q: `怎么对 pack 中每个元素做相同操作？`, hint: `① C++17 fold + comma：<code>((process(args), ...));</code>；② std::apply + lambda；③ C++20 ranges 的 zip` },
        { q: `variadic 跟 std::tuple 关系？`, hint: `tuple 是把 variadic pack <strong>具现化</strong>为对象（pack 是编译期概念）；操作 tuple 通常需要 fold expression 或 std::apply 把它"展开"回 pack` },
      ],
    },

    180: {
      why_asked: `void_t 是 SFINAE 的"秘密武器"，简洁威力大。能讲"detection idiom"的人是真写过 type trait。`,
      answers: {
        mid: `<strong>C++17</strong>: <code>template&lt;class...&gt; using void_t = void;</code>。用于 SFINAE <strong>检测"某表达式是否合法"</strong>。经典：检测类型有无某成员函数。`,
        senior: `<strong>经典用法 (Detection Idiom)</strong>：<br><code>template&lt;class, class = void&gt; struct has_size : std::false_type {};</code><br><code>template&lt;class T&gt; struct has_size&lt;T, std::void_t&lt;decltype(std::declval&lt;T&gt;().size())&gt;&gt; : std::true_type {};</code><br><br><strong>用法</strong>：<code>has_size&lt;std::vector&lt;int&gt;&gt;::value</code> = true，<code>has_size&lt;int&gt;::value</code> = false（int 没 size()）。<br><br><strong>原理</strong>：① 特化版本的<strong>第二个参数</strong>用 void_t 包住 <code>decltype(...)</code>；② 如果表达式合法，void_t 求值为 void，特化生效（true_type）；③ 表达式非法，SFINAE 让特化被丢弃，回到通用 false_type。`,
        staff: `深一层：void_t 是 <strong>"忽略一切类型表达式，统一变成 void"</strong>—— 它的<strong>真正作用是触发 SFINAE</strong>（让 decltype 求值失败时整个 template 被丢弃）。<br><br><strong>C++20 替代</strong>：concept + requires 简洁太多：<br><code>template&lt;class T&gt; concept HasSize = requires(T t) { t.size(); };</code><br>等价的 detection idiom 一行写完。<strong>但</strong>老代码 / 跨编译器兼容仍用 void_t。<br><br><strong>实战陷阱</strong>：<br>① <strong>declval 不能用于求值</strong>—— 只能用在 unevaluated context（decltype / sizeof / noexcept 内）；外面用会 link error。<br>② void_t 检测的<strong>是<u>表达式合法性</u>不是行为正确性</strong>—— 有个 size() 函数但返回 string 仍然 has_size = true。要进一步检查可加 <code>std::enable_if_t&lt;std::is_integral_v&lt;decltype(...)&gt;&gt;</code>。<br>③ <strong>嵌套 void_t 多个 decltype</strong> 可以同时检测多个表达式（如要求类型同时有 begin() 和 end()）。<br><br><strong>真实案例</strong>：在 platform agent 实现一个 generic serializer，要检测类型是否有 <code>void serialize(Buffer&)</code> 成员。用 void_t + decltype 写了 3 行 detection idiom，C++14 兼容。C++20 升级后改用 concept HasSerialize，可读性 ↑↑↑。`,
      },
      failure_modes: [
        `不知道 void_t 在 SFINAE 中的角色 → 自己写复杂 enable_if`,
        `declval 在求值上下文用 → link error`,
        `void_t 检测后没进一步检查返回类型 → has_size 但实际类型错`,
        `不知道 C++20 concept 已经几乎完全替代 void_t`,
        `跟 partial specialization 组合时模板参数顺序错`,
      ],
      follow_ups: [
        { q: `declval 的实现？`, hint: `<code>template&lt;class T&gt; add_rvalue_reference_t&lt;T&gt; declval() noexcept;</code>—— 永不定义、不能调用、只能在 unevaluated context 中用；让你"假装有一个 T"用于类型计算` },
        { q: `怎么检测"成员函数返回特定类型"？`, hint: `void_t + std::is_same / std::convertible_to：<code>void_t&lt;std::enable_if_t&lt;std::is_same_v&lt;decltype(T{}.foo()), int&gt;&gt;&gt;</code>；C++20 concept 更简洁` },
        { q: `多个表达式同时检测？`, hint: `<code>void_t&lt;decltype(t.begin()), decltype(t.end())&gt;</code>—— 包多个，全部合法才 SFINAE pass；任何一个失败整体 fall back` },
      ],
    },

    183: {
      why_asked: `区分"会写模板"和"会调模板 bug"的关键。能讲清两阶段查找的人是真踩过"基类成员找不到"的坑。`,
      answers: {
        mid: `编译器解析模板分两阶段：<br>① <strong>定义时</strong>：解析<strong>非依赖名字</strong>（不依赖模板参数的）—— 如果有 typo / 错误直接报。<br>② <strong>实例化时</strong>：解析<strong>依赖名字</strong>（依赖于模板参数 T 的）—— 实例化时才查找。<br>这就是为什么访问基类成员要写 <code>this-&gt;</code> 或 <code>Base&lt;T&gt;::</code>。`,
        senior: `<strong>典型问题</strong>：<br><code>template&lt;class T&gt; class Derived : public Base&lt;T&gt; { void foo() { bar(); } };</code><br>—— 编译错 "bar() 未声明"。原因：bar() 在 Base&lt;T&gt; 里定义（依赖 T），但 Derived::foo() 解析时 "bar" 不是依赖名字（没看到 T） → 第一阶段不在依赖名字查找列表 → 编译器在 Derived 当前作用域 + 全局作用域找，找不到。<strong>修正</strong>：<br>① <code>this-&gt;bar();</code>（this 是依赖于 T 的 → 整个表达式变依赖名字）<br>② <code>Base&lt;T&gt;::bar();</code>（显式作用域）`,
        staff: `深一层：两阶段查找是 C++ 模板设计的<strong>"双刃剑"</strong>——① 优势：定义时就能查出大部分错误（不必每次实例化都重查），编译速度优化；② 劣势：跟<strong>名字查找 + ADL</strong>组合规则复杂，新人极难理解为什么"看起来应该找到的"没找到。<br><br><strong>什么是"依赖名字"</strong>：<br>· <code>T x;</code> —— T 依赖（模板参）<br>· <code>typename T::iterator it;</code> —— T::iterator 依赖<br>· <code>foo(t);</code> 当 t 是 T 类型 —— foo 通过 ADL 依赖<br>· 普通名字（非模板上下文出现）—— 非依赖<br><br><strong>typename 关键字</strong>：访问依赖名字的<strong>类型</strong>时必须写 typename（C++17 起部分场景可省，C++20 进一步减少）：<br><code>typename Base&lt;T&gt;::iterator it;</code> —— 没 typename 编译器不知道 iterator 是 type 还是 value。<br><br><strong>真实经验</strong>：移植一段 GCC 代码到 Clang 时，GCC 由于"宽松"两阶段查找（部分 GCC 版本 bug）让没写 this-&gt; 的代码也通过；Clang 严格 → 一堆 "bar() not declared" 错误。批量加 this-&gt; 后通过。<strong>对策</strong>：① 一律写 this-&gt; （即使 GCC 不强制，跨编译器统一）；② 类内 typedef 简化访问（typedef Base&lt;T&gt; B; B::bar() 比 Base&lt;T&gt;::bar() 短）。`,
      },
      failure_modes: [
        `继承模板基类调用基类成员忘 this-&gt; → "未声明"错误（典型新人题）`,
        `访问依赖类型忘 typename → 编译错 "expected ; before iterator"`,
        `跨编译器迁移时撞 GCC 宽松两阶段 bug`,
        `不理解为什么<strong>不依赖</strong>名字第一阶段就报错（重要的编译期保护）`,
        `用 using Base::bar; 没意识到也要写 typename 标记 type`,
      ],
      follow_ups: [
        { q: `怎么避免到处写 this-&gt;？`, hint: `① using Base&lt;T&gt;::bar; 在类内显式声明（一次写，到处用）；② typedef Base&lt;T&gt; B; 缩写；③ C++ Core Guidelines 推荐 using` },
        { q: `typename / template 关键字什么时候写？`, hint: `① 依赖名字的 <strong>type</strong> 用 typename；② 依赖名字的 <strong>template</strong> 用 template；典型：<code>typename T::template inner_template&lt;U&gt;</code>` },
        { q: `两阶段查找跟 ADL 的关系？`, hint: `第二阶段（实例化时）做依赖名字查找 + ADL；这就是为什么 namespace 内的友元函数（ADL only）只在实例化时被找到` },
      ],
    },

    // ============== 内存模型 / 并发 ==============
    77: {
      why_asked: `C++11 引入的关键概念，能背全 6 种 + 讲对场景的人有真实无锁编程经验。`,
      answers: {
        mid: `① <strong>relaxed</strong>: 仅原子保证，无同步；<br>② <strong>consume</strong>（历史，实际等价 acquire，C++26 deprecate）；<br>③ <strong>acquire</strong>: 之后的操作不能重排到本 load 之前；<br>④ <strong>release</strong>: 之前的操作不能重排到本 store 之后；<br>⑤ <strong>acq_rel</strong>: read-modify-write 同时具备；<br>⑥ <strong>seq_cst</strong>: 全局总序（默认，最贵）。`,
        senior: `<strong>典型用法</strong>：<br>· <strong>引用计数</strong>：fetch_add 用 relaxed（只是计数）；fetch_sub 用 acq_rel（防止析构时看不到别人对对象的写）；最后 == 0 时 acquire fence 后 delete。<br>· <strong>spinlock</strong>：acquire load 等待，release store 释放。<br>· <strong>双向 producer-consumer</strong>：release / acquire pair 同步。<br>· <strong>seq_cst</strong>：跨多个原子变量需要全局总序时（少用，开销大 2-10×）。`,
        staff: `深一层：memory order 是 C++ 跨硬件抽象——x86 默认<strong>强 ordered</strong>（acquire / release 几乎免费）；<strong>ARM / RISC-V 弱 ordered</strong>（需要显式 dmb / dsb 指令）；seq_cst 在 ARM 上代价显著。<br><br><strong>调优指南</strong>：<br>① 默认 seq_cst（写新代码时安全）；<br>② benchmark 后<strong>逐个原子</strong>降级到合适等级；<br>③ <strong>relaxed</strong>: 计数 / 统计 / 单调递增 ID；<br>④ <strong>acquire / release</strong>: 同步两个线程对某状态的"先写后读"（producer-consumer 经典 pair）；<br>⑤ <strong>seq_cst</strong>: 需要跨多个原子变量的全局序（如 Dekker 算法、双向同步）。<br><br><strong>真实经验</strong>：在低延迟项目实现 SPSC ring buffer，初版用 seq_cst → benchmark 单 op ~50 ns；改成 acquire/release pair → 10 ns；改成 head/tail 各自 cache line align + acq_rel → 6 ns。<strong>验证工具</strong>：① <strong>TSan</strong>（线程检查器）能识别 data race；② <strong>cppmem</strong>（在线工具）让你画 happens-before 图；③ <strong>perf c2c</strong> 看 cache 一致性流量。<strong>坑</strong>：① consume 历史上为了优化弱 order 平台引入，但所有主流编译器实现成 acquire（C++26 deprecate）；② <strong>memory_order_relaxed 不是"无屏障"</strong>—— 它保证原子操作不被分裂，但允许其他内存操作跨它重排；③ <strong>fence 跟 memory order on atomic 不等价</strong>—— fence 是"对所有内存"加屏障，atomic op 的 order 只对该原子和相关内存。`,
      },
      failure_modes: [
        `默认全用 seq_cst（性能浪费）/ 默认 relaxed（数据竞争）`,
        `release / acquire 没配对使用 → 同步失效`,
        `引用计数用 relaxed → 析构时看不到别人的写 → UB`,
        `认为 consume 有用 → 实际所有实现 fall back 到 acquire`,
        `测试只在 x86 跑 → 弱 order 平台上才暴露`,
      ],
      follow_ups: [
        { q: `怎么验证 memory order 正确？`, hint: `① TSan + 大量 fuzz；② cppmem 在线工具画 happens-before；③ ARM / Apple Silicon 上跑（暴露 x86 隐藏的问题）；④ rrlog / formal verification（TLA+）` },
        { q: `compiler fence 跟 hardware fence 区别？`, hint: `compiler fence (<code>std::atomic_signal_fence</code>) 只阻止编译器重排（生成代码顺序）；hardware fence (<code>std::atomic_thread_fence</code>) 同时阻止 CPU 乱序执行；x86 上后者部分免费，ARM 上代价高` },
        { q: `seq_cst 在 ARM 上真的慢吗？`, hint: `是。x86 上 acquire/release ≈ 普通 load/store；seq_cst store 需 mfence；ARM 上 acquire = ldar，release = stlr（专用指令），seq_cst load + store 都需要这两条；典型 seq_cst 比 acq_rel 慢 2-5× on ARM` },
      ],
    },

    78: {
      why_asked: `Happens-before 是 C++ 内存模型的"语言"。能解释 mutex / atomic / thread 各自如何建立 hb 的人理解到位。`,
      answers: {
        mid: `<strong>happens-before</strong> 是两个操作的<strong>偏序关系</strong>：A happens-before B → A 的所有效果对 B <strong>可见</strong>（不会重排到 B 之后）。<br>典型建立 hb 的方式：<br>① 同线程的<strong>程序顺序</strong>；<br>② mutex <strong>unlock → 后续 lock</strong>；<br>③ atomic <strong>release → 后续 acquire</strong>；<br>④ thread.start → 子线程的所有操作；<br>⑤ future <strong>set → 后续 get</strong>。`,
        senior: `<strong>关键</strong>：hb 是<strong>跨线程同步的唯一保证</strong>。如果两个线程之间没有 hb 链，那它们看到的内存修改可能<strong>任意乱序</strong>（即使在硬件上看起来"应该"先发生）。<strong>"data race"的定义</strong>：两个线程访问同一内存，至少一个是写，且没有 hb 关系 → UB。`,
        staff: `深一层：happens-before 是 C++ 内存模型的<strong>核心抽象</strong>—— 让程序员只关心"<strong>哪些操作之间有同步</strong>"而不关心 CPU 内存模型的细节（x86 vs ARM vs RISC-V）。<br><br><strong>具体建立方式</strong>：<br>① <strong>Sequenced-before</strong>: 同线程内 A; B; → A sb B（最强，几乎无重排空间）；<br>② <strong>Synchronizes-with</strong>: release-acquire pair / mutex unlock-lock / thread.start / future.get → A sw B；<br>③ <strong>Inter-thread-happens-before</strong>: sw 后的传递；<br>④ <strong>Happens-before</strong>: sb / itb 的并集。<br><br><strong>data race</strong>: 两线程 access 同一对象，至少一个 write，<strong>没有 hb 关系</strong> → <strong>UB</strong>（不是 race condition，UB 比 race condition 更严厉）。<br><br><strong>真实陷阱</strong>：① <strong>看起来"在 mutex 内"也可能 race</strong>—— 如果不同线程持有<strong>不同的 mutex</strong> 访问同一变量，没 hb；② <strong>atomic relaxed</strong> 不建立 hb（只保证原子性，不保证可见性）；③ <strong>fence + atomic relaxed</strong> 可以重建 hb（<code>std::atomic_thread_fence(memory_order_release)</code> + 后续 relaxed store；reader 用 relaxed load + fence acquire）。<br><br><strong>验证工具</strong>：① TSan 自动检测 race（没 hb 的 conflict access）；② cppmem 在线手动画 hb 图；③ <strong>正式验证</strong>（TLA+ / SPIN）针对关键无锁数据结构。`,
      },
      failure_modes: [
        `认为"两次操作都 atomic 就线程安全" → 不一定，需 hb 才能跨线程可见`,
        `跨 mutex 访问同一变量没意识到 race`,
        `relaxed atomic 操作期待跨线程可见（不建立 hb，只保原子性）`,
        `不知道 race 是 UB（部分人当 race condition 处理，其实 UB 更严）`,
        `没用 TSan 验证 / 仅在 x86 跑测试`,
      ],
      follow_ups: [
        { q: `sequenced-before vs happens-before？`, hint: `sb 是同线程程序顺序（最强）；hb 是 sb 的跨线程扩展（包括 synchronizes-with）；data race 定义用 hb 不用 sb` },
        { q: `Java / Go 的 hb 跟 C++ 区别？`, hint: `Java JMM 跟 C++ 内存模型类似但更简洁（JLS 17.4）；Go 也是 hb-based（"The Go Memory Model"）；C++ 由于 6 种 order 选择更灵活但更难` },
        { q: `没 hb 不一定 race，对吗？`, hint: `对——如果只读 / 不同地址 / 单线程，没 hb 也没问题。data race 定义需 ① 同址 ② 至少一写 ③ 无 hb 三者同时满足` },
      ],
    },

    79: {
      why_asked: `经典题，能讲清"控制块原子 / 对象本身不安全"两层语义的人理解扎实。`,
      answers: {
        mid: `多个线程可能同时拷贝 / 析构同一 shared_ptr → 计数读改写<strong>必须原子</strong>。<br><strong>但</strong> shared_ptr <strong>对象本身</strong>的赋值<strong>不是线程安全</strong>的（改对象指针 + 改控制块指针不是一个原子操作，C++20 起可用 std::atomic&lt;std::shared_ptr&gt; 解决）。`,
        senior: `<strong>shared_ptr 内部</strong>：① 一个指向<strong>对象</strong>的 raw ptr（typically 8 字节）；② 一个指向<strong>控制块</strong>的 raw ptr（控制块含 strong count + weak count）。<strong>引用计数原子是底层保证</strong>—— 但 shared_ptr <strong>对象本身</strong>包含两个指针的赋值不能原子（需要 16 字节 CAS，部分平台不支持）。<br><strong>线程安全性矩阵</strong>：<br>· 多线程<strong>读同一 shared_ptr</strong>（拷贝 / 销毁）→ 安全（引用计数原子）；<br>· 多线程<strong>读 / 写同一 shared_ptr 变量</strong>（赋值新值 / 重置）→ <strong>不安全</strong>（需要 std::atomic&lt;shared_ptr&gt; 或 shared_mutex）。`,
        staff: `深一层：shared_ptr 引用计数的<strong>memory order</strong> 优化是 libc++ / libstdc++ 高级技巧：<br>① fetch_add 用 <strong>relaxed</strong>（只是计数 +1，无同步语义）；<br>② fetch_sub 用 <strong>acq_rel</strong>（acquire 看到别人对对象的写，release 同步给最后释放者）；<br>③ 当 fetch_sub 返回 1 时（我是最后一个）→ acquire fence + delete。<br><br><strong>反例</strong>：如果计数 +1 也用 acq_rel，性能下降 ~30%（acquire 比 relaxed 慢）。Boost.atomic 早期就是因为这个不优化，被批评。<br><br><strong>真实经验</strong>：platform agent 早期用 <code>shared_ptr&lt;Config&gt; config_;</code> 让多线程 reader / writer 共享；reader 直接 <code>auto c = config_;</code>—— 同时有 writer 改 <code>config_ = new_config;</code> 时偶现段错（同一 shared_ptr 变量的多线程读写 race）。改用 <code>std::atomic&lt;std::shared_ptr&lt;Config&gt;&gt; config_;</code>（C++20）后修复，性能 -5%（atomic 操作开销）。<strong>陷阱</strong>：① 写代码时忘了 shared_ptr 不是"完全线程安全"；② <strong>多线程 weak_ptr.lock()</strong> 也涉及计数原子，安全；③ <strong>不能跨进程</strong>共享 shared_ptr（控制块在堆，进程间不共享）；④ <code>std::atomic&lt;std::shared_ptr&gt;</code> 实现 free 但可能内部用 spinlock（Apple Clang 早期实现）—— 性能比想象慢。<strong>替代方案</strong>：① <code>folly::AtomicSharedPtr</code> 性能最好（用 packed pointer）；② Hazard Pointer / RCU 在 hot path。`,
      },
      failure_modes: [
        `认为 shared_ptr 完全线程安全 → 多线程读写同一变量 → 段错`,
        `引用计数自己加 atomic 但用 seq_cst → 性能浪费`,
        `期待 shared_ptr 能跨进程（不能，控制块在堆）`,
        `复杂场景反复 lock weak_ptr → 性能差（应该考虑 hazard pointer / RCU）`,
        `不知道 C++20 std::atomic&lt;std::shared_ptr&gt;`,
      ],
      follow_ups: [
        { q: `weak_ptr 怎么实现？`, hint: `控制块多一个 weak count；weak_ptr 持控制块指针；lock() 时 CAS strong count（如果 &gt; 0 则 +1 返回 shared_ptr，否则返 nullptr）；weak count 用于决定何时释放控制块本身` },
        { q: `shared_ptr 的开销？`, hint: `① 8 字节 + 8 字节 = 16 字节 vs raw ptr 8 字节；② 拷贝：原子 +1 ~3-10 ns；③ 销毁：原子 -1，若 ==0 还要 delete object + 可能 delete 控制块；④ make_shared 把控制块跟对象一起分配（cache friendly）` },
        { q: `intrusive_ptr vs shared_ptr 区别？`, hint: `intrusive: 计数嵌在对象本身（boost::intrusive_ptr）；优点 ① 16 字节 → 8 字节；② 单次 alloc；③ 可从 raw ptr 重建；缺点 ① 类型必须改；② 弱 ptr 难实现` },
      ],
    },

    80: {
      why_asked: `性能优化题，能讲 cache line + MESI 协议 + alignas 解法的人有实际并发性能调优经验。`,
      answers: {
        mid: `两个<strong>不同变量</strong>被<strong>不同线程</strong>读写，但恰好<strong>在同一 cache line</strong>（典型 64 字节）→ CPU 缓存一致性协议（MESI）让 cache line 在核间反复传输 → <strong>性能暴跌</strong>。<br><strong>解法</strong>：<strong>cache line 对齐</strong>—— <code>alignas(64)</code> 或 <code>std::hardware_destructive_interference_size</code>（C++17）。`,
        senior: `<strong>典型场景</strong>：<br>① <strong>SPSC ring buffer</strong> 的 head 和 tail：producer 写 tail / consumer 写 head → 同 cache line → 互相 invalidate 对方的 cache → 性能 -80%；<br>② <strong>分线程计数</strong>：<code>std::array&lt;int, N&gt; counts;</code>，每个线程更新自己的 counts[tid] → 都在同一 cache line → 实际并发性能跟单线程一样；<br>③ <strong>mutex 数组</strong>：<code>std::vector&lt;std::mutex&gt; locks;</code> 但 mutex 小（typically 40 字节）→ 多个 mutex 在同 cache line → 加锁互相 invalidate。<br><br><strong>解法</strong>：<code>struct alignas(64) PaddedCounter { std::atomic&lt;int&gt; value; };</code>—— 强制 64 字节对齐 + 占满 cache line。`,
        staff: `深一层：false sharing 是<strong>"代码看起来无 race，性能却像有 race"</strong> 的隐藏 bug。<strong>检测困难</strong>：① 看不出来（代码逻辑正确）；② benchmark 才发现性能不对；③ <strong>profiling 工具</strong>能定位：Linux <code>perf c2c</code>（cache-to-cache 流量）/ Intel VTune（HITM Stage）。<br><br><strong>真实经验</strong>：在 platform agent 实现一个 SPSC ring buffer，初版结构 <code>struct Queue { atomic&lt;size_t&gt; head; atomic&lt;size_t&gt; tail; T data[N]; };</code>—— 单线程 baseline 12M ops/s，启 2 线程后只有 1.5M ops/s（producer / consumer 同时活动反而慢 8 倍）。<br><strong>原因</strong>：head 和 tail 在同 cache line → MESI 在 2 个核之间 ping-pong。<br><strong>修正</strong>：<code>struct Queue { alignas(64) atomic&lt;size_t&gt; head; char pad[64]; alignas(64) atomic&lt;size_t&gt; tail; ... };</code>—— 强制两者各占独立 cache line。2 线程性能 → 18M ops/s，提升 12×。<br><br><strong>std::hardware_destructive_interference_size</strong>（C++17）：标准提供的 cache line 大小常量（typical 64，但 M1 上 128）。比 hardcoded 64 更 portable。<strong>反义</strong>：<code>std::hardware_constructive_interference_size</code>—— 同访问的数据应该放在同 cache line（如配对 head + 数据指针），减少 cache miss。<strong>实战建议</strong>：① 性能敏感的多线程数据结构必须考虑 false sharing；② 用 alignas + std::hardware_destructive_interference_size；③ perf c2c 是 Linux 上的最佳工具；④ Apple Silicon M1/M2 cache line 是 128 字节（不是 64），跨平台代码用标准常量。`,
      },
      failure_modes: [
        `多线程 counter / stats 用 vector<int> 不加 padding`,
        `SPSC / MPMC queue head / tail 不对齐`,
        `mutex 数组 / 锁池没考虑 mutex size 跟 cache line 关系`,
        `hardcoded 64 字节对齐不 portable（M1 是 128）`,
        `性能问题不用 perf c2c 排查 → 凭感觉乱改`,
      ],
      follow_ups: [
        { q: `perf c2c 怎么用？`, hint: `<code>perf c2c record ./prog; perf c2c report</code>—— 报告显示 HITM 高的 cache line，定位 false sharing 源；Linux 4.10+，需要 perf_events 权限` },
        { q: `false sharing 跟 true sharing 区别？`, hint: `false: 不同变量在同 cache line（可避免，加 padding 即可）；true: 真的访问同一变量（不可避免，是数据结构本身问题，要重新设计）` },
        { q: `Apple Silicon / ARM 上 cache line 是？`, hint: `M1/M2 是 128 字节（双 cache line interleaving）；ARMv8 一般 64 但实现各异；用 <code>std::hardware_destructive_interference_size</code> 或 <code>sysconf(_SC_LEVEL1_DCACHE_LINESIZE)</code> 运行时查` },
      ],
    },

    81: {
      why_asked: `具体场景的 memory order 应用题。能讲清 add_ref relaxed / release acq_rel 的人是真做过引用计数实现。`,
      answers: {
        mid: `① <strong>add_ref</strong>（拷贝时 +1）用 <strong>relaxed</strong> —— 只是计数，无同步需求。<br>② <strong>release</strong>（析构时 -1）用 <strong>acq_rel</strong> —— acquire 看到别人对对象的写（防止 reorder 后看不到），release 同步给最后释放者。<br>③ 当 fetch_sub 返回 1（我是最后一个）→ delete object。`,
        senior: `<strong>完整代码</strong>：<br><code>void add_ref() { count_.fetch_add(1, std::memory_order_relaxed); }</code><br><code>void release() {</code><br><code>    if (count_.fetch_sub(1, std::memory_order_acq_rel) == 1) {</code><br><code>        delete this;</code><br><code>    }</code><br><code>}</code><br><br><strong>更进一步优化</strong>（Boost / libc++ 用）：fetch_sub 用 release，最后释放者额外做 acquire fence：<br><code>if (count_.fetch_sub(1, std::memory_order_release) == 1) {</code><br><code>    std::atomic_thread_fence(std::memory_order_acquire);</code><br><code>    delete this;</code><br><code>}</code><br>—— 这样<strong>普通 release</strong>更便宜（多数情况），只在最后一个需要 acquire。`,
        staff: `深一层：这种"<strong>relaxed add / release+acquire-fence delete</strong>"模式是 Boost.Atomic / libstdc++ shared_ptr 等成熟实现的标准做法。<br><br><strong>为什么 add_ref 用 relaxed 够</strong>：① 我们只是 +1 计数，没修改对象本身；② 拷贝完毕的 shared_ptr 已经持有 strong reference，对象不会消失；③ 我们不需要"看到"别人的写（add 操作和对象内容无关）。<br><br><strong>为什么 release 用 acq_rel（或 release + fence）</strong>：① <strong>release</strong>：让我之前对对象的所有修改对最后释放者可见（"我刷新到对象"）；② <strong>acquire</strong>：让我看到别人的所有修改（"避免 use-after-free with stale view"）。如果两者都用 release，最后一个 delete 时可能看不到别人对对象的 partial write → 析构时 UB。<br><br><strong>真实经验</strong>：写一个简化的 intrusive_ptr，初版 add / release 都用 seq_cst → micro-benchmark 单次 op ~25 ns。改成 relaxed add / acq_rel release → 15 ns。再改成 relaxed / release + 最后 acquire fence → 12 ns。生产 hot path 累积影响显著。<strong>验证</strong>：① TSan 跑大规模拷贝 / 析构场景 race-free；② <strong>delete-twice</strong> 必检测（用 ASan）。<strong>更高级</strong>：<strong>Hazard Pointer</strong>（不需要 strong count，纯 weak）和 <strong>RCU</strong>（读端零开销）在极高并发下击败引用计数；但实现复杂度高 10×。`,
      },
      failure_modes: [
        `add_ref 用 acq_rel（不必要的同步，慢）`,
        `release 用 relaxed → 最后 delete 看不到别人的写 → UB`,
        `release 用 release 但忘了 acquire fence → 同上问题`,
        `用 seq_cst 全部 → 性能浪费 30%+`,
        `没用 ASan 验证 double-delete / use-after-free`,
      ],
      follow_ups: [
        { q: `为什么不能 add_ref 用 release？`, hint: `add_ref 不修改对象，没什么要"刷新到对象"的；用 release 是多余的同步开销；relaxed 在 x86 上零开销，ARM 上比 release 便宜` },
        { q: `weak_ptr 引用计数怎么实现？`, hint: `控制块有两个 count：strong + weak；weak_ptr 增减 weak count（同样 relaxed / acq_rel pattern）；lock() 时 CAS strong count（若 &gt; 0 则 +1 返回 shared_ptr）` },
        { q: `什么时候用 Hazard Pointer 替代引用计数？`, hint: `① 极高并发读 + 偶尔写（如配置热加载）；② 引用计数的 cache line 竞争成为瓶颈；③ 需要无锁；代价：实现复杂、内存使用更高（每读者一个 hazard slot）` },
      ],
    },

    84: {
      why_asked: `性能直觉题。能讲清"shared_mutex 实现复杂自身开销大"的人是 benchmark 过的。`,
      answers: {
        mid: `<strong>不一定</strong>。shared_mutex 实现复杂，自身 lock / unlock 开销 ~<strong>5×</strong> 普通 mutex。<strong>临界区极短</strong>时，"shared_mutex 自身开销 &gt; 节省的等待时间" → <strong>反而慢</strong>。适合：<strong>读多写少 + 临界区不极短</strong>。`,
        senior: `<strong>具体数字</strong>（典型 Linux x86_64）：<br>· <code>std::mutex</code> uncontended lock+unlock: ~25 ns<br>· <code>std::shared_mutex</code> uncontended lock+unlock: ~50 ns（shared）/ ~120 ns（exclusive）<br><br><strong>转折点</strong>：当临界区耗时 &lt; 100 ns，shared_mutex 自身开销占比 &gt; 50%，没有性能优势。<strong>判断方法</strong>：① <strong>临界区微秒级</strong>（&gt; 1us）+ <strong>读 / 写比 &gt; 10:1</strong> → shared_mutex 有意义；② 否则用 std::mutex。`,
        staff: `深一层：shared_mutex 的<strong>替代方案</strong>：<br>① <strong>std::mutex + 复制读快照</strong>：写端拿锁改 + 替换 ptr；读端 atomic load 当前 ptr。读端零开销，<strong>RCU-lite</strong> 模式。<br>② <strong>RW spinlock</strong>（自己实现）：底层用 atomic + compare-exchange，单 op ~10 ns，但只适合<strong>极短临界区</strong>，且竞争激烈时浪费 CPU。<br>③ <strong>RCU (Read-Copy-Update)</strong>：读端 <strong>零开销</strong>（毫秒级 grace period 后回收），适合极高读吞吐；实现复杂，userspace-rcu 库。<br>④ <strong>seqlock</strong>：读端无锁（用版本号检测中途被改）；适合数据小、读频繁；不适合可变长数据。<br><br><strong>真实经验</strong>：platform agent 的"设备配置缓存"早期用 shared_mutex，<strong>1k reader 线程 + 1 writer / 秒</strong>下，profile 显示 shared_mutex.lock_shared 占 12% CPU。改用 <code>std::atomic&lt;std::shared_ptr&lt;Config&gt;&gt;</code> + writer 替换 ptr（RCU-lite）后，reader 端零锁开销，CPU 降到 1%。<strong>判断指南</strong>：<br>① 临界区<strong>纳秒级</strong> → std::mutex（avoid 复杂性）；<br>② <strong>读远多于写 + 临界区微秒级</strong> → shared_mutex；<br>③ <strong>读极多 + 数据可拷贝</strong> → atomic ptr + 写端 RCU-style 替换；<br>④ <strong>读 hot path 极致延迟</strong> → seqlock / Hazard Pointer / RCU。<strong>陷阱</strong>：① shared_mutex 默认<strong>非递归</strong>，writer-then-reader 同一线程 deadlock；② <code>std::shared_lock</code> 和 <code>std::unique_lock</code> 都要 RAII，混用易错；③ 写端饥饿（reader 持续来时 writer 永远拿不到）需要 fair 实现。`,
      },
      failure_modes: [
        `无脑用 shared_mutex "读多写少应该用 RW lock"（没量化临界区时长）`,
        `临界区纳秒级用 shared_mutex（自身开销超过省的时间）`,
        `没用 atomic ptr + replace 替代方案（更快）`,
        `没意识到 writer 饥饿风险（默认实现）`,
        `同线程 unique_lock 后 shared_lock → 不是 recursive → deadlock`,
      ],
      follow_ups: [
        { q: `RCU 怎么工作？`, hint: `① 读端：进入 critical section（typically 仅设线程本地标志）；② 写端：复制数据 → 改副本 → atomic 替换指针；③ 等所有当前 reader 退出（grace period）→ 回收老数据；读端开销 ~ atomic load，写端贵但少` },
        { q: `seqlock 怎么实现？`, hint: `① 写端：seq 偶 → 奇（lock）→ 改 → 奇 → 偶（unlock）；② 读端：read seq_before → load data → read seq_after → if (before != after || before % 2) retry；适合<strong>少量数据 + 读频繁</strong>` },
        { q: `公司里见过的 shared_mutex 误用？`, hint: `① 所有 getter 都加 lock_shared（每次都拿锁）→ 临界区只读取一个指针，开销 &gt; 操作；正解：atomic ptr 或一次锁后传 data 出去；② writer 数量 ~ reader，shared_mutex 仅有微弱优势` },
      ],
    },

    86: {
      why_asked: `经典并发题。能讲多种方法（顺序 / scoped_lock / 层次锁 / 减粒度）的人有真实死锁经验。`,
      answers: {
        mid: `① <strong>所有线程按同一顺序拿锁</strong>（最简单）；<br>② 多锁同时用 <strong>std::scoped_lock</strong>（C++17）或 std::lock + adopt_lock；<br>③ <strong>锁层次</strong>（HierarchicalMutex）—— 每个 mutex 标 level，禁止从低 level 拿到高 level；<br>④ 锁粒度<strong>尽量小</strong>；<br>⑤ <strong>不持锁调用未知代码</strong>（用户回调 / 虚函数 / 跨模块调用）。`,
        senior: `<strong>std::scoped_lock 原理</strong>：内部用 <code>std::lock(m1, m2, ...)</code>，使用<strong>避免死锁算法</strong>（典型 try-and-back-off）—— 拿不到一个就释放所有再重试。<strong>关键</strong>：保证<strong>多个 mutex 同时拿</strong>，避免"拿 A 等 B / 拿 B 等 A" 的循环等。<br><br><strong>HierarchicalMutex</strong>: 给每个 mutex 一个 level（如 100 / 200 / 300）；线程拿锁时检查"已持有的最高 level" — 新锁 level 必须更低，否则 throw。强制<strong>编译期 / 运行期检测</strong>违反顺序。`,
        staff: `深一层：死锁的<strong>4 个必要条件</strong>（Coffman 1971）：互斥 / 持有并等待 / 不剥夺 / 循环等待。<strong>破坏任一即可</strong>—— 实践中通常破坏"循环等待"（按顺序 / 层次）或"持有并等待"（lock-free 或 try_lock with timeout）。<br><br><strong>实战 4 类死锁场景</strong>：<br>① <strong>多 mutex 不同顺序</strong>（最经典）→ scoped_lock / 顺序约定；<br>② <strong>嵌套调用</strong>（A 持锁调 B，B 也想锁）→ 减小临界区，调外部函数前 unlock；<br>③ <strong>RAII + 异常</strong>—— 析构期间锁未释放（应该不会发生，但 mutex impl 有 bug 时可能）；<br>④ <strong>condition variable 误用</strong>—— spurious wakeup 没检查条件 → 拿锁但条件不满足 → 一直持锁等。<br><br><strong>真实经验</strong>：platform agent 早期有一段代码：<code>void Service::reconfigure() { std::lock_guard a(this-&gt;mu); subscriber-&gt;notify(); }</code>—— subscriber-&gt;notify() 回调用户代码，用户代码回调 Service 的另一方法 → reentrant lock → deadlock（std::mutex 非递归）。<strong>修正</strong>：1) 在临界区外调 notify（先拿数据 → unlock → notify）；2) subscriber 持自己锁，独立 lock graph。死锁修复后做了<strong>静态检查</strong>：clang-tidy 的 <code>concurrency-*</code> 系列检查 + 自己写了一个 lock acquisition graph 工具（识别 cycle）。<strong>检测</strong>：① <strong>TSan</strong> 自动检测 lock order inversion；② <strong>HelGrind</strong>（Valgrind）类似；③ <strong>perf trace + ltrace</strong> 记录 lock 序列。<strong>工程建议</strong>：① 写 mutex 时<strong>注释 lock 层次</strong>；② 避免在 callback / virtual / 用户代码内持锁；③ 用 try_lock with timeout 防止永久死锁（超时 abort + log）。`,
      },
      failure_modes: [
        `多 mutex 不同顺序（A→B vs B→A）`,
        `在持锁状态调用 callback / virtual / 用户代码（可能重入或多 lock graph）`,
        `RAII 锁但忘了异常导致的特殊路径（不应该有，但实现 bug 可能）`,
        `不用 scoped_lock，手动 std::lock + adopt_lock 写错（顺序 / 异常）`,
        `不知道 std::mutex 非递归 → 同线程二次 lock 直接 deadlock`,
      ],
      follow_ups: [
        { q: `怎么检测潜在 lock order inversion？`, hint: `① TSan / HelGrind 动态检测；② clang-thread-safety-analysis 静态检查（需注解）；③ 自己写 lock graph + cycle detection；④ FreeBSD 的 WITNESS 内核机制启发的工具` },
        { q: `recursive_mutex 是不是解决方案？`, hint: `不是<strong>真正</strong>方案——它只解决"同线程同 mutex 多次 lock"，不解决跨线程死锁。而且使用 recursive 通常意味着代码组织不清晰（应该重构而不是用 recursive_mutex）` },
        { q: `lock-free 完全没死锁吗？`, hint: `lock-free 算法没<strong>传统死锁</strong>，但有 <strong>livelock</strong>（多线程一直 retry CAS 都不成功）和 <strong>priority inversion</strong>（高优先级等低优先级完成）；trade-off 不一样` },
      ],
    },

    87: {
      why_asked: `手写题。能讲 packaged_task / future / 异常透传完整的人是真做过通用线程池库。`,
      answers: {
        mid: `<strong>核心机制</strong>：① 用 <code>std::packaged_task&lt;R()&gt;</code> 包装 callable，自动捕获异常到 future；② submit 模板返 <code>future&lt;invoke_result_t&lt;F, Args...&gt;&gt;</code>；③ 用 <code>shared_ptr&lt;packaged_task&gt;</code> 让 lambda 能拷贝（packaged_task 不可拷贝只可 move）；④ 用 <code>std::apply</code> + tuple 实现完美转发。`,
        senior: `<strong>骨架代码</strong>：<br><code>template&lt;class F, class... Args&gt;</code><br><code>auto submit(F&amp;&amp; f, Args&amp;&amp;... args)</code><br><code>    -&gt; std::future&lt;std::invoke_result_t&lt;F, Args...&gt;&gt; {</code><br><code>    using R = std::invoke_result_t&lt;F, Args...&gt;;</code><br><code>    auto task = std::make_shared&lt;std::packaged_task&lt;R()&gt;&gt;(</code><br><code>        [f = std::forward&lt;F&gt;(f), tup = std::make_tuple(std::forward&lt;Args&gt;(args)...)] () mutable {</code><br><code>            return std::apply(std::move(f), std::move(tup));</code><br><code>        }</code><br><code>    );</code><br><code>    auto fut = task-&gt;get_future();</code><br><code>    {</code><br><code>        std::lock_guard lg(mu_);</code><br><code>        queue_.push_back([task]() { (*task)(); });</code><br><code>    }</code><br><code>    cv_.notify_one();</code><br><code>    return fut;</code><br><code>}</code>`,
        staff: `深一层：完整线程池要处理：<br>① <strong>shutdown / drain</strong>：要 atomic stop 标志 + drain 已 submit task；<br>② <strong>worker error</strong>：worker 内 task 抛异常 → packaged_task 自动捕获到 future，但 worker 本身不应该 propagate（继续处理下一个 task）；<br>③ <strong>队列满</strong>：bounded queue + 背压策略（block / reject / discard）；<br>④ <strong>动态 thread count</strong>：根据 load 增减；<br>⑤ <strong>priority</strong>：multi-queue 或 heap。<br><br><strong>真实经验</strong>：platform agent 早期用 <code>std::async</code>（每次启动新 thread），10k 任务 / 秒时 thread 创建 overhead 占 30%。换成线程池后单线程开销 ~5%。后来发现仍不够，引入<strong>分类线程池</strong>：① IO-bound pool（多 thread，高 idle）；② CPU-bound pool（thread = cores）；③ Latency-critical pool（pin to cores + huge page）。<br><br><strong>陷阱</strong>：① <strong>packaged_task 必须传 lambda 可拷贝形式</strong>—— shared_ptr 包一层；② <strong>tuple 完美转发参数</strong>，否则 reference / move 丢失；③ <strong>future 析构</strong>—— async future 析构会阻塞等 task 完成（async 特殊语义），packaged_task 不会；④ <strong>worker 数量</strong>—— CPU-bound = cores；IO-bound = cores × 2-4。<strong>开源参考</strong>：① <code>folly::CPUThreadPoolExecutor</code>（Facebook）；② <code>BS::thread_pool</code>（轻量 header-only）；③ <code>asio::thread_pool</code>。生产推荐 folly / asio，不要自己写。`,
      },
      failure_modes: [
        `packaged_task 不包 shared_ptr → 不能拷贝 → 编译错`,
        `参数没用 tuple + forward → reference 失效`,
        `worker 不 try/catch → task 异常导致整 worker 退出`,
        `shutdown 不 drain → 未完成 task 丢失`,
        `bounded queue 不实现背压策略 → 内存爆`,
      ],
      follow_ups: [
        { q: `如果不想要 future 怎么办？`, hint: `① fire-and-forget 模式：直接 push 一个 lambda 到 queue，不返回 future；② 错误处理：lambda 内 try/catch + log；③ 性能：少一次 future + state 同步` },
        { q: `怎么实现 priority 线程池？`, hint: `① 多 queue（high / normal / low），worker 按优先级取；② std::priority_queue + cv 等待最高优先；③ Lock-free priority queue（复杂，typically Boost.Lockfree） ` },
        { q: `线程池 vs 协程 vs std::async 怎么选？`, hint: `① CPU-bound + 已知工作量：线程池；② IO-bound + 大量并发：协程（C++20）或事件循环；③ 一次性异步：async（但每次启 thread 开销大，不推荐）` },
      ],
    },

    89: {
      why_asked: `经典手写题。能讲清楚 close 处理 + drain + cv pair 三个细节的人是真做过。`,
      answers: {
        mid: `<strong>核心组件</strong>：queue + mutex + cv_not_full + cv_not_empty + closed flag。<br>· <strong>push</strong>: 满 → cv_not_full.wait；closed → return false。<br>· <strong>pop</strong>: 空 → cv_not_empty.wait；closed + drained → 返 nullopt。<br>· <strong>close</strong>: 唤醒所有等待者。`,
        senior: `<strong>骨架代码</strong>：<br><code>class BoundedQueue&lt;T&gt; {</code><br><code>    std::queue&lt;T&gt; q_;</code><br><code>    std::mutex mu_;</code><br><code>    std::condition_variable not_full_, not_empty_;</code><br><code>    const size_t cap_;</code><br><code>    bool closed_ = false;</code><br><code>public:</code><br><code>    bool push(T x) {</code><br><code>        std::unique_lock lk(mu_);</code><br><code>        not_full_.wait(lk, [&amp;]{ return q_.size() &lt; cap_ || closed_; });</code><br><code>        if (closed_) return false;</code><br><code>        q_.push(std::move(x));</code><br><code>        not_empty_.notify_one();</code><br><code>        return true;</code><br><code>    }</code><br><code>    std::optional&lt;T&gt; pop() {</code><br><code>        std::unique_lock lk(mu_);</code><br><code>        not_empty_.wait(lk, [&amp;]{ return !q_.empty() || closed_; });</code><br><code>        if (q_.empty()) return std::nullopt;  // closed + drained</code><br><code>        T x = std::move(q_.front()); q_.pop();</code><br><code>        not_full_.notify_one();</code><br><code>        return x;</code><br><code>    }</code><br><code>    void close() {</code><br><code>        { std::lock_guard lg(mu_); closed_ = true; }</code><br><code>        not_full_.notify_all(); not_empty_.notify_all();</code><br><code>    }</code><br><code>};</code>`,
        staff: `深一层：实现的<strong>关键正确性陷阱</strong>：<br>① <strong>spurious wakeup</strong>：cv 的 predicate 必须在 lambda 里检查（不能 if + wait）；<br>② <strong>close + drain</strong>：closed 但 queue 还有数据时，pop 应继续返回 data（不能立即 return null）；<br>③ <strong>notify_all on close</strong>：必须 wake all waiters（push 端和 pop 端都可能在等）；<br>④ <strong>双向背压</strong>：not_full 和 not_empty 两个 cv，避免一个 cv 唤醒所有线程（产生惊群效应）；<br>⑤ <strong>异常安全</strong>：T 的拷贝 / 移动可能抛 → push 失败时 queue 状态保持一致。<br><br><strong>性能优化</strong>：<br>① <strong>批量 push / pop</strong>：减少 cv notify 次数（10x 吞吐）；<br>② <strong>无锁 SPSC / MPSC</strong>：单消费者场景用 lock-free ring buffer（10-100x 性能）；<br>③ <strong>分片 queue</strong>：高并发下 1 个 mutex 是瓶颈，分多个 sub-queue + 哈希。<br><br><strong>真实经验</strong>：platform agent 的 event queue 早期用上面这种 BoundedQueue，10k events/s 时 CPU 15%。改用<strong>Disruptor 风格</strong>（ring buffer + sequence + busy-wait）后，100k events/s 时 CPU 仍 15%。但 Disruptor 实现复杂、busy-wait 占核 → 视场景选择。<strong>替代</strong>：moodycamel::ConcurrentQueue（MPMC lock-free）、Boost.Lockfree、folly::MPMCQueue。`,
      },
      failure_modes: [
        `cv 用 if 不用 while / lambda → spurious wakeup 漏掉`,
        `close 不 drain → 已 push 的数据丢失`,
        `close 用 notify_one 不 notify_all → 部分线程永远阻塞`,
        `单 cv 处理 not_full + not_empty → 惊群效应（不必要的 wake）`,
        `unique_lock 持有时间过长 → 退化为单线程`,
      ],
      follow_ups: [
        { q: `bounded vs unbounded queue 怎么选？`, hint: `① bounded：自然背压，内存可控；② unbounded：吞吐稍高但 OOM 风险；③ 99% 生产场景应该 bounded（设大 capacity 而不是 unbounded）` },
        { q: `怎么实现 timed wait？`, hint: `① <code>cv.wait_for(lk, timeout, predicate)</code>；② 返 bool（true = predicate satisfied，false = timeout）；③ 业务层用于 retry / give up` },
        { q: `lock-free ring buffer 跟 BoundedQueue 怎么选？`, hint: `① 简单场景 + 中低吞吐 → BoundedQueue（25 行实现，bug 少）；② 高吞吐 + 临界区极短 → lock-free ring buffer（10-100x 但实现复杂）；先 benchmark 验证瓶颈再选` },
      ],
    },

    90: {
      why_asked: `生产场景必备。能讲 drain / signal / jthread 完整 4 步的人是做过真实服务运维。`,
      answers: {
        mid: `<strong>4 步</strong>：① <strong>停止接受</strong>新连接 / 任务；② <strong>drain</strong> 已接受任务（有 timeout）；③ <strong>关闭</strong>连接 / 释放资源；④ 用 <code>std::jthread</code>（C++20）<strong>自动 join</strong>。<br>触发：信号驱动（SIGTERM）→ atomic flag → 主循环检测。`,
        senior: `<strong>完整实现要点</strong>：<br>① <strong>signal handler</strong>：信号上下文里只设 atomic flag（不能调复杂代码 / malloc / log）；<br>② <strong>主循环</strong> select / epoll 调 with timeout → 检查 flag → 进入 shutdown 流程；<br>③ <strong>新连接 reject</strong>：accept 后立即 close（或不再 accept）；<br>④ <strong>已 connect</strong>：发 "service shutting down" 响应 + close；<br>⑤ <strong>已 dispatched 任务</strong>：等其完成 with timeout（如 30s）；timeout 后强行 abort；<br>⑥ <strong>资源释放</strong>：DB connection / file handle / shared memory 等；<br>⑦ <strong>worker join</strong>：用 jthread 自动管理。`,
        staff: `深一层：优雅停服的<strong>哲学</strong>是"<strong>让客户端有时间感知 + 已 in-flight 请求安全完成</strong>"，而不是"<strong>立即停</strong>"。<br><br><strong>真实经验</strong>：platform agent 的优雅停服设计：<br>1) <strong>SIGTERM</strong> 到达 → main thread 检测 atomic flag → 进入 draining 状态；<br>2) <strong>HTTP API</strong>：health-check 改返 503（让 load balancer 把流量切走，<strong>这是关键</strong>—— LB 切流 typical 5-10s）；<br>3) <strong>等 15s</strong>（等 LB 完全切走 in-flight 流量）；<br>4) <strong>Sessions</strong>：发送 close-session 给所有 active session 并等 ack（with 5s timeout）；<br>5) <strong>worker 池</strong>：停止接受新 task，等 drain 完成（30s timeout，超时强 abort）；<br>6) <strong>数据库 / 缓存连接</strong>：commit 未提交事务 + flush；<br>7) <strong>jthread 自动 join</strong>。<br><br><strong>总 timeout</strong>: ~60s（k8s default 30s 不够，调到 120s）。<br><br><strong>陷阱</strong>：① <strong>signal handler async-signal-safe</strong> 限制非常严（只能调一小撮函数，不能 malloc / printf）—— 错误做法直接死锁；② <strong>worker 卡在 IO</strong>：close 后 read/write 触发 EBADF → drain 正常进行；③ <strong>k8s grace period</strong>：terminationGracePeriodSeconds 默认 30s，比应用 shutdown 时间长才有意义；④ <strong>connection draining</strong>：HTTP/1.1 有 Connection: close header；HTTP/2 有 GOAWAY；RPC 有 close-session。<strong>C++20 jthread</strong>：自动 RAII join + 提供 stop_token / stop_source 替代手动 atomic flag；推荐新代码用。`,
      },
      failure_modes: [
        `signal handler 调 malloc / printf / mutex（async-signal-unsafe）→ deadlock / 崩`,
        `不 drain in-flight 请求 → client 看到 500 / connection reset`,
        `没有 timeout → drain 卡死等不响应的客户端`,
        `worker 直接 join 不 set flag → 卡在 read/write`,
        `k8s grace period 短于应用 shutdown → SIGKILL 强杀 → 数据丢失`,
      ],
      follow_ups: [
        { q: `signal handler 可以调什么？`, hint: `async-signal-safe 函数：write / abort / _exit / sigaction 等；<strong>不能</strong>: malloc / printf / mutex / fopen / 90% 的标准库函数；POSIX 列表见 signal-safety(7)` },
        { q: `怎么从 signal handler 通知主线程？`, hint: `① 设 atomic flag，主循环轮询；② signalfd（Linux）让信号变 fd 可在 epoll 等待；③ pipe self-pipe trick：handler 写 pipe，epoll wait 收到` },
        { q: `jthread 的 stop_token 怎么用？`, hint: `① stop_token 传给 thread function；② thread 内定期 stop_requested() 检测；③ 析构 / request_stop 触发 stop_token；④ 替代 atomic stop flag，标准化模式` },
      ],
    },

    // ============== 异常 ==============
    64: {
      why_asked: `异常 ABI 题。能讲清"不抛零开销 + 抛时高代价"的人理解 LSDA / unwind table。`,
      answers: {
        mid: `指<strong>不抛时无运行时代价</strong>—— 编译器把 unwind table 存在 <code>.eh_frame</code> / <code>.gcc_except_table</code> 等<strong>只读段</strong>，正常代码路径不读它们。<br><strong>一旦真抛</strong>：~1-100 µs（分配异常对象 + 栈展开 + LSDA 表查找）。`,
        senior: `<strong>具体机制</strong>：① 编译器为每个 throw 点 / catch 块生成<strong>额外元数据</strong>（unwind information），存在二进制独立 section；② 正常 code path 完全不 touch 这些数据；③ 抛异常时 <code>libgcc_eh.a</code> / <code>libunwind</code> 库走<strong>双阶段算法</strong>：phase 1 找 handler，phase 2 实际 unwind 调用所有局部对象析构。<strong>性能数字</strong>：抛 + catch 一次 typical 1-10 µs（小函数）；大函数 / 跨多帧可达 100 µs。`,
        staff: `深一层：C++ 异常的<strong>"零开销"哲学</strong>有 trade-off：① <strong>二进制 size 增加</strong> 5-15%（eh_frame 元数据）；② <strong>编译时间略增</strong>（生成额外信息）；③ <strong>真抛时不快</strong>（不适合 hot path 控制流）。<br><br><strong>对比方案</strong>：<br>· <strong>error_code（C++03 / Boost.System）</strong>：返回 int / enum，每次 check；编译期可推断，hot path 友好，但代码可读性差；<br>· <strong>std::expected&lt;T, E&gt;（C++23）</strong>：返回值/错误二选一，monadic ops；可读性接近异常，性能跟 error_code；<br>· <strong>std::error_code + std::system_error</strong>：跨 lib 错误码统一；<br>· <strong>Result&lt;T, E&gt; (Rust style)</strong>：编译期强制处理错误。<br><br><strong>实战决策</strong>：<br>① <strong>构造失败 / 资源耗尽</strong> → 异常（无返回值可用）；<br>② <strong>预期错误（如 file not found / parse fail）</strong> → expected / error_code；<br>③ <strong>性能极致路径</strong> → 完全不用异常（noexcept 全部 + error_code）；<br>④ <strong>跨 ABI 边界（C ABI / .so）</strong> → 不用异常（异常不能跨 C ABI）。<br><br><strong>真实经验</strong>：platform agent core 经过 profiling，把 <strong>parse error</strong> 类异常改成 std::expected → throughput +12%（parse error 在合法输入下也偶尔触发，原本异常 1k/s + 100µs each = 100ms/s 浪费）。<strong>真异常路径</strong>（如 OOM / 程序员 bug）保留异常，因为 cold path 无所谓性能。`,
      },
      failure_modes: [
        `用异常做控制流（loop break / state machine 切换）→ hot path 慢 1000×`,
        `跨 ABI 边界（.so / C ABI）让异常逃逸 → UB`,
        `nothrow new 仍写 try/catch（new 不抛只返 nullptr）→ catch 永不到`,
        `noexcept 函数内调可能抛的代码 → std::terminate`,
        `不用 std::expected（C++23）/ error_code → 一切错误都用异常`,
      ],
      follow_ups: [
        { q: `异常 vs expected 选型指南？`, hint: `① 异常：罕见 / 不可恢复 / 没合理 return value 时；② expected: 频繁 / 业务可预期 / 调用者要 explicit handle；③ 一个项目内可混用：API 边界 expected，内部异常` },
        { q: `noexcept 对性能的影响？`, hint: `① 编译器可以省去 unwind table 入口；② 启用 move 而非 copy（move_if_noexcept）；③ inline 优化更激进；④ 实测大型项目 binary size -2-5%，hot path 性能 +2-5%` },
        { q: `跨 .so 抛异常安全吗？`, hint: `<strong>不</strong>—— 不同编译器 / libstdc++ 版本的异常 ABI 可能不一致；C++ 异常依赖 typeid 跨边界比较；推荐：library boundary 用 C ABI + error code` },
      ],
    },

    // ============== 设计模式 ==============
    94: {
      why_asked: `验证候选人是否理解 std::function / std::any 的实现原理。能讲"Concept-Model"模式的人是真写过库。`,
      answers: {
        mid: `<strong>Type Erasure</strong>：把"任意符合接口的类型"统一存入<strong>同一变量</strong>，<strong>不需要继承公共基类</strong>。典型：std::function / std::any。<br><strong>实现套路</strong>：内部 <strong>Concept</strong> 抽象基类（虚函数定义接口）+ <strong>Model 模板</strong>派生（wrap 具体类型 T）。`,
        senior: `<strong>完整骨架</strong>：<br><code>class Drawable {</code><br><code>    struct Concept { virtual void draw() = 0; virtual ~Concept() = default; };</code><br><code>    template&lt;class T&gt; struct Model : Concept {</code><br><code>        T obj;</code><br><code>        Model(T o) : obj(std::move(o)) {}</code><br><code>        void draw() override { obj.draw(); }</code><br><code>    };</code><br><code>    std::unique_ptr&lt;Concept&gt; p_;</code><br><code>public:</code><br><code>    template&lt;class T&gt; Drawable(T t) : p_(std::make_unique&lt;Model&lt;T&gt;&gt;(std::move(t))) {}</code><br><code>    void draw() { p_-&gt;draw(); }</code><br><code>};</code><br><br><strong>关键</strong>：① 用户类型 T 不需要继承 Drawable，只要有 draw() 成员；② Concept-Model 完成<strong>"鸭子类型 → 多态"的桥</strong>；③ 性能：每次调用一次 indirect call（vtable lookup）。`,
        staff: `深一层：Type Erasure 是 C++ 最有用的 idiom 之一，<strong>解决两大问题</strong>：<br>① "<strong>我不想强迫用户类型继承我的基类</strong>"（开源库的常见诉求）；<br>② "<strong>我要存任意符合接口的对象</strong>"（容器场景）。<br><br><strong>典型库</strong>：<br>· <strong>std::function</strong>：擦除 callable 类型（lambda / 函数指针 / functor）；<br>· <strong>std::any</strong>：擦除任意类型（用法跟 void* + dynamic_cast 类似但 type-safe）；<br>· <strong>boost::any</strong> / <strong>boost::variant</strong>；<br>· <strong>folly::Function</strong>（高性能 std::function）。<br><br><strong>SBO (Small Buffer Optimization)</strong>：std::function 内部典型有 24 字节 inline buffer，小 lambda 直接存对象避免堆分配；大 lambda fall back 到 heap。<strong>性能</strong>：① 调用：~5 ns（一次 indirect）；② 构造：&lt; SBO 时 ~10 ns，否则 ~50 ns（堆分配）。<br><br><strong>真实经验</strong>：platform agent 早期回调机制用<strong>纯虚基类继承</strong>，每个 user 类型必须 inherit Callback —— 用户嫌侵入。改用 type erasure 实现 <code>Callback</code>（接受任何有 <code>void operator()(Event)</code> 的类型）后，用户体验好，<strong>代码侵入归零</strong>。<strong>陷阱</strong>：① <strong>性能</strong>：每次调用 indirect call 阻止 inline → hot path 慎用；② <strong>复杂错误</strong>：Concept-Model 模板 instantiation 失败时错误信息长（C++20 concept 缓解）；③ <strong>copy semantics</strong>：要支持拷贝时 Concept 需要 clone() 虚函数；④ <strong>SBO 对齐</strong>：自己写 SBO 容易踩内存对齐的坑（用 std::aligned_storage）。`,
      },
      failure_modes: [
        `Concept 缺虚析构 → 派生对象不能正确销毁`,
        `Model 不 move 入参 → 不必要的拷贝`,
        `存 raw pointer 不用 unique_ptr → 内存泄漏`,
        `没考虑 SBO → 小 lambda 也 heap alloc`,
        `不知道为什么 std::function 比 lambda 直接调慢 5×（type erasure 阻 inline）`,
      ],
      follow_ups: [
        { q: `Type Erasure vs 虚基类继承怎么选？`, hint: `① TE：用户类型不必侵入；适合开放接口；② 虚基类：所有实现集中管理；适合封闭类型集；③ 性能差不多（都一次 indirect call）；TE 在易用性 + Compose 上更灵活` },
        { q: `怎么实现支持 copy 的 type erasure？`, hint: `Concept 加 <code>virtual unique_ptr&lt;Concept&gt; clone() const = 0;</code>；Model 实现 <code>return make_unique&lt;Model&gt;(*this);</code>；外层 copy ctor 调 clone` },
        { q: `std::function vs std::move_only_function (C++23) 区别？`, hint: `① std::function 要求 copyable callable；② move_only_function 接受 move-only（如 unique_ptr captures）；③ 性能基本相同；④ C++23 还有 std::function_ref（轻量引用版）` },
      ],
    },

    // ============== 低延时 ==============
    91: {
      why_asked: `低延迟编程必考。能讲 cache line align + 2 的幂 + release-acquire pair 三要点的人是真做过 lock-free。`,
      answers: {
        mid: `<strong>4 要点</strong>：① head / tail 各自 <strong>cache line 对齐</strong>（<code>alignas(64)</code>）—— 防 false sharing；② <strong>大小 N 是 2 的幂</strong>—— 用 <code>&amp;(N-1)</code> 取模（比 % 快）；③ <strong>release-acquire pair</strong>：push: store(release)，pop: load(acquire)；④ 操作 <strong>~10 ns</strong> vs 加锁 50-100 ns。`,
        senior: `<strong>SPSC 关键代码</strong>：<br><code>class SpscQueue&lt;T, size_t N&gt; {</code><br><code>    alignas(64) std::atomic&lt;size_t&gt; head_{0};  // consumer 只改</code><br><code>    char pad_[64];</code><br><code>    alignas(64) std::atomic&lt;size_t&gt; tail_{0};  // producer 只改</code><br><code>    T data_[N];</code><br><code>public:</code><br><code>    bool push(T x) {</code><br><code>        const size_t t = tail_.load(std::memory_order_relaxed);</code><br><code>        const size_t next = (t + 1) &amp; (N - 1);</code><br><code>        if (next == head_.load(std::memory_order_acquire)) return false;  // full</code><br><code>        data_[t] = std::move(x);</code><br><code>        tail_.store(next, std::memory_order_release);</code><br><code>        return true;</code><br><code>    }</code><br><code>    bool pop(T&amp; out) {</code><br><code>        const size_t h = head_.load(std::memory_order_relaxed);</code><br><code>        if (h == tail_.load(std::memory_order_acquire)) return false;  // empty</code><br><code>        out = std::move(data_[h]);</code><br><code>        head_.store((h + 1) &amp; (N - 1), std::memory_order_release);</code><br><code>        return true;</code><br><code>    }</code><br><code>};</code>`,
        staff: `深一层：SPSC lock-free 的<strong>核心洞察</strong>：单 producer 单 consumer 下，<strong>head 只被 consumer 改，tail 只被 producer 改</strong> → 一个 atomic load + 一个 atomic store + memory order pair 就够了，比 MPMC 简单 10×。<br><br><strong>性能优化</strong>：<br>① <strong>cache 本地副本</strong>：producer 缓存自己看到的 head（避免每次 push 都跨 cache line load）；consumer 缓存 tail。批量操作时大幅减少 cache line ping-pong。<br>② <strong>批量 push / pop</strong>：减少 atomic 操作（10× 吞吐）。<br>③ <strong>spin vs sleep</strong>：consumer 空时 busy-spin（低延迟）vs <code>std::this_thread::yield()</code>（节能）vs <code>pause</code> 指令（CPU hint）。<br><br><strong>真实经验</strong>：platform agent telemetry 数据流用 SPSC，初版上面代码 ~10 ns/op；加 cache 本地 head / tail 副本 ~7 ns；加 batch（一次 push / pop 16 个）~2 ns/op amortized。生产用 batch 版。<br><br><strong>vs Disruptor</strong>：Disruptor 是 SPSC / MPSC 的极致优化（LMAX 提出），用 sequence number + barriers，性能比朴素 SPSC 还快 30%；但实现复杂、调试困难。生产推荐 <strong>moodycamel::ReaderWriterQueue</strong>（header-only SPSC）/ <strong>folly::ProducerConsumerQueue</strong>。<strong>陷阱</strong>：① <strong>N 必须 2 的幂</strong>—— 取模 fast path；② 写 data_[t] 必须<strong>在 tail_.store 之前</strong>（release 保证）；③ <strong>destructor</strong> 需 drain 剩余元素；④ <strong>MPSC / MPMC 完全不同</strong>—— 需要 CAS + sequence number。`,
      },
      failure_modes: [
        `head / tail 同 cache line（无 padding）→ false sharing → 性能 -80%`,
        `用 seq_cst 而非 release-acquire → 性能 -50%`,
        `N 非 2 的幂用 % → fast path 慢`,
        `把 SPSC 当 MPMC 用 → 数据竞争 / 丢失`,
        `consumer 空 spin 不 backoff → CPU 100% 烧`,
      ],
      follow_ups: [
        { q: `MPSC / MPMC 怎么实现？`, hint: `MPSC: producer 用 CAS 抢 tail；MPMC: 需 sequence number + 双重 CAS；复杂度 ×10；推荐用 moodycamel / folly 现成库` },
        { q: `怎么测 SPSC 性能？`, hint: `① microbenchmark（google-benchmark）单线程 baseline；② 两线程 ping-pong（一来一回）测端到端延迟；③ 实测 throughput（一直 push / pop 测吞吐）；④ Perf c2c 看 cache line 流量` },
        { q: `Lock-free SPSC vs 加锁 BoundedQueue 怎么选？`, hint: `① 临界区极短 + 极高吞吐 → SPSC；② 一般场景 → BoundedQueue（25 行实现，bug 少）；③ <strong>先 benchmark 再优化</strong>—— 大多数业务 BoundedQueue 够用` },
      ],
    },

    164: {
      why_asked: `低延时高性能必考。能讲 pinning + NUMA + isolcpus 完整链条的人有真实 HFT / 网络设备调优经验。`,
      answers: {
        mid: `<strong>CPU pinning</strong>: 线程<strong>绑核</strong>避免迁移导致 cache miss / TLB miss。<br><strong>NUMA</strong>: 跨 socket 访问内存<strong>2-3× 本地慢</strong>。<br><strong>要点</strong>：① 高频线程 pin 到固定核；② 数据 numa_alloc_onnode 同节点；③ 关键应用配 <strong>isolcpus + nohz_full + IRQ affinity</strong>。`,
        senior: `<strong>具体 API</strong>：<br>· <strong>Linux</strong>: <code>pthread_setaffinity_np</code> / <code>sched_setaffinity</code> / <code>numa_run_on_node</code> / <code>numa_alloc_onnode</code><br>· <strong>std::thread</strong>: 没有原生 API，要用 <code>native_handle()</code> + pthread API<br>· <strong>boost::thread</strong> / <code>boost::compute</code> 有 cross-platform wrapper<br><br><strong>验证</strong>：<code>taskset -p $PID</code> / <code>numastat -p $PID</code> 看亲和性。<br><br><strong>典型生产配置</strong>：<br>① <code>isolcpus=2-7,10-15</code>（保留 6 个核给 latency-critical app）；<br>② <code>nohz_full=2-7,10-15</code>（隔离的核停 timer tick）；<br>③ <code>rcu_nocbs=2-7,10-15</code>（RCU callback 不在这些核）；<br>④ IRQ affinity 把网卡 IRQ 也 pin 到对应核。`,
        staff: `深一层：CPU 亲和性是 low-latency 三大支柱之一（另外两个：lock-free + zero-allocation）。<br><br><strong>NUMA 的细节</strong>：<br>① <strong>本地内存</strong>: ~80 ns 访问延迟；<br>② <strong>跨 socket（QPI / UPI）</strong>: ~140 ns（1.7×）；<br>③ <strong>L3 cache hit local</strong>: ~10 ns；<br>④ <strong>L3 cache hit remote</strong>: ~60 ns；<br>⑤ <strong>跨 socket 的 cache coherence</strong>: 极贵（HITM 100+ ns）。<br><br><strong>实战调优 4 步</strong>：<br>1) <code>numactl --hardware</code> 看 NUMA 拓扑；<br>2) 应用启动 <code>numactl --membind=0 --cpunodebind=0 ./app</code> 强制 node 0；<br>3) 多线程：每线程 pin 一个核 + 邻近 NUMA 节点；<br>4) 网卡：<code>set_irq_affinity.sh</code> 把网卡 IRQ 钉到处理它的核。<br><br><strong>真实经验</strong>：platform agent 的低延迟模式下：<br>① 8 核机器，isolcpus 4-7（4 个核保留）；<br>② 主 event loop pin 到核 4；<br>③ 4 个 worker pin 到核 5/6/7 / 4（同 NUMA node）；<br>④ 网卡 IRQ pin 到核 5；<br>⑤ NUMA local alloc。<br>结果：P99 latency 从 850 µs 降到 120 µs（-86%）。<br><br><strong>陷阱</strong>：① pinning 后操作系统不能均衡负载 → 选错核反而慢；② isolcpus 完全阻 kernel scheduling，必须 dedicated workload；③ 容器化（k8s）的 CPU affinity 要 cgroup cpuset 配置；④ NUMA balancer（kernel auto-migration）可能 conflict，需要 disable。<strong>验证工具</strong>：① <code>perf stat -e cache-misses,LLC-load-misses</code>；② <code>numastat</code>；③ <code>turbostat</code> 看每核 CPU freq。`,
      },
      failure_modes: [
        `不 pin 让 OS scheduler 迁移线程 → cache miss + TLB miss → P99 抖动`,
        `不考虑 NUMA → 跨 socket 内存访问慢 2-3×`,
        `isolcpus 后 OS 完全不调度该核 → 必须有任务在跑，否则浪费`,
        `容器化忽略 cpuset → CPU pinning 不生效`,
        `网卡 IRQ 没 pin → 中断打断关键线程`,
      ],
      follow_ups: [
        { q: `怎么验证 pinning 生效？`, hint: `① <code>taskset -p $PID</code> 看 affinity mask；② <code>perf stat</code> 跑 workload，比对 cache-misses；③ stress test 时看 P99 是否稳定` },
        { q: `Apple Silicon / ARM 上有类似工具吗？`, hint: `① macOS 没有完整等价（用 pthread_setaffinity_np_qos）；② ARM Linux 同 x86（taskset / numactl）；③ Apple 用 QoS class (USER_INTERACTIVE / USER_INITIATED) 间接控制` },
        { q: `huge page 跟 CPU pinning 关系？`, hint: `① 协同：减 TLB miss + 稳定 cache locality；② <code>madvise(MADV_HUGEPAGE)</code> 或 <code>echo always &gt; /sys/.../transparent_hugepage/enabled</code>；③ 巨页 2MB / 1GB，减少 TLB pressure 显著（hot working set &gt; few MB 时）` },
      ],
    },

    // ============== 对象模型 ==============
    145: {
      why_asked: `多继承经典题。能讲 vbptr / 共享 vs 重复 + 代价的人理解对象布局。`,
      answers: {
        mid: `<strong>菱形继承</strong>：A → B, A → C, D 同时继承 B 和 C → <strong>D 中有两份 A</strong>（重复 + 二义性）。<strong>解决</strong>：虚继承 <code>class B : virtual public A</code> + <code>class C : virtual public A</code> → 让 B 和 C <strong>共享一份 A</strong>。代价：对象布局复杂，引入 <strong>vbptr</strong>（virtual base table pointer）间接访问。`,
        senior: `<strong>对象布局对比</strong>：<br>· <strong>普通多继承</strong>：sizeof(D) = sizeof(B's A part) + sizeof(C's A part) + 派生类自己；访问 a.x 二义 → 需 <code>D::B::a.x</code> 显式消歧。<br>· <strong>虚继承</strong>：B 和 C 各持一个 <strong>vbptr</strong>（typically 8 字节）指向 vbtable → 间接定位共享 A 的偏移；sizeof(D) 比普通多继承小 8-16 字节但访问慢。<br><br><strong>性能</strong>：① 虚基类成员访问 +1 间接（vbptr 解引用），typical &lt; 1 ns；② <code>dynamic_cast</code> 跨虚继承层级开销大（运行时遍历继承图）。`,
        staff: `深一层：菱形继承是 C++ 多继承设计的<strong>"原罪"</strong>—— 简化版（Java / Kotlin）选择"<strong>单继承 + 多接口</strong>"完全绕开这个问题。C++ 保留多继承的理由：① mixin（如 std::iostream 同时继承 istream + ostream）；② 历史兼容。<br><br><strong>实战陷阱</strong>：<br>① 虚继承的<strong>构造函数顺序</strong>：最派生类必须显式调用<strong>虚基类构造</strong>（其他基类不能间接调）—— 容易忘；<br>② <strong>vbtable</strong> 跨编译器实现不同（MSVC / Itanium ABI）→ 跨 .so 共享虚继承类型是 ABI 灾难；<br>③ <strong>dynamic_cast 性能</strong>：跨虚继承时 typeid 比较 + 偏移计算，比普通继承慢 10×；<br>④ <strong>EBO（Empty Base Optimization）</strong>：虚继承通常 disable EBO（因 vbptr 占空间）。<br><br><strong>真实经验</strong>：在 platform agent 项目里曾出现过菱形继承（一个 ConfigItem 既继承 Serializable 也继承 Validatable，两者都继承 Loggable）。最初没用虚继承导致 ConfigItem 有两份 Loggable 状态，log 输出乱序。改用<strong>组合替代继承</strong>（ConfigItem has-a Logger 而非 is-a Loggable）后彻底解决。<strong>C++ Core Guidelines C.131 / C.135</strong>：避免菱形继承，优先组合 + concept；只在 mixin 必需时用虚继承。`,
      },
      failure_modes: [
        `不用虚继承导致基类重复 + 二义性`,
        `虚继承构造函数依赖中间类调虚基类（必须最派生类直接调）`,
        `跨 .so 共享虚继承类型 → ABI 不兼容`,
        `用菱形继承做组合（应该 has-a 不是 is-a）`,
        `dynamic_cast 跨虚继承当 hot path 用 → 性能崩`,
      ],
      follow_ups: [
        { q: `什么时候真的需要多继承？`, hint: `① Mixin / Policy-based design（按特性组合）；② iostream 风格（聚合多接口）；③ Pimpl 反例 / 嵌入第三方需要继承的接口；99% 场景用组合 + concept 替代` },
        { q: `EBO 是什么？跟虚继承关系？`, hint: `Empty Base Optimization：空基类不占空间（编译器允许 sizeof 为 0）；虚继承通常 disable EBO（vbptr 占空间）；C++20 [[no_unique_address]] 是 EBO 的现代替代` },
        { q: `菱形继承的 sizeof 怎么算？`, hint: `① 普通多继承：A's part × 2 + B unique + C unique + D unique + vptr 等；② 虚继承：A 只 1 份 + B unique + C unique + D + 2 个 vbptr；用 godbolt 看具体 layout` },
      ],
    },

    213: {
      why_asked: `对象模型的"五个为什么"。能讲清每种的<strong>底层原因</strong>而非"标准规定"的人是真理解 vtable。`,
      answers: {
        mid: `5 种 + 原因：① <strong>构造函数</strong>：调用时 <strong>vptr 还未初始化</strong>，没办法虚；② <strong>静态成员函数</strong>：无 this，也就无 vptr；③ <strong>友元函数</strong>：不是类成员，不能继承；④ <strong>普通非成员函数</strong>：同上；⑤ <strong>内联函数</strong>：inline 是编译期决议，virtual 是运行期—— 语义冲突（形式上可写，但虚调用时不会 inline）。`,
        senior: `<strong>构造函数不能虚的深层原因</strong>：① vptr 在构造体内才被设置；② 派生类构造的<strong>前期</strong>（基类构造时）vptr 指向<strong>基类 vtable</strong>，不指向最派生类 → 即使能调虚也只会调基类版本；③ "构造一个虚类型"需要工厂模式 + clone() 模拟。<br><strong>析构函数可以虚</strong>（与构造对比）：vptr 在派生类析构开始时被设回派生类 vtable → 派生析构 → 基类析构时 vptr 已设回基类。`,
        staff: `深一层：理解这些限制能避免一类 C++ 经典 bug：<br>① <strong>"在构造函数里调虚函数"陷阱</strong>：调的是<strong>本类</strong>的版本，<strong>不是派生类</strong>的 override（vptr 还指向本类 vtable）。<strong>Effective C++</strong> 第 9 条经典反模式。<br>② <strong>解决方法</strong>：① "<strong>two-phase initialization</strong>"（构造完成后再 init）；② <strong>CRTP</strong>（Curiously Recurring Template Pattern）静态多态替代；③ 工厂函数 + 后置 init 调用。<br>③ <strong>析构函数应该 virtual</strong>（如果类作为基类用）—— delete derived * via base * 时无虚析构 → UB。<br><br><strong>真实案例</strong>：platform agent 早期有 <code>class Service { Service() { initialize(); } virtual void initialize(); };</code> Derived override initialize 后<strong>不工作</strong>—— 调的是 Service::initialize。改用 <code>Service() { setup(); } void setup(); virtual void initialize();</code> + 用户必须显式 init() 后修复。<br><br><strong>其他限制</strong>：① 模板成员函数也不能 virtual（vtable 大小未知，无法实例化所有版本）；② 不能 virtual + constexpr（C++17 前；C++20 允许 virtual constexpr）。`,
      },
      failure_modes: [
        `构造里调虚函数期待派生版本（实际调本类）`,
        `delete derived via base* 不写 virtual ~Base() → UB`,
        `静态成员加 virtual 修饰 → 编译错（语义冲突）`,
        `把构造函数设计成"虚"模式 → 不可能 → 需 factory pattern`,
        `把 inline + virtual 当编译期 + 运行期混用 → 不能 inline + virtual 调用`,
      ],
      follow_ups: [
        { q: `析构函数应该 virtual 的标准？`, hint: `① 类作为基类（被继承）→ 必须 virtual；② final class / 不打算被继承 → 不需要；③ 标准：有任何 virtual 函数就应该 virtual 析构（cppcoreguidelines）` },
        { q: `CRTP 怎么实现 "constructor 多态"？`, hint: `<code>template&lt;class Derived&gt; class Base { Base() { static_cast&lt;Derived*&gt;(this)-&gt;init(); } };</code> + <code>class D : public Base&lt;D&gt; { public: void init(); };</code>——编译期分派，避免 vptr 初始化问题` },
        { q: `C++20 的 constexpr virtual 怎么用？`, hint: `① 编译期多态：constexpr virtual 函数；② 但仍受限（constexpr context 内调用，对象需 constexpr 构造）；③ 适合编译期反射 + 元编程场景` },
      ],
    },

    214: {
      why_asked: `对象模型基础。能列 4 种情况的人是真读过《Inside the C++ Object Model》。`,
      answers: {
        mid: `4 种情况：① 类的<strong>成员对象</strong>有默认构造函数；② 类的<strong>基类</strong>有默认构造函数；③ 类有<strong>虚函数</strong>（需要在构造里初始化 vptr）；④ 类有<strong>虚基类</strong>（需要初始化 vbtable）。仅以上情况编译器才合成；否则什么都不生成（POD 风格，对象内存未初始化）。`,
        senior: `<strong>合成的目的</strong>是<strong>编译器必须做的初始化工作</strong>（不是 user-defined logic）：<br>· 成员对象 / 基类有 ctor → 必须调它们的 ctor<br>· virtual 函数 → 必须初始化 vptr 指向本类 vtable<br>· 虚基类 → 必须初始化 vbptr 指向 vbtable<br><br><strong>不合成时</strong>：纯 POD（C++ 03 / aggregate C++ 17）—— 内存内容 indeterminate（不是 0，是栈 / heap 残留），用前必须显式初始化。<strong>C++11 改进</strong>：成员初始化列表内 default member initializer（<code>int x = 0;</code>），即使无 ctor 也能给默认值。`,
        staff: `深一层：理解合成规则能<strong>避免性能陷阱</strong>。<strong>对比</strong>：<br>① <strong>不需要合成</strong>（pure POD）：栈上对象是 zero-cost（不调任何函数）；<br>② <strong>合成</strong>：编译器生成的 ctor body 调用所有需要的初始化，<strong>typically inline 优化掉</strong>。<br>③ <strong>用户自定义</strong>：自己写 <code>X() = default</code> 或 <code>X() {}</code> 也算合成（但<strong>= default 和 {} 的语义差异微妙</strong>—— = default 是 trivial 的话允许，{} 是 user-defined 不 trivial）。<br><br><strong>实战影响</strong>：<br>· <code>struct Foo { int x; };</code> Foo 是 trivial，<code>Foo f;</code> x 未初始化 → 用前 UB；<br>· <code>struct Foo { int x = 0; };</code> 仍 trivial（C++14 后），<code>Foo f;</code> x = 0；<br>· <code>struct Foo { int x; Foo() = default; };</code> 同上（trivial）；<br>· <code>struct Foo { int x; Foo() {} };</code> 不 trivial，但 x 仍未初始化（user-defined ctor 不做隐式初始化）；<br>· <code>struct Foo { int x; Foo() : x(0) {} };</code> x = 0。<br><br><strong>真实经验</strong>：在 platform agent 优化某 hot struct 时发现 <code>struct Msg { int len; };</code> 的 <code>Msg m;</code> 是 zero-cost，<code>Msg m{};</code> 显式 zero-init 也 zero-cost（编译器优化），但 <code>struct Msg { int len; Msg() : len(0) {} };</code> 居然没被 inline 优化掉（GCC 13 -O2），改回 = default 后 inline。<strong>结论</strong>：① POD-like 类型用 default member initializer；② = default 通常 ≥ explicit empty body；③ 容器扩容时编译器倾向 memcpy（trivial）vs 调 copy ctor（user-defined）—— 巨大性能差。`,
      },
      failure_modes: [
        `期待编译器给 POD 类型零初始化 → 实际 indeterminate → UB`,
        `用 <code>Foo() {}</code> 替代 = default → 失去 trivial 属性 → 容器优化失效`,
        `不知道 default member initializer 保留 trivial`,
        `成员有默认构造但用户写空 ctor → 没初始化用户 expected 字段`,
        `跨 .so 边界传 non-trivial 类型 → ABI 风险`,
      ],
      follow_ups: [
        { q: `trivial / standard-layout / POD 区别？`, hint: `① trivial：所有特殊成员函数都是 default + 没有 virtual / 虚基；② standard-layout：内存布局确定（兼容 C struct）；③ POD = trivial + standard-layout（C++20 起 POD 被废弃，分别使用）` },
        { q: `什么时候应该禁用 default ctor？`, hint: `① 类必须有外部状态才能用（如 file handle 必须给路径）；② 防止误用 default 状态；用 <code>X() = delete;</code> 显式禁用` },
        { q: `合成的 ctor / dtor / copy / move 都什么时候被禁？`, hint: `① 用户声明任一特殊成员函数 → 部分 disable（Rule of Zero / Rule of Five）；② 类含 const / reference 成员 → copy assignment disabled；③ 含 move-only 成员 → copy disabled` },
      ],
    },

    216: {
      why_asked: `对象模型五大题之一。能讲完整 5 步顺序的人是真做过 C++ 底层开发。`,
      answers: {
        mid: `编译器在构造函数体里<strong>隐式插入</strong>这些步骤（按顺序）：① 调用<strong>虚基类构造</strong>（按继承列表顺序）；② 调用<strong>直接基类构造</strong>；③ 初始化 <strong>vptr</strong>（指向本类 vtable）；④ 按声明顺序<strong>初始化成员变量</strong>（用初始化列表的值或默认）；⑤ 执行用户写的<strong>构造函数体</strong>。`,
        senior: `<strong>关键顺序原则</strong>：<br>① <strong>虚基类先于普通基类</strong>—— 因为虚基类共享，必须最早初始化；<br>② <strong>基类先于派生类</strong>—— 派生类构造体可能依赖基类已初始化的状态；<br>③ <strong>成员按<u>声明顺序</u>初始化</strong>—— 不是按初始化列表顺序！这是经典面试坑：<code>X() : b(1), a(b) {}</code> 但 a 在 b 之前声明 → a 用未初始化的 b 算自己。<br>④ vptr 在<strong>所有基类构造完后</strong>设置 → 这就是构造内调虚函数不工作的根本原因。`,
        staff: `深一层：构造顺序是 C++ 对象模型最复杂的部分之一。<br><br><strong>vptr 切换的"奇妙时刻"</strong>：<br>1. 进入 Derived 的构造函数；<br>2. 调用 Base 构造函数前，vptr 还未设置（或承袭上一阶段的）；<br>3. 进入 Base 构造体，<strong>vptr 被设为 Base::vtable</strong>（"<strong>当前类型</strong>"）；<br>4. Base 构造体内调虚函数 → 走 Base::vtable → 调 Base::override 而非 Derived::override；<br>5. Base 构造完，回到 Derived 构造前导阶段，<strong>vptr 切换到 Derived::vtable</strong>；<br>6. 现在调虚函数才走 Derived。<br><br><strong>实战陷阱</strong>：<br>① <strong>初始化列表顺序 ≠ 声明顺序</strong>—— 编译器以声明顺序为准，写错时部分编译器报 warning（-Wreorder）；<br>② <strong>构造体内调虚函数</strong>调本类 vtable 版本，不调派生版本；<br>③ <strong>异常</strong>：如果 step 4 抛异常，前面 step 已构造的成员 / 基类会按相反顺序析构 → "<strong>部分构造</strong>" 不存在，要么完整要么没构造。<br><br><strong>真实经验</strong>：曾踩过初始化顺序坑——<code>class A { int* p; size_t len; A() : len(100), p(new int[len]) {} };</code> p 在 len 之前声明 → p(new int[len]) 时 len 是 garbage → new 大小未定义。调换声明顺序后修复。<strong>对策</strong>：① 启用 <code>-Wreorder</code>；② 初始化列表按声明顺序写（即使代码风格略丑）；③ 避免成员之间初始化依赖（用 lazy / two-phase）。`,
      },
      failure_modes: [
        `初始化列表写顺序当真实顺序（实际编译器按声明顺序）`,
        `构造体调虚函数期待派生版本`,
        `异常时假设部分初始化能恢复（实际 RAII 自动析构已构造部分）`,
        `成员之间互相依赖初始化（顺序敏感，bug 难找）`,
        `不启 -Wreorder warning → 错误顺序无 warn`,
      ],
      follow_ups: [
        { q: `vptr 在哪里？`, hint: `每个有 virtual 函数的对象的<strong>第一个 8 字节</strong>（Itanium ABI）；指向类的 vtable；通过 <code>&amp;obj</code> 取址后 dereferences 看到 vtable address` },
        { q: `多继承下 vptr 几个？`, hint: `每个有 virtual 函数的基类各一个 vptr；典型 sizeof(Derived) = base1's vptr + base1 unique + base2's vptr + base2 unique + Derived unique` },
        { q: `析构顺序怎么样？`, hint: `<strong>反向</strong>构造顺序：① 用户体；② 成员（反声明顺序）；③ 派生类 vptr 切回基类 vtable；④ 直接基类（反列表顺序）；⑤ 虚基类（反列表顺序）` },
      ],
    },

    218: {
      why_asked: `对象模型基础题。能讲"无限递归"的人理解 by-value 与 reference 的本质。`,
      answers: {
        mid: `<strong>传值 → 形参构造需要调用拷贝构造 → 拷贝构造又需要构造形参... → 无限递归 → 编译错 / 栈溢出</strong>。必须传<strong>引用</strong>（传地址值）来打破这个循环。通常签名：<code>T(const T&amp;)</code>。`,
        senior: `<strong>详细解释</strong>：函数参数 by-value 时，调用方<strong>拷贝</strong>实参到形参。如果 <code>T(T t)</code> 是拷贝构造，那调用它需要先<strong>把实参拷贝</strong>到形参 t —— 而拷贝是用什么操作？正是 T(T t)！→ 调用 T(T t) → 要拷贝 → 又调用 T(T t) → ...无限递归。<strong>引用传递</strong>不需要拷贝（传 8 字节地址），打破递归。<strong>const 修饰</strong>让拷贝构造能接受临时对象（rvalue）。`,
        staff: `深一层：拷贝构造的 <strong>5 种合法签名</strong>：<br>· <code>T(T&amp;)</code> —— 非 const，只能拷贝 non-const lvalue<br>· <code>T(const T&amp;)</code> —— 最常用，能拷贝所有<br>· <code>T(volatile T&amp;)</code> —— 罕见<br>· <code>T(const volatile T&amp;)</code> —— 罕见<br>· <code>T(T)</code> —— <strong>违法</strong>（无限递归）<br><br><strong>编译器检测</strong>：当编译器在合成拷贝构造时（无用户定义），它<strong>自动选 T(const T&amp;)</strong>。如果有成员是 <code>T(T&amp;)</code>（非 const），合成版本也是 <code>T(T&amp;)</code>。<br><br><strong>实战陷阱</strong>：<br>① <strong>std::auto_ptr</strong>（C++03，已 deprecate）的拷贝构造是 <code>auto_ptr(auto_ptr&amp;)</code>（非 const），<strong>剥夺源对象</strong>—— 后被 unique_ptr 替代（不可拷贝只可移动）；<br>② <strong>移动构造可以传值的 trick</strong>：<code>T(T)</code> 违法但 <code>T(T&amp;&amp;)</code> 合法（rvalue ref 类似 ptr，无拷贝循环）；<br>③ <strong>"Copy and Swap"</strong> idiom：<code>T&amp; operator=(T other) { swap(other); return *this; }</code> —— 这里 other 是<strong>形参拷贝</strong>，看似 by-value 但调用方先创建临时然后 move/copy 进 other，没递归。<br><br><strong>真实经验</strong>：曾见过 junior 写 <code>class Foo { public: Foo(Foo f) {...} };</code>，期待"自然拷贝"，编译器 200 行 error 看不懂。改成 <code>Foo(const Foo&amp; f)</code> 后通过。<strong>建议</strong>：① 90% 场景 <code>const T&amp;</code>；② 类型有<strong>SBO + 廉价 copy</strong>（如 string_view）才考虑 <code>T</code>（按值传递更快无 alias）；③ rule of five 全显式 default 让编译器帮你生成。`,
      },
      failure_modes: [
        `写 T(T) → 编译失败（无限递归）→ 不知道错在哪`,
        `用 T(T&amp;) 替代 T(const T&amp;) → 不能拷贝临时 / const 对象`,
        `auto_ptr / unique_ptr 混用 → 复制时剥夺源 / 编译错`,
        `Copy and swap idiom 写成 T& op=(const T&) 后 swap → 看不出比直接赋值的优势`,
        `不知道 T(T&&) 合法（移动构造可以 by-value rvalue ref）`,
      ],
      follow_ups: [
        { q: `Rule of 0/3/5 是什么？`, hint: `① Rule of 0：依赖默认成员函数（用 STL / smart ptr）—— 最理想；② Rule of 3：写了 dtor / copy ctor / copy assign 之一就要写另外两个（C++03）；③ Rule of 5：加 move ctor / move assign（C++11）` },
        { q: `Copy and Swap idiom 的优势？`, hint: `① 强异常安全（先构造再 swap，swap noexcept）；② 共享 copy ctor + move 逻辑；③ 处理 self-assignment 自动（other 是拷贝）；④ 代价：每次 op= 都有一次拷贝 + 一次 swap` },
        { q: `传值 vs 传 const T& 性能差异？`, hint: `① 小类型（&lt; 16 bytes）：传值更快（寄存器传递，无 alias 优化好）；② 大类型 / non-trivial：const T& 更快（避免一次 copy）；③ T&& 接收 rvalue 启用 move` },
      ],
    },

    222: {
      why_asked: `底层基础题。能讲完整 6 步流程的人理解 ABI / calling convention。`,
      answers: {
        mid: `<strong>调用方</strong>：① 参数<strong>从右向左</strong>压栈（cdecl）；② <strong>call 指令</strong>把返回地址压栈，跳到被调函数。<br><strong>被调函数</strong>：① 保存旧 ebp/rbp 到栈；② <strong>mov ebp, esp</strong>（建立新栈帧）；③ <strong>sub esp, N</strong> 给局部变量留空间；④ 执行函数体；⑤ <strong>mov esp, ebp + pop ebp</strong>（恢复）；⑥ <strong>ret</strong>（弹返回地址跳回）。`,
        senior: `<strong>x86-64 ABI 差异</strong>（System V vs Win64）：<br>· <strong>System V AMD64</strong>（Linux / macOS）：前 6 个整型参数走 <strong>rdi / rsi / rdx / rcx / r8 / r9</strong>，前 8 个浮点走 <strong>xmm0-xmm7</strong>；其余压栈；<br>· <strong>Win64</strong>：前 4 个走 <strong>rcx / rdx / r8 / r9</strong>（整型 / 浮点共用槽）；其余压栈；<br>· <strong>返回值</strong>：整型 rax，浮点 xmm0；大返回（&gt; 16 bytes）由调用方分配栈空间，被调写入 + rax 返地址；<br>· <strong>caller-saved vs callee-saved 寄存器</strong>：各自责任不同。`,
        staff: `深一层：理解栈帧能<strong>解释多个 C++ 底层现象</strong>：<br>① <strong>RVO/NRVO</strong>：caller 在自己栈帧预留返回值空间 + 传地址给 callee；callee 直接<strong>原地构造</strong>到 caller 空间 → 无 copy；<br>② <strong>移动语义</strong>性能：右值引用是 8 字节指针 → 几乎零成本传递；<br>③ <strong>异常 unwind</strong>：unwind table 记录每个函数的栈帧 layout，runtime 能反向 pop 帧 + 调析构；<br>④ <strong>tail call optimization</strong>：函数<strong>最后一步</strong>是调另一函数 → 复用当前栈帧（不嵌套）；<br>⑤ <strong>frame pointer 省略</strong>（-fomit-frame-pointer）：用 rsp 直接索引，少一次 push rbp，但 backtrace 困难。<br><br><strong>调试时</strong>用 GDB <code>info frame</code> 看栈帧细节；<code>disas /s</code> 看汇编 + 源码对照。<strong>真实经验</strong>：platform agent 一次 release 段错 (-O2)，gdb backtrace 全是 ?? —— 因 -fomit-frame-pointer。重编加 <code>-fno-omit-frame-pointer</code> 后 backtrace 清晰，定位到一个 stack-use-after-return（局部数组 escape 给 worker thread）。`,
      },
      failure_modes: [
        `不区分 System V 和 Win64 ABI → 跨平台代码混用错误`,
        `期待"栈分配是免费"忽略 stack overflow（深递归 / 大局部数组）`,
        `Release 不加 -fno-omit-frame-pointer → backtrace 无用`,
        `不理解 caller-saved vs callee-saved → 内联汇编破坏寄存器`,
        `不知道 RVO 通过 caller-allocated 空间实现`,
      ],
      follow_ups: [
        { q: `caller-saved 和 callee-saved 寄存器分别是哪些？`, hint: `System V AMD64：caller-saved（被调可任意改）: rax, rcx, rdx, rsi, rdi, r8-r11；callee-saved（被调必须恢复）: rbx, rbp, r12-r15` },
        { q: `Tail call optimization 怎么触发？`, hint: `① 函数<strong>最后一步</strong>是调另一函数；② 返回值直接是被调返回；③ 编译器优化（GCC -O2 默认开）；④ 但有 destructor / cleanup 时不能 TCO` },
        { q: `栈溢出怎么调试？`, hint: `① 检查无限递归 / 大局部数组；② -fstack-usage 编译看每函数栈使用；③ 增加栈大小（pthread_attr_setstacksize）；④ AddressSanitizer with stack overflow detection` },
      ],
    },

    225: {
      why_asked: `基础题但能筛人。能讲清"3 个必要条件缺一不可"的人是真理解 vtable 分发机制。`,
      answers: {
        mid: `<strong>3 个必要条件</strong>：① 基类必须有 <strong>virtual</strong> 函数；② 派生类必须 <strong>override</strong> 该函数（相同签名）；③ 必须通过<strong>基类指针 / 引用</strong>调用（不是对象本身）。`,
        senior: `<strong>缺一不可的反例</strong>：<br>① <strong>没 virtual</strong>：编译期静态绑定，调基类版本（即使派生类有同名函数）；<br>② <strong>signature 不一致</strong>：派生类 <code>void foo() const</code> vs 基类 <code>void foo()</code> → 不是 override，是<strong>隐藏</strong>（hide）；<br>③ <strong>通过对象调用</strong>：<code>Base b = derived;</code> 后 b.foo()<strong>切片</strong>（slicing）—— 已经丢失派生类信息 → 只能调 Base::foo。<br><br><strong>实战工具</strong>：C++11 起强制写 <code>override</code> 关键字，编译器检查签名一致；<code>final</code> 标记不能进一步 override。`,
        staff: `深一层：多态发生需要"<strong>vtable 间接调用</strong>"机制，三个条件缺一不可：<br>① virtual 让<strong>编译器为该函数生成 vtable 槽</strong>；<br>② override 让<strong>派生类 vtable 该槽指向派生版本</strong>；<br>③ 通过基类指针 / 引用调用时<strong>编译器生成 indirect call</strong>（lookup vtable + jump），而<strong>对象调用是 direct call</strong>。<br><br><strong>性能成本</strong>：<br>· 直接调（无 virtual）：1 个 call 指令，&lt; 1 ns；<br>· 虚调用：vtable lookup + indirect call，~ 1-3 ns（cache 命中）/ ~10 ns（miss）；<br>· <strong>devirtualization</strong>：编译器看到<strong>final class</strong> 或<strong>static type 已知</strong>时优化成直接调（-O2 通常做）。<br><br><strong>真实案例</strong>：在 platform agent profile 一段 hot path，发现 90% 时间在 virtual function call。原因：调用方是 vector&lt;Base*&gt; loop，每个 dispatch 都 vtable lookup。<strong>优化</strong>：① 类型已知场景改 static dispatch（template + CRTP）；② 排序 vector by type 后用 branch prediction；③ profile-guided optimization 让编译器学到 hot indirect target。结果性能 +35%。<strong>对比</strong>：① CRTP（静态多态）零开销但模板膨胀；② <code>std::variant + std::visit</code>（C++17 sum type）：编译期分发但代码量大；③ <strong>tagged union + switch</strong>：手动版本，最 verbose 但 cache friendly。`,
      },
      failure_modes: [
        `基类无 virtual 期待派生类 override → 编译过但调基类版本（hidden）`,
        `signature 写错（const / 参数）→ override 失败 → 没用 override 关键字时编译不报`,
        `对象切片：把派生赋给基类对象（不是 ptr / ref）→ 派生成员丢失 + 多态失效`,
        `hot path 大量虚调用 → cache miss → 性能崩`,
        `不用 override / final → 维护期改动易出错`,
      ],
      follow_ups: [
        { q: `override 关键字必须写吗？`, hint: `推荐永远写！① 编译器检查签名一致（防 hide）；② 代码可读性（显式 override 意图）；③ Refactor 时基类签名变了立刻报错；C++ Core Guidelines C.128 强制要求` },
        { q: `final 什么时候用？`, hint: `① 类 final：禁止继承（编译器可 devirtualize 所有调用）；② 函数 final：派生类不能 override；③ 性能优化：让编译器 inline / devirtualize 虚调用` },
        { q: `静态多态（CRTP）vs 动态多态（virtual）怎么选？`, hint: `① CRTP：编译期已知类型 + hot path / 模板库；② virtual：运行期类型未知 / 异构集合 / 插件系统；③ 设计判断："这个类型集合需要 runtime extensibility 吗?"` },
      ],
    },

    227: {
      why_asked: `对象布局题，能给具体 sizeof 的人是真画过 vtable / 内存图。`,
      answers: {
        mid: `① <strong>单一类</strong>：成员和 +（vptr 8 字节 if 有 virtual）+ 对齐。<br>② <strong>单继承</strong>：基类布局 + 派生类成员。<strong>共享一个 vptr</strong>。<br>③ <strong>多继承</strong>：多个基类按声明顺序排，<strong>各自的 vptr 都在</strong>。<br>④ <strong>虚继承</strong>：多一个 <strong>vbptr</strong> 指向虚基类表 —— 共享虚基类。`,
        senior: `<strong>典型 sizeof 例子</strong>（64-bit 系统）：<br>· <code>struct A { int x; };</code> sizeof = 4<br>· <code>struct A { int x; virtual void f(); };</code> sizeof = 16（vptr 8 + int 4 + padding 4）<br>· <code>struct B : A { int y; };</code>（A 无 virtual）sizeof = 8（A 的 x 4 + B 的 y 4）<br>· <code>struct C : A { int y; };</code>（A 有 virtual）sizeof = 16（vptr + x + y + padding）<br>· <code>struct D : A, B { int z; };</code>（多继承）：A.vptr + A.x + B.vptr + B.x + D.z + padding<br>· <code>struct E : virtual A {};</code>：A 部分 + vbptr 8 字节<br>· <code>struct F : virtual A {}; struct G : virtual A {}; struct H : F, G {};</code>：A 一份（共享）+ F's vbptr + G's vbptr + H's part`,
        staff: `深一层：理解对象布局能解释<strong>多个 C++ 性能 / ABI 现象</strong>：<br>① <strong>EBO</strong>（Empty Base Optimization）：空基类<strong>不占空间</strong>（编译器允许 sizeof base = 0），所以 <code>struct A {}; struct B : A { int x; };</code> sizeof(B) = 4 不是 5；<br>② <strong>vptr 位置</strong>：Itanium ABI 把 vptr 放对象<strong>第一个字段</strong>（reinterpret_cast 后能直接访问）；<br>③ <strong>多继承下 this 调整</strong>：<code>D d; B* b = &amp;d;</code> 时 b 不等于 &d，编译器自动加 offset；调用 B 的虚函数时 thunk 调整 this 回 D；<br>④ <strong>跨 .so</strong>：对象布局是 ABI 一部分 → 改类成员就破坏 ABI（Pimpl 解决）。<br><br><strong>工具</strong>：① <code>clang -Xclang -fdump-record-layouts</code> 看类布局；② godbolt 看汇编中 offset；③ <code>__builtin_offsetof</code> 查成员偏移。<br><br><strong>真实经验</strong>：platform agent 的 hot struct <code>Message { uint64_t id; std::string body; int priority; };</code> sizeof = 56（id 8 + string 32 + priority 4 + padding 12）。<strong>调整顺序</strong> <code>Message { uint64_t id; int priority; std::string body; };</code> sizeof = 48（id 8 + priority 4 + padding 4 + string 32），<strong>每个 Message 省 8 字节</strong>。Hot path 100k QPS 累积省 800KB/s + cache friendly → 性能 +5%。<strong>原则</strong>：成员按 sizeof <strong>从大到小</strong>排列减少 padding。<strong>C++20 [[no_unique_address]]</strong>：让空类型成员不占空间（EBO 的现代替代）。`,
      },
      failure_modes: [
        `不知道 vptr 占空间（认为 sizeof(A) = 4 但实际 16）`,
        `多继承时 this pointer 转换没意识 → 手动 reinterpret_cast 错位`,
        `成员声明顺序随意 → 多余 padding 导致 cache line 浪费`,
        `虚继承的 sizeof 算错（漏掉 vbptr）`,
        `没用 EBO / [[no_unique_address]] 优化空类型成员`,
      ],
      follow_ups: [
        { q: `怎么查具体类的内存布局？`, hint: `① clang -Xclang -fdump-record-layouts；② -Wpadded 提示 padding 字段；③ pahole（Linux 工具）；④ Visual Studio "/d1 reportSingleClassLayout&lt;ClassName&gt;"` },
        { q: `什么是 [[no_unique_address]]？`, hint: `C++20 attribute，允许编译器把空成员的地址 reuse 给其他成员，sizeof 不增加；EBO 的现代替代，更通用（不限于继承）` },
        { q: `成员排列优化的规则？`, hint: `① 从大到小排列减 padding；② alignas 显式对齐 cache-critical 字段；③ 频繁访问字段放一起；④ 避免 false sharing 时反而拉大分布` },
      ],
    },

    // ============== 性能 ==============
    106: {
      why_asked: `生产 C++ 必备优化技术。能讲两者各自原理 + 收益数字的人是真做过编译优化。`,
      answers: {
        mid: `<strong>LTO (Link Time Optimization)</strong>：链接时<strong>跨 TU 优化</strong>（跨文件 inline / dead code 消除），收益 <strong>5-15%</strong>。<br><strong>PGO (Profile-Guided Optimization)</strong>：用<strong>真实数据</strong>指导优化（哪些函数热，哪些分支常走），收益 <strong>5-20%</strong>。流程：编译插桩 → 跑真实负载 → 重编。`,
        senior: `<strong>LTO</strong>：典型做法 <code>-flto</code>，链接时把所有 IR 一起做<strong>全局优化</strong>（跨文件 inline 是最大收益，因为 <code>.cpp</code> 边界不再阻碍 inline 决策）。代价：<strong>链接时间 ×3-10</strong>。<strong>ThinLTO</strong> 是 LLVM 引入的 incremental LTO，链接时间增加少（~ 1.5×）但收益略低（80% of full LTO）。<br><strong>PGO</strong>：3 阶段 ① <code>-fprofile-generate</code> 编译插桩版；② 跑代表性 workload 收集 profile；③ <code>-fprofile-use</code> 重编。<strong>痛点</strong>：必须有 representative workload，不准的 profile 可能反优化。<strong>AutoFDO</strong>（Google）/ <strong>BOLT</strong>（Facebook）从生产 perf 数据获取 profile，免去插桩 step。`,
        staff: `深一层：LTO 和 PGO 是<strong>正交</strong>的，可<strong>叠加使用</strong>（典型生产配置）。<br><br><strong>LTO + PGO 累计收益</strong>：典型 10-25%（取决于代码风格 / 业务）。<strong>注意</strong>：① <strong>code size</strong> 通常增加（更激进 inline）；② <strong>编译 + 链接时间</strong> ×5-10；③ <strong>调试</strong>难度上升（inline 后 backtrace 难看）。<br><br><strong>BOLT (Binary Optimization and Layout Tool)</strong>：Facebook 工具，<strong>编译后</strong>用 perf 数据重排二进制（hot function 排前面 / cold 排后面 / branch 重排）。<strong>跟 PGO 互补</strong>—— PGO 在编译期优化，BOLT 在链接后再优化。生产典型再加 5-15%。<br><br><strong>真实经验</strong>：platform agent 优化经历：<br>① baseline (-O2): 性能 100%<br>② +LTO: 110%（+10%）<br>③ +PGO: 122%（+11%）<br>④ +BOLT: 135%（+11%）<br>⑤ +CPU pinning + NUMA: 158%（+17%）<br>累计 +58%。<strong>取舍</strong>：① 内部 release 关 LTO 加快迭代；② Production release 全开；③ 调试构建（debug）完全不开（影响 backtrace）。<strong>陷阱</strong>：① PGO workload 不代表生产 → 优化反向；② LTO 暴露 ODR 违反（不同 TU 同名同类型不同定义）→ 编译错或运行 UB；③ BOLT 需要 frame pointer 完整（-fno-omit-frame-pointer）。`,
      },
      failure_modes: [
        `PGO 用 synthetic workload → profile 不代表生产 → 反优化`,
        `LTO 暴露 ODR 违反 → 编译错或 runtime UB`,
        `Production binary 没开 LTO → 失去免费 10% 性能`,
        `Debug build 也开 LTO → 编译慢 / 调试体验差`,
        `BOLT 需要 frame pointer 但配 -fomit-frame-pointer → BOLT 无法工作`,
      ],
      follow_ups: [
        { q: `ThinLTO vs Full LTO？`, hint: `① Full LTO：所有 IR 一起优化，慢但收益大；② ThinLTO：分 module 增量优化 + summary-based cross-module；链接时间 1.5× vs 5×，收益 80% vs 100%；2026 年 ThinLTO 是默认选择` },
        { q: `PGO 跟 AutoFDO 区别？`, hint: `① PGO：插桩二进制，单独跑收集 profile；② AutoFDO（Google）：从生产 perf record 数据自动转 profile；优势：免插桩 + 持续优化；劣势：精度略低` },
        { q: `怎么验证 LTO/PGO 真的生效？`, hint: `① <code>readelf -S binary</code> 看 .gnu.lto_* sections；② perf record + symbol 看 hot function；③ pre/post benchmark 对比；④ binary size 通常涨` },
      ],
    },

    108: {
      why_asked: `零分配 / 低延迟编程必考。能讲清"arena 顺序推进 + reset 一次性回收"的人是真实践过。`,
      answers: {
        mid: `<strong>顺序推进的 arena allocator</strong>：分配只是<strong>指针前移</strong>（~几 ns），<strong>不释放</strong>；整个 resource 析构 / reset 时一次性回收。配 <code>std::pmr::vector</code> / <code>pmr::map</code> 等容器，请求处理结束自动整体释放，<strong>0 次 free</strong>。`,
        senior: `<strong>典型用法</strong>（C++17 PMR）：<br><code>void handleRequest(Request&amp; req) {</code><br><code>    char buf[64 * 1024];</code><br><code>    std::pmr::monotonic_buffer_resource arena{buf, sizeof(buf)};</code><br><code>    std::pmr::vector&lt;Item&gt; items(&amp;arena);</code><br><code>    std::pmr::unordered_map&lt;std::pmr::string, int&gt; cache(&amp;arena);</code><br><code>    // ...大量临时数据结构分配...</code><br><code>    // 函数结束 arena 析构 → 一次性回收所有内存</code><br><code>}</code><br><br><strong>关键</strong>：① 栈上 buffer 优先（cache friendly）；② 不够时<strong>fall back 到 upstream allocator</strong>（默认 new/delete）—— 不会崩；③ 整个 arena<strong>不能单个 free</strong> 元素（"<strong>monotonic</strong>" 的含义）。`,
        staff: `深一层：monotonic_buffer_resource 是 C++17 引入的<strong>"零分配请求处理"</strong>核心工具，借鉴自 Andrei Alexandrescu 等 talks。<strong>设计哲学</strong>：① <strong>分配 fast path</strong>：bump pointer，&lt; 5 ns；② <strong>释放是 batch 操作</strong>：整体 reset / destroy；③ <strong>对齐自动处理</strong>（按要求对齐推进指针）。<br><br><strong>vs std::allocator / jemalloc</strong>：<br>· <strong>std::allocator</strong>: 通用，~30-100 ns / allocation，可单独 free<br>· <strong>jemalloc / tcmalloc</strong>: 优化的通用 allocator，~15-50 ns<br>· <strong>monotonic_buffer</strong>: ~5 ns，但只能 batch release<br><strong>适用场景</strong>：① <strong>请求级生命周期</strong>（web server / RPC handler）；② <strong>解析中间对象</strong>（parser tree）；③ <strong>批处理任务</strong>。<br><br><strong>真实经验</strong>：platform agent 每个 RPC 包含多个解析步骤（XML / schema / config diff），<strong>之前用 new/delete</strong>，单 RPC ~80 次 allocation，单 RPC ~50 µs。<br><strong>改造</strong>：① 每个 RPC 处理函数栈上 64KB buffer + monotonic_buffer_resource；② 所有 STL 容器换 pmr 版本；③ string 用 pmr::string；<br><strong>结果</strong>：① RPC 内 allocation 数 ~80 → 1（只 arena 内部偶尔 grow upstream）；② 单 RPC 时延 50 µs → 12 µs（-76%）；③ <strong>P99 抖动</strong>显著降低（allocator 是 P99 主因之一）。<strong>陷阱</strong>：① 容器析构时仍调元素 dtor（不是 0 cost）；② <strong>不能在 arena 销毁后访问</strong>元素；③ pmr 容器跟普通容器不兼容（不同 allocator type）。<strong>替代</strong>：① <strong>fmt::format_to_n</strong> 直接写栈 buffer；② <strong>boost::container::small_vector</strong> 小对象内嵌；③ 自定义 arena（更激进，不走 PMR 抽象层）。`,
      },
      failure_modes: [
        `不知道 arena 不能单个 free（试图 erase 元素期望立刻回收）`,
        `Buffer 太小 → 频繁 fall back upstream → 性能没改善`,
        `pmr 容器跟普通容器混用 → allocator 类型不匹配 → 编译错`,
        `arena 析构后还访问元素 → use-after-free`,
        `期待容器析构 0 cost（实际 dtor 还要调）`,
      ],
      follow_ups: [
        { q: `synchronized_pool_resource 跟 monotonic 区别？`, hint: `① monotonic: 单向推进 + 批量 release，无单 free；② synchronized_pool: 单元素 free，按 size class 分桶，线程安全；适合长期持有 / 元素生命周期不同步` },
        { q: `跟 jemalloc / tcmalloc 怎么选？`, hint: `① 全局 allocator 用 jemalloc / tcmalloc（替代 glibc malloc 通用更快）；② 请求级用 monotonic_buffer 叠加 → 双重优化；③ 不是 either-or` },
        { q: `怎么测 zero-allocation 真的实现了？`, hint: `① 自定义 allocator 加 atomic counter；② 跑测试看 counter 是否 = 0；③ LD_PRELOAD 替换 malloc 计数；④ valgrind --tool=massif` },
      ],
    },

    110: {
      why_asked: `低延迟实战题。能列 7 个 technique 的人有 HFT / 网络设备 / 实时系统经验。`,
      answers: {
        mid: `<strong>7 个技术</strong>：① <strong>启动期预分配</strong>所有 buffer / pool；② 请求级 <strong>arena</strong>（monotonic_buffer_resource）；③ 字符串用 <strong>string_view</strong>；④ 序列化用 <strong>fmt::format_to_n</strong> 写栈 buffer；⑤ 错误用 <strong>std::expected</strong> 不用异常；⑥ <strong>异步日志</strong>；⑦ <strong>测试期 hook malloc</strong> 验证。`,
        senior: `<strong>详细技巧</strong>：<br>① <strong>启动期预分配</strong>：连接池 / 对象池 / message buffer 在 startup 阶段分配，运行期只 borrow / return；<br>② <strong>arena</strong>：见 #108；<br>③ <strong>string_view</strong>：避免短字符串临时拷贝；<br>④ <strong>fmt</strong>: <code>fmt::format_to_n(buf, N, "...", args)</code> 写入栈 buffer，无 dynamic alloc；<br>⑤ <strong>expected vs exception</strong>: 异常对象 heap alloc + unwind 慢；expected 是 stack-only；<br>⑥ <strong>异步日志</strong>（spdlog async / quill）：log call 只 push 到 ring buffer，IO 在后台线程；<br>⑦ <strong>malloc hook</strong>: LD_PRELOAD 替换 malloc 加 abort，测试期验证 hot path 真零分配。`,
        staff: `深一层：零分配请求处理是<strong>低延迟编程的圣杯</strong>，但<strong>不是 absolute zero</strong>—— 是"<strong>请求处理路径上不触发 heap allocator</strong>"。Startup 期分配和 OS 调用（如 syscall）不算。<br><br><strong>典型 hot path budget</strong>（HFT / 网络设备）：<br>· P99 latency &lt; 10 µs / order<br>· allocations / request: 0<br>· cache lines touched: &lt; 50<br>· system calls: 0（用户态网络栈如 DPDK）<br><br><strong>真实经验</strong>：platform agent low-latency 模式实施 7 技术：<br>① 启动期 message pool 10k 个 buffer；② 每 RPC monotonic_buffer 64KB；③ string_view 替代 90% string 临时；④ fmt 写响应；⑤ expected 替代 80% 异常路径（保留 catastrophic exception）；⑥ quill 异步日志；⑦ 测试 LD_PRELOAD malloc-counter 验证。<br>结果：P99 from 280 µs → 35 µs（-87%），P99.9 from 1.2 ms → 50 µs。<br><br><strong>陷阱</strong>：① <strong>library 内部仍 alloc</strong>（如某些 OpenSSL 函数）→ 用 perf record 或 mtrace 找；② <strong>std::function captures by value</strong> 可能 heap alloc → 用 small lambda + std::move_only_function；③ <strong>locale / iostream / printf</strong> 都 alloc → fmt + 自定义 stream；④ <strong>thread local storage</strong> 初次访问可能 alloc。<strong>工具</strong>：① <strong>perf record + tools/perf-malloc-hook</strong>；② <strong>jemalloc stats</strong>；③ <strong>heaptrack</strong>；④ <strong>Linux strace -e trace=memory</strong>。<strong>哲学</strong>：① 不要预 optimize（先 profile）；② Hot path 100% 验证；③ Cold path 接受标准分配。`,
      },
      failure_modes: [
        `不 profile 直接堆 7 技术（很多场景不需要这么 extreme）`,
        `用 std::function 不知道 heap capture → hot path 偷偷 alloc`,
        `日志同步写 → 偶发 100 ms 抖动`,
        `Library（OpenSSL / iostream）内部 alloc → 检测不到`,
        `测试期不验证 → 生产偶发 alloc → P99 抖`,
      ],
      follow_ups: [
        { q: `怎么验证零分配？`, hint: `① LD_PRELOAD 自定义 malloc + abort + log；② jemalloc.stats 累计 allocation count；③ 测试期 hook + assert count == 0；④ perf record -e probe:malloc` },
        { q: `异常 vs expected 性能差？`, hint: `① 抛 + catch 一次：1-100 µs（unwind 跨多帧）；② expected check：&lt; 1 ns；③ hot path 频繁错误用 expected；catastrophic / 罕见用 exception 仍可` },
        { q: `异步日志怎么实现？`, hint: `① Producer 写 ring buffer（lock-free）；② Background thread 批量写盘；③ Latency: producer ~50 ns，I/O 异步；④ 工具：spdlog async / quill / NanoLog` },
      ],
    },

    // ============== ABI / 编译 ==============
    113: {
      why_asked: `ABI 基础题。能讲 Itanium ABI mangling 规则的人是真分析过 .so 符号。`,
      answers: {
        mid: `C++ 把<strong>函数名 + 参数类型 + 命名空间 + cv 限定</strong>等编码为<strong>唯一符号名</strong>，用于支持<strong>函数重载 / 命名空间 / 模板</strong>。例如 <code>foo(int)</code> mangled 为 <code>_Z3fooi</code>（Itanium ABI）。`,
        senior: `<strong>为什么需要</strong>：C 语言只有函数名作为 link 符号；C++ 因为 <strong>function overload</strong>（同名不同参）必须 mangling 才能让 linker 区分。<br><strong>Itanium ABI（GCC / Clang Linux）</strong>：<br>· <code>_Z</code> 开头<br>· 数字 = 名字长度<br>· 类型简写：<code>i</code> = int / <code>l</code> = long / <code>P</code> = pointer / <code>R</code> = reference / <code>K</code> = const<br>例：<code>void foo(int, const char*)</code> → <code>_Z3fooiPKc</code>。<br><strong>MSVC ABI</strong>：完全不同的语法（<code>?foo@@YAXHPBD@Z</code>），<strong>跨编译器不兼容</strong>。`,
        staff: `深一层：name mangling 不仅编码<strong>函数签名</strong>，还编码：<br>· <strong>命名空间</strong>（namespace foo:: → mangled 含 N_foo）<br>· <strong>类成员函数</strong>（class Bar::method → N_Bar_method）<br>· <strong>模板参数</strong>（vector&lt;int&gt;::push_back → 含 NS_v_E_i）<br>· <strong>const / volatile / ref qualifier</strong><br>· <strong>异常 specification</strong>（noexcept，C++17 起是签名一部分）<br><br><strong>实战工具</strong>：<br>① <code>nm -C binary</code>：列出符号 + demangled 名字<br>② <code>c++filt</code>：手动 demangle（<code>echo _Z3fooi | c++filt</code> → "foo(int)"）<br>③ <code>readelf -Ws</code>：详细符号表 + 大小<br>④ <code>abidiff</code>：比较两个 .so 的 ABI 兼容性<br><br><strong>真实经验</strong>：电信项目 customer 反馈 "你的新版本 .so 不能 link 我们老的 caller"。我用 <code>abidiff old.so new.so</code> 发现一个 public class 加了 private 成员 → sizeof 变 → mangled name 不变但 ABI 破坏。Customer 老 caller 用旧 sizeof，运行时 layout 错。<strong>对策</strong>：① 用 Pimpl 隔离实现（见 #20）；② CI 加 abidiff 自动检测。<strong>陷阱</strong>：① <strong>extern "C" 禁 mangling</strong>—— 跨编译器 / 跨语言（Python / Go via cgo）接口必备；② <strong>inline function</strong> mangling 包含 instantiation context，跨 .so 可能多份；③ <strong>template instantiation</strong> 在每个 user TU 都生成 mangled 符号 → 二进制膨胀 → explicit instantiation 可控制。`,
      },
      failure_modes: [
        `Cross-编译器（GCC + MSVC）共享 C++ 库 → mangling 不同 → link fail`,
        `跨 .so 暴露 std::string / std::vector → 不同 libstdc++ 版本布局不同`,
        `Class 加 private 成员认为是兼容（实际 sizeof 变 → 老 caller 用错位）`,
        `不用 abidiff 检测 ABI break → 客户报错才知`,
        `Template heavy 库不 explicit instantiation → 二进制膨胀 / 编译慢`,
      ],
      follow_ups: [
        { q: `怎么用 c++filt？`, hint: `① 单符号：<code>c++filt _Z3fooi</code>；② 批量：<code>nm binary | c++filt</code>；③ 选择 ABI：<code>c++filt -p</code> Itanium / <code>--format=ms</code> MSVC` },
        { q: `extern "C" 影响 mangling 怎么？`, hint: `① 完全禁 mangling，符号名 = 函数名（C 风格）；② 不能 overload（同名只能一个）；③ 必须 namespace 中或 file scope 显式包；④ 不能模板 / 类成员` },
        { q: `Inline function 跨 .so 怎么处理？`, hint: `① 每个 user TU 生成自己的实例化（vague linkage）；② Linker 合并重复符号（COMDAT）；③ 如果两个 .so 版本不同 → ODR violation → UB；解：用 visibility=hidden + 不 inline 跨边界` },
      ],
    },

    114: {
      why_asked: `必考。能讲"禁 mangling + 必要场景"完整 3 个的人是真做过 C/C++ 混编。`,
      answers: {
        mid: `<strong>禁止 name mangling</strong>，让 C++ 函数能被 <strong>C 代码</strong>调用或调用 C 函数。<strong>必要场景</strong>：① 给 C 暴露接口；② <code>dlsym</code> 需要稳定符号名；③ POSIX / Win32 API 头（C 风格）。`,
        senior: `<strong>语法</strong>：<br><code>extern "C" void foo(int);</code>（单函数）<br><code>extern "C" { void foo(); void bar(); }</code>（块）<br><strong>头文件双兼容</strong>：<br><code>#ifdef __cplusplus</code><br><code>extern "C" {</code><br><code>#endif</code><br><code>void foo(int);</code><br><code>#ifdef __cplusplus</code><br><code>}</code><br><code>#endif</code><br>—— C 编译器看不到 extern "C"，C++ 编译器看到。<strong>限制</strong>：extern "C" 函数不能 overload / 不能是类成员 / 不能模板。`,
        staff: `深一层：extern "C" 是 <strong>跨语言互操作的基石</strong>。<strong>常见场景</strong>：<br>① <strong>C++ 库给 C 用</strong>（如 SQLite C API for C++ implementation）<br>② <strong>给 Python / Rust / Go 等语言 binding</strong>（这些语言通常只能通过 C ABI 调）<br>③ <strong>dlsym</strong> / <strong>GetProcAddress</strong> 动态加载需要稳定符号名<br>④ <strong>kernel / driver 接口</strong>（多 C 风格）<br>⑤ <strong>跨编译器 .so 边界</strong>（GCC 编译的库给 MSVC caller）<br><br><strong>跨边界的限制 + 注意</strong>：<br>① <strong>不能传 C++ 类型</strong>（std::string / std::vector / std::map）—— C 看不懂；只能传 C 类型（int / char* / struct）+ opaque pointer<br>② <strong>不能 C++ 异常逃逸</strong>—— C 不能 catch，UB；必须 catch all + 转 error code<br>③ <strong>C++ 类的方法不能 extern "C"</strong>（类成员有 implicit this）—— 必须包 free function：<code>extern "C" void Foo_method(Foo* obj, int arg) { obj-&gt;method(arg); }</code><br>④ <strong>RAII 不跨边界</strong>—— C 调用方不会自动析构，必须 explicit destroy 函数<br>⑤ <strong>calling convention</strong>—— Windows 上要明确 __stdcall / __cdecl<br><br><strong>真实经验</strong>：platform agent SDK 给客户用，需支持 C / C++ / Python / Go binding。设计了纯 C ABI shim：<br>1) Header 全部 <code>extern "C"</code> + opaque handle <code>typedef struct NCAgent NCAgent;</code><br>2) 创建 / 销毁：<code>NCAgent* nc_create(); void nc_destroy(NCAgent*);</code><br>3) 操作：<code>int nc_send_rpc(NCAgent*, const char* rpc_xml, char* response_buf, size_t buf_size);</code><br>4) 异常 catch all：<code>try { ... } catch (const std::exception&amp; e) { strncpy(err_buf, e.what(), n); return -1; }</code><br>5) Python ctypes / Go cgo 直接调即可。<br>结果：单一 C 头文件，5 平台都能用。`,
      },
      failure_modes: [
        `extern "C" 内部仍传 std::string / std::vector → 跨边界 UB`,
        `C++ 异常逃逸到 C 调用方 → 立即崩 / UB`,
        `期待 extern "C" overload 同名函数 → 编译错`,
        `RAII 类对象给 C 调用方 → 没自动析构 → 泄漏`,
        `头文件没 #ifdef __cplusplus → C 编译器卡 extern "C"`,
      ],
      follow_ups: [
        { q: `extern "C++" 是什么？`, hint: `跟 extern "C" 对应，明确 C++ linkage；很少显式写（默认就是）；主要在 extern "C" 块内部需要嵌入 C++ 函数时用：<code>extern "C" { extern "C++" void cpp_only(); }</code>` },
        { q: `Calling convention 怎么处理？`, hint: `① Windows 历史多种：__cdecl / __stdcall / __fastcall / __thiscall；② extern "C" 不指定 convention，要 explicit <code>extern "C" __stdcall void foo();</code>；③ Linux 通常只 cdecl，无需指定` },
        { q: `怎么让 C++ class 给 C 用？`, hint: `① Opaque handle (forward decl + extern "C" 工厂函数)；② OOP pattern via "method" free function + handle as first arg；③ 见 #22 详细模式` },
      ],
    },

    189: {
      why_asked: `工程级题。能讲 5 类 ABI 陷阱 + 解法的人是真维护过 SDK / 大型 .so。`,
      answers: {
        mid: `<strong>5 类陷阱</strong>：① <strong>类成员变化</strong>（sizeof / 成员偏移变）→ 调用方未重编 = 崩；② <strong>虚函数表变化</strong>；③ <strong>inline 函数版本不一致</strong>（ODR violation）；④ <strong>STL 类型跨编译器不兼容</strong>（libstdc++ vs libc++ 的 string 实现不同）；⑤ <strong>异常类型跨 .so 边界</strong>。<br><strong>解法</strong>：Pimpl + extern "C" 边界。`,
        senior: `<strong>每类详解</strong>：<br>① <strong>类成员变化</strong>：加 public / private 成员都改 sizeof → 老 caller 用错位偏移；解：Pimpl（pImpl 是 8 字节稳定 ptr）<br>② <strong>vtable 变化</strong>：加 / 删 / 重排 virtual 函数 → vtable offset 全乱；解：vtable 一旦发布<strong>永不改</strong>，加新方法只能在末尾追加，不删<br>③ <strong>inline 版本不一致</strong>：A.so 编译时 caller header v1，B.so 用 v2 → 内联展开版本不同 → ODR violation → 运行时随机错<br>④ <strong>STL 类型跨边界</strong>：GCC libstdc++ string SSO 16 字节 vs Clang libc++ string SSO 24 字节 → ABI 不兼容；解：library boundary 不暴露 STL，用 C ABI + opaque<br>⑤ <strong>异常跨 .so</strong>：异常对象内含 typeid，跨编译器 typeid 不一致 → catch 不到 / 错位`,
        staff: `深一层：ABI 兼容性是<strong>共享库设计最难的部分</strong>。<strong>语义化版本</strong>规则：① patch（z）：bug fix，ABI 不变；② minor（y）：API 新增，ABI 不变；③ major（x）：ABI 破坏，caller 必须重编。<br><br><strong>工程实践</strong>：<br>① <strong>Pimpl</strong>：public class 只持有 unique_ptr&lt;Impl&gt;，Impl 在 .cpp 里随意改；<br>② <strong>extern "C" 边界</strong>：跨 .so 接口纯 C ABI；<br>③ <strong>inline namespace</strong>：版本化命名空间 <code>namespace lib { inline namespace v1 { class Foo; } }</code>，升级时 v1 → v2 同时保留；<br>④ <strong>visibility 控制</strong>：<code>-fvisibility=hidden</code> + <code>__attribute__((visibility("default")))</code> 标记 public 符号；<br>⑤ <strong>CI 自动 abi check</strong>：abidiff / abi-compliance-checker。<br><br><strong>真实经验</strong>：platform agent SDK 维护 5 年期间通过这套实践 <strong>零 ABI 破坏事故</strong>：<br>1) 所有 public class 强制 Pimpl<br>2) CI 每 PR 跑 abidiff，break 必须 explicit bump major<br>3) inline namespace v1 / v2 / v3 渐进废弃<br>4) extern "C" 边界给 C / Python / Go bindings<br><br>过去某 patch 加私有成员被 abidiff 拦下 + 红色 warning"this PR breaks ABI"，开发同事意识到，改用 Pimpl 内部加成员。<strong>陷阱</strong>：① <strong>头文件改了 inline 函数</strong>—— ABI break 但 abidiff 检测不出（compiler 在 caller 端实例化）；解：visibility hidden + 不 inline boundary；② <strong>template instantiation 跨 .so</strong>—— 每边各自 inst，ODR 风险；③ <strong>std::string SSO size cross-versions</strong>—— Dual ABI libstdc++ 切换会破坏。`,
      },
      failure_modes: [
        `加成员认为 "我没改 public API" → 实际 ABI 破坏`,
        `跨 .so 边界传 std::string / std::vector → ABI 不兼容`,
        `异常跨 .so → typeid 不一致 → catch fail`,
        `不用 abidiff → release 后客户报错`,
        `inline 函数实现改了不 bump 版本 → 客户混版本 ODR violation`,
      ],
      follow_ups: [
        { q: `Pimpl 性能代价多少？`, hint: `① 每方法 +1 indirect call ~ 1 ns；② 一次堆分配（构造时）；③ hot path 可能可察觉；④ ABI boundary 库必须用，性能敏感的 inline 库慎用` },
        { q: `Dual ABI (libstdc++ _GLIBCXX_USE_CXX11_ABI) 是什么？`, hint: `GCC 5+ 引入两套 std::string / std::list 实现，编译标志切换；不同 ABI 编译的 .so 链接时符号不匹配；整条工具链必须统一` },
        { q: `怎么自动检测 ABI break？`, hint: `① abi-compliance-checker（HTML 报告）；② libabigail abidiff（精确比较）；③ 集成 CI：baseline.abi 跟 pr.abi 比对，break 失败` },
      ],
    },

    // ============== Sanitizer ==============
    117: {
      why_asked: `ASan 是 C++ 必备工具。能讲 shadow memory + redzone 原理的人是真深入过。`,
      answers: {
        mid: `两机制：① <strong>每次内存访问插桩</strong>，检查 shadow memory；② <strong>shadow memory</strong>: 1 字节影子标记 8 字节真实内存的<strong>有效性</strong>（0 = 全可用，1-7 = 前 N 字节，负值 = 各种 poison）。<strong>红区 (red zone)</strong> 围绕每个分配，越界立刻报警。<strong>UAF</strong>: free 时不立即释放，进 <strong>quarantine</strong> 队列 + shadow 标 freed。`,
        senior: `<strong>详细机制</strong>：<br>① <strong>编译期插桩</strong>：每次内存读写前生成 ~10 行汇编检查 shadow（典型 2× slowdown）；<br>② <strong>shadow memory mapping</strong>：1/8 比例 —— 用户内存 N 字节 → shadow N/8 字节；<br>③ <strong>red zone</strong>：每个 heap allocation 前后各 128 字节"<strong>毒区</strong>"，访问触发 ASan 报警；<br>④ <strong>stack frame 也加 red zone</strong>：局部数组越界一样能检测；<br>⑤ <strong>UAF detection</strong>：free 后不立即归还，放 quarantine 几秒 + shadow poison，再次访问报警。`,
        staff: `深一层：ASan 设计是 Google 2012 年的开源工程，<strong>颠覆性</strong>—— 之前 Valgrind 是 ~50× slowdown，ASan 仅 2× → 能在<strong>开发 / CI / 部分生产</strong>跑。<br><br><strong>覆盖范围</strong>：<br>· <strong>Heap buffer overflow / underflow</strong>（malloc/new 越界）<br>· <strong>Stack buffer overflow / underflow</strong>（局部数组越界）<br>· <strong>Use-after-free</strong>（free 后再访问）<br>· <strong>Use-after-return</strong>（栈对象 escape 给其他线程）<br>· <strong>Use-after-scope</strong>（lifetime 结束后访问）<br>· <strong>Initialization order bugs</strong>（全局对象构造顺序问题）<br>· <strong>Memory leak</strong>（程序退出时统计）<br><br><strong>不能检测</strong>：<br>· <strong>Data race</strong>（→ TSan）<br>· <strong>Uninitialized memory read</strong>（→ MSan）<br>· <strong>Undefined behavior</strong>（→ UBSan）<br><br><strong>使用</strong>：<code>g++ -fsanitize=address -fno-omit-frame-pointer -g -O1 ...</code>。<strong>typical overhead</strong>: CPU 2×, Memory 3×。<strong>生产场景</strong>：① CI 跑全部测试 with ASan；② Canary deployment 10% 流量带 ASan（仅小规模 production）；③ HWASan（ARM 上更便宜）可考虑全 prod。<br><br><strong>真实经验</strong>：platform agent 老代码升级到 ASan 后第一周抓到 13 个 bug，包括 ① 2 个 UAF（shared_ptr 循环引用边缘）；② 5 个 stack buffer overflow（fixed-size 数组 + dynamic input）；③ 6 个 memory leak（exception path 没释放）。<strong>对策</strong>：每个 release 必跑 ASan + TSan + UBSan triple，零容忍报警。<strong>陷阱</strong>：① ASan slow，hot path benchmark 不准（必须分开 perf 和 ASan run）；② false positive 罕见但可能（如自己的 allocator）；③ Production 启用要小心（攻击者可能利用 ASan 检测路径）。`,
      },
      failure_modes: [
        `不在 CI 跑 ASan → bug 进生产才暴`,
        `期待 ASan 检测 race / uninit → 用错工具`,
        `ASan 跟 benchmark 一起跑 → 性能数据不准`,
        `生产长期开 ASan → 2× CPU / 3× memory 浪费`,
        `ASan 报警当 false positive 忽略 → 真 bug 漏掉`,
      ],
      follow_ups: [
        { q: `ASan 性能代价具体？`, hint: `① CPU ~2×（检查 + shadow access）；② Memory ~3×（shadow + redzone + quarantine）；③ Compile time +20-50%；④ Binary size +30-50%；适合 dev / CI / canary` },
        { q: `HWASan 是什么？`, hint: `ARM 上的 ASan：用 ARM 的 top-byte-ignore / Memory Tagging Extension（MTE）做 tagging，比 ASan shadow 便宜 5-10×；生产开销 5-15% → 可用于 production；2026 年 Pixel 已默认开` },
        { q: `GWP-ASan 跟 ASan 区别？`, hint: `GWP-ASan: 随机采样 ~1/10000 allocation 加 red zone，开销可忽略；适合 production 抓 rare bug；Google / Apple 大量使用` },
      ],
    },

    118: {
      why_asked: `TSan 实现原理高级题。能讲 vector clock + happens-before 的人是真理解 race detection。`,
      answers: {
        mid: `每个内存位置 shadow 记录"<strong>上次访问者 + vector clock</strong>"。每个线程维护自己 vector clock + 已知其他线程时刻。<strong>同步操作</strong>（mutex / atomic / cv）合并双方 vector clock。访问内存时检查"<strong>上次访问</strong>"的 vector clock 是否 ≤ 当前 → 否 = race。`,
        senior: `<strong>vector clock 是分布式系统的"逻辑时间"</strong>：N 个线程的 N-元 vector，每个元素是该线程的事件计数。<strong>规则</strong>：<br>① 线程 i 做事件 → 自己的 V[i]++；<br>② 同步操作（mutex unlock / atomic release）→ 携带 vector；<br>③ 接收方（mutex lock / atomic acquire）→ 合并 V[j] = max(local V[j], received V[j])；<br>④ <strong>判断 race</strong>：上次访问的 vector U vs 当前 V，如果 U 不 ≤ V（即至少一个 U[k] &gt; V[k]）→ 没有 hb → race。`,
        staff: `深一层：TSan 用的是 <strong>FastTrack 算法</strong>（2009，Dimitar Dimitrov 等）—— vector clock 的优化版本，单次访问 ~5-10× slowdown（vs 朴素 vector clock 100×+）。<br><br><strong>关键优化</strong>：<br>① <strong>"读"用 epoch</strong>（单时间戳）<strong>不用 full vector</strong>—— 多个读不形成 race，只要记最大；<br>② <strong>"写"用 full vector clock</strong>—— 写跟之前的读 / 写都要查；<br>③ <strong>shadow memory</strong> 跟 ASan 类似，每 8 字节用户内存对应 32 字节 shadow（存上次访问的 epoch / vc + 类型）。<br><br><strong>覆盖能力</strong>：<br>· <strong>Data race</strong>（任何 happens-before 缺失的内存 conflict）<br>· <strong>Deadlock</strong>（lock order inversion）<br>· <strong>Async-signal-unsafe usage</strong><br>· 不检测：deadlock 实际发生（只 detect potential）/ algorithm livelock。<br><br><strong>使用</strong>: <code>g++ -fsanitize=thread -O1 -g</code>。<strong>typical overhead</strong>: CPU 5-15×（更贵于 ASan），Memory 5-10×。<strong>限制</strong>：① 不能跟 ASan 同时用（shadow 冲突），分开 build；② 不识别 lock-free 算法的 fence / hand-rolled sync（需 <code>__tsan_*</code> annotations）；③ ARM 上有 limitations。<br><br><strong>真实经验</strong>：platform agent 一段时间出现"<strong>偶发段错</strong>"，无规律。跑 TSan 在 CI 测试上发现一段无关 race：<code>std::unordered_map&lt;Key, Value&gt;</code> 共享给多线程，一个线程 insert 同时另一个读—— map 内部 rehash 可能让 reader 看到部分 reorganize state。bug fix：加 shared_mutex。<strong>陷阱</strong>：① False positive 比 ASan 多（lock-free 算法 / 自定义 sync 容易触发）；② Production 不建议开（10× slowdown）；③ TSan + jemalloc 兼容性问题 → glibc malloc 跑。<strong>替代</strong>：HelGrind（Valgrind）类似但更慢；DataRaceBench 类的测试套件。`,
      },
      failure_modes: [
        `lock-free 代码用 TSan → 大量 false positive`,
        `跟 ASan 一起 build → shadow 冲突`,
        `Production 长期开 → 10× slowdown`,
        `不 annotate hand-rolled sync → TSan 不知道是真的 sync`,
        `Mutex + atomic 混用 → TSan 报 race 实际上 OK`,
      ],
      follow_ups: [
        { q: `怎么 annotate hand-rolled sync 给 TSan？`, hint: `① <code>__tsan_acquire(addr)</code> / <code>__tsan_release(addr)</code> 显式标记；② <code>ANNOTATE_HAPPENS_BEFORE / AFTER</code>；③ 仅用于真知道 sync 正确的代码（否则 mask 真 bug）` },
        { q: `RR-record-replay 跟 TSan 关系？`, hint: `① RR：record once + deterministic replay；② 能精确复现偶发 race；③ TSan 检测 race 类型；④ 组合用：TSan 找疑似，RR 复现给开发调试` },
        { q: `Java / Go 的 race detector 跟 TSan？`, hint: `① Go race detector 直接用 TSan runtime（实现复用）；② Java 有自己的 ThreadSanitizer + JVM 集成；③ 算法都是 vector clock + happens-before` },
      ],
    },

    // ============== I/O ==============
    124: {
      why_asked: `Linux 网络编程必考。能讲清"ET 必须读到 EAGAIN"的人是真写过非阻塞服务器。`,
      answers: {
        mid: `<strong>LT (level-triggered, 默认)</strong>: 只要 fd 可读 / 写就<strong>持续通知</strong>。<br><strong>ET (edge-triggered)</strong>: 仅<strong>状态变化时通知一次</strong>，必须读到 <strong>EAGAIN</strong> 才停（否则丢事件）。<br>ET 更快但更难写，<strong>必须配非阻塞 IO</strong>。`,
        senior: `<strong>ET 工作流</strong>：<br>1) fd 从"不可读"变"可读" → epoll 通知一次<br>2) 程序 read 一次：如果 read 返回 N（&lt; buffer size）—— 不知道是不是读完了，必须再 read<br>3) 继续 read 直到返回 <strong>EAGAIN / EWOULDBLOCK</strong>（"现在没数据了"）<br>4) 否则下次 epoll 不通知，<strong>剩余数据"卡住"</strong>直到下次状态变化<br><br><strong>性能差异</strong>：LT 每个事件可能多次唤醒 epoll；ET 仅一次。高 QPS 服务器 ET 节省 syscall。<strong>风险</strong>：ET 漏读 → 连接 hang，bug 难定位。`,
        staff: `深一层：ET 是"<strong>边沿触发</strong>" 哲学的 IO 应用——只通知<strong>变化</strong>不通知<strong>状态</strong>。这种设计在 OS / 硬件抢占性事件机制里常见（中断也是边沿触发版本）。<br><br><strong>实战 ET 模板</strong>：<br><code>while (true) {</code><br><code>    ssize_t n = read(fd, buf, sizeof(buf));</code><br><code>    if (n &gt; 0) { process(buf, n); }</code><br><code>    else if (n == 0) { close(fd); break; }  // EOF</code><br><code>    else if (errno == EAGAIN) { break; }  // no more data, exit loop</code><br><code>    else { /* error */ break; }</code><br><code>}</code><br><br><strong>必须配套</strong>：① <code>fcntl(fd, F_SETFL, O_NONBLOCK)</code>—— 非阻塞，否则 ET 读到没数据时<strong>整线程 block</strong>；② accept ET 也要循环—— 新连接同样可能"<strong>批量到</strong>"。<br><br><strong>真实经验</strong>：platform agent 初版用 LT，10k 连接时 epoll_wait CPU ~15%。改 ET 后 ~5%（节省 syscall）。但<strong>第一周出过一次事故</strong>：write 后没循环到 EAGAIN，对端等不到剩余数据 → connection hang → load balancer health check 失败。Fix 后加了<strong>统一的 read/write loop 抽象</strong>避免人为漏循环。<strong>选型建议</strong>：① 简单 / 中等性能场景 LT（不易出错）；② 高 QPS 服务器 ET + 严格 review；③ 极致性能 → io_uring（见 #125）。<strong>陷阱</strong>：① ET write 也要循环（write 满返回 EAGAIN 时必须 epoll wait）；② <strong>EPOLLONESHOT</strong> 多线程场景必备（避免多线程同时处理同 fd）；③ <strong>edge-triggered 实战</strong> 比 level 多 ~50% 代码量。`,
      },
      failure_modes: [
        `ET 不读到 EAGAIN → 剩余数据"卡住" → 连接 hang`,
        `ET 不配 O_NONBLOCK → read 阻塞整线程`,
        `accept ET 不循环 → 批量新连接漏接`,
        `多线程 + ET 不用 EPOLLONESHOT → 多线程同时处理同 fd 数据竞争`,
        `ET write 不处理 EAGAIN → silently lose 数据`,
      ],
      follow_ups: [
        { q: `EPOLLONESHOT 怎么用？`, hint: `① 一次性事件（处理完后该 fd 不再通知）；② 处理完后需 epoll_ctl(MOD) 重新加入；③ 多线程场景防止 thundering herd；典型用法搭配 ET` },
        { q: `epoll 跟 select / poll 区别？`, hint: `① select：fd_set 限制 1024 + 每次 O(n) scan；② poll：无限制但仍 O(n)；③ epoll：O(1) lookup + edge/level；④ 大并发（&gt; 1000）必用 epoll；少 fd 时 select/poll 简单` },
        { q: `kqueue / IOCP 跟 epoll 关系？`, hint: `① BSD kqueue：类似 epoll 但 API 不同；② Windows IOCP：真异步（完成端口），跟 io_uring 模型更像；③ 跨平台库（libevent / libuv）抽象这些差异` },
      ],
    },

    125: {
      why_asked: `2024-2026 高性能 IO 必考。能讲清 4 大优势的人跟上 Linux IO 演进。`,
      answers: {
        mid: `① <strong>共享内存环</strong>（SQE / CQE），不需要每次 syscall；<br>② <strong>批量提交</strong>多个 IO；<br>③ <strong>polling 模式</strong>（SQPOLL，完全无 syscall）；<br>④ <strong>异步操作</strong>（read / write / accept / connect / openat / ... &gt; 50 种），不限于网络。<strong>高 QPS 场景理论最优</strong>。`,
        senior: `<strong>vs epoll</strong>：<br>· epoll: 仍然每个 IO 操作一次 syscall（read / write 还是阻塞 / 非阻塞）；epoll 只 notify 就绪<br>· io_uring: 提交 (SQE) + 完成 (CQE) 两环，<strong>从提交到完成全 ring 中</strong>，主线程<strong>无 syscall</strong>（或仅 enter syscall 一次唤醒）<br><br><strong>架构</strong>：<br>1) Userspace 写 SQE 到 ring<br>2) Kernel 看到（poll 模式）或被 io_uring_enter 唤醒<br>3) Kernel 异步执行 IO<br>4) 完成时写 CQE 到 ring<br>5) Userspace 从 ring poll CQE`,
        staff: `深一层：io_uring 是 Linux 5.1+ 引入（2019），<strong>从根本上重设计了 Linux IO 模型</strong>。<strong>真实成就</strong>：① 把 Windows 的 IOCP / Solaris 的 event completion 这种"真异步 + 完成通知" model 带到 Linux；② <strong>跨 IO 类型统一</strong>—— 之前网络（epoll）/ 磁盘（aio）各有 API，io_uring 一统；③ <strong>多种增量</strong>：注册 buffer / 注册 fd / fixed file table / SQPOLL（kernel polling 模式，完全免 syscall）。<br><br><strong>性能 vs epoll</strong>：<br>· 极小 IO（&lt; 100 byte）：5-10× faster（syscall overhead 大）<br>· 中等 IO：2-3× faster<br>· 大 IO：相当（IO 本身是瓶颈）<br>· 但<strong>需要 io_uring-aware 库</strong>，移植不便宜<br><br><strong>真实采用情况</strong>（2026）：<br>· <strong>Linux database</strong>：ScyllaDB / Redis Disk-IO / 部分 RocksDB optional<br>· <strong>Web server</strong>：Nginx 实验 / Cloudflare Boring Crypto<br>· <strong>Network</strong>：tigerbeetle / 各种 user-space TCP stack<br>· <strong>主流大厂</strong>：仍 hesitant 因为 ① 安全 CVE 历史多（io_uring 漏洞频繁）；② 需 kernel 5.6+；③ 移植代码量大<br><br><strong>platform agent 评估</strong>：测过 epoll vs io_uring 的 RPC throughput，10k QPS 下 io_uring +28%（每 RPC 多次 small read/write）。但<strong>没投产</strong>：① 客户 RHEL 7 / 8 还在用（kernel 太旧）；② 团队学习曲线；③ 收益对业务不关键（已经 over-deliver SLA）。Decision: 等 RHEL 9 + 普及再说。<strong>陷阱</strong>：① <strong>liburing</strong> wrapper 是事实标准，不要 raw syscall；② <strong>SQPOLL</strong> 模式占一个核 polling，小流量浪费 CPU；③ <strong>安全</strong>：部分公司因 CVE 风险 disable io_uring。`,
      },
      failure_modes: [
        `把 io_uring 当 epoll 用（保持每次 syscall）→ 没收益`,
        `不用 liburing 直接 raw syscall → 复杂度爆`,
        `SQPOLL 模式开但流量低 → 浪费一核 CPU`,
        `期待立即 production-ready → 实际仍受 kernel 版本限制`,
        `安全风险忽视（io_uring CVE 多） → 攻击面增加`,
      ],
      follow_ups: [
        { q: `什么场景应该投资 io_uring？`, hint: `① 极高 QPS（&gt; 100k req/s）+ small IO；② kernel 5.10+；③ 团队愿投入学习；④ Security policy 允许；满足 + 移植 ROI 才有意义` },
        { q: `跟 DPDK / 用户态 TCP stack 比？`, hint: `① io_uring 仍走 kernel TCP/IP，多线程友好；② DPDK 完全 kernel bypass，单 thread 极致延迟（HFT）；③ 选择：HFT → DPDK；通用高性能 → io_uring；普通应用 → epoll` },
        { q: `io_uring 在 macOS / Windows 等价？`, hint: `① macOS 无（不开源 kernel）；② Windows IOCP / Registered IO 类似；③ FreeBSD kqueue（更老 mature）；④ 跨平台抽象层：libuv / Asio / async runtime` },
      ],
    },

    127: {
      why_asked: `Linux 系统调用经典题。能讲清"page cache 直接映射 + page fault 代价"的人理解 VM。`,
      answers: {
        mid: `① 避免一次<strong>内核到用户的拷贝</strong>（mmap 直接映射 <strong>page cache</strong>）；② <strong>大文件随机访问</strong>极快（按需分页）；③ <strong>多进程共享内存</strong>。<br>但<strong>小文件 / 顺序访问</strong> read 更快（mmap 有 <strong>page fault 开销</strong>）。`,
        senior: `<strong>read 流程</strong>：用户调 read → 内核检查 page cache 有数据 → 复制到用户 buffer → 返回。<br><strong>mmap 流程</strong>：mmap 创建 VMA 映射，<strong>不实际加载</strong>；访问页时 page fault → 内核分配 page cache + 读盘 → 设置页表；之后直接访问 page cache（用户视角 = 内存）。<br><br><strong>关键差异</strong>：<br>· read：每次都有一次<strong>内核 → 用户拷贝</strong>（4KB 块 ~ µs）<br>· mmap：<strong>page fault</strong>开销（~ µs）但<strong>仅首次</strong>，后续 cache hit 直接 load 内存`,
        staff: `深一层：mmap vs read 的取舍是<strong>"小固定开销 vs 增量复制开销"</strong>。<br><br><strong>具体场景</strong>：<br>· <strong>顺序读大文件</strong>：read（用 readahead）通常更快——OS 预读 + 流式 copy，单次 syscall 8MB 也只是 ~1ms<br>· <strong>随机访问</strong>：mmap 优势大——只 fault 用到的页，不浪费<br>· <strong>多进程共享只读数据</strong>（如索引）：mmap 必备（共享 page cache，零额外内存）<br>· <strong>实时修改 + 持久</strong>：mmap MAP_SHARED + msync<br>· <strong>小文件</strong>（&lt; 4KB）：read 更快（mmap 至少分配一页）<br><br><strong>陷阱</strong>：<br>① <strong>page fault 不是 free</strong>—— 首次访问 ~ µs；② <strong>TLB miss</strong>—— 大文件随机访问 TLB 频繁刷新（huge page 缓解）；③ <strong>write back</strong>—— MAP_SHARED 修改不立即落盘，msync 强制；④ <strong>file 末尾</strong>—— mmap 到 file size 但 read/write 超出 = SIGBUS（read 是 EOF）。<br><br><strong>真实经验</strong>：platform agent 处理大 schema schema 文件（~ 100MB）：<br>· 老版用 read 整文件 → 100ms（包括 1 次 copy）<br>· 改 mmap：首次随机访问 page faults 慢，但总时间 ~80ms（节省 copy + readahead）<br>· 添加 <code>madvise(MADV_RANDOM)</code> 进一步优化（告诉 kernel 不要 readahead，节省 cache pollution）<br><br><strong>性能 vs 易用</strong>：mmap 错误处理复杂（SIGBUS for out-of-bounds、跨进程同步），<strong>除非性能必需</strong>否则用 read。<strong>2026 现状</strong>：① io_uring 让 read 更高效（接近 mmap 性能 + 异步）；② mmap 仍是<strong>共享只读数据</strong>的最优解（databases / vector search index）。`,
      },
      failure_modes: [
        `小文件用 mmap（page fault 开销 &gt; copy 开销）`,
        `顺序读用 mmap 不加 madvise → 浪费 readahead`,
        `MAP_SHARED 修改不 msync → 进程崩可能数据丢`,
        `期待 mmap 完全无开销（实际有 page fault + TLB miss）`,
        `跨进程 mmap 同一文件不考虑同步 → race`,
      ],
      follow_ups: [
        { q: `MAP_POPULATE 是什么？`, hint: `mmap flag，立即把文件全部加载到 page cache（fault 提前发生），用于"<strong>预热</strong>" + 避免 hot path page fault；代价：mmap 调用变慢` },
        { q: `Huge page 跟 mmap 关系？`, hint: `① mmap 大区域可用 2MB/1GB huge page → 减 TLB miss；② <code>madvise(MADV_HUGEPAGE)</code> 或 <code>mmap MAP_HUGETLB</code>；③ 减少 page fault 次数 + TLB pressure` },
        { q: `mmap 跟 io_uring 怎么选？`, hint: `① 共享只读数据：mmap 仍最优；② 异步写 / 大量小 IO：io_uring；③ 顺序大读：io_uring 或 read with readahead；scenario-driven` },
      ],
    },

    171: {
      why_asked: `网络服务器架构必考。能讲 3 种 Reactor 变体 + Proactor 对比的人是真做过服务器框架。`,
      answers: {
        mid: `IO 复用（epoll）+ 事件分发：<br>① <strong>单 Reactor 单线程</strong>（Redis 风格）；<br>② <strong>单 Reactor 多线程</strong>（Reactor 接收 + 业务 worker 池）；<br>③ <strong>多 Reactor 多线程</strong>（主 Reactor accept + 子 Reactor 处理 IO + worker 池）。<br>类比：<strong>Proactor</strong>（io_uring 风格 —— 真异步，OS 完成后回调）。`,
        senior: `<strong>3 种 Reactor 详细</strong>：<br>· <strong>单 Reactor 单线程</strong>（Redis）：所有 IO + 业务在一个线程；优势：无锁，简单；劣势：业务长操作阻塞所有 IO。<br>· <strong>单 Reactor 多线程</strong>（Memcached）：一个 IO 线程 epoll + N 个 worker 线程；IO 接收后 dispatch 给 worker；劣势：单 epoll 线程是瓶颈。<br>· <strong>多 Reactor 多线程</strong>（Nginx / Netty）：主 reactor accept 后<strong>分发给子 reactor</strong>；子 reactor 各自 epoll 一组连接；最 scalable。<br><br><strong>Proactor</strong>：用户提交"<strong>请求 + 完成回调</strong>"，OS 异步完成后调回调（Windows IOCP / Linux io_uring）。`,
        staff: `深一层：Reactor 模式是<strong>异步 IO 网络编程的事实标准</strong>，2000 年 Doug Schmidt 形式化。<strong>核心机制</strong>：① <strong>事件循环</strong>（epoll_wait）；② <strong>事件类型</strong>（read / write / accept / close）；③ <strong>分发到 handler</strong>（callback / event handler）。<br><br><strong>3 种 Reactor 性能对比</strong>（hypothetical 10k 连接）：<br>· 单线程：CPU bottleneck @ ~50k req/s（单核）<br>· 单 Reactor 多线程：~150k req/s（IO 单线程仍瓶颈）<br>· 多 Reactor：~500k+ req/s（多核 scaling）<br><br><strong>Reactor vs Proactor</strong>：<br>· Reactor: "I want to read, tell me when ready"<br>· Proactor: "Read N bytes for me, tell me when done"<br>· Reactor 更通用（任何 OS）；Proactor 性能稍优但需 OS 支持<br><br><strong>真实经验</strong>：platform agent 架构演化：<br>1) <strong>v1</strong>: 单 Reactor 单线程 - 1k 连接 OK，10k 时单核 100%<br>2) <strong>v2</strong>: 单 Reactor + worker pool - 10k 连接 OK，但 IO 线程 80% CPU<br>3) <strong>v3</strong>: 多 Reactor（每 CPU core 一个 sub-reactor）+ worker pool - 50k 连接稳定，CPU 均匀分布<br>4) <strong>v4</strong>（试验）: 移植到 io_uring（Proactor 模式）- 同负载 CPU -30%，但代码复杂度 ↑↑<br><br><strong>chosen</strong>：v3（多 Reactor）— 性能足够 + 维护成本可控。<strong>主流框架</strong>：<br>· <strong>Boost.Asio</strong>: Reactor + Proactor 抽象（Linux epoll / Windows IOCP / Linux io_uring）<br>· <strong>libuv</strong>: Node.js 用，类似 abstraction<br>· <strong>seastar</strong>: per-core sharded reactor (ScyllaDB)，极致性能<br>· <strong>folly::AsyncSocket</strong>: Facebook 的高性能 reactor<br><br><strong>陷阱</strong>：① reactor 内不能阻塞调用（导致 head-of-line blocking）；② callback hell（C++20 协程缓解）；③ 跨线程 dispatch 开销不能忽略。`,
      },
      failure_modes: [
        `Reactor 内做 CPU-bound 业务 → 所有 IO 卡住`,
        `单 Reactor 多线程 → IO 线程瓶颈，多线程意义不大`,
        `Multi-Reactor 但 connection 不均匀分发 → 部分 sub-reactor 闲`,
        `Reactor 内的 callback 嵌套 → 难维护（callback hell）`,
        `Proactor 在 Linux 上没 io_uring 试图模拟 → 退化为 Reactor 性能`,
      ],
      follow_ups: [
        { q: `怎么实现 Multi-Reactor 的 connection 分发？`, hint: `① Round-robin（最简单）；② Sticky by hash（同 client 总到同 reactor，方便 stateful）；③ Least-connection（动态平衡）；④ SO_REUSEPORT（kernel 帮你 hash distribute）` },
        { q: `事件循环跟协程关系？`, hint: `① 事件循环 = 调度器 + 回调；② 协程 = 把"挂起 + 恢复"写成同步语法；③ 组合：reactor 触发事件 → resume 等待的 coroutine；C++20 协程 + Asio 就是这个模式` },
        { q: `Tornado / asyncio 风格的事件循环 vs Reactor？`, hint: `本质相同（都是 epoll 之上的事件分发）；Python asyncio 借鉴 Reactor / Proactor 模式；Tornado 是 Reactor 在 Python 的实现` },
      ],
    },

    // ============== 系统 ==============
    129: {
      why_asked: `Linux 系统编程基础题。能讲 fd table copy / file struct shared / offset shared 三层的人理解 Unix process model。`,
      answers: {
        mid: `子进程<strong>继承</strong>父进程的 <strong>fd table 拷贝</strong>，但<strong>都指向同一 file struct</strong> → <strong>共享 file offset</strong>。read / write 的 offset <strong>影响双方</strong>。close 一方<strong>不影响</strong>另一方（除非引用计数到 0）。`,
        senior: `<strong>Linux fd 三层结构</strong>：<br>1) <strong>fd table</strong>（per-process）：fd 数字 → file struct 指针<br>2) <strong>file struct</strong>（system-wide）：含<strong>file offset</strong> + flags + 引用计数 + inode 指针<br>3) <strong>inode</strong>（per-file）：文件元数据 + 数据块映射<br><br><strong>fork 时</strong>：① fd table copy → 每个 fd 仍指向 file struct；② file struct 引用计数 +1 → <strong>共享</strong>；③ inode 共享（一直就是）。<br><strong>结果</strong>：父子各 fd 独立，但<strong>读写同一文件偏移</strong>—— 如果父子都 read，offset 互相影响。`,
        staff: `深一层：fd 共享 + offset 共享是 Unix 设计的<strong>核心</strong>，影响多个场景：<br><br>① <strong>shell pipe</strong>：<code>cmd1 | cmd2</code> 实际是 cmd1 / cmd2 共享一个 pipe fd（fork 后），写 / 读独立<br>② <strong>双向 communication</strong>：socket pair fork 后，父子双向通信<br>③ <strong>stdio redirect</strong>：<code>./prog &gt; file</code> 实际是 shell 在 fork 后 dup2 file 到 fd 1，然后 exec<br><br><strong>关键陷阱</strong>：<br>· <strong>父子同 read 一文件</strong> → offset 共享 → 各自 read 1KB 实际是读不同部分（offset 累计）<br>· <strong>父子都 close 同一 fd</strong> → 都 close 才真正释放底层 file struct（引用计数）<br>· <strong>exec 后 fd 默认保留</strong>（除非 FD_CLOEXEC flag）→ 安全风险 + 资源泄漏<br><br><strong>O_CLOEXEC</strong>: <code>open(..., O_CLOEXEC)</code> 让 fd 在 exec 时自动关闭（Linux 2.6.23+）—— <strong>新代码必加</strong>，避免 fd leak。<br><br><strong>真实经验</strong>：platform agent 老代码 fork worker 进程时<strong>没加 O_CLOEXEC</strong>，导致 worker 进程继承了 parent 的所有 fd（包括 log file、socket 等）→ ① 资源泄漏（child 死了 fd 不释放）；② 安全（child 能访问 parent's 网络 socket）。修复加 O_CLOEXEC 后正常。<br><br><strong>fork + exec 模式</strong>：<br>· Linux：fork() + exec() 标准 pattern<br>· macOS：posix_spawn 推荐（避免 fork 一次完整 copy）<br>· Windows：CreateProcess（无 fork 概念）`,
      },
      failure_modes: [
        `期待父子 read 同文件互不影响（实际 offset 共享）`,
        `不加 O_CLOEXEC → child exec 后继承所有 fd → 资源泄漏 + 安全风险`,
        `多线程程序 fork → fork 只 copy 当前线程 → child 半状态 → undefined`,
        `fork bomb（无限制 fork） → 资源耗尽`,
        `child 不 close 不需要的 fd → file struct 引用计数不降 → 仿佛 leak`,
      ],
      follow_ups: [
        { q: `dup / dup2 / dup3 区别？`, hint: `① dup(fd)：复制到最小可用 fd；② dup2(oldfd, newfd)：复制到指定 fd（atomic close + dup）；③ dup3(... O_CLOEXEC)：加 flag 控制；redirect IO 用 dup2` },
        { q: `posix_spawn 跟 fork+exec 区别？`, hint: `① posix_spawn：单 syscall 替代 fork+exec，更高效（没整个 process copy）；② macOS 推荐；③ Linux 上 implementation 通常仍是 fork+exec，但 atomic` },
        { q: `多线程 fork 安全吗？`, hint: `不太安全：① fork 只 copy 当前 thread，其他 thread 不存在于 child；② child 中持有的 mutex 可能是 locked 状态（never unlocked）；③ 推荐 fork 后立即 exec 不做其他事，或者用 posix_spawn` },
      ],
    },

    // ============== 网络 ==============
    172: {
      why_asked: `高性能 IO 题。能讲 4 种 + 各自适用场景的人是真做过 zero-copy 优化。`,
      answers: {
        mid: `4 种：① <strong>sendfile</strong>：file fd → socket fd，内核直接搬，不经用户空间；② <strong>splice</strong>：通用管道（任意两个 fd 之间）；③ <strong>mmap + write</strong>：用户态见到数据但不拷贝到 socket；④ <strong>SO_ZEROCOPY</strong>：send 时 page-flip，不拷贝。`,
        senior: `<strong>具体场景</strong>：<br>· <strong>sendfile</strong>: 文件下载服务器经典（Nginx static file），<strong>2 次拷贝省成 0 次</strong>（disk → page cache → socket buffer 仍有，但用户空间不拷贝）<br>· <strong>splice</strong>: pipe 中间介质，更通用（如 socket → pipe → file）<br>· <strong>mmap + write</strong>: 用户态需要 inspect data + 发送，省 read 那一次拷贝<br>· <strong>SO_ZEROCOPY</strong>: send/sendmsg 时 kernel 不拷贝用户 buffer，page-flip + async notify when complete<br><br><strong>典型收益</strong>：1GB 文件传输节省 ~2GB memory bandwidth + ~ms CPU。`,
        staff: `深一层："零拷贝"是相对的—— 减少<strong>用户 ↔ 内核</strong>的拷贝，但<strong>内核内部</strong>（page cache → socket buffer → NIC DMA）仍可能有拷贝。<strong>真正零拷贝</strong>需要 ① DPDK / RDMA 用户态 NIC 驱动；② splice + pipe + sendfile 组合（避免 socket buffer 中间步骤）。<br><br><strong>各方案细节</strong>：<br>① <strong>sendfile</strong>（Linux 特有）：<code>sendfile(out_fd, in_fd, offset, count)</code>—— out_fd 必须 socket，in_fd 任意 file。<br>② <strong>splice</strong>（Linux 2.6.17+）：<code>splice(fd_in, off, fd_out, off, len, flags)</code> 一边必须是 pipe；通过 pipe 中介实现任意 fd 间。<br>③ <strong>mmap + write</strong>：自由度高但<strong>write 仍有 user→kernel copy</strong>，只省 read 的 copy。<br>④ <strong>SO_ZEROCOPY</strong>（Linux 4.14+）：send + MSG_ZEROCOPY，kernel 不立即 copy，完成时通过 socket error queue 通知（poll EPOLLERR）。<strong>注意</strong>：send 返回后 user buffer 不能立即修改！<br><br><strong>真实经验</strong>：platform agent telemetry 流式传输（大量 device data 100MB+ files）：<br>· baseline read + send: ~80% CPU on socket / file IO<br>· sendfile: CPU -40%（省 user space copy）<br>· splice + pipe: 类似 sendfile 效果<br>· SO_ZEROCOPY: 试过但 callback complexity 高 + 收益边际<br>· 最终选 sendfile（简单 + 收益大）<br><br><strong>陷阱</strong>：① sendfile 不能修改 file data（pure file → socket）；② splice 涉及 pipe 中介，pipe buffer 有限；③ SO_ZEROCOPY <strong>send 后不能立即修改 user buffer</strong> → 需要异步生命周期管理；④ TLS 加密让 sendfile 失效（kTLS 是解决方案，加密在 kernel）。`,
      },
      failure_modes: [
        `用 sendfile 但需要修改 data（实际只能 raw file content）`,
        `SO_ZEROCOPY 后立即修改 user buffer → data corruption`,
        `splice 中介 pipe buffer 小（默认 64KB）→ 性能没改善`,
        `TLS 让 sendfile 失效（kTLS 解决）`,
        `认为"零拷贝就 0 cost" → 实际只是减 user-kernel copy`,
      ],
      follow_ups: [
        { q: `RDMA 跟 zero-copy 关系？`, hint: `① RDMA = Remote Direct Memory Access，硬件级 zero-copy；② 一台机的内存直接写到另一台（NIC 处理）；③ 跳过双方 OS kernel；④ 适合 HPC / 存储集群` },
        { q: `kTLS 是什么？`, hint: `① kernel TLS：TLS 加密 / 解密在 kernel 完成（typically 用 AES-NI 硬件指令）；② 可继续用 sendfile（kernel 加密后发）；③ Linux 4.13+ 支持；④ Nginx / Netflix 大量用` },
        { q: `跨平台 zero-copy？`, hint: `① macOS：sendfile（语义稍异）；② Windows：TransmitFile；③ libuv / asio 抽象（不是所有 backend 都 zero-copy）；④ 跨平台代码可能 fallback 到 read + send` },
      ],
    },

    256: {
      why_asked: `网络安全基础。能讲完整 TLS 1.2 5 步 + 1.3 差异的人是真懂 TLS。`,
      answers: {
        mid: `<strong>TLS 1.2 简化版</strong>：① 客户端 <strong>ClientHello</strong>（含支持的加密套件 + 随机数 client_random）；② 服务端 <strong>ServerHello</strong>（选定套件 + server_random + 证书）；③ 客户端验证证书 → 生成 <strong>pre_master</strong>，用服务端公钥加密发回；④ 双方用 client_random + server_random + pre_master 推出<strong>会话密钥</strong>；⑤ 用对称密钥（AES）加密后续应用数据。`,
        senior: `<strong>5 步完整</strong>：<br>1) <strong>ClientHello</strong>: 客户端发支持的版本 / cipher suites / random / extensions（SNI 等）<br>2) <strong>ServerHello + Certificate + ServerHelloDone</strong>: 服务端选 cipher + random + 证书链<br>3) <strong>ClientKeyExchange</strong>: 客户端验证证书（链 / 时效 / hostname）+ 生成 pre_master + 用证书公钥加密发回<br>4) <strong>ChangeCipherSpec + Finished</strong>: 双方切换到对称加密 + 用 hash of 之前 messages 验证<br>5) <strong>Application Data</strong>: 用对称密钥（AES-GCM 等）加密后续<br><br><strong>密钥推导</strong>: <code>master_secret = PRF(pre_master, "master secret", client_random || server_random)</code>; <code>session_key = PRF(master_secret, "key expansion", server_random || client_random)</code>。`,
        staff: `深一层：TLS 1.3（2018 RFC 8446）<strong>大幅简化 + 加速</strong>：<br>① <strong>0-RTT</strong>（先发后认证，可选）<br>② <strong>1-RTT handshake</strong>（vs TLS 1.2 的 2-RTT）<br>③ <strong>移除老不安全 cipher</strong>（RC4 / MD5 / DES / RSA key exchange）<br>④ <strong>强制 forward secrecy</strong>（必须用 DH / ECDH）<br>⑤ <strong>Encrypted SNI</strong>（ECH，更隐私）<br><br><strong>vs TLS 1.2 的步骤</strong>：1.3 把 ServerKeyExchange / ChangeCipherSpec 等合并；客户端 hello 时已带 key share，服务端立即推 finished。<br><br><strong>实战考虑</strong>：<br>① <strong>HTTPS 性能</strong>：TLS 1.3 比 1.2 快 ~30%（少一个 RTT）；<br>② <strong>HTTP/3 + QUIC</strong>：QUIC 直接集成 TLS 1.3 in transport layer，0-RTT 默认；<br>③ <strong>证书验证</strong>：① 链验证（intermediate → CA root）；② 时效检查（notBefore / notAfter）；③ hostname 验证（Subject CN / SAN）；④ revocation（OCSP / CRL）；<br>④ <strong>cipher suite</strong>：2026 年推荐 AES-128-GCM / ChaCha20-Poly1305（mobile）；<br>⑤ <strong>kTLS</strong>：kernel 处理对称加密，能继续 sendfile。<br><br><strong>真实经验</strong>：RPC over TLS 部署在生产，曾遇到客户老 RHEL 7 默认 TLS 1.0 + weak cipher → 我们 reject → 客户报错。妥协支持 TLS 1.2+ 同时禁用 RC4 / MD5 / DES。<strong>monitoring</strong>：① 监控 TLS version distribution；② 监控 cipher suite usage；③ 证书过期告警（前 30 / 7 / 1 天）；④ <strong>SNI</strong> 加密（ECH）逐步铺开。`,
      },
      failure_modes: [
        `不验证证书 hostname / SAN → MitM 攻击风险`,
        `Pin certificate 但忘了 rotate → 证书过期后客户端拒服务`,
        `Old TLS 1.0 / 1.1 不 disable → 容易降级攻击`,
        `Weak cipher suite（RC4 / MD5 / DES）未 disable`,
        `不监控证书过期 → 突然失效`,
      ],
      follow_ups: [
        { q: `OCSP vs CRL 区别？`, hint: `① CRL: 大文件下载，更新慢，浏览器很少用；② OCSP: 实时查询单证书状态，更快但服务器开销大；③ OCSP stapling: 服务器代查 + 返客户端 → 减少客户端额外查询` },
        { q: `Perfect Forward Secrecy 是什么？`, hint: `① 用 DH / ECDH key exchange，每次会话独立密钥；② 即使长期 RSA private key 泄漏，<strong>历史会话仍安全</strong>；③ TLS 1.3 强制；TLS 1.2 推荐` },
        { q: `mTLS（mutual TLS）怎么用？`, hint: `① 双向证书验证（客户端也必须有证书）；② 配置 SSL_VERIFY_PEER + 要求 client cert；③ 适合 service-to-service（Istio / Consul Connect 等 service mesh）` },
      ],
    },

    // ============== 系统设计 ==============
    148: {
      why_asked: `经典手写 + 系统设计。能讲 list+map O(1) 实现 + thread-safe 扩展的人是真做过。`,
      answers: {
        mid: `核心：<code>list&lt;pair&lt;K, V&gt;&gt;</code> + <code>unordered_map&lt;K, list_iterator&gt;</code>。<br>· <strong>get(k)</strong>: map 找到 iterator → splice 到 list 头部 → 返回 value。<br>· <strong>put(k, v)</strong>: 已存在 → 更新 + 移到头；不存在 → 头插 + map 加入；超容量 → 删尾 + map 删除。<br>都是 <strong>O(1)</strong>。`,
        senior: `<strong>关键代码骨架</strong>：<br><code>template&lt;class K, class V&gt; class LRUCache {</code><br><code>    size_t cap_;</code><br><code>    std::list&lt;std::pair&lt;K, V&gt;&gt; lst_;</code><br><code>    std::unordered_map&lt;K, decltype(lst_)::iterator&gt; map_;</code><br><code>public:</code><br><code>    explicit LRUCache(size_t cap) : cap_(cap) {}</code><br><code>    std::optional&lt;V&gt; get(const K&amp; k) {</code><br><code>        auto it = map_.find(k);</code><br><code>        if (it == map_.end()) return std::nullopt;</code><br><code>        lst_.splice(lst_.begin(), lst_, it-&gt;second);  // O(1) 移到头</code><br><code>        return it-&gt;second-&gt;second;</code><br><code>    }</code><br><code>    void put(K k, V v) {</code><br><code>        auto it = map_.find(k);</code><br><code>        if (it != map_.end()) {</code><br><code>            it-&gt;second-&gt;second = std::move(v);</code><br><code>            lst_.splice(lst_.begin(), lst_, it-&gt;second);</code><br><code>            return;</code><br><code>        }</code><br><code>        if (lst_.size() == cap_) {</code><br><code>            map_.erase(lst_.back().first);</code><br><code>            lst_.pop_back();</code><br><code>        }</code><br><code>        lst_.emplace_front(k, std::move(v));</code><br><code>        map_[k] = lst_.begin();</code><br><code>    }</code><br><code>};</code>`,
        staff: `深一层：LRU 的<strong>设计取舍</strong>：<br>① <strong>容器选择</strong>：<br>· <code>std::list</code>：双向链表，splice 是 <strong>O(1)</strong>，唯一选择（vector / array splice 是 O(n)）<br>· <code>std::unordered_map</code>：哈希表 O(1)，比 map 快（map 是 RB-tree O(log n)）<br>② <strong>iterator stability</strong>：std::list 的 iterator 在其他操作时不失效（只删自己才失效）→ map 存 iterator 安全<br>③ <strong>thread safety</strong>：上面是单线程版；多线程需 <code>std::shared_mutex</code> 或 <strong>分片 LRU</strong>（按 hash 拆 N 段，减锁竞争）<br><br><strong>高级变体</strong>：<br>· <strong>LRU-K</strong>（最近 K 次访问，更精确）<br>· <strong>Segmented LRU</strong>（hot / cold 两段）<br>· <strong>Clock algorithm</strong>（OS page replacement，近似 LRU 但更便宜）<br>· <strong>ARC (Adaptive Replacement Cache)</strong>（LRU + LFU 自适应，IBM）<br>· <strong>TinyLFU / W-TinyLFU</strong>（Caffeine library，2026 SOTA）<br><br><strong>真实经验</strong>：platform agent 实现 device state 缓存（100k devices），最初用上面这种 LRU + 单 mutex：<br>· 单线程性能 ~5M ops/sec<br>· 16 线程并发：~6M ops/sec（mutex 瓶颈）<br>· 改成<strong>分片</strong>（256 个 sub-LRU，每个 sub 自己 mutex）：~80M ops/sec<br>· 进一步用 folly::EvictingCacheMap（lock-free 部分操作）：~150M ops/sec<br><br><strong>陷阱</strong>：① 接 K = std::string，map 多次 hash 浪费 → 用 transparent comparator；② Iterator invalidation 必须懂 list / map 各自规则；③ <strong>memory locality</strong>：std::list 节点散布堆中，cache unfriendly → boost::intrusive::list 或自定义 arena 可改善。`,
      },
      failure_modes: [
        `用 vector 代替 list → splice O(n)`,
        `没用 unordered_map → 退化到 O(log n)`,
        `多线程不加锁 → race`,
        `单 mutex 高并发 → 严重瓶颈（应该分片）`,
        `string key 反复 hash → 不知道 transparent comparator`,
      ],
      follow_ups: [
        { q: `怎么实现 thread-safe LRU？`, hint: `① 简单：std::mutex 包整个；② 分片：N 段独立 LRU + 各自 mutex；③ Lock-free LRU（极复杂，参考 folly EvictingCacheMap）；scenario-driven` },
        { q: `LRU vs LFU 怎么选？`, hint: `① LRU：基于"<strong>最近</strong>"访问，简单常用；② LFU：基于"<strong>频次</strong>"，长期 hot 数据稳定；③ 组合：ARC / TinyLFU 自适应；④ 视访问 pattern 选` },
        { q: `Distributed LRU 怎么做？`, hint: `① Memcached / Redis 内置 LRU eviction；② Consistent hashing 分布数据；③ 每节点本地 LRU；④ 不能保证<strong>全局</strong> LRU（typical 各节点独立）` },
      ],
    },

    149: {
      why_asked: `分布式系统经典题。能讲清"补 + 减"逻辑 + 多线程实现的人是真做过限流器。`,
      answers: {
        mid: `<strong>状态</strong>：当前 token 数 + rate (tokens/sec) + capacity + last_refill_time。<br><strong>acquire(n)</strong>：① 计算 dt = now - last_refill_time；② <strong>补充 tokens = min(capacity, tokens + dt × rate)</strong>；③ 若 tokens ≥ n → 减去返 true；否则返 false。<br><strong>多线程</strong>：atomic + CAS 循环 或 mutex。`,
        senior: `<strong>关键代码</strong>：<br><code>class TokenBucket {</code><br><code>    double rate_;      // tokens / sec</code><br><code>    double capacity_;</code><br><code>    double tokens_;</code><br><code>    std::chrono::steady_clock::time_point last_;</code><br><code>    std::mutex mu_;</code><br><code>public:</code><br><code>    TokenBucket(double rate, double cap) : rate_(rate), capacity_(cap), tokens_(cap), last_(std::chrono::steady_clock::now()) {}</code><br><code>    bool acquire(double n) {</code><br><code>        std::lock_guard lg(mu_);</code><br><code>        auto now = std::chrono::steady_clock::now();</code><br><code>        double dt = std::chrono::duration&lt;double&gt;(now - last_).count();</code><br><code>        tokens_ = std::min(capacity_, tokens_ + dt * rate_);</code><br><code>        last_ = now;</code><br><code>        if (tokens_ &gt;= n) { tokens_ -= n; return true; }</code><br><code>        return false;</code><br><code>    }</code><br><code>};</code><br><br><strong>变体</strong>：① 阻塞 acquire（等到有 token）—— 用 cv；② 限速 burst（capacity &gt; rate）—— 允许短时高并发；③ 分布式 limit（Redis Lua）。`,
        staff: `深一层：限流算法<strong>四大类</strong>：<br>① <strong>Token Bucket</strong>（上面）：允许 burst（capacity 大），平均速率 = rate<br>② <strong>Leaky Bucket</strong>：恒定输出速率（不允许 burst），适合<strong>流量整形</strong>（traffic shaping）<br>③ <strong>Fixed Window Counter</strong>：count requests / minute，简单但<strong>边界突刺</strong>（59.9s 满了 + 60.1s 又满）<br>④ <strong>Sliding Window Log</strong>：精确但内存大（存所有 timestamp）；<strong>Sliding Window Counter</strong>（折中）<br><br><strong>典型选择</strong>：<br>· <strong>API rate limit</strong>: Token Bucket（允许偶尔 burst）<br>· <strong>QPS 平稳输出</strong>: Leaky Bucket<br>· <strong>分布式</strong>: Redis + Lua 实现 Token Bucket（atomic）<br><br><strong>多线程实现</strong>：<br>· <strong>mutex 版</strong>: 上面代码，简单但高并发 bottleneck<br>· <strong>atomic 版</strong>: tokens 用 atomic&lt;double&gt; + CAS loop，复杂但快<br>· <strong>per-thread bucket + 周期合并</strong>: 减少全局竞争，适合 high-throughput<br><br><strong>真实经验</strong>：platform agent 给某 customer 限流 100 RPC/sec（防其 polling script 把 server 打挂）：<br>· Token Bucket capacity 100, rate 100/s<br>· 客户能 burst 100 个，之后稳定 100/s<br>· 用 mutex 版本：1 万 device 同时 polling 时 mutex 竞争 ~5% CPU<br>· 改 atomic CAS loop：CPU &lt; 1%<br>· 边界 case 处理：dt 极大（系统 sleep）→ tokens 立即满，正常；dt 极小（多线程同时进 acquire）→ CAS 重试，正常<br><br><strong>陷阱</strong>：① <strong>steady_clock vs system_clock</strong>—— 必须用 steady（不受时区 / NTP 调整影响）；② tokens / rate 用 double 而非 int —— 支持小数 rate（如 0.5/s）；③ <strong>multiple bucket / hierarchical</strong>—— 每用户 / 每 API / 全局 三层；④ <strong>graceful degradation</strong>—— 超限不要直接 reject，可以 enqueue + slow down。<strong>分布式</strong>：Redis Lua 脚本原子化 token 补 + 减；网关 / API gateway 内置（Kong / Envoy / Istio）。`,
      },
      failure_modes: [
        `用 system_clock → NTP 调整 / 时区切换导致 token 计算错`,
        `tokens / rate 用 int → 不支持小数 rate`,
        `不限制 dt 最大值 → 极长 sleep 后 tokens 溢出（应该 cap 到 capacity）`,
        `分布式场景用本地 bucket → 限流不准（每节点各自限）`,
        `Token Bucket 用于"严格"限流场景（应该 Leaky Bucket）`,
      ],
      follow_ups: [
        { q: `分布式限流怎么实现？`, hint: `① Redis + Lua 脚本（atomic）；② 网关侧（Kong / Envoy）；③ 自建：consistent hashing 路由到固定节点；④ Sliding Window in Redis：用 ZSET 存 timestamps` },
        { q: `Hierarchical rate limit 怎么设计？`, hint: `① 多层 bucket：全局 / 用户 / API；② acquire 时需所有层 acquire 成功；③ 触发限流时返回是哪层（debug 友好）；④ 例：100 RPS 全局 + 10 RPS 每用户 + 5 RPS 每 endpoint` },
        { q: `Algorithm 选择？`, hint: `Token Bucket: allow burst；Leaky Bucket: strict shaping；Fixed Window: 简单但有边界 burst；Sliding Window: 精确无 burst；根据业务 SLA 选` },
      ],
    },

    152: {
      why_asked: `特定项目题，跟你简历背景强相关。能讲 7 个优化点的人就是真做过。`,
      answers: {
        mid: `① 每 RPC 用 <strong>monotonic_buffer arena</strong>（零分配）；② 解析全用 <strong>string_view</strong>；③ 路由表用 <strong>FlatMap</strong>（vector + sort）替代 unordered_map；④ <strong>session 表分片</strong>（减锁）；⑤ <strong>Reactor 单线程</strong> + worker 池；⑥ <strong>异步日志</strong> + 批 flush；⑦ <strong>HdrHistogram</strong> 监控 P99.99。`,
        senior: `<strong>详细说明</strong>：<br>① <strong>arena</strong>：每 RPC 处理在栈上 64KB buffer + monotonic_buffer_resource，所有 STL 容器用 pmr 版本，函数结束整体释放；<br>② <strong>string_view</strong>：schema XML 解析时不拷贝 string，<strong>view 进栈 buffer</strong>；<br>③ <strong>FlatMap</strong>：路由表~1k 条目，FlatMap 比 unordered_map 更 cache-friendly + 更小内存；<br>④ <strong>session shard</strong>：256 个 sub-map，按 session_id hash 分；锁竞争降 256×；<br>⑤ <strong>Reactor</strong>：主线程 epoll + dispatch 到 worker pool；<br>⑥ <strong>quill</strong> 异步日志，producer ~50ns，批 flush；<br>⑦ <strong>HdrHistogram</strong>：精确 P99 / P99.9 / P99.99（vs 简单 percentile 估算）。`,
        staff: `深一层：这套优化让 platform agent 达到 <strong>50k RPC/sec single-machine</strong>（业内 SOTA），P99 latency <strong>&lt; 5ms</strong>。<br><br><strong>关键设计决策</strong>：<br>① <strong>不用 protobuf RPC</strong>—— RPC 是 IETF 标准基于 XML，必须用；优化 XML parser 用 zero-copy + SIMD（rapidxml-ns / pugixml）<br>② <strong>不用 grpc</strong>—— 自己实现 SSH-based session 处理（RPC 用 SSH 而非 HTTP）<br>③ <strong>不分布式</strong>—— 每个 agent 处理 own device set；按 device hash 路由<br>④ <strong>无 SQL 数据库</strong>—— in-memory + WAL，shared-nothing<br><br><strong>性能 baseline 对比</strong>：<br>· 老 vendor agent（Java）：~ 5k RPC/s, P99 &gt; 50ms<br>· 我们 v1（C++ 朴素）：~ 15k RPC/s, P99 ~ 20ms<br>· v2（加上 7 个优化）：~ 50k RPC/s, P99 ~ 4ms<br>· <strong>10× 性能</strong>，1/10 硬件成本<br><br><strong>验证</strong>：① k6 压测 + HdrHistogram 监控；② Linux perf record 验证 hot path；③ jemalloc.stats 验证 zero alloc。<strong>陷阱</strong>：① 优化优先级 —— 先 profile 再优化（不要凭感觉）；② Maintain readability —— 7 个优化都加了详细注释 + Doc；③ Test coverage —— 大量 fuzz + load test 防 regression；④ <strong>"<u>premature optimization is root of all evil</u>"</strong>—— 这套是<strong>有数据支撑的</strong>（之前慢，必须优化），不是 over-engineering。`,
      },
      failure_modes: [
        `优化不 profile 先 → 选错方向 / 没真改善`,
        `所有优化堆一起 → 调试困难 / regression 不知谁的`,
        `优化破坏可读性 → 团队维护成本爆`,
        `不做 benchmark validation → 改了不知有没有效果`,
        `不维护 SLA monitor → 退化不知`,
      ],
      follow_ups: [
        { q: `HdrHistogram 为什么比简单 percentile 准？`, hint: `① 简单方法 sample 全部数据 + sort → 内存 O(n)；② HdrHistogram 用 high dynamic range 桶 → 内存 O(log n)，精度 0.01%；③ Cloudflare / Twitter / 多家在用` },
        { q: `FlatMap vs unordered_map 区别？`, hint: `① FlatMap = sorted vector + binary search，O(log n) lookup；② 比 unordered_map 更 cache friendly（vector contiguous）；③ 适合小 (-1k entries) + 多读少写场景；④ 不适合频繁 insert/delete（O(n) move）` },
        { q: `Session shard 的 key 怎么设计？`, hint: `① 按 session_id 取低位 / 高位（depends on distribution）；② 避免 sequential id 导致 shard 不均；③ 256 shard 是 sweet spot（约等于 typical CPU cores × 16-32）` },
      ],
    },

    // ============== 工程 / 思维 ==============
    173: {
      why_asked: `代码 review 能力题。能给系统化 checklist 的人是真做过 senior C++ review。`,
      answers: {
        mid: `<strong>Checklist 8 项</strong>：① 共享数据是否都被<strong>锁 / atomic</strong>保护？② <strong>锁顺序</strong>一致？③ <strong>cv.wait 带谓词</strong>？④ 析构 / 移动 / swap 是否 <strong>noexcept</strong>？⑤ 异常路径是否 <strong>RAII</strong> 释放资源？⑥ 跨线程对象<strong>生命周期</strong>（shared_ptr 续命）？⑦ <strong>假共享</strong>（atomic 数组对齐）？⑧ 是否真<strong>需要锁</strong>（vs thread_local / lock-free）？`,
        senior: `<strong>每项详细</strong>：<br>① <strong>共享保护</strong>: 看每个非原子写入是否在 lock 内；atomic 用什么 memory order；<br>② <strong>锁顺序</strong>: 注释 / 编码规范明确层次；clang-thread-safety analysis；<br>③ <strong>cv 谓词</strong>: 必须 lambda predicate，防 spurious wakeup；<br>④ <strong>noexcept</strong>: 影响 vector 扩容 / move semantics；<br>⑤ <strong>异常 RAII</strong>: try / catch 内不应该手动 release，全 unique_ptr / lock_guard；<br>⑥ <strong>生命周期</strong>: lambda capture by reference 危险（异步路径）；shared_ptr 续命 + weak_ptr 反查；<br>⑦ <strong>假共享</strong>: 多线程频繁写的 atomic / counter 应 cache line align；<br>⑧ <strong>是否真要锁</strong>: thread_local / immutable / lock-free 数据结构 / functional style 优先。`,
        staff: `深一层：并发 C++ review 是 senior 才能做好的，因为<strong>静态看不出 race，必须脑里跑多线程</strong>。<br><br><strong>个人 review style</strong>：<br>1) <strong>第一遍 scan</strong>：找 atomic / mutex / cv / thread / async / future 关键字 → 这是高风险区<br>2) <strong>逐个 critical section</strong>：写 happens-before 图 + 多个调用顺序模拟<br>3) <strong>异常路径</strong>：每个 catch 想"持锁 / 持资源 状态"<br>4) <strong>cancel / shutdown 路径</strong>：90% 并发 bug 在 shutdown 时暴露<br>5) <strong>跨线程对象</strong>：lambda capture / member function pointer 都要分析 lifetime<br><br><strong>真实案例 1</strong>：review 一段 producer-consumer queue 代码：<br><code>void push(T x) { {std::lock_guard lg(mu_); q_.push(x);} cv_.notify_one(); }</code><br>—— <strong>看似对</strong>，但仔细想：① push 不 noexcept (T 拷贝可能抛) → 加 noexcept 或 move；② <strong>notify after unlock</strong> 是 best practice，但 cv 实现可能要求 lock 内 notify（实测安全），代码本身 OK；③ <strong>full queue</strong>没处理。<br><br><strong>真实案例 2</strong>：lambda capture by reference 跨线程：<br><code>auto p = "..."; thread t([&amp;]() { use(p); });</code> —— 主线程 p 局部变量析构后 t 还在用 → UB。Fix：capture by value 或 std::move。<br><br><strong>工具辅助</strong>：① clang-thread-safety；② TSan 跑 CI；③ Helgrind 偶尔；④ 自己写 lock graph analyzer；<strong>但人脑仍是主力</strong>—— 工具 catch ~70%，30% 的 subtle 案例需要 review。<strong>建议</strong>：① 团队内培训 senior review 这类技能；② 关键并发代码<strong>两人 review</strong>；③ 写明确的 thread safety annotation（doc）；④ 做不动就重写而不是 patch。`,
      },
      failure_modes: [
        `Review 只看语法不脑里跑多线程`,
        `不检查 cancel / shutdown 路径（最易出 bug）`,
        `Lambda capture by reference 跨线程不发现`,
        `cv.wait 不带 predicate 没识别`,
        `noexcept 错误（move 不 noexcept 退化 copy）`,
      ],
      follow_ups: [
        { q: `怎么训练 review 多线程代码的能力？`, hint: `① 多读经典并发 bug case study（Java Memory Model / C++ Memory Model）；② 自己写 + TSan 跑；③ Shadow senior review；④ pair review 关键模块` },
        { q: `怎么 annotate 并发代码？`, hint: `① clang thread safety: <code>__attribute__((guarded_by(mu_)))</code>；② 注释 lock 顺序 + 调用约定；③ Doc：每 public method 标 "thread-safe? guard? blocking?"` },
        { q: `Static analyzer 能 catch 多少？`, hint: `① clang-thread-safety: 显式标注后高准确；② clang-analyzer: 简单 race；③ Coverity: 商业，相对全；④ 仍有 ~30% 需要 dynamic test (TSan) + human review` },
      ],
    },

    174: {
      why_asked: `生产 troubleshoot 题。能讲完整 6 步流程的人是真处理过生产事故。`,
      answers: {
        mid: `<strong>6 步排查</strong>：① 监控 <strong>RSS 增长曲线</strong> + GC 回收特征（对比 jemalloc.stats）；② 看是<strong>慢增长</strong>（泄漏）还是<strong>大段增长</strong>（突发负载）；③ <strong>heap profiler</strong>（jemalloc / tcmalloc）；④ <strong>关键对象统计</strong>（业务侧加 atomic counter）；⑤ <strong>/proc/PID/maps + smaps</strong> 看哪段；⑥ <strong>可疑代码加 LSan / ASan</strong> 测试期复现。`,
        senior: `<strong>分类诊断</strong>：<br>· <strong>慢线性增长</strong>（几小时 / 几天）→ <strong>泄漏</strong>（new / new[] 不释放、shared_ptr 循环引用、容器 only grow）<br>· <strong>突然跳一段</strong>（几分钟）→ <strong>突发负载</strong>（流量增 / 大请求 / 文件上传等）<br>· <strong>不增但波动</strong> → <strong>正常 buffer / cache</strong><br>· <strong>peak 很高但不释放</strong> → glibc malloc 不归还 OS（jemalloc 改善）<br><br><strong>工具栈</strong>：<br>· <strong>jemalloc.prof</strong>：直接生成 .prof 文件 + pprof 分析<br>· <strong>tcmalloc HeapProfiler</strong>：类似<br>· <strong>heaptrack</strong>：开发环境 record + 重放<br>· <strong>massif</strong>（Valgrind）：snapshot allocation tree，慢<br>· <strong>BPF tools</strong>: bcc memleak / bpftrace 自定义 probe`,
        staff: `深一层：内存增长在生产 C++ 服务里有 ~5 个主要来源，<strong>排查方法不同</strong>：<br><br>① <strong>纯 leak (new 不 delete)</strong>: LSan / Valgrind 一抓一个准；现代 C++ 用 unique_ptr 几乎绝迹<br>② <strong>shared_ptr 循环引用</strong>：用 weak_ptr 一方；Valgrind 看不到，业务侧 counter + 代码 review<br>③ <strong>容器 only grow</strong>（如 cache 不 evict、queue 只 push）：业务侧 counter + 监控<br>④ <strong>malloc 不归还 OS</strong>（fragmentation）：glibc 默认 ptmalloc 这样；换 jemalloc / tcmalloc 改善<br>⑤ <strong>突发 + 大对象</strong>（如解析大 XML 一次性 buffer 100MB）：profile 看 RSS 跳变时间点对应业务<br><br><strong>真实经验</strong>：platform agent 生产 RSS 持续 3 天慢增长 ~50MB/天：<br>1) <strong>jemalloc.prof</strong> + pprof：看 hot allocation site → 发现是某 cache 持续 grow<br>2) <strong>业务 counter</strong>：cache.size() 持续涨 → 没 evict 逻辑（design bug）<br>3) <strong>修复</strong>：加 LRU eviction + 监控 cache hit rate<br>4) <strong>验证</strong>：RSS 稳定一周后无增长<br><br><strong>另一案例</strong>：peak 8GB 后稳定 4GB，glibc 不还 OS：<br>1) <strong>切 jemalloc</strong>：peak 8GB → 稳定 ~5GB（仍较高）<br>2) <strong>调 jemalloc 参数</strong>：<code>narenas:1, dirty_decay_ms:1000</code> → peak 后 30s 内回到 ~5GB<br>3) <strong>实质</strong>：fragmentation，arena 调整 + decay 加速归还<br><br><strong>陷阱</strong>：① 不区分 RSS / VSS / heap usage —— 三者不同含义；② 用 top 看 RSS 不准（含 shared library）—— smaps 更精确；③ jemalloc + ASan 偶尔冲突；④ <strong>真泄漏</strong>很少（90% 是 design issue）。`,
      },
      failure_modes: [
        `不分 RSS / VSS / heap → 错误判断有无泄漏`,
        `top 看 RSS 当真实使用（含 shared lib）`,
        `期待 glibc 立即归还 OS → 实际 fragmentation 保留`,
        `Valgrind 跑生产负载（50× 慢）→ 跑不动`,
        `不加业务侧 counter → 看不到具体哪段 grow`,
      ],
      follow_ups: [
        { q: `jemalloc / tcmalloc 怎么选？`, hint: `① jemalloc：fragmentation 控制好，Facebook 主推；② tcmalloc：Google，per-thread cache，多线程 friendly；③ benchmark 自己 workload 选；④ glibc malloc 通常都比这两个差` },
        { q: `怎么用 jemalloc 做 heap profiling？`, hint: `① <code>MALLOC_CONF=prof:true,lg_prof_sample:19</code> 启动；② 周期性 dump <code>jeprof --show_bytes ./prog jeprof.*.heap</code>；③ pprof 分析 hot allocation；④ delta profile (两个时刻对比)定位新增 leak` },
        { q: `BPF tools 怎么用？`, hint: `① <code>memleak</code>（bcc）实时定位 leak；② <code>bpftrace</code> 自定义 probe malloc / free；③ 优势：不需要重编译应用，生产可用；④ 限制：需 BTF 或 debug symbols` },
      ],
    },

    191: {
      why_asked: `生产 debug 必备。能讲 -O2 -g + 注意事项 + frame pointer 全套的人是真在 release 上 debug 过。`,
      answers: {
        mid: `<strong>保留 debug info</strong>：<code>g++ -O2 -g</code>。<strong>-O2 仍可调</strong>，但变量被优化掉显示 <code>&lt;optimized out&gt;</code>，行号有时不准（多语句合一）。严重场景重新编译加 <strong>-fno-omit-frame-pointer</strong> 改善 backtrace。<strong>关键变量加 volatile</strong> 防优化掉。`,
        senior: `<strong>典型问题 + 解法</strong>：<br>· <strong>变量 &lt;optimized out&gt;</strong>：变量被 register 优化或 dead code 消除；解法 ① -O1 或 -Og 替代 -O2；② 关键变量加 volatile（注意性能影响）；③ 用 gdb <code>print expression</code> 直接计算<br>· <strong>行号跳跃 / 重叠</strong>：编译器多语句合一；解法重读 disasm（<code>disas /s</code>）找当前 IP<br>· <strong>backtrace 不完整</strong>：-fomit-frame-pointer（-O2 默认）让 backtrace 难追；解法重编 -fno-omit-frame-pointer<br>· <strong>inline 函数失去</strong>：-O2 大量 inline；gdb <code>info inline</code> 查实际 inline 链`,
        staff: `深一层：release debug 是<strong>真 senior C++ 必备技能</strong>。<br><br><strong>工具组合</strong>：<br>· <strong>core dump</strong> + <strong>gdb</strong>：生产事故首选<br>· <strong>perf record + perf report</strong>：性能 + flame graph<br>· <strong>strace / ltrace</strong>：syscall / library call trace<br>· <strong>rr (record-replay)</strong>：record 一次然后 deterministic replay debug（Mozilla 工具）<br>· <strong>eBPF tools</strong>: bpftrace / bcc / bpftrace<br><br><strong>真实经验</strong>：platform agent 生产偶发段错：<br>1) <strong>core dump 配置</strong>：<code>ulimit -c unlimited</code> + <code>echo "/var/cores/%e.%p" &gt; /proc/sys/kernel/core_pattern</code><br>2) 事故发生时拿到 core file<br>3) <code>gdb binary core</code>，<code>bt</code> 显示 ?? ??（frame pointer 没保留）<br>4) <strong>重编</strong>：<code>g++ -O2 -g -fno-omit-frame-pointer ...</code><br>5) 模拟相同 input，再 crash → 这次 bt 完整：定位到某个 std::map::find 在被 concurrent 修改时的迭代器失效<br>6) <strong>修复</strong>：加 shared_mutex<br><br><strong>另一案例</strong>：性能问题（P99 周期性飙到 100ms）：<br>1) perf record + flame graph：发现 lock contention spike<br>2) <strong>rr</strong> record 一段 → replay 慢慢看为什么这段 lock contention<br>3) 发现：某 batch job 每分钟 sync 时 hold lock 长 → 改 async<br><br><strong>实践建议</strong>：<br>· Production 永远 <code>-g -O2</code>（debug info 不影响 runtime perf，磁盘多占 30%）<br>· 关键服务 <code>-fno-omit-frame-pointer</code>（无 backtrace 不能调）<br>· Core dump 必开 + 收集到中心化存储<br>· 关键服务带 <strong>continuous profiling</strong>（Pyroscope / Parca）— 始终有 flame graph 供调查<br>· 学会 <strong>用 disasm 调</strong>—— 关键 bug 时不可避免`,
      },
      failure_modes: [
        `Production 不带 -g → core dump 不可读`,
        `-fomit-frame-pointer → backtrace 大量 ??`,
        `不收集 core dump → 事故无法事后分析`,
        `gdb 不会看 disasm → release 优化代码完全调不动`,
        `没 continuous profiling → 性能问题事后才查`,
      ],
      follow_ups: [
        { q: `rr 怎么用？`, hint: `① <code>rr record ./prog</code>：录制执行；② <code>rr replay</code>：deterministic 重放（可任意倒退）；③ 偶发 race / 不易重现的 bug 神器；④ 需 Intel CPU + 一些 kernel 配置` },
        { q: `怎么从 core dump 提取信息？`, hint: `① <code>gdb binary core</code>；② <code>bt full</code> 看局部变量；③ <code>info threads + thread N + bt</code> 看每线程；④ <code>x /Nx 0x...</code> 读内存；⑤ separate debuginfo（debuginfod）让 production 二进制小但调试有信息` },
        { q: `Continuous profiling 怎么部署？`, hint: `① Pyroscope / Parca / Grafana Phlare；② Agent in production 持续采集 perf data；③ 上传中心存储 + UI 查询；④ Overhead &lt; 1% CPU；⑤ 大型 SaaS 必备` },
      ],
    },

    198: {
      why_asked: `综合性大题。能讲 8 个 principle 的人是真理解 modern C++ API design。`,
      answers: {
        mid: `<strong>8 大原则</strong>：① <strong>难以错用</strong>（Scott Meyers）：类型告诉调用方该怎么用；② <strong>RAII</strong> 管理资源生命周期；③ <strong>explicit</strong> 防止意外转换；④ <strong>const</strong> 正确；⑤ <strong>noexcept</strong> 正确；⑥ <strong>[[nodiscard]]</strong> 强制处理结果；⑦ <strong>string_view / span</strong> 接口边界；⑧ 文档化<strong>所有权 / 线程安全 / 异常保证</strong>。`,
        senior: `<strong>逐项展开</strong>：<br>① <strong>"hard to use wrong"</strong>: 用 strong typedef 替代 raw int / string（用 UserId 不 int）；返回 std::optional / std::expected 而非 nullable raw ptr；<br>② <strong>RAII</strong>: 资源在构造获取，析构释放；用 unique_ptr / lock_guard / scope_exit；<br>③ <strong>explicit</strong>: 单参 ctor 永远 explicit（除非真需要隐式）；<br>④ <strong>const</strong>: getter / 不修改成员的函数都 const；参数 const &amp; 当不拷贝；<br>⑤ <strong>noexcept</strong>: move / swap / destructor 永远 noexcept（启用容器优化）；<br>⑥ <strong>[[nodiscard]]</strong>: 返回 status / error code / required value 的函数加；<br>⑦ <strong>view 类型</strong>: 不需要 ownership 的参数用 string_view / span / function_ref；<br>⑧ <strong>文档</strong>: ownership transfer (move from)? 线程 safe? 异常 throws what?`,
        staff: `深一层：好的 C++ API 设计跟 Rust 异曲同工——<strong>用类型系统强制正确使用</strong>。<br><br><strong>extended principle</strong>：<br>⑨ <strong>不要 expose 实现细节</strong>：用 Pimpl 隐藏成员；用 ABI namespace inline 版本化；<br>⑩ <strong>strong types over weak</strong>: UserId vs int；不能混用 UserId 和 OrderId；<br>⑪ <strong>builder pattern</strong> 复杂构造：<code>HttpRequest::Builder().url("...").timeout(30s).build()</code><br>⑫ <strong>Composable</strong>: Function as first-class，function_ref / function 参数，让调用方组合；<br>⑬ <strong>Stream-like or single-call</strong>: 选其一别混（要么 builder 链式要么单次 settle）；<br>⑭ <strong>Sane defaults</strong>: 90% 用户不需要看 doc 也能用对<br><br><strong>真实例子</strong>：platform agent SDK 设计：<br><code>auto session = net::Session::connect({.host = "router.example.com", .port = 830, .auth = net::SshAuth::with_key(key_file)})</code><br><code>    .timeout(std::chrono::seconds(30))</code><br><code>    .build();</code><br><br><strong>用了什么 principle</strong>：<br>· Designated initializer (C++20) 让 ConnectionOpts 字段清晰；<br>· Builder 模式可加可减 optional 参数；<br>· <strong>RAII session</strong>：session 析构自动 disconnect；<br>· 返回 <code>std::expected&lt;Session, ConnectError&gt;</code>—— 错误强制 handle；<br>· net::SshAuth strong type—— 不能误传 password 到 with_key()；<br>· timeout 用 std::chrono 强类型—— 不能误传 "30" 当秒数 / 毫秒数<br><br><strong>对比反例</strong>：早期 RPC SDK API：<code>nc_session_t* nc_connect(const char* host, int port, const char* user, const char* pass);</code>—— ① raw ptr ownership 不明；② 4 个 raw 参数易顺序错；③ password 字符串明文（应该 zeroize）；④ 错误用全局 errno 不返回。<br><br><strong>学习资源</strong>：① Scott Meyers《Effective C++》/《Effective Modern C++》；② Herb Sutter《Exceptional C++》；③ C++ Core Guidelines（cppcoreguidelines.org）；④ Sean Parent 《Better Code》系列 talks；⑤ 反面教材：早期 STL / Boost / WinAPI（学怎么<u>不要</u>设计）。`,
      },
      failure_modes: [
        `Raw pointer 接口 → ownership 不明 / lifetime 难管`,
        `单参 ctor 不 explicit → 意外转换`,
        `Move / swap / dtor 没 noexcept → vector 扩容退化拷贝`,
        `用 int / string 当 ID → 易混淆 / 误传`,
        `返回 nullable ptr 而非 optional → 用户漏 null check`,
      ],
      follow_ups: [
        { q: `Strong typedef 怎么实现？`, hint: `① C++20 没 native：要 boost::strong_typedef 或自己 template；② Rust 的 newtype pattern；③ 例：<code>struct UserId { uint64_t v; explicit UserId(uint64_t x) : v(x) {} };</code>` },
        { q: `[[nodiscard]] 滥用风险？`, hint: `① 每个返回 bool / int 都加 → noise；② 只用在<strong>真有必要 handle</strong>（status / error / ID）的；③ Tag with reason (C++20)：<code>[[nodiscard("Check error code")]]</code>` },
        { q: `怎么评估自己 API 设计好坏？`, hint: `① "If you don't read docs, can you use it correctly?"；② New hire 试用看用错点；③ 对比 std / Boost 类似 API；④ Static analyzer 提示用错；⑤ ScottMeyers's "Hard to use wrong" Test` },
      ],
    },

    // ============== Phase 2 续推 · 基础 / 转换 ==============
    7: {
      why_asked: `4 种 cast 是 C++ 基础题但筛人很 effective。能讲清"static / dynamic / const / reinterpret + 运行时检查只 dynamic"的人没踩过 UB 坑。`,
      answers: {
        mid: `<strong>4 种 cast</strong>:① <strong>static_cast</strong>—— 编译期已知关系的转换（int↔float / Derived↔Base 上下）；② <strong>dynamic_cast</strong>—— <strong>运行时检查</strong>多态指针 / 引用（唯一有运行时检查）；③ <strong>const_cast</strong>—— 加 / 去 const（罕用，多数是 design smell）；④ <strong>reinterpret_cast</strong>—— bit-level 重解释（最危险，UB 高风险）。`,
        senior: `<strong>详细用法 + 例</strong>:<br>· <strong>static_cast</strong>: 安全的编译期转换<br>· <code>static_cast&lt;int&gt;(3.14)</code> → 3<br>· <code>static_cast&lt;Derived*&gt;(base_ptr)</code> → no runtime check，wrong type = UB<br>· <strong>dynamic_cast</strong>: 多态类型必有 virtual function（vtable）<br>· <code>auto* d = dynamic_cast&lt;Derived*&gt;(base_ptr)</code> → null if wrong type<br>· 失败时 reference 抛 <code>std::bad_cast</code><br>· <strong>const_cast</strong>: 通常 wrong design<br>· 合法 use: 老 C API 不 const-correct 但确实只读<br>· <strong>reinterpret_cast</strong>: bit pattern 不变, 类型重新解释<br>· 主要场景: hardware register / serialize / type erasure<br>· 99% 用法是 UB temptation`,
        staff: `深一层：选 cast 类型本身是<strong>code review 信号</strong>:<br>· <strong>大量 static_cast</strong>: 正常 (most usage)<br>· <strong>dynamic_cast</strong>: 偶尔 OK (visitor pattern alternative)，但<strong>常见</strong>意味 OOP design smell —— consider std::variant + std::visit<br>· <strong>const_cast</strong>: 通常 design smell —— 你不该需要去 const<br>· <strong>reinterpret_cast</strong>: red flag —— 99% 是 UB 风险<br><br><strong>真实 case</strong>:<br><br>1. <strong>static_cast 错误典型</strong>: <br><code>Base* b = new Derived;<br>Other* o = static_cast&lt;Other*&gt;(b);  // wrong type, UB</code><br>编译期 pass 但 runtime undefined。改用 dynamic_cast 至少有 null check。<br><br>2. <strong>dynamic_cast 性能</strong>: ~10-100ns per call (vtable walk + RTTI lookup). Hot path 避免。<br><br>3. <strong>reinterpret_cast UB</strong>: <code>float f = 1.0; int* i = reinterpret_cast&lt;int*&gt;(&amp;f); *i;</code> → strict aliasing UB. 正确: <code>std::bit_cast</code> (C++20) or <code>std::memcpy</code>.<br><br><strong>建议</strong>:<br>① Default static_cast<br>② OOP downcast: 重新设计避免 / std::variant / 必须用时 dynamic_cast<br>③ const_cast: 极少 + 留 comment 解释<br>④ reinterpret_cast: replace with std::bit_cast / memcpy<br>⑤ <strong>C-style cast 永远不用</strong>—— hide 4 种之一，不易 grep<br><br><strong>跟 C-style cast 区别</strong>: <code>(int)x</code> 实际是<strong>4 种之一 + const_cast 组合</strong>，编译器自动选 "最 permissive"——危险且不显式。新代码应该<strong>禁 C-style cast</strong> (lint warning)。`,
      },
      failure_modes: [
        `用 C-style cast 隐藏真意图`,
        `static_cast 错型 → UB`,
        `const_cast 频繁用 → design smell`,
        `reinterpret_cast 跨类型 read → strict aliasing UB`,
        `Hot path 大量 dynamic_cast → 性能问题`,
      ],
      follow_ups: [
        { q: `std::bit_cast 是什么 (C++20)？`, hint: `① 安全的 bit-level cast (跟 reinterpret_cast 区别)；② constexpr (编译期 evaluate)；③ Requires trivially copyable + same size；④ 替代 memcpy + reinterpret_cast pattern` },
        { q: `dynamic_cast 性能怎么优化？`, hint: `① Hot path 改 static_cast (确定类型时)；② 用 std::variant + std::visit 替代；③ Type tag (enum) + switch；④ CRTP 静态多态 (no runtime cost)` },
        { q: `什么时候 const_cast 合法？`, hint: `① 调老 C API 不 const-correct (确实只读)；② Mutable 成员的 const method 内修改；③ <strong>原对象不能是 const-declared</strong>（否则 UB）；④ 99% case 有更好 design` },
      ],
    },

    32: {
      why_asked: `vector 是最常用容器。能讲"摊销分析 + 2× growth + capacity vs size"的人理解 amortized complexity。`,
      answers: {
        mid: `<strong>2 倍扩容</strong>（GCC libstdc++）/ <strong>1.5 倍</strong>（MSVC）。<strong>摊销分析</strong>：N 次 push_back 总 cost ≤ 2N（每个元素平均被 copy/move &lt; 2 次）→ 摊销 O(1)。`,
        senior: `<strong>摊销分析详解</strong>:<br>· N 次 push_back 触发 log(N) 次扩容<br>· 第 k 次扩容: copy 2^k elements<br>· Total copies: 2^0 + 2^1 + ... + 2^log(N) ≈ 2N<br>· Average per insert: 2N/N = 2 = O(1)<br><br><strong>1.5x vs 2x growth tradeoff</strong>:<br>· 2x: faster amortized, 但 wastes more memory (after grow, half is wasted)<br>· 1.5x: more memory efficient, marginally slower<br>· GCC: 2x; MSVC: 1.5x；都有道理<br><br><strong>size vs capacity</strong>:<br>· size(): 实际元素数<br>· capacity(): 已分配可容纳<br>· reserve(N): 预分配避免扩容<br>· shrink_to_fit(): 实际收回未用 (non-binding hint)`,
        staff: `深一层：vector 扩容的<strong>性能实战</strong>:<br><br>1. <strong>预知 size 用 reserve</strong>: 100k push_back without reserve → 17 次 reallocation (each copy all). With reserve(100k) → 0 reallocation. 性能 +20-50%.<br><br>2. <strong>noexcept move 影响扩容</strong>: 扩容时若 element move ctor noexcept → 用 move; 否则 fallback to copy (保 strong exception safety)。<br>· 真实案例: platform agent <code>std::vector&lt;Message&gt;</code>，Message 含 <code>std::function</code> (不 noexcept move)，扩容退化为 copy，慢 20×. Fix: 自定义 noexcept move ctor.<br><br>3. <strong>vector vs other containers 性能</strong>:<br>· Insert at end: vector amortized O(1); deque O(1); list O(1)<br>· Insert at middle: vector O(n); deque O(n); list O(1) but list 整体慢<br>· Random access: vector O(1); deque O(1); list O(n)<br>· Cache friendly: vector ≫ deque &gt; list<br>· Default choice: vector<br><br>4. <strong>growth factor &gt; 1 必要</strong>: 1.5 / 2 都 OK；如果是 +constant（如 +10）→ N push back is O(N²) 不 amortized<br><br><strong>面试 follow up</strong>: vector resize() 跟 reserve() 区别？<br>· reserve(N): 改 capacity, size 不变 (元素不构造)<br>· resize(N): 改 size, 多出 default-construct, 少了 destruct<br><br><strong>陷阱</strong>:<br>① 没 reserve 大量 push_back<br>② Element move ctor 没 noexcept → 扩容退化 copy<br>③ growth factor &lt; 1.5 (linear growth → O(N²))<br>④ 大 vector shrink_to_fit 期望立即回收 → impl 可能 ignore<br>⑤ Capacity 跟 size 混 → 读 element 用 size, not capacity`,
      },
      failure_modes: [
        `没 reserve 大量 push_back → reallocation 频繁`,
        `Element move ctor 没 noexcept → 扩容退化 copy`,
        `Growth factor 算成 +constant → O(N²)`,
        `Capacity / size 混`,
        `shrink_to_fit 期望立即收回 → impl 可能 ignore`,
      ],
      follow_ups: [
        { q: `2x vs 1.5x growth tradeoff？`, hint: `① 2x: faster amortized + more memory waste；② 1.5x: less memory waste + slightly slower；③ Galloping (Folly): adaptive；④ 都 acceptable，差别 marginal` },
        { q: `vector::reserve 跟 std::vector(size, value) 区别？`, hint: `① reserve(N): 只 alloc capacity, size 不变, 元素不构造；② vector(N): 分配 + size = N + default-construct N elements；③ 不同用法` },
        { q: `怎么避免 capacity 浪费？`, hint: `① 用 reserve 准确预分配；② shrink_to_fit (non-binding)；③ Move-construct from temp: <code>vec = std::vector(std::move(vec))</code> swap idiom；④ 接受 50% capacity waste 是 2x growth 的代价` },
      ],
    },

    33: {
      why_asked: `vector iterator 失效是 C++ 经典 UB 来源。能讲"insert/erase/扩容三种失效场景"的人调过相关 bug。`,
      answers: {
        mid: `<strong>3 类失效</strong>:① <strong>扩容</strong>（push_back / reserve / resize > capacity）→ <strong>所有 iterator 失效</strong>；② <strong>insert</strong>（插入位置后所有 iterator 失效，前面的仍 valid）；③ <strong>erase</strong>（删除位置后所有 iterator 失效，前面仍 valid）。`,
        senior: `<strong>具体规则</strong>:<br>1. <strong>push_back / emplace_back</strong>: <br>· If new size &lt;= capacity: <strong>只 end() iterator 失效</strong>，其他 valid<br>· If new size &gt; capacity (扩容): <strong>所有 iterator 失效</strong><br>2. <strong>insert(it, val)</strong>:<br>· If 扩容: 所有失效<br>· If 不扩容: it 及之后失效<br>3. <strong>erase(it)</strong>: it 及之后失效（前面 valid）<br>4. <strong>clear()</strong>: 所有失效<br>5. <strong>swap</strong>: <strong>不失效</strong>（two vectors 互换 internal pointer）<br><br><strong>典型 bug</strong>:<br><code>for (auto it = v.begin(); it != v.end(); ++it) {<br>  if (need_insert) v.insert(it, x);  // 失效 it</code> → UB`,
        staff: `深一层：iterator 失效是 C++ <strong>UB 三大来源</strong>之一 (其他: use-after-free / 数据竞争). 编译期 0 warning, runtime random crash. <strong>预防 &gt; 检测</strong>.<br><br><strong>实战常见错误</strong>:<br><br>1. <strong>循环里 insert / erase 不更新 iterator</strong>:<br><code>for (auto it = v.begin(); it != v.end(); ++it) {<br>  if (pred(*it)) v.erase(it);  // UB after erase<br>}</code><br>正确:<br><code>for (auto it = v.begin(); it != v.end(); ) {<br>  if (pred(*it)) it = v.erase(it);  // erase returns next valid iterator<br>  else ++it;<br>}</code><br>或者 C++20: <code>std::erase_if(v, pred);</code><br><br>2. <strong>缓存 iterator 后扩容</strong>:<br><code>auto it = v.begin();<br>v.push_back(x);  // may invalidate<br>*it;  // potential UB</code><br><br>3. <strong>range-for 内部修改 vector</strong>:<br><code>for (auto&amp; x : v) {<br>  v.push_back(y);  // UB if reallocate<br>}</code><br>(range-for 隐式持有 begin/end iterator)<br><br><strong>预防 best practices</strong>:<br>① 不在 loop 内修改 container size (use copy / index based)<br>② erase-remove idiom: <code>v.erase(std::remove_if(...), v.end())</code>；C++20 简化为 <code>std::erase_if</code><br>③ 大量 insert 用 reserve 预分配避免 mid-loop 扩容<br>④ Index-based loop 对 random access container 更安全 (但 size 变化时 still careful)<br>⑤ ASan / iterator debugging mode (MSVC iterator debug level) catch 大部分<br><br><strong>不同容器失效规则</strong>:<br>· vector: 扩容失效 all, insert/erase 失效 from point<br>· deque: insert/erase 失效 all (different impl)<br>· list/forward_list: 插入不失效, erase 只失效被删的<br>· map/set: insert 不失效, erase 只失效被删的<br>· unordered_map/set: rehash 失效 all<br><br><strong>真实经验</strong>: platform agent 早期一个 P0 crash—— message queue 处理时 push_back 新 message，导致 outer loop iterator 失效. ASan catch 后改为 two-phase（处理 + queue 新 message in batch）。Lesson: 任何 container loop 内修改 size 永远 suspect。`,
      },
      failure_modes: [
        `Loop 内 insert/erase 不更新 iterator`,
        `缓存 iterator 后扩容 → UB`,
        `Range-for 内改 vector`,
        `不知道不同容器失效规则差异`,
        `不用 erase-remove idiom 自己写 loop`,
      ],
      follow_ups: [
        { q: `erase-remove idiom 是什么？`, hint: `<code>v.erase(std::remove_if(v.begin(), v.end(), pred), v.end())</code>—— remove_if 不真删，把保留元素 move 到前面，返回 logical end；erase 缩 size；C++20 <code>std::erase_if</code> 一行完成` },
        { q: `vector::end() iterator 永远失效吗？`, hint: `① 任何 size 变化（push/insert/erase/resize）都失效 end()；② begin() 通常 stable（除非扩容）；③ 不要缓存 end()` },
        { q: `迭代器失效跟 reference 失效一样吗？`, hint: `① 大致相同—— 引用本质也是 pointer to internal storage；② 但 list 等 node-based container, reference 跟 iterator 失效规则可能微妙不同；③ 实战: 同样 careful 处理 reference / iterator / pointer 到容器元素` },
      ],
    },

    34: {
      why_asked: `emplace 是 C++11 high-impact 优化。能讲"in-place construction + perfect forwarding + 收益场景"的人是真用过。`,
      answers: {
        mid: `<strong>emplace_back</strong> 直接在容器内存上<strong>原地构造</strong>元素，<strong>不需要先构造再 copy/move</strong>。<strong>push_back</strong> 需要先构造一个临时再 move/copy 进 vector。`,
        senior: `<strong>差异举例</strong>:<br><code>vec.push_back(MyClass(a, b));   // 1. 临时 MyClass; 2. move/copy 进 vec<br>vec.emplace_back(a, b);          // 直接在 vec 内存上构造</code><br><br><strong>性能差</strong>: <br>· Trivially copyable type: emplace ≈ push (compiler 优化 same)<br>· Non-trivial type (e.g., std::string): emplace 省 1 move/copy<br>· Heavy class (e.g., 含 std::vector / std::map 成员): emplace 显著快<br><br><strong>API</strong>:<br>· <code>emplace_back(args...)</code>: perfect forward args 到 element ctor<br>· <code>emplace(pos, args...)</code>: 在 pos 构造<br>· map/set 有 <code>emplace_hint</code> + <code>try_emplace</code> (C++17)`,
        staff: `深一层：emplace 本质是<strong>perfect forwarding 应用</strong>—— 转发 args 到 ctor 而不是构造好的 object。<br><br><strong>实战场景何时差异大</strong>:<br>1. <strong>std::string element</strong>: <br><code>vec.emplace_back("hello");        // 1 次 ctor<br>vec.push_back("hello");           // 1 次 ctor + 1 次 move</code><br>(后者编译器优化后也只 1 次 ctor，差异 minimal)<br><br>2. <strong>复杂 object (大 string + vector member)</strong>: emplace 显著省 move cost<br><br>3. <strong>aggregate initialization</strong>:<br><code>vec.push_back({a, b, c});         // 隐式 ctor<br>vec.emplace_back(a, b, c);        // 显式</code><br><br><strong>陷阱 + 反直觉</strong>:<br>1. <strong>emplace 不总是更快</strong>: <br>· Trivially copyable: same<br>· 已有 already-constructed object: <code>vec.push_back(std::move(obj))</code> 也只 1 move<br>· emplace 优势主要在 "<strong>避免临时 object</strong>" 场景<br>2. <strong>explicit ctor 不能 push_back</strong> braced-init: <br><code>struct S { explicit S(int); };<br>vec.push_back({1});  // error if explicit<br>vec.emplace_back(1); // OK</code><br>3. <strong>emplace 跟 initializer_list</strong>: <br><code>vec.emplace_back({1,2,3});   // error: braced-init not a type<br>vec.emplace_back(std::initializer_list&lt;int&gt;{1,2,3}); // OK</code><br><br><strong>真实经验</strong>: platform agent profile hot path，把 100+ push_back 改 emplace_back：性能<strong>不变</strong>（gcc -O2 优化 push_back 临时元素到 in-place ctor）。结论: <strong>emplace_back 是 "free" upgrade 但不是 magic boost</strong>—— 写新代码用 emplace，重构旧代码 push_back ROI 低。<br><br><strong>建议</strong>:<br>① 新代码默认 emplace_back<br>② 不为优化大量 refactor old push_back<br>③ map::try_emplace (C++17) 比 insert 更高效 (avoid construct on key collision)<br>④ 不滥用—— emplace_back(MyClass{a,b}) 没好处，不如 emplace_back(a,b)`,
      },
      failure_modes: [
        `滥用 emplace 期待 magic speedup`,
        `emplace 跟 initializer_list 混淆`,
        `Explicit ctor 用 push_back braced-init 编译错`,
        `不用 try_emplace 在 map / unordered_map`,
        `重构旧 push_back 投入 vs ROI 不值`,
      ],
      follow_ups: [
        { q: `try_emplace 跟 emplace 区别？`, hint: `① try_emplace (C++17): 仅 key 不存在时 construct value (避免 wasted ctor on collision)；② emplace: 总 construct value 再尝试 insert，collision 时 wasted；③ Map / unordered_map 用 try_emplace` },
        { q: `emplace_back 怎么 perfect forward 多 arg？`, hint: `① Variadic template + std::forward；<code>template&lt;class... Args&gt; void emplace_back(Args&&... args) { ... new(...) T(std::forward&lt;Args&gt;(args)...); }</code>` },
        { q: `什么时候 push_back 更合适？`, hint: `① 已有 lvalue object: <code>push_back(obj)</code> 跟 <code>emplace_back(obj)</code> 完全一样；② Code clarity (已 constructed object 用 push 更清晰)；③ emplace 不带 magic 时差异 marginal` },
      ],
    },

    35: {
      why_asked: `std::string SSO 是 C++ 实现 detail 但常被问。能讲"SSO + COW 历史 + ABI"的人深入过 libstdc++。`,
      answers: {
        mid: `<strong>SSO (Small String Optimization)</strong>: 短字符串（typical &lt; 16-24 bytes）直接存在 string object 内部（栈），<strong>不分配堆</strong>。长字符串 fall back 到 heap allocation。`,
        senior: `<strong>SSO 实现细节</strong> (libstdc++ default):<br>· string object 自身 ~32 bytes (包括 size / capacity / data ptr)<br>· SSO buffer: ~15 bytes 内嵌（last byte sentinel）<br>· capacity &gt; SSO size → heap alloc<br>· libc++ SSO size 不同 (~22 bytes)<br><br><strong>历史: COW (Copy-On-Write) 时代</strong>:<br>· C++03 时代 libstdc++ 用 COW: 多个 string copy 共享同一 buffer + 引用计数<br>· C++11 引入 move semantics 后 COW 性能优势消失（move 更快）<br>· COW 多线程不安全（atomic ref count 开销 + 内存模型复杂）<br>· libstdc++ 5+ 抛弃 COW 改 SSO（Dual ABI 来源）<br><br><strong>性能</strong>:<br>· 短 string (95% real world): no alloc, fast<br>· 长 string: heap alloc 同 raw new`,
        staff: `深一层：SSO 跟 COW 历史是 libstdc++ <strong>Dual ABI 来源</strong>，是 C++ ABI 兼容性最 painful 的问题之一。<br><br><strong>Dual ABI 详解</strong>:<br>· GCC 5+ 引入 <code>_GLIBCXX_USE_CXX11_ABI</code><br>· 0 = 老 COW string (ABI 跟 GCC 4.x 兼容)<br>· 1 = 新 SSO string (默认, C++11 spec 合规)<br>· 不同 ABI 编译的 .so 链接时 std::string 符号不匹配 → link error<br>· 整条工具链必须统一<br><br><strong>真实坑</strong>: 跟老 vendor library (用 GCC 4.x COW string 编译) 一起 link 时:<br>· Option 1: 整 build chain 用 _GLIBCXX_USE_CXX11_ABI=0 (sacrifice C++17 / 20 部分功能)<br>· Option 2: vendor 提供 GCC 5+ 编译版本<br>· Option 3: ABI shim layer (wrapped extern "C")<br>之前 platform agent 跟客户老 vendor SDK 集成时遇过 → 选 Option 3 + 大量 extra work。<br><br><strong>性能差异 (SSO vs COW)</strong>:<br>· 短 string copy:<br>· SSO: 直接 byte copy (cache-friendly, no atomic)<br>· COW: atomic increment ref count (cache miss + barrier)<br>· SSO 通常 faster<br>· 多线程并发:<br>· SSO: no contention<br>· COW: ref count atomic contention<br>· SSO ≫ COW<br>· 长 string copy:<br>· SSO: full heap copy<br>· COW: just bump ref<br>· COW faster for big strings if rarely modified<br>· 现代 use case: move semantics + string_view 让 COW 优势消失<br><br><strong>验证 SSO size</strong>:<br><code>std::string s = "abc";<br>std::cout &lt;&lt; sizeof(s) &lt;&lt; ' ' &lt;&lt; (void*)s.data();</code><br>看 data() 是否在 s 内部地址范围 (是 = SSO, 不是 = heap)<br><br><strong>陷阱</strong>:<br>① 假设所有 string copy 都 alloc (短 string 不 alloc)<br>② 跨 GCC 4.x / 5+ 不知 Dual ABI<br>③ 期望 COW (老 mental model) 但默认 SSO<br>④ 性能 microbenchmark 用短 string → 不反映长 string 性能<br>⑤ libstdc++ vs libc++ SSO size 不同 → 测试结果不可移植`,
      },
      failure_modes: [
        `假设所有 string copy 都 alloc`,
        `不知 Dual ABI 在 GCC 5+`,
        `Mental model 仍是 COW`,
        `Microbenchmark 全用短 string`,
        `跨 stdlib 假设 SSO size 一致`,
      ],
      follow_ups: [
        { q: `怎么 disable SSO 强制 heap alloc？`, hint: `① 不能 portable disable—— 是 impl detail；② 测试时 reserve(N) 大 N 强制 heap；③ Alternative: 用 std::vector&lt;char&gt; 替代 string` },
        { q: `string_view 跟 SSO 关系？`, hint: `① string_view 完全不拥有数据—— no allocation；② 比 SSO 还轻 (just ptr + size)；③ Hot path 接口用 string_view 替代 string&；④ 注意 lifetime` },
        { q: `小字符串高频 copy 怎么优化？`, hint: `① SSO 已经免 alloc；② Move 优于 copy；③ 用 string_view 传递；④ 大量重复字符串考虑 string interning (e.g., absl::string_view + 共享 storage)` },
      ],
    },

    38: {
      why_asked: `unordered_map rehash 是 hash table 经典话题。能讲"rehash trigger + iterator/reference 失效 + reserve"的人是真做过性能调优。`,
      answers: {
        mid: `<strong>rehash trigger</strong>: load factor (size / bucket_count) 超过 max_load_factor (default 1.0) → 翻倍 bucket + rehash all elements。<br><strong>失效</strong>: <strong>所有 iterator 失效</strong>；<strong>reference / pointer 不失效</strong>（element 仍在原位置，只是 bucket pointer 重建）。`,
        senior: `<strong>详细</strong>:<br>· <strong>rehash 不只 insert 触发</strong>: 显式 <code>rehash(N)</code> / <code>reserve(N)</code> 也 trigger<br>· <strong>load factor</strong> 默认 1.0；调小（<code>max_load_factor(0.5)</code>）= 更多 memory + 更少 collision<br>· <strong>iterator 失效</strong>: 所有 begin/end/find 返回的 iterator 失效<br>· <strong>reference 不失效</strong>（unlike vector）：因为 element 在 heap-allocated node, rehash 只改 bucket pointer，node address 不变<br>· <strong>insert/erase 元素</strong> 也不失效 reference (除被 erase 的)<br><br><strong>性能</strong>:<br>· Amortized insert: O(1)<br>· Worst case (rehash): O(N)<br>· Reserve N before insert: avoid mid-way rehash`,
        staff: `深一层：unordered_map 实现是<strong>chained hash table</strong>（每个 bucket 是 linked list of nodes）。<br><br><strong>性能 reality check</strong>:<br>1. <strong>unordered_map 比 std::map 快？</strong> 不一定:<br>· 小 N (&lt; 100): map 可能更快 (cache locality)<br>· 大 N: unordered_map 更快 (O(1) vs O(log N))<br>· 但 unordered_map 有 hash + collision overhead + node 分散在 heap (cache miss)<br>2. <strong>更快替代</strong>: <br>· <strong>Abseil flat_hash_map</strong>: open-addressing + cache friendly, 2-3× faster than std::unordered_map<br>· <strong>F14 (Folly)</strong>: 类似 fast hash map<br>· <strong>boost::container::flat_map</strong>: sorted vector + binary search (适合小 N)<br><br><strong>rehash 性能 trap</strong>:<br>1. <strong>渐进 grow 没 reserve</strong>: 100k insert 触发多次 rehash, each rehash O(current size)<br>· Without reserve: ~10× slower<br>· With reserve(100k): one-time alloc<br>2. <strong>load factor 设太小</strong>: <code>max_load_factor(0.25)</code> → 4× memory，但 lookup 几乎不快<br>3. <strong>iterator invalidation 后用</strong>: 隐 bug。Reference 不失效是 unordered_map 特性<br><br><strong>真实经验</strong>: platform agent device state cache (100k device, ~1M lookup/s):<br>· baseline std::unordered_map: P99 lookup 800ns<br>· change to absl::flat_hash_map: P99 200ns (4×)<br>· cache miss 数从 25% → 6% (perf c2c)<br><br><strong>陷阱</strong>:<br>① 渐增 insert 没 reserve<br>② Iterator 失效不知，crash random<br>③ 假设 unordered_map 永远比 map 快<br>④ Hash function 烂（用 sequential ID 当 key, all collide in bucket 0）<br>⑤ 不知 reference 不失效（误以为跟 vector 一样）<br><br><strong>选型决策</strong>:<br>· N &lt; 50, 多读少写: <strong>flat_map / sorted vector</strong> (cache locality)<br>· 50-10k, 通用: <strong>absl::flat_hash_map</strong> (best)<br>· 10k+ 或需要 ordering: <strong>std::map / std::unordered_map</strong><br>· concurrent: <strong>tbb::concurrent_hash_map / folly::ConcurrentHashMap</strong>`,
      },
      failure_modes: [
        `渐增 insert 不 reserve → 多次 rehash`,
        `Iterator 失效不知 → crash`,
        `Hash function 烂 → all collide`,
        `Load factor 设太小 → 浪费 memory`,
        `假设 unordered_map &gt; map for all N`,
      ],
      follow_ups: [
        { q: `好的 hash function 长啥样？`, hint: `① Uniform distribution；② Low collision rate；③ Cheap to compute；④ std::hash 通常够用；⑤ Custom key 要专门 hash (e.g., struct of int + string → combine)` },
        { q: `absl::flat_hash_map 比 std::unordered_map 快在哪？`, hint: `① Open addressing not chaining—— cache friendly；② SIMD lookup for empty/deleted slots；③ Robin hood hashing；④ Comprehensive analysis: Abseil documentation` },
        { q: `concurrent hash map 怎么选？`, hint: `① Read-heavy: folly::ConcurrentHashMap (lock-free reads)；② Mixed: tbb::concurrent_hash_map (fine-grained lock)；③ Simple: std::shared_mutex + std::unordered_map；④ 高 contention: 用 striped lock / lock-free 数据结构` },
      ],
    },

    47: {
      why_asked: `Top-K 是 STL 经典综合题。能讲"std::nth_element + 部分 sort + heap"3 方法的人懂复杂度。`,
      answers: {
        mid: `<strong>3 种方法</strong>:① <strong>std::nth_element</strong>（O(n) average，找第 k 大但 unordered）；② <strong>std::partial_sort</strong>（O(n log k)，前 k 个 sorted）；③ <strong>std::priority_queue (heap)</strong>（O(n log k)，适合 streaming）。`,
        senior: `<strong>详细对比</strong>:<br>1. <strong>std::nth_element(first, nth, last)</strong>: <br>· O(n) average (quickselect)<br>· O(n²) worst case<br>· 之后 [first, nth) 都 ≤ *nth, (nth, last) 都 ≥<br>· 但 [first, nth) 不 sorted<br>2. <strong>std::partial_sort(first, middle, last)</strong>:<br>· O(n log k) where k = middle - first<br>· [first, middle) is sorted top k<br>3. <strong>std::priority_queue + 维护 size k</strong>:<br>· Streaming (data 一次性看不完)<br>· O(n log k) per processing<br>· Memory O(k)<br><br><strong>选择</strong>:<br>· k 远小于 n + 只要 unordered: <strong>nth_element</strong> (fastest)<br>· k 远小于 n + 要 sorted: <strong>partial_sort</strong><br>· Streaming 数据: <strong>priority_queue</strong>`,
        staff: `深一层：Top-K 看似简单实际有<strong>不少 senior 区分点</strong>:<br><br>1. <strong>k 跟 n 比例 matter</strong>:<br>· k = n/2: nth_element no advantage over sort<br>· k &lt;&lt; n: nth_element 显著快<br>· k = 1 (find max): std::max_element O(n), best<br>2. <strong>是否需要 sorted</strong>:<br>· 不需要 sorted (e.g., 求 top-100 students 的集合，不在乎顺序): nth_element<br>· 需要 sorted (e.g., leaderboard): partial_sort<br>3. <strong>是否 streaming</strong>:<br>· Batch (data 全在 memory): nth_element / partial_sort<br>· Streaming (one pass / data 太大): priority_queue 维护 size k<br>4. <strong>是否 stable</strong>:<br>· nth_element / partial_sort: <strong>not stable</strong><br>· 需要 stable: std::stable_sort + slice (O(n log n))<br><br><strong>真实案例</strong>: platform agent telemetry，每秒 100k events 找 top-100 异常 device:<br>· Batch (1 sec buffer): nth_element 50ms<br>· Streaming: priority_queue maintain top-100 (each insert O(log 100)) → 总 O(n log k), real-time<br>· 选 streaming (low latency requirement)<br><br><strong>性能 数字</strong>:<br>· n = 1M, k = 100<br>· std::sort: ~100ms (cache-friendly)<br>· partial_sort: ~10ms<br>· nth_element: ~3ms (10× faster)<br>· priority_queue streaming: comparable to nth_element (each insertion overhead but distributed)<br><br><strong>陷阱</strong>:<br>① 用 std::sort 当 top-K 工具—— 浪费 O(n log n)<br>② 不知道 nth_element 是 partial QuickSort<br>③ 期望 nth_element 后 [first, nth) 是 sorted<br>④ k 大时 priority_queue 比 partial_sort 慢（k log k vs k log k 但 const factor 大）<br>⑤ Worst case O(n²) of nth_element 不知（malicious input 可触发）<br><br><strong>替代方案</strong>:<br>· Randomized selection (Quickselect + random pivot)<br>· 介绍 select algorithm (BFPRT, O(n) worst case 但 const factor 大, 实战很少用)<br>· 数据可并行: 分块 + merge top-K`,
      },
      failure_modes: [
        `用 std::sort 当 top-K 工具`,
        `期望 nth_element 后 sorted`,
        `k 大时仍用 priority_queue`,
        `Worst case O(n²) 不知`,
        `Stable 跟 unstable 混`,
      ],
      follow_ups: [
        { q: `怎么 parallel top-K？`, hint: `① 数据分块，每块 partial_sort top-K；② Merge top-K of all blocks；③ Total O(n/p × log k + p × k log k)；④ TBB / std::execution::par_unseq` },
        { q: `Streaming top-K 算法？`, hint: `① priority_queue (min-heap of size k)；② 新元素 &gt; heap.top() 则 pop + push；③ Time O(n log k)；④ Memory O(k)；⑤ 适合 data 一次性 stream` },
        { q: `Top-K of sorted streams (k-way merge)？`, hint: `① priority_queue of stream iterators；② Pop smallest, advance that stream；③ Time O(n log k) where k = stream count；④ 经典 external sort building block` },
      ],
    },

    56: {
      why_asked: `Rule of 0/3/5 是现代 C++ 设计原则。能讲"3 → 5 演进 + Rule of 0 哲学"的人懂 RAII。`,
      answers: {
        mid: `<strong>Rule of 3 (C++03)</strong>: 自定义任一 (dtor / copy ctor / copy assign) → 必须自定义另外 2 个。<br><strong>Rule of 5 (C++11)</strong>: 加 move ctor / move assign 共 5 个。<br><strong>Rule of 0 (modern)</strong>: <strong>尽量不自定义任何</strong>—— 让 compiler 生成默认; 资源管理交给 RAII type (unique_ptr / vector / lock_guard)。`,
        senior: `<strong>具体规则</strong>:<br>· 自定义 dtor → 通常意味管 resource → copy/move 需要正确处理 (deep copy / transfer ownership)<br>· 编译器默认 copy/move = member-wise → 资源 type member-wise 可能 wrong<br><br><strong>Rule of 0 实战</strong>:<br>· 用 std::unique_ptr 管 ownership → 不用写 dtor / move (default ok)<br>· 用 std::vector / std::string → 同上<br>· 类自然 move-only / copyable based on members<br><br><strong>例</strong>:<br><code>class Foo {<br>  std::unique_ptr&lt;Bar&gt; ptr_;     // owns Bar<br>  std::vector&lt;int&gt; data_;        // owns vector<br>  // No need to define dtor / copy / move<br>  // Default-generated: move-only (because unique_ptr)<br>};</code>`,
        staff: `深一层：Rule of 0 是<strong>现代 C++ 最重要原则之一</strong>—— "<strong>resource management should be a separate concern from business logic</strong>"。如果你写 dtor，你应该 question why（是不是该 wrap to RAII type）。<br><br><strong>Rule of 5 详细行为</strong>:<br>1. <strong>用户自定义 dtor</strong> → compiler 不生成 move (但仍生成 deprecated copy)<br>2. <strong>用户自定义 move ctor/assign</strong> → compiler 不生成 copy<br>3. <strong>= default 显式</strong> 让 compiler 生成 (区别于 not declared)<br>4. <strong>= delete</strong> 显式禁止<br><br><strong>真实陷阱</strong>:<br>1. <strong>写了 dtor 但忘写 move</strong>:<br><code>class Foo {<br>  std::unique_ptr&lt;Bar&gt; ptr_;<br>  ~Foo() { log("destroying"); }  // user-declared dtor<br>};<br>// Compiler 不生成 move → Foo 不是 movable<br>// std::vector&lt;Foo&gt; 退化 to copy → unique_ptr copy = error</code><br>修正: 显式 <code>Foo(Foo&amp;&amp;) = default;</code><br><br>2. <strong>= default move noexcept</strong>:<br>· Compiler 生成 move 时根据 member move 推导 noexcept<br>· 一个 member 不 noexcept → Foo move 也不 noexcept<br>· 影响 std::vector&lt;Foo&gt; 扩容 (退化 copy)<br>· Fix: ensure members noexcept; static_assert<br><br>3. <strong>Rule of 5 应用过度</strong>:<br>· 简单 type 不应该写 5 个 (Rule of 0 优先)<br>· 写 5 个意味着 manual resource management → consider RAII<br><br><strong>真实经验</strong>: platform agent 代码 review 中常见 anti-pattern:<br>· 100+ line class with manual <code>new/delete</code> in dtor → refactor to std::unique_ptr<br>· Member 包含 raw pointer + manual copy/move → wrap to RAII type<br><br>Rule of 0 是 modern code review checklist 必查项。<br><br><strong>关键</strong>: ① Rule of 0 优先；② Rule of 5 当真需要 manual resource；③ Rule of 3 已 obsolete (但仍要懂 legacy code)；④ 显式 = default / = delete 表达意图；⑤ Code review flag 大量自定义 special member functions。`,
      },
      failure_modes: [
        `写 dtor 忘写 move → compiler 不生成 move → 退化 copy`,
        `Manual new/delete 在 dtor 不用 unique_ptr`,
        `Member move 不 noexcept → vector 扩容退化 copy`,
        `Rule of 5 写到简单 type（应该 Rule of 0）`,
        `= delete vs not declared 混 → 隐式生成 unexpected`,
      ],
      follow_ups: [
        { q: `什么时候真的需要 Rule of 5？`, hint: `① 类实现 RAII wrapper (e.g., 自己 wrap pthread mutex / file handle)；② 类直接管 raw resource not in std lib；③ 99% case 用 unique_ptr / vector / wrap-existing-RAII` },
        { q: `Move-only vs copyable 怎么决定？`, hint: `① 包含 unique_ptr / thread → move-only；② 包含 shared_ptr / value type → copyable；③ 显式 = delete copy 让 move-only；④ Default 通常正确` },
        { q: `Empty base class optimization 跟 Rule of 0 关系？`, hint: `① EBO (Empty Base Optimization) 让 empty type 不占空间；② C++20 [[no_unique_address]] 现代替代；③ Rule of 0 + EBO 让 wrapper class 真的 zero-overhead` },
      ],
    },

    57: {
      why_asked: `析构函数声明影响其他成员是 C++ 规则坑。能讲"5 个 special member functions 互相影响"的人懂 standard。`,
      answers: {
        mid: `<strong>用户声明 dtor</strong> → compiler <strong>不生成 move ctor / move assign</strong>（但仍生成 copy ctor / copy assign，C++ 11 后这两个 deprecated）。<br>结果：类<strong>退化为 copy-only</strong>，失去 move 优化。`,
        senior: `<strong>完整规则 (C++ Standard)</strong>:<br>1. 用户声明 <strong>copy ctor / copy assign / dtor</strong> 任一 → <strong>不生成 move ctor/assign</strong><br>2. 用户声明 <strong>move ctor / move assign</strong> 任一 → <strong>不生成 copy ctor/assign (= delete)</strong><br>3. 用户声明 dtor → 生成的 copy ctor/assign <strong>deprecated</strong>（C++11+）<br><br><strong>典型踩坑</strong>:<br><code>class Foo {<br>  std::vector&lt;int&gt; data_;<br>  ~Foo() { /* log destruction */ }<br>};<br>// Compiler 不生成 move → Foo 不 movable<br>// std::vector&lt;Foo&gt; 扩容时退化为 copy<br>// 性能 -50% or worse</code><br><br><strong>修正</strong>: 显式声明<br><code>Foo(Foo&amp;&amp;) noexcept = default;<br>Foo&amp; operator=(Foo&amp;&amp;) noexcept = default;</code>`,
        staff: `深一层：这条规则是<strong>C++ 历史包袱</strong>——为兼容 C++03 code（没 move 概念）保留默认 copy 行为。Modern C++ guidelines 强烈建议<strong>显式控制全部 5 个</strong>或<strong>都不声明 (Rule of 0)</strong>。<br><br><strong>真实事故 case</strong>:<br>1. <strong>platform agent 性能事故</strong>: Message class 含 std::function。某天 dev 加了 <code>~Message() { metrics_.dec(); }</code>。<br>· Compiler 不生成 move ctor → Message 不 movable<br>· std::vector&lt;Message&gt; queue 扩容时 copy 整个 Message (含 std::function copy ~ 100ns)<br>· 高 QPS 下 P99 latency +50%<br>· Profile + look at codegen 才发现<br>· 修正: 显式 <code>Message(Message&amp;&amp;) noexcept = default;</code> → 性能恢复<br><br>2. <strong>Subtle bug: 隐式 copy still works</strong>:<br><code>class Resource {<br>  int* data_;<br>  ~Resource() { delete data_; }  // 用户声明 dtor<br>  // No copy ctor declared → compiler 生成 default copy (deprecated but still works)<br>};<br>Resource a, b = a;  // shallow copy! 两个对象同 data_ → double delete</code><br>修正: <code>Resource(const Resource&amp;) = delete;</code> 或 deep copy<br><br><strong>规则记忆 trick</strong>: "<strong>当你声明 5 中任一，重新思考另外 4 个</strong>"<br><br><strong>建议</strong>:<br>① Rule of 0 优先（不写任何 special member）<br>② 如果必须写，<strong>全部 5 个显式</strong> (= default / = delete / 自定义)<br>③ Move ctor / move assign <strong>显式 noexcept</strong><br>④ Static_assert 验证: <code>static_assert(std::is_nothrow_move_constructible_v&lt;Foo&gt;);</code><br>⑤ Code review tools (clang-tidy) check<br><br><strong>关键</strong>: 析构声明 ≠ 单纯加 logging—— 一定<strong>影响 4 个其他 special member functions</strong>，可能 silent perf 退化或 silent 错误 copy。`,
      },
      failure_modes: [
        `自定义 dtor 没补 move → 退化 copy`,
        `Subtle shallow copy（compiler 默认 generate）→ double delete`,
        `Move 没显式 noexcept → vector 扩容退化`,
        `不知道 dtor 影响其他 4 个`,
        `不用 static_assert 验证 noexcept move`,
      ],
      follow_ups: [
        { q: `什么时候用 = default？`, hint: `① 你想要 compiler 生成（明确意图）；② 防止 deprecated copy generation；③ 跟 = delete 配合精确控制；④ 默认 inline / trivial-preserving` },
        { q: `Trivially copyable 是什么？`, hint: `① 所有 special members 都是 trivial（compiler 生成）；② 可以 memcpy；③ std::is_trivially_copyable_v；④ POD-like type 主流；⑤ 容器 algorithm 优化（vector reserve 用 memcpy not copy ctor）` },
        { q: `Compiler-generated 跟自定义性能差？`, hint: `① Compiler-generated 通常 inline + 优化更激进；② 自定义即使一样代码可能不 inline；③ benchmark 测；④ 大多 case 无差异` },
      ],
    },

    63: {
      why_asked: `异常安全 3 级是 C++ 经典理论 (Stroustrup / Sutter)。能讲清"basic / strong / nothrow"+ 实战的人写过 library。`,
      answers: {
        mid: `<strong>3 级 (Sutter)</strong>:① <strong>Basic</strong>—— 异常后 object 仍 valid (但 state may change), no resource leak；② <strong>Strong</strong>—— 异常后<strong>commit or rollback</strong>，state 不变；③ <strong>Nothrow / No-throw</strong>—— 永不抛 (noexcept)。`,
        senior: `<strong>每级 example</strong>:<br>1. <strong>Basic guarantee</strong>:<br>· std::vector::push_back: 失败时 vector 仍 valid, 但元素可能部分构造<br>· 大多数 STL 操作至少 basic<br>2. <strong>Strong guarantee</strong>:<br>· std::vector::push_back if element copy ctor 不抛 OR move noexcept: strong<br>· 关键技术: copy-and-swap idiom<br>· Performance cost: 通常需要 extra copy<br>3. <strong>Nothrow</strong>:<br>· 关键操作（dtor / swap / move）必须<br>· compiler check: noexcept specifier<br><br><strong>实战 priority</strong>:<br>· dtor: 永远 nothrow (隐式 noexcept; 抛异常 = std::terminate)<br>· swap: 永远 nothrow<br>· move: 努力 nothrow (vector 扩容 move_if_noexcept)<br>· 其他操作: at least basic`,
        staff: `深一层：异常安全是<strong>library / API 设计核心</strong>。Sutter "<strong>Exceptional C++</strong>" 是经典。<br><br><strong>设计原则</strong>:<br>1. <strong>构造函数</strong>: strong (要么完整构造要么不 commit)<br>· 失败抛异常 → 已构造 members 自动析构 (RAII)<br>· 不要 "partial constructed" state<br>2. <strong>析构函数</strong>: nothrow (always)<br>· dtor 抛 + 另一异常 stack unwind = std::terminate<br>· C++11 起 dtor 隐式 noexcept (除非显式 noexcept(false))<br>3. <strong>赋值 (copy/move assign)</strong>: 至少 basic, 理想 strong<br>· copy assign: copy-and-swap idiom 实现 strong<br>4. <strong>swap</strong>: nothrow (member-wise swap of nothrow types)<br><br><strong>copy-and-swap idiom</strong>:<br><code>Foo&amp; operator=(Foo other) {  // 注意是 value param (copy in)<br>  swap(other);  // nothrow swap<br>  return *this;<br>}  // other dtor</code><br>· 异常发生在 copy （early），this 不变 → strong guarantee<br>· Code 简洁 (handle copy/move via param convention)<br><br><strong>真实案例</strong>: platform agent SafeConfig class:<br>· apply(new_config) operation 需要 strong guarantee (atomic apply or rollback)<br>· 用 copy-and-swap: <code>auto temp = current; temp.merge(new_config); swap(current, temp);</code><br>· 中途失败 (merge 抛) → current 不变, rollback automatic<br><br><strong>性能 tradeoff</strong>:<br>· Strong guarantee 通常需要 copy (memory + CPU cost)<br>· Hot path 可能选 basic + 业务层 retry<br>· 关键 financial / atomic op 选 strong<br><br><strong>陷阱</strong>:<br>① dtor 抛异常 (C++11+ 直接 terminate)<br>② swap 抛异常 (assignment 失败状态)<br>③ Strong guarantee 不 verify (测试: 注入异常看 state)<br>④ noexcept 标记错（声明 noexcept 但实际抛 = terminate）<br>⑤ Move 不 noexcept → vector reservation 退化 copy<br><br><strong>验证</strong>:<br>① static_assert noexcept<br>② Code review: 关注 dtor / swap / move<br>③ Sanitizer 测试: 注入异常看 invariant`,
      },
      failure_modes: [
        `dtor 抛异常 → terminate`,
        `swap 抛异常 → assignment 半状态`,
        `Strong guarantee 不 verify`,
        `noexcept 标记错 → 抛即 terminate`,
        `Hot path 强求 strong → 性能浪费`,
      ],
      follow_ups: [
        { q: `Copy-and-swap idiom 完整 implementation？`, hint: `① Member swap (nothrow)；② Free swap function (ADL)；③ copy ctor / move ctor (= default OK)；④ operator= takes value param + swap；⑤ Rule of 5 兼容` },
        { q: `noexcept(noexcept(...)) 是什么？`, hint: `① 条件性 noexcept—— 基于其他表达式是否 noexcept；② 例: <code>void swap(T&amp; a, T&amp; b) noexcept(noexcept(a.swap(b)))</code>；③ 模板代码常用` },
        { q: `异常安全跟 thread safety 关系？`, hint: `① 独立维度；② 但 strong exception safety 通常需要 atomic / lock 配合 thread safety；③ 写 thread-safe library 必须同时考虑两者` },
      ],
    },

    65: {
      why_asked: `栈展开是 C++ 异常实现 detail。能讲"unwind table + RAII + 性能"的人懂 zero-overhead exception。`,
      answers: {
        mid: `<strong>Stack Unwinding</strong>: 抛异常时，runtime <strong>反向遍历调用栈</strong>，对每个栈帧调用<strong>所有局部对象的析构</strong>（RAII），直到匹配的 catch。`,
        senior: `<strong>详细过程</strong>:<br>1. throw 表达式 → runtime 构造 exception object (typically heap-allocated)<br>2. 查 <strong>EH frame table</strong> (.eh_frame section) 找当前 PC 的 cleanup info<br>3. <strong>Phase 1 (search)</strong>: 反向遍历栈帧找匹配 catch<br>4. <strong>Phase 2 (cleanup)</strong>: 对每个栈帧调用 <strong>local destructors</strong>（按构造逆序）<br>5. 到匹配 catch block → transfer control<br>6. 没匹配 catch → std::terminate<br><br><strong>关键</strong>:<br>· 局部对象 dtor 自动调用 = <strong>RAII</strong> 安全基础<br>· dtor 不能 throw（C++11+ 强制 noexcept）<br>· 性能: throw 1 次 ~1-100 µs，no-throw path 0 overhead`,
        staff: `深一层：栈展开机制是<strong>"zero-cost exception"</strong> 的实现基础。<br><br><strong>关键概念</strong>:<br>1. <strong>Itanium ABI exception handling</strong> (GCC / Clang Linux): <br>· <strong>.eh_frame + .gcc_except_table</strong> sections 存 unwind info (DWARF format)<br>· no-throw path: 完全不读这些 (zero cost on hot path)<br>· throw path: libgcc_eh.a / libunwind 执行 unwind<br>2. <strong>Two-phase</strong>: phase 1 (search) + phase 2 (cleanup)<br>· Phase 1 找 catch 但不 destroy<br>· 找到才 phase 2 destroy + transfer<br>· 没找到 (uncaught) → terminate 前不 destroy (UB-ish but standard)<br>3. <strong>性能</strong>:<br>· No throw: 0 ns overhead<br>· Throw: 1-100 µs (proportional to stack depth + dtor count)<br>· 不适合 hot path 控制流<br><br><strong>RAII safety</strong>:<br>· 局部 unique_ptr → dtor 自动 release<br>· 局部 lock_guard → dtor 自动 unlock<br>· 局部 vector → dtor 自动 free<br>· 这就是 "<strong>构造函数 strong guarantee + RAII</strong>" 的基础<br><br><strong>真实案例 1</strong>: platform agent 早期一段代码:<br><code>void f() {<br>  auto lock = mtx.lock();  // RAII<br>  do_work();               // throw inside<br>}  // unwinding: lock dtor auto release</code><br>异常没 catch → terminate 但 lock 仍 release。<br><br><strong>真实案例 2</strong>: dtor 抛异常事故:<br><code>struct R {<br>  ~R() { throw std::runtime_error("..."); }  // BAD<br>};<br>void f() {<br>  R r;<br>  throw std::runtime_error("other");  // already unwinding<br>  // r dtor throws → std::terminate</code><br>修正: dtor 永不抛 (C++11+ implicit noexcept)<br><br><strong>陷阱</strong>:<br>① <strong>dtor throw</strong>—— terminate 直接<br>② <strong>跨 .so 异常</strong>—— typeid 跨边界可能不匹配<br>③ <strong>跨 C ABI</strong>—— C 不能 catch C++ 异常, UB<br>④ <strong>异常做控制流</strong>—— hot path 性能崩 (1000× 慢于 if/else)<br>⑤ <strong>不 catch by const reference</strong>—— catch by value slicing 派生信息丢<br><br><strong>跨编译器 / 平台</strong>:<br>· GCC / Clang: Itanium ABI<br>· MSVC: 自己的 SEH-based ABI（不兼容 Itanium）<br>· 跨编译器 .so 不能 throw 异常`,
      },
      failure_modes: [
        `dtor 抛异常 → terminate`,
        `异常做控制流 → 性能崩`,
        `跨 C ABI 抛异常`,
        `catch by value slicing`,
        `dtor 内 catch all 掩盖错误`,
      ],
      follow_ups: [
        { q: `Zero-cost exception 真的 zero cost 吗？`, hint: `① No-throw path: yes (only metadata in eh_frame section)；② Binary size +5-15%；③ Throw cost 1-100 µs；④ "Zero cost" 指 normal execution path` },
        { q: `noexcept 函数抛异常会怎样？`, hint: `① 直接 std::terminate（不 unwind 进一步）；② 用 noexcept 是 contract / 编译器优化提示；③ 错标 noexcept = 隐藏 bug` },
        { q: `跟其他语言异常 (Java / Python) 比？`, hint: `① Java/Python: 异常 cost 较低 (throw ~ µs)；② C++: throw 较慢但 no-throw zero cost；③ Java/Python: 常用异常做控制流 (OK); C++: 不该` },
      ],
    },

    69: {
      why_asked: `std::expected 是 C++23 关键新特性，2026 hot 题。能讲"vs 异常 + monadic ops + 适用场景"的人跟上 C++ 发展。`,
      answers: {
        mid: `<strong>std::expected&lt;T, E&gt;</strong>: 包含 value (T) 或 error (E)，类似 Rust Result。<strong>vs 异常</strong>:<br>· 性能 zero overhead (stack-only)<br>· 显式 error handling（caller 强制看）<br>· 适合频繁错误 / hot path<br>· 异常适合罕见 / catastrophic`,
        senior: `<strong>用法</strong>:<br><code>std::expected&lt;int, std::string&gt; divide(int a, int b) {<br>  if (b == 0) return std::unexpected("div by zero");<br>  return a / b;<br>}<br>auto r = divide(10, 0);<br>if (r) use(*r);<br>else log(r.error());</code><br><br><strong>monadic operations</strong>:<br>· <code>.and_then(f)</code>: if value, apply f; else propagate error<br>· <code>.transform(f)</code>: map value through f<br>· <code>.or_else(f)</code>: if error, apply f<br>· 链式 error handling 无 nested if<br><br><strong>选择指南</strong>:<br>· <strong>异常</strong>: catastrophic / programmer error / 无 valid return value<br>· <strong>expected</strong>: 业务可预期错误 / 频繁触发 / hot path<br>· 项目内可混用: API boundary expected, 内部 catastrophic 异常`,
        staff: `深一层：expected 是 <strong>C++23 标准化 Rust-style error handling</strong>—— 2024-2026 主流。Boost.Outcome / leaf 是 pre-C++23 替代。<br><br><strong>性能对比 (typical hot path)</strong>:<br>· Exception throw + catch: 1-100 µs<br>· expected return + check: &lt; 1 ns<br>· Difference: <strong>1000-100000×</strong><br><br><strong>真实迁移案例</strong>: platform agent v3 把 parse error 从异常改 expected:<br>· Before: <code>Message parse(string)</code> throws on parse error<br>· After: <code>std::expected&lt;Message, ParseError&gt; parse(string)</code><br>· Hot path benchmark: throughput +12%<br>· Code 改动: callers 必须显式 handle error (一开始 verbose)<br>· 后期发现: 实际 error rate 10% 不算"<strong>罕见</strong>", expected 更 fit<br><br><strong>monadic chaining 优雅</strong>:<br><code>auto result = parse(input)<br>  .and_then([](auto m) { return validate(m); })<br>  .and_then([](auto m) { return process(m); })<br>  .transform([](auto r) { return r.summary(); });</code><br>vs nested if-else + manual error propagation:<br><code>auto m = parse(input);<br>if (!m) return std::unexpected(m.error());<br>auto v = validate(*m);<br>if (!v) return std::unexpected(v.error());<br>...</code><br><br><strong>陷阱</strong>:<br>① <strong>所有错误都用 expected</strong>—— programmer error / OOM 用异常更合理<br>② <strong>不用 monadic ops</strong>—— code 仍 verbose<br>③ <strong>Error type 太宽</strong>—— <code>std::expected&lt;T, std::string&gt;</code> 失去类型信息，改用 enum / variant<br>④ <strong>跨 ABI 用 expected</strong>—— 标准 type ABI 仍可能不稳<br>⑤ <strong>Heavy error type</strong>—— expected size = sizeof(T) + sizeof(E) + 1, error type 大时浪费<br><br><strong>跟 Result&lt;T, E&gt; (Rust) / Result (Haskell)</strong>: 完全同概念，C++23 标准化版。<br><br><strong>建议</strong>:<br>① C++23 项目优先 expected for predictable errors<br>② Pre-C++23: Boost.Outcome / leaf / tl::expected<br>③ 异常仍用 for: ctor / OOM / programmer bug<br>④ Error type 用 enum class + 详细 context struct<br>⑤ 链式用 monadic ops`,
      },
      failure_modes: [
        `所有错误都用 expected → ctor/OOM 应该异常`,
        `不用 monadic ops → code 仍 verbose`,
        `Error type 太宽（string）→ 失去类型`,
        `跨 ABI 用 expected → 不稳`,
        `Heavy error type → expected size 浪费`,
      ],
      follow_ups: [
        { q: `Pre-C++23 怎么模拟 expected？`, hint: `① Boost.Outcome；② tl::expected (header-only)；③ leaf (Niall Douglas)；④ 自己 wrap variant&lt;T, E&gt;` },
        { q: `expected 跟 optional 区别？`, hint: `① optional&lt;T&gt;: 值或没值 (no error info)；② expected&lt;T, E&gt;: 值或带类型 error；③ optional 适合 "missing" 场景, expected 适合 "fail with reason"` },
        { q: `跟 Rust Result 比较？`, hint: `① 概念同；② Rust 强制 ? operator 处理；③ C++ expected 不强制 (但 [[nodiscard]] 帮)；④ 实际使用相似 patterns` },
      ],
    },

    72: {
      why_asked: `make_shared vs shared_ptr(new) 是 C++ 性能 + 异常安全题。能讲"single allocation + 异常安全 + weak_ptr lifetime"的人懂 implementation。`,
      answers: {
        mid: `<strong>3 个优势</strong>:① <strong>单次 allocation</strong>—— object + control block 一起分配 (1 allocation vs 2)；② <strong>异常安全</strong>—— 避免 raw new 泄漏；③ <strong>cache-friendly</strong>—— object 跟 control block 相邻。`,
        senior: `<strong>详细</strong>:<br><br>1. <strong>单次 allocation 性能</strong>:<br>· make_shared: 1 次 alloc (object + control block)<br>· shared_ptr(new T): 2 次 alloc (new T + new control block)<br>· Allocation cost: ~50-100ns × 2 vs 1<br>· Cache: object + ctrl 相邻 → cache hit on deref<br><br>2. <strong>异常安全</strong>:<br><code>// Unsafe<br>f(shared_ptr&lt;T&gt;(new T), shared_ptr&lt;U&gt;(new U));<br>// 评估顺序未定: new T, new U, ctor shared_ptr<br>// 中间 throw → leak<br>// Safe<br>f(make_shared&lt;T&gt;(), make_shared&lt;U&gt;());  // each is atomic</code><br><br>3. <strong>缺点</strong>:<br>· Object 跟 control block 一起分配 → <strong>weak_ptr 持有时 object memory 也不能 release</strong> (要等 weak count = 0)<br>· 不能 custom deleter (use new + custom_deleter 时)<br>· 大 object + 长 weak_ptr lifetime → memory pinned`,
        staff: `深一层：make_shared 优化看似简单，但<strong>side effect</strong> 经常被忽略:<br><br><strong>memory pinning by weak_ptr</strong>:<br>· make_shared: object + ctrl 一起分配<br>· 当 shared_ptr 全 release (strong count = 0) → object dtor 调用<br>· 但 memory 仍 pinned 直到 weak count = 0<br>· 即 1 个 weak_ptr 仍 alive 时, object 的 100MB memory 不能 free<br>· vs shared_ptr(new T): object alloc 跟 ctrl alloc 独立 → object dtor 时 object memory 立即 release, weak count 0 后才 release ctrl<br><br><strong>真实事故</strong>: platform agent 缓存 large object + 偶尔有 weak_ptr observer:<br>· 用 make_shared → 大 object memory 持有时间长 (weak_ptr 延长 lifetime)<br>· 切换到 shared_ptr(new T, custom_deleter) → object 立即 free, ctrl 稍后 free<br>· Memory usage 改善 30%<br><br><strong>选择决策</strong>:<br>· <strong>默认</strong>: make_shared (单次 alloc 性能 + 异常安全)<br>· <strong>大 object + 可能有 weak_ptr</strong>: shared_ptr(new T)<br>· <strong>需要 custom deleter</strong>: shared_ptr(new T, deleter)<br>· <strong>需要 aligned alloc</strong>: shared_ptr(new (alignment) T) or std::allocate_shared<br>· <strong>不需要 weak_ptr</strong>: make_shared always OK<br><br><strong>C++17/20 改进</strong>:<br>· C++17: std::make_shared with custom alignment<br>· C++20: std::make_shared&lt;T[]&gt; for array<br>· make_unique (C++14) 类似但 unique_ptr 不 share<br><br><strong>陷阱</strong>:<br>① 大 object + weak_ptr → memory pinned<br>② Custom deleter 不能用 make_shared<br>③ 自定义 allocator (std::allocate_shared 可以)<br>④ 性能微 benchmark 不显（除非 hot path 大量分配）<br>⑤ shared_ptr 自身 24 字节 (vs raw ptr 8) memory overhead<br><br><strong>关键</strong>: ① 默认 make_shared；② 大 object + weak 时用 new；③ 跨 weak_ptr usage pattern 决定。`,
      },
      failure_modes: [
        `大 object + weak_ptr → memory pinning`,
        `Custom deleter 仍用 make_shared`,
        `Hot path 没考虑 make_shared 性能优势`,
        `不知 weak_ptr 延长 memory (ctrl block) lifetime`,
        `Raw new 在 ctor arg → 异常 leak`,
      ],
      follow_ups: [
        { q: `make_unique 跟 unique_ptr(new) 区别？`, hint: `① make_unique 也异常安全；② 但 unique_ptr 不 share → 没"双 alloc"问题；③ make_unique 主要是异常安全 + 简洁；④ 性能 minimal difference` },
        { q: `std::allocate_shared 怎么用？`, hint: `① Custom allocator 但仍 single alloc；② 用 polymorphic_allocator + memory pool 在 hot path；③ 接口: <code>std::allocate_shared&lt;T&gt;(allocator, args...)</code>` },
        { q: `make_shared 跟 weak_ptr 内部结构？`, hint: `① 单次 alloc: header (ref counts + deleter) + T object；② shared_ptr: strong_count + weak_count + ptr to T；③ weak_ptr.lock(): atomic CAS strong_count；④ Boost.intrusive_ptr 更轻 (no separate ctrl block)` },
      ],
    },

    73: {
      why_asked: `循环引用是 shared_ptr 经典陷阱。能讲"weak_ptr 解决 + design 避免"的人调过 leak。`,
      answers: {
        mid: `<strong>问题</strong>: A 持 shared_ptr&lt;B&gt;, B 持 shared_ptr&lt;A&gt; → 两者 ref count 永不到 0 → memory leak。<br><strong>解法</strong>: 一方改 <strong>weak_ptr</strong>（typically 是 "back-reference"—— 子 → 父）。`,
        senior: `<strong>典型场景</strong>:<br>1. <strong>Parent-Child</strong>: parent owns children (shared_ptr), child references parent (<strong>weak_ptr</strong>)<br>2. <strong>Observer pattern</strong>: subject owns observers (shared_ptr), observers reference subject (weak_ptr)<br>3. <strong>Doubly linked list</strong>: next 用 shared_ptr, prev 用 weak_ptr<br><br><strong>weak_ptr usage</strong>:<br><code>weak_ptr&lt;T&gt; w = some_shared;<br>if (auto sp = w.lock()) {<br>  // sp is shared_ptr, use sp<br>} else {<br>  // object 已 destroyed<br>}</code><br><br><strong>检测工具</strong>:<br>· LSan / Valgrind: 检测最终 leak<br>· heaptrack: 看 allocation pattern<br>· Manual review: 标识 ownership 关系`,
        staff: `深一层：循环引用是<strong>"ownership 设计不清晰"</strong> 的症状。本质问题不是 shared_ptr 本身，是<strong>没明确"谁拥有谁"</strong>。<br><br><strong>设计原则</strong>:<br>1. <strong>每个 object 有 1 个 owner</strong> (root path 唯一)<br>2. <strong>非 owning 关系用 weak_ptr / raw ptr / reference</strong><br>3. <strong>避免双向所有权</strong>—— 一定 wrong<br>4. <strong>Tree-like ownership</strong> 健康<br>5. <strong>Graph-like ownership</strong> 需 weak_ptr or GC<br><br><strong>真实事故</strong>:<br><br><strong>Case 1: Parent-Child</strong><br><code>class Node {<br>  shared_ptr&lt;Node&gt; parent_;  // BAD<br>  vector&lt;shared_ptr&lt;Node&gt;&gt; children_;<br>};<br>// Parent 持 children, children 持 parent → 循环</code><br>修正: <code>weak_ptr&lt;Node&gt; parent_;</code><br><br><strong>Case 2: Observer</strong><br><code>class Subject {<br>  vector&lt;shared_ptr&lt;Observer&gt;&gt; observers_;  // BAD if Observer holds Subject<br>};<br>class Observer {<br>  shared_ptr&lt;Subject&gt; subject_;  // BAD</code><br>修正: Subject 持 raw / weak Observer, Observer 持 weak Subject<br><br><strong>Case 3: Callback</strong><br><code>void register_callback(shared_ptr&lt;Self&gt; this_) {<br>  registry_.push_back([this_]() { this_-&gt;do_it(); });<br>}<br>// lambda 持 shared_ptr&lt;Self&gt;, Self 持 lambda → 循环</code><br>修正: lambda 持 weak_ptr<br><br><strong>检测 + 防范</strong>:<br>1. <strong>Code review</strong>: 看到 shared_ptr 时问 "谁是 owner"<br>2. <strong>Test 时跑 LSan / Valgrind</strong>: 检测 leak<br>3. <strong>Heap profiler</strong>: 看 retention path<br>4. <strong>设计</strong>: tree-like ownership优先<br><br><strong>真实经验</strong>: platform agent v2 一个偶发 OOM (~100MB / hour grow). 用 jeprof heap profile 发现 Subject + Observer 互持。Fix weak_ptr 后 OOM 消失。<br><br><strong>跟 GC 语言对比</strong>:<br>· Java/Python: GC 处理循环引用 (mark-and-sweep)<br>· C++/Rust: 必须 explicit ownership design<br>· Rust 编译期强制 (Rc + Weak)，C++ runtime 检测<br><br><strong>陷阱</strong>:<br>① 双向 shared_ptr<br>② Lambda capture this 作 shared_ptr<br>③ Container holds shared_ptr to object holding container<br>④ 跨层级（GUI parent-child）误用 shared_ptr<br>⑤ Detection 推迟到生产 → memory growth long-running service<br><br><strong>建议</strong>:<br>① Design first—— ownership graph 必无环<br>② weak_ptr for 非 owning reference<br>③ Code review 强制 question shared_ptr usage<br>④ Test 跑 LSan / Valgrind<br>⑤ Heap profiler in production monitoring`,
      },
      failure_modes: [
        `双向 shared_ptr → 循环`,
        `Lambda capture this as shared_ptr → 循环`,
        `Observer pattern 不用 weak_ptr`,
        `Tree-like ownership 错画成 graph`,
        `不跑 LSan / Valgrind 检测`,
      ],
      follow_ups: [
        { q: `enable_shared_from_this 解决啥？`, hint: `① 从 this 获 shared_ptr（不创新 ref count）；② Inherit enable_shared_from_this&lt;T&gt; → shared_from_this()；③ 用法: callback 需要 shared_ptr&lt;Self&gt;；④ 注意: 第一个 shared_ptr 创建后才能用` },
        { q: `怎么 detect 循环引用？`, hint: `① LSan / Valgrind on exit；② Heap profiler (jeprof / massif) 看 retention path；③ Code review: 双向 shared_ptr → red flag；④ Some debug allocator track ref count` },
        { q: `Hazard pointer 跟 weak_ptr 区别？`, hint: `① weak_ptr: per-object 控制块开销 (32 bytes)；② Hazard pointer: thread-local hazard slot, no per-object overhead；③ Hazard 适合 lock-free 数据结构；④ Folly / userspace-RCU 实现` },
      ],
    },

    75: {
      why_asked: `RAII 是 C++ 最核心 idiom。能讲"构造获取 + 析构释放 + 异常安全 + scoped"4 个 dimension 的人理解透彻。`,
      answers: {
        mid: `<strong>RAII (Resource Acquisition Is Initialization)</strong>: 资源在<strong>构造时获取</strong>，<strong>析构时自动释放</strong>。Stroustrup 命名，但核心是 C++ 析构机制 + 异常安全 unwind。`,
        senior: `<strong>4 个 dimension</strong>:<br>1. <strong>构造获取</strong>: 资源在 ctor 内 alloc / lock / open<br>2. <strong>析构释放</strong>: dtor 自动 free / unlock / close<br>3. <strong>异常安全</strong>: 抛异常时 stack unwind 调用 dtor → 资源自动 release<br>4. <strong>Scoped lifetime</strong>: 资源 lifetime = 对象 lifetime<br><br><strong>典型 RAII types</strong>:<br>· std::unique_ptr / shared_ptr: heap memory<br>· std::lock_guard / unique_lock: mutex<br>· std::ifstream / ofstream: file handle<br>· std::thread (C++20 jthread): thread join<br>· 自定义: 自己 wrap pthread / SOCKET / DB connection<br><br><strong>跟异常安全关系</strong>:<br>· RAII 是 strong exception safety 的<strong>基础</strong><br>· 抛异常时局部 RAII 对象自动析构 → 资源 release<br>· 这就是为什么 C++ 不需要 try/finally`,
        staff: `深一层：RAII 是 C++ 区别于其他语言的<strong>核心设计哲学</strong>。其他语言:<br>· Java: try/finally 或 try-with-resources<br>· Python: with statement (__enter__/__exit__)<br>· Go: defer<br>· Rust: Drop trait (类似 RAII)<br><br>C++ 的 RAII<strong>是 idiomatic / automatic</strong>—— 局部对象生命周期结束自动调 dtor, no need explicit handling.<br><br><strong>实现 RAII type 5 步</strong>:<br>1. Ctor: 获取资源 (设置成员)<br>2. Dtor: 释放资源 (清理成员)<br>3. Copy ctor / assign: 决策 - shared / unique / deleted<br>4. Move ctor / assign: 转移 ownership (typically default if members are smart)<br>5. swap (nothrow): 用于 strong exception safety<br><br><strong>真实 RAII 例</strong>:<br><code>class FileGuard {<br>  FILE* fp_;<br>public:<br>  FileGuard(const char* path) : fp_(fopen(path, "r")) {<br>    if (!fp_) throw std::runtime_error("open failed");<br>  }<br>  ~FileGuard() { if (fp_) fclose(fp_); }<br>  FileGuard(const FileGuard&amp;) = delete;<br>  FileGuard&amp; operator=(const FileGuard&amp;) = delete;<br>  FileGuard(FileGuard&amp;&amp; o) noexcept : fp_(std::exchange(o.fp_, nullptr)) {}<br>  FileGuard&amp; operator=(FileGuard&amp;&amp; o) noexcept {<br>    std::swap(fp_, o.fp_); return *this;<br>  }<br>  FILE* get() { return fp_; }<br>};</code><br><br><strong>RAII 不只 memory</strong>:<br>· File handles<br>· Mutex locks<br>· Network sockets<br>· Database connections<br>· GUI resources (handles / contexts)<br>· OpenGL / GPU buffers<br>· Transaction commits / rollbacks<br><br><strong>真实 case</strong>: platform agent 数据库 transaction RAII:<br><code>class TxnGuard {<br>  Connection&amp; conn_;<br>  bool committed_ = false;<br>public:<br>  TxnGuard(Connection&amp; c) : conn_(c) { c.begin(); }<br>  ~TxnGuard() { if (!committed_) conn_.rollback(); }<br>  void commit() { conn_.commit(); committed_ = true; }<br>};<br>// 使用<br>void update() {<br>  TxnGuard tx(conn_);<br>  do_updates();      // 抛异常 → tx dtor rollback<br>  tx.commit();       // 显式 commit<br>}</code><br>异常自动 rollback 比 try/catch 简洁 + 不会漏。<br><br><strong>陷阱</strong>:<br>① <strong>Dtor 抛异常</strong>—— terminate<br>② <strong>没 delete copy</strong> 资源被 double-released<br>③ <strong>Move 后 source 不重置</strong> → dtor double-free<br>④ <strong>跨 ABI</strong>—— RAII 不能跨 C ABI<br>⑤ <strong>Manual cleanup mix RAII</strong>—— 显式 close() + RAII 双重 cleanup<br><br><strong>建议</strong>:<br>① 所有资源 wrap to RAII type<br>② 单一 ownership semantics (copy / move / unique)<br>③ Dtor noexcept (默认 implicit)<br>④ Move 后 reset source<br>⑤ 用 std lib (unique_ptr / lock_guard / fstream) 优先于自己写`,
      },
      failure_modes: [
        `Dtor 抛异常 → terminate`,
        `没 delete copy → double-release`,
        `Move 后 source 不 reset → double-free`,
        `跨 C ABI 用 RAII → 不工作`,
        `Manual close() + RAII dtor → double close`,
      ],
      follow_ups: [
        { q: `怎么实现 ScopeExit (Go defer 风格)？`, hint: `<code>template&lt;class F&gt; struct ScopeExit { F f_; ~ScopeExit() { f_(); } };</code> + factory func；或 boost::scope_exit；C++17 lambda-based；适合 cleanup ad-hoc resource` },
        { q: `RAII 跟 Drop trait (Rust) 区别？`, hint: `① 概念相同；② Rust Drop 编译期强制 ownership move（编译错 vs runtime UB）；③ C++ 更灵活但 require 更多 discipline；④ Rust borrow checker 防 use-after-free` },
        { q: `什么时候 RAII 不适用？`, hint: `① 跨线程 ownership transfer（仍可用 RAII + smart ptr）；② Manual cleanup needed (rare, e.g., specific timing)；③ C interop boundary；④ GC-like deferred cleanup 需求` },
      ],
    },
  },

  pm: {
    // ============== 框架 ==============
    1: {
      why_asked: `PM / EM 面试必问。能讲"Action 50% + 用我不用我们 + 量化结果 + 留钩子"4 要点的人通常做过 mock 面试或读过 Gayle McDowell。`,
      answers: {
        mid: `<strong>STAR</strong>：Situation（背景）→ Task（任务）→ Action（行动）→ Result（结果）。所有"讲一次你..."的<strong>行为题</strong>都用这个公式。`,
        senior: `<strong>时间分配 + 4 大要点</strong>：<br>· <strong>S</strong>: 10-15s（背景 + 我的角色 + 时间）<br>· <strong>T</strong>: 10s（目标 + 关键挑战）<br>· <strong>A</strong>: <strong>45-50s（最重要！）</strong>—— 具体做了什么，<strong>用"我"不用"我们"</strong><br>· <strong>R</strong>: 15s（结果 + 衡量，<strong>必须有数字</strong>）<br>· R+: 可选 10s（学到什么）<br><br><strong>高分要点</strong>：① Action 占 50% 时间；② 用"我"不用"我们"；③ 结果<strong>量化</strong>（百分比/节省时间/提升指标）；④ 留 1-2 个<strong>钩子</strong>让对方主动追问。`,
        staff: `深一层：STAR 不是"答题套路"而是<strong>面试官 evaluate 信号的框架</strong>—— 通过看你 STAR 各段比例可以判断：① 偏 process（侧重 S/T）vs 偏 execution（侧重 A）；② 个体贡献（"我"清晰）vs 团队 follower（满口"我们"）；③ 真做过（细节具体）vs 听说过（泛泛而谈）。<br><br><strong>真实经验</strong>：我跟 mentor mock 面试发现自己常犯：<br>① <strong>S 段太长</strong>（30s+，面试官失去耐心）→ 砍到 15s<br>② <strong>用"我们"</strong>（暴露不知自己具体贡献）→ 强迫自己 4 个"我"开头<br>③ <strong>R 没数字</strong>（"提升了用户体验"）→ 改 "DAU +12% / P99 -40%"<br>④ <strong>无钩子</strong>（讲完案例无下文）→ 故意留"细节我可以展开"信号<br><br><strong>典型 anti-pattern</strong>：① 把 S 当主菜（讲了 1 分钟项目背景才到 A）；② Action 写成"我们大家一起..."；③ Result 只说"很成功"无数字；④ 故事一气讲完 5 分钟没让面试官追问—— 失去 calibration 机会。<strong>实战训练</strong>：① 准备 6-8 个 STAR 故事（覆盖领导力 / 失败 / 冲突 / 创新等高频维度）；② 录音听自己（关键看用我 vs 我们比例）；③ 4 分钟极限版 + 90s 精简版各练熟。`,
      },
      failure_modes: [
        `S 段太长（&gt; 30s）→ 面试官失耐心`,
        `用"我们"不用"我" → 看不出个人贡献`,
        `R 无量化数字 → "成功"是 vacuous`,
        `Action 写成"团队大家一起" → 个体贡献模糊`,
        `一气讲完不留钩子 → 失去面试官 follow-up 机会`,
      ],
      follow_ups: [
        { q: `Action 段具体讲什么？`, hint: `① 具体决策（我决定 X 而非 Y）；② 关键沟通（我跟 Z 说了 X）；③ 量化技术细节（用了 X tool / X 框架）；④ 反映 leadership / influence` },
        { q: `失败题的 R 怎么讲？`, hint: `① 量化失败程度（"项目延期 3 个月 / 用户流失 X%"）；② 自我反思（"复盘发现我 X 决策错"）；③ 学习 + 后续改进（"现在用 Y 框架避免重蹈"）` },
        { q: `怎么准备 STAR 故事库？`, hint: `① 列 6-8 个项目；② 每项目按维度（领导力 / 影响力 / 失败 / 冲突 / 创新 / 跨部门）打标签；③ 一个故事可服务多维度；④ 90s + 4min 两版本各练熟` },
      ],
    },

    // ============== 行为题 ==============
    2: {
      why_asked: `领导力高频题。能讲"识别贵货币 + Pyramid + Bridge"的人是真用过 Cohen-Bradford 影响力理论。`,
      answers: {
        mid: `用 STAR 讲。重点在 <strong>Action</strong>：用 <strong>Cohen-Bradford 6 类货币</strong>（地位 / 关系 / 灵感 / 任务 / 个人 / 影响力）找到对方"<strong>贵货币</strong>"；用 <strong>Pyramid Principle</strong> 写一页纸打动决策者；用 <strong>Bridge</strong> 找信任第三方背书。`,
        senior: `<strong>"没人想做"的<u>根因诊断</u></strong>：① 看不见 ROI（数据不足）；② 看见 ROI 但<strong>影响其他优先级</strong>；③ 历史失败过；④ 文化抵触（"以前没这么干过"）。每个根因 action 不同。<br><strong>典型 Action</strong>：<br>· 用 customer interview / data 让 ROI 可见<br>· Pyramid 一页纸：结论 → 3 论据 → 数据支撑<br>· 找 1-2 个 sponsor（高级别）背书<br>· 小范围 pilot validate → 数据说话 → 全推`,
        staff: `深一层：这道题考的是 PM <strong>"无权但有影响力"</strong>核心能力。<strong>Cohen-Bradford 货币模型</strong>详解：<br>① <strong>Task</strong>: 直接帮助对方完成本职（"我帮你 X，你帮我 Y"）<br>② <strong>Inspiration</strong>: 大愿景 / 使命感<br>③ <strong>Status</strong>: 地位 / 影响力扩展<br>④ <strong>Relationship</strong>: 友谊 / 信任<br>⑤ <strong>Personal</strong>: 个人偏好 / 兴趣<br>⑥ <strong>Position</strong>: 职权 / 资源<br>关键：<strong>不同 stakeholder 贵货币不同</strong>。Tech lead 通常贵 task + inspiration；EM 贵 status + relationship；C-level 贵 inspiration + position；财务贵 task。<br><br><strong>真实案例</strong>：我推过一个 "API 监控统一" 项目，5 个团队都没动力。<br><strong>诊断</strong>：① 团队 A 觉得他们的监控已足够；② 团队 B 担心额外工作量；③ 团队 C 怕 visibility 后 SLO 暴露问题。<br><strong>Action</strong>：<br>· 跟 A 强调"事故时跨团队协作快 30%"（task currency）<br>· 跟 B 提供我们 team 帮 setup（task currency）<br>· 跟 C 强调"反正大家都做，谁不做谁突出"（status currency 反向）<br>· 找 VP sponsor 在 leadership meeting 1 分钟提一句（position currency）<br><strong>R</strong>：4 个月推 4 个团队上线，第 5 个团队主动来 onboard（peer pressure），事故 MTTR 从 45min 降到 18min。<strong>陷阱</strong>：① 一种货币打所有人（如 C-level 不在意 task）；② 不诊断根因直接 push；③ 不给对方"赢"的空间（强势压人）；④ 没 sponsor 单兵作战。`,
      },
      failure_modes: [
        `单一货币打所有 stakeholder（每个人 sweet spot 不同）`,
        `不诊断"为什么没人想做"直接 push → 反弹更强`,
        `用 position（"我老板让你做"）压人 → 短期有效长期失信`,
        `没找 sponsor / Bridge 第三方背书 → 单兵作战累`,
        `Pilot 不验证就全推 → 失败影响 credibility`,
      ],
      follow_ups: [
        { q: `Pyramid Principle 怎么用？`, hint: `① 顶层：1 句话结论；② 中层：3-5 个支撑论点；③ 底层：每个论点的具体数据 / 例子；④ "金字塔倒过来给"——先讲结论再 drill down` },
        { q: `没有 sponsor 怎么办？`, hint: `① 找 peer 中受尊重的（不一定 senior）做"first follower"；② Bridge 信任第三方背书；③ 用 data + case study 替代权威；④ 渐进式建立 own credibility` },
        { q: `Cohen-Bradford 跟其他影响力理论关系？`, hint: `① Cialdini 影响力 6 原则（互惠 / 一致 / 社会认同 / 喜好 / 权威 / 稀缺）—— 心理学层面；② Cohen-Bradford 实务层面；③ 组合用更强；④ 推荐读两本原书` },
      ],
    },

    3: {
      why_asked: `"无权而有影响力"经典考察。能讲"没职权 + 数据 + 备选 + 1on1"的人是真做过 senior PM 工作。`,
      answers: {
        mid: `"<strong>Influence Without Authority</strong>" 案例。STAR 重点：① 我<strong>没有职权</strong>用<strong>数据</strong>；② 备选方案<strong>不带情绪</strong>；③ 通过 <strong>1on1 而非公开会议</strong>让对方"自己得出结论"。`,
        senior: `<strong>关键技巧</strong>：<br>① <strong>找贵货币</strong>（见 #2）：对 senior 通常 inspiration / position currency<br>② <strong>preparation</strong>：准备好数据 + 至少 3 个备选方案 + 自己倾向但不暴露<br>③ <strong>提问 &gt; 主张</strong>：用 Socratic 方法让对方"自己发现"<br>④ <strong>1on1 不是公开会</strong>：避免对方"挂面子" → 私下更愿听<br>⑤ <strong>明确 ask</strong>：你要的是什么具体决策 / 资源 / 时间`,
        staff: `深一层：影响 senior 的<strong>核心心态转变</strong>是 "<strong>我不是来让他同意我，是来一起做出更好决策</strong>"。Senior 时间 expensive，准备<strong>不充分 = 浪费他的时间 = 失去 next opportunity</strong>。<br><br><strong>真实案例</strong>：我作为 EM 想推一个 "<strong>10% 工程时间投技术债</strong>" 制度，但 VP 不感兴趣（"我们 deadline 紧"）。<br><strong>Action</strong>：<br>1) <strong>1on1 准备</strong>：① 跟 VP 1on1 列了 sprint 数据（最近 6 sprint 有 4 个 missed deadline，平均因为 unexpected bug fix）；② 提了 3 个 option（A: 0% 不变 / B: 10% 投入 / C: 20% 投入）；③ 量化预期：B 选项预计 3 个月后 sprint completion rate +15%。<br>2) <strong>提问引导</strong>：不主张"我们应该 B"，而问 "你看这 4 个 missed deadline，root cause 都是 tech debt，咱们 60% 时间在救火，长期可持续吗？"<br>3) <strong>1on1 不公开</strong>：VP 公开会面子 weight 大，私下他可以说 "I was thinking about this too"。<br>4) <strong>明确 ask</strong>："想试 3 个月 pilot，30 day check-in 决定 continue"。<br><strong>R</strong>：VP 同意 pilot；3 个月后 sprint completion rate +18%（超预期），推到所有团队。<br><br><strong>陷阱</strong>：① <strong>没数据靠 passion</strong>（senior 不吃这套）；② 唯一方案推（"必须 B"）显得 inflexible；③ 公开 push（让 senior 面子下不来）；④ 没明确 ask（senior 不知道你要他做什么决策）；⑤ <strong>太软</strong>—— "我只是建议"等于不主张。<strong>关键</strong>：① pre-meet 1on1 比 group meet 高效 10×；② Senior 看你的 thought process 不只是结论；③ 接受被否决—— 准备 backup plan 或 next iteration。`,
      },
      failure_modes: [
        `没数据靠 passion → senior 不 buy`,
        `单一方案推（"必须做 X"）→ 显得 inflexible`,
        `公开 group meeting push → senior 面子下不来 → 抵触`,
        `没明确 ask → senior 不知道要他干什么`,
        `太软（"只是建议"）→ 等于没主张`,
      ],
      follow_ups: [
        { q: `Senior 不直接拒绝但 stall 怎么办？`, hint: `① 跟进 cadence（每 2 周 1on1）；② 提供更多 data / case study；③ 找 peer 帮你 advocate；④ 接受可能需要 6-12 个月 build credibility；⑤ 同时推进 small win 建立 track record` },
        { q: `怎么避免 senior 觉得你"越级"？`, hint: `① 提前跟自己 manager align（"我打算跟 X VP 谈，你怎么看"）；② 谈完 brief manager；③ 始终代表 manager / team interest，不是 personal agenda；④ Manager support 是关键` },
        { q: `Senior 当场推翻你的 proposal 怎么应对？`, hint: `① 不 defend，先 acknowledge（"good point on X"）；② 问"what would make you supportive"挖根因；③ 跟进发 written summary + revised proposal；④ 不挂面子，反映成熟度` },
      ],
    },

    4: {
      why_asked: `跨部门考察 PM 综合能力。能讲"4 件套（map + RACI + EVM + 风险）+ SPI/CPI 量化"的人是真做过项目管理。`,
      answers: {
        mid: `体现 <strong>4 件套</strong>：① <strong>stakeholder map</strong>（power-interest grid）；② <strong>RACI</strong>（每交付物明确 R/A/C/I）；③ <strong>EVM 监控</strong>（每周 SPI / CPI）；④ <strong>风险登记</strong>（top 10 risk + mitigation）。结果一定要用 <strong>SPI / CPI</strong> 或<strong>具体节省 X 周</strong>的数字。`,
        senior: `<strong>STAR 完整结构</strong>：<br>· <strong>S</strong>: 项目规模（涉及多少团队 / 多少人 / 时长）<br>· <strong>T</strong>: 我作为 PM 的角色 + 主要挑战<br>· <strong>A</strong>: 4 件套的具体应用 + 2-3 个关键决策（如 trade-off / escalation）<br>· <strong>R</strong>: 量化结果（按时上线 / 超 deliver / 跨团队满意度）<br><br><strong>关键</strong>：跨部门 complexity 不是讲<strong>故事多 dramatic</strong>，是讲<strong>process discipline</strong>—— 怎么<strong>系统化</strong>管理多变量。`,
        staff: `深一层：跨部门项目<strong>失败的 90% 在 setup 阶段</strong>：① stakeholder 没识别全；② RACI 没明确 → 后期扯皮 ownership；③ 风险没 surface → 中后期 surprises。<strong>4 件套的真实价值</strong>不是文档本身，而是<strong>"setup 时强迫思考"</strong>。<br><br><strong>真实案例</strong>：基础设施 "<strong>跨 5 个团队的 platform agent 替换项目</strong>"（替老 Java agent）：<br><strong>S</strong>: 5 team (Engineering / Ops / QA / Product / Customer Success) / 18 人月预算 / 6 个月 timeline / 8 个客户 customer-facing<br><strong>T</strong>: 我作为 PM lead，挑战：① 5 团队 priorities 不同；② 客户 transition 风险高；③ 老 agent 已在生产 8 年（dependencies 复杂）<br><strong>A</strong>:<br>1) <strong>Stakeholder map</strong>：8 个客户 + 5 team leads + VP Engineering + VP Sales，按 power/interest 排<br>2) <strong>RACI</strong>：12 个交付物（代码 / 文档 / migration tool / customer training 等），每个明确 R/A/C/I<br>3) <strong>EVM</strong>：每周 weekly report 给 VP + customer success，SPI / CPI trend<br>4) <strong>风险登记</strong>：top 12 risk，每月 review；用 P × I 矩阵<br>5) <strong>关键决策</strong>：① month 3 发现 QA team underallocate → 升级到 VP 加资源；② month 5 一个客户拒绝迁移 → 决定 keep dual agent for them 6 months（trade-off）<br><strong>R</strong>: 6 个月按时完成，SPI = 0.98 / CPI = 1.05（small under-budget），8 个客户 7 个按时迁移，第 8 个延 3 个月（accepted risk），<strong>跨团队 NPS +30 vs 平均跨部门项目</strong>。<br><br><strong>陷阱</strong>：① 4 件套写完不<strong>持续 review</strong>（变成 setup artifact）；② RACI 写多个 A（每个 deliverable 只能 1 个 accountable）；③ 风险不分级 → 都当 high priority → 实际 nothing 优先；④ 量化结果不显著（"项目成功" vs "SPI = 0.98"）。`,
      },
      failure_modes: [
        `Setup 阶段 4 件套不全 → 后期扯皮`,
        `RACI 多个 A（每行必须 1 个）`,
        `风险不分级 → 都 high → 实际 nothing 优先`,
        `EVM / 进度不 weekly review → setup 文档变成历史档案`,
        `R 段不量化（"项目成功"）→ 信号弱`,
      ],
      follow_ups: [
        { q: `Stakeholder Map 怎么画？`, hint: `① Power × Interest 2x2 grid；② High P + High I = Manage Closely；High P + Low I = Keep Satisfied；Low P + High I = Keep Informed；Low + Low = Monitor；③ 每个 stakeholder 标 quarterly cadence` },
        { q: `RACI 跟 DACI / RAPID 区别？`, hint: `① RACI 适合 deliverable-driven 项目；② DACI（Driver / Approver / Contributor / Informed）适合 decision-driven；③ RAPID（Recommend / Agree / Perform / Input / Decide）Bain 风格，复杂决策用；scenario 选` },
        { q: `EVM 数据怎么收集 + 报？`, hint: `① Jira / Asana / 自定义 dashboard；② Weekly status report 自动生成 SPI / CPI / 趋势 chart；③ 月度 stakeholder review；④ tools: MS Project / Smartsheet / Jira Advanced Roadmaps` },
      ],
    },

    14: {
      why_asked: `失败题考<strong>self-awareness</strong>。能讲"承担责任 + 具体根因 + 学习 + 防再犯"的人通过；甩锅 / 假谦虚都 fail。`,
      answers: {
        mid: `<strong>4 步</strong>：① 承担责任（不甩锅）；② 具体说错在哪（<strong>数据 / 假设 / 沟通</strong> 哪类）；③ 讲学到了什么；④ 讲后来怎么避免。`,
        senior: `<strong>关键原则</strong>：① <strong>选真的错决策</strong>不是"伪谦虚"（如"我太投入了"）；② <strong>不甩锅</strong>（不归咎团队 / 老板 / 客户）；③ <strong>根因到 process / system 层</strong>（不止"我没注意"）；④ <strong>后续具体改进</strong>（"现在每次决策前 X 检查"）。`,
        staff: `深一层：面试官通过这题<strong>验证三个信号</strong>：① <strong>真有反思能力</strong>（不是 PR-style 答案）；② <strong>能识别 system / process 层 root cause</strong>（不只 individual blame）；③ <strong>真改进了</strong>（不是嘴上学习）。<br><br><strong>真实案例</strong>：作为 EM 决策"<strong>暂停一个 in-flight 项目以追快 deadline 项目</strong>"。<br><strong>具体错</strong>：<br>· <strong>假设错</strong>：我假定 in-flight 项目"小 pause 再 restart 容易"。实际上：① 工程师 context switch 成本巨大；② in-flight 团队成员 morale 受打击（"我的工作不重要"）；③ in-flight 项目 dependency 也卡<br>· <strong>沟通错</strong>：决策时没充分跟 in-flight 团队解释 trade-off rationale，他们感觉被 ignore<br>· <strong>process 错</strong>：没正式 evaluation framework，凭"deadline 优先"直觉决策<br><strong>结果</strong>：deadline 项目按时上线，但 in-flight 项目 1 个 senior dev 3 个月后离职（部分原因），项目 restart 后效率 -40%，<strong>整体净损失 &gt; 收益</strong>。<br><strong>学到</strong>：<br>① <strong>system thinking</strong>：决策影响远超个体决策点（second order effect）<br>② <strong>沟通成本 underestimated</strong>：trade-off 决策必须包含 explanation 给受影响 team<br>③ <strong>正式 framework</strong>：现在用 <strong>Decision Matrix</strong>（impact / urgency / reversibility / team morale）打分而非直觉<br>④ <strong>1on1 first</strong>：影响重大决策前跟受影响 team lead 1on1，给他们影响决策的机会<br><br><strong>后续改进</strong>：① <strong>Decision Log</strong>（quarterly review）；② <strong>跨项目 prioritization framework</strong> 在团队全员对齐；③ 6 个月没再做类似 "switch project" 决策但<strong>有过 1 次"诱惑场景"</strong>—— 这次按 framework 评估，决定 NOT switch，事后 validated。<br><br><strong>陷阱</strong>：① <strong>选小 stake 决策</strong>（暴露不愿真 share）；② <strong>把 individual blame 当 root cause</strong>（system / process 层更深）；③ <strong>讲完后续没改</strong>（"我会更小心"是 vacuous）；④ <strong>"我们决策错"</strong>—— 这是 STAR 大忌（"我"不是"我们"）。`,
      },
      failure_modes: [
        `选小 stake 决策（"我曾选了错 typeface"）→ 不诚信`,
        `甩锅给团队 / 老板 / 客户 / 时间不够`,
        `Root cause 停在 individual blame（"我没注意"）→ 不深入`,
        `没具体后续改进（"我会更小心"）→ vacuous`,
        `用"我们"主语 → 看不出个人 ownership`,
      ],
      follow_ups: [
        { q: `怎么选合适的"错决策"故事？`, hint: `① 真的有 impact（不是 trivial）；② 你确实有 ownership（不是别人决定）；③ 已经 resolved / 有 learning；④ 能讲到 root cause 层；⑤ 后续真改进了` },
        { q: `面试官说 "你这个不算 mistake" 怎么办？`, hint: `① 不 defend"为啥算"；② 直接 give another example（"你说得对，那我说另一个"）；③ 准备 2-3 个 mistake 故事 backup` },
        { q: `怎么讲"还没 fully recover" 的失败？`, hint: `① 客观陈述 status；② 讲已经做的 mitigation；③ 讲 still-learning（"6 个月后再 review，我会带新 data"）；④ 显示成熟（不是所有失败都立即 turn-around）` },
      ],
    },

    22: {
      why_asked: `<strong>真失败题</strong>。能讲"非伪谦虚 + 责任 + 根因 + 长期改变"的人是真有 PM 经历。`,
      answers: {
        mid: `<strong>真失败</strong>（不是"伪谦虚"），讲清<strong>责任 / 根因 / 补救 / 长期改变</strong>。表现出"<strong>我能从失败中学到东西</strong>"的能力。`,
        senior: `<strong>结构</strong>：<br>1) <strong>S/T</strong>: 项目背景 + 我作为 PM 角色 + 失败的具体定义（哪个目标没达成）<br>2) <strong>A</strong>: 我做了什么决策 / 行动，特别是<strong>哪些是事后看错的</strong><br>3) <strong>R</strong>: 失败结果（量化：用户流失 / 收入损失 / 团队 morale）+ 我作为 PM 承担的部分<br>4) <strong>+R</strong>: 复盘 root cause + 学到的 + 后续 X 个 quarter 应用了 learning 的 evidence`,
        staff: `深一层：真失败题<strong>三个 trap</strong>：① <strong>伪失败</strong>（"项目 ship 晚了 1 周但成功了"）；② <strong>外部归因</strong>（"market 变了"）；③ <strong>没 learning evidence</strong>（"我学到要 communicate 更多"，没具体）。<br><br><strong>真实案例</strong>：作为 PM 负责 "<strong>platform agent v3 自定义 plugin 框架</strong>"—— 让客户能写自定义 plugin 扩展 agent 行为。<br><br><strong>S/T</strong>: 6 个月 + 4 工程师 / 跟 5 个 strategic 客户调研后启动 / 目标：3 客户 adopt + 验证产品方向。<br><strong>A (我的关键决策)</strong>:<br>1) <strong>过早 commit framework API</strong>：调研只看了 5 客户，假定他们的 use case 代表全部<br>2) <strong>开发期跟 strategic 客户 weekly sync 不够 deep</strong>（产品 demo 一致点头，但没要求实际 prototype trial）<br>3) <strong>没识别 alternative</strong>（客户其实更需要 better default config，不是 plugin 灵活性）<br>4) <strong>launch 时 plugin API 复杂度过高</strong>（需要 client engineer 学 ~ 100 个 callbacks）<br><br><strong>R</strong>: 6 个月按时 ship + 客户 demo 都说"很赞" → 实际 3 个月内 0 客户真用上；6 个月内只 1 客户 prototype（被代码量震惊）；产品方向调整 - kill 这个 framework + 转回 better config UX。<strong>损失</strong>：~4 工程师 × 6 个月 = 2 person-year 投入，加上信誉 cost。<br><br><strong>root cause（复盘）</strong>：<br>1) <strong>Discovery 不充分</strong>：调研 stop at "yes I like" 没深入到"<strong>你愿意花多少时间学</strong>"<br>2) <strong>缺 prototype validation</strong>：直接做 production code，没 wireframe / mock 验证<br>3) <strong>vanity metric</strong>：把 demo 反应当成功信号（实际 demo 是社交礼貌）<br>4) <strong>没 alternative 探索</strong>：先入为主"我们要做 plugin"，没考虑 simpler solutions<br><br><strong>学习 + 后续 evidence</strong>：<br>1) <strong>Discovery Framework</strong>：现在 discovery 必有 "<strong>willingness to pay</strong>" 量化（时间 / 钱 / 复杂度容忍）<br>2) <strong>Prototype-first</strong>：production 投入前必有 prototype 给 3-5 客户 hands-on test<br>3) <strong>Anti-vanity metric</strong>：discovery 阶段不看"喜欢吗"看"会用吗 + 多少 effort"<br>4) <strong>后续 6 quarter</strong>：3 个新功能都按 framework 做，1 个 kill 在 prototype 阶段（avoided 6 month investment），2 个 ship 后 success<br><br><strong>陷阱</strong>：① 选不真 painful 的失败 → 显得不严肃；② 不量化 cost → 不真实；③ Learning 不 specific（"要 listen 用户"）；④ 没 evidence 真 apply learning。`,
      },
      failure_modes: [
        `选伪失败（"晚 1 周但成功"）→ 不严肃 / 不诚信`,
        `外部归因（"market 变 / 团队不给力"）→ 没 ownership`,
        `量化 cost 缺失 → 不真实`,
        `Learning vague（"要更注意 X"）→ 没 actionable`,
        `没后续 evidence apply learning → 不可信改了`,
      ],
      follow_ups: [
        { q: `如果项目失败但你不负责怎么办？`, hint: `① 仍找出"我可以做更多"的部分（advocate / escalate / influence）；② 不全甩锅 EM / VP；③ 体现 expanding ownership 心态` },
        { q: `失败后跟团队怎么 communicate？`, hint: `① 第一时间 honest 承担；② Blameless retro（重点 system not individual）；③ 给团队明确 path forward；④ 庆祝 learning + 表扬 contributors` },
        { q: `面试官质疑你的 learning 不够具体？`, hint: `① 给 specific case study（"X 项目我用了 Y framework"）；② 显示前后对比的 evidence；③ 接受批评（"good point, here's another angle"）` },
      ],
    },

    23: {
      why_asked: `经典 self-awareness 题。能讲"真弱点 + 具体改进 evidence"的人通过；假谦虚（"我太完美主义"）立即 fail。`,
      answers: {
        mid: `<strong>真弱点 + 具体改进 evidence</strong>。例："我以前会<strong>过度做计划</strong>反而拖延决策，去年读了《Decisive》后练习 <strong>2-way door 决策思维</strong>，现在会主动用 70/30 法则。"`,
        senior: `<strong>3 部分</strong>：<br>1) <strong>真弱点</strong>（不是"太完美主义" / "工作太投入"）：选一个<strong>真的影响过 work output</strong>的<br>2) <strong>具体改进 evidence</strong>：读了什么 / 做了什么 / 谁帮助你 / 用了什么 framework<br>3) <strong>仍在路上 / 可观察 progress</strong>：不假装"已完美解决"`,
        staff: `深一层：这道题考<strong>self-awareness + growth mindset</strong>。面试官 looking for：① <strong>真知道自己 weakness</strong>（不是 deflect）；② <strong>主动 work on it</strong>（不是认命）；③ <strong>能看到 progress</strong>（measurable）。<br><br><strong>真实例子</strong>：我的真弱点是 "<strong>对 conflict 不够直接，倾向于私下解决而非现场 push back</strong>"。<br><br><strong>具体 manifest</strong>：① 跨团队会议有 disagreement 时倾向 "I'll follow up after" 而非现场 challenge；② 1on1 给负面 feedback 容易过 soft（员工感觉"还好"实际 serious）。<br><strong>影响</strong>：① 错过 group setting 的 alignment 机会（事后 1-on-1 effort × 5）；② 员工 review 时 surprise（"我以为没那么 serious"）。<br><br><strong>改进 actions</strong>：<br>1) <strong>读书</strong>：《Crucial Conversations》《Radical Candor》（Kim Scott）<br>2) <strong>训练</strong>：跟 mentor coach 每月 mock 一次 difficult conversation<br>3) <strong>practice in low-stakes</strong>：每周至少在 1 个非关键会议 push back 一次（练习 muscle）<br>4) <strong>结构化负面 feedback</strong>：每次给 feedback 用 SBI framework（Situation-Behavior-Impact）+ 录音听自己<br><br><strong>Progress evidence</strong>：<br>1) <strong>过去 6 个月</strong>：跨团队会议 push back 增加 ~3×（peer feedback 360 数据）<br>2) <strong>员工 review</strong>：去年 review 0 surprise（前年 2 个）<br>3) <strong>仍要 improve</strong>：跟 VP 1on1 给 feedback 仍然偏 soft（power dynamics + cultural 因素）<br><br><strong>陷阱</strong>：① "我太 perfectionism"（红旗答案，90% 候选人答这个）；② "工作太投入"（伪谦虚）；③ 没改进 evidence（只承认）；④ 选 work-irrelevant weakness（如"我不擅长 sport"）；⑤ 假装已完美 fix（不真实）。`,
      },
      failure_modes: [
        `"完美主义" / "太投入" → 伪谦虚红旗`,
        `选 work-irrelevant weakness → 显得 dodge`,
        `只承认没改进 → 没 growth mindset`,
        `假装已完美 fix → 不真实`,
        `Weakness vague（"沟通"）→ 没具体场景`,
      ],
      follow_ups: [
        { q: `面试官说 "this isn't really a weakness" 怎么办？`, hint: `① 同意 + 升级 stake（"对，更严重的是 X"）；② 给具体 painful example；③ 准备 2-3 个不同 weakness backup` },
        { q: `怎么找自己真 weakness？`, hint: `① 360 feedback（同事 / 下属 / 上级 anonymous）；② 自己 1on1 with mentor / coach；③ Performance review 上 manager 的 "areas to grow"；④ 自我反思失败案例 root cause` },
        { q: `Weakness 跟 area-to-grow 区别？`, hint: `① Weakness: 已经影响 work output；② Area to grow: skill 没到下个 level；③ 面试通常问 weakness（更严重），但你可以 reframe 成 growth area + 加 progress evidence` },
      ],
    },

    26: {
      why_asked: `转 PM 必问。能讲 3 层（推 / 拉 / 准备）的人通常想清楚了，不是冲动转。`,
      answers: {
        mid: `<strong>3 层结构</strong>：① <strong>推力</strong>（EM 让我意识到产品决策影响 &gt; 技术深度）；② <strong>拉力</strong>（具体场景 / 角色让我兴奋）；③ <strong>准备</strong>（过去 3 个月学了什么 / 做了什么）。`,
        senior: `<strong>展开例子</strong>：<br>1) <strong>推</strong>: "作为 senior EM 我发现 80% 影响力发生在产品决策时刻（这个 feature 要不要做、怎么定义 success），而我对'用户场景'理解还不够深；技术决策反而是 derived"<br>2) <strong>拉</strong>: "我喜欢做用户研究 + 数据分析定义问题，比写代码 / 管理团队更让我 energized；过去带产品讨论时我 take 太多 leadership role 即使非 PM"<br>3) <strong>准备</strong>: "过去 6 个月：① 读 Inspired / Lean Product Playbook / Continuous Discovery；② 跟 5 个 senior PM 1on1；③ 主动 take 2 个 cross-functional initiative 当 PM role；④ 做了一个 side project 完整 product cycle"`,
        staff: `深一层：转 PM 的<strong>真 risk</strong>是: ① "<strong>不爱写代码所以转 PM</strong>"（红旗，PM 不是 IC 升级）；② "<strong>看 PM 工作光鲜</strong>"（实际 PM 多数时间是 negotiation / 写 PRD / 跟数据）；③ "<strong>转完后悔回不去</strong>" → 候选人没 calibration。<br><br><strong>面试官 looking for</strong>：① <strong>清晰 motivation</strong>（不是 default option）；② <strong>清楚 trade-off</strong>（接受 PM 的不光鲜面）；③ <strong>已经在做 PM-like 工作</strong>（不是凭空想象）。<br><br><strong>真实经验</strong>：我从 senior EM 想转 PdM 时，跟 5 个 senior PM 1on1 学到：<br>1) <strong>PM 是 hardest job 之一</strong>—— 没直接权力但要 align 所有人；<br>2) <strong>没 immediate feedback</strong>—— ship 后数个月才知道做对没；<br>3) <strong>很多人讨厌 PM</strong>—— 工程师觉得 PM "添乱"，sales 觉得 PM "拒绝客户需求"；<br>4) <strong>需要 thick skin</strong>—— Decision 经常被质疑 / 改。<br><br>了解这些 reality 后我选择"<strong>先做 PM-like work 6 个月再决定</strong>"：take 一个 strategic project 当 de facto PM（continued EM role 但 work allocation 70% PM-flavor）；6 个月后：<br>① <strong>energy 持续高</strong>（喜欢 problem ambiguity）<br>② <strong>但</strong>意识到我对 quantitative analysis 不够（弱在 SQL / experiments）<br>③ 决定"<strong>side career pivot</strong>" 而非完全转<br><br><strong>说给面试官的版本</strong>: 推 + 拉 + 准备 + <strong>"我做了 6 个月 dry run，看到自己 strengths 和 gaps"</strong> → 这种 calibrated 答案比纯热血 strong 10×。<br><br><strong>陷阱</strong>：① "不喜欢写代码"（红旗）；② "我觉得 PM 工作有趣"（vague）；③ 没准备 evidence；④ 不知道 PM dark side；⑤ "<strong>我管理过 team 所以我适合 PM</strong>"—— PM 跟 EM 完全不同技能集，不能混淆。`,
      },
      failure_modes: [
        `"不喜欢写代码 / 不想做 EM 了" → 红旗 motivation`,
        `vague description（"PM 工作有趣"）`,
        `没准备 evidence（没读书 / 没 dry run / 没 PM mentor）`,
        `不知道 PM dark side（被以为 idealized PM）`,
        `用 EM / IC 经验直接 map 到 PM（误以为是 same skill set）`,
      ],
      follow_ups: [
        { q: `如果做了 PM 6 个月发现不适合怎么办？`, hint: `① 跟 manager 坦诚谈；② 看是否能回 EM/IC track（很多公司可逆）；③ 总结学到的 PM skills 对 IC/EM 也有用；④ 显示成熟 self-awareness` },
        { q: `从 EM 转 PM vs 从 IC 转 PM 区别？`, hint: `① EM → PM：strength 在 execution / leadership / cross-functional；gap 在 product depth / data；② IC → PM：strength 在 technical depth；gap 在 leadership / ambiguity；不同 path 准备不同` },
        { q: `转 PM 后 senior level 怎么算？`, hint: `① 通常 PM 公司从 mid level 起算（不是 fresh）；② Your past EM/IC seniority 部分认可；③ 第一年薪资可能持平或略降；④ 长期 ROI 看个人 trajectory` },
      ],
    },

    // ============== PgM EVM ==============
    32: {
      why_asked: `EVM 基础题。能讲清 PV/EV/AC 概念 + 公式应用的人是真做过项目控制。`,
      answers: {
        mid: `<strong>PV / EV / AC</strong>：<br>· <strong>PV (Planned Value)</strong>: 计划价值（按 baseline schedule 应完成的工作量 × 预算单价）<br>· <strong>EV (Earned Value)</strong>: 挣值（实际完成的工作量 × 预算单价）<br>· <strong>AC (Actual Cost)</strong>: 实际成本<br><strong>EV vs PV 看进度</strong>，<strong>EV vs AC 看成本</strong>。`,
        senior: `<strong>核心公式</strong>：<br>· <strong>SV (Schedule Variance)</strong> = EV - PV（正值 = 超前，负值 = 落后）<br>· <strong>CV (Cost Variance)</strong> = EV - AC（正值 = 省钱，负值 = 超支）<br>· <strong>SPI (Schedule Performance Index)</strong> = EV / PV（> 1 = 超前）<br>· <strong>CPI (Cost Performance Index)</strong> = EV / AC（> 1 = 省钱）<br>· <strong>EAC (Estimate at Completion)</strong> = BAC / CPI（按当前 CPI 推总成本）<br>· <strong>ETC (Estimate to Completion)</strong> = EAC - AC（还要花多少钱）`,
        staff: `深一层：EVM 的<strong>真实价值</strong>不是公式而是<strong>"用客观数据替代主观判断"</strong>。没 EVM 时 PM 跟老板汇报"项目挺好"，主观；有 EVM 时报 "SPI = 0.85 / CPI = 0.92，按当前 trend EAC 比 BAC 高 18%"，客观。<br><br><strong>实战 + 真实经验</strong>：电信项目用 EVM tracking：<br>· Baseline: 6 个月 / 18 人月预算<br>· Week 12 (50%) 时：PV = $90k / EV = $63k / AC = $84k → SPI = 0.7 / CPI = 0.75 → 红灯<br>· EAC = BAC / CPI = $180k / 0.75 = $240k → 超 $60k<br>· <strong>给 VP report</strong>："项目红区，按当前 trend 超 33% 预算 + 落后 30%。Root cause: scope creep + 1 个 senior dev离职。建议：① cut 20% scope；② 加 1 个 contractor 6 周"<br>· <strong>决策</strong>：选 ②，3 周后 SPI 回到 0.85，CPI 0.85（仍超但 manageable）<br><br><strong>陷阱</strong>：① <strong>EVM 不衡量 quality</strong>（按 schedule 但代码烂也是 EV 完成）—— 加 quality metric 配合；② <strong>baseline 不更新</strong>—— scope 改了不重新 baseline 导致 SV 失真；③ <strong>50% rule</strong> 滥用（task 开始算 50% EV，完成才 100%）—— 适合短任务，长任务用 milestone EV；④ <strong>weekly tracking overhead</strong>—— 小项目 EVM 太重，用简化版（task% complete）。<strong>工具</strong>：MS Project / Smartsheet / Jira Advanced Roadmaps / 自建 Excel。`,
      },
      failure_modes: [
        `混淆 PV / EV / AC（典型新人）`,
        `Baseline 不更新（scope 变了仍按老 PV）`,
        `EVM 当唯一信号（忽略 quality / team morale）`,
        `小项目用复杂 EVM（overhead &gt; value）`,
        `不知道 EAC / ETC 怎么预测（停在 SPI / CPI）`,
      ],
      follow_ups: [
        { q: `SPI 跟 schedule 实际进度差什么？`, hint: `① SPI 是 value-based（EV / PV），不是 duration-based；② 项目最后阶段 SPI 会自然 → 1（EV catches up），<strong>不代表真按时</strong>；③ 用 SPI + critical path duration 组合判断` },
        { q: `EAC 几种算法？`, hint: `① EAC₁ = AC + (BAC - EV)（假设剩余按 baseline 速度）；② EAC₂ = BAC / CPI（假设按当前 CPI）；③ EAC₃ = AC + (BAC - EV) / (CPI × SPI)（综合）；通常 ② 最常用` },
        { q: `什么场景不适合 EVM？`, hint: `① 极小项目（&lt; 2 人月）；② Agile / Scrum 持续 backlog（用 velocity）；③ 探索性 R&D（无 fixed scope）；④ EVM 适合 plan-driven + 大型项目` },
      ],
    },

    33: {
      why_asked: `EVM 应用题。能用<strong>BLUF + 量化 + 选项 + ask</strong>的人是真做过 escalation。`,
      answers: {
        mid: `<strong>BLUF（Bottom Line Up Front）</strong>：项目<strong>红区</strong>，进度低 30%、超 25%。<strong>EAC₂</strong> 预测 +25%。建议<strong>追预算或减范围二选一</strong>。`,
        senior: `<strong>详细 talk track</strong>（90s 版）：<br>1) <strong>BLUF</strong>："项目当前 SPI = 0.7 / CPI = 0.8 → red zone"<br>2) <strong>EAC</strong>："按当前 trend 总成本超 25% / 完成时间 + 4 周"<br>3) <strong>Root cause</strong>："① X scope creep / ② Y 团队 turnover / ③ Z 外部依赖延"<br>4) <strong>3 个 options</strong>（不只 1 个）：<br>· A: 加预算 +25% 维持 scope<br>· B: cut scope 30% 保 timeline<br>· C: 延期 4 周 维持 scope + 预算<br>5) <strong>My recommendation + rationale</strong>：B 因为<br>6) <strong>Ask</strong>："需要 you 同意 X 决策 by EOW"`,
        staff: `深一层：这道题考<strong>EM/PM 向上汇报的核心能力</strong>—— 把<strong>坏消息变成 actionable 决策</strong>。<br><br><strong>对比 anti-pattern</strong>：<br>· <strong>差答</strong>："项目有点问题，进度落后，可能要延期"（vague + no ask + 不显示思考）<br>· <strong>好答</strong>: 上面 6 步 BLUF 结构<br><br><strong>真实经验</strong>：项目 month 4 EVM SPI = 0.65 / CPI = 0.8。我跟 VP 1on1：<br>1) <strong>BLUF</strong>: "项目 red，需要你决策 by EOW"<br>2) <strong>data</strong>: SPI / CPI / EAC + trend chart (4 weeks)<br>3) <strong>root cause</strong>: 2 个 dependency 延迟（vendor X 没按时 deliver SDK / regulatory approval 慢 3 周）+ 1 个 senior 离职<br>4) <strong>3 options</strong>: <br>· A: +$200k 加 contractor + 维持 scope + on time<br>· B: cut feature Y（30% scope）+ 保 timeline + 不加 budget<br>· C: 延 4 周 + 不加 budget + 维持 scope<br>5) <strong>Recommend B</strong>: feature Y 已经 deprioritized in product roadmap，cutting 影响小<br>6) <strong>Ask</strong>: VP approval by Friday<br><strong>VP 反应</strong>: "appreciate the clarity, let's do B"<br><strong>关键</strong>：① <strong>不绕弯</strong>—— 90s 内 VP 知道 status + 要决策；② <strong>option 不止 1 个</strong>—— 显示我考虑了 trade-off；③ <strong>recommend + rationale</strong>—— 显示我有判断不是甩问题；④ <strong>明确 ask + timeline</strong>—— 不让 VP 自己想要 do 什么。<br><br><strong>陷阱</strong>：① 没量化（"SPI 不太好"）；② 没 3 个 options；③ 没 recommendation；④ Ask 不明确（"看看怎么办"）；⑤ 拖延报 → grapevine 先到 → trust 崩。<strong>对 VP 心理</strong>：他们 prefer <strong>"early bad news with options"</strong> &gt; "late surprise"。`,
      },
      failure_modes: [
        `BLUF 不上来直接讲 → 拖时间`,
        `没量化（"挺糟"）→ vague`,
        `没 3 options 单一 push → 不显思考`,
        `Recommendation 不明确 → VP 不知你想啥`,
        `Ask 不明确（"看你怎么定"）→ 没 next step`,
      ],
      follow_ups: [
        { q: `VP 当场否决你的 recommendation 怎么办？`, hint: `① 不 defend，先 acknowledge；② 问"what would make A workable"；③ 24h 内 follow-up written summary + revised proposal；④ 不挂面子` },
        { q: `怎么避免 SPI/CPI 短期 fluctuation 误报红灯？`, hint: `① 用 trend (4-week moving avg)；② 配 critical path（spi 不重要任务波动 OK）；③ 早期项目数据少 → 慎判断；④ 跟 EM / tech lead 双向 validate` },
        { q: `VP 跟 sponsor 不一样的 update 怎么办？`, hint: `① 一致 message + audience-adjusted depth；② sponsor (operational) 知 detail；③ VP (strategic) 知 BLUF + ask；④ 两者 align 后再 publish` },
      ],
    },

    45: {
      why_asked: `项目管理基础题。能讲"R 干活 / A 拍板 / C / I"4 件套 + "每行 1 个 A"的人是真做过 PM。`,
      answers: {
        mid: `<strong>R</strong> 干活（多个）/ <strong>A</strong> 拍板（每行 <strong>1 个</strong>）/ <strong>C</strong> 咨询 / <strong>I</strong> 通知。每个交付物 1 行。`,
        senior: `<strong>详细</strong>：<br>· <strong>R (Responsible)</strong>: 实际执行的人，<strong>可多个</strong><br>· <strong>A (Accountable)</strong>: 对结果 accountable，<strong>每行只能 1 个</strong>（"<strong>One throat to choke</strong>"）<br>· <strong>C (Consulted)</strong>: 决策前要咨询的（双向沟通）<br>· <strong>I (Informed)</strong>: 决策后告知的（单向沟通）<br><br><strong>关键规则</strong>：① 每个 deliverable 1 行；② A 必须 1 个；③ R 可以是 A 同一人（小项目）；④ Stakeholder 多时拆 RACI 矩阵 by phase。`,
        staff: `深一层：RACI 的<strong>真实价值</strong>是<strong>"setup 阶段强迫 align ownership"</strong>—— 90% 跨部门项目失败因为<strong>不清楚 ownership</strong>。RACI 写完 review 时<strong>暴露的问题</strong>比 RACI 本身更有价值。<br><br><strong>RACI 常见 anti-pattern</strong>：<br>① <strong>多个 A</strong>（"我们三个一起 own"）→ 实际没人 own → 失败<br>② <strong>所有 cell 都是 R</strong>（everyone is responsible）→ 等于 nobody is<br>③ <strong>A 没 authority</strong>（accountable 但没决策权）<br>④ <strong>太多 C</strong>（一切要 consult）→ 决策慢死<br>⑤ <strong>RACI 写完不维护</strong>—— stakeholder 变了不更新<br><br><strong>真实案例</strong>：电信项目跨 5 团队 RACI 表，12 个 deliverable：<br>· "v3 agent code" → R: eng team A / A: eng lead A / C: architect + product / I: customer success<br>· "client migration tool" → R: eng team B / A: eng lead B / C: support / I: VP<br>· "customer training" → R: customer success / A: CS lead / C: eng lead A / I: sales<br>...<br>RACI 第一稿被 lead 们 challenge 3 轮：① "client migration tool" 谁 A？最初写两个 team lead 都 A → 改成 1 个 sub-team lead A；② "training" customer success 不知道 own 吗？→ explicit assign。<br>RACI 完后 ownership 清晰，<strong>项目执行期间 0 ownership 扯皮</strong>。<br><br><strong>陷阱</strong>：① <strong>RACI 当 documentation 不当 alignment tool</strong>；② Big project 不分 phase（一张 RACI 太大）；③ R/A 不在 group meeting 跟 stakeholder confirm；④ <strong>A 跟 manager hierarchy 不 align</strong>（A 是 lower level 但 senior 老在 push opinion）。<strong>变体</strong>：① DACI（Driver / Approver / Contributor / Informed）—— Atlassian 用，适合 decision-driven 项目；② RAPID（Recommend / Agree / Perform / Input / Decide）—— Bain，复杂决策；scenario 选。`,
      },
      failure_modes: [
        `多个 A（"我们一起 own"）→ 没人真 own`,
        `所有 cell R（"everyone responsible"）→ vacuous`,
        `A 没 authority（accountable 但没决策权）`,
        `太多 C（一切咨询）→ 决策瘫痪`,
        `Setup 后不维护 → stakeholder 变化 RACI 过期`,
      ],
      follow_ups: [
        { q: `RACI 跟 DACI 怎么选？`, hint: `① RACI: deliverable-driven 项目（每个 artifact 1 行）；② DACI: decision-driven（每个 decision 1 行）；③ 实战常组合：项目用 RACI，关键决策用 DACI` },
        { q: `Big project RACI 怎么 manage？`, hint: `① 按 phase 拆（discovery / build / launch 各一张）；② Top-level summary + 子 RACI；③ Tool: Smartsheet / Confluence / 专门 RACI tool` },
        { q: `Stakeholder 不同意 RACI 怎么办？`, hint: `① 不要 PM 单独决定—— 跟 stakeholders 一起 draft；② 第一版 review 时 disagreement 是 normal；③ Escalate 给 sponsor 仲裁；④ 写完 RACI 所有 R/A 必须签名 confirm` },
      ],
    },

    // ============== PdM ==============
    52: {
      why_asked: `PdM 基础题。能讲"反映价值 + 可拆解 + 跟留存正相关"3 条 + 具体公司例子的人是真做过 PdM。`,
      answers: {
        mid: `反映产品对用户<strong>核心价值</strong>的<strong>唯一指标</strong>。3 条：<strong>反映价值 / 可拆解 / 与长期留存正相关</strong>。例：Spotify <strong>周播放分钟数</strong>。`,
        senior: `<strong>3 条详解</strong>：<br>① <strong>反映价值</strong>：用户花钱 / 时间 / 关注的核心理由<br>② <strong>可拆解</strong>：能 break down 成 sub-metrics（北极星 = activation × frequency × magnitude）<br>③ <strong>跟长期留存正相关</strong>：今天指标涨 → 6 个月后留存涨<br><br><strong>典型例子</strong>：<br>· Facebook: 月活跃用户（MAU）<br>· Spotify: 周播放分钟数（不是 DAU，因为 active = listen）<br>· Airbnb: 入住夜数（不是订单数，因为 longer stay = more value）<br>· Slack: 每日发送消息数（活跃使用证据）<br>· DoorDash: 完成订单数<br>· Notion: 周文档创建数（创造行为）`,
        staff: `深一层：北极星指标的<strong>真实价值</strong>是<strong>"跨部门对齐目标"</strong>—— Engineering / Product / Marketing / Sales 都看同一个指标 → 决策时同 frame of reference。<br><br><strong>怎么定义自己产品的北极星</strong>：<br>1) <strong>识别核心价值</strong>：用户为什么使用？（不是"用户怎么用"）<br>2) <strong>对比候选指标</strong>：① MAU（虚荣指标 risk）vs ② 周活跃使用次数 vs ③ 周价值创造行为<br>3) <strong>测试与留存相关性</strong>：选 30-180 天后 retention 高的用户 → 看他们当时哪个指标最显著<br>4) <strong>避免 vanity</strong>：注册数 / 下载数 / pageview 通常是 vanity（看似涨但不带 retention）<br><br><strong>真实经验</strong>：我作为 platform agent PdM 时定北极星：<br>· 候选 1: MAU (active customer accounts) → 但客户已签合同必须用 → vanity<br>· 候选 2: RPC throughput per customer → 体现"客户实际工作量" → 跟 customer satisfaction 正相关<br>· 候选 3: # of device migrated to new agent / month → ship velocity<br>· <strong>选 2</strong>: 季度跟 customer satisfaction 数据相关性最高（r = 0.78）<br><strong>使用</strong>：每月 leadership review，所有 functional team OKR derived from 北极星。<br><br><strong>陷阱</strong>：① <strong>vanity metric</strong>（MAU / pageview / downloads）；② 选过于 lagging 指标（如年收入）—— 短期改动看不到；③ <strong>over-optimize 单一指标</strong>—— Goodhart's law（指标变 target，被 game）；④ 不 paired with guardrail metric（如 churn / customer satisfaction）。<br><br><strong>对比 OKR / KPI</strong>：① 北极星指标是<strong>顶层愿景</strong>（slow-moving）；② OKR 是 quarterly drivers of 北极星；③ KPI 是 operational metrics 防退化；三层都要。`,
      },
      failure_modes: [
        `选 vanity metric（MAU / pageview / downloads）`,
        `选 lagging 太长（年收入）→ 短期改不见效`,
        `Over-optimize 单一 → Goodhart's law`,
        `没 guardrail metric paired → 单一指标改了别处坏`,
        `不 review 不更新（产品阶段变了北极星可能要换）`,
      ],
      follow_ups: [
        { q: `怎么验证候选北极星跟留存正相关？`, hint: `① 取一群 6 个月前的新用户；② 按 30 天 cohort 数据；③ 看哪个早期指标跟 6 个月 retention 相关 highest；④ 多变量回归隔离其他因素` },
        { q: `不同生命周期阶段北极星会变吗？`, hint: `① 早期：activation（用户成功用一次）；② 成长期：retention + frequency；③ 成熟期：value per user (LTV / revenue)；阶段变 metric 重置` },
        { q: `怎么 align 团队都看北极星？`, hint: `① All-hands 强化；② OKR derive from 北极星；③ Dashboard 中央展示；④ 每 deliverable 标"如何影响北极星"；⑤ Bonus / promotion 部分 tied to 北极星` },
      ],
    },

    53: {
      why_asked: `PdM 框架基础题。能讲 AARRR 5 阶段 + RARRA 重排理由的人是真用过漏斗分析。`,
      answers: {
        mid: `<strong>AARRR</strong>: <strong>Acquisition</strong>（获取）/ <strong>Activation</strong>（激活）/ <strong>Retention</strong>（留存）/ <strong>Revenue</strong>（收入）/ <strong>Referral</strong>（推荐）—— "<strong>海盗指标</strong>"。<strong>RARRA</strong> 是重排（留存优先）。`,
        senior: `<strong>原 AARRR（Dave McClure 2007）</strong>：以增长流程为序——先获取再激活再留存等。<br><strong>RARRA（Thomas Petit / Gabor Papp 2017）</strong>：<strong>留存先</strong>的反思 —— "如果没留存，所有 acquisition 都漏；先保留存再 grow"。<br><strong>每阶段典型指标</strong>：<br>· A1: CAC / 渠道流量 / 注册转化率<br>· A2: 激活定义（如 "首次完成核心动作"）/ activation rate<br>· R: D1 / D7 / D30 留存率 / 月活跃 / cohort retention curve<br>· R: ARPU / LTV / churn<br>· R: NPS / 推荐率 / virality coefficient`,
        staff: `深一层：AARRR 是<strong>"用户生命周期"分析框架</strong>，不是 metric 也不是产品策略——只是<strong>"看用户从认识到推荐的过程"</strong>的视角。<br><br><strong>实战 + 真实经验</strong>：作为 platform agent PdM 我们用 AARRR 分析<strong>customer 的"产品生命周期"</strong>：<br>1) <strong>A1 Acquisition</strong>: 销售 / Bid winning → 30+ enterprise 客户 funnel<br>2) <strong>A2 Activation</strong>: 客户完成首次 production deployment → ~70% conversion（30% 因 integration 复杂卡住）<br>3) <strong>R Retention</strong>: 12 个月 churn rate（客户停用 / 转 vendor）→ ~5%（行业平均 10%）<br>4) <strong>R Revenue</strong>: ARR per customer + expansion（add features / devices）<br>5) <strong>R Referral</strong>: 客户 case study 引荐其他客户（typical &lt; 5%）<br><br><strong>洞察</strong>：A2 (activation) 是最大瓶颈（30% 客户被复杂 integration 卡死）。<strong>Action</strong>：① 投资 onboarding tooling；② 出 customer success 团队；③ 简化 default config。<br>结果：activation rate 从 70% → 85%（6 个月后）。<br><br><strong>陷阱</strong>：① <strong>只看 acquisition</strong>（最 visible 但 leaky bucket）；② AARRR 5 个都 weighed 同等（实际看哪段是 bottleneck）；③ Activation 定义 vague（必须具体可测）；④ 不分 segment（B2B / B2C / 不同 plan 各自 funnel 不同）。<strong>RARRA 适用</strong>：① 早期产品 retention 差 → 先 fix retention；② SaaS / subscription 业务（留存 = 收入）；③ Marketplace（双边都要 retain）。<strong>2026 思考</strong>：AARRR 框架已 20 年了，仍是 PdM 入门必修，但 modern PdM 加 ① cohort analysis；② product-led growth metrics；③ usage analytics（哪些 feature 真用）。`,
      },
      failure_modes: [
        `只关注 Acquisition（最易测但 leaky bucket）`,
        `Activation 没具体定义（vague "用户开始用"）`,
        `5 个都同等 weight（实际看 bottleneck）`,
        `不分 segment （B2B / B2C / 不同 plan）`,
        `不 paired with cohort analysis → 看不到时间维度`,
      ],
      follow_ups: [
        { q: `Activation 怎么定义？`, hint: `① 找"<strong>aha moment</strong>"（用户第一次感受到价值的动作）；② Quantify: "X 天内做 Y 次 Z 动作"；③ 跟 retention 相关性验证；例：Facebook "7 friends in 10 days"，Twitter "follow 30+ accounts"` },
        { q: `什么时候用 RARRA？`, hint: `① 早期产品（M年内）；② SaaS / subscription 业务；③ Retention 数据明显差（D30 retention &lt; 20%）；④ Stop pouring acquisition before fixing leaky bucket` },
        { q: `AARRR 跟 OKR 关系？`, hint: `① AARRR 是分析框架；② OKR 是季度目标设定；③ OKR 可 derived from AARRR diagnosis（"哪段最 weak，本季 focus" → Objective）；④ 两者 complement` },
      ],
    },

    55: {
      why_asked: `PdM 高频题。能讲 "<strong>看行为 &gt; 听 stated &gt; Mom Test 三规则</strong>" 的人是真做过 user research。`,
      answers: {
        mid: `<strong>用户行为</strong>（workaround）&gt; 用户意愿；<strong>量化规模和深度</strong>；<strong>Mom Test 三规则</strong>：问"上次怎么做的"，<strong>不问"未来会不会用"</strong>。`,
        senior: `<strong>Mom Test（Rob Fitzpatrick 2013）3 大规则</strong>：<br>1) <strong>谈对方的生活而不是你的想法</strong>（"上次遇到 X 你怎么解决"，而不是"如果有 Y 你会用吗"）<br>2) <strong>问具体的过去而不是 hypothetical 未来</strong>（"上周做 X 几次"，而不是"会不会做 X"）<br>3) <strong>少说多听</strong>（80/20 rule）<br><br><strong>判断真假需求 3 招</strong>：<br>① <strong>看是否有 workaround</strong>（已经在花时间解决 = real）<br>② <strong>量化 willing to pay</strong>（钱 / 时间 / 复杂度容忍）<br>③ <strong>5 客户深访</strong>（不是 1 客户 deep + 100 客户 superficial）`,
        staff: `深一层：90% PM 错误来自<strong>"客户嘴上想要的 vs 真用的"差距</strong>。Henry Ford 名言："<strong>If I asked customers what they wanted, they'd say faster horses</strong>"—— 客户能描述<strong>现状的不满</strong>但不能 design 解决方案。PM 的工作是 listen 不满 + design 解决。<br><br><strong>真实案例</strong>：作为 platform agent PdM 做 customer interview。<br><strong>客户 stated</strong>："我们需要更多的 metrics 暴露"<br><strong>实际场景挖</strong>："上次 metrics 不够你怎么办的？"<br>· 客户：" 我们写脚本 polling 设备状态"（workaround 存在）<br>· "写了几个脚本，用了多久"<br>· "12 个脚本，团队 2 工程师 6 个月"（量化 → 真痛 + ROI 高）<br>· "如果你们 agent 暴露这些 metrics，你们会停用脚本吗"<br>· "如果可靠 + 我们能 alert，立刻停"<br><strong>洞察</strong>：客户不是缺 "more metrics" 而是缺 "<strong>structured queryable metrics + alerting infrastructure</strong>"。Build the latter 比 expose all metrics 更 high ROI。<br><br>另一案例（真假需求 stark contrast）：<br>· 客户 A: "我们需要 web UI 来配置 agent"（嘴上）→ 挖：上次 config 用 CLI，团队都 happy → vanity request → 不做<br>· 客户 B: "agent crash 时 debug 很难"（嘴上）→ 挖：上周一次 P0 事故 6 工程师 spent 4 hours debug + 客户 lost $50k revenue → real + willing to invest → 优先做 better diagnostics<br><br><strong>陷阱</strong>：① 问 leading question（"你想要 X 吗"）；② 一个客户 deep dive 当全部代表；③ 不量化 → 真假难分；④ 客户 PM-mode（"应该这样设计"）—— ignore，关注他们的 problem；⑤ "if I built X, would you use" 这种 hypothetical—— 99% 假阳性。`,
      },
      failure_modes: [
        `问 hypothetical（"如果有 X 你会用吗"）→ 99% false yes`,
        `一个客户 deep dive 当全部代表 → bias`,
        `不量化（"很痛苦"）→ 真假不分`,
        `Leading question（"你需要 X 对吗"）→ 客户 say yes 来 polite`,
        `客户 PM-mode → 接受 stated solution 而非 underlying problem`,
      ],
      follow_ups: [
        { q: `客户 interview 几个够？`, hint: `① B2B SaaS: 5-8 个 deep dive (60-90 min each)；② B2C: 10-15 个 (45 min)；③ 直到 saturation（新 insight 不来）；④ 不是数量，是 sample 代表性` },
        { q: `怎么避免 confirmation bias？`, hint: `① 跟 mentor 一起 interview（cross check）；② 录音 + transcribe + 多人 review；③ 故意找 disconfirming evidence；④ 6 个月后 revisit interview notes 看是否 still hold` },
        { q: `Quantitative vs qualitative 怎么 balance？`, hint: `① Qualitative (interview): 找 problem space + 假设；② Quantitative (survey / analytics): validate 假设的 scale；③ 通常 qual first 找 direction，quant 验证 magnitude` },
      ],
    },

    56: {
      why_asked: `PdM 框架题。能讲"<strong>情境 + 动机 + 结果</strong>"三段 + 3 层（功能 / 情感 / 社交）的人是真用过 JTBD framework。`,
      answers: {
        mid: `<strong>JTBD (Jobs-To-Be-Done) 模板</strong>：<strong>当 [情境]，我想 [动机]，以便 [结果]</strong>。三层：<strong>Functional</strong>（功能）/ <strong>Emotional</strong>（情感）/ <strong>Social</strong>（社交）。`,
        senior: `<strong>典型例子</strong>：<br>· <strong>Functional</strong>: "当我赶时间通勤（情境），我想要快速买杯咖啡（动机），以便不迟到工作（结果）"<br>· <strong>Emotional</strong>: "当我下班疲惫（情境），我想要 30 min 独处（动机），以便从工作 mode 切回家庭 mode（结果）"<br>· <strong>Social</strong>: "当我跟朋友聚会（情境），我想要点 fancy 咖啡（动机），以便显得有品味（结果）"<br><br><strong>对比传统 user story</strong>："As a [user], I want [feature], so that [benefit]"——JTBD 更 outcome-focused，user-agnostic（不关注用户身份，关注情境）。`,
        staff: `深一层：JTBD 的<strong>"圣经般 case</strong>"是 Clayton Christensen 的奶昔故事——快餐店想 sell 更多奶昔，做了大量传统 segmentation（年龄 / 性别 / 收入）都没 actionable insight。改用 JTBD：早晨买奶昔的客户 hire 奶昔 to do the job "<strong>消化无聊通勤 + 不弄脏车 + 不饿到中午</strong>"。这个洞察 actionable: 加厚奶昔（更耐喝）/ 加 chewy 元素（更 entertaining）→ 销量 +7%。<br><br><strong>JTBD vs Persona vs User Story</strong>：<br>· <strong>Persona</strong>: "27 岁女性，城市，月入 1 万"—— demographic-driven，对 design 帮助小<br>· <strong>User Story</strong>: "As 27 岁女性 I want X"—— feature-driven，假设 user 类型决定行为<br>· <strong>JTBD</strong>: "When I'm in situation X, I want to achieve Y"—— situation-driven，不假设 user 谁<br><br><strong>JTBD 适合用</strong>：① Product positioning（找 competing products = 同样 hire 的）；② Feature prioritization（按 jobs 不按 users）；③ New product discovery（unmet jobs = market opportunity）。<br><br><strong>真实经验</strong>：platform agent 用 JTBD 重新定位：<br>· <strong>原 Persona</strong>: "电信工程师，男，5+ 年经验"<br>· <strong>JTBD insight</strong>: "<strong>当我有 100k devices 需要批量配置（情境），我想要 1 个 click apply（动机），以便 deadline 前完成 + 不出错（结果）</strong>"<br>· <strong>洞察</strong>: 客户不是 hire 我们 "as platform agent" 是 hire 我们 "as bulk config automation"<br>· <strong>Action</strong>: 简化 UI / build template library / 集成 ITSM workflow<br>· <strong>结果</strong>: 6 个月内新 enterprise 客户 +40%<br><br><strong>陷阱</strong>：① JTBD 写成 feature description（"想要 button X"）→ 应该 outcome description（"想要 quickly do Y"）；② 三层只关注 functional（emotional / social 同样重要）；③ JTBD 太宽（"想要让 work easier"）—— 必须具体 situation；④ 不验证（基于 PM 猜测 JTBD）—— 必须 customer interview validate。`,
      },
      failure_modes: [
        `写成 feature description（"想 button X"）→ 不是 outcome`,
        `只关注 functional 三层（忽略 emotional / social）`,
        `JTBD 太宽 → 不可 actionable`,
        `PM 自己猜 JTBD 不 validate → 假 insight`,
        `JTBD = persona 替换品 → 两者互补不替代`,
      ],
      follow_ups: [
        { q: `怎么发现 JTBD？`, hint: `① 客户 interview "上次遇到 X 你 hire 什么 product 解决"；② Diary study（客户记一周 task）；③ 观察 workaround（用户用其他工具补缺）；④ Switch interview（client 从竞品转过来时挖原因）` },
        { q: `JTBD 跟 OKR 关系？`, hint: `① JTBD = 客户 outcome；② OKR Objective derived from "improve customer's ability to achieve job Y"；③ KR 量化 "how well we serve that job"；④ 三层 link 起来` },
        { q: `JTBD 在 B2B 跟 B2C 差异？`, hint: `① B2C: 1 个 user = 1 个 JTBD subject；② B2B: 多 role（user / buyer / champion），各自不同 JTBD；③ 通常先服务 user 的 functional JTBD，再考虑 buyer 的 strategic JTBD` },
      ],
    },

    64: {
      why_asked: `PdM 优先级框架基础。能讲"<strong>RICE 公式 + Confidence 易滥用</strong>"的人是真用过。`,
      answers: {
        mid: `<strong>RICE = (Reach × Impact × Confidence) / Effort</strong>。比纯主观靠谱，但 <strong>Confidence 易被滥用</strong>。`,
        senior: `<strong>4 个因子</strong>：<br>· <strong>Reach</strong>: 影响多少用户 / 时段（如 # of users / quarter）<br>· <strong>Impact</strong>: 对每个用户的影响（典型 1-3 scale: 3 = massive, 1 = minor）<br>· <strong>Confidence</strong>: 你对 Reach × Impact 预估的<strong>把握</strong>（0-100%）<br>· <strong>Effort</strong>: 人月（含 product / design / engineering / QA）<br><br><strong>计算</strong>：<code>Score = (Reach × Impact × Confidence) / Effort</code> → 数字大 = 优先做。<strong>实际用法</strong>：填 spreadsheet，所有 feature 排序，head-to-head 比 score。`,
        staff: `深一层：RICE 的<strong>真实价值</strong>是<strong>"<u>强迫团队具体讨论 4 个 dimension</u>"</strong>—— 没 RICE 时大家拍脑袋说"这个重要"；有 RICE 时讨论"reach 是多少？impact 等级？confidence 凭什么？effort 估多少？"<strong>讨论过程 &gt; 最终 score</strong>。<br><br><strong>陷阱 + 反模式</strong>：<br>① <strong>Confidence 被滥用</strong>：开发想做某 feature 给 90% confidence，不想做的给 30%。<strong>对策</strong>：要求 evidence（数据 / 用户访谈数 / prototype 验证）才能 80%+。<br>② <strong>Reach 过 broad</strong>："影响所有用户 100M" → 但 actually 只是 banner，没 impact。<strong>对策</strong>：Reach 必须配 actively engaged use 数据。<br>③ <strong>Impact 1-3 不够细</strong>：实际差异大，可能用 1-10 或 dollar value。<br>④ <strong>Effort estimate 过乐观</strong>：典型 underestimate 2-3×。<br>⑤ <strong>RICE 当唯一框架</strong>：忽略 strategic value / dependency / risk。<br><br><strong>真实经验</strong>：作为 platform agent PdM 季度 prioritization，10 个 candidate features，RICE score：<br>· Feature A "Bulk config UI": R=200 customers × I=3 × C=80% / E=6 mo = score 80<br>· Feature B "Custom plugin framework": R=20 customers × I=3 × C=30% / E=6 mo = score 3<br>· Feature C "Better diagnostics": R=200 customers × I=2 × C=90% / E=2 mo = score 180<br>→ <strong>选 C 做先（highest score）</strong>，A 第二，B 拒（低 confidence + high effort）。<br><strong>事后 validate</strong>: C 上线后 customer satisfaction +30%（match RICE prediction）。<br><br><strong>对比其他框架</strong>：<br>· <strong>MoSCoW</strong>: Must / Should / Could / Won't —— qualitative, faster but less rigorous<br>· <strong>Kano</strong>: Basic / Performance / Excitement —— customer satisfaction dimension<br>· <strong>Value vs Effort 2x2</strong>: 简单 quick wins 识别<br>· <strong>Weighted Shortest Job First (WSJF)</strong>: SAFe 框架，类似 RICE 但加 Cost of Delay<br><br><strong>2026 实践</strong>: RICE 仍主流，但 modern PdM 加 ① cohort impact（不只 total reach）；② strategic alignment score；③ technical debt impact；④ risk dimension。`,
      },
      failure_modes: [
        `Confidence 主观滥用 → 影响整 score`,
        `Reach 过 broad（不 actively engaged 用户也算）`,
        `Effort 严重 underestimate → 实际超 2-3×`,
        `RICE 当唯一框架 → 忽略 strategic / risk`,
        `不 retro RICE prediction vs reality → 不 calibrate`,
      ],
      follow_ups: [
        { q: `Confidence 怎么避免滥用？`, hint: `① 设 confidence rubric：80%+ 需 data / 用户访谈；50-80% 需 prototype 验证；&lt; 50% 还在 hypothesis；② Public 在 spreadsheet 显示 evidence；③ 季度 retro 看哪些 high confidence 错了` },
        { q: `RICE 跟 OKR 关系？`, hint: `① OKR 设方向（"提升 retention"）；② RICE 排具体 feature 优先级 to achieve OKR；③ RICE high score 但 not align OKR → 不做；④ 两层都要` },
        { q: `B2B SaaS 跟 B2C 用 RICE 差异？`, hint: `① B2C: Reach = MAU，标准化；② B2B: Reach = "# accounts" 但要 weight by ARR（一个 enterprise &gt; 100 SMB）；③ B2B impact 可量化 dollar value 不只 1-3` },
      ],
    },

    // ============== Case / Estimation ==============
    77: {
      why_asked: `Case 题万能公式。能讲"<strong>结构化思维 &gt; 答案对错 + 30s 画框架</strong>"的人是 case-prepared。`,
      answers: {
        mid: `<strong>Case 题考的是结构化思维过程，不是答案对错</strong>。开口前先用 <strong>30 秒画框架</strong>。<strong>CIRCLES</strong>: <strong>Comprehend</strong>（理解）/ <strong>Identify customer</strong>（识别用户）/ <strong>Report needs</strong>（陈述需求）/ <strong>Cut by priority</strong>（按优先级砍）/ <strong>List solutions</strong>（列解决方案）/ <strong>Evaluate trade-offs</strong>（评估权衡）/ <strong>Summarize</strong>（总结）。`,
        senior: `<strong>详细 7 步</strong>（典型 25-30 min case）：<br>1) <strong>C (Comprehend)</strong>: 3 min，clarifying questions（产品 stage / 目标 user / 时间 horizon / 度量指标 / 资源约束）<br>2) <strong>I (Identify users)</strong>: 2 min，列 3-5 个 user segments，简短 persona<br>3) <strong>R (Report needs)</strong>: 5 min，每个 segment 的 jobs / pain points（用 JTBD）<br>4) <strong>C (Cut by priority)</strong>: 2 min，按 RICE / impact 选最 high priority 1-2 segment<br>5) <strong>L (List solutions)</strong>: 8 min，brainstorm 3-5 个 solution（包括 MVP / nice-to-have）<br>6) <strong>E (Evaluate trade-offs)</strong>: 5 min，每个 solution 的 pros / cons / risk<br>7) <strong>S (Summarize)</strong>: 2 min，recommend 1 个 + rationale + measure success / next step`,
        staff: `深一层：CIRCLES 是<strong>"用 framework 给面试官 structured signal"</strong>。面试官看你<strong>怎么思考</strong>不是<strong>结论</strong>。<br><br><strong>关键 mindset</strong>：<br>1) <strong>开口前 30 秒画框架</strong>：silent 30s 看似 awkward 但比"哦"开始好太多<br>2) <strong>Talk through 你的 thinking</strong>：每步 verbalize "I'm now thinking about user segments because..."<br>3) <strong>邀请 facilitator interaction</strong>：用 "does that make sense" / "want me to dive deeper into X" 跟面试官 calibrate<br>4) <strong>Trade-off 明确 + recommendation 锁定</strong>：不要 fence-sit（"好像都不错"）<br><br><strong>真实经验</strong>：面 senior PM role 时 case "<strong>Design a feature to help Spotify users discover new music</strong>"。<br>· 30s 画 CIRCLES 在 notebook<br>· C: clarifying questions (3 min) - "free / premium? geo? time horizon? success metric?"<br>· I: 4 segments (casual listener / superfan / new platform user / mood listener)<br>· R: each segment's discovery pain<br>· C: prioritize "casual listener" (largest, lowest activation)<br>· L: 5 solutions (mood-based playlist / friend-curated / podcast-style / weekly digest / similar-artist auto-add)<br>· E: trade-off matrix (effort / impact / risk)<br>· S: recommend "mood-based smart playlist" + propose A/B test design + measure with "monthly new tracks discovered per user"<br><strong>面试官反馈</strong>: "Strong structure, would hire"。<br><br><strong>陷阱</strong>：① 不画框架直接 dive into solution → unstructured；② skip "clarifying"（assume 自己 right）；③ 给 10 个 solution 但每个 superficial（depth &gt; breadth）；④ 不 recommend single solution（fence-sit）；⑤ ignore facilitator's signal（不 invite interaction）。<strong>其他 case framework</strong>: ① CIRCLES（产品设计题）；② SAS（Strategy / Analysis / Solution，市场分析）；③ HEART（discovery / definition / execution）；scenario-specific 选。`,
      },
      failure_modes: [
        `不画框架直接 dive into 答 → unstructured`,
        `Skip clarifying questions → assume 自己 right`,
        `给 10 solution 但 superficial → depth missing`,
        `不 recommend single → fence-sit`,
        `不 invite facilitator interaction → monologue`,
      ],
      follow_ups: [
        { q: `Case 题 30 min 不够怎么办？`, hint: `① 优先 depth on 1-2 solutions；② skip C if facilitator gave context；③ verbalize "I'm skipping X to focus on Y"；④ 节奏感跟面试官 sync` },
        { q: `怎么准备 case 题？`, hint: `① 读 Decode and Conquer（Lewis Lin）/ Cracking the PM Interview；② Mock with PM friends（5-10 times）；③ 公开 case 库（Exponent / IGotAnOffer）；④ 录音听自己 (talk pace / structure)` },
        { q: `Case 题面试官不响应怎么办？`, hint: `① 主动 ping "want me to continue or do you have questions"；② Continue with confidence；③ 不 awkward silence（让自己 verbalize 替代）；④ 最后总结 invite feedback` },
      ],
    },

    87: {
      why_asked: `Case 题最难类。能讲"<strong>归因 + Discovery + OST + A/B</strong>"4 步的人是 senior PM。`,
      answers: {
        mid: `先<strong>归因</strong>（漏斗 + Cohort 看哪个 segment 流失最多），再 <strong>Discovery</strong>（访谈 5-10 个流失用户），再 <strong>OST 排序机会</strong>，最后 <strong>A/B 验证</strong>。`,
        senior: `<strong>完整 4 步</strong>：<br>1) <strong>归因 (Diagnostic)</strong>: <br>· 漏斗分析：D1 / D7 / D30 retention 各段流失 %<br>· Cohort: 不同时间注册的用户 retention 曲线对比<br>· Segment: 按 user type / source / 行为分群<br>· 找最大流失 segment / 最大流失 step<br>2) <strong>Discovery</strong>: <br>· 访谈 5-10 个流失用户（"上次用 X 是什么时候，为什么停"）<br>· Survey 补充 quantitative<br>· Analytics: 流失前用户的行为 pattern<br>3) <strong>OST (Opportunity Solution Tree)</strong> by Teresa Torres:<br>· Top: Outcome ("retention +10%")<br>· Mid: Opportunities (从 discovery 来的 themes)<br>· Bottom: Solutions for each opportunity<br>· 排序选 best opportunity + best solution<br>4) <strong>A/B Validation</strong>: <br>· Hypothesis: "If we ship X, retention +5%"<br>· A/B test design（traffic split / duration / success metric / guardrail）<br>· Run + analyze + ship if positive`,
        staff: `深一层：retention 题考<strong>PdM 完整 cycle</strong>—— diagnosis / discovery / prioritization / validation / shipping。<strong>常见 mistake</strong> 是 skip 1 / 2 直接 jump to solution（"加 push notification 应该能提 retention"）。<strong>没诊断 + 没 discovery 的 solution 是 guess</strong>。<br><br><strong>真实案例</strong>：作为 PdM 处理 platform agent 客户 churn 问题，3 month churn rate 从 5% → 12%。<br><br><strong>1) 归因</strong>: 漏斗分析发现 churn 集中在<strong>小客户（&lt; 1000 devices）</strong>，大客户 churn 不变。Cohort 看新签的小客户 D90 churn 25%（前 5%）。<br><strong>2) Discovery</strong>: 访谈 8 个 churned 小客户：<br>· 6/8 提到 "<strong>setup 太复杂</strong>"<br>· 5/8 提到 "<strong>monthly cost 高于备选 vendor</strong>"<br>· 3/8 提到 "<strong>support 响应慢</strong>"<br>· 2/8 提到 "feature gap"<br><strong>3) OST</strong>:<br>· Outcome: 小客户 churn 从 25% → 10%<br>· Opp 1: simplify setup → solutions: wizard UI / one-click templates / customer success onboarding<br>· Opp 2: pricing for small customers → solutions: SMB tier / annual prepay discount<br>· Opp 3: faster support → solutions: chat support / community forum / better docs<br>· 排序：Opp 1 highest（最多 customer 提 + manageable effort）<br><strong>4) A/B</strong>:<br>· Hypothesis: 给新签小客户提供 "guided onboarding wizard"，D90 churn 下降<br>· A/B (50/50, 3 months, n = 200 customers each)<br>· Result: Treatment D90 churn 15% vs Control 25%（statistically significant，p &lt; 0.01）<br>· <strong>Ship</strong>: 全量 rollout + 监控 trend<br>· <strong>6 months later</strong>: 全 small customer churn 12% → 14%（中间反弹但仍 better baseline），证明 worked。<br><br><strong>陷阱</strong>：① <strong>skip diagnostic</strong> 直接 jump to "add feature X" guess；② Discovery 访谈太少（&lt; 5）→ bias；③ OST 不画或不 prioritize；④ A/B 没 guardrail metrics → 提了 retention 但其他坏；⑤ ship 后不 monitor → 假阳性。`,
      },
      failure_modes: [
        `Skip diagnostic 直接 jump to solution`,
        `Discovery 访谈太少 → bias`,
        `OST 不 prioritize → 同时做多 things → 都做不好`,
        `A/B 没 guardrail metrics → 单一指标涨别处坏`,
        `Ship 后不 monitor → 假阳性`,
      ],
      follow_ups: [
        { q: `Retention curve 4 种形状是什么？`, hint: `① Flat-bottom（healthy，长期 retention）；② Smile（low after grace period 但能 win back）；③ Hockey stick（极少）；④ Cliff（drop to 0，dead）；不同形状策略不同` },
        { q: `怎么判断 A/B 真有效？`, hint: `① Statistical significance (p &lt; 0.05)；② Practical significance (lift 大小 vs noise)；③ Guardrail metrics 没坏；④ Multiple segments 都 positive；⑤ Sustained over time (3-6 month look-back)` },
        { q: `如果 retention 提升但 revenue 下降怎么办？`, hint: `① Investigate (高 retention low value users? cannibalization?)；② Check segment effects；③ 可能需要不同 monetization strategy；④ Trade-off 决定 worth it？` },
      ],
    },

    88: {
      why_asked: `Estimation 题考<strong>结构化推理 + 数字感</strong>。能讲"<strong>top-down + bottom-up + 验证</strong>"的人 case ready。`,
      answers: {
        mid: `<strong>思路</strong>：① 14 亿人口 → 吉他爱好者比例 ≈ 1%（1400 万）；② 平均每 5 年换 1 把（→ 200 万 / 年）；③ 新增学习者 ≈ 200 万 / 年（每人 1 把）；④ <strong>总和 ≈ 400 万把</strong>。`,
        senior: `<strong>结构化展开</strong>：<br>1) <strong>假设 + clarify</strong>: "新吉他 + replacement，不含二手；中国大陆"<br>2) <strong>分 segments</strong>:<br>· 新学吉他人群（青少年 / 成人）<br>· 现有吉他爱好者（replacement）<br>· 专业 / 半专业（高换购）<br>3) <strong>Top-down 估算</strong>:<br>· 中国人口 14 亿<br>· 吉他爱好者 ≈ 1%（基于直觉 / 数据点）= 1400 万<br>· 80% 业余（5 年换 1）+ 15% 进阶（2 年换 1）+ 5% 专业（年换 2）<br>· 现有 replacement: 1120万 × 1/5 + 210万 × 1/2 + 70万 × 2 = 224 + 105 + 140 = 469 万<br>· 新增学习者: 14 亿 × 0.5% / 10年 = 70 万 / 年<br>· 总: 469 万 + 70 万 = <strong>~540 万 / 年</strong><br>4) <strong>Validation</strong>: 真实数据（如果有）/ 相似国家对比`,
        staff: `深一层：Estimation 题的<strong>真实目的</strong>不是数字准确（面试官不知道 ground truth），是<strong>看你的 reasoning</strong>：① 是否 structured；② 是否 verbalize 假设；③ 是否 sanity check；④ 是否处理 uncertainty。<br><br><strong>4 个关键 skill</strong>：<br>1) <strong>Top-down vs bottom-up</strong>: 同问题用两种方法估算，对比验证。"<strong>top-down 估出 500 万，bottom-up 估 400 万 → 一致量级 → confidence 增加</strong>"<br>2) <strong>Verbalize assumptions</strong>: "I'm assuming 1% adoption rate based on X" - explicit 让面试官 challenge<br>3) <strong>Sanity check</strong>: 数字算完反过来想"这意味着每天 1 万把？10000 商店？感觉合理吗"<br>4) <strong>Sensitivity analysis</strong>: "如果 adoption 是 0.5% 而不是 1%，结果会减半 → 250 万 / 年"<br><br><strong>真实经验</strong>: 准备 PM interview 时 mock estimation 10+ 次。pattern 是：<br>· <strong>Top-down</strong>: 大数字（人口 / GDP / market size）层层 divide<br>· <strong>Bottom-up</strong>: 单价 × 频率 × 用户数<br>· <strong>对比</strong>: 两个估算 should be in same order of magnitude (10× ok, 100× 红灯)<br>· <strong>明确不确定</strong>: "实际可能 200 万 - 1000 万范围，中位估 500 万"<br><br><strong>常见 anti-pattern</strong>：① 不 verbalize 假设直接 multiply numbers；② 1 个 method (top OR bottom only)；③ 数字算完不 sanity check；④ 不展示 sensitivity；⑤ over-precise（"387.5 万"）- estimation 应该是 round number。<strong>其他 estimation 题套路</strong>：① Market size (TAM / SAM / SOM)；② Customer count；③ Server / database capacity；④ Time to complete project；framework 类似都是 segment + per-unit × scale + validate。`,
      },
      failure_modes: [
        `不 verbalize 假设 → 面试官看不到 reasoning`,
        `单一 method（only top-down / bottom-up）`,
        `不 sanity check → 数字荒谬不知`,
        `Over-precise（"387.5万"）→ estimation 应该 round`,
        `不展示 sensitivity → uncertainty 没承认`,
      ],
      follow_ups: [
        { q: `没有 ground truth 怎么判断答案合理？`, hint: `① 跟"已知 data points" 对比（X 国数据 / 类似产品）；② Order of magnitude 对就好（精确度不重要）；③ Sensitivity test → if 关键假设变化，结论是否 still hold` },
        { q: `Estimation 跟 forecasting 区别？`, hint: `① Estimation: snapshot 估当前 size；② Forecasting: 预测未来 trajectory；后者需 growth rate / driver analysis；前者结构化推理够` },
        { q: `怎么准备 estimation interview？`, hint: `① Mock 10+ 次（市场 size / customer count / server capacity 各类）；② 背"useful base rates"（人口 / GDP / 主流 device usage rate）；③ 用 paper / 白板练 visual reasoning；④ 录音听自己 verbalize` },
      ],
    },

    // ============== 红旗 ==============
    93: {
      why_asked: `面试技巧题。能讲"<strong>'我们' vs '我'</strong>"差异的人是真懂 PM 面试 storytelling。`,
      answers: {
        mid: `面试官无法<strong>判断你的贡献</strong>。修：刻意用"<strong>我</strong>"，团队的事用"<strong>我推动了 / 我决定了</strong>"。`,
        senior: `<strong>"我们" vs "我"的细微差别</strong>：<br>· "<strong>我们做了 X</strong>" → 团队成果，你的贡献不明<br>· "<strong>我决定 / 推动 / 设计 / 主导 X</strong>" → 你的<strong>具体 actions</strong> 明确<br>· 对比："我们成功上线了 feature" vs "<strong>我设计 PRD + push 跨 3 team align + 主持 launch checklist</strong>，最终 feature 上线"<br>· 后者展示 individual contribution + leadership signal`,
        staff: `深一层：用 "我" vs "我们"<strong>反映候选人的 self-awareness 和 ownership</strong>。<br><br><strong>面试官心理</strong>：<br>· "我们" heavy → "<strong>这人可能只是 follower / 不知道自己的具体贡献</strong>"<br>· "我" balanced → "<strong>个体贡献清晰 + 仍 acknowledge team</strong>"<br>· "我" 过 dominant → "<strong>太 ego / 不团队 player</strong>"（red flag too，但远不如"我们"普遍）<br><br><strong>实战 rule of thumb</strong>:<br>1) <strong>主语 80% 用"我"</strong>：S/T/A 阶段全用 I<br>2) <strong>"我们" 用于 acknowledge team contribution</strong>：R 阶段 "我做了 X，<strong>我们团队</strong>最终 ship 了 Y"<br>3) <strong>具体动词替代"我们"</strong>：不写"我们 discussed"，写"<strong>我 facilitated discussion + 我 documented decisions</strong>"<br><br><strong>真实经验</strong>: Mock interview 时朋友录音指出我"我们" usage 60%。Practice 后降到 20%：<br>· 之前："我们决定用 React 不用 Vue"<br>· 之后："<strong>我 advocate React</strong> 因为 X + Y 理由，<strong>团队同意</strong> + 我们 ship"<br>· <strong>差别</strong>: 你是 decision-driver 还是 decision-follower？<br><br><strong>陷阱</strong>：① 一些文化（亚洲 / 学术）下 "我们" 是 modesty 信号；面试场景要 explicit 调整；② "我" overuse → ego red flag；③ 不 acknowledge team → 显得不 collaborative。<strong>建议</strong>：① 录音 mock 自己 count "我们" 使用频率；② 改写关键 STAR 故事 4-5 个；③ Practice 直到 conscious effort 不需要。`,
      },
      failure_modes: [
        `"我们"主语 60%+ → individual contribution 不明`,
        `用"我们"包装 "我没决策权"`,
        `不在 R 阶段 acknowledge team → 显得 ego`,
        `Vague verbs（"参与 / 帮助"）→ contribution 看不出`,
        `文化默认 modest → 面试场景没 explicitly 调整`,
      ],
      follow_ups: [
        { q: `怎么平衡 "我" vs "team player"？`, hint: `① S/T/A 80% "我"；② R "我们 achieved" 但具体 attribute "我贡献是 X"；③ 主动 credit team for specific things；④ 不暗示 "我自己做完所有"` },
        { q: `面试官问 "what did your team do" vs "what did you do" 区别？`, hint: `① "team did X": zoom out 讲 team accomplishment；② "you did X": 必须 specific your action；③ 听 question 谁是 subject` },
        { q: `怎么 practice 这点？`, hint: `① 录音 self-introduction + 6 个 STAR；② 数 "我" vs "我们" frequency；③ 朋友 mock 让他 flag "我们" usage；④ 重写 STAR scripts 直到 conscious style 形成` },
      ],
    },

    // ============== Phase 2 续推 · 行为题 ==============
    5: {
      why_asked: `团队反对你方向是新晋 PM/EM 必遇场景。能讲"diagnose root cause → influence not push → 决策框架"的人是真做过冲突管理。`,
      answers: {
        mid: `<strong>4 步</strong>：① 先<strong>真正听</strong>（不 defend）；② 区分<strong>真 disagree</strong> vs <strong>没理解</strong>；③ 用<strong>data + 多方案</strong>不用<strong>权威</strong>；④ 真 disagree 时<strong>commit and disagree</strong>（接受决策但 capture concerns）。`,
        senior: `<strong>决策框架</strong>：<br>1. <strong>判断 reversibility</strong>: 容易改 → speed over consensus；难改 → 多投资 consensus<br>2. <strong>识别 disagree 类型</strong>:<br>· <strong>事实分歧</strong>（"data 不一样"）→ 用 evidence 解决<br>· <strong>价值观分歧</strong>（"质量 vs 速度"）→ 需要 leadership / stakeholder 仲裁<br>· <strong>沟通问题</strong>（其实理解不一致）→ 重新对齐<br>3. <strong>不强 push</strong>: "Disagree and commit" 是 Amazon 文化—— 接受决策同时<strong>document concerns</strong>，事后看 outcome calibrate`,
        staff: `深一层：团队不同意你的方向<strong>通常是好事</strong>—— 说明 team 有 ownership + critical thinking。最差的 team 是"<strong>EM 说啥都 yes</strong>"—— 后期事故时无人挺身。<br><br><strong>真实案例</strong>: platform agent v3 启动时我作为 EM 主张"用 Rust 写新模块"，team 6 人有 4 个反对（C++ 熟悉，不愿学）。<br><br>1. <strong>1on1 deep dive</strong>: 跟反对的 4 人各 1on1，发现真 root cause:<br>· 2 人是 fear of learning curve（不 want spend 2 月学 Rust）<br>· 1 人是 confidence issue（"我 Rust 写不好 PR review 难"）<br>· 1 人真 disagree（"Rust ecosystem for RPC 不够 mature"）<br><br>2. <strong>分类处理</strong>:<br>· 2 个 fear: 给 onboarding plan + pair with Rust mentor → 2 月后 productive<br>· 1 个 confidence: 私下 reassure + 让他 own small Rust module first<br>· 1 个真 disagree: 跟他 deep tech discussion → 他举了 3 个真问题（schema parser lib / SNMP integration / debug toolchain），我 acknowledge 这些都是 real concern<br><br>3. <strong>调整 plan</strong>: 不是"全 Rust"，是"<strong>新性能 critical 模块 Rust + 老模块继续 C++ + interop layer</strong>"—— 接受真 disagree 的部分。<br><br>4. <strong>Document</strong>: ADR 记录 trade-off + 反对意见 + 决定 + 6 月 retrospective plan。<br><br>结果: 6 月后 Rust 模块 production stable，C++ 模块继续 maintain，<strong>那个原本最反对的 Engineer 后来 lead Rust 团队</strong>—— 因为他看到自己的 concern 被认真对待。<br><br><strong>陷阱</strong>:<br>① <strong>用 authority push</strong> "我决定就这样"—— 短期服从长期反弹<br>② <strong>过度 consensus 寻求</strong>—— 决策瘫痪<br>③ <strong>忽略真 disagree</strong>—— 错过真 risk<br>④ <strong>不区分 fear / disagree / confusion</strong>—— 治标不治本<br>⑤ <strong>不 document concerns</strong>—— 事后 retro 时大家都说"我早说过了"<br><br><strong>关键</strong>：① 1on1 优先于群体；② 识别 disagree 类型；③ 接受部分真 concern；④ Disagree and commit；⑤ Document for retro。`,
      },
      failure_modes: [
        `Authority push → 短期服从长期反弹`,
        `过度 consensus → 决策瘫痪`,
        `忽略真 disagree → 错过 risk`,
        `不区分 fear / disagree / confusion → 治标`,
        `不 document → retro 时甩锅`,
      ],
      follow_ups: [
        { q: `"Disagree and commit" 怎么实践？`, hint: `① 决策前充分讨论；② 决策后 explicit commit 不再 undermine；③ 仍 capture concern in ADR；④ 6 月 retro calibrate；⑤ Amazon Leadership Principle 之一` },
        { q: `team 一致赞同你的方向怎么办？`, hint: `① 警惕 echo chamber—— 是不是 team 不敢反对；② 主动 invite devil's advocate；③ Pre-mortem 假设失败找 risk；④ Healthy team 应该 disagree 5-20% 时间` },
        { q: `跟同 level peer disagree 怎么 resolve？`, hint: `① 1on1 私下 first；② 如果 deadlock, 找 common boss 仲裁；③ 不在 group meeting 当面 disagree（伤 face）；④ Disagree 但<strong>同 message</strong> 跟 team` },
      ],
    },

    12: {
      why_asked: `最大冲突题考<strong>真实经验 + 处理成熟度</strong>。能讲清"冲突 + 升级 + 最终解决方式"的人通常是 senior。`,
      answers: {
        mid: `<strong>STAR + 强调过程</strong>：① 冲突真实背景；② 我做了什么尝试（1on1 / data / 中立 facilitator）；③ 升级到 leadership；④ 最终如何 resolve；⑤ 学到什么。`,
        senior: `<strong>结构 4 段</strong>:<br>1. <strong>S</strong>: 冲突 stakes（团队 / 项目 / 客户 / 钱）<br>2. <strong>T</strong>: 我的 stake 跟 conflicting party stake<br>3. <strong>A</strong>: ① 先 1on1 私下尝试；② 用 data 不用 emotion；③ 找 common ground；④ 必要时 escalate；⑤ 接受不是 zero-sum<br>4. <strong>R</strong>: 量化 outcome + 关系是否 maintain<br><br><strong>关键 signal</strong>: 选真 stakes 冲突（不是"我跟同事讨论字体"）+ 自己 own 部分错（不全 blame other）+ relationship preserved。`,
        staff: `深一层：最大冲突题<strong>不是讲故事</strong>，是<strong>展示 emotional maturity</strong>。面试官 looking for：① 能 acknowledge own role；② 不 demonize other party；③ 关注 outcome 不 ego；④ Learning 反思真实。<br><br><strong>真实案例 talk track</strong>: "<strong>S</strong>: 我作为 platform agent PM，跟 Engineering EM (X) 因为 v3 launch timeline 严重冲突。他想推 6 个月 ship 完整 v3，我跟 sales 承诺 4 个月 ship MVP 给 strategic customer Y。\n\n<strong>T</strong>: 表面是 timeline，深层是<strong>我跟 X 对 product 优先级看法不同</strong>。X 认为 quality first，我认为 customer commitment first。\n\n<strong>A</strong>: 早期我 emotional——跟 X argue in group meeting，引起团队 awkwardness。意识到错后我 step back:<br>① 私下跟 X 1on1 4 hours：先听他 concern (quality / team burnout)，然后 share 我 concern (customer churn risk)<br>② 我 own 部分 mistake：我之前 promise sales 没跟 engineering pre-align，是 unilateral commitment<br>③ 一起设计 compromise: 4 月 ship Y customer-specific MVP（功能子集），6 月 ship 完整 v3<br>④ Reset sales expectation 给 customer Y<br>⑤ Joint 2-week retrospective 看 process improvement<br><br><strong>R</strong>: 4 月 ship MVP 满足 Y，customer 满意；6 月 ship 完整 v3。我跟 X 的合作关系 long-term 变好（因为 conflict 后建立的 trust）。<strong>我学到</strong>：① Cross-functional commitment 必须 align 后再 promise；② Conflict in group meeting 严重伤 team morale；③ Own own mistake first 让对方更 open。"<br><br><strong>陷阱</strong>:<br>① 选 trivial conflict（"我跟同事讨论 stand-up 时间"）—— 不严肃<br>② 全 blame 对方—— 缺 maturity<br>③ Outcome 是<strong>"我赢了"</strong>—— ego 太重<br>④ Learning vague—— "我学到 communication 重要"（vacuous）<br>⑤ Relationship 没 preserved—— 显示长期 EQ 不够<br>⑥ 没 own own role—— 不诚实<br><br><strong>关键</strong>: 真 stakes + own own role + outcome focused + maturity + relationship preserved。`,
      },
      failure_modes: [
        `选 trivial conflict → 不严肃`,
        `全 blame 对方 → 缺 maturity`,
        `Outcome "我赢了" → ego 太重`,
        `Learning vague → vacuous`,
        `Relationship 崩 → 长期 EQ 不够`,
      ],
      follow_ups: [
        { q: `如果对方仍 unreasonable 怎么办？`, hint: `① 尝试 multiple channel（1on1 / written / 3rd party）；② Escalate 当 last resort；③ Document for self-protection；④ 接受 walk away（少数情况，但 OK）；⑤ Long-term: assess if work environment sustainable` },
        { q: `Conflict 跟自己 boss 怎么处理？`, hint: `① 1on1 私下 first，不 group challenge；② Use data not emotion；③ Disagree and commit；④ Worst case: skip-level 谈但 high risk；⑤ 如果系统性冲突 → consider transfer / leave` },
        { q: `面试官追问 "如果再来一次你会怎么做"？`, hint: `① Specific change（不 vague）；② 早期 1on1 不 group challenge；③ Pre-align before commitment；④ 主动 own mistake earlier；⑤ Show calibration` },
      ],
    },

    16: {
      why_asked: `延期向 VP 汇报是 PM/EM 高频痛点。能讲"BLUF + Root cause + Options + Recommendation + Ask"5 段的人能通过 senior 面试。`,
      answers: {
        mid: `用 <strong>BLUF + 5 段</strong> 跟 #33 EVM 答法一样：① <strong>BLUF</strong>（项目延期 2 月）；② <strong>data</strong>（SPI/CPI/cause）；③ <strong>3 options</strong>（加资源 / 减 scope / 延期）；④ <strong>recommendation</strong>；⑤ <strong>ask</strong>（决策 + by when）。`,
        senior: `<strong>详细 talk track</strong>:<br>1. "<strong>BLUF: RPC v3 项目延期 2 月，从 Oct → Dec，需要你决策 by EOW</strong>"<br>2. "<strong>Data</strong>: SPI 0.72 / CPI 0.85，4 周持续 trend 下滑"<br>3. "<strong>Root cause</strong>:<br>· Senior eng X 离职（影响 4 周）<br>· Vendor SDK 兼容性比预期复杂（2 周）<br>· Spec 中途加 customer Z 定制需求（1 周 scope creep）"<br>4. "<strong>3 options</strong>:<br>· A: 加 contractor +$60k → ship on time<br>· B: cut customer Z scope → ship on time<br>· C: 接受延期 2 月 + customer expectation reset"<br>5. "<strong>Recommend A</strong>: customer Z 是 strategic，cut 风险大；contractor ROI 8x"<br>6. "<strong>Ask</strong>: budget approval +$60k by EOW；sales align customer expectation if not approve"`,
        staff: `深一层：跟<strong>#33 EVM 汇报</strong>本质同—— 都考 BLUF + options + ask。区别在<strong>面试场景</strong> vs 实际汇报：<br>· <strong>实际汇报</strong>: 你已知道 root cause + 准备好 data<br>· <strong>面试题</strong>: 面试官想看你的<strong>结构化思考过程</strong>—— 没真实背景时仍能 frame 出 BLUF 结构<br><br><strong>面试场景准备</strong>:<br>① 选一个 you've actually done 的延期项目<br>② STAR talk through<br>③ 量化 dollar / week / team / customer impact<br>④ Show learning + future prevention<br><br><strong>常见 anti-pattern</strong>:<br>① "<strong>项目可能要晚一点</strong>"—— vague，VP 无法决策<br>② 长篇 implementation detail—— VP zoned out<br>③ 没 option 直接 "<strong>怎么办</strong>"—— 甩问题<br>④ Hide and hope 不 surface—— ship 前一周 surprise<br>⑤ Late surface 限制 option 空间<br><br><strong>真实经验</strong>: 我作为 PM 第一次给 VP 汇报延期，准备了 20 min PPT + 5 个 options。VP 5 分钟后 "<strong>What do you recommend?</strong>" → 我没准备 → fumbled。教训：① 准备 90 秒 BLUF；② 1-2 recommendation max；③ Anticipate VP question；④ Written follow-up email。<br><br>第二次延期汇报：90 秒 BLUF 完成 + VP approve recommendation in 5 minutes。<br><br><strong>跟 #33 SPI/CPI 题 cross-link</strong>: 完全一样的框架，区别仅在<strong>侧重点</strong>：#33 偏量化 metric，#16 偏 communication tactics。`,
      },
      failure_modes: [
        `"项目可能要晚一点" vague`,
        `20 min PPT VP 没耐心`,
        `没 recommendation 甩问题`,
        `Hide and hope late surface`,
        `没 written follow-up VP 忘事`,
      ],
      follow_ups: [
        { q: `VP angry 怎么办？`, hint: `① Acknowledge frustration "I understand"；② Don't defensive；③ Reiterate commitment；④ Ask "what additional info do you need"；⑤ Written 24h follow-up；⑥ Don't avoid future face` },
        { q: `如果 VP 不同意 recommendation？`, hint: `① 不 defend，听完 reasoning；② Ask clarifying questions；③ 24h 内重新 evaluate + revised proposal；④ Walk away ready 如果 fundamental disagreement；⑤ Document for transparency` },
        { q: `第 2 / 3 次延期同一项目怎么 communicate？`, hint: `① 严肃 retrospective—— 估算 vs execution；② 跟 leadership reset—— "可能项目 fundamentally underscoped"；③ Consider escalating—— 是否要 kill / re-charter；④ Self-reflect as PM` },
      ],
    },

    17: {
      why_asked: `客户加范围是 PM 经典 scope creep 场景。能讲"CR process + impact analysis + 3 options"的人是真做过 client management。`,
      answers: {
        mid: `<strong>3 步</strong>: ① <strong>立即 acknowledge</strong>（不立 commit）；② <strong>impact analysis</strong>（time / cost / risk to existing scope）；③ 走 <strong>CR (Change Request) process</strong> + 给客户 3 options（加 budget / extend timeline / swap scope）。`,
        senior: `<strong>详细 process</strong>:<br>1. <strong>不当场 say yes</strong> "Let me understand the request, I'll get back to you in 48h"<br>2. <strong>Internal impact analysis</strong>:<br>· Effort estimate（人月 + duration）<br>· Risk to existing commitments<br>· Dependency / sequencing<br>3. <strong>3 options 给 customer</strong>:<br>· A: <strong>Accept with budget +X / timeline +Y</strong>（标准 CR）<br>· B: <strong>Swap</strong>（cut feature Z 换新 feature W）<br>· C: <strong>Defer</strong>（next release / Q+1）<br>4. <strong>Formal CR document</strong>：双方签字<br>5. <strong>Comm to team</strong>: 不是 EM 默默吞下，team 知道 scope 变更`,
        staff: `深一层：Scope creep 是 PM 长期最大 risk。客户的"<strong>just one more thing</strong>" 单看小，累积起来 sink 项目。<strong>3 个心态</strong>:<br>1. <strong>Saying no is OK</strong>—— 客户可能不爽但 long-term respect you 的 discipline<br>2. <strong>Free 是最贵的</strong>—— 接受 free scope creep 教坏客户期待<br>3. <strong>Document everything</strong>—— "我们以为他/她说 X" 无证据 = lose<br><br><strong>真实案例</strong>: platform agent customer X 在 month 3 ask "再加 SDN integration"，"<strong>不会很多工作吧</strong>"。<br><br>我的 response process:<br>1. "<strong>Let me get back to you in 48h with impact analysis</strong>" (不当场 commit)<br>2. <strong>Internal eng team estimate</strong>: 6 weeks + 2 engineers full time（不小）<br>3. <strong>3 options 给 customer</strong>:<br>· A: <strong>Accept</strong>: Add 6 weeks to timeline + $40k cost (signed CR)<br>· B: <strong>Swap</strong>: defer original feature Y (less critical) → ship on time<br>· C: <strong>Phased</strong>: ship original scope on time, SDN integration as Phase 2 in Q+1<br>4. <strong>Recommendation</strong>: C（不影响 timeline + customer 仍 get value within 6 month）<br><br>Customer 反应: 当场 not happy 因为他想 "<strong>free</strong>"，但 1 周后 sales mgr 说 customer fine with C 因为 ROI 计算后 budget 真的不够 +$40k。<br><br><strong>结果</strong>: ① 不延期；② customer get full scope eventually；③ Team morale 不受 sudden push 影响；④ Sales 也学到 future commitment 跟 PM align。<br><br><strong>常见 anti-pattern</strong>:<br>① <strong>当场 say yes</strong>—— Team 后续填坑 + 没有 documented commitment<br>② <strong>Pure no</strong>—— customer 失望 + sales 反弹<br>③ <strong>没 CR formal process</strong>—— 后期 dispute 时无依据<br>④ <strong>Pad estimate</strong>（"6 weeks 实际 4 weeks 我加 buffer"）—— customer 知道后 trust 崩<br>⑤ <strong>不 escalate sales 那边</strong>—— sales 还在 promise customer<br><br><strong>关键</strong>: ① 48h cool-down；② impact analysis；③ 3 options；④ Formal CR；⑤ Comm everywhere（team + sales + customer）。`,
      },
      failure_modes: [
        `当场 say yes → team 填坑`,
        `Pure no → customer / sales 反弹`,
        `没 CR formal process → 后期 dispute 无依据`,
        `Pad estimate → trust 崩`,
        `不跟 sales align → 仍 promise free`,
      ],
      follow_ups: [
        { q: `Customer 当场 push back "but this is small"？`, hint: `① "Help me understand the underlying need"—— 可能其实 alternative；② "If small, I'll get exact estimate in 48h"；③ Don't accept "small" labeling without analysis；④ Show CR is process not bureaucracy` },
        { q: `Sales 已经 promise customer free 怎么办？`, hint: `① 不在 customer 面前 contradict sales (face issue)；② 私下跟 sales align "this is unsustainable"；③ Sales mgr / VP 升级；④ Long-term: sales engagement process 加 PM review` },
        { q: `Customer 是 strategic 不能 say no？`, hint: `① 还可以 negotiate timeline / phased；② Accept 时 explicit ROI calculation 给 own VP（"这个 $40k cost 换 $X ARR"）；③ Document strategic exception；④ 用 momentum push internal eng support` },
      ],
    },

    19: {
      why_asked: `复盘是 senior PM/EM 必备技能。能讲"blameless + 5 whys + action items + 跟进"的人是真做过 postmortem。`,
      answers: {
        mid: `<strong>4 个原则</strong>: ① <strong>Blameless</strong>（不针对 individual）；② <strong>Timeline first</strong>（事实 before judgement）；③ <strong>5 whys 找 root cause</strong>（不止 stop at first answer）；④ <strong>Action items + owner + deadline</strong>（不只学习）。`,
        senior: `<strong>典型 postmortem 结构</strong>:<br>1. <strong>Summary</strong>: 1 段话讲事故 / 失败的本质<br>2. <strong>Impact</strong>: customer / revenue / 团队 morale 量化<br>3. <strong>Timeline</strong>: 客观时间线 (T0 / T+5m / T+30m / 解决)<br>4. <strong>Root cause analysis (5 whys)</strong>:<br>· Why 1: 直接 trigger<br>· Why 2: 为啥 trigger 没被 prevent<br>· Why 3: 为啥 monitor 没 catch<br>· Why 4: 为啥 process 没 防止<br>· Why 5: System / culture 层<br>5. <strong>What went well</strong>（不只 negative）<br>6. <strong>Action items</strong>: <strong>SMART</strong> (具体 / 可测 / Owner / Deadline)<br>7. <strong>Lessons</strong>: 团队 / 组织层面 learnings<br><br><strong>关键</strong>: ① 不 blame；② 不 stop at surface；③ Action items track 到底。`,
        staff: `深一层：复盘的<strong>真实价值</strong>是<strong>"防止类似问题再发生"</strong>，不是"找 blame"。Google SRE 强调 <strong>Blameless Postmortem</strong> 文化—— 不仅<strong>不 blame</strong>，是<strong>主动 reframe</strong> "如果 X 是问题，那为啥我们的 system / process 允许 X 发生？"<br><br><strong>真实案例</strong>: platform agent 一个项目失败（6 个月 ship 不出来），复盘 process:<br><br>1. <strong>Scheduled 2 hour blameless meeting</strong>，邀请 entire team + key stakeholders<br>2. <strong>预先 1on1 collection</strong> (1 周): 每个 team member 私下 share 他们的 perspective—— anonymized 入 doc<br>3. <strong>Meeting 4 sections</strong>:<br>· Section 1 (30 min): Timeline 重建 (objective facts only)<br>· Section 2 (45 min): 5 whys + system analysis<br>· Section 3 (30 min): What went well<br>· Section 4 (15 min): Action items + owner<br><br>4. <strong>5 whys 实际找到的</strong>:<br>· Why 1: feature complexity 比预期高 → 直接因素<br>· Why 2: 为啥估算错？→ 没 reference class 数据<br>· Why 3: 为啥没 reference class？→ 团队没 estimation process<br>· Why 4: 为啥没 process？→ 新 EM 没 prioritize estimation discipline<br>· Why 5: 为啥 EM 不知道？→ Onboard EM training 缺这一块<br><br>5. <strong>Action items</strong>:<br>· [Owner: PM] 引入 reference class forecasting + planning poker (Q+1 sprint 1)<br>· [Owner: VP] EM onboarding 加 estimation training (next hire)<br>· [Owner: tech lead] 历史项目 retrospective 数据库 (90 天内)<br>· [Owner: PM] Quarterly estimation calibration retrospective (ongoing)<br><br>6. <strong>3 months later check-in</strong>: 4/4 action items completed → 下个项目 estimation ratio 1.5× → 1.2×<br><br><strong>陷阱</strong>:<br>① <strong>Blame individual</strong>—— "X 做错了"—— individual 离职后问题 persist<br>② <strong>Stop at why 1-2</strong>—— surface symptom 不到 system / culture<br>③ <strong>Action items vague</strong>—— "improve communication"—— 不 actionable<br>④ <strong>No owner / deadline</strong>—— 6 个月后没人执行<br>⑤ <strong>不 follow-up 3 月后</strong>—— 复盘文档归档无 impact<br>⑥ <strong>只 do for big failure</strong>—— 应该 routine retro 每 sprint + 大复盘每事故<br><br><strong>关键</strong>: ① Blameless culture；② 5+ whys 到 system；③ SMART action items；④ Track follow-up；⑤ Make routine。`,
      },
      failure_modes: [
        `Blame individual → 离职后问题 persist`,
        `Stop at why 1-2 → surface symptom`,
        `Action items vague`,
        `No owner / deadline → 6 月后无执行`,
        `不 follow-up 3 月后 → 复盘归档无 impact`,
      ],
      follow_ups: [
        { q: `怎么 facilitate blameless atmosphere？`, hint: `① EM open with own mistake first；② 严禁"why didn't X do Y" 改成 "what made it easy to miss Y"；③ 邀请 leadership 出席体现 priority；④ 不 publicize individual blame；⑤ Reward "找 root cause" 不"惩罚 owner"` },
        { q: `Postmortem doc 怎么写？`, hint: `① Template 标准化（Google SRE Book Chapter 15 template）；② Public visible 给整 team；③ Concise (5-10 pages max)；④ Searchable archive；⑤ Quarterly aggregate retro 看 trends` },
        { q: `如果 root cause 是某个 individual 真做错？`, hint: `① 仍 framing 为 "system 允许 individual error"——typo / missed step / vague spec；② Action items focus on system fix (review / automation / training)；③ 私下跟 individual coach（separate from blameless postmortem）；④ Never public blame` },
      ],
    },

    21: {
      why_asked: `优先级冲突跟 #54 EM 题相通。能讲"force ranking + cost of delay + escalate"的人是真做过 PM 工作。`,
      answers: {
        mid: `<strong>3 招</strong>: ① <strong>Force ranking</strong>—— 不允许 "all P0"；② <strong>Cost of Delay</strong>—— 量化每个 delay 1 月损失；③ <strong>Escalate to leadership</strong>—— 多 P0 是 leadership alignment failure。`,
        senior: `跟 EM #54 题相通。PM 版本侧重<strong>跨多 stakeholder</strong>（sales / customer success / engineering / leadership 各自有"P0"），EM 版本侧重<strong>跨多团队</strong>。<br><br><strong>PM 特有 challenge</strong>: <br>· 没 direct authority over engineering team<br>· 必须 negotiate scope with sales / customer<br>· 跟 PM peers 之间也有 priority 冲突<br><br><strong>方法</strong>:<br>1. <strong>列出 stakeholders 的 "P0"</strong>: sales 的 customer commitment / customer 的 feature request / engineering 的 tech debt / leadership 的 strategic initiative<br>2. <strong>Cost of Delay 量化</strong>: ARR / 风险 / strategic value<br>3. <strong>跟 leadership pre-align 优先级框架</strong>（不在每个具体决策时 escalate）<br>4. <strong>Document + communicate</strong> 决策 + rationale + alternative timeline`,
        staff: `深一层：PM 优先级管理跟 EM 区别——PM 不只是 "<strong>scope 内排序</strong>"，是 "<strong>跟所有 stakeholder 教育 priority framework</strong>"。<br><br><strong>真实案例</strong>: 作为 platform agent PM，Q4 收到:<br>1. <strong>Sales</strong>: customer X 要 SDN integration (deal $500k/yr)<br>2. <strong>Customer Success</strong>: existing customer Y 报 P0 bug<br>3. <strong>Engineering</strong>: tech debt 重构（影响 future velocity）<br>4. <strong>Leadership</strong>: AI feature 要 ship for marketing<br>5. <strong>另一 PM</strong>: 共享 infra 也要他们的 feature<br><br><strong>我的 process</strong>:<br>1. <strong>1on1 each stakeholder</strong>: 量化他们的 P0 cost of delay<br>· Sales: ARR $500k/yr + customer X strategic / 长期客户<br>· CS: P0 bug → customer Y churn risk $200k/yr<br>· Eng: tech debt → future velocity -30%, but fuzzy<br>· Leadership: AI feature marketing - $50k visibility 但 nice-to-have<br>· Peer PM: 共享 infra 可以等 1-2 sprint<br><br>2. <strong>Force ranking</strong>:<br>· P0 真: CS bug + Sales SDN<br>· P1: Engineering tech debt（partial 在 P0 + 当 capacity 允许）<br>· P2: AI feature / peer PM<br><br>3. <strong>跟 VP align</strong>（不是问每个具体，是 align framework）: "<strong>我们用 ARR-at-risk + strategic value 排序，这个 quarter focus customer retention + strategic deal。其他推 Q1</strong>"<br><br>4. <strong>Communicate to each stakeholder</strong>:<br>· Sales: confirmed SDN priority + 时间表<br>· CS: P0 bug priority<br>· Eng: tech debt 占 capacity 的 20%（routine）<br>· Leadership: AI feature Q1 ship + Q4 communicate context<br>· Peer PM: Q1 align timeline<br><br>5. <strong>Document</strong>: 季度 priority memo 给所有 stakeholders<br><br>结果: 所有 P0 都 hit，P1 部分 ship，P2 Q1 reset。各 stakeholder 短期失望但理解 framework + 长期 trust PM。<br><br><strong>陷阱</strong>:<br>① <strong>Loudest wins</strong>—— sales 通常 loudest，导致 quiet stakeholder (eng) 永远 deprioritize<br>② <strong>"All P0" → all suffer</strong>—— PM 必须 force ranking<br>③ <strong>不跟 leadership align framework</strong>—— 每个具体决策都 escalate, leadership 累<br>④ <strong>不 document</strong>—— retro 时甩锅<br>⑤ <strong>不 communicate "no"</strong>—— stakeholder 一直 expect<br><br><strong>关键</strong>: ① Quantify CoD；② Force ranking；③ Leadership align framework；④ Communicate explicitly；⑤ Document。`,
      },
      failure_modes: [
        `Loudest wins → quiet stakeholder 永远 deprioritize`,
        `All P0 → all suffer`,
        `不跟 leadership align framework → 每决策都 escalate`,
        `不 document → retro 甩锅`,
        `不 communicate "no" → stakeholder 一直 expect`,
      ],
      follow_ups: [
        { q: `Stakeholder 抱怨自己项目被 deprioritize？`, hint: `① 1on1 解释 rationale + data；② 给 alternative timeline；③ 邀请他们 challenge ranking (data-based)；④ 不 unilaterally change；⑤ Escalate if unhappy 但 own decision` },
        { q: `Leadership 也说 "all 5 are P0"？`, hint: `① Skip-level；② Show capacity math (5 P0 = 3x capacity)；③ 给 hire / contractor option；④ If unmovable, document risk acknowledgement` },
        { q: `Cost of Delay 怎么量化？`, hint: `① Revenue impact / 月；② Risk × probability；③ Strategic value (market window / competitive)；④ 越量化越易 leadership 决策` },
      ],
    },

    30: {
      why_asked: `反向问题是面试结尾<strong>必问</strong>。能讲"问出 senior signal + 体现 fit + 风险信号"的人通过；不问问题等于 0 interest red flag。`,
      answers: {
        mid: `<strong>必须问 3-5 个</strong>。问 senior 级问题（不是 "<strong>公司福利怎么样</strong>"）。Categories: ① <strong>角色 / team</strong>；② <strong>挑战 / opportunity</strong>；③ <strong>面试官 own experience</strong>；④ <strong>Calibration 我能不能 fit</strong>。`,
        senior: `<strong>高质量问题示例</strong>:<br>1. <strong>角色挑战</strong>: "这个 role 90 天 / 6 月 / 1 年的 success 长什么样？"<br>2. <strong>Team 文化</strong>: "Team 最近一次 conflict 是关于啥？怎么 resolve 的？"<br>3. <strong>面试官 own perspective</strong>: "你在这工作 X 年了，最 surprise 你的是啥？"<br>4. <strong>挑战</strong>: "如果我 join，前 3 月最大 risk 是啥？"<br>5. <strong>Calibration</strong>: "Based on 这场 interview，你对我有啥 concern 我可以 address？"<br><br><strong>避免</strong>:<br>· Benefits / vacation / WFH（HR 问，不是面试官问）<br>· "Tell me about company"（Google 一下）<br>· "How long until promotion?" (显得 transactional)<br>· "Anything I should know"（vague）`,
        staff: `深一层：反向问题<strong>不只是 ritual</strong>，是<strong>双向 evaluation 工具</strong>。Senior PM/EM 通过 question quality 体现：① 真有 think about role；② Critical thinking；③ Maturity；④ Calibration ability。<br><br>同时<strong>你也在面试公司</strong>—— 答案能 reveal：① Team health；② Leadership quality；③ Real challenges。<br><br><strong>真实经验</strong>: 我面过 4 个公司 PM role，反向问题影响选择:<br><br>· <strong>Company A</strong>: 我问 "team 最近 conflict？" → 面试官答 "我们 team 不太有 conflict"—— red flag (要么不真实要么 echo chamber)<br>· <strong>Company B</strong>: 同问题 → 面试官详细讲 1 个 recent disagreement + 怎么 resolve—— green flag, team 心理安全<br>· <strong>Company C</strong>: 我问 "我前 3 月最大 risk?" → 答 "no risk, you'll do great"—— red flag (lie or naive)<br>· <strong>Company D</strong>: 同问 → "X stakeholder 难合作，Y system 是 legacy 你要 navigate"—— green flag, honest<br><br>最终接 B 跟 D 之一（D），过去 2 年很满意。<br><br><strong>5 个 senior-tier 问题模板</strong>:<br>1. "<strong>Team disagree most recent?</strong>"—— 看 conflict handling<br>2. "<strong>What surprised you?</strong>"—— 面试官真实 perspective<br>3. "<strong>3-month risk?</strong>"—— honest assessment<br>4. "<strong>Concerns about me?</strong>"—— calibration + close gap<br>5. "<strong>How do you measure success of this role?</strong>"—— alignment<br><br><strong>陷阱</strong>:<br>① <strong>"No questions"</strong>—— 极 red flag (no interest)<br>② <strong>Google-able 问题</strong>（公司规模 / 上市状态）—— didn't prep<br>③ <strong>Transactional</strong>（promotion / comp）—— 给 HR，不是面试官<br>④ <strong>Yes/No 问题</strong>—— close-ended，no insight<br>⑤ <strong>多次 round 都同问题</strong>—— 显示 lazy<br><br><strong>关键</strong>: ① 准备 5-7 个高 quality 问题；② 每 round 不同；③ 听答案的 quality 评估公司；④ Reveal critical thinking + calibration。`,
      },
      failure_modes: [
        `"No questions" → red flag no interest`,
        `Google-able 问题 → didn't prep`,
        `Transactional (promotion/comp)`,
        `Yes/No 问题 close-ended`,
        `多 round 同问题 lazy`,
      ],
      follow_ups: [
        { q: `面试官答得 vague 怎么办？`, hint: `① Follow up specific example；② "Can you give me a specific story of...?"；③ 同问题问下个面试官 cross-validate；④ Vague answer 本身是 signal` },
        { q: `什么样的答案是 red flag？`, hint: `① "我们没有 conflict" / "no risk" → 不诚实 / naive；② Generic answer (HR-like)；③ 跟其他 round 答案矛盾；④ 不能讲具体 example；⑤ Defensive 回应你的 question` },
        { q: `怎么问 about salary / promotion 不显 transactional？`, hint: `① 留给 HR / recruiter 阶段；② Final round 偶尔可以 high-level 问 "career path of this role"；③ 不在 hiring manager / peer round 问；④ Focus content over comp` },
      ],
    },

    // ============== PgM ==============
    34: {
      why_asked: `CPM 是 PgM 基础。能讲"关键路径 + float + crashing"的人是真做过 schedule management。`,
      answers: {
        mid: `<strong>关键路径 (Critical Path)</strong>: 项目中<strong>最长的 task chain</strong>—— 决定项目最早完成时间。<strong>float / slack = 0</strong> 的 tasks。Delay 任何 critical path task → 整项目延期。`,
        senior: `<strong>CPM (Critical Path Method) 完整概念</strong>:<br>· <strong>Task / Activity</strong>: 工作单元 + duration<br>· <strong>Dependency</strong>: A must finish before B (FS / SS / FF / SF 4 种)<br>· <strong>ES / EF</strong>: Earliest Start / Finish<br>· <strong>LS / LF</strong>: Latest Start / Finish<br>· <strong>Float / Slack</strong>: LS - ES = LF - EF<br>· <strong>Critical Path</strong>: float = 0 的 path（最长）<br><br><strong>实战 use</strong>:<br>1. 识别 critical path → prioritize resource<br>2. <strong>Crashing</strong>: 加资源缩短 critical task（cost extra $$）<br>3. <strong>Fast tracking</strong>: 并行原本 sequential task（add risk）<br>4. <strong>Buffer management</strong> (Critical Chain): 加 project buffer 防 statistical variation`,
        staff: `深一层：CPM 是 1950s 化工 / 国防项目发明的，今天<strong>仍是大型项目核心</strong>。但<strong>软件项目少用纯 CPM</strong>—— 软件 task dependency 弱 + estimation 不准 + scope 经常变。<strong>替代</strong>: agile burn-down + critical-path-lite。<br><br><strong>实战场景</strong>: 适合用 CPM 的:<br>· 客户 deployment / migration（task fixed + dependency 明确）<br>· 硬件 / 物理 setup<br>· Compliance audit (regulatory deadline)<br>· Conference / product launch（fixed end date）<br><br>不适合用纯 CPM 的:<br>· Discovery / R&D 阶段（task uncertain）<br>· Agile feature development<br>· 长期演进项目（&gt; 1 年）<br><br><strong>真实案例</strong>: platform agent 客户 migration 项目，CPM 关键路径:<br>· Day 1-3: customer env survey<br>· Day 4-7: agent install + config (critical, 必 follow survey)<br>· Day 8-10: integration test (critical)<br>· Day 11-14: cutover + monitor (critical)<br>· Parallel: Day 1-5 documentation (float = 5 day, 非 critical)<br><br>客户 push timeline 5 day（Day 7-10 holiday）→ 我 evaluate:<br>· Crash install (加 2 个 contractor，cost $30k) → save 2 day<br>· Fast track install + test 并行 → save 1 day 但 add risk<br>· 不 work on document parallel → not on critical path, irrelevant<br><br>选 crashing → 5 day → 7 day, customer happy。<br><br><strong>常见 mistake</strong>:<br>① <strong>不 identify critical path</strong>—— 把资源平均铺到所有 task<br>② <strong>不更新 critical path</strong>—— 项目中期 dependency 变了，critical path 也变<br>③ <strong>软件项目硬套 CPM</strong>—— task uncertain 时 CPM 不准<br>④ <strong>Crashing 不算 cost</strong>—— 加资源不是 free，且 Brooks' Law 限制<br>⑤ <strong>Fast tracking 不算 risk</strong>—— 并行的 risk 后期暴露<br><br><strong>跟 Critical Chain 区别</strong>: Goldratt 1997 提出，<strong>不止找 longest path，还考虑 resource constraint</strong>（同一 resource 不能同时做两个 task）。更现实但更复杂。`,
      },
      failure_modes: [
        `不 identify critical path → 资源平均铺`,
        `不更新 critical path → dependency 变后失效`,
        `软件项目硬套 CPM`,
        `Crashing 不算 cost / Brooks' Law`,
        `Fast tracking 不算 risk`,
      ],
      follow_ups: [
        { q: `Crashing vs Fast tracking 选哪个？`, hint: `① Crashing: 加 cost 不加 risk（加资源 / 加班）；② Fast tracking: 加 risk 不加 cost（并行 sequential task）；③ 通常先 fast tracking（cheap），不够再 crashing` },
        { q: `Critical Chain 跟 CPM 区别？`, hint: `① CPM 只看 task dependency；② CC 加 resource constraint（同 resource 不并行）；③ CC 加 buffer 防 variation；④ 现代项目 CC 更现实但复杂` },
        { q: `Agile 项目怎么用 critical path 思维？`, hint: `① Backlog 排序 + dependency 标记；② 每 sprint identify "must complete this sprint" 任务；③ Burn-down + cumulative flow diagram；④ 灵活 over 严格 critical path` },
      ],
    },

    37: {
      why_asked: `风险评分 P×I 是 PMBOK 标准。能讲"P×I 矩阵 + 16 = high + response strategy"的人是真做过风险登记。`,
      answers: {
        mid: `<strong>P × I 矩阵</strong>: Probability × Impact 各 1-5 → 1-25 score。<strong>16+ = High</strong>—— 必须有 mitigation plan + owner + review cadence。`,
        senior: `<strong>响应策略 4 类</strong>:<br>1. <strong>Avoid (避免)</strong>: 重新设计避免风险（最贵但最 effective）<br>2. <strong>Transfer (转移)</strong>: 给 vendor / insurance / contractor（成本 transfer）<br>3. <strong>Mitigate (缓解)</strong>: 降低 P 或 I (主流，~70% case)<br>4. <strong>Accept (接受)</strong>: 监控 + contingency reserve<br><br><strong>P × I = 16 specific 处理</strong>:<br>① 立 mitigation plan + owner + 周 review<br>② 5%-10% contingency budget reserve<br>③ Escalate 到 steering committee monthly<br>④ Trigger event define + auto-escalate threshold<br>⑤ Pre-mortem (假设 risk happens, what's our response)`,
        staff: `深一层：P × I 矩阵的<strong>本质问题</strong>是<strong>P 跟 I 都难量化</strong>。"<strong>50% 概率影响 customer X 100k</strong>" 在新 PM 嘴里完全 made up。但<strong>结构化讨论本身有 value</strong>——团队 alignment + surface unknown unknowns。<br><br><strong>4 类响应实战</strong>:<br><br><strong>Avoid 示例</strong>: platform agent 早期考虑用 vendor X SDK，P×I=20（vendor 不稳定 + 影响 critical path）。Avoid: 自研 minimal SDK 替代 vendor。Cost: +2 月 dev time，<strong>但</strong>砍掉 P×I=20 风险。<br><br><strong>Transfer 示例</strong>: 数据中心物理 setup P×I=15。Transfer: 用 AWS / Azure（hosting cost 但 risk 转给 cloud vendor）。<br><br><strong>Mitigate 示例</strong>: senior eng X 可能离职 P=0.4 I=4 → 8。Mitigate: cross-training (减 I to 2) + retention bonus (减 P to 0.2) → P×I 8 → 0.4。<br><br><strong>Accept 示例</strong>: 客户 country 政治 instability P=0.1 I=5 → 0.5。Accept + monitor。Contingency: backup customer pipeline。<br><br><strong>真实经验</strong>: platform agent v3 project risk register top 5:<br>1. Senior eng X 离职 (P×I=12) → mitigate: cross-train + bonus<br>2. Vendor SDK 不兼容 (P×I=16) → mitigate: spike 验证 in 2 weeks<br>3. Customer Y migration 复杂 (P×I=15) → mitigate: 1 month early pilot<br>4. Compliance feature 需求变 (P×I=10) → accept + 跟 legal weekly<br>5. Team capacity 不足 (P×I=20) → avoid: scope cut OR transfer: contractor<br><br>Risk #5 escalate VP → approved contractor budget → P×I 降到 6。<br><br><strong>陷阱</strong>:<br>① <strong>P / I 随便填</strong>—— "I feel like 30%" → useless<br>② <strong>不 review 不更新</strong>—— P×I = 16 半年前现在还在 register 没人看<br>③ <strong>只 identify 不 action</strong>—— register 30 个 risk 没 mitigation owner<br>④ <strong>Top management 不参与 review</strong>—— senior risk 没 leadership visibility<br>⑤ <strong>不区分 P × I = 16 不同来源</strong>—— P=4 I=4 跟 P=8 I=2 处理不同<br><br><strong>关键</strong>: ① 量化基于 evidence（如类似过去项目）；② Weekly review high risk；③ Owner + deadline；④ Escalate top 3-5 to leadership monthly；⑤ Pre-mortem。`,
      },
      failure_modes: [
        `P / I 随便填 (made up)`,
        `不 review 不更新 → 过期 register`,
        `只 identify 不 action`,
        `不 escalate top risk 给 leadership`,
        `不区分 P=4 I=4 vs P=8 I=2`,
      ],
      follow_ups: [
        { q: `怎么 calibrate P 估算？`, hint: `① Reference Class（类似过去项目实际发生率）；② Expert panel (multi-perspective + 投票)；③ Pre-mortem (假设 happens, working backwards)；④ Update P 当新信息 come` },
        { q: `Contingency Reserve 怎么定？`, hint: `① 项目 budget 5-15% 通常 reserve；② 基于 high risk 总 expected value (Σ P×I×cost)；③ Reserve PM 控制 not project budget；④ Use 时 document trigger event` },
        { q: `Risk Register 怎么 manage scale？`, hint: `① Tier (high/med/low)；② High weekly review，med biweekly，low monthly；③ Tool: spreadsheet / Jira / Smartsheet；④ Quarterly aggregate retro 看 trend` },
      ],
    },

    38: {
      why_asked: `5 类风险应对是 PMBOK 标准。能列全 + 给场景的人 well-prepared。`,
      answers: {
        mid: `<strong>5 类（PMBOK 正负风险各分 4 + 接受）</strong>:<br><strong>负风险 (Threats)</strong>: ① <strong>Avoid</strong>（避免）；② <strong>Transfer</strong>（转移）；③ <strong>Mitigate</strong>（缓解）；④ <strong>Accept</strong>（接受）<br><strong>正风险 (Opportunities)</strong>: 对应 Exploit / Share / Enhance / Accept`,
        senior: `<strong>详细 + 场景</strong>:<br><br><strong>Threats (4 + Accept)</strong>:<br>1. <strong>Avoid</strong>: 改设计完全避免（最 effective 最贵）。例: 不用 vendor X 自研<br>2. <strong>Transfer</strong>: 给第三方承担（insurance / contractor / cloud）。例: 物理 hosting 给 AWS<br>3. <strong>Mitigate</strong>: 降 P 或 I（主流，70% case）。例: cross-train + retention bonus<br>4. <strong>Accept (passive)</strong>: 监控 + 不主动 mitigate<br>5. <strong>Accept (active)</strong>: 接受 + contingency reserve（典型 5-15% budget）<br><br><strong>Opportunities (mirror)</strong>:<br>1. <strong>Exploit</strong>: 确保 opportunity 实现（如 hire 已知 senior eng）<br>2. <strong>Share</strong>: partner 一起追 opportunity（如 JV）<br>3. <strong>Enhance</strong>: 提高 P 或 I（如 invest marketing）<br>4. <strong>Accept</strong>: 不主动追，机会 come 也 OK`,
        staff: `深一层：PMBOK 5 类应对在<strong>软件项目实战 80% 是 mitigate</strong>。Pure avoid 罕见（项目本身 by nature 有 risk），transfer 限于 outsource 场景，accept 是 default。<br><br><strong>选择决策框架</strong>:<br>1. <strong>Cost of avoidance vs Cost of impact</strong>:<br>· Avoidance &lt; expected impact (P × I × cost) → Avoid<br>· Avoidance &gt;&gt; impact → Mitigate / Accept<br>2. <strong>Reversibility</strong>:<br>· 不可逆 (regulatory fine / safety) → Avoid 优先<br>· 可逆 (perf miss / feature delay) → Mitigate or Accept<br>3. <strong>Probability</strong>:<br>· P 高 → Mitigate（降 P）<br>· P 低 → Accept + 监控<br>4. <strong>Impact concentration</strong>:<br>· Single point of failure → Transfer / Avoid<br>· Distributed → Mitigate<br><br><strong>真实案例</strong>: platform agent v3 风险应对组合:<br>· Risk A: senior eng 离职 (P=0.4 I=4) → <strong>Mitigate</strong>（cross-train + retention）<br>· Risk B: vendor SDK 不兼容 (P=0.6 I=5) → <strong>Avoid</strong>（自研 minimal SDK）<br>· Risk C: 数据中心物理 setup (P=0.2 I=4) → <strong>Transfer</strong>（AWS hosting）<br>· Risk D: customer country political (P=0.1 I=5) → <strong>Accept (active)</strong>（backup customer pipeline）<br>· Risk E: 老 team member 上 promote (P=0.4 I=+3 positive) → <strong>Enhance</strong>（早期 visibility / mentorship）<br><br><strong>陷阱</strong>:<br>① <strong>所有 risk 都 mitigate</strong>—— 不够资源 + 浪费<br>② <strong>不 distinguish active / passive accept</strong>—— passive 没 contingency<br>③ <strong>Transfer 不算 cost</strong>—— insurance / cloud / contractor 仍要 budget<br>④ <strong>不识别 positive risk (opportunity)</strong>—— 错过<br>⑤ <strong>Accept 不 review</strong>—— P 变了仍当低 risk<br><br><strong>关键</strong>: ① 按 cost-benefit 选 response；② 区分 active / passive accept；③ Don't ignore opportunities；④ Quarterly re-assess。`,
      },
      failure_modes: [
        `所有 risk 都 mitigate → 资源不够`,
        `不区分 active / passive accept`,
        `Transfer 不算 cost`,
        `不识别 positive risk`,
        `Accept 不 review → P 变后失效`,
      ],
      follow_ups: [
        { q: `什么时候 Avoid 优先？`, hint: `① 不可逆 impact (regulatory / safety)；② Cost of avoidance &lt; expected impact；③ Single point of failure；④ Strategic priority` },
        { q: `Transfer 真的转移了 risk 吗？`, hint: `① Cost yes (insurance 赔 / vendor 担责)；② Operational risk partial (vendor 跑路时你仍 affected)；③ Reputation risk 不能 transfer；④ Always read fine print` },
        { q: `Positive risk (opportunity) 怎么 manage？`, hint: `① 同样 P × I scoring；② Exploit (确保 happen) / Enhance (提高 P/I) / Share (partner) / Accept；③ 多数项目 only track threats, but opportunity 同样重要` },
      ],
    },

    // ============== PdM ==============
    65: {
      why_asked: `Kano 模型是 PdM 经典工具。能讲"5 类需求 + 时间 decay + 实战 use"的人是真用过。`,
      answers: {
        mid: `<strong>5 类需求</strong>:① <strong>Basic / Must-have</strong>（缺则崩，有也不喜）；② <strong>Performance / Linear</strong>（越好越喜）；③ <strong>Excitement / Delighter</strong>（意料外的惊喜）；④ <strong>Indifferent</strong>（没影响）；⑤ <strong>Reverse</strong>（有了反而不喜）。<br><strong>Time decay</strong>: Delighter 久了变 Performance 再变 Basic。`,
        senior: `<strong>典型 use case</strong>:<br>1. <strong>Feature 优先级</strong>: Must-have 必做 + Performance 持续 invest + Delighter 选择性 invest<br>2. <strong>Survey 设计</strong>: Kano questionnaire (functional + dysfunctional question pair)<br>3. <strong>Competitive analysis</strong>: 竞品 Basic 都有 → 你必有；Delighter 是 differentiator<br><br><strong>典型 evolution</strong>:<br>· iPhone retina display (2010): Delighter → 2014 Performance → 2020 Basic<br>· 智能手机 camera: 2007 Performance → 2025 Basic（所有手机都好）<br><br><strong>关键 insight</strong>: Delighter 是<strong>差异化关键</strong>但 short-lived；Basic 必须不输竞品；Performance 持续 invest。`,
        staff: `深一层：Kano 模型的<strong>真实价值</strong>是<strong>"教育 stakeholder 不要平等对待所有 feature"</strong>。<br><br>· Sales 通常 push <strong>customer-asked features</strong>—— 大多是 Performance (linear)<br>· Engineer push <strong>tech debt fixes</strong>—— 大多是 Basic (must-have, 但不 differentiator)<br>· PM 应该 push <strong>Delighter</strong>—— 客户没 ask 但 reveal 后 wow，长期 build moat<br><br><strong>真实案例</strong>: platform agent v3 我作为 PM 用 Kano 分类:<br>· <strong>Basic</strong>: RPC 标准 protocol 支持 + customer's existing device firmware 兼容 + basic CLI<br>· <strong>Performance</strong>: P99 latency / 吞吐 / availability—— 越快越好<br>· <strong>Delighter</strong>:<br>· <strong>"Show me everything"</strong> diagnostic tool (一键 dump 整个 device state)—— 客户没要，但发现后 every demo 都"<strong>wow</strong>"<br>· <strong>Pre-flight check</strong>（操作前 dry run 预测影响）—— 防止 customer fat finger<br><br>Result: Basic + Performance 让我们 catch up vendor，<strong>Delighter 让我们 differentiator</strong> → 6 个月赢 3 个 enterprise deal "原本不打算切 vendor 的 customer 因为我们这两个 feature 切了"。<br><br><strong>Time decay 实战</strong>: 2024 一键 dump 是 Delighter，2026 已经 industry standard → 变 Performance。我们要继续找 next Delighter（如 AI-powered config recommendation）。<br><br><strong>陷阱</strong>:<br>① <strong>只 listen customer</strong>—— customer 不 ask Delighter（他们想不到）<br>② <strong>Equal invest 所有类型</strong>—— Basic 跟 Delighter 同等资源 = waste<br>③ <strong>不考虑 time decay</strong>—— 6 月前 Delighter 现在 baseline<br>④ <strong>Delighter 跟 unnecessary 混</strong>—— "engineer 觉得 cool" ≠ Delighter，必须 customer 真 wow<br>⑤ <strong>不 quantitative survey 验证</strong>—— pure intuition 易错<br><br><strong>验证方法</strong>: Kano survey (Noriaki Kano original):<br>· Q: "如果产品有 X 你感觉？" (functional)<br>· Q: "如果没 X 你感觉？" (dysfunctional)<br>· 答案矩阵 → 自动分类 Basic / Performance / Delighter / Indifferent / Reverse`,
      },
      failure_modes: [
        `只 listen customer → 错过 Delighter`,
        `Equal invest 所有类型`,
        `不考虑 time decay`,
        `Delighter 跟 engineer-cool 混`,
        `不 quantitative survey 验证`,
      ],
      follow_ups: [
        { q: `Kano survey 怎么 design？`, hint: `① Each feature 2 question (functional + dysfunctional)；② Likert scale (like / expect / neutral / dislike-tolerate / dislike)；③ 答案矩阵自动分类；④ Sample size 30-100 customer 足够` },
        { q: `Reverse 需求是啥？`, hint: `① 有了反而 less satisfied (e.g., 太多 notification → 反感)；② 罕见但 critical 识别；③ 例: simplify UI 删功能可能让 power user 反感` },
        { q: `怎么找 Delighter？`, hint: `① Observation (用户 workaround / pain points 但他们不 ask fix)；② Adjacent industry inspiration；③ Internal team's "wouldn't it be cool if"；④ Customer interview 问 "<strong>最 frustrating moment</strong>"反推` },
      ],
    },

    68: {
      why_asked: `留存曲线是 PdM 核心 metric。能讲"4 形状 + 含义 + action"的人是真做过 retention analysis。`,
      answers: {
        mid: `<strong>4 种形状</strong>:① <strong>Flat-bottom</strong>（健康）—— 长期稳定 retention；② <strong>Smile</strong>—— low after grace period 但能 win back；③ <strong>Hockey stick</strong>（极少）—— 持续增长；④ <strong>Cliff</strong>—— drop to 0，dead。`,
        senior: `<strong>4 种形状详解 + 含义</strong>:<br><br>1. <strong>Flat-bottom (healthy)</strong>: D1 60% → D7 40% → D30 35% → D90 35% (stabilize)<br>· 含义: 找到 product-market fit，stable user base<br>· Action: Maintain + grow acquisition<br><br>2. <strong>Smile</strong>: D1 60% → D7 30% → D30 20% → D90 25% → D180 30% (回升)<br>· 含义: 部分 user 离开但 win-back works（如 re-engagement campaign）<br>· Action: Optimize re-engagement + identify why mid-period drop<br><br>3. <strong>Hockey stick</strong>: D1 40% → D7 30% → D30 25% → D90 35% → D180 50%<br>· 罕见 (typically B2B with growing power user usage)<br>· 含义: 用户越用越 hooked<br>· Action: Double down<br><br>4. <strong>Cliff</strong>: D1 50% → D7 20% → D30 5% → D90 1%<br>· 含义: 没 PMF / leaky bucket<br>· Action: 停 acquisition 先 fix retention (RARRA 逻辑)`,
        staff: `深一层：留存曲线的<strong>真实信号</strong>不是绝对数字，是<strong>shape</strong>。Andrew Chen 写过 "<strong>The Only Metric That Matters is Retention</strong>"—— 因为 retention 反映<strong>real value delivery</strong>，而 acquisition 可以靠 marketing $$ 买。<br><br><strong>真实案例对比</strong>:<br><br><strong>Product A (Cliff)</strong>: D30 1% retention<br>· 100k MAU but 99% 1 月内流失<br>· 单看 MAU 数字 vanity；实际 leaky bucket<br>· 不 fix retention，acquisition $$ 等于扔火里<br><br><strong>Product B (Flat-bottom)</strong>: D30 35% stable<br>· 30k MAU but 35% 长期保留<br>· 实际 long-term active user base 大 (10500 stable vs 1000 in A)<br>· 即使 MAU 少 1/3，business value 大 10×<br><br><strong>Action 决策</strong>:<br>· Cliff (D30 &lt; 10%) → 停 acquisition + fix retention (PMF gap)<br>· Smile (mid-period drop + 回升) → optimize re-engagement (push / email)<br>· Flat-bottom (healthy) → 同时 grow acquisition + maintain retention<br>· Hockey stick → invest in power user features<br><br><strong>怎么诊断 Cliff?</strong> 拆 funnel:<br>1. D0-D1: activation (用户 first session 是否成功)<br>2. D1-D7: habit formation (用户 form usage habit)<br>3. D7-D30: long-term value (用户感知 product value)<br>4. D30+: power user transformation<br><br>每段 drop-off 不同 root cause + fix。<br><br><strong>真实经验</strong>: platform agent customer churn 6 月发现 D30 customer NPS 30 (低)，churn 12%。诊断 cliff:<br>· D0-D1: deployment 复杂（30% fail first attempt）<br>· D1-D7: customer 找 admin 学习 cost 大<br>· D7-D30: 觉得 vendor 老 product "<strong>fine</strong>"<br><br>Action:<br>1. Onboarding wizard + customer success team → fix D0-D1 (deployment success 90%)<br>2. Better doc + video tutorial → fix D1-D7<br>3. Delighter feature ("show me everything")→ fix D7-D30 wow moment<br><br>6 month later: D30 churn 12% → 5% (industry baseline)。<br><br><strong>陷阱</strong>:<br>① <strong>看 MAU 不看 retention curve</strong>—— vanity<br>② <strong>不 cohort 分</strong>—— mix new + old cohort, signal 模糊<br>③ <strong>D30 stable 就 assume PMF</strong>—— 可能只是 sticky workflow 不是 valued<br>④ <strong>Pour acquisition $$ before fix retention</strong> (cliff case)<br>⑤ <strong>不区分 segment</strong>—— 小客户 vs 大客户 vs 不同 industry curve 不同`,
      },
      failure_modes: [
        `看 MAU 不看 retention curve → vanity`,
        `不 cohort 分 → signal 模糊`,
        `D30 stable 就 assume PMF → 可能 sticky workflow`,
        `Pour acquisition $$ before fix retention (cliff case)`,
        `不区分 segment`,
      ],
      follow_ups: [
        { q: `怎么定义 "active user"？`, hint: `① Product-specific (not blanket)；② 反映 core value (Spotify: 播放 30s；Slack: send msg；非 just login)；③ Aligned with 北极星 metric；④ Different cohorts may need different definition` },
        { q: `Smile curve 怎么 capitalize?`, hint: `① Re-engagement campaign at mid-period drop (push / email / in-app)；② Identify what brings them back (analyze win-back cohort)；③ Move that moment earlier in lifecycle` },
        { q: `B2B 的 retention curve 跟 B2C 差异？`, hint: `① B2B retention 通常更高 (switching cost + multi-user adoption)；② 但 churn 影响 ARR 大；③ Net Revenue Retention (NRR) &gt; 100% 健康；④ B2C focus DAU/MAU，B2B focus account-level retention` },
      ],
    },

    69: {
      why_asked: `A/B 设计是 senior PdM 必备。能讲"Hypothesis + sample size + guardrail + statistical significance"的人是真做过 experiment。`,
      answers: {
        mid: `<strong>5 步</strong>:① <strong>Hypothesis</strong>（"If X then Y because Z"）；② <strong>Traffic split + sample size</strong>（calculate via power analysis）；③ <strong>Duration</strong>（typical 1-4 weeks 跨业务 cycle）；④ <strong>Guardrail metrics</strong>（防别处 regress）；⑤ <strong>Significance + practical effect</strong>。`,
        senior: `<strong>详细 design checklist</strong>:<br>1. <strong>Clear hypothesis</strong>: "If we change CTA color from blue to green, conversion will improve by 5% because color affects attention"<br>2. <strong>Primary metric</strong>: conversion rate (NSM-aligned)<br>3. <strong>Guardrail metrics</strong>: <br>· Revenue per user (防 cannibalization)<br>· Retention (防 short-term boost long-term loss)<br>· Engineering health (latency / error rate)<br>4. <strong>Sample size calculation</strong>:<br>· Baseline conversion 10%<br>· MDE (Minimum Detectable Effect) 5% relative<br>· Statistical power 80%<br>· Significance level 95%<br>· → ~30k users per group<br>5. <strong>Duration</strong>: 至少 2 weeks (full business cycle)<br>6. <strong>Run + analyze</strong>: t-test / chi-square / Bayesian<br>7. <strong>Practical significance</strong>: p &lt; 0.05 但 effect size 0.1%？ship or not 看 cost`,
        staff: `深一层：A/B 设计最容易错的 4 个点:<br><br>1. <strong>Sample size 太小</strong>—— Power 不够 → 真 effect 测不出来（false negative）<br>· 真实情况: 团队跑 1 周 1000 user，"<strong>没 significant difference</strong>"→ 实际可能是 5% improvement 但 sample 不够<br><br>2. <strong>太多 metric</strong>—— 同时看 20 metric 必有 1 个"significant"（multiple comparison）<br>· 解: 预先 declare 1 primary + 3-5 guardrails，不 fishing<br><br>3. <strong>过早 stop</strong>—— 1 周看到 significant 就 stop → 实际 noise<br>· 解: pre-commit duration + 不 peek<br><br>4. <strong>Practical vs Statistical significance</strong>—— p &lt; 0.001 但 lift 0.1% → not worth ship<br>· 解: 预先 declare MDE，effect &lt; MDE 不 ship<br><br><strong>真实案例</strong>: platform agent UI 改进 A/B:<br>· Hypothesis: "If we add wizard onboarding, customer activation rate +20%"<br>· Primary: D7 activation rate<br>· Guardrails: D30 retention / customer satisfaction / support ticket<br>· Sample size: 10k user / variant (calculation given baseline 30% MDE 20% relative)<br>· Duration: 4 weeks<br>· Result: <br>· Treatment: 35% activation vs Control 30% → 17% lift, p &lt; 0.01<br>· Guardrail: D30 retention same，customer satisfaction +5，support ticket -10%<br>· → Ship<br><br><strong>失败的 A/B 案例</strong>:<br>· Hypothesis: "Better doc reduces support ticket"<br>· Sample: 500 customer<br>· Duration: 1 week<br>· Result: ticket -10% but p = 0.15 (not significant)<br>· Team push to ship anyway → 3 month later actually no change (was noise)<br><br>教训: 不 ship marginal A/B（"<strong>p &lt; 0.05 但 actually noise</strong>"）。<br><br><strong>陷阱</strong>:<br>① Sample size 太小<br>② 过早 stop<br>③ 太多 metric (multiple comparison)<br>④ Cherry-pick segment ("整 group 不 significant 但 mobile user significant"—— 找细分群是 fishing)<br>⑤ A/A test 没做 (validate platform 本身没 bias)<br>⑥ Network effect 忽略 (social product 用户互相影响 break independence)<br><br><strong>关键</strong>: ① Pre-commit hypothesis + metrics + duration；② Calculate sample size；③ Multiple comparison correction；④ A/A test validate；⑤ Long-term follow-up post-ship。`,
      },
      failure_modes: [
        `Sample size 太小 → false negative`,
        `过早 stop → noise misinterpreted`,
        `太多 metric → multiple comparison`,
        `Cherry-pick segment fishing`,
        `Network effect 忽略 break independence`,
      ],
      follow_ups: [
        { q: `Sample size 怎么 calculate？`, hint: `① 工具: Optimizely / VWO calculator / G*Power；② Inputs: baseline rate / MDE / power (80%) / significance (95%)；③ 通常 1k-100k per group；④ Tradeoff: smaller MDE → larger sample` },
        { q: `Multiple comparison 怎么 correct？`, hint: `① Bonferroni correction (α / # comparisons)—— conservative；② Benjamini-Hochberg FDR—— less conservative；③ Pre-commit primary metric 减 comparisons` },
        { q: `Bayesian A/B 跟 frequentist 区别？`, hint: `① Frequentist: p-value / significance threshold；② Bayesian: posterior probability ("70% chance B is better than A by X")；③ Bayesian 更易解释 + can stop early；④ 现代主流大公司多用 Bayesian` },
      ],
    },

    76: {
      why_asked: `LTV/CAC 是 PdM 商业题。能讲"3x healthy + 18 month payback + unit economics"的人 senior+。`,
      answers: {
        mid: `<strong>LTV / CAC &gt; 3</strong> healthy。<strong>Payback period &lt; 18 month</strong> ideal (SaaS)。<br>· <strong>LTV</strong>: Customer Lifetime Value—— customer total revenue<br>· <strong>CAC</strong>: Customer Acquisition Cost—— sales + marketing per new customer`,
        senior: `<strong>完整 unit economics</strong>:<br>· <strong>ARPU</strong> (Average Revenue Per User) per month<br>· <strong>Gross Margin %</strong> (after COGS)<br>· <strong>Churn %</strong> per month<br>· <strong>LTV = ARPU × Gross Margin / Monthly Churn</strong><br>· <strong>CAC</strong>: total S&M cost / # new customers<br>· <strong>LTV/CAC ratio</strong>: 3+ healthy, &lt; 1 burning money, &gt; 5 可能 under-investing<br>· <strong>Payback</strong>: CAC / (ARPU × Gross Margin) ≤ 18 month<br><br><strong>典型范围</strong>:<br>· SaaS: LTV/CAC 3-5, payback 12-18 月<br>· Consumer subscription: LTV/CAC 2-4, payback 6-12 月<br>· Marketplace: payback &lt; 6 month`,
        staff: `深一层：LTV/CAC 是<strong>business viability 的 north star</strong>—— PM 必须懂，但<strong>很多 PdM 只关注 product metric 不关注 business model</strong>。Senior PdM 必须 fluent。<br><br><strong>实战陷阱</strong>:<br>1. <strong>LTV 太乐观</strong>: 假设 customer 用 5 年 → LTV 5×ARPU. 实际 churn 20%/yr → 真 lifetime 3 year not 5<br>2. <strong>CAC 不算 fully loaded</strong>: 只算 ads 不算 sales 工资 + customer success<br>3. <strong>Gross Margin 不算 COGS</strong>: hosting + support + payment processing = 真 GM 60-70% not 100%<br>4. <strong>Cohort 差异忽略</strong>: 不同 channel / segment LTV/CAC 完全不同<br><br><strong>真实案例</strong>: platform agent SaaS pricing analysis:<br>· ARPU: $10k/year / customer<br>· Gross Margin: 75% (hosting + support cost)<br>· Monthly Churn: 0.5% (annual churn 6%)<br>· LTV = $10k × 75% / 0.5% / 12 = $125k<br>· CAC: total S&M $1M / 50 new customer/yr = $20k<br>· LTV/CAC = 6.25 (healthy)<br>· Payback = $20k / ($10k × 75%) = 2.7 month (excellent)<br>· → unit economics 健康，可以 scale sales spend<br><br>但 segment 分:<br>· SMB customer: ARPU $5k, churn 1%/月, CAC $10k → LTV $37.5k, LTV/CAC 3.75 (OK)<br>· Enterprise customer: ARPU $50k, churn 0.2%/月, CAC $50k → LTV $1.5M, LTV/CAC 30 (amazing)<br><br>Action: focus sales on enterprise (much better unit economics)。<br><br><strong>陷阱</strong>:<br>① <strong>LTV 太乐观</strong>（假设 perpetual customer）<br>② <strong>CAC 不 fully loaded</strong><br>③ <strong>Gross Margin 不算</strong><br>④ <strong>Cohort / segment 不分</strong><br>⑤ <strong>Pre-revenue / early stage 用 LTV/CAC</strong>—— 数据不够 noisy<br>⑥ <strong>LTV/CAC 高就 over-spend</strong>—— 8 跟 3 都健康，但 8 时 over-investing 可能合理（grow faster）<br><br><strong>关键</strong>: ① Fully loaded CAC + realistic LTV；② Segment analysis；③ Quarterly track trend；④ 不 over-index on absolute ratio (3+ healthy)；⑤ Tied to retention curve analysis。`,
      },
      failure_modes: [
        `LTV 太乐观（perpetual customer）`,
        `CAC 不 fully loaded`,
        `Gross Margin 不算`,
        `Cohort / segment 不分`,
        `Early stage 数据不够还硬算`,
      ],
      follow_ups: [
        { q: `Negative LTV/CAC 怎么办？`, hint: `① 危险 sign—— burning money per customer；② Investigate: too cheap pricing or too expensive acquisition；③ Cut S&M spend OR raise price；④ Consider segment focus (some segments may have positive LTV/CAC)` },
        { q: `LTV 怎么 calibrate？`, hint: `① Don't extrapolate from short period (1-month churn → 5-yr LTV)；② Use cohort retention curve；③ Discount future revenue (10% discount rate)；④ Conservative—— "expected" LTV not "best case"` },
        { q: `B2B 跟 B2C unit economics 差异？`, hint: `① B2B: higher ARPU (10x-100x)；② B2B: longer payback (12-24 month)；③ B2B: lower churn (5-10%/yr vs 30-50% B2C)；④ B2B: enterprise sales motion (longer cycle but stickier)` },
      ],
    },

    // ============== Case / Estimation ==============
    92: {
      why_asked: `TAM/SAM/SOM 是 PdM / strategy 必考。能讲"3 层 + top-down/bottom-up 双向 + sanity check"的人是真做过 business plan。`,
      answers: {
        mid: `<strong>3 层市场</strong>:① <strong>TAM</strong> (Total Addressable Market)—— 全球 total demand；② <strong>SAM</strong> (Serviceable Addressable Market)—— 你能 serve 的部分；③ <strong>SOM</strong> (Serviceable Obtainable Market)—— 实际可获得 (typically 1-10% of SAM)。`,
        senior: `<strong>计算 + sanity check</strong>:<br>1. <strong>TAM</strong>: <br>· Top-down: industry report / IDC / Gartner<br>· Bottom-up: # potential customer × ARPU<br>· 两者对比 → 一致量级 OK<br>2. <strong>SAM</strong>: TAM × % geo / channel / segment you can serve<br>3. <strong>SOM</strong>: SAM × realistic market share (typically 1-10% for new entrant, 20-40% for leader)<br><br><strong>典型 example (platform agent SaaS)</strong>:<br>· TAM: 全球 enterprise RPC demand $5B/yr (Gartner)<br>· SAM: 北美 + EU + APAC primary segment = $2B/yr<br>· SOM: 5-year target 5% share = $100M ARR<br>· Year 1 SOM: 0.5% = $10M ARR (realistic startup)`,
        staff: `深一层：TAM/SAM/SOM 的<strong>真实使用 case</strong>:<br>1. <strong>Investor pitch</strong>: VC 要 TAM &gt; $1B 才看<br>2. <strong>Product strategy</strong>: 选大市场 invest，避免小市场 stuck<br>3. <strong>Sales team sizing</strong>: SAM determine sales team size<br>4. <strong>Competition analysis</strong>: TAM 大 → 多 player；TAM 小 → likely consolidation<br><br><strong>实战 mistakes</strong>:<br>1. <strong>TAM inflate</strong>: "全球 software market $X 亿"—— 太宽，VC reject<br>· 正确: narrow to specific segment "RPC management software for infrastructure"<br>2. <strong>SAM = TAM</strong>: 没 serve constraint (geo / industry / pricing)—— unrealistic<br>3. <strong>SOM 过乐观</strong>: 假设 50% market share—— 现实 1-10% 起步<br>4. <strong>不 sanity check</strong>: top-down $1B 但 bottom-up $100M → flag<br><br><strong>真实案例</strong>: 我作为 PM 给 VP 做 platform agent expansion proposal:<br>· <strong>TAM</strong>: infrastructure network mgmt software $5B/yr (Gartner 2024)<br>· <strong>SAM</strong>: protocol-based $2B (60% of telco moving to RPC)<br>· <strong>SOM Year 1-3</strong>: existing 8 enterprise customer + 20 new = $50M ARR (1% SAM)<br>· <strong>SOM Year 5</strong>: 5% SAM = $100M ARR (aggressive but reachable)<br><br>Bottom-up validation:<br>· 100 target enterprise × $500k ARR each = $50M (matches Year 1-3 SOM)<br>· Sanity check pass<br><br>VP approve expansion plan。<br><br><strong>反例</strong>: 早期 startup pitch:<br>· TAM: "全球 cloud software $500B" (太宽)<br>· SAM: $50B (still too broad)<br>· SOM: "10% in 3 years" = $5B (delusional)<br>· VC reject "<strong>not credible</strong>"<br><br><strong>陷阱</strong>:<br>① TAM 太宽（"software market"）<br>② SAM 没 serve constraint<br>③ SOM 过乐观（&gt; 10% new entrant）<br>④ 不 top-down + bottom-up cross-validate<br>⑤ Static analysis（市场 dynamic, 5 年 TAM 可能翻倍）<br>⑥ Ignore competition share (SOM 不能算 100% market 都你的)<br><br><strong>关键</strong>: ① Narrow specific TAM；② Realistic SAM constraint；③ Conservative SOM；④ Cross-validate top-down + bottom-up；⑤ 5-year trajectory not single year。`,
      },
      failure_modes: [
        `TAM 太宽（"software market"）`,
        `SAM 没 serve constraint`,
        `SOM 过乐观 (&gt; 10% new entrant)`,
        `不 cross-validate top-down + bottom-up`,
        `Static analysis 不考虑 market dynamic`,
      ],
      follow_ups: [
        { q: `TAM 怎么 estimate without industry report？`, hint: `① Bottom-up: # potential customer × ARPU；② Top-down via proxy (% GDP / industry size)；③ Compare to similar markets (analogous);  ④ Multiple methods triangulate` },
        { q: `早期产品 SOM 怎么定？`, hint: `① 不超 5% new entrant year 1；② Based on sales capacity (1 AE close 5-10 deal/year)；③ Bottom-up: target account list (top 20 prospect)；④ 不 over-promise to VP / board` },
        { q: `Market 不存在的 product 怎么 TAM？`, hint: `① Adjacent market substitute analysis；② Bottom-up: pain point quantify × # affected users × WTP；③ Survey willingness-to-pay (Mom Test rigorous)；④ Acknowledge uncertainty (TAM range 不 single number)` },
      ],
    },
  },
};

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const slug = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!slug || !ENRICHMENT[slug]) {
    console.error(`Usage: node tools/enrich-cards.mjs <slug> [--dry-run]`);
    console.error(`Available slugs: ${Object.keys(ENRICHMENT).join(', ')}`);
    process.exit(1);
  }
  const dataPath = join(REPO_ROOT, 'interview', 'data', `${slug}.json`);
  if (!existsSync(dataPath)) {
    console.error(`Data file not found: ${dataPath}`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const enriched = ENRICHMENT[slug];
  const targetIds = new Set(Object.keys(enriched).map(Number));
  let count = 0;
  const missing = new Set(targetIds);
  for (const card of data.cards) {
    const e = enriched[card.id];
    if (!e) continue;
    missing.delete(card.id);
    if (e.why_asked != null) card.why_asked = e.why_asked;
    if (e.answers != null) card.answers = e.answers;
    if (e.failure_modes != null) card.failure_modes = e.failure_modes;
    if (e.follow_ups != null) card.follow_ups = e.follow_ups;
    count++;
  }
  if (missing.size > 0) {
    console.warn(`[enrich] WARNING: ${missing.size} enrichment entries did not match any card id: [${[...missing].join(', ')}]`);
  }
  console.log(`[enrich] ${slug}: enriched ${count} / ${targetIds.size} cards`);
  if (dryRun) {
    console.log(`[enrich] dry-run, not writing.`);
    return;
  }
  writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[enrich] wrote ${dataPath}`);
}

main();
