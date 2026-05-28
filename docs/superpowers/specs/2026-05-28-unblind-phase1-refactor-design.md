# Unblind Phase 1 重构设计规格

> 日期：2026-05-28 | 状态：待实现 | 遵循 Karpathy Guidelines

## 一、目标

将当前 165 行单文件 `scripts/unblind.mjs` 重构为 10 个职责单一的模块，保持 JavaScript + JSDoc，零依赖，Skill 身份不变。

## 二、模块架构

```
scripts/
├── unblind.mjs                    # CLI 入口（薄壳）：参数解析 → 调 orchestrator
└── lib/
    ├── logger.js                  # 结构化日志（JSON Lines）
    ├── errorHandler.js            # 错误分类（客户端/服务端/网络）+ 中文友好提示
    ├── config.js                  # 配置读取/验证/默认值补全
    ├── credentialManager.js       # API Key 安全读取（env → settings.json）
    ├── retry.js                   # 指数退避重试 + Circuit Breaker
    ├── imageProcessor.js          # 格式校验 + 大小限制 + Base64 编码 + 尺寸压缩
    ├── orchestrator.js            # 调度核心：选 Provider → 预处理 → 调用 → 后处理
    └── providers/
        ├── provider.js            # IVisionProvider 接口（JSDoc 契约 + 运行时校验）
        └── mimo.js                # MimoProvider 实现
```

## 三、模块职责与接口

### 3.1 Logger (`lib/logger.js`)

输出 JSON Lines 到 stderr（stdout 保留给分析结果）。

```js
/**
 * @param {"debug"|"info"|"warn"|"error"} level
 * @param {string} module - 模块名
 * @param {string} event - 事件名
 * @param {object} [data] - 附加字段
 */
function log(level, module, event, data) {}
```

日志格式：`{"timestamp":"ISO8601","level":"info","module":"mimo","event":"api_call","durationMs":234}`

### 3.2 ErrorHandler (`lib/errorHandler.js`)

三类错误：
- `ClientError` — 4xx、无效 API Key、格式不支持 → 立即失败，提示用户修改
- `ServerError` — 5xx、429 → 触发重试
- `NetworkError` — DNS/连接失败 → 重试 + 最终降级

每个错误包含：类型、原因（中文）、解决建议。

### 3.3 Config (`lib/config.js`)

```js
/**
 * 从 ~/.claude/settings.json 读取配置，校验，补全默认值
 * @returns {{ apiKey, baseUrl, model, maxImageSize, jpegQuality, 
 *             retry: {maxAttempts, baseDelayMs, maxDelayMs},
 *             circuitBreaker: {failureThreshold, timeoutSeconds},
 *             logging: {level} }}
 */
function loadConfig() {}
```

- `maxImageSize` 可由用户在 settings.json 覆写
- 若用户设置 > 20MB，打印性能警告
- 缺字段用默认值

### 3.4 CredentialManager (`lib/credentialManager.js`)

```js
/** @returns {string} API Key（从 env 或 settings.json 读取） */
function getApiKey() {}

/** @returns {string} API Base URL（auto-detect from key prefix） */
function getBaseUrl() {}
```

### 3.5 Retry (`lib/retry.js`)

指数退避：1s → 2s → 4s（可配置），最大重试 3 次。

Circuit Breaker 状态机：
```
CLOSED → (失败>=阈值) → OPEN → (冷却后) → HALF-OPEN → (成功) → CLOSED
```

```js
/** 执行带重试和熔断保护的异步操作 */
async function withRetry(fn, options) {}

/** 获取当前熔断器状态 */
function getCircuitState() {}
```

熔断触发时：
- 有备选 Provider → 自动切换，告知用户："Mimo 暂不可用（熔断保护），已自动切换到 <备选名称>。"
- 无备选 → 报错："Mimo 服务暂不可用，请稍后重试（熔断保护中，<N>s 后自动恢复）。"

### 3.6 ImageProcessor (`lib/imageProcessor.js`)

```js
/**
 * @param {string} imagePath
 * @returns {{ base64, mimeType, hash, size }} 编码后的图片数据
 * @throws {ClientError} 格式不支持、文件过大、文件不存在
 */
function processImage(imagePath) {}
```

- 支持扩展名：.jpg/.jpeg/.png/.gif/.webp/.bmp/.svg
- 文件大小上限：默认 50MB（可配置，>20MB 警告）
- 空文件检测
- 长边缩放至 1024px（保留宽高比）
- JPEG 质量 80%
- 输出 Base64 data URL

### 3.7 Provider 接口 (`lib/providers/provider.js`)

```js
/**
 * @interface IVisionProvider
 */
/** @type {string} */ IVisionProvider.name;
/** @type {(params: AnalyzeParams) => Promise<AnalyzeResult>} */ IVisionProvider.analyzeImage;
/** @type {() => Promise<boolean>} */ IVisionProvider.healthCheck;

/**
 * @typedef {object} AnalyzeParams
 * @property {string} image - Base64 data URL
 * @property {string} [prompt] - 自定义提示词
 * @property {{ maxSize?: number, temperature?: number }} [options]
 *
 * @typedef {object} AnalyzeResult
 * @property {string} content - 分析结果文本
 * @property {string} model - 使用的模型名
 * @property {number} processingTimeMs
 */
```

### 3.8 MimoProvider (`lib/providers/mimo.js`)

```js
/** @implements {IVisionProvider} */
class MimoProvider {
  get name() { return "mimo"; }
  async analyzeImage(params) { /* Mimo Anthropic-compatible API 调用 */ }
  async healthCheck() { /* 发送最小请求，返回 boolean */ }
}
```

5 种模式 prompt（与当前 `unblind.mjs` 完全一致）：
describe / ocr / ui-review / chart-data / object-detect

### 3.9 Orchestrator (`lib/orchestrator.js`)

```js
/**
 * @param {string} imagePath
 * @param {string} mode - describe|ocr|ui-review|chart-data|object-detect
 * @returns {Promise<string>} 分析结果文本
 */
async function analyze(imagePath, mode) {}
```

调度流程：config 加载 → imageProcessor 预处理 → 主 Provider 调用（带重试/熔断）→ 失败则降级备选 → 返回结果。

### 3.10 CLI 入口 (`scripts/unblind.mjs`)

重构后仅为薄壳：
```js
// 1. 解析 CLI 参数（<image-path> <mode>）
// 2. 调用 orchestrator.analyze(imagePath, mode)
// 3. 输出结果到 stdout，错误到 stderr
// 4. 退出码：0 成功，1 失败
```

命令行行为与重构前完全一致，向后兼容。

## 四、增量步骤与验收标准

### Step 1: Logger + ErrorHandler
- [ ] `log()` 输出合法 JSON Lines 到 stderr
- [ ] `level` 过滤生效（debug < info < warn < error）
- [ ] ClientError / ServerError / NetworkError 三类各自包含中文原因+建议
- **验证**：`node -e` 直接调用各函数，检查 stderr 输出

### Step 2: Config
- [ ] 从 `~/.claude/settings.json` 正确读取
- [ ] 缺失字段自动补全默认值
- [ ] `maxImageSize > 20MB` 时打印性能警告
- **验证**：临时修改 settings.json 各字段，确认读取和默认值行为

### Step 3: CredentialManager
- [ ] `getApiKey()` 从 `MIMO_API_KEY` env 正确读取
- [ ] `getBaseUrl()` 自动根据 key 前缀检测（tp- / sk-）
- [ ] Key 为空时抛出 ClientError
- **验证**：设置/取消 env 变量，确认读取和错误抛出

### Step 4: Retry
- [ ] 指数退避：1s → 2s → 4s（可配置）
- [ ] 达到 maxAttempts 后抛错
- [ ] Circuit Breaker：连续失败 5 次 → OPEN → 60s 冷却 → HALF-OPEN
- [ ] HALF-OPEN 首次成功 → CLOSED；失败 → 回 OPEN
- **验证**：模拟失败函数，计时确认退避间隔和熔断行为

### Step 5: ImageProcessor
- [ ] 支持的所有格式正确识别
- [ ] 超大文件/空文件/不存在文件 → 抛出 ClientError
- [ ] Base64 编码正确（含 MIME type data URL）
- [ ] 长边缩放至 ≤1024px，保留宽高比
- [ ] JPEG 质量 80%
- **验证**：用已知尺寸的测试图片，检查输出尺寸和编码

### Step 6: Provider 接口 + MimoProvider
- [ ] `provider.js` 提供接口校验函数，运行时检查实现完整性
- [ ] `MimoProvider.analyzeImage()` — 5 种模式全部返回有效结果
- [ ] `MimoProvider.healthCheck()` — 返回 `true/false`
- [ ] API Key 错误 → 抛出 ClientError
- [ ] 429 → 抛出 ServerError（触发上游重试）
- **验证**：真实 API 调用测试图片，5 种模式各一次

### Step 7: Orchestrator
- [ ] `analyze(imagePath, mode)` 端到端可用
- [ ] 正确串联 config → imageProcessor → provider → 结果
- [ ] 主 Provider 失败时尝试备选（若配置）
- **验证**：与当前 `unblind.mjs` 对同一图片输出相同结果

### Step 8: CLI 入口重构
- [ ] `scripts/unblind.mjs` 变为薄壳（参数解析 + 调 orchestrator）
- [ ] CLI 行为与重构前 100% 兼容
- [ ] 错误信息干净（无堆栈追踪到用户）
- **验证**：比较重构前后 CLI 输出（正常/错误场景）

### Step 9: 端到端回归
- [ ] 5 种模式各 1 张测试图片，输出与原版一致
- [ ] 错误场景：无效 API Key、超大文件、不支持的格式、网络超时
- [ ] 安全审计：命令注入防护、Key 不出现在输出中
- [ ] 输出到 `docs/test-results/step9-regression.md`

## 五、关键设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| 语言 | JavaScript + JSDoc | 零构建，Skill 即用 |
| 配置值可覆写 | settings.json 允许覆盖 | 用户可按需调整 |
| 大配置值警告 | >20MB 时打印性能提示 | 避免用户无意中影响体验 |
| 熔断降级 | 有备选自动切换+告知；无备选报错+倒计时 | 透明切换，用户始终知情 |
| healthCheck | 简单 boolean | 不做监控扩展，保持单一职责 |
| Skill 身份 | 不变 — SKILL.md 仍是唯一入口 | 内部重构不影响 Claude Code 接口 |

## 六、不变项

- CLI 命令格式：`node scripts/unblind.mjs <image> <mode>`
- 环境变量：`MIMO_API_KEY`、`MIMO_BASE_URL`、`MIMO_VISION_MODEL`
- 输出格式：stdout 纯文本结果，stderr 错误
- 零外部依赖（仅 Node.js >= 18 内置模块）
- SKILL.md 作为 Skill 入口，按需加载
