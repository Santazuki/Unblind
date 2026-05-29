# Phase 5 — Google Gemini Provider

## 概述

为 Unblind 添加 Google Gemini 视觉模型支持。Gemini 2.5 Flash 是免费层最强的视觉模型之一，与现有 Mimo/OpenAI/Ollama 并列，用户可通过 `UNBLIND_PROVIDER_ORDER` 将其加入链式轮换。

## API 格式映射

### Gemini API 格式

```
端点:  {baseUrl}/v1/models/{model}:generateContent
认证:  x-goog-api-key: {apiKey}
请求:  POST, JSON body
```

### 请求体对比

| 维度 | Mimo (Anthropic) | OpenAI | **Gemini (本次)** |
|------|------------------|--------|-------------------|
| 图片格式 | `{ type:"image", source:{ type:"base64", media_type, data }}` | `{ type:"image_url", image_url:{ url }}` data URL | `{ inlineData:{ mimeType, data }}` raw base64, mimeType 分离 |
| 多图 | content[] 中多个 image 块 | content[] 中多个 image_url 块 | parts[] 中多个 inlineData 块 |
| 认证 | `Authorization: Bearer` 或 `x-api-key` | `Authorization: Bearer` | `x-goog-api-key` |
| URL 路径 | `/v1/messages` | `/chat/completions` | `/v1/models/{model}:generateContent` |
| Base URL | 由 key 前缀自动推导 | 固定或 env 指定 | 固定 `https://generativelanguage.googleapis.com` |
| 默认模型 | mimo-v2.5 | gpt-4o | gemini-2.5-flash |

### Gemini 响应格式

```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "图片描述内容..." }]
    }
  }]
}
```

提取路径: `data.candidates[0].content.parts[0].text`

## 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/lib/providers/gemini.js` | **新增** | GeminiProvider 类 |
| `scripts/lib/providers/registry.js` | 修改 | 注册表加一行 gemini 条目 |
| `scripts/lib/credentialManager.js` | 修改 | 增加 `AIza` 前缀检测 → Gemini Base URL |
| `docs/design/phase5-gemini-provider.md` | 新增 | 本文档 |
| `tests/test-gemini-provider.js` | 新增 | 单元测试（见下方测试要点） |

**不修改的文件**: `provider.js`（基类无需变动）、`orchestrator.js`（registry 改动对上层透明）、`httpClient.js`（通用 fetch 层无需变动）

## 各文件详细设计

### 1. `scripts/lib/providers/gemini.js` — 新增 Provider 实现

```js
import { BaseProvider } from "./provider.js";
import { ClientError } from "../errorHandler.js";
import { log } from "../logger.js";

const GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

export class GeminiProvider extends BaseProvider {
  constructor({ apiKey, baseUrl, model = "gemini-2.5-flash", timeoutMs = 60_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl || GEMINI_DEFAULT_BASE_URL;
  }

  get name() { return "gemini"; }

  _buildRequest(images, prompt, options) {
    const parts = [];

    if (Array.isArray(images)) {
      // Multi-image: each element is { base64, mimeType }
      for (const img of images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: this._rawB64(img.base64),
          },
        });
      }
    } else {
      // Single image (backward-compatible)
      parts.push({
        inlineData: {
          mimeType: this._mime(images),
          data: this._rawB64(images),
        },
      });
    }

    parts.push({ text: prompt });

    return {
      url: `${this._baseUrl}/v1/models/${this._model}:generateContent`,
      body: { contents: [{ parts }] },
      headers: { "x-goog-api-key": this._apiKey },
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ClientError("Gemini API 返回格式异常，未找到文本内容");
    return text;
  }

  /** 从 data URL 中提取 raw base64（去掉 data:...;base64, 前缀） */
  _rawB64(d) {
    const i = d.indexOf(";base64,");
    return i >= 0 ? d.slice(i + 8) : d;
  }

  /** 从 data URL 中提取 mimeType */
  _mime(d) {
    const m = d.match(/^data:(.+?);base64,/);
    return m ? m[1] : "image/png";
  }
}
```

**关键设计要点**:
- `timeoutMs` 默认设为 60000（60s），因 Gemini 免费层首次调用有冷启动延迟
- 认证使用 `x-goog-api-key` 头，与 Bearer 体系隔离
- `_rawB64()` 与 Mimo 的 `_b64()` 逻辑完全相同（剥离 data URL 前缀），但方法名更语义化
- 不依赖 `credentialManager.js` 的 `getAuthHeader()` / `getBaseUrl()`，因为 Gemini 的认证方式完全不同

### 2. `scripts/lib/providers/registry.js` — 注册表加一行

在 `REGISTRY` 数组末尾追加：

```js
{
  name: "gemini",
  cls: GeminiProvider,
  envKey: "GEMINI_API_KEY",
  build: (apiKey, baseUrl, model, timeoutMs) =>
    new GeminiProvider({ apiKey, baseUrl, model, timeoutMs }),
},
```

同时文件顶部 import：

```js
import { GeminiProvider } from "./gemini.js";
```

用户配置方式：
```bash
export GEMINI_API_KEY="AIza..."
export UNBLIND_PROVIDER_ORDER="gemini,mimo,openai"
```

Gemini 无需额外 Base URL 配置（使用默认值 `https://generativelanguage.googleapis.com`），但如使用代理或兼容 API，可以通过环境变量覆盖：
```bash
export GEMINI_BASE_URL="https://custom-gateway.example.com"
```

**注意**: 当前 registry 的 `build` 函数签名 `(apiKey, baseUrl, model, timeoutMs)` 中的 `baseUrl` 通过 `baseUrls[name]` 传入。由于 `credentialManager.js` 不会在 registry 的 `loadProviders` 流程中自动推导 Gemini 的 baseUrl，需要在 `registry.js` 或 `gemini.js` 中处理默认值。上述 `gemini.js` 的设计已包含 `baseUrl || GEMINI_DEFAULT_BASE_URL` 兜底，所以当 `baseUrl` 为空字符串时自动 fallback。

### 3. `scripts/lib/credentialManager.js` — AIza 前缀检测

在 `getBaseUrl()` 函数中，在 `sk-ant` 分支之后、`sk-` 分支之前，增加 `AIza` 前缀检测：

```js
if (apiKey.startsWith("AIza")) {
  const url = "https://generativelanguage.googleapis.com";
  log("debug", "credentialManager", "base_url_detected", { type: "gemini", url });
  return url;
}
```

**为何需要**: 虽然 GeminiProvider 内部已硬编码默认 Base URL，但 `credentialManager.getBaseUrl()` 被其他模块或外部调用时也应能识别 Gemini Key。这保持了 credentialManager 的完整性——它负责"根据 Key 前缀识别 Provider 类型"这一职责。

`getAuthHeader()` 保持不动：Gemini 使用 `x-goog-api-key` 头，这与当前逻辑不冲突（`sk-` 前缀走 Bearer，非 `sk-` 走 `x-api-key`——但 Gemini 的 Key 头是 `x-goog-api-key`，在 GeminiProvider 内部直接构造 header，不通过 `getAuthHeader()`）。

### 4. 测试要点 (`tests/test-gemini-provider.js`)

| 测试 | 说明 |
|------|------|
| 构造 & name | `new GeminiProvider({apiKey:"AIza..."})` → `.name === "gemini"` |
| `_rawB64()` | data URL → 正确剥离前缀 |
| `_mime()` | data URL → 提取 mimeType: image/png |
| `_buildRequest` 单图 | 返回 url/body/headers 结构正确，parts 含 inlineData + text |
| `_buildRequest` 多图 | `[{base64,mimeType}]` → parts 中多个 inlineData |
| `_parseResponse` 正常 | mock 响应 → 正确提取 text |
| `_parseResponse` 异常 | 缺少 candidates → ClientError |
| healthCheck | 继承 BaseProvider，自动可用 |

## 实现顺序

```
Step 1: scripts/lib/providers/gemini.js    — Provider 核心实现
Step 2: scripts/lib/providers/registry.js  — 注册一行
Step 3: scripts/lib/credentialManager.js   — AIza 前缀检测
Step 4: tests/test-gemini-provider.js      — 测试
Step 5: node --test                        — 全量回归
```

## 多 Provider 集成全景

加入 Gemini 后，完整的 Provider 生态：

```
Mimo     (Anthropic 格式)    mimo-v2.5     env: MIMO_API_KEY
OpenAI   (OpenAI 格式)       gpt-4o        env: OPENAI_API_KEY
Ollama   (OpenAI 格式)       gemma3        env: OLLAMA_BASE_URL
Gemini   (Gemini 格式)       gemini-2.5-flash  env: GEMINI_API_KEY   ← 新增
```

链式轮换顺序示例：
```bash
# 优先 Gemini (免费)，降级到 Mimo (TokenPlan)
export UNBLIND_PROVIDER_ORDER="gemini,mimo,openai"

# 仅用 Gemini
export UNBLIND_PROVIDER_ORDER="gemini"
```

## Gemini API 注意事项

1. **隐私**: Google 免费层 API Key 可能用于训练。生产环境建议付费层或自行评估。
2. **免费额度**: Gemini API 有免费配额（每分钟请求数限制），`_buildRequest` 无需改动，但用户应注意调用频率。
3. **模型版本**: `gemini-2.5-flash` 是当前默认，用户可通过 `UNBLIND_MODEL=gemini-2.5-pro` 自定义。
4. **图片限制**: Gemini 支持图片最大 20MB（base64 编码后），与现有 `imageProcessor.js` 的校验兼容。
5. **Safety Settings**: Gemini 默认 safety 阈值可能拦截部分图片描述。如需放宽，可在 `_buildRequest` 中追加 `safetySettings` 字段，但初始版本不做，保持最小实现。
