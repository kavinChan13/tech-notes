# Tech Notes

一份个人沉淀的技术与管理知识库。覆盖 **C++ 工程深入主题**、**系统/IO/调试**、**工程管理与 EM 模板**、**面试与 Tech Lead 准备**。所有文档均为独立 HTML，可直接在浏览器打开，也可通过 GitHub Pages 在线浏览。

> 在线访问：发布 GitHub Pages 后，入口为 `https://<your-username>.github.io/tech-notes/`

---

## 快速导航

> 推荐入口：[`index.html`](./index.html) — 一个聚合所有文档的统一导航首页。

### I · C++ 语言核心

| 文档 | 主题 |
|---|---|
| [cpp_compilation_guide.html](./cpp_compilation_guide.html) | 编译流程、链接、ODR |
| [cpp_object_model.html](./cpp_object_model.html) | 对象模型、内存布局、虚表 |
| [cpp_memory_model.html](./cpp_memory_model.html) | 内存模型、原子、顺序一致性 |
| [cpp_value_categories_guide.html](./cpp_value_categories_guide.html) | 左值/右值/将亡值 |
| [cpp_type_conversions_guide.html](./cpp_type_conversions_guide.html) | 隐式/显式类型转换、四类 cast |
| [cpp_templates_guide.html](./cpp_templates_guide.html) | 模板、SFINAE、CRTP |
| [cpp_exceptions_guide.html](./cpp_exceptions_guide.html) | 异常、RAII、noexcept |
| [cpp_modern_features_ppt.html](./cpp_modern_features_ppt.html) | C++11/14/17/20 现代特性 |

### II · STL 与设计模式

| 文档 | 主题 |
|---|---|
| [cpp_stl_containers_ppt.html](./cpp_stl_containers_ppt.html) | STL 容器实现与选型 |
| [cpp_stl_algorithms_ppt.html](./cpp_stl_algorithms_ppt.html) | STL 算法库 |
| [cpp_design_patterns_ppt.html](./cpp_design_patterns_ppt.html) | C++ 视角的设计模式 |
| [cpp_concurrency_patterns_guide.html](./cpp_concurrency_patterns_guide.html) | 并发模式 |

### III · 性能 / 调优 / 调试

| 文档 | 主题 |
|---|---|
| [cpp_performance_guide.html](./cpp_performance_guide.html) | 性能优化 |
| [cpp_low_latency_guide.html](./cpp_low_latency_guide.html) | 低延迟编程 |
| [cpp_memory_leak_guide.html](./cpp_memory_leak_guide.html) | 内存泄漏定位与排查 |
| [cpp_crash_debugging_guide.html](./cpp_crash_debugging_guide.html) | 崩溃调试 |
| [cpp_deadlock_debugging_guide.html](./cpp_deadlock_debugging_guide.html) | 死锁调试 |
| [cpp_sanitizers_guide.html](./cpp_sanitizers_guide.html) | ASan / TSan / UBSan |
| [cpp_cmake_ci_guide.html](./cpp_cmake_ci_guide.html) | CMake & CI |

### IV · 系统 / IO / 网络

| 文档 | 主题 |
|---|---|
| [CPP_IO_Linux_Kernel_Guide.html](./CPP_IO_Linux_Kernel_Guide.html) | Linux 内核 IO、Page Cache、Direct IO |
| [FileDescriptor_DeepDive.html](./FileDescriptor_DeepDive.html) | 文件描述符深入 |
| [cpp_os_fundamentals.html](./cpp_os_fundamentals.html) | 操作系统基础 |
| [cpp_networking_guide.html](./cpp_networking_guide.html) | 网络编程 |

### V · 工程管理与 EM 模板

| 文档 | 主题 |
|---|---|
| [software_management_guide.html](./software_management_guide.html) | 软件研发管理指南 |
| [management_knowledge_system.html](./management_knowledge_system.html) | 管理知识体系 |
| [em-templates/index.html](./em-templates/index.html) | **EM Templates · Library**（12 份模板：1on1、QBR、Postmortem、ADR、Hiring Scorecard 等） |

### VI · 面试 / Tech Lead

| 文档 | 主题 |
|---|---|
| [tech_lead_interview_guide.html](./tech_lead_interview_guide.html) | Tech Lead 面试指南 |
| [cpp_interview_cards.html](./cpp_interview_cards.html) | C++ 面试速查卡 |

---

## 项目结构

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

## 本地预览

直接双击任意 `.html` 文件用浏览器打开即可。如果希望以本地服务器方式访问（更接近 Pages 行为）：

```bash
# Python
python -m http.server 8080

# 或者 Node
npx serve .
```

然后访问 `http://localhost:8080/index.html`。

## GitHub Pages 部署

仓库已配置 `.github/workflows/pages.yml`，推送到 `main` 分支后会自动发布到 GitHub Pages。
首次启用步骤：

1. Push 到 GitHub。
2. 进入仓库 **Settings → Pages**，**Source** 选择 **GitHub Actions**。
3. 等首次工作流跑完，访问 `https://<your-username>.github.io/tech-notes/`。

## License

[MIT](./LICENSE)
