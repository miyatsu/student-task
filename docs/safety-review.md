# 安全审计报告

审计日期：2026-05-31 | 审计范围：全量源码（`server.ts`、`src/`、`scripts/`）| 方法：静态代码审查

## 审计概要

| 严重度 | 数量 | 说明 |
|:---|:---|:---|
| 高 (HIGH) | 0 | 未发现可直接远程利用的高危漏洞 |
| 中 (MEDIUM) | 4 | 文件上传无大小限制、XSS 风险、依赖供应链 |
| 低 (LOW) | 5 | 代码健壮性改进点、缺失安全头部等 |
| 信息 (INFO) | 3 | 设计层面的安全说明 |

---

## 中危发现 (MEDIUM)

### M1 — multer 文件上传无大小限制

**文件**: `server.ts:37`
**代码**: `const upload = multer({ dest: uploadDir });`

multer 实例创建时未配置 `limits.fileSize`，攻击者或意外的大文件上传可能耗尽磁盘空间。所有文件上传路由（`/api/word/extract-html`、`/api/word/convert-pdf`、`/api/compress/start`、`/api/pdf2img`）均受影响。

**建议**: 为 `multer` 添加合理的文件大小上限，例如 `limits: { fileSize: 100 * 1024 * 1024 }`（100 MB），或在各路由中按文件类型分别设置限制。

### M2 — FilePreview 组件 XSS 风险（mammoth HTML 直接渲染）

**文件**: `src/components/FilePreview.tsx:93-96`
**代码**:
```tsx
<div
  className="..."
  dangerouslySetInnerHTML={{ __html: wordHtml }}
/>
```

`wordHtml` 来源于 `mammoth.convertToHtml()`（DOCX）或服务端 `word-conversion.ts`（旧版 `.doc`）。服务端路径已通过 `escapeHtml()` 转义，但 mammoth 的输出保留了 DOCX 中的原始 HTML 结构。恶意构造的 DOCX 文件可通过嵌入 `<script>`、`<iframe>` 或事件处理器（`onload`、`onerror` 等）在 FilePreview 组件的 origin 上下文中执行任意 JavaScript。

**注意**: 此 XSS 仅在使用者主动预览恶意 DOCX 文件时触发，不是反射型或存储型远程攻击。但考虑到 DOCX 文件可能来自不可信来源（邮件附件、网络下载），风险不可忽略。

**建议**: 在渲染前对 mammoth 输出的 HTML 做消毒处理，推荐使用 `DOMPurify`：
```ts
import DOMPurify from 'dompurify';
const sanitized = DOMPurify.sanitize(result.value);
```

同理，`src/features/files/word-pdf.ts:18` 中 `source.innerHTML = html` 也使用了未经消毒的 HTML 用于 PDF 生成（虽然该宿主节点不可见且 `pointer-events: none`）。

### M3 — 依赖供应链风险

**文件**: `package.json`、`scripts/bootstrap-local-ocr.mjs`

1. `npm install` 未使用 `npm ci` 或 lockfile 完整性校验。
2. `bootstrap-local-ocr.mjs:156-159` 通过硬编码的 PyPI 镜像安装 `paddlepaddle`：
   ```
   -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
   ```
   该 URL 未使用 HTTPS 证书固定，且安装过程中未校验包哈希。若镜像被劫持，攻击者可注入恶意 Python 包。
3. 项目依赖的第三方包数量较多（40+），建议定期执行 `npm audit`。

**建议**:
- 定期运行 `npm audit` 并修复已知漏洞
- 对 `bootstrap-local-ocr.mjs` 中的 pip 安装添加 `--require-hashes` 或至少固定版本号
- 在 CI 中启用 Dependabot 或类似工具

### M4 — Ghostscript 命令注入面

**文件**: `src/server/compression.ts:30-35`、`server.ts:195-205`

```ts
export function buildGhostscriptCompressionCommand({ inputPath, outputPath, pdfSettings }) {
  return `gs -sDEVICE=pdfwrite ... -sOutputFile="${outputPath}" "${inputPath}"`;
}
```

虽然当前 `pdfSettings` 受限于三个硬编码值（`/screen`、`/ebook`、`/printer`），`inputPath` 来自 multer 生成的安全临时路径，当前**不可被外部利用**，但使用字符串拼接构建 shell 命令 + `child_process.exec()` 的组合是命令注入的典型反模式。未来若有人修改 `resolvePdfCompressionSettings` 使其接受用户输入，将直接产生命令注入漏洞。

**建议**: 改用 `execFile('gs', args)` 并将参数以数组形式传递，彻底消除 shell 解析环节。

---

## 低危发现 (LOW)

### L1 — 缺失安全相关 HTTP 头部

**文件**: `server.ts`

服务器未设置以下安全头部：
- `Content-Security-Policy`（CSP）
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`（本地使用 HTTP 时不适用）

对于本地单用户工具，缺失这些头部的实际风险较低。若未来部署到公网环境，需要补充。

**建议**: 添加一个简单的安全头部中间件，至少设置 `X-Content-Type-Options: nosniff`。

### L2 — 无请求频率限制

所有 API 端点（`/api/ai/chat`、`/api/ocr/image`、`/api/compress/start` 等）均无速率限制。在本地单用户场景下风险低，但恶意本地进程或浏览器扩展可能滥用。

**建议**: 对 AI gateway 端点添加速率限制，保护 API 配额不被意外耗尽。

### L3 — `/api/runtime-config` 无响应缓存控制

**文件**: `server.ts:51-54`

虽然已设置 `Cache-Control: no-store`，但 `/api/runtime-config` 返回了哪些 AI provider 已配置的信息。这本身就是设计意图（前端需要知道 AI 是否可用），但攻击者可以通过此端点探测系统是否配置了特定 AI 服务。

**当前状态**: 可接受，仅为信息泄露级别。

### L4 — Python OCR runner 异常信息泄露

**文件**: `scripts/local-ocr/ocr_runner.py:77`

```python
emit_message({"type": "error", "id": request_id, "error": str(error)})
```

OCR 错误信息直接透传给前端。在本地工具中这有助于调试，但如果错误信息包含文件路径或系统细节，可能泄露内部信息。

**建议**: 在生产模式中对错误信息做脱敏处理。

### L5 — 无 CORS 保护

**文件**: `server.ts`

Express 应用未使用 `cors` 中间件，也未手动设置 CORS 头部。浏览器的默认同源策略会阻止跨源请求，因此本地使用时是安全的。但若将来需要允许跨源访问，务必配置严格的 CORS 白名单。

---

## 信息 (INFO)

### I1 — 无身份认证（按设计）

系统设计为本地单用户工具，无登录/认证机制。所有 API 端点均可被 localhost 上的任意进程访问。这是架构上的有意取舍，而非疏忽。部署到多用户或公网环境时需额外添加认证层。

### I2 — AI 文件内容发送

用户通过 AI 助手分析文件时，文件内容（文本和 base64 图片）通过服务端 `/api/ai/chat` 转发给第三方 AI provider（Gemini、OpenAI 或 DeepSeek）。这不属于漏洞——AI 对话功能的前提就是用户主动选择将文件内容发送给 AI。README 和 `.env.example` 已明确说明本地优先原则。

### I3 — `.env` 保护

`.env` 文件已正确加入 `.gitignore`（第 16 行），`.env.example` 通过 `!.env.example` 规则排除在忽略列表外。API key 不会通过服务端 `/api/runtime-config` 暴露给浏览器，仅返回 `configured: true/false` 的布尔摘要。`dotenv.config({ quiet: true })` 确保缺失 `.env` 时不会中断启动。

---

## 已验证安全的设计

以下方面经审查确认为安全：

- **输入验证**: `src/server/ai.ts` 中的 `normalizeAiChatRequest()`、`normalizeAiOcrRequest()` 对所有 AI 请求字段做了严格的类型和格式校验；`src/server/local-ocr.ts` 同理
- **HTML 转义**: `src/server/word-conversion.ts` 中的 `escapeHtml()` 函数对旧版 `.doc` 提取的文本做了正确的 HTML 实体编码
- **JSON 解析**: 全局使用 `JSON.parse()` 而非 `eval()`，无任意代码执行风险
- **文件路径**: 所有磁盘文件路径通过 multer 生成或 `path.join()` 构建，无路径遍历风险
- **子进程调用**: `word-pdf-native.ts` 使用 `execFile`（非 `exec`），避免了 shell 注入
- **Python 端**: `ocr_runner.py` 使用 `tempfile.NamedTemporaryFile` 安全创建临时文件，结束后通过 `finally` 块清理

---

## 建议修复优先级

| 优先级 | 编号 | 措施 | 工作量 |
|:---|:---|:---|:---|
| P0 | M2 | 对 mammoth HTML 输出做 DOMPurify 消毒 | 小 |
| P1 | M1 | 为 multer 添加 `fileSize` 限制 | 小 |
| P1 | M4 | 将 Ghostscript 命令改用 `execFile` | 小 |
| P2 | M3 | 执行 `npm audit` 并修复已知漏洞 | 中 |
| P2 | L1 | 添加基础安全 HTTP 头部 | 小 |
| P3 | L2 | 为 AI endpoint 添加速率限制 | 中 |

---

*本报告基于静态代码审查生成，未包含动态渗透测试或依赖漏洞自动化扫描。建议在每次发版前重新执行 `npm audit` 并在重大功能变更后更新本报告。*
