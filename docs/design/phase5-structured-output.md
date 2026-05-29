# Phase 5: Structured Output (--format json|yaml|csv)

## 问题

当前 `unblind.mjs` 输出的始终是纯文本。下游脚本或数据管道（如自动化报表、UI 测试断言、数据提取）需要自行解析非结构化文本，易出错、不通用。

已有 `templates/output_formats/json.md`、`yaml.md`、`csv.md` 规划文档，但未实现 CLI 入口。

## 方案

CLI 新增 `--format <json|yaml|csv>` 标志。指定时，在发给模型的 prompt 末尾追加结构化格式指令，让模型直接输出对应格式。

**设计约束：** 只改 2 个文件，不改 Provider 接口，不引入新依赖。

## 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `scripts/unblind.mjs` | 解析 `--format`，传 `format` 到 `analyze()` | 3 |
| `scripts/lib/orchestrator.js` | 新增 `FORMAT_PROMPTS` 映射 + 追加逻辑；`tryChain` 透传 prompt | 15 |

## 接口变更

### scripts/unblind.mjs

第 101 行，`analyze()` 调用处增加 `format` 参数：

```js
const format = flags.includes("--format") ? args[args.indexOf("--format") + 1] : undefined;
const result = await analyze(imagePath, mode, { skipCache, format });
// 现有 flags.some 解析也合法，但要支持 --format json 拿值，用 indexOf
```

`--help` 新增一行：

```
  --format <json|yaml|csv>  指定输出格式，追加格式指令到 prompt
```

### scripts/lib/orchestrator.js

#### 1. 新增 FORMAT_PROMPTS 映射

```js
const FORMAT_PROMPTS = {
  json: `Respond in **valid JSON only**, no markdown fences, no extra text. Use this structure:
{
  "summary": "<one-sentence summary>",
  "details": {
    "objects": [{ "name": "...", "location": "...", "attributes": {} }],
    "text": [{ "content": "...", "location": "..." }],
    "colors": ["..."],
    "composition": "..."
  }
}`,
  yaml: `Respond in **YAML format only**, no extra text before or after. Use this structure:
analysis:
  mode: "<mode>"
  model: "<model>"
result:
  summary: "<one-sentence summary>"
  details:
    objects:
      - name: "..."
        location: "..."
        attributes: {}
    text:
      - content: "..."
        location: "..."
    colors: ["..."]
    composition: "..."`,
  csv: `Respond in **CSV format only** with a header row. Use commas as delimiters. Escape commas with double quotes where needed. No extra text before or after.
Header: mode,summary,detail`,
};
```

#### 2. analyze() 中拼接 prompt

现有第 81 行 `const prompt = MODE_PROMPTS[mode]` 之后：

```js
let prompt = MODE_PROMPTS[mode];
if (options.format && FORMAT_PROMPTS[options.format]) {
  prompt += "\n\n" + FORMAT_PROMPTS[options.format];
}
```

#### 3. tryChain 透传 prompt

将 `tryChain(chain, base64, mode, config)` 改为 `tryChain(chain, base64, mode, config, prompt)`：

```js
const result = await withRetry(
  () => provider.analyzeImage({ image: base64, prompt, options: { mode } }),
  { ...config.retry, circuitBreaker: cb }
);
```

### 数据流

```
CLI: --format json
  ↓
unblind.mjs: options.format = "json"
  ↓
orchestrator.analyze(): prompt = MODE_PROMPTS[mode] + FORMAT_PROMPTS["json"]
  ↓ (prompt 作为独立参数传入)
tryChain() → provider.analyzeImage({ image, prompt, options: { mode } })
  ↓
BaseProvider.analyzeImage: _buildRequest(image, prompt(已含格式指令), options)
  ↓
模型返回 JSON 纯文本
```

### 不变的部分

- `IVisionProvider` 接口不变（`analyzeImage` 早已接受 `prompt` 参数）
- `BaseProvider._buildRequest()` 不变（prompt 字符串直接传入）
- `BaseProvider._validate()` 不变（只校验 mode，不关心 prompt 内容）
- 缓存键不变（缓存键用 `MODEPROMPTS[mode]`，不含格式指令——设计权衡：格式指令不应影响缓存键，同一 mode 的 JSON/YAML/CSV 应共享缓存）
- `config.js`、`MODE_PROMPTS`、Provider 实现均不动
- 无新依赖，无新文件，无模板读取

### 缓存设计说明

缓存键仍为 `SHA256(imageContent) + MODE_PROMPTS[mode]`，**不包含格式指令**。理由：
- 格式指令只改变输出格式，不改变分析内容
- 同一图片同一 mode 的 JSON/YAML/CSV 输出共享缓存，减少 API 调用
- 模型输出的格式是否严格匹配预期格式由模型能力保证，与缓存语义无关
- 如有格式特殊需求，可使用 `--no-cache` 绕过

## 验证方式

### 1. CLI 单元测试（test-unblind-cli.js）

| 用例 | 预期 |
|------|------|
| `--format json` 被正确解析到 `options.format` | `format === "json"` |
| `--format yaml` 同上 | `format === "yaml"` |
| `--format csv` 同上 | `format === "csv"` |
| 不传 `--format` 时 `format` 为 `undefined` | `format === undefined` |
| 无效 format 值（如 `--format html`）不报错，原样传给模型 | 不回退，不崩溃 |

### 2. 集成验证（test-orchestrator-format.js 或手工）

| 用例 | 预期 |
|------|------|
| `--format json` + `describe` | prompt 末尾含 JSON 结构指令 |
| `--format yaml` + `ocr` | prompt 末尾含 YAML 结构指令 |
| `--format csv` + `chart-data` | prompt 末尾含 CSV 指令 |
| 无 `--format` | prompt 行为完全不变 |
| 无效 format | prompt 不变（无匹配的 FORMAT_PROMPTS） |

### 3. 回归验证

- `node --test tests/test-*.js` — 全部通过（无快照类测试不受影响）
- 不传 `--format` 时输出完全一致
- 缓存键不变，缓存命中不受影响
