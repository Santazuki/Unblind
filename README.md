<h1 align="center">Unblind</h1>
<p align="center"><em>一个不会悄无声息挂掉的视觉 skill</em></p>
<p align="center">
  👁️ 自愈配置 · 熔断重试 · 安全沙箱 · 零依赖
  <br>
  🛠️ 全程 <b>Claude Code</b> 开发 · 自研<b>双 Pipeline 多 Agent 协作模式</b>
</p>
<p align="center">
  <a href="#english">English</a> | 中文
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/node-≥18-brightgreen" alt="node">
  <img src="https://img.shields.io/badge/tests-171%20pass-success" alt="tests">
  <img src="https://img.shields.io/badge/dependencies-0-zero?labelColor=white" alt="zero deps">
  <img src="https://img.shields.io/badge/agentskills.io-compatible-purple" alt="agentskills.io">
</p>

---

## ✨ 这是什么

Unblind 是给 AI Agent 用的视觉后端——不是面向人类的 App，而是面向 Agent 的基础设施。把图片路由到视觉 API，返回文字描述，让没有多模态能力的模型（如 DeepSeek）能够"看图"。

和大多数视觉 skill 不同的是，它不是一层薄薄的 API 封装。每一步都有防御：

```
用户发图 → Phase 0 自检（静默）→ 魔数校验 → 缓存查询 → 7 Provider 链轮换 → 返回描述
```

## 🚀 快速开始

把下面这句话发给 Claude Code：

> 帮我安装 unblind skill，GitHub 仓库是 https://github.com/Santazuki/unblind，clone 后运行 install.sh 即可。

或手动：

```bash
git clone https://github.com/Santazuki/unblind.git /tmp/unblind
bash /tmp/unblind/install.sh
```

首次运行自动检测缺失配置并修复。无需手动编辑 settings.json。

## ⚙️ 工程特性

| 特性 | 说明 |
|------|------|
| 🩺 **Phase 0 自愈** | 每次调用静默检查环境，配置缺失当场修复，不打断用户 |
| 🔌 **熔断 + 指数退避** | 每 Provider 独立 CircuitBreaker，5 次失败熔断 60s |
| 💾 **SHA256 持久化缓存** | 内容寻址，TTL + LRU 1000，跨进程命中，`--no-cache` 跳过 |
| 🔀 **Provider 故障转移** | 7 个 Provider 链式轮换，`UNBLIND_PROVIDER_ORDER` 自定义顺序 |
| 🛡️ **魔数文件校验** | 读取文件头字节，拒绝伪装成图片的攻击文件 |
| 🔒 **安全沙箱** | 零 exec / child_process，API Key 不在任何输出中暴露 |
| 📐 **结构化输出** | `--format json|yaml|csv`，Agent 可编程调用 |
| 📦 **零依赖** | 只用 Node.js >= 18 内置模块，clone 即用 |

## 🔍 分析模式

| 模式 | 用途 | 示例 |
|------|------|------|
| `describe` | 通用描述 | `unblind.mjs image.png` |
| `ocr` | 文字提取 | `unblind.mjs scan.png ocr` |
| `ui-review` | UI/UX 评审 | `unblind.mjs mockup.png ui-review` |
| `chart-data` | 图表数据 | `unblind.mjs chart.png chart-data` |
| `object-detect` | 物体识别 | `unblind.mjs photo.png object-detect` |
| `compare` | 多图对比 | `unblind.mjs a.png b.png compare` |

## 🎯 视觉模型

预置 7 个 Provider，新增只需在注册表数组中加一行纯数据：

| Provider | 协议族 | 默认模型 |
|----------|--------|------|
| Mimo | Anthropic Messages | mimo-v2.5 |
| OpenAI | OpenAI Chat Completions | gpt-4o |
| Gemini | Google Generative AI | gemini-2.5-flash |
| Ollama | OpenAI 兼容（本地） | llama3.2-vision |
| Groq | OpenAI 兼容 | llama-4-vision |
| Together | OpenAI 兼容 | Llama-4-Maverick |
| Fireworks | OpenAI 兼容 | llama-v4 |

## ⌨️ CLI

```bash
unblind.mjs <image> [mode]           # 分析图片
unblind.mjs <a.png> <b.png> compare  # 多图对比
unblind.mjs <img> --format json      # 结构化输出
unblind.mjs --health                 # 连通性诊断
unblind.mjs --config                 # 查看配置
unblind.mjs --set-model <model>      # 切换模型
unblind.mjs --cache-stats            # 缓存统计
unblind.mjs --clear-cache            # 清空缓存
```

## 🏗️ 架构

v3.0 协议驱动架构——3 协议族，GenericProvider 唯一调度类，纯数据注册表。

```
CLI → orchestrator (config → image → cache → provider → result)
        → providers/ (GenericProvider → protocols 协议函数调度)
        → httpClient (fetch + 超时 + parseError 委托)
        → cache (SHA256 + TTL + LRU)
        → retry (指数退避 + CircuitBreaker)
        → errorHandler (ClientError / ServerError / NetworkError)
```

详见 [设计文档](docs/superpowers/specs/2026-05-30-provider-v3-protocol-driven-design.md)。

## 🧪 工程实践

- **171 tests，169 pass**，GitHub Actions 实跑
- **TDD**：`node --test` 内置框架，先测试后实现
- **安全审计**：三轮 CLEAN，18 security tests
- **零 npm 依赖**：Node.js >= 18 内置模块
- **双 Pipeline 多 Agent 协作**：Part 1 (Architect → Developer + Reviewer) + Part 2 (SL → QA → RE ≤3 轮)，PM 5 关口控制
- **CLAUDE.md 自动维护**：阶段/重构/模块变化时即时同步

📄 [多 Agent 协作指南](docs/project-prepare-md/多agent协作开发unblind.md) · [DevFlow](https://github.com/Santazuki/devflow)

## 🤝 参与贡献

欢迎提 Issue 和 PR。

### 开发环境

```bash
git clone https://github.com/Santazuki/unblind.git
cd unblind
# 零依赖，直接可用
```

### 运行测试

```bash
node --test tests/test-*.js
```

需要 API Key 的测试在无 Key 时自动跳过。

---

<span id="english"></span>

## English

Unblind is a vision backend for AI Agents — not a human-facing app, but infrastructure for Agents. It routes images to vision APIs and returns text descriptions, giving non-multimodal models the ability to "see."

Unlike most vision skills, it's engineered with defense at every layer: Phase 0 self-healing, circuit breaker retry, SHA256 persistent cache, magic byte validation, and a 3-round security audit (CLEAN). Built entirely with **Claude Code** and a custom **dual-pipeline multi-agent workflow**.

### 🚀 Quick Install

Send this to Claude Code:

> Install the unblind skill from https://github.com/Santazuki/unblind — clone it and run install.sh.

### ⚙️ Features

- **Phase 0 Self-Healing**: Silent pre-flight check, auto-repairs config gaps
- **Circuit Breaker + Retry**: Per-provider isolation, exponential backoff
- **SHA256 Persistent Cache**: Content-addressed, TTL + LRU 1000, cross-process hit
- **Provider Failover**: Chain rotation across 7 providers, auto fallback
- **Magic Byte Validation**: Rejects disguised attack files
- **Security Sandbox**: Zero exec, API key never exposed
- **Structured Output**: `--format json|yaml|csv`
- **Zero Dependencies**: Node.js >= 18 built-in modules only

### 🧪 By the Numbers

- **171 tests**, 169 pass, 0 fail — GitHub Actions
- **7 providers**, 3 protocol families, 6 analysis modes
- **15 modules**, zero npm dependencies
- **3-round security audit**, 18 security tests, all CLEAN

### License

MIT

---

<p align="center">
  <sub>Built by <a href="https://github.com/Santazuki">Santaz</a>. Workflow extracted into <a href="https://github.com/Santazuki/devflow">DevFlow</a>.</sub>
</p>
