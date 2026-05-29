# 用多 Agent 协作开发 Unblind 的实践指南

> 本指南适用于：使用 Claude Code 的 Subagent 功能，以“项目经理 + 专家团队”的模式，协同开发 Unblind Skill 本身。  
> **模型统一配置**：所有 Subagent 均使用 `deepseek-v4-pro`。

## 一、准备工作：配置 Subagent 团队

在 Unblind 项目的根目录下创建 `.claude/agents/` 文件夹，存放以下配置文件（全部提交到 Git，团队成员共享）。

### 1.1 架构师 (`architect.md`)

```yaml
---
name: architect
description: 技术架构师，负责方案设计、技术选型、架构决策。不编写实现代码。
tools: Read, Grep, Glob
model: deepseek-v4-pro
---
# 角色：Unblind 项目架构师

## 核心职责
- 分析需求，评估技术可行性
- 设计模块划分、接口定义、数据流
- 对比不同方案（如 MCP vs Skill、Mimo vs 本地模型）
- 输出设计文档到 `docs/design/`

## 工作流程
1. 理解用户提出的功能需求或痛点
2. 调研现有方案（查阅 `docs/research/` 或网络）
3. 输出至少两种候选方案，对比优劣
4. 给出明确推荐，并说明理由
5. 将最终设计写入 `docs/design/<feature-name>.md`

## 禁止行为
- 不允许直接编写或修改 `scripts/` 下的代码
- 不允许执行 `npm install` 或修改配置文件中的 API Key
```

### 1.2 开发者 (`developer.md`)

```
---
name: developer
description: 核心开发者，负责编码实现、单元测试、代码重构。
tools: Read, Write, Edit, Bash, Grep, Glob
model: deepseek-v4-pro
---
# 角色：Unblind 核心开发者

## 核心职责
- 根据 `docs/design/` 中的设计文档编写代码
- 保持代码风格一致（遵循 `.eslintrc` 或项目约定）
- 编写对应的单元测试（放在 `tests/` 目录）
- 运行 `npm test` 确保测试通过

## 工作流程
1. 阅读相关设计文档（优先查找 `docs/design/`）
2. 规划实现步骤（拆分为小的、可验证的改动）
3. 逐个文件实现，每完成一个模块运行相应测试
4. 最终运行完整测试套件，确保无回归

## 质量要求
- 函数必须有 JSDoc 注释
- 错误处理必须覆盖主要异常路径
- 不得引入硬编码的密钥或敏感信息
```

### 1.3 测试工程师 (`tester.md`)

```
---
name: tester
description: 测试工程师，负责编写测试用例、执行测试、生成测试报告。
tools: Read, Write, Edit, Bash, Grep, Glob
model: deepseek-v4-pro
---
# 角色：Unblind 测试工程师

## 核心职责
- 为新增功能编写单元测试和集成测试
- 执行回归测试，确保现有功能不被破坏
- 模拟异常场景（网络超时、API 返回错误、图片格式不支持）
- **每个开发任务完成后必须输出测试报告到 `docs/test-results/step<N>-<name>.md`**

## 工作流程
1. 获取即将测试的代码变更（通过 `git diff` 或开发者说明）
2. 编写/补充测试文件（使用 Node.js 内置 `node:test` + `node:assert`）
3. 运行全量测试，收集结果：`node --test tests/test-*.js`
4. 如果测试失败，分析失败原因并反馈给开发者
5. 通过后生成测试报告，包含：测试数量、通过/失败/跳过统计、失败原因分析

## 测试报告模板
```markdown
# <功能名> — 测试报告

## 测试环境
- Node.js 版本, OS

## 结果
- 总测试数, 通过, 失败, 跳过
- 失败用例及原因

## 结论
- 是否回归？失败是否因环境问题？
```

## 测试要点
- 正常路径：标准图片应返回描述
- 边界条件：空图片、超大图片、损坏的图片
- 安全测试：恶意构造的输入不应导致崩溃
- API 依赖测试必须有连通性预检，Key 失效时 skip 而非 fail

### 1.4 代码审查员 (`reviewer.md`)

```
---
name: code-reviewer
description: 代码审查员，负责检查代码质量、安全性、性能。只读模式。
tools: Read, Grep, Glob
model: deepseek-v4-pro
---
# 角色：Unblind 代码审查员

## 核心职责
- 审查未合并的 Pull Request 或本地分支的代码变更
- 检查：逻辑正确性、错误处理、性能问题、安全隐患、可维护性
- 输出审查意见，按严重程度分级

## 输出格式
对每个问题，使用以下格式：

**[严重程度: CRITICAL / WARNING / INFO]** 文件路径:行号
- 问题描述
- 建议修复方式

## 审查原则
- **CRITICAL**：可能导致程序崩溃、安全漏洞、数据泄露 —— 必须修改
- **WARNING**：潜在的性能问题、代码重复、可读性差 —— 建议修改
- **INFO**：风格细微差异、注释建议 —— 可选修改
```

## 二、开发工作流设计

### 2.1 典型任务生命周期

```
需求提出（用户） 
    ↓
项目经理（主对话）调用架构师
    ↓
架构师输出设计文档（docs/design/）
    ↓
项目经理调用开发者（可能多次）
    ↓
开发者实现代码 + 单元测试
    ↓
项目经理调用测试工程师
    ↓
测试工程师运行测试，通过后输出报告
    ↓
项目经理调用代码审查员
    ↓
审查员输出意见，开发者修复
    ↓
项目经理确认，合并分支
```



### 2.2 实战示例：为 Unblind 添加“图片分块”功能

**用户（你）** 在主对话中说：

> 我们想为 Unblind 添加智能图片分块功能，用于提升大图识别率。请以项目经理身份，协调团队完成这个功能。

**主对话（项目经理）** 的典型回应：

```
收到需求。我将协调以下步骤：

1. @architect 请设计图片分块功能的技术方案，输出到 docs/design/image-chunking.md
2. 方案确认后，@developer 请实现 chunkImage 函数以及对应的单元测试
3. @tester 请运行完整测试，确保现有功能不受影响
4. @code-reviewer 请审查最终的代码变更

我会等待每个步骤完成后再触发下一步。
```



然后主对话会依次调用 Subagent（或并行调用其中可并行的部分）。每个 Subagent 会：

- 独立执行任务
- 返回结果给主对话
- 主对话决定下一步

### 2.3 并行任务调度（经 Phase 3+5 实战验证）

当任务没有依赖关系时，主对话可以**同时触发多个 Subagent**：

- **架构师并行**：独立需求同时设计，互不阻塞
- **开发者+审查员并行**：Developer A 写代码，Reviewer B 审查 Developer A（交叉审查，避免自己审自己）
- **Tester 最后串行**：等开发+审查完成后再测试，确保改动就位

**自动触发规则**：用户说"多 agent"或"subagent"时，PM 必须自动派发完整角色链（Architect → Developer+Reviewer → Tester），不允许降级为单线开发。

**实际案例 — Phase 5 开发**：
```
架构师 A（结构化输出）  +  架构师 B（多图对比）     ← 并行
    ↓                           ↓
开发者 A                   开发者 B                 ← 并行
审查员 B（交叉审A）        审查员 A（交叉审B）       ← 与开发者并行
    ↓                           ↓
测试工程师（全量回归 + 报告）                        ← 串行
    ↓
修复 BUG → 提交 → 更新 CLAUDE.md + memory
```

------

## 三、解决 Subagent 之间的记忆共享

Subagent 每次调用都是无状态的。为了让团队积累经验（例如：避免重复犯错、记住架构决策），需要外部记忆。

### 3.1 方案一：使用项目文件作为共享记忆（最简单）

在项目中维护以下文件，所有 Subagent 都可以读写（通过 `Read` / `Write` 工具）：

| 文件路径                     | 内容                                     | 维护者             |
| :--------------------------- | :--------------------------------------- | :----------------- |
| `docs/decisions.md`          | 记录重要架构决策（ADR）                  | 架构师             |
| `docs/known-issues.md`       | 记录已知问题和规避方案                   | 测试工程师、开发者 |
| `docs/coding-conventions.md` | 代码风格和约定                           | 审查员             |
| `CLAUDE.md`                  | 项目级指令，所有 Subagent 启动时自动加载 | 项目经理           |

**工作流程**：

- 架构师完成设计后，在 `docs/decisions.md` 中追加一条记录
- 测试工程师发现某个 API 容易超时，在 `docs/known-issues.md` 中记录建议的重试参数
- 开发者实现前，先阅读 `docs/known-issues.md` 避免踩坑
- 审查员在审查时，可参考 `docs/coding-conventions.md`

### 3.2 方案二：集成 MCP Memory Server（适合更大规模团队）

使用社区已有的 Memory MCP Server（如 `agentmemory`、`linksee-memory`）。配置方法：

1. 在 Claude Code 的 MCP 配置文件中添加 Memory Server
2. 所有 Subagent 配置中，允许使用 `mcp__memory__*` 工具
3. Subagent 可以调用 `mcp__memory__add` 写入经验，`mcp__memory__search` 检索

**优点**：支持语义搜索、自动过期、集中管理
**缺点**：需要额外运行 MCP Server，对轻量级项目可能过重

### 3.3 方案三：利用 Claude Code 的 `hooks` + 外部脚本（创新方案）

通过 `hooks` 在 Subagent 完成时自动触发脚本，将关键结论写入共享 JSON 文件。例如：

json

```
// .claude/hooks/agent-complete.json
{
  "event": "agent_complete",
  "script": "./scripts/record-agent-memory.sh"
}
```



脚本内容可以从 Subagent 的最终输出中提取结构化信息，存入 `shared_memory.json`。下一个 Subagent 启动时，可以在其 prompt 中通过 `Read` 工具读取该文件。

------

## 四、最佳实践与注意事项

### 4.1 设计 Subagent 的 prompt 时

- **职责单一**：一个 Subagent 只做一件事（如架构师不写代码）
- **明确输出格式**：让项目经理容易解析结果（例如要求输出 JSON 或特定标题）
- **限制工具权限**：只给必要的工具（如审查员不给 `Write`）
- **选择合适的模型**：所有 Subagent 均使用 `deepseek-v4-pro`（根据统一配置）

### 4.2 项目经理（主对话）应该做的

- **显式记录任务状态**：可以在 `docs/sprint-status.md` 中维护一个待办列表，用 `- [ ]` 标记
- **处理错误**：如果某个 Subagent 失败，分析原因，可以重新调用或回滚
- **定期同步**：每隔几个任务，让某个 Subagent 更新 `CLAUDE.md` 中的项目进度

### 4.3 避免的坑

- **不要让 Subagent 直接修改 `CLAUDE.md`**（这是项目级全局指令，应由项目经理或架构师审慎更新）
- **不要让多个 Subagent 并发写入同一文件**（会导致冲突）。项目经理应串行化写操作。
- **不要忘记给 Subagent 传递必要的上下文**（例如指定要阅读的设计文档路径）

### 4.4 版本控制策略

将 `.claude/agents/` 目录提交到 Git，让团队成员共享同一套 AI 团队配置。但运行期产生的记忆文件（如 `docs/known-issues.md` 的动态内容）也提交，这样大家都能看到历史决策。

------

## 五、总结

这套多 Agent 协作模式，本质上是 **“人工智能辅助的软件工程”** 的轻量实现：

- **项目经理（你 + 主对话）**：负责拆解任务、调度资源、风险管理
- **专家 Subagent**：各自深耕一个领域，产出高质量的设计、代码、测试、审查
- **共享记忆**：通过文件或 MCP Server 实现经验传递和知识沉淀

对于 Unblind 这个项目，采用这套模式可以：

- 显著提升开发效率（并行处理多个任务）
- 保证代码质量（审查员和测试工程师双重把关）
- 积累项目知识（每个决策都被记录）