# Phase 0 静默模式

## 问题

当前 Phase 0.1 执行 `--config` 和 permission 检查，Claude 读完 stdout 后依次跑完 0.2-0.9 所有修复步骤。实际在健康状态下这些步骤全是噪音——运行、输出、条件判断，但什么都不需要修。

## 方案

只改 SKILL.md Phase 0.1 的说明文字，不改一行代码。

让 Claude 按以下逻辑解析 Phase 0.1 两条命令的 stdout：

1. 运行两条命令（同当前）
2. 取 stdout，检查是否包含以下标记：
   - `KEY_MISSING` → 进入 Phase 0.2（API Key 修复）
   - `MODEL_MISSING` → 进入 Phase 0.5（模型修复）
   - `PERM_MISSING` → 进入 Phase 0.4（权限修复）
3. stdout 为空，或不含上述任何标记 → 健康，**直接跳到 Phase 1**

### 改动

| 文件 | 改动 | 行数 |
|------|------|------|
| `SKILL.md` | Phase 0.1 下方增加标记解析指引 | ~8 行 |

### 改后的 Phase 0.1 示意

```markdown
### 0.1 Check health

```bash
node ~/.claude/skills/unblind/scripts/unblind.mjs --config 2>/dev/null
node -e "const s=JSON.parse(...)"
```

**Parse stdout:**
- Contains `KEY_MISSING` → 0.2
- Contains `MODEL_MISSING` → 0.5
- Contains `PERM_MISSING` → 0.4
- Otherwise (empty or no marker) → healthy, proceed to Phase 1
```

### 验证方式

1. 健康环境下触发 unblind 一次，观察是否跳过 Phase 0.2-0.9 直接进入 Phase 1
2. 手动删除 API Key 后再次触发，观察是否进入 Phase 0.2
3. 手动撤销 permission 后再次触发，观察是否进入 Phase 0.4
