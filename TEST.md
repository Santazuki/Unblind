# Unblind — 测试报告 / Test Report

> 最后更新 / Last updated: 2026-05-28

[English](#english) | 中文

---

## 1. 模型发现 / Model Discovery (2026-05-27)

| # | 模型 / Model | 视觉 / Vision | Credits（输入/输出） | 结果 / Result |
|---|---|---|---|---|
| 1 | `mimo-v2.5` | 支持 | 100 / 200 | 选定为默认 |
| 2 | `mimo-v2-omni` | 支持 | 280 / 1400 | 可用，输出贵 7 倍 |
| 3 | `mimo-v2.5-pro` | 不支持 | 300 / 600 | 拒绝 — 不支持图片输入 |

**方法：** 向每个模型端点发送一张 1x1 红色 PNG，通过 Mimo 的 Anthropic 兼容 API。三个模型均能响应文本；v2.5-pro 返回 "No endpoints found that support image input."

## 2. 多场景识图 / Multi-Scene Recognition (2026-05-27)

| # | 图片类型 | 模型 | 结果 |
|---|---|---|---|
| 1 | 中文文本截图（面试脚本） | v2.5 | 正确提取全部中文内容和结构 |
| 2 | 人像照片（正式证件照） | v2.5 | 正确：东亚男性、深蓝西装、紫色领带、影棚打光 |
| 3 | 电商产品图（食盐包装） | v2.5 | 正确：品牌、重量、等级、营销文案 |
| 4 | 宠物照片（兔子特写、笼栏） | v2.5 | 正确：白色兔子、笼中场景、"鼻孔仰拍"幽默感 |
| 5 | 动漫 meme（薄荷绿双马尾、中文配文） | v2.5 | 正确：角色描述、全部叠层中文文字 |
| 6 | 3D 渲染（湖边可达鸭） | v2.5 | 正确：识别为 Psyduck、详细景观描述 |

## 3. 安装与分发 / Installation & Distribution (2026-05-28)

| 测试 | 命令 | 结果 |
|---|---|---|
| GitHub 克隆 | `git clone` | 通过 |
| npm skills 拉取 | `npx skills add Santazuki/unblind -g --list` | 通过 — 发现 1 个 skill |
| npm skills 安装 | `npx skills add Santazuki/unblind -g -y` | 通过 — 支持 55 个 agent |
| skills.sh 搜索 | `npx skills find unblind` | 待收录 — Issue 已提交至 vercel-labs/skills |

## 4. 模型切换 / Model Switching (2026-05-28)

| 测试 | 操作 | 结果 |
|---|---|---|
| 切换到 omni | 设置 `MIMO_VISION_MODEL=mimo-v2-omni` | 通过 — 工具即时使用新模型 |
| 切回 v2.5 | 设置 `MIMO_VISION_MODEL=mimo-v2.5` | 通过 |
| 无效模型拦截 | `mimo-v2.5-pro` | 标记为无视觉能力，提示重新选择 |

**方法：** 修改 `~/.claude/settings.json` 中的 `MIMO_VISION_MODEL`，用同一张图片测试两个模型。均返回有效描述；omni 输出略微更详细。

## 5. 自愈配置 — 全流程 / Self-Healing Full Flow (2026-05-28)

起始状态：`settings.json` 中零 Mimo 配置，无 skill 文件。

| 步骤 | Phase | 触发条件 | 动作 | 结果 |
|---|---|---|---|---|
| 1 | 0.2 | 缺少 `MIMO_API_KEY` | 引导用户通过终端写入 | Key 在 settings.json 中，不在聊天记录中 |
| 2 | 0.3 | 缺少 `MIMO_BASE_URL` | 自动写入 | 默认 URL 已设置 |
| 3 | 0.5 | 缺少 `MIMO_VISION_MODEL` | 引导用户选择 1 或 2 | 已选 `mimo-v2.5` |
| 4 | 0.4 | 缺少权限规则 | 自动添加 | `Bash(*~/.claude/skills/unblind/unblind.mjs*)` |
| 5 | 3 | 用户发送图片 | 执行视觉分析 | 返回正确描述 |

**一次发图交互即完成全部自愈流程。**

## 6. 安全 — API Key 暴露 / API Key Exposure (2026-05-28)

### 6.1 修复前 / Before Fix

```
Bash 命令输出: export MIMO_API_KEY="tp-..." && export MIMO_BASE_URL="..." && node ...
```
每次识图命令都显示 Key。

### 6.2 修复后 / After Fix

```
Bash 命令输出: node ~/.claude/skills/unblind/unblind.mjs 'image-path' describe
```
命令输出中零敏感信息。

### 6.3 验证 / Verification

| 测试 | 方法 | 结果 |
|---|---|---|
| 全新 bash 子进程有 env | `bash -c 'echo ${MIMO_API_KEY:0:10}...'` | 是 — Claude Code 从 settings.json 注入 |
| 无 export 工具正常工作 | `node unblind.mjs <image> describe` | 是 — 自动读取环境变量 |
| 输出中不含 Key | 对工具输出 `grep -c "tp-cla"` | 0 次出现 |
| env -u 正确剥离 | `env -u MIMO_API_KEY ...` | 确认工具中无硬编码回退 |

**根因：** Claude Code 在每次 Bash 调用时自动将 `~/.claude/settings.json` 中所有 `env` 键注入子进程。之前的 `export` 语句是多余的。

### 6.4 Phase 0.2 密钥输入 / Key Input

| 修复前 | 修复后 |
|---|---|
| 用户在聊天框粘贴 key → agent 通过 Edit 工具写入 | 用户在终端运行命令 → key 不进入对话记录 |

## 7. 安全审计 / Security Audit (2026-05-27, revised 2026-05-28)

| # | 问题 / Issue | 严重程度 / Severity | 状态 / Status |
|---|---|---|---|
| 1 | 命令注入 / Command injection via shell path | 高 / High | 已修复 — 路径校验门 + 单引号 |
| 2 | 权限规则过宽 / Overly broad Bash permission | 高 / High | 已修复 — 限定至 `~/.claude/skills/unblind/` |
| 3 | 请求无超时 / No fetch timeout | 中 / Medium | 已修复 — 30s AbortController |
| 4 | 无文件大小限制 / No file size limit | 低 / Low | 已修复 — 50MB 上限 + 空文件检测 |
| 5 | 未签名 commit / Unsigned commits | 中 / Medium | 已修复 — 全部 11 个 commit 已 GPG 签名 |
| 6 | usage 旧文件名 / Stale filename | 低 / Low | 已修复 |
| 7 | API Key 明文存储 / Plaintext key | 低 / Low | 已知接受（生态限制） |
| 8 | API Key 出现在 Bash 输出中 | 高 / High | 已修复 — 移除全部 export，依赖 env 注入 |

## 8. 发布前检查清单 / Pre-Release Checklist

每次发布前执行：

- [ ] `npx skills add Santazuki/unblind -g -y` — 纯净安装
- [ ] 发送图片 → Phase 0 自愈流程正确触发
- [ ] 发送图片 → 全部 5 种模式（describe, ocr, ui-review, chart-data, object-detect）
- [ ] "切换模型" → 模型切换提示正常工作
- [ ] 修改 `MIMO_VISION_MODEL` → 工具使用新模型
- [ ] `git log --show-signature` → 全部 commit GPG 验证
- [ ] 工具输出：grep `tp-` → 0 结果
- [ ] 含特殊字符的路径 → 被拒绝并显示明确错误
- [ ] 文件 > 50MB → 被拒绝并显示明确错误
- [ ] 空文件 → 被拒绝并显示明确错误
- [ ] `npx skills update unblind` → 从 GitHub 成功更新

---

## English

## 1. Model Discovery (2026-05-27)

| # | Model | Vision | Credits (in/out) | Result |
|---|---|---|---|---|
| 1 | `mimo-v2.5` | Yes | 100 / 200 | Selected as default |
| 2 | `mimo-v2-omni` | Yes | 280 / 1400 | Works, 7x more expensive output |
| 3 | `mimo-v2.5-pro` | No | 300 / 600 | Rejected — no image input support |

**Method:** Sent a 1x1 red PNG to each model endpoint via Mimo's Anthropic-compatible API. All three responded to text; v2.5-pro returned "No endpoints found that support image input."

## 2. Multi-Scene Recognition (2026-05-27)

| # | Image Type | Model | Result |
|---|---|---|---|
| 1 | Chinese text screenshot (interview script) | v2.5 | Correctly extracted all Chinese text and structure |
| 2 | Portrait photo (formal headshot) | v2.5 | Correct: East Asian male, navy suit, purple tie, studio lighting |
| 3 | E-commerce product image (salt package) | v2.5 | Correct: brand, weight, grade, all Chinese marketing copy |
| 4 | Pet photo (rabbit close-up, cage bars) | v2.5 | Correct: white rabbit, cage context, "up-the-nose" humor recognized |
| 5 | Anime meme (mint-green twin-tails, Chinese text) | v2.5 | Correct: character description, all overlaid Chinese text |
| 6 | 3D render (Psyduck by lakeside) | v2.5 | Correct: identified as Psyduck, detailed landscape description |

## 3. Installation & Distribution (2026-05-28)

| Test | Command | Result |
|---|---|---|
| GitHub clone | `git clone` | OK |
| npm skills pull | `npx skills add Santazuki/unblind -g --list` | OK — 1 skill found |
| npm skills install | `npx skills add Santazuki/unblind -g -y` | OK — 55 agents supported |
| skills.sh search | `npx skills find unblind` | Pending — issue submitted to vercel-labs/skills |

## 4. Model Switching (2026-05-28)

| Test | Action | Result |
|---|---|---|
| Switch to omni | Set `MIMO_VISION_MODEL=mimo-v2-omni` | OK — tool uses new model immediately |
| Switch back to v2.5 | Set `MIMO_VISION_MODEL=mimo-v2.5` | OK |
| Invalid model guard | `mimo-v2.5-pro` | Flagged as no-vision, prompts re-selection |

**Method:** Changed `MIMO_VISION_MODEL` in `~/.claude/settings.json` and ran the same image through both models. Both returned valid descriptions; omni output was slightly more verbose.

## 5. Self-Healing Full Flow (2026-05-28)

Starting state: zero Mimo configuration in `settings.json`. No skill files present.

| Step | Phase | Trigger | Action | Result |
|---|---|---|---|---|
| 1 | 0.2 | Missing `MIMO_API_KEY` | User prompted for key → writes via terminal | Key in settings.json, NOT in chat transcript |
| 2 | 0.3 | Missing `MIMO_BASE_URL` | Auto-written | Default URL set |
| 3 | 0.5 | Missing `MIMO_VISION_MODEL` | User prompted to choose 1 or 2 | `mimo-v2.5` selected |
| 4 | 0.4 | Missing permission rule | Auto-added | `Bash(*~/.claude/skills/unblind/unblind.mjs*)` |
| 5 | 3 | Image sent | Vision analysis executes | Correct description returned |

**Full self-healing pipeline completed in a single image-send interaction.**

## 6. Security — API Key Exposure (2026-05-28)

### 6.1 Before Fix

```
Bash command output: export MIMO_API_KEY="tp-..." && export MIMO_BASE_URL="..." && node ...
```
Key visible in every image analysis command.

### 6.2 After Fix

```
Bash command output: node ~/.claude/skills/unblind/unblind.mjs 'image-path' describe
```
Zero secrets in command output.

### 6.3 Verification

| Test | Method | Result |
|---|---|---|
| Fresh bash subshell has env | `bash -c 'echo ${MIMO_API_KEY:0:10}...'` | Yes — Claude Code injects from settings.json |
| Tool works without exports | `node unblind.mjs <image> describe` | Yes — reads env automatically |
| Key not in output | `grep -c "tp-cla"` on tool output | 0 occurrences |
| env -u strips correctly | `env -u MIMO_API_KEY ...` | Confirms no hardcoded fallback in tool |

**Root cause:** Claude Code injects all `env` entries from `~/.claude/settings.json` into every Bash child process automatically. The `export` statements were redundant.

### 6.4 Phase 0.2 Key Input

| Before | After |
|---|---|
| User pastes key in chat → agent writes via Edit tool | User runs terminal command → key never enters transcript |

## 7. Security Audit (2026-05-27, revised 2026-05-28)

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Command injection via shell path | High | Fixed — path validation gate, single quotes |
| 2 | Overly broad Bash permission | High | Fixed — scoped to `~/.claude/skills/unblind/` |
| 3 | No fetch timeout | Medium | Fixed — 30s AbortController |
| 4 | No file size limit | Low | Fixed — 50MB max, empty file check |
| 5 | Unsigned commits | Medium | Fixed — all 11 commits GPG-signed |
| 6 | Stale filename in usage text | Low | Fixed |
| 7 | Plaintext API key in settings.json | Low | Accepted (ecosystem limitation) |
| 8 | API key in Bash command output | High | Fixed — removed all exports, rely on env injection |

## 8. Pre-Release Checklist

Run these before each release:

- [ ] `npx skills add Santazuki/unblind -g -y` — clean install
- [ ] Send image → Phase 0 self-healing triggers correctly
- [ ] Send image → all 5 modes (describe, ocr, ui-review, chart-data, object-detect)
- [ ] "切换模型" → model switch prompt works
- [ ] Change `MIMO_VISION_MODEL` → tool respects new model
- [ ] `git log --show-signature` → all commits GPG-verified
- [ ] Tool output: grep for `tp-` → 0 results
- [ ] Path with special chars → rejected with clear error
- [ ] File > 50MB → rejected with clear error
- [ ] Empty file → rejected with clear error
- [ ] `npx skills update unblind` → updates from GitHub

## 10. Phase 1 重构回归 / Phase 1 Refactor Regression (2026-05-28)

| 测试项 | 结果 |
|--------|------|
| 单元测试总数 | 40/40 通过 |
| 模块总数 | 10 |
| 零外部依赖 | ✅ |
| 无硬编码 API Key | ✅ |
| CLI 向后兼容 | ✅ |
| 5 种模式 API 调用 | ✅ |
| 错误场景（缺失文件/无效格式/空文件） | ✅ |
| 安全审计（命令注入/Key暴露/超时/文件大小） | ✅ |
| 原始 unblind.mjs 行数 | 165 → 39 |

## 11. Phase 2 稳定性增强 / Phase 2 Stability Enhancements (2026-05-28)

| 测试项 | 结果 |
|--------|------|
| 单元测试总数 | 44/44 通过（+4 cache +1 CLI health -1 冗余） |
| 缓存模块（SHA256 + mtime） | ✅ |
| 缓存命中/过期/失效/TTL | ✅ 10/10 cache tests pass |
| --health 健康检查 | ✅ config + api_key + api_connectivity |
| --no-cache 跳过缓存 | ✅ |
| 日志级别修复（module_loaded → debug） | ✅ 5 模块 |
| install.sh 清理旧文件 | ✅ |
| 废弃占位文件清理 | ✅ scripts/providers/, scripts/imageProcessor.js |
| 运行时 root unblind.mjs 清理 | ✅ |
| 零外部依赖 | ✅ |
| 安全审计通过 | ✅ |
