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
