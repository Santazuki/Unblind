import { createHash } from "crypto";
import { log } from "./logger.js";

/** @type {Map<string, { value: any, expiresAt: number }>} */
const store = new Map();

let hits = 0;
let misses = 0;

/**
 * 生成缓存键（基于图片内容哈希 + 提示词的 SHA256）
 * @param {string} contentHash - 图片内容的 SHA256 哈希
 * @param {string} prompt - 分析提示词
 * @returns {string}
 */
export function getCacheKey(contentHash, prompt) {
  return createHash("sha256")
    .update(`${contentHash}:${prompt}`)
    .digest("hex");
}

/**
 * 获取缓存结果
 * @param {string} key
 * @returns {any|null}
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    misses++;
    log("debug", "cache", "entry_expired", { key: key.slice(0, 8) });
    return null;
  }
  hits++;
  log("debug", "cache", "hit", { key: key.slice(0, 8) });
  return entry.value;
}

/**
 * 存储缓存结果
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
export function set(key, value, ttlSeconds = 3600) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  log("debug", "cache", "set", { key: key.slice(0, 8), ttlSeconds });
}

/**
 * 删除缓存条目
 * @param {string} key
 */
export function invalidate(key) {
  store.delete(key);
  log("debug", "cache", "invalidated", { key: key.slice(0, 8) });
}

/**
 * 获取缓存统计
 * @returns {{ hits: number, misses: number, size: number }}
 */
export function getStats() {
  return { hits, misses, size: store.size };
}

/** 清空全部缓存 */
export function clear() {
  store.clear();
  hits = 0;
  misses = 0;
  log("debug", "cache", "cleared");
}

log("debug", "cache", "module_loaded");
