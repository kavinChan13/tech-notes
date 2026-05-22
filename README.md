<div align="center">

# Tech Notes

### 📚 个人技术与管理知识库

_C++ 系统编程 · 性能与调试 · 操作系统/网络 IO · 架构方法论 · 工程管理 · PM 双线_

[![Pages](https://img.shields.io/badge/GitHub_Pages-Live-2ea44f?style=for-the-badge&logo=github)](https://kavinchan13.github.io/tech-notes/)
[![License](https://img.shields.io/badge/License-MIT-1c3a5e?style=for-the-badge)](./LICENSE)
[![Docs](https://img.shields.io/badge/Docs-53_HTML-1c3a5e?style=for-the-badge)](https://kavinchan13.github.io/tech-notes/)
[![Templates](https://img.shields.io/badge/Templates-24-a47018?style=for-the-badge)](https://kavinchan13.github.io/tech-notes/)

---

## 🌐 在线阅读

### **[🚀 进入知识库首页](https://kavinchan13.github.io/tech-notes/)**

无需下载，浏览器直接打开即可阅读全部 **53 篇技术与管理指南 + 24 份模板**

</div>

---

## 🎯 项目介绍

这里聚合了我在长期工作中沉淀的技术与管理笔记，覆盖：

- **C · C++ 语言核心** — 编译、对象模型、内存模型、值类别、类型转换、模板、异常、现代特性 (C++11-26)、智能指针/协程深度
- **S · STL 与设计模式** — 容器/算法剖析，C++ 视角的 GoF 模式与并发模式（含 LMAX Disruptor / Sender-Receiver）
- **P · 性能 / 调试 / 构建** — 性能优化、低延迟、内存泄漏、崩溃/死锁、Sanitizers、CMake & CI/Bazel、ABI 兼容性、安全硬化、可观测性、现代第三方库
- **N · 系统 / IO / 网络** — Linux 内核 IO、文件描述符全家桶、OS 基础（含容器底层）、网络编程、异步网络框架深度
- **A · 架构师方法论** — 软件架构（C4/DDD/ADR）、大型 C++ 工程化、分布式系统、存储与数据架构、可观测性工程、Capstone、架构师面试题库
- **M · 工程管理与 EM 模板** — 研发管理、管理知识体系、Senior EM、AI-Native EM、12 份 EM 必备模板
- **G · PM 双线** — 项目经理 (PgM) + 产品经理 (PdM) 8 份指南：能力雷达、EVM、A/B、干系人、JTBD、PRD、PMBOK、面试 + 12 份 PM 模板
- **I · 面试 / Tech Lead** — Tech Lead 面试指南、C++ 面试速查卡

所有文档均为独立 HTML 单文件，可离线阅读，也可通过 GitHub Pages 在线浏览。
每篇文档右上角都有 **「主页 / Repo / Source / 阅读时长」** 浮动胶囊，方便跳转。

---

## 📖 内容导航

> 编号体系：`C01..C10` C++ 核心 · `S01..S04` STL · `P01..P11` 性能/调试 · `N01..N05` 系统/网络 · `A01..A07` 架构 · `M01..M05` 管理 · `G01..G09` PM 双线 · `I01..I02` 面试
>
> 下面所有链接默认指向 [GitHub Pages 在线版](https://kavinchan13.github.io/tech-notes/)，点击即可在浏览器渲染。

### I · C++ 语言核心 — `cpp/`

| #   | 文档 | 主题 |
|-----|---|---|
| C01 | [编译流程指南](https://kavinchan13.github.io/tech-notes/cpp/compilation_guide.html) | 预处理 / 编译 / 汇编 / 链接、ODR、符号、链接错误排查、现代链接器 |
| C02 | [C++ 对象模型](https://kavinchan13.github.io/tech-notes/cpp/object_model.html) | 内存布局、vtable、多重/菱形继承、EBO、`std::launder`、inline namespace ABI |
| C03 | [C++ 内存模型](https://kavinchan13.github.io/tech-notes/cpp/memory_model.html) | 原子、memory order、与硬件 cache 一致性、Hazard Pointer / RCU / ABA |
| C04 | [值类别](https://kavinchan13.github.io/tech-notes/cpp/value_categories_guide.html) | lvalue / rvalue / xvalue / prvalue / glvalue 全景，C++23 deducing this |
| C05 | [类型转换](https://kavinchan13.github.io/tech-notes/cpp/type_conversions_guide.html) | 隐式转换、四类 cast、UDC 与陷阱 |
| C06 | [模板深入](https://kavinchan13.github.io/tech-notes/cpp/templates_guide.html) | 函数/类模板、特化、SFINAE、CRTP、变参模板、Concepts、TMP 进阶 |
| C07 | [异常与 RAII](https://kavinchan13.github.io/tech-notes/cpp/exceptions_guide.html) | throw/catch、异常安全等级、noexcept、error_code 生态、std::expected |
| C08 | [C++ 现代特性](https://kavinchan13.github.io/tech-notes/cpp/modern_features_ppt.html) | C++11/14/17/20/23/26 重要特性精讲（含 Reflection / Pattern Matching / Sender-Receiver） |
| C09 | [智能指针深度](https://kavinchan13.github.io/tech-notes/cpp/smart_pointers_deep_dive.html) | unique / shared / weak / atomic / intrusive：控制块、aliasing、多线程真相、跨 ABI 坑 |
| C10 | [协程完全深度](https://kavinchan13.github.io/tech-notes/cpp/coroutines_deep_dive.html) | promise_type / awaiter、手写 Task & Generator、Symmetric Transfer、HALO、调度器、调试与泄漏 |

### II · STL 与设计模式 — `stl/`

| #   | 文档 | 主题 |
|-----|---|---|
| S01 | [STL 容器](https://kavinchan13.github.io/tech-notes/stl/stl_containers_ppt.html) | vector/map/unordered_map/list/deque 实现剖析与选型 |
| S02 | [STL 算法](https://kavinchan13.github.io/tech-notes/stl/stl_algorithms_ppt.html) | algorithm/numeric/ranges 常用算法与复杂度速查 |
| S03 | [设计模式（C++ 视角）](https://kavinchan13.github.io/tech-notes/stl/design_patterns_ppt.html) | 23 种 GoF + 现代 C++ 重写：Pimpl / Type Erasure / Policy / HSM / Sender-Receiver |
| S04 | [并发模式](https://kavinchan13.github.io/tech-notes/stl/concurrency_patterns_guide.html) | 线程池、Producer-Consumer、无锁队列、LMAX Disruptor、Sender/Receiver |

### III · 性能 / 调优 / 调试 / 构建 — `perf-debug/`

| #   | 文档 | 主题 |
|-----|---|---|
| P01 | [性能优化](https://kavinchan13.github.io/tech-notes/perf-debug/performance_guide.html) | 缓存友好、分支预测、SIMD 深度、PGO / AutoFDO / BOLT |
| P02 | [低延迟编程](https://kavinchan13.github.io/tech-notes/perf-debug/low_latency_guide.html) | 无锁、内存预分配、CPU 亲和、内核旁路（DPDK/RDMA/XDP）、PTP 时间戳 |
| P03 | [内存泄漏排查](https://kavinchan13.github.io/tech-notes/perf-debug/memory_leak_guide.html) | Valgrind / ASan / heaptrack / pmap，从工具到方法论 |
| P04 | [崩溃调试](https://kavinchan13.github.io/tech-notes/perf-debug/crash_debugging_guide.html) | core dump、gdb、信号处理、rr 记录回放、LLDB、bpftrace |
| P05 | [死锁调试](https://kavinchan13.github.io/tech-notes/perf-debug/deadlock_debugging_guide.html) | 检测、复现、TSan，与锁层级化设计 |
| P06 | [Sanitizers](https://kavinchan13.github.io/tech-notes/perf-debug/sanitizers_guide.html) | ASan/TSan/UBSan/MSan + Fuzz 进阶 + HWASan / GWP-ASan 生产部署 |
| P07 | [CMake & CI](https://kavinchan13.github.io/tech-notes/perf-debug/cmake_ci_guide.html) | 现代 CMake + GitLab/GitHub Actions + Bazel/Ninja/C++20 Modules 全景 |
| P08 | [ABI 兼容性深度](https://kavinchan13.github.io/tech-notes/perf-debug/abi_compatibility_guide.html) | Itanium ABI / libstdc++ Dual ABI / inline namespace / PIMPL / 跨 .so 边界 / 真实生产事故 5 例 |
| P09 | [安全与硬化深度](https://kavinchan13.github.io/tech-notes/perf-debug/security_hardening_guide.html) | 5 大漏洞分类 / FORTIFY_SOURCE / Stack Protector / RELRO / CFI / MISRA / AUTOSAR / SBOM |
| P10 | [可观测性（C++ 侧）](https://kavinchan13.github.io/tech-notes/perf-debug/observability_guide.html) | 结构化日志 / Prometheus + HDR Histogram / OpenTelemetry C++ / Continuous Profiling / eBPF |
| P11 | [现代第三方库速览](https://kavinchan13.github.io/tech-notes/perf-debug/modern_libs_guide.html) | Boost / Abseil / Folly / TBB / Seastar / EASTL / Cap'n Proto / simdjson / fmt — 选型矩阵 + 5 实战 |

### IV · 系统 / IO / 网络 — `system/`

| #   | 文档 | 主题 |
|-----|---|---|
| N01 | [Linux 内核 IO 指南](https://kavinchan13.github.io/tech-notes/system/io_linux_kernel_guide.html) | Page Cache、Direct IO、io_uring、零拷贝 |
| N02 | [文件描述符深入](https://kavinchan13.github.io/tech-notes/system/filedescriptor_deepdive.html) | fd / open file / inode 表、dup/fork/exec、eventfd/signalfd/timerfd/pidfd/memfd 全家桶 |
| N03 | [操作系统基础](https://kavinchan13.github.io/tech-notes/system/os_fundamentals.html) | 进程/线程、调度、虚拟内存、系统调用、容器底层（namespaces / cgroup v2 / seccomp） |
| N04 | [网络编程](https://kavinchan13.github.io/tech-notes/system/networking_guide.html) | socket / epoll / TCP 状态机 / Reactor / HTTP/2 + QUIC/HTTP3/BBR/SO_REUSEPORT |
| N05 | [异步网络框架深度](https://kavinchan13.github.io/tech-notes/system/async_networking_guide.html) | Boost.Asio + 协程 / Reactor vs Proactor vs Sender-Receiver / gRPC / brpc / QUIC / 百万连接架构 |

### V · 架构师方法论 — `architect/`

| #   | 文档 | 主题 |
|-----|---|---|
| A01 | [软件架构方法论（C++ 视角）](https://kavinchan13.github.io/tech-notes/architect/architecture_methodology.html) | C4 / DDD / ADR / Clean Arch / ATAM / 演进式架构 / 嵌入式落地，端到端参考书 |
| A02 | [大型 C++ 工程化与 ABI 治理](https://kavinchan13.github.io/tech-notes/architect/large_scale_engineering.html) | ABI 稳定 / Pimpl / C++20 Modules / Conan / vcpkg / 插件化 / 跨平台 / 构建性能 |
| A03 | [分布式系统基础](https://kavinchan13.github.io/tech-notes/architect/distributed_systems_fundamentals.html) | CAP / PACELC / Raft / 分布式事务（2PC / Saga / Outbox）/ Kafka / 分布式锁 |
| A04 | [存储与数据架构](https://kavinchan13.github.io/tech-notes/architect/storage_and_data_architecture.html) | B+ Tree / LSM-Tree / WAL / MVCC 与隔离级别 / 多级缓存 / Redis 内部 / 时序数据库 |
| A05 | [可观测性工程](https://kavinchan13.github.io/tech-notes/architect/observability_engineering.html) | 三支柱 / OpenTelemetry C++ SDK / 分布式 Tracing / Prometheus / spdlog / Pyroscope / 车端 DLT |
| A06 | [C++ 架构师 Capstone](https://kavinchan13.github.io/tech-notes/architect/architect_capstone.html) | 端到端架构实战：车端遥测 — 需求 → ATAM → C4 → DDD → 6 条 ADR → ABI → 存储 → 可观测性 |
| A07 | [C++ 架构师面试题库](https://kavinchan13.github.io/tech-notes/architect/architect_interview.html) | 50+ 高频题速查 + 深度解析 — 方法论 / DDD / C++ 工程化 / 分布式 / 存储 / 可观测性 / 软技能 |

### VI · 工程管理与 EM 模板 — `management/`

| #   | 文档 | 主题 |
|-----|---|---|
| M01 | [软件研发管理指南](https://kavinchan13.github.io/tech-notes/management/software_management_guide.html) | 立项 / 迭代 / 质量 / 交付 / 回顾，IC → Manager 转型 |
| M02 | [管理知识体系](https://kavinchan13.github.io/tech-notes/management/management_knowledge_system.html) | 人 / 事 / 组织 三轴展开，配套阅读地图与决策框架 |
| M03 | **[EM Templates · Library](https://kavinchan13.github.io/tech-notes/management/em-templates/)** | **12 份必备模板：1on1、Weekly、QBR、Postmortem、ADR、Hiring Scorecard…** |
| M04 | [高级管理者知识体系](https://kavinchan13.github.io/tech-notes/management/senior_manager_knowledge_system.html) | Line → Senior EM 的 8 大模块 + 42 道面试题与高分答案 |
| M05 | [AI 时代的工程管理](https://kavinchan13.github.io/tech-notes/management/ai_native_engineering_management.html) | GenAI 对 EM 的 6 大根本性影响 + 10 道高频面试题 |

### VII · PM 双线（项目经理 × 产品经理） — `pm/`

> 给"已经做过 IC / Tech Lead / EM，想横向打开 Project Manager / Product Manager 能力面"的 3 个月体系性补齐地图。重点补三大弱项：① 项目计划/EVM ② 数据/AB 测试 ③ 干系人/影响力。

| #   | 文档 | 主题 |
|-----|---|---|
| G01 | **[PM 双线总览](https://kavinchan13.github.io/tech-notes/pm/dual_track_overview.html)** | **PgM × PdM 能力雷达 + 知识地图 + 12 周路线 + 8 份配套文档导航（入口）** |
| G02 | [项目计划与 EVM 完全指南](https://kavinchan13.github.io/tech-notes/pm/evm_planning_guide.html) | WBS / CPM / PERT / EVM 7 公式 / 资源平衡 / 关键链 + 25 道计算题 |
| G03 | [数据分析与 A/B 测试](https://kavinchan13.github.io/tech-notes/pm/data_ab_testing.html) | NSM / AARRR / HEART · 漏斗 / Cohort / 留存 · A/B 设计 + 8 大陷阱 · SQL 8 招 |
| G04 | [干系人与影响力指南](https://kavinchan13.github.io/tech-notes/pm/stakeholder_influence.html) | 权力-利益方格 · RACI/DACI/RAPID · Cohen-Bradford 6 类货币 · Harvard 谈判 7 要素 |
| G05 | [产品发现与 JTBD](https://kavinchan13.github.io/tech-notes/pm/discovery_jtbd.html) | 双钻 / JTBD / Opportunity Solution Tree / 用户访谈 / Persona / 旅程图 |
| G06 | [PRD 写作工具包](https://kavinchan13.github.io/tech-notes/pm/prd_writing_kit.html) | PRD/MRD/BRD 区别 + 5 段式 PRD 模板 + INVEST + Given-When-Then + 12 项评审清单 |
| G07 | [PMBOK 全景速查](https://kavinchan13.github.io/tech-notes/pm/pmbok_overview.html) | 5 大过程组 × 10 大知识领域 49 过程矩阵 + PMBOK 6 vs 7 + EM 视角解读 |
| G08 | [PM 面试速查卡](https://kavinchan13.github.io/tech-notes/pm/interview_cards.html) | PgM/PdM 行为 / Case / Estimation 90 题速查，含 STAR 模板 + 7 大致命红旗 |
| G09 | **[PM Templates · Library](https://kavinchan13.github.io/tech-notes/pm/templates/)** | **12 份必备模板：Charter / Stakeholder / WBS / RACI / RAID / CR / EVM / JTBD / Interview / Persona / PRD / A/B** |

### VIII · 面试 / Tech Lead — `interview/`

| #   | 文档 | 主题 |
|-----|---|---|
| I01 | [Tech Lead 面试指南](https://kavinchan13.github.io/tech-notes/interview/tech_lead_interview_guide.html) | 技术深度 + 系统设计 + 领导力，含 CAP / Raft / SLI-SLO 章节 |
| I02 | [C++ 面试速查卡](https://kavinchan13.github.io/tech-notes/interview/cpp_interview_cards.html) | 高频考点速查，按主题组织，面试前一晚的 cram sheet |

---

## 📂 项目结构

```
tech-notes/
├── index.html              # 统一导航首页（GitHub Pages 入口）
├── README.md  LICENSE
│
├── cpp/                    # C01..C10  C++ 语言核心 (10 docs)
├── stl/                    # S01..S04  STL & 设计模式 (4 docs)
├── perf-debug/             # P01..P11  性能 / 调试 / 构建 (11 docs)
├── system/                 # N01..N05  系统 / IO / 网络 (5 docs)
├── architect/              # A01..A07  架构师方法论 (7 docs)
├── management/             # M01..M05  工程管理 + EM 模板
│   ├── *.html              #   4 篇管理指南
│   └── em-templates/       #   M03 · 12 份 EM 模板 + index
├── pm/                     # G01..G09  PM 双线 + PM 模板
│   ├── *.html              #   8 篇 PgM × PdM 指南
│   └── templates/          #   G09 · 12 份 PM 模板 + index
├── interview/              # I01..I02  面试 / Tech Lead (2 docs)
│
├── assets/                 # 共享样式资源
├── tools/                  # 维护脚本
└── .github/workflows/      # GitHub Pages 自动部署
```

> **重构提示**：2026-05 把根目录平铺的 51 个文档归类到 8 个子目录。所有文档右上角有统一的「主页 / Repo / Source」浮动胶囊，方便跳转。请使用新的子目录路径访问，旧根级 URL 已不再可用。

---

## 💻 本地阅读

如果您希望离线阅读，可以 clone 后双击任意 `.html` 文件用浏览器打开：

```bash
git clone https://github.com/kavinChan13/tech-notes.git
cd tech-notes
# 直接在文件管理器里双击 index.html 即可
```

或者起一个本地 HTTP 服务器（更接近 GitHub Pages 行为）：

```bash
# Python
python -m http.server 8080

# 或者 Node
npx serve .
```

然后访问 `http://localhost:8080/`。

---

## 🚀 自动部署

仓库已配置 [`.github/workflows/pages.yml`](./.github/workflows/pages.yml)，**push 到 `main` 分支后会自动发布到 GitHub Pages**，无需任何手动操作。

修改文档的标准流程：

```bash
git add .
git commit -m "docs: update xxx"
git push
# 1~2 分钟后 https://kavinchan13.github.io/tech-notes/ 自动更新
```

---

## 📜 License

[MIT](./LICENSE) © 2026 Kavin Chan
