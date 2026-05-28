import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { log } from "./logger.js";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

const DEFAULTS = {
  maxImageSize: 50 * 1024 * 1024,        // 50MB
  jpegQuality: 80,
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  },
  circuitBreaker: {
    failureThreshold: 5,
    timeoutSeconds: 60,
  },
  logging: {
    level: "info",
  },
  requestTimeoutMs: 30_000,
};

const MAX_SIZE_WARN_THRESHOLD = 20 * 1024 * 1024; // 20MB

/**
 * 从 ~/.claude/settings.json 读取配置，校验，补全默认值
 * @returns {{
 *   apiKey: string,
 *   baseUrl: string,
 *   model: string,
 *   maxImageSize: number,
 *   jpegQuality: number,
 *   retry: { maxAttempts: number, baseDelayMs: number, maxDelayMs: number },
 *   circuitBreaker: { failureThreshold: number, timeoutSeconds: number },
 *   logging: { level: string },
 *   requestTimeoutMs: number
 * }}
 */
export function loadConfig() {
  let settings = {};
  try {
    const raw = readFileSync(SETTINGS_FILE, "utf8");
    settings = JSON.parse(raw);
  } catch {
    log("warn", "config", "settings_file_unreadable", { path: SETTINGS_FILE });
  }

  const env = settings.env || {};

  const config = {
    apiKey: env.MIMO_API_KEY || "",
    baseUrl: env.MIMO_BASE_URL || "",
    model: env.MIMO_VISION_MODEL || "mimo-v2.5",
    maxImageSize: env.MIMO_MAX_IMAGE_SIZE
      ? Number(env.MIMO_MAX_IMAGE_SIZE)
      : DEFAULTS.maxImageSize,
    jpegQuality: env.MIMO_JPEG_QUALITY
      ? Number(env.MIMO_JPEG_QUALITY)
      : DEFAULTS.jpegQuality,
    retry: { ...DEFAULTS.retry },
    circuitBreaker: { ...DEFAULTS.circuitBreaker },
    logging: { ...DEFAULTS.logging },
    requestTimeoutMs: env.MIMO_REQUEST_TIMEOUT
      ? Number(env.MIMO_REQUEST_TIMEOUT)
      : DEFAULTS.requestTimeoutMs,
  };

  // 性能警告
  if (config.maxImageSize > MAX_SIZE_WARN_THRESHOLD) {
    log("warn", "config", "large_max_image_size", {
      maxImageSizeMB: (config.maxImageSize / 1024 / 1024).toFixed(0),
      advisory: "大于 20MB 的图片可能导致 API 调用耗时增加和 token 消耗上升",
    });
    process.stderr.write(
      `⚠️ 性能提示：当前图片大小上限 ${(config.maxImageSize / 1024 / 1024).toFixed(0)}MB，` +
      `超过 20MB 可能导致处理变慢。可在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整。\n`
    );
  }

  log("info", "config", "loaded", {
    model: config.model,
    maxImageSizeMB: (config.maxImageSize / 1024 / 1024).toFixed(1),
  });

  return config;
}
