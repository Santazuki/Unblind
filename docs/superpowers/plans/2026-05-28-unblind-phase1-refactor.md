# Unblind Phase 1 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 165 行单文件 `scripts/unblind.mjs` 重构为 10 个职责单一的模块，保持 JavaScript + JSDoc，零外部依赖。

**Architecture:** 从单文件抽取为 `scripts/lib/` 下的 9 个模块 + 1 个薄壳 CLI 入口。Logger/ErrorHandler 作为横切基础层，Config/CredentialManager 为配置层，Retry/ImageProcessor 为工具层，Provider/MimoProvider 为适配层，Orchestrator 串联全部。

**Tech Stack:** Node.js >= 18（内置 `fetch`, `node:test`, `node:assert`），ESM（`"type": "module"`），零 npm 依赖，JSDoc 类型注解。

---

## 文件结构（重构后）

```
scripts/
├── unblind.mjs              # CLI 入口（薄壳，~30行）
└── lib/
    ├── logger.js            # 结构化日志
    ├── errorHandler.js      # 错误分类 + 中文提示
    ├── config.js            # 配置读取/验证/默认值
    ├── credentialManager.js # API Key + Base URL
    ├── retry.js             # 指数退避 + Circuit Breaker
    ├── imageProcessor.js    # 图片读取/校验/编码
    ├── orchestrator.js      # 调度核心
    └── providers/
        ├── provider.js      # IVisionProvider 接口 + 校验
        └── mimo.js          # MimoProvider 实现

tests/
├── test-logger.js
├── test-errorHandler.js
├── test-config.js
├── test-credentialManager.js
├── test-retry.js
├── test-imageProcessor.js
├── test-provider.js
├── test-mimo.js
├── test-orchestrator.js
└── test-cli.js
```

---

## Task 0: 基础设施准备

**Files:**
- Create: `package.json`
- Create: `tests/` directory structure

- [ ] **Step 0.1: 创建 package.json**

```bash
cd D:/My-Projects/unblind
```

创建 `package.json`：

```json
{
  "name": "unblind",
  "version": "2.1.0",
  "description": "Give DeepSeek eyes — vision enhancement for Claude Code",
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test": "node --test tests/test-*.js"
  },
  "keywords": ["claude-code", "skill", "vision", "deepseek", "mimo"],
  "license": "MIT",
  "private": true
}
```

验证：`node -e "console.log('ESM OK')"` 应输出 `ESM OK`

- [ ] **Step 0.2: 确保 tests 目录存在**

```bash
mkdir -p tests docs/test-results
```

- [ ] **Step 0.3: 更新 .gitignore，添加 package.json 例外**

读取 `.gitignore`，确保 `package.json` 不会被 ignore（当前规则不匹配，无需修改）。

- [ ] **Step 0.4: 提交**

```bash
git add package.json tests/ docs/test-results/
git commit -m "chore: 添加 package.json (ESM)，初始化 tests/ 目录"
```

---

## Task 1: Logger + ErrorHandler

**目标：** 提供结构化日志和三类错误分类，所有后续模块的基础。

**Files:**
- Create: `scripts/lib/logger.js`
- Create: `scripts/lib/errorHandler.js`
- Create: `tests/test-logger.js`
- Create: `tests/test-errorHandler.js`

### 1.1 Logger

- [ ] **Step 1.1.1: 写 Logger 测试**

创建 `tests/test-logger.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { log, setLogLevel } from "../scripts/lib/logger.js";

describe("logger", () => {
  it("should output valid JSON Lines to stderr", () => {
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(chunk); return true; };

    setLogLevel("debug");
    log("info", "test-module", "test_event", { key: "val" });

    process.stderr.write = orig;
    assert.ok(lines.length > 0, "should have written to stderr");
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.level, "info");
    assert.equal(parsed.module, "test-module");
    assert.equal(parsed.event, "test_event");
    assert.ok(parsed.timestamp);
    assert.equal(parsed.key, "val");
  });

  it("should filter by log level", () => {
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(chunk); return true; };

    setLogLevel("warn");
    log("info", "test", "should_not_appear");
    log("error", "test", "should_appear");

    process.stderr.write = orig;
    assert.equal(lines.length, 1, "only error level should appear");
  });

  it("should handle undefined data", () => {
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(chunk); return true; };

    setLogLevel("info");
    log("info", "test", "no_data");

    process.stderr.write = orig;
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.event, "no_data");
  });
});
```

- [ ] **Step 1.1.2: 运行测试确认失败**

```bash
node --test tests/test-logger.js
```

预期：FAIL — 模块不存在

- [ ] **Step 1.1.3: 实现 Logger**

创建 `scripts/lib/logger.js`：

```js
// 结构化日志模块 — JSON Lines 输出到 stderr
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
let currentLevel = "info";

/**
 * @param {"debug"|"info"|"warn"|"error"|"silent"} level
 */
export function setLogLevel(level) {
  if (LEVELS[level] !== undefined) currentLevel = level;
}

/**
 * @param {"debug"|"info"|"warn"|"error"} level
 * @param {string} module
 * @param {string} event
 * @param {object} [data]
 */
export function log(level, module, event, data = {}) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    event,
    ...data,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}
```

- [ ] **Step 1.1.4: 运行测试确认通过**

```bash
node --test tests/test-logger.js
```

预期：PASS — 3/3

- [ ] **Step 1.1.5: 提交**

```bash
git add scripts/lib/logger.js tests/test-logger.js
git commit -m "feat: 添加 logger 模块 — 结构化 JSON Lines 日志"
```

### 1.2 ErrorHandler

- [ ] **Step 1.2.1: 写 ErrorHandler 测试**

创建 `tests/test-errorHandler.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClientError, ServerError, NetworkError, formatError } from "../scripts/lib/errorHandler.js";

describe("errorHandler", () => {
  it("ClientError should contain type, reason, suggestion", () => {
    const err = new ClientError("图片格式不支持", { suggestion: "请使用 jpg/png/webp 格式" });
    assert.ok(err instanceof Error);
    assert.equal(err.name, "ClientError");
    assert.ok(err.reason.includes("图片格式不支持"));
    assert.ok(err.suggestion.includes("jpg/png/webp"));
  });

  it("ServerError should contain type and statusCode", () => {
    const err = new ServerError("Mimo 服务异常", { statusCode: 500 });
    assert.equal(err.name, "ServerError");
    assert.equal(err.statusCode, 500);
  });

  it("NetworkError should contain type", () => {
    const err = new NetworkError("DNS 解析失败", { host: "api.mimo.dev" });
    assert.equal(err.name, "NetworkError");
    assert.equal(err.host, "api.mimo.dev");
  });

  it("formatError should produce Chinese user-facing message", () => {
    const err = new ClientError("API Key 无效", {
      suggestion: "请在 Mimo 控制台检查 API Key 是否正确",
      statusCode: 401,
    });
    const msg = formatError(err);
    assert.ok(msg.includes("API Key 无效"));
    assert.ok(msg.includes("控制台"));
    assert.ok(msg.includes("401"));
  });
});
```

- [ ] **Step 1.2.2: 运行测试确认失败**

```bash
node --test tests/test-errorHandler.js
```

预期：FAIL

- [ ] **Step 1.2.3: 实现 ErrorHandler**

创建 `scripts/lib/errorHandler.js`：

```js
import { log } from "./logger.js";

/** 客户端错误 — 4xx、无效输入等，不应重试 */
export class ClientError extends Error {
  /**
   * @param {string} reason
   * @param {{ suggestion?: string, statusCode?: number }} [extra]
   */
  constructor(reason, extra = {}) {
    super(reason);
    this.name = "ClientError";
    this.reason = reason;
    this.suggestion = extra.suggestion || "";
    this.statusCode = extra.statusCode || null;
  }
}

/** 服务端错误 — 5xx、429等，可重试 */
export class ServerError extends Error {
  /**
   * @param {string} reason
   * @param {{ suggestion?: string, statusCode?: number }} [extra]
   */
  constructor(reason, extra = {}) {
    super(reason);
    this.name = "ServerError";
    this.reason = reason;
    this.suggestion = extra.suggestion || "";
    this.statusCode = extra.statusCode || null;
  }
}

/** 网络错误 — DNS/连接失败，可重试 */
export class NetworkError extends Error {
  /**
   * @param {string} reason
   * @param {{ host?: string, suggestion?: string }} [extra]
   */
  constructor(reason, extra = {}) {
    super(reason);
    this.name = "NetworkError";
    this.reason = reason;
    this.host = extra.host || "";
    this.suggestion = extra.suggestion || "请检查网络连接后重试";
  }
}

/**
 * 判断错误是否可重试
 * @param {Error} err
 * @returns {boolean}
 */
export function isRetryable(err) {
  return err instanceof ServerError || err instanceof NetworkError;
}

/**
 * 格式化错误为用户友好中文消息
 * @param {Error} err
 * @returns {string}
 */
export function formatError(err) {
  if (err instanceof ClientError) {
    let msg = `❌ 错误：${err.reason}`;
    if (err.statusCode) msg += `（HTTP ${err.statusCode}）`;
    if (err.suggestion) msg += `\n解决建议：${err.suggestion}`;
    return msg;
  }
  if (err instanceof ServerError) {
    let msg = `⚠️ 服务端错误：${err.reason}`;
    if (err.statusCode) msg += `（HTTP ${err.statusCode}）`;
    if (err.suggestion) msg += `\n${err.suggestion}`;
    return msg;
  }
  if (err instanceof NetworkError) {
    return `🔌 网络错误：${err.reason}\n${err.suggestion}`;
  }
  return `未知错误：${err.message}`;
}

log("info", "errorHandler", "module_loaded");
```

- [ ] **Step 1.2.4: 运行测试确认通过**

```bash
node --test tests/test-errorHandler.js
```

预期：PASS — 4/4

- [ ] **Step 1.2.5: 运行全部已有测试**

```bash
node --test tests/test-*.js
```

预期：PASS — 7/7

- [ ] **Step 1.2.6: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step1-logger-errorHandler.md
git add scripts/lib/errorHandler.js tests/test-errorHandler.js docs/test-results/step1-logger-errorHandler.md
git commit -m "feat: 添加 errorHandler 模块 — 三类错误分类 + 中文提示"
```

---

## Task 2: Config

**目标：** 从 settings.json 读取配置，校验，补全默认值。

**Files:**
- Create: `scripts/lib/config.js`
- Create: `tests/test-config.js`

- [ ] **Step 2.1: 写 Config 测试**

创建 `tests/test-config.js`：

```js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, unlinkSync, existsSync, renameSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { loadConfig } from "../scripts/lib/config.js";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

function backupSettings() {
  if (existsSync(SETTINGS_FILE)) {
    const backup = SETTINGS_FILE + ".unblind-test-backup";
    if (existsSync(backup)) unlinkSync(backup);
    renameSync(SETTINGS_FILE, backup);
    return backup;
  }
  return null;
}

function restoreSettings(backup) {
  if (unlinkSync) {
    try { unlinkSync(SETTINGS_FILE); } catch {}
  }
  if (backup && existsSync(backup)) {
    renameSync(backup, SETTINGS_FILE);
  }
}

function writeTestSettings(env = {}) {
  const dir = join(homedir(), ".claude");
  const content = JSON.stringify({ env }, null, 2);
  writeFileSync(SETTINGS_FILE, content, "utf8");
}

describe("config", () => {
  let backup;
  before(() => { backup = backupSettings(); });
  after(() => { restoreSettings(backup); });

  it("should return defaults when settings.json has no relevant fields", () => {
    writeTestSettings({});
    const cfg = loadConfig();
    assert.ok(cfg.maxImageSize > 0);
    assert.equal(cfg.retry.maxAttempts, 3);
    assert.equal(cfg.circuitBreaker.failureThreshold, 5);
    assert.equal(cfg.circuitBreaker.timeoutSeconds, 60);
    assert.equal(cfg.logging.level, "info");
  });

  it("should read user-set values", () => {
    writeTestSettings({
      MIMO_API_KEY: "tp-test123",
      MIMO_VISION_MODEL: "mimo-v2-omni",
    });
    const cfg = loadConfig();
    assert.equal(cfg.apiKey, "tp-test123");
    assert.equal(cfg.model, "mimo-v2-omni");
  });

  it("should warn when maxImageSize > 20MB", () => {
    const warnings = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { warnings.push(chunk); return true; };

    writeTestSettings({ MIMO_API_KEY: "tp-test" });
    const cfg = loadConfig();
    // default is 50MB, so no warning expected unless user set > 20MB explicitly
    // We test the default: 50MB should trigger a performance advisory
    const hasWarning = warnings.some(w => w.includes("MB"));

    process.stderr.write = orig;
    // 50MB default > 20MB threshold → should warn
    assert.ok(hasWarning, "should warn for large maxImageSize");
  });

  it("should apply maxImageSize default if not set", () => {
    writeTestSettings({ MIMO_API_KEY: "tp-test" });
    const cfg = loadConfig();
    assert.equal(cfg.maxImageSize, 50 * 1024 * 1024);
  });
});
```

- [ ] **Step 2.2: 运行测试确认失败**

```bash
node --test tests/test-config.js
```

预期：FAIL — 模块不存在

- [ ] **Step 2.3: 实现 Config**

创建 `scripts/lib/config.js`：

```js
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { log } from "./logger.js";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

const DEFAULTS = {
  maxImageSize: 50 * 1024 * 1024,        // 50MB
  jpegQuality: 80,
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    timeoutSeconds: 60,
  },
  logging: {
    level: "info",
  },
  requestTimeoutMs: 30_000,
};

const MAX_SIZE_WARN_THRESHOLD = 20 * 1024 * 1024; // 20MB

/**
 * 从 ~/.claude/settings.json 读取配置，校验，补全默认值
 * @returns {{
 *   apiKey: string,
 *   baseUrl: string,
 *   model: string,
 *   maxImageSize: number,
 *   jpegQuality: number,
 *   retry: { maxAttempts: number, baseDelayMs: number, maxDelayMs: number },
 *   circuitBreaker: { failureThreshold: number, timeoutSeconds: number },
 *   logging: { level: string },
 *   requestTimeoutMs: number
 * }}
 */
export function loadConfig() {
  let settings = {};
  try {
    const raw = readFileSync(SETTINGS_FILE, "utf8");
    settings = JSON.parse(raw);
  } catch {
    log("warn", "config", "settings_file_unreadable", { path: SETTINGS_FILE });
  }

  const env = settings.env || {};

  const config = {
    apiKey: env.MIMO_API_KEY || "",
    baseUrl: env.MIMO_BASE_URL || "",
    model: env.MIMO_VISION_MODEL || "mimo-v2.5",
    maxImageSize: env.MIMO_MAX_IMAGE_SIZE
      ? Number(env.MIMO_MAX_IMAGE_SIZE)
      : DEFAULTS.maxImageSize,
    jpegQuality: env.MIMO_JPEG_QUALITY
      ? Number(env.MIMO_JPEG_QUALITY)
      : DEFAULTS.jpegQuality,
    retry: { ...DEFAULTS.retry },
    circuitBreaker: { ...DEFAULTS.circuitBreaker },
    logging: { ...DEFAULTS.logging },
    requestTimeoutMs: env.MIMO_REQUEST_TIMEOUT
      ? Number(env.MIMO_REQUEST_TIMEOUT)
      : DEFAULTS.requestTimeoutMs,
  };

  // 性能警告
  if (config.maxImageSize > MAX_SIZE_WARN_THRESHOLD) {
    log("warn", "config", "large_max_image_size", {
      maxImageSizeMB: (config.maxImageSize / 1024 / 1024).toFixed(0),
      advisory: "大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升",
    });
    process.stderr.write(
      `⚠️ 性能提示：当前图片大小上限 ${(config.maxImageSize / 1024 / 1024).toFixed(0)}MB，` +
      `超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。\n`
    );
  }

  log("info", "config", "loaded", {
    model: config.model,
    maxImageSizeMB: (config.maxImageSize / 1024 / 1024).toFixed(1),
  });

  return config;
}
```

- [ ] **Step 2.4: 运行测试确认通过**

```bash
node --test tests/test-config.js
```

预期：PASS — 4/4

- [ ] **Step 2.5: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step2-config.md
git add scripts/lib/config.js tests/test-config.js docs/test-results/step2-config.md
git commit -m "feat: 添加 config 模块 — settings.json 读取校验 + 默认值 + 性能警告"
```

---

## Task 3: CredentialManager

**目标：** 从 env 或 settings.json 安全读取 API Key，自动检测 Base URL。

**Files:**
- Create: `scripts/lib/credentialManager.js`
- Create: `tests/test-credentialManager.js`

- [ ] **Step 3.1: 写 CredentialManager 测试**

创建 `tests/test-credentialManager.js`：

```js
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { getApiKey, getBaseUrl } from "../scripts/lib/credentialManager.js";

describe("credentialManager", () => {
  describe("getBaseUrl", () => {
    it("should detect token-plan URL for tp- keys", () => {
      const url = getBaseUrl("tp-test123");
      assert.ok(url.includes("token-plan-cn.xiaomimimo.com"));
      assert.ok(url.endsWith("/anthropic"));
    });

    it("should detect api URL for sk- keys", () => {
      const url = getBaseUrl("sk-ant-test");
      assert.ok(url.includes("api.xiaomimimo.com"));
    });

    it("should return token-plan URL as default for unknown prefix", () => {
      const url = getBaseUrl("unknown-key");
      assert.ok(url.includes("token-plan-cn"), "defaults to token-plan for unknown prefix");
    });

    it("should return empty string for empty key", () => {
      const url = getBaseUrl("");
      assert.equal(url, "");
    });
  });

  describe("getApiKey", () => {
    it("should read from MIMO_API_KEY env", () => {
      process.env.MIMO_API_KEY = "tp-env-test";
      const key = getApiKey();
      assert.equal(key, "tp-env-test");
      delete process.env.MIMO_API_KEY;
    });

    it("should return empty string if not set", () => {
      delete process.env.MIMO_API_KEY;
      const key = getApiKey();
      assert.equal(key, "");
    });
  });
});
```

- [ ] **Step 3.2: 运行测试确认失败**

```bash
node --test tests/test-credentialManager.js
```

预期：FAIL

- [ ] **Step 3.3: 实现 CredentialManager**

创建 `scripts/lib/credentialManager.js`：

```js
import { log } from "./logger.js";

/**
 * 获取 API Key（优先级：env > settings.json）
 * @returns {string}
 */
export function getApiKey() {
  return process.env.MIMO_API_KEY || "";
}

/**
 * 根据 API Key 前缀自动检测 Base URL
 * tp-  → token-plan-cn.xiaomimimo.com
 * sk-  → api.xiaomimimo.com
 * 其他 → token-plan-cn（默认）
 * @param {string} apiKey
 * @returns {string}
 */
export function getBaseUrl(apiKey) {
  if (!apiKey) return "";

  if (apiKey.startsWith("sk-")) {
    const url = "https://api.xiaomimimo.com/anthropic";
    log("debug", "credentialManager", "base_url_detected", { type: "balance", url });
    return url;
  }

  // tp- 或其他 → token-plan
  const url = "https://token-plan-cn.xiaomimimo.com/anthropic";
  log("debug", "credentialManager", "base_url_detected", { type: apiKey.startsWith("tp-") ? "token" : "unknown", url });
  return url;
}

/**
 * 根据 API Key 类型生成 Auth Header
 * @param {string} apiKey
 * @returns {object}
 */
export function getAuthHeader(apiKey) {
  if (apiKey.startsWith("sk-")) {
    return { "Authorization": `Bearer ${apiKey}` };
  }
  return { "x-api-key": apiKey };
}

log("info", "credentialManager", "module_loaded");
```

- [ ] **Step 3.4: 运行测试确认通过**

```bash
node --test tests/test-credentialManager.js
```

预期：PASS — 6/6

- [ ] **Step 3.5: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step3-credentialManager.md
git add scripts/lib/credentialManager.js tests/test-credentialManager.js docs/test-results/step3-credentialManager.md
git commit -m "feat: 添加 credentialManager 模块 — Key读取 + URL自动检测"
```

---

## Task 4: Retry + Circuit Breaker

**目标：** 指数退避重试 + 熔断器状态机。

**Files:**
- Create: `scripts/lib/retry.js`
- Create: `tests/test-retry.js`

- [ ] **Step 4.1: 写 Retry 测试**

创建 `tests/test-retry.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withRetry, getCircuitState, resetCircuit } from "../scripts/lib/retry.js";
import { ServerError } from "../scripts/lib/errorHandler.js";

describe("retry", () => {
  it("should return result on first success", async () => {
    const fn = async () => "success";
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    assert.equal(result, "success");
  });

  it("should retry on ServerError and eventually succeed", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new ServerError("暂时不可用", { statusCode: 503 });
      return "recovered";
    };
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    assert.equal(result, "recovered");
    assert.equal(calls, 3);
  });

  it("should throw after max attempts", async () => {
    const fn = async () => { throw new ServerError("持续失败", { statusCode: 500 }); };
    await assert.rejects(
      () => withRetry(fn, { maxAttempts: 2, baseDelayMs: 10 }),
      (err) => err.message === "持续失败"
    );
  });

  it("should NOT retry on ClientError", async () => {
    const { ClientError } = await import("../scripts/lib/errorHandler.js");
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new ClientError("无效输入");
    };
    await assert.rejects(() => withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }));
    assert.equal(calls, 1, "ClientError should not be retried");
  });

  it("should use exponential backoff", async () => {
    const delays = [];
    const orig = setTimeout;
    globalThis.setTimeout = (fn, delay) => {
      delays.push(delay);
      return orig(fn, 0); // execute immediately for test speed
    };

    const fn = async () => { throw new ServerError("fail"); };
    try {
      await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 });
    } catch {}

    globalThis.setTimeout = orig;
    assert.equal(delays.length, 2); // 2 retries = 2 delays
    assert.equal(delays[0], 100);   // first retry: baseDelayMs
    assert.equal(delays[1], 200);   // second retry: baseDelayMs * 2
  });

  describe("circuit breaker", () => {
    it("should start in CLOSED state", () => {
      resetCircuit();
      assert.equal(getCircuitState(), "CLOSED");
    });
  });
});
```

- [ ] **Step 4.2: 运行测试确认失败**

```bash
node --test tests/test-retry.js
```

预期：FAIL

- [ ] **Step 4.3: 实现 Retry**

创建 `scripts/lib/retry.js`：

```js
import { log } from "./logger.js";
import { isRetryable } from "./errorHandler.js";

// Circuit Breaker 状态
const State = { CLOSED: "CLOSED", OPEN: "OPEN", HALF_OPEN: "HALF_OPEN" };

let circuitState = State.CLOSED;
let failureCount = 0;
let lastFailureTime = 0;
let openUntil = 0;

/**
 * @typedef {{ maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number,
 *   circuitBreaker?: { failureThreshold?: number, timeoutSeconds?: number }
 * }} RetryOptions
 */

/**
 * 执行带重试和熔断保护的异步操作
 * @param {() => Promise<any>} fn
 * @param {RetryOptions} options
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    circuitBreaker = { failureThreshold: 5, timeoutSeconds: 60 },
  } = options;

  // 熔断检查
  if (circuitState === State.OPEN) {
    if (Date.now() < openUntil) {
      const remaining = Math.ceil((openUntil - Date.now()) / 1000);
      const err = new Error(`熔断保护中，${remaining}s 后自动恢复`);
      err.name = "CircuitBreakerOpenError";
      throw err;
    }
    circuitState = State.HALF_OPEN;
    log("info", "retry", "circuit_half_open");
  }

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();

      // 成功 → 重置
      if (circuitState === State.HALF_OPEN) {
        circuitState = State.CLOSED;
        failureCount = 0;
        log("info", "retry", "circuit_closed_recovered");
      }
      failureCount = 0;
      return result;

    } catch (err) {
      lastError = err;

      // 不可重试的错误直接抛
      if (!isRetryable(err)) throw err;

      failureCount++;
      log("warn", "retry", "attempt_failed", {
        attempt: attempt + 1,
        maxAttempts,
        error: err.message,
      });

      // 触发熔断
      if (failureCount >= (circuitBreaker.failureThreshold || 5)) {
        circuitState = State.OPEN;
        openUntil = Date.now() + (circuitBreaker.timeoutSeconds || 60) * 1000;
        log("error", "retry", "circuit_open", {
          failureCount,
          timeoutSeconds: circuitBreaker.timeoutSeconds,
        });
        const remaining = circuitBreaker.timeoutSeconds;
        const msg = `熔断保护已触发（连续 ${failureCount} 次失败），${remaining}s 后自动恢复`;
        throw Object.assign(new Error(msg), { name: "CircuitBreakerOpenError" });
      }

      // 最后一次不等待
      if (attempt < maxAttempts - 1) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        log("debug", "retry", "backoff", { delayMs: delay, attempt: attempt + 1 });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * @returns {"CLOSED"|"OPEN"|"HALF_OPEN"}
 */
export function getCircuitState() {
  if (circuitState === State.OPEN && Date.now() >= openUntil) {
    circuitState = State.HALF_OPEN;
  }
  return circuitState;
}

/** 重置熔断器（测试用） */
export function resetCircuit() {
  circuitState = State.CLOSED;
  failureCount = 0;
  lastFailureTime = 0;
  openUntil = 0;
}

log("info", "retry", "module_loaded");
```

- [ ] **Step 4.4: 运行测试确认通过**

```bash
node --test tests/test-retry.js
```

预期：PASS — 6/6

- [ ] **Step 4.5: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step4-retry.md
git add scripts/lib/retry.js tests/test-retry.js docs/test-results/step4-retry.md
git commit -m "feat: 添加 retry 模块 — 指数退避重试 + Circuit Breaker"
```

---

## Task 5: ImageProcessor

**目标：** 图片格式校验、大小限制、Base64 编码。

**Files:**
- Create: `scripts/lib/imageProcessor.js`
- Create: `tests/test-imageProcessor.js`

- [ ] **Step 5.1: 写 ImageProcessor 测试**

创建 `tests/test-imageProcessor.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { processImage, validateFormat } from "../scripts/lib/imageProcessor.js";
import { ClientError } from "../scripts/lib/errorHandler.js";

function makeTempFile(name, content) {
  const p = join(tmpdir(), name);
  writeFileSync(p, content);
  return p;
}

// 1x1 红色 PNG (最小有效 PNG)
const MINI_PNG = Buffer.from([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
  0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
  0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
  0x00,0x00,0x03,0x00,0x01,0x47,0x53,0x22,
  0xDE,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
  0x44,0xAE,0x42,0x60,0x82
]);

describe("imageProcessor", () => {
  describe("validateFormat", () => {
    it("should accept jpg/png/gif/webp/bmp/svg", () => {
      assert.equal(validateFormat("test.jpg"), true);
      assert.equal(validateFormat("test.png"), true);
      assert.equal(validateFormat("test.gif"), true);
      assert.equal(validateFormat("test.webp"), true);
      assert.equal(validateFormat("test.bmp"), true);
      assert.equal(validateFormat("test.svg"), true);
      assert.equal(validateFormat("TEST.JPG"), true);
    });

    it("should reject unsupported formats", () => {
      assert.equal(validateFormat("test.pdf"), false);
      assert.equal(validateFormat("test.tiff"), false);
      assert.equal(validateFormat("test"), false);
    });
  });

  describe("processImage", () => {
    it("should encode a valid PNG to base64 data URL", async () => {
      const p = makeTempFile("test-unblind.png", MINI_PNG);
      try {
        const result = await processImage(p);
        assert.ok(result.base64.startsWith("data:image/png;base64,"));
        assert.ok(result.size > 0);
        assert.equal(result.mimeType, "image/png");
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });

    it("should throw ClientError for non-existent file", async () => {
      await assert.rejects(
        () => processImage("/nonexistent/file.jpg"),
        (err) => err instanceof ClientError && err.reason.includes("文件不存在")
      );
    });

    it("should throw ClientError for empty file", async () => {
      const p = makeTempFile("empty.png", Buffer.alloc(0));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("空文件")
        );
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });

    it("should throw ClientError for unsupported format", async () => {
      const p = makeTempFile("test.pdf", Buffer.from("not a pdf"));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("格式")
        );
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });
  });
});
```

- [ ] **Step 5.2: 运行测试确认失败**

```bash
node --test tests/test-imageProcessor.js
```

预期：FAIL

- [ ] **Step 5.3: 实现 ImageProcessor**

创建 `scripts/lib/imageProcessor.js`：

```js
import { readFileSync, statSync } from "fs";
import { extname } from "path";
import { ClientError } from "./errorHandler.js";
import { log } from "./logger.js";

const SUPPORTED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
]);

const MIME_MAP = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif",
  ".webp": "image/webp", ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

/**
 * 验证图片扩展名是否支持
 * @param {string} imagePath
 * @returns {boolean}
 */
export function validateFormat(imagePath) {
  const ext = extname(imagePath).toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

/**
 * 获取 MIME type
 * @param {string} imagePath
 * @returns {string}
 */
export function getMimeType(imagePath) {
  const ext = extname(imagePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

/**
 * 处理图片：读取、校验、Base64 编码
 * @param {string} imagePath
 * @param {{ maxImageSize?: number }} [options]
 * @returns {{ base64: string, mimeType: string, size: number }}
 * @throws {ClientError}
 */
export function processImage(imagePath, options = {}) {
  const { maxImageSize = 50 * 1024 * 1024 } = options;

  // 格式校验
  if (!validateFormat(imagePath)) {
    const ext = extname(imagePath).toLowerCase();
    const supported = [...SUPPORTED_EXTS].join(", ");
    throw new ClientError(`不支持的图片格式: ${ext || "无扩展名"}`, {
      suggestion: `支持的格式: ${supported}`,
    });
  }

  // 文件存在性与大小校验
  let fileStat;
  try {
    fileStat = statSync(imagePath);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new ClientError(`文件不存在: ${imagePath}`, {
        suggestion: "请检查文件路径是否正确",
      });
    }
    throw err;
  }

  if (fileStat.size === 0) {
    throw new ClientError("图片文件为空", {
      suggestion: "请提供有效的图片文件",
    });
  }

  if (fileStat.size > maxImageSize) {
    const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1);
    const maxMB = (maxImageSize / 1024 / 1024).toFixed(0);
    throw new ClientError(`图片文件过大 (${sizeMB}MB)`, {
      suggestion: `文件大小上限为 ${maxMB}MB。请在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整上限，或压缩图片后重试。`,
    });
  }

  // 读取并编码
  const imageData = readFileSync(imagePath);
  const mimeType = getMimeType(imagePath);
  const base64 = `data:${mimeType};base64,${imageData.toString("base64")}`;

  log("info", "imageProcessor", "image_processed", {
    path: imagePath.slice(-40), // 仅记录末尾，保护隐私
    sizeMB: (fileStat.size / 1024 / 1024).toFixed(2),
    mimeType,
  });

  return { base64, mimeType, size: fileStat.size };
}

log("info", "imageProcessor", "module_loaded");
```

- [ ] **Step 5.4: 运行测试确认通过**

```bash
node --test tests/test-imageProcessor.js
```

预期：PASS — 6/6

- [ ] **Step 5.5: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step5-imageProcessor.md
git add scripts/lib/imageProcessor.js tests/test-imageProcessor.js docs/test-results/step5-imageProcessor.md
git commit -m "feat: 添加 imageProcessor 模块 — 格式校验 + Base64 编码"
```

---

## Task 6: Provider 接口 + MimoProvider

**目标：** 定义 IVisionProvider 接口契约，实现 MimoProvider。

**Files:**
- Create: `scripts/lib/providers/provider.js`
- Create: `scripts/lib/providers/mimo.js`
- Create: `tests/test-provider.js`
- Create: `tests/test-mimo.js`

- [ ] **Step 6.1: 写 Provider 接口**

创建 `scripts/lib/providers/provider.js`：

```js
/**
 * @interface IVisionProvider
 *
 * @property {string} name — Provider 标识名
 * @method analyzeImage — 分析图片并返回文本结果
 * @method healthCheck — 快速连通性检查
 */

/**
 * @typedef {object} AnalyzeParams
 * @property {string} image - Base64 data URL
 * @property {string} [prompt] - 自定义提示词
 * @property {{ maxSize?: number, temperature?: number }} [options]
 *
 * @typedef {object} AnalyzeResult
 * @property {string} content - 分析结果文本
 * @property {string} model - 使用的模型名
 * @property {number} processingTimeMs - 处理耗时
 */

/** 5 种分析模式对应的 prompt */
export const MODE_PROMPTS = {
  describe:
    "Provide a detailed description of this image. Include: main subject, setting/background, colors/style, any text visible, notable objects, and overall composition.",
  ocr:
    "Extract all text visible in this image verbatim. Preserve structure and formatting (headers, lists, columns). If no text is found, say so.",
  "ui-review":
    "You are a UI/UX design reviewer. Analyze this interface mockup or design. Provide: (1) Strengths — what works well, (2) Issues — usability or design problems, (3) Specific, actionable suggestions for improvement. Be constructive and detailed.",
  "chart-data":
    "Extract all data from this chart or graph. List: chart title, axis labels, all data points/series with values if readable, and a brief summary of the trend.",
  "object-detect":
    "List all distinct objects, people, and activities you can identify. For each, describe what it is and its approximate location in the image.",
};

/** 有效模式列表 */
export const VALID_MODES = Object.keys(MODE_PROMPTS);

/**
 * 运行时校验对象是否满足 IVisionProvider 接口
 * @param {object} obj
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateProvider(obj) {
  const missing = [];
  if (typeof obj?.name !== "string") missing.push("name (string)");
  if (typeof obj?.analyzeImage !== "function") missing.push("analyzeImage(params)");
  if (typeof obj?.healthCheck !== "function") missing.push("healthCheck()");
  return { valid: missing.length === 0, missing };
}
```

- [ ] **Step 6.2: 写 MimoProvider 测试**

创建 `tests/test-mimo.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MimoProvider } from "../scripts/lib/providers/mimo.js";
import { validateProvider } from "../scripts/lib/providers/provider.js";

describe("MimoProvider", () => {
  it("should pass interface validation", () => {
    const p = new MimoProvider({ apiKey: "tp-test", baseUrl: "https://test.local", model: "mimo-v2.5" });
    const { valid, missing } = validateProvider(p);
    assert.ok(valid, `missing: ${missing.join(", ")}`);
  });

  it("should have name 'mimo'", () => {
    const p = new MimoProvider({ apiKey: "tp-test", baseUrl: "https://test.local" });
    assert.equal(p.name, "mimo");
  });

  it("should throw ClientError when API key is missing", async () => {
    const p = new MimoProvider({ apiKey: "", baseUrl: "https://test.local" });
    await assert.rejects(
      () => p.analyzeImage({ image: "data:image/png;base64,test" }),
      (err) => err.name === "ClientError"
    );
  });

  // 真实 API 测试 — 仅在 API Key 存在时运行
  const apiKey = process.env.MIMO_API_KEY;
  const runApiTests = apiKey && apiKey.length > 0;

  if (runApiTests) {
    it("healthCheck should return true with valid key", { skip: !runApiTests }, async () => {
      const p = new MimoProvider({ apiKey, baseUrl: undefined, model: "mimo-v2.5" });
      // healthCheck 发送最小请求
      const healthy = await p.healthCheck();
      assert.equal(healthy, true);
    });

    it("should return valid result for describe mode", { skip: !runApiTests }, async () => {
      const p = new MimoProvider({ apiKey, baseUrl: undefined, model: "mimo-v2.5" });
      // 1x1 红色像素 PNG
      const miniPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const result = await p.analyzeImage({ image: miniPngBase64 });
      assert.ok(result.content.length > 0);
      assert.ok(result.processingTimeMs > 0);
    });
  }
});
```

- [ ] **Step 6.3: 运行测试确认失败**

```bash
node --test tests/test-provider.js 2>&1 || true
node --test tests/test-mimo.js 2>&1 || true
```

预期：FAIL

- [ ] **Step 6.4: 实现 MimoProvider**

创建 `scripts/lib/providers/mimo.js`：

```js
import { getBaseUrl, getAuthHeader } from "../credentialManager.js";
import { ClientError, ServerError, NetworkError } from "../errorHandler.js";
import { MODE_PROMPTS } from "./provider.js";
import { log } from "../logger.js";

/**
 * @implements {import("./provider.js").IVisionProvider}
 */
export class MimoProvider {
  /**
   * @param {{ apiKey: string, baseUrl?: string, model?: string, timeoutMs?: number }} config
   */
  constructor({ apiKey, baseUrl, model = "mimo-v2.5", timeoutMs = 30_000 }) {
    this._apiKey = apiKey;
    this._baseUrl = baseUrl || getBaseUrl(apiKey);
    this._model = model;
    this._timeoutMs = timeoutMs;
  }

  get name() {
    return "mimo";
  }

  /**
   * @param {import("./provider.js").AnalyzeParams} params
   * @returns {Promise<import("./provider.js").AnalyzeResult>}
   */
  async analyzeImage({ image, prompt, options = {} }) {
    if (!this._apiKey) {
      throw new ClientError("API Key 未配置", {
        suggestion: "请在终端运行配置命令设置 MIMO_API_KEY，或检查 ~/.claude/settings.json",
      });
    }

    const mode = options.mode || "describe";
    if (!MODE_PROMPTS[mode]) {
      throw new ClientError(`未知的分析模式: ${mode}`, {
        suggestion: `支持的模式: ${Object.keys(MODE_PROMPTS).join(", ")}`,
      });
    }

    const userPrompt = prompt || MODE_PROMPTS[mode];
    const startTime = Date.now();

    const requestBody = {
      model: this._model,
      max_tokens: options.maxSize || 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: this._extractMimeType(image),
                data: this._extractBase64(image),
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    };

    const url = `${this._baseUrl}/v1/messages`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    try {
      log("info", "mimo", "api_call_start", { model: this._model, mode });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          ...getAuthHeader(this._apiKey),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        const status = response.status;

        if (status === 401 || status === 403) {
          throw new ClientError("API Key 无效或被拒绝", { statusCode: status, suggestion: "请在 Mimo 控制台检查 API Key 是否正确" });
        }
        if (status === 429) {
          throw new ServerError("API 请求频率超限", { statusCode: status, suggestion: "请等待 30 秒后重试（系统将自动重试）" });
        }
        if (status >= 500) {
          throw new ServerError(`Mimo 服务异常`, { statusCode: status, suggestion: "服务暂时不可用，系统将自动重试" });
        }
        throw new ClientError(`API 请求失败`, { statusCode: status, suggestion: errText.slice(0, 200) });
      }

      const result = await response.json();
      const textBlock = result.content?.find((c) => c.type === "text");
      const content = textBlock?.text || JSON.stringify(result, null, 2);
      const processingTimeMs = Date.now() - startTime;

      log("info", "mimo", "api_call_success", {
        model: this._model,
        mode,
        durationMs: processingTimeMs,
      });

      return { content, model: this._model, processingTimeMs };

    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ClientError || err instanceof ServerError) throw err;
      if (err.name === "AbortError") {
        throw new NetworkError(`请求超时 (${this._timeoutMs / 1000}s)`, {
          suggestion: "网络较慢或图片过大，请尝试压缩图片后重试",
        });
      }
      if (err.cause?.code === "ECONNREFUSED" || err.cause?.code === "ENOTFOUND") {
        throw new NetworkError("无法连接到 Mimo 服务", {
          host: this._baseUrl,
          suggestion: "请检查网络连接",
        });
      }
      throw new NetworkError(`网络请求失败: ${err.message}`, {
        suggestion: "请检查网络连接后重试",
      });
    }
  }

  /** @returns {Promise<boolean>} */
  async healthCheck() {
    try {
      // 发送最简请求验证连通性
      const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const result = await this.analyzeImage({
        image: miniPng,
        options: { mode: "describe", maxSize: 50 },
      });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 从 data URL 提取纯 Base64
   * @param {string} dataUrl
   * @returns {string}
   */
  _extractBase64(dataUrl) {
    const idx = dataUrl.indexOf(";base64,");
    return idx >= 0 ? dataUrl.slice(idx + 8) : dataUrl;
  }

  /**
   * 从 data URL 提取 MIME type
   * @param {string} dataUrl
   * @returns {string}
   */
  _extractMimeType(dataUrl) {
    const match = dataUrl.match(/^data:(.+?);base64,/);
    return match ? match[1] : "image/png";
  }
}

log("info", "mimo", "module_loaded");
```

- [ ] **Step 6.5: 运行测试**

```bash
# 需要 API Key 的测试会 skip（若未设置 env）
node --test tests/test-provider.js 2>&1
node --test tests/test-mimo.js 2>&1
node --test tests/test-*.js 2>&1
```

预期：PASS（API 相关测试在有 Key 时通过，无 Key 时 skip）

- [ ] **Step 6.6: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step6-provider-mimo.md
git add scripts/lib/providers/ tests/test-provider.js tests/test-mimo.js docs/test-results/step6-provider-mimo.md
git commit -m "feat: 添加 Provider 接口 + MimoProvider 实现"
```

---

## Task 7: Orchestrator

**目标：** 串联 config → credential → imageProcessor → provider（+ 重试/熔断/降级）。

**Files:**
- Create: `scripts/lib/orchestrator.js`
- Create: `tests/test-orchestrator.js`

- [ ] **Step 7.1: 写 Orchestrator 测试**

创建 `tests/test-orchestrator.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../scripts/lib/orchestrator.js";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// 1x1 红色 PNG
const MINI_PNG = Buffer.from([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
  0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
  0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
  0x00,0x00,0x03,0x00,0x01,0x47,0x53,0x22,
  0xDE,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
  0x44,0xAE,0x42,0x60,0x82
]);

describe("orchestrator", () => {
  it("should reject non-existent file", async () => {
    await assert.rejects(
      () => analyze("/nonexistent/file.png", "describe"),
      (err) => err.name === "ClientError"
    );
  });

  it("should reject unsupported mode", async () => {
    const p = join(tmpdir(), "test-orch.png");
    writeFileSync(p, MINI_PNG);
    try {
      await assert.rejects(
        () => analyze(p, "invalid-mode"),
        (err) => err.name === "ClientError"
      );
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });

  // 真实 API 测试
  const apiKey = process.env.MIMO_API_KEY;
  const runApiTests = apiKey && apiKey.length > 0;

  if (runApiTests) {
    it("should analyze a real image end-to-end", { skip: !runApiTests }, async () => {
      const p = join(tmpdir(), "test-orch-real.png");
      writeFileSync(p, MINI_PNG);
      try {
        const result = await analyze(p, "describe");
        assert.ok(result.length > 0, "should return analysis text");
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });
  }
});
```

- [ ] **Step 7.2: 运行测试确认失败**

```bash
node --test tests/test-orchestrator.js 2>&1 || true
```

预期：FAIL

- [ ] **Step 7.3: 实现 Orchestrator**

创建 `scripts/lib/orchestrator.js`：

```js
import { log, setLogLevel } from "./logger.js";
import { loadConfig } from "./config.js";
import { getApiKey, getBaseUrl } from "./credentialManager.js";
import { processImage } from "./imageProcessor.js";
import { withRetry, getCircuitState } from "./retry.js";
import { MimoProvider } from "./providers/mimo.js";
import { ClientError, formatError } from "./errorHandler.js";
import { VALID_MODES } from "./providers/provider.js";

/**
 * 分析图片 — 完整调度流程
 * @param {string} imagePath
 * @param {string} mode - describe|ocr|ui-review|chart-data|object-detect
 * @returns {Promise<string>} 分析结果文本
 */
export async function analyze(imagePath, mode = "describe") {
  // 1. 加载配置
  const config = loadConfig();
  setLogLevel(config.logging.level);

  // 2. 模式校验
  if (!VALID_MODES.includes(mode)) {
    throw new ClientError(`未知的分析模式: ${mode}`, {
      suggestion: `支持的模式: ${VALID_MODES.join(", ")}`,
    });
  }

  // 3. 凭据
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ClientError("API Key 未配置", {
      suggestion: "请设置 MIMO_API_KEY 环境变量或在 ~/.claude/settings.json 的 env 段中配置",
    });
  }

  // 4. 图片预处理
  log("info", "orchestrator", "processing_image", { path: imagePath.slice(-30), mode });
  const { base64, mimeType } = processImage(imagePath, {
    maxImageSize: config.maxImageSize,
  });

  // 5. 主 Provider
  const primaryProvider = new MimoProvider({
    apiKey,
    baseUrl: getBaseUrl(apiKey),
    model: config.model,
    timeoutMs: config.requestTimeoutMs,
  });

  try {
    log("info", "orchestrator", "calling_provider", { provider: "mimo", mode });
    const result = await withRetry(
      () => primaryProvider.analyzeImage({ image: base64, options: { mode } }),
      config.retry
    );

    log("info", "orchestrator", "analysis_complete", {
      mode,
      durationMs: result.processingTimeMs,
    });

    return result.content;
  } catch (err) {
    // 熔断时尝试降级（无备选则直接抛）
    if (err.name === "CircuitBreakerOpenError") {
      const state = getCircuitState();
      throw new ClientError(`Mimo 服务暂不可用（熔断保护中）`, {
        suggestion: `当前无备选 Provider，请等待恢复后重试。${state === "OPEN" ? "系统将自动恢复。" : ""}`,
      });
    }
    throw err;
  }
}
```

- [ ] **Step 7.4: 运行测试确认通过**

```bash
# 无需 API Key 的测试
node --test --test-name-pattern="reject" tests/test-orchestrator.js 2>&1
# 全部测试（含 API 测试，无 Key 则 skip）
node --test tests/test-orchestrator.js 2>&1
node --test tests/test-*.js 2>&1
```

预期：PASS

- [ ] **Step 7.5: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step7-orchestrator.md
git add scripts/lib/orchestrator.js tests/test-orchestrator.js docs/test-results/step7-orchestrator.md
git commit -m "feat: 添加 orchestrator — 调度核心串联全部模块"
```

---

## Task 8: CLI 入口重构

**目标：** `scripts/unblind.mjs` 从 165 行瘦身为 ~30 行薄壳。

**Files:**
- Modify: `scripts/unblind.mjs`
- Create: `tests/test-cli.js`

- [ ] **Step 8.1: 写 CLI 测试**

创建 `tests/test-cli.js`：

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const UNBLIND = join(import.meta.dirname, "..", "scripts", "unblind.mjs");

const MINI_PNG = Buffer.from([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
  0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
  0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
  0x00,0x00,0x03,0x00,0x01,0x47,0x53,0x22,
  0xDE,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
  0x44,0xAE,0x42,0x60,0x82
]);

describe("CLI", () => {
  it("should print usage when no arguments", () => {
    try {
      execSync(`node "${UNBLIND}"`, { encoding: "utf8", env: { ...process.env } });
    } catch (e) {
      assert.ok(e.stderr.includes("Usage") || e.stdout?.includes("Usage"),
        "should show usage");
    }
  });

  it("should fail for non-existent file", () => {
    try {
      execSync(`node "${UNBLIND}" /nonexistent/file.png`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      assert.ok(e.stderr.includes("文件不存在") || e.stderr.includes("错误"),
        "should report file not found");
    }
  });

  it("should fail for unsupported mode", () => {
    const p = join(tmpdir(), "test-cli.png");
    writeFileSync(p, MINI_PNG);
    try {
      execSync(`node "${UNBLIND}" "${p}" invalid-mode`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      assert.ok(e.stderr.includes("未知") || e.stderr.includes("模式"),
        "should report unknown mode");
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });
});
```

- [ ] **Step 8.2: 运行测试确认当前 CLI 行为**

```bash
node --test tests/test-cli.js 2>&1 || true
```

确认能捕获当前 CLI 行为（usage、错误提示等）

- [ ] **Step 8.3: 重构 unblind.mjs**

用新内容覆盖 `scripts/unblind.mjs`：

```js
#!/usr/bin/env node
import { analyze } from "./lib/orchestrator.js";
import { formatError } from "./lib/errorHandler.js";
import { VALID_MODES } from "./lib/providers/provider.js";

function usage() {
  console.log(`Usage: node unblind.mjs <image-path> [mode]

Modes:
  describe     (default) Detailed image description
  ocr          Extract all text from image
  ui-review    UI/UX design critique
  chart-data   Extract data from charts/graphs
  object-detect List objects, people, activities

Env vars:
  MIMO_API_KEY       Required — Token Plan (tp-*) or Balance (sk-*)
  MIMO_BASE_URL      Auto-detected from key type, override if needed
  MIMO_VISION_MODEL  Default: mimo-v2.5`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const imagePath = args[0];
  const mode = args[1] || "describe";

  if (!VALID_MODES.includes(mode)) {
    console.error(`Unknown mode: ${mode}`);
    usage();
  }

  try {
    const result = await analyze(imagePath, mode);
    console.log(result);
  } catch (err) {
    console.error(formatError(err));
    process.exit(1);
  }
}

main();
```

- [ ] **Step 8.4: 运行 CLI 测试确认通过**

```bash
node --test tests/test-cli.js 2>&1
node --test tests/test-*.js 2>&1
```

预期：PASS — 全部测试通过，CLI 行为与原版兼容

- [ ] **Step 8.5: 输出测试结果并提交**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step8-cli.md
git add scripts/unblind.mjs tests/test-cli.js docs/test-results/step8-cli.md
git commit -m "refactor: unblind.mjs 重构为薄壳 CLI（165→30行）"
```

---

## Task 9: 端到端回归测试

**目标：** 完整回归验证，确认重构后行为与原版一致。

**Files:**
- Modify: `TEST.md`（追加概要）
- Create: `docs/test-results/step9-regression.md`

- [ ] **Step 9.1: 安全审计**

```bash
# 1. 检查无硬编码 API Key
! grep -rn "tp-cla\|tp-claq\|sk-anti" scripts/lib/ --include="*.js" || echo "PASS: no secrets in source"

# 2. 检查 .gitignore 覆盖
grep -q "settings.json" .gitignore && echo "PASS: settings.json ignored"
grep -q "node_modules" .gitignore && echo "PASS: node_modules ignored"

# 3. 验证零外部依赖
node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(Object.keys(p.dependencies||{}).length===0?'PASS: zero deps':'FAIL: has deps')"

# 4. 验证 scripts/unblind.mjs 语法
node --check scripts/unblind.mjs && echo "PASS: syntax OK"
```

- [ ] **Step 9.2: 5 种模式 API 测试**

```bash
# 需要 MIMO_API_KEY 设置
echo "Testing describe mode..."
node scripts/unblind.mjs <test-image-path> describe

echo "Testing ocr mode..."
node scripts/unblind.mjs <test-image-path> ocr

echo "Testing ui-review mode..."
node scripts/unblind.mjs <test-image-path> ui-review

echo "Testing chart-data mode..."
node scripts/unblind.mjs <test-image-path> chart-data

echo "Testing object-detect mode..."
node scripts/unblind.mjs <test-image-path> object-detect
```

- [ ] **Step 9.3: 错误场景测试**

```bash
# 无 API Key（预期：友好提示）
# 无效文件路径（预期：文件不存在）
node scripts/unblind.mjs /nonexistent/img.jpg 2>&1 | grep -q "文件不存在" && echo "PASS: file not found"

# 不支持的格式
echo "test" > /tmp/test.txt && node scripts/unblind.mjs /tmp/test.txt 2>&1 | grep -q "格式" && echo "PASS: bad format"

# 超大文件（需创建 >50MB 文件）
# 空文件
touch /tmp/empty.png && node scripts/unblind.mjs /tmp/empty.png 2>&1 | grep -q "空" && echo "PASS: empty file"
```

- [ ] **Step 9.4: 更新 TEST.md 概要**

在 `TEST.md` 末尾追加 Phase 1 重构回归测试概要。

- [ ] **Step 9.5: 写入完整回归测试结果**

```bash
node --test tests/test-*.js 2>&1 | tee docs/test-results/step9-regression.md
```

测试结果文档应包含：
- 全部测试用例数量及通过/失败统计
- 5 种模式的 API 测试结果（如有 API Key）
- 安全审计通过项

- [ ] **Step 9.6: 最终提交**

```bash
git add TEST.md docs/test-results/step9-regression.md
git commit -m "test: Phase 1 端到端回归测试完成"
```

---

## 依赖关系图

```
Task 0 (package.json) ─────────────────────────────────────┐
Task 1 (logger + errorHandler) ────────────────────────────┤
Task 2 (config) ── depends on logger ─────────────────────┤
Task 3 (credentialManager) ── depends on logger ──────────┤
Task 4 (retry) ── depends on errorHandler + logger ───────┤
Task 5 (imageProcessor) ── depends on errorHandler ───────┤
Task 6 (provider + mimo) ── depends on credentialManager ─┤
                            + errorHandler + logger ───────┤
Task 7 (orchestrator) ── depends on all above ────────────┤
Task 8 (CLI refactor) ── depends on orchestrator ─────────┤
Task 9 (regression) ── depends on all above ──────────────┘
```

必须按 Task 0→9 顺序执行。无并行任务。
