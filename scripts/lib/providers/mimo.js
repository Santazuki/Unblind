import { getBaseUrl, getAuthHeader } from "../credentialManager.js";
import { BaseProvider } from "./provider.js";
import { ClientError } from "../errorHandler.js";
import { log } from "../logger.js";

export class MimoProvider extends BaseProvider {
  constructor({ apiKey, baseUrl, model = "mimo-v2.5", timeoutMs = 30_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl || getBaseUrl(apiKey);
  }

  get name() { return "mimo"; }

  _buildRequest(images, prompt, options) {
    const content = [];

    if (Array.isArray(images)) {
      // Multi-image: each element is { base64, mimeType }
      for (const img of images) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: img.mimeType, data: this._b64(img.base64) },
        });
      }
    } else {
      // Single image (backward-compatible)
      content.push({
        type: "image",
        source: { type: "base64", media_type: this._mime(images), data: this._b64(images) },
      });
    }

    content.push({ type: "text", text: prompt });

    return {
      url: `${this._baseUrl}/v1/messages`,
      body: {
        model: this._model, max_tokens: options.maxSize || 2048,
        messages: [{ role: "user", content }]
      },
      headers: { "anthropic-version": "2023-06-01", ...getAuthHeader(this._apiKey) }
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    const tb = data.content?.find(c => c.type === "text");
    if (!tb?.text) throw new ClientError("API 返回格式异常，未找到文本内容");
    return tb.text;
  }

  _b64(d) { const i = d.indexOf(";base64,"); return i >= 0 ? d.slice(i + 8) : d; }
  _mime(d) { const m = d.match(/^data:(.+?);base64,/); return m ? m[1] : "image/png"; }
}
log("debug", "mimo", "module_loaded");
