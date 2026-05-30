# 用多 Agent 协作开发 Unblind 的实践指南

> **角色定义**：
> - **你（用户）**：项目开发者，Team Leader。与 PM Agent 讨论需求、审核方向、做最终决策。
> - **PM Agent（当前对话的 Claude）**：项目经理。理解需求后派发任务给其他 Agent，逐关查验，控制流程。
> - **Subagent 团队**：Architect / Developer / Reviewer / Security Lead / QA Engineer / Reliability Engineer，接收 PM 派发的任务，完成后回报。
>
> **模型**：设计/审查用 `deepseek-v4-pro`，实现/测试用 `deepseek-v4-flash`。

## 一、双 Pipeline 架构

```
Part 1: 开发 Pipeline (串行)          Part 2: Quality Gate (循环)
─────────────────────────────        ────────────────────────────
Architect → Developer → Reviewer     Security Lead → QA Engineer
              ↑                          ↓               ↓
              └── 代码问题直接修复    Reliability Engineer ←──┘
                                          ↑_______↓
                                          (循环至 CLEAN)
```

### 角色清单（6 个）

| 角色 | Pipeline | 职责 | 工具权限 |
|------|----------|------|---------|
| **Architect** | Part 1 | 设计文档，输出到 `docs/design/` | Read, Grep, Glob |
| **Developer** | Part 1 | TDD 实现，独立 commit | Read, Write, Edit, Bash |
| **Reviewer** | Part 1 | 代码审查，输出功能/质量问题清单 | Read, Grep, Glob |
| **Security Lead** | Part 2 | 方向制定、攻击面分析、最终评估 | Read, Grep, Glob |
| **QA Engineer** | Part 2 | 全量回归、安全测试、边缘场景、功能验证 | Read, Write, Bash |
| **Reliability Engineer** | Part 2 | 修复失败项、CI/CD、版本管理、部署验证 | Read, Write, Edit, Bash |

### 角色合并说明

| 旧角色 | 合并到 |
|--------|--------|
| Tester + Test Engineer | → QA Engineer |
| Security Expert | → Security Lead（扩展：接收功能问题、最终评估） |
| DevOps Engineer | → Reliability Engineer |

## 二、Part 1: 开发 Pipeline（串行）

```
Architect ×N（并行设计）
    ↓
Developer ×N + Reviewer ×N（交叉审查）
    ↓
问题清单（功能 → Part 2 / 代码 → 回 Developer）
```

### Architect

```yaml
---
name: architect
description: 架构师，负责方案设计、技术选型。不编写代码。
tools: Read, Grep, Glob
model: deepseek-v4-pro
---
```

核心职责：分析需求 → 设计方案 → 输出 `docs/design/<feature>.md`

### Developer

```yaml
---
name: developer
description: 开发者，负责编码实现、单元测试。
tools: Read, Write, Edit, Bash, Grep, Glob
model: deepseek-v4-flash
---
```

核心职责：读设计文档 → TDD 实现 → 独立 commit → `node --test`

### Reviewer

```yaml
---
name: reviewer
description: 审查员，检查代码质量、安全性。只读模式。
tools: Read, Grep, Glob
model: deepseek-v4-pro
---
```

**分工策略**：3 个 Reviewer 各负责一个维度，不交叉覆盖，缩小审查范围加速执行。

| Reviewer | 审查维度 | 关注点 |
|----------|----------|--------|
| #1 安全 | API Key 泄露、硬编码 Key、注入、错误消息泄露 | 安全红线 5 条 |
| #2 代码质量 | 接口一致性、DRY、overrides 机制、向后兼容 | 逻辑正确性 |
| #3 集成 | Provider 数据一致性、开关行为、调用链兼容 | 端到端链路 |

输出格式：`[CRITICAL/HIGH/MEDIUM] 文件:行号 — 问题描述 — 修复建议`

**CRITICAL 处理流程**：
1. Reviewer 发现 CRITICAL → 阻断 Part 2
2. PM 将对应 Developer 任务标记为 in_progress
3. Developer 修复 → 提交
4. **同一 Reviewer 复审查** → 确认 CRITICAL 已消除
5. 才可进入 Part 2

WARNING/INFO 不阻断。

## 三、Part 2: Quality Gate — Guardian Trio（循环）

```
Security Lead（方向 + 接收 Reviewer 问题）
    ↓
QA Engineer（测试 + 回归 + 安全验证）
    ↓ (失败)
Reliability Engineer（修复）
    ↓
QA Engineer（重测）
    ↓ (通过)
Security Lead（最终评估）
    ↓ (仍有问题 → 重复循环 / CLEAN → 提交)
```

### Security Lead

```yaml
---
name: security-lead
description: 安全负责人，启发性漏洞预判、攻击面分析、最终评估。
tools: Read, Grep, Glob
model: deepseek-v4-pro
---
```

**双重出场**：SL 在两个关口出现，不可合并或跳过。

| 出场 | 时机 | 职责 |
|------|------|------|
| **G2** | Architect 设计完成后 | 审查设计安全（安全左移），输出文件:行号+严重度 |
| **Part 2** | QA 测试通过后 | 汇总攻击面 → 最终评估 → CLEAN 或重开循环 |

职责：G2 审设计安全 → Part 2 汇总攻击面 → 最终评估 → CLEAN 或重开循环。

### QA Engineer

```yaml
---
name: qa-engineer
description: QA 工程师，全量回归、安全测试、边缘场景、功能验证。
tools: Read, Write, Edit, Bash, Grep, Glob
model: deepseek-v4-flash
---
```

职责：`node --test tests/test-*.js` → 分析失败 → 输出报告到 `docs/test-results/`

### Reliability Engineer

```yaml
---
name: reliability-engineer
description: 可靠性工程师，修复测试失败、CI/CD 排障、版本管理、部署验证。
tools: Read, Write, Edit, Bash, Grep, Glob
model: deepseek-v4-pro
---
```

职责：修复失败项 → 推送 → 检查 CI → 循环至绿。

## 四、完整流程

```
你（Leader）提需求
      ↓
PM Agent 派发任务
      ↓
┌─ Part 1 ──────────────────────────────────────┐
│  Architect → docs/design/<feature>.md          │
│      ↓                ↓                        │
│      │        Security Lead 并行审查设计        │   ← 安全左移
│      │                │                        │
│      │         设计安全问题? → 回 Architect     │
│      ↓                                         │
│  Developer ×N ──→ 代码变更                     │
│      ↓                                         │
│  Reviewer ×N (交叉审查)                         │
│      ↓                                         │
│  ├─ CRITICAL? → 阻断 Part 2，回 Developer      │
│  ├─ 代码问题 → Developer 修复                  │
│  └─ 功能问题 → 问题清单 → 传递给 Part 2        │
└────────────────────────────────────────────────┘
      ↓
┌─ Part 2: Quality Gate ────────────────────────┐
│  Security Lead (汇总攻击面 + 功能问题)          │
│      ↓                                         │
│  QA Engineer → node --test                     │
│      ├─ PASS → 报告                            │
│      └─ FAIL → RE 诊断                         │
│           ├─ 可修(配置/环境/测试) → 修复       │
│           ├─ 代码bug → 退回 Part 1 Developer   │
│           └─ 设计缺陷 → 退回 Part 1 Architect  │
│      ↓                                         │
│  QA 重测 (≤3轮)                                 │
│      ↓                                         │
│  3轮后仍失败:                                   │
│      ├─ 非阻塞 → known-issues.md → CLEAN       │
│      └─ 阻塞性 → 通知你(Leader)决策            │
│      ↓                                         │
│  Security Lead 最终评估 → CLEAN                │
└────────────────────────────────────────────────┘
      ↓
提交 + CLAUDE.md 更新 + 记忆持久化
```

## 五、PM 关口（保证流程执行）

PM Agent 在 5 个关口逐项查验，不满足不派下一个 Agent：

| 关口 | 前置条件 | 不满足时 |
|------|---------|---------|
| G1 | Architect 输出了 `docs/design/<feature>.md` | 等 Architect 完成 |
| G2 | **独立 SL Agent** 输出设计审查意见 | 设计安全问题回 Architect |
| G3 | **独立 Reviewer Agent** 无 CRITICAL | 阻断 Part 2，回 Developer，同一 Reviewer 复审查 |
| G4 | **独立 QA Agent** 全量测试 PASS | 派 RE 修复（≤3轮） |
| G5 | 3轮后 **独立 SL Agent** 判定阻塞性 | 通知 Leader 决策 |

### PM 硬约束

**PM Agent 禁止亲自执行以下角色，必须通过 Agent 工具派发独立 Agent。违规则关口无效。**

| 角色 | 工具 | 触发时机 | 违规自检 |
|------|------|----------|----------|
| Security Lead | `Agent(subagent_type="Explore")` | G2(审设计) + Part2(攻击面+评估) | "SL 报告是我写的还是独立 Agent 写的？" |
| Reviewer | `Agent(subagent_type="Explore")` | G3(交叉审查) | "审查结论是我 grep 出来的还是独立 Agent 出的？" |
| QA Engineer | `Agent` | Part2(全量测试) | "测试是我跑的 node --test 还是独立 Agent 跑的？" |
| Reliability Engineer | `Agent` | Part2(修复失败) | "修复是独立 Agent 做的还是我手动改的？" |

**为什么**：审查、测试、安全判定的价值在于**独立视角**。PM 自己审自己派的活 = 盲区。这是双 Pipeline 模式的核心保障。

## 六、PM 调度规则：串行 vs 并行

> **本章解决的核心问题**：PM 在派发任务时，哪些 Agent 可以同时派发（并行），哪些必须等前一个完成后再派（串行）。这是双 Pipeline 实践中**最容易出错的决策点**——并行派错会导致合并冲突、逻辑断裂；串行派错会浪费 Token 和时间。

### 核心原则

PM 做并行/串行决策时，只需回答两个问题：

| 问题 | 回答 | 结论 |
|------|------|------|
| 任务 B 的**产出**是否依赖任务 A 的**代码/设计**？ | 是 | **必须串行**：A 完成后 B 才能开始 |
| 任务 A 和任务 B 是否修改**同一文件**？ | 是 | **必须串行**：即使 worktree 隔离，合并时冲突不可避免 |
| 以上两个问题均回答"否" | — | **可以并行** |

**只读 Agent 永远可并行**：Reviewer 和 Security Lead 只做 Read/Grep/Glob，不写文件，因此彼此之间、与任何其他 Agent 之间均无冲突风险，可以任意并行。

**Worktree 不是并行通行证**：即使每个 Developer 使用独立的 `isolation="worktree"`，如果两个 Developer 修改同一基准文件（如都改 `orchestrator.js`），合并时必然产生冲突。Worktree 解决的是**工作区隔离**，不是**逻辑冲突**。

### Agent 并行/串行判定总表

| Agent 组 | 默认模式 | 可并行条件 | 必须串行条件 | 决策人 |
|----------|:---:|------------|-------------|:---:|
| **Architect ×N** | 并行 | 各 Architect 输出独立的设计文档（不同文件路径） | 两个 Architect 修改同一份已有设计文档 | PM |
| **SL(G2) + Architect** | 并行 | SL 审设计是只读，与 Architect 写设计互不冲突 | — | 自动 |
| **Developer ×N** | **逐任务判定** | 文件路径无交集 + 无模块导入依赖 | 修改同一文件 / Dev B import Dev A 的输出 | **PM 必须逐任务判定** |
| **Reviewer ×N** | 并行 | 只读 + 审查维度不同（安全 / 代码质量 / 集成） | — | 自动 |
| **Reviewer ×N + Developer** | 并行 | Reviewer 只读，不阻塞 Developer 修复其他问题 | Reviewer 发现 CRITICAL → Developer 暂停新任务，先修 CRITICAL | PM |
| **Part 2: SL → QA → RE** | 串行 | — | SL 方向是 QA 测试依据，QA 失败是 RE 修复目标。严格顺序依赖 | 自动 |
| **安全审计 Round 1** | 并行 | 3 审计员各扫不同维度（Key 泄露 / 注入 / 日志），只读 | — | 自动 |
| **安全审计 Round 2/3** | 串行 | — | R2 基于 R1 修复结果，R3 确认 R2 无遗漏 | 自动 |

### Developer 并行决策流程（重点）

**PM 派发 Developer 前必做检查清单：**

```
Step 1: 列出每个 Dev 任务涉及的文件路径（增/改/删）
        ↓
Step 2: 检查文件交集
        → 有交集？ → 必须串行（标记冲突文件，确定先后顺序）
        → 无交集？ → 进入 Step 3
        ↓
Step 3: 检查模块导入依赖
        → Dev B 是否 import Dev A 将创建或修改的模块？
        → 是 → A 必须在 B 之前完成（串行，A → B）
        → 否 → 进入 Step 4
        ↓
Step 4: 输出判定
        → 无交集 + 无依赖 → 可以并行派发
        → 有交集或有依赖 → 必须串行，标注顺序
```

**判定示例：**

| 场景 | Dev | 涉及文件 | 判定 |
|------|-----|----------|:---:|
| 可并行 | A: 创建 `protocols.js` | `scripts/lib/providers/protocols.js`（新建） | 文件无交集，无导入依赖 |
|  | B: 修改 `httpClient.js` | `scripts/lib/httpClient.js`（修改） | |
| 必须串行 | A: 创建 `protocols.js` | `scripts/lib/providers/protocols.js`（新建） | `generic-provider.js` import PROTOCOLS |
| (模块依赖) | B: 创建 `generic-provider.js` | `scripts/lib/providers/generic-provider.js`（新建） | → A 先于 B |
| 必须串行 | A: 修注册逻辑 | `scripts/lib/providers/registry.js`（修改） | 同一文件 |
| (文件冲突) | B: 加新条目 | `scripts/lib/providers/registry.js`（修改） | |

**文件路径声明规范**：PM 派发 Developer 时，任务描述中必须包含明确的文件路径清单，据此执行上述检查。

### 各 Pipeline 阶段总览

| 阶段 | Agent | 模式 | 备注 |
|------|-------|:---:|------|
| G0 设计 | Architect ×N | **并行** | 各输出独立设计文档 |
| G2 安全左移 | SL | **单独**（与 G0 并行） | 只读，不阻塞 Architect |
| G0↺ 设计修复 | Architect | **串行**（等 SL 完成） | SL 发现安全问题 |
| G1 实现 | Developer ×N | **逐任务判定** | 按 Developer 决策流程 |
| G3 审查 | Reviewer ×N | **并行**（可与 Dev 并行） | 只读，各审不同维度 |
| G3↺ CRITICAL | Developer | **串行**（暂停其他 Dev） | 同一 Reviewer 复审查 |
| Part 2 测试 | QA Engineer | **单独**（串行） | 等全部代码就位 |
| Part 2 修复 | RE | **单独**（串行） | QA 失败才触发 |
| Part 2 重测 | QA → RE | **循环串行**（≤3轮） | 每轮 QA 测 → RE 修 |
| Part 2 评估 | SL | **单独**（串行） | 最终 CLEAN 判定 |
| 安全审计 R1 | 审计员 ×3 | **并行** | 只读，各扫不同维度 |
| 安全审计 R2/R3 | 审计员 ×1 | **串行** | 基于上轮修复结果 |

**记忆口诀**：`只读一定并行，写操作用文件判。无交无依赖并行，有交有依赖串行。Part2 全程串行。`

### 派发前 PM 自问清单

每次准备派发 Agent 前，PM 逐条确认：

1. **[硬约束]** 这个角色我能不能亲自做？（SL/Reviewer/QA/RE → 必须独立 Agent）
2. **[文件冲突]** 如果派多个 Developer，它们的文件路径清单有交集吗？
3. **[模块依赖]** 如果派多个 Developer，有谁 import 另一个将创建的模块？
4. **[产出依赖]** 这个 Agent 是否需要前一个 Agent 的产出？
5. **[只读豁免]** 这个 Agent 是只读的吗？（Reviewer/SL → 自动与所有人并行）
6. **[阶段顺序]** Part 1 没走完能进 Part 2 吗？（不能 — G3 无 CRITICAL 是准入条件）

6 条全部确认无误后再派发。

## 七、回退规则

| 失败类型 | 谁修 | 回退到 |
|---------|------|--------|
| CI 配置 / 环境 / 版本 | RE | 本轮继续 |
| 测试断言过时 | RE | 本轮继续 |
| 代码逻辑 bug | Developer | Part 1 |
| 设计缺陷 / 接口断裂 | Architect | Part 1 从头开始 |

## 八、CRITICAL 阻断规则

Reviewer 发现以下任一 → **阻断 Part 2**：

| 类型 | 示例 |
|------|------|
| 安全漏洞 | 硬编码 Key、注入点 |
| 逻辑错误 | 数据损坏、状态机错误 |
| 接口断裂 | Provider 签名变更未同步 |

WARNING/INFO 不阻断。

## 九、Token 优化

| 策略 | 说明 |
|------|------|
| SL+Architect 并行 | 同读设计文档，不额外等待 |
| Review 输出复用 | 问题清单直喂 Security Lead |
| Blackboard 同步 | 文件即状态，不实时消息 |
| SL 只读 | 不写代码，省 Write 开销 |

## 十、相关文档

- `CLAUDE.md` — 实时状态 + 开发约定
- `docs/design/multi-agent-usage-proof.md` — Agent 使用记录
- `docs/design/agent-engineering-review.md` — 简历资格评审
