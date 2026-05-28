# 架构设计文档

本项目整体为一个**前端重度驱动 (Front-End Heavy)** 的现代化 Web 应用。设计主旨是利用现代化浏览器丰富的标准 API（File API，WebGL/WebGPU），将传统上需要厚重后端的业务直接前置，提升用户隐私安全体验。

## 1. 技术栈选型

<a id="frontend-tech"></a>
### 1.1 前端核心
- **视图层框架**: React v19.0.0
- **打包与构建**: Vite v6
- **样式引擎**: TailwindCSS v4
- **拖拽引擎**: `@hello-pangea/dnd` 提供跨列表元素的排序交互。

### 1.2 核心业务依赖库
- **PDF 编解码**: `pdf-lib` (对页面和流数据处理)、`pdfjs-dist` (PDF可视化渲染或预览支持)。
- **Word 文档解析**: `mammoth` 用于前端 `DOCX -> HTML` 转换，`word-extractor` 用于服务端解析旧版 `.doc` 文档中的可读文本。
- **机器视觉与 AI**: 
  - 通过 `@tensorflow/tfjs` 和 `upscaler`，实现本地推理解析，提升图片质感和细节。
  - 图片 OCR 通过本地 PaddleOCR 运行时完成：Node 服务负责把图片请求交给项目内虚拟环境中的 Python runner，PaddlePaddle / PaddleOCR 与离线模型在 `npm install` 时自动 bootstrap 到 `.local/paddleocr/`。
  - AI 助手继续通过服务端 AI gateway 对接云端大规模语言模型（LLM）：Gemini 通过 `@google/genai` 接入，OpenAI / DeepSeek 通过标准 HTTPS API 接入，并在服务端按顺序自动选择首个可用 provider。
- **打包组装**: `jszip` 动态生成下载的压缩包；`browser-image-compression` 实现本地图片压缩。

### 1.3 后端核心（BFF / 轻代理）
- 提供了一个基于 `express` 的轻量 API Node Server (`server.ts`)。当前实现使用进程内 `Map` 跟踪短生命周期作业状态，主要负责文件上传处理、PDF 压缩 / 转图、旧版 `.doc` 文本提取、本地 `/api/ocr/image` PaddleOCR 编排，以及 `/api/ai/chat` 这类 AI gateway 任务；`/api/runtime-config` 只返回“哪些 AI provider 已配置”与“本地 OCR runtime 是否就绪”的摘要，不再把原始第三方 API key 暴露给浏览器。开发模式下还会把 Vite 中间件与 HMR WebSocket 统一挂载到同一个 HTTP Server 上，并在默认端口被占用时自动回退到下一个可用端口。在核心文件交互（增删改查及画质增强）上仍保持“后端可选”的设计。

## 2. 核心架构与组件划分

整个前端组件树保持扁平且高聚合特点：

1. **[App.tsx](../src/App.tsx) 主状态机应用**
   - 维护所有文件的核心池：`imageFiles`、`pdfFiles`、`wordFiles` 状态与 `selectedIds` 选中的映射表。
   - 实现通用的文件分发函数与导出能力。
   - 为子模块分发 Props 注入机制。

2. **核心流转模块**
   - 文件预览：`FilePreview` 支持对各种扩展名做本地协议对象（Blob URL）的加载。
   - PDF 处理器：`PdfEditor` 控制单个 PDF 的内聚逻辑管理。
   - 图像超级解析：`ImageEnhanceModal`。
   - 通用外脑组件：`AiAssistant`。

3. **共享文件领域模块**
  - `src/features/files/types.ts`：定义 `AppFile`、排序配置等跨组件共享类型，避免组件反向依赖 `App.tsx`。
  - `src/features/files/file-utils.ts`：封装文件分类、排序、选择切换、重命名、复制、批量删除和 Zip 命名冲突处理等纯逻辑。
  - `src/features/files/file-utils.test.ts`：为上述纯逻辑提供自动化回归测试。
  - `src/features/files/components/ConversionProgressCard.tsx`：为图片与 Word 批量转 PDF 复用统一的绿色进度卡片。

4. **轻量服务端辅助模块**
  - `src/server/compression.ts`：封装 PDF 压缩任务的参数拼装。
  - `src/server/runtime-config.ts`：集中读取运行时 AI provider 配置摘要。
  - `src/server/ai.ts`：负责 AI provider 顺序回退、能力判断以及 AI 助手对话 gateway。
  - `src/server/local-ocr.ts`：负责本地 PaddleOCR runtime 状态探测、图片 OCR 请求归一化，以及调用项目内 Python runner 执行离线 OCR。
  - `src/server/word-conversion.ts`：使用 `word-extractor` 解析旧版 `.doc` 文件，并把可读文本包装成安全 HTML，供前端继续转 PDF。

## 3. 本地架构视图 
*(C4 模型的容器级架构)*

[查看架构图源码](./puml/architecture.puml)

```plantuml
@startuml
skinparam componentStyle rectangle

package "前端 (React + Vite + TailwindCSS)" {
  [App.tsx (应用入口 & 状态管理)] as App
  
  package "核心组件" {
    [PdfEditor (PDF操作界面)] as PdfEditor
    [ImageEnhanceModal (AI图像增强)] as ImageEnhanceModal
    [AiAssistant (AI文档对话)] as AiAssistant
    [FilePreview (文件预览)] as FilePreview
  }
  
  package "前端功能库" {
    [pdf-lib (PDF处理模块)] as PDFLib
    [upscaler + tfjs (本地推理大模型)] as TFJS
    [browser-image-compression] as ImageCompression
  }
}

package "后端 (Express + TS)" {
  [server.ts (API服务 & 前端代理)] as Backend
  [AI Gateway\nGemini / OpenAI / DeepSeek] as LLMGateway
  [Local OCR\nPaddleOCR + PaddlePaddle] as LocalOCR
}

App --> PdfEditor
App --> ImageEnhanceModal
App --> AiAssistant
App --> FilePreview

PdfEditor --> PDFLib : PDF操作
ImageEnhanceModal --> TFJS : 端侧图像增强
AiAssistant --> Backend : AI 对话请求
App --> ImageCompression : 本地图片压缩
App --> Backend : 图片 OCR 请求

App <--> Backend : 可选 API 调用
Backend --> LLMGateway : 顺序选择首个可用 provider
Backend --> LocalOCR : 本地离线 OCR
Backend --> Backend : `.doc` 文本提取 / PDF 转图 / 压缩任务`
@enduml
```

---

*下一步：有关这些组件更深层的实现策略（尤其是本地 AI），请查看 [技术与实现文档](./implementation.md); 若想加入开发，请参考[开发环境配置](./development.md)。*
