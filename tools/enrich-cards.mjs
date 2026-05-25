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
        staff: `C4 真正的价值在于<strong>"给对的人画对的图"</strong>，避免"一张图所有人都看不懂"。我在 telecom 团队推 C4 后，PMO sprint review 看 L1，跨团队 architecture council 看 L2，sprint planning 看 L3，新人 onboarding 看 L4——同一系统不同视图减少了 70% 的 "我们说的是同一个东西吗" 类争论。还有 2 个补充层：<strong>System Landscape</strong>（公司全景，比 L1 更高）和 <strong>Dynamic Diagram</strong>（运行时调用序列，覆盖 C4 静态短板）。工具上推荐 <strong>Structurizr DSL</strong>（代码化、可版本化）+ PlantUML 生成图，避免拖图变更不易追溯。`,
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
        staff: `ATAM 完整流程 9 步：介绍 → 业务驱动 → 架构介绍 → 识别架构方法 → 生成 <strong>utility tree</strong> → 分析 → brainstorm scenarios → re-analyze → report。<strong>真实经验</strong>：在车端 telecom 团队做过一次 ATAM，最大收获是 utility tree 把模糊的"系统要可靠"具化成 "ECU 断电恢复后 5s 内重连 + 100% 消息不丢"，从此架构讨论有了量化锚点。Tradeoff 例子：高频遥测数据用 protobuf（高效但难调试）vs JSON（易调试但带宽 3x），最终选 protobuf + 离线 schema 工具链，写了 ADR-007。Lightweight ATAM（1 天版）适合中小团队。`,
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
        staff: `这是 SEI 的 SOSA / QAW (Quality Attribute Workshop) 方法核心。真实价值：① 让产品 / 运维 / 开发对"做到什么程度"达成共识；② 后续 ATAM 评估有依据；③ <strong>直接映射 SLI/SLO</strong>，可观测性平台直接告警。我在 NETCONF agent 项目里推这个格式之后，PRD 阶段就把"高可用"细化成 "Active-Active 集群在 1 节点失效后 RTO ≤ 30s、RPO ≤ 5s"——开发 / SRE / 客户三方都签字，上线后 SLO 对得上。<strong>注意</strong>：场景要覆盖 4 类——normal / growth（高负载）/ stressed（异常）/ failure（故障）。`,
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
        staff: `深一层：三者都试图解决"<strong>业务逻辑被框架/技术污染</strong>"的问题。Cockburn 2005 提 Hexagonal，Palermo 2008 提 Onion 简化它，Uncle Bob 2012 加 4 层 + Dependency Rule 让它更规范化。<strong>真实落地比理论争论更重要</strong>：我在 NETCONF agent 项目里用了一个简化版 Hexagonal——domain 层只依赖 std::*，infra 层（YANG parser / SNMP / Kafka）通过纯虚接口注入，业务测试零外部依赖（mock 接口即可），单测从 12 min 降到 28s。<strong>陷阱</strong>：项目小（&lt;10 人）时分层带来的样板代码可能超过收益，可以从两层（domain + infra）起步。`,
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
        staff: `常见的 fitness function 模式：① <strong>架构依赖检查</strong>（ArchUnit / pyverdep / depcheck，禁止 domain → infra）；② <strong>性能基线</strong>（k6 压测在 CI 跑，P99 退化 &gt; 10% 失败）；③ <strong>API 兼容</strong>（buf breaking 检测 protobuf 破坏性改动）；④ <strong>安全合规</strong>（trivy / snyk 扫依赖漏洞）；⑤ <strong>代码质量</strong>（cyclomatic complexity / test coverage 不许下降）。<strong>真实案例</strong>：在 NETCONF agent 项目我加了 6 个 fitness function 后，半年内拦下了 11 次"图省事"的架构违规 PR（如 domain 直接 include &lt;curl/curl.h&gt;）。<strong>关键</strong>：fitness function 失败的 PR 必须有 reviewer 审批 override，否则会被绕过。`,
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
        staff: `落地工具链：① Facade 层用 nginx / envoy / API gateway；② Feature flag 用 LaunchDarkly / Unleash / 自建；③ 影子流量用 Diffy（Twitter 开源）/ goreplay 录制 + 重放；④ 切流用 weighted routing 5% → 25% → 50% → 100%；⑤ deadline 用 calendar 提醒 + 季度复盘。<strong>真实案例</strong>：在电信网管系统替换老 NETCONF agent 时用了 Strangler，6 个月切流完成，第 7 个月按 deadline 删了 47K LOC 老代码——如果不删，运维要永远维护两套监控/告警/部署脚本。<strong>反例</strong>：见过一个 ERP 项目"strangling" 6 年还没死，新老系统同时活着，bug 修复要 PR 两遍，最后老板砍掉新项目。`,
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
        staff: `深层理解：VO 是<strong>消除 Primitive Obsession 反模式</strong>的核心工具——把 string / int / float 包装成有领域语义的类型。<strong>三大收益</strong>：① 类型安全（金额不能加坐标，编译期就拦下）；② 业务规则封装在构造函数里（Email 构造时验证格式）；③ 不可变 + thread-safe（多线程共享无锁）。<strong>真实案例</strong>：NETCONF agent 项目最初用 std::string 当 NodeId 到处传，三个月后追查一个 bug 发现两个不同语义的 string 被错误地比较；引入 NodeId VO（class NodeId { std::string v; explicit NodeId(std::string); }）后，类型系统直接拦下错误，重构后修了 5 个类似 bug。<strong>C++ 落地</strong>：用 explicit 构造 + delete 默认拷贝 / 用 strong_typedef 库（如 Folly TypedIdentifier）。`,
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
        staff: `Outbox 是 Chris Richardson 在 microservices.io 总结的标准模式，<strong>事实标准</strong>。深一层：Outbox 解决的是 <strong>dual write 问题</strong>（同时写 DB 和 MQ 不能原子）；与之相对的是 <strong>Inbox 模式</strong>（消费端去重）。<strong>实现要点</strong>：① outbox 表带 status / created_at / retry_count；② 用 CDC（Debezium 监听 binlog）比 poller 性能好 10x；③ 消费方必须幂等（用 message_id 去重）；④ 设 max_retry + DLQ。<strong>真实案例</strong>：NETCONF agent 项目里"配置变更后通知下游"用 Outbox + Debezium 实现，2 年内零事件丢失，对比之前直接发 Kafka 的版本（月均 3 次"业务成功但消息没发"事故）。<strong>陷阱</strong>：Outbox 表会变大，要定期清理已发送的（保留 30 天审计）。`,
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
        staff: `<strong>核心价值不在产出物，在"对齐过程"</strong>——往往一次 Big Picture workshop 能让 PM / Dev / Sales 三方第一次发现"我们说的'客户'其实是三个不同的实体"。<strong>关键产出</strong>：红色 sticky（hotspot）—— 团队对业务理解不一致的点。<strong>红色 sticky 才是最有价值的</strong>，比所有事件链都重要。<strong>真实经验</strong>：在电信运营商客户那做了一次 Big Picture（10 人，4h），识别出 23 个红色 hotspot，其中 5 个是 PM 都不知道的业务规则模糊点；后续 sprint 0 阶段先解决 hotspot，避免了开发到一半发现"PRD 不一致"。<strong>注意</strong>：facilitator 不能是开发——会引导成"实现方案讨论"；最好是中立的 BA / 产品 lead。`,
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
        staff: `深一层：三分的判断不是技术属性而是<strong>商业属性</strong>——同一个"用户认证"在身份认证公司是 Core，在电商是 Generic。<strong>常见错误</strong>：技术派觉得"我们自己写更可控"，忽略了机会成本——自研 Generic 域=用 Core 域的工程师做不出竞争力的活。<strong>真实案例</strong>：电信网管系统里，"NETCONF / YANG 配置引擎"是 Core（我们的差异化），"用户认证 / 审计日志"是 Generic（用 Keycloak + ELK），"工单流程"是 Supporting（用低代码工具 Activiti）。<strong>反例</strong>：见过一个 SaaS 团队自研短信网关 + 邮件系统 + 全文搜索（都是 Generic），结果半年后 Core 域的核心算法落后竞品 2 个版本。<strong>实践建议</strong>：每 6 个月做一次"投入审计"——花在 Core / Supporting / Generic 的工程师 ratio 应该接近 60 / 30 / 10。`,
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
        staff: `深一层：Pimpl 解决的是 C++ <strong>compilation firewall</strong> 三大问题——① 改实现不需重编 caller（编译速度）；② 改实现不破坏 ABI（库升级）；③ 头文件 minimal include（减少传染依赖）。<strong>真实案例</strong>：NETCONF agent 项目里 SDK 暴露给上百个客户端，所有 public class 强制 Pimpl，过去 3 年我们重构了 4 次内部数据结构，客户零需要重新链接。<strong>变种</strong>：① <strong>fast Pimpl / SBO Pimpl</strong>（小对象内嵌避免堆分配，如 Eric Niebler 的 propagate_const + std::aligned_storage）；② <strong>Bridge Pattern</strong>（多个 Impl 实现，运行时切换）。<strong>反模式</strong>：所有内部 helper class 都 Pimpl（过度设计；只在 ABI 边界用）。<strong>C++20</strong> 可用 module 部分替代，但跨 .so 边界仍需 Pimpl。`,
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
        staff: `<strong>完整设计模式</strong>：<br>1) 公开头文件用纯 C 接口 + opaque handle（隐藏一切 C++ 细节）。<br>2) C++ 实现内部 + extern "C" 入口 catch all 异常（C++ 异常不能跨 C ABI）。<br>3) 跨边界传内存：调用方 alloc / 被调方写入 / 调用方 free；或被调方 alloc + 提供 destroy 函数；<strong>禁止</strong>跨 heap free。<br>4) C++ 调用方可选地用 RAII wrapper 把 C handle 重新包成 C++ 类。<br><br><strong>真实案例</strong>：NETCONF agent SDK 给客户用，最初尝试 C++ ABI 失败（客户 Windows MSVC 用不了我们 GCC 编译的 .so），改成 C ABI 后所有平台都能用：Linux/macOS .so / Windows .dll / Android .so / iOS framework，<strong>同一份 C 头文件，5 种平台都能消费</strong>。<br><br><strong>进阶</strong>：用 <strong>cxx</strong>（Rust 项目）、<strong>SWIG</strong>（多语言绑定）、<strong>nanobind</strong>（Python C++ 绑定）等工具自动生成 C ABI wrapper；Cap'n Proto / FlatBuffers 跨边界传结构化数据。`,
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
        staff: `<strong>完整工具链</strong>：<br>1) <strong>abi-dumper</strong>（生成 ABI 描述 XML，需要 debug 符号）<br>2) <strong>abi-compliance-checker</strong>（人类友好 HTML 报告，按 severity 分级）<br>3) <strong>libabigail abidiff / abipkgdiff</strong>（精确的 ABI 差异，适合 RPM/DEB 包级比对）<br>4) <strong>Red Hat 的 ABI sanity check</strong>（发行版用的工业级方案）<br><br><strong>真实落地</strong>：在 NETCONF agent SDK 项目里，我搭了如下 pipeline：<br>① master 每次 release 跑 abi-dumper 存 baseline.abi 到 Artifactory；<br>② 每个 PR 编出 .so 后跑 <code>abidiff baseline.abi pr.so</code>；<br>③ 任何 break 直接 fail build，并在 PR comment 自动留 HTML 报告链接；<br>④ 真的要 break ABI 必须显式在 commit 加 <code>[BREAKING ABI]</code> 标签 + 同步 bump major 版本 + 写 migration ADR。<br><br>过去 18 个月拦了 7 次"无意 ABI 破坏"PR（4 次加私有成员、2 次改虚函数顺序、1 次改 enum 值）。零生产事故。<strong>陷阱</strong>：① abidiff 需要带 debug 符号（-g），release build 要单独跑或保留 symbol；② 模板代码的 ABI 检测精度有限（实例化在 caller 端发生）；③ inline 函数的破坏检测不全（建议结合 ABI 监管 + Pimpl 物理隔离）。`,
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
        staff: `Daniel Abadi 2010 年提出，<strong>修正 CAP 的工程化缺陷</strong>——CAP 让人误以为"非分区时不用做选择"，但实际上同步复制就是要等待，跨地域强一致就是慢。<strong>真实案例</strong>：NETCONF agent 在跨地域电信场景做了 PACELC 选型：① 核心配置仓库 PC/EC（强一致优先，延迟敏感度低）→ 用 etcd；② 设备遥测数据 PA/EL（高吞吐 + 低延迟）→ 用 Kafka + 最终一致；③ 同一系统，<strong>不同子域不同选型</strong>。<strong>更进一步</strong>：① 客户端能选 consistency level（如 Cassandra 的 read/write CL）；② 同一 key 在不同时刻可选不同 CL（写时 QUORUM，读时 ONE，性能 ×2）；③ Anti-entropy 后台同步修正 EL 系统的不一致。<strong>注意</strong>：PACELC 仍然简化——真实系统还要考虑 partial network partition、读写分别的一致性、写多 leader 等。`,
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
        staff: `更深层：<strong>Cache-Aside + 删除策略仍有罕见不一致窗口</strong>——A 读 miss → load 老值；B 更 DB + 删缓存；A 把老值写回缓存 → 缓存又老了。概率很低（要求 A 的 read-from-DB 比 B 的 DB-commit+del-cache 还慢），但金融场景可能感知。<strong>更稳的方案</strong>：① <strong>Read-Through + Write-Through</strong>（缓存层接管所有读写，应用不直接操作 DB）；② <strong>Write-Behind</strong>（写缓存立即返回，异步写 DB，性能好但有丢数据风险）；③ <strong>CDC + 失效</strong>（Debezium 监听 binlog → 异步删缓存，应用零负担）。<strong>真实案例</strong>：电信运营商系统里有"用户套餐"表缓存到 Redis（TTL 30 min），早期用 Cache-Aside 手动删，发现月均 5-10 起客户投诉"我刚改完套餐还是老的"，原因是 service A 改 DB 后还没来得及删缓存 service B 已经读到老值。引入 Debezium → Kafka → cache-invalidator 消费者后，缓存延迟稳定 &lt; 500ms 内一致，投诉归零。<strong>陷阱</strong>：① TTL 不能完全替代主动失效（用户感知 TTL 时长）；② 删失败要重试（DLQ）；③ 批量更新触发"惊群"——大量 key 同时失效。`,
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
        staff: `深层工程实践：<br><strong>1. OpenTelemetry</strong> 是事实标准（OTLP 协议、SDK 多语言、resource semantic conventions）；2024 年起 OTel 也吸收 profiling（pprof 格式）。<br><strong>2. 后端选型</strong>：① Tempo (Grafana) / Jaeger 存 traces；② Prometheus / VictoriaMetrics / Mimir 存 metrics；③ Loki / Elasticsearch 存 logs；④ Pyroscope / Parca / Grafana Phlare 存 profiles。<br><strong>3. 关键设计</strong>：① 所有信号带 trace_id 实现 correlation；② Tail sampling 保留有价值 trace（错误 + 慢请求 100%，其他 1%）；③ High-cardinality metrics 谨慎用（exemplars 替代）；④ Continuous Profiling 默认开（开销 &lt; 1% CPU）。<br><br><strong>真实案例</strong>：电信网管系统 OTel 栈：Java/C++ agent → OTel Collector → Tempo + Prometheus + Loki + Pyroscope，统一在 Grafana 展示。一次 P99 飙升事件链路：① Prom alert 触发 → ② Grafana 看 traces 找到某 endpoint 慢 → ③ 点 trace 看到 NETCONF parse 慢 → ④ 跳 Pyroscope CPU profile 看到 XPath 查询占了 60% CPU → ⑤ 改代码用预编译 XPath，30 min 定位 + 修复。<strong>没有 profiling 的话</strong>这一步要靠人 SSH 上机器跑 perf record，事故修复时间至少 ×3。`,
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
  },

  em: {
    // ============== 转型 ==============
    1: {
      why_asked: `面试 EM 的<strong>开场必问题</strong>，验证 motivation。能区分"推/拉/准备"三层结构的人通常想过自己为什么转型，而不是被动跟风。这道题答得好，整个面试基调就立住了。`,
      answers: {
        mid: `三层结构（推 / 拉 / 准备）：<strong>推</strong>——作为 IC 发现"个人产出"天花板，10 人团队的 leverage = 10× 单人；<strong>拉</strong>——在 Tech Lead 阶段发现自己更享受"团队 / 流程"问题，享受帮人成长；<strong>准备</strong>——过去半年带 mentee / 主导 onboarding / 读过 EM 经典书。`,
        senior: `比"想转 EM"更有说服力的是<strong>"我在做 IC 时已经在做 EM 的工作"</strong>：mentor 2 个 junior 一年 / 主持团队的 sprint planning / 设计了 oncall rotation / 跨团队推动了某个共识。<strong>红旗答法</strong>："不想写代码了" / "想要 title" / "想管人"——EM 不是 IC 的"下一级"，是平行轨道，混淆这个信号说明候选人不理解角色。`,
        staff: `更深一层：能讲<strong>"我考虑过放弃 EM 路"的情景</strong>——比如做了 6 个月 Tech Lead 后认真想过 IC track，最后选择 EM 是因为发现自己在解决"系统级问题"（沟通 / 流程 / 招聘）时更有杠杆和成就感。<strong>真实经验</strong>：我在 NETCONF 团队从 senior dev 转 lead 时，前 3 个月还在写代码（每周 50%+），后来意识到团队 5 人时我"代码贡献"+"被打断频次"开始负反馈——同样 1h 我做 review + 1on1 比写代码价值高 10×。这个量化体验让我确认 EM 是对的方向。<strong>对面试官</strong>：还要展现你<strong>清楚 EM 工作的非光鲜面</strong>——比如裁员谈话、低绩效辅导、跨部门扯皮——能讲出"我准备好面对这些"的人是真做过功课。`,
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
        staff: `深一层：<strong>Loop 设计的真问题是"我们要 hire for what？"</strong>。Hiring Manager 必须事先写一份 <strong>Job Scorecard</strong>（不是 JD），包含：① 6-month / 1-year 期待 outcome；② 关键 competencies（5-7 个）；③ Anti-attributes（什么样的人 not hire）。<strong>然后</strong>把 competency 映射到 interview rounds（如 "ownership" 测在 behavioral / "system design depth" 测在 SD round）。<strong>真实经验</strong>：在做 senior C++ engineer 招聘时，Job Scorecard 列了 7 个 competencies：技术深度（C++/系统）/ 系统设计 / 调试能力 / 跨团队协作 / mentorship / 业务感 / learning agility。Loop 设计：① Coding（C++ + 算法）→ 技术深度 + 代码质量；② System design（设计 NETCONF 服务）→ 系统设计 + 业务感；③ Debug round（给一段问题代码让候选人找 bug）→ 调试能力；④ Behavioral（mentor / cross-team）→ 协作 + mentorship；⑤ HM round → learning agility + 总体 cultural fit。<strong>结果</strong>：6 个月 hire 4 人，全部 1-year retention，都达 / 超 expectation。<strong>陷阱</strong>：① Loop 太长（&gt; 6 轮）→ 候选人 fatigue / 退出 ratio 飙；② 同一个 competency 多轮重复测（浪费 round）；③ 没 calibration 直接面试（不同 interviewer 评分飘）；④ 用 brainteaser puzzle（Google 早期反思过，没预测效果）。`,
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
        staff: `深一层：debrief 是<strong>整个 loop 中最容易出 bias 的环节</strong>——决策从"个体评价"转成"集体决策"，受声大者 / senior / hiring manager 偏好严重影响。<strong>反 bias 实践</strong>：① <strong>Written first</strong>（每人面完 24h 内独立写 + submit，他人看不到）；② <strong>Round-robin 发言顺序</strong>（最 junior interviewer 先讲，避免被 senior 锚定）；③ <strong>明确 Strong / No / Strong-No 的 evidence 要求</strong>（"strong yes" 必须有 specific 例子，不能 gut feel）。<br><br><strong>真实经验</strong>：在 NETCONF 团队招 senior 时一次 debrief 出现 2:2 split（2 强 yes / 2 弱 no）。我做 HM：<br>① 先让 2 个 no 讲 evidence —— 一个是"他不熟 Boost.Asio"（不是 dealbreaker，可以学），另一个是"他在 system design 没 push back 我的假设"（confirmation bias risk）；<br>② 让 2 个 yes 讲 —— 都有具体例子说明候选人 ownership + learning agility 强；<br>③ 我决定 hire，但写了 ADR 解释为什么 override the no（"Boost.Asio gap 在 onboarding 6 周内可补，候选人 fundamentals 强 + cultural fit 好"）；<br>④ 6 个月后 retro：候选人确实补上了 gap + 进入 high performer，证明决策正确。<br><br><strong>陷阱</strong>：① 没 written feedback → 会场记忆主导，details lost；② "consensus or no hire" 死板规则 → 永远 hire 不到 boundary 候选人（其实 boundary 才是 most learning）；③ HM bias：自己面过的轮重过其他人；④ 不写 decision rationale → 半年后 mishire 复盘没线索。`,
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
        staff: `深一层：calibration 的<strong>真实价值不在调分</strong>，而在 ① 跨 team <strong>建立共同语言</strong>（"L5 Senior 应该是什么样"）；② <strong>暴露 bias</strong>（某 EM 长期给某类员工高 / 低分）；③ <strong>为 promotion case 蓄势</strong>（高潜员工被 senior leaders 看见，下个周期 promo 阻力小）。<br><br><strong>真实经验</strong>：在 telecom 团队第一次 calibration（4 个 EM 共 30 人）时：<br>① 我准备了我 8 人团队的 ratings + 2-paragraph 每人 evidence；<br>② 会上发现我给的 ratings histogram 比其他 EM 高 0.5（typical new EM bias）→ 校准下来 2 人 rating 调低；<br>③ 另一 EM 给一个 senior eng 评 "needs improvement"，我和另一 EM 提出 evidence 不足 → 调成 "meets expectation" + 标 promo block；<br>④ 整个过程 3 小时，所有 EM 学到怎么写 evidence；<br>⑤ 后续 review delivery 时，员工被 calibrate 后的 rating 不 surprise（因为我们提前 ongoing feedback）。<br><br><strong>陷阱</strong>：① 没 evidence 就调分 → 不公平 / 不可申诉；② 调分后 EM 不会 deliver（"我本来给你 5，calibration 调成 4"）→ 暴露 internal process / 损害 trust；③ 用 forced ranking（强制 1-2-7 distribution）→ 团队恶性竞争 / sandbag；④ 不让 ICs 看 calibration process → 觉得"黑箱"。<br><br><strong>实践建议</strong>：① calibration 之前一个月做 dry run（self-calibration）；② 高潜要让 senior leaders 知道（在 calibration 上下文）；③ 调分必有 evidence 修订（不只是"committee 决定"）；④ Calibration session 的结论是 sticky（不要会后又个别 EM 私下改）。`,
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
        staff: `深一层：<strong>EM 在事故中的 leverage 远大于一个 IC</strong>——你扛住 leadership noise = 让 5 个 engineer 多 50% productivity。但<strong>很多新 EM 不知道这点</strong>，倾向跳进去帮 debug（"我还会写"），结果团队没人协调 → 事故拖长 + leadership 失控。<br><br><strong>真实经验</strong>：电信项目曾遇过 P0 事故（核心 NETCONF agent crash loop 影响 2000+ 设备）：<br>① <strong>0-5 min</strong>：oncall declared P0，我作为 EM 加入 Slack channel；<br>② <strong>5-15 min</strong>：拉 senior SRE 进来当 incident commander，我转作 communicator 给 VP 发了首条 status；<br>③ <strong>15-90 min</strong>：每 20 min update VP / 客户 / product；挡住一个高管 "how soon" 噪音（让 incident commander 专注）；coordinate 拉 senior engineer 从其他时区起床加入；<br>④ <strong>90-180 min</strong>：team identified rollback safe + 2 senior 准备 forward fix。<strong>我做了 rollback decision</strong>（balance forward fix 风险 vs rollback 时长）—— rollback；<br>⑤ <strong>180-240 min</strong>：service recover，monitor 30 min 确认 stable；<br>⑥ <strong>240+</strong>：postmortem 周一组织，期间 oncall engineer 周末休息（我把 routine task 给其他人 cover）。<br><br><strong>结果</strong>：4h MTTR，VP 满意 communication 透明，oncall engineer 没 burnout。<br><br><strong>陷阱</strong>：① EM 抢 debug → 没人 communicate → leadership 进 panic mode → call EM 老板 → wider escalation；② Update 间隔太长（&gt; 1h）→ stakeholder 焦虑乘以；③ rollback / forward 决策犹豫 30 min+ → 系统继续坏；④ 事故后不强制 oncall recovery → burnout / quit。<strong>原则</strong>：<strong>"在你的 leverage 处发力，不要 zero-sum compete 团队的 expertise"</strong>。`,
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
        staff: `深一层：crisis communication 的<strong>胜负在初始 1 条 message</strong>——这条决定 leadership 对你的信任。<strong>反模式</strong>：① "We're looking into it"（vacuous）；② "should be fixed soon"（speculation，最 dangerous）；③ Too technical（VP 不理解）。<br><br><strong>真实经验</strong>：电信 P0 事故 4h 期间我给 VP 的 timeline：<br><strong>+5 min</strong>: "P0 declared. NETCONF agent crash affecting 2000+ devices in EMEA region. Team mobilized. Next update in 30 min."<br><strong>+35 min</strong>: "Identified suspected root cause in YANG schema validation. Considering rollback. Customer impact: device config updates blocked since 10:23 UTC. Mitigation ETA: 30-60 min. Next update in 30 min."<br><strong>+95 min</strong>: "Rollback initiated to commit X. ETA to recovery: 15-30 min. Customer impact unchanged. Next update in 15 min."<br><strong>+120 min</strong>: "Recovery confirmed. Monitoring stable for 30 min. Will send formal incident report by EOD."<br><br><strong>关键</strong>：① 每条都有 What / Scope / Status / ETA bracket / Next update；② 不解释 technical detail（VP 不需要）；③ 不归咎个人（不写 "X engineer made mistake"）；④ 不 promise 不能 deliver（不写 "fixed in 15 min" 然后 4h）。<br><br><strong>结果</strong>：VP 信任 communication 流，没 escalate 到 CEO；客户对透明 communication 反馈 positive（"at least we knew what's happening"），客户 retention 没受损。<br><br><strong>陷阱</strong>：① 第一条 update 太迟（&gt; 30 min）→ leadership panic + 自行 escalate；② Speculation（"should be 15 min"）→ 50 min 后没解决 → trust 崩；③ Detail 太多（VP 看不懂 NETCONF / YANG）→ noise；④ 找借口 / blame other team → 立刻 unprofessional；⑤ 解决后不写 formal report → leadership 不知道 closed。`,
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
        staff: `深一层：team burnout 通常是 systemic 不是 individual—— "one person needs rest" 通常意味着<strong>"team's load is unsustainable"</strong>。<strong>EM 的失败是没在 burnout 之前就识别 unsustainable signals</strong>（持续超时 / 高 PR cycle time / PTO 没人 take）。<br><br><strong>真实经验</strong>：电信团队某 quarter 连续 3 个 P0 事故（每个 4-6h），oncall 轮换的 senior dev 第 8 周开始有 burnout 征兆：① 1on1 quieter；② PR comment 多 cynical；③ 主动 take 周末 PTO（之前从不）。<strong>我的处理</strong>：<br>① 1on1 直接谈："我注意到你最近 X / Y / Z，我担心 burnout。你怎么看？"——对方初期 deny ("just busy"), 我 listen 给空间；<br>② 第 2 次 1on1 对方承认 "感觉 endless firefighting，看不到 light"；<br>③ <strong>结构性 fix</strong>：oncall 加 backup secondary（之前只有 primary，secondary 在压力时拒接）；postmortem action items 优先 alert 调优（减 false positive）；告知 product "下个 quarter cut 30% scope until oncall stabilize"；<br>④ <strong>个人 fix</strong>：他 take 2 周连续 PTO（mandatory disconnect，不查 Slack），oncall transfer to 我 backup；<br>⑤ <strong>Meaning reaffirm</strong>：跟他 talk through "你帮稳定了 telecom 客户的核心服务"，并给他参与 oncall 改革的 ownership；<br>⑥ <strong>3 个月 track</strong>：oncall freq 从 3/quarter 降到 0.5/quarter；个人 NPS 回升；keep 在团队。<br><br><strong>陷阱</strong>：① "Take a vacation" 单 fix → 回来 same conditions → burnout 复发；② Public discussion 该 individual 的 burnout → 隐私 / shame；③ EM 不调整团队 workload 期望 → 个人 fix 无效；④ Burnout 等 individual 主动说 → 通常太迟（已 disengage）；⑤ EM 自己也 burnout 但 hide → 不能 model healthy behavior。`,
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
        staff: `深一层：<strong>EM 怎么传递坏消息是被老板 evaluate effectiveness 的主要时刻</strong>——任何人都能传递好消息，handle 坏消息看出 leadership maturity。<strong>常见 anti-patterns</strong>：① 拖延（不愿面对）→ 老板从 grapevine 听到 → 信任崩；② 包装太重（"some challenges, but we're confident"）→ 老板 doesn't trust 后续；③ Pessimism / venting → 老板 doubt EM judgment；④ 没 owned the problem → 老板觉得你不可靠。<br><br><strong>真实经验</strong>：在带 NETCONF 团队时一次 critical project 发现要 miss 6 周 deadline（之前预期 miss 2 周）。我做了：<br>① 周一发现 → 周二中午约 VP 1on1（不 wait 周报 cycle）；<br>② 准备：① 数据（具体 blocker / dependencies / why slip from 2 to 6 weeks）；② 3 options（A: 接受 6 week slip 维持 scope；B: cut 30% scope 保 deadline；C: bring in contractor 1.5x cost 加速）；③ 我的 recommendation（A，因为 cutting scope kills critical feature）；④ Asks（VP 跟 customer success 同步预期 + 同意 contractor 是 backup）；<br>③ 对话本身 15 min：我 5 min 讲完 SCQA，VP 5 min 问 questions，VP 同意 A + back up plan；<br>④ Follow-up：next day 我给 VP 发了 written summary（meeting confirm 用）。<br><br><strong>VP 反馈</strong>："I appreciate you flagging early with options. Many EMs would have hidden this until the last week."<strong>结果</strong>：项目 6 week slip 顺利沟通，customer 没 lose；同时 VP 对我"reliable communicator" trust 增加，下季度给了更大的 scope。<br><br><strong>陷阱</strong>：① 等 weekly report 才说 → 老板 grapevine 先听 → 信任崩；② 没 options，只有 problem → 老板 frustration（"so what do you want me to do?"）；③ Recommendation 不明确 → 老板要花时间 figure out → annoyance；④ No followup written summary → 后续 dispute 没依据。`,
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
