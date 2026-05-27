你是一位资深前端工程师、产品 UI/UX 设计专家和 React/Tailwind 代码重构顾问。请帮助我改进当前 PCIE 项目的完整首页界面，使其更加简洁、整洁、美观、大方，并符合一个专业工具型 Web App 的产品气质。

项目背景：
PCIE 是一个 local-first 的文件处理工作区，主要支持 PDF、图片、Word 文件的上传、排序、转换、提取、增强和导出。AI/Gemini 是可选能力，只有在用户主动配置 key 后才启用。项目源码位于当前 VSCode 工作区，请你直接阅读项目结构和相关源码后再给出修改方案并实施。

当前首页由两个主要区域组成：

1. 顶部 Hero 区域
   - 当前包含：
     - LOCAL-FIRST WORKSPACE
     - PDF · IMAGE · WORD
     - AI OPTIONAL
     - Sort. Convert. Extract. Export.
     - 大标题：One workspace for PDFs, images, and Word.
     - 副标题
     - 两张 trust card：Local-first processing / Gemini when you choose it
     - 右侧四张 feature card：Unified intake / Edit and convert / Enhance and read / Review and export

2. 下方 Workspace Upload 区域
   - 当前包含：
     - 大型虚线边框上传区
     - 上传图标
     - WORKSPACE UPLOAD
     - 标题：Drop PDFs, images, or Word documents
     - 描述：Mixed uploads are sorted automatically...
     - 文件类型 chips：PDF / DOC-DOCX / PNG / JPG-JPEG

当前界面主要问题：
1. 顶部 Hero 区域和下方 Upload 区域割裂感较强，像两个独立模块，而不是一个统一的产品入口。
2. Hero 区域的信息密度偏高，胶囊标签、功能短语、trust cards、feature cards 同时出现，显得杂乱。
3. Hero 标题字号和字重过大，压迫感强。
4. 右侧四张 feature card 纵向堆叠，占据空间较大，但信息重复，缺少明确流程感。
5. 下方 Workspace Upload 区域才是真正的操作入口，但视觉上被放在 Hero 之后，首屏主 CTA 不够明确。
6. local-first 和 AI optional 是核心差异点，但目前被拆散在多个小元素中，没有形成清晰可信的表达。
7. 当前视觉使用浅蓝、浅绿、橙色、绿色、红色等多种强调色，缺少统一的设计系统。
8. 首页整体偏“功能陈列”，应改成“文件处理工作台入口”。

请完成以下任务。

一、代码阅读与定位

请先阅读当前项目源码，重点检查：
- src/components/HomeHero.tsx
- src/App.tsx
- 与 Workspace Upload 区域相关的组件
- 与上传、拖拽、文件选择相关的组件和 props
- Tailwind / CSS / design token 相关配置

在修改前，请先简要说明：
1. 当前首页实际由哪些组件组成；
2. HomeHero 与 Workspace Upload 的关系；
3. 哪些文件需要修改；
4. 哪些业务逻辑不能改动；
5. 你计划如何低风险地完成视觉与结构优化。

请注意：
不要修改核心文件处理逻辑。
不要修改 PDF、图片、Word 转换逻辑。
不要修改 Gemini API 调用逻辑。
不要修改 Express / legacy DOC 处理逻辑。
不要为了重构而重构。

二、总体改造目标

请将首页从“功能陈列型首页”改为“产品工作台入口型首页”。

目标效果：
1. 第一眼就能看出这是一个 local-first 文件处理 workspace。
2. 第一屏就有明确上传入口或主 CTA。
3. Hero 和 Workspace Upload 在视觉上应连贯，避免重复表达。
4. 信息层级更加清晰：
   - 一句话说明产品价值；
   - 一个清晰上传入口；
   - 三类文件能力说明；
   - local-first / AI optional 作为信任说明。
5. 整体更克制、现代、专业，接近成熟生产力工具。
6. 保持响应式良好，移动端不能拥挤。

三、建议的新首页信息架构

请优先采用以下结构：

整体首页：

1. Hero + Upload 组合区
   - 左侧：产品价值主张
   - 右侧或下方：真实上传入口 / 上传面板
   - 不要让 Hero 和 Upload 看起来像两个完全分离的大模块

2. Capability Strip
   - 三个小型能力卡片：
     - PDF workflow
     - Image workflow
     - Word workflow

3. Trust / Privacy Note
   - Local-first by default
   - AI only when configured

如果当前代码结构不方便完全合并 Hero 与 Upload，请至少做到：
1. Hero 中出现明确 CTA，点击后能引导到下方真实上传区，或复用现有文件选择能力。
2. Hero 与 Upload 区域使用统一背景、边框、圆角、阴影、字体层级。
3. 减少 Hero 内部重复卡片，让下方上传区成为真正的视觉中心。

四、Hero 区域具体修改要求

请将当前 Hero 区域简化。

删除或合并以下元素：
- 删除多个并列胶囊标签，只保留一个：
  Local-first · AI optional
- 删除或弱化：
  Sort. Convert. Extract. Export.
- 删除左下角两张 trust cards，改为更轻量的 inline trust notes。
- 删除右侧四张大 feature cards，改为一个更紧凑的 workflow preview 或 upload preview。

推荐 Hero 文案：

Badge:
Local-first · AI optional

Headline:
Process PDFs, images, and Word files in one local-first workspace.

Subheadline:
Drop mixed files, organize them visually, convert or extract what you need, and export the result. Gemini stays off until you configure a key.

Primary CTA:
Choose files

Secondary text:
Supports PDF · DOCX · DOC · PNG · JPG

Hero 风格要求：
- 标题使用 text-4xl sm:text-5xl lg:text-6xl
- 不要使用 font-black，建议 font-semibold 或 font-bold
- 行高和 tracking 要克制
- 正文使用 text-slate-600 或 text-slate-700
- 主按钮使用 bg-slate-950 text-white hover:bg-slate-800 rounded-xl
- 背景使用 bg-slate-50 / white / very subtle gradient
- 不要使用过多彩色 icon 背景

五、Workspace Upload 区域具体修改要求

当前下方 Workspace Upload 区域是实际操作入口，请优化它，而不是删除它。

请检查现有上传区逻辑并保持功能不变，只优化 UI 和文案。

建议改造方向：
1. 让上传区看起来像首页的核心操作面板，而不是一个孤立的大虚线盒子。
2. 保留 drag-and-drop 语义，但弱化过大的虚线边框。
3. 可以使用：
   - rounded-3xl
   - border border-slate-200
   - bg-white/85
   - shadow-sm 或 shadow-lg shadow-slate-200/50
4. 拖拽状态可以使用：
   - border-sky-300
   - bg-sky-50/60
5. 上传图标可以保留，但尺寸和背景要克制。
6. 文件类型 chips 统一样式：
   - rounded-full
   - border border-slate-200
   - bg-white
   - text-slate-600
7. 文案建议：

Eyebrow:
Workspace upload

Title:
Drop files into your workspace

Description:
Mixed PDFs, images, and Word documents are sorted automatically so you can process them without switching tools.

Chips:
PDF / DOCX / DOC / PNG / JPG

注意：
如果已有文件选择按钮，请保留并统一样式。
如果没有按钮，可以添加 Choose files，但必须复用现有 input 或 handler，不要新增重复逻辑。
如果 Hero 中的 Choose files 按钮需要触发上传，请尽量复用同一个 file input ref 或平滑滚动到上传区。

六、Capability Strip 建议

请在 Hero + Upload 之后增加或保留一个简洁能力区，替代当前 Hero 右侧四张大卡片。

建议内容：

PDF workflow
Merge, split, compress, extract pages, and export clean results.

Image workflow
Rotate, enhance, convert to PDF, or extract text when AI is enabled.

Word workflow
Convert DOCX in-browser and handle legacy DOC through the local server path.

实现要求：
- 使用数组定义 capabilities，避免重复 JSX。
- 使用 lucide-react 图标：
  - FileText
  - Image
  - FileArchive 或 FileType
- 三张卡片在 desktop 上一行三列；
- mobile 上单列；
- 使用统一中性色，不要每张卡片一个强烈颜色。

七、Trust / Privacy Note 建议

请增加一个轻量的信任说明，不要做成很重的大卡片。

推荐文案：

Private by default.
Core editing and export stay local. Gemini is used only after you configure a key and choose AI features.

或者更短：

Local-first by default. AI only when configured.

样式：
- 小号文字
- 放在 CTA 附近或上传区下方
- 使用 Lock / Shield 图标
- 不要占用太多垂直空间

八、视觉系统要求

请统一首页视觉风格：

颜色：
- bg-slate-50
- bg-white / bg-white/85
- text-slate-950
- text-slate-700
- text-slate-600
- text-slate-500
- border-slate-200

强调色：
- 主操作只使用 slate-950
- 拖拽激活状态可以使用 sky
- 成功状态可以使用 emerald
- 不要在普通 feature card 中混用蓝、橙、绿、红

圆角：
- 大面板：rounded-3xl
- 卡片：rounded-2xl
- 按钮：rounded-xl
- chips：rounded-full

阴影：
- 使用 shadow-sm 或轻量 shadow
- 避免过重阴影

间距：
- 页面容器 max-w-7xl
- px-6 lg:px-8
- py-12 / py-16 / lg:py-20
- 避免首屏两个大模块之间出现过大的割裂空白

字体：
- 标题不要过粗
- 英文大写 eyebrow 需要减少 letter spacing 或降低使用频率
- 不要在页面上出现过多 uppercase 标签

九、交互要求

请保持或改进以下交互：
1. 支持拖拽上传。
2. 支持点击选择文件。
3. 拖拽 hover/active 状态清晰。
4. Hero 的 Choose files 按钮应能：
   - 直接打开文件选择器；或者
   - 平滑滚动到 Workspace Upload 区域。
5. 不要创建两个互相独立、行为不一致的上传入口。
6. 不要破坏现有文件排序、分类、转换、导出流程。

十、可访问性要求

请注意：
1. button 必须有 focus-visible 样式。
2. 上传区应有清晰的 aria-label 或可读文本。
3. 图标不能作为唯一语义来源。
4. h1/h2/h3 层级合理。
5. 普通正文颜色对比度足够，不要用过浅灰色。
6. 移动端不能出现过窄卡片或拥挤 chips。

十一、推荐实现策略

请优先采用低风险分步改造：

Step 1:
重构 HomeHero.tsx：
- 简化文案和结构；
- 删除重复卡片；
- 增加主 CTA；
- 将右侧改为 workflow/upload preview。

Step 2:
轻量优化 App.tsx 或上传组件：
- 统一 Workspace Upload 样式；
- 保持上传逻辑不变；
- 确保 Hero CTA 能触发上传或滚动到上传区。

Step 3:
增加 Capability Strip：
- 如果 HomeHero 内已有类似内容，可移到 Hero 下方；
- 不要重复表达同一组功能。

Step 4:
统一 Tailwind 样式：
- 抽出数组常量；
- 避免重复 JSX；
- 保持 TypeScript 类型正确。

十二、请直接修改代码

请直接基于当前工作区代码实现以上改造。

要求：
1. 不引入新的大型依赖。
2. 不引入 shadcn/ui、MUI、Ant Design 等 UI 框架。
3. 可以继续使用 lucide-react。
4. 保持 TypeScript 无类型错误。
5. 保持 ESLint/Prettier 风格一致。
6. 不删除现有核心功能。
7. 不修改后端、Express、文件转换、Gemini API 调用等核心逻辑。
8. 不要只给建议，请直接修改相关文件。

十三、完成后请输出总结

完成后请告诉我：

1. 修改了哪些文件；
2. 每个文件的核心变化；
3. Hero 区域如何变得更简洁；
4. Workspace Upload 区域如何与 Hero 统一；
5. 是否改动了任何业务逻辑；
6. 是否存在兼容性风险；
7. 如何本地验证：

   npm install
   npm run dev
   npm run build
   npm run lint

如果项目没有 lint 脚本，请说明。

注意：请自行规划阶段性独立提交 git push，不要等到最终完成才做一次大的 git push，要小步骤迭代提交，每次提交都包含一个相对完整的调整与文档的同步更新。