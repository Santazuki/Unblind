---
name: unblind
description: >
  Routes images to Mimo/OpenAI vision API for text-only models. Use this
  skill when the user sends an image, asks "what's in this picture", says
  "analyze this screenshot", requests "OCR" or "extract text", reviews UI
  designs, reads charts, or uses Chinese triggers like 识别图片/看图.
  Self-healing setup on first run. Does NOT handle video, audio, or PDFs.
metadata:
  version: "2.2"
  category: ai-vision
  bundled_tools:
    - scripts/unblind.mjs
  requirements:
    - Node.js >= 18
    - Mimo or OpenAI API key (auto-prompted on first run)
compatibility: Claude Code (bundled script, zero npm deps)
allowed-tools: Bash(node ~/.claude/skills/unblind/scripts/unblind.mjs:*)
---

<!-- LEVEL 1: Metadata above (~180 tokens, always loaded) -->
<!-- LEVEL 2: Instructions below (~700 tokens, loaded on trigger) -->

# Unblind

Route images to vision API. Never pretend to see. Never Read/Edit settings.json.

## Iron Rules

1. Phase 0 mandatory every invocation
2. NEVER Read/Edit `~/.claude/settings.json`
3. Config via CLI (`--config`, `--set-model`) or `node -e`, never via tools
4. Never preamble. Never hallucinate. Always invoke bundled script.
5. Tool reads API key from env automatically

## Quick Start

User sends image → Unblind routes to Mimo/OpenAI → returns text.
Example: "What's in this screenshot?" → OCR mode extracts all text.
Example: "Review this UI design" → ui-review mode critiques layout/UX.

## Edge Cases

- API key expired/missing → Phase 0.2 prompts user to set it
- Image >50MB → rejected with size limit + compression suggestion
- Unsupported format → rejected with list of 7 supported formats
- Both providers fail → automatic Mimo→OpenAI fallback, clean error if both down
- Malicious path input → metacharacter gate rejects before execution

## Phase 0: Self-Healing

### 0.1 Silent health check

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));const issues=[];if(!s.env?.MIMO_API_KEY) issues.push('KEY_MISSING');if(!s.env?.MIMO_VISION_MODEL||s.env.MIMO_VISION_MODEL==='mimo-v2.5-pro') issues.push('MODEL_MISSING');const a=s.permissions?.allow||[];if(!a.some(x=>x.includes('unblind'))) issues.push('PERM_MISSING');if(issues.length) console.log(issues.join(' '));" 2>/dev/null
```

- Empty → healthy, **skip to Phase 1**
- `KEY_MISSING` → 0.2 | `MODEL_MISSING` → 0.5 | `PERM_MISSING` → 0.4

### 0.2-0.8 Repair procedures

See `resources/troubleshooting.md` for: API key setup, base URL repair, permission fix, model selection, version check, Node.js check.

Key rules:
- API key: user runs command in own terminal. Never write it yourself.
- Model switch: user says "切换模型" → show prompt, write via Bash, confirm.
- Version: `git fetch` → if behind, tell user to `git pull`.

### 0.9 All healthy → Phase 1

## Phase 1-4: Analyze

1. **Detect** image path from `[Image: source: <path>]`. Must be absolute, supported ext, no shell metacharacters.
2. **Classify** mode: `describe` (default), `ocr`, `ui-review`, `chart-data`, `object-detect`.
3. **Execute**: `node ~/.claude/skills/unblind/scripts/unblind.mjs '<path>' <mode>` — no preamble.
4. **Report**: print stdout. API key error → back to 0.2.

## CLI Quick Reference

```
node scripts/unblind.mjs <image> <mode>  分析图片
node scripts/unblind.mjs --health        健康检查
node scripts/unblind.mjs --config        查看配置（Key已脱敏）
node scripts/unblind.mjs --set-model <m> 切换模型 (mimo-v2.5 / mimo-v2-omni)
node scripts/unblind.mjs --no-cache      跳过缓存
node scripts/unblind.mjs --cache-stats   缓存统计
```

<!-- LEVEL 3: Resources (on-demand, see files below) -->

## Resources

- `resources/troubleshooting.md` — Phase 0 repair commands, common errors, Node.js setup
- `resources/best_practices.md` — Model selection guide, token optimization, debugging
- `templates/output_formats/` — JSON/YAML/CSV output templates (Phase 3+)
- `README.md` — Install guide, security verification, GPT audit rebuttal
