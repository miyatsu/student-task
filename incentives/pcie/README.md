# 多功能文件处理系统 (Web App)

PCIE 是一个本地优先的 Web 文档工作区。上传、排序、转换、提取、增强、导出，在同一界面内完成。

工作区围绕三类文件展开：PDF、图片、Word。文件列表支持自然排序、拖拽重排、行内上移/下移、重命名、复制、批量删除与 Zip 导出。图片与 Word 的批量转 PDF 流程都提供进度卡片；Word 转 PDF 会显示已用时长与正在使用的转换方式。Word 转 PDF 采用质量优先的本地链路：`本地 Microsoft Word 原生导出 -> LibreOffice CLI -> 浏览器 HTML fallback`；旧版 `.doc` 文档通过服务端文本提取链路参与转换。

首页采用工作台入口结构，下图展示了应用的首页初始状态：

![PCIE homepage initial state](./docs/assets/homepage-initial-state.png)

首页的首屏由三部分组成：顶部 Hero 负责说明 `Local-first by default` 与 `AI only when configured` 这两个产品前提；中段 `Workspace Upload` 面板承接文件导入；下方 capability strip 以 PDF、Image、Word 三条 workflow 概括后续能力。首页使用单一上传入口，支持 `PDF`、`DOC / DOCX`、`PNG / JPG / JPEG` 三类格式，并通过 `Choose files` 按钮与拖拽提示引导用户进入工作区。

前端构建采用按需加载策略。`PdfEditor`、`AiAssistant`、`ImageEnhanceModal`、`FilePreview` 通过 `React.lazy()` 独立拆包；`pdf-lib`、`jszip`、`mammoth`、`browser-image-compression` 与部分浏览器端转换依赖通过运行时 `import()` 加载。Vite 会把 `pdf-lib`、`pdfjs-dist`、`mammoth`、`html2canvas`、`tfjs` 等较重依赖拆分为独立 vendor chunk，并将 `chunkSizeWarningLimit` 设为 `900`，以便将构建告警集中到真正异常的产物上。

Word 转 PDF 支持四类可选链路：
- `Microsoft Word 原生导出`：Windows 环境下的最高保真方案。
- `LibreOffice CLI`：适合跨平台与批处理环境。
- `浏览器 HTML fallback`：不依赖本地 Office 组件的兜底方案。
- `Python 封装层`：例如 `docx2pdf`、`pywin32`、UNO / `unoconv` 等，它们本质上是对 Word 或 LibreOffice 的调用包装，不作为独立渲染引擎。

Word 浏览器导出链路使用隐藏宿主容器承载 HTML 内容，使传入 `html2pdf` 的源节点保持在普通文档流中，保证本地渲染与布局稳定性。

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
支持本地增强图片，并把“图像理解”和“语言智能”拆分为两条独立路径：图片 OCR 通过本地 PaddleOCR 离线完成，不依赖任何云端 key；AI 助手在需要总结、问答或多文档分析时，通过已配置的 Gemini、OpenAI、DeepSeek 自动选择首个可用 provider。

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

开发模式使用 `npm run dev`，默认监听 `http://localhost:3000`；如果端口已被占用，服务会自动选择下一个可用端口并在终端打印实际访问地址。

生产预览使用 `npm run preview`，它会以 `NODE_ENV=production` 启动完整的 Express + API 服务器并直接服务 `dist/` 产物；如果只需纯静态前端预览，可使用 `npm run preview:static`。预览生产包时，建议顺手打开 AI 增强、PDF 编辑、预览、OCR 与 AI 对话入口，确认按需下载的功能块能够正常加载。

自动化回归通过 `npm test` 运行，覆盖文件领域纯逻辑、文件列表 UI、自然排序与行内移动、图片/Word 转 PDF 进度、旧版 `.doc` 提取辅助逻辑、PDF 页操作、前端运行时配置加载，以及服务端 AI provider fallback、本地 OCR 运行时配置与 PDF 压缩辅助逻辑。开发期诊断与手工验证脚本位于 `scripts/experiments/`，按 `diagnostics/`、`manual/`、`spikes/` 分类保存，不进入默认测试流水线。

如果这是从 Google AI Studio 导出的项目，请额外注意：AI Studio 托管环境通常只会替它自己的 Gemini 能力注入密钥；本地运行时如果没有在项目根目录配置可用的 `.env`，你仍然需要自行提供 `GEMINI_API_KEY`、`OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY` 中的一个或多个。

AI 与 OCR 配置速览：
- 支持的 AI provider 默认尝试顺序是 `Gemini -> OpenAI / ChatGPT -> DeepSeek`。如果你同时配置了多个 key，AI 助手会按这个顺序使用首个可完成当前任务的 provider。
- 获取独立 Key：Gemini 在 Google AI Studio 申请 <https://aistudio.google.com/app/apikey>；OpenAI / ChatGPT 在 OpenAI Platform 申请 <https://platform.openai.com/api-keys>；DeepSeek 在 DeepSeek Platform 申请 <https://platform.deepseek.com/api_keys>。
- 图片 OCR 不依赖这些 AI key。它通过本地 PaddleOCR 运行时执行；`npm install` 会自动执行 `npm run setup:ocr`，创建项目内的 Python 虚拟环境、安装 PaddlePaddle / PaddleOCR，并预热离线模型。
- 如需快速验证本地 OCR 运行时本身，可执行 `npm run smoke:ocr`。该命令会补齐本地 PaddleOCR bootstrap、生成一张样例图片，并输出一次真实 OCR 请求的耗时与识别结果预览。
- 为了让本地 OCR bootstrap 成功，机器上需要预先安装 Python `3.9+`。如果安装阶段因为 Python 缺失或网络原因中断，可以在补齐环境后手动重跑 `npm run setup:ocr`。
- 本地运行 AI 助手时，在项目根目录创建 `.env` 并写入一个或多个 key，例如 `GEMINI_API_KEY=...`、`OPENAI_API_KEY=...`、`DEEPSEEK_API_KEY=...`，然后执行 `npm run dev`。
- 如果 `npm run dev` 已经先启动、随后才补建 `.env`，`/api/runtime-config` 会在后续 AI 请求时重新读取该文件；刷新页面或重新打开 AI 助手即可。图片 OCR 的可用性取决于本地 PaddleOCR runtime 是否完成安装。
- 云端部署时，无需改前端代码；只需在平台环境变量里设置同名 AI key。`npm run start` 启动的 `server.ts` 会在服务端 `/api/ai/chat` gateway 中按顺序选择 provider，而图片 OCR 则通过本地 `/api/ocr/image` route 调用 PaddleOCR，浏览器不会直接拿到这些原始 key。
- AI 相关报错会区分“API key 被拒绝”“配额/速率限制”“AI provider 网络不可达”“模型不可用”或“请求参数不合法”；本地 OCR 报错会区分 Python / PaddleOCR 未安装、离线模型未预热或本地 OCR runner 异常。

---
*本项目不强制绑定远端的云端数据库或者依赖云侧持久化存储，核心在于使用浏览器内置机能（`tf.js`, Web Workers 等）保护您的重要事务文档数据安全。*
