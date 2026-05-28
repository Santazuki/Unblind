# OpenAI Provider

## 问题

当前仅支持 Mimo Anthropic-compatible API。用户持有 OpenAI / GLM / Ollama 等 Chat Completions 格式服务的 Key 时无法使用。

## 方案

新增 `OpenAIProvider` 类，通过 Key 前缀自动选 Provider。无工厂函数、无新环境变量、无 `detectProviderType`。

### 前缀规则

- `sk-ant` → MimoProvider（Mimo Balance Key，Anthropic 风格）
- `tp-` → MimoProvider（Token Plan Key）
- `sk-`（其他） → OpenAIProvider（OpenAI / GLM / Ollama）
- 其他 → MimoProvider（兼容旧版）

### 改动

| 文件 | 改动 | 行数 |
|------|------|------|
| `scripts/lib/providers/openai.js` | **新增**，实现 `IVisionProvider` | ~100 |
| `scripts/lib/orchestrator.js` | 2 处 provider 实例化处加 if-else 选 Provider | 6 |
| `scripts/lib/credentialManager.js` | `getBaseUrl` 增加 `sk-` 非 `sk-ant` 分支 → OpenAI URL | 2 |

### 新增文件：`scripts/lib/providers/openai.js`

与 `mimo.js` 同结构，仅在请求体格式和响应解析上不同：

- `analyzeImage({ image, prompt, options })` 发送 **Chat Completions** 格式
  - `image` 以 `image_url` 类型嵌入（非 Mimo 的 `image` source 类型）
  - 端点：`/v1/chat/completions`
  - Auth header：`Authorization: Bearer <key>`（始终 Bearer）
  - 响应从 `choices[0].message.content` 提取
- `healthCheck()` 发送最小 1px PNG，检查连通性

### orchestrator.js 改动

```js
// 替换 analyze() 中：
const Provider = (!apiKey.startsWith("sk-") || apiKey.startsWith("sk-ant"))
  ? MimoProvider
  : OpenAIProvider;
const primaryProvider = new Provider({ apiKey, baseUrl, model, timeoutMs });

// 同理替换 runHealthCheck() 中：
const Provider = (!apiKey.startsWith("sk-") || apiKey.startsWith("sk-ant"))
  ? MimoProvider
  : OpenAIProvider;
const provider = new Provider({ apiKey, baseUrl, model: loadConfig().model, timeoutMs: 10_000 });
```

导入新增：

```js
import { MimoProvider } from "./providers/mimo.js";
import { OpenAIProvider } from "./providers/openai.js";   // 新增
```

### credentialManager.js 改动

```js
// getBaseUrl — 拆 sk-ant 和 sk-（非 ant）
if (apiKey.startsWith("sk-ant")) {
  return "https://api.xiaomimimo.com/anthropic";
}
if (apiKey.startsWith("sk-")) {
  return "https://api.openai.com/v1";   // 新增
}
// tp- 或其他 → token-plan（不变）
```

`getAuthHeader` 不需改动——OpenAI 始终用 Bearer，而 `sk-` 已走该分支。

### 不变的部分

- 无新环境变量（OpenAI Key 复用 `MIMO_API_KEY`，base URL 自动检测）
- 无 `detectProviderType` 函数
- 无工厂函数 / Provider 注册表
- `config.js` 不动
- `SKILL.md` 不动（Phase 0 key 检测逻辑不变，`sk-` 仍被识别为有效 Key）
- `tests/` 仅新增 `test-providers-openai.js`

### 验证方式

1. 单元测试：新增 `test-providers-openai.js`，mock fetch 验证请求体格式（`image_url`）、响应解析（`choices[0].message.content`）
2. 集成验证：设置 `sk-proj-xxx` 假 Key，确认 `getBaseUrl` 返回 `api.openai.com/v1`，orchestrator 创建 `OpenAIProvider`
3. 回归验证：`sk-ant-xxx` / `tp-xxx` 仍走 `MimoProvider`，行为不变
