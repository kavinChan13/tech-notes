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

  cpp: {
    // ============== 值类别 / 移动语义 ==============
    51: {
      why_asked: `区分"背过 move 关键字"和"真理解 C++11 内存模型"。能讲清 5 值类别 + 两两组合（glvalue / rvalue）的人通常调过 perfect forwarding 相关的 bug。`,
      answers: {
        mid: `底层 3 种：<strong>lvalue</strong>（有名 / 可取址）、<strong>prvalue</strong>（纯临时，如字面量、返回值）、<strong>xvalue</strong>（将亡值，有身份但资源可被偷，如 <code>std::move(x)</code>）。聚合 2 种：<strong>glvalue</strong> = lvalue ∪ xvalue（有身份的值），<strong>rvalue</strong> = xvalue ∪ prvalue（可被移动的值）。`,
        senior: `<strong>双维度</strong>：① <strong>有无身份</strong>（identity，能否取址 / 跨表达式访问）；② <strong>能否被移动</strong>（moveable，资源可偷）。组合出 4 个理论象限，但 "有身份且不可移动" 就是 lvalue / "无身份且不可移动" 不存在 / "无身份可移动" = prvalue / "有身份可移动" = xvalue。<strong>关键洞察</strong>：<strong>右值引用变量本身是 lvalue</strong>（有名）—— 这是 perfect forwarding 必须用 std::forward 而不是直接传 T&& 的原因。`,
        staff: `深一层：值类别<strong>是表达式属性而非类型属性</strong>——"int x" 的 x 在不同表达式里值类别不同。<strong>C++17 改动</strong>：prvalue 不再"实体化"为临时对象，直到必要时才 materialize → 让 <strong>guaranteed copy elision</strong> 成为标准（之前只是优化）。<strong>实战影响</strong>：① 工厂函数返回不可拷贝/移动的类型可行了（如 <code>std::lock_guard</code>，C++17 前要 trick）；② <code>return T(...)</code> 不再有"应不应该写 move" 的犹豫。<strong>真实经验</strong>：NETCONF agent 项目曾因为不懂 xvalue 和 prvalue 区别，写了 <code>auto v = std::move(GetVec())</code>—— GetVec() 已经是 prvalue（C++17 后 RVO 强制 elision），std::move 反而 disable 了 elision，多了一次 move 构造。看 -ftime-report 才发现性能慢了 8%。修成 <code>auto v = GetVec();</code> 后恢复。`,
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
        staff: `深一层：理解 std::move 的精确语义能避免一类性能 bug。<strong>典型 case</strong>：<br>① <code>auto y = std::move(x);</code>—— 如果 X 类型只有拷贝构造没有移动构造，y 还是<strong>拷贝</strong>得来，x 不变。<br>② <code>const X x; auto y = std::move(x);</code>—— move 后类型是 const X&&，但移动构造形参是 X&&，<strong>const X&& 不能绑 X&&</strong>，编译器退化到拷贝构造（const X& 能绑），<strong>silently 退化</strong>。<br>③ 模板内 <code>T&& x</code> 是万能引用 —— 用 std::move 会把 lvalue 也 force 成 xvalue，调用方原对象可能被偷空（应该用 std::forward）。<br><br><strong>真实经验</strong>：NETCONF 项目有次性能审计发现某 hot path 慢，profile 发现是 <code>const Buffer b = ...; queue.push(std::move(b));</code> —— 因为 const，move 后还是拷贝（10MB Buffer 拷贝 ~3ms × 10k QPS）。改成 mutable Buffer 后恢复。<strong>实用规则</strong>：① 写完 std::move 永远问一次"接收方有移动操作吗 + 我的对象是 const 吗"；② Class 没特殊原因都加 <code>X(X&&) noexcept = default; X&amp; operator=(X&&) noexcept = default;</code>。`,
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
        staff: `深一层：理解 elision 的精确机制能避免几类典型性能 bug。<br><strong>反模式</strong>：<br>① <code>return std::move(local);</code>—— 强制把 prvalue 变 xvalue，<strong>disable RVO</strong>，多一次 move 构造（move 不便宜，复合对象 ~100ns）。<br>② <code>if (x) return A; else return B;</code> 多分支返回不同对象——NRVO 难做，可能退化为 copy / move。<br>③ 返回类型不一致——<code>T f() { U u; return u; }</code> 触发隐式转换 U → T，elision 失败。<br><br><strong>真实经验</strong>：在 NETCONF agent 优化某 hot path 时发现 <code>std::string buildPath() { std::string p = "..."; ... return std::move(p); }</code>—— 当时同事认为"显式 move 更高效"，实际禁用了 NRVO，每次调用多一次 move。改成 <code>return p;</code> 后 -O2 下完全 zero-cost 返回（NRVO 让 p 直接构造在 caller 的栈帧位置）。<br><br><strong>C++17 强制 RVO 的副效应</strong>：现在可以这样写：<code>auto lg = make_lock_guard(mu);</code> 即使 lock_guard 不可移动不可拷贝。之前这种 noncopyable 工厂模式必须用 <code>std::optional</code> 或额外指针。`,
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
        staff: `深一层：这条规则的<strong>设计哲学</strong>—— 如果 T&& x 自身就是 rvalue，那任何用 x 的代码都可能偷它的资源，<strong>第二次访问就是 UB</strong>。把变量本身定义为 lvalue 让代码"<strong>显式同意</strong>"被 move（必须写 std::move）。<br><br><strong>实战影响</strong>：① 移动构造函数体内 <code>T(T&&amp; other) { member = other.member; }</code>—— other 是 lvalue → member 拷贝构造！正确：<code>member = std::move(other.member);</code> 才真移动。② Perfect forwarding 必须用 std::forward 不是 std::move——因为 T&& x 自身是 lvalue，直接传给下层函数会丢失原值类别。③ 万能引用的设计完全依赖此规则。<br><br><strong>真实案例</strong>：NETCONF agent 的 Message 类移动构造写错过：<code>Message(Message&&amp; other) : payload(other.payload) {}</code>—— 这写法<strong>看起来在 move 但实际是 copy</strong>（payload 是 lvalue）。性能审计时发现 message hot path 慢，profile 显示大量 std::vector::vector(const std::vector&)（拷贝构造）。改成 <code>: payload(std::move(other.payload))</code> 后吞吐 +35%。这个 bug 类型在 senior C++ codebase 里很常见，很多人写完 move ctor 没真测过。<strong>对策</strong>：用 <code>= default</code> 让编译器生成（除非必须自定义）。`,
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
        staff: `深一层：ranges 的<strong>设计代价</strong>不小——① 编译时间增加（重模板 + concept），② 错误信息复杂的链可能仍长，③ 标准库实现差异较大（GCC 13+ / Clang 16+ / MSVC 2022 19.30+ 完整支持）。<br><strong>实战建议</strong>：① <strong>新项目</strong>大胆用，提升可读性；② <strong>性能敏感场景</strong>仍用 for 循环（views 链有 abstraction overhead，typical 5-15% 慢，编译器优化后能接近持平但不一定）；③ <strong>调试</strong>：每个 view 单独 piping 出来检查，链式 debug 困难；④ <strong>避免 dangling</strong>—— views 持有 source 的引用，source 析构后 views UB（owning_view C++23 部分缓解）。<br><br><strong>真实案例</strong>：NETCONF agent 用 ranges 处理设备列表 transformation，<strong>代码行数 -40%，可读性 +++</strong>，<strong>但</strong> hot path（百万设备 / 秒）退回手写 for 循环（ranges 版本 -8% 性能）。中等吞吐 + 复杂逻辑场景是 ranges 甜点；hot path 仍是手写 loop。<strong>C++23 增量</strong>：① std::ranges::to&lt;Container&gt;()（从 view 物化到容器）；② 更多视图（chunk / slide / zip / cartesian_product）；③ owning_view 安全持有源。`,
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
        staff: `深一层：C++ 协程是<strong>"library-defined coroutine"</strong>——语言只提供 co_await / co_return / co_yield 关键字 + 编译器机械切分，<strong>所有语义靠用户自定义 promise_type / awaiter</strong>。这是 power but burden：① 标准库不提供 Task&lt;T&gt; / Generator&lt;T&gt;（C++23 加 generator），用户要自己实现或用 cppcoro / Folly / Boost.Cobalt；② 异常 propagation / 取消机制 / 调度器集成都自己设计。<br><br><strong>vs Go goroutine</strong>：① Go 是有栈协程（每 goroutine ~4KB 栈），切换需要保存 / 恢复栈；C++ 无栈协程零栈切换开销但函数边界硬约束（不能在任意函数里 suspend）；② Go runtime 自带调度器，C++ 必须自定义（io_uring / boost.asio / 自写）。<br><br><strong>真实经验</strong>：NETCONF agent 异步 NETCONF RPC 处理：① 之前用 Boost.Asio yield_context（stackful coroutine）—— 写法好但每个 coroutine ~512KB 栈，10k 并发 = 5GB 内存；② 切到 C++20 无栈协程 + cppcoro Task &lt;T&gt;，单 coroutine ~200 bytes frame，10k 并发 ~2MB 内存。<strong>代价</strong>：① 学习曲线陡（promise_type / awaitable 概念）；② 调试支持不完善（gdb 7+ 才有 coroutine print）；③ 编译错误可能很长。<strong>C++23</strong> 加 <code>std::generator</code>，预计 C++26 加 std::execution（Sender/Receiver 模型替代 / 增强协程）。`,
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
        staff: `深一层：CTAD 是 C++17 "<strong>少写模板参数</strong>" 趋势的一部分（auto + structured binding + CTAD）。<strong>陷阱</strong>：① <strong>不能用于成员变量声明</strong>（C++17 只支持局部变量 / new；C++20 起部分场景支持成员）；② 推导可能<strong>意外</strong>（<code>std::pair p{1, "hi"}</code> 推 const char*，不是 std::string）—— 用 deduction guide 修正；③ <strong>聚合初始化</strong>（C++20）跟 CTAD 组合时规则复杂。<br><br><strong>实践</strong>：① <strong>立即可用</strong>：std::vector / std::set / std::lock_guard / std::optional 等标准库类型；② <strong>自定义类型</strong>：模板参数能从 ctor 直接推则不写 deduction guide，复杂场景写；③ <strong>避免过度依赖</strong>—— 显式模板参数有时更可读（特别是接口边界）。<br><br><strong>真实经验</strong>：NETCONF agent 把 200+ 处 <code>std::lock_guard&lt;std::mutex&gt; lg(mu);</code> 改成 <code>std::lock_guard lg(mu);</code>，代码行数减 / 阅读舒适度上升；但 public API 仍保留显式模板参数（type 是接口契约一部分，不让 caller 看到推导结果）。<strong>C++17 vs C++20 增强</strong>：C++20 起聚合初始化也支持 CTAD —— <code>struct Foo { int a; double b; }; Foo f{1, 2.0};</code> 自动推导（之前不可）。`,
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
        staff: `深一层：SFINAE 是 C++ "<strong>偶然</strong>发现"的特性（标准并未明确"为什么这么设计"），是 type trait 库 + tag dispatch + iterator categories 的基础。<strong>SFINAE 的 4 个限制</strong>：① <strong>仅 substitution 阶段</strong>—— 函数体内 / 类内 error 不 SFINAE；② <strong>仅 immediate context</strong>—— template 嵌套时深层失败不 SFINAE（导致"hard error"）；③ <strong>错误信息巨长</strong>（多重 substitution failure 累积）；④ <strong>partial ordering 复杂</strong>—— 多个重载都 SFINAE pass 时谁优先？<br><br><strong>真实经验</strong>：在 NETCONF agent 的 type erasure container 里用了 12 处 SFINAE 检测"是否有 serialize / deserialize 成员"。C++20 升级后改用 concept，代码行数 -40%，错误信息从平均 300 行降到 5 行。<strong>SFINAE vs concept</strong>：① SFINAE 是过程式（"如果代入这个失败，跳过这个候选"），concept 是声明式（"这个类型必须满足这个谓词"）；② 错误质量 concept ≫ SFINAE；③ 性能编译时间 concept ~ SFINAE（取决于复杂度）；④ <strong>新代码全用 concept</strong>，老代码逐步迁移。`,
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
        staff: `深一层：void_t 是 <strong>"忽略一切类型表达式，统一变成 void"</strong>—— 它的<strong>真正作用是触发 SFINAE</strong>（让 decltype 求值失败时整个 template 被丢弃）。<br><br><strong>C++20 替代</strong>：concept + requires 简洁太多：<br><code>template&lt;class T&gt; concept HasSize = requires(T t) { t.size(); };</code><br>等价的 detection idiom 一行写完。<strong>但</strong>老代码 / 跨编译器兼容仍用 void_t。<br><br><strong>实战陷阱</strong>：<br>① <strong>declval 不能用于求值</strong>—— 只能用在 unevaluated context（decltype / sizeof / noexcept 内）；外面用会 link error。<br>② void_t 检测的<strong>是<u>表达式合法性</u>不是行为正确性</strong>—— 有个 size() 函数但返回 string 仍然 has_size = true。要进一步检查可加 <code>std::enable_if_t&lt;std::is_integral_v&lt;decltype(...)&gt;&gt;</code>。<br>③ <strong>嵌套 void_t 多个 decltype</strong> 可以同时检测多个表达式（如要求类型同时有 begin() 和 end()）。<br><br><strong>真实案例</strong>：在 NETCONF agent 实现一个 generic serializer，要检测类型是否有 <code>void serialize(Buffer&)</code> 成员。用 void_t + decltype 写了 3 行 detection idiom，C++14 兼容。C++20 升级后改用 concept HasSerialize，可读性 ↑↑↑。`,
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
        staff: `深一层：shared_ptr 引用计数的<strong>memory order</strong> 优化是 libc++ / libstdc++ 高级技巧：<br>① fetch_add 用 <strong>relaxed</strong>（只是计数 +1，无同步语义）；<br>② fetch_sub 用 <strong>acq_rel</strong>（acquire 看到别人对对象的写，release 同步给最后释放者）；<br>③ 当 fetch_sub 返回 1 时（我是最后一个）→ acquire fence + delete。<br><br><strong>反例</strong>：如果计数 +1 也用 acq_rel，性能下降 ~30%（acquire 比 relaxed 慢）。Boost.atomic 早期就是因为这个不优化，被批评。<br><br><strong>真实经验</strong>：NETCONF agent 早期用 <code>shared_ptr&lt;Config&gt; config_;</code> 让多线程 reader / writer 共享；reader 直接 <code>auto c = config_;</code>—— 同时有 writer 改 <code>config_ = new_config;</code> 时偶现段错（同一 shared_ptr 变量的多线程读写 race）。改用 <code>std::atomic&lt;std::shared_ptr&lt;Config&gt;&gt; config_;</code>（C++20）后修复，性能 -5%（atomic 操作开销）。<strong>陷阱</strong>：① 写代码时忘了 shared_ptr 不是"完全线程安全"；② <strong>多线程 weak_ptr.lock()</strong> 也涉及计数原子，安全；③ <strong>不能跨进程</strong>共享 shared_ptr（控制块在堆，进程间不共享）；④ <code>std::atomic&lt;std::shared_ptr&gt;</code> 实现 free 但可能内部用 spinlock（Apple Clang 早期实现）—— 性能比想象慢。<strong>替代方案</strong>：① <code>folly::AtomicSharedPtr</code> 性能最好（用 packed pointer）；② Hazard Pointer / RCU 在 hot path。`,
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
        staff: `深一层：false sharing 是<strong>"代码看起来无 race，性能却像有 race"</strong> 的隐藏 bug。<strong>检测困难</strong>：① 看不出来（代码逻辑正确）；② benchmark 才发现性能不对；③ <strong>profiling 工具</strong>能定位：Linux <code>perf c2c</code>（cache-to-cache 流量）/ Intel VTune（HITM Stage）。<br><br><strong>真实经验</strong>：在 NETCONF agent 实现一个 SPSC ring buffer，初版结构 <code>struct Queue { atomic&lt;size_t&gt; head; atomic&lt;size_t&gt; tail; T data[N]; };</code>—— 单线程 baseline 12M ops/s，启 2 线程后只有 1.5M ops/s（producer / consumer 同时活动反而慢 8 倍）。<br><strong>原因</strong>：head 和 tail 在同 cache line → MESI 在 2 个核之间 ping-pong。<br><strong>修正</strong>：<code>struct Queue { alignas(64) atomic&lt;size_t&gt; head; char pad[64]; alignas(64) atomic&lt;size_t&gt; tail; ... };</code>—— 强制两者各占独立 cache line。2 线程性能 → 18M ops/s，提升 12×。<br><br><strong>std::hardware_destructive_interference_size</strong>（C++17）：标准提供的 cache line 大小常量（typical 64，但 M1 上 128）。比 hardcoded 64 更 portable。<strong>反义</strong>：<code>std::hardware_constructive_interference_size</code>—— 同访问的数据应该放在同 cache line（如配对 head + 数据指针），减少 cache miss。<strong>实战建议</strong>：① 性能敏感的多线程数据结构必须考虑 false sharing；② 用 alignas + std::hardware_destructive_interference_size；③ perf c2c 是 Linux 上的最佳工具；④ Apple Silicon M1/M2 cache line 是 128 字节（不是 64），跨平台代码用标准常量。`,
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
        staff: `深一层：shared_mutex 的<strong>替代方案</strong>：<br>① <strong>std::mutex + 复制读快照</strong>：写端拿锁改 + 替换 ptr；读端 atomic load 当前 ptr。读端零开销，<strong>RCU-lite</strong> 模式。<br>② <strong>RW spinlock</strong>（自己实现）：底层用 atomic + compare-exchange，单 op ~10 ns，但只适合<strong>极短临界区</strong>，且竞争激烈时浪费 CPU。<br>③ <strong>RCU (Read-Copy-Update)</strong>：读端 <strong>零开销</strong>（毫秒级 grace period 后回收），适合极高读吞吐；实现复杂，userspace-rcu 库。<br>④ <strong>seqlock</strong>：读端无锁（用版本号检测中途被改）；适合数据小、读频繁；不适合可变长数据。<br><br><strong>真实经验</strong>：NETCONF agent 的"设备配置缓存"早期用 shared_mutex，<strong>1k reader 线程 + 1 writer / 秒</strong>下，profile 显示 shared_mutex.lock_shared 占 12% CPU。改用 <code>std::atomic&lt;std::shared_ptr&lt;Config&gt;&gt;</code> + writer 替换 ptr（RCU-lite）后，reader 端零锁开销，CPU 降到 1%。<strong>判断指南</strong>：<br>① 临界区<strong>纳秒级</strong> → std::mutex（avoid 复杂性）；<br>② <strong>读远多于写 + 临界区微秒级</strong> → shared_mutex；<br>③ <strong>读极多 + 数据可拷贝</strong> → atomic ptr + 写端 RCU-style 替换；<br>④ <strong>读 hot path 极致延迟</strong> → seqlock / Hazard Pointer / RCU。<strong>陷阱</strong>：① shared_mutex 默认<strong>非递归</strong>，writer-then-reader 同一线程 deadlock；② <code>std::shared_lock</code> 和 <code>std::unique_lock</code> 都要 RAII，混用易错；③ 写端饥饿（reader 持续来时 writer 永远拿不到）需要 fair 实现。`,
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
        staff: `深一层：死锁的<strong>4 个必要条件</strong>（Coffman 1971）：互斥 / 持有并等待 / 不剥夺 / 循环等待。<strong>破坏任一即可</strong>—— 实践中通常破坏"循环等待"（按顺序 / 层次）或"持有并等待"（lock-free 或 try_lock with timeout）。<br><br><strong>实战 4 类死锁场景</strong>：<br>① <strong>多 mutex 不同顺序</strong>（最经典）→ scoped_lock / 顺序约定；<br>② <strong>嵌套调用</strong>（A 持锁调 B，B 也想锁）→ 减小临界区，调外部函数前 unlock；<br>③ <strong>RAII + 异常</strong>—— 析构期间锁未释放（应该不会发生，但 mutex impl 有 bug 时可能）；<br>④ <strong>condition variable 误用</strong>—— spurious wakeup 没检查条件 → 拿锁但条件不满足 → 一直持锁等。<br><br><strong>真实经验</strong>：NETCONF agent 早期有一段代码：<code>void Service::reconfigure() { std::lock_guard a(this-&gt;mu); subscriber-&gt;notify(); }</code>—— subscriber-&gt;notify() 回调用户代码，用户代码回调 Service 的另一方法 → reentrant lock → deadlock（std::mutex 非递归）。<strong>修正</strong>：1) 在临界区外调 notify（先拿数据 → unlock → notify）；2) subscriber 持自己锁，独立 lock graph。死锁修复后做了<strong>静态检查</strong>：clang-tidy 的 <code>concurrency-*</code> 系列检查 + 自己写了一个 lock acquisition graph 工具（识别 cycle）。<strong>检测</strong>：① <strong>TSan</strong> 自动检测 lock order inversion；② <strong>HelGrind</strong>（Valgrind）类似；③ <strong>perf trace + ltrace</strong> 记录 lock 序列。<strong>工程建议</strong>：① 写 mutex 时<strong>注释 lock 层次</strong>；② 避免在 callback / virtual / 用户代码内持锁；③ 用 try_lock with timeout 防止永久死锁（超时 abort + log）。`,
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
        staff: `深一层：完整线程池要处理：<br>① <strong>shutdown / drain</strong>：要 atomic stop 标志 + drain 已 submit task；<br>② <strong>worker error</strong>：worker 内 task 抛异常 → packaged_task 自动捕获到 future，但 worker 本身不应该 propagate（继续处理下一个 task）；<br>③ <strong>队列满</strong>：bounded queue + 背压策略（block / reject / discard）；<br>④ <strong>动态 thread count</strong>：根据 load 增减；<br>⑤ <strong>priority</strong>：multi-queue 或 heap。<br><br><strong>真实经验</strong>：NETCONF agent 早期用 <code>std::async</code>（每次启动新 thread），10k 任务 / 秒时 thread 创建 overhead 占 30%。换成线程池后单线程开销 ~5%。后来发现仍不够，引入<strong>分类线程池</strong>：① IO-bound pool（多 thread，高 idle）；② CPU-bound pool（thread = cores）；③ Latency-critical pool（pin to cores + huge page）。<br><br><strong>陷阱</strong>：① <strong>packaged_task 必须传 lambda 可拷贝形式</strong>—— shared_ptr 包一层；② <strong>tuple 完美转发参数</strong>，否则 reference / move 丢失；③ <strong>future 析构</strong>—— async future 析构会阻塞等 task 完成（async 特殊语义），packaged_task 不会；④ <strong>worker 数量</strong>—— CPU-bound = cores；IO-bound = cores × 2-4。<strong>开源参考</strong>：① <code>folly::CPUThreadPoolExecutor</code>（Facebook）；② <code>BS::thread_pool</code>（轻量 header-only）；③ <code>asio::thread_pool</code>。生产推荐 folly / asio，不要自己写。`,
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
        staff: `深一层：实现的<strong>关键正确性陷阱</strong>：<br>① <strong>spurious wakeup</strong>：cv 的 predicate 必须在 lambda 里检查（不能 if + wait）；<br>② <strong>close + drain</strong>：closed 但 queue 还有数据时，pop 应继续返回 data（不能立即 return null）；<br>③ <strong>notify_all on close</strong>：必须 wake all waiters（push 端和 pop 端都可能在等）；<br>④ <strong>双向背压</strong>：not_full 和 not_empty 两个 cv，避免一个 cv 唤醒所有线程（产生惊群效应）；<br>⑤ <strong>异常安全</strong>：T 的拷贝 / 移动可能抛 → push 失败时 queue 状态保持一致。<br><br><strong>性能优化</strong>：<br>① <strong>批量 push / pop</strong>：减少 cv notify 次数（10x 吞吐）；<br>② <strong>无锁 SPSC / MPSC</strong>：单消费者场景用 lock-free ring buffer（10-100x 性能）；<br>③ <strong>分片 queue</strong>：高并发下 1 个 mutex 是瓶颈，分多个 sub-queue + 哈希。<br><br><strong>真实经验</strong>：NETCONF agent 的 event queue 早期用上面这种 BoundedQueue，10k events/s 时 CPU 15%。改用<strong>Disruptor 风格</strong>（ring buffer + sequence + busy-wait）后，100k events/s 时 CPU 仍 15%。但 Disruptor 实现复杂、busy-wait 占核 → 视场景选择。<strong>替代</strong>：moodycamel::ConcurrentQueue（MPMC lock-free）、Boost.Lockfree、folly::MPMCQueue。`,
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
        staff: `深一层：优雅停服的<strong>哲学</strong>是"<strong>让客户端有时间感知 + 已 in-flight 请求安全完成</strong>"，而不是"<strong>立即停</strong>"。<br><br><strong>真实经验</strong>：NETCONF agent 的优雅停服设计：<br>1) <strong>SIGTERM</strong> 到达 → main thread 检测 atomic flag → 进入 draining 状态；<br>2) <strong>HTTP API</strong>：health-check 改返 503（让 load balancer 把流量切走，<strong>这是关键</strong>—— LB 切流 typical 5-10s）；<br>3) <strong>等 15s</strong>（等 LB 完全切走 in-flight 流量）；<br>4) <strong>NETCONF sessions</strong>：发送 close-session 给所有 active session 并等 ack（with 5s timeout）；<br>5) <strong>worker 池</strong>：停止接受新 task，等 drain 完成（30s timeout，超时强 abort）；<br>6) <strong>数据库 / 缓存连接</strong>：commit 未提交事务 + flush；<br>7) <strong>jthread 自动 join</strong>。<br><br><strong>总 timeout</strong>: ~60s（k8s default 30s 不够，调到 120s）。<br><br><strong>陷阱</strong>：① <strong>signal handler async-signal-safe</strong> 限制非常严（只能调一小撮函数，不能 malloc / printf）—— 错误做法直接死锁；② <strong>worker 卡在 IO</strong>：close 后 read/write 触发 EBADF → drain 正常进行；③ <strong>k8s grace period</strong>：terminationGracePeriodSeconds 默认 30s，比应用 shutdown 时间长才有意义；④ <strong>connection draining</strong>：HTTP/1.1 有 Connection: close header；HTTP/2 有 GOAWAY；NETCONF 有 close-session。<strong>C++20 jthread</strong>：自动 RAII join + 提供 stop_token / stop_source 替代手动 atomic flag；推荐新代码用。`,
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
        staff: `深一层：C++ 异常的<strong>"零开销"哲学</strong>有 trade-off：① <strong>二进制 size 增加</strong> 5-15%（eh_frame 元数据）；② <strong>编译时间略增</strong>（生成额外信息）；③ <strong>真抛时不快</strong>（不适合 hot path 控制流）。<br><br><strong>对比方案</strong>：<br>· <strong>error_code（C++03 / Boost.System）</strong>：返回 int / enum，每次 check；编译期可推断，hot path 友好，但代码可读性差；<br>· <strong>std::expected&lt;T, E&gt;（C++23）</strong>：返回值/错误二选一，monadic ops；可读性接近异常，性能跟 error_code；<br>· <strong>std::error_code + std::system_error</strong>：跨 lib 错误码统一；<br>· <strong>Result&lt;T, E&gt; (Rust style)</strong>：编译期强制处理错误。<br><br><strong>实战决策</strong>：<br>① <strong>构造失败 / 资源耗尽</strong> → 异常（无返回值可用）；<br>② <strong>预期错误（如 file not found / parse fail）</strong> → expected / error_code；<br>③ <strong>性能极致路径</strong> → 完全不用异常（noexcept 全部 + error_code）；<br>④ <strong>跨 ABI 边界（C ABI / .so）</strong> → 不用异常（异常不能跨 C ABI）。<br><br><strong>真实经验</strong>：NETCONF agent core 经过 profiling，把 <strong>parse error</strong> 类异常改成 std::expected → throughput +12%（parse error 在合法输入下也偶尔触发，原本异常 1k/s + 100µs each = 100ms/s 浪费）。<strong>真异常路径</strong>（如 OOM / 程序员 bug）保留异常，因为 cold path 无所谓性能。`,
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
        staff: `深一层：Type Erasure 是 C++ 最有用的 idiom 之一，<strong>解决两大问题</strong>：<br>① "<strong>我不想强迫用户类型继承我的基类</strong>"（开源库的常见诉求）；<br>② "<strong>我要存任意符合接口的对象</strong>"（容器场景）。<br><br><strong>典型库</strong>：<br>· <strong>std::function</strong>：擦除 callable 类型（lambda / 函数指针 / functor）；<br>· <strong>std::any</strong>：擦除任意类型（用法跟 void* + dynamic_cast 类似但 type-safe）；<br>· <strong>boost::any</strong> / <strong>boost::variant</strong>；<br>· <strong>folly::Function</strong>（高性能 std::function）。<br><br><strong>SBO (Small Buffer Optimization)</strong>：std::function 内部典型有 24 字节 inline buffer，小 lambda 直接存对象避免堆分配；大 lambda fall back 到 heap。<strong>性能</strong>：① 调用：~5 ns（一次 indirect）；② 构造：&lt; SBO 时 ~10 ns，否则 ~50 ns（堆分配）。<br><br><strong>真实经验</strong>：NETCONF agent 早期回调机制用<strong>纯虚基类继承</strong>，每个 user 类型必须 inherit Callback —— 用户嫌侵入。改用 type erasure 实现 <code>Callback</code>（接受任何有 <code>void operator()(Event)</code> 的类型）后，用户体验好，<strong>代码侵入归零</strong>。<strong>陷阱</strong>：① <strong>性能</strong>：每次调用 indirect call 阻止 inline → hot path 慎用；② <strong>复杂错误</strong>：Concept-Model 模板 instantiation 失败时错误信息长（C++20 concept 缓解）；③ <strong>copy semantics</strong>：要支持拷贝时 Concept 需要 clone() 虚函数；④ <strong>SBO 对齐</strong>：自己写 SBO 容易踩内存对齐的坑（用 std::aligned_storage）。`,
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
        staff: `深一层：SPSC lock-free 的<strong>核心洞察</strong>：单 producer 单 consumer 下，<strong>head 只被 consumer 改，tail 只被 producer 改</strong> → 一个 atomic load + 一个 atomic store + memory order pair 就够了，比 MPMC 简单 10×。<br><br><strong>性能优化</strong>：<br>① <strong>cache 本地副本</strong>：producer 缓存自己看到的 head（避免每次 push 都跨 cache line load）；consumer 缓存 tail。批量操作时大幅减少 cache line ping-pong。<br>② <strong>批量 push / pop</strong>：减少 atomic 操作（10× 吞吐）。<br>③ <strong>spin vs sleep</strong>：consumer 空时 busy-spin（低延迟）vs <code>std::this_thread::yield()</code>（节能）vs <code>pause</code> 指令（CPU hint）。<br><br><strong>真实经验</strong>：NETCONF agent telemetry 数据流用 SPSC，初版上面代码 ~10 ns/op；加 cache 本地 head / tail 副本 ~7 ns；加 batch（一次 push / pop 16 个）~2 ns/op amortized。生产用 batch 版。<br><br><strong>vs Disruptor</strong>：Disruptor 是 SPSC / MPSC 的极致优化（LMAX 提出），用 sequence number + barriers，性能比朴素 SPSC 还快 30%；但实现复杂、调试困难。生产推荐 <strong>moodycamel::ReaderWriterQueue</strong>（header-only SPSC）/ <strong>folly::ProducerConsumerQueue</strong>。<strong>陷阱</strong>：① <strong>N 必须 2 的幂</strong>—— 取模 fast path；② 写 data_[t] 必须<strong>在 tail_.store 之前</strong>（release 保证）；③ <strong>destructor</strong> 需 drain 剩余元素；④ <strong>MPSC / MPMC 完全不同</strong>—— 需要 CAS + sequence number。`,
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
        staff: `深一层：CPU 亲和性是 low-latency 三大支柱之一（另外两个：lock-free + zero-allocation）。<br><br><strong>NUMA 的细节</strong>：<br>① <strong>本地内存</strong>: ~80 ns 访问延迟；<br>② <strong>跨 socket（QPI / UPI）</strong>: ~140 ns（1.7×）；<br>③ <strong>L3 cache hit local</strong>: ~10 ns；<br>④ <strong>L3 cache hit remote</strong>: ~60 ns；<br>⑤ <strong>跨 socket 的 cache coherence</strong>: 极贵（HITM 100+ ns）。<br><br><strong>实战调优 4 步</strong>：<br>1) <code>numactl --hardware</code> 看 NUMA 拓扑；<br>2) 应用启动 <code>numactl --membind=0 --cpunodebind=0 ./app</code> 强制 node 0；<br>3) 多线程：每线程 pin 一个核 + 邻近 NUMA 节点；<br>4) 网卡：<code>set_irq_affinity.sh</code> 把网卡 IRQ 钉到处理它的核。<br><br><strong>真实经验</strong>：NETCONF agent 的低延迟模式下：<br>① 8 核机器，isolcpus 4-7（4 个核保留）；<br>② 主 event loop pin 到核 4；<br>③ 4 个 worker pin 到核 5/6/7 / 4（同 NUMA node）；<br>④ 网卡 IRQ pin 到核 5；<br>⑤ NUMA local alloc。<br>结果：P99 latency 从 850 µs 降到 120 µs（-86%）。<br><br><strong>陷阱</strong>：① pinning 后操作系统不能均衡负载 → 选错核反而慢；② isolcpus 完全阻 kernel scheduling，必须 dedicated workload；③ 容器化（k8s）的 CPU affinity 要 cgroup cpuset 配置；④ NUMA balancer（kernel auto-migration）可能 conflict，需要 disable。<strong>验证工具</strong>：① <code>perf stat -e cache-misses,LLC-load-misses</code>；② <code>numastat</code>；③ <code>turbostat</code> 看每核 CPU freq。`,
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
        staff: `深一层：菱形继承是 C++ 多继承设计的<strong>"原罪"</strong>—— 简化版（Java / Kotlin）选择"<strong>单继承 + 多接口</strong>"完全绕开这个问题。C++ 保留多继承的理由：① mixin（如 std::iostream 同时继承 istream + ostream）；② 历史兼容。<br><br><strong>实战陷阱</strong>：<br>① 虚继承的<strong>构造函数顺序</strong>：最派生类必须显式调用<strong>虚基类构造</strong>（其他基类不能间接调）—— 容易忘；<br>② <strong>vbtable</strong> 跨编译器实现不同（MSVC / Itanium ABI）→ 跨 .so 共享虚继承类型是 ABI 灾难；<br>③ <strong>dynamic_cast 性能</strong>：跨虚继承时 typeid 比较 + 偏移计算，比普通继承慢 10×；<br>④ <strong>EBO（Empty Base Optimization）</strong>：虚继承通常 disable EBO（因 vbptr 占空间）。<br><br><strong>真实经验</strong>：在 NETCONF agent 项目里曾出现过菱形继承（一个 ConfigItem 既继承 Serializable 也继承 Validatable，两者都继承 Loggable）。最初没用虚继承导致 ConfigItem 有两份 Loggable 状态，log 输出乱序。改用<strong>组合替代继承</strong>（ConfigItem has-a Logger 而非 is-a Loggable）后彻底解决。<strong>C++ Core Guidelines C.131 / C.135</strong>：避免菱形继承，优先组合 + concept；只在 mixin 必需时用虚继承。`,
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
        staff: `深一层：理解这些限制能避免一类 C++ 经典 bug：<br>① <strong>"在构造函数里调虚函数"陷阱</strong>：调的是<strong>本类</strong>的版本，<strong>不是派生类</strong>的 override（vptr 还指向本类 vtable）。<strong>Effective C++</strong> 第 9 条经典反模式。<br>② <strong>解决方法</strong>：① "<strong>two-phase initialization</strong>"（构造完成后再 init）；② <strong>CRTP</strong>（Curiously Recurring Template Pattern）静态多态替代；③ 工厂函数 + 后置 init 调用。<br>③ <strong>析构函数应该 virtual</strong>（如果类作为基类用）—— delete derived * via base * 时无虚析构 → UB。<br><br><strong>真实案例</strong>：NETCONF agent 早期有 <code>class Service { Service() { initialize(); } virtual void initialize(); };</code> Derived override initialize 后<strong>不工作</strong>—— 调的是 Service::initialize。改用 <code>Service() { setup(); } void setup(); virtual void initialize();</code> + 用户必须显式 init() 后修复。<br><br><strong>其他限制</strong>：① 模板成员函数也不能 virtual（vtable 大小未知，无法实例化所有版本）；② 不能 virtual + constexpr（C++17 前；C++20 允许 virtual constexpr）。`,
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
        staff: `深一层：理解合成规则能<strong>避免性能陷阱</strong>。<strong>对比</strong>：<br>① <strong>不需要合成</strong>（pure POD）：栈上对象是 zero-cost（不调任何函数）；<br>② <strong>合成</strong>：编译器生成的 ctor body 调用所有需要的初始化，<strong>typically inline 优化掉</strong>。<br>③ <strong>用户自定义</strong>：自己写 <code>X() = default</code> 或 <code>X() {}</code> 也算合成（但<strong>= default 和 {} 的语义差异微妙</strong>—— = default 是 trivial 的话允许，{} 是 user-defined 不 trivial）。<br><br><strong>实战影响</strong>：<br>· <code>struct Foo { int x; };</code> Foo 是 trivial，<code>Foo f;</code> x 未初始化 → 用前 UB；<br>· <code>struct Foo { int x = 0; };</code> 仍 trivial（C++14 后），<code>Foo f;</code> x = 0；<br>· <code>struct Foo { int x; Foo() = default; };</code> 同上（trivial）；<br>· <code>struct Foo { int x; Foo() {} };</code> 不 trivial，但 x 仍未初始化（user-defined ctor 不做隐式初始化）；<br>· <code>struct Foo { int x; Foo() : x(0) {} };</code> x = 0。<br><br><strong>真实经验</strong>：在 NETCONF agent 优化某 hot struct 时发现 <code>struct Msg { int len; };</code> 的 <code>Msg m;</code> 是 zero-cost，<code>Msg m{};</code> 显式 zero-init 也 zero-cost（编译器优化），但 <code>struct Msg { int len; Msg() : len(0) {} };</code> 居然没被 inline 优化掉（GCC 13 -O2），改回 = default 后 inline。<strong>结论</strong>：① POD-like 类型用 default member initializer；② = default 通常 ≥ explicit empty body；③ 容器扩容时编译器倾向 memcpy（trivial）vs 调 copy ctor（user-defined）—— 巨大性能差。`,
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
        staff: `深一层：理解栈帧能<strong>解释多个 C++ 底层现象</strong>：<br>① <strong>RVO/NRVO</strong>：caller 在自己栈帧预留返回值空间 + 传地址给 callee；callee 直接<strong>原地构造</strong>到 caller 空间 → 无 copy；<br>② <strong>移动语义</strong>性能：右值引用是 8 字节指针 → 几乎零成本传递；<br>③ <strong>异常 unwind</strong>：unwind table 记录每个函数的栈帧 layout，runtime 能反向 pop 帧 + 调析构；<br>④ <strong>tail call optimization</strong>：函数<strong>最后一步</strong>是调另一函数 → 复用当前栈帧（不嵌套）；<br>⑤ <strong>frame pointer 省略</strong>（-fomit-frame-pointer）：用 rsp 直接索引，少一次 push rbp，但 backtrace 困难。<br><br><strong>调试时</strong>用 GDB <code>info frame</code> 看栈帧细节；<code>disas /s</code> 看汇编 + 源码对照。<strong>真实经验</strong>：NETCONF agent 一次 release 段错 (-O2)，gdb backtrace 全是 ?? —— 因 -fomit-frame-pointer。重编加 <code>-fno-omit-frame-pointer</code> 后 backtrace 清晰，定位到一个 stack-use-after-return（局部数组 escape 给 worker thread）。`,
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
        staff: `深一层：多态发生需要"<strong>vtable 间接调用</strong>"机制，三个条件缺一不可：<br>① virtual 让<strong>编译器为该函数生成 vtable 槽</strong>；<br>② override 让<strong>派生类 vtable 该槽指向派生版本</strong>；<br>③ 通过基类指针 / 引用调用时<strong>编译器生成 indirect call</strong>（lookup vtable + jump），而<strong>对象调用是 direct call</strong>。<br><br><strong>性能成本</strong>：<br>· 直接调（无 virtual）：1 个 call 指令，&lt; 1 ns；<br>· 虚调用：vtable lookup + indirect call，~ 1-3 ns（cache 命中）/ ~10 ns（miss）；<br>· <strong>devirtualization</strong>：编译器看到<strong>final class</strong> 或<strong>static type 已知</strong>时优化成直接调（-O2 通常做）。<br><br><strong>真实案例</strong>：在 NETCONF agent profile 一段 hot path，发现 90% 时间在 virtual function call。原因：调用方是 vector&lt;Base*&gt; loop，每个 dispatch 都 vtable lookup。<strong>优化</strong>：① 类型已知场景改 static dispatch（template + CRTP）；② 排序 vector by type 后用 branch prediction；③ profile-guided optimization 让编译器学到 hot indirect target。结果性能 +35%。<strong>对比</strong>：① CRTP（静态多态）零开销但模板膨胀；② <code>std::variant + std::visit</code>（C++17 sum type）：编译期分发但代码量大；③ <strong>tagged union + switch</strong>：手动版本，最 verbose 但 cache friendly。`,
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
        staff: `深一层：理解对象布局能解释<strong>多个 C++ 性能 / ABI 现象</strong>：<br>① <strong>EBO</strong>（Empty Base Optimization）：空基类<strong>不占空间</strong>（编译器允许 sizeof base = 0），所以 <code>struct A {}; struct B : A { int x; };</code> sizeof(B) = 4 不是 5；<br>② <strong>vptr 位置</strong>：Itanium ABI 把 vptr 放对象<strong>第一个字段</strong>（reinterpret_cast 后能直接访问）；<br>③ <strong>多继承下 this 调整</strong>：<code>D d; B* b = &amp;d;</code> 时 b 不等于 &d，编译器自动加 offset；调用 B 的虚函数时 thunk 调整 this 回 D；<br>④ <strong>跨 .so</strong>：对象布局是 ABI 一部分 → 改类成员就破坏 ABI（Pimpl 解决）。<br><br><strong>工具</strong>：① <code>clang -Xclang -fdump-record-layouts</code> 看类布局；② godbolt 看汇编中 offset；③ <code>__builtin_offsetof</code> 查成员偏移。<br><br><strong>真实经验</strong>：NETCONF agent 的 hot struct <code>Message { uint64_t id; std::string body; int priority; };</code> sizeof = 56（id 8 + string 32 + priority 4 + padding 12）。<strong>调整顺序</strong> <code>Message { uint64_t id; int priority; std::string body; };</code> sizeof = 48（id 8 + priority 4 + padding 4 + string 32），<strong>每个 Message 省 8 字节</strong>。Hot path 100k QPS 累积省 800KB/s + cache friendly → 性能 +5%。<strong>原则</strong>：成员按 sizeof <strong>从大到小</strong>排列减少 padding。<strong>C++20 [[no_unique_address]]</strong>：让空类型成员不占空间（EBO 的现代替代）。`,
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
        staff: `深一层：LTO 和 PGO 是<strong>正交</strong>的，可<strong>叠加使用</strong>（典型生产配置）。<br><br><strong>LTO + PGO 累计收益</strong>：典型 10-25%（取决于代码风格 / 业务）。<strong>注意</strong>：① <strong>code size</strong> 通常增加（更激进 inline）；② <strong>编译 + 链接时间</strong> ×5-10；③ <strong>调试</strong>难度上升（inline 后 backtrace 难看）。<br><br><strong>BOLT (Binary Optimization and Layout Tool)</strong>：Facebook 工具，<strong>编译后</strong>用 perf 数据重排二进制（hot function 排前面 / cold 排后面 / branch 重排）。<strong>跟 PGO 互补</strong>—— PGO 在编译期优化，BOLT 在链接后再优化。生产典型再加 5-15%。<br><br><strong>真实经验</strong>：NETCONF agent 优化经历：<br>① baseline (-O2): 性能 100%<br>② +LTO: 110%（+10%）<br>③ +PGO: 122%（+11%）<br>④ +BOLT: 135%（+11%）<br>⑤ +CPU pinning + NUMA: 158%（+17%）<br>累计 +58%。<strong>取舍</strong>：① 内部 release 关 LTO 加快迭代；② Production release 全开；③ 调试构建（debug）完全不开（影响 backtrace）。<strong>陷阱</strong>：① PGO workload 不代表生产 → 优化反向；② LTO 暴露 ODR 违反（不同 TU 同名同类型不同定义）→ 编译错或运行 UB；③ BOLT 需要 frame pointer 完整（-fno-omit-frame-pointer）。`,
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
        staff: `深一层：monotonic_buffer_resource 是 C++17 引入的<strong>"零分配请求处理"</strong>核心工具，借鉴自 Andrei Alexandrescu 等 talks。<strong>设计哲学</strong>：① <strong>分配 fast path</strong>：bump pointer，&lt; 5 ns；② <strong>释放是 batch 操作</strong>：整体 reset / destroy；③ <strong>对齐自动处理</strong>（按要求对齐推进指针）。<br><br><strong>vs std::allocator / jemalloc</strong>：<br>· <strong>std::allocator</strong>: 通用，~30-100 ns / allocation，可单独 free<br>· <strong>jemalloc / tcmalloc</strong>: 优化的通用 allocator，~15-50 ns<br>· <strong>monotonic_buffer</strong>: ~5 ns，但只能 batch release<br><strong>适用场景</strong>：① <strong>请求级生命周期</strong>（web server / RPC handler）；② <strong>解析中间对象</strong>（parser tree）；③ <strong>批处理任务</strong>。<br><br><strong>真实经验</strong>：NETCONF agent 每个 NETCONF RPC 包含多个解析步骤（XML / YANG / config diff），<strong>之前用 new/delete</strong>，单 RPC ~80 次 allocation，单 RPC ~50 µs。<br><strong>改造</strong>：① 每个 RPC 处理函数栈上 64KB buffer + monotonic_buffer_resource；② 所有 STL 容器换 pmr 版本；③ string 用 pmr::string；<br><strong>结果</strong>：① RPC 内 allocation 数 ~80 → 1（只 arena 内部偶尔 grow upstream）；② 单 RPC 时延 50 µs → 12 µs（-76%）；③ <strong>P99 抖动</strong>显著降低（allocator 是 P99 主因之一）。<strong>陷阱</strong>：① 容器析构时仍调元素 dtor（不是 0 cost）；② <strong>不能在 arena 销毁后访问</strong>元素；③ pmr 容器跟普通容器不兼容（不同 allocator type）。<strong>替代</strong>：① <strong>fmt::format_to_n</strong> 直接写栈 buffer；② <strong>boost::container::small_vector</strong> 小对象内嵌；③ 自定义 arena（更激进，不走 PMR 抽象层）。`,
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
        staff: `深一层：零分配请求处理是<strong>低延迟编程的圣杯</strong>，但<strong>不是 absolute zero</strong>—— 是"<strong>请求处理路径上不触发 heap allocator</strong>"。Startup 期分配和 OS 调用（如 syscall）不算。<br><br><strong>典型 hot path budget</strong>（HFT / 网络设备）：<br>· P99 latency &lt; 10 µs / order<br>· allocations / request: 0<br>· cache lines touched: &lt; 50<br>· system calls: 0（用户态网络栈如 DPDK）<br><br><strong>真实经验</strong>：NETCONF agent low-latency 模式实施 7 技术：<br>① 启动期 message pool 10k 个 buffer；② 每 RPC monotonic_buffer 64KB；③ string_view 替代 90% string 临时；④ fmt 写响应；⑤ expected 替代 80% 异常路径（保留 catastrophic exception）；⑥ quill 异步日志；⑦ 测试 LD_PRELOAD malloc-counter 验证。<br>结果：P99 from 280 µs → 35 µs（-87%），P99.9 from 1.2 ms → 50 µs。<br><br><strong>陷阱</strong>：① <strong>library 内部仍 alloc</strong>（如某些 OpenSSL 函数）→ 用 perf record 或 mtrace 找；② <strong>std::function captures by value</strong> 可能 heap alloc → 用 small lambda + std::move_only_function；③ <strong>locale / iostream / printf</strong> 都 alloc → fmt + 自定义 stream；④ <strong>thread local storage</strong> 初次访问可能 alloc。<strong>工具</strong>：① <strong>perf record + tools/perf-malloc-hook</strong>；② <strong>jemalloc stats</strong>；③ <strong>heaptrack</strong>；④ <strong>Linux strace -e trace=memory</strong>。<strong>哲学</strong>：① 不要预 optimize（先 profile）；② Hot path 100% 验证；③ Cold path 接受标准分配。`,
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
        staff: `深一层：extern "C" 是 <strong>跨语言互操作的基石</strong>。<strong>常见场景</strong>：<br>① <strong>C++ 库给 C 用</strong>（如 SQLite C API for C++ implementation）<br>② <strong>给 Python / Rust / Go 等语言 binding</strong>（这些语言通常只能通过 C ABI 调）<br>③ <strong>dlsym</strong> / <strong>GetProcAddress</strong> 动态加载需要稳定符号名<br>④ <strong>kernel / driver 接口</strong>（多 C 风格）<br>⑤ <strong>跨编译器 .so 边界</strong>（GCC 编译的库给 MSVC caller）<br><br><strong>跨边界的限制 + 注意</strong>：<br>① <strong>不能传 C++ 类型</strong>（std::string / std::vector / std::map）—— C 看不懂；只能传 C 类型（int / char* / struct）+ opaque pointer<br>② <strong>不能 C++ 异常逃逸</strong>—— C 不能 catch，UB；必须 catch all + 转 error code<br>③ <strong>C++ 类的方法不能 extern "C"</strong>（类成员有 implicit this）—— 必须包 free function：<code>extern "C" void Foo_method(Foo* obj, int arg) { obj-&gt;method(arg); }</code><br>④ <strong>RAII 不跨边界</strong>—— C 调用方不会自动析构，必须 explicit destroy 函数<br>⑤ <strong>calling convention</strong>—— Windows 上要明确 __stdcall / __cdecl<br><br><strong>真实经验</strong>：NETCONF agent SDK 给客户用，需支持 C / C++ / Python / Go binding。设计了纯 C ABI shim：<br>1) Header 全部 <code>extern "C"</code> + opaque handle <code>typedef struct NCAgent NCAgent;</code><br>2) 创建 / 销毁：<code>NCAgent* nc_create(); void nc_destroy(NCAgent*);</code><br>3) 操作：<code>int nc_send_rpc(NCAgent*, const char* rpc_xml, char* response_buf, size_t buf_size);</code><br>4) 异常 catch all：<code>try { ... } catch (const std::exception&amp; e) { strncpy(err_buf, e.what(), n); return -1; }</code><br>5) Python ctypes / Go cgo 直接调即可。<br>结果：单一 C 头文件，5 平台都能用。`,
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
        staff: `深一层：ABI 兼容性是<strong>共享库设计最难的部分</strong>。<strong>语义化版本</strong>规则：① patch（z）：bug fix，ABI 不变；② minor（y）：API 新增，ABI 不变；③ major（x）：ABI 破坏，caller 必须重编。<br><br><strong>工程实践</strong>：<br>① <strong>Pimpl</strong>：public class 只持有 unique_ptr&lt;Impl&gt;，Impl 在 .cpp 里随意改；<br>② <strong>extern "C" 边界</strong>：跨 .so 接口纯 C ABI；<br>③ <strong>inline namespace</strong>：版本化命名空间 <code>namespace lib { inline namespace v1 { class Foo; } }</code>，升级时 v1 → v2 同时保留；<br>④ <strong>visibility 控制</strong>：<code>-fvisibility=hidden</code> + <code>__attribute__((visibility("default")))</code> 标记 public 符号；<br>⑤ <strong>CI 自动 abi check</strong>：abidiff / abi-compliance-checker。<br><br><strong>真实经验</strong>：NETCONF agent SDK 维护 5 年期间通过这套实践 <strong>零 ABI 破坏事故</strong>：<br>1) 所有 public class 强制 Pimpl<br>2) CI 每 PR 跑 abidiff，break 必须 explicit bump major<br>3) inline namespace v1 / v2 / v3 渐进废弃<br>4) extern "C" 边界给 C / Python / Go bindings<br><br>过去某 patch 加私有成员被 abidiff 拦下 + 红色 warning"this PR breaks ABI"，开发同事意识到，改用 Pimpl 内部加成员。<strong>陷阱</strong>：① <strong>头文件改了 inline 函数</strong>—— ABI break 但 abidiff 检测不出（compiler 在 caller 端实例化）；解：visibility hidden + 不 inline boundary；② <strong>template instantiation 跨 .so</strong>—— 每边各自 inst，ODR 风险；③ <strong>std::string SSO size cross-versions</strong>—— Dual ABI libstdc++ 切换会破坏。`,
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
        staff: `深一层：ASan 设计是 Google 2012 年的开源工程，<strong>颠覆性</strong>—— 之前 Valgrind 是 ~50× slowdown，ASan 仅 2× → 能在<strong>开发 / CI / 部分生产</strong>跑。<br><br><strong>覆盖范围</strong>：<br>· <strong>Heap buffer overflow / underflow</strong>（malloc/new 越界）<br>· <strong>Stack buffer overflow / underflow</strong>（局部数组越界）<br>· <strong>Use-after-free</strong>（free 后再访问）<br>· <strong>Use-after-return</strong>（栈对象 escape 给其他线程）<br>· <strong>Use-after-scope</strong>（lifetime 结束后访问）<br>· <strong>Initialization order bugs</strong>（全局对象构造顺序问题）<br>· <strong>Memory leak</strong>（程序退出时统计）<br><br><strong>不能检测</strong>：<br>· <strong>Data race</strong>（→ TSan）<br>· <strong>Uninitialized memory read</strong>（→ MSan）<br>· <strong>Undefined behavior</strong>（→ UBSan）<br><br><strong>使用</strong>：<code>g++ -fsanitize=address -fno-omit-frame-pointer -g -O1 ...</code>。<strong>typical overhead</strong>: CPU 2×, Memory 3×。<strong>生产场景</strong>：① CI 跑全部测试 with ASan；② Canary deployment 10% 流量带 ASan（仅小规模 production）；③ HWASan（ARM 上更便宜）可考虑全 prod。<br><br><strong>真实经验</strong>：NETCONF agent 老代码升级到 ASan 后第一周抓到 13 个 bug，包括 ① 2 个 UAF（shared_ptr 循环引用边缘）；② 5 个 stack buffer overflow（fixed-size 数组 + dynamic input）；③ 6 个 memory leak（exception path 没释放）。<strong>对策</strong>：每个 release 必跑 ASan + TSan + UBSan triple，零容忍报警。<strong>陷阱</strong>：① ASan slow，hot path benchmark 不准（必须分开 perf 和 ASan run）；② false positive 罕见但可能（如自己的 allocator）；③ Production 启用要小心（攻击者可能利用 ASan 检测路径）。`,
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
        staff: `深一层：TSan 用的是 <strong>FastTrack 算法</strong>（2009，Dimitar Dimitrov 等）—— vector clock 的优化版本，单次访问 ~5-10× slowdown（vs 朴素 vector clock 100×+）。<br><br><strong>关键优化</strong>：<br>① <strong>"读"用 epoch</strong>（单时间戳）<strong>不用 full vector</strong>—— 多个读不形成 race，只要记最大；<br>② <strong>"写"用 full vector clock</strong>—— 写跟之前的读 / 写都要查；<br>③ <strong>shadow memory</strong> 跟 ASan 类似，每 8 字节用户内存对应 32 字节 shadow（存上次访问的 epoch / vc + 类型）。<br><br><strong>覆盖能力</strong>：<br>· <strong>Data race</strong>（任何 happens-before 缺失的内存 conflict）<br>· <strong>Deadlock</strong>（lock order inversion）<br>· <strong>Async-signal-unsafe usage</strong><br>· 不检测：deadlock 实际发生（只 detect potential）/ algorithm livelock。<br><br><strong>使用</strong>: <code>g++ -fsanitize=thread -O1 -g</code>。<strong>typical overhead</strong>: CPU 5-15×（更贵于 ASan），Memory 5-10×。<strong>限制</strong>：① 不能跟 ASan 同时用（shadow 冲突），分开 build；② 不识别 lock-free 算法的 fence / hand-rolled sync（需 <code>__tsan_*</code> annotations）；③ ARM 上有 limitations。<br><br><strong>真实经验</strong>：NETCONF agent 一段时间出现"<strong>偶发段错</strong>"，无规律。跑 TSan 在 CI 测试上发现一段无关 race：<code>std::unordered_map&lt;Key, Value&gt;</code> 共享给多线程，一个线程 insert 同时另一个读—— map 内部 rehash 可能让 reader 看到部分 reorganize state。bug fix：加 shared_mutex。<strong>陷阱</strong>：① False positive 比 ASan 多（lock-free 算法 / 自定义 sync 容易触发）；② Production 不建议开（10× slowdown）；③ TSan + jemalloc 兼容性问题 → glibc malloc 跑。<strong>替代</strong>：HelGrind（Valgrind）类似但更慢；DataRaceBench 类的测试套件。`,
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
        staff: `深一层：ET 是"<strong>边沿触发</strong>" 哲学的 IO 应用——只通知<strong>变化</strong>不通知<strong>状态</strong>。这种设计在 OS / 硬件抢占性事件机制里常见（中断也是边沿触发版本）。<br><br><strong>实战 ET 模板</strong>：<br><code>while (true) {</code><br><code>    ssize_t n = read(fd, buf, sizeof(buf));</code><br><code>    if (n &gt; 0) { process(buf, n); }</code><br><code>    else if (n == 0) { close(fd); break; }  // EOF</code><br><code>    else if (errno == EAGAIN) { break; }  // no more data, exit loop</code><br><code>    else { /* error */ break; }</code><br><code>}</code><br><br><strong>必须配套</strong>：① <code>fcntl(fd, F_SETFL, O_NONBLOCK)</code>—— 非阻塞，否则 ET 读到没数据时<strong>整线程 block</strong>；② accept ET 也要循环—— 新连接同样可能"<strong>批量到</strong>"。<br><br><strong>真实经验</strong>：NETCONF agent 初版用 LT，10k 连接时 epoll_wait CPU ~15%。改 ET 后 ~5%（节省 syscall）。但<strong>第一周出过一次事故</strong>：write 后没循环到 EAGAIN，对端等不到剩余数据 → connection hang → load balancer health check 失败。Fix 后加了<strong>统一的 read/write loop 抽象</strong>避免人为漏循环。<strong>选型建议</strong>：① 简单 / 中等性能场景 LT（不易出错）；② 高 QPS 服务器 ET + 严格 review；③ 极致性能 → io_uring（见 #125）。<strong>陷阱</strong>：① ET write 也要循环（write 满返回 EAGAIN 时必须 epoll wait）；② <strong>EPOLLONESHOT</strong> 多线程场景必备（避免多线程同时处理同 fd）；③ <strong>edge-triggered 实战</strong> 比 level 多 ~50% 代码量。`,
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
        staff: `深一层：io_uring 是 Linux 5.1+ 引入（2019），<strong>从根本上重设计了 Linux IO 模型</strong>。<strong>真实成就</strong>：① 把 Windows 的 IOCP / Solaris 的 event completion 这种"真异步 + 完成通知" model 带到 Linux；② <strong>跨 IO 类型统一</strong>—— 之前网络（epoll）/ 磁盘（aio）各有 API，io_uring 一统；③ <strong>多种增量</strong>：注册 buffer / 注册 fd / fixed file table / SQPOLL（kernel polling 模式，完全免 syscall）。<br><br><strong>性能 vs epoll</strong>：<br>· 极小 IO（&lt; 100 byte）：5-10× faster（syscall overhead 大）<br>· 中等 IO：2-3× faster<br>· 大 IO：相当（IO 本身是瓶颈）<br>· 但<strong>需要 io_uring-aware 库</strong>，移植不便宜<br><br><strong>真实采用情况</strong>（2026）：<br>· <strong>Linux database</strong>：ScyllaDB / Redis Disk-IO / 部分 RocksDB optional<br>· <strong>Web server</strong>：Nginx 实验 / Cloudflare Boring Crypto<br>· <strong>Network</strong>：tigerbeetle / 各种 user-space TCP stack<br>· <strong>主流大厂</strong>：仍 hesitant 因为 ① 安全 CVE 历史多（io_uring 漏洞频繁）；② 需 kernel 5.6+；③ 移植代码量大<br><br><strong>NETCONF agent 评估</strong>：测过 epoll vs io_uring 的 NETCONF RPC throughput，10k QPS 下 io_uring +28%（每 RPC 多次 small read/write）。但<strong>没投产</strong>：① 客户 RHEL 7 / 8 还在用（kernel 太旧）；② 团队学习曲线；③ 收益对业务不关键（已经 over-deliver SLA）。Decision: 等 RHEL 9 + 普及再说。<strong>陷阱</strong>：① <strong>liburing</strong> wrapper 是事实标准，不要 raw syscall；② <strong>SQPOLL</strong> 模式占一个核 polling，小流量浪费 CPU；③ <strong>安全</strong>：部分公司因 CVE 风险 disable io_uring。`,
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
        staff: `深一层：mmap vs read 的取舍是<strong>"小固定开销 vs 增量复制开销"</strong>。<br><br><strong>具体场景</strong>：<br>· <strong>顺序读大文件</strong>：read（用 readahead）通常更快——OS 预读 + 流式 copy，单次 syscall 8MB 也只是 ~1ms<br>· <strong>随机访问</strong>：mmap 优势大——只 fault 用到的页，不浪费<br>· <strong>多进程共享只读数据</strong>（如索引）：mmap 必备（共享 page cache，零额外内存）<br>· <strong>实时修改 + 持久</strong>：mmap MAP_SHARED + msync<br>· <strong>小文件</strong>（&lt; 4KB）：read 更快（mmap 至少分配一页）<br><br><strong>陷阱</strong>：<br>① <strong>page fault 不是 free</strong>—— 首次访问 ~ µs；② <strong>TLB miss</strong>—— 大文件随机访问 TLB 频繁刷新（huge page 缓解）；③ <strong>write back</strong>—— MAP_SHARED 修改不立即落盘，msync 强制；④ <strong>file 末尾</strong>—— mmap 到 file size 但 read/write 超出 = SIGBUS（read 是 EOF）。<br><br><strong>真实经验</strong>：NETCONF agent 处理大 YANG schema 文件（~ 100MB）：<br>· 老版用 read 整文件 → 100ms（包括 1 次 copy）<br>· 改 mmap：首次随机访问 page faults 慢，但总时间 ~80ms（节省 copy + readahead）<br>· 添加 <code>madvise(MADV_RANDOM)</code> 进一步优化（告诉 kernel 不要 readahead，节省 cache pollution）<br><br><strong>性能 vs 易用</strong>：mmap 错误处理复杂（SIGBUS for out-of-bounds、跨进程同步），<strong>除非性能必需</strong>否则用 read。<strong>2026 现状</strong>：① io_uring 让 read 更高效（接近 mmap 性能 + 异步）；② mmap 仍是<strong>共享只读数据</strong>的最优解（databases / vector search index）。`,
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
        staff: `深一层：Reactor 模式是<strong>异步 IO 网络编程的事实标准</strong>，2000 年 Doug Schmidt 形式化。<strong>核心机制</strong>：① <strong>事件循环</strong>（epoll_wait）；② <strong>事件类型</strong>（read / write / accept / close）；③ <strong>分发到 handler</strong>（callback / event handler）。<br><br><strong>3 种 Reactor 性能对比</strong>（hypothetical 10k 连接）：<br>· 单线程：CPU bottleneck @ ~50k req/s（单核）<br>· 单 Reactor 多线程：~150k req/s（IO 单线程仍瓶颈）<br>· 多 Reactor：~500k+ req/s（多核 scaling）<br><br><strong>Reactor vs Proactor</strong>：<br>· Reactor: "I want to read, tell me when ready"<br>· Proactor: "Read N bytes for me, tell me when done"<br>· Reactor 更通用（任何 OS）；Proactor 性能稍优但需 OS 支持<br><br><strong>真实经验</strong>：NETCONF agent 架构演化：<br>1) <strong>v1</strong>: 单 Reactor 单线程 - 1k 连接 OK，10k 时单核 100%<br>2) <strong>v2</strong>: 单 Reactor + worker pool - 10k 连接 OK，但 IO 线程 80% CPU<br>3) <strong>v3</strong>: 多 Reactor（每 CPU core 一个 sub-reactor）+ worker pool - 50k 连接稳定，CPU 均匀分布<br>4) <strong>v4</strong>（试验）: 移植到 io_uring（Proactor 模式）- 同负载 CPU -30%，但代码复杂度 ↑↑<br><br><strong>chosen</strong>：v3（多 Reactor）— 性能足够 + 维护成本可控。<strong>主流框架</strong>：<br>· <strong>Boost.Asio</strong>: Reactor + Proactor 抽象（Linux epoll / Windows IOCP / Linux io_uring）<br>· <strong>libuv</strong>: Node.js 用，类似 abstraction<br>· <strong>seastar</strong>: per-core sharded reactor (ScyllaDB)，极致性能<br>· <strong>folly::AsyncSocket</strong>: Facebook 的高性能 reactor<br><br><strong>陷阱</strong>：① reactor 内不能阻塞调用（导致 head-of-line blocking）；② callback hell（C++20 协程缓解）；③ 跨线程 dispatch 开销不能忽略。`,
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
        staff: `深一层：fd 共享 + offset 共享是 Unix 设计的<strong>核心</strong>，影响多个场景：<br><br>① <strong>shell pipe</strong>：<code>cmd1 | cmd2</code> 实际是 cmd1 / cmd2 共享一个 pipe fd（fork 后），写 / 读独立<br>② <strong>双向 communication</strong>：socket pair fork 后，父子双向通信<br>③ <strong>stdio redirect</strong>：<code>./prog &gt; file</code> 实际是 shell 在 fork 后 dup2 file 到 fd 1，然后 exec<br><br><strong>关键陷阱</strong>：<br>· <strong>父子同 read 一文件</strong> → offset 共享 → 各自 read 1KB 实际是读不同部分（offset 累计）<br>· <strong>父子都 close 同一 fd</strong> → 都 close 才真正释放底层 file struct（引用计数）<br>· <strong>exec 后 fd 默认保留</strong>（除非 FD_CLOEXEC flag）→ 安全风险 + 资源泄漏<br><br><strong>O_CLOEXEC</strong>: <code>open(..., O_CLOEXEC)</code> 让 fd 在 exec 时自动关闭（Linux 2.6.23+）—— <strong>新代码必加</strong>，避免 fd leak。<br><br><strong>真实经验</strong>：NETCONF agent 老代码 fork worker 进程时<strong>没加 O_CLOEXEC</strong>，导致 worker 进程继承了 parent 的所有 fd（包括 log file、socket 等）→ ① 资源泄漏（child 死了 fd 不释放）；② 安全（child 能访问 parent's 网络 socket）。修复加 O_CLOEXEC 后正常。<br><br><strong>fork + exec 模式</strong>：<br>· Linux：fork() + exec() 标准 pattern<br>· macOS：posix_spawn 推荐（避免 fork 一次完整 copy）<br>· Windows：CreateProcess（无 fork 概念）`,
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
        staff: `深一层："零拷贝"是相对的—— 减少<strong>用户 ↔ 内核</strong>的拷贝，但<strong>内核内部</strong>（page cache → socket buffer → NIC DMA）仍可能有拷贝。<strong>真正零拷贝</strong>需要 ① DPDK / RDMA 用户态 NIC 驱动；② splice + pipe + sendfile 组合（避免 socket buffer 中间步骤）。<br><br><strong>各方案细节</strong>：<br>① <strong>sendfile</strong>（Linux 特有）：<code>sendfile(out_fd, in_fd, offset, count)</code>—— out_fd 必须 socket，in_fd 任意 file。<br>② <strong>splice</strong>（Linux 2.6.17+）：<code>splice(fd_in, off, fd_out, off, len, flags)</code> 一边必须是 pipe；通过 pipe 中介实现任意 fd 间。<br>③ <strong>mmap + write</strong>：自由度高但<strong>write 仍有 user→kernel copy</strong>，只省 read 的 copy。<br>④ <strong>SO_ZEROCOPY</strong>（Linux 4.14+）：send + MSG_ZEROCOPY，kernel 不立即 copy，完成时通过 socket error queue 通知（poll EPOLLERR）。<strong>注意</strong>：send 返回后 user buffer 不能立即修改！<br><br><strong>真实经验</strong>：NETCONF agent telemetry 流式传输（大量 device data 100MB+ files）：<br>· baseline read + send: ~80% CPU on socket / file IO<br>· sendfile: CPU -40%（省 user space copy）<br>· splice + pipe: 类似 sendfile 效果<br>· SO_ZEROCOPY: 试过但 callback complexity 高 + 收益边际<br>· 最终选 sendfile（简单 + 收益大）<br><br><strong>陷阱</strong>：① sendfile 不能修改 file data（pure file → socket）；② splice 涉及 pipe 中介，pipe buffer 有限；③ SO_ZEROCOPY <strong>send 后不能立即修改 user buffer</strong> → 需要异步生命周期管理；④ TLS 加密让 sendfile 失效（kTLS 是解决方案，加密在 kernel）。`,
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
        staff: `深一层：TLS 1.3（2018 RFC 8446）<strong>大幅简化 + 加速</strong>：<br>① <strong>0-RTT</strong>（先发后认证，可选）<br>② <strong>1-RTT handshake</strong>（vs TLS 1.2 的 2-RTT）<br>③ <strong>移除老不安全 cipher</strong>（RC4 / MD5 / DES / RSA key exchange）<br>④ <strong>强制 forward secrecy</strong>（必须用 DH / ECDH）<br>⑤ <strong>Encrypted SNI</strong>（ECH，更隐私）<br><br><strong>vs TLS 1.2 的步骤</strong>：1.3 把 ServerKeyExchange / ChangeCipherSpec 等合并；客户端 hello 时已带 key share，服务端立即推 finished。<br><br><strong>实战考虑</strong>：<br>① <strong>HTTPS 性能</strong>：TLS 1.3 比 1.2 快 ~30%（少一个 RTT）；<br>② <strong>HTTP/3 + QUIC</strong>：QUIC 直接集成 TLS 1.3 in transport layer，0-RTT 默认；<br>③ <strong>证书验证</strong>：① 链验证（intermediate → CA root）；② 时效检查（notBefore / notAfter）；③ hostname 验证（Subject CN / SAN）；④ revocation（OCSP / CRL）；<br>④ <strong>cipher suite</strong>：2026 年推荐 AES-128-GCM / ChaCha20-Poly1305（mobile）；<br>⑤ <strong>kTLS</strong>：kernel 处理对称加密，能继续 sendfile。<br><br><strong>真实经验</strong>：NETCONF over TLS 部署在生产，曾遇到客户老 RHEL 7 默认 TLS 1.0 + weak cipher → 我们 reject → 客户报错。妥协支持 TLS 1.2+ 同时禁用 RC4 / MD5 / DES。<strong>monitoring</strong>：① 监控 TLS version distribution；② 监控 cipher suite usage；③ 证书过期告警（前 30 / 7 / 1 天）；④ <strong>SNI</strong> 加密（ECH）逐步铺开。`,
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
        staff: `深一层：LRU 的<strong>设计取舍</strong>：<br>① <strong>容器选择</strong>：<br>· <code>std::list</code>：双向链表，splice 是 <strong>O(1)</strong>，唯一选择（vector / array splice 是 O(n)）<br>· <code>std::unordered_map</code>：哈希表 O(1)，比 map 快（map 是 RB-tree O(log n)）<br>② <strong>iterator stability</strong>：std::list 的 iterator 在其他操作时不失效（只删自己才失效）→ map 存 iterator 安全<br>③ <strong>thread safety</strong>：上面是单线程版；多线程需 <code>std::shared_mutex</code> 或 <strong>分片 LRU</strong>（按 hash 拆 N 段，减锁竞争）<br><br><strong>高级变体</strong>：<br>· <strong>LRU-K</strong>（最近 K 次访问，更精确）<br>· <strong>Segmented LRU</strong>（hot / cold 两段）<br>· <strong>Clock algorithm</strong>（OS page replacement，近似 LRU 但更便宜）<br>· <strong>ARC (Adaptive Replacement Cache)</strong>（LRU + LFU 自适应，IBM）<br>· <strong>TinyLFU / W-TinyLFU</strong>（Caffeine library，2026 SOTA）<br><br><strong>真实经验</strong>：NETCONF agent 实现 device state 缓存（100k devices），最初用上面这种 LRU + 单 mutex：<br>· 单线程性能 ~5M ops/sec<br>· 16 线程并发：~6M ops/sec（mutex 瓶颈）<br>· 改成<strong>分片</strong>（256 个 sub-LRU，每个 sub 自己 mutex）：~80M ops/sec<br>· 进一步用 folly::EvictingCacheMap（lock-free 部分操作）：~150M ops/sec<br><br><strong>陷阱</strong>：① 接 K = std::string，map 多次 hash 浪费 → 用 transparent comparator；② Iterator invalidation 必须懂 list / map 各自规则；③ <strong>memory locality</strong>：std::list 节点散布堆中，cache unfriendly → boost::intrusive::list 或自定义 arena 可改善。`,
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
        staff: `深一层：限流算法<strong>四大类</strong>：<br>① <strong>Token Bucket</strong>（上面）：允许 burst（capacity 大），平均速率 = rate<br>② <strong>Leaky Bucket</strong>：恒定输出速率（不允许 burst），适合<strong>流量整形</strong>（traffic shaping）<br>③ <strong>Fixed Window Counter</strong>：count requests / minute，简单但<strong>边界突刺</strong>（59.9s 满了 + 60.1s 又满）<br>④ <strong>Sliding Window Log</strong>：精确但内存大（存所有 timestamp）；<strong>Sliding Window Counter</strong>（折中）<br><br><strong>典型选择</strong>：<br>· <strong>API rate limit</strong>: Token Bucket（允许偶尔 burst）<br>· <strong>QPS 平稳输出</strong>: Leaky Bucket<br>· <strong>分布式</strong>: Redis + Lua 实现 Token Bucket（atomic）<br><br><strong>多线程实现</strong>：<br>· <strong>mutex 版</strong>: 上面代码，简单但高并发 bottleneck<br>· <strong>atomic 版</strong>: tokens 用 atomic&lt;double&gt; + CAS loop，复杂但快<br>· <strong>per-thread bucket + 周期合并</strong>: 减少全局竞争，适合 high-throughput<br><br><strong>真实经验</strong>：NETCONF agent 给某 customer 限流 100 RPC/sec（防其 polling script 把 server 打挂）：<br>· Token Bucket capacity 100, rate 100/s<br>· 客户能 burst 100 个，之后稳定 100/s<br>· 用 mutex 版本：1 万 device 同时 polling 时 mutex 竞争 ~5% CPU<br>· 改 atomic CAS loop：CPU &lt; 1%<br>· 边界 case 处理：dt 极大（系统 sleep）→ tokens 立即满，正常；dt 极小（多线程同时进 acquire）→ CAS 重试，正常<br><br><strong>陷阱</strong>：① <strong>steady_clock vs system_clock</strong>—— 必须用 steady（不受时区 / NTP 调整影响）；② tokens / rate 用 double 而非 int —— 支持小数 rate（如 0.5/s）；③ <strong>multiple bucket / hierarchical</strong>—— 每用户 / 每 API / 全局 三层；④ <strong>graceful degradation</strong>—— 超限不要直接 reject，可以 enqueue + slow down。<strong>分布式</strong>：Redis Lua 脚本原子化 token 补 + 减；网关 / API gateway 内置（Kong / Envoy / Istio）。`,
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
        senior: `<strong>详细说明</strong>：<br>① <strong>arena</strong>：每 NETCONF RPC 处理在栈上 64KB buffer + monotonic_buffer_resource，所有 STL 容器用 pmr 版本，函数结束整体释放；<br>② <strong>string_view</strong>：YANG XML 解析时不拷贝 string，<strong>view 进栈 buffer</strong>；<br>③ <strong>FlatMap</strong>：路由表~1k 条目，FlatMap 比 unordered_map 更 cache-friendly + 更小内存；<br>④ <strong>session shard</strong>：256 个 sub-map，按 session_id hash 分；锁竞争降 256×；<br>⑤ <strong>Reactor</strong>：主线程 epoll + dispatch 到 worker pool；<br>⑥ <strong>quill</strong> 异步日志，producer ~50ns，批 flush；<br>⑦ <strong>HdrHistogram</strong>：精确 P99 / P99.9 / P99.99（vs 简单 percentile 估算）。`,
        staff: `深一层：这套优化让 NETCONF agent 达到 <strong>50k RPC/sec single-machine</strong>（业内 SOTA），P99 latency <strong>&lt; 5ms</strong>。<br><br><strong>关键设计决策</strong>：<br>① <strong>不用 protobuf RPC</strong>—— NETCONF 是 IETF 标准基于 XML，必须用；优化 XML parser 用 zero-copy + SIMD（rapidxml-ns / pugixml）<br>② <strong>不用 grpc</strong>—— 自己实现 SSH-based session 处理（NETCONF 用 SSH 而非 HTTP）<br>③ <strong>不分布式</strong>—— 每个 agent 处理 own device set；按 device hash 路由<br>④ <strong>无 SQL 数据库</strong>—— in-memory + WAL，shared-nothing<br><br><strong>性能 baseline 对比</strong>：<br>· 老 vendor agent（Java）：~ 5k RPC/s, P99 &gt; 50ms<br>· 我们 v1（C++ 朴素）：~ 15k RPC/s, P99 ~ 20ms<br>· v2（加上 7 个优化）：~ 50k RPC/s, P99 ~ 4ms<br>· <strong>10× 性能</strong>，1/10 硬件成本<br><br><strong>验证</strong>：① k6 压测 + HdrHistogram 监控；② Linux perf record 验证 hot path；③ jemalloc.stats 验证 zero alloc。<strong>陷阱</strong>：① 优化优先级 —— 先 profile 再优化（不要凭感觉）；② Maintain readability —— 7 个优化都加了详细注释 + Doc；③ Test coverage —— 大量 fuzz + load test 防 regression；④ <strong>"<u>premature optimization is root of all evil</u>"</strong>—— 这套是<strong>有数据支撑的</strong>（之前慢，必须优化），不是 over-engineering。`,
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
        staff: `深一层：内存增长在生产 C++ 服务里有 ~5 个主要来源，<strong>排查方法不同</strong>：<br><br>① <strong>纯 leak (new 不 delete)</strong>: LSan / Valgrind 一抓一个准；现代 C++ 用 unique_ptr 几乎绝迹<br>② <strong>shared_ptr 循环引用</strong>：用 weak_ptr 一方；Valgrind 看不到，业务侧 counter + 代码 review<br>③ <strong>容器 only grow</strong>（如 cache 不 evict、queue 只 push）：业务侧 counter + 监控<br>④ <strong>malloc 不归还 OS</strong>（fragmentation）：glibc 默认 ptmalloc 这样；换 jemalloc / tcmalloc 改善<br>⑤ <strong>突发 + 大对象</strong>（如解析大 XML 一次性 buffer 100MB）：profile 看 RSS 跳变时间点对应业务<br><br><strong>真实经验</strong>：NETCONF agent 生产 RSS 持续 3 天慢增长 ~50MB/天：<br>1) <strong>jemalloc.prof</strong> + pprof：看 hot allocation site → 发现是某 cache 持续 grow<br>2) <strong>业务 counter</strong>：cache.size() 持续涨 → 没 evict 逻辑（design bug）<br>3) <strong>修复</strong>：加 LRU eviction + 监控 cache hit rate<br>4) <strong>验证</strong>：RSS 稳定一周后无增长<br><br><strong>另一案例</strong>：peak 8GB 后稳定 4GB，glibc 不还 OS：<br>1) <strong>切 jemalloc</strong>：peak 8GB → 稳定 ~5GB（仍较高）<br>2) <strong>调 jemalloc 参数</strong>：<code>narenas:1, dirty_decay_ms:1000</code> → peak 后 30s 内回到 ~5GB<br>3) <strong>实质</strong>：fragmentation，arena 调整 + decay 加速归还<br><br><strong>陷阱</strong>：① 不区分 RSS / VSS / heap usage —— 三者不同含义；② 用 top 看 RSS 不准（含 shared library）—— smaps 更精确；③ jemalloc + ASan 偶尔冲突；④ <strong>真泄漏</strong>很少（90% 是 design issue）。`,
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
        staff: `深一层：release debug 是<strong>真 senior C++ 必备技能</strong>。<br><br><strong>工具组合</strong>：<br>· <strong>core dump</strong> + <strong>gdb</strong>：生产事故首选<br>· <strong>perf record + perf report</strong>：性能 + flame graph<br>· <strong>strace / ltrace</strong>：syscall / library call trace<br>· <strong>rr (record-replay)</strong>：record 一次然后 deterministic replay debug（Mozilla 工具）<br>· <strong>eBPF tools</strong>: bpftrace / bcc / bpftrace<br><br><strong>真实经验</strong>：NETCONF agent 生产偶发段错：<br>1) <strong>core dump 配置</strong>：<code>ulimit -c unlimited</code> + <code>echo "/var/cores/%e.%p" &gt; /proc/sys/kernel/core_pattern</code><br>2) 事故发生时拿到 core file<br>3) <code>gdb binary core</code>，<code>bt</code> 显示 ?? ??（frame pointer 没保留）<br>4) <strong>重编</strong>：<code>g++ -O2 -g -fno-omit-frame-pointer ...</code><br>5) 模拟相同 input，再 crash → 这次 bt 完整：定位到某个 std::map::find 在被 concurrent 修改时的迭代器失效<br>6) <strong>修复</strong>：加 shared_mutex<br><br><strong>另一案例</strong>：性能问题（P99 周期性飙到 100ms）：<br>1) perf record + flame graph：发现 lock contention spike<br>2) <strong>rr</strong> record 一段 → replay 慢慢看为什么这段 lock contention<br>3) 发现：某 batch job 每分钟 sync 时 hold lock 长 → 改 async<br><br><strong>实践建议</strong>：<br>· Production 永远 <code>-g -O2</code>（debug info 不影响 runtime perf，磁盘多占 30%）<br>· 关键服务 <code>-fno-omit-frame-pointer</code>（无 backtrace 不能调）<br>· Core dump 必开 + 收集到中心化存储<br>· 关键服务带 <strong>continuous profiling</strong>（Pyroscope / Parca）— 始终有 flame graph 供调查<br>· 学会 <strong>用 disasm 调</strong>—— 关键 bug 时不可避免`,
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
        staff: `深一层：好的 C++ API 设计跟 Rust 异曲同工——<strong>用类型系统强制正确使用</strong>。<br><br><strong>extended principle</strong>：<br>⑨ <strong>不要 expose 实现细节</strong>：用 Pimpl 隐藏成员；用 ABI namespace inline 版本化；<br>⑩ <strong>strong types over weak</strong>: UserId vs int；不能混用 UserId 和 OrderId；<br>⑪ <strong>builder pattern</strong> 复杂构造：<code>HttpRequest::Builder().url("...").timeout(30s).build()</code><br>⑫ <strong>Composable</strong>: Function as first-class，function_ref / function 参数，让调用方组合；<br>⑬ <strong>Stream-like or single-call</strong>: 选其一别混（要么 builder 链式要么单次 settle）；<br>⑭ <strong>Sane defaults</strong>: 90% 用户不需要看 doc 也能用对<br><br><strong>真实例子</strong>：NETCONF agent SDK 设计：<br><code>auto session = nc::Session::connect({.host = "router.example.com", .port = 830, .auth = nc::SshAuth::with_key(key_file)})</code><br><code>    .timeout(std::chrono::seconds(30))</code><br><code>    .build();</code><br><br><strong>用了什么 principle</strong>：<br>· Designated initializer (C++20) 让 ConnectionOpts 字段清晰；<br>· Builder 模式可加可减 optional 参数；<br>· <strong>RAII session</strong>：session 析构自动 disconnect；<br>· 返回 <code>std::expected&lt;Session, ConnectError&gt;</code>—— 错误强制 handle；<br>· nc::SshAuth strong type—— 不能误传 password 到 with_key()；<br>· timeout 用 std::chrono 强类型—— 不能误传 "30" 当秒数 / 毫秒数<br><br><strong>对比反例</strong>：早期 NETCONF SDK API：<code>nc_session_t* nc_connect(const char* host, int port, const char* user, const char* pass);</code>—— ① raw ptr ownership 不明；② 4 个 raw 参数易顺序错；③ password 字符串明文（应该 zeroize）；④ 错误用全局 errno 不返回。<br><br><strong>学习资源</strong>：① Scott Meyers《Effective C++》/《Effective Modern C++》；② Herb Sutter《Exceptional C++》；③ C++ Core Guidelines（cppcoreguidelines.org）；④ Sean Parent 《Better Code》系列 talks；⑤ 反面教材：早期 STL / Boost / WinAPI（学怎么<u>不要</u>设计）。`,
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
