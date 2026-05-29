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

输出格式：`[CRITICAL/WARNING/INFO] 文件:行号 — 问题描述 — 修复建议`

两类输出：
- **功能问题** → 传递给 Part 2 Security Lead
- **代码质量问题** → Developer 直接修复

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
description: 安全负责人，启发性漏洞预判、攻击面分析、最终评估、协调功能问题修复。
tools: Read, Grep, Glob
model: deepseek-v4-pro
---
```

职责：方向制定 → 接收 Reviewer 功能问题 → 最终评估 → CLEAN 或重开循环。

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
Part 1: Architect → Developer → Reviewer
                              │
                    ┌─ CRITICAL? → Developer
                    └─ 通过 → 问题清单
                                    │
Part 2: Security Lead ←────────────┘
           │
           ▼
        QA Engineer ──→ PASS? → SL 评估 → 提交
           │                                 ↑
           │ FAIL                            │
           ▼                                 │
        RE 诊断                             │
        ├── 可修 → 修复 → QA 重测 ──→ (≤3轮) ┘
        ├── 代码bug → 退回 Developer
        └── 设计缺陷 → 退回 Architect

3轮上限:
  ├── 非阻塞 → known-issues.md → SL 标记 CLEAN → 提交
  └── 阻塞性 → 通知 Leader 决策
```

**PM Agent 在 5 个关口逐项查验，控制流程流转。**

## 五、PM 关口（保证流程执行）

PM Agent 在 5 个关口逐项查验，不满足不派下一个 Agent：

| 关口 | 前置条件 | 不满足时 |
|------|---------|---------|
| G1 | Architect 输出了 `docs/design/<feature>.md` | 等 Architect 完成 |
| G2 | SL 输出设计审查意见 | 设计安全问题回 Architect |
| G3 | Reviewer 无 CRITICAL | 阻断 Part 2，回 Developer |
| G4 | QA 全量测试 PASS | 派 RE 修复（≤3轮） |
| G5 | 3轮后 SL 判定阻塞性 | 通知 Leader 决策 |

## 六、回退规则

| 失败类型 | 谁修 | 回退到 |
|---------|------|--------|
| CI 配置 / 环境 / 版本 | RE | 本轮继续 |
| 测试断言过时 | RE | 本轮继续 |
| 代码逻辑 bug | Developer | Part 1 |
| 设计缺陷 / 接口断裂 | Architect | Part 1 从头开始 |

## 七、CRITICAL 阻断规则

Reviewer 发现以下任一 → **阻断 Part 2**：

| 类型 | 示例 |
|------|------|
| 安全漏洞 | 硬编码 Key、注入点 |
| 逻辑错误 | 数据损坏、状态机错误 |
| 接口断裂 | Provider 签名变更未同步 |

WARNING/INFO 不阻断。

## 八、Token 优化

| 策略 | 说明 |
|------|------|
| SL+Architect 并行 | 同读设计文档，不额外等待 |
| Review 输出复用 | 问题清单直喂 Security Lead |
| Blackboard 同步 | 文件即状态，不实时消息 |
| SL 只读 | 不写代码，省 Write 开销 |

## 五、相关文档

- `CLAUDE.md` — 实时状态 + 开发约定
- `docs/design/multi-agent-usage-proof.md` — Agent 使用记录
- `docs/design/agent-engineering-review.md` — 简历资格评审
