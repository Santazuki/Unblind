# 缓存粒度优化 — 测试报告

## test-cache.js
- 结果: 10/10 通过
- 失败用例: (无)

## test-orchestrator.js
- 结果: 2/3 通过
- 失败用例:
  - `should analyze a real image end-to-end` — ClientError: API Key 无效或被拒绝 (401)

## 全量回归
- 总测试数: 53 (10 个文件, 20 个套件)
- 通过: 50
- 失败: 3

## 失败详情

| 测试文件 | 用例 | 原因 |
|---|---|---|
| `tests/test-mimo.js:31` | healthCheck should return true with valid key | API Key 无效 |
| `tests/test-mimo.js:37` | should return valid result for describe mode | API Key 无效或被拒绝 (401) |
| `tests/test-orchestrator.js:45` | should analyze a real image end-to-end | API Key 无效或被拒绝 (401) |

## 结论
- 是否所有非 API Key 依赖的测试通过？ **是** — 50 个非 API Key 依赖的测试全部通过 (0 失败)。
- API Key 依赖的测试失败原因是否为环境问题（非代码bug）？ **是** — 3 个失败均因 `ClientError: API Key 无效或被拒绝`，为本地环境未配置有效 Mimo API Key 导致，非代码缺陷。
