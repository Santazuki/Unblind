---
name: pm-dispatch
description: >
  PM 调度决策 skill。输入任务列表和文件路径，输出并行/串行判定和派发顺序。
  触发: "帮我排一下任务顺序"、"哪些可以并行"、"dispatch plan"、
  "派发计划"、"调度"、"多agent派发"。
model: inherit
---

# PM Dispatch — 多 Agent 调度决策

## 概述

帮 PM 决定：哪些 Agent 可以同时派发（并行），哪些必须等前一个完成（串行）。

## 输入格式

PM 提供任务列表，每个任务包含：

```yaml
tasks:
  - id: Dev-1
    role: Developer
    description: 实现 protocols.js
    files:
      create: [scripts/lib/providers/protocols.js]
    dependencies: []  # 依赖其他 task 的 id
  - id: Dev-2
    role: Developer
    description: 修改 httpClient
    files:
      modify: [scripts/lib/httpClient.js]
    dependencies: []
  - id: QA-1
    role: QA Engineer
    description: 全量测试
    files: []
    dependencies: [Dev-1, Dev-2]  # 必须等这两个完成
```

## 判定规则

### 核心两问

| 问题 | 回答 | 结论 |
|------|------|------|
| B 的产出依赖 A 的代码/设计？ | 是 | **串行**：A → B |
| A 和 B 修改同一文件？ | 是 | **串行**：任意顺序，但不同时 |
| 都不是 | — | **并行** |

### 只读豁免

Reviewer、Security Lead 只做 Read/Grep/Glob，不写文件 → **永远可并行**，与任何人无冲突。

### 角色默认模式

| 角色 | 默认 |
|------|:---:|
| Architect ×N | 并行 |
| Developer ×N | 逐任务判定 |
| Reviewer ×N | 并行 |
| Part 2 (SL→QA→RE) | 串行 |
| 安全审计 R1 | 并行 |
| 安全审计 R2/R3 | 串行 |

## 输出格式

```
## Dispatch Plan

### 第 1 轮（并行）
  Dev-1: [任务描述] — 文件无冲突
  Dev-3: [任务描述] — 文件无冲突

### 第 2 轮（等第 1 轮完成后）
  Dev-2: [任务描述] — import Dev-1 的输出模块

### 第 3 轮（等所有 Dev 完成后）
  Reviewer#1: 安全审查
  Reviewer#2: 代码质量审查
  Reviewer#3: 集成审查

### 第 4 轮（等 Reviewer 无 CRITICAL 后）
  QA-1: 全量测试
```

## 检查清单

对每轮调度输出以下信息：

1. **文件交集矩阵**：每个 Dev 的文件路径清单 + 交集检测
2. **依赖图**：A → B 表示 B 依赖 A 的产出
3. **并行组**：标记哪些可以在同一轮派发
4. **阻塞条件**：每个串行边界的前置条件

## 注意事项

- Worktree 隔离不能替代文件交集检查。两个 Dev 改同一基准文件，worktree 隔离没用。
- 显式声明的 `dependencies` 优先于文件交集检测。
- 如果 PM 把自己放进任务列表里的 SL/Reviewer/QA/RE 角色，**拒绝并提示 PM 硬约束**。
