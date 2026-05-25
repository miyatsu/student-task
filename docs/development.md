# 开发规范与环境配置指导

欢迎参与多功能文件处理系统的开发工作。本指南为参与此 Web 项目的研发者提供快速启动环境流程。

## 1. 基础环境前置要求
本系统广泛运用了 ES Modules 和较新的语言特性，推荐运行在现代稳定的工具链之上：
- **操作系统**：Windows 10/11 (WSL 推荐)，macOS，或各大 Linux 发行版。
- **Node.js**: `v20.x` 或 `v22.x` 稳定版。推荐使用 nvm 或者 fnm 管理 Node.js 版本。
- **npm**: 随同 Node.js 提供的较新版本进行包管理。

## 2. 下载及依赖安装

请将项目的源码克隆至本地，或如果是平台（如 AI Studio 等）已经挂载的环境，直接通过 Terminal 终端进入。

1. **进入项目根目录：**（确保你能够看到 `package.json` 文件）
2. **安装所有的第三方依赖：**

由于内置了大型机器学习依赖 (`@tensorflow/tfjs`, `upscaler`) 以及 PDF 解析库，该步骤可能耗时几十秒。
由于底层可能需要编译 sqlite 相关的预置组件，系统可能提示需要一些 python 或者 C++ 组件库的支持，一般在标准的 Mac/Linux 或者已经有 Visual Studio Build Tools 的 Windows 下可以无缝通过。

```bash
npm install
```

## 3. 本地启动与调试

在项目的根目录下执行如下脚本：
```bash
npm run dev
```
此命令将触发 `package.json` 里的 `"tsx server.ts"`，同时挂载 Vite 中间件（在 Express 环境下），以便提供前后端联调并在修改文件后支持热模块替换（如果禁用则为刷新式开发机制）。
此时您的控制台会打印绑定的端口。通常在浏览器输入 `http://localhost:3000` 即可直接访问应用。

## 4. 前端打包与生产测试
如需向线上服务器发布静态资产：

```bash
npm run build
```
这一步会将所有的 React 组件、本地的 tfjs 流水线以及 CSS 打包到根目录下的 `dist/` 文件夹中。同时因为通过 esbuild 将相关 node runtime（`server.ts`）捆绑为能够利用的执行文件，随后可通过 `npm run start` 确认与线上等同的运行效果。

## 5. 项目风格及代码提交
在提交代码之前：
- 请运行 `npm run lint` 以检查可能的 TypeScript 类型语法错误以及未捕捉的反模式调用。
- 我们并未规定严苛的 Prettier 配置。然而由于使用了 TailwindCSS v4 的编译机制，请确保在新增 React Components 时合理使用 Utility classes 堆叠范式。对于具有逻辑复用属性的自定义钩子文件统一储存在对应的功能包下。

## 6. 添加环境变量
虽然前端代码绝大部分运行在客户端，但如果使用到了特定的云端功能（如 Gemini API 交互分析），则需要在项目根目录依据示例创建 `.env`文件配置后端参数。

```text
# 示例：创建 .env
GEMINI_API_KEY=your_actual_key_here
```
> 请特别注意：绝不要把包括 `.env` 在内的含有私人身份和计费 Key 的属性混入 Git 代码库。

---

*针对代码模块（具体某个功能如何用代码完成）的进一步参考：[技术与实现文档](./implementation.md) 及 [整体架构说明](./architecture.md)*
