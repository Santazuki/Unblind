import { getBaseUrl, getAuthHeader } from "../credentialManager.js";
import { ClientError, ServerError, NetworkError } from "../errorHandler.js";
import { MODE_PROMPTS } from "./provider.js";
import { log } from "../logger.js";

/**
 * @implements {import("./provider.js").IVisionProvider}
 */
export class MimoProvider {
  /**
   * @param {{ apiKey: string, baseUrl?: string, model?: string, timeoutMs?: number }} config
   */
  constructor({ apiKey, baseUrl, model = "mimo-v2.5", timeoutMs = 30_000 }) {
    this._apiKey = apiKey;
    this._baseUrl = baseUrl || getBaseUrl(apiKey);
    this._model = model;
    this._timeoutMs = timeoutMs;
  }

  get name() {
    return "mimo";
  }

  /**
   * @param {import("./provider.js").AnalyzeParams} params
   * @returns {Promise<import("./provider.js").AnalyzeResult>}
   */
  async analyzeImage({ image, prompt, options = {} }) {
    if (!this._apiKey) {
      throw new ClientError("API Key 未配置", {
        suggestion: "请在终端运行配置命令设置 MIMO_API_KEY，或检查 ~/.claude/settings.json",
      });
    }

    const mode = options.mode || "describe";
    if (!MODE_PROMPTS[mode]) {
      throw new ClientError(`未知的分析模式: ${mode}`, {
        suggestion: `支持的模式: ${Object.keys(MODE_PROMPTS).join(", ")}`,
      });
    }

    const userPrompt = prompt || MODE_PROMPTS[mode];
    const startTime = Date.now();

    const requestBody = {
      model: this._model,
      max_tokens: options.maxSize || 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: this._extractMimeType(image),
                data: this._extractBase64(image),
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    };

    const url = `${this._baseUrl}/v1/messages`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);

    try {
      log("info", "mimo", "api_call_start", { model: this._model, mode });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          ...getAuthHeader(this._apiKey),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        const status = response.status;

        if (status === 401 || status === 403) {
          throw new ClientError("API Key 无效或被拒绝", { statusCode: status, suggestion: "请在 Mimo 控制台检查 API Key 是否正确" });
        }
        if (status === 429) {
          throw new ServerError("API 请求频率超限", { statusCode: status, suggestion: "请等待 30 秒后重试（系统将自动重试）" });
        }
        if (status >= 500) {
          throw new ServerError(`Mimo 服务异常`, { statusCode: status, suggestion: "服务暂时不可用，系统将自动重试" });
        }
        throw new ClientError(`API 请求失败`, { statusCode: status, suggestion: errText.slice(0, 200) });
      }

      const result = await response.json();
      const textBlock = result.content?.find((c) => c.type === "text");
      const content = textBlock?.text || JSON.stringify(result, null, 2);
      const processingTimeMs = Date.now() - startTime;

      log("info", "mimo", "api_call_success", {
        model: this._model,
        mode,
        durationMs: processingTimeMs,
      });

      return { content, model: this._model, processingTimeMs };

    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ClientError || err instanceof ServerError) throw err;
      if (err.name === "AbortError") {
        throw new NetworkError(`请求超时 (${this._timeoutMs / 1000}s)`, {
          suggestion: "网络较慢或图片过大，请尝试压缩图片后重试",
        });
      }
      if (err.cause?.code === "ECONNREFUSED" || err.cause?.code === "ENOTFOUND") {
        throw new NetworkError("无法连接到 Mimo 服务", {
          host: this._baseUrl,
          suggestion: "请检查网络连接",
        });
      }
      throw new NetworkError(`网络请求失败: ${err.message}`, {
        suggestion: "请检查网络连接后重试",
      });
    }
  }

  /** @returns {Promise<boolean>} */
  async healthCheck() {
    try {
      const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const result = await this.analyzeImage({
        image: miniPng,
        options: { mode: "describe", maxSize: 50 },
      });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }

  _extractBase64(dataUrl) {
    const idx = dataUrl.indexOf(";base64,");
    return idx >= 0 ? dataUrl.slice(idx + 8) : dataUrl;
  }

  _extractMimeType(dataUrl) {
    const match = dataUrl.match(/^data:(.+?);base64,/);
    return match ? match[1] : "image/png";
  }
}

log("info", "mimo", "module_loaded");
