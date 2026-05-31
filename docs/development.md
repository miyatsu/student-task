# 开发规范与环境配置指导

本指南说明本项目的开发环境、启动方式、验证要求与运行时配置。

## 1. 前置环境

推荐使用现代稳定工具链：

- **操作系统**：Windows 10/11、macOS、主流 Linux 发行版
- **Node.js**：`v20.19+` 或 `v22.13+`
- **npm**：随 Node.js 提供的较新版本
- **Python**：`3.9+`，用于本地 PaddleOCR bootstrap 与运行
- **Ghostscript**：用于 PDF 压缩功能（`/api/compress/start` 路由依赖 `gs` 命令）

低于上述版本的 Node.js 不受支持。图片 OCR 依赖本地 PaddleOCR runtime，因此开发机和演示机都需要具备可调用的 Python。

## 2. 安装依赖

进入项目根目录后执行：

```bash
npm install
```

如果 VS Code 已经打开且刚切换过 Node.js / nvm 版本，集成终端可能尚未刷新环境变量，可先执行：

```powershell
. .\scripts\refresh-node-env.ps1
```

若仍无法识别 `node` 或 `npm`，请重启 VS Code。

安装过程中会同时安装前端依赖、PDF 处理依赖、本地图像增强依赖，以及本地 OCR 运行时。`npm install` 的 `postinstall` 会自动执行 `npm run setup:ocr`，流程包括：

1. 检测本机可用的 Python `3.9+`
2. 创建 `.local/paddleocr/venv`
3. 安装 `paddlepaddle` CPU 版与 `paddleocr`
4. 预热默认 OCR 模型并写入 `.local/paddleocr/cache`

如果自动 bootstrap 因 Python 缺失、网络限制或本地环境异常而中断，可在修复环境后单独执行：

```bash
npm run setup:ocr
```

如需快速验证本地 OCR 运行时是否可用，可执行：

```bash
npm run smoke:ocr
```

该命令会补齐本地 PaddleOCR bootstrap、生成一张样例图片，并通过真实的服务端本地 OCR 调度路径输出耗时与识别结果预览。

## 3. 本地启动

开发模式使用：

```bash
npm run dev
```

该命令会执行 `tsx server.ts`，并在同一个 Express HTTP Server 上挂载 Vite 中间件与 HMR WebSocket，支持前后端联调与热更新。默认端口为 `http://localhost:3000`；若端口已被占用，服务会自动选择下一个可用端口并在终端输出实际地址。

## 4. 构建、预览与部署

### 4.1 生产构建

```bash
npm run build
```

该命令会生成 `dist/` 前端产物。前端构建采用按需加载策略：`PdfEditor`、`AiAssistant`、`ImageEnhanceModal`、`FilePreview` 通过 `React.lazy()` 拆分，`pdf-lib`、`jszip`、`mammoth`、`browser-image-compression` 与部分浏览器端转换依赖通过 `import()` 运行时加载。Vite 会将 `pdf-lib`、`pdfjs-dist`、`mammoth`、`html2canvas`、`@tensorflow/*`、`upscaler` 等依赖拆分为独立 vendor chunk。

### 4.2 生产预览

预览完整生产态：

```bash
npm run preview
```

该命令以生产模式启动 `server.ts` 并服务 `dist/`，适合验证 `.doc` 转 PDF、PDF 转图、压缩、AI gateway、本地 OCR 等依赖 Express 路由的功能。

只预览纯静态前端时，可使用：

```bash
npm run preview:static
```

### 4.3 云端部署

部署到 Cloud Run、VPS、Docker 或其他云平台时：

1. 在构建或镜像初始化阶段执行 `npm install`
2. 确保本地 OCR 运行时已通过 `npm run setup:ocr` 安装完成
3. 在运行平台配置 `GEMINI_API_KEY`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 中的一个或多个
4. 运行阶段使用 `npm run start`

AI key 不需要注入前端产物。服务端会在 `/api/ai/chat` 中按顺序选择首个可用 provider，本地 OCR 则通过 `/api/ocr/image` 调用 PaddleOCR runtime。

## 5. 提交前验证

提交代码前至少执行：

- `npm run lint`
- `npm test`
- `npm run build`

如果改动涉及 PDF 编辑、AI 增强、OCR / AI 对话、Word HTML fallback 等按需加载功能，还应在构建后手动打开这些入口，确认惰性 chunk 可以正常加载。

项目未强制依赖 Prettier 配置；新增 React 组件时请保持现有 Tailwind CSS utility class 风格，并将具备复用属性的逻辑放入对应功能包。

## 6. Word 转 PDF 的本地依赖

Word 转 PDF 的默认顺序为：`Microsoft Word 原生导出 -> LibreOffice CLI -> HTML fallback`。

- 如需最高保真度，请优先确保本机安装并可调用 Microsoft Word。
- 如需复现第二优先级链路，请安装 LibreOffice，并确保 `soffice` 可被系统路径或默认安装目录检测到。
- 项目不会在 `npm install` 阶段自动安装 Microsoft Word 或 LibreOffice。
- `docx2pdf`、`pywin32`、UNO / `unoconv` 等 Python 或脚本方案属于调用包装层，不视为独立渲染引擎。

## 7. 运行时环境变量

AI 助手依赖服务端环境变量；图片 OCR 不依赖这些 key，而是依赖本地 PaddleOCR runtime。

### 7.1 获取 AI Provider Key

默认 provider 顺序为：`Gemini -> OpenAI / ChatGPT -> DeepSeek`。

- Gemini：<https://aistudio.google.com/app/apikey>
- OpenAI / ChatGPT：<https://platform.openai.com/api-keys>
- DeepSeek：<https://platform.deepseek.com/api_keys>

可以只配置一个 provider，也可以同时配置多个 key。若同时存在多个 key，服务端会按顺序自动选择首个可用 provider。

### 7.2 本地开发

在项目根目录创建 `.env` 文件，并填写：

```text
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
```

随后执行：

```bash
npm run dev
```

开发服务器运行后补建 `.env` 时，刷新页面或重新打开 AI 助手即可触发新的运行时配置探测。未配置任何 AI key 时，基础文件处理与本地 OCR 仍可继续使用，只要本地 PaddleOCR runtime 已准备完成。

### 7.3 云端运行

在平台环境变量面板中配置与 `.env` 同名的 key，并使用 `npm run start` 启动服务。服务端会在运行时读取这些变量，并仅向浏览器暴露配置摘要而不是原始 key。

### 7.4 故障排查

AI 助手失败时，可按以下顺序排查：

1. API key 被拒绝：检查 key 是否错误、过期或权限不足
2. 配额或速率限制：检查账号额度并等待恢复
3. AI provider 网络不可达：检查网络、防火墙、代理、VPN、DNS 或区域访问限制
4. 模型不可用：检查 provider 账号与模型权限
5. 请求参数被拒绝：检查提交给 AI 的文件内容与请求结构

图片 OCR 失败时，可优先检查：

1. 本机是否安装 Python `3.9+`
2. `npm install` 或 `npm run setup:ocr` 是否执行成功
3. `.local/paddleocr/venv` 与 `.local/paddleocr/cache` 是否存在
4. 是否需要重新执行 `npm run setup:ocr` 补齐 PaddleOCR 与离线模型
5. 执行 `npm run smoke:ocr`，确认本地 OCR smoke 链路是否可以稳定返回结果

> 不要将 `.env` 或任何计费密钥提交到 Git 仓库。

---

*实现细节请参考 [技术与实现文档](./implementation.md)，系统分层请参考 [架构设计文档](./architecture.md)。*
