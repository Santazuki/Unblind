# CSV 输出格式 / CSV Output Format

## 说明

适用于表格类视觉分析（chart-data 模式），将数据输出为 CSV 格式。

## 格式模板

```csv
category,label,value,unit
"<类别>","<标签>","<数值>","<单位>"
```

## 多物体识别 CSV

```csv
object_name,category,location,confidence
"<名称>","<类别>","<位置>","<置信度>"
```

## 使用方法

在调用时指定 `--format csv` 参数（Phase 3 实现）。
