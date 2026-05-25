# Refactor Log

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
