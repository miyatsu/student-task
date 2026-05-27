请先不要修改代码。请作为资深网页设计专家和 React/Tailwind 前端工程师，阅读当前 PCIE 项目的首页相关源码，重点检查 Hero、Workflow Cards、Workspace Upload 上传区和 App.tsx 的布局组合。

当前首页已经从旧版简化，但仍存在以下视觉问题：
1. Hero tags 靠左而标题居中，视觉轴线不统一；
2. 页面留白较多，但视觉重心不够明确；
3. Workflow cards 和 Upload panel 像两个分离模块；
4. Upload panel 面积过大但内容偏少；
5. 缺少明确主 CTA；
6. 虚线边框略显 demo 感；
7. 图标风格不够统一；
8. 色彩偏冷偏硬，缺少成熟产品感。

请先分析：
1. 当前首页组件结构；
2. 每个组件的问题；
3. 哪些文件需要修改；
4. 哪些业务逻辑不能改；
5. 你建议采用居中布局还是左右分栏布局；
6. 具体的配色、字体、间距、卡片、上传区优化方案；
7. 修改计划和风险点。

请只输出分析和计划，暂时不要改代码。等我确认后再实施。

---

## 当前首页分析（基于 2026-05-27 当前代码状态）

### 1. 当前首页组件结构

当前首页的首屏结构主要由两个文件决定：

1. `src/App.tsx`
	- 顶部用一个 `section.space-y-6` 串联三个模块：`<HomeHero />`、`<HomeCapabilityStrip />`、`workspace-upload-panel`。
	- 上传区的真实交互逻辑在这里，使用同一个 `fileInputRef`、`openFilePicker()`、`processFiles()`、`handleDragOver()`、`handleDragLeave()`、`handleDrop()`、`handleFileInput()`、`handleUploadZoneKeyDown()`。
	- 首屏之后才进入 `ImageFilesSection`、`PdfFilesSection`、`WordFilesSection` 等真实工作区。

2. `src/components/HomeHero.tsx`
	- `HomeHero` 负责 trust tags、主标题和两段 supporting copy。
	- `HomeCapabilityStrip` 负责三张 Workflow cards，并通过 `capabilities` 数组渲染。
	- 图标系统当前是“自定义 PDF/DOC 文档图形 + lucide 图片图标”的混合实现。

3. `src/index.css`
	- 当前只有 Tailwind 基础引入，没有首页级别的设计 token、颜色变量、字体策略或组件级语义样式层。

结论：
当前首页已经不是传统 Hero + 复杂 marketing 长页，而是一个“首屏入口 + 下方真实工作区”的结构。问题不在业务逻辑，而在视觉层级、对齐策略和模块组合方式。

### 2. 每个组件的问题

#### Hero（`HomeHero`）

1. trust tags 仍然偏左，而主标题与正文偏居中，首屏视觉轴线并不统一。
2. 标题为了强行保持单行，已经依赖较多响应式字号与 `nowrap` 微调；当前方案可用，但设计弹性不足，后续再改文案时容易再次溢出。
3. supporting copy 目前是两段文本，但主视觉里仍缺少“明确可点击主 CTA”，导致用户读完文案后还要把视线继续往下找上传入口。
4. Hero 背景和容器都偏浅，标题虽然大，但首屏真正的行动焦点并不够集中。

#### Workflow Cards（`HomeCapabilityStrip`）

1. 三张卡片本身干净，但与 Upload panel 之间仍像两个独立模块，而不是一个连续的工作台入口。
2. 卡片的信息密度偏平均，每张卡都很“正确”，但缺少主次，导致它们更像说明区而不是 workflow summary。
3. 图标风格仍然不完全统一：PDF / Word 是自绘文档造型，Image 是 lucide 图标，线条语言与体量感不同。

#### Workspace Upload（`workspace-upload-panel`）

1. 当前已回退到更居中的卡片风格，但面积仍偏大，内容量偏少，视觉上像一个独立海报，而不是首屏主操作区的一部分。
2. 虚线边框虽然弱化过，但依然容易带出 demo / dropzone 组件的气质，不够成熟。
3. 当前通过整卡点击承载 CTA，功能没问题，但“可点击”的强度主要依赖用户经验，而不是视觉引导。
4. 上传区和 Workflow Cards 之间缺少共享容器、共享背景或共享节奏，因此它们仍像上下堆叠的两块白卡。

#### App.tsx 布局组合

1. 当前首屏是 `Hero -> cards -> upload` 的纵向堆叠，但这三个模块彼此是并列关系，不是一个整合过的单一故事线。
2. 页面留白很多，但由于缺少一个强主卡或主按钮，视觉重心并没有真正收束到上传动作上。
3. `max-w-7xl` + 大留白 + 多张白卡的组合，会放大“模块分散”的感觉。

### 3. 哪些文件需要修改

如果要解决当前问题，建议优先改以下文件：

1. `src/components/HomeHero.tsx`
	- 对齐方式统一
	- Hero 标题/正文/CTA 重构
	- Workflow cards 的图标、层级、间距、背景关系调整

2. `src/App.tsx`
	- 首屏三个模块的组合方式
	- Upload panel 的外层容器、尺寸、CTA 呈现、共享背景/边框策略
	- Hero / cards / upload 之间的 spacing 和层级关系

3. `src/index.css`
	- 如需要统一成熟产品感，建议新增少量首页专用设计 token：颜色变量、阴影、背景渐层、可选字体类

4. 文档文件（实施后同步）
	- `README.md`
	- `docs/user-manual.md`
	- `docs/implementation.md`

### 4. 哪些业务逻辑不能改

以下逻辑建议明确保持不变，只允许换壳，不允许重写行为：

1. `fileInputRef` 与 `openFilePicker()`
2. `processFiles()` 的文件识别、分组与加入列表逻辑
3. `handleDragOver()` / `handleDragLeave()` / `handleDrop()` / `handleFileInput()`
4. `handleUploadZoneKeyDown()` 的键盘可达性逻辑
5. `ImageFilesSection` / `PdfFilesSection` / `WordFilesSection` 的 props、排序、选择、转换、预览、AI、压缩等业务行为
6. Word / image / PDF 相关转换链路与其进度状态
7. 现有的 local-first / AI optional 语义

结论：
这一轮应当是“视觉层重构”，不是“交互链路重构”。上传入口仍然必须复用同一套隐藏 `input[type=file]` 和同一批事件处理函数。

### 5. 布局建议：选择居中布局，不回到左右分栏

我建议继续采用**居中布局**，但不是当前这种“顺序堆三块卡片”的松散居中，而是：

1. 保持首页首屏为单列中心轴
2. 让 Hero、Workflow summary、Upload CTA 视觉上收束为一个整体
3. 用共享背景、共享外轮廓或更紧凑的垂直节奏，把三段内容整合成一个“入口工作台”

不建议回到左右分栏，原因有三点：

1. 当前首页最重要的动作只有一个：上传文件。分栏会再次制造“双焦点”。
2. 文案量已经被压缩到很短，左文右卡会放大空白，反而更容易失衡。
3. 居中布局更适合当前工具型首页，也更容易兼容窄桌面和移动端。

### 6. 具体视觉优化建议

#### 配色

当前问题不是颜色太少，而是偏冷、偏硬、层次不够成熟。建议：

1. 页面基底从 `slate-50` 往更暖的中性色移动，例如 `zinc-50` / `stone-50` 方向。
2. 主文字保持深色中性（接近 `zinc-900`），次级文字统一到 `zinc-500/600`，避免 `slate` / `zinc` / `sky` 混用过多。
3. 强调色只保留一种主色，推荐偏稳的 desaturated blue：用于上传图标、CTA 和 focus state。
4. Hero 背景渐层改为更柔和的暖灰 + 淡蓝洗色，而不是当前偏冷的 top-left radial。

#### 字体

低风险方案：

1. 保持现有 sans 体系，不引入额外字体下载
2. 通过更稳定的字号和 tracking 调整层级

更优方案：

1. 给标题引入一款更成熟的展示型无衬线，例如 `Manrope` 或 `Instrument Sans`
2. 正文仍可保留系统 sans，控制引入成本

#### 间距

1. Hero / cards / upload 三段之间不建议继续使用平均 `space-y-6`
2. 更建议压缩成：Hero 下方 `20-24px`，cards 到 upload `16-20px`
3. Upload panel 的高度应该控制在“足以容纳主 CTA 和提示”的级别，而不是大面积留白

#### 卡片

1. 三张 Workflow cards 建议弱化“独立卡片感”，强化“同一条 workflow ribbon”感
2. 可考虑统一放进一个共享外壳中，再用三列内部分隔，而不是三张分离白卡
3. 阴影更轻，边框更细，背景更统一

#### Upload 区

1. 去掉强 demo 感虚线边框，改用实线细边框或弱描边 + hover 高亮
2. 在整卡可点击之外，增加更明确的主 CTA，例如一个真正的 `Choose files` 按钮
3. 保留拖拽提示，但降为次级辅助文案
4. 上传区应与 Workflow 区共享同一视觉母体，而不是独立海报卡片

#### 图标

1. 不建议继续混用“半自绘文档卡 + lucide 图片”
2. 建议统一到一套图标语言：
	- 要么全部用 lucide / phosphor / heroicons
	- 要么全部用统一风格的自定义文件徽章
3. 如果维持文件徽章方案，Image 也应改成同一风格的“图片文件卡”而不是纯线性图标

### 7. 修改计划（建议实施顺序）

#### Phase 1：结构收束

1. 在 `App.tsx` 中把 Hero、Workflow summary、Upload panel 收到一个共享首屏容器里
2. 调整三段间距和外层背景，让它们从“3 张卡”变成“1 个工作台入口”
3. 保留当前纵向单列，不回到左右分栏

#### Phase 2：Hero 重构

1. 统一 trust tags、标题、正文的中心轴
2. 让正文宽度和标题宽度服务同一视觉中心
3. 明确加入主 CTA，并与 upload 行为复用同一个 `fileInputRef`

#### Phase 3：Workflow ribbon 重构

1. 把三张 cards 从“平级说明卡”改成“轻量能力摘要带”
2. 统一图标风格
3. 减轻卡片分离感，提升和 Upload panel 的连续性

#### Phase 4：Upload panel 重构

1. 缩小面板高度
2. 去掉虚线 demo 感
3. 增加更明确主 CTA
4. 保留文件对话框选择、拖拽上传、键盘触发三种访问路径

#### Phase 5：样式收尾与文档同步

1. 如有必要，在 `src/index.css` 中补充极少量 token
2. 同步更新 `README.md`、`docs/user-manual.md`、`docs/implementation.md`
3. 跑 `npm run lint`、必要时跑 `npm test` / `npm run build`

### 8. 风险点

1. **上传可访问性风险**
	- 如果同时保留整卡点击和内嵌按钮，容易再次出现嵌套交互语义问题。

2. **响应式标题风险**
	- 当前 Hero 标题已经对宽度较敏感；如果再加字体或改文案，容易在中间断点重新溢出。

3. **模块重组风险**
	- 如果把 cards 和 upload 合并得太深，容易让首屏结构更复杂，而不是更清晰。

4. **图标统一风险**
	- 若临时混合两套图标体系，会让页面更不统一。

5. **逻辑回归风险**
	- 如果在布局重构时误改 `processFiles()`、拖拽事件、键盘事件或 `fileInputRef` 复用关系，会直接影响核心上传行为。

## 结论

当前首页的问题核心不是“功能不够”，而是“同一件事被拆成三个视觉上平级的模块”。

建议方向：

1. 保持居中布局
2. 把 Hero / Workflow / Upload 重新整合为一个入口工作台
3. 强化单一主 CTA
4. 弱化 demo 感边框和冷硬配色
5. 严格不改上传与文件处理业务逻辑