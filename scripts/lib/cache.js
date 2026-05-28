import { createHash } from "crypto";
import { log } from "./logger.js";
import { mkdir, readFile, writeFile, readdir, unlink, stat } from "fs/promises";
import path from "path";
import os from "os";

const CACHE_DIR = path.join(os.homedir(), ".claude", "unblind", "cache");
const MAX_ENTRIES = 1000;

let hits = 0;
let misses = 0;

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

function keyToFile(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

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
 * @returns {Promise<any|null>}
 */
export async function get(key) {
  try {
    const filePath = keyToFile(key);
    const raw = await readFile(filePath, "utf-8");
    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      await unlink(filePath).catch(() => {});
      misses++;
      log("debug", "cache", "entry_expired", { key: key.slice(0, 8) });
      return null;
    }
    hits++;
    log("debug", "cache", "hit", { key: key.slice(0, 8) });
    return entry.value;
  } catch {
    misses++;
    return null;
  }
}

/**
 * 存储缓存结果
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
export async function set(key, value, ttlSeconds = 3600) {
  try {
    await ensureCacheDir();
    const entry = { value, expiresAt: Date.now() + ttlSeconds * 1000 };
    await writeFile(keyToFile(key), JSON.stringify(entry), "utf-8");
    log("debug", "cache", "set", { key: key.slice(0, 8), ttlSeconds });
    await enforceLRULimit();
  } catch {
    // I/O 错误时降级，不抛错
  }
}

/**
 * 当缓存超过 MAX_ENTRIES 时，删除最旧的文件（基于 mtime）
 */
async function enforceLRULimit() {
  let files;
  try {
    files = await readdir(CACHE_DIR);
  } catch {
    return;
  }
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  if (jsonFiles.length <= MAX_ENTRIES) return;

  const entries = await Promise.all(
    jsonFiles.map(async (file) => {
      try {
        const s = await stat(path.join(CACHE_DIR, file));
        return { file, mtime: s.mtimeMs };
      } catch {
        return null;
      }
    }),
  );

  const valid = entries.filter(Boolean).sort((a, b) => a.mtime - b.mtime);
  const toDelete = valid.slice(0, valid.length - MAX_ENTRIES);
  await Promise.all(
    toDelete.map((e) => unlink(path.join(CACHE_DIR, e.file)).catch(() => {})),
  );
}

/**
 * 删除缓存条目
 * @param {string} key
 */
export async function invalidate(key) {
  try {
    await unlink(keyToFile(key));
    log("debug", "cache", "invalidated", { key: key.slice(0, 8) });
  } catch {
    // 文件不存在，忽略
  }
}

/**
 * 获取缓存统计
 * @returns {Promise<{ hits: number, misses: number, size: number }>}
 */
export async function getStats() {
  let size = 0;
  try {
    const files = await readdir(CACHE_DIR);
    size = files.filter((f) => f.endsWith(".json")).length;
  } catch {
    size = 0;
  }
  return { hits, misses, size };
}

/** 清空全部缓存 */
export async function clear() {
  try {
    const files = await readdir(CACHE_DIR);
    await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => unlink(path.join(CACHE_DIR, f)).catch(() => {})),
    );
  } catch {
    // 目录不存在，无需清理
  }
  hits = 0;
  misses = 0;
  log("debug", "cache", "cleared");
}

log("debug", "cache", "module_loaded");
