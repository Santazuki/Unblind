# CLAUDE.md — Unblind

> Claude Code Agent Skill，为 DeepSeek 等纯文本模型提供视觉能力。图片 → Mimo API → 文字描述。
> 核心哲学：自行车道不是高速公路。零 npm 依赖，克隆即用。

## 当前状态

Phase 1+2 完成，Phase 3 进行中。165 行单文件 → 14 模块，53 tests（50 pass, 0 fail, 3 API-skip）。

> 注意：`docs/project-prepare-md/` 中的设计文档使用 `src/` + TypeScript，代表**原始蓝图**。实际采用 `scripts/lib/` + JavaScript + `env.*` 配置格式。差异是有意为之（零编译、Claude Code 原生 env 注入），历史设计文档未更新。

## 目录结构（实际）

```
scripts/
├── unblind.mjs              # CLI 入口: analyze / --health / --config / --set-model / --cache-stats
├── install.js               # Node.js 安装脚本（--check 诊断模式）
└── lib/
    ├── orchestrator.js      # 调度核心：config → image → cache → provider → result
    ├── httpClient.js        # 统一 HTTP 层：fetch + 超时 + 错误分类 + Retry-After
    ├── config.js            # 读取 settings.json，校验，默认值，saveConfig()
    ├── credentialManager.js # API Key + Base URL 自动检测（sk-ant/sk-/tp- 前缀）
    ├── imageProcessor.js    # 格式/魔数/大小校验 + Base64 编码（async readFile）
    ├── cache.js             # SHA256 文件持久化缓存，TTL 过期，LRU 1000
    ├── retry.js             # 指数退避 + Circuit Breaker 熔断器
    ├── errorHandler.js      # ClientError / ServerError / NetworkError + 中文提示
    ├── logger.js            # JSON Lines → stderr
    └── providers/
        ├── provider.js      # IVisionProvider 接口 + BaseProvider 基类
        ├── mimo.js          # Mimo Anthropic-compatible API
        └── openai.js        # OpenAI Chat Completions API (GPT-4V/GLM-5V/Ollama)
tests/                       # node --test tests/test-*.js (50 pass, 3 API-skip)
docs/test-results/           # 14 份按步骤的测试结果
resources/troubleshooting.md # Phase 0 修复命令、常见错误
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
| 3 扩展（多 Provider） | 🔄 OpenAI ✅ · DeepSeekVL 📋 · Ollama 📋 |
| 4 多 Agent（MCP） | ⏭️ 跳过（设计决策：自行车道不修高速） |
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
- **测试报告**：功能修复或新增后，必须输出测试报告到 `docs/test-results/step<N>-<name>.md`，包含测试数、通过/失败/跳过统计、失败原因
- **Subagent 模型选择**：机械任务用 haiku（快/便宜），集成/判断用标准模型

### 安全审计流程

重大变更后执行三轮审计（经本项目实战验证）：

```
Round 1: 3 审计员并行（API Key 泄露 / 注入验证 / 日志数据泄露）
       → 修复 HIGH + MEDIUM
Round 2: 1 审计员验证修复 + 扫新问题
       → 修复遗漏
Round 3: 1 审计员最终确认
       → CLEAN 或继续
```

各审计员只读扫描，报告文件:行号、严重程度、修复建议。不修复 LOW/INFO 级别。

### 多 Agent 协作指南

详见 `docs/project-prepare-md/多agent协作开发unblind.md`。核心角色：
- **Architect** → 输出设计文档到 `docs/design/`
- **Developer** → 按 TDD 实现，独立 commit
- **Tester** → `node --test` + 输出报告到 `docs/test-results/`
- **Reviewer** → 只读审查，按 CRITICAL/WARNING/INFO 分级

### 提交规范（每次 commit 后强制执行）

1. `git add <files> && git commit -m "..."` — 常规提交
2. **自问**：项目状态变了吗？设计决策新增了吗？测试数变了吗？
3. **如果有变**：立即写记忆文件（`~/.claude/projects/D--My-Projects-unblind/memory/`），记忆文件由 Claude Code 自动持久化，无需 git 管理
4. **如果无变**：跳过
