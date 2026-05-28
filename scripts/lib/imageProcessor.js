import { readFileSync, statSync } from "fs";
import { extname } from "path";
import { ClientError } from "./errorHandler.js";
import { log } from "./logger.js";

const SUPPORTED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
]);

const MIME_MAP = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif",
  ".webp": "image/webp", ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

/**
 * 验证图片扩展名是否支持
 * @param {string} imagePath
 * @returns {boolean}
 */
export function validateFormat(imagePath) {
  const ext = extname(imagePath).toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

/**
 * 获取 MIME type
 * @param {string} imagePath
 * @returns {string}
 */
export function getMimeType(imagePath) {
  const ext = extname(imagePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

/**
 * 处理图片：读取、校验、Base64 编码
 * @param {string} imagePath
 * @param {{ maxImageSize?: number }} [options]
 * @returns {{ base64: string, mimeType: string, size: number }}
 * @throws {ClientError}
 */
export async function processImage(imagePath, options = {}) {
  const { maxImageSize = 50 * 1024 * 1024 } = options;

  // 格式校验
  if (!validateFormat(imagePath)) {
    const ext = extname(imagePath).toLowerCase();
    const supported = [...SUPPORTED_EXTS].join(", ");
    throw new ClientError(`不支持的图片格式: ${ext || "无扩展名"}`, {
      suggestion: `支持的格式: ${supported}`,
    });
  }

  // 文件存在性与大小校验
  let fileStat;
  try {
    fileStat = statSync(imagePath);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new ClientError(`文件不存在: ${imagePath}`, {
        suggestion: "请检查文件路径是否正确",
      });
    }
    throw err;
  }

  if (fileStat.size === 0) {
    throw new ClientError("图片文件为空", {
      suggestion: "请提供有效的图片文件",
    });
  }

  if (fileStat.size > maxImageSize) {
    const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1);
    const maxMB = (maxImageSize / 1024 / 1024).toFixed(0);
    throw new ClientError(`图片文件过大 (${sizeMB}MB)`, {
      suggestion: `文件大小上限为 ${maxMB}MB。请在 settings.json 中设置 MIMO_MAX_IMAGE_SIZE 调整上限，或压缩图片后重试。`,
    });
  }

  // 读取并编码
  const imageData = readFileSync(imagePath);
  const mimeType = getMimeType(imagePath);
  const base64 = `data:${mimeType};base64,${imageData.toString("base64")}`;

  log("info", "imageProcessor", "image_processed", {
    path: imagePath.slice(-40), // 仅记录末尾，保护隐私
    sizeMB: (fileStat.size / 1024 / 1024).toFixed(2),
    mimeType,
  });

  return { base64, mimeType, size: fileStat.size };
}

log("info", "imageProcessor", "module_loaded");
