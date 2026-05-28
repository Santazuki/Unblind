# JSON 输出格式 / JSON Output Format

## 说明

将视觉分析结果输出为结构化 JSON，便于下游脚本或数据管道直接使用。

## 格式模板

```json
{
  "analysis": {
    "mode": "<describe|ocr|ui-review|chart-data|object-detect>",
    "model": "<model-name>",
    "timestamp": "<iso-8601>",
    "processingTimeMs": "<number>"
  },
  "result": {
    "summary": "<一句话总结>",
    "details": {
      "objects": [
        {
          "name": "<物体名称>",
          "location": "<位置描述>",
          "attributes": {}
        }
      ],
      "text": [
        {
          "content": "<文字内容>",
          "location": "<位置描述>"
        }
      ],
      "colors": ["<主色调>"],
      "composition": "<构图描述>"
    }
  }
}
```

## 使用方法

在调用时指定 `--format json` 参数（Phase 3 实现）。
