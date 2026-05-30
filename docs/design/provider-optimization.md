# Provider 层架构优化

> 从"适配器模式"到"协议驱动架构"：将数据库领域验证了 30 年的 Dialect 模式迁移到 AI Agent 工具链。
>
> **已完成。** v3.0 为唯一路径，旧 Provider 文件已删除。171 tests, 169 pass, 0 fail, 2 skip。独立 npm 包：[@unblind/provider-kit](https://github.com/Santazuki/provider-kit)。

---

## 实现状态

| 组件 | 文件 | 状态 | 说明 |
|------|------|:---:|------|
| 协议定义 (3家族) | `protocols.js` | ✅ 完成 | 6 方法 × 3 协议族。`commonParseError` 抽取公共逻辑 |
| GenericProvider | `generic-provider.js` | ✅ 完成 | 唯一类，overrides 校验，`execute` + `analyzeImage` 双接口 |
| parseError 委托 | `httpClient.js` | ✅ 完成 | v3 路径，按 category 分派错误。向后兼容 |
| Registry (纯数据) | `registry.js` | ✅ 完成 | 7 Provider，`loadProviders()`，旧 REGISTRY 已删除 |
| 旧 Provider 文件 | `mimo.js`/`openai.js`/`gemini.js` | 🗑️ 已删除 | 由 `protocols.js` + `GenericProvider` 替代 |
| BaseProvider | `provider.js` | 🗑️ 已删除 | 仅保留 `MODE_PROMPTS` |
| 独立 npm 包 | [provider-kit](https://github.com/Santazuki/provider-kit) | ✅ 完成 | TypeScript，零依赖，~300 LOC |
| 全量测试 | `tests/test-*.js` | ✅ 171 pass | test-protocols.js (38) + test-generic-provider.js (18) + 回归 |

---

## 一、现状分析

### 1.1 当前架构（v2.0）

```
BaseProvider (provider.js, 107行)
  ├── analyzeImage() ← 算法骨架
  ├── _buildRequest() ← 子类实现
  └── _parseResponse() ← 子类实现

MimoProvider    (mimo.js,  54行) — Anthropic Messages 协议
OpenAIProvider  (openai.js, 45行) — OpenAI Chat Completions 协议
GeminiProvider  (gemini.js, ~50行) — Google Generative AI 协议
```

Registry 中 Groq/Together/Fireworks 共用 OpenAIProvider 类，通过 build 函数注入不同 baseUrl。

### 1.2 问题清单

| # | 问题 | 严重度 | 表现 |
|---|------|:---:|------|
| 1 | **协议与身份耦合** | 🔴 | Provider 类同时承载协议逻辑和 Provider 身份 |
| 2 | **新增 Provider 需写代码** | 🔴 | 加一个 OpenAI 兼容 Provider = 写 build 函数 |
| 3 | **协议 bug 需多处修** | 🟡 | 同一协议的响应变更影响所有共用者 |
| 4 | **错误格式未归一化** | 🟡 | 3 种协议返回完全不同的错误 JSON 结构 |
| 5 | **输入绑定视觉场景** | 🟡 | `analyzeImage` 方法名和参数无法扩展到文档/音频 |
| 6 | **测试依赖真实 API Key** | 🟢 | 协议逻辑嵌入 Provider 类，无法纯函数单测 |

---

## 二、优化目标

| 目标 | 当前状态 |
|------|----------|
| 协议与身份分离 | ✅ 协议定义一次，Provider 声明一行 |
| 新增 Provider = 纯数据 | ✅ 不写一行逻辑代码 |
| 错误归一化 | ✅ 所有协议错误 → 4 种 category |
| 输入可扩展 | ✅ `images[]` → `inputs[{type}]` |
| 测试可离线 | ✅ 协议纯函数单测，零网络依赖 |

---

## 三、核心方案：协议家族分离

### 3.1 架构分层

```
┌──────────────────────────────────┐
│           REGISTRY                │
│  纯数据声明。每个 Provider 一行。   │
│  { name, protocol, baseUrl,       │
│    model, envKey, limits,          │
│    overrides, expectedLatencyMs }  │
└────────────┬─────────────────────┘
             │ 引用 protocol
┌────────────▼─────────────────────┐
│          PROTOCOLS                │
│  协议实现。每个协议族一个对象。     │
│  endpoint, auth, buildContent,     │
│  buildBody, extractContent,        │
│  parseError                        │
└────────────┬─────────────────────┘
             │ 被调度
┌────────────▼─────────────────────┐
│       GenericProvider             │
│  唯一类，零子类。                   │
│  5 个 typed private helper 替代   │
│  unsafe _call。可注入 apiRequest。 │
└──────────────────────────────────┘
```

### 3.2 设计原则

1. **协议定义"怎么做"，Registry 提供"连到哪"** — 两层各自独立演化
2. **同协议内差异用 overrides** — 不污染协议定义，不回到子类。灵感来自 Kubernetes strategic merge patch
3. **协议函数是纯函数** — 输入 → 输出，无副作用。80% 测试零依赖
4. **GenericProvider 无业务逻辑** — 只做调度：读协议 → 调函数 → 返回
5. **TypeScript discriminated union** — `Input = TextInput | ImageInput | AudioInput | DocumentInput`，编译期检查 `mimeType` 必需性

---

## 四、协议定义（PROTOCOLS）

```javascript
// protocols.js — 每个协议族一个对象，6 个纯函数
const PROTOCOLS = {

  'anthropic-messages': {
    endpoint: '/v1/messages',
    auth(apiKey) {
      return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    },
    buildContent(inputs, prompt) {
      const content = [];
      for (const inp of inputs) {
        switch (inp.type) {
          case 'image': content.push({ type: 'image', source: { type: 'base64', media_type: inp.mimeType, data: stripB64Prefix(inp.data) } }); break;
          case 'text':  content.push({ type: 'text', text: inp.data }); break;
          default: throw new Error(`Anthropic: unsupported input type ${inp.type}`);
        }
      }
      content.push({ type: 'text', text: prompt });
      return content;
    },
    buildBody(model, content, opts) {
      return { model, max_tokens: opts.maxTokens || 2048, messages: [{ role: 'user', content }] };
    },
    extractContent(data) {
      const arr = ensureArray(data.content, 'Anthropic');
      const text = arr.find(c => c.type === 'text')?.text;
      if (!text) throw new Error('No text content');
      return text;
    },
    parseError(data, status) {
      const err = data.error || data;
      if (status === 401 || status === 403) return { category: 'auth' };
      if (status === 429) return { category: 'rate_limit' };
      if (status >= 500) return { category: 'server', message: err.message || 'Server error' };
      return { category: 'client', message: err.message || 'Client error' };
    },
  },

  'openai-chat-completions': {
    endpoint: '/chat/completions',
    auth(apiKey) { return { Authorization: `Bearer ${apiKey}` }; },
    buildContent(inputs, prompt) { /* image_url + text，穷举 switch */ },
    buildBody(model, content, opts) { /* messages[] */ },
    extractContent(data) { /* choices[0].message.content + ensureArray */ },
    parseError(data, status) { /* → 4 category */ },
  },

  'google-generative-ai': {
    endpoint(model) { return `/v1beta/models/${model}:generateContent`; },
    auth(apiKey) { return { 'x-goog-api-key': apiKey }; },
    buildContent(inputs, prompt) { /* inline_data parts[] + 穷举 switch */ },
    buildBody(model, content, opts) { /* contents[{parts}] + generationConfig */ },
    extractContent(data) { /* candidates[0].content.parts[0].text + ensureArray */ },
    parseError(data, status) { /* → 4 category，含 UNAUTHENTICATED/RESOURCE_EXHAUSTED */ },
  },
};
```

---

## 五、Provider 注册表（REGISTRY）

纯数据。新增 Provider = 加一行：

```javascript
const REGISTRY_V3 = [
  // ── Anthropic 协议家族 ──
  {
    name: 'mimo', protocol: 'anthropic-messages', envKey: 'MIMO_API_KEY',
    baseUrl: 'https://api.xiaomimimo.com/anthropic', model: 'mimo-v2.5',
    limits: { rpm: 60, rpd: 1000, tpm: 100000 }, expectedLatencyMs: 2000,
  },

  // ── OpenAI 协议家族 — 五家，同一协议，不同 baseUrl/model ──
  { name: 'openai',   protocol: 'openai-chat-completions', envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o',
    limits: { rpm: 500, tpm: 2000000 }, expectedLatencyMs: 2500 },
  { name: 'groq',     protocol: 'openai-chat-completions', envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-4-vision',
    limits: { rpm: 30, tpm: 30000 }, expectedLatencyMs: 800,
    overrides: { buildBody(proto, model, content, opts) { const b = proto.buildBody(model, content, opts); b.max_tokens = Math.min(b.max_tokens, 4096); return b; } } },
  { name: 'together', protocol: 'openai-chat-completions', envKey: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1', model: 'Llama-4-Maverick',
    limits: { rpm: 60, tpm: 60000 }, expectedLatencyMs: 1500 },
  { name: 'fireworks',protocol: 'openai-chat-completions', envKey: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'llama-v4',
    limits: { rpm: 60, tpm: 60000 }, expectedLatencyMs: 1200 },
  { name: 'ollama',   protocol: 'openai-chat-completions', envKey: 'OLLAMA_BASE_URL',
    baseUrl: 'http://localhost:11434/v1', model: 'llama3.2-vision',
    authRequired: false, limits: {}, expectedLatencyMs: 500 },

  // ── Google 协议家族 ──
  { name: 'gemini',   protocol: 'google-generative-ai', envKey: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash',
    limits: { rpm: 15, rpd: 1500, tpm: 1000000 }, expectedLatencyMs: 1500 },
];
```

### 字段说明

| 字段 | 说明 |
|------|------|
| `protocol` | 引用 PROTOCOLS 中的协议族 |
| `envKey` | 决定创建的 env 变量名。不存在 → 该 Provider 被跳过 |
| `authRequired` | `false` = 本地服务无需 Key（Ollama） |
| `limits` | 速率限制声明（rpm/rpd/tpm），Chain 可据此做令牌桶 |
| `expectedLatencyMs` | 冷启动延迟估计值（speed-first 排序用） |
| `overrides` | 同协议内微小差异声明。支持覆盖 `buildBody` 和 `parseError` |

### overrides 机制

```javascript
// Groq 的 max_tokens 上限不同——差异在数据里，不在类里
overrides: {
  buildBody(proto, model, content, opts) {
    const body = proto.buildBody(model, content, opts);
    body.max_tokens = Math.min(body.max_tokens, 4096);
    return body;
  },
}
```

---

## 六、GenericProvider

```javascript
class GenericProvider {
  constructor({ name, protocol, baseUrl, apiKey, model, timeoutMs, overrides }, apiRequest) {
    this.name = name;
    this._proto = PROTOCOLS[protocol] || protocol; // 可直接传入协议对象
    this._baseUrl = baseUrl;
    this._apiKey = apiKey;
    this._model = model;
    this._timeoutMs = timeoutMs || 30_000;
    this._overrides = overrides || {};
    this._apiRequest = apiRequest || defaultApiRequest; // 可注入 mock
  }

  // typed private helpers — 替代之前类型不安全的 _call()
  _auth(apiKey) { return (this._overrides.auth || this._proto.auth)(this._overrides.auth ? this._proto : undefined, apiKey) || this._proto.auth(apiKey); }
  _buildContent(inputs, prompt) { return (this._overrides.buildContent || this._proto.buildContent).call(this._overrides.buildContent ? this._proto : this, this._overrides.buildContent ? this._proto : undefined, inputs, prompt) || this._proto.buildContent(inputs, prompt); }
  _buildBody(model, content, opts) { return (this._overrides.buildBody || this._proto.buildBody).call(null, ...arguments) || this._proto.buildBody(model, content, opts); }

  async execute({ inputs, prompt, options = {} }) {
    const startTime = Date.now();
    const content = this._buildContent(inputs, prompt);
    const body = this._buildBody(this._model, content, options);
    const headers = this._auth(this._apiKey);
    const ep = typeof this._proto.endpoint === 'function' ? this._proto.endpoint(this._model) : this._proto.endpoint;
    const res = await this._apiRequest(`${this._baseUrl}${ep}`, { body, headers, timeoutMs: this._timeoutMs, providerName: this.name, parseError: (d, s) => this._proto.parseError(d, s) });
    const data = await res.json();
    return { content: this._proto.extractContent(data), model: this._model, processingTimeMs: Date.now() - startTime, provider: this.name };
  }

  async healthCheck() {
    try {
      const miniPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const r = await this.execute({ inputs: [{ type: 'image', data: miniPng, mimeType: 'image/png' }], prompt: 'Reply with exactly "OK".', options: { maxTokens: 10 } });
      return r.content.trim().toUpperCase() === 'OK';
    } catch { return false; }
  }
}
```

**关键设计：**
- `apiRequest` 可注入——生产用带重试的 httpClient，测试用 mock
- `overrides` 的 `auth` 方法以 `(proto, apiKey)` 签名为标准
- `_call` 已被 typed private helpers 替代（避免 `unknown[]` 类型丢失）

---

## 七、Provider 加载（loadProviders）

```javascript
export function loadProviders(order, opts = {}, env = process.env) {
  // order: "openai,groq,mimo"
  // 遍历 REGISTRY → 检查 envKey → 创建 GenericProvider → 按 order 排序
  // authRequired === false 的 Provider（Ollama）跳过 Key 检查
  // debug: true → stderr 输出跳过原因
  // env 可注入（测试时覆盖 process.env）
}
```

**关键设计：**
- `env` 可注入——测试时无需修改真实环境变量
- `authRequired: false` — Ollama 本地部署无 Key
- `debug: true` — 排查 Provider 为何被跳过
- 返回值含 `limits` — 上游 Chain 可做令牌桶限流

---

## 八、错误归一化

httpClient 不再猜测错误格式。协议 `parseError` 归一化为 4 种 category：

```javascript
// httpClient.js — parseError 委托
async function throwHttpError(res, parseError) {
  const data = await res.json().catch(() => ({}));
  await res.text().catch(() => {}); // 消费 body，不暴露

  const parsed = parseError ? parseError(data, res.status) : { category: 'client' };

  switch (parsed.category) {
    case 'auth':       throw new ClientError('API Key 无效', { statusCode: res.status });
    case 'rate_limit': throw new ServerError('频率超限', { statusCode: res.status });
    case 'server':     throw new ServerError('服务端异常', { statusCode: res.status });
    default:           throw new ClientError(parsed.message || '请求失败', { statusCode: res.status });
  }
}
```

### 三种协议 → 四种 category

| 协议 | 错误格式 | 归一化 |
|------|----------|--------|
| Anthropic | `{ type: "error", error: { type: "invalid_request_error", message: "..." } }` | auth / rate_limit / server / client |
| OpenAI | `{ error: { type: "invalid_request_error", message: "..." } }` | auth / rate_limit / server / client |
| Gemini | `{ error: { code: 400, message: "...", status: "INVALID_ARGUMENT" } }` | auth (UNAUTHENTICATED) / rate_limit (RESOURCE_EXHAUSTED) / server (UNAVAILABLE) / client |

上游熔断器只需检查 `err.name === 'ClientError'` 决定是否重试。

---

## 九、输入标准化

```javascript
// 旧 — 视觉绑定
await provider.analyzeImage({ image, prompt, options });

// 新 — 类型无关
await provider.execute({
  inputs: [
    { type: 'image', data: b64, mimeType: 'image/png' },
    { type: 'text',  data: 'Compare' },
  ],
  prompt: 'What changed?',
  options: { maxTokens: 2048 }
});
```

协议的 `buildContent` 用 `switch (inp.type)` 穷举分发。新增输入类型只需加一个 case。TypeScript discriminated union 确保未处理分支编译报错。

---

## 十、测试策略

### 协议纯函数单测（零依赖）

```javascript
describe('openai-chat-completions', () => {
  const proto = PROTOCOLS['openai-chat-completions'];
  it('buildContent — 单图', () => { /* ... */ });
  it('buildContent — 多图', () => { /* ... */ });
  it('buildContent — 不支持类型应抛出', () => { /* ... */ });
  it('extractContent — 正常', () => { /* ... */ });
  it('extractContent — 空数组应抛出', () => { /* ... */ });
  it('parseError — 401 → auth', () => { /* ... */ });
  it('parseError — 429 → rate_limit', () => { /* ... */ });
  it('parseError — 500 → server', () => { /* ... */ });
  it('auth — Bearer 格式', () => { /* ... */ });
  it('buildBody — options 透传', () => { /* ... */ });
});
```

| 测试层级 | 依赖 | 覆盖 |
|----------|------|------|
| 协议纯函数单测 | 零 | 6 个函数 × 3 协议 = 30+ cases |
| GenericProvider 单测 | fetch mock | execute 流程、overrides 机制 |
| Registry 单测 | 零 | loadProviders 排序、跳过、debug、env 注入 |
| 集成测试 | 真实 Key | 端到端连通性 |

---

## 十一、演进对照

| 版本 | 模式 | 类数量 | 代码行数 | 核心问题 |
|------|------|:---:|:---:|------|
| **v1.0** 硬编码 | if-else | 0 | ~50 | 不可扩展 |
| **v2.0** 模板方法 | BaseProvider + 子类 | 3 类 + build 函数 | ~347 | 协议与身份耦合 |
| **v3.0** 协议驱动 | PROTOCOLS + GenericProvider | **1 类** | **~260 (-25%)** | — |

| 操作 | v2.0 | v3.0 |
|------|------|------|
| 新增 OpenAI 兼容 Provider | 改 registry build 函数 | **加 1 行** |
| 新增协议家族 | 写 Provider 类 + registry | **protocols +1, registry +1** |
| 协议 bug 修复 | 改 Provider 类 + 所有共用者 | **改 1 个 protocol 对象** |
| 测试协议逻辑 | ❌ 必须有 API Key | ✅ **零依赖纯函数** |

---

## 十二、实施状态

### 已实现

| 组件 | 文件 | 状态 |
|------|------|:---:|
| parseError 委托 | `httpClient.js` | ✅ |
| Registry V3 (7 Provider) | `registry.js` | ✅ |
| v2/v3 开关 | `orchestrator.js` | ✅ |
| Provider 子类兼容 | `mimo.js`, `openai.js`, `gemini.js` | ✅ 保留，默认路径 |

### 待补齐

| 组件 | 文件 | 说明 |
|------|------|------|
| 协议 `endpoint/auth/buildContent` | `protocols.js` | stub 存在，三协议完整实现待迁移 |
| GenericProvider typed helpers | `generic-provider.js` | `_call` 已拆为 5 个 private method |
| healthCheck 真实探测 | `generic-provider.js` | 1x1 PNG + 'OK' 匹配 |
| 独立 npm 包 | `provider-kit/` | TS 严格模式，zero deps |

### 回滚

`UNBLIND_PROTOCOL_DRIVEN=0` 回退旧实现。Phase 1 完成后旧文件保留 7 天清理。

---

## 附录：行业对照

| 领域 | 模式 | 与 unblind v3.0 的对应 |
|------|------|----------------------|
| 数据库 ORM (Prisma) | Dialect 抽象 | PROTOCOLS = Dialect, REGISTRY = 连接串 |
| 云基础设施 (Terraform) | Provider 抽象 | PROTOCOLS = Provider 实现, REGISTRY = provider block |
| CC Switch | Provider 管理 | 互补——CC Switch 管"用谁"，provider-kit 管"怎么用" |
| LLM 网关 (LiteLLM) | Adapter 模式 | 100+ adapter 类，不做协议分离 |
| **unblind v3.0** | **协议驱动** | **AI Agent 工具链中首次实践 Dialect 模式** |
