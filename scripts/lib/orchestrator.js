import { createHash } from "crypto";
import { log, setLogLevel } from "./logger.js";
import { loadConfig } from "./config.js";
import { getApiKey, getBaseUrl } from "./credentialManager.js";
import { processImage } from "./imageProcessor.js";
import { withRetry, CircuitBreaker } from "./retry.js";
import { ClientError } from "./errorHandler.js";
import { MODE_PROMPTS, VALID_MODES } from "./providers/provider.js";
import { getCacheKey, get, set, getStats } from "./cache.js";
import { loadProviders } from "./providers/registry.js";

const FORMAT_PROMPTS = {
  json: "\n\nOutput the result as a single valid JSON object with keys: summary, details (array of strings). Do not wrap in markdown code blocks.",
  yaml: "\n\nOutput the result as valid YAML with keys: summary, details. Do not wrap in markdown code blocks.",
  csv: "\n\nOutput the result as CSV with columns: category, description. Include header row.",
};

/** 构建 Provider 链，每个 Provider 独立 CircuitBreaker */
function buildProviderChain(config) {
  const mimoKey = getApiKey();
  const baseUrls = {
    mimo: mimoKey ? getBaseUrl(mimoKey) : "",
  };
  const model = process.env.OPENAI_VISION_MODEL || config.model;

  const providers = loadProviders(config.providerOrder, {
    model: config.model,
    timeoutMs: config.requestTimeoutMs,
    baseUrls,
  });

  return providers.map(p => ({
    ...p,
    cb: new CircuitBreaker({ failureThreshold: p.name === "ollama" ? 3 : 5, timeoutSeconds: 60 }),
  }));
}

/** 遍历 Provider 链，第一个成功即返回 */
async function tryChain(chain, images, mode, config, prompt) {
  const errors = [];
  for (const { provider, name, cb } of chain) {
    if (cb.state === "OPEN") {
      log("info", "orchestrator", "provider_skipped", { provider: name, reason: "circuit_open" });
      continue;
    }

    try {
      log("info", "orchestrator", "calling_provider", { provider: name, mode });
      const result = await withRetry(
        () => provider.analyzeImage({ image: images, prompt, options: { mode } }),
        { ...config.retry, circuitBreaker: cb }
      );
      log("info", "orchestrator", "analysis_complete", { mode, durationMs: result.processingTimeMs, provider: name });
      return result;
    } catch (err) {
      errors.push({ name, error: err.message });
      if (err.name === "ClientError" || err.name === "CircuitBreakerOpenError") continue;
      log("warn", "orchestrator", "provider_failed", { provider: name, error: err.message });
    }
  }
  throw new ClientError("所有 Provider 均不可用", {
    suggestion: `已尝试 ${chain.length} 个 Provider。请稍后重试或检查配置。`,
  });
}

export async function analyze(imagePaths, mode = "describe", options = {}) {
  const config = loadConfig();
  setLogLevel(config.logging.level);

  if (!VALID_MODES.includes(mode)) {
    throw new ClientError(`未知的分析模式: ${mode}`, {
      suggestion: `支持的模式: ${VALID_MODES.join(", ")}`,
    });
  }

  const chain = buildProviderChain(config);
  if (chain.length === 0) {
    throw new ClientError("API Key 未配置", {
      suggestion: "请设置 MIMO_API_KEY 或 OPENAI_API_KEY 环境变量",
    });
  }

  // Normalize to array (backward-compatible with string path)
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  log("info", "orchestrator", "processing_images", { path: paths.map(p => p.slice(-30)).join(", "), mode, count: paths.length });

  // Batch process all images
  const images = await Promise.all(
    paths.map(p => processImage(p, { maxImageSize: config.maxImageSize }))
  );

  const cachePrompt = MODE_PROMPTS[mode];  // 缓存键不含格式指令，跨格式共享
  const apiPrompt = cachePrompt + (options.format ? (FORMAT_PROMPTS[options.format] || "") : "");

  // Multi-image cache key: hash all base64 concatenated (backward-compatible for single image)
  const combinedBase64 = images.map(i => i.base64).join("::");
  const imageHash = createHash("sha256").update(combinedBase64).digest("hex");

  if (!options.skipCache) {
    const cacheKey = getCacheKey(imageHash, cachePrompt);
    const cacheEntry = await get(cacheKey);
    if (cacheEntry) {
      log("info", "orchestrator", "cache_hit", { path: paths.map(p => p.slice(-30)).join(", "), mode, stats: await getStats() });
      return cacheEntry.content;
    }
  }

  const result = await tryChain(chain, images, mode, config, apiPrompt);

  if (!options.skipCache) {
    await set(getCacheKey(imageHash, cachePrompt), { content: result.content }, config.cacheTTLSeconds || 3600);
  }

  return result.content;
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

  const chain = buildProviderChain(config);
  checks.push({ name: "providers", pass: chain.length > 0, detail: `${chain.length} 个可用 Provider: ${chain.map(c => c.name).join(", ")}` });

  let anyOk = false;
  for (const { provider, name } of chain) {
    try {
      const ok = await provider.healthCheck();
      checks.push({ name: `connectivity_${name}`, pass: ok, detail: ok ? `${name} API 连通正常` : `${name} API 连通失败` });
      if (ok) anyOk = true;
    } catch (err) {
      checks.push({ name: `connectivity_${name}`, pass: false, detail: err.message });
    }
  }
  if (!anyOk && chain.length > 0) {
    checks.push({ name: "all_providers", pass: false, detail: "所有 Provider 均无法连通" });
  }

  return { healthy: checks.every(c => c.pass), checks };
}
