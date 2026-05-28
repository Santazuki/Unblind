# 视觉链式思考模板 / Visual Chain-of-Thought Template

## 输出格式

使用此模板时，视觉模型按以下分步格式输出分析结果：

```
## 1. 区域定位 / Region Localization
- 图片整体布局描述（上/中/下、左/中/右分区）
- 关键区域的位置标注

## 2. 特征提取 / Feature Extraction
- 每个关键区域的视觉特征（颜色、形状、纹理、文字）
- 物体、人物、场景元素

## 3. 关系推理 / Relational Reasoning
- 各元素之间的空间关系
- 语义关系（因果关系、时间顺序等）
- 可能的上下文推断

## 4. 综合结论 / Comprehensive Conclusion
- 图片的整体理解与总结
- 对用户问题的直接回答
```

## 使用方式

在调用 unblind 时指定 mode 参数：

```bash
node unblind.mjs <image-path> describe --template chain-of-thought
```

## 注意事项

- 此模板会增加输出长度和 API 调用成本（约 2-3 倍 token 消耗）
- 适用于需要可解释性或调试视觉分析结果的场景
- 日常识图请使用默认的简洁模式
