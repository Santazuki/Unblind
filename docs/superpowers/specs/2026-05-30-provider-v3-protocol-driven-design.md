# Provider v3.0 协议驱动架构 — 设计规格

> 从模板方法模式到协议驱动架构：分离"怎么说话"（协议）和"跟谁说话"（身份）。

## 1. 目标

| 目标 | 衡量标准 |
|------|----------|
| 协议与身份分离 | 协议定义一次，Provider 声明一行 |
| 新增 Provider = 纯数据 | 不写一行逻辑代码 |
| 错误归一化 | 所有协议错误 → auth/rate_limit/server/client 四类 |
| 输入可扩展 | inputs[{type}] 替代 analyzeImage，支持 image/text/未来类型 |
| 测试可离线 | 协议纯函数单测，零网络依赖 |
| 代码量减少 | ~347 行 → ~290 行（-16%） |

## 2. 架构

### 2.1 三层分离

```
┌──────────────────────────────────┐
│           REGISTRY                │
│  纯数据数组。                      │
│  { name, protocol, baseUrl,       │
│    model, envKey, limits }         │
│  新增 Provider = 加 1 行           │
└────────────┬─────────────────────┘
             │
┌────────────▼─────────────────────┐
│          PROTOCOLS                │
│  协议族纯函数对象。6 个方法：       │
│  endpoint(model) → 路径           │
│  auth(apiKey) → headers           │
│  buildContent(inputs, prompt)     │
│  buildBody(model, content, opts)  │
│  extractContent(data) → text      │
│  parseError(data, status) → cat   │
│  新增协议族 = 定义 1 个对象        │
└────────────┬─────────────────────┘
             │
┌────────────▼─────────────────────┐
│       GenericProvider             │
│  唯一类，零子类。                   │
│  调度协议函数完成请求，无业务逻辑。  │
└──────────────────────────────────┘
```

### 2.2 数据流

```
orchestrator → GenericProvider.execute({inputs, prompt, options})
  → proto.auth(apiKey)              → headers
  → proto.buildContent(inputs, ...) → content
  → proto.buildBody(model, ...)     → body
  → proto.endpoint(model)           → path
  → httpClient({body, headers, parseError: proto.parseError})
  → proto.extractContent(data)      → text
  ← { content, model, processingTimeMs }
```

## 3. 协议定义（PROTOCOLS）

协议对象是纯函数集合，每个函数输入→输出，无副作用。

### 3.1 协议方法签名

```javascript
{
  endpoint(model: string): string,           // API 路径，统一为函数
  auth(apiKey: string): Record<string,string>, // HTTP headers
  buildContent(inputs: Input[], prompt: string): any,  // 协议特定的 content 结构
  buildBody(model: string, content: any, options: Options): object,  // 请求体
  extractContent(data: object): string,      // 从响应中提取文字
  parseError(data: object, status: number): {category: string, message?: string}
}
```

### 3.2 输入标准化

```javascript
// Input 类型
interface Input {
  type: 'image' | 'text';  // 可扩展: 'audio', 'document'
  data: string;             // Base64 data URL 或纯文本
  mimeType?: string;        // image/png, image/jpeg, ...
}
```

### 3.3 三个协议族

| 协议 | 标识符 | 覆盖 Provider |
|------|--------|---------------|
| OpenAI Chat Completions | `openai-chat-completions` | openai, groq, together, fireworks, ollama |
| Anthropic Messages | `anthropic-messages` | mimo |
| Google Generative AI | `google-generative-ai` | gemini |

## 4. Provider 注册表（REGISTRY）

纯数据数组，一行一个 Provider：

```javascript
const REGISTRY = [
  // OpenAI 协议家族 — 5 个 Provider，同一协议，不同 baseUrl/model
  { name: 'openai',    protocol: 'openai-chat-completions', envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', limits: { rpm: 500, tpm: 2000000 } },
  { name: 'groq',      protocol: 'openai-chat-completions', envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-4-vision', limits: { rpm: 30, tpm: 30000 },
    overrides: { buildBody(proto, model, content, opts) { /* cap max_tokens */ } } },
  { name: 'together',  protocol: 'openai-chat-completions', envKey: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1', model: 'Llama-4-Maverick', limits: { rpm: 60, tpm: 60000 } },
  { name: 'fireworks', protocol: 'openai-chat-completions', envKey: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'llama-v4', limits: { rpm: 60, tpm: 60000 } },
  { name: 'ollama',    protocol: 'openai-chat-completions', envKey: 'OLLAMA_BASE_URL',
    baseUrl: null, model: 'llama3.2-vision', limits: {} },

  // Anthropic 协议家族
  { name: 'mimo', protocol: 'anthropic-messages', envKey: 'MIMO_API_KEY',
    baseUrl: 'https://api.xiaomimimo.com/anthropic', model: 'mimo-v2.5', limits: { rpm: 60, rpd: 1000, tpm: 100000 } },

  // Google 协议家族
  { name: 'gemini', protocol: 'google-generative-ai', envKey: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.5-flash', limits: { rpm: 15, rpd: 1500, tpm: 1000000 } },
];
```

## 5. GenericProvider

唯一的 Provider 类，无子类，无协议特定逻辑：

```javascript
class GenericProvider {
  constructor({ name, protocol, baseUrl, apiKey, model, timeoutMs = 30_000, overrides = {} }) {
    // 1) 协议存在性校验
    // 2) overrides key 校验（仅允许 ['buildBody', 'parseError']）
    // 3) overrides key 必须存在于协议对象中
    this.name = name;
    this._proto = PROTOCOLS[protocol];
    this._baseUrl = baseUrl;
    this._apiKey = apiKey;
    this._model = model;
    this._timeoutMs = timeoutMs;
    this._overrides = overrides;
  }

  async execute({ inputs, prompt, options = {} }) {
    // 调度协议函数，无业务逻辑
    // overrides 优先：overrides[method].call(null, proto, ...args)
  }

  async healthCheck() { /* 1x1 PNG → execute → 判空 */ }
}
```

## 6. overrides 约束

- **仅允许覆盖** `buildBody` 和 `parseError`
- **构造时校验**：非法 key → 立即抛 ClientError
- **构造时校验**：override key 在协议对象中不存在 → 立即抛 ClientError
- **调用约定**：`overrides.method(proto, ...args)`，proto 作为第一个参数传入

```javascript
const ALLOWED_OVERRIDES = ['buildBody', 'parseError'];

// 构造时校验
for (const key of Object.keys(overrides)) {
  if (!ALLOWED_OVERRIDES.includes(key)) {
    throw new ClientError(`Provider "${name}": 不允许覆盖 "${key}"，仅允许 ${ALLOWED_OVERRIDES.join(', ')}`);
  }
  if (typeof proto[key] !== 'function') {
    throw new ClientError(`Provider "${name}": 协议 "${protocol}" 没有方法 "${key}"`);
  }
}
```

## 7. 错误归一化

httpClient 委托 `parseError` 做分类：

```javascript
// httpClient 不再猜测错误格式
const parsed = parseError(data, res.status);
// { category: 'auth' | 'rate_limit' | 'server' | 'client', message?: string }
```

4 种 category → 统一 ClientError / ServerError，调用方只看到两种错误类型。

## 8. 实施策略

### 8.1 并行共存

- 新建 `protocols.js` + `generic-provider.js`，**不删**旧 Provider 文件
- `orchestrator.js` 通过 `UNBLIND_PROTOCOL_DRIVEN=1` 切换新路径
- 默认使用旧实现（`UNBLIND_PROTOCOL_DRIVEN=0`），新实现 opt-in
- 测试全过后，删除 `mimo.js` / `openai.js` / `gemini.js`，移除开关

### 8.2 切分顺序

| 批次 | 内容 | 文件变更 |
|------|------|----------|
| **Batch 1** | 新建 `protocols.js`（3 个协议）+ `generic-provider.js` | 新增 |
| **Batch 2** | OpenAI 家族切换（5 Provider）| 改 registry.js + orchestrator.js |
| **Batch 3** | Anthropic + Gemini 家族切换 | 验证 2 个协议 |
| **Batch 4** | 测试补齐 + 旧文件清理 | 删 mimo.js/openai.js/gemini.js |

## 9. 测试策略

| 层级 | 文件 | 依赖 | 覆盖目标 |
|------|------|------|----------|
| 协议纯函数 | `tests/test-protocols.js` | 零 | 6 方法 × 3 协议 = 18+ 用例 |
| GenericProvider | `tests/test-generic-provider.js` | fetch mock | execute 流程、overrides 校验 |
| Registry | `tests/test-registry.js` | 零 | 数据完整性、排序、env 优先级 |
| 集成 | 现有 `tests/test-*.js` | 真实 Key | 端到端连通性回归 |

## 10. 回滚

如果新实现出现问题：
- 设 `UNBLIND_PROTOCOL_DRIVEN=0` 立即回退旧实现
- 协议函数为纯函数，不影响旧路径
- `protocols.js` + `generic-provider.js` 与旧模块完全隔离

## 11. 成功标准

- [ ] `node --test tests/test-protocols.js` — 全新，≥25 pass
- [ ] `node --test tests/test-generic-provider.js` — 全新，≥10 pass
- [ ] `node --test tests/test-*.js` — 现有 95 tests 全部回归通过
- [ ] OpenAI 家族 5 个 Provider 通过新路径 health check
- [ ] 无硬编码 Key、无真实图片在 test fixtures 中
- [ ] 旧 Provider 文件已删除，开关代码已移除
