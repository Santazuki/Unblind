import { ClientError, ServerError, NetworkError } from "./errorHandler.js";
import { log } from "./logger.js";

/**
 * 发送 API 请求，统一处理超时、错误分类、网络异常
 * 解析 429 Retry-After 头，传递给上层重试逻辑
 */
export async function apiRequest(url, { body, headers = {}, timeoutMs = 30_000, providerName }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw await httpError(res, providerName);
    return res;

  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ClientError || err instanceof ServerError) throw err;
    if (err.name === "AbortError") {
      throw new NetworkError(`请求超时 (${timeoutMs / 1000}s)`, {
        suggestion: "网络较慢或图片过大，请重试",
      });
    }
    throw new NetworkError(`网络请求失败: ${err.message}`, {
      suggestion: "请检查网络连接后重试",
    });
  }
}

/** 根据 HTTP 状态码分类，429 时解析 Retry-After 头 */
async function httpError(res, providerName) {
  const text = await res.text();
  const s = res.status;

  if (s === 401 || s === 403) {
    throw new ClientError(`${providerName} API Key 无效`, { statusCode: s, suggestion: "请检查 API Key 是否正确" });
  }
  if (s === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const waitSec = retryAfter ? parseInt(retryAfter) : null;
    throw new ServerError(`${providerName} API 限流`, {
      statusCode: s,
      retryAfterSec: waitSec,
      suggestion: waitSec ? `请等待 ${waitSec}s 后重试` : "请稍后重试（系统将自动重试）",
    });
  }
  if (s >= 500) {
    throw new ServerError(`${providerName} 服务异常`, { statusCode: s });
  }
  throw new ClientError(`${providerName} API 请求失败`, { statusCode: s, suggestion: text.slice(0, 200) });
}

log("debug", "httpClient", "module_loaded");
