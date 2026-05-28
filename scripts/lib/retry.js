import { log } from "./logger.js";
import { isRetryable } from "./errorHandler.js";

// Circuit Breaker 状态
const State = { CLOSED: "CLOSED", OPEN: "OPEN", HALF_OPEN: "HALF_OPEN" };

let circuitState = State.CLOSED;
let failureCount = 0;
let lastFailureTime = 0;
let openUntil = 0;

/**
 * @typedef {{ maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number,
 *   circuitBreaker?: { failureThreshold?: number, timeoutSeconds?: number }
 * }} RetryOptions
 */

/**
 * 执行带重试和熔断保护的异步操作
 * @param {() => Promise<any>} fn
 * @param {RetryOptions} options
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    circuitBreaker = { failureThreshold: 5, timeoutSeconds: 60 },
  } = options;

  // 熔断检查
  if (circuitState === State.OPEN) {
    if (Date.now() < openUntil) {
      const remaining = Math.ceil((openUntil - Date.now()) / 1000);
      const err = new Error(`熔断保护中，${remaining}s 后自动恢复`);
      err.name = "CircuitBreakerOpenError";
      throw err;
    }
    circuitState = State.HALF_OPEN;
    log("info", "retry", "circuit_half_open");
  }

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();

      // 成功 → 重置
      // HALF_OPEN 恢复：单线程 Node.js 无竞态，await fn() 期间其他调用排队
      if (circuitState === State.HALF_OPEN) {
        circuitState = State.CLOSED;
        log("info", "retry", "circuit_closed_recovered");
      }
      failureCount = 0;  // 每次成功都清零（简单连续故障模型，非滑动窗口）
      return result;

    } catch (err) {
      lastError = err;

      // 不可重试的错误直接抛
      if (!isRetryable(err)) throw err;

      failureCount++;
      log("warn", "retry", "attempt_failed", {
        attempt: attempt + 1,
        maxAttempts,
        error: err.message,
      });

      // 触发熔断
      if (failureCount >= (circuitBreaker.failureThreshold || 5)) {
        circuitState = State.OPEN;
        openUntil = Date.now() + (circuitBreaker.timeoutSeconds || 60) * 1000;
        log("error", "retry", "circuit_open", {
          failureCount,
          timeoutSeconds: circuitBreaker.timeoutSeconds,
        });
        const remaining = circuitBreaker.timeoutSeconds;
        const msg = `熔断保护已触发（连续 ${failureCount} 次失败），${remaining}s 后自动恢复`;
        throw Object.assign(new Error(msg), { name: "CircuitBreakerOpenError" });
      }

      // 最后一次不等待
      if (attempt < maxAttempts - 1) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        log("debug", "retry", "backoff", { delayMs: delay, attempt: attempt + 1 });
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/**
 * @returns {"CLOSED"|"OPEN"|"HALF_OPEN"}
 */
export function getCircuitState() {
  if (circuitState === State.OPEN && Date.now() >= openUntil) {
    circuitState = State.HALF_OPEN;
  }
  return circuitState;
}

/** 重置熔断器（测试用） */
export function resetCircuit() {
  circuitState = State.CLOSED;
  failureCount = 0;
  lastFailureTime = 0;
  openUntil = 0;
}

log("debug", "retry", "module_loaded");
