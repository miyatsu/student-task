# Refactor Archive

本文档是工程重构档案，用于记录重构决策、取舍与验证结果，不作为系统当前行为的主说明文档。面向现状的产品、架构、实现与使用说明请分别参考 `README.md` 与 `docs/` 下的正式文档。

## 2026-05-25 · Iteration 1 · Extract Shared File Utilities

### 重构理由

- `src/App.tsx` 同时承担状态编排、文件类型识别、排序、选择切换、重命名、复制、批量删除、Zip 导出重名处理等多种职责。
- 多个组件通过 `import { AppFile } from '../App'` 依赖 `App.tsx`，形成了不必要的反向耦合。
- 这些纯逻辑缺少自动化测试，后续重构容易出现无意识回归。

### 备选方案

1. **直接把 `App.tsx` 拆成多个大 UI 子组件**
	- 优点：视觉结构会更清晰。
	- 缺点：UI 与状态流改动面太大，首轮验证成本高，容易在没有测试护栏时引入回归。
2. **先抽离共享类型与纯逻辑模块，再保留现有 UI 结构**
	- 优点：行为保持风险低，可快速建立自动化测试基线。
	- 缺点：`App.tsx` 仍然偏大，UI 层拆分要留到后续迭代。

### 最终方案

选择方案 2，先完成以下重构：

- 新增 `src/features/files/types.ts` 承载 `AppFile`、排序配置等共享类型。
- 新增 `src/features/files/file-utils.ts` 承载文件领域纯逻辑。
- 新增 `src/features/files/file-utils.test.ts` 建立自动化回归测试。
- 让 `AiAssistant`、`FilePreview`、`ImageEnhanceModal`、`PdfEditor` 改为依赖共享类型模块，而不是依赖 `App.tsx`。
- 让 `App.tsx` 通过导入纯函数完成文件分类、排序、选择切换、重命名、复制、批量删除和 Zip 命名处理。

### 重构前后对比

#### 重构前

- `App.tsx` 内含大量重复的按文件类型分支逻辑。
- 共享类型定义散落在 `App.tsx` 或局部组件中。
- 文件领域逻辑没有自动化测试。

#### 重构后

- 文件领域共享类型集中到 `src/features/files/types.ts`。
- 纯逻辑集中到 `src/features/files/file-utils.ts`。
- 相关行为可通过 `npm test` 自动验证。
- 组件边界更清晰，跨模块依赖方向更合理。

### 验证结果

- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未拆分 `App.tsx` 中大段 JSX 区块，因为这会显著扩大 UI 回归面，需要在已有测试基线之上单独推进。
- 暂未移动根目录下的实验性 `test-*.mjs` / `test-*.ts` 脚本，因为需要先识别哪些脚本仍在使用、哪些可以归档到更合适的目录。
- 暂未为图片压缩、PDF 合并、Word 转 PDF 等浏览器副作用流程编写端到端自动化测试，这些应在后续迭代中逐步补齐。

## 2026-05-25 · Iteration 2 · Extract Typed File Section Components

### 重构理由

- `App.tsx` 中图片、PDF、Word 三个列表区块同时包含区头排序、拖拽列表、行内重命名、单项操作、批量操作等大段 JSX，阅读和后续局部修改成本都偏高。
- 三个区块虽然行为不同，但结构高度相似，继续把它们留在 `App.tsx` 内会让后续 UI 层测试和进一步拆分变得更困难。
- 已有纯逻辑测试覆盖文件领域函数，可以在此基础上低风险提炼表现层子组件。

### 备选方案

1. **继续把所有 JSX 保留在 `App.tsx`，仅抽少量渲染辅助函数**
	- 优点：文件数量不增加。
	- 缺点：核心复杂度仍集中在单文件里，JSX 体量下降有限。
2. **抽取类型化区块组件，同时保留 `App.tsx` 中的状态与事件编排**
	- 优点：职责边界清晰，行为风险可控，后续测试更容易落到组件级别。
	- 缺点：需要梳理组件 props 边界，并同步搬移少量展示辅助逻辑。

### 最终方案

选择方案 2，完成以下调整：

- 新增 `src/features/files/components/FileSectionHeader.tsx`，统一区头勾选与排序按钮展示。
- 新增 `src/features/files/components/EditableFileNameCell.tsx`，统一行内重命名展示逻辑。
- 新增 `ImageFilesSection`、`PdfFilesSection`、`WordFilesSection` 三个类型化列表组件，承接各自区块 JSX。
- `App.tsx` 保留状态、领域动作和模态框编排，只通过 props 向子组件注入行为。

### 重构前后对比

#### 重构前

- `App.tsx` 直接承载三大文件区块的完整 JSX。
- 区头排序、行内重命名和批量操作等展示逻辑重复分散。

#### 重构后

- 三大文件区块收敛到独立的类型化表现层组件。
- 共享展示结构集中在 `FileSectionHeader` 与 `EditableFileNameCell`。
- `App.tsx` 更聚焦于状态编排与事件路由。

### 验证结果

- 触达文件编辑器类型检查通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未整理根目录实验脚本目录结构，这将作为下一次独立提交处理。
- 暂未引入 UI / 集成测试框架和用例，这将作为后续单独迭代推进。

## 2026-05-25 · Iteration 3 · Reorganize Experimental Scripts

### 重构理由

- 根目录散落 14 个 `test-*` 实验脚本，和应用入口、构建配置、正式文档混在一起，影响项目顶层可读性。
- 这些文件没有被 `package.json`、应用源码或文档引用，适合集中收纳到更明确的目录。
- 少数脚本依赖硬编码的 `node_modules/...` 相对路径，迁移时需要顺手修正以保持可执行性。

### 备选方案

1. **保留在根目录，仅靠命名区分实验脚本**
	- 优点：路径完全不变。
	- 缺点：顶层结构继续拥挤，实验脚本和正式入口难以快速区分。
2. **迁移到 `scripts/experiments/` 并补最小说明文档**
	- 优点：目录职责清晰，改动面小，后续继续归档或删除都更方便。
	- 缺点：需要修正少量相对路径。

### 最终方案

选择方案 2，完成以下调整：

- 将根目录下的 `test-*.ts`、`test-*.mjs` 和 `test-tools.js` 统一迁移到 `scripts/experiments/`。
- 修正 4 个脚本中对 `node_modules/...` 的相对路径依赖。
- 新增 `scripts/experiments/README.md`，说明这些脚本的用途和分组。

### 重构前后对比

#### 重构前

- 根目录同时堆放应用代码、配置文件和手工实验脚本。
- 实验脚本用途只能靠文件名猜测。

#### 重构后

- 实验脚本集中到 `scripts/experiments/`。
- 顶层目录职责更单一。
- 目录内有简短说明文件帮助后续维护。

### 验证结果

- `node scripts/experiments/test-mupdf2.mjs` 通过
- `node scripts/experiments/test-mupdf-destroy.mjs` 通过
- `node scripts/experiments/test-mupdf-page.mjs` 通过
- `node scripts/experiments/test-pdfjs-svg.mjs` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未引入 UI / 集成测试框架和用例，这将作为后续单独迭代推进。

## 2026-05-25 · Iteration 4 · Add UI Regression Tests

### 重构理由

- 前两轮已经把 `App.tsx` 的纯逻辑和大段列表 JSX 分别抽离，但当前自动化测试仍主要覆盖纯逻辑层，无法直接保护表现层事件接线。
- 当前最高风险区域集中在新抽出的文件列表组件，适合优先补一层轻量的 jsdom UI 回归测试。
- 直接为整个 `App.tsx` 做浏览器级集成测试会把 PDF、AI、拖拽和文件 API 副作用同时引入，首轮成本和脆弱性都偏高。

### 备选方案

1. **继续只保留纯逻辑测试**
	- 优点：维护成本最低。
	- 缺点：无法覆盖 JSX 回调接线、批量操作按钮状态和行内重命名交互。
2. **引入最小 UI 测试层，先覆盖新抽出的高风险列表组件**
	- 优点：能直接保护当前重构热点，且不必一次性引入完整 E2E 复杂度。
	- 缺点：需要新增测试运行时依赖与配置。

### 最终方案

选择方案 2，完成以下调整：

- 引入 `vitest`、`jsdom` 和 React Testing Library 作为 UI 测试基础设施。
- 新增 `vitest.config.ts` 和 `src/test/setup.ts`。
- 将 `npm test` 扩展为纯逻辑测试与 UI 测试的组合入口，并新增 `npm run test:logic`、`npm run test:ui`。
- 新增 `src/features/files/components/ImageFilesSection.ui.test.tsx`，覆盖排序、批量操作、单项操作以及行内重命名的关键 UI 回归。

### 重构前后对比

#### 重构前

- 自动化测试仅覆盖文件领域纯逻辑。
- 列表组件的 JSX 交互主要依赖人工回归。

#### 重构后

- 自动化测试同时覆盖纯逻辑层和关键 UI 组件层。
- 新抽出的文件列表组件有了直接回归护栏。

### 验证结果

- `npm run test:ui` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未引入浏览器级 E2E 测试，这一步先以高价值、低脆弱度的 UI 回归测试为主。

## 2026-05-25 · Iteration 5 · Reclassify Experiment Scripts

### 重构理由

- 上一轮已经把根目录中的 `test-*` 文件收敛到了 `scripts/experiments/`，但目录内部仍然是平铺结构，手工验证、诊断脚本和 spike 混在一起。
- 进一步检查后可以确认，这些文件多数不是应该纳入 CI 的自动化回归测试，而是开发期验证工具；如果直接迁入真正的 `test/` 树，反而会模糊“自动化测试”和“探索性脚本”的边界。
- 其中少量诊断脚本在再次下沉目录后需要同步修正相对路径，以保持可执行性。

### 备选方案

1. **把 `scripts/experiments/` 下的全部 `test-*` 迁入新的 `test/` 目录**
	- 优点：名称上看更像测试文件，目录名更直观。
	- 缺点：会把手工联调脚本、环境探测脚本和自动化回归测试混在一起，语义不准确。
2. **保留在 `scripts/experiments/`，但按用途细分并明确文档边界**
	- 优点：保留开发工具属性，同时降低目录阅读成本。
	- 缺点：仍需维护一套与自动化测试并行的开发验证脚本树。

### 最终方案

选择方案 2，完成以下调整：

- 将 `scripts/experiments/` 重组为 `diagnostics/`、`manual/`、`spikes/` 三类子目录。
- 保持这些文件继续脱离自动化测试入口，不并入真正的 `test/` 树。
- 修正 4 个依赖 `node_modules/...` 相对路径的诊断脚本。
- 同步更新 `scripts/experiments/README.md`、`docs/testing.md`、`README.md`，明确实验脚本与自动化测试的边界。

### 重构前后对比

#### 重构前

- `scripts/experiments/` 内部平铺所有 `test-*` 脚本。
- 自动化测试与探索性脚本的边界主要靠人工理解。

#### 重构后

- 实验脚本按 `diagnostics/`、`manual/`、`spikes/` 分类存放。
- 文档明确说明这些文件不会进入 `npm test`。
- 目录语义与文件真实用途更一致。

### 验证结果

- `node scripts/experiments/diagnostics/test-mupdf2.mjs` 通过
- `node scripts/experiments/diagnostics/test-mupdf-destroy.mjs` 通过
- `node scripts/experiments/diagnostics/test-mupdf-page.mjs` 通过
- `node scripts/experiments/diagnostics/test-pdfjs-svg.mjs` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未引入浏览器级 E2E 测试，这一步仍以结构澄清和已有开发脚本整理为主。

## 2026-05-25 · Iteration 6 · Expand Automated Feature Coverage

### 重构理由

- 当前自动化测试已经覆盖文件领域纯逻辑与图片列表组件，但 PDF 列表、Word 列表、PDF 页编辑和 Gemini 运行时配置仍存在明显空白。
- 这些区域分别对应系统的主干文件管理功能、PDF 核心编辑功能和 AI 启用路径，都是后续继续重构时的高风险点。
- 现有 Vitest 基础设施已经可用，适合继续以低成本扩展到更多应用层回归测试。

### 备选方案

1. **直接上浏览器级 E2E，覆盖尽可能多的真实流程**
	- 优点：更贴近用户真实操作路径。
	- 缺点：当前仓库仍有较多浏览器 API、第三方库和本地工具依赖，首轮扩展的脆弱性偏高。
2. **继续扩展应用层回归测试，优先覆盖最核心且最易回归的主功能组件与运行时逻辑**
	- 优点：信号强、维护成本可控、适合支撑下一轮重构。
	- 缺点：对端到端联动的覆盖仍然有限。

### 最终方案

选择方案 2，完成以下调整：

- 为 `PdfFilesSection`、`WordFilesSection` 补齐列表交互与批量操作回归测试。
- 为 `PdfEditor` 补齐页删除、页抽取和“禁止删除全部页面”测试。
- 为 `gemini.ts` 补齐运行时配置加载、缓存与客户端创建测试。
- 将 Vitest 测试层从单纯的 `test:ui` 语义扩展为 `test:app`，并保留 `test:ui` 兼容别名。
- 同步更新 `docs/testing.md`、`README.md` 和本重构日志。

### 重构前后对比

#### 重构前

- 自动化覆盖主要集中在文件纯逻辑与图片列表组件。
- PDF 核心编辑与 Gemini 运行时配置没有直接回归护栏。

#### 重构后

- 文件列表三大区块都具备了应用层 UI 回归测试。
- `PdfEditor` 的关键页面处理行为可自动回归。
- Gemini 配置加载链路有了独立测试保障。

### 验证结果

- `npm run test:app` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未引入浏览器级 E2E 测试，这一步仍优先扩大高信号、低脆弱度的应用层自动化覆盖。

## 2026-05-25 · Iteration 7 · Extract Server Runtime Helpers

### 重构理由

- `server.ts` 目前同时承载 Express 路由、环境变量读取、PDF 压缩等级分支、Ghostscript 命令拼装和任务 ID 生成，字符串式逻辑分散在路由内部。
- 这些逻辑本身并不依赖 Express 请求生命周期，适合下沉为纯函数模块，以降低服务端入口文件的职责密度。
- 将这些逻辑抽离后，可以直接建立自动化测试，而不必通过真实文件上传和 Ghostscript 执行来间接覆盖。

### 备选方案

1. **继续保留在 `server.ts` 内联实现，只通过人工联调验证**
	- 优点：文件数量不增加。
	- 缺点：字符串式命令和环境变量处理缺少直接测试，也加重入口文件职责。
2. **抽离运行时配置与压缩辅助逻辑到 `src/server/` 模块，并为纯函数建测试**
	- 优点：职责边界更清晰，可直接建立稳定的自动化回归。
	- 缺点：需要新增服务端模块并调整入口文件导入。

### 最终方案

选择方案 2，完成以下调整：

- 新增 `src/server/runtime-config.ts`，统一读取并规范化运行时 Gemini 配置。
- 新增 `src/server/compression.ts`，承载 PDF 压缩等级映射、任务 ID 生成和 Ghostscript 命令拼装。
- 让 `server.ts` 改为依赖这些纯函数，而不是在路由内内联字符串分支。
- 新增 `src/server/server-helpers.app.test.ts`，为这些服务端纯函数建立自动化回归测试。
- 同步更新 `docs/testing.md`、`docs/implementation.md`、`README.md` 和本重构日志。

### 重构前后对比

#### 重构前

- `server.ts` 直接内联运行时配置读取和压缩命令拼装。
- 服务端关键逻辑主要依赖人工联调验证。

#### 重构后

- 运行时配置与压缩辅助逻辑集中在 `src/server/`。
- `server.ts` 更聚焦于路由和请求流程。
- 服务端纯逻辑可通过自动化测试直接验证。

### 验证结果

- `npm run test:app` 通过
- `npm test` 通过
- `npm run lint` 通过
- `npm run build` 通过

### 刻意暂不改动的部分

- 暂未继续拆分 `/api/pdf2img` 的流式转换主流程，这部分依赖 MuPDF 生命周期与流式响应，后续应在更充分的测试护栏下再推进。
