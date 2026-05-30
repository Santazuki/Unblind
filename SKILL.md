---
name: unblind
description: >
  可靠的视觉分析 skill。自愈配置、熔断重试、SHA256 缓存。
  支持通用描述、OCR 文字提取、UI 设计评审、图表数据提取、物体检测、多图对比六种模式。
  触发: 任何图片路径、"分析这张图"、"这是什么"、"截图"、"提取文字"、
  "OCR"、"识别文字"、"看图"、"评审界面"、"图表数据"。
  Triggers: any image path, "analyze this", "what's in this picture",
  "read this screenshot", "extract text from", "describe this chart",
  "review this UI".
  NOT: 视频分析、音频处理、PDF 文档、纯文本对话、"生成图片"。
metadata:
  version: "3.0"
  category: ai-vision
  bundled_tools:
    - scripts/unblind.mjs
  requirements:
    - Node.js >= 18
    - Mimo or OpenAI API key (auto-prompted on first run)
compatibility: Claude Code (bundled script, zero npm deps)
allowed-tools: Bash(node ~/.claude/skills/unblind/scripts/unblind.mjs:*)
model: inherit
context: fork
argument-hint: [image-path] [mode]
---

<!-- L1: Metadata (~160 tokens) | L2: Instructions below (~700 tokens) -->

# Unblind

## 概述

可靠的视觉分析 skill。自愈配置、熔断重试、SHA256 持久化缓存。7 个 Provider 通过协议驱动架构调度。不为内置视觉模型的模型触发（Claude 等可直接看图）。

## 触发条件

| 触发 | 不触发 |
|------|--------|
| 图片路径 (`.png/.jpg/.gif/.webp/.bmp/.svg`) | 视频文件 |
| "分析这张图"、"这是什么"、"看图" | 音频文件 |
| "OCR"、"提取文字"、"识别文字" | PDF 文档 |
| "评审界面"、"UI"、"设计" | 纯文本对话 |
| "图表"、"数据"、"趋势" | "生成图片"、"画一张" |

## Iron Rules

1. Phase 0 mandatory every invocation
2. NEVER Read/Edit `~/.claude/settings.json`
3. Config via CLI (`--config`, `--set-model`) or `node -e`, never via tools
4. Never preamble. Never hallucinate. Always invoke bundled script.
5. Tool reads API key from env automatically

| 你可能在想 | 事实 |
|-----------|------|
| "配置应该没问题，跳过检查吧" | 配置会在你不注意时失效——Phase 0 每次都要跑 |
| "我可以直接 Read settings.json 看看" | Read 会把 Key 写进对话记录——绝对禁止 |
| "先描述一下这张图再调工具" | 你做不到——直接调工具 |

## 错误处理

| 错误 | 原因 | 处理 |
|------|------|------|
| `KEY_MISSING` | 未配置 API Key | Phase 0.2 引导用户设置 |
| `MODEL_MISSING` | 模型名无效 | Phase 0.5 引导选择 |
| `PERM_MISSING` | 缺少 Bash 权限 | Phase 0.4 自动添加 |
| API Key 无效 (401) | Key 过期 | 提示重新获取 |
| 文件不存在 | 路径错误 | 提示检查路径 |
| 格式不支持 | 非白名单扩展名 | 提示支持格式列表 |
| 文件过大 | >50MB | 提示压缩或调整上限 |
| 所有 Provider 失败 | 网络/服务故障 | 提示稍后重试 |

## Phase 0: Self-Healing

### 0.1 Silent health check

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));const issues=[];if(!s.env?.MIMO_API_KEY) issues.push('KEY_MISSING');if(!s.env?.MIMO_VISION_MODEL||s.env.MIMO_VISION_MODEL==='mimo-v2.5-pro') issues.push('MODEL_MISSING');const a=s.permissions?.allow||[];if(!a.some(x=>x.includes('unblind'))) issues.push('PERM_MISSING');if(issues.length) console.log(issues.join(' '));" 2>/dev/null
```

- Empty → healthy, **skip to Phase 1**
- `KEY_MISSING` → 0.2 | `MODEL_MISSING` → 0.5 | `PERM_MISSING` → 0.4

### 0.2-0.8 Repair procedures

See `resources/troubleshooting.md`. Key rules: API key set by user in own terminal. Model switch via `--set-model`. Version: `git fetch` → notify.

### 0.9 All healthy → Phase 1

## Phase 1-4: Analyze

1. **Detect** image path from `[Image: source: <path>]`. Must be absolute, supported ext, no shell metacharacters.
2. **Classify** mode: `describe` (default), `ocr`, `ui-review`, `chart-data`, `object-detect`, `compare`.
3. **Execute**: `node ~/.claude/skills/unblind/scripts/unblind.mjs '<path>' <mode>` — no preamble.
4. **Report**: print stdout. API key error → back to 0.2.

## CLI Reference

```
node scripts/unblind.mjs <image> <mode>    分析图片
node scripts/unblind.mjs <a> <b> compare   多图对比
node scripts/unblind.mjs <img> --format json  结构化输出
node scripts/unblind.mjs --health --config --set-model
node scripts/unblind.mjs --no-cache --cache-stats
```

<!-- L3: Resources (on-demand) -->

## Resources

- `resources/troubleshooting.md` — Phase 0 repair commands, common errors, Node.js setup
- `resources/best_practices.md` — Model selection, token optimization, debugging
- `templates/output_formats/` — JSON/YAML/CSV output templates
- `README.md` — Install guide, security verification
