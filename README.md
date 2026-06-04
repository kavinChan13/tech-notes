<div align="center">

<img src="./assets/banner.png" alt="技术笔记 · Tech Notes" width="100%">

<br>

# 技术笔记

### 📓 系统、架构与工程管理的工作笔记

_关于 C++ 内部、分布式系统、工程实践与团队管理的一份长期笔记 · 单页 HTML · 离线可读_

<br>

<a href="https://kavinchan13.github.io/tech-notes/">
  <img src="https://img.shields.io/badge/在线阅读-kavinchan13.github.io-1c3a5e?style=flat-square&labelColor=faf8f3" alt="在线阅读">
</a>
&nbsp;
<a href="./LICENSE">
  <img src="https://img.shields.io/badge/License-MIT-8a2e2e?style=flat-square&labelColor=faf8f3" alt="License">
</a>
&nbsp;
<img src="https://img.shields.io/badge/纯-HTML-2c6042?style=flat-square&labelColor=faf8f3" alt="Pure HTML">
&nbsp;
<img src="https://img.shields.io/badge/部署-GitHub%20Pages-a47018?style=flat-square&labelColor=faf8f3" alt="GitHub Pages">

</div>

---

## 🎯 项目介绍

这是我在长期一线工作中沉淀下来的技术与管理笔记。最早只是几篇 C++ 调试记录，后来慢慢长成了一个有十个子目录、几十篇文档的静态站点。它不是教程，也不是面向某个具体岗位的体系——更像是一个"自用的工程参考书"：遇到问题翻一翻、回顾旧知识时也方便找。

整个仓库不依赖任何构建工具、框架或外部服务。每篇文档都是一个独立的 HTML 文件，clone 下来双击就能用浏览器打开；`push` 到 `main` 之后 GitHub Pages 会自动把仓库当作静态站点发布。每页右上角带统一的「主页 / Repo / Source」浮动胶囊，方便跳回索引或查看源码。

## 📚 快速开始

### 在线阅读

**[🌐 进入知识库首页](https://kavinchan13.github.io/tech-notes/)** —— 无需下载，浏览器直接打开即可阅读全部内容。

### 本地阅读

```bash
git clone https://github.com/kavinChan13/tech-notes.git
cd tech-notes

# 若要在本机使用 Cursor Agent Skill「bili-to-note」（该目录为 Git submodule），请改用：
# git clone --recurse-submodules https://github.com/kavinChan13/tech-notes.git
# 若已 clone 但未带子模块：git submodule update --init --recursive

# 方式一：直接双击 index.html
# 方式二：起一个本地服务器（更接近 GitHub Pages 行为）
python -m http.server 8080
# 或
npx serve .
```

然后访问 `http://localhost:8080/`。

### ✨ 你能在这里看到什么

- 📐 **C++ 与系统内功** —— 编译流程、对象模型、内存模型、模板、协程、LLVM 工具链、Sanitizer 内部、Modern CMake、并发
- ⚡ **性能与排错** —— 低延迟、缓存友好、内存泄漏、崩溃/死锁、Sanitizers、ABI 兼容、安全硬化、可观测性
- 🌐 **系统与网络** —— Linux 内核 IO、文件描述符全家桶、OS 基础、网络编程、异步框架
- 🏛️ **架构与分布式** —— DDD / C4 / ADR、大型 C++ 工程化、Raft / Paxos、存储、可观测性、端到端 Capstone
- 🤖 **AI-Native 工程** —— Prompt 工程、Agent 架构、LLMOps、AI Safety，以及配套的 AI 基础设施
- 🚗 **嵌入式与车端** —— PREEMPT_RT、AUTOSAR AP、ISO 26262、车端网络
- 👥 **工程管理** —— EM 知识体系、组织设计、AI 时代的工程管理，配套 EM 模板库
- 📋 **PM 双线** —— 项目管理 + 产品管理双轨学习路线，配套 PM 模板库
- 🎯 **面试速查卡** —— C++ / 架构师 / EM / PM 四套交互式卡片应用，可搜索、筛选、标记掌握度

## 📖 内容导航

| 板块 | 目录 | 主要内容 |
| --- | --- | --- |
| **C++ 语言核心** | [`cpp/`](./cpp) | 编译、对象与内存模型、值类别、模板、异常、现代特性、智能指针、协程、LLVM 工具链、Sanitizer 内部、Modern CMake、并发 |
| **STL & 设计模式** | [`stl/`](./stl) | 容器、算法、GoF 模式（C++ 视角）、并发模式 |
| **性能与调试** | [`perf-debug/`](./perf-debug) | 性能优化、低延迟、内存泄漏、崩溃与死锁调试、Sanitizers、CMake/CI、ABI 兼容、安全硬化、可观测性 |
| **系统与网络** | [`system/`](./system) | Linux 内核 IO、文件描述符、OS 基础、网络编程、异步网络框架 |
| **架构师方法论** | [`architect/`](./architect) | C4 / DDD / ADR、大型 C++ 工程化、分布式系统、存储、可观测性、Capstone、分布式进阶 |
| **AI-Native 工程** | [`ai-native/`](./ai-native) · [`ai-infra/`](./ai-infra) | AI-Native 实践、Prompt 工程、Agent 架构、LLMOps、AI Safety + AI 基础设施 |
| **嵌入式 / 实时 / 车端** | [`embedded-realtime/`](./embedded-realtime) | PREEMPT_RT、AUTOSAR AP、ISO 26262、车端网络 |
| **工程管理 & EM** | [`management/`](./management) | 研发管理、管理知识体系、Senior EM、AI-Native EM、组织设计、EM 模板库 |
| **PM 双线** | [`pm/`](./pm) | PgM × PdM 能力地图、EVM、A/B 测试、干系人、JTBD、PRD、PMBOK + PM 模板库 |
| **面试** | [`interview/`](./interview) | Tech Lead 长文 + C++ / 架构师 / EM / PM 四套交互式卡片应用 |

> 完整目录、跨文档链接、搜索、阅读时长等导航信息都在 [GitHub Pages 站点](https://kavinchan13.github.io/tech-notes/) 上。

## 💡 推荐的几个入口

如果不知道从哪里开始，可以试试这几篇：

- [C++ 对象模型](https://kavinchan13.github.io/tech-notes/cpp/object_model.html) —— vtable、多继承、EBO，那些容易忘记的细节
- [低延迟编程](https://kavinchan13.github.io/tech-notes/perf-debug/low_latency_guide.html) —— 无锁、内核旁路、硬件时间戳
- [架构师 Capstone (C++)](https://kavinchan13.github.io/tech-notes/architect/architect_capstone.html) —— 一个端到端的设计走查：需求 → ADR → 存储 → 可观测性
- [AI Agent Capstone · 端到端 case study](https://kavinchan13.github.io/tech-notes/ai-native/ai_agent_capstone.html) —— 通用 AI Agent 系统设计 case study · 5 ADR + 4 层 RAG + hypothesis-driven 范式 · 把 X06/X08/X09/X11/X12 串成一个端到端实战
- [Transformer 与现代 LLM 架构](https://kavinchan13.github.io/tech-notes/ai-native/transformer_llm_architecture.html) —— Attention/KV-Cache/RoPE/GQA→MLA/MoE，生活类比 + 交互演示
- [vLLM 推理深潜](https://kavinchan13.github.io/tech-notes/ai-infra/inference_serving.html) —— PagedAttention、Continuous Batching、源码导览（C++ 老兵转 AI Infra 的最大杠杆点）
- [AI 工程师 30/60/90 学习路径](https://kavinchan13.github.io/tech-notes/interview/ai_study_path.html) —— 周-by-周计划，3 轨可选（AI Infra / LLM App / ML Research）
- [EM 模板库](https://kavinchan13.github.io/tech-notes/management/em-templates/) —— 1on1、周报、Postmortem、招聘 Scorecard 等可直接复用的模板

## 🚀 部署

仓库已配置 [`.github/workflows/pages.yml`](./.github/workflows/pages.yml)，每次 push 到 `main` 之后会自动发布到 GitHub Pages，没有任何构建步骤。

```bash
git add .
git commit -m "docs: ..."
git push
# 一两分钟后 https://kavinchan13.github.io/tech-notes/ 会自动更新
```

## 📜 关于内容

- 部分较长的文档由 AI 辅助起草，再经过本人人工整理、验证与修订后发布。所有内容只代表个人学习与思考记录，不代表任何雇主、客户或组织的观点，也不构成法律、安全或认证建议。
- 文中提及的 PMBOK<sup>®</sup> / AUTOSAR<sup>®</sup> / ISO / IEC / MISRA 等名称均为各自权利人的注册商标或标准名称，仅用于描述性引用。本仓库与上述组织无任何附属、赞助或背书关系。

## License

[MIT](./LICENSE) © 2026 Kavin Chan
