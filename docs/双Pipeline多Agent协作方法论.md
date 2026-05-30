# 双 Pipeline 多 Agent 协作方法论

> 一个大三学生在开发 AI Agent Skill 时，意外摸索出一套可复用的多 Agent 协作框架。

## 关于作者

我是一名大三下学期在读学生。2026 年 5 月，我在用 Claude Code 开发 [unblind](https://github.com/Santazuki/unblind)——一个为纯文本模型提供视觉能力的 Agent Skill。

开发过程中我逐渐意识到：每次说"多 agent"触发的那套流程——PM 派发任务、双 Pipeline 串行、Reviewer 交叉审查、Part 2 质量门循环——本身就是一个可复用的开发框架。它不绑定 unblind，不依赖特定工具，只是一套关于"一个 PM Agent 怎么管 6 个 Subagent 把代码写好"的规则。

这篇文章记录了这套方法的由来、迭代和最终形态。

## 缘起：为什么需要一套流程

最早我用 Claude Code 开发 unblind 时，就是普通的对话式编程——提需求、AI 写代码、跑测试、修 bug。当项目只有 2-3 个文件时还行。到 Phase 3 扩展到 7 个 Provider 时，单次改动可能涉及 spec 设计、3 个文件实现、安全审查、全量回归测试。在对话里逐件事做，效率很低。

我试着用 Claude Code 的 Agent 工具把任务派发给 Subagent。确实快了——但新问题出现了：

1. **我自己在替 Subagent 干活**——SL 审查设计、QA 跑测试，经常是 PM（我自己对话里的 Claude）顺手就做了，关口形同虚设
2. **不知道什么时候该并行派发**——Developer 全并行导致合并冲突，全串行又浪费时间
3. **Reviewer 重复审查同一批代码**——3 个人都审全部文件，耗 token 还容易遗漏

这些问题的本质是：**缺少一套 PM Agent 的调度规范**。PM 需要知道什么时候派谁、派几个、串行还是并行、什么情况回退。

## 版本演进

### v0：手动派发（最原始状态）

```
我提需求 → Claude 写代码 → 我审 → 改 → 如此循环
```

没有 Subagent，没有角色分工。适合 50 行以内的小改动。

### v1：朴素 Subagent 派发

```
我提需求 → PM 理解 → 派一个 Agent 干全部（设计+实现+测试）
```

开始用 Agent 工具了，但一个 Agent 包揽所有事。设计差、测试漏、安全没人看。

### v2：双 Pipeline 架构

这是第一次质变。从 unblind 的开发流程中抽象出了两个阶段：

**Part 1：开发 Pipeline**

```
Architect（设计）→ Developer（实现）→ Reviewer（审查）
```

Architect 先出设计文档，Developer 照设计写代码，Reviewer 审查代码质量和安全。安全左移——Security Lead 在 Architect 完成后就并行审查设计，不等代码写出来。

**Part 2：质量门（Quality Gate）**

```
Security Lead（攻击面汇总）→ QA Engineer（全量测试）→ Reliability Engineer（修复）→ 重测 ≤ 3 轮
```

Part 1 全部完成且无 CRITICAL 才进 Part 2。SL 汇总攻击面，QA 全量回归，RE 修复失败项。3 轮后仍失败，SL 判定是阻塞还是记录技术债。

**为什么是双 Pipeline？** 因为开发阶段和质量验证有不重叠的阻塞条件。开发阶段可以并行（多个 Developer 写不同文件），但全量测试必须等所有代码就位。Part 1 的快慢不影响 Part 2 的开始条件——Part 2 只看"代码到位 + 审查通过"。

**v2 的问题**：我（PM）经常亲自做 SL/QA/Reviewer 的工作。不是工具不支持，是我潜意识觉得"自己干更快"。结果是关口失效——自己审自己派的活，和没审一样。

### v3：PM 硬约束 + 调度规则 + 三维审查

v2 的框架是对的，但缺少约束力。v3 加了三条规则，把 PM 从"可以遵守"变成"必须遵守"：

**1. PM 硬约束**

PM 禁止亲自执行 SL / Reviewer / QA Engineer / Reliability Engineer 这 4 个角色。必须通过 Agent 工具派发独立 Agent。每关完成后 PM 自问："这关是独立 Agent 做的还是我自己做的？"——自己做的立即补派。

**为什么这很重要**：审查、测试、安全判定的价值在于**独立视角**。PM 自己审自己派的活 = 盲区。

**2. PM 调度规则：串行 vs 并行**

PM 派发前只需回答两个问题：

1. B 的产出依赖 A 的代码/设计？→ 串行
2. B 和 A 修改同一文件？→ 串行
3. 都不是 → 并行

加上 6 条派发前自问清单（硬约束 + 文件冲突 + 模块依赖 + 产出依赖 + 只读豁免 + 阶段顺序），PM 不用猜。

**只读 Agent 永远可并行**：Reviewer 和 SL 只做 Read/Grep，与任何人无冲突。Worktree 隔离不是并行通行证——两个 Dev 改同一个基准文件，隔离也没用。

**3. Reviewer 三维分工**

3 个 Reviewer 各负责一个维度，不交叉覆盖：

| Reviewer | 维度 | 关注点 |
|----------|------|--------|
| #1 | 安全 | API Key 泄露、硬编码 Key、注入、错误消息泄露 |
| #2 | 代码质量 | 接口一致性、DRY、overrides 机制、向后兼容 |
| #3 | 集成 | Provider 数据一致性、调用链兼容、端到端链路 |

CRITICAL 发现 → 阻断 Part 2 → 退回 Developer → **同一 Reviewer 复审查** → 确认才放行。

**为什么是三维**：安全、质量、集成三类问题的审查方法完全不同。安全需要 grep 扫描和攻击面推理，质量需要接口比对和逻辑走读，集成需要数据一致性和调用链验证。让一个人同时做三件事不如三个人各精一项。

**为什么 CRITICAL 要同一个 Reviewer 复审查**：发现问题的 Reviewer 最清楚问题是什么、怎么才算修好。换个 Reviewer 要重新理解上下文，浪费时间。

## 完整框架速查

### 角色清单

| 角色 | Pipeline | 职责 | 权限 |
|------|----------|------|------|
| Architect | Part 1 | 设计方案，输出设计文档 | 只读 |
| Developer | Part 1 | TDD 实现，独立 commit | 读写 |
| Reviewer #1/#2/#3 | Part 1 | 安全/代码质量/集成三维审查 | 只读 |
| Security Lead | G2 + Part 2 | 审设计安全 + 攻击面汇总 + 最终评估 | 只读 |
| QA Engineer | Part 2 | 全量回归 + 安全测试 | 读写（测试文件） |
| Reliability Engineer | Part 2 | 修复失败项（配置/环境/测试） | 读写 |

### 5 个关口

| 关口 | 前置条件 | 不满足时 |
|------|---------|---------|
| G1 | Architect 输出设计文档 | 等 Architect 完成 |
| G2 | **独立 SL Agent** 输出设计审查 | 安全问题回 Architect |
| G3 | **独立 Reviewer Agent** 无 CRITICAL | 阻断 Part 2，回 Developer，同一 Reviewer 复审查 |
| G4 | **独立 QA Agent** 全量测试 PASS | 派 RE 修复（≤3 轮） |
| G5 | 3 轮后 **独立 SL Agent** 判定 | 通知 Leader 决策 |

### 派发前 PM 自问清单

1. 这个角色我能不能亲自做？（SL/Reviewer/QA/RE → 不能）
2. 如果派多个 Developer，文件路径清单有交集吗？
3. 有谁 import 另一个将创建的模块？
4. 这个 Agent 是否需要前一个 Agent 的产出？
5. 这个 Agent 是只读的吗？（是 → 自动与所有人并行）
6. Part 1 没走完能进 Part 2 吗？（不能）

### 记忆口诀

```
只读一定并行，写操作用文件判。
无交无依赖并行，有交有依赖串行。
Part 2 全程串行，CRITICAL 必回退。
PM 不得亲自做，自己审自己是盲区。
```

## 实战案例：unblind Provider v3.0 重构

以下是这套方法在 unblind Provider 层重构中的完整执行记录。

### 背景

将 Provider 层从模板方法模式（BaseProvider + 3 子类）重构为协议驱动架构（PROTOCOLS + GenericProvider + 纯数据 Registry）。涉及：新建 2 个文件，删除 3 个文件，修改 4 个文件。

### 执行过程

**G1 — Architect 设计**：PM 与 Leader 对齐需求后，Architect 输出 Spec 和 Plan，共 228 + 1613 行。

**G2 — SL 安全左移**：独立 SL Agent 审查 spec + plan，发现 1 MEDIUM（协议对象可变）。Leader 判定"不要过度设计"，放行。

**Part 1 实施 — 并行派发 3 个 Developer**：

| Dev | 任务 | 涉及文件 | 判定 |
|-----|------|----------|:---:|
| #1 | protocols.js + test-protocols.js | 新建 2 个文件 | 无交集 → 并行 |
| #2 | generic-provider.js + test-generic-provider.js | 新建 2 个文件 | 无交集 → 并行 |
| #3 | httpClient + registry + orchestrator | 修改 3 个已存在文件 | 无交集 → 并行 |

3 个 Dev 全并行，各自在独立 worktree 中工作。事后 cherry-pick 合并，冲突仅发生在 Dev #2/#3 创建的桩文件上，用 Dev #1 的正式版本覆盖解决。

**G3 — Reviewer 三维审查**：

| Reviewer | 发现 |
|----------|------|
| #1 安全 | 2 HIGH — `parsed.message` 透传 API 错误 |
| #2 代码质量 | 2 HIGH + 1 MEDIUM — parseError 绕过 `_call` + Mimo baseUrl 为空 |
| #3 集成 | 1 CRITICAL + 2 HIGH — Mimo baseUrl 同一问题，确认修复方向 |

**G3 回退**：CRITICAL 阻断 Part 2 → Dev #3 修复 → Reviewer #3 复审查 → 确认 3 项全部 FIXED → 进入 Part 2。

**Part 2 质量门**：

```
SL 攻击面汇总（CLEAN）→ QA 全量测试（163 pass, 0 fail）→ 无需 RE → SL 最终评估 → CLEAN
```

全程 1 轮过。

### 最终指标

| 指标 | 重构前 | 重构后 |
|------|:---:|:---:|
| 模块 | 16 | 15 |
| 测试 | 95 | 171 |
| 代码行（Provider 层） | ~347 | ~290 |
| 新增 Provider | 写 build 函数 | 加 1 行数据 |

## 最佳实践

### 重构后全量扫描

每次重大重构完成后，系统性 grep 旧类名、旧模块数、旧测试数，逐文件修复。覆盖：

- 源码（`scripts/`）
- 测试（`tests/`）
- README / SKILL.md / package.json
- CLAUDE.md
- 记忆文件（`memory/`）

unblind v3.0 重构中，这一轮扫描发现了 30+ 处过时引用。其中 memory/project-state.md 的模块数和测试数是 AI 在新对话中理解项目状态的关键入口——如果这俩没更新，新对话中的 Claude 会基于错误信息做决策。

**检查清单**：

| 扫描目标 | 搜索模式 |
|----------|----------|
| 旧类名 | `MimoProvider`、`OpenAIProvider` |
| 旧文件名 | `mimo.js`、`openai.js`、`gemini.js` |
| 旧模块数 | `16 模块`、`16模块` |
| 旧测试数 | `93 pass`、`95 test` |
| 旧版本号 | `version: "2.x"` |
| 关键文件 | `grep -rn "old_pattern" README.md SKILL.md CLAUDE.md package.json` |

这套检查适合在 Part 2 QA 通过后作为最后一道防线执行，确保没有"僵尸引用"残留。

## 适用场景与局限

### 适用

- 中等复杂度以上的项目（>5 个模块，多人或多次 Agent 协作）
- 有明确安全要求的项目（处理 API Key、用户输入、外部服务）
- 需要频繁重构的项目（双 Pipeline 的回退机制天然适配迭代）

### 不适用

- 单文件小工具、配置修改、文档更新——直接对话更快
- 紧耦合的单体架构（所有文件相互依赖，无法并行 Developer）
- 单人快速原型阶段——v0/v1 就够用

### 需要的工具支持

- Agent 工具（派发独立 Subagent）
- Worktree 或分支隔离（并行 Developer 不互相覆盖）
- 一个能理解关口规则并严格执行的 PM Agent（目前用 CLAUDE.md + 记忆文件约束）

## 附录 A：CLAUDE.md 模板骨架

以下是可复用的 CLAUDE.md 多 Agent 协作段。复制到你的项目 CLAUDE.md 中，按需调整角色名和工具。

```markdown
### 多 Agent 协作

采用双 Pipeline 多 Agent 协作模式。

**角色**：Leader（你）→ PM Agent（我）→ 6 个 Subagent：
Part 1: Architect → Developer + Reviewer (SL 并行审设计)
Part 2: SL → QA → RE (≤3 轮)

**PM 硬约束**：SL / Reviewer / QA / RE 必须通过 Agent 工具派发独立 Agent，PM 不得亲自替代。
每关完成后自问："这关是独立 Agent 做的还是我自己做的？"

**5 关口**：G1(设计出) → G2(SL审设计) → G3(Reviewer无CRITICAL) → G4(QA全绿) → G5(SL最终判)

**派发前必答两问**：
1. B 的产出依赖 A 的代码？→ 串行
2. B 和 A 修改同一文件？→ 串行
3. 都不是 → 并行

**Reviewer 分工**：3 个 Reviewer 各负责安全/代码质量/集成一个维度。
CRITICAL → 阻断 Part 2 → 回 Developer → 同一 Reviewer 复审查 → CLEAN 才进 Part 2。

**回退规则**：代码 bug → Developer · 设计缺陷 → Architect · 配置/环境/测试 → RE
```

## 附录 B：PM 调度 Skill

`pm-dispatch` skill — 输入任务列表，输出并行/串行判定和派发顺序。

详见 [`skills/pm-dispatch.md`](../skills/pm-dispatch.md)。

---

> 这套方法是在 unblind 开发中自然生长出来的。它不是教科书上的理论，是一个学生在实际项目里踩了坑、修了 bug、迭代了三个版本之后沉淀下来的东西。如果它对你有用，或者你觉得哪里可以改进，欢迎提 issue。
