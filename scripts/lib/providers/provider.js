/**
 * @interface IVisionProvider
 *
 * @property {string} name — Provider 标识名
 * @method analyzeImage — 分析图片并返回文本结果
 * @method healthCheck — 快速连通性检查
 */

/**
 * @typedef {object} AnalyzeParams
 * @property {string} image - Base64 data URL
 * @property {string} [prompt] - 自定义提示词
 * @property {{ maxSize?: number, temperature?: number }} [options]
 *
 * @typedef {object} AnalyzeResult
 * @property {string} content - 分析结果文本
 * @property {string} model - 使用的模型名
 * @property {number} processingTimeMs - 处理耗时
 */

import { log } from "../logger.js";

/** 5 种分析模式对应的 prompt */
export const MODE_PROMPTS = {
  describe:
    "Provide a detailed description of this image. Include: main subject, setting/background, colors/style, any text visible, notable objects, and overall composition.",
  ocr:
    "Extract all text visible in this image verbatim. Preserve structure and formatting (headers, lists, columns). If no text is found, say so.",
  "ui-review":
    "You are a UI/UX design reviewer. Analyze this interface mockup or design. Provide: (1) Strengths — what works well, (2) Issues — usability or design problems, (3) Specific, actionable suggestions for improvement. Be constructive and detailed.",
  "chart-data":
    "Extract all data from this chart or graph. List: chart title, axis labels, all data points/series with values if readable, and a brief summary of the trend.",
  "object-detect":
    "List all distinct objects, people, and activities you can identify. For each, describe what it is and its approximate location in the image.",
  compare:
    "You are an image comparison expert. Multiple images have been provided. "
    + "For each image, give a brief 1-2 sentence description. "
    + "Then analyze them together:\n"
    + "1. **Similarities** — What visual elements, subjects, colors, layout patterns, or compositions do the images share?\n"
    + "2. **Differences** — How do they differ in content, style, focus, quality, or structure?\n"
    + "3. **Summary** — Synthesize the comparison into a clear conclusion.\n"
    + "Refer to images as Image 1, Image 2, etc. when mentioning specific ones.",
};

/** 有效模式列表 */
export const VALID_MODES = Object.keys(MODE_PROMPTS);

/**
 * 运行时校验对象是否满足 IVisionProvider 接口
 * @param {object} obj
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateProvider(obj) {
  const missing = [];
  if (typeof obj?.name !== "string") missing.push("name (string)");
  if (typeof obj?.analyzeImage !== "function") missing.push("analyzeImage(params)");
  if (typeof obj?.healthCheck !== "function") missing.push("healthCheck()");
  return { valid: missing.length === 0, missing };
}

log("debug", "provider", "module_loaded");
