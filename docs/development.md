# 开发规范与环境配置指导

欢迎参与多功能文件处理系统的开发工作。本指南为参与此 Web 项目的研发者提供快速启动环境流程。

## 1. 基础环境前置要求
本系统广泛运用了 ES Modules 和较新的语言特性，推荐运行在现代稳定的工具链之上：
- **操作系统**：Windows 10/11 (WSL 推荐)，macOS，或各大 Linux 发行版。
- **Node.js**: `v20.19+` 或 `v22.13+` 稳定版。低于该版本的 Node.js 会在 `npm install` 前被直接拒绝，因为当前依赖链（Vite / pdfjs 等）已不再支持 Node 18。
- **npm**: 随同 Node.js 提供的较新版本进行包管理。

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

```bash
npm install
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

如果你想在本地预览“带后端 API 的生产态”，请在构建完成后执行：

```bash
npm run preview
```

这个脚本会直接用生产模式启动 `server.ts` 并服务 `dist/`，因此 `.doc` 转 PDF、PDF 转图、压缩等依赖 Express 路由的能力都能一起验证。如果只想临时查看纯静态前端资源，而不需要任何 API，可额外使用：

```bash
npm run preview:static
```

如果你要把应用部署到 Cloud Run、VPS、Docker 容器或其他云平台，Gemini Key 不需要在构建阶段硬编码到前端产物里。只要在运行平台配置好 `GEMINI_API_KEY`，`npm run start` 启动时的 `server.ts` 就会在运行时读取该环境变量并把它提供给浏览器端的 Gemini 客户端。

## 5. 项目风格及代码提交
在提交代码之前：
- 请运行 `npm test` 以验证已抽离的纯逻辑模块没有发生行为回归。
- 请运行 `npm run lint` 以检查可能的 TypeScript 类型语法错误以及未捕捉的反模式调用。
- 如果本轮修改影响了前端运行逻辑或共享模块，请额外运行 `npm run build` 做一次打包验证。
- 我们并未规定严苛的 Prettier 配置。然而由于使用了 TailwindCSS v4 的编译机制，请确保在新增 React Components 时合理使用 Utility classes 堆叠范式。对于具有逻辑复用属性的自定义钩子文件统一储存在对应的功能包下。

## 5.1 Word 转 PDF 的本地依赖说明
- 按“转换质量第一，稳定性第二，性能第三”的用户目标，当前默认链路为 `Microsoft Word 原生导出 -> LibreOffice CLI -> HTML fallback`。如果你希望在开发机或演示机上复现最高保真的默认路径，请优先确保本机已安装并可调用 Microsoft Word。
- 如果机器上没有 Microsoft Word，系统的第二选择应是 `LibreOffice CLI`；要稳定复现这一路径，请单独安装 LibreOffice，并确保 `soffice` 可通过系统路径或默认安装目录被检测到。
- 项目不会在 `npm install` 期间自动为用户安装 Office / LibreOffice。这类桌面软件体积大、授权条件不同，也通常需要管理员或用户交互，因此只做“检测并利用”，不做自动捆绑安装。
- `winword.exe` 没有稳定的官方 headless PDF CLI；常见 Python 库 `docx2pdf` 在 Windows/macOS 上本质仍然依赖本地 Word 自动化，而 UNO / `unoconv` 一类方案本质仍然依赖 LibreOffice。因此这些 Python 或脚本方案被视为调用包装层，而不是新的独立默认导出链路。

## 6. 添加环境变量
虽然前端代码绝大部分运行在客户端，但如果使用到了特定的云端功能（如 Gemini API 交互分析），则需要在项目根目录依据示例创建 `.env`文件配置后端参数。

### 6.1 免费获取独立 Key
你可以前往 Google AI Studio 开发者控制台免费申请一个专属的 Gemini API Key：

<https://aistudio.google.com/app/apikey>

Gemini 的免费层级一般已经足够覆盖本项目的本地开发、功能演示与轻量公开部署测试。

如果该项目来自 Google AI Studio 导出，请不要假设本地开发环境会自动继承 AI Studio 中的密钥注入。你需要在本机手动创建 `.env` 并填入可用的 `GEMINI_API_KEY`。

未配置 `GEMINI_API_KEY` 时，应用主界面仍会正常启动；只有 Gemini 聊天和基于 Gemini 的图片 OCR 会在界面内提示“未配置”并保持不可用，不会再导致整页白屏。

### 6.2 本地物理机运行
在项目根目录新建 `.env` 文件（不要提交到 Git），填入：

```text
# 示例：创建 .env
GEMINI_API_KEY=your_actual_key_here
```

随后执行：

```bash
npm run dev
```

### 6.3 云服务器 / 云平台运行
对于 Cloud Run、VPS、Docker / 容器平台等独立部署环境，无需修改项目代码。只需要在平台提供的“环境变量 (Environment Variables)”配置面板中新增：

```text
GEMINI_API_KEY=your_actual_key_here
```

之后在部署流程中执行构建，并在运行阶段通过 `npm run start` 启动。`server.ts` 会在运行时读取该环境变量并让前端 Gemini 对话与 OCR 能力正常工作。

> 请特别注意：绝不要把包括 `.env` 在内的含有私人身份和计费 Key 的属性混入 Git 代码库。

---

*针对代码模块（具体某个功能如何用代码完成）的进一步参考：[技术与实现文档](./implementation.md) 及 [整体架构说明](./architecture.md)*
