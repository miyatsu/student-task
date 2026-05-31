# 安全审计报告

审计日期：2026-05-31 | 审计范围：全量源码（`server.ts`、`src/`、`scripts/`）| 方法：静态代码审查

---

## 审计概要

| 严重度 | 数量 | 说明 |
|:---|:---|:---|
| 高 (HIGH) | 2 | 服务端绑定 `0.0.0.0`、XSS via mammoth HTML |
| 中 (MEDIUM) | 4 | 文件上传无大小限制、命令注入反模式、依赖供应链风险、缺少安全头 |
| 低 (LOW) | 5 | 无认证、无速率限制、错误信息泄露、react-markdown 链接风险、OCR 超时 |
| 信息 (INFO) | 3 | 设计层面的安全说明与已验证的安全实践 |

---

## 高危发现 (HIGH)

### H1 — 服务端绑定 0.0.0.0，暴露于所有网络接口

**文件**: `server.ts:401`

```typescript
httpServer.listen(activePort, "0.0.0.0");
```

服务端显式绑定到 `0.0.0.0`，会在本机所有网络接口上监听。对于本地优先的工具，这会导致：
- 同一局域网内的其他设备可以访问服务端及全部 API
- 若存在端口转发或 NAT，可能暴露到公网
- AI API key 虽不直接暴露给浏览器，但攻击者可通过 `/api/ai/chat` 消耗配额
- `/api/compress/start`、`/api/word/convert-pdf` 等端点亦可被远程利用

**建议**: 默认绑定到 `127.0.0.1`。如需局域网访问，通过环境变量（如 `BIND_ADDRESS`）控制。

---

### H2 — FilePreview 组件 XSS 风险（mammoth HTML 未经消毒直接渲染）

**文件**: `src/components/FilePreview.tsx:93-96`、`src/features/files/word-pdf.ts:18`

```tsx
// FilePreview.tsx
<div dangerouslySetInnerHTML={{ __html: wordHtml }} />

// word-pdf.ts
source.innerHTML = html;
```

`wordHtml` 来源于 `mammoth.convertToHtml()`（DOCX）或服务端 `word-conversion.ts`（旧版 `.doc`）。服务端路径已通过 `escapeHtml()` 转义，但 mammoth 的输出保留了 DOCX 中的原始 HTML 结构。恶意构造的 DOCX 文件可通过嵌入 `<script>`、`<iframe>` 或事件处理器（`onload`、`onerror` 等）在 FilePreview 组件的 origin 上下文中执行任意 JavaScript。

**注意**: 此 XSS 仅在用户主动预览恶意 DOCX 文件时触发，不是反射型或存储型远程攻击。但 DOCX 文件可能来自不可信来源（邮件附件、网络下载），风险不可忽略。

`word-pdf.ts:18` 中的 `source.innerHTML = html` 也使用了未经消毒的 HTML。该宿主节点虽然不可见且 `pointer-events: none`，但 HTML 中的脚本可能被执行。

**建议**: 在渲染前对 mammoth 输出的 HTML 做消毒处理，推荐使用 `DOMPurify`：
```ts
import DOMPurify from 'dompurify';
const sanitized = DOMPurify.sanitize(result.value);
```

---

## 中危发现 (MEDIUM)

### M1 — Multer 文件上传无大小和类型限制

**文件**: `server.ts:37`

```typescript
const upload = multer({ dest: uploadDir });
```

multer 实例未配置 `limits.fileSize`、`limits.files`、`fileFilter` 等参数。攻击者可以：
- 上传超大文件耗尽磁盘空间
- 上传非预期类型文件触发服务端异常

受影响端点：`/api/word/extract-html`、`/api/word/convert-pdf`、`/api/compress/start`、`/api/pdf2img`。

**建议**: 为 multer 添加合理的文件大小上限，例如 `limits: { fileSize: 100 * 1024 * 1024 }`（100 MB），并添加 `fileFilter` 按 MIME 类型过滤。

---

### M2 — Ghostscript 命令注入反模式

**文件**: `src/server/compression.ts:30-36`、`server.ts:205`

```typescript
export function buildGhostscriptCompressionCommand({ inputPath, outputPath, pdfSettings }) {
  return `gs -sDEVICE=pdfwrite ... -sOutputFile="${outputPath}" "${inputPath}"`;
}
// ...
await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
```

使用字符串拼接构建 shell 命令 + `child_process.exec()` 的组合是命令注入的典型反模式。虽然当前 `pdfSettings` 受限于三个硬编码值（`/screen`、`/ebook`、`/printer`），`inputPath` 和 `outputPath` 来自 multer 生成的临时路径，**当前不可被外部利用**，但若未来有人修改 `resolvePdfCompressionSettings` 使其接受用户输入，将直接产生命令注入漏洞。

此外，Ghostscript 命令未显式设置 `-dSAFER` 标志。虽然现代 Ghostscript（≥9.50）默认启用，但显式设置可防止因版本差异导致的安全退化。

**建议**:
- 改用 `execFile('gs', args)` 并将参数以数组形式传递
- 显式添加 `-dSAFER` 标志

---

### M3 — 依赖供应链风险

**文件**: `package.json`、`scripts/bootstrap-local-ocr.mjs`

1. `bootstrap-local-ocr.mjs:156-159` 通过硬编码的 PyPI 镜像安装 `paddlepaddle`：
   ```
   -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
   ```
   该 URL 未使用证书固定，且未校验包哈希。若镜像被劫持，攻击者可注入恶意 Python 包。
2. PaddlePaddle 版本在 `bootstrap-local-ocr.mjs:18` 中硬编码为 `3.2.0`，但 `paddleocr` 未固定版本，可能引入未经审查的依赖变更。
3. 项目有 40+ npm 依赖，建议定期执行 `npm audit`。

**建议**:
- 定期运行 `npm audit` 并修复已知漏洞
- 对 pip 安装固定具体版本（如 `paddleocr==x.x.x`）
- 考虑在 CI 中启用 Dependabot

---

### M4 — 缺少安全相关 HTTP 响应头

**文件**: `server.ts`

服务器未设置以下关键安全头部：
- `Content-Security-Policy`（CSP）
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`

对于本地单用户工具，缺失这些头部的实际风险较低。若未来部署到公网或多人环境，需补充。

**建议**: 引入 `helmet` 中间件，至少配置 `X-Content-Type-Options: nosniff` 和 `X-Frame-Options: DENY`。

---

## 低危发现 (LOW)

### L1 — 所有 API 端点无认证

**文件**: `server.ts:47-364`

`/api/ai/chat`、`/api/ocr/image`、`/api/compress/*`、`/api/word/*`、`/api/pdf2img` 等端点均无需认证。系统设计为本地单用户工具，此为架构上的有意取舍。但结合 [H1]（绑定 `0.0.0.0`）时，此问题严重性升高。

**建议**: 绑定到 `127.0.0.1` 可缓解此问题。若需远程访问，添加 token 认证。

---

### L2 — 无请求速率限制

**文件**: `server.ts` 全局

所有 API 端点均无速率限制。对 `/api/ai/chat` 来说，缺乏限制可能导致 AI API 配额被意外耗尽。对 `/api/ocr/image` 来说，大量并发 OCR 请求可能占用 CPU。

**建议**: 引入 `express-rate-limit` 对 AI 和 OCR 端点设置合理限制。

---

### L3 — 错误响应泄露内部信息

**文件**: `server.ts:104,157,358`、`src/server/local-ocr.ts:233`、`scripts/local-ocr/ocr_runner.py:77`

多处错误处理将原始 `error.message` 返回给客户端：
```typescript
res.status(500).json({
  error: error instanceof Error ? error.message : String(error),
});
```
内部错误消息可能暴露文件系统路径、依赖库版本等信息。

**建议**: 生产环境返回通用错误消息，详细错误记录到服务端日志。

---

### L4 — react-markdown 链接协议风险

**文件**: `src/components/AiAssistant.tsx:219`

```tsx
<Markdown>{msg.text}</Markdown>
```

`react-markdown` 默认不渲染原始 HTML，但 markdown 链接语法 `[text](url)` 中的 URL 不经过滤。如果 AI 模型返回包含 `javascript:` 协议链接的 markdown，可能构成风险。

**建议**: 配置 `urlTransform` 过滤危险协议：
```tsx
<Markdown urlTransform={(url) => /^(https?:|mailto:|#)/.test(url) ? url : ''}>
  {msg.text}
</Markdown>
```

---

### L5 — OCR 超时较长

**文件**: `src/server/local-ocr.ts:10-11`

```typescript
const LOCAL_OCR_REQUEST_TIMEOUT_MS = 300_000;  // 5 分钟
const LOCAL_OCR_STARTUP_TIMEOUT_MS = 300_000;  // 5 分钟
```

单个 OCR 请求可占用 worker 进程长达 5 分钟，且并发请求需排队，可能被利用进行资源占用。

**建议**: 将超时降低到 120 秒，并限制并发 OCR 请求数量。

---

## 信息 (INFO)

### I1 — 无身份认证（按设计）

系统设计为本地单用户工具，无登录/认证机制。所有 API 端点均可被 localhost 上的任意进程访问。这是架构上的有意取舍，而非疏忽。部署到多用户或公网环境时需额外添加认证层。

### I2 — AI 文件内容发送

用户通过 AI 助手分析文件时，文件内容（文本和 base64 图片）通过服务端 `/api/ai/chat` 转发给第三方 AI provider。这不属于漏洞——AI 对话功能的前提就是用户主动选择将文件内容发送给 AI。README 和 `.env.example` 已明确说明此行为。

### I3 — `.env` 保护

`.env` 文件已正确加入 `.gitignore`，`.env.example` 通过 `!.env.example` 规则排除在忽略列表外。API key 不会通过 `/api/runtime-config` 暴露给浏览器，仅返回 `configured: true/false` 的布尔摘要。`dotenv.config({ override: false, quiet: true })` 确保已有环境变量不被覆盖、缺失 `.env` 时不中断启动。

---

## 已验证安全的设计

以下方面经审查确认为安全：

- **输入验证**: `src/server/ai.ts` 中对 AI 请求的 `normalizeAiChatRequest()`、`normalizeAiOcrRequest()` 对所有字段做了严格类型和格式校验；`src/server/local-ocr.ts` 同理
- **HTML 转义**: `src/server/word-conversion.ts` 中的 `escapeHtml()` 函数对旧版 `.doc` 提取的文本做了正确的 HTML 实体编码
- **JSON 解析**: 全局使用 `JSON.parse()` 而非 `eval()`，无任意代码执行风险
- **文件路径**: 所有磁盘文件路径通过 multer 生成或 `path.join()` 构建，无路径遍历风险
- **子进程调用**: `word-pdf-native.ts` 使用 `execFile`（非 `exec`），避免了 shell 注入；PowerShell 脚本使用 `Resolve-Path` 防止路径遍历
- **Python 端**: `ocr_runner.py` 使用 `tempfile.NamedTemporaryFile` 安全创建临时文件，结束后通过 `finally` 块清理；OCR runner 通过 stdin/stdout JSON 行协议通信，避免命令行参数注入
- **API Key 隔离**: `/api/runtime-config` 只返回"已配置/未配置"摘要，不暴露原始 key
- **上传清理**: 所有文件上传端点使用 `finally` 块清理临时文件
- **`bootstrap-local-ocr.mjs` 使用 `spawnSync` 参数数组**：避免了命令注入

---

## 建议修复优先级

| 优先级 | 编号 | 措施 | 工作量 |
|:---|:---|:---|:---|
| P0 | H1 | 将服务端默认绑定到 `127.0.0.1` | 极小 |
| P0 | H2 | 对 mammoth HTML 输出做 DOMPurify 消毒 | 小 |
| P1 | M1 | 为 multer 添加 `fileSize` 限制 | 小 |
| P1 | M2 | 将 Ghostscript 命令改用 `execFile` | 小 |
| P2 | M3 | 执行 `npm audit`、固定 pip 依赖版本 | 中 |
| P2 | M4 | 添加基础安全 HTTP 头部 | 小 |
| P3 | L2 | 为 AI endpoint 添加速率限制 | 中 |
| P3 | L4 | 为 react-markdown 添加 URL 过滤 | 极小 |

---

*本报告基于静态代码审查生成，未包含动态渗透测试或依赖漏洞自动化扫描。建议在每次发版前重新执行 `npm audit` 并在重大功能变更后更新本报告。*
