# 缓存粒度

## 问题

当前缓存键为 `SHA256(imagePath + mode)`。路径敏感：同一内容的图片通过 `/tmp/a.png` 和 `/tmp/b.png` 引用会生成不同键，导致缓存穿透。

缓存语义应该是：**相同图片内容 + 相同提示词 = 相同缓存结果**。

## 方案

不改 I/O 流程，不碰 `processImage`。用 `processImage` 已返回的 `base64` 字符串做内容哈希，用 `MODE_PROMPTS[mode]` 做提示词。

### 改动

| 文件 | 改动 | 行数 |
|------|------|------|
| `scripts/lib/cache.js` | `getCacheKey(contentHash, prompt)` 替换 `getCacheKey(imagePath, mode)` | 1 |
| `scripts/lib/orchestrator.js` | 两处调用点改用 `createHash("sha256").update(base64).digest("hex")` + `MODE_PROMPTS[mode]`；补 `createHash` 和 `MODE_PROMPTS` 导入 | 6 |
| `tests/test-cache.js` | 更新 `getCacheKey` 的 3 个测试用例以匹配新签名 | 8 |

### 接口签名

```js
// cache.js — 参数改为 contentHash + prompt
export function getCacheKey(contentHash, prompt)

// 使用示例（orchestrator.js 两处）
const contentHash = createHash("sha256").update(base64).digest("hex");
const prompt = MODE_PROMPTS[mode];
const cacheKey = getCacheKey(contentHash, prompt);
```

### 数据流不变

```
processImage(path) → { base64 }
  ↓
sha256(base64) → contentHash        ← 新增，用已有 base64
MODE_PROMPTS[mode] → prompt         ← 新增，用已有常量
getCacheKey(contentHash, prompt)    ← 新签名
  ↓
get(cacheKey) / set(cacheKey, ...)  ← 不变
```

### 验证方式

1. 单元测试：`getCacheKey` 三用例改为传 contentHash + prompt
2. 集成验证：同一图片不同路径（复制到 `/tmp/a.png` 和 `/tmp/b.png`），同一 mode 应命中缓存
3. 集成验证：同一图片不同 mode（describe vs ocr）应生成不同键，不命中
