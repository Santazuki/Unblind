# Unblind — 一个不会悄无声息挂掉的视觉 skill

> 👁️ 给 AI Agent 安装可靠的视觉能力。自愈配置、熔断重试、安全沙箱。
> 你的 Agent 值得一个不会悄无声息挂掉的视觉后端。
>
> 🛠️ 全程使用 **Claude Code** 开发，采用自研**双 Pipeline 多 Agent 协作模式**。

[English](#english) | 中文

---

## ✨ 为什么选择 Unblind

大多数视觉 skill 是一层薄薄的 API 封装——请求失败就抛异常，配置丢了就卡住。Unblind 按后端工程标准设计，每一步都有防御：

- **🩺 Phase 0 自愈**：每次调用静默检查环境，配置缺失当场修复，不打断用户
- **🔌 熔断 + 指数退避**：每 Provider 独立 CircuitBreaker，故障不雪崩
- **💾 SHA256 持久化缓存**：内容寻址，跨进程命中，TTL + LRU 1000
- **🔀 Provider 故障转移**：链式轮换 7 个 Provider，第一个失败自动切下一个
- **🛡️ 魔数文件校验**：读取文件头字节，拒绝伪装成图片的攻击文件
- **🔒 安全沙箱**：零 exec / child_process，API Key 不在任何输出中暴露
- **📐 结构化输出**：`--format json|yaml|csv`，Agent 可编程调用
- **📦 零 npm 依赖**：只用 Node.js >= 18 内置模块，clone 即用

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

### Phase 0 自愈

每次调用前静默检查环境：Node.js 版本、settings.json 存在性、API Key 配置。缺失项目当场自动修复，不打断用户流程。健康的 skill 不应该让用户操心配置。

### 熔断 + 重试

每个 Provider 独立的 CircuitBreaker：5 次失败（Ollama 3 次）自动熔断 60 秒。指数退避重试配合 Retry-After 响应头，避免 API 雪崩。

### SHA256 持久化缓存

文件级缓存（TTL + LRU 1000），SHA256 基于图片内容 + prompt 生成缓存键。同一张图跨进程、跨模式共享缓存命中。`--no-cache` 强制跳过。

### 安全边界

- **零 exec / child_process**：所有操作纯 Node.js，无命令注入面
- **魔数校验**：读取文件头字节，内容与扩展名必须一致
- **API Key 保护**：Key 不在日志/错误消息中暴露
- **错误脱敏**：Provider 名、响应体不进入用户可见错误
- **三轮安全审计**：18 security tests，全部 CLEAN

## 🔍 分析模式

| 模式 | 用途 | CLI |
|------|------|-----|
| `describe` | 通用图片描述 | `node scripts/unblind.mjs image.png` |
| `ocr` | 文字提取 | `node scripts/unblind.mjs image.png ocr` |
| `ui-review` | UI/UX 设计评审 | `node scripts/unblind.mjs mockup.png ui-review` |
| `chart-data` | 图表数据提取 | `node scripts/unblind.mjs chart.png chart-data` |
| `object-detect` | 物体识别 | `node scripts/unblind.mjs photo.png object-detect` |
| `compare` | 多图对比 | `node scripts/unblind.mjs a.png b.png compare` |

结构化输出：`--format json|yaml|csv`

## 🎯 视觉模型

预置 7 个 Provider，通过 `UNBLIND_PROVIDER_ORDER` 自定义轮换顺序：

| Provider | 协议族 | 模型 |
|----------|--------|------|
| Mimo | Anthropic Messages | mimo-v2.5 |
| OpenAI | OpenAI Chat Completions | gpt-4o |
| Gemini | Google Generative AI | gemini-2.5-flash |
| Ollama | OpenAI 兼容（本地） | llama3.2-vision |
| Groq | OpenAI 兼容 | llama-4-vision |
| Together | OpenAI 兼容 | Llama-4-Maverick |
| Fireworks | OpenAI 兼容 | llama-v4 |

新增 Provider = 在注册表数组中加一行纯数据，不写逻辑代码。

## ⌨️ CLI

```
node scripts/unblind.mjs <image> [mode]   分析图片
node scripts/unblind.mjs <a.png> <b.png> compare  多图对比
node scripts/unblind.mjs <image> --format json     结构化输出
node scripts/unblind.mjs --health                 连通性诊断
node scripts/unblind.mjs --config                 查看配置
node scripts/unblind.mjs --set-model <model>      切换模型
node scripts/unblind.mjs --cache-stats            缓存统计
node scripts/unblind.mjs --clear-cache            清空缓存
node scripts/unblind.mjs --no-cache <image>       跳过缓存
```

## 🏗️ 架构

```
CLI (unblind.mjs)
  → orchestrator (config → image → cache → provider → result)
    → providers/ (通用 GenericProvider → protocols 协议函数调度)
    → httpClient (fetch + 超时 + parseError 委托)
    → cache (SHA256 + TTL + LRU)
    → retry (指数退避 + CircuitBreaker)
    → errorHandler (ClientError/ServerError/NetworkError + 中文提示)
```

v3.0 协议驱动架构 — 3 协议族 (Anthropic Messages / OpenAI Chat Completions / Google Generative AI)，7 个 Provider 通过纯数据注册表声明。详见 [设计文档](docs/superpowers/specs/2026-05-30-provider-v3-protocol-driven-design.md)。

## 🧪 工程实践

采用自研**双 Pipeline 多 Agent 协作模式**开发。

- **171 tests CI 实跑**（169 pass, 0 fail, 2 API-skip），GitHub Actions
- **TDD**：`node --test` 内置框架，先测试后实现
- **零 npm 依赖**：只用 Node.js >= 18 内置模块
- **双 Pipeline**：Part 1 (Architect → Developer + Reviewer) + Part 2 (SL → QA → RE ≤3轮)，PM 5 关口控制
- **CLAUDE.md 自动维护**：阶段/重构/模块变化时即时同步

📄 [多 Agent 协作指南](docs/project-prepare-md/多agent协作开发unblind.md) · [实现计划](docs/superpowers/plans/2026-05-30-provider-v3-protocol-driven.md)

---

## English

**Unblind** — A vision skill that doesn't fail silently.

👁️ Give your AI Agent reliable vision. Self-healing config, circuit-breaker retry, SHA256 cache, security sandbox. Built entirely with **Claude Code**, using a custom **dual-pipeline multi-agent workflow**.

### ✨ Why Unblind

Most vision skills are thin API wrappers — fail on a bad request, freeze on missing config. Unblind is engineered with defense at every layer:

- **Phase 0 Self-Healing**: Silent pre-flight check on every invocation, auto-repairs config gaps
- **Circuit Breaker + Retry**: Per-provider isolation, exponential backoff, fault containment
- **SHA256 Persistent Cache**: Content-addressed, cross-process hit, TTL + LRU 1000
- **Provider Failover**: Chain rotation across 7 providers, automatic fallback
- **Magic Byte Validation**: File header verification, rejects disguised attack files
- **Security Sandbox**: Zero exec, API key never exposed in output
- **Structured Output**: `--format json|yaml|csv` for programmable agent consumption
- **Zero npm Dependencies**: Node.js >= 18 built-in modules only, clone and run

### 🚀 Quick Install

Send this to Claude Code:

> Install the unblind skill from https://github.com/Santazuki/unblind — clone it and run install.sh.

### 🧪 Engineering

Built with a custom **dual-pipeline multi-agent workflow**.

- **171 tests in CI**: 169 pass, 0 fail. GitHub Actions enforced
- **TDD**: `node --test` native framework, test-first
- **Zero npm deps**: Node.js >= 18 built-in modules only
- **Dual-Pipeline**: Part 1 (Architect → Developer + Reviewer) + Part 2 (SL → QA → RE ≤3 rounds), 5-gate PM control
- **CLAUDE.md auto-maintained**: syncs on phase changes, refactors, module updates

### License

MIT
