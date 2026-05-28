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

## 按需读取策略

**本文件和记忆文件足以理解项目全貌。以下内容仅在需要时读取，不要预加载：**

| 何时读取 | 读什么 |
|----------|--------|
| 需要了解某个模块的实现细节 | `scripts/lib/<module>.js` |
| 需要查看完整设计背景 | `docs/superpowers/specs/*.md` |
| 需要查看分步实现计划 | `docs/superpowers/plans/*.md` |
| 需要查看历史测试结果 | `docs/test-results/step*.md` |
| 需要了解项目定位/重构蓝图 | `docs/project-prepare-md/*.md` |

**常见任务速查：**
- 加新功能 → `scripts/lib/orchestrator.js` 是入口，`scripts/lib/providers/provider.js` 是接口
- 修 Bug → 从 `tests/` 写复现用例开始
- 加新 Provider → 参考 `scripts/lib/providers/mimo.js`，实现 `IVisionProvider` 接口
- 验证改动 → `node --test tests/test-*.js`

## 记忆文件

`~/.claude/projects/D--My-Projects-unblind/memory/` — 设计决策、项目状态、文档索引，新对话自动加载。

## 项目审计清单

**阶段性完成或重大变更后，逐项检查：**

- [ ] `node --test tests/test-*.js` — 全部通过
- [ ] `git status` — 无遗漏的未跟踪文件
- [ ] 无残留占位文件（`scripts/` 下不应有仅含注释的空壳）
- [ ] `tests/sample_images/` 中无真实图片（仅允许 .md）
- [ ] `grep -r "tp-cla\|sk-anti" scripts/` — 源码中无硬编码 Key
- [ ] `.gitignore` 覆盖：settings.json、.env、node_modules、测试图片
- [ ] 所有新增文件已 `git add`
- [ ] `scripts/lib/` 模块数与设计文档一致
- [ ] CLAUDE.md 状态描述与实际一致（Phase 状态、测试数、commit 数）

## 记忆维护策略

| 触发条件 | 操作 |
|----------|------|
| 设计决策达成 | 追加到 `memory/design-decisions.md` |
| Phase/里程碑完成 | 更新 `memory/project-state.md` |
| 新增文档或目录 | 更新 `memory/doc-index.md` |
| CLAUDE.md 信息过时 | 立即修正（状态表、测试数、目录结构） |
| MEMORY.md 索引过期 | 同步更新链接和描述 |
| 上下文低于 50% 时 | 主动写记忆，确保新对话可恢复 |

## 开发工作流

采用 **Subagent-Driven Development**（多 Agent 协作），流程：

```
需求 → brainstorm → spec → plan → subagent(implement → spec-review → code-review) → audit → memory
```

- **复杂任务**：使用 `superpowers:brainstorming` → `writing-plans` → `subagent-driven-development`
- **小改动**：直接实现，不走 subagent dispatch
- **每步验证**：`node --test` + 提交独立 commit
- **Subagent 模型选择**：机械任务用 haiku（快/便宜），集成/判断用标准模型
