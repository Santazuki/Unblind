# 测试用例 / Test Cases

> 本目录存放测试用例定义（纯文字描述），不使用真实图片。
> 真实图片测试在本地环境中手动执行，不应提交到 Git 仓库。

## 设计原则

- 每个测试用例用文字描述测什么、期望什么
- 真实图片路径通过环境变量或本地配置注入
- 所有测试数据不包含敏感信息

## 用例模板

```yaml
test_case:
  id: "TC-001"
  mode: describe
  description: "中文文本截图——验证 OCR 准确提取"
  image_hint: "一张包含中文面试题目和答案的截图"
  expected:
    - "应提取所有中文字符，无乱码"
    - "应保留题目-答案的层级结构"
    - "处理时间 < 5s"

test_case:
  id: "TC-002"
  mode: describe
  description: "人像照片——验证人物特征描述"
  image_hint: "一张正式证件照（东亚男性、正装）"
  expected:
    - "应识别出人物性别、着装、背景"
    - "不应包含幻觉信息（如不存在的人物细节）"

test_case:
  id: "TC-003"
  mode: ocr
  description: "多语言混排——验证文字提取完整性"
  image_hint: "一张包含中文、英文、数字混排的文档截图"
  expected:
    - "应提取所有语言文字"
    - "中英文不应混淆"
    - "数字和符号不应遗漏"
```

## 本地测试命令

```bash
# 设置测试图片路径
export TEST_IMAGE_001="/path/to/chinese_screenshot.png"
export TEST_IMAGE_002="/path/to/portrait.jpg"

# 运行测试
node scripts/unblind.mjs "$TEST_IMAGE_001" describe
node scripts/unblind.mjs "$TEST_IMAGE_002" describe
```
