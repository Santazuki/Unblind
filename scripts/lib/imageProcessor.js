import { statSync } from "fs";
import { readFile } from "fs/promises";
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
      throw new ClientError("文件不存在", {
        suggestion: "请检查文件路径是否正确",
      });
    }
    throw new ClientError(`无法读取文件: ${err.code || err.message}`, {
      suggestion: "请检查文件权限和路径是否正确",
    });
  }

  if (!fileStat.isFile()) throw new ClientError("路径不是文件");

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
  const imageData = await readFile(imagePath);
  // 魔数字节校验（SVG 为文本格式，跳过）
  const magicExt = extname(imagePath).toLowerCase();
  if (magicExt !== ".svg") {
    const magicBuf = imageData.slice(0, 4);
    const magic = new Uint8Array(magicBuf);
    const isPNG  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47;
    const isJPEG = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF;
    const isGIF  = magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x38;
    const isWebP = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46;
    const isBMP  = magic[0] === 0x42 && magic[1] === 0x4D;
    if (!(isPNG || isJPEG || isGIF || isWebP || isBMP)) {
      throw new ClientError("文件内容与扩展名不匹配");
    }
  }

  const mimeType = getMimeType(imagePath);
  const base64 = `data:${mimeType};base64,${imageData.toString("base64")}`;

  log("info", "imageProcessor", "image_processed", {
    path: imagePath.slice(-40), // 仅记录末尾，保护隐私
    sizeMB: (fileStat.size / 1024 / 1024).toFixed(2),
    mimeType,
  });

  return { base64, mimeType, size: fileStat.size };
}

log("debug", "imageProcessor", "module_loaded");
