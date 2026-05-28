---
name: unblind
description: >
  Unblind — Give DeepSeek eyes. Self-contained + self-healing Claude Code
  Agent Skill. DeepSeek models (v4/v4-pro/v4-flash) lack multimodal
  capability — Unblind intercepts images and routes them to Mimo's
  Anthropic-compatible vision API (mimo-v2.5, 100/200 credits).
  Auto-detects missing config and repairs itself on first run.
  Five modes: describe, ocr, ui-review, chart-data, object-detect.
  Triggers: any image path, "analyze this image", "look at this",
  "what's in this picture", "read this screenshot", "extract text from",
  "describe this chart", "review this UI", "识别图片", "看图",
  "这张图片", "分析图片", "OCR", "图片描述".
metadata:
  version: "2.1"
  category: ai-vision
  bundled_tools:
    - scripts/unblind.mjs
  requirements:
    - Node.js >= 18
    - Mimo Token Plan API key (auto-prompted on first run)
---

# Unblind

Intercept images before DeepSeek sees them → route to Mimo vision API → return text.
Never pretend to see images. Never touch settings.json with Read/Edit tools.

## Iron Rules

1. Phase 0 self-check is mandatory on every invocation
2. NEVER use Read or Edit tool on `~/.claude/settings.json` — it would expose the API key
3. All config checks/writes go through `node -e` Bash commands or the bundled CLI
4. Never preamble. Never hallucinate vision. Always invoke the bundled script.
5. The tool reads MIMO_API_KEY from env automatically (Claude Code injects it)

## Phase 0: Self-Healing Setup

### 0.1 Check health (silent when healthy)

```bash
node -e "
const fs=require('fs');const os=require('os');
const p=require('path').join(os.homedir(),'.claude','settings.json');
const s=JSON.parse(fs.readFileSync(p,'utf8'));
const issues=[];
if(!s.env?.MIMO_API_KEY) issues.push('KEY_MISSING');
if(!s.env?.MIMO_VISION_MODEL || s.env.MIMO_VISION_MODEL==='mimo-v2.5-pro') issues.push('MODEL_MISSING');
const a=s.permissions?.allow||[];
if(!a.some(x=>x.includes('unblind'))) issues.push('PERM_MISSING');
if(issues.length) console.log(issues.join(' '));
" 2>/dev/null
```

If stdout is empty → healthy, **skip silently to Phase 1**.
If stdout contains `KEY_MISSING` → go to 0.2
If stdout contains `MODEL_MISSING` → go to 0.5
If stdout contains `PERM_MISSING` → go to 0.4

### 0.2 Repair API Key

If Key missing (`--config` shows "未设置" or errors), tell user (exact wording):

"Unblind 需要 Mimo API Key。获取后，在终端运行（替换 YOUR_KEY）：

node -e \"const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.env.MIMO_API_KEY='YOUR_KEY';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\\n')\""

User runs this in their own terminal. After they confirm, re-run 0.1. Never write the key yourself.

### 0.3 Repair Base URL

If missing, auto-detect from key prefix:

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));const k=s.env?.MIMO_API_KEY||'';const url=k.startsWith('sk-')?'https://api.xiaomimimo.com/anthropic':'https://token-plan-cn.xiaomimimo.com/anthropic';if(!s.env.MIMO_BASE_URL){s.env.MIMO_BASE_URL=url;fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')}"
```

### 0.4 Repair permission

If PERM_MISSING:

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));if(!s.permissions)s.permissions={allow:[]};const a=s.permissions.allow;if(!a.some(x=>x.includes('unblind'))){a.push('Bash(*~/.claude/skills/unblind/scripts/unblind.mjs*)');fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')}"
```

### 0.5 Repair Vision Model

If model missing or `mimo-v2.5-pro` (no vision support), ask:

"请选择视觉模型：
1. **mimo-v2.5**（推荐）— 100/200 credits
2. **mimo-v2-omni** — 280/1400 credits
输入 1 或 2："

Write choice via Bash. For choice 1:

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.env.MIMO_VISION_MODEL='mimo-v2.5';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')"
```

For choice 2, replace `mimo-v2.5` with `mimo-v2-omni`.

### 0.6 Model switching (runtime)

If user says "切换模型" / "switch model" / "换个模型": show current model (from 0.1 output), present choice prompt, write selection (same as 0.5), confirm: "已切换到 <model>。"

### 0.7 Version check

```bash
cd ~/.claude/skills/unblind && git fetch origin 2>/dev/null && git rev-list --count HEAD..origin/master 2>/dev/null || echo "0"
```
If > 0: "Unblind 有新版本可用（落后 <N> 个提交）。运行 `cd ~/.claude/skills/unblind && git pull` 更新。"

### 0.8 Node.js check

If `node --version` fails or < 18, report and stop.

### 0.9 All healthy → proceed silently to Phase 1.

## Models

| Model | Input | Output | Vision |
|---|---|---|---|
| **mimo-v2.5** (default) | 100 | 200 | Yes |
| mimo-v2-omni | 280 | 1400 | Yes |

mimo-v2.5-pro has NO vision support.

## Modes

| Mode | Triggers |
|---|---|
| `describe` | default, "what's in", "describe", "描述" |
| `ocr` | "read text", "extract", "OCR", "文字" |
| `ui-review` | "review", "UI", "design", "界面" |
| `chart-data` | "chart", "graph", "data", "图表" |
| `object-detect` | "objects", "detect", "identify" |

## Phase 1: Extract & validate image path

From user message: `[Image: source: <absolute-path>]`

Validation: absolute path, supported extension (.jpg/.jpeg/.png/.gif/.webp/.bmp/.svg), no shell metacharacters (`"`, `'`, `` ` ``, `$`, `;`, `|`, `&`, `>`, `<`, `(`, `)`, `{`, `}`, newline). Fail → "图片路径包含不安全字符，无法处理。"

## Phase 2: Classify mode

Match user message to Mode table above. Default: `describe`.

## Phase 3: Execute

```bash
node ~/.claude/skills/unblind/scripts/unblind.mjs '<image-path>' <mode>
```

No preamble. No permission prompt. Just run.

## Phase 4: Report

Print stdout. If API key error → re-enter Phase 0.2.
