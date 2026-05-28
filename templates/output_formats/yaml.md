# YAML 输出格式 / YAML Output Format

## 说明

将视觉分析结果输出为 YAML 格式，兼顾可读性与结构化。

## 格式模板

```yaml
analysis:
  mode: describe
  model: mimo-v2.5
  timestamp: "2026-05-28T10:30:00Z"
  processing_time_ms: 234

result:
  summary: "<一句话总结>"
  details:
    objects:
      - name: "<物体名称>"
        location: "<位置描述>"
        attributes: {}
    text:
      - content: "<文字内容>"
        location: "<位置描述>"
    colors:
      - "<主色调>"
    composition: "<构图描述>"
```

## 使用方法

在调用时指定 `--format yaml` 参数（Phase 3 实现）。
