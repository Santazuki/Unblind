import { log } from "./logger.js";

/**
 * 获取 API Key（从环境变量读取）
 * @returns {string}
 */
export function getApiKey() {
  return process.env.MIMO_API_KEY || "";
}

/**
 * 根据 API Key 前缀自动检测 Base URL
 * sk-ant → api.xiaomimimo.com/anthropic (Mimo Balance)
 * sk-   → api.openai.com/v1 (OpenAI Chat Completions)
 * tp-   → token-plan-cn.xiaomimimo.com
 * 其他   → token-plan-cn（默认）
 * @param {string} apiKey
 * @returns {string}
 */
export function getBaseUrl(apiKey) {
  if (!apiKey) return "";

  if (apiKey.startsWith("sk-ant")) {
    const url = "https://api.xiaomimimo.com/anthropic";
    log("debug", "credentialManager", "base_url_detected", { type: "balance", url });
    return url;
  }

  if (apiKey.startsWith("AIza")) {
    const url = "https://generativelanguage.googleapis.com/v1beta";
    log("debug", "credentialManager", "base_url_detected", { type: "gemini", url });
    return url;
  }

  if (apiKey.startsWith("sk-")) {
    const url = "https://api.openai.com/v1";
    log("debug", "credentialManager", "base_url_detected", { type: "openai", url });
    return url;
  }

  // tp- 或其他 → token-plan
  const url = "https://token-plan-cn.xiaomimimo.com/anthropic";
  log("debug", "credentialManager", "base_url_detected", { type: apiKey.startsWith("tp-") ? "token" : "unknown", url });
  return url;
}

/**
 * 根据 API Key 类型生成 Auth Header
 * @param {string} apiKey
 * @returns {object}
 */
export function getAuthHeader(apiKey) {
  if (apiKey.startsWith("sk-")) {
    return { "Authorization": `Bearer ${apiKey}` };
  }
  if (apiKey.startsWith("AIza")) {
    return { "x-goog-api-key": apiKey };
  }
  return { "x-api-key": apiKey };
}

log("debug", "credentialManager", "module_loaded");
