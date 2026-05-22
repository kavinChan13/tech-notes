<div align="center">

# Tech Notes

### 📚 个人技术与管理知识库

_C++ 系统编程 · 性能与调试 · 操作系统/网络 IO · 工程管理 · EM 模板_

[![Pages](https://img.shields.io/badge/GitHub_Pages-Live-2ea44f?style=for-the-badge&logo=github)](https://kavinchan13.github.io/tech-notes/)
[![License](https://img.shields.io/badge/License-MIT-1c3a5e?style=for-the-badge)](./LICENSE)
[![Docs](https://img.shields.io/badge/Docs-44_HTML-1c3a5e?style=for-the-badge)](https://kavinchan13.github.io/tech-notes/)

---

## 🌐 在线阅读

### **[🚀 进入知识库首页](https://kavinchan13.github.io/tech-notes/)**

无需下载，浏览器直接打开即可阅读全部 30 篇技术与管理指南 + 12 份 EM 模板

</div>

---

## 🎯 项目介绍

这里聚合了我在长期工作中沉淀的技术与管理笔记，覆盖：

- **C++ 工程深入**：编译、对象模型、内存模型、模板、异常、并发、现代特性
- **STL 与设计模式**：容器/算法实现剖析，C++ 视角的 GoF 模式与并发模式
- **性能与调试**：性能优化、低延迟、内存泄漏、崩溃/死锁调试、Sanitizers、CMake & CI
- **系统/IO/网络**：Linux 内核 IO、文件描述符、操作系统基础、网络编程
- **工程管理**：软件研发管理指南、管理知识体系、12 份 EM 必备模板
- **面试与 Tech Lead**：Tech Lead 面试指南、C++ 面试速查卡

所有文档均为独立 HTML 单文件，可离线阅读，也可通过 GitHub Pages 在线浏览。

---

## 📖 内容导航

> 下面所有链接默认指向 [GitHub Pages 在线版](https://kavinchan13.github.io/tech-notes/)，点击即可在浏览器渲染。

### I · C++ 语言核心

| 文档 | 主题 |
|---|---|
| [编译流程指南](https://kavinchan13.github.io/tech-notes/cpp_compilation_guide.html) | 预处理 / 编译 / 汇编 / 链接、ODR、符号、链接错误排查 |
| [C++ 对象模型](https://kavinchan13.github.io/tech-notes/cpp_object_model.html) | 内存布局、虚函数表、多重/菱形继承、空基类优化 |
| [C++ 内存模型](https://kavinchan13.github.io/tech-notes/cpp_memory_model.html) | 原子、memory order、与硬件 cache 一致性 |
| [值类别](https://kavinchan13.github.io/tech-notes/cpp_value_categories_guide.html) | lvalue / rvalue / xvalue / prvalue / glvalue 全景 |
| [类型转换](https://kavinchan13.github.io/tech-notes/cpp_type_conversions_guide.html) | 隐式转换、四类 cast、UDC 与陷阱 |
| [模板深入](https://kavinchan13.github.io/tech-notes/cpp_templates_guide.html) | 函数/类模板、特化、SFINAE、CRTP、变参模板 |
| [异常与 RAII](https://kavinchan13.github.io/tech-notes/cpp_exceptions_guide.html) | throw/catch、异常安全等级、noexcept、栈展开 |
| [C++ 现代特性](https://kavinchan13.github.io/tech-notes/cpp_modern_features_ppt.html) | C++11/14/17/20/23/26 重要特性精讲（含 C++26 std::execution / Reflection / Pattern Matching） |
| [智能指针深度](https://kavinchan13.github.io/tech-notes/cpp_smart_pointers_deep_dive.html) | unique / shared / weak / atomic / intrusive：控制块剖析、aliasing、多线程真相、跨 ABI 坑 |

### II · STL 与设计模式

| 文档 | 主题 |
|---|---|
| [STL 容器](https://kavinchan13.github.io/tech-notes/cpp_stl_containers_ppt.html) | vector/map/unordered_map/list/deque 实现剖析与选型 |
| [STL 算法](https://kavinchan13.github.io/tech-notes/cpp_stl_algorithms_ppt.html) | algorithm/numeric/ranges 常用算法与复杂度速查 |
| [设计模式（C++ 视角）](https://kavinchan13.github.io/tech-notes/cpp_design_patterns_ppt.html) | 23 种 GoF 模式 + 现代 C++ 重写：Pimpl、Type Erasure、Policy |
| [并发模式](https://kavinchan13.github.io/tech-notes/cpp_concurrency_patterns_guide.html) | 线程池、Producer-Consumer、读者写者、无锁队列 |

### III · 性能 / 调优 / 调试

| 文档 | 主题 |
|---|---|
| [性能优化](https://kavinchan13.github.io/tech-notes/cpp_performance_guide.html) | 缓存友好、分支预测、SIMD、profile 驱动优化 |
| [低延迟编程](https://kavinchan13.github.io/tech-notes/cpp_low_latency_guide.html) | 无锁、内存预分配、CPU 亲和、Hot/Cold 路径 |
| [内存泄漏排查](https://kavinchan13.github.io/tech-notes/cpp_memory_leak_guide.html) | Valgrind / ASan / heaptrack / pmap，从工具到方法论 |
| [崩溃调试](https://kavinchan13.github.io/tech-notes/cpp_crash_debugging_guide.html) | core dump、gdb、backtrace、信号处理、生产复现 |
| [死锁调试](https://kavinchan13.github.io/tech-notes/cpp_deadlock_debugging_guide.html) | 检测、复现、TSan，与锁层级化设计 |
| [Sanitizers](https://kavinchan13.github.io/tech-notes/cpp_sanitizers_guide.html) | ASan / TSan / UBSan / MSan 启用、解读、CI 集成 |
| [CMake & CI](https://kavinchan13.github.io/tech-notes/cpp_cmake_ci_guide.html) | 现代 CMake 写法 + GitLab/GitHub Actions CI 实战 |

### IV · 系统 / IO / 网络

| 文档 | 主题 |
|---|---|
| [Linux 内核 IO 指南](https://kavinchan13.github.io/tech-notes/CPP_IO_Linux_Kernel_Guide.html) | Page Cache、Direct IO、io_uring、零拷贝 |
| [文件描述符深入](https://kavinchan13.github.io/tech-notes/FileDescriptor_DeepDive.html) | fd 表、open file 表、inode 表、dup/fork/exec |
| [操作系统基础](https://kavinchan13.github.io/tech-notes/cpp_os_fundamentals.html) | 进程/线程、调度、内存管理、虚拟内存、系统调用 |
| [网络编程](https://kavinchan13.github.io/tech-notes/cpp_networking_guide.html) | socket、epoll、TCP 状态机、Reactor、HTTP/2 |

### V · 工程管理与 EM 模板

| 文档 | 主题 |
|---|---|
| [软件研发管理指南](https://kavinchan13.github.io/tech-notes/software_management_guide.html) | 立项 / 迭代 / 质量 / 交付 / 回顾，IC → Manager 转型 |
| [管理知识体系](https://kavinchan13.github.io/tech-notes/management_knowledge_system.html) | 人 / 事 / 组织 三轴展开，配套阅读地图与决策框架 |
| **[EM Templates · Library](https://kavinchan13.github.io/tech-notes/em-templates/)** | **12 份必备模板：1on1、Weekly Update、QBR、Postmortem、ADR、Hiring Scorecard…** |
| **[高级管理者知识体系](https://kavinchan13.github.io/tech-notes/senior_manager_knowledge_system.html)** | **Line Manager → Senior EM 8 大模块：商业财务 / 管经理人 / 战略 / 向上沟通 / 人的高阶 / 跨文化 + 42 道面试题与高分答案** |
| **[AI 时代的工程管理](https://kavinchan13.github.io/tech-notes/ai_native_engineering_management.html)** | **GenAI 对 EM 的 6 大根本性影响：流程重塑 / 效能度量 / 招聘标准 / 团队系统 / 风险合规 / Telecom 场景 + 10 道高频面试题** |

### VI · 面试 / Tech Lead

| 文档 | 主题 |
|---|---|
| [Tech Lead 面试指南](https://kavinchan13.github.io/tech-notes/tech_lead_interview_guide.html) | 技术深度 + 系统设计 + 领导力，TL 面试全维度准备 |
| [C++ 面试速查卡](https://kavinchan13.github.io/tech-notes/cpp_interview_cards.html) | 高频考点速查，按主题组织，面试前一晚的 cram sheet |

---

## 📂 项目结构

```
tech-notes/
├── index.html                  # 统一导航首页（GitHub Pages 入口）
├── README.md
├── LICENSE
├── *.html                      # 顶层文档（C++、系统、管理、面试等）
├── em-templates/               # EM 模板库（12 份模板 + index 页）
│   ├── index.html
│   ├── shared.css
│   ├── shared.js
│   └── 01..12 *.html
└── .github/workflows/pages.yml # GitHub Pages 自动部署
```

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
