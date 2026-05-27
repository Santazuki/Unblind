# Unblind — Test Report

Last updated: 2026-05-28

## 1. Model Discovery (2026-05-27)

| # | Model | Vision | Credits (in/out) | Result |
|---|---|---|---|---|
| 1 | `mimo-v2.5` | Yes | 100 / 200 | Selected as default |
| 2 | `mimo-v2-omni` | Yes | 280 / 1400 | Works, 7x more expensive output |
| 3 | `mimo-v2.5-pro` | No | 300 / 600 | Rejected — no image input support |

**Method:** Sent a 1x1 red PNG to each model endpoint via Mimo's Anthropic-compatible API.
All three responded to text; v2.5-pro returned "No endpoints found that support image input."

## 2. Image Recognition — Multi-Scene (2026-05-27)

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

**Method:** Changed `MIMO_VISION_MODEL` in `~/.claude/settings.json` and ran the same image through both models.
Both returned valid descriptions; omni output was slightly more verbose.

## 5. Self-Healing Setup — Full Flow (2026-05-28)

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
| 2 | Overly broad Bash permission `*unblind.mjs*` | High | Fixed — scoped to `~/.claude/skills/unblind/` |
| 3 | No fetch timeout | Medium | Fixed — 30s AbortController |
| 4 | No file size limit | Low | Fixed — 50MB max, empty file check |
| 5 | Unsigned commits | Medium | Fixed — all 10 commits GPG-signed |
| 6 | Stale filename in usage text | Low | Fixed |
| 7 | Plaintext API key in settings.json | Low | Accepted (ecosystem limitation) |
| 8 | API key in Bash command output | High | Fixed — removed all exports, rely on env injection |

## 8. Future Test Checklist

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
