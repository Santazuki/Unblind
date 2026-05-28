# Unblind 故障排查与修复指南

> Level 3 资源 — 仅在 Phase 0 检测到异常时加载

## API Key 设置 (Phase 0.2)

用户需在终端运行（替换 YOUR_KEY）：

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.env.MIMO_API_KEY='YOUR_KEY';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')"
```

Key 类型：
- `tp-` 开头 → Token Plan 订阅: https://token-plan-cn.xiaomimimo.com
- `sk-ant` 开头 → Mimo 余额/按量: https://mimo.xiaomi.com
- `sk-` 其他 → OpenAI (GPT-4V/GLM-5V/Ollama)

## Base URL 修复 (Phase 0.3)

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));const k=s.env?.MIMO_API_KEY||'';const u=k.startsWith('sk-ant')?'https://api.xiaomimimo.com/anthropic':k.startsWith('sk-')?'https://api.openai.com/v1':'https://token-plan-cn.xiaomimimo.com/anthropic';if(!s.env.MIMO_BASE_URL){s.env.MIMO_BASE_URL=u;fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')}"
```

## 权限修复 (Phase 0.4)

```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));if(!s.permissions)s.permissions={allow:[]};const a=s.permissions.allow;if(!a.some(x=>x.includes('unblind'))){a.push('Bash(*~/.claude/skills/unblind/scripts/unblind.mjs*)');fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')}"
```

## 模型选择 (Phase 0.5)

询问用户：

> 请选择视觉模型：
> 1. **mimo-v2.5**（推荐）— 100/200 credits
> 2. **mimo-v2-omni** — 280/1400 credits
> 输入 1 或 2：

选 1：
```bash
node -e "const fs=require('fs');const os=require('os');const p=require('path').join(os.homedir(),'.claude','settings.json');const s=JSON.parse(fs.readFileSync(p,'utf8'));s.env.MIMO_VISION_MODEL='mimo-v2.5';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\n')"
```

选 2：替换 `mimo-v2.5` 为 `mimo-v2-omni`。

注意：`mimo-v2.5-pro` 不支持图片，勿用。

## 模型切换 (Phase 0.6)

用户说 "切换模型" / "switch model" / "换个模型" → 显示当前模型 → 弹出 0.5 的选择提示 → Bash 写入 → 确认 "已切换到 <model>。"

## 版本检查 (Phase 0.7)

```bash
cd ~/.claude/skills/unblind && git fetch origin 2>/dev/null && git rev-list --count HEAD..origin/master 2>/dev/null || echo "0"
```

若 > 0：`Unblind 有新版本可用（落后 <N> 个提交）。运行 cd ~/.claude/skills/unblind && git pull 更新。`

## Node.js 检查 (Phase 0.8)

```bash
node --version
```

若失败或 < 18：`Unblind 需要 Node.js >= 18，请安装后重试。` 停止。

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `API Key 无效或被拒绝` (401) | Key 过期/错误 | 重新获取 Key，运行 Phase 0.2 命令 |
| `API 请求频率超限` (429) | 调用太频繁 | 等待后自动重试 |
| `服务端异常` (5xx) | Mimo/OpenAI 服务故障 | 等待恢复，或切换 Provider |
| `文件内容与扩展名不匹配` | 文件损坏或格式错误 | 检查图片文件 |
| `图片文件为空` | 0 字节文件 | 提供有效图片 |
| `路径不是文件` | 传入了目录路径 | 指定图片文件路径 |
