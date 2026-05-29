import { BaseProvider } from "./provider.js";
import { log } from "../logger.js";

/**
 * Google Gemini Provider
 * 实现 IVisionProvider 接口，支持 Gemini 2.5 Flash 等视觉模型
 * 认证方式：x-goog-api-key（非 Bearer）
 * 端点格式：{baseUrl}/models/{model}:generateContent
 */
export class GeminiProvider extends BaseProvider {
  /**
   * @param {object} opts
   * @param {string} opts.apiKey - Gemini API Key（AIza...）
   * @param {string} [opts.baseUrl] - 自定义 Base URL，默认 Google API
   * @param {string} [opts.model] - 模型名，默认 gemini-2.5-flash
   * @param {number} [opts.timeoutMs] - 超时时间，默认 60000ms
   */
  constructor({ apiKey, baseUrl, model = "gemini-2.5-flash", timeoutMs = 60_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  }

  get name() { return "gemini"; }

  _buildRequest(image, prompt, options) {
    const images = Array.isArray(image) ? image : [image];
    const parts = images.map(img => {
      const src = typeof img === "string" ? img : img.base64 || img;
      const mime = typeof img === "string" ? (src.match(/^data:(.+?);base64,/) || [,"image/png"])[1] : (img.mimeType || "image/png");
      const b64 = typeof src === "string" ? (src.includes(";base64,") ? src.split(";base64,")[1] : src) : src;
      return { inlineData: { mimeType: mime, data: b64 } };
    });
    parts.push({ text: prompt });

    return {
      url: `${this._baseUrl}/models/${this._model}:generateContent`,
      body: { contents: [{ parts }] },
      headers: { "x-goog-api-key": this._apiKey },
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
    if (!text) throw new Error("Gemini 返回格式异常");
    return text;
  }
}

log("debug", "gemini", "module_loaded");
