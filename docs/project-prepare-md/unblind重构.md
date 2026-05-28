# Unblind 项目重构设计文档

> 为纯文本模型构建健壮、可扩展、可维护的视觉增强 Skill

## 一、背景与定位

### 1.1 问题描述

Claude Code 等 Agent 生态中，纯文本模型（如 DeepSeek）无法直接感知图像内容。用户需要一种机制——称为“视觉增强”——让这些模型获得“看见”的能力。

当前 `unblind` 提供了一种解决方案：通过调用第三方视觉模型 API（如 Mimo）为纯文本模型补充视觉理解能力。在 DeepSeek 和 Mimo 双双宣布永久折扣的利好下，此方案的性价比大幅提升，具备可持续运营的商业基础。

### 1.2 核心理念

本 Skill 的核心定位是：

> **在 Claude Code 的 Skill 框架内，为纯文本模型提供统一、健壮、可扩展的视觉理解能力。**

设计遵循以下原则：

- **高内聚、低耦合**：模块职责单一，依赖关系清晰
- **配置驱动**：所有模型接入通过配置声明，不修改核心代码
- **安全先行**：API 凭据加密存储，输入输出可审计
- **优雅失败**：任何外部依赖失效时，都有清晰的降级路径
- **工程完备**：测试覆盖、日志可观测、错误可诊断

### 1.3 生态定位

当前视觉增强领域存在三类方案，各有优劣：

| 方案               | 代表项目                                       | 优势                   | 局限                   |
| :----------------- | :--------------------------------------------- | :--------------------- | :--------------------- |
| **Skill 直调 API** | `unblind`、`vision-support`                    | 轻量、低成本、易扩展   | 可靠性依赖 API 服务    |
| **MCP Server**     | `opencode-vision`、`Luma MCP`、`moondream-mcp` | 强隔离、可复用、企业级 | 复杂度高、Token 开销大 |
| **内置多模态模型** | Claude Opus 4.7、GLM-5V-Turbo                  | 原生支持、延迟低       | 成本高、受限于特定模型 |

`unblind` 属于第一类，**适合追求成本可控、快速迭代、深度集成 DeepSeek 生态的场景**。

## 二、总体架构设计

### 2.1 分层架构

text

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code Agent                     │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                     SKILL.md (入口)                       │
│  • 元数据声明（名称、触发条件、依赖）                        │
│  • 三级加载结构（metadata → instructions → resources）    │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                     核心调度模块                          │
│  • 路由与分发（根据配置选择 Provider）                     │
│  • 请求预处理（参数校验、格式转换）                         │
└─────────────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ MimoProvider │ │DeepSeek-VL   │ │   Future     │
│   (默认)      │ │ Provider     │ │ Providers    │
└──────────────┘ └──────────────┘ └──────────────┘
          │              │              │
          └──────────────┼──────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     横切关注层                            │
│  • 图片预处理（压缩、格式转换、尺寸裁剪）                    │
│  • 重试与熔断（指数退避、Circuit Breaker）                │
│  • 错误处理与降级                                         │
│  • 日志与审计                                            │
│  • 凭据管理（加密存储）                                   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   底层基础设施                            │
│  • 文件系统（图片读取、缓存）                              │
│  • HTTP 客户端（API 调用）                                │
│  • 本地加密存储（凭据）                                   │
└─────────────────────────────────────────────────────────┘
```



### 2.2 模块划分

| 模块          | 文件                        | 职责                                          |
| :------------ | :-------------------------- | :-------------------------------------------- |
| Skill 入口    | `SKILL.md`                  | 三级加载内容，定义触发条件和使用说明          |
| 配置管理      | `src/config.ts`             | 读取/验证 `settings.json`，管理模型配置和凭据 |
| 调度核心      | `src/orchestrator.ts`       | 路由请求到对应 Provider，协调预处理和后处理   |
| Provider 接口 | `src/providers/provider.ts` | 定义 `IVisionProvider` 接口                   |
| Mimo Provider | `src/providers/mimo.ts`     | Mimo API 适配实现                             |
| 图片处理      | `src/imageProcessor.ts`     | 压缩、格式转换、尺寸调整、Base64 编码         |
| 重试与熔断    | `src/retry.ts`              | 指数退避重试、Circuit Breaker                 |
| 错误处理      | `src/errorHandler.ts`       | 异常分类、错误上报                            |
| 日志模块      | `src/logger.ts`             | 结构化日志输出                                |
| 凭据管理      | `src/credentialManager.ts`  | 加密存储 API Key                              |

## 三、核心模块详细设计

### 3.1 Provider 接口与依赖注入

Provider 接口定义了视觉能力的通用抽象，确保未来增加新模型时无需改动调度代码：

typescript

```
// src/providers/provider.ts
export interface IVisionProvider {
  readonly name: string;
  
  analyzeImage(params: AnalyzeParams): Promise<AnalyzeResult>;
  
  healthCheck(): Promise<boolean>;
}

export interface AnalyzeParams {
  image: string | Buffer;      // Base64 或 Buffer
  prompt?: string;              // 可选的提示词
  options?: {
    maxSize?: number;           // 输出长度限制
    temperature?: number;
  };
}

export interface AnalyzeResult {
  content: string;
  model: string;
  processingTimeMs: number;
}
```



依赖注入通过配置文件中的 `activeProvider` 字段声明式绑定，而非硬编码。

### 3.2 三级加载的 Skill 入口设计

Claude Skills 要求 Skill 内容按层级组织，以避免无关内容挤占上下文：

| 层级                | 内容                             | 大小限制         |
| :------------------ | :------------------------------- | :--------------- |
| **Level 1: 元数据** | 技能名称、简短描述、触发关键词   | < 200 tokens     |
| **Level 2: 说明**   | 使用方式、示例对话、模式说明     | < 2000 tokens    |
| **Level 3: 资源**   | API 文档、详细配置指南、故障排查 | 无限制，按需加载 |

**SKILL.md 结构示例**：

markdown

```
# unblind - Vision Enhancement for Claude Code

<!-- METADATA:LEVEL=1 -->
unblind gives text‑only models the ability to describe images by routing them 
to vision APIs. Trigger on: "analyze image", "what's in this picture", "OCR".

<!-- INSTRUCTIONS:LEVEL=2 -->
## Usage
1. Place images in conversation or provide a path
2. Model will automatically analyze when relevant
3. Supported analysis modes: general, OCR, UI critique, chart data, object

<!-- RESOURCES:LEVEL=3 -->
## API Documentation
[Detailed endpoint specs, error codes, advanced configuration...]
```



Skills 与 System Prompts 的差异在于：System Prompts 是“全量预装”，Skills 是“按需加载”——只有被判定为相关时，Claude 才会读取完整内容，此机制对 Token 效率有显著提升。

### 3.3 重试与熔断机制

引入工业级可靠性设计，而非“一次性调用”：

**指数退避重试**：

| 重试次数 | 等待时间 | 适用场景           |
| :------- | :------- | :----------------- |
| 1        | 1 秒     | 网络抖动、瞬态超时 |
| 2        | 2 秒     | 服务短暂过载       |
| 3        | 4 秒     | 中等负载波动       |
| 超时后   | 熔断     | 持续失败触发保护   |

**Circuit Breaker（熔断器）** 状态机：

text

```
       失败次数 ≥ 阈值
CLOSED ──────────────→ OPEN
  │                      │
  │                      │ 冷却时间结束后
  │  调用成功            │
  │ ←─────────────────── HALF-OPEN
  │       (尝试恢复)
```



### 3.4 图片预处理策略

在发送给视觉模型前进行预处理，可显著降低延迟和成本：

| 预处理策略  | 实现                   | 收益                     |
| :---------- | :--------------------- | :----------------------- |
| 尺寸限制    | 长边缩放至 ≤1024px     | 减少 API 调用 token 消耗 |
| 格式统一    | 全部转为 JPEG          | 兼容性提升               |
| 质量压缩    | JPEG 质量 75-85%       | 文件体积减少 40-60%      |
| Base64 编码 | 统一编码格式           | 传输标准化               |
| 缓存        | 基于图片哈希值缓存结果 | 相同图片不重复调用       |

### 3.5 错误分类与处理

所有错误均分为三类，以便调用方做出合理决策：

| 错误类型       | 示例                         | 推荐处理                   |
| :------------- | :--------------------------- | :------------------------- |
| **客户端错误** | 无效 API Key、图片格式不支持 | 立即失败，提示用户修改配置 |
| **服务端错误** | 500 系错误、超时、429 限流   | 指数退避重试，熔断保护     |
| **网络错误**   | DNS 失败、连接中断           | 重试 + 最终降级提示        |

### 3.6 凭据安全管理

当前实现将 API Key 明文存储在 `settings.json` 中，存在安全隐患。重构方案：

- **开发环境**：通过环境变量 `MIMO_API_KEY` 传入
- **生产环境**：调用操作系统加密存储
  - macOS: Keychain (`security add-generic-password`)
  - Windows: Credential Manager
  - Linux: `libsecret` 或加密配置文件

**凭据服务接口**：

typescript

```
interface ICredentialStore {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}
```



若无法使用系统加密存储，则回退至 `~/.claude/.unblind.enc` 文件，使用用户提供的口令进行 AES-256-GCM 加密。

### 3.7 结构化日志设计

日志格式（JSON Lines）：

json

```
{
  "timestamp": "2026-05-28T10:30:00Z",
  "level": "info",
  "module": "mimo-provider",
  "requestId": "req_7f3a2c1e",
  "event": "api_call",
  "durationMs": 234,
  "imageSize": 1024,
  "model": "mimo-v2.5-pro"
}
```



各模块独立输出结构化日志，便于集中分析和监控。

## 四、配置管理设计

### 4.1 配置文件结构

`~/.claude/skills/unblind/settings.json`：

json

```
{
  "version": "2.0",
  "activeProvider": "mimo",
  "providers": {
    "mimo": {
      "apiKey": "encrypted:base64...",
      "apiUrl": "https://api.mimo.dev/v1/chat/completions",
      "modelName": "mimo-v2.5-pro",
      "timeoutMs": 30000
    },
    "deepseek-vl": {
      "apiKey": "encrypted:...",
      "apiUrl": "https://api.deepseek.com/v1/chat/completions",
      "modelName": "deepseek-vl-2.0"
    },
    "fallback": {
      "enabled": true,
      "order": ["mimo", "deepseek-vl"]
    }
  },
  "processing": {
    "maxImageSize": 1024,
    "jpegQuality": 80,
    "cacheEnabled": true,
    "cacheTTLSeconds": 3600
  },
  "retry": {
    "maxAttempts": 3,
    "baseDelayMs": 1000,
    "maxDelayMs": 10000
  },
  "circuitBreaker": {
    "failureThreshold": 5,
    "timeoutSeconds": 60
  },
  "logging": {
    "level": "info",
    "outputFile": "~/.claude/unblind/logs/unblind.log"
  }
}
```



### 4.2 配置版本迁移

配置文件中包含 `version` 字段。当 Skill 检测到配置版本低于当前要求时，自动运行迁移逻辑，确保用户配置始终兼容。版本变更记录在 `CHANGELOG.md` 中维护。

## 五、扩展性设计

### 5.1 多视觉模型 Provider 扩展点

目前提供两种 Provider 实现，未来可按相同模式扩展：

| Provider           | 适用场景                                                   | 优先接入   |
| :----------------- | :--------------------------------------------------------- | :--------- |
| `MimoProvider`     | 当前主力，已确认永久折扣，性价比高                         | ✅ 已实现   |
| `DeepSeekProvider` | DeepSeek VL 模型可能后续开放，作为长期备选                 | 🔄 预留接口 |
| `OpenAIProvider`   | GPT-4V 备选，需用户自备 API Key                            | 📋 待实现   |
| `LocalProvider`    | 本地 Ollama 模型（llava、moondream），零成本，适合离线场景 | 📋 待实现   |

新增 Provider 只需三步：

1. 在 `src/providers/` 下新建文件，实现 `IVisionProvider`
2. 在 `src/providers/index.ts` 中注册
3. 在配置文件的 `providers` 字段中添加对应配置段

### 5.2 Agent 环境兼容性

当前实现紧耦合 Claude Code。未来可通过适配层支持更多 Agent：

| Agent       | 兼容状态 | 适配要点                    |
| :---------- | :------- | :-------------------------- |
| Claude Code | ✅ 已支持 | 原生 Skills 机制            |
| Cursor      | 🔄 规划中 | 需适配 MCP 协议             |
| OpenCode    | 🔄 规划中 | 兼容 Claude Skills 目录结构 |
| Codex CLI   | 📋 待评估 | 需单独适配                  |

### 5.3 多图处理与上下文感知

- 支持多图输入时，调度器按顺序调用 Provider 并行处理
- 对同一对话中的多张图片，系统维持独立的 analysis cache，降低重复调用成本
- 当前若需进行多图对比，Skill 将单独调度每个请求并在最终响应中汇总

### 5.4 扩展能力图谱

text

```
当前能力
├── 基础图像描述
├── OCR 文字提取
├── UI 评审
├── 图表数据解读
└── 通用物体识别

未来扩展
├── 视频帧分析（每隔 N 帧取图调用）
├── PDF 解析（转换为多张图片 + OCR）
├── 屏幕实时捕获（与 OS 级集成）
└── 多模态意图路由（系统级判断应使用哪类视图）
```



## 六、安全设计

### 6.1 输入安全

- 图片类型白名单（`image/jpeg`、`image/png`、`image/webp`）
- 文件大小限制（单图 ≤10MB）
- Base64 字符串长度校验，避免畸形注入
- 图片哈希化存储，防止敏感图像路径泄露

### 6.2 传输安全

- 所有 API 请求强制 HTTPS
- 支持自定义 CA 证书
- 可选请求签名（若目标视觉模型支持）
- 支持与/或验证 Mimo 返回数据的 JWT 签名（若服务端启用）

### 6.3 输出安全

- 输出内容敏感词过滤（可选，由用户配置）
- 审计日志（记录图片哈希、分析类型、时间戳），但不记录原始图片
- 支持企业级输出控制（限制返回信息敏感度）

## 七、健壮性与可观测性

### 7.1 健康检查与自愈

- **启动自检**：验证配置文件完整性、Provider 连通性
- **运行时健康检查**：每个 Provider 提供 `healthCheck()` 方法
- **降级路由**：主 Provider 失败时自动切换至备选 Provider
- **优雅退出**：处理 SIGTERM，完成进行中的请求

### 7.2 指标与监控

推荐暴露以下指标（可接入 Prometheus）：

| 指标名                          | 类型      | 说明           |
| :------------------------------ | :-------- | :------------- |
| `unblind_analyze_total`         | Counter   | 分析请求总数   |
| `unblind_analyze_duration_ms`   | Histogram | 请求耗时分布   |
| `unblind_api_errors`            | Counter   | 按错误类型分类 |
| `unblind_cache_hit_ratio`       | Gauge     | 缓存命中率     |
| `unblind_circuit_breaker_state` | Gauge     | 熔断器状态     |

### 7.3 性能基准（预期指标）

| 指标           | 冷启动      | 热调用          |
| :------------- | :---------- | :-------------- |
| 函数调用延迟   | < 5 ms      | < 5 ms          |
| 图片预处理耗时 | < 50 ms     | < 20 ms（缓存） |
| 全链路平均耗时 | 500-2000 ms | 300-1000 ms     |
| 内存占用       | < 50 MB     | < 30 MB         |

## 八、便利性与用户体验

### 8.1 一键安装脚本

bash

```
# 方法一：通过 npm 包安装（推荐）
npx install-unblind --agent claude-code

# 方法二：curl 方式
curl -fsSL https://raw.githubusercontent.com/Santazuki/unblind/main/install.sh | bash

# 方法三：手动 git clone
git clone https://github.com/Santazuki/unblind.git ~/.claude/skills/unblind
cd ~/.claude/skills/unblind && npm install
```



安装脚本自动完成：

1. 检测 Claude Code 安装路径（常用位置：`~/.claude/skills`）
2. 克隆仓库至正确目录
3. 执行 `npm install`
4. 若检测到已有 `settings.json`，保留原配置
5. 引导用户配置 API Key
6. 发送固定测试图片验证连通性

### 8.2 配置引导

首次运行时，若无有效配置，Skill 展示交互式引导：

text

```
📸 欢迎使用 Unblind！

未检测到视觉模型配置，请选择：

1. 使用 Mimo（推荐，已确认永久折扣）
2. 使用 DeepSeek VL（待开放）
3. 使用其他 OpenAI 兼容 API

请选择 [1/2/3]: 1
请输入 Mimo API Key: ****************

✅ 连通性测试通过！Unblind 已就绪。
下次可使用 "analyze image: <图片路径>" 体验视觉能力。
```



### 8.3 错误提示优化

告别“Something went wrong”类错误，改为：

text

```
❌ 错误：Mimo API 请求失败（HTTP 429）

原因：已达到 Mimo API 限流配额
解决建议：
  1. 等待 30 秒后重试（自动重试已启动）
  2. 若持续出现，请检查 Mimo 控制台配额
  3. 考虑切换备选模型（需在 settings.json 中配置）

预计自动重试倒计时：4 秒...
```



## 九、工程实践

### 9.1 测试策略

| 测试层级   | 覆盖范围                              | 要求                      |
| :--------- | :------------------------------------ | :------------------------ |
| 单元测试   | Provider 调用、图片处理、配置解析     | 覆盖率 ≥80%               |
| 集成测试   | Mimo API 真实调用（使用专用测试 Key） | 每个分析模式至少 1 个用例 |
| 缓存测试   | 相同图片重用缓存                      | 1 个完整场景              |
| 熔断测试   | 模拟连续失败触发熔断                  | 1 个场景                  |
| 跨平台测试 | macOS、Windows、Linux                 | 功能一致性验证            |

### 9.2 CI/CD 流程

GitHub Actions 配置：

yaml

```
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run type-check

  security:
    runs-on: ubuntu-latest
    steps:
      - run: npm audit --production
      - uses: snyk/actions/node@master  # 依赖漏洞扫描

  release:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: [test, security]
    runs-on: ubuntu-latest
    steps:
      - run: npm publish  # 发布至 npm
```



### 9.3 发布管理

- 遵循语义化版本（SemVer）：`v2.0.0`
- GitHub Release 包含：源码包、CHANGELOG、签名校验（GPG）
- npm 包同步发布
- Homebrew tap 作为备选安装方式

## 十、未来发展路线

| 阶段        | 核心目标      | 关键产出                                                |
| :---------- | :------------ | :------------------------------------------------------ |
| **Phase 1** | 重构核心      | 多 Provider 架构、熔断与重试机制、凭据加密存储          |
| **Phase 2** | 稳定性增强    | 单元测试全覆盖、缓存与健康检查、结构化日志              |
| **Phase 3** | 扩展性提升    | DeepSeekVL Provider、OpenAI Provider、本地模型 Provider |
| **Phase 4** | 多 Agent 适配 | MCP 协议适配、Cursor/OpenCode 兼容性                    |
| **Phase 5** | 高级功能      | 多图对比、视频帧分析、屏幕实时捕获                      |

## 十一、总结

`unblind` 的定位是清晰且实用的：在 Claude Code 生态中，为纯文本模型（尤其是 DeepSeek）提供低延迟、高性价比的视觉能力。在 DeepSeek 和 Mimo 双双宣布永久折扣的背景下，此方案的 TCO 大幅优化，具备长期可持续运营的价值。

当前代码处于原型阶段，以上述重构设计为蓝图，可以从以下方面着手：

1. **重构核心架构**：抽象 Provider 接口、解耦模型调用逻辑
2. **引入可靠性保障**：重试机制、Circuit Breaker、健康检查
3. **加固安全与加密**：凭据管理、输出过滤
4. **提升可观测性**：结构化日志、指标采集
5. **完善工程闭环**：自动化测试、CI/CD、发布流程

完成上述改造后，`unblind` 将从一个“130 行的个人脚本”蜕变为一个**工程完备、可投入生产使用**的社区级 Skill，在视觉增强领域占据一席之地。