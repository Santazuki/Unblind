# CLAUDE.md — Unblind

> Claude Code Agent Skill，为 DeepSeek 等纯文本模型提供视觉能力。图片 → Mimo API → 文字描述。
> 核心哲学：自行车道不是高速公路。零 npm 依赖，克隆即用。
> 遵循 [agentskills.io](https://agentskills.io) 规范：三级渐进披露、allowed-tools、description 触发优化（主动语态+否定Case）、scenarios+evals 评估体系。

## 当前状态

Phase 1+2+3+5 完成。v3.0 协议驱动架构。15 模块，161 tests（159 pass, 0 fail, 2 API-skip）。Provider 注册表 7 条目（Mimo/OpenAI/Ollama/Gemini/Groq/Together/Fireworks），3 协议族（Anthropic Messages / OpenAI Chat Completions / Google Generative AI）。

> 注意：`docs/project-prepare-md/` 中的设计文档使用 `src/` + TypeScript，代表**原始蓝图**。实际采用 `scripts/lib/` + JavaScript + `env.*` 配置格式。差异是有意为之（零编译、Claude Code 原生 env 注入），历史设计文档未更新。

## 目录结构（实际）

```
scripts/
├── unblind.mjs              # CLI 入口: analyze / --health / --config / --set-model / --cache-stats
├── install.js               # Node.js 安装脚本（--check 诊断模式）
└── lib/
    ├── orchestrator.js      # 调度核心：config → image → cache → provider → result
    ├── httpClient.js        # 统一 HTTP 层：fetch + 超时 + 错误分类 + parseError 委托
    ├── config.js            # 读取 settings.json，校验，默认值，saveConfig()
    ├── credentialManager.js # API Key + Base URL 自动检测（sk-ant/sk-/tp- 前缀）
    ├── imageProcessor.js    # 格式/魔数/大小校验 + Base64 编码（async readFile）
    ├── cache.js             # SHA256 文件持久化缓存，TTL 过期，LRU 1000
    ├── retry.js             # 指数退避 + Circuit Breaker 熔断器
    ├── errorHandler.js      # ClientError / ServerError / NetworkError + 中文提示
    ├── logger.js            # JSON Lines → stderr
    └── providers/
        ├── provider.js      # MODE_PROMPTS + validateProvider（BaseProvider 已由 GenericProvider 替代）
        ├── registry.js      # 纯数据注册表 — 新增 Provider = 加一行
        ├── protocols.js     # 3 协议族纯函数（anthropic-messages / openai-chat-completions / google-generative-ai）
        └── generic-provider.js  # 唯一 Provider 类，调度协议函数，overrides 校验
tests/                       # node --test tests/test-*.js (163 tests, 161 pass, 0 fail, 2 API-skip)
docs/test-results/           # 18 份按步骤的测试结果
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
| `scripts/lib/providers/protocols.js` | 3 协议族纯函数 | 新增协议在此定义 |
| `scripts/lib/providers/generic-provider.js` | 唯一 Provider 类 | 影响所有 Provider 调用 |
| `scripts/lib/providers/registry.js` | 纯数据注册表 | 新增 Provider 加一行 |
| `scripts/lib/httpClient.js` | HTTP 层 + parseError 委托 | 影响错误分类 |
| `install.sh` | 部署到 ~/.claude/skills/unblind/ | 影响分发 |

## 路线

| Phase | 状态 |
|-------|------|
| 0 原型 | ✅ |
| 1 模块化 | ✅ |
| 2 稳定性（缓存/健康检查/CLI管理） | ✅ |
| 3 扩展（多 Provider） | ✅ v3.0 协议驱动架构 |
| 4 多 Agent（MCP） | ⏭️ 跳过 |
| 5 高级功能 | ✅ 多图对比 + 结构化输出 + 7 Provider |

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
- 加新 Provider → 在 `scripts/lib/providers/registry.js` REGISTRY 数组中加一行（纯数据）
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

## CLAUDE.md 自动更新规则

**CLAUDE.md 是项目的"AI 长期记忆"。以下触发条件必须即时更新，不得等用户提醒：**

1. **新 Phase 开启或方向变化** → 更新路线表、状态描述
2. **重构完成（局部或整体）** → 更新目录结构、模块数量、架构描述
3. **新增/删除模块** → 同步目录结构中的文件清单
4. **测试数变化** → 更新当前状态行
5. **设计决策转变** → 追加到开发约定或架构原则

每次 `git commit` 后自问："CLAUDE.md 还准确吗？"→ 不准确立即修。

**每次批量提交后，必须检查 GitHub Actions CI 状态。如有失败，立即修复并重新提交，直到 CI 通过。**

**对于任何测试失败，动态添加或修改测试脚本（放宽断言、适配新行为、填补缺失用例），直到全部测试跑通。**

## 记忆维护策略

| 触发条件 | 操作 |
|----------|------|
| 设计决策达成 | 追加到 `memory/design-decisions.md` |
| Phase/里程碑完成 | 更新 `memory/project-state.md` |
| 新增文档或目录 | 更新 `memory/doc-index.md` |
| CLAUDE.md 信息过时 | 立即修正（状态表、测试数、目录结构） |
| 项目进入新 Phase/方向变化 | **强制更新 CLAUDE.md** 路线表 + 状态描述 + 目录结构 |
| 局部或整体重构完成 | **强制更新 CLAUDE.md** 架构描述 + 模块数量 + 新增/删除文件 |
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
- **Subagent 模型选择**：机械任务用 deepseek-v4-flash，集成/判断用 deepseek-v4-pro

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

### Quality Gate 协作循环

**PM Agent 硬约束：以下角色必须通过 Agent 工具派发独立 Agent 执行，PM 不得亲自替代。违规则关口无效。**

| 角色 | 派发时机 | 原因 |
|------|----------|------|
| Security Lead | G2(审设计) + Part2(攻击面汇总+最终评估) | PM 审自己的设计=盲区 |
| Reviewer | G3 交叉审查 | 独立视角是审查唯一价值 |
| QA Engineer | Part2 全量测试 | 测试和修 bug 不能同一人 |
| Reliability Engineer | Part2 修复失败项 | 同上 |

**自检**：每关完成后 PM 自问"这关是独立 Agent 做的还是我自己做的？"→ 自己做的立即补派。

```
Security Lead (方向) → QA Engineer (测试) → Reliability Engineer (修复)
      ↑                                                    ↓
      └────────── 重新评估 ←────── 重测 (≤3轮) ←──────────┘
```

1. **Security Lead** 攻击面分析 + 审查 Architect 设计（安全左移，G2 首次 + Part2 最终）
2. **QA Engineer** 全量回归 + 安全测试 + 边缘场景
3. **Reliability Engineer** 修复失败项（配置/环境/测试），代码bug 回 Developer
4. **3 轮上限**：仍失败 → Security Lead 判定阻塞性 → 通知 Leader 或记录技术债
5. **回退规则**：代码bug → Part 1 Developer · 设计缺陷 → Part 1 Architect

### 多 Agent 协作指南

详见 `docs/project-prepare-md/多agent协作开发unblind.md`。角色分工：
- **你（用户）**：Team Leader，讨论需求、审核方向、最终决策
- **PM Agent（我）**：理解需求 → 派发任务 → 5 个关口逐项查验 → 控制流程。**不得亲自执行 SL/Reviewer/QA/RE 角色工作**。Architect 设计未出不等 Developer。Reviewer 有 CRITICAL 阻断 Part 2 并回退 Developer。QA 失败 3 轮通知 Leader。
- **Subagent 6 角色**：Part 1(Architect→Developer+Reviewer, SL 并行审设计) + Part 2(SL→QA→RE 循环≤3轮)
- **自动触发**：说"多 agent"即启动完整双 pipeline，不漏角色。
- **G3 Reviewer 分工**：3 个 Reviewer 各负责不同维度（安全/代码质量/集成），缩小审查范围避免重复。`CRITICAL` 发现 → 阻断 Part 2 → 退回 Developer 修复 → Reviewer 复审查 → 确认 CLEAN 后才进 Part 2。

### PM 调度规则速查

详见 `docs/project-prepare-md/多agent协作开发unblind.md` 第六章"PM 调度规则：串行 vs 并行"。

**派发前必答两问**：
1. B 的产出依赖 A 的代码/设计？→ **串行**
2. B 和 A 修改同一文件？→ **串行**
3. 都不是 → **并行**

**速记**：只读 Agent 永远并行。Developer 用文件交集 + 模块依赖判定。Part 2 全程串行。

### 提交规范（每次 commit 后强制执行）

1. `git add <files> && git commit -m "..."` — 常规提交
2. **自问**：项目状态变了吗？设计决策新增了吗？测试数变了吗？
3. **如果有变**：立即写记忆文件（`~/.claude/projects/D--My-Projects-unblind/memory/`），记忆文件由 Claude Code 自动持久化，无需 git 管理
4. **如果无变**：跳过
