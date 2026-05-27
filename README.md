# Unblind

> **DeepSeek can seek. Unblind lets it see.**
>
> DeepSeek 能求索，Unblind 让它看见。

---

[English](#english) | 中文

## 这是什么

DeepSeek（v4 / v4-pro / v4-flash）是目前最强的推理模型之一，但它没有多模态能力——发图片只会得到 "Unsupported Image"。

Unblind 是一个**自愈型 Claude Code Agent Skill**。当 DeepSeek 收到图片时，Unblind 自动拦截，将图片路由到小米 Mimo 视觉模型（mimo-v2.5），返回文字描述。对用户来说，DeepSeek 像是突然学会了看图。

> **Mimo 补上了 DeepSeek 缺失的多模态能力。**
> 小米 Mimo Token Plan 提供 Anthropic 兼容 API，原生支持图片理解。
> 2026 年 5 月，Mimo 宣布 API **永久降价最高 99%**，全部套餐额度重置，
> 夜间（北京时间 0:00–8:00）消耗更享 0.8x 倍率。现在是用 Mimo 做视觉最好的时机。

```
用户发图 → Unblind 检测图片路径
  → Phase 0 自检配置
  → Base64 编码 → POST Mimo Anthropic 兼容 API
  → 返回文字描述
```

## 核心特性

- **零配置**：克隆即用。首次运行自动检测缺失配置，引导用户完成，当场写入 settings.json
- **自修复**：每次调用先跑 Phase 0 自检——API Key 丢了、权限丢了，当场修好
- **自包含**：内嵌单个 Node.js 脚本，不依赖 MCP Server，不需要 `npm install`
- **极低成本**：默认 mimo-v2.5，输入 100 credits、输出 200 credits（每百万 token）。输入比 v2-omni 便宜 2.8x，输出便宜 7x

## 快速安装

```bash
git clone https://github.com/Santazuki/unblind.git ~/.claude/skills/unblind
```

然后直接发一张图片给 Claude Code。首次运行会自动引导你配置 Mimo API Key，无需手动编辑任何文件。

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

**少即是多。** MCP 需要额外安装 Server（如 `uvx minimax-coding-plan-mcp`）、单独配置 `mcp.json`、维护进程生命周期。Unblind 就是一个 130 行的 `.mjs` 文件，Node.js 原生 `fetch`，零 `npm install`。每少一层，就少一个出问题的点。

**体验即分发。** Unblind 的设计目标是一行 `git clone` + 发一张图 = 能用。如果用 MCP——用户得先装 MCP Server、配环境变量、重启 Claude Code、`/mcp` 验证。这些步骤里任意一步卡住，这个 skill 就不会被用起来。内置脚本把"部署"变成了"复制一个目录"。

**MCP 适合共享服务，不适合独占工具。** MCP 的价值在于一个 Server 被 Claude Code、Cursor、Codex 多个客户端复用。但 Unblind 是 Claude Code 独占的——script 直接丢给 Bash 执行，不需要跨平台协议。没必要为 130 行代码修一条高速。

一句话：**MCP 是高速公路，Unblind 只需要一条自行车道。**

---

## English

## What is this

DeepSeek (v4 / v4-pro / v4-flash) is one of the most powerful reasoning models. But it has no multimodal capability — images return "Unsupported Image."

Unblind is a **self-healing Claude Code Agent Skill**. It intercepts images before they hit DeepSeek, routes them to Xiaomi Mimo's vision API (mimo-v2.5), and returns text descriptions. To the user, DeepSeek just gained sight.

> **Mimo fills DeepSeek's multimodal gap.**
> Xiaomi Mimo Token Plan provides an Anthropic-compatible API with native image understanding.
> In May 2026, Mimo announced **permanent price cuts up to 99%** across all plans,
> with full quota resets and an additional 0.8x rate during night hours (Beijing time 0:00–8:00).
> There's never been a better time to use Mimo for vision.

## Key Features

- **Zero config**: Clone and use. Auto-detects missing setup on first run, writes config automatically.
- **Self-healing**: Phase 0 health check on every invocation. Missing API key? Broken permission? Repairs itself.
- **Self-contained**: Bundled Node.js script — no MCP servers, no `npm install`.
- **Cost-effective**: mimo-v2.5 at 100/200 credits per 1M tokens. 2.8x cheaper input, 7x cheaper output than v2-omni.

## Quick Install

```bash
git clone https://github.com/Santazuki/unblind.git ~/.claude/skills/unblind
```

Send any image to Claude Code. First run guides you through API key setup — no manual file editing.

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

**Less is more.** MCP requires an extra server install (`uvx minimax-coding-plan-mcp`), separate `mcp.json` config, and process lifecycle management. Unblind is a 130-line `.mjs` file — Node.js native `fetch`, zero `npm install`. Every layer you remove is one less thing that can break.

**Experience is distribution.** Unblind's goal is `git clone` + send an image = it works. With MCP, users must install a server, set env vars, restart Claude Code, and run `/mcp` to verify. Any step can silently fail. A bundled script turns "deployment" into "copy a directory."

**MCP is for shared services, not exclusive tools.** MCP shines when one server serves multiple clients — Claude Code, Cursor, Codex. Unblind is Claude Code only. A script piped to Bash needs no cross-platform protocol. You don't build a highway for a bicycle.

In one sentence: **MCP is a highway. Unblind just needs a bike lane.**

## Why "Unblind"

DeepSeek draws its name from a classical Chinese poem: *"The road is long and winding, I will seek high and low."* It can seek — but it cannot see.

Seeking without sight is blindness. Unblind removes the blindfold.

*DeepSeek seeks. Unblind lets it see.*

## License

MIT
