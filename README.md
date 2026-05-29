# Unblind

> **DeepSeek can seek. Unblind lets it see.**
>
> DeepSeek 能求索，Unblind 让它看见。

---

[English](#english) | 中文

## 这是什么

DeepSeek（v4 / v4-pro / v4-flash）是目前最强的推理模型之一，但它没有多模态能力——发图片只会得到 "Unsupported Image"。

Unblind 是一个**自愈型 Claude Code Agent Skill**，遵循 [agentskills.io](https://agentskills.io) 规范（三级渐进披露、allowed-tools、evals 触发率评估）。当 DeepSeek 收到图片时，Unblind 自动拦截，将图片路由到 Mimo / OpenAI 视觉模型，返回文字描述。对用户来说，DeepSeek 像是突然学会了看图。

> **Mimo 补上了 DeepSeek 缺失的多模态能力。**
> 小米 Mimo Token Plan 提供 Anthropic 兼容 API，原生支持图片理解。
> 2026 年 5 月，Mimo 宣布 API **永久降价最高 99%**，全部套餐额度重置，
> 夜间（北京时间 0:00–8:00）消耗更享 0.8x 倍率。现在是用 Mimo 做视觉最好的时机。

```
用户发图 → Unblind 检测图片路径
  → Phase 0 自检配置（静默，仅异常时修复）
  → 图片校验(魔数) → 缓存查询(文件持久化) → Mimo/OpenAI API
  → 返回文字描述
```

## 核心特性

- **零配置**：克隆即用。首次运行自动检测缺失配置，引导用户完成，当场写入 settings.json
- **自修复**：每次调用先跑 Phase 0 自检——API Key 丢了、权限丢了，当场修好
- **自包含**：纯 Node.js 脚本，不依赖 MCP Server，不需要 `npm install`
- **多 Provider**：Mimo + OpenAI 兼容接口，Key 前缀自动路由（tp-/sk-ant→Mimo, sk-→OpenAI）
- **极低成本**：默认 mimo-v2.5，输入 100 credits、输出 200 credits
- **文件缓存**：SHA256 持久化缓存，跨进程共享，TTL 自动过期
- **内置管理**：`--config` 查看配置、`--set-model` 切换模型、`--health` 健康检查、`--cache-stats` 缓存统计

## 安装

### 方式一：让 AI 帮你装（推荐）

把下面这句话发给 Claude Code / Codex / Cursor Agent：

> 帮我安装 unblind skill，GitHub 仓库是 https://github.com/Santazuki/unblind，clone 后运行 install.sh 即可。

或者直接说：

### 方式二：手动安装

```bash
git clone https://github.com/Santazuki/unblind.git /tmp/unblind
bash /tmp/unblind/install.sh
```

安装后发一张图片给 Claude Code，首次运行会自动引导配置 Mimo API Key。

### 更新

```bash
npx skills update unblind
```

Skill 内置版本检查：每次会话自动对比 GitHub 仓库，有新版本会主动提醒。

## 前提条件

- Node.js >= 18
- [Mimo Token Plan](https://token-plan-cn.xiaomimimo.com) API Key（Lite 套餐 $6/月起）

## 视觉模型

| 模型 | Credits（百万 token 输入/输出） | 视觉 |
|---|---|---|
| **mimo-v2.5**（默认） | 100 / 200 | 支持 |
| mimo-v2-omni | 280 / 1400 | 支持 |

> mimo-v2.5-pro 不支持图片输入，勿用。

## 分析模式

| 模式 | 用途 | 触发词 |
|---|---|---|
| `describe` | 通用图片描述 | 默认、"这是什么"、"描述" |
| `ocr` | 文字提取 | "提取文字"、"OCR"、"识别文字" |
| `ui-review` | UI/UX 设计评审 | "评审界面"、"UI"、"设计" |
| `chart-data` | 图表数据提取 | "图表"、"数据"、"趋势" |
| `object-detect` | 物体识别 | "识别物体"、"有什么" |

## 为什么叫 Unblind

DeepSeek 取名自"路漫漫其修远兮，吾将上下而求索"。但它看不到图片。

求索而无视，是为盲。Unblind，去盲。

*DeepSeek seeks deep. Unblind lets it see.*

## 为什么用内置脚本而不是 MCP

MCP 的链路是：

```
用户发图 → Claude Code → MCP Client → MCP Server → HTTP → Mimo API
```

Unblind 的链路是：

```
用户发图 → Claude Code → node unblind.mjs → HTTP → Mimo API
```

**两层差距，三个理由：**

**少即是多。** MCP 需要额外安装 Server、单独配置 `mcp.json`、维护进程生命周期。Unblind 就是一组纯 Node.js 脚本，`fetch` 调 API，零 `npm install`。每少一层，就少一个出问题的点。

**体验即分发。** Unblind 的设计目标是 `git clone` + `install.sh` + 发一张图 = 能用。如果用 MCP——用户得先装 MCP Server、配环境变量、重启 Claude Code、`/mcp` 验证。这些步骤里任意一步卡住，这个 skill 就不会被用起来。内置脚本把"部署"变成了"复制一个目录"。

**MCP 适合共享服务，不适合独占工具。** MCP 的价值在于一个 Server 被 Claude Code、Cursor、Codex 多个客户端复用。但 Unblind 是 Claude Code 独占的——script 直接丢给 Bash 执行，不需要跨平台协议。

一句话：**MCP 是高速公路，Unblind 只需要一条自行车道。**

## 自动化验证

每次提交自动运行 68 项测试（GitHub Actions 实际执行验证）：

```
65 pass  0 fail  3 skip (API 连通性)
```

包括：
- **功能测试**：12 个模块，50 项单元/集成测试
- **文档命令验证**：自动提取文档中的 CLI 命令并执行，确保文档不腐烂
- **安装脚本验证**：`install.sh` / `install.js` 语法检查 + 部署完整性

详细报告：[docs/test-results/](docs/test-results/)

## 多 Agent 协作开发

本项目采用 Subagent-Driven Development 模式，经 Phase 3+5 实战验证：

- **Architect ×N**：并行设计，输出到 `docs/design/`
- **Developer + Reviewer 并行**：交叉审查，边开发边把关
- **Tester**：全量回归 + 测试报告 `docs/test-results/`
- **自动触发**：说"多 agent"即派发完整角色链，不漏角色

详见 [docs/project-prepare-md/多agent协作开发unblind.md](docs/project-prepare-md/多agent协作开发unblind.md)

## GPT 的质疑 & Claude Code 的回应

我们用 GPT 对项目进行了一次"刻薄审计"，它提出了 20 条潜在问题（功能缺陷 + 安全漏洞）。然后用 Claude Code 逐条实测：

- **12 条完全错误** — GPT 没读过代码，凭"典型 Node 项目"经验推断（如：以为用 `exec` 拼命令、以为缓存没写 TTL、以为只支持 JPG/PNG）
- **5 条不适用** — 指控的是设计文档里的未来规划，非已实现功能
- **3 条部分成立** — 已纳入后续改进

完整实测报告：[docs/test-results/gpt-rebuttal-report.md](docs/test-results/gpt-rebuttal-report.md)

## 安全验证

| 验证项 | 状态 |
|---|---|
| API Key 不出现在对话记录中 | ✅ Phase 0.2 用户终端自行写入 |
| API Key 不出现在 Bash 命令输出中 | ✅ 零 export，Claude Code env 注入 |
| 命令注入防护 | ✅ 全项目零 exec/child_process，路径校验门 |
| 请求超时保护 | ✅ 30s AbortController + 指数退避重试 |
| 文件大小 + 魔数校验 | ✅ 50MB 上限 + PNG/JPEG/GIF/WebP/BMP 魔数检查 |
| 错误信息不泄露原始响应 | ✅ httpClient 统一过滤，不暴露 provider/响应体 |
| 三轮安全审计 | ✅ 2026-05-28 — CLEAN（无 HIGH/MEDIUM 漏洞） |
| 多 Provider 故障转移 | ✅ Mimo 失败自动切换 OpenAI |
| 全场景识图 | ✅ 中文截图/人像/电商图/宠物照/meme/3D渲染 |

完整测试报告见 [TEST.md](TEST.md)。

---

## English

## What is this

DeepSeek (v4 / v4-pro / v4-flash) is one of the most powerful reasoning models. But it has no multimodal capability — images return "Unsupported Image."

Unblind is a **self-healing Claude Code Agent Skill**. It intercepts images before they hit DeepSeek, routes them to Mimo / OpenAI vision APIs, and returns text descriptions. To the user, DeepSeek just gained sight.

> **Mimo fills DeepSeek's multimodal gap.**
> Xiaomi Mimo Token Plan provides an Anthropic-compatible API with native image understanding.
> In May 2026, Mimo announced **permanent price cuts up to 99%** across all plans,
> with full quota resets and an additional 0.8x rate during night hours (Beijing time 0:00–8:00).
> There's never been a better time to use Mimo for vision.

## Key Features

- **Zero config**: Clone and use. Auto-detects missing setup on first run, writes config automatically.
- **Self-healing**: Phase 0 health check on every invocation. Missing API key? Broken permission? Repairs itself.
- **Self-contained**: Pure Node.js scripts — no MCP servers, no `npm install`.
- **Multi-Provider**: Mimo + OpenAI compatible. Auto-routes by key prefix (tp-/sk-ant→Mimo, sk-→OpenAI).
- **Cost-effective**: mimo-v2.5 at 100/200 credits per 1M tokens.
- **File cache**: SHA256 persistent cache, cross-process, TTL expiry.
- **Built-in CLI**: `--config`, `--set-model`, `--health`, `--cache-stats`

## Install

### Method 1: Let your AI do it (recommended)

Send this to Claude Code / Codex / Cursor Agent:

> Install the unblind skill from https://github.com/Santazuki/unblind — clone it and run install.sh.

### Method 2: Manual install

```bash
git clone https://github.com/Santazuki/unblind.git /tmp/unblind
bash /tmp/unblind/install.sh
```

Send any image to Claude Code after install. First run auto-configures your Mimo API Key.

### Update

```bash
npx skills update unblind
```

Built-in version check: compares against GitHub on each session, notifies you when an update is available.

## Requirements

- Node.js >= 18
- [Mimo Token Plan](https://token-plan-cn.xiaomimimo.com) API Key (Lite plan from $6/month)

## Models

| Model | Credits (1M tokens in/out) | Vision |
|---|---|---|
| **mimo-v2.5** (default) | 100 / 200 | Yes |
| mimo-v2-omni | 280 / 1400 | Yes |

## Modes

| Mode | Use case |
|---|---|
| `describe` | General image understanding |
| `ocr` | Text extraction from screenshots, documents |
| `ui-review` | UI/UX design critique |
| `chart-data` | Chart and graph data extraction |
| `object-detect` | Object, person, activity identification |

## Why a Bundled Script, Not MCP

The MCP path:

```
User → Claude Code → MCP Client → MCP Server → HTTP → Mimo API
```

Unblind's path:

```
User → Claude Code → node unblind.mjs → HTTP → Mimo API
```

**Two fewer layers, three reasons:**

**Less is more.** MCP requires an extra server install, separate `mcp.json` config, and process lifecycle management. Unblind is a set of pure Node.js scripts — native `fetch`, zero `npm install`. Every layer you remove is one less thing that can break.

**Experience is distribution.** Unblind's goal is `git clone` + `install.sh` + send an image = it works. With MCP, users must install a server, set env vars, restart Claude Code, and run `/mcp` to verify. Any step can silently fail. A bundled script turns "deployment" into "copy a directory."

**MCP is for shared services, not exclusive tools.** MCP shines when one server serves multiple clients — Claude Code, Cursor, Codex. Unblind is Claude Code only. Scripts piped to Bash need no cross-platform protocol.

In one sentence: **MCP is a highway. Unblind just needs a bike lane.**

## Automated Validation

68 tests run on every commit (verified in GitHub Actions):

```
65 pass  0 fail  3 skip (API connectivity)
```

Covers:
- **Functionality**: 12 modules, 50 unit/integration tests
- **Doc commands**: CLI commands in documentation auto-extracted and verified
- **Install scripts**: `install.sh` / `install.js` syntax + deployment integrity

Full report: [docs/test-results/](docs/test-results/)

## GPT's Critique & Claude Code's Response

We had GPT perform a "brutal audit" of this project, raising 20 potential issues. Claude Code then tested each claim against the actual code:

- **12 claims outright wrong** — GPT assumed typical Node.js pitfalls without reading the code (e.g. claiming we use `exec`, caching has no TTL, or only support JPG/PNG)
- **5 claims inapplicable** — targeting future roadmap items, not implemented features
- **3 claims partially valid** — added to improvement backlog

Full report: [docs/test-results/gpt-rebuttal-report.md](docs/test-results/gpt-rebuttal-report.md)

## Why "Unblind"

DeepSeek draws its name from a classical Chinese poem: *"The road is long and winding, I will seek high and low."* It can seek — but it cannot see.

Seeking without sight is blindness. Unblind removes the blindfold.

*DeepSeek seeks. Unblind lets it see.*

## Security Verification

| Check | Status |
|---|---|
| API Key never in transcript or output | ✅ Terminal entry + env injection |
| Command injection | ✅ Zero exec/child_process, path validation gate |
| Magic byte + size validation | ✅ 7 formats, 50MB cap, empty file detection |
| Error message sanitization | ✅ No raw response bodies, no provider names in errors |
| 3-round security audit | ✅ 2026-05-28 — CLEAN (no HIGH/MEDIUM issues) |
| Provider failover | ✅ Mimo → OpenAI automatic fallback |
| Multi-scene recognition | ✅ Screenshots, portraits, products, pets, memes, 3D renders |

Full test report: [TEST.md](TEST.md).

## License

MIT
