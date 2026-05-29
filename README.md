# Unblind

> **DeepSeek can seek. Unblind lets it see.**
>
> DeepSeek 能求索，Unblind 让它看见。

> 🚀 全程使用 **Claude Code + Subagent-Driven Development** 开发，25+ AI Agent 协作完成从原型到工程化的全链路。

---

[English](#english) | 中文 | 最后更新: 2026-05-29

## 这是什么

DeepSeek 是目前最强的推理模型之一，但没有多模态能力。Unblind 是一个**自愈型 Claude Code Agent Skill**，遵循 [agentskills.io](https://agentskills.io) 规范，将图片路由到 Mimo / OpenAI / Ollama 视觉模型，返回文字描述。

```
用户发图 → Phase 0 自检（静默）→ 魔数校验 → 缓存查询 → Provider 链轮换 → 返回描述
```

## AI Agent 工程亮点

这个项目展示了以下 Agent 开发能力：

- **Agent Skill 设计**：三级渐进式披露（838 tokens）、自愈机制、evals 触发率评估
- **多 Provider 架构**：Mimo → OpenAI → Ollama 链式轮换，独立 CircuitBreaker 故障隔离
- **Subagent-Driven 开发**：Architect → Developer + Reviewer 交叉审查 → Tester，25+ Agent 协作
- **工程完备性**：93 tests CI 实跑、三轮安全审计 CLEAN、零 npm 依赖

## 核心特性

- **零配置 / 自修复**：首次运行自动检测缺失配置并当场修复
- **多 Provider 链式轮换**：Mimo + OpenAI + Ollama，UNBLIND_PROVIDER_ORDER 自定义顺序
- **Provider 注册表**：新增模型只需一行数组，零 if-else
- **文件持久化缓存**：SHA256 + TTL + LRU，跨进程共享
- **结构化输出**：`--format json|yaml|csv`，Agent 可编程调用
- **多图对比**：`compare` 模式一次分析多张图片
- **CircuitBreaker 实例隔离**：每个 Provider 独立熔断器，故障不传播

## 安装

把下面这句话发给 Claude Code：

> 帮我安装 unblind skill，GitHub 仓库是 https://github.com/Santazuki/unblind，clone 后运行 install.sh 即可。

或手动：

```bash
git clone https://github.com/Santazuki/unblind.git /tmp/unblind
bash /tmp/unblind/install.sh
```

## 开发流程

本项目全程使用 **Claude Code + Subagent-Driven Development**，25+ AI Agent 协作。

### 方法论

```
需求 → brainstorm → spec → plan → subagent → audit → memory
```

### 多 Agent 角色

| 角色 | 职责 | 模型 |
|------|------|------|
| Architect | 并行设计，输出 `docs/design/` | deepseek-v4-pro |
| Developer + Reviewer | 交叉审查，边开发边把关 | v4-flash / v4-pro |
| Tester | 全量回归 + `docs/test-results/` 报告 | v4-flash |

### 工程纪律

- **TDD**：`node --test` 驱动实现，93 tests CI 实跑
- **三轮安全审计**：并行扫描 → 修复 HIGH+MEDIUM → 验证 → CLEAN
- **CLAUDE.md 自动更新**：新 Phase/方向变化/重构完成时强制同步
- **记忆文件**：`~/.claude/projects/.../memory/` 持久化，新对话自动加载

📄 [多Agent协作指南](docs/project-prepare-md/多agent协作开发unblind.md) · [Agent使用证明](docs/design/multi-agent-usage-proof.md)

## 自动化验证

93 tests，GitHub Actions 实跑：

```
91 pass  0 fail  2 skip (API 连通性)
```

涵盖：功能测试、文档命令自动验证、安装脚本语法+部署检查。

## GPT 的质疑 & Claude Code 的回应

GPT 提出 20 条指控，Claude Code 逐条实测：12 条错误、5 条不适用、3 条部分成立。[实测报告](docs/test-results/gpt-rebuttal-report.md)

## 安全验证

| 验证项 | 状态 |
|---|---|
| API Key 不出现于对话/Bash | ✅ |
| 命令注入防护（零 exec/child_process） | ✅ |
| 魔数校验 + 50MB 上限 | ✅ |
| 错误脱敏（不泄露 provider/响应体） | ✅ |
| 三轮安全审计 CLEAN | ✅ |
| Provider 故障转移 | ✅ |

## 支持的模型

**Mimo**（Anthropic Messages API）：mimo-v2.5 等视觉模型

**OpenAI 兼容**（Chat Completions API）：GPT-4o / GPT-4.1 / GLM-5V 等

**Ollama**（本地 OpenAI 兼容）：llava / moondream 等

通过 `UNBLIND_PROVIDER_ORDER` 自定义轮换顺序，Provider 注册表一行新增模型。

## 分析模式

| 模式 | 用途 |
|------|------|
| `describe` | 通用描述 |
| `ocr` | 文字提取 |
| `ui-review` | UI/UX 设计评审 |
| `chart-data` | 图表数据提取 |
| `object-detect` | 物体识别 |
| `compare` | 多图对比 |

## MCP vs Skill — 架构决策

Unblind 刻意不采用 MCP：两层更少的链路 = 两个更少的故障点。不是"我不会 MCP"，是"评估后判断 MCP 是过度设计"。

---

## English

> 🚀 Built end-to-end with **Claude Code + Subagent-Driven Development**, 25+ AI Agents collaborating from prototype to production.

## What is this

Unblind is a **self-healing Claude Code Agent Skill** that gives DeepSeek vision capability by routing images to Mimo / OpenAI / Ollama vision APIs. Follows the [agentskills.io](https://agentskills.io) specification.

## AI Agent Engineering Highlights

- **Agent Skill Design**: 3-level progressive disclosure (838 tokens), self-healing, evals-based trigger testing
- **Multi-Provider Architecture**: Chain rotation with independent CircuitBreakers per provider
- **Subagent-Driven Development**: Architect → Developer + Cross-Reviewer → Tester, 25+ agents
- **Engineering Rigor**: 93 tests with CI enforcement, 3-round security audit (CLEAN), zero npm deps

## Key Features

- **Zero config, self-healing** on first run
- **Multi-Provider chain rotation**: Mimo + OpenAI + Ollama, user-defined order
- **Provider registry**: Add a new model with one array line
- **Structured output**: `--format json|yaml|csv` for programmable agent consumption
- **Multi-image comparison**: `compare` mode analyzes multiple images in one call
- **Isolated CircuitBreaker**: Per-provider, failure doesn't cascade

## Quick Install

Send this to Claude Code:

> Install the unblind skill from https://github.com/Santazuki/unblind — clone it and run install.sh.

Or manually: `git clone ... && bash install.sh`

## Dev Process

Built with **Claude Code + Subagent-Driven Development**, 25+ AI agents collaborating under a structured workflow:

```
brainstorm → spec → plan → subagent(implement+review) → audit → memory
```

- **Architect ×N** (parallel) → `docs/design/`
- **Developer + Reviewer** (cross-review, parallel)
- **Tester** → `docs/test-results/`
- **TDD**: `node --test`, 93 tests in CI
- **3-round security audit**: parallel scan → fix → verify → CLEAN
- **CLAUDE.md**: auto-updates on phase changes / refactors
- **Memory files**: persist across conversations

[Multi-Agent Guide](docs/project-prepare-md/多agent协作开发unblind.md) · [Agent Proof](docs/design/multi-agent-usage-proof.md)

## Validation

93 tests in GitHub Actions: 91 pass, 0 fail, 2 skip. Covers unit, integration, doc command, and install script validation.

## Security

3-round audit CLEAN · Zero exec/child_process · Error sanitization · Magic byte validation · Provider failover

## Models & Modes

Mimo (Anthropic-compatible) · OpenAI-compatible (GPT-4o/4.1, GLM-5V) · Ollama (llava, moondream)
describe / ocr / ui-review / chart-data / object-detect / compare

## License

MIT
