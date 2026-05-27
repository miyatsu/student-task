# 多功能文件处理系统 (Web App)

PCIE 是一个本地优先的 Web 文档工作区。上传、排序、转换、提取、增强、导出，在同一块面板里完成。

当前工作区支持更直观的排序胶囊按钮、按名称自然排序、逐文件上移/下移，并且在图片与 Word 批量转 PDF 时都会显示实时绿色进度卡片；Word 转 PDF 进度现在会同时显示已用时长与当前采用的转换方式，完成时会在列表内收束到 `100%` 而不是打断式成功弹窗。当前默认的高保真 Word 转 PDF 策略以“转换质量第一，稳定性第二，性能第三”为原则，按 `本地 Microsoft Word 原生导出 -> LibreOffice CLI -> 浏览器 HTML fallback` 的顺序尝试；旧版 `.doc` 文档也可以通过内置的服务端提取链路转成 PDF。

首页入口也已调整为更偏“工作台入口”而不是“功能陈列”的结构：首屏直接组合产品价值说明与真实 Workspace Upload 面板，用户可以在第一屏直接选择文件或拖拽上传，再往下查看 PDF / Image / Word 三类核心能力说明。

当前项目认可的 Word 转 PDF 可行链路主要有四类：
- `Microsoft Word 原生导出`：Windows + 本地 Word 可用时，通常最接近用户在 Word 中“另存为 PDF”的结果，质量最高。
- `LibreOffice CLI`：适合跨平台和批处理环境，稳定性与自动化体验较好，但复杂 Office 样式的保真度通常略低于 Word 原生。
- `浏览器 HTML fallback`：无需额外本地 Office 依赖，兜底能力最强，但复杂布局的保真度最低。
- `Python 封装层`：如 `docx2pdf`、`pywin32`、UNO / `unoconv` 等，更多是对 Word 或 LibreOffice 的调用包装，不是新的独立渲染引擎，因此不单独作为默认优先级。

Word 转 PDF 继续遵循 local-first：`DOCX` 在浏览器内直接转 HTML 并生成 PDF，旧版 `.doc` 走项目内置的本地 Express 提取链路，不依赖外部 Office 安装、云端转换服务或额外运行时。最近还修复了 Word 导出偶发空白 PDF 的问题，当前渲染会通过隐藏宿主层在本地完成，避免离屏源节点被 `html2pdf` 克隆后高度塌成 `0`。

当前工作区还支持按名称自然排序、对单个文件执行行内上移/下移，以及在批量图片转 PDF 时提供实时进度反馈，方便在混合文件流里做细粒度整理与转换。

## PCIE 宣传语

- 中文宣传语
> 本地优先，AI 自选。PCIE，为你的文档加速。

- 英文宣传语
> "Local-first, AI-optional. PCIE — Your documents, accelerated."

## 命名诠释：PCIE

将 PCIE 拆解为四大核心特性，每个字母恰好对应系统的一个关键能力，同时也呼应计算机中 PCIe 总线 高速、直连、按需扩展的特点：

- **P** — Privacy & PDF（隐私与 PDF 中枢）
系统以本地优先为基石，你的文件从不离浏览器，隐私完全由你掌控。同时，所有处理围绕 PDF 展开：图片、Word 均能转为 PDF，形成统一的文档中枢。

- **C**: Convert, Compress, Combine（转换、压缩、合并）
这是工作区里的“变形”能力：图片转 PDF、Word 转 PDF、PDF 压缩、多 PDF 合并，一站式完成，无需跳转多个工具。

- **I**: Image & Intelligence（图像增强与智能随选）
支持本地增强图片，同时将 AI 设为可选项。仅在需要时开启 Gemini，获得 AI 聊天和 OCR 识别，让智能随需而至，不打扰、不捆绑。

- **E**: Extract & Export（提取与统一导出）
提取页面、提取图像、提取文本，最后将处理结果统一打包导出，让整个流程有始有终，干净利落。

就像 PCIe 总线为计算机部件提供高速直连通道一样，PCIE 为你的文档处理搭建了一条私密、灵活、高效的一站式流水线。

## 📖 工程项目规范指引目录

出于现代软件工程维护的高要求以及防内容分发重复。一切详尽系统的操作、技术路线和测试方法均位于本项目的 `docs/` 目录下。请通过下列本地相对链接进行进一步的探讨与阅读：

| 领域 | 文档访问地址 | 详情说明 |
|:---|:---|:---|
| **新手指南 / 用户篇** | [用户手册 (User Manual)](./docs/user-manual.md) | 关于如何使用本应用的核心指引，介绍各种文件（PDF/Word/图像变清晰）的操作步骤。 |
| **产品与设计 / 需求篇** | [需求分析文档 (Requirements)](./docs/requirements.md) | 深入解析该系统为什么而建，用户角色，以及核心功能的边界和用例。 |
| **技术底座 / 架构篇** | [架构设计文档 (Architecture)](./docs/architecture.md) | 解析底层所采用的技术集合以及前后端的切分流转关系。 |
| **运行与编译 / 开发环境搭建** | [开发环境配置指导 (Development)](./docs/development.md) | 如果你需要克隆本机并在本地机器将此代码运行起来或开发，必读的环境搭建步骤。 |
| **实现思路 / 技术原理** | [技术与实现文档 (Implementation)](./docs/implementation.md) | 最底层的核心技术实现、疑难设计与关键组件说明。 |
| **质量保证 / 测试篇** | [集成与人工测试方案 (Testing)](./docs/testing.md) | 发版部署前必须的用例追踪清单，以维持产品的极高稳定性。 |

> 注：关于各类详细的 UML 图片/系统交互图等物理源码也保存在 `docs/puml/` 目录中。

开发模式补充说明：`npm run dev` 默认监听 `http://localhost:3000`；如果 3000 已被占用，服务会自动切换到下一个可用端口，并在终端打印实际访问地址。

生产预览补充说明：`npm run preview` 现在会以 `NODE_ENV=production` 启动完整的 Express + API 服务器，并直接服务 `dist/` 产物，因此像 `.doc` 转 PDF、PDF 转图等依赖后端接口的功能也能在预览阶段真实可用；如果只想看纯静态前端，可使用 `npm run preview:static`。

仓库中的自动化回归测试通过 `npm test` 运行，当前覆盖纯逻辑、文件列表 UI 回归、自然排序与行内移动规则、图片/Word 转 PDF 进度展示、旧版 `.doc` 提取辅助逻辑、PDF 页操作、Gemini 运行时配置加载以及服务端运行时配置 / PDF 压缩辅助逻辑；另有一组开发期诊断与手工验证脚本位于 `scripts/experiments/`，按 `diagnostics/`、`manual/`、`spikes/` 分类保存，它们不会进入默认测试流水线。

如果这是从 Google AI Studio 导出的项目，请额外注意：AI Studio 托管环境通常会替你注入 Gemini 所需的密钥；本地运行时如果没有在项目根目录配置 `.env` 中的 `GEMINI_API_KEY`，基础文件处理界面仍然可以正常打开，但 Gemini 聊天与基于 Gemini 的 OCR 能力会保持禁用并提示如何配置。

Gemini Key 配置速览：
- 免费独立 Key 可在 Google AI Studio 开发者控制台申请：<https://aistudio.google.com/app/apikey>。免费层通常足够覆盖本地试用或轻量公开演示。
- 本地运行时，在项目根目录创建 `.env` 并写入 `GEMINI_API_KEY=你的专属 API Key`，然后执行 `npm run dev`。
- 云端部署时，无需改代码；只需在平台环境变量里设置 `GEMINI_API_KEY`。构建完成后，`npm run start` 启动的 `server.ts` 会在运行时读取该值并提供给浏览器端 AI 功能。

---
*本项目不强制绑定远端的云端数据库或者依赖云侧持久化存储，核心在于使用浏览器内置机能（`tf.js`, Web Workers 等）保护您的重要事务文档数据安全。*
