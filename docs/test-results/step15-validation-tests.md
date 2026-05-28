# 自动化验证测试报告 — 文档 & 安装脚本有效性

> 日期：2026-05-28 | 测试框架：`node:test` | 65 tests total

## 测试目标

确保文档中的命令和安装脚本不会随时间腐烂。每次 `npm test` 强制验证。

## 文档命令验证 (`tests/test-docs.js`)

扫描 `resources/best_practices.md` 和 `resources/troubleshooting.md`，提取所有 `node scripts/...` 命令并逐条执行验证。

**6/6 通过**

| 测试 | 结果 | 说明 |
|------|------|------|
| 静态命令语法有效性 | ✅ 2/2 | 文档中的 `node scripts/...` 命令能正常执行 |
| 模板命令基础结构 | ✅ 0/0 | 无含占位符的命令（如有会验证脚本路径存在） |
| `--health` 诊断输出 | ✅ | 网络不可达时仍输出健康检查信息 |
| `--config` 配置查看 | ✅ | 显示模型、Key 前缀（脱敏） |
| `--cache-stats` 缓存统计 | ✅ | 显示缓存条目、命中/未命中 |
| `--set-model invalid` 错误提示 | ✅ | 无效模型时输出清晰错误消息 |

**保证机制**：文档中任何 `node scripts/xxx` 命令如果失效 → 测试失败 → 开发者必须同步更新文档。

## 安装脚本验证 (`tests/test-install.js`)

验证 `install.sh` 和 `install.js` 的语法正确性和部署行为。

**6/6 通过**

| 测试 | 结果 | 说明 |
|------|------|------|
| install.sh 引用文件存在 | ✅ | 脚本中引用的源文件均在 dev 目录中 |
| install.sh 语法检查 (`bash -n`) | ✅ | 无语法错误 |
| install.sh 部署到临时目录 | ✅ | 部署后核心文件存在，开发文件未泄漏 |
| install.js 语法检查 (`node --check`) | ✅ | 无语法错误 |
| install.js 文件存在 | ✅ | dev 目录中可找到 |
| install.js 不引用已删除文件 | ✅ | FILES_TO_COPY 不含旧版路径 |

**保证机制**：
- `install.sh` 被修改 → `bash -n` 检测语法错误
- 部署文件列表变化 → 完整性检查检测缺失/多余文件
- `install.js` 引用已删除文件 → 引用检查检测

## 全量测试摘要

```
65 tests total
62 pass
0 fail
3 skip (API 连通性依赖，Key 失效时自动跳过)
```

## 测试覆盖矩阵

| 类别 | 测试数 | 覆盖内容 |
|------|--------|---------|
| logger | 3 | JSON Lines, 级别过滤, 空数据 |
| errorHandler | 4 | 三类错误, 中文提示, 重试判断 |
| config | 4 | 默认值, 用户覆盖, 性能警告 |
| credentialManager | 6 | URL 检测, Key 读取, Auth Header |
| retry | 6 | 指数退避, 最大重试, Circuit Breaker |
| imageProcessor | 6 | 格式/魔数/大小校验, Base64 |
| cache | 10 | SHA256, TTL, LRU, 持久化 |
| provider (mimo) | 3 | 接口验证, Key 缺失, API 集成 |
| orchestrator | 3 | 端到端, 文件不存在, 无效模式 |
| CLI | 6 | health, usage, 错误文件, config, model, cache |
| **文档命令** | **6** | **best_practices + troubleshooting 命令** |
| **安装脚本** | **6** | **install.sh + install.js 语法与部署** |
