# Unblind — 测试场景 / Test Scenarios

> 遵循 agentskills.io 场景测试规范

## Scenario 1: 通用图片描述
**Difficulty:** Easy
**Query:** "What's in this image?" (附一张风景照)
**Expected behaviors:**
1. Phase 0 静默通过，直接进入 Phase 1
   - **Minimum:** 不输出任何自检信息
   - **Quality criteria:** stdout 无 JSON Lines 日志
   - **Haiku pitfall:** 可能逐字输出 Phase 0 检查结果
   - **Weight:** 3
2. 图片被 describe 模式正确分析
   - **Minimum:** 返回非空文本描述
   - **Quality criteria:** 描述包含主体/背景/颜色等结构化内容
   - **Haiku pitfall:** 可能跳过模式选择直接用 default
   - **Weight:** 5

## Scenario 2: Phase 0 自愈（配置缺失）
**Difficulty:** Medium
**Query:** 用户未设置 MIMO_API_KEY，发一张图片
**Expected behaviors:**
1. Phase 0.1 检测到 KEY_MISSING
   - **Minimum:** 输出 KEY_MISSING 标记
   - **Quality criteria:** 精准诊断，不误报其他检查项
   - **Weight:** 4
2. Phase 0.2 引导用户设置 Key
   - **Minimum:** 给出终端命令让用户自行执行
   - **Quality criteria:** Key 不进入对话记录，不通过 Read/Edit 工具操作
   - **Weight:** 5
3. 用户确认后重新检测通过
   - **Minimum:** 再次运行 0.1，输出为空（健康）
   - **Weight:** 3

## Scenario 3: Provider 故障转移
**Difficulty:** Hard
**Query:** 用户同时配置了 MIMO_API_KEY 和 OPENAI_API_KEY，Mimo API 返回 500
**Expected behaviors:**
1. 主 Provider (Mimo) 重试 3 次后失败
   - **Minimum:** 指数退避 1s→2s→4s 后放弃
   - **Quality criteria:** 熔断器触发，记录 circuit_open 事件
   - **Weight:** 4
2. 自动切换到 OpenAI Provider
   - **Minimum:** 切换后成功返回结果
   - **Quality criteria:** 用户无感切换，日志记录回退事件
   - **Weight:** 5
3. 两个 Provider 的熔断器状态隔离
   - **Minimum:** Mimo 的 OPEN 状态不影响 OpenAI
   - **Weight:** 4

## Scenario 4: 恶意输入防御
**Difficulty:** Edge-case
**Query:** 用户传入包含 shell 元字符的路径 `test"; rm -rf / #.png`
**Expected behaviors:**
1. Phase 1 路径校验门拦截
   - **Minimum:** 检测到元字符，拒绝执行
   - **Quality criteria:** 输出中文错误提示 "图片路径包含不安全字符"
   - **Weight:** 5
2. 不调用任何 shell 命令
   - **Minimum:** 路径未进入 Bash 执行
   - **Quality criteria:** 日志中无任何命令执行记录
   - **Weight:** 5
