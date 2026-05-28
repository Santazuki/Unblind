import { ClientError, ServerError, NetworkError } from "./errorHandler.js";
import { log } from "./logger.js";

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

    if (!res.ok) throw await httpError(res);
    return res;

  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ClientError || err instanceof ServerError) throw err;
    if (err.name === "AbortError") {
      throw new NetworkError("请求超时", { suggestion: "网络较慢或图片过大，请重试" });
    }
    throw new NetworkError("网络请求失败", { suggestion: "请检查网络连接后重试" });
  }
}

/** 不泄露 provider 名称、原始响应体到错误消息 */
async function httpError(res) {
  const s = res.status;
  // 消耗响应体防止内存泄漏，不暴露内容
  res.text().catch(() => {});

  if (s === 401 || s === 403) {
    throw new ClientError("API Key 无效或被拒绝", { statusCode: s, suggestion: "请检查 API Key 是否正确" });
  }
  if (s === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const waitSec = retryAfter ? parseInt(retryAfter) : null;
    throw new ServerError("API 请求频率超限", {
      statusCode: s, retryAfterSec: waitSec,
      suggestion: waitSec ? `请等待 ${waitSec}s 后重试` : "请稍后重试（系统将自动重试）",
    });
  }
  if (s >= 500) {
    throw new ServerError("服务端异常，请稍后重试", { statusCode: s });
  }
  throw new ClientError("API 请求失败", { statusCode: s, suggestion: "请检查请求参数后重试" });
}

log("debug", "httpClient", "module_loaded");
