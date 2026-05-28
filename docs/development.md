# 开发规范与环境配置指导

欢迎参与多功能文件处理系统的开发工作。本指南为参与此 Web 项目的研发者提供快速启动环境流程。

## 1. 基础环境前置要求
本系统广泛运用了 ES Modules 和较新的语言特性，推荐运行在现代稳定的工具链之上：
- **操作系统**：Windows 10/11 (WSL 推荐)，macOS，或各大 Linux 发行版。
- **Node.js**: `v20.19+` 或 `v22.13+` 稳定版。低于该版本的 Node.js 会在 `npm install` 前被直接拒绝，因为当前依赖链（Vite / pdfjs 等）已不再支持 Node 18。
- **npm**: 随同 Node.js 提供的较新版本进行包管理。
- **Python**: `3.9+`。图片 OCR 现在通过本地 PaddleOCR 完成，`npm install` 会自动创建项目内虚拟环境并安装 PaddlePaddle / PaddleOCR，因此开发机和演示机需要预先具备可调用的 Python。

## 2. 下载及依赖安装

请将项目的源码克隆至本地，或如果是平台（如 AI Studio 等）已经挂载的环境，直接通过 Terminal 终端进入。

1. **进入项目根目录：**（确保你能够看到 `package.json` 文件）
2. **安装所有的第三方依赖：**

如果你是在 **VS Code 已经打开** 的情况下，刚刚安装或切换了 Node.js / nvm 版本，当前集成终端可能还没有拿到新的环境变量，表现通常是 `npm` / `node` “无法识别命令”。此时请先执行：

```powershell
. .\scripts\refresh-node-env.ps1
```

如果仍然无效，再完全关闭并重新打开 VS Code。

由于内置了大型机器学习依赖 (`@tensorflow/tfjs`, `upscaler`) 以及 PDF 解析库，该步骤可能耗时几十秒。
当前依赖集不再包含 `better-sqlite3` 这类 sqlite 原生编译模块；只要使用受支持的 Node.js 版本，常规 `npm install` 不应再要求 Visual Studio C++ Build Tools。若安装失败，优先检查 Node.js 版本与网络访问 npm registry 的情况。

从这一版开始，`npm install` 还会在 `postinstall` 阶段自动执行 `npm run setup:ocr`：

1. 检测本机可用的 Python `3.9+`
2. 在项目内创建 `.local/paddleocr/venv`
3. 安装 `paddlepaddle` CPU 版与 `paddleocr`
4. 预热默认 OCR 模型，把离线所需的权重下载到 `.local/paddleocr/cache`

因此，第一次安装依赖会比之前更久一些，但换来的结果是图片 OCR 在安装完成后即可离线使用，而不需要再向任何云端 OCR provider 请求。

```bash
npm install
```

如果自动 bootstrap 因 Python 缺失、网络限制或本地环境异常而中断，可以在修复环境后单独重跑：

```bash
npm run setup:ocr
```

## 3. 本地启动与调试

在项目的根目录下执行如下脚本：
```bash
npm run dev
```
此命令将触发 `package.json` 里的 `"tsx server.ts"`，同时在同一个 Express HTTP Server 上挂载 Vite 中间件和 HMR WebSocket，以便提供前后端联调并在修改文件后支持热模块替换（如果禁用则为刷新式开发机制）。
此时控制台会打印实际绑定的端口。默认优先使用 `http://localhost:3000`；如果该端口已被其他进程占用，开发服务器会自动顺延到下一个可用端口（如 `http://localhost:3001`），避免直接因端口冲突退出。

## 4. 前端打包与生产测试
如需向线上服务器发布静态资产：

```bash
npm run build
```
这一步会将所有的 React 组件、本地的 tfjs 流水线以及 CSS 打包到根目录下的 `dist/` 文件夹中。同时因为通过 esbuild 将相关 node runtime（`server.ts`）捆绑为能够利用的执行文件，随后可通过 `npm run start` 确认与线上等同的运行效果。

当前前端构建还包含一层针对大依赖的收束策略：`PdfEditor`、`AiAssistant`、`ImageEnhanceModal`、`FilePreview` 这些不属于首页首屏的工具入口会被 `React.lazy()` 拆成独立 chunk；`pdf-lib`、`jszip`、`mammoth`、`browser-image-compression` 和部分浏览器端 fallback 依赖则会在运行时通过 `import()` 拉起。与此同时，Vite 会把 `pdf-lib`、`pdfjs-dist`、`mammoth`、`html2canvas`、`@tensorflow/*`、`upscaler` 等重依赖继续拆成单独的 vendor chunk，避免它们重新回流到首页主包。

由于这些 chunk 大多只在 PDF 编辑、AI 增强、OCR / AI 对话或浏览器端 Word fallback 时才会下载，`vite.config.ts` 里的 `chunkSizeWarningLimit` 被调整为 `900`。如果未来 `npm run build` 再次出现 chunk 告警，优先判断它是否落在首页主入口；如果只是某个惰性工具块单独膨胀，再决定是继续拆包还是接受该功能的按需体积。

如果你想在本地预览“带后端 API 的生产态”，请在构建完成后执行：

```bash
npm run preview
```

这个脚本会直接用生产模式启动 `server.ts` 并服务 `dist/`，因此 `.doc` 转 PDF、PDF 转图、压缩等依赖 Express 路由的能力都能一起验证。如果只想临时查看纯静态前端资源，而不需要任何 API，可额外使用：

```bash
npm run preview:static
```

如果你要把应用部署到 Cloud Run、VPS、Docker 容器或其他云平台，AI provider 的 API key 不需要在构建阶段硬编码到前端产物里。只要在运行平台配置好 `GEMINI_API_KEY`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 中的一个或多个，`npm run start` 启动时的 `server.ts` 就会在服务端的 `/api/ai/chat` gateway 中按顺序选择首个可用 provider。与此同时，图片 OCR 所需的 PaddleOCR runtime 也应在镜像构建或机器初始化阶段通过 `npm install` / `npm run setup:ocr` 一并装好，这样 `/api/ocr/image` 才能保持真正的本地离线可用。

## 5. 项目风格及代码提交
在提交代码之前：
- 请运行 `npm test` 以验证已抽离的纯逻辑模块没有发生行为回归。
- 请运行 `npm run lint` 以检查可能的 TypeScript 类型语法错误以及未捕捉的反模式调用。
- 如果本轮修改影响了前端运行逻辑或共享模块，请额外运行 `npm run build` 做一次打包验证。
- 如果本轮修改触及 PDF 编辑、AI 增强、OCR / AI 对话、Word HTML fallback 等重功能入口，请在 `npm run build` 后手动打开这些入口确认惰性 chunk 也能被正常加载，而不仅仅是首页能够打开。
- 我们并未规定严苛的 Prettier 配置。然而由于使用了 TailwindCSS v4 的编译机制，请确保在新增 React Components 时合理使用 Utility classes 堆叠范式。对于具有逻辑复用属性的自定义钩子文件统一储存在对应的功能包下。

## 5.1 Word 转 PDF 的本地依赖说明
- 按“转换质量第一，稳定性第二，性能第三”的用户目标，当前默认链路为 `Microsoft Word 原生导出 -> LibreOffice CLI -> HTML fallback`。如果你希望在开发机或演示机上复现最高保真的默认路径，请优先确保本机已安装并可调用 Microsoft Word。
- 如果机器上没有 Microsoft Word，系统的第二选择应是 `LibreOffice CLI`；要稳定复现这一路径，请单独安装 LibreOffice，并确保 `soffice` 可通过系统路径或默认安装目录被检测到。
- 项目不会在 `npm install` 期间自动为用户安装 Office / LibreOffice。这类桌面软件体积大、授权条件不同，也通常需要管理员或用户交互，因此只做“检测并利用”，不做自动捆绑安装。
- `winword.exe` 没有稳定的官方 headless PDF CLI；常见 Python 库 `docx2pdf` 在 Windows/macOS 上本质仍然依赖本地 Word 自动化，而 UNO / `unoconv` 一类方案本质仍然依赖 LibreOffice。因此这些 Python 或脚本方案被视为调用包装层，而不是新的独立默认导出链路。

## 6. 添加环境变量
虽然前端代码绝大部分运行在客户端，但如果使用到了特定的云端能力（当前主要是 AI 助手对话），则需要在项目根目录依据示例创建 `.env` 文件配置服务端参数。图片 OCR 不再依赖这些环境变量，而是走本地 PaddleOCR runtime。

### 6.1 获取 AI Provider Key
当前支持的 AI provider 及默认尝试顺序为：`Gemini -> OpenAI / ChatGPT -> DeepSeek`。

获取 Key 的入口如下：

- Gemini：<https://aistudio.google.com/app/apikey>
- OpenAI / ChatGPT：<https://platform.openai.com/api-keys>
- DeepSeek：<https://platform.deepseek.com/api_keys>

你可以只配置一个 provider，也可以同时配置多个 key。若同时存在多个 key，服务端会按上述顺序依次尝试，自动使用第一个既可用又能处理当前任务的 provider。

如果该项目来自 Google AI Studio 导出，请不要假设本地开发环境会自动继承 AI Studio 中的密钥注入。你需要在本机手动创建 `.env` 并填入可用的 `GEMINI_API_KEY`、`OPENAI_API_KEY`、`DEEPSEEK_API_KEY` 中的一个或多个。

未配置任何 AI key 时，应用主界面仍会正常启动；AI 助手会在界面内提示“未配置”并保持不可用，但图片 OCR 仍可继续工作，只要本地 PaddleOCR runtime 已经 bootstrap 完成。

### 6.2 本地物理机运行
在项目根目录新建 `.env` 文件（不要提交到 Git），填入：

```text
# 示例：创建 .env
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
```

随后执行：

```bash
npm run dev
```

如果你是在 `npm run dev` 已经运行之后才新建 `.env`，不必为了 AI 单独重启整套服务。当前运行时配置接口会在下一次 AI 请求时补读项目根目录的 `.env`；刷新页面或重新打开 AI 助手即可。图片 OCR 的可用性则由本地 PaddleOCR bootstrap 状态决定，不依赖 `.env`。

### 6.3 云服务器 / 云平台运行
对于 Cloud Run、VPS、Docker / 容器平台等独立部署环境，无需修改项目代码。只需要在平台提供的“环境变量 (Environment Variables)”配置面板中新增：

```text
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here
```

之后在部署流程中执行构建，并在运行阶段通过 `npm run start` 启动。`server.ts` 会在运行时读取这些环境变量，并通过服务端 `/api/ai/chat` gateway 让前端 AI 对话能力正常工作，而不是把原始 key 注入浏览器。图片 OCR 则通过独立的 `/api/ocr/image` route 调用本地 PaddleOCR。

### 6.4 AI 故障分型与排查
如果 AI 助手失败，当前界面会优先给出更具体的分类，而不是统一提示“请重试”。可以按下面的顺序排查：

1. 如果提示 API key 被拒绝，请先检查 `.env` 或云端环境变量中的已配置 key 是否填错、过期或权限不足。
2. 如果提示配额或速率限制，请等待一段时间后重试，并检查对应 provider 账号的用量额度。
3. 如果提示 AI provider 网络不可达，说明问题在网络链路而不是前端功能实现；请检查本机或部署环境的防火墙、代理、VPN、DNS 和区域访问限制。
4. 如果提示模型不可用，请检查当前 provider 账号、区域和默认模型访问权限是否支持该能力。
5. 如果提示请求参数被拒绝，请优先检查提交给 AI 的文件内容或请求结构，而不是先怀疑 `.env`。

对于图片 OCR，请优先检查另一组本地条件：

1. 本机是否已安装 Python `3.9+`。
2. `npm install` 或 `npm run setup:ocr` 是否成功完成。
3. `.local/paddleocr/venv` 与 `.local/paddleocr/cache` 是否已经生成。
4. 若 bootstrap 曾被中断，重新执行 `npm run setup:ocr` 以补齐 PaddleOCR 与离线模型。

> 请特别注意：绝不要把包括 `.env` 在内的含有私人身份和计费 Key 的属性混入 Git 代码库。

---

*针对代码模块（具体某个功能如何用代码完成）的进一步参考：[技术与实现文档](./implementation.md) 及 [整体架构说明](./architecture.md)*
