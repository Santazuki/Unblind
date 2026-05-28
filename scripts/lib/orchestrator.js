import { createHash } from "crypto";
import { log, setLogLevel } from "./logger.js";
import { loadConfig } from "./config.js";
import { getApiKey, getBaseUrl } from "./credentialManager.js";
import { processImage } from "./imageProcessor.js";
import { withRetry } from "./retry.js";
import { MimoProvider } from "./providers/mimo.js";
import { OpenAIProvider } from "./providers/openai.js";
import { ClientError } from "./errorHandler.js";
import { MODE_PROMPTS, VALID_MODES } from "./providers/provider.js";
import { getCacheKey, get, set, getStats } from "./cache.js";

/**
 * 创建主备 Provider 对
 * @param {string} primaryKey - 主 API Key（MIMO）
 * @param {string} fallbackKey - 备选 API Key（OpenAI，可选）
 * @returns {{ primary: {provider, name}, fallback: {provider, name} | null }}
 */
function createProvider(primaryKey, fallbackKey, model, timeoutMs) {
  const createOne = (apiKey) => {
    const baseUrl = getBaseUrl(apiKey);
    const isOpenAI = apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant");
    const Provider = isOpenAI ? OpenAIProvider : MimoProvider;
    return { provider: new Provider({ apiKey, baseUrl, model, timeoutMs }), name: isOpenAI ? "openai" : "mimo" };
  };
  const primary = createOne(primaryKey);
  let fallback = null;
  if (fallbackKey && fallbackKey !== primaryKey) {
    fallback = createOne(fallbackKey);
  }
  return { primary, fallback };
}

export async function analyze(imagePath, mode = "describe", options = {}) {
  const config = loadConfig();
  setLogLevel(config.logging.level);

  if (!VALID_MODES.includes(mode)) {
    throw new ClientError(`未知的分析模式: ${mode}`, {
      suggestion: `支持的模式: ${VALID_MODES.join(", ")}`,
    });
  }

  const primaryKey = getApiKey();
  const fallbackKey = process.env.OPENAI_API_KEY || "";

  if (!primaryKey && !fallbackKey) {
    throw new ClientError("API Key 未配置", {
      suggestion: "请设置 MIMO_API_KEY 或 OPENAI_API_KEY 环境变量或在 ~/.claude/settings.json 的 env 段中配置",
    });
  }

  log("info", "orchestrator", "processing_image", { path: imagePath.slice(-30), mode });
  const { base64 } = await processImage(imagePath, { maxImageSize: config.maxImageSize });

  const imageHash = createHash("sha256").update(base64).digest("hex");
  const prompt = MODE_PROMPTS[mode];

  if (!options.skipCache) {
    const cacheKey = getCacheKey(imageHash, prompt);
    const cacheEntry = await get(cacheKey);
    if (cacheEntry) {
      log("info", "orchestrator", "cache_hit", { path: imagePath.slice(-30), mode, stats: await getStats() });
      return cacheEntry.content;
    }
  }

  const { primary, fallback } = createProvider(primaryKey, fallbackKey, config.model, config.requestTimeoutMs);

  // 主 Provider
  try {
    log("info", "orchestrator", "calling_provider", { provider: primary.name, mode });
    const result = await withRetry(
      () => primary.provider.analyzeImage({ image: base64, options: { mode } }),
      { ...config.retry, circuitBreaker: config.circuitBreaker }
    );

    log("info", "orchestrator", "analysis_complete", { mode, durationMs: result.processingTimeMs });

    if (!options.skipCache) {
      await set(getCacheKey(imageHash, prompt), { content: result.content }, config.cacheTTLSeconds || 3600);
    }

    return result.content;
  } catch (err) {
    // 非客户端错误（ServerError/NetworkError/CircuitBreaker）且有备选时自动切换
    if (fallback && err.name !== "ClientError") {
      log("info", "orchestrator", "failing_over", {
        from: primary.name,
        to: fallback.name,
        reason: err.name,
      });
      try {
        const result = await fallback.provider.analyzeImage({ image: base64, options: { mode } });
        log("info", "orchestrator", "analysis_complete", { mode, durationMs: result.processingTimeMs, provider: fallback.name });
        if (!options.skipCache) {
          await set(getCacheKey(imageHash, prompt), { content: result.content }, config.cacheTTLSeconds || 3600);
        }
        return result.content;
      } catch (fallbackErr) {
        throw new ClientError("所有 API 服务均不可用", {
          suggestion: "请稍后重试。若持续出现，请检查 API Key 配置或网络连接。",
        });
      }
    }
    throw err;
  }
}

export async function runHealthCheck() {
  const checks = [];
  const config = loadConfig();

  try {
    checks.push({ name: "config", pass: true, detail: `模型: ${config.model}, 图片上限: ${(config.maxImageSize / 1024 / 1024).toFixed(0)}MB` });
  } catch (err) {
    checks.push({ name: "config", pass: false, detail: err.message });
    return { healthy: false, checks };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    checks.push({ name: "api_key", pass: false, detail: "未设置 MIMO_API_KEY" });
    return { healthy: false, checks };
  }
  checks.push({ name: "api_key", pass: true, detail: `Key 前缀: ${apiKey.slice(0, 3)}...` });

  try {
    const { primary } = createProvider(apiKey, "", config.model, 10_000);
    const ok = await primary.provider.healthCheck();
    checks.push({ name: "api_connectivity", pass: ok, detail: ok ? `${primary.name} API 连通正常` : `${primary.name} API 连通失败` });
  } catch (err) {
    checks.push({ name: "api_connectivity", pass: false, detail: err.message });
  }

  return { healthy: checks.every(c => c.pass), checks };
}
