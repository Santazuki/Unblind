// Mimo Vision Provider
// Phase 1 — Mimo Anthropic-compatible API 适配实现
//
// API 端点: https://token-plan-cn.xiaomimimo.com/anthropic/v1/messages
// 认证方式: x-api-key (Token Plan) 或 Bearer (Balance)
// 支持模型: mimo-v2.5, mimo-v2-omni
// 不支持: mimo-v2.5-pro (无视觉能力)
//
// 当前实现位置: ../../unblind.mjs
// 重构时迁移至此文件，实现 IVisionProvider 接口
