# CLAUDE.md — Unblind

> Claude Code Agent Skill，为 DeepSeek 等纯文本模型提供视觉能力。图片 → Mimo API → 文字描述。
> 核心哲学：自行车道不是高速公路。零 npm 依赖，克隆即用。

## 当前状态

Phase 1+2 完成。165 行单文件 → 12 模块，53/53 测试通过。19 commits 已推送。

## 目录结构（实际）

```
scripts/
├── unblind.mjs              # CLI 入口（39行薄壳）: analyze / --health / --config / --set-model
└── lib/
    ├── orchestrator.js      # 调度核心：config → image → cache → provider → result
    ├── config.js            # 读取 ~/.claude/settings.json，校验，默认值，saveConfig()
    ├── credentialManager.js # API Key + Base URL 自动检测（tp-/sk- 前缀）
    ├── imageProcessor.js    # 格式校验 + 大小限制 + Base64 编码
    ├── cache.js             # SHA256 + mtime 精确匹配缓存，TTL 过期
    ├── retry.js             # 指数退避 + Circuit Breaker 熔断器
    ├── errorHandler.js      # ClientError / ServerError / NetworkError + 中文提示
    ├── logger.js            # JSON Lines → stderr
    └── providers/
        ├── provider.js      # IVisionProvider 接口 + 5 种模式 prompt
        └── mimo.js          # Mimo Anthropic-compatible API 适配
tests/                       # 53 tests，node --test tests/test-*.js
docs/test-results/           # 11 份按步骤的测试结果
```

## 开发约定

- **零 npm 依赖** — 只用 Node.js >= 18 内置模块（fs/path/crypto/fetch）
- **JS + JSDoc** — ESM（`"type": "module"`），不编译
- **安全红线** — 绝不硬编码 Key，绝不在命令输出暴露 Key，路径校验门防注入
- **TDD** — `node --test` 内置框架，先写测试再写实现
- **错误** — 中文面向用户，三类：ClientError（不重试）/ ServerError（重试）/ NetworkError（重试）
- **测试无真实图片** — 用例用文字描述，真实图片路径通过 env 注入

## 关键文件

| 文件 | 作用 | 小心 |
|------|------|------|
| `SKILL.md` | Skill 入口（触发词、自愈流程、执行规则） | 影响所有用户 |
| `scripts/unblind.mjs` | CLI 入口 | 影响核心功能 |
| `scripts/lib/orchestrator.js` | 调度核心 | 串联全链路 |
| `scripts/lib/providers/mimo.js` | Mimo API 调用 | 影响核心功能 |
| `install.sh` | 部署到 ~/.claude/skills/unblind/ | 影响分发 |

## 路线

| Phase | 状态 |
|-------|------|
| 0 原型 | ✅ |
| 1 模块化 | ✅ |
| 2 稳定性（缓存/健康检查/CLI管理） | ✅ |
| 3 扩展（多 Provider） | 📋 |
| 4 多 Agent（MCP） | 📋 |
| 5 高级功能 | 📋 |

## 记忆文件

`~/.claude/projects/D--My-Projects-unblind/memory/` — 设计决策、项目状态、文档索引，新对话自动加载。
