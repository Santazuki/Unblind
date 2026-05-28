import { log } from "./logger.js";

/** 客户端错误 — 4xx、无效输入等，不应重试 */
export class ClientError extends Error {
  /**
   * @param {string} reason
   * @param {{ suggestion?: string, statusCode?: number }} [extra]
   */
  constructor(reason, extra = {}) {
    super(reason);
    this.name = "ClientError";
    this.reason = reason;
    this.suggestion = extra.suggestion || "";
    this.statusCode = extra.statusCode || null;
  }
}

/** 服务端错误 — 5xx、429等，可重试 */
export class ServerError extends Error {
  /**
   * @param {string} reason
   * @param {{ suggestion?: string, statusCode?: number }} [extra]
   */
  constructor(reason, extra = {}) {
    super(reason);
    this.name = "ServerError";
    this.reason = reason;
    this.suggestion = extra.suggestion || "";
    this.statusCode = extra.statusCode || null;
  }
}

/** 网络错误 — DNS/连接失败，可重试 */
export class NetworkError extends Error {
  /**
   * @param {string} reason
   * @param {{ host?: string, suggestion?: string }} [extra]
   */
  constructor(reason, extra = {}) {
    super(reason);
    this.name = "NetworkError";
    this.reason = reason;
    this.host = extra.host || "";
    this.suggestion = extra.suggestion || "请检查网络连接后重试";
  }
}

/**
 * 判断错误是否可重试
 * @param {Error} err
 * @returns {boolean}
 */
export function isRetryable(err) {
  return err instanceof ServerError || err instanceof NetworkError;
}

/**
 * 格式化错误为用户友好中文消息
 * @param {Error} err
 * @returns {string}
 */
export function formatError(err) {
  if (err instanceof ClientError) {
    let msg = `❌ 错误：${err.reason}`;
    if (err.statusCode) msg += `（HTTP ${err.statusCode}）`;
    if (err.suggestion) msg += `\n解决建议：${err.suggestion}`;
    return msg;
  }
  if (err instanceof ServerError) {
    let msg = `⚠️ 服务端错误：${err.reason}`;
    if (err.statusCode) msg += `（HTTP ${err.statusCode}）`;
    if (err.suggestion) msg += `\n${err.suggestion}`;
    return msg;
  }
  if (err instanceof NetworkError) {
    return `🔌 网络错误：${err.reason}\n${err.suggestion}`;
  }
  return "未知错误，请检查日志后重试，或提交 issue";
}

log("debug", "errorHandler", "module_loaded");
