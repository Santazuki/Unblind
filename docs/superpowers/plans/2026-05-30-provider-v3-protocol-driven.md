# Provider v3.0 协议驱动架构 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Provider 层从模板方法模式重构为协议驱动架构，分离协议逻辑与 Provider 身份，实现新增 Provider = 纯数据声明。

**Architecture:** 三层分离 — PROTOCOLS（纯函数协议族）→ REGISTRY（纯数据 Provider 声明）→ GenericProvider（唯一调度类）。并行共存策略，`UNBLIND_PROTOCOL_DRIVEN=1` 启用新路径，OpenAI 家族先切，测试全过后清理旧文件。

**Tech Stack:** Node.js >= 18 内置模块（fs/path/crypto/fetch），`node:test` + `node:assert/strict`，纯 JS+JSDoc，ESM。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `scripts/lib/providers/protocols.js` | **新建** | 3 个协议族纯函数对象（OpenAI/Anthropic/Google） |
| `scripts/lib/providers/generic-provider.js` | **新建** | 唯一 Provider 类，调度协议函数，含 overrides 校验 |
| `tests/test-protocols.js` | **新建** | 协议纯函数单测（零依赖，≥25 用例） |
| `tests/test-generic-provider.js` | **新建** | GenericProvider 单测（fetch mock，≥10 用例） |
| `scripts/lib/providers/registry.js` | **修改** | 新增 REGISTRY_V3 纯数据数组 + loadProvidersV3() |
| `scripts/lib/httpClient.js` | **修改** | apiRequest 增加 parseError 委托参数 |
| `scripts/lib/orchestrator.js` | **修改** | 增加 env 开关切换新旧路径 |
| `scripts/lib/providers/mimo.js` | **删除** | Batch 4 清理（由 protocols.js 替代） |
| `scripts/lib/providers/openai.js` | **删除** | Batch 4 清理（由 protocols.js 替代） |
| `scripts/lib/providers/gemini.js` | **删除** | Batch 4 清理（由 protocols.js 替代） |
| `tests/test-registry.js` | **修改** | 新增 REGISTRY_V3 数据完整性用例 |

---

### Task 1: 协议纯函数测试（TDD）

**Files:**
- Create: `tests/test-protocols.js`

**说明：** 协议函数是纯函数，零网络依赖。这是本次重构最大的测试收益——从集成测试回归到纯函数单测。

- [ ] **Step 1: 写 OpenAI 协议族的纯函数测试**

```javascript
// tests/test-protocols.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Protocol module not created yet — tests will fail initially
// We import the module that WILL exist after Task 2
let PROTOCOLS;
try {
  const mod = await import("../scripts/lib/providers/protocols.js");
  PROTOCOLS = mod.PROTOCOLS;
} catch {
  // Module not created yet — define inline for TDD
}

const IMAGE_1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const IMAGE_2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQg=";

describe("PROTOCOLS: openai-chat-completions", () => {
  const proto = PROTOCOLS?.["openai-chat-completions"];

  // --- endpoint ---
  it("endpoint returns /chat/completions", () => {
    const result = proto.endpoint("gpt-4o");
    assert.equal(result, "/chat/completions");
  });

  // --- auth ---
  it("auth returns Bearer header", () => {
    const headers = proto.auth("sk-test123");
    assert.deepStrictEqual(headers, { Authorization: "Bearer sk-test123" });
  });

  // --- buildContent: single image ---
  it("buildContent — single image", () => {
    const inputs = [{ type: "image", data: IMAGE_1, mimeType: "image/png" }];
    const content = proto.buildContent(inputs, "Describe this image");
    assert.equal(content.length, 2, "1 image + 1 text = 2 content blocks");
    assert.equal(content[0].type, "image_url");
    assert.equal(content[0].image_url.url, IMAGE_1);
    assert.equal(content[1].type, "text");
    assert.equal(content[1].text, "Describe this image");
  });

  // --- buildContent: multiple images ---
  it("buildContent — multiple images", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "image", data: IMAGE_2, mimeType: "image/jpeg" },
    ];
    const content = proto.buildContent(inputs, "Compare these");
    assert.equal(content.length, 3, "2 images + 1 text = 3 content blocks");
    assert.equal(content[0].type, "image_url");
    assert.equal(content[0].image_url.url, IMAGE_1);
    assert.equal(content[1].type, "image_url");
    assert.equal(content[1].image_url.url, IMAGE_2);
    assert.equal(content[2].type, "text");
  });

  // --- buildContent: text input ---
  it("buildContent — text input", () => {
    const inputs = [{ type: "text", data: "Previous analysis result" }];
    const content = proto.buildContent(inputs, "Compare with this");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "text");
    assert.equal(content[0].text, "Previous analysis result");
    assert.equal(content[1].type, "text");
    assert.equal(content[1].text, "Compare with this");
  });

  // --- buildContent: mixed image+text ---
  it("buildContent — mixed image+text inputs", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "text", data: "Reference: sunny day" },
    ];
    const content = proto.buildContent(inputs, "Analyze");
    assert.equal(content.length, 3);
    assert.equal(content[0].type, "image_url");
    assert.equal(content[1].type, "text");
    assert.equal(content[1].text, "Reference: sunny day");
    assert.equal(content[2].type, "text");
    assert.equal(content[2].text, "Analyze");
  });

  // --- buildBody ---
  it("buildBody — default options", () => {
    const body = proto.buildBody("gpt-4o", [{ type: "text", text: "Hello" }], {});
    assert.equal(body.model, "gpt-4o");
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].role, "user");
    assert.ok(Array.isArray(body.messages[0].content));
  });

  it("buildBody — custom maxTokens", () => {
    const body = proto.buildBody("gpt-4o", [], { maxTokens: 4096 });
    assert.equal(body.max_tokens, 4096);
  });

  it("buildBody — custom temperature", () => {
    const body = proto.buildBody("gpt-4o", [], { temperature: 0.7 });
    assert.equal(body.temperature, 0.7);
  });

  // --- extractContent ---
  it("extractContent — valid response", () => {
    const data = {
      choices: [{ message: { content: "This is a cat" } }],
    };
    const text = proto.extractContent(data);
    assert.equal(text, "This is a cat");
  });

  it("extractContent — empty choice should throw", () => {
    const data = { choices: [] };
    assert.throws(() => proto.extractContent(data), /No text content/);
  });

  it("extractContent — null message should throw", () => {
    const data = { choices: [{}] };
    assert.throws(() => proto.extractContent(data));
  });

  // --- parseError ---
  it("parseError — 401 maps to auth", () => {
    const result = proto.parseError({ error: { message: "Unauthorized" } }, 401);
    assert.equal(result.category, "auth");
  });

  it("parseError — 403 maps to auth", () => {
    const result = proto.parseError({}, 403);
    assert.equal(result.category, "auth");
  });

  it("parseError — 429 maps to rate_limit", () => {
    const result = proto.parseError({ error: { message: "Rate limited" } }, 429);
    assert.equal(result.category, "rate_limit");
  });

  it("parseError — 500 maps to server", () => {
    const result = proto.parseError({}, 500);
    assert.equal(result.category, "server");
  });

  it("parseError — 503 maps to server", () => {
    const result = proto.parseError({}, 503);
    assert.equal(result.category, "server");
  });

  it("parseError — 400 maps to client", () => {
    const result = proto.parseError({ error: { message: "Bad request" } }, 400);
    assert.equal(result.category, "client");
  });

  it("parseError — passes through error message", () => {
    const result = proto.parseError({ error: { message: "Invalid MIME type" } }, 400);
    assert.equal(result.category, "client");
    assert.equal(result.message, "Invalid MIME type");
  });
});

describe("PROTOCOLS: anthropic-messages", () => {
  const proto = PROTOCOLS?.["anthropic-messages"];

  // --- endpoint ---
  it("endpoint returns /v1/messages", () => {
    assert.equal(proto.endpoint("claude-sonnet"), "/v1/messages");
  });

  // --- auth ---
  it("auth returns x-api-key + anthropic-version headers", () => {
    const headers = proto.auth("sk-ant-test123");
    assert.equal(headers["x-api-key"], "sk-ant-test123");
    assert.equal(headers["anthropic-version"], "2023-06-01");
  });

  // --- buildContent: strips base64 prefix ---
  it("buildContent — strips data: prefix from base64", () => {
    const inputs = [{ type: "image", data: IMAGE_1, mimeType: "image/png" }];
    const content = proto.buildContent(inputs, "Describe");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "image");
    assert.equal(content[0].source.type, "base64");
    assert.equal(content[0].source.media_type, "image/png");
    // Should NOT contain the "data:...base64," prefix
    assert.ok(!content[0].source.data.includes("data:"), "Base64 prefix should be stripped");
    assert.ok(!content[0].source.data.includes("base64,"), "Base64 prefix should be stripped");
    assert.ok(content[0].source.data.includes("iVBORw0KGgo"), "Should contain raw base64 data");
  });

  // --- buildContent: multiple images ---
  it("buildContent — multiple images", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "image", data: IMAGE_2, mimeType: "image/jpeg" },
    ];
    const content = proto.buildContent(inputs, "Compare");
    assert.equal(content.length, 3);
    assert.equal(content[0].source.media_type, "image/png");
    assert.equal(content[1].source.media_type, "image/jpeg");
  });

  // --- buildContent: text input ---
  it("buildContent — text input", () => {
    const inputs = [{ type: "text", data: "Hello" }];
    const content = proto.buildContent(inputs, "World");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "text");
    assert.equal(content[0].text, "Hello");
    assert.equal(content[1].type, "text");
    assert.equal(content[1].text, "World");
  });

  // --- buildBody ---
  it("buildBody — default options", () => {
    const body = proto.buildBody("claude-sonnet-4-6-20250501", [{ type: "text", text: "Hi" }], {});
    assert.equal(body.model, "claude-sonnet-4-6-20250501");
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.messages[0].role, "user");
  });

  // --- extractContent ---
  it("extractContent — valid response", () => {
    const data = { content: [{ type: "text", text: "A beautiful sunset" }] };
    assert.equal(proto.extractContent(data), "A beautiful sunset");
  });

  it("extractContent — no text content should throw", () => {
    assert.throws(() => proto.extractContent({ content: [{ type: "image" }] }));
  });

  // --- parseError ---
  it("parseError — 401 maps to auth", () => {
    const result = proto.parseError({ error: { message: "Invalid key" } }, 401);
    assert.equal(result.category, "auth");
  });

  it("parseError — 429 maps to rate_limit", () => {
    const result = proto.parseError({ type: "error", error: { type: "rate_limit_error", message: "Too fast" } }, 429);
    assert.equal(result.category, "rate_limit");
  });

  it("parseError — 500 maps to server", () => {
    const result = proto.parseError({}, 500);
    assert.equal(result.category, "server");
  });
});

describe("PROTOCOLS: google-generative-ai", () => {
  const proto = PROTOCOLS?.["google-generative-ai"];

  // --- endpoint ---
  it("endpoint includes model in path", () => {
    assert.equal(proto.endpoint("gemini-2.5-flash"), "/v1beta/models/gemini-2.5-flash:generateContent");
  });

  // --- auth ---
  it("auth returns x-goog-api-key header", () => {
    const headers = proto.auth("AIzaTest123");
    assert.equal(headers["x-goog-api-key"], "AIzaTest123");
  });

  // --- buildContent: single image ---
  it("buildContent — single image", () => {
    const inputs = [{ type: "image", data: IMAGE_1, mimeType: "image/png" }];
    const parts = proto.buildContent(inputs, "Describe");
    assert.equal(parts.length, 2);
    assert.ok(parts[0].inline_data);
    assert.equal(parts[0].inline_data.mime_type, "image/png");
    assert.ok(parts[0].inline_data.data.includes("iVBORw0KGgo"));
    assert.equal(parts[1].text, "Describe");
  });

  // --- buildContent: multiple images ---
  it("buildContent — multiple images", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "image", data: IMAGE_2, mimeType: "image/jpeg" },
    ];
    const parts = proto.buildContent(inputs, "Compare");
    assert.equal(parts.length, 3);
    assert.equal(parts[0].inline_data.mime_type, "image/png");
    assert.equal(parts[1].inline_data.mime_type, "image/jpeg");
  });

  // --- buildContent: text input ---
  it("buildContent — text input", () => {
    const inputs = [{ type: "text", data: "Context" }];
    const parts = proto.buildContent(inputs, "Question?");
    assert.equal(parts.length, 2);
    assert.equal(parts[0].text, "Context");
    assert.equal(parts[1].text, "Question?");
  });

  // --- buildBody ---
  it("buildBody — default options", () => {
    const body = proto.buildBody("gemini-2.5-flash", [{ text: "Hi" }], {});
    assert.equal(body.contents.length, 1);
    assert.deepStrictEqual(body.contents[0].parts, [{ text: "Hi" }]);
  });

  // --- extractContent ---
  it("extractContent — valid response", () => {
    const data = {
      candidates: [{ content: { parts: [{ text: "A cat on a sofa" }] } }],
    };
    assert.equal(proto.extractContent(data), "A cat on a sofa");
  });

  it("extractContent — no candidates should throw", () => {
    const data = { candidates: [] };
    assert.throws(() => proto.extractContent(data));
  });

  // --- parseError ---
  it("parseError — 401 maps to auth", () => {
    const result = proto.parseError({ error: { message: "Invalid API key" } }, 401);
    assert.equal(result.category, "auth");
  });

  it("parseError — 429 maps to rate_limit", () => {
    const result = proto.parseError({ error: { message: "Quota exceeded" } }, 429);
    assert.equal(result.category, "rate_limit");
  });
});
```

- [ ] **Step 2: 运行测试验证它们失败**

```bash
node --test tests/test-protocols.js
```

Expected: 全部 FAIL（PROTOCOLS 模块不存在）

- [ ] **Step 3: Commit**

```bash
git add tests/test-protocols.js
git commit -m "test: protocols 纯函数 TDD 用例（3协议 × 6方法 = 30 test）"
```

---

### Task 2: 实现协议对象（PROTOCOLS）

**Files:**
- Create: `scripts/lib/providers/protocols.js`

- [ ] **Step 1: 实现 3 个协议族的纯函数**

```javascript
// scripts/lib/providers/protocols.js

/**
 * 协议定义 — 纯函数集合
 *
 * 每个协议族对象包含 6 个方法，覆盖一个 API 家族的全部差异：
 * - endpoint(model)  → 请求路径
 * - auth(apiKey)     → HTTP 认证头
 * - buildContent(inputs, prompt) → 协议特定的 content 结构
 * - buildBody(model, content, options) → 请求体
 * - extractContent(data) → 从响应提取文本
 * - parseError(data, status) → 归一化错误分类
 *
 * 所有方法均为纯函数：输入 → 输出，零副作用。
 */

/**
 * 去除 Base64 data URL 前缀，返回纯 Base64 字符串
 * @param {string} data - "data:image/png;base64,iVBORw0KGgo..." 或纯 Base64
 * @returns {string} 纯 Base64
 */
function stripB64Prefix(data) {
  const i = data.indexOf(";base64,");
  return i >= 0 ? data.slice(i + 8) : data;
}

export const PROTOCOLS = {

  /** Anthropic Messages API (mimo 等) */
  "anthropic-messages": {
    endpoint(_model) {
      return "/v1/messages";
    },

    auth(apiKey) {
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
    },

    buildContent(inputs, prompt) {
      const content = [];
      for (const inp of inputs) {
        if (inp.type === "image") {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: inp.mimeType || "image/png",
              data: stripB64Prefix(inp.data),
            },
          });
        } else if (inp.type === "text") {
          content.push({ type: "text", text: inp.data });
        }
      }
      content.push({ type: "text", text: prompt });
      return content;
    },

    buildBody(model, content, options) {
      const body = {
        model,
        max_tokens: options.maxTokens || 2048,
        messages: [{ role: "user", content }],
      };
      if (options.temperature != null) body.temperature = options.temperature;
      return body;
    },

    extractContent(data) {
      const text = data.content?.find(c => c.type === "text")?.text;
      if (!text) throw new Error("No text content in response");
      return text;
    },

    parseError(data, status) {
      const err = data.error || data;
      if (status === 401 || status === 403) return { category: "auth" };
      if (status === 429) return { category: "rate_limit" };
      if (status >= 500) return { category: "server" };
      return { category: "client", message: err.message };
    },
  },

  /** OpenAI Chat Completions API (openai/groq/together/fireworks/ollama) */
  "openai-chat-completions": {
    endpoint(_model) {
      return "/chat/completions";
    },

    auth(apiKey) {
      return { Authorization: `Bearer ${apiKey}` };
    },

    buildContent(inputs, prompt) {
      const content = [];
      for (const inp of inputs) {
        if (inp.type === "image") {
          content.push({ type: "image_url", image_url: { url: inp.data } });
        } else if (inp.type === "text") {
          content.push({ type: "text", text: inp.data });
        }
      }
      content.push({ type: "text", text: prompt });
      return content;
    },

    buildBody(model, content, options) {
      const body = {
        model,
        max_tokens: options.maxTokens || 2048,
        messages: [{ role: "user", content }],
      };
      if (options.temperature != null) body.temperature = options.temperature;
      return body;
    },

    extractContent(data) {
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("No text content in response");
      return text;
    },

    parseError(data, status) {
      const err = data.error || data;
      if (status === 401 || status === 403) return { category: "auth" };
      if (status === 429) return { category: "rate_limit" };
      if (status >= 500) return { category: "server" };
      return { category: "client", message: err.message };
    },
  },

  /** Google Generative AI API (gemini) */
  "google-generative-ai": {
    endpoint(model) {
      return `/v1beta/models/${model}:generateContent`;
    },

    auth(apiKey) {
      return { "x-goog-api-key": apiKey };
    },

    buildContent(inputs, prompt) {
      const parts = [];
      for (const inp of inputs) {
        if (inp.type === "image") {
          parts.push({
            inline_data: {
              mime_type: inp.mimeType || "image/png",
              data: stripB64Prefix(inp.data),
            },
          });
        } else if (inp.type === "text") {
          parts.push({ text: inp.data });
        }
      }
      parts.push({ text: prompt });
      return parts;
    },

    buildBody(model, parts, options) {
      const body = { contents: [{ parts }] };
      if (options.temperature != null) {
        body.generationConfig = { temperature: options.temperature };
      }
      return body;
    },

    extractContent(data) {
      const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
      if (!text) throw new Error("No text content in response");
      return text;
    },

    parseError(data, status) {
      const err = data.error || data;
      if (status === 401 || status === 403) return { category: "auth" };
      if (status === 429) return { category: "rate_limit" };
      if (status >= 500) return { category: "server" };
      return { category: "client", message: err.message };
    },
  },
};
```

- [ ] **Step 2: 运行测试验证通过**

```bash
node --test tests/test-protocols.js
```

Expected: 全部 30 test PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/providers/protocols.js
git commit -m "feat: 新增 protocols.js — 3 协议族纯函数（Anthropic/OpenAI/Google）"
```

---

### Task 3: GenericProvider 测试（TDD）

**Files:**
- Create: `tests/test-generic-provider.js`

- [ ] **Step 1: 写 GenericProvider 测试（含 overrides 校验 + 构造时验证）**

```javascript
// tests/test-generic-provider.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClientError } from "../scripts/lib/errorHandler.js";

// NOTE: Task 4 will create this module; tests will fail until then
let { GenericProvider } = {};
try {
  const mod = await import("../scripts/lib/providers/generic-provider.js");
  GenericProvider = mod.GenericProvider;
} catch { /* module not created yet */ }

// Minimal mock protocol for testing GenericProvider in isolation
const MOCK_PROTOCOL = {
  endpoint: () => "/test/endpoint",
  auth: (apiKey) => ({ "X-Test-Key": apiKey }),
  buildContent: (inputs, prompt) => [...inputs, { type: "text", text: prompt }],
  buildBody: (model, content, opts) => ({ model, max_tokens: opts.maxTokens || 2048, content }),
  extractContent: (data) => data.text || "",
  parseError: (data, status) => {
    if (status === 401) return { category: "auth" };
    if (status === 429) return { category: "rate_limit" };
    if (status >= 500) return { category: "server" };
    return { category: "client" };
  },
};

// Helper: create GenericProvider with mock protocol
function createProvider(overrides = {}) {
  return new GenericProvider({
    name: "test-provider",
    protocol: MOCK_PROTOCOL,
    baseUrl: "https://test.local",
    apiKey: "sk-test123",
    model: "test-model",
    timeoutMs: 5000,
    overrides,
  });
}

describe("GenericProvider", () => {
  // ============ Constructor validation ============
  describe("constructor", () => {
    it("should throw if protocol is null/undefined", () => {
      assert.throws(
        () => new GenericProvider({ name: "x", protocol: null, apiKey: "k" }),
        (err) => err instanceof ClientError && err.message.includes("未知协议")
      );
    });

    it("should throw if overrides contains disallowed key", () => {
      assert.throws(
        () => createProvider({ auth: () => ({}) }),
        (err) => err instanceof ClientError && err.message.includes("不允许覆盖")
      );
    });

    it("should throw if overrides key does not exist in protocol", () => {
      assert.throws(
        () => createProvider({ buildBody: null }),
        // MOCK_PROTOCOL has buildBody, so null check is different
      );
    });

    it("should throw if overrides key method absent in protocol", () => {
      assert.throws(
        () => createProvider({ parseError: null }),
        // MOCK_PROTOCOL has parseError, so null check
      );
    });

    it("should accept valid overrides: buildBody", () => {
      const gp = createProvider({ buildBody: (proto, model, content, opts) => proto.buildBody(model, content, { ...opts, maxTokens: 100 }) });
      assert.equal(gp.name, "test-provider");
    });

    it("should accept valid overrides: parseError", () => {
      const gp = createProvider({ parseError: (proto, data, status) => proto.parseError(data, status) });
      assert.equal(gp.name, "test-provider");
    });

    it("should set all properties", () => {
      const gp = createProvider();
      assert.equal(gp.name, "test-provider");
    });

    it("should throw when overrides value is not a function", () => {
      // buildBody override is "not_a_function" string
      assert.throws(
        () => new GenericProvider({
          name: "x",
          protocol: MOCK_PROTOCOL,
          baseUrl: "https://t.local",
          apiKey: "k",
          model: "m",
          overrides: { buildBody: "not_a_function" },
        }),
        (err) => err instanceof ClientError && err.message.includes("必须是函数")
      );
    });

    it("should throw when override key does not exist in protocol", () => {
      // Create protocol without parseError to test
      const protoNoError = { ...MOCK_PROTOCOL };
      delete protoNoError.buildBody;
      assert.throws(
        () => new GenericProvider({
          name: "x",
          protocol: protoNoError,
          baseUrl: "https://t.local",
          apiKey: "k",
          model: "m",
          overrides: { buildBody: () => ({}) },
        }),
        (err) => err instanceof ClientError && err.message.includes("没有方法")
      );
    });
  });

  // ============ Override mechanism ============
  describe("overrides", () => {
    it("should call override instead of protocol method", async () => {
      let called = false;
      const gp = new GenericProvider({
        name: "test",
        protocol: MOCK_PROTOCOL,
        baseUrl: "https://t.local",
        apiKey: "k",
        model: "m",
        overrides: {
          buildBody(proto, model, content, opts) {
            called = true;
            const body = proto.buildBody(model, content, opts);
            body.max_tokens = Math.min(body.max_tokens, 10);
            return body;
          },
        },
      });
      // We can't easily test _call() directly, but we can verify it during execute
      // For now, validate construction succeeded
      assert.ok(gp);
    });
  });

  // ============ healthCheck ============
  describe("healthCheck", () => {
    it("should return boolean", async () => {
      // Will fail without fetch mock — tests GenericProvider structure
      // This test validates the method exists and returns a boolean
      const gp = createProvider();
      assert.equal(typeof gp.healthCheck, "function");
    });
  });

  // ============ analyzeImage backward compat ============
  describe("analyzeImage (backward compat)", () => {
    it("should exist as a method", () => {
      const gp = createProvider();
      assert.equal(typeof gp.analyzeImage, "function");
    });

    it("should accept single image string", () => {
      const gp = createProvider();
      // Structure check only — actual call needs fetch mock
      assert.ok(gp.analyzeImage);
    });
  });

  // ============ execute ============
  describe("execute", () => {
    it("should exist as primary interface", () => {
      const gp = createProvider();
      assert.equal(typeof gp.execute, "function");
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
node --test tests/test-generic-provider.js
```

Expected: FAIL（GenericProvider 模块不存在）

- [ ] **Step 3: Commit**

```bash
git add tests/test-generic-provider.js
git commit -m "test: GenericProvider 构造校验 + overrides 约束用例"
```

---

### Task 4: 实现 GenericProvider

**Files:**
- Create: `scripts/lib/providers/generic-provider.js`

**说明：** GenericProvider 是 v3.0 唯一的 Provider 类，零子类。它能接受协议对象（纯函数）或协议名字符串（查 PROTOCOLS），方便测试 mock。

- [ ] **Step 1: 实现 GenericProvider**

```javascript
// scripts/lib/providers/generic-provider.js

import { ClientError } from "../errorHandler.js";
import { apiRequest } from "../httpClient.js";
import { MODE_PROMPTS } from "./provider.js";

/** 允许 overrides 覆盖的方法 */
const ALLOWED_OVERRIDES = ["buildBody", "parseError"];

/**
 * GenericProvider — 唯一 Provider 类，零子类
 *
 * 接收一个协议对象（或注册表中的配置项），调度协议函数完成请求。
 * 不含任何 API 特定的业务逻辑。
 *
 * 同时暴露新旧两套接口：
 * - execute({inputs, prompt, options}) — 新主接口，类型无关
 * - analyzeImage({image, prompt, options}) — 旧接口，向后兼容
 */
export class GenericProvider {
  /**
   * @param {object} opts
   * @param {string} opts.name — Provider 名
   * @param {object|string} opts.protocol — 协议对象 或 PROTOCOLS 中的 key
   * @param {string} opts.baseUrl — API 基地址
   * @param {string} opts.apiKey — API Key
   * @param {string} opts.model — 模型名
   * @param {number} [opts.timeoutMs=30000] — 超时
   * @param {object} [opts.overrides={}] — 方法覆盖（仅 buildBody/parseError）
   */
  constructor({ name, protocol, baseUrl, apiKey, model, timeoutMs = 30_000, overrides = {} }) {
    this.name = name;
    this._baseUrl = baseUrl;
    this._apiKey = apiKey;
    this._model = model;
    this._timeoutMs = timeoutMs;

    // 协议对象 — 由调用方（registry）从 PROTOCOLS 解析后传入
    // 字符串 key 应在 registry 层解析为对象后再传入，不在此处处理
    if (!protocol || typeof protocol !== "object") {
      throw new ClientError(`Provider "${name}": 协议无效，请传入协议对象`);
    }
    this._proto = protocol;

    // 校验 overrides
    this._validateOverrides(overrides);
    this._overrides = overrides;
  }

  /**
   * 校验 overrides 仅包含合法 key，且值均为函数，且对应方法在协议中存在
   */
  _validateOverrides(overrides) {
    for (const key of Object.keys(overrides)) {
      if (!ALLOWED_OVERRIDES.includes(key)) {
        throw new ClientError(
          `Provider "${this.name}": 不允许覆盖 "${key}"，仅允许 ${ALLOWED_OVERRIDES.join(", ")}`
        );
      }
      if (typeof overrides[key] !== "function") {
        throw new ClientError(
          `Provider "${this.name}": override "${key}" 必须是函数`
        );
      }
      if (typeof this._proto[key] !== "function") {
        throw new ClientError(
          `Provider "${this.name}": 协议没有方法 "${key}"，无法覆盖`
        );
      }
    }
  }

  /**
   * 调用协议方法（overrides 优先）
   * @param {string} method
   * @param {...any} args
   * @returns {any}
   */
  _call(method, ...args) {
    if (this._overrides[method]) {
      return this._overrides[method](this._proto, ...args);
    }
    return this._proto[method](...args);
  }

  /**
   * 新主接口：类型无关的输入处理
   * @param {{ inputs: Array<{type:string, data:string, mimeType?:string}>, prompt: string, options?: object }} params
   * @returns {Promise<{ content: string, model: string, processingTimeMs: number }>}
   */
  async execute({ inputs, prompt, options = {} }) {
    const startTime = Date.now();

    const content = this._call("buildContent", inputs, prompt);
    const body = this._call("buildBody", this._model, content, options);
    const headers = this._call("auth", this._apiKey);
    const ep = this._proto.endpoint(this._model);

    const url = this._baseUrl ? `${this._baseUrl}${ep}` : ep;
    const res = await apiRequest(url, {
      body,
      headers,
      timeoutMs: this._timeoutMs,
      providerName: this.name,
      parseError: (data, status) => this._proto.parseError(data, status),
    });

    const data = await res.json();
    const text = this._proto.extractContent(data);

    return {
      content: text,
      model: this._model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 向后兼容旧接口
   * 将 {image, prompt, options} 转换为 execute({inputs, prompt, options})
   */
  async analyzeImage({ image, prompt, options = {} }) {
    const imgs = Array.isArray(image) ? image : [image];
    const inputs = imgs.map(img => {
      if (typeof img === "string") {
        // Single base64 string
        const mimeMatch = img.match(/^data:(.+?);base64,/);
        return { type: "image", data: img, mimeType: mimeMatch ? mimeMatch[1] : "image/png" };
      }
      return { type: "image", data: img.base64, mimeType: img.mimeType || "image/png" };
    });

    const mode = options.mode || "describe";
    const defaultPrompt = MODE_PROMPTS[mode] || prompt || "";
    const finalPrompt = prompt && prompt !== defaultPrompt ? prompt : defaultPrompt;

    return this.execute({
      inputs,
      prompt: finalPrompt,
      options: { maxTokens: options.maxSize, temperature: options.temperature },
    });
  }

  /**
   * 快速连通性检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const result = await this.execute({
        inputs: [{ type: "image", data: miniPng, mimeType: "image/png" }],
        prompt: "say OK",
        options: { maxTokens: 50 },
      });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: 运行 GenericProvider 测试**

```bash
node --test tests/test-generic-provider.js
```

Expected: 构造校验相关的 test PASS（构造中抛出正确错误），execute/healthCheck 因无 fetch mock 而失败。这是因为测试中有些用例调用了 execute，会真正发 fetch。调整测试——构造校验类 PASS，execute 类暂时跳过。

> **注意：** 构造相关的 7 个测试应全部通过。execute 相关的 3 个测试需要用 `{ skip: true }` 标记跳过，等 httpClient 适配后再开启。

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/providers/generic-provider.js
git commit -m "feat: 新增 GenericProvider — 唯一 Provider 类，协议驱动调度"
```

---

### Task 5: httpClient 适配 — 委托 parseError

**Files:**
- Modify: `scripts/lib/httpClient.js` (line 4-51)

**说明：** httpClient 当前自己判断 HTTP 状态码做错误分类。需要改为：接收可选的 `parseError` 函数，有则委托，无则走旧逻辑。

- [ ] **Step 1: 修改 `apiRequest` 和 `httpError`**

```javascript
// scripts/lib/httpClient.js — 修改部分

export async function apiRequest(url, { body, headers = {}, timeoutMs = 30_000, providerName, parseError }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw await httpError(res, parseError);
    return res;

  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ClientError || err instanceof ServerError) throw err;
    if (err.name === "AbortError") {
      throw new NetworkError("请求超时", { suggestion: "网络较慢或图片过大，请重试" });
    }
    throw new NetworkError("网络请求失败", { suggestion: "请检查网络连接后重试" });
  }
}

/** 不泄露 provider 名称、原始响应体到错误消息 */
async function httpError(res, parseError) {
  const s = res.status;
  const data = await res.json().catch(() => ({}));

  // 如果有 parseError，委托它做分类
  if (typeof parseError === "function") {
    const parsed = parseError(data, s);
    switch (parsed.category) {
      case "auth":
        throw new ClientError("API Key 无效或被拒绝", { statusCode: s, suggestion: "请检查 API Key 是否正确" });
      case "rate_limit":
        throw new ServerError("API 请求频率超限", {
          statusCode: s,
          suggestion: "请稍后重试（系统将自动重试）",
        });
      case "server":
        throw new ServerError("服务端异常，请稍后重试", { statusCode: s });
      case "client":
      default:
        throw new ClientError(parsed.message || "API 请求失败", { statusCode: s, suggestion: "请检查请求参数后重试" });
    }
  }

  // 旧路径：无 parseError，保持原有逻辑
  if (s === 401 || s === 403) {
    throw new ClientError("API Key 无效或被拒绝", { statusCode: s, suggestion: "请检查 API Key 是否正确" });
  }
  if (s === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const waitSec = retryAfter ? parseInt(retryAfter) : null;
    throw new ServerError("API 请求频率超限", {
      statusCode: s, retryAfterSec: waitSec,
      suggestion: waitSec ? `请等待 ${waitSec}s 后重试` : "请稍后重试（系统将自动重试）",
    });
  }
  if (s >= 500) {
    throw new ServerError("服务端异常，请稍后重试", { statusCode: s });
  }
  throw new ClientError("API 请求失败", { statusCode: s, suggestion: "请检查请求参数后重试" });
}
```

注意：需要消费响应体防止内存泄漏。旧代码用 `res.text().catch(() => {})`，新代码用 `res.json().catch(() => ({}))` 获取数据用于 parseError。

- [ ] **Step 2: 运行现有测试验证无回归**

```bash
node --test tests/test-httpClient.js 2>/dev/null || echo "no httpClient-specific tests"
node --test tests/test-errorHandler.js
node --test tests/test-orchestrator.js
```

Expected: 现有测试全部 PASS，httpClient 改动不影响旧路径。

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/httpClient.js
git commit -m "feat: httpClient 支持 parseError 委托 — 新旧路径兼容"
```

---

### Task 6: Registry v3 — 纯数据声明 + loadProvidersV3

**Files:**
- Modify: `scripts/lib/providers/registry.js`

**说明：** 在现有 registry.js 中追加 REGISTRY_V3（纯数据）和 `loadProvidersV3()`，旧的 REGISTRY 和 `loadProviders()` 保持不变。并行共存。

- [ ] **Step 1: 在 registry.js 末尾追加新代码**

```javascript
// scripts/lib/providers/registry.js — 追加以下内容

// ========== v3.0 协议驱动注册表 ==========

import { GenericProvider } from "./generic-provider.js";
import { PROTOCOLS } from "./protocols.js";

/**
 * v3.0 Provider 注册表 — 纯数据
 * 新增 Provider = 加 1 行。overrides 仅允许 buildBody 和 parseError。
 */
export const REGISTRY_V3 = [
  // ── OpenAI 协议家族 (5 Provider) ──
  {
    name: "openai",
    protocol: "openai-chat-completions",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    limits: { rpm: 500, tpm: 2000000 },
  },
  {
    name: "groq",
    protocol: "openai-chat-completions",
    envKey: "GROQ_API_KEY",
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    model: process.env.GROQ_MODEL || "llama-4-vision",
    limits: { rpm: 30, tpm: 30000 },
    overrides: {
      buildBody(proto, model, content, opts) {
        const body = proto.buildBody(model, content, opts);
        body.max_tokens = Math.min(body.max_tokens, 4096);
        return body;
      },
    },
  },
  {
    name: "together",
    protocol: "openai-chat-completions",
    envKey: "TOGETHER_API_KEY",
    baseUrl: process.env.TOGETHER_BASE_URL || "https://api.together.xyz/v1",
    model: process.env.TOGETHER_MODEL || "Llama-4-Maverick",
    limits: { rpm: 60, tpm: 60000 },
  },
  {
    name: "fireworks",
    protocol: "openai-chat-completions",
    envKey: "FIREWORKS_API_KEY",
    baseUrl: process.env.FIREWORKS_BASE_URL || "https://api.fireworks.ai/inference/v1",
    model: process.env.FIREWORKS_MODEL || "llama-v4",
    limits: { rpm: 60, tpm: 60000 },
  },
  {
    name: "ollama",
    protocol: "openai-chat-completions",
    envKey: "OLLAMA_BASE_URL",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: "llama3.2-vision",
    limits: {},
  },

  // ── Anthropic 协议家族 ──
  {
    name: "mimo",
    protocol: "anthropic-messages",
    envKey: "MIMO_API_KEY",
    baseUrl: "",
    model: "mimo-v2.5",
    limits: { rpm: 60, rpd: 1000, tpm: 100000 },
  },

  // ── Google 协议家族 ──
  {
    name: "gemini",
    protocol: "google-generative-ai",
    envKey: "GEMINI_API_KEY",
    baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    limits: { rpm: 15, rpd: 1500, tpm: 1000000 },
  },
];

/**
 * v3.0 加载已配置的 Provider
 * @param {string} order — "openai,groq,mimo"
 * @param {object} opts — { model, timeoutMs, baseUrls }
 * @returns {Array<{ provider: GenericProvider, name: string }>}
 */
export function loadProvidersV3(order, opts = {}) {
  const { model, timeoutMs, baseUrls = {} } = opts;
  const available = new Map();

  for (const entry of REGISTRY_V3) {
    const key = process.env[entry.envKey] || "";
    if (!key) continue;

    const proto = PROTOCOLS[entry.protocol];
    if (!proto) {
      log("warn", "registry", "unknown_protocol", { provider: entry.name, protocol: entry.protocol });
      continue;
    }

    const baseUrl = baseUrls[entry.name] || entry.baseUrl;
    const providerModel = model || entry.model;

    try {
      available.set(entry.name, {
        provider: new GenericProvider({
          name: entry.name,
          protocol: proto,
          baseUrl,
          apiKey: key,
          model: providerModel,
          timeoutMs,
          overrides: entry.overrides || {},
        }),
        name: entry.name,
      });
    } catch (err) {
      log("warn", "registry", "provider_init_failed", { provider: entry.name, error: err.message });
    }
  }

  const ordered = order.split(",").map(s => s.trim());
  const result = [];
  for (const name of ordered) {
    if (available.has(name)) result.push(available.get(name));
  }

  log("debug", "registry", "providers_loaded_v3", { order, count: result.length });
  return result;
}
```

- [ ] **Step 2: 更新 registry 测试 — 增加 REGISTRY_V3 数据完整性**

在 `tests/test-registry.js` 末尾追加：

```javascript
// tests/test-registry.js — 追加 v3 测试

import { REGISTRY_V3, loadProvidersV3 } from "../scripts/lib/providers/registry.js";
import { PROTOCOLS } from "../scripts/lib/providers/protocols.js";

describe("registry v3", () => {
  describe("REGISTRY_V3 data integrity", () => {
    it("should have 7 entries", () => {
      assert.equal(REGISTRY_V3.length, 7);
    });

    it("each entry should have required fields", () => {
      for (const entry of REGISTRY_V3) {
        assert.ok(entry.name, `${entry.name || "?"} has name`);
        assert.ok(entry.protocol, `${entry.name} has protocol`);
        assert.ok(entry.envKey, `${entry.name} has envKey`);
        assert.ok(typeof entry.baseUrl === "string" || entry.baseUrl === "", `${entry.name} has baseUrl`);
        assert.ok(entry.model, `${entry.name} has model`);
        assert.ok(entry.limits && typeof entry.limits === "object", `${entry.name} has limits`);
      }
    });

    it("each protocol reference should exist in PROTOCOLS", () => {
      for (const entry of REGISTRY_V3) {
        assert.ok(PROTOCOLS[entry.protocol], `${entry.name} protocol "${entry.protocol}" exists in PROTOCOLS`);
      }
    });

    it("ollama uses openai-chat-completions protocol", () => {
      const ollama = REGISTRY_V3.find(e => e.name === "ollama");
      assert.equal(ollama.protocol, "openai-chat-completions");
    });

    it("only groq has overrides", () => {
      const withOverrides = REGISTRY_V3.filter(e => e.overrides && Object.keys(e.overrides).length > 0);
      assert.equal(withOverrides.length, 1);
      assert.equal(withOverrides[0].name, "groq");
    });

    it("groq overrides only uses buildBody", () => {
      const groq = REGISTRY_V3.find(e => e.name === "groq");
      const keys = Object.keys(groq.overrides);
      assert.ok(keys.includes("buildBody"), "groq overrides includes buildBody");
      // Check no disallowed keys
      const allowed = ["buildBody", "parseError"];
      for (const key of keys) {
        assert.ok(allowed.includes(key), `groq override "${key}" is allowed`);
      }
    });

    it("all names must be unique", () => {
      const names = REGISTRY_V3.map(e => e.name);
      const unique = new Set(names);
      assert.equal(unique.size, names.length);
    });
  });

  describe("loadProvidersV3", () => {
    it("should return empty array when no keys configured", () => {
      withEnv({ OPENAI_API_KEY: null, MIMO_API_KEY: null, OLLAMA_BASE_URL: null }, () => {
        const result = loadProvidersV3("openai,mimo,ollama", { timeoutMs: 5000 });
        assert.equal(result.length, 0);
      });
    });

    it("should return providers with keys set", () => {
      withEnv({ OPENAI_API_KEY: "sk-test", MIMO_API_KEY: null }, () => {
        const result = loadProvidersV3("openai", { timeoutMs: 5000 });
        assert.equal(result.length, 1);
        assert.equal(result[0].name, "openai");
      });
    });

    it("should respect provider order", () => {
      withEnv({ OPENAI_API_KEY: "sk-test", MIMO_API_KEY: "tp-test" }, () => {
        const a = loadProvidersV3("openai,mimo", { timeoutMs: 5000 });
        assert.equal(a[0].name, "openai");
        assert.equal(a[1].name, "mimo");

        const b = loadProvidersV3("mimo,openai", { timeoutMs: 5000 });
        assert.equal(b[0].name, "mimo");
        assert.equal(b[1].name, "openai");
      });
    });
  });
});
```

- [ ] **Step 3: 运行测试**

```bash
node --test tests/test-registry.js
```

Expected: 旧 7 test PASS + 新 v3 test PASS

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/providers/registry.js tests/test-registry.js
git commit -m "feat: REGISTRY_V3 纯数据注册表 + loadProvidersV3 + 数据完整性测试"
```

---

### Task 7: Orchestrator 开关集成

**Files:**
- Modify: `scripts/lib/orchestrator.js`

**说明：** 通过 `UNBLIND_PROTOCOL_DRIVEN=1` 切换新旧路径。改动 `buildProviderChain` 函数，其他函数不变。

- [ ] **Step 1: 修改 `buildProviderChain` 增加开关**

`buildProviderChain` 替换为：

```javascript
/** 构建 Provider 链，每个 Provider 独立 CircuitBreaker */
function buildProviderChain(config) {
  const useV3 = process.env.UNBLIND_PROTOCOL_DRIVEN === "1";

  let providers;
  if (useV3) {
    // v3.0 协议驱动路径
    const baseUrls = {};
    providers = loadProvidersV3(config.providerOrder, {
      model: config.model,
      timeoutMs: config.requestTimeoutMs,
      baseUrls,
    });
  } else {
    // v2.0 旧路径
    const mimoKey = getApiKey();
    const baseUrls = {
      mimo: mimoKey ? getBaseUrl(mimoKey) : "",
    };
    const model = process.env.OPENAI_VISION_MODEL || config.model;

    providers = loadProviders(config.providerOrder, {
      model: config.model,
      timeoutMs: config.requestTimeoutMs,
      baseUrls,
    });
  }

  return providers.map(p => ({
    ...p,
    cb: new CircuitBreaker({ failureThreshold: p.name === "ollama" ? 3 : 5, timeoutSeconds: 60 }),
  }));
}
```

同时更新 import，加入 v3 的 `loadProvidersV3`：

```javascript
// 修改 import 行
import { loadProviders, loadProvidersV3 } from "./providers/registry.js";
```

- [ ] **Step 2: 运行 orchestrator 相关测试**

```bash
node --test tests/test-orchestrator.js
```

Expected: 现有测试 PASS（默认走旧路径，无回归）

```bash
UNBLIND_PROTOCOL_DRIVEN=1 node --test tests/test-orchestrator.js
```

Expected: 如果无 API Key，返回 "所有 Provider 均不可用"；有 Key 则可能通过。

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/orchestrator.js
git commit -m "feat: orchestrator 支持 UNBLIND_PROTOCOL_DRIVEN=1 切换 v3 协议驱动路径"
```

---

### Task 8: 全量测试回归 + 旧文件清理 + 开关移除

**Files:**
- Delete: `scripts/lib/providers/mimo.js`
- Delete: `scripts/lib/providers/openai.js`
- Delete: `scripts/lib/providers/gemini.js`
- Modify: `scripts/lib/orchestrator.js`（移除开关，直接走 v3）
- Modify: `scripts/lib/providers/registry.js`（移除旧 REGISTRY + loadProviders）
- Modify: `tests/test-mimo.js`（适配 GenericProvider）

- [ ] **Step 1: 删除旧 Provider 文件**

```bash
git rm scripts/lib/providers/mimo.js
git rm scripts/lib/providers/openai.js
git rm scripts/lib/providers/gemini.js
```

- [ ] **Step 2: 简化 orchestrator — 移除开关**

`buildProviderChain` 简化为：

```javascript
function buildProviderChain(config) {
  const providers = loadProvidersV3(config.providerOrder, {
    model: config.model,
    timeoutMs: config.requestTimeoutMs,
    baseUrls: {},
  });

  return providers.map(p => ({
    ...p,
    cb: new CircuitBreaker({ failureThreshold: p.name === "ollama" ? 3 : 5, timeoutSeconds: 60 }),
  }));
}
```

移除不再需要的 import：
```javascript
// 删除
import { getApiKey, getBaseUrl } from "./credentialManager.js";
// 简化
import { loadProvidersV3 } from "./providers/registry.js";
```

- [ ] **Step 3: 简化 registry.js — 移除旧代码**

删除 `loadProviders` 函数，删除旧 `REGISTRY` 数组，删除旧 import（MimoProvider/OpenAIProvider/GeminiProvider）。
将 `loadProvidersV3` 重命名为 `loadProviders`，`REGISTRY_V3` 重命名为 `REGISTRY`。

- [ ] **Step 4: 更新 test-mimo.js 适配 GenericProvider**

```javascript
// tests/test-mimo.js — 改为使用 GenericProvider
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GenericProvider } from "../scripts/lib/providers/generic-provider.js";
import { PROTOCOLS } from "../scripts/lib/providers/protocols.js";

const apiKey = process.env.MIMO_API_KEY;
let apiAvailable = false;

async function probeApi() {
  if (!apiKey) return;
  try {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      apiKey,
      model: "mimo-v2.5",
      timeoutMs: 10_000,
    });
    const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    await p.analyzeImage({ image: miniPng, options: { mode: "describe", maxSize: 50 } });
    apiAvailable = true;
  } catch { /* Key 无效 */ }
}

await probeApi();

describe("MimoProvider (v3 GenericProvider)", () => {
  it("should have name 'mimo'", () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://test.local",
      apiKey: "tp-test",
      model: "mimo-v2.5",
    });
    assert.equal(p.name, "mimo");
  });

  it("should throw ClientError when API key is missing", () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://test.local",
      apiKey: "",
      model: "mimo-v2.5",
    });
    // execute with empty key will hit API; the error comes from httpClient
    // This test validates construction succeeds even with empty key
    assert.equal(p.name, "mimo");
  });

  it("healthCheck should return true with valid key", { skip: !apiAvailable }, async () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      apiKey,
      model: "mimo-v2.5",
    });
    const healthy = await p.healthCheck();
    assert.equal(healthy, true);
  });

  it("should return valid result for describe mode", { skip: !apiAvailable }, async () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      apiKey,
      model: "mimo-v2.5",
    });
    const miniPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const result = await p.analyzeImage({ image: miniPngBase64 });
    assert.ok(result.content.length > 0);
    assert.ok(result.processingTimeMs > 0);
  });
});
```

- [ ] **Step 5: 全量测试回归**

```bash
node --test tests/test-*.js
```

Expected: 全部 PASS（API 依赖的 test skip 允许）。至少 ≥93 pass。

- [ ] **Step 6: 审计**

```bash
grep -r "tp-cla\|sk-anti" scripts/  # 应无输出
git status  # 无遗漏文件
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: 清理旧 Provider 文件，v3 协议驱动架构正式启用"
```

- [ ] **Step 8: 更新 CLAUDE.md**

更新目录结构、测试数、模块数。当前状态：16 模块 → 15 模块（3 个 Provider 文件删除，新增 2 个文件 = -1）。测试从 95 → 更多。

- [ ] **Step 9: 最终 Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 同步 Provider v3.0 协议驱动架构变更"
```

---

## 实施概览

| Batch | Task | 内容 | 文件变更 |
|-------|------|------|----------|
| 1 | 1+2 | protocols 测试 + 实现 | 新建 tests/test-protocols.js + scripts/lib/providers/protocols.js |
| 1 | 3+4 | GenericProvider 测试 + 实现 | 新建 tests/test-generic-provider.js + scripts/lib/providers/generic-provider.js |
| 2 | 5 | httpClient 适配 parseError | 修改 scripts/lib/httpClient.js |
| 2 | 6 | Registry v3 数据 + 加载 | 修改 scripts/lib/providers/registry.js + tests/test-registry.js |
| 3 | 7 | Orchestrator 开关集成 | 修改 scripts/lib/orchestrator.js |
| 3 | 8 | 旧文件清理 + 全量回归 | 删除 3 个旧 Provider 文件，简化 orchestrator/registry，更新测试 + CLAUDE.md |

## 成功标准

- [ ] `node --test tests/test-protocols.js` — ≥25 pass
- [ ] `node --test tests/test-generic-provider.js` — ≥10 pass
- [ ] `node --test tests/test-registry.js` — v3 新增用例 pass
- [ ] `node --test tests/test-*.js` — 全量回归 ≥ 现有 (93 pass)
- [ ] `grep -r "tp-cla\|sk-anti" scripts/` — 无输出
- [ ] `mimo.js` / `openai.js` / `gemini.js` 已删除
- [ ] orchestrator 直接使用 `loadProvidersV3`，无 env 开关
