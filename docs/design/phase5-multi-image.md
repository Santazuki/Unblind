# Phase 5: 多图对比 (Multi-Image Comparison)

> 为 Unblind 添加多图输入与对比分析能力。单次 API 调用，零 Provider 接口破坏。

---

## 1. 问题

当前 Unblind 每次只能分析一张图片。用户无法在一次操作中对比多张图片（如设计稿 A vs B、两张截图找差异、多张图表对比趋势）。

### 约束

- 零 npm 依赖，零编译
- 不改 Provider 接口签名 — `analyzeImage({ image, prompt, options })` 的 `image` 字段保持单字符串向后兼容
- 不改 `tryChain` 链式调用逻辑
- 缓存机制支持多图 key

---

## 2. CLI 格式

```
node unblind.mjs <path> [path...] [mode]
```

### 示例

```bash
# 两张图对比
node unblind.mjs mockup-v1.png mockup-v2.png compare

# 三张图对比（默认 mode = describe）
node unblind.mjs img1.png img2.png img3.png

# 向后兼容 — 单图单模式
node unblind.mjs screenshot.png ocr

# 多图 + 跳过缓存
node unblind.mjs a.png b.png c.png compare --no-cache
```

### 解析规则

所有非 `--` 开头的参数视为位置参数。

```
positional = args.filter(a => !a.startsWith("--"))

if VALID_MODES.includes(last(positional)):
    mode = last(positional)
    paths = positional[0..-2]
else:
    mode = config.defaultMode || "describe"
    paths = positional  # all positional args are paths
```

这样单图调用完全不动，多图时最后一个已知模式名自动识别。

### 提示信息更新

`usage()` 增加多图用法提示：

```
  node unblind.mjs <image-path> [...更多图片] [mode]  分析/对比图片

Modes:
  compare       多图对比分析（需 ≥2 张图）
```

---

## 3. 改动文件清单

| 文件 | 改动类型 | 描述 |
|------|----------|------|
| `scripts/unblind.mjs` | 修改 | 解析多个位置参数，传递数组给 `analyze()` |
| `scripts/lib/orchestrator.js` | 修改 | `analyze()` 接受 `imagePaths[]`，批量 `processImage`，构造多图 content 数组，多图缓存 key |
| `scripts/lib/providers/provider.js` | 修改 | 新增 `MODE_PROMPTS["compare"]`，`BaseProvider._buildRequest` 支持 `images` 参数 |
| `scripts/lib/providers/mimo.js` | 修改 | `_buildRequest` 处理多图 content 数组 |
| `scripts/lib/providers/openai.js` | 修改 | `_buildRequest` 处理多图 content 数组 |
| `tests/test-multi-image.js` | 新增 | 多图 CLI 解析、缓存 key、Provider content 数组、Pipeline 集成测试 |

### 不改的文件

- `retry.js` — 与图片数量无关
- `cache.js` — 只是 key 构造变了，接口不变
- `errorHandler.js` — 无改动
- `httpClient.js` — 无改动
- `config.js` — 无改动
- `credentialManager.js` — 无改动
- `imageProcessor.js` — 单图函数，多图只是多次调用
- `registry.js` — 无改动

---

## 4. 详细设计

### 4.1 `scripts/unblind.mjs` — CLI 入口

**改动点：** `positional` 解析逻辑。

```js
// 当前（单图）：
const imagePath = resolve(positional[0]);
const mode = positional[1] || cfg.defaultMode || "describe";

// 改为（多图）：
let mode, paths;
const last = positional[positional.length - 1];
if (VALID_MODES.includes(last)) {
  mode = last;
  paths = positional.slice(0, -1);
} else {
  mode = cfg.defaultMode || "describe";
  paths = positional;
}
if (paths.length === 0) usage();
if (mode === "compare" && paths.length < 2) {
  console.error("compare 模式需要至少 2 张图片");
  process.exit(1);
}

const imagePaths = paths.map(p => resolve(p));
const result = await analyze(imagePaths, mode, { skipCache });
```

### 4.2 `scripts/lib/orchestrator.js` — 调度核心

**改动点：** `analyze()` 签名与流程。

```js
// 签名 — 兼容旧调用 (单字符串或数组)
export async function analyze(imagePaths, mode = "describe", options = {}) {
  // 统一为数组
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  // ... 校验、建链不变 ...

  // 批量处理图片
  const images = await Promise.all(
    paths.map(p => processImage(p, { maxImageSize: config.maxImageSize }))
  );

  // 多图缓存 key：所有 base64 拼接 hash
  const hashInput = images.map(i => i.base64).join("|") + prompt;
  const imageHash = createHash("sha256").update(hashInput).digest("hex");

  // 缓存查找
  if (!options.skipCache) {
    const cacheKey = getCacheKey(imageHash, prompt);
    // ... 命中则返回 ...

  // API 调用 — 传入 images 数组
  const result = await tryChain(chain, images, mode, config);

  // 缓存写入
  if (!options.skipCache) {
    await set(getCacheKey(imageHash, prompt), { content: result.content }, ...);
  }
}
```

**`tryChain` 改动：** 将 `base64` 参数替换为 `images` 数组。

```js
async function tryChain(chain, images, mode, config) {
  // ...
  const result = await withRetry(
    () => provider.analyzeImage({ image: images, options: { mode } }),
    { ... }
  );
}
```

单图时 `images` 是 `[{ base64, mimeType }]`（单元素数组），Provider 仍接收数组，由 Provider 内部的 `_buildRequest` 统一处理。

### 4.3 `scripts/lib/providers/provider.js` — MODE_PROMPTS 与基类

**新增模式 prompt：**

```js
export const MODE_PROMPTS = {
  // ...
  compare:
    "You are an image comparison expert. Multiple images have been provided. "
    + "For each image, give a brief 1-2 sentence description. "
    + "Then analyze them together:\n"
    + "1. **Similarities** — What visual elements, subjects, colors, layout patterns, or compositions do the images share?\n"
    + "2. **Differences** — How do they differ in content, style, focus, quality, or structure?\n"
    + "3. **Summary** — Synthesize the comparison into a clear conclusion.\n"
    + "Refer to images as Image 1, Image 2, etc. when mentioning specific ones.",
};
```

**`_buildRequest` 签名不变** — `image` 参数同时接受单字符串与数组。基类不做分发，由子类根据 `Array.isArray(image)` 处理。

### 4.4 `scripts/lib/providers/mimo.js` — 多图 content 数组

```js
_buildRequest(image, prompt, options) {
  const content = [];

  if (Array.isArray(image)) {
    // 多图：每个 image 元素是 { base64, mimeType }
    for (const img of image) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: this._b64(img.base64) },
      });
    }
  } else {
    // 单图：向后兼容
    content.push({
      type: "image",
      source: { type: "base64", media_type: this._mime(image), data: this._b64(image) },
    });
  }

  content.push({ type: "text", text: prompt });

  return {
    url: `${this._baseUrl}/v1/messages`,
    body: {
      model: this._model, max_tokens: options.maxSize || 2048,
      messages: [{ role: "user", content }],
    },
    headers: { "anthropic-version": "2023-06-01", ...getAuthHeader(this._apiKey) },
  };
}
```

### 4.5 `scripts/lib/providers/openai.js` — 多图 content 数组

```js
_buildRequest(image, prompt, options) {
  const content = [];

  if (Array.isArray(image)) {
    for (const img of image) {
      content.push({ type: "image_url", image_url: { url: img.base64 } });
    }
  } else {
    content.push({ type: "image_url", image_url: { url: image } });
  }

  content.push({ type: "text", text: prompt });

  return {
    url: `${this._baseUrl}/chat/completions`,
    body: {
      model: this._model, max_tokens: options.maxSize || 2048,
      messages: [{ role: "user", content }],
    },
    headers: { "Authorization": `Bearer ${this._apiKey}` },
  };
}
```

### 4.6 缓存策略

多图缓存 key 构造：

```
hashInput = images.map(i => i.base64).join("|") + "||PROMPT||" + prompt
cacheKey = sha256(hashInput)
```

- 图片顺序敏感 — `a.png + b.png` 与 `b.png + a.png` 是不同 key（对比时顺序有意义）
- 单图路径不变 — `images` 数组长度为 1 时 key == 旧单图 key

---

## 5. Prompt 设计（"compare" 模式）

### 设计原则

1. **独立描述先行** — 要求模型先描述每张图，确保各图都被观察到
2. **结构化对比** — 相似点 → 差异点 → 总结，三段式结构
3. **编号引用** — 要求模型以"Image 1"、"Image 2"称呼，输出可阅读

### 最终 prompt（英文，保持与其他模式一致）

```
You are an image comparison expert. Multiple images have been provided.
For each image, give a brief 1-2 sentence description.
Then analyze them together:
1. **Similarities** — What visual elements, subjects, colors, layout patterns, or compositions do the images share?
2. **Differences** — How do they differ in content, style, focus, quality, or structure?
3. **Summary** — Synthesize the comparison into a clear conclusion.
Refer to images as Image 1, Image 2, etc. when mentioning specific ones.
```

### 为什么不用中文 prompt

- 其他 5 个模式均为英文 prompt
- 英文对 vision 模型的指令理解稳定性更高
- 结果内容可以是中文（取决于输入图片的文字），prompt 语言不限制输出语言

---

## 6. 错误处理

| 场景 | 错误类型 | 提示 |
|------|----------|------|
| compare 模式只有 1 张图 | ClientError | "compare 模式需要至少 2 张图片" |
| 路径参数为空 | 无参 → usage() | 打印帮助信息 |
| 某张图片无法读取 | ClientError | "文件不存在: xxx。请检查文件路径是否正确" |
| 某张图片格式不支持 | ClientError | "不支持的图片格式"（已有） |
| 单张图片太大 | ClientError | "图片文件过大"（已有） |
| 全部图片超出总大小限制 | 见下节 | 在 orchestrator 汇总每张图大小 |

### 总大小限制

多图时单图仍受 `maxImageSize` 约束（已有），不另设总大小上限。原因：
- API 的 token 限制由 `max_tokens` 控制
- 图片太多时，API 会返回 400，由 `errorHandler` 分类为 ServerError，触发重试后可自然降级

---

## 7. 验证方式

### 单元测试 (`tests/test-multi-image.js`)

| 测试用例 | 验证点 |
|----------|--------|
| CLI 解析：1 图 + mode | `analyze` 收到 `["img.png"]`, mode=`"ocr"` |
| CLI 解析：2 图 + compare | `analyze` 收到 `["a.png","b.png"]`, mode=`"compare"` |
| CLI 解析：3 图无 mode | `analyze` 收到 `["a.png","b.png","c.png"]`, mode=`"describe"` |
| CLI 解析：无图 | `process.exit(1)` + usage |
| CLI 解析：compare 1 图 | `process.exit(1)` + 错误提示 |
| Mimo `_buildRequest` 多图 | content 数组含 N+1 个元素（N 图 + 1 text） |
| OpenAI `_buildRequest` 多图 | content 数组正确 |
| 缓存 key 差异 | `a+b` vs `b+a` 不同 key |
| 缓存 key 向后兼容 | 单图数组 key == 旧单图 key |
| Pipeline：`analyze` 接收数组 | `processImage` 被调用 N 次 |
| 向后兼容：传递字符串 | 自动包装为 `[string]` |

### 集成测试

| 场景 | 方法 |
|------|------|
| 双图 compare 真实 API | `node unblind.mjs a.png b.png compare`（需要在 CI 环境配置 API Key） |
| 三图默认模式 | `node unblind.mjs a.png b.png c.png` |
| 混合 flags | `node unblind.mjs a.png b.png compare --no-cache` |

### 验收标准

```
node --test tests/test-multi-image.js    # 全部通过
node unblind.mjs img1.png img2.png compare  # 输出结构化的对比结果
node unblind.mjs solo.png               # 单图仍然正常工作
```

---

## 8. 向后兼容性

| 旧用法 | 新行为 | 兼容性 |
|--------|--------|--------|
| `node unblind.mjs img.png` | `paths=["img.png"]`, mode=default | ✅ 完全一致 |
| `node unblind.mjs img.png ocr` | `paths=["img.png"]`, mode="ocr" | ✅ 完全一致 |
| `node unblind.mjs img.png --no-cache` | flags 解析不变 | ✅ 完全一致 |
| `analyze("path", mode)` (字符串) | 自动包装 `["path"]` | ✅ 签名兼容 |
| `analyze(["path"], mode)` (数组) | 新用法 | ✅ 新增 |

---

## 9. 工作量估算

| 模块 | 行数变化 | 复杂度 |
|------|----------|--------|
| `unblind.mjs` | ~+15 行 | 低 — 简单条件分支 |
| `orchestrator.js` | ~+25 行 | 中 — 批量处理 + 缓存逻辑 |
| `provider.js` | ~+10 行 | 低 — 新增 prompt |
| `mimo.js` | ~+15 行 | 低 — `if/else` 分支 |
| `openai.js` | ~+10 行 | 低 — `if/else` 分支 |
| `test-multi-image.js` | ~+60 行 | 中 — 新测试文件 |

预计 **净增 ~100 行**（含测试），零依赖变更。

---

## 10. 未涵盖 & 未来方向

| 方向 | 原因（不在本轮实现） |
|------|---------------------|
| 多图混合模式（如图 1 ocr + 图 2 compare） | 无实际需求，CLI 语义复杂 |
| 总图片大小上限 | 单图已有上限，API 自动处理超限错误 |
| MCP 工具多图支持 | Phase 4 已跳过（自行车道不修高速） |
| 图片数量上限 | 建议 ≤5 张，但由 API max_tokens 自然限制 |
