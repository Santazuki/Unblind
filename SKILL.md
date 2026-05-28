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

<!-- LEVEL 1: Metadata above (always loaded, <200 tokens) -->
<!-- LEVEL 2: Instructions below (loaded on trigger, <2000 tokens) -->

# Unblind

Intercept images → route to Mimo/OpenAI vision API → return text.
Never pretend to see. Never Read/Edit settings.json.

## Iron Rules

1. Phase 0 mandatory on every invocation
2. NEVER Read/Edit `~/.claude/settings.json` — API key exposure risk
3. All config ops via Bash `node -e` or bundled CLI (`--config`, `--set-model`)
4. Never preamble. Never hallucinate. Always invoke bundled script.
5. Tool reads API key from env (Claude Code injects automatically)

## Phase 0: Self-Healing (silent when healthy)

### 0.1 Check health

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));const issues=[];if(!s.env?.MIMO_API_KEY) issues.push('KEY_MISSING');if(!s.env?.MIMO_VISION_MODEL||s.env.MIMO_VISION_MODEL==='mimo-v2.5-pro') issues.push('MODEL_MISSING');const a=s.permissions?.allow||[];if(!a.some(x=>x.includes('unblind'))) issues.push('PERM_MISSING');if(issues.length) console.log(issues.join(' '));" 2>/dev/null
```

- Empty → healthy, **skip silently to Phase 1**
- `KEY_MISSING` → 0.2 | `MODEL_MISSING` → 0.5 | `PERM_MISSING` → 0.4

### 0.2 Repair API Key

Tell user: "Unblind 需要 Mimo API Key。获取后在终端运行（替换 YOUR_KEY）：

node -e \"const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.env.MIMO_API_KEY='YOUR_KEY';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')\""

User runs in own terminal. Re-run 0.1 after. Never write key yourself.

### 0.3 Repair Base URL

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));const k=s.env?.MIMO_API_KEY||'';const u=k.startsWith('sk-')?'https://api.xiaomimimo.com/anthropic':'https://token-plan-cn.xiaomimimo.com/anthropic';if(!s.env.MIMO_BASE_URL){s.env.MIMO_BASE_URL=u;fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')}"
```

### 0.4 Repair permission

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));if(!s.permissions)s.permissions={allow:[]};const a=s.permissions.allow;if(!a.some(x=>x.includes('unblind'))){a.push('Bash(*~/.claude/skills/unblind/scripts/unblind.mjs*)');fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')}"
```

### 0.5 Repair model | 0.6 Switch model | 0.7 Version check | 0.8 Node.js check

See `resources/troubleshooting.md` for details.

### 0.9 All healthy → Phase 1

## Phase 1-4: Analyze Image

**Phase 1:** Extract image path from `[Image: source: <path>]`. Validate: absolute path, supported ext, no shell metacharacters.

**Phase 2:** Classify mode from Mode table. Default: `describe`.

**Phase 3:** Execute:
```bash
node ~/.claude/skills/unblind/scripts/unblind.mjs '<image-path>' <mode>
```
No preamble. No permission prompt.

**Phase 4:** Print stdout. API key error → back to 0.2.

<!-- LEVEL 3: Resources below (loaded on-demand only) -->

## Models & Modes

| Model | Credits (in/out) | Vision |
|---|---|---|
| **mimo-v2.5** (default) | 100/200 | Yes |
| mimo-v2-omni | 280/1400 | Yes |
| gpt-4o (via OpenAI) | varies | Yes |

mimo-v2.5-pro has NO vision support. Never use it.

| Mode | Triggers |
|---|---|
| `describe` | default, "what's in", "describe", "描述" |
| `ocr` | "read text", "extract", "OCR", "文字" |
| `ui-review` | "review", "UI", "design", "界面" |
| `chart-data` | "chart", "graph", "data", "图表" |
| `object-detect` | "objects", "detect", "identify" |

For detailed API docs, config guide, and troubleshooting, see `resources/best_practices.md`.
For install guide, see README.md.
