# Phase 5: Provider 注册表扩展方案

> 作者: 架构师
> 状态: 设计稿
> 目标: 从 3 Provider（mimo/openai/ollama）扩展到 6+ Provider，支持"一人一类"和"多人一类"两种注册模式

---

## 1. 现状分析

### 当前注册表结构（registry.js）

```js
const REGISTRY = [
  { name: "mimo",   cls: MimoProvider,   envKey: "MIMO_API_KEY",      build: (key, url, ...) => new MimoProvider({...}) },
  { name: "openai", cls: OpenAIProvider,  envKey: "OPENAI_API_KEY",    build: (key, url, ...) => new OpenAIProvider({...}) },
  { name: "ollama", cls: OpenAIProvider,  envKey: "OLLAMA_BASE_URL",   build: (key, url, ...) => new OpenAIProvider({...}) },
];
```

**关键洞察**: ollama 已证明 `OpenAIProvider` 可复用——只需不同 `envKey`、不同 `baseUrl`。Groq / Together AI / Fireworks AI 同理，它们都实现了 OpenAI Chat Completions API。

### 当前限制

1. **credentialManager.js** 只识别 `sk-ant`、`sk-`、`tp-` 前缀，无法处理 Gemini 的 `AIza` Key
2. **config.js** 大量 `MIMO_*` 硬编码 env 变量名，未抽象成通用模式
3. **orchestrator.js** 的 `buildProviderChain()` 硬编码了 `mimoKey` 和 baseUrls 的构造方式
4. 注册表不支持"同一类不同配置"的元数据描述（如 Groq 需 `GROQ_API_KEY` + `GROQ_BASE_URL`）

---

## 2. 新注册表结构

在 REGISTRY 条目中增加 `baseUrlKey`（可选）和 `openaiCompatible`（可选）属性，使 OpenAI 兼容的 Provider 不再需要硬编码 baseUrl。

### 2.1 核心改动：registry.js

```js
/**
 * @typedef {object} RegistryEntry
 * @property {string}      name        — 唯一标识名，用于 UNBLIND_PROVIDER_ORDER 排序
 * @property {function}    cls         — Provider 类（构造函数）
 * @property {string}      envKey      — API Key 环境变量（存在即启用）
 * @property {string}      [baseUrlKey] — Base URL 环境变量（可选，默认取 defaultBaseUrl）
 * @property {string}      [defaultBaseUrl] — 默认 Base URL（硬编码默认值）
 * @property {boolean}     [openaiCompatible] — true 表示复用 OpenAIProvider，仅组装参数
 * @property {function}    build       — (apiKey, baseUrl, model, timeoutMs) => provider 实例
 */
```

### 2.2 完整注册表

```js
const REGISTRY = [
  // ── 原生 Provider（独立类） ──
  {
    name: "mimo",
    cls: MimoProvider,
    envKey: "MIMO_API_KEY",
    build: (apiKey, baseUrl, model, timeoutMs) =>
      new MimoProvider({ apiKey, baseUrl, model, timeoutMs }),
  },
  {
    name: "gemini",
    cls: GeminiProvider,
    envKey: "GEMINI_API_KEY",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    build: (apiKey, baseUrl, model, timeoutMs) =>
      new GeminiProvider({ apiKey, baseUrl, model, timeoutMs }),
  },

  // ── OpenAI 兼容 Provider（共享 OpenAIProvider 类） ──
  {
    name: "openai",
    cls: OpenAIProvider,
    envKey: "OPENAI_API_KEY",
    defaultBaseUrl: "https://api.openai.com/v1",
    openaiCompatible: true,
    build: (apiKey, _baseUrl, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, model, timeoutMs }),
  },
  {
    name: "ollama",
    cls: OpenAIProvider,
    envKey: "OLLAMA_BASE_URL",       // 特殊：ollama 用 baseUrl 判断启用
    defaultBaseUrl: "http://localhost:11434/v1",
    openaiCompatible: true,
    build: (apiKey, url, model, timeoutMs) =>
      new OpenAIProvider({ apiKey: "ollama", baseUrl: url, model, timeoutMs }),
  },
  {
    name: "groq",
    cls: OpenAIProvider,
    envKey: "GROQ_API_KEY",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    openaiCompatible: true,
    build: (apiKey, _baseUrl, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, model, timeoutMs }),
  },
  {
    name: "together",
    cls: OpenAIProvider,
    envKey: "TOGETHER_API_KEY",
    defaultBaseUrl: "https://api.together.xyz/v1",
    openaiCompatible: true,
    build: (apiKey, _baseUrl, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, model, timeoutMs }),
  },
  {
    name: "fireworks",
    cls: OpenAIProvider,
    envKey: "FIREWORKS_API_KEY",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    openaiCompatible: true,
    build: (apiKey, _baseUrl, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, model, timeoutMs }),
  },

  // ── 待定 ──
  // deepseek-vl: 等待 DeepSeek 开放兼容的 API 端点后添加
];
```

### 2.3 loadProviders 适配

核心变化：
- 自动拼接 baseUrl：优先 `baseUrls[name]`（用户自定义） > 环境变量 `{NAME}_BASE_URL` > `defaultBaseUrl`（硬编码） > `""`
- `envKey` 逻辑不变：环境变量存在（非空字符串）即启用
- `openaiCompatible` 在内部用于日志标记，不改变行为

```js
export function loadProviders(order, opts = {}) {
  const { model, timeoutMs, baseUrls = {} } = opts;
  const available = new Map();

  for (const entry of REGISTRY) {
    const key = process.env[entry.envKey] || "";
    if (!key) continue;

    // 优先级: baseUrls[name] > env var > defaultBaseUrl > ""
    const envBaseUrl = entry.baseUrlKey ? (process.env[entry.baseUrlKey] || "") : "";
    const baseUrl = baseUrls[entry.name] || envBaseUrl || entry.defaultBaseUrl || "";

    available.set(entry.name, {
      provider: entry.build(key, baseUrl, model, timeoutMs),
      name: entry.name,
    });
  }
  // ...排序逻辑不变
}
```

---

## 3. 各 Provider 的 Env 变量命名规范

| Provider | 启用 Key 环境变量 | Base URL 环境变量 | 默认 Base URL | 默认模型 |
|----------|------------------|-------------------|---------------|----------|
| Mimo | `MIMO_API_KEY` | `MIMO_BASE_URL` | auto-detect | `mimo-v2.5` |
| Gemini | `GEMINI_API_KEY` | `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash-exp` |
| OpenAI | `OPENAI_API_KEY` | `OPENAI_BASE_URL` | `https://api.openai.com/v1` | `gpt-4o` |
| Ollama | `OLLAMA_BASE_URL`（无 Key 模式） | — | `http://localhost:11434/v1` | `llava` |
| Groq | `GROQ_API_KEY` | `GROQ_BASE_URL` | `https://api.groq.com/openai/v1` | `llama-4-vision` |
| Together | `TOGETHER_API_KEY` | `TOGETHER_BASE_URL` | `https://api.together.xyz/v1` | `meta-llama/Llama-3.2-90B-Vision` |
| Fireworks | `FIREWORKS_API_KEY` | `FIREWORKS_BASE_URL` | `https://api.fireworks.ai/inference/v1` | `llama-vision` |
| DeepSeek VL | `DEEPSEEK_API_KEY` | `DEEPSEEK_BASE_URL` | TBD | `deepseek-vl2` |

### 命名规范

- **格式**: `{PROVIDER_NAME}_API_KEY` 和 `{PROVIDER_NAME}_BASE_URL`
- **例外**: `MIMO_API_KEY` 保留向后兼容（已发布）；Ollama 无 Key 模式特殊
- **MIMO_BASE_URL**: 保留但用户极少设置，因为 credentialManager 自动检测更快
- **UNBLIND_PROVIDER_ORDER**: 扩展为可包含新名称，如 `"mimo,groq,together,openai,ollama"`

---

## 4. credentialManager.js 扩展方案

### 4.1 当前 Key 前缀检测

| 前缀 | 当前行为 |
|------|----------|
| `sk-ant` | Mimo Balance → `api.xiaomimimo.com/anthropic` |
| `sk-` | OpenAI → `api.openai.com/v1` |
| `tp-` | Token Plan → `token-plan-cn.xiaomimimo.com/anthropic` |
| 其他 | Token Plan（默认 fallback） |

### 4.2 扩展后的检测表

| 前缀 | Provider | Base URL | Auth Header |
|------|----------|----------|-------------|
| `sk-ant` | Mimo Balance | `https://api.xiaomimimo.com/anthropic` | `x-api-key` |
| `sk-` | OpenAI 原生 | `https://api.openai.com/v1` | `Bearer` |
| `tp-` | Mimo Token Plan | `https://token-plan-cn.xiaomimimo.com/anthropic` | `x-api-key` |
| `AIza` | Google Gemini | —（通过 `GEMINI_BASE_URL` 显式配置或使用默认值） | `Bearer` |
| 其他 | 未知 Key 类型 | `""`（交给 registry 的 defaultBaseUrl 兜底） | `Bearer` |

### 4.3 改动点

```js
// getBaseUrl 新增 AIza 分支
export function getBaseUrl(apiKey) {
  if (!apiKey) return "";
  if (apiKey.startsWith("sk-ant")) { /* 不变 */ }
  if (apiKey.startsWith("sk-"))    { /* 不变 */ }
  if (apiKey.startsWith("tp-"))    { /* 不变 */ }
  if (apiKey.startsWith("AIza")) {
    log("debug", "credentialManager", "base_url_detected", { type: "gemini" });
    return ""; // Gemini 不使用自动映射，由 registry 的 defaultBaseUrl 提供
  }
  // 未知 → 不再强行映射到 Token Plan，改为返回空让 registry 兜底
  return "";
}
```

**重要设计决策**: `getBaseUrl()` 对未知 Key 前缀返回空字符串而非默认映射到 Token Plan。原因：
- Phase 5 新增了多个 Provider，Token Plan 只是 Mimo 的一种计费方式，不应作为全局 fallback
- registry 的 `loadProviders()` 现在提供三层 baseUrl 解析（自定义 > env > 默认），比 credentialManager 更灵活

### 4.4 getAuthHeader 扩展

```js
export function getAuthHeader(apiKey) {
  if (apiKey.startsWith("sk-")) return { "Authorization": `Bearer ${apiKey}` };
  if (apiKey.startsWith("AIza")) return { "x-goog-api-key": apiKey };
  return { "x-api-key": apiKey };
}
```

---

## 5. GeminiProvider 设计

### 5.1 为什么需要新类？

Groq/Together/Fireworks 共用 OpenAIProvider，因为它们的请求/响应结构与 OpenAI Chat Completions 完全相同。但 Gemini 不同：

| 维度 | OpenAI Chat Completions | Gemini API |
|------|------------------------|------------|
| 端点 | `/v1/chat/completions` | `/v1beta/models/{model}:generateContent` |
| 请求体 | `messages: [{role, content}]` | `contents: [{parts: [{inlineData, text}]}]` |
| 图片格式 | `image_url: {url: data:...}` | `inlineData: {mimeType, data}` |
| 响应提取 | `choices[0].message.content` | `candidates[0].content.parts[0].text` |
| Auth | `Authorization: Bearer` | `x-goog-api-key` |

所以 Gemini 必须实现为独立的 `GeminiProvider` 类。

### 5.2 GeminiProvider 接口设计

```js
export class GeminiProvider extends BaseProvider {
  constructor({ apiKey, baseUrl, model = "gemini-2.0-flash-exp", timeoutMs = 30_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  }

  get name() { return "gemini"; }

  _buildRequest(images, prompt, options) {
    const parts = [];

    if (Array.isArray(images)) {
      for (const img of images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64.replace(/^data:.*?;base64,/, ""),
          },
        });
      }
    } else {
      // Single image
      parts.push({
        inlineData: {
          mimeType: "image/png",  // 从 data URL 解析
          data: images.replace(/^data:.*?;base64,/, ""),
        },
      });
    }

    parts.push({ text: prompt });

    return {
      url: `${this._baseUrl}/models/${this._model}:generateContent`,
      body: { contents: [{ parts }] },
      headers: { "x-goog-api-key": this._apiKey, "Content-Type": "application/json" },
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new ClientError("Gemini API 返回格式异常，未找到文本内容");
    return text;
  }
}
```

---

## 6. 波及改动汇总

### 6.1 orchestrator.js 改动

当前硬编码段：
```js
const mimoKey = getApiKey();
const baseUrls = {
  mimo: mimoKey ? getBaseUrl(mimoKey) : "",
};
const model = process.env.OPENAI_VISION_MODEL || config.model;
```

需要改为通用模式：
```js
const baseUrls = {};
// 自动为每个启用 Provider 检测 baseUrl
for (const entry of REGISTRY) {
  const key = process.env[entry.envKey] || "";
  if (key && entry.name === "mimo") {
    baseUrls.mimo = getBaseUrl(key);
  }
}
```

更简洁的方案：将 baseUrl 检测逻辑下沉到 registry 中，由 registry 决定何时调用 credentialManager。这需要使 registry 可访问 credentialManager 的 `getBaseUrl`。

### 6.2 config.js 改动

- 新增 provider 相关的配置项（非阻塞，使用 env 变量即可）
- 考虑移除或淡化 `MIMO_*` 硬编码的配置项名，改为更通用的 `VISION_*` 命名
- 保留 `MIMO_*` 向后兼容

### 6.3 测试覆盖

新增 `tests/test-gemini.js`（mock HTTP），`tests/test-registry.js` 扩展验证 6 个 Provider 的注册和排序。

---

## 7. 实现顺序

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1 | credentialManager 扩展 AIza 前缀 + 未知 Key fallback 改为空字符串 | `credentialManager.js` |
| 2 | GeminiProvider 类实现 | `providers/gemini.js` |
| 3 | registry 重构 + 新增 4 条注册条目 + 三层 baseUrl 解析 | `providers/registry.js` |
| 4 | orchestrator `buildProviderChain` 泛化 baseUrls 构造 | `orchestrator.js` |
| 5 | 测试: registry 验证 6 Provider 注册/排序 | `tests/test-registry.js` |
| 6 | 测试: Gemini provider mock | `tests/test-gemini.js` |

---

## 8. 用户配置示例

### .env 或 settings.json

```json
{
  "env": {
    "MIMO_API_KEY": "sk-ant-xxx",
    "GROQ_API_KEY": "gsk_xxx",
    "TOGETHER_API_KEY": "xxx",
    "FIREWORKS_API_KEY": "xxx",
    "UNBLIND_PROVIDER_ORDER": "mimo,groq,together,openai,fireworks,ollama",
    "UNBLIND_VISION_MODEL": "gpt-4o",
    "GROQ_MODEL": "llama-4-vision",
    "TOGETHER_MODEL": "meta-llama/Llama-3.2-90B-Vision"
  }
}
```

### 模型覆盖逻辑

在 loadProviders 中增加 model 解析：
```
优先级: 环境变量 {NAME}_MODEL > loadProviders 传入的 model > entry.defaultModel
```

```js
export function loadProviders(order, opts = {}) {
  const { model: defaultModel, timeoutMs, baseUrls = {} } = opts;
  const available = new Map();

  for (const entry of REGISTRY) {
    const key = process.env[entry.envKey] || "";
    if (!key) continue;

    // 模型优先级: {NAME}_MODEL env > 全局 model > entry.defaultModel
    const model = process.env[`${entry.name.toUpperCase()}_MODEL`] || defaultModel || entry.defaultModel || "";
    const baseUrl = /* 三层解析逻辑同上 */;

    available.set(entry.name, {
      provider: entry.build(key, baseUrl, model, timeoutMs),
      name: entry.name,
    });
  }
  // ...
}
```

---

## 9. 风险与注意事项

1. **向后兼容**: `MIMO_API_KEY` + `MIMO_BASE_URL` 必须继续工作，注册表中 mimo 条目保留 `envKey: "MIMO_API_KEY"`
2. **Ollama 特殊逻辑**: Ollama 无 Key，当前用 `OLLAMA_BASE_URL` 的存在性判断启用，且传 `apiKey: "ollama"` 占位。新注册表须保留此特殊性
3. **速率限制差异**: Groq 免费版限制 30 req/min，注册表不处理限流——由各 Provider 的 HTTP 层和重试逻辑处理
4. **DeepSeek VL 待定**: 不创建占位文件，只在注册表中留注释。当 DeepSeek 开放兼容 API 端点时再添加
5. **multi-image 支持**: GeminiProvider 和 OpenAIProvider 都已支持多图片（数组输入），`_buildRequest` 中已有 Array.isArray 分支
6. **OpenAIProvider.name 问题**: 当前 `OpenAIProvider.name` 返回硬编码 `"openai"`，当多 Provider 复用该类时，healthCheck 和日志中会混淆。解决：在 `entry.build()` 中设置 `provider.name = entry.name`，或给 `OpenAIProvider` 增加 `name` 构造参数
