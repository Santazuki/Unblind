# CLAUDE.md — Unblind Project Architecture & Conventions

> 本文档为 AI 编码助手（Claude Code、Copilot 等）在此仓库中协作时提供架构原则与开发约定。
> 面向人类开发者的文档见 [README.md](README.md)。

## 项目定位

Unblind 是一个 Claude Code Agent Skill，为纯文本模型（DeepSeek）提供视觉理解能力。
通过拦截图片、路由到 Mimo 视觉 API，让 DeepSeek "看见"图片。

**核心哲学：自行车道，不是高速公路。**
- 自包含单文件脚本，零 `npm install`
- 三级按需加载，初始上下文 < 200 tokens
- 自愈配置：首次运行自动检测并修复缺失配置

## 技术栈

- **运行时**：Node.js >= 18
- **依赖**：零外部依赖（仅用 Node.js 内置 `fs`、`path`、`fetch`）
- **外部 API**：Mimo Anthropic-compatible vision API（mimo-v2.5 / mimo-v2-omni）
- **分发**：GitHub + npm skills registry

## 架构原则

1. **高内聚低耦合** — 模块职责单一，依赖清晰。当前为原型阶段（单文件），逐步向多 Provider 架构迁移。
2. **配置驱动** — 所有模型接入通过 `settings.json` 声明，不修改核心代码。
3. **安全先行** — API Key 不出现在终端输出和对话记录中，依赖 Claude Code env 自动注入。
4. **优雅失败** — 外部依赖失效时有清晰的降级路径和用户提示。
5. **做减法** — 够用即可。不引入 MCP 复杂度，不添加未被验证需要的抽象。

## 目录结构

```
unblind/
├── SKILL.md              # 技能入口（三级加载）
├── README.md             # 人类阅读文档
├── CLAUDE.md             # AI 开发指导（本文件）
├── LICENSE               # MIT
├── install.sh            # 一键安装脚本
├── settings.example.json # 示例配置
├── docs/                 # 项目设计文档
├── scripts/              # 工具脚本
│   ├── unblind.mjs       #   核心视觉工具（当前阶段）
│   ├── install.js        #   Node.js 安装脚本
│   ├── imageProcessor.js #   图片预处理（Phase 1+）
│   ├── cache.js          #   感知哈希缓存（Phase 2+）
│   └── providers/        #   Vision Provider 实现（Phase 1+）
├── templates/            # 输出模板
│   ├── chain_of_thought.md
│   └── output_formats/
├── resources/            # 参考文档
│   └── best_practices.md
├── tests/                # 测试用例（纯文字，不含真实图片）
│   └── sample_images/
└── .github/workflows/    # CI/CD
```

## 开发约定

### 安全红线（不可违反）

- **绝不**在代码中硬编码 API Key
- **绝不**在 Bash 命令输出中暴露 API Key（用 env 注入，不用 export）
- **绝不**在 `.gitignore` 之外提交 `settings.json`、`.env`、日志文件
- **必须**对图片路径做校验门检查（拒绝含 shell 元字符的路径）
- **必须**设置请求超时（AbortController, 30s）

### 代码风格

- 保持脚本自包含——能用 Node.js 内置模块解决的问题，不引入第三方依赖
- 错误信息面向最终用户（中文优先），给出原因 + 解决建议，不用 "Something went wrong"
- 日志用结构化格式（JSON Lines），包含 timestamp、level、module、requestId
- 配置变更需考虑向后兼容（version 字段 + 自动迁移逻辑）

### 测试要求

- **纯文字测试**：测试用例定义在 `tests/sample_images/`，用文字描述测试场景，**不提交真实图片**。真实图片测试在本地环境手动执行，路径通过环境变量注入。
- 每个分析模式（describe / ocr / ui-review / chart-data / object-detect）至少一个用例
- 自愈流程（Phase 0）全链路测试
- 安全审计项全部通过（命令注入、Key 暴露、超时、文件大小）
- 发布前执行完整检查清单（见 TEST.md 第 8 节）

## 当前状态与路线

| 阶段 | 状态 | 关键产出 |
|------|------|----------|
| Phase 0（原型） | ✅ 完成 | 单文件脚本、5 种模式、自愈配置、安全加固 |
| Phase 1（重构核心） | 📋 规划中 | 多 Provider 架构、熔断重试、凭据加密存储 |
| Phase 2（稳定性） | 📋 规划中 | 单元测试全覆盖、缓存与健康检查、结构化日志 |
| Phase 3（扩展性） | 📋 待实现 | DeepSeekVL/OpenAI/Local Provider |
| Phase 4（多 Agent） | 📋 待评估 | MCP 协议适配 |

## 关键文件说明

| 文件 | 角色 | 修改需谨慎 |
|------|------|-----------|
| `SKILL.md` | Skill 入口，定义触发条件、自愈流程、执行规则 | 是 — 影响所有用户 |
| `scripts/unblind.mjs` | 核心视觉工具，图片编码 + API 调用 | 是 — 影响核心功能 |
| `install.sh` | 安装脚本，自动部署到 Claude Code 目录 | 是 — 影响分发 |
| `README.md` | 用户文档（双语） | 随功能更新 |
| `TEST.md` | 测试报告与安全检查清单 | 每次发布前更新 |

## 关键约束

- Skill 三级加载：元数据 < 200 tokens，说明 < 2000 tokens，资源按需
- 仅 Claude Code 环境（不引入 MCP 协议），如需多 Agent 适配在 Phase 4 处理
- Mimo API 使用 Anthropic Messages 兼容格式（非 Chat Completions）
- Windows / macOS / Linux 三平台兼容
